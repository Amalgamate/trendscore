#!/usr/bin/env bash
# L2C-0-06: Compare key names in the committed env files against what is live
# on the VPS, so we know which leaked credentials are still active.
# Prints LIVE or DEAD for each key — never prints values.
# Run from the repo root on your local machine (needs ssh 'production' alias).
#
# Usage: bash scripts/ops/secret-fingerprints.sh
set -euo pipefail

LIVE_KEYS=$(ssh production "sudo cat /srv/zawadi/apps/.env.console | grep -v '^#' | grep -v '^$' | cut -d= -f1")
LIVE_SERVER_ENV=$(ssh production "sudo cat /srv/zawadi/apps/.env.production 2>/dev/null | grep -v '^#' | grep -v '^$' | cut -d= -f1 || echo ''")
ALL_LIVE="$LIVE_KEYS
$LIVE_SERVER_ENV"

# Keys from the committed server/.env.production at 3a5afe96
COMMITTED_KEYS=(
  DATABASE_URL
  SUPABASE_URL
  SUPABASE_ANON_KEY
  JWT_SECRET
  JWT_REFRESH_SECRET
  JWT_EXPIRES_IN
  JWT_REFRESH_EXPIRES_IN
  FRONTEND_URL
  RESEND_API_KEY
  EMAIL_FROM
  REDIS_HOST
  REDIS_PORT
  ENCRYPTION_KEY
  CLOUDINARY_URL
)

echo "Key fingerprint check — committed server/.env.production (3a5afe96) vs VPS"
echo "LIVE = same key name exists in the VPS env files (value may differ)"
echo "DEAD = key not present on VPS (probably unused service)"
echo "------------------------------------------------------------------------"
for key in "${COMMITTED_KEYS[@]}"; do
  if echo "$ALL_LIVE" | grep -qx "$key"; then
    echo "LIVE  $key"
  else
    echo "DEAD  $key"
  fi
done

echo ""
echo "Note: LIVE means the key NAME exists — it does not prove the committed VALUE"
echo "is still in use. Rotate any LIVE key for services you still actively use."
