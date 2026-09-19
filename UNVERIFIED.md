# UNVERIFIED — running register of facts needing human confirmation

**Read this before publishing anything.** Nothing below may be presented to a
pilgrim as confirmed until a human verifies it against an authoritative source.
Grouped by severity. Last updated 2026-09-15.

Legend: 🔴 blocks publication · 🟠 must fix before that section ships · 🟢 track.

---

## 🔴 Dates & religious facts (a wrong one ends the product)

1. **All three Amrit Snan dates** (2 Aug / 31 Aug / 11 Sep 2027). Only secondary
   travel aggregators confirm them. Get Nashik district administration / akhara
   council confirmation. *Owner: content lead.*
2. **Conflict C1 — akhara↔site assignment.** Two sources directly contradict each
   other on which traditions bathe at Ramkund vs Kushavarta. RELIGIOUSLY
   SENSITIVE. Do not assert either. Needs authoritative source + native-speaker/
   community review. *Owner: subject-matter reviewer.*
3. **Conflict C2 — flag-hoisting date** (31 Oct 2026 vs 24 Jul 2027). Sets the
   coverage window and the site countdown. Confirm officially.
4. **Conflict C3 — third snan 11 vs 11–12 Sep.** Engine to compute Ekadashi/
   Dwadashi spans; administration to confirm designated bath day(s).
5. **Full parva-snan list (45+ days).** Must be (a) computed by the engine AND
   (b) reconciled with the official parva-snan schedule once declared. No such
   date may be published from computation alone, nor from aggregators alone.
6. **Every religious term** (शाही स्नान, अमृत स्नान, पर्व स्नान, तिथि, masa/
   nakshatra names, Devanagari for both sites) → single review file for a native
   speaker before launch (Deliverable 6). Not yet created.
7. **Helpline / emergency numbers.** Only 112 provisionally noted. All mela
   control-room numbers must be retrieved verbatim from the administration and
   confirmed by phone. Never from memory or aggregators.

## 🟠 Engine conventions (confirm with a panchang authority)

8. **Sunrise-tithi day rule** — correct for most parva; some festivals use other
   moments. Confirm none of our flagged days needs a special rule.
9. **Amanta masa system + adhika masa handling** — confirm naming for the 2027
   window (a Jupiter-in-Simha year; check whether an adhika masa falls in range).
10. **Ayanamsa = Lahiri** — confirm this is the authority the local administration/
    panchang uses; other ayanamsas shift nakshatra edges.
11. **Engine self-check not yet run** (no Python on this machine). Until run, all
    `panchang.*` fields are `PENDING_ENGINE_COMPUTATION`.
12. **Site coordinates** are approximate (sunrise calc only). Verify before any
    map/print use.

## 🟠 Crowd model (Deliverable 2)

13. **IMD monsoon data is a PLACEHOLDER** shaped from general climatology, not
    sourced IMD Nashik weekly normals. Replace with real IMD data and re-derive
    peak weeks from it (do not assume). *Owner: data lead.*
14. **Historical attendance distributions** (Nashik 2015, Prayagraj 2025) are
    referenced qualitatively; exact sourced figures still to be added.
15. **Maharashtra state + national fixed holidays for 2027** in
    `data/holidays.json` are the well-known fixed-date ones; the full gazetted
    2027 list (esp. movable/state-declared holidays) is not yet published —
    reconcile when released.
16. **All crowd weights are informed estimates, not validated predictions.** This
    must be stated on the public Methodology page (D3) verbatim.

## 🟢 Commercial / platform (Deliverable 4)

17. **WhatsApp India rate — PIN TO OFFICIAL.** Re-model DONE (`bot/COST_MODEL.md`).
    Verified from secondary sources: service messages billable from 1 Oct 2026 at
    the utility rate, **₹0.115 or ₹0.145** (sources conflict), first **1,000/
    number/month free**. wa.me links do NOT get the free 72h entry window. Meta
    promised the exact 1-Oct rate card by 1 Sep 2026 — since today is 15 Sep 2026
    it should be published now: pull it from Meta's official developer pricing and
    pin the number. *Owner: platform lead.*
18. **Own agent vs Meta Business Agent** — resolved in favour of our own agent
    (Meta Business Agent adds per-token AI billing from 1 Aug 2026). Re-confirm at
    launch.
19. **LLM per-message cost is a PLACEHOLDER** (₹0.05) in `bot/cost.config.json` —
    replace with the chosen model's real token price.
20. **Cost assumptions** (1.5 msgs/conversation, 30% LLM share) are estimates —
    validate against the evaluation set (D5).

## Environment blockers (not facts, but block execution)

- **No Python / Node / npm / git / winget on the build machine.** Engine written
  but not run; site/bot not scaffolded. Install runtimes to proceed (see README).
