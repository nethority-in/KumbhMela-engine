#!/usr/bin/env python3
"""
score.py — Deliverable 2, the crowd estimation model.

Transparent, rule-based, no ML, no black box. Reads the engine's computed
candidate days + the verified anchors, applies crowd-model/weights.config.json,
and writes data/dist/calendar.json — the final static artifact the website (D3)
and bot (D4) consume.

Every day gets: a 0-100 score, one of four bands (Very High / High / Moderate /
Lower), a full point-by-point breakdown, and ONE plain-language sentence a user
can understand. Nothing here is labelled safe/unsafe.

RUN (after the engine):
    python crowd-model/score.py
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..")


def load(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return json.load(fh)


def band_for(score: int, bands: dict) -> dict:
    for key in ("very_high", "high", "moderate", "lower"):
        if score >= bands[key]["min"]:
            return {"key": key, **{k: v for k, v in bands[key].items() if k != "min"}}
    return {"key": "lower", **bands["lower"]}


def classify(day: dict, amrit_dates: set) -> str:
    """Map a computed candidate day to a crowd-model baseline class."""
    if day["gregorian_date"] in amrit_dates:
        return "amrit_snan"
    if day.get("is_amavasya") or day.get("is_purnima") or day.get("is_somvati_amavasya"):
        return "parva_snan_major"
    if day.get("is_ekadashi") or day.get("is_sankranti"):
        return "auspicious_minor"
    return "ordinary_mela_day"


def nearest_amrit_gap(d: date, amrit_dates: set) -> int:
    return min((abs((d - date.fromisoformat(a)).days) for a in amrit_dates), default=999)


def score_day(day: dict, ctx: dict) -> dict:
    w = ctx["weights"]
    d = date.fromisoformat(day["gregorian_date"])
    contributions = []

    def add(points, reason):
        if points:
            contributions.append({"points": points, "reason": reason})

    # 1) baseline by classification
    cls = classify(day, ctx["amrit_dates"])
    base = w["baseline_by_classification"][cls]
    add(base["value"], base["why"])

    # 2) day of week
    wd = d.weekday()  # Mon=0
    dow = w["day_of_week"]
    if wd == 5:
        add(dow["saturday"]["value"], "Saturday — weekend surge")
    elif wd == 6:
        add(dow["sunday"]["value"], "Sunday — weekend surge")
    elif wd == 4:
        add(dow["friday"]["value"], "Friday — leading edge of the weekend")

    # 3) fixed-date holiday coincidence
    iso = day["gregorian_date"]
    if iso in ctx["holiday_dates"]:
        h = w["holiday_coincidence"]["on_national_or_state_holiday"]
        add(h["value"], f"Public holiday ({ctx['holiday_dates'][iso]})")

    # 4) major festival coincidence (festival dates injected from engine output)
    if iso in ctx["festival_dates"]:
        f = w["major_festival_coincidence"]["on_major_festival"]
        add(f["value"], f"Major festival ({ctx['festival_dates'][iso]})")

    # 5) Amrit Snan clustering (skip for the Amrit Snan day itself)
    if cls != "amrit_snan":
        gap = nearest_amrit_gap(d, ctx["amrit_dates"])
        cl = w["amrit_snan_clustering"]
        if gap <= 3:
            add(cl["within_3_days_of_amrit_snan"]["value"], "Within 3 days of a royal bath — spillover")
        elif gap <= 7:
            add(cl["within_4_to_7_days"]["value"], "Within a week of a royal bath — outer spillover")

    # 6) monsoon intensity
    intensity = ctx["monsoon_by_month"].get(f"{d.month:02d}", "moderate")
    mon = w["monsoon_intensity"]
    if intensity == "peak":
        add(mon["peak_week"]["value"], "Peak monsoon week — slightly dampens turnout")
    elif intensity == "high":
        add(mon["high_week"]["value"], "Heavy monsoon week — marginally dampens turnout")
    elif intensity in ("low", "dry"):
        add(mon["low_week"]["value"], "Drier week — slightly higher turnout")

    # 7) weekend day-trip amplifier (travel accessibility)
    if wd in (5, 6):
        amp = w["travel_accessibility"]["weekend_daytrip_amplifier"]
        add(amp["value"], "Weekend day-trips feasible from Mumbai/Pune")

    total = sum(c["points"] for c in contributions)
    total = max(w["clamp"]["min"], min(w["clamp"]["max"], total))
    band = band_for(total, w["bands"])

    headline = _headline(cls, band, contributions, day)

    return {
        "gregorian_date": iso,
        "classification": cls,
        "score": total,
        "band": band,
        "headline_reason": headline,
        "breakdown": contributions,
        "estimate_disclaimer": "Crowd estimate only — informed by rules, not a validated prediction. Always follow police and administration instruction on the day.",
        "panchang": {
            "tithi": f"{day.get('paksha','')} {day.get('tithi_name','')}".strip(),
            "nakshatra": day.get("nakshatra"),
            "masa": day.get("masa"),
            "weekday": day.get("weekday"),
        },
    }


def _headline(cls: str, band: dict, contributions: list, day: dict) -> str:
    """One sentence a 55+ reader can understand."""
    label = band["label_en"]
    pieces = [c["reason"] for c in contributions[1:4]]  # skip baseline, take top few
    tail = ("; ".join(pieces)) if pieces else "religious significance"
    names = {
        "amrit_snan": "Royal bath (Amrit Snan)",
        "parva_snan_major": "Major bathing day",
        "auspicious_minor": "Auspicious day",
        "ordinary_mela_day": "Regular mela day",
    }
    return f"{names[cls]} — estimated {label} crowd ({tail})."


def main() -> None:
    weights = load("crowd-model", "weights.config.json")
    golden = load("data", "golden-source.json")
    monsoon = load("data", "imd-rainfall-nashik.json")
    holidays = load("data", "holidays.json")

    computed_path = os.path.join(ROOT, "data", "dist", "calendar_computed.json")
    if not os.path.exists(computed_path):
        raise SystemExit(
            "data/dist/calendar_computed.json not found. Run engine/panchang_engine.py first."
        )
    computed = load("data", "dist", "calendar_computed.json")

    amrit_dates = {b["gregorian_date"] for b in golden["bathing_days"]
                   if b["classification"]["type"] == "amrit_snan"}
    holiday_dates = {h["date"]: h["name_en"] for h in holidays["fixed_date_holidays_2027"]}

    # Festival dates are read from any engine candidate flagged as a named festival.
    # (The engine flags Sankranti; named lunar festivals like Ganesh Chaturthi can be
    # emitted by extending the engine. Until then this map is what the engine provides.)
    festival_dates: dict = {}

    ctx = {
        "weights": weights,
        "amrit_dates": amrit_dates,
        "holiday_dates": holiday_dates,
        "festival_dates": festival_dates,
        "monsoon_by_month": monsoon["by_month"],
    }

    # Union of engine candidates + the verified anchors (anchors may not be flagged
    # by the engine if a festival-specific rule applies — never drop a declared bath).
    by_date = {c["gregorian_date"]: c for c in computed["candidates"]}
    for b in golden["bathing_days"]:
        by_date.setdefault(b["gregorian_date"], {
            "gregorian_date": b["gregorian_date"],
            "auspicious_flags": ["declared Amrit Snan (not flagged by engine — verify)"],
        })

    scored = [score_day(day, ctx) for _, day in sorted(by_date.items())]

    out_path = os.path.join(ROOT, "data", "dist", "calendar.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({
            "_generated_by": "crowd-model/score.py",
            "_contract": "This is the static artifact the website (D3) and bot (D4) consume. Read-only.",
            "_honesty": "All crowd figures are estimates, never safe/unsafe. Weights: crowd-model/weights.config.json.",
            "weights_version": weights["version"],
            "table_version": golden["table_version"],
            "day_count": len(scored),
            "days": scored,
        }, fh, ensure_ascii=False, indent=2)

    print(f"Wrote {len(scored)} scored days -> {out_path}")
    for day in scored:
        print(f"  {day['gregorian_date']}  {day['score']:>3}  {day['band']['label_en']:<10}  {day['headline_reason']}")


if __name__ == "__main__":
    main()
