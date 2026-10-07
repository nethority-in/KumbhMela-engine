"use strict";

/* WhatsApp sender via Twilio.
   DRY_RUN=true makes every send a no-op that only logs, so the bot can be
   exercised without Twilio credentials or spending anything. */

const DRY = process.env.DRY_RUN !== "false";
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "";

const twilio = require("twilio");
const client = DRY ? null : twilio(ACCOUNT_SID, AUTH_TOKEN);

async function sendText(to, body) {
  if (DRY) {
    console.log(`[dry-run] -> ${to}: ${JSON.stringify(body.slice(0, 120))}...`);
    return { ok: true, dry: true };
  }
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER must be set when DRY_RUN=false");
  }

  // Twilio uses whatsapp:+14155238886 as 'from', and the to must be in same format
  const from = FROM_NUMBER.startsWith("whatsapp:") ? FROM_NUMBER : `whatsapp:${FROM_NUMBER}`;
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  try {
    const message = await client.messages.create({
      from,
      to: toFormatted,
      body,
    });
    return { ok: true, sid: message.sid };
  } catch (err) {
    console.error("[twilio] send failed:", err.message);
    throw new Error(`twilio send failed: ${err.message}`);
  }
}

/* Twilio retries on non-200, so we always 200. */
function ack(res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

module.exports = { sendText, ack, DRY };
