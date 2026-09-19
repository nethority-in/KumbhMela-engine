# WhatsApp bot — cost model (re-based for post-1-Oct-2026 billing)

*Deliverable 4, cost re-model. All numbers are editable in `cost.config.json`.
Rates are secondary-sourced (Sep 2026) and MUST be pinned to Meta's official
1-Oct-2026 rate card before launch — see the correction and caveats below.*

---

## The correction that reshapes the whole model

The brief targets "70%+ of queries answered from a cached or canned response with
no LLM call." That target is good, but it controls the **wrong cost line for
Meta**:

> **Caching reduces our LLM inference cost. It does NOT reduce our WhatsApp
> message cost.** From 1 Oct 2026 every free-form reply we send inside the 24-hour
> window is a **billable "service message,"** whether or not an LLM produced it.

So there are **two independent cost lines**, and they must be modelled
separately:

1. **Meta messaging cost** — driven by the *number of replies we send*. Caching
   does nothing here. The only levers are: send **one batched message per
   answer** (a brief constraint — now also the single biggest cost control),
   fewer follow-ups, and staying inside the free monthly allowance.
2. **LLM cost** — driven by the *share of messages that call the model*. This is
   where the 70%-cache target pays off.

## Verified billing facts (India, 2026)

| Item | Value | Note |
|---|---|---|
| Service message (free-form reply, 24h window) | **₹0.115 / msg** | Billable **from 1 Oct 2026** (was free). Some sources say ₹0.145 — pin to official. |
| Utility template | ₹0.115 / msg | For replies **outside** the 24h window. |
| Marketing template | ₹0.8631 / msg | **Never used** (no ads/marketing). |
| Free service messages | **1,000 / number / month** | Charges from the 1,001st; resets monthly; no rollover. |
| Free 72h entry window | Click-to-WhatsApp ads / FB CTA only | **wa.me links do NOT qualify.** Our conversations are ordinary service windows. |
| Meta Business Agent AI | per-token from 1 Aug 2026 | **Not used** — we run our own agent, avoiding this line entirely. |

Sources: [wati](https://www.wati.io/en/blog/whatsapp-service-message-pricing/),
[chatmaxima](https://chatmaxima.com/blog/whatsapp-service-message-pricing-october-2026/),
[myoperator (India)](https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026),
[dev.to rupee breakdown](https://dev.to/preciousky_45d956626d31c3/whatsapp-business-platform-pricing-in-rupees-and-the-two-things-that-change-on-1-october-2026-4ko0).

## Per-conversation cost (worked, with stated assumptions)

Assumptions (all in `cost.config.json`, all flagged estimates):
- **1.5 messages per conversation** on average (one batched answer + an occasional single follow-up).
- **30%** of our messages call the LLM; **₹0.05** per LLM'd message (placeholder).
- Beyond the free 1,000/month, marginal Meta cost = ₹0.115 per outbound message.

```
Meta cost / conversation   = 1.5 msgs × ₹0.115            ≈ ₹0.173
LLM cost  / conversation   = 1.5 × 0.30 × ₹0.05           ≈ ₹0.023
------------------------------------------------------------------
Total (marginal)           ≈ ₹0.196  ≈ $0.0023  per conversation
```

The first 1,000 service messages each month are free, so genuinely low-traffic
months can be **₹0**.

## Scenario table (marginal cost, free tier ignored at scale)

| Conversations | Meta (₹) | LLM (₹) | Total (₹) | ≈ USD |
|---|---|---|---|---|
| 10,000 | 1,725 | 225 | 1,950 | $22 |
| 100,000 | 17,250 | 2,250 | 19,500 | $224 |
| 1,000,000 | 172,500 | 22,500 | 195,000 | $2,241 |
| 10,000,000 | 1,725,000 | 225,000 | 1,950,000 | $22,414 |

*USD ≈ ₹87/$. These are order-of-magnitude planning figures, not quotes.*

**Reading it:** even at ten million conversations across the whole mela, Meta
messaging dominates (~88% of cost) and the total is ~₹19.5 lakh (~$22k). The LLM
is the cheap part — so the 70%-cache target is about resilience and latency more
than rupees. **The rupee lever is message count**: one message per answer,
minimal follow-ups.

## Cost-control mechanisms (in `cost.config.json`)

- **One batched message per answer** — the primary Meta-cost control.
- **Per-number rate limit** — 20 msgs/number/day, 5/min burst; abuse or a runaway
  loop can't run up spend. On exceed, one cached limit-notice then silence
  (un-sent replies cost nothing).
- **Global daily spend cap** with tiers: **warn 70% → soft-kill 90% → hard-kill
  100%**.
  - *Soft-kill*: LLM off (cache/canned only) + no follow-ups (one reply max).
  - *Hard-kill*: stop sending replies; webhook still returns 200 so Meta doesn't
    retry; every dropped message logged. Because a reply not sent is not billed,
    this is the only true emergency brake on Meta spend.
- **Manual kill switch** — a single operator boolean forcing hard-kill.
- **Cost logged per conversation** (phone number stored as a salted hash).

## The 24-hour window and templates

Users reach us via **wa.me** deep links, so almost every exchange is
**user-initiated and inside the 24h service window** — one free-form service
message answers them. We should **avoid proactive/out-of-window messaging**
almost entirely; if it's ever needed (e.g. a safety notice), it requires an
approved **utility template** (₹0.115) and explicit handling. Design implication:
this is a **pull service** — it answers when asked and does not chase users,
which is also the cheapest and least intrusive posture (constraint #10).

## Own agent vs Meta Business Agent (confirmed)

We run **our own agent**. Meta's managed **Business Agent** would add **per-token
AI billing from 1 Aug 2026** on top of the message rates — a strictly higher
cost with less control over the strict no-hallucination retrieval rules. Our-own
is both cheaper and safer here.

## What still must be verified before this model is trusted

1. **Pin the exact 1-Oct-2026 India rate** from Meta's official developer pricing
   (₹0.115 vs ₹0.145). It should be published now (promised by 1 Sep 2026).
2. Replace the **LLM per-message cost** placeholder with the chosen model's real
   token price once the model is selected (the brief says keep it configurable —
   `cost.config.json` already does).
3. Validate the **1.5 msgs/conversation** and **30% LLM** assumptions against the
   evaluation set (D5) once it exists.
4. Confirm whether the operator's BSP-free **direct Cloud API** setup changes any
   allowance (the free 1,000/month is per business number).
