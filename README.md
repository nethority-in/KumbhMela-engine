# Simhastha Kumbh 2027 — "Which bathing day should I attend?"

An independent, non-governmental information service for pilgrims attending the
Nashik–Trimbakeshwar Simhastha Kumbh Mela 2027. It surfaces **every** auspicious
bathing day — not only the three headline Amrit Snan dates — with a transparent,
labelled crowd **estimate** and plain-language significance, so a pilgrim can
choose the day that fits them instead of everyone converging on the same three.

> **Not affiliated with any government or religious body.** All crowd figures are
> estimates, always labelled as such. Never "safe/unsafe". Always follow police
> and administration instruction on the day.

---

## Why this exists

The government has spread this Kumbh across roughly 21 months and **45+ bathing
days specifically to reduce crowd pressure** (see `data/golden-source.json`
sources). Yet almost every existing site lists only the same three dates, so
everyone still goes on those three — the most crowded and most dangerous. At
Prayagraj in 2025 at least ~30 people died in a stampede on one such day. This
product's single job: show all the options with honest trade-offs and let the
pilgrim decide. **We never tell anyone not to attend, and never say "avoid the
Shahi Snan." We help each person find *their* best day.**

## The seven deliverables

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | **Date engine** — versioned static table of every auspicious day | **In progress** (this commit) |
| 2 | **Crowd model** — transparent rule-based 0–100 score → 4 bands | **In progress** (this commit) |
| 3 | Website (Next.js, static, hi/mr/en) | Not started — blocked on D1/D2 per working method |
| 4 | WhatsApp bot (Cloud API direct) | Not started |
| 5 | Evaluation set (100+ questions, 3 languages) | Not started |
| 6 | Content, all three languages | Not started |
| 7 | Supporting (privacy/DPDP, terms, deploy, load tests) | Not started |

Working method (from brief): **finish D1 and D2 before touching the website.**

## Architecture (data-flow contract)

```
data/golden-source.json   ← human-authored, VERIFIED facts (dates, helplines, sources)
        │                    the only file a non-technical editor touches
        ▼
engine/panchang_engine.py ← computes tithi/nakshatra/paksha/masa + candidate
        │                    parva days with Swiss Ephemeris (Lahiri ayanamsa)
        ▼
crowd-model/score.py      ← applies crowd-model/weights.config.json
        │
        ▼
data/dist/calendar.json   ← BUILT artifact consumed by the website (D3) and bot (D4)
```

Rationale for this split:
- **Dates/tithis/helplines are never LLM-generated.** They are either retrieved
  verbatim from a cited source, or computed deterministically by Swiss Ephemeris.
  Any field not yet verified/computed is explicitly `null` with a `_status`
  marker — never guessed.
- The website and bot are **read-only consumers of a static JSON file**, so the
  whole system runs unattended from launch to Sept 2027 (constraint #4: no live
  feeds).
- A non-technical person edits only `golden-source.json` (constraint D7: update
  the table without a deploy).

## Runtime prerequisites (IMPORTANT — nothing is installed on this machine)

This environment currently has **no Python, Node, npm, or git**. To run anything
you must install:

- **Python 3.10+** and `pip install -r engine/requirements.txt` — for the build
  pipeline (engine + crowd model). Build-time only; not in production.
- **Node.js 20 LTS** — for the website (D3) and bot (D4), later.
- **git** — for versioning the data table + changelog.

Why Python for the engine despite the site being Node: `pyswisseph` is the
reference binding to Swiss Ephemeris, the computation Indian professional
panchangs rely on. The engine is a rare, developer-run build step, so a
build-time Python dependency is an acceptable price for maximum date-integrity.
This is a reversible decision — an all-Node pipeline (`mhah-panchang` or native
`swisseph`) is possible if you'd rather one toolchain; see `engine/README.md`.

## How to run the build pipeline (once Python is installed)

```bash
pip install -r engine/requirements.txt
python engine/panchang_engine.py          # writes data/dist/calendar_computed.json
python crowd-model/score.py               # merges crowd scores → data/dist/calendar.json
```

The engine also runs a **self-check**: it recomputes the tithis of the three
declared Amrit Snan dates and reports whether they match the tithi labels our
sources provided. A mismatch is a loud warning, not a silent pass.

## Governance files

- `CHANGELOG.md` — every change to the date table, dated and reasoned.
- `UNVERIFIED.md` — the running register of every fact awaiting human
  confirmation. **Read this before publishing anything.**
