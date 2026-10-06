# WhatsApp bot — deliverable 4

An information bot for the Simhastha Kumbh 2027, on the WhatsApp Cloud API
directly, with no BSP in between.

**Zero runtime dependencies.** Node built-ins only, so the Docker build has
nothing to install and nothing to break.

## The one rule this bot is built around

> No message it ever sends contains a date or fact that did not come out of
> `data/dist/calendar.json` or `data/golden-source.json`.

There is no model in the answering path. Not "a model with strict rules" — no
model. If a fact is not in the JSON, the bot says it does not have it and
points you at the website. That is checked by tests, not by good intentions.

## What it will answer

| Intent | Example | Source |
|---|---|---|
| Every auspicious day | "which days are auspicious" | `calendar.json` |
| A specific day | "2 august", "11/9/2027" | `calendar.json` |
| The quieter days | "which day is less crowded" | `calendar.json`, lowest 3 |
| How crowds are estimated | "how crowded will it be" | `weights.config.json` bands |
| The two waters | "ramkund or kushavarta" | `golden-source.json` |
| Emergency numbers | "helpline" | `golden-source.json`, confirmed only |
| Which akhara bathes where | "which akhara" | **refuses to guess** |

Three languages, detected per message: English, Hindi, Marathi.

## What it deliberately will not do

- Say **safe** or **unsafe**. It models crowd *size* only.
- Say **avoid this day** or name a **best day**. It presents trade-offs.
- Quote a mela control-room number. Those change per event; it tells you to
  read the official board instead.
- Give travel routes or distances. Not in the data, so it refuses.
- Send more than one message per answer.

## Spend control

Every reply we send inside the 24-hour window is a billable service message.
**Caching does not reduce that.** The only lever is how many replies go out, so
`bot/cost.config.json` drives three guardrails, enforced in `store.js`:

1. **Per number** — 20 messages/day, 5/min. On exceed: one cached notice, then
   silence. An un-sent reply is not billed, which is what makes silence cheaper
   than answering.
2. **Daily spend cap** — warn 70%, soft-kill 90% (cache-only, no follow-ups),
   hard-kill 100% (stop replying entirely). The webhook still returns 200 so
   Meta does not retry.
3. **Free allowance** — the first 1,000 service messages per number per month
   cost nothing; past that, the rate in `cost.config.json` applies.

Phone numbers are stored as a **salted SHA-256 hash**, never in plaintext.

## Run it

```bash
npm test                      # 28 assertions, no network, no credentials
DRY_RUN=true node bot/server.js
```

Test the webhook by hand:

```bash
curl -s localhost:8080/healthz
curl -s "localhost:8080/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=OK"
```

## Go live

1. `DRY_RUN=false`, and set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`,
   `WEBHOOK_VERIFY_TOKEN`, `BOT_HASH_SALT`.
2. Point the Meta webhook at `https://<your-domain>/webhook`, subscribe to
   `messages`.
3. **Pin Meta's official India rate in `cost.config.json`** — the file currently
   carries 0.115 from secondary sources, and 0.145 appears elsewhere. This is
   the single number that decides what a conversation costs.
4. Confirm the bot never says safe/unsafe. `npm test` asserts it on every
   language; re-run it after any copy change.

## Deploy on EasyPanel

- **App** service, builder **Dockerfile**, path `bot/Dockerfile`.
- **Port** 8080, and attach a domain so Meta can reach the webhook.
- Add `BOT_DATA_DIR=/app/state` as a **storage mount**, or the monthly
  free-allowance accounting resets on every redeploy.
- Secrets go in the service's Environment section, never in git.
