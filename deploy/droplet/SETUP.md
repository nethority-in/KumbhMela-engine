# Manual server setup — exact commands

*Host: DigitalOcean Droplet (Ubuntu 24.04). Two repos, one unprivileged service
user, nginx for TLS, systemd for the bot.*

Run the numbered blocks in order. Blocks A–C are on your **Mac**; everything from
D onwards is on the **Droplet**, reached over SSH.

---

## A. SSH key on your Mac

One key, used for both DigitalOcean and GitHub.

```bash
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519 -C "kumbh-deploy"
pbcopy < ~/.ssh/id_ed25519.pub
```

`pbcopy` puts the **public** key on your clipboard. Never copy
`id_ed25519` without `.pub` — that is the private key and it must stay on this
machine.

## B. The key on GitHub

**Settings → SSH and GPG keys → New SSH key**

| Field | Value |
|---|---|
| Title | `kumbh-deploy (MacBook)` |
| Key type | Authentication Key |
| Key | paste from clipboard |

Using an **account key** rather than a per-repo deploy key, because the same key
must read *two* repos and a deploy key is scoped to one repo.

To confirm it works:

```bash
ssh -T git@github.com
# "Hi <user>! You've successfully authenticated..."
```

## C. Create the Droplet with that key

**DigitalOcean → Droplets → Create**

| Field | Value |
|---|---|
| Image | Ubuntu 24.04 LTS x64 |
| Authentication | **SSH key** → the one from step A |
| Size | smallest that fits; the guide and bot are both light |
| Region | closest to your users — Mumbai if offered |

Then, from your Mac:

```bash
ssh root@<DROPLET_IP>
```

## D. Point DNS before anything else

TLS cannot be issued until DNS resolves, so do this before the certificate step.

Both records already exist and point at `139.59.46.221`, the Droplet. The apex
`mahakumbh.net` points at `104.248.165.174`, which is EasyPanel — that is the
landing page and is a separate machine.

| Type | Host | Value | Serves |
|---|---|---|---|
| A | `@` | `104.248.165.174` | landing page (EasyPanel) |
| A | `app` | `139.59.46.221` | the guide (this Droplet) |
| A | `api` | `139.59.46.221` | the bot webhook (this Droplet) |

**Confirm the TTL has actually expired before running certbot.** Certbot validates
from several public resolvers, and one of them still returning an old answer is
enough to fail the request. Check from two different networks:

```bash
dig +short app.mahakumbh.net A
dig +short api.mahakumbh.net A
```

Both must return `139.59.46.221`. `whatsmydns.net` is a good second opinion, since
your own resolver may still be caching the old answer.

## E. Run the bootstrap

Still on the Droplet as root:

```bash
git clone git@github.com:nethority-in/KumbhMela-engine.git /tmp/kumbh-engine
sudo bash /tmp/kumbh-engine/deploy/droplet/bootstrap.sh \
  app.mahakumbh.net \
  api.mahakumbh.net
```

It is idempotent, so re-running is safe. It installs the packages, Node 22, the
`kumbh` user, both repos, the Python virtualenv, the nginx sites, the systemd
unit, and the firewall.

Confirm the bot answered:

```bash
curl -fsS http://127.0.0.1:8080/healthz
```

Expect `{"ok":true,"dry_run":true,"days":102,...}`.

## F. TLS certificates

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d app.mahakumbh.net -d api.mahakumbh.net
```

Answer **Y** to redirect HTTP to HTTPS. Certbot also installs a renewal timer;
verify it with `certbot renew --dry-run`.

## G. Run the pipeline once

```bash
sudo bash /opt/kumbh/pipeline/deploy/droplet/run-pipeline.sh
```

**Read the self-check output.** On a current checkout it reports a mismatch for
2 Aug 2027 (declared "Shravan Shukla", computed "Ashadha Krishna Amavasya"), so
the script will refuse to publish. That is intentional — an unverified date is
worse than no date. Once a panchang authority has ruled on it, re-run with
`--force` and record the decision in `CHANGELOG.md`.

## H. Go live with Meta

1. Read the verify token:
   ```bash
   sudo grep WEBHOOK_VERIFY_TOKEN /etc/kumbh-bot.env
   ```
2. Meta Business Suite → **WhatsApp → API Setup**
   - Webhook URL: `https://api.mahakumbh.net/webhook`
   - Verify token: the value above
   - Subscribe to: `messages`
3. Send a message to the business number and watch the log:
   ```bash
   journalctl -u kumbh-bot -f
   ```
   You should see `[bot] <intent>/<lang> ...`.
4. `DRY_RUN` stays `true` until you are satisfied with the answers. Then:
   ```bash
   sudo sed -i 's/^DRY_RUN=true/DRY_RUN=false/' /etc/kumbh-bot.env
   sudo systemctl restart kumbh-bot
   ```

---

## Everyday commands

```bash
# what is running
systemctl status kumbh-bot
journalctl -u kumbh-bot -f          # live logs
journalctl -u kumbh-bot --since "1 hour ago"

# restart after a code change
cd /opt/kumbh/pipeline && sudo -u kumbh git pull --ff-only
sudo systemctl restart kumbh-bot

# update the guide's HTML
cd /opt/kumbh/site && sudo -u kumbh git pull --ff-only
sudo rsync -a --delete --exclude '.git' /opt/kumbh/site/ /var/www/kumbh-guide/

# re-run the pipeline after a data change
sudo bash /opt/kumbh/pipeline/deploy/droplet/run-pipeline.sh

# the kill switch: stop replying without stopping the webhook
sudo systemctl stop kumbh-bot      # hard kill — no replies, no Meta charges

# certificates
sudo certbot renew --dry-run
```

## Layout on the server

| Path | What |
|---|---|
| `/opt/kumbh/site` | guide repo (cloned by `kumbh`) |
| `/opt/kumbh/pipeline` | engine + bot repo |
| `/var/www/kumbh-guide` | what nginx actually serves |
| `/var/lib/kumbh-bot` | cost log — **this is why the systemd unit exists** |
| `/etc/kumbh-bot.env` | secrets, mode `640`, never in git |

## Two things that will bite you if forgotten

**The cost log must survive restarts.** It lives in `/var/lib/kumbh-bot`, and the
systemd unit is what keeps it on a real path. Lose it and the monthly
1,000-free-message allowance resets, so spend gets over-counted against you.

**The bot URL must not change.** Meta registers one webhook URL and expects it to
stay valid until Sept 2027. Do not rename the subdomain, and do not let the
Droplet IP change without also re-registering the webhook in Meta.
