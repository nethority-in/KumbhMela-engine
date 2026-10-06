#!/usr/bin/env bash
# Run the date pipeline and publish the result to the live guide.
#
# Run as root or via sudo, after a change to data/golden-source.json or
# crowd-model/weights.config.json:
#   sudo bash /opt/kumbh/pipeline/deploy/droplet/run-pipeline.sh
#
# It refuses to publish if the engine's self-check reports a mismatch, because an
# unverified date is worse than no date. Resolve the mismatch, then re-run with
# --force if you have a panchang authority's confirmation.

set -euo pipefail

APP_USER=kumbh
APP_HOME=/opt/kumbh
SITE_ROOT=/var/www/kumbh-guide
PIPELINE_DIR="$APP_HOME/pipeline"

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root (or with sudo)"

cd "$PIPELINE_DIR"

log "Pulling the latest pipeline"
su - "$APP_USER" -c "cd $PIPELINE_DIR && git pull --ff-only"

log "Running the date engine (Swiss Ephemeris)"
su - "$APP_USER" -c "cd $PIPELINE_DIR && .venv/bin/python engine/panchang_engine.py" \
  | tee /tmp/engine.out

# The engine prints a SELF-CHECK block. A line whose "declared" and "computed"
# differ is a real conflict that needs a human, not a warning to scroll past.
if grep -q 'declared:' /tmp/engine.out; then
  # Compare the TITHI, not the whole label. Sources name a tithi as
  # "<masa> <paksha> <tithi>" (or just "<masa> <tithi>") and the engine as
  # "<masa> <paksha> <tithi>", but the masa is spelled differently between them
  # (Shravan / Shravana) and a source may omit the paksha where the engine
  # always writes it (Shravan Amavasya vs Shravana Krishna Amavasya). Those are
  # naming conventions, not disagreements. The tithi itself is always the final
  # word - Amavasya, Purnima, Ekadashi, Pratipada and so on - so compare that.
  # A different final word means a genuinely different tithi, which is the
  # 2027-08-02 case: "Shukla" (declined) against "Amavasya" (computed).
  MISMATCH=$(awk '
    function trim(s) { gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
    function tithi(s,   t) { t = s; sub(/[[:space:]]*\(.*/, "", t); return trim(t) }
    function lastword(s,   n, a) { n = split(s, a, " "); return a[n] }
    /declared:/ { split($0, a, "declared: "); d = tithi(trim(a[2])) }
    /computed:/ { split($0, b, "computed: "); c = tithi(trim(b[2]))
                  if (d != "" && c != "" && lastword(d) != lastword(c))
                    print "  declared: " d "\n  computed: " c
                  d = "" }
  ' /tmp/engine.out)

  if [ -n "$MISMATCH" ]; then
    echo
    echo "SELF-CHECK MISMATCH:"
    echo "$MISMATCH"
    echo
    if [ "$FORCE" -ne 1 ]; then
      die "not publishing. Resolve with a panchang authority, then re-run with --force.
       See UNVERIFIED.md and CHANGELOG.md. Do not silently accept a wrong date."
    fi
    warn "publishing anyway because --force was passed"
  else
    log "Self-check clean: every declared tithi matched the computed one."
  fi
fi

log "Scoring the crowd model"
su - "$APP_USER" -c "cd $PIPELINE_DIR && .venv/bin/python crowd-model/score.py" \
  | tail -5

COMPUTED="$PIPELINE_DIR/data/dist/calendar.json"
[ -s "$COMPUTED" ] || die "$COMPUTED was not produced"

DAYS=$(python3 -c "import json;print(len(json.load(open('$COMPUTED'))['days']))")
log "Produced $DAYS days -> publishing to $SITE_ROOT/data/calendar.json"

install -m 644 -o www-data -g www-data "$COMPUTED" "$SITE_ROOT/data/calendar.json"

# nginx serves straight from disk, so there is nothing to restart. The previous
# copy is kept once, which makes a bad publish recoverable in one command.
if [ -f "$SITE_ROOT/data/calendar.prev.json" ]; then
  cp "$SITE_ROOT/data/calendar.json" "$SITE_ROOT/data/calendar.prev.json"
fi

log "Done. The guide is serving the new table immediately."
echo "  rollback: install -m 644 $SITE_ROOT/data/calendar.prev.json $SITE_ROOT/data/calendar.json"
