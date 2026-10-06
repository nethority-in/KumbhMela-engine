# Changelog — date table & crowd model

Every change to `data/golden-source.json` and `crowd-model/weights.config.json`
is recorded here, dated and reasoned. Newest first.

## 2026-10-06 — Pipeline first run, and D4 bot built

**Engine (`engine/panchang_engine.py`)**
- Fixed a crash that had prevented the engine from ever running: `swe.rise_trans`
  was called with longitude and latitude as separate arguments, but the binding
  takes `geopos` as one three-element sequence. Passing 8 arguments to a
  7-argument function raised `TypeError` on the first sunrise computation.
  Corrected the call to `rise_trans(jd, SUN, CALC_RISE, (lon, lat, 0), 0, 0, flags)`.
- **The pipeline has now been run for the first time.** Output:
  `data/dist/calendar_computed.json` — 102 candidate auspicious days across
  2026-11-05 → 2028-07-22. No date was changed as a result; this is the first
  computed table, not a revision.

**Self-check outcome — ONE MISMATCH, UNRESOLVED**
- `2027-08-31` — source "Shravana Krishna Amavasya" vs computed "Shravana Krishna
  Amavasya". Match.
- `2027-09-11` — source "Bhadrapada Shukla Ekadashi" vs computed "Bhadrapada
  Shukla Ekadashi". Match.
- `2027-08-02` — source "Shravan Shukla ('Shravan Shuddha')" vs computed
  **"Ashadha Krishna Amavasya (Somvar)"**. **MISMATCH.**
  The computed tithi is an Amavasya on a Monday, which the engine independently
  flags as *Somvati Amavasya* — and a royal bath falling on Somvati Amavasya is
  astronomically coherent. The likeliest explanation is that the source label
  "Shravan Shukla" is wrong, not that the computation is. **We have not changed
  either value.** This needs a panchang authority before publication, and it is
  tracked as UNVERIFIED.md #1. Note the consequence: if 2 Aug is a new moon in
  Ashadha, then the *third* royal bath on 11 Sep cannot be Ekadashi of a
  Shravan-shukla reckoning without a stated festival-specific rule.

**Crowd model (`crowd-model/`)**
- First execution. 102 days scored: 3 `High`, 46 `Moderate`, 53 `Lower`, and
  **zero `Very High`**. All three royal baths land in `High`. Weights are
  unchanged — this is the model's first output, not a tuning.
- Consequence for the site's product story: the honest claim is "three High days
  out of 102", not "three crowded days". The methodology copy already says the
  bands come from rules, not attendance.

**D3 website (`KumbhMela/`, separate repo)**
- Site is live on EasyPanel (nginx, Auto Deploy on the GitHub webhook).
- Made data-driven: renders all 102 days with band, panchang, one-line reason and
  the full point breakdown; countdown re-anchors to the computed royal-bath dates;
  band and day-type filters added.
- **Band only is rendered. The raw 0–100 score is never shown** — false
  precision. No copy anywhere says safe/unsafe or avoid-this-day.

**D4 bot (`bot/`) — built from nothing, previously cost model only**
- Answer engine, WhatsApp Cloud API webhook, per-number and per-minute rate
  limits, daily spend cap with warn/soft-kill/hard-kill tiers, salted-hash cost
  logging. English, Hindi and Marathi, detected per message.
- **No model in the answering path.** Every fact comes from
  `data/dist/calendar.json` or `data/golden-source.json`.
- `npm test` — 28 assertions, including that no reply in any language contains
  "safe"/"unsafe", "avoid"/"best day", an exclamation mark, or the raw score.
- `DRY_RUN=true` by default so the whole thing can be exercised with no Meta
  credentials and no spend.

## 2026-09-15 — D4 bot cost re-model

**Bot cost (`bot/COST_MODEL.md`, `bot/cost.config.json`)**
- Re-based the WhatsApp cost model on verified post-1-Oct-2026 billing. Corrected
  the brief's premise: caching cuts LLM cost, NOT Meta message cost — every reply
  is a billable service message (₹0.115, India; first 1,000/number/month free).
- Recorded that wa.me deep links do not qualify for the free 72h entry window.
- Confirmed our-own-agent over Meta Business Agent (which adds per-token AI billing
  from 1 Aug 2026).
- Added editable guardrails: per-number rate limits, global daily spend cap with
  warn/soft-kill/hard-kill tiers, manual kill switch, per-conversation cost logging.
- Rates are secondary-sourced; flagged to pin against Meta's official 1-Oct-2026
  rate card (UNVERIFIED.md #17).

## 2026-09-15 — v0.1.0-draft (initial)

**Date table (`golden-source.json`)**
- Created schema and populated the three Amrit Snan anchor dates:
  **2 Aug 2027, 31 Aug 2027, 11 Sep 2027** (11–12 disputed).
  Reason: three independent secondary sources (S1/S3 + project notes) concur.
  Confidence: `awaiting-official-declaration` — all sources are travel
  aggregators, no government confirmation obtained yet.
- Recorded conflict **C1** (akhara↔site assignment): nashik.gov.in (via project
  notes) says Shaiva→Kushavarta / Vaishnava→Ramkund; aggregator S1 says the
  opposite. Marked RELIGIOUS-sensitive, unresolved.
- Recorded conflict **C2** (flag-hoisting date): 31 Oct 2026 vs 24 Jul 2027.
  Both retained, unresolved. Coverage start provisionally 31 Oct 2026.
- Recorded conflict **C3** (third snan single vs 11–12 Sep two-day span).
- `dhwajarohan` anchor date left `null` pending C2 resolution.
- Helplines left `PENDING_VERIFICATION` (only 112 provisionally noted).
- Full parva/other-days list intentionally **empty**: to be produced by the
  engine, not hand-entered, to avoid any LLM-authored date.

**Engine (`panchang_engine.py`)**
- Implemented Swiss Ephemeris (Lahiri, Moshier) computation of tithi/nakshatra/
  paksha/masa at local sunrise; amanta masa mapping with adhika detection;
  candidate-day flagging (Amavasya/Purnima/Ekadashi/Sankranti/Somvati Amavasya);
  self-check against the three declared Amrit Snan dates.
- NOT YET EXECUTED: this machine has no Python. All `panchang.*` fields in the
  table remain `PENDING_ENGINE_COMPUTATION` until the engine is run.

**Crowd model (`weights.config.json`)**
- Created initial transparent weight set (Deliverable 2). All weights marked as
  informed estimates, not validated predictions. Monsoon intensity input is a
  climatology-shaped PLACEHOLDER pending sourced IMD Nashik data.
