"use strict";

/* Simhastha Kumbh 2027 - WhatsApp information bot.
   One message per answer. Facts only from data/dist/calendar.json and
   data/golden-source.json. Never a model-generated date. */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { answer } = require("./answer");
const { sendText, ack, DRY } = require("./meta");
const store = require("./store");
const data = require("./data");
const { pool } = require("./db");

const g = store.load(data.cost);
store.loadPersisted();

const PORT = Number(process.env.PORT || 8080);
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "replace-me";
const START_LANG = process.env.START_LANG || "auto";

/* ------------------------------------------------------------------ */
/* /stats — read-only dashboard of what the bot has answered.        */
/* Protected by a bearer token.                                     */
/* ------------------------------------------------------------------ */
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "local-dev-token";

function aggregateStats() {
  const rows = [];
  try {
    const raw = fs.readFileSync(store.DATA_DIR + "/conversations.jsonl", "utf8");
    for (const line of raw.split("\n")) {
      if (line.trim()) rows.push(JSON.parse(line));
    }
  } catch { /* no conversations yet */ }

  const byIntent = {};
  const byLang = {};
  let totalFree = 0;
  let totalBillable = 0;
  let totalMetaInr = 0;
  let totalLlmInr = 0;
  const byDay = {};

  for (const r of rows) {
    byIntent[r.intent] = (byIntent[r.intent] || 0) + 1;
    byLang[r.lang || "en"] = (byLang[r.lang || "en"] || 0) + 1;
    if (r.window_state === "free_allowance") totalFree++;
    else totalBillable++;
    totalMetaInr += r.meta_inr || 0;
    totalLlmInr += r.llm_inr || 0;
    const day = r.date;
    byDay[day] = byDay[day] || { messages: 0, inr: 0 };
    byDay[day].messages++;
    byDay[day].inr += (r.meta_inr || 0) + (r.llm_inr || 0);
  }

  return { totalFree, totalBillable, totalMetaInr, totalLlmInr, byIntent, byLang, byDay, count: rows.length };
}

function statsHTML(s) {
  const intentRows = Object.entries(s.byIntent)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
  const langRows = Object.entries(s.byLang)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
  const dayRows = Object.entries(s.byDay)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([d, v]) => `<tr><td>${d}</td><td>${v.messages}</td><td>₹${v.inr.toFixed(4)}</td></tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Kumbh Bot — Conversation Stats</title>
<style>
 body { font-family: system-ui, sans-serif; max-width: 840px; margin: 2rem auto; padding: 0 1rem; background:#0d0c0b; color:#f4efe6; }
 h1 { font-weight: 500; font-size: 1.6rem; }
 h2 { margin-top: 2rem; font-weight: 500; font-size: 1.1rem; color:#e0954a; text-transform: uppercase; letter-spacing: .14em; }
 table { width: 100%; border-collapse: collapse; }
 td, th { padding: .4rem .6rem; text-align: left; border-bottom: 1px solid #2a2520; }
 th { color: #cdc3b4; font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; }
 .note { padding: .8rem 1rem; border-left: 3px solid #e0954a; background: rgba(224,149,74,.07); border-radius: 0 .5rem .5rem 0; font-size: .9rem; }
</style></head><body>
<h1>Kumbh 2027 — Bot stats</h1>
<p class="note">Generated from <code>conversations.jsonl</code>. Raw phone numbers are never stored — only a salted hash. ₹ costs use <code>cost.config.json</code> rates (placeholder until Meta rates are pinned).</p>
<h2>Summary</h2>
<table><tr><th>Total conversations</th><td>${s.count}</td></tr>
<tr><th>Free (within first 1,000/month)</th><td>${s.totalFree}</td></tr>
<tr><th>Billable</th><td>${s.totalBillable}</td></tr>
<tr><th>Meta cost</th><td>₹${s.totalMetaInr.toFixed(4)}</td></tr>
<tr><th>LLM cost</th><td>₹${s.totalLlmInr.toFixed(4)}</td></tr>
</table>
<h2>By language</h2><table><tr><th>Code</th><th>Count</th></tr>${langRows}</table>
<h2>By intent</h2><table><tr><th>Intent</th><th>Count</th></tr>${intentRows}</table>
<h2>By day</h2><table><tr><th>Date</th><th>Messages</th><th>Cost</th></tr>${dayRows}</table>
</body></html>`;
}

const sessions = new Map();

function langFor(waId, text, sessions) {
  if (START_LANG !== "auto") return START_LANG;
  const s = sessions.get(waId);
  if (s && s.lang) return s.lang;
  const { detectLang } = require("./answer");
  const lang = detectLang(text);
  sessions.set(waId, { lang });
  return lang;
}

async function handleMessage(from, text) {
  const gate = store.check(from, g);

  if (!gate.allowed) {
    if (gate.limited) {
      /* one cached limit notice, then silence for that number */
      const lang = langFor(from, text, sessions);
      const { T } = require("./i18n");
      const notice =
        lang === "hi"
          ? "आज की सीमा पूरी हो गई है। कल फिर पूछ सकते हैं। आपातकाल के लिए 112।"
          : lang === "mr"
            ? "आजची मर्यादा संपली आहे. उद्या पुन्हा विचारू शकता. आणीबाणीसाठी 112."
            : "That is all for today. You can ask again tomorrow. For an emergency, 112.";
      await sendText(from, notice);
      await store.record(from, "rate_limit_notice", false, g, lang);
    } else {
      console.log(
        `[gate] reply suppressed for ${store.hashPhone(from)}: ${gate.reason}`,
      );
    }
    return gate.reason;
  }

  const lang = langFor(from, text, sessions);
  // Record the incoming user message so it is searchable.
  try {
    await pool.query(
      "INSERT INTO conversations (phone_hash, lang, role, text, intent, used_llm, meta_inr, llm_inr, window_state, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())",
      [store.hashPhone(from), lang, "user", text, null, false, 0, 0, "free"]
    );
  } catch (e) {
    console.error("[server] failed to record user message:", e.message);
  }

  const res = answer(text, data, lang);
  const usedLlm = false; /* cache-first: the answer engine never calls a model */
  const spend = await store.record(from, res.intent, usedLlm, g, res.lang);
  await sendText(from, res.text);
  const t = store.tier(g);
  console.log(
    `[bot] ${res.intent}/${lang} meta=₹${spend.metaInr.toFixed(3)} day=₹${spend.dailyInr.toFixed(3)} (${t.pct}%)` +
      (t.soft ? " SOFT-KILL" : "") +
      (t.hard ? " HARD-KILL" : ""),
  );
  return res.intent;
}

