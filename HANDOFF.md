# Kumbh Mela project — handoff & what it needs to run

Hi — here's everything you need to pick this up. There are **two folders**.

## 1. `KumbhMela/` — the website. Already finished, nothing to run.
A single self-contained file (`index.html`) — no framework, no build step, no
internet needed. Just open it in a browser. The two `.md` files beside it
(`CONTEXT.md`, `UI-ELEMENTS.md`) explain what it is and how it's built.

## 2. `kumbh-2027/` — the data engine + crowd model + bot work. This needs a runtime.
The machine this was built on had **no Python, Node, or git installed**, so the
code is written but **has never actually been run**.

**You need Python 3.10+** (for the build pipeline). Install from python.org with
"Add to PATH" checked. Then, from inside the `kumbh-2027` folder:

```
pip install -r engine/requirements.txt
python engine/panchang_engine.py     # computes dates -> data/dist/calendar_computed.json + prints a self-check
python crowd-model/score.py          # adds crowd scores -> data/dist/calendar.json
```

The engine uses Swiss Ephemeris (Lahiri ayanamsa) to compute tithi/nakshatra/etc.
Until you run it, the panchang fields in the data table are empty placeholders on
purpose. **Read `README.md` first**, then `UNVERIFIED.md` — it lists every fact
that must be confirmed by a human before anything is published (a wrong date is a
hard fail for this project).

**You'll also need Node.js 20** later, for the two things not built yet: the
Next.js website and the WhatsApp bot.

## What's done vs. left
- ✅ Date engine + crowd model (code written — needs to be *run* by you)
- ✅ WhatsApp bot **cost model** (`bot/COST_MODEL.md`) — must be re-pinned to
  Meta's official India rate
- ⬜ Not started: the Next.js website, the rest of the WhatsApp bot, the
  evaluation test set, the multi-language content, and the legal/privacy/
  deployment docs

## Verify early
1. WhatsApp per-message India rate (₹0.115 vs ₹0.145 — check Meta's official rate card).
2. The religious/date conflicts in `UNVERIFIED.md` — the akhara↔site question
   especially (sources disagree; don't guess).

Docs to start with: `README.md`, `UNVERIFIED.md`, `CHANGELOG.md`.
