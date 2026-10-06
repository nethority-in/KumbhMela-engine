# Deployment

*Host for the website and backend: **DigitalOcean App Platform**. EasyPanel serves
the landing page only.*

This document states what each component **requires**, then gives App Platform
steps. The requirements section stays platform-neutral on purpose — moving hosts
later should mean re-reading the top half only.

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

## DigitalOcean App Platform — step by step

App Platform suits this project because it already provides the two things it
needs: an **assigned `$PORT`** and a **persistent volume**. It also gives
automatic HTTPS, which Meta requires.

A Droplet with hand-rolled nginx and systemd works too, and is cheaper at
comparable performance. App Platform costs more but removes the ops work, which
matters here because the site must stay up unattended from launch until Sept 2027.

### Step 1 — connect the GitHub account

**Account → Integrations → GitHub → Connect.** This is what enables auto-deploy
on every push to `main`. Without it you will be redeploying by hand.

### Step 2 — the website (the guide)

**Create → App Platform → App → From a GitHub repository**

| Field | Value |
|---|---|
| Repository | `nethority-in/KumbhMela-` |
| Branch | `main` |
| Build method | **Dockerfile** (auto-detected) |
| Dockerfile path | `Dockerfile` |
| HTTP Port | `8080` |

The Dockerfile uses `nginxinc/nginx-unprivileged`, which listens on `8080` and
does not run as root. The port comes from `$PORT` via an envsubst template, so if
DO assigns something else it still binds correctly.

### Step 3 — the backend (the bot)

**Create → App Platform → App → From a GitHub repository**

| Field | Value |
|---|---|
| Repository | `nethority-in/KumbhMela-engine` |
| Branch | `main` |
| Build method | **Dockerfile** |
| Dockerfile path | `bot/Dockerfile` |
| HTTP Port | `8080` |

Then:

1. **Environment** — add these as secrets, not plain values:

   ```
   DRY_RUN=true
   WEBHOOK_VERIFY_TOKEN=<any long random string>
   WHATSAPP_TOKEN=<from Meta>
   WHATSAPP_PHONE_ID=<from Meta>
   BOT_HASH_SALT=<generated once>
   START_LANG=auto
   ```

2. **Storage** — attach a volume mounted at `/app/state`, and confirm
   `BOT_DATA_DIR=/app/state`. **This step is what keeps the monthly
   free-allowance accounting intact.** Without a persistent volume, every deploy
   resets the counter and spend is over-counted against the 1,000 free messages.

3. **Health check** — HTTP GET on `/healthz`.

Leave `DRY_RUN=true` until the answers have been reviewed, then switch to
`false` and redeploy.

### Step 4 — the domain and the Meta webhook

1. Attach the domain to the bot app. App Platform provisions the TLS
   certificate.
2. **The URL must not change.** Do not rename or move the app after Meta has the
   webhook registered.
3. In the Meta dashboard, set the webhook to `https://<bot-domain>/webhook`,
   subscribe to `messages`, and paste `WEBHOOK_VERIFY_TOKEN`.
4. Send a message to the business number and check the app's logs — you should
   see a `[bot] <intent>/<lang>` line.

### Step 5 — order of operations

The bot's image embeds `data/dist/calendar.json`, so it must be committed before
the bot is first deployed. Recommended sequence:

1. Run the pipeline locally, read the self-check
2. Commit `calendar.json` to the site repo and to `data/dist/` in the engine repo
3. Deploy the site
4. Deploy the bot with `DRY_RUN=true`, smoke-test it
5. Only then start Meta verification

### Step 6 — updating the data later

1. Edit `data/golden-source.json` or `crowd-model/weights.config.json`
2. Run the pipeline, read the self-check
3. Commit `calendar.json` into the site repo's `data/`
4. Push — auto-deploy rebuilds the site

**Do not redeploy the bot for a data change.** Its image embeds the JSON, so a
bot redeploy does pick up new data, but there is no reason to trigger one unless
the bot code itself changed.

### First-build caveat

The site Dockerfile has not been built locally — there was no Docker on the build
machine. The first App Platform build is the real test. If it fails, the most
likely cause is the envsubst template path; the fix is to verify
`/etc/nginx/templates/default.conf.template` exists in the image, since the
unprivileged image renders that directory at startup.

---

## The two constraints that actually narrow the choice

Most of hosting is free-tier judgement. Two things genuinely are not:

**A stable HTTPS URL for the bot.** Meta registers one webhook URL and it must
stay valid until Sept 2027. Avoid anything that sleeps, redeploys to a new host,
or hands out changing URLs — many preview-deploy services do exactly that.

**A persistent writable volume.** Ephemeral filesystems break the
free-allowance accounting described above. This is the single most common way a
free-tier deployment of this bot ends up silently overspending.

**A Droplet alternative.** If cost matters more than ops, one Ubuntu Droplet
running nginx for the site plus a systemd unit for the bot does the same job, and
the persistent-volume problem disappears because a Droplet is a real filesystem.
It is more manual, and it is the version to pick if nobody wants to be on call
until 2027.

