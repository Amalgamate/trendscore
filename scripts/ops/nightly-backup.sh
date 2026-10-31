#!/usr/bin/env bash
# Nightly consistent backup of the platform-console billing database (L2C-0-09).
# Runs on the VPS host (as root, from cron). Needs backup-db.mjs in the same folder.
#
# Install (once):
#   scp scripts/ops/nightly-backup.sh scripts/backup-db.mjs production:/srv/zawadi/ops/
#   ssh production "chmod 700 /srv/zawadi/ops/nightly-backup.sh"
#   crontab line (root):  15 1 * * * BACKUP_OWNER=<ssh-user> /srv/zawadi/ops/nightly-backup.sh >> /srv/zawadi/ops/backup.log 2>&1
#   (01:15 UTC = 04:15 Nairobi)
#
# Result: <host data dir>/billing-backups/nightly-<UTC stamp>.sqlite, newest 14 days kept.
set -euo pipefail

CONTAINER="${CONTAINER:-zawadi-console}"
CONTAINER_DATA="${CONTAINER_DATA:-/app/data}"
HOST_DATA="${HOST_DATA:-/srv/zawadi/apps/console-data}"
KEEP_DAYS="${KEEP_DAYS:-14}"
BACKUP_OWNER="${BACKUP_OWNER:-}"   # user that pulls the file over scp; it must be able to read it

HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="nightly-${STAMP}.sqlite"

fail() { echo "$(date -u +%FT%TZ) BACKUP FAILED: $1"; exit 1; }
trap 'fail "unexpected error on line $LINENO"' ERR

[ -f "$HERE/backup-db.mjs" ] || fail "backup-db.mjs missing next to this script"
docker inspect "$CONTAINER" >/dev/null 2>&1 || fail "container $CONTAINER not found"

docker cp "$HERE/backup-db.mjs" "$CONTAINER:/tmp/backup-db.mjs"
docker exec "$CONTAINER" node --experimental-sqlite /tmp/backup-db.mjs \
  "$CONTAINER_DATA/platform-billing.sqlite" "$CONTAINER_DATA/billing-backups/$NAME"

FILE="$HOST_DATA/billing-backups/$NAME"
[ -s "$FILE" ] || fail "backup file not found on the host at $FILE (check the bind mount path)"
chmod 600 "$FILE"
[ -n "$BACKUP_OWNER" ] && chown "$BACKUP_OWNER" "$FILE"

# retention: nightly files older than KEEP_DAYS are removed; other backups are never touched
find "$HOST_DATA/billing-backups" -maxdepth 1 -name 'nightly-*.sqlite' -mtime +"$KEEP_DAYS" -delete

echo "$(date -u +%FT%TZ) backup ok: $NAME ($(stat -c %s "$FILE") bytes)"