const server = http.createServer(async (req, res) => {
  // All endpoints are same-origin for the React app? Not quite - the website is
  // at app.mahakumbh.net and the API at api.mahakumbh.net, so we need CORS headers.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
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
      res.writeHead(403);
      return res.end("forbidden");
    }

    if (
      req.method === "GET" &&
      (url.pathname === "/healthz" || url.pathname === "/")
    ) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: true,
          dry_run: DRY,
          days: (data.calendar.days || []).length,
          table_version: data.calendar.table_version,
          hard_kill: store.state.hardKill,
          soft_kill: store.state.softKill,
        }),
      );
    }

    if (req.method === "GET" && url.pathname === "/stats") {
      const token = (req.headers.authorization || "").replace(/^Bearer /, "");
      if (token !== DASHBOARD_TOKEN) {
        res.writeHead(401, { "WWW-Authenticate": "Bearer" });
        return res.end("Unauthorised");
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(statsHTML(aggregateStats()));
    }

    if (req.method === "POST" && url.pathname === "/chat") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {}

      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'API key not configured' }));
      }

      const systemPrompt = [
        'You are a helpful assistant for the Simhastha Kumbh Mela 2027 guide website.',
        'Answer questions about bathing days, crowd estimates, travel tips, and practical info.',
        'Keep answers concise, friendly, and in the same language the user wrote.',
        'Never say a day is safe or unsafe. Never recommend skipping a day.',
        'All crowd figures are estimates. Use the calendar data when possible.',
      ].join(' ');

      const messages = body.messages || [{ role: 'user', content: body.text || '' }];

      // Simple one-retry pattern: if the API is overloaded or rate-limited,
      // wait 2 seconds and try once more. No exponential backoff math needed
      // for a small project site.
      const makeAiCall = async () => {
        return await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages,
          }),
        });
      };

      try {
        let aiRes = await makeAiCall();

        if (aiRes.status === 429 || aiRes.status >= 500) {
          await new Promise(r => setTimeout(r, 2000));
          aiRes = await makeAiCall();
        }

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          res.writeHead(aiRes.status, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: errText }));
        }

        const aiData = await aiRes.json();
        const reply = aiData.content?.[0]?.text || 'Sorry, I could not generate a response.';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ reply }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    if (req.method === "POST" && url.pathname === "/track-visit") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {}
      try {
        await pool.query(
          "INSERT INTO website_visits (page, device, lang, created_at) VALUES ($1,$2,$3,NOW())",
          [body.page || "/", body.device || "desktop", body.lang || "en"]
        );
      } catch {}
      return ack(res);
    }

    if (req.method === "GET" && url.pathname === "/stats/json") {
      try {
        const [convRes, visitRes, byLang, byIntent, byDay, topMsgs] = await Promise.all([
          pool.query("SELECT COUNT(*)::int AS total_conversations, COUNT(*) FILTER (WHERE window_state='free_allowance')::int AS free_count FROM conversations"),
          pool.query("SELECT COUNT(*)::int AS total_visits FROM website_visits"),
          pool.query("SELECT lang, COUNT(*)::int AS count FROM conversations GROUP BY lang"),
          pool.query("SELECT intent, COUNT(*)::int AS count FROM conversations WHERE intent IS NOT NULL GROUP BY intent"),
          pool.query("SELECT DATE(created_at) AS day, COUNT(*)::int AS messages FROM conversations GROUP BY DATE(created_at) ORDER BY day DESC"),
          pool.query("SELECT text, COUNT(*)::int AS count FROM conversations WHERE role='user' GROUP BY text ORDER BY count DESC LIMIT 10"),
        ]);
        return res.end(JSON.stringify({
          total_conversations: convRes.rows[0].total_conversations,
          free_conversations: convRes.rows[0].free_count,
          total_visits: visitRes.rows[0].total_visits,
          by_lang: byLang.rows,
          by_intent: byIntent.rows,
          by_day: byDay.rows,
          top_messages: topMsgs.rows,
        }));
      } catch (e) {
        res.writeHead(500); return res.end(JSON.stringify({ error: e.message }));
      }
    }

    if (req.method === "POST" && url.pathname === "/webhook") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        /* ignore */
      }

      const jobs = [];
      for (const entry of body.entry || []) {
        for (const ch of entry.changes || []) {
          const msg = ch.value && ch.value.messages && ch.value.messages[0];
          if (msg && msg.type === "text") {
            const from = msg.from;
            const text = msg.text.body;
            jobs.push(
              handleMessage(from, text).catch((e) =>
                console.error("[bot] error:", e.message),
              ),
            );
          }
        }
      }
      ack(res); /* always ack first - Meta retries on anything slow */
      await Promise.all(jobs);
      return;
    }

    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    console.error("[server]", e);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("error");
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `kumbh bot listening on :${PORT}  dry_run=${DRY}  days=${(data.calendar.days || []).length}`,
  );
});
