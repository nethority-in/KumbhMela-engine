"use strict";

/* Evaluation set runner (deliverable 5).
   Executes every case in eval/eval-set.json against the live answer engine and
   checks three things: the intent is the one we expected, the required facts are
   present, and the forbidden phrasings are absent.
   Run: node bot/eval.js */

const fs = require("node:fs");
const path = require("node:path");
const { answer, detectLang } = require("./answer");
const data = require("./data");

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "eval/eval-set.json"), "utf8"));

let pass = 0;
const failures = [];

for (const c of cases) {
  const res = answer(c.question, data, c.lang);
  const errs = [];

  if (c.intent && res.intent !== c.intent) errs.push(`intent ${res.intent} != ${c.intent}`);

  const detected = detectLang(c.question);
  if (c.lang !== "auto" && detected !== c.lang) errs.push(`lang ${detected} != ${c.lang}`);

  for (const s of c.must_contain || []) {
    if (!res.text.includes(s)) errs.push(`missing "${s}"`);
  }
  for (const s of c.must_not_contain || []) {
    if (res.text.includes(s)) errs.push(`forbidden "${s}"`);
  }

  if (errs.length) failures.push({ id: c.id, q: c.question, errs });
  else pass++;
}

console.log(`\nEval set — ${cases.length} cases, ${pass} passed, ${failures.length} failed`);
for (const f of failures) {
  console.log(`  FAIL ${f.id}  "${f.q}"`);
  for (const e of f.errs) console.log(`        ${e}`);
}
if (failures.length) {
  const byLang = {};
  for (const c of cases) byLang[c.lang] = (byLang[c.lang] || 0) + 1;
  console.log(`\n  coverage: ${Object.entries(byLang).map(([k, v]) => `${k}=${v}`).join(" ")}`);
}
console.log();
process.exit(failures.length ? 1 : 0);
