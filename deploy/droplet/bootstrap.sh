#!/usr/bin/env bash
# Server-side provisioning for the Kumbh Mela 2027 project.
#
# Run ONCE on a fresh Ubuntu 24.04 Droplet as root (or via sudo):
#   curl -O https://raw.githubusercontent.com/nethority-in/KumbhMela-engine/main/deploy/droplet/bootstrap.sh
#   sudo bash bootstrap.sh kumbh.example.com bot.kumbh.example.com
#
# Idempotent: safe to re-run. Creates an unprivileged `kumbh` user, installs the
# runtime, serves the guide behind nginx, and runs the bot under systemd.
#
# The bot listens on 127.0.0.1 only. It is never exposed directly; nginx
# terminates TLS and proxies. That is what lets Meta's webhook reach it over
# HTTPS without the Node process ever holding a certificate.

set -euo pipefail

SITE_DOMAIN="${1:?usage: bootstrap.sh <site-domain> <bot-domain>}"
BOT_DOMAIN="${2:?usage: bootstrap.sh <site-domain> <bot-domain>}"

APP_USER=kumbh
APP_HOME=/opt/kumbh
SITE_ROOT=/var/www/kumbh-guide
STATE_DIR=/var/lib/kumbh-bot
BOT_PORT=8080

SITE_REPO="git@github.com:nethority-in/KumbhMela-.git"
ENGINE_REPO="git@github.com:nethority-in/KumbhMela-engine.git"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

# --------------------------------------------------------------------------- #
log "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  nginx git curl unzip rsync ufw fail2ban \
  ca-certificates gnupg build-essential python3 python3-venv python3-pip

# --------------------------------------------------------------------------- #
log "Node.js 22 (the bot needs >=20; 22 is what it was built against)"
if ! command -v node >/dev/null || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]; then
  mkdir -p -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs
fi
node -v

# --------------------------------------------------------------------------- #
log "Service user: $APP_USER"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi
mkdir -p "$APP_HOME" "$SITE_ROOT" "$STATE_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_HOME" "$STATE_DIR"

# --------------------------------------------------------------------------- #
log "SSH access for $APP_USER"
# The deploy key you added to GitHub is NOT in root's authorized_keys. Without
# this, `git pull` inside the service user cannot read the repos.
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"

if [ -f /root/.ssh/id_ed25519.pub ]; then
  install -m 600 -o "$APP_USER" -g "$APP_USER" /root/.ssh/id_ed25519 \
    "/home/$APP_USER/.ssh/id_ed25519"
  install -m 644 -o "$APP_USER" -g "$APP_USER" /root/.ssh/id_ed25519.pub \
    "/home/$APP_USER/.ssh/id_ed25519.pub"
else
  warn "no /root/.ssh/id_ed25519.pub - cloning as $APP_USER may fail."
  warn "run: ssh-keygen -t ed25519 -N '' (accept the default path), then add the pubkey to GitHub."
fi

# Create the files before chowning them, or chown fails on a missing path and,
# under `set -e`, takes the whole script down.
touch "/home/$APP_USER/.ssh/known_hosts"
cat > "/home/$APP_USER/.ssh/config" <<SSHCONF
Host github.com
  StrictHostKeyChecking accept-new
SSHCONF
chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh"
chmod 700 "/home/$APP_USER/.ssh"
chmod 600 "/home/$APP_USER/.ssh/config" "/home/$APP_USER/.ssh/known_hosts"

# git refuses to operate on a repo owned by another user. Harmless here, but it
# produces a confusing "dubious ownership" error, so it is pre-empted.
git config --system --add safe.directory "$APP_HOME/pipeline"
git config --system --add safe.directory "$APP_HOME/site"

# --------------------------------------------------------------------------- #
log "Cloning repositories"
su - "$APP_USER" -c "test -d $APP_HOME/site/.git" || \
  su - "$APP_USER" -c "git clone --depth 1 $SITE_REPO $APP_HOME/site"
su - "$APP_USER" -c "test -d $APP_HOME/pipeline/.git" || \
  su - "$APP_USER" -c "git clone --depth 1 $ENGINE_REPO $APP_HOME/pipeline"

log "Publishing the guide into $SITE_ROOT"
rsync -a --delete --exclude '.git' "$APP_HOME/site/" "$SITE_ROOT/"
# rsync carries the source umask across, which leaves directories without the
# execute bit that nginx needs to descend into them - the symptom is a 403 on
# every request. Set the modes explicitly instead of relying on what came over.
chown -R www-data:www-data "$SITE_ROOT"
find "$SITE_ROOT" -type d -exec chmod 755 {} +
find "$SITE_ROOT" -type f -exec chmod 644 {} +

