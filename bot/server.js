"use strict";

/* Simhastha Kumbh 2027 — WhatsApp information bot.
   One message per answer. Facts only from data/dist/calendar.json and
   data/golden-source.json. Never a model-generated date. */

const http = require("node:http");
const { answer } = require("./answer");
const { sendText, ack, DRY } = require("./meta");
const store = require("./store");
const data = require("./data");

const g = store.load(data.cost);
store.loadPersisted();

const PORT = Number(process.env.PORT || 8080);
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "replace-me";
const START_LANG = process.env.START_LANG || "auto";

function langFor(waId, text, sessions) {
  if (START_LANG !== "auto") return START_LANG;
  const s = sessions.get(waId);
  if (s && s.lang) return s.lang;
  const { detectLang } = require("./answer");
  const lang = detectLang(text);
  sessions.set(waId, { lang });
  return lang;
}

const sessions = new Map();

async function handleMessage(from, text) {
  const gate = store.check(from, g);

  if (!gate.allowed) {
    if (gate.limited) {
      /* one cached limit notice, then silence for that number */
      const lang = langFor(from, text, sessions);
      const { T } = require("./i18n");
      const notice = lang === "hi"
        ? "आज की सीमा पूरी हो गई है। कल फिर पूछ सकते हैं। आपातकाल के लिए 112।"
        : lang === "mr"
        ? "आजची मर्यादा संपली आहे. उद्या पुन्हा विचारू शकता. आणीबाणीसाठी 112."
        : "That is all for today. You can ask again tomorrow. For an emergency, 112.";
      await sendText(from, notice);
      store.record(from, "rate_limit_notice", false, g);
    } else {
      console.log(`[gate] reply suppressed for ${store.hashPhone(from)}: ${gate.reason}`);
    }
    return gate.reason;
  }

  const lang = langFor(from, text, sessions);
  const res = answer(text, data, lang);
  const usedLlm = false; /* cache-first: the answer engine never calls a model */
  const spend = store.record(from, res.intent, usedLlm, g);
  await sendText(from, res.text);
  const t = store.tier(g);
  console.log(
    `[bot] ${res.intent}/${lang} meta=₹${spend.metaInr.toFixed(3)} day=₹${spend.dailyInr.toFixed(3)} (${t.pct}%)` +
    (t.soft ? " SOFT-KILL" : "") + (t.hard ? " HARD-KILL" : "")
  );
  return res.intent;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");

    if (req.method === "GET" && url.pathname === "/webhook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end(challenge || "");
      }
      res.writeHead(403); return res.end("forbidden");
    }

    if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        ok: true,
        dry_run: DRY,
        days: (data.calendar.days || []).length,
        table_version: data.calendar.table_version,
        hard_kill: store.state.hardKill,
        soft_kill: store.state.softKill,
      }));
    }

    if (req.method === "POST" && url.pathname === "/webhook") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { /* ignore */ }

      const jobs = [];
      for (const entry of body.entry || []) {
        for (const ch of entry.changes || []) {
          const msg = ch.value && ch.value.messages && ch.value.messages[0];
          if (msg && msg.type === "text") {
            const from = msg.from;
            const text = msg.text.body;
            jobs.push(handleMessage(from, text).catch((e) => console.error("[bot] error:", e.message)));
          }
        }
      }
      ack(res);              /* always ack first — Meta retries on anything slow */
      await Promise.all(jobs);
      return;
    }

    res.writeHead(404); res.end("not found");
  } catch (e) {
    console.error("[server]", e);
    if (!res.headersSent) { res.writeHead(500); res.end("error"); }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`kumbh bot listening on :${PORT}  dry_run=${DRY}  days=${(data.calendar.days || []).length}`);
});
