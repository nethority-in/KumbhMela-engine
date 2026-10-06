# Deployment — platform-neutral

*Deployment target is not yet decided. This document states what each component
**requires** so it can be dropped onto any host. It is deliberately not a
click-by-click guide for one vendor, because that would need rewriting the
moment the platform is chosen.*

EasyPanel currently serves the **landing page only**. The website (the guide) and
the backend (the WhatsApp bot) are meant to be deployed elsewhere. Nothing in the
code is tied to EasyPanel — it was the first host tried, not a dependency.

---

## The three components

| Component | Repo | What it is | Needs |
|---|---|---|---|
| Landing page | — | static marketing page | a web server |
| Website (the guide) | `nethority-in/KumbhMela-` | static `index.html` + `data/calendar.json` | a web server. No runtime, no build |
| Backend (bot) | `nethority-in/KumbhMela-engine` | Node 22, zero dependencies | a Node runtime + writable disk |
| Pipeline (build step) | `nethority-in/KumbhMela-engine` | Python + `pyswisseph` | Python 3.11+. **Not a service** — a job you run |

---

## 1. Website (the guide)

**What it is:** one HTML file with inline CSS and JS, plus one JSON file. No
package manager, no build step, no server-side code.

**Requirements**
- Any web server that can serve a directory: nginx, Caddy, Apache, an S3/Blob
  bucket behind a CDN, or a static host.
- `index.html` at the site root.
- **`data/calendar.json` must be reachable at the same origin.** The page fetches
  `data/calendar.json` with a relative path. If the JSON lives on a different
  host, that request becomes cross-origin and needs CORS — avoid this by serving
  both from the same place.
- HTTPS. The page is fully functional over HTTP, but the domain must be
  certificate-backed before Meta will accept the bot webhook.

**Graceful degradation (already built in)**
- No JavaScript → the original hand-written summary cards remain visible.
- `calendar.json` fails to load → the page says so and keeps the summary dates.
  Nothing breaks and nothing lies.

**The nginx Dockerfile in that repo (`Dockerfile`, 3 lines) is optional.** It is
useful for any Docker host, not just EasyPanel.

---

## 2. Backend (the WhatsApp bot)

**What it is:** a single Node 22 process. **Zero npm dependencies** — only Node
built-ins, so there is nothing to install and no lockfile to drift.

**Requirements**
- Node **22** (or 20+).
- One HTTP port, taken from `PORT` (defaults to 8080). Must bind `0.0.0.0`.
- A **writable, persistent directory** for `BOT_DATA_DIR`.
- A **stable public HTTPS URL** — Meta requires a valid certificate to deliver
  webhooks, and the URL cannot change without re-registering the webhook.

**Environment**

| Variable | Required | Note |
|---|---|---|
| `DRY_RUN` | yes | `true` logs instead of sending. **Keep `true` until answers are reviewed** |
| `PORT` | yes | `8080` unless the platform assigns one |
| `WEBHOOK_VERIFY_TOKEN` | go-live | any non-empty value; must match the Meta webhook config |
| `WHATSAPP_TOKEN` | go-live | from the Meta dashboard |
| `WHATSAPP_PHONE_ID` | go-live | from the Meta dashboard |
| `BOT_HASH_SALT` | go-live | generate once; changing it breaks continuity of the monthly free-allowance accounting |
| `START_LANG` | optional | `auto` (default) detects hi/mr/en per message |
| `BOT_DATA_DIR` | recommended | persistent mount path |

**The persistence is not optional.** Without it, the cost log and the monthly
free-allowance counter reset on every restart or redeploy, which silently
over-counts spend against the 1,000 free messages per number per month.

**Health check:** `GET /healthz` returns day count, table version, dry-run flag,
and kill-switch state. Point the platform's health check here.

---

## 3. The pipeline (a job, not a service)

```bash
pip install -r engine/requirements.txt
python engine/panchang_engine.py    # -> data/dist/calendar_computed.json + self-check
python crowd-model/score.py         # -> data/dist/calendar.json
```

**Read the self-check output before anything is published.** On the first run, two
of the three Amrit Snan dates matched their computed tithi and one did not
(2027-08-02 — see `CHANGELOG.md` and `UNVERIFIED.md` #1). A mismatch is a reason
to stop, not a warning to scroll past.

**This runs when the data changes, not continuously.** There are no live feeds by
design — the site and bot are read-only consumers of a static JSON file.

**Order of operations**
1. Edit `data/golden-source.json` or `crowd-model/weights.config.json`
2. Run the pipeline
3. Read the self-check
4. Copy `data/dist/calendar.json` into the website repo's `data/` and commit
5. Redeploy the website — Auto Deploy or equivalent picks it up

---

## Choosing a platform — the two real constraints

Most of this is free-tier judgement, but two things genuinely narrow the choice:

**A stable HTTPS URL for the bot.** Meta registers one webhook URL. It must stay
valid from now until Sept 2027. Avoid anything that sleeps, redeploys to a new
host, or gives you a changing URL (many preview-deploy services do this).

**A persistent writable volume.** Free tiers commonly offer ephemeral filesystems.
That breaks the free-allowance accounting described above. Check this before
committing to a host.

Everything else — provider, region, language runtime support — is ordinary
choice. A Railway/Render/Fly/Cloud Run style Node service and a static host for
the guide covers the whole project.