# --------------------------------------------------------------------------- #
log "Python virtualenv for the pipeline"
su - "$APP_USER" -c "cd $APP_HOME/pipeline && python3 -m venv .venv"
su - "$APP_USER" -c "cd $APP_HOME/pipeline && .venv/bin/pip install -q -r engine/requirements.txt"

# --------------------------------------------------------------------------- #
log "nginx"
cat > /etc/nginx/sites-available/kumbh-guide <<NGINX
# The guide. Single page, so unknown paths fall back to index.html.
server {
    listen 80;
    listen [::]:80;
    server_name $SITE_DOMAIN;

    root $SITE_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # The generated calendar changes only when the pipeline re-runs.
    location = /data/calendar.json {
        add_header Cache-Control "public, max-age=300";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
NGINX

cat > /etc/nginx/sites-available/kumbh-bot <<NGINX
# The bot. TLS terminates here; Node stays on loopback with no certificate.
server {
    listen 80;
    listen [::]:80;
    server_name $BOT_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$BOT_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Webhook replies are fast, but Meta retries aggressively on anything
        # slow, so give the handler room before timing out.
        proxy_read_timeout 30s;
    }

    # Nobody needs the health endpoint exposed to the internet.
    location = /healthz { allow 127.0.0.1; deny all; proxy_pass http://127.0.0.1:$BOT_PORT; }
}
NGINX

ln -sf /etc/nginx/sites-available/kumbh-guide /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/kumbh-bot  /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t

# --------------------------------------------------------------------------- #
log "systemd unit for the bot"
cat > /etc/systemd/system/kumbh-bot.service <<UNIT
[Unit]
Description=Kumbh 2027 WhatsApp information bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_HOME/pipeline
EnvironmentFile=/etc/kumbh-bot.env
ExecStart=/usr/bin/node bot/server.js
Restart=always
RestartSec=5

# The bot's only legitimate write target is its cost log.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$STATE_DIR

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/kumbh-bot.env <<ENV
PORT=$BOT_PORT
BOT_DATA_DIR=$STATE_DIR
START_LANG=auto
DRY_RUN=true
BOT_HASH_SALT=__GENERATE_ME__
WEBHOOK_VERIFY_TOKEN=__GENERATE_ME__
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
ENV
chmod 640 /etc/kumbh-bot.env
chown root:"$APP_USER" /etc/kumbh-bot.env

# Fill both secrets now, so the file is never committed half-built. Written by
# key name rather than by replacing a placeholder, which cannot tell the two
# apart. od is coreutils, so this fallback has no package dependency.
randhex() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
SALT=$(randhex 32)
VERIFY=$(randhex 24)
sed -i "s|^BOT_HASH_SALT=.*|BOT_HASH_SALT=$SALT|" /etc/kumbh-bot.env
sed -i "s|^WEBHOOK_VERIFY_TOKEN=.*|WEBHOOK_VERIFY_TOKEN=$VERIFY|" /etc/kumbh-bot.env

systemctl daemon-reload
systemctl enable --now kumbh-bot.service

# --------------------------------------------------------------------------- #
log "Firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# --------------------------------------------------------------------------- #
log "Verifying the bot is up"
for i in $(seq 1 10); do
  if curl -fsS "http://127.0.0.1:$BOT_PORT/healthz" >/dev/null 2>&1; then
    curl -fsS "http://127.0.0.1:$BOT_PORT/healthz"; echo
    break
  fi
  sleep 1
done

systemctl reload nginx

cat <<SUMMARY

--------------------------------------------------------------------------
 Bootstrap complete.

 Still to do, in this order:

 1. Point DNS at this Droplet:
      $SITE_DOMAIN      -> this server
      $BOT_DOMAIN       -> this server

 2. Get certificates (needs DNS live first):
      certbot --nginx -d $SITE_DOMAIN -d $BOT_DOMAIN

 3. Run the pipeline once and publish the calendar:
      sudo bash $APP_HOME/pipeline/deploy/droplet/run-pipeline.sh

 4. Start Meta verification (1-3 weeks). Set in the Meta dashboard:
      webhook URL   https://$BOT_DOMAIN/webhook
      verify token  the WEBHOOK_VERIFY_TOKEN from /etc/kumbh-bot.env
      subscribe to  messages

 5. When Meta is approved and the answers look right:
      sed -i 's/^DRY_RUN=true/DRY_RUN=false/' /etc/kumbh-bot.env
      systemctl restart kumbh-bot

 Read the WEBHOOK_VERIFY_TOKEN with:
      sudo grep WEBHOOK_VERIFY_TOKEN /etc/kumbh-bot.env
--------------------------------------------------------------------------
SUMMARY
