"use strict";

const fs = require("node:fs");
const path = require("node:path");

function loadJson(rel) {
  const p = path.join(__dirname, "..", rel);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const calendar = loadJson("data/dist/calendar.json");
const golden = loadJson("data/golden-source.json");
const cost = loadJson("bot/cost.config.json");

module.exports = { calendar, golden, cost };
