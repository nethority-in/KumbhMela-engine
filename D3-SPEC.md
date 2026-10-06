# D3 - Website spec (Next.js, hi/mr/en) + analytics rules

_Deliverable 3. This document is the build contract for the site. It fixes the
display rules for crowd metrics, the analytics we are allowed to collect, and the
approvals still needed from the client. Written after the EasyPanel deployment of
the current static guide._

---

## Status

| Item                                          | State                                                                |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `KumbhMela/index.html` - static visitor guide | **Live** on EasyPanel (nginx Dockerfile, Auto Deploy on)             |
| Data pipeline (`engine/` + `crowd-model/`)    | Code written, **never executed** - no `data/dist/` output exists yet |
| This spec (D3 Next.js site)                   | Not started                                                          |

The live site today is the **emotional, public-facing surface** only. It carries
dates and crowd levels **hard-coded in three places** (countdown `SNANS` array,
filter cards, timeline) and reads no JSON. D3 replaces it with a data-driven
site that renders from `data/dist/calendar.json` so dates are never hand-copied
again.

---

## 1. How crowd metrics are displayed (hard rules)

The score in `weights.config.json` is an internal 0–100 sum. **It is never
rendered.** Only the band is.

### Show

1. **Band label** - exactly one of `Very High` / `High` / `Moderate` / `Lower`,
   using the `label_en` / `label_hi` / `label_mr` values already in the config.
2. **"Estimate" marker** - always adjacent to the band, never implied. Same
   wording in all three languages.
3. **One plain-language reason** - single sentence, e.g. "A royal bath on a
   weekend." No jargon, no tithi names in the primary line.
4. **Full point breakdown** - collapsed by default. Every factor and its points
   (religious rank, day of week, holiday, festival, snan proximity, monsoon,
   travel). This is the trust mechanism; `METHODOLOGY.md` is public so anyone can
   audit the weights.
5. **Link to the methodology page.**

### Never show

| Forbidden                                  | Why                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Raw 0–100 score                            | False precision. 72 vs 74 is noise; it implies measurement we do not have.  |
| "Safe" / "Unsafe"                          | Banned by project rule. We model crowd _size_, never safety.                |
| Live or predicted headcount                | No such data exists and there are no live feeds by design.                  |
| "Avoid this day" / "Best day to visit"     | The product helps each pilgrim choose; it never tells anyone not to attend. |
| Any phrasing implying official endorsement | Independent, non-governmental.                                              |

A dot meter (● ● ●) is acceptable - it encodes the band, not the number.

### Day card shape

```
Date + festival name
[● ● ●]  Very High            ← band + "Estimate" marker
"A royal bath on a weekend."  ← one-line reason
▸ See how we calculated this  ← expands the breakdown
```

---

## 2. Analytics - what we collect and what we refuse to

Two independent sources. Both aggregate. **Neither identifies a user.**

### 2.1 Website (cookie-free, self-hosted)

Tool: **Plausible or Umami**, deployed on our own EasyPanel server. No cookies,
no personal identifiers, no cross-site tracking - which keeps us inside DPDP
without needing a consent banner for analytics.

Events worth recording:

- Which **date** page was viewed (e.g. 2 Aug vs 31 Aug) - measures interest per day
- Which **filter chip** was tapped (`procession` / `quiet` / `ritual`)
- **Language toggle** usage (hi / mr / en) - tells us where to invest in content
- Scroll depth on the planning section

Purpose: decide what to translate and explain first. Content priority only.

### 2.2 Bot (aggregate conversation counts)

- Which day users ask about most; how many conversations per day
- Distribution of intents (quiet day vs procession vs ritual)
- Top question intents overall
- Total registration requests

Phone numbers are stored **salted-hash only**, exactly as `bot/COST_MODEL.md`
already specifies. Never a plaintext number in logs.

### 2.3 The hard prohibition - no feedback loop into crowd scores

Interest in a date must **never** be fed back into the crowd model. If "everyone
clicked 2 Aug, therefore 2 Aug is busier," the model would be citing our own
traffic as evidence about the world, and the estimate would become
self-fulfilling.

**Interest is not attendance.** Analytics may shape content, translation, and
editorial attention. It may not move a single weight in
`crowd-model/weights.config.json`. Weights change only for stated reasons in
`CHANGELOG.md`.

### 2.4 Registration requests - no form

If a registration or "remind me" flow is wanted, it is a **`wa.me` deep link**.
WhatsApp collects the number; we never receive or store it. Zero personal data on
our side. Any form that asks for name or phone needs explicit consent text and
falls under the DPDP work in D7.

---

## 3. Deployment

EasyPanel hosts the **landing page only**. The website and the backend are
intended for a different host, not yet chosen. See `DEPLOY.md` for what each
component requires.

| Layer       | State                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Repos       | `nethority-in/KumbhMela-` (site), `nethority-in/KumbhMela-engine` (pipeline + bot)              |
| Website     | Static `index.html` + `data/calendar.json`. Needs only a web server - no build step, no runtime |
| Auto Deploy | Enabled where the repo is hosted; every push to `main` redeploys                                |
| Backend     | Node 22, zero dependencies, one port, and a **persistent** volume for `BOT_DATA_DIR`            |

**Two things that are not yet settled:**

- The target platform for the website and the bot.
- Whether `calendar.json` is committed as an artifact (current approach) or
  served from a mounted volume. Committing keeps the site a pure static build;
  a volume keeps the pipeline as the single source of truth at runtime.

---

## 4. Prerequisites - needed from the client

### Content and verification (blocking publish)

1. **Verified date list** - official 2027 snan / auspicious days, confirmed by a
   panchang authority or the organising committee. A wrong date is a hard fail.
2. **Akhara ↔ site clarification** - written answer on which akharas bathe at
   Nashik vs Trimbakeshwar. Sources currently disagree (see `UNVERIFIED.md`, C1).
3. **Content sign-off** - who writes hi/mr/en copy, who approves it finally.

### WhatsApp bot (start now - Meta verification takes 1–3 weeks)

4. **Meta Business Account** - needs client documents: PAN, GST, Aadhaar, address proof.
5. **Dedicated business number** - not a personal number.
6. **WhatsApp API access token** - generated in the Meta dashboard.
7. **Official India rate pinned** - ₹0.115 vs ₹0.145, from Meta's own rate card,
   not secondary sources.

### Decisions

8. **LLM provider + API key + monthly budget** (India, ≈₹0.196 per conversation).
9. **Priority** - bot first or website first.
10. **Deadline.**
11. **Legal review** - DPDP privacy policy + terms, required because the bot
    handles hashed phone numbers.

---

## 5. Open questions for us

- Persist `calendar.json` via storage mount, or commit the artifact?
- Plausible vs Umami - both self-hostable; pick on EasyPanel resource limits.
- Does D3 ship in all three languages at once, or English first with hi/mr after
  the client approves translations?
