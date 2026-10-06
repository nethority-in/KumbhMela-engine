"use strict";

/* Unit tests for the answer engine and the guardrails.
   Run: node bot/test.js
   These are the project's own rules expressed as assertions - if a test fails,
   the bot has started breaking a promise the site also makes. */

const assert = require("node:assert");
const {
  answer,
  detectLang,
  parseDate,
  quietDays,
  royalDays,
} = require("./answer");
const data = require("./data");
const store = require("./store");

const days = data.calendar.days || [];
let pass = 0,
  fail = 0;

function t(name, fn) {
  try {
    fn();
    pass++;
    console.log("  ok  " + name);
  } catch (e) {
    fail++;
    console.log("  FAIL " + name + "\n       " + e.message);
  }
}

const A = (q, lang) => answer(q, data, lang).text;
const ALL_DAYS = [
  A("which days are auspicious", "en"),
  A("कौन से दिन शुभ हैं", "hi"),
  A("कोणते दिवस शुभ आहेत", "mr"),
];

console.log("\ndata contract");
t("102 days present", () => assert.strictEqual(days.length, 102));
t("exactly 3 royal baths", () => assert.strictEqual(royalDays(days).length, 3));
t("every day has a band", () =>
  assert.ok(days.every((d) => d.band && d.band.label_en)),
);
t("every day has a reason", () =>
  assert.ok(days.every((d) => (d.headline_reason || "").length > 0)),
);
t("every day has a breakdown", () =>
  assert.ok(
    days.every((d) => Array.isArray(d.breakdown) && d.breakdown.length),
  ),
);
t("band labels exist in all 3 languages", () =>
  assert.ok(
    days.every((d) => d.band.label_en && d.band.label_hi && d.band.label_mr),
  ),
);

console.log("\nproject promises, enforced");
t("no reply ever says safe or unsafe", () => {
  for (const s of ALL_DAYS) {
    assert.ok(!/\bsafe\b|\bunsafe\b/i.test(s), "found safe/unsafe");
  }
});
t("no reply ever says avoid or best day", () => {
  for (const s of ALL_DAYS) {
    assert.ok(!/\bavoid\b|\bbest day\b/i.test(s), "found avoid/best day");
  }
});
t("no reply contains an exclamation mark", () => {
  for (const s of ALL_DAYS) assert.ok(!s.includes("!"), "found !");
});
t("every crowd answer is labelled an estimate", () => {
  for (const lang of ["en", "hi", "mr"]) {
    const s = A(lang === "en" ? "crowd" : lang === "hi" ? "भीड़" : "भीड", lang);
    assert.ok(
      /estimate/i.test(s) || /अनुमानित/.test(s) || /अंदाजे/.test(s),
      `${lang}: not labelled`,
    );
  }
});
t("every answer ends with the follow-the-authority tail", () => {
  const tail = /police|पुलिस|पोलीस/;
  assert.ok(tail.test(A("quiet days", "en")));
  assert.ok(tail.test(A("शांत दिन", "hi")));
  assert.ok(tail.test(A("शांत दिवस", "mr")));
});
t("no answer leaks the raw 0-100 score", () => {
  const s = A("2 august 2027", "en");
  const score = days.find((d) => d.gregorian_date === "2027-08-02").score;
  assert.ok(!new RegExp("\\b" + score + "\\b").test(s), "raw score leaked");
});

console.log("\nlanguage detection");
t("english", () => assert.strictEqual(detectLang("which day is quiet"), "en"));
t("hindi", () => assert.strictEqual(detectLang("भीड़ कितनी है"), "hi"));
t("marathi", () => assert.strictEqual(detectLang("भीड किती आहे"), "mr"));

console.log("\ndate parsing");
t("2 august", () =>
  assert.deepStrictEqual(parseDate("2 august"), { d: 2, m: 8 }),
);
t("aug 31", () => assert.deepStrictEqual(parseDate("aug 31"), { d: 31, m: 8 }));
t("11/9/2027", () =>
  assert.deepStrictEqual(parseDate("11/9/2027"), { d: 11, m: 9, y: "2027" }),
);
t("specific date answers with that day", () => {
  const s = A("2 august", "en");
  assert.ok(s.includes("August"), s.slice(0, 60));
});

