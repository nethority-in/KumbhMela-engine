# How we estimate crowds — the method, in full

*This page is public. If you can read this, you can check our work.*

## The one thing to know first

**These are estimates, not predictions.** We have no way to know the true crowd
on a day that has not happened yet. What we have is a set of transparent rules,
each based on a sensible reason, that add up to a rough score. We show you that
score as one of four bands so you can weigh your options. **On the day itself,
always follow the police and administration.** We never say a day is "safe" or
"unsafe" — only more or less crowded, as our rules estimate it.

## The four bands

| Band | Score | Meaning |
|------|-------|---------|
| **Very High** | 75–100 | Among the busiest days; heaviest management, longest waits. |
| **High** | 55–74 | A large crowd expected. |
| **Moderate** | 35–54 | A meaningful but more manageable crowd. |
| **Lower** | 0–34 | Among the quieter auspicious days. |

## How a day's score is built

We start from the day's **religious rank** and then add or subtract points for a
handful of real-world factors. Every number lives in one file
(`crowd-model/weights.config.json`) and every point on a day is shown to you in
the day's breakdown. Nothing is hidden.

1. **Religious rank (baseline).** A royal bath (Amrit Snan) starts highest; a
   major bathing day (new moon, full moon) next; a lesser auspicious day (like
   an Ekadashi) lower; an ordinary mela day lowest. *This is the biggest factor.*
2. **Day of the week.** Weekends draw more people; Friday a little.
3. **Public holidays.** A national or Maharashtra holiday on the day frees more
   people to travel.
4. **Major festivals.** A big festival landing on or near the day — Ganesh
   Chaturthi is especially large in Maharashtra — compounds the crowd. Festival
   dates are computed from the panchang, never guessed.
5. **Nearness to a royal bath.** The days just before and after a royal bath
   inherit its spillover.
6. **Monsoon.** Heavy-rain weeks slightly lower discretionary turnout. *This
   effect is small and uncertain — see the honesty notes below.*
7. **Travel from big cities.** Nashik is a feasible weekend trip from Mumbai and
   Pune, so weekends get an extra day-trip bump.

The points are summed and capped at 0–100, then mapped to a band. You always see
the sentence-long reason and the full point list.

## Where the numbers come from

- **Religious ranks and festival dates:** from the date engine, which computes
  the panchang with Swiss Ephemeris (Lahiri ayanamsa). See `engine/README.md`.
- **Holidays:** fixed-date national/Maharashtra holidays; movable festivals from
  the panchang, not from school calendars.
- **Monsoon:** historical rainfall intensity for Nashik. *(Currently a
  climatology-shaped placeholder — being replaced with sourced IMD Nashik data.)*
- **Historical attendance** at Nashik 2015 and Prayagraj 2025 informs the shape
  of the ranks (royal baths dwarf other days), as a sanity check.

## Honesty notes (the limits of this model)

- There is **no 2027 ground truth** to fit against, so the weights are judgement,
  not a fitted result. We chose transparency over false precision.
- The **monsoon effect's sign and size are uncertain.** Heavy rain may reduce
  crowd size but raise on-ground risk; we model only crowd size, and lightly.
- Estimates can be **wrong**. If you spot an error, our Corrections page tells you
  how to report it, and every change is logged in `CHANGELOG.md`.
- We will **never** phrase any of this as "avoid this day." Every day is shown
  with its trade-offs so you can choose the one that fits you.
