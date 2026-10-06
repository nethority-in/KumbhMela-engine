"use strict";

/* WhatsApp Cloud API sender. Direct (no BSP).
   DRY_RUN=true makes every send a no-op that only logs, so the whole bot can be
   exercised end to end without Meta credentials or spending anything. */

const DRY = process.env.DRY_RUN !== "false";
const TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const API_VER = process.env.WHATSAPP_API_VERSION || "v21.0";

async function sendText(to, body) {
  if (DRY) {
    console.log(`[dry-run] -> ${to}: ${JSON.stringify(body.slice(0, 120))}...`);
    return { ok: true, dry: true };
  }
  if (!TOKEN || !PHONE_ID) throw new Error("WHATSAPP_TOKEN and WHATSAPP_PHONE_ID must be set when DRY_RUN=false");

  const url = `https://graph.facebook.com/${API_VER}/${PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[meta] send failed", res.status, JSON.stringify(json));
    throw new Error(`meta send failed: ${res.status}`);
  }
  return json;
}

/* Meta retries on anything that is not a fast 200, so we always 200. */
function ack(res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

module.exports = { sendText, ack, DRY };
