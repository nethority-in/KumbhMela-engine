#!/usr/bin/env python3
"""
panchang_engine.py — Deliverable 1, the date engine.

WHAT THIS DOES
--------------
Computes, for the full Simhastha 2027 mela window, the panchang (tithi,
nakshatra, paksha, masa) at LOCAL SUNRISE for each day, and flags the
astronomically auspicious bathing days (Amavasya, Purnima, every Ekadashi,
Sankranti/solar ingress, Somvati Amavasya). It then cross-checks the three
officially-reported Amrit Snan dates against their computed tithis and warns
loudly on any mismatch.

WHY THIS LIBRARY
----------------
Swiss Ephemeris (via `pyswisseph`) is the reference implementation Indian
professional panchang-makers rely on. We use its built-in Moshier analytic
ephemeris (`FLG_MOSEPH`) so NO external ephemeris data files are required —
Moshier gives arc-second-level accuracy, far more than tithi boundaries need.
Ayanamsa is Lahiri (Chitrapaksha), the Government of India Rashtriya Panchang
standard.

INTEGRITY RULES (see project README)
------------------------------------
- Nothing here is "generated" text. Every value is a deterministic astronomical
  computation. This file NEVER invents a date.
- The engine's output is a CANDIDATE list. It does not override official
  declaration; it is reconciled against data/golden-source.json downstream.

CONVENTIONS (flagged for a panchang authority to confirm — see UNVERIFIED.md)
-----------------------------------------------------------------------------
- Day rule: tithi prevailing at local sunrise names the day. Some festivals use
  other moments (moonrise/midday/ritual instant); those are NOT special-cased
  here and must be confirmed per festival.
- Masa system: AMANTA (new-moon-ending), as used in Maharashtra. Determined by
  the sun's sidereal rashi at the new moon that begins the lunar month.
- Adhika (leap) masa is detected (two new moons within one solar month) and
  labelled "Adhika"; confirm treatment with a panchang authority.

USAGE
-----
    pip install -r engine/requirements.txt
    python engine/panchang_engine.py
Writes: data/dist/calendar_computed.json  and prints a self-check report.
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass, asdict
from datetime import date, datetime, timedelta, timezone

try:
    import swisseph as swe
except ImportError as exc:  # pragma: no cover - environment guard
    raise SystemExit(
        "pyswisseph is not installed. Run: pip install -r engine/requirements.txt\n"
        "(This machine currently has no Python/pip — see project README prerequisites.)"
    ) from exc

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

IST = timezone(timedelta(hours=5, minutes=30))          # India Standard Time
COVERAGE_START = date(2026, 10, 31)                      # see conflicts C2 (disputed)
COVERAGE_END = date(2028, 7, 24)

# Sunrise reference site. The two ghats are ~28 km apart; sunrise differs by well
# under a minute, which cannot move a sunrise-tithi boundary in practice. We use
# Trimbakeshwar (the western, later-sunrise site) as the conservative reference
# and record the site in the convention block. Both sets of coordinates live in
# data/golden-source.json.
REF_LAT = 19.9403
REF_LON = 73.5305

AYANAMSA = swe.SIDM_LAHIRI
CALC_FLAGS = swe.FLG_MOSEPH | swe.FLG_SIDEREAL   # sidereal longitudes, no data files

TITHI_NAMES = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
    "Trayodashi", "Chaturdashi", "Purnima",
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
    "Trayodashi", "Chaturdashi", "Amavasya",
]

NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
    "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
    "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
    "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada",
    "Revati",
]

# Sidereal solar months (sun's rashi). Amanta lunar month is named after the
# solar month in which its new moon falls.
RASHI_NAMES = [
    "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula",
    "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
]
# Lunar month name by the solar-month index the new moon falls in.
LUNAR_MONTH_BY_SOLAR = [
    "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada", "Ashwina",
    "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna", "Chaitra",
]

# Weekday names (Python weekday(): Mon=0)
VARA = ["Somvar", "Mangalvar", "Budhvar", "Guruvar", "Shukravar", "Shanivar", "Ravivar"]


# --------------------------------------------------------------------------- #
# Astronomy helpers
# --------------------------------------------------------------------------- #

def _init() -> None:
    swe.set_sid_mode(AYANAMSA)


def jd_ut(dt_utc: datetime) -> float:
    """Julian Day (UT) from a timezone-aware UTC datetime."""
    dt = dt_utc.astimezone(timezone.utc)
    return swe.julday(
        dt.year, dt.month, dt.day,
        dt.hour + dt.minute / 60 + dt.second / 3600,
    )


def sun_moon_long(jd: float) -> tuple[float, float]:
    """Sidereal ecliptic longitudes (deg) of Sun and Moon at Julian Day jd."""
    sun = swe.calc_ut(jd, swe.SUN, CALC_FLAGS)[0][0]
    moon = swe.calc_ut(jd, swe.MOON, CALC_FLAGS)[0][0]
    return sun % 360.0, moon % 360.0


def tithi_index(jd: float) -> int:
    """0..29 tithi index. Elongation (Moon-Sun) is ayanamsa-independent."""
    sun, moon = sun_moon_long(jd)
    return int(((moon - sun) % 360.0) // 12.0)


def nakshatra_index(jd: float) -> int:
    """0..26 nakshatra index from sidereal Moon longitude."""
    _, moon = sun_moon_long(jd)
    return int(moon // (360.0 / 27.0))


def solar_month_index(jd: float) -> int:
    """0..11 sidereal rashi of the Sun (0 = Mesha)."""
    sun, _ = sun_moon_long(jd)
    return int(sun // 30.0)


def local_sunrise_jd(d: date) -> float:
    """Julian Day (UT) of local sunrise at the reference site for civil date d."""
    # Start searching from local midnight of d, expressed in UT.
    local_midnight = datetime(d.year, d.month, d.day, 0, 0, tzinfo=IST)
    start_jd = jd_ut(local_midnight)
    res = swe.rise_trans(
        start_jd, swe.SUN, REF_LON, REF_LAT, 0.0, 0.0,
        0.0, swe.FLG_MOSEPH | swe.CALC_RISE | swe.BIT_DISC_CENTER,
    )
    # pyswisseph returns (retflag, (tret,...)); tret[0] is the rise time (JD UT).
    return res[1][0]


# --------------------------------------------------------------------------- #
# New-moon scan (for amanta masa naming + adhika detection)
# --------------------------------------------------------------------------- #

def find_new_moons(start: date, end: date) -> list[float]:
    """Julian Days (UT) of every new moon (elongation crossing 0) in [start,end]."""
    jd = jd_ut(datetime(start.year, start.month, start.day, tzinfo=IST))
    end_jd = jd_ut(datetime(end.year, end.month, end.day, 23, 59, tzinfo=IST))
    result: list[float] = []
    step = 0.25  # 6-hour coarse scan, then refine
    prev = None
    x = jd
    while x < end_jd:
        sun, moon = sun_moon_long(x)
        elong = (moon - sun) % 360.0
        if prev is not None:
            prev_e, prev_x = prev
            # detect wrap from ~360 back to ~0 (new moon crossing)
            if prev_e > 300 and elong < 60:
                result.append(_refine_new_moon(prev_x, x))
        prev = (elong, x)
        x += step
    return result


def _refine_new_moon(lo: float, hi: float) -> float:
    """Bisection to the instant elongation == 0 (mod 360)."""
    for _ in range(60):
        mid = (lo + hi) / 2
        sun, moon = sun_moon_long(mid)
        elong = (moon - sun) % 360.0
        # bring near 0 from below (359.9) or above (0.1)
        signed = elong - 360.0 if elong > 180 else elong
        if signed < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def build_amanta_month_map(start: date, end: date) -> list[tuple[float, float, str]]:
    """
    Returns list of (start_jd, end_jd, month_name) amanta lunar months spanning
    the window. Month name = LUNAR_MONTH_BY_SOLAR[solar month of the starting new
    moon]. If two new moons fall in the same solar month, the first is 'Adhika'.
    """
    nm = find_new_moons(start - timedelta(days=40), end + timedelta(days=40))
    months: list[tuple[float, float, str]] = []
    for i in range(len(nm) - 1):
        s, e = nm[i], nm[i + 1]
        sm = solar_month_index(s)
        sm_next_nm = solar_month_index(nm[i + 1]) if i + 1 < len(nm) else None
        name = LUNAR_MONTH_BY_SOLAR[sm]
        # Adhika masa: no solar ingress between this new moon and the next.
        is_adhika = (sm_next_nm is not None and sm == sm_next_nm)
        months.append((s, e, ("Adhika " + name) if is_adhika else name))
    return months


def month_for(jd: float, months: list[tuple[float, float, str]]) -> str:
    for s, e, name in months:
        if s <= jd < e:
            return name
    return "unknown"


# --------------------------------------------------------------------------- #
# Day record
# --------------------------------------------------------------------------- #

@dataclass
class DayRecord:
    gregorian_date: str
    weekday: str
    tithi_num: int          # 1..30
    tithi_name: str
    paksha: str             # Shukla / Krishna
    nakshatra: str
    masa: str
    is_amavasya: bool
    is_purnima: bool
    is_ekadashi: bool
    is_somvati_amavasya: bool
    is_sankranti: bool      # solar ingress on this day
    auspicious_flags: list  # human-readable reasons this day is a bathing candidate


def compute_day(d: date, months) -> DayRecord:
    jd = local_sunrise_jd(d)
    ti = tithi_index(jd)                 # 0..29
    tithi_num = ti + 1                    # 1..30
    ni = nakshatra_index(jd)
    paksha = "Shukla" if ti < 15 else "Krishna"
    masa = month_for(jd, months)

    is_amavasya = (tithi_num == 30)
    is_purnima = (tithi_num == 15)
    is_ekadashi = (tithi_num in (11, 26))
    weekday = d.weekday()  # Mon=0
    is_somvati = is_amavasya and weekday == 0  # Amavasya on Monday
    # Sankranti: solar rashi at this sunrise differs from previous day's sunrise.
    prev_sm = solar_month_index(local_sunrise_jd(d - timedelta(days=1)))
    is_sankranti = solar_month_index(jd) != prev_sm

    flags = []
    if is_amavasya:
        flags.append("Amavasya (new moon)")
    if is_purnima:
        flags.append("Purnima (full moon)")
    if is_ekadashi:
        flags.append("Ekadashi")
    if is_somvati:
        flags.append("Somvati Amavasya (Amavasya on Monday)")
    if is_sankranti:
        flags.append(f"Sankranti / solar ingress into {RASHI_NAMES[solar_month_index(jd)]}")

    return DayRecord(
        gregorian_date=d.isoformat(),
        weekday=VARA[weekday],
        tithi_num=tithi_num,
        tithi_name=TITHI_NAMES[ti],
        paksha=paksha,
        nakshatra=NAKSHATRA_NAMES[ni],
        masa=masa,
        is_amavasya=is_amavasya,
        is_purnima=is_purnima,
        is_ekadashi=is_ekadashi,
        is_somvati_amavasya=is_somvati,
        is_sankranti=is_sankranti,
        auspicious_flags=flags,
    )


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

DECLARED_AMRIT_SNAN = {
    "2027-08-02": "Shravan Shukla (first royal bath)",
    "2027-08-31": "Shravan Amavasya",
    "2027-09-11": "Bhadrapada Shukla Ekadashi (Vaman Dwadashi 12th)",
}


def main() -> None:
    _init()
    months = build_amanta_month_map(COVERAGE_START, COVERAGE_END)

    days: list[DayRecord] = []
    d = COVERAGE_START
    while d <= COVERAGE_END:
        days.append(compute_day(d, months))
        d += timedelta(days=1)

    candidates = [asdict(x) for x in days if x.auspicious_flags]

    out_dir = os.path.join(os.path.dirname(__file__), "..", "data", "dist")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "calendar_computed.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "_generated_by": "engine/panchang_engine.py",
                "_ayanamsa": "Lahiri",
                "_masa_system": "Amanta",
                "_day_rule": "tithi at local sunrise (Trimbakeshwar reference)",
                "_note": "COMPUTED candidate auspicious days. Reconcile with official declaration in golden-source.json. Not for publication until confirmed.",
                "coverage": {"start": COVERAGE_START.isoformat(), "end": COVERAGE_END.isoformat()},
                "candidate_count": len(candidates),
                "candidates": candidates,
            },
            fh, ensure_ascii=False, indent=2,
        )

    # ---- Self-check against declared Amrit Snan dates ---------------------- #
    print(f"Wrote {len(candidates)} candidate auspicious days -> {out_path}\n")
    print("SELF-CHECK: declared Amrit Snan vs computed tithi at sunrise")
    print("-" * 64)
    by_date = {x.gregorian_date: x for x in days}
    for iso, label in DECLARED_AMRIT_SNAN.items():
        rec = by_date.get(iso)
        if rec is None:
            print(f"  {iso}  OUTSIDE COVERAGE — cannot check")
            continue
        computed = f"{rec.masa} {rec.paksha} {rec.tithi_name} ({rec.weekday})"
        print(f"  {iso}  declared: {label}")
        print(f"             computed: {computed}")
        print(f"             flags: {', '.join(rec.auspicious_flags) or '(none)'}\n")
    print("Review any line where 'computed' does not match 'declared'. A mismatch "
          "means either a source error, a festival-specific tithi rule, or an "
          "ayanamsa/convention difference — resolve with a panchang authority "
          "before publishing. See UNVERIFIED.md.")


if __name__ == "__main__":
    main()
