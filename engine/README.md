# Date engine — library choice & conventions

## Library: Swiss Ephemeris via `pyswisseph`

**Why this one.** Swiss Ephemeris is the computation professional Indian
panchang-makers use; `pyswisseph` is its maintained Python binding. We run it
with the built-in **Moshier** analytic ephemeris (`FLG_MOSEPH`), so there are
**no ephemeris data files to ship or manage** — accuracy is arc-second level,
vastly finer than any tithi boundary needs. Ayanamsa is **Lahiri (Chitrapaksha)**,
the Government of India *Rashtriya Panchang* standard.

**What the engine is — and is not.** It deterministically computes tithi,
nakshatra, paksha and masa, and flags astronomically auspicious bathing days.
It does **not** decide which day the administration will *declare* an Amrit/Parva
Snan — that is a human/official act. The engine's output is a **candidate list
and a cross-check**, reconciled against `data/golden-source.json`. No date in
this system is ever produced by a language model.

## Conventions (each is a judgment call — all flagged in `UNVERIFIED.md`)

| Convention | Chosen value | Note |
|---|---|---|
| Ayanamsa | Lahiri (Chitrapaksha) | GoI standard. Some lineages use Raman/KP — would shift nakshatra edges slightly. |
| Day rule | Tithi at **local sunrise** names the day | Standard for most parva/vrata. Some festivals use moonrise/midday/ritual-moment rules — NOT special-cased; confirm per festival. |
| Masa system | **Amanta** (new-moon-ending) | Used in Maharashtra. North India uses Purnimanta; month names differ for the dark fortnight. |
| Adhika masa | Detected (two new moons in one solar month) → labelled "Adhika" | Confirm treatment with a panchang authority. |
| Sunrise site | Trimbakeshwar (western, later sunrise) as conservative reference | The two ghats are ~28 km apart; sunrise differs < 1 min — cannot move a tithi boundary. |

## Running it

```bash
pip install -r engine/requirements.txt
python engine/panchang_engine.py
```

Outputs `data/dist/calendar_computed.json` and prints a **self-check**: the
computed sunrise-tithi for each of the three declared Amrit Snan dates, next to
the tithi label our sources gave. Investigate every non-match before trusting
the table.

## Alternative: an all-Node pipeline (if you want one toolchain)

The site (D3) and bot (D4) are Node. If a single toolchain matters more than
using the reference ephemeris binding, replace this engine with either:

- **`mhah-panchang`** (pure JS, no native build) — easy install, decent accuracy;
  less battle-tested than Swiss Ephemeris for edge tithi boundaries. Verify its
  ayanamsa handling matches Lahiri before trusting.
- **`swisseph`** (Node native binding) — same engine as here, but needs `node-gyp`
  + C++ build tools, which is painful on Windows.

This is a **reversible** decision. It is isolated behind the JSON contract
(`data/dist/calendar.json`), so swapping the engine does not touch the website
or bot. Recommendation: keep Python + Swiss Ephemeris for maximum date-integrity
unless the operator specifically wants to avoid a second runtime.
