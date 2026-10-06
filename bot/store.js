"use strict";

/* Spend and abuse guardrails, exactly as specified in bot/cost.config.json.
   The only real lever on Meta billing is the NUMBER of replies sent, so both kill
   tiers reduce replies. A reply we do not send is a reply we are not charged for. */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DATA_DIR = process.env.BOT_DATA_DIR || path.join(__dirname, ".data");
const SALT = process.env.BOT_HASH_SALT || "change-me-before-launch";
const LOG = path.join(DATA_DIR, "conversations.jsonl");

/* operator switches */
const state = {
  hardKill: false,
  softKill: false,
};

function hashPhone(phone) {
  return crypto
    .createHash("sha256")
    .update(SALT + "|" + phone)
    .digest("hex")
    .slice(0, 32);
}

function load(cost) {
  return {
    perDay: cost.guardrails.per_number_rate_limit.messages_per_number_per_day,
    perMin: cost.guardrails.per_number_rate_limit.burst_per_number_per_minute,
    onExceed: cost.guardrails.per_number_rate_limit.on_exceed,
    dailyCap: cost.guardrails.global_daily_spend_cap_inr.value,
    tiers: cost.guardrails.global_daily_spend_cap_inr.tiers,
    rate: cost.meta_rates_india_inr.service_message.value,
    freePerMonth:
      cost.meta_free_allowances.service_messages_free_per_number_per_month
        .value,
    llmShare: cost.llm_cost_estimate.share_of_messages_using_llm.value,
    llmPerMsg: cost.llm_cost_estimate.avg_inr_per_llm_message.value,
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);
const minuteKey = () => new Date().toISOString().slice(0, 16);

/* in-memory index; flushed to disk so a restart does not reset the caps */
const perNumber = new Map(); // hash -> { day, dayCount, minute, minuteCount, month, monthSent }
let dailyInr = 0;
let dailyDate = today();

function loadPersisted() {
  try {
    const raw = fs.readFileSync(LOG, "utf8").trim();
    if (!raw) return;
    for (const line of raw.split("\n")) {
      const r = JSON.parse(line);
      if (r.date !== today()) continue;
      dailyInr += r.meta_inr || 0;
      const cur = perNumber.get(r.phone_hash) || {
        day: r.date,
        dayCount: 0,
        minute: "",
        minuteCount: 0,
        month: r.month,
        monthSent: 0,
      };
      cur.dayCount += r.outbound_count || 0;
      cur.monthSent += r.outbound_count || 0;
      perNumber.set(r.phone_hash, cur);
    }
  } catch {
    /* first run */
  }
}

function append(record) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify(record) + "\n");
  } catch (e) {
    console.error("[store] log write failed:", e.message);
  }
}

/* Gate + reserve in one step: a passing check consumes one slot of the caller's
   quota, so a caller that never calls record() still cannot exceed the limit. */
function check(phone, g) {
  const nowDay = today(),
    nowMin = minuteKey(),
    nowMon = monthKey();
  if (dailyDate !== nowDay) {
    dailyDate = nowDay;
    dailyInr = 0;
  }

  if (state.hardKill) return { allowed: false, reason: "hard_kill" };
  if (dailyInr >= g.dailyCap) return { allowed: false, reason: "daily_cap" };

  const h = hashPhone(phone);
  let r = perNumber.get(h);
  if (!r || r.day !== nowDay)
    r = {
      day: nowDay,
      dayCount: 0,
      minute: "",
      minuteCount: 0,
      month: nowMon,
      monthSent: 0,
    };
  if (r.minute !== nowMin) {
    r.minute = nowMin;
    r.minuteCount = 0;
  }

  if (r.dayCount >= g.perDay)
    return { allowed: false, reason: "rate_day", limited: true };
  if (r.minuteCount >= g.perMin)
    return { allowed: false, reason: "rate_min", limited: true };

  r.dayCount += 1;
  r.minuteCount += 1;
  perNumber.set(h, r);
  return { allowed: true };
}

/* Logs spend. Counters were already consumed by check(), so they are not
   touched here - this must stay the single place Meta cost is accounted. */
function record(phone, intent, usedLlm, g) {
  const nowDay = today();
  const h = hashPhone(phone);
  let r = perNumber.get(h);
  if (!r)
    r = {
      day: today(),
      dayCount: 0,
      minute: "",
      minuteCount: 0,
      month: monthKey(),
      monthSent: 0,
    };

  /* billable === "Meta charged for this one". The first freePerMonth messages of
     the month cost nothing; only past that does the service-message rate apply. */
  const billable = r.monthSent >= g.freePerMonth;
  const metaInr = billable ? g.rate : 0;
  const llmInr = usedLlm ? g.llmPerMsg : 0;

  r.monthSent += 1;
  perNumber.set(h, r);
  dailyInr += metaInr + llmInr;

  append({
    ts: new Date().toISOString(),
    date: nowDay,
    month: monthKey(),
    phone_hash: h,
    intent,
    outbound_count: 1,
    used_llm: !!usedLlm,
    meta_inr: metaInr,
    llm_inr: llmInr,
    window_state: billable ? "free_allowance" : "billable",
    daily_inr: Number(dailyInr.toFixed(4)),
  });

  return { metaInr, llmInr, billable, dailyInr };
}

function tier(g) {
  const pct = (dailyInr / g.dailyCap) * 100;
  if (pct >= g.tiers.hard_kill_at_pct) state.hardKill = true;
  else if (pct >= g.tiers.soft_kill_at_pct) state.softKill = true;
  return {
    pct: Number(pct.toFixed(1)),
    soft: state.softKill,
    hard: state.hardKill,
  };
}

module.exports = {
  state,
  load,
  check,
  record,
  tier,
  hashPhone,
  loadPersisted,
  DATA_DIR,
};
