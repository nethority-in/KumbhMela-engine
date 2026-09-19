# Changelog — date table & crowd model

Every change to `data/golden-source.json` and `crowd-model/weights.config.json`
is recorded here, dated and reasoned. Newest first. (git is not yet installed on
the build machine; until it is, this file is the authoritative change history.)

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