console.log("\nintents");
t("quiet returns the three calmest days, excludes royal baths", () => {
  const q = quietDays(days, 3);
  assert.strictEqual(q.length, 3);
  assert.ok(q.every((d) => d.classification !== "amrit_snan"));
});
t("helpline gives 112 and refuses to invent mela numbers", () => {
  const s = A("emergency helpline", "en");
  assert.ok(s.includes("112"));
  assert.ok(s.includes("change"), "should say mela numbers change");
});
t("akhara question refuses to guess", () => {
  const s = A("which akhara bathes where", "en");
  assert.ok(/not something I will guess|will not guess/i.test(s));
  assert.ok(!/Vaishnava.*Trimbakeshwar/.test(s));
});
t("unknown falls back helpfully", () =>
  assert.ok(/did not understand|understand/i.test(A("asdf qwerty", "en"))),
);
t("travel question refuses to invent routes", () => {
  const s = A("how do I reach nashik by train", "en");
  assert.ok(/website/i.test(s) && /not keep travel routes/i.test(s));
});

console.log("\nguardrails");
t("phone hash is salted and stable", () => {
  const h1 = store.hashPhone("919999999999");
  const h2 = store.hashPhone("919999999999");
  assert.strictEqual(h1, h2);
  assert.strictEqual(h1.length, 32);
  assert.ok(!h1.includes("9999"));
});
t("rate limit allows then blocks at the daily cap", () => {
  const g = {
    perDay: 3,
    perMin: 99,
    dailyCap: 1e9,
    tiers: { warn_at_pct: 70, soft_kill_at_pct: 90, hard_kill_at_pct: 100 },
    rate: 0.115,
    freePerMonth: 1e9,
    llmShare: 0.3,
    llmPerMsg: 0.05,
  };
  const p = "+910000000" + Math.floor(Math.random() * 100000);
  for (let i = 0; i < 3; i++)
    assert.strictEqual(store.check(p, g).allowed, true, "call " + i);
  assert.strictEqual(store.check(p, g).allowed, false);
});
t("hard kill blocks everything", () => {
  const g = {
    perDay: 99,
    perMin: 99,
    dailyCap: 1e9,
    tiers: { warn_at_pct: 70, soft_kill_at_pct: 90, hard_kill_at_pct: 100 },
    rate: 0.115,
    freePerMonth: 1e9,
    llmShare: 0.3,
    llmPerMsg: 0.05,
  };
  store.state.hardKill = true;
  assert.strictEqual(store.check("+911111111111", g).allowed, false);
  store.state.hardKill = false;
});
t("cost: the first 1000 messages of a month are free, then billed", () => {
  const base = {
    perDay: 999,
    perMin: 999,
    dailyCap: 1e9,
    tiers: { warn_at_pct: 70, soft_kill_at_pct: 90, hard_kill_at_pct: 100 },
    rate: 0.115,
    freePerMonth: 1000,
    llmShare: 0.3,
    llmPerMsg: 0.05,
  };
  const p = "+913333333" + Math.floor(Math.random() * 100000);
  const first = store.record(p, "test", false, base);
  assert.strictEqual(
    first.billable,
    false,
    "first message should be inside the free allowance",
  );
  assert.strictEqual(first.metaInr, 0, "first message must cost nothing");

  const g2 = { ...base, freePerMonth: 1 }; /* only the first is free */
  const p2 = "+914444444" + Math.floor(Math.random() * 100000);
  const a = store.record(p2, "test", false, g2);
  const b = store.record(p2, "test", false, g2);
  assert.strictEqual(a.billable, false, "first message is free");
  assert.strictEqual(b.billable, true, "second message should be billable");
  assert.ok(
    Math.abs(b.metaInr - 0.115) < 1e-9,
    "rate should be 0.115, got " + b.metaInr,
  );
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
