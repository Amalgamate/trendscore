#!/usr/bin/env bash
# Establish SSH connectivity before invoking a non-idempotent production command.
# This script never runs the deployment itself, so reconnect retries are safe.
set -euo pipefail

attempt=1
max_attempts="${SSH_RETRY_ATTEMPTS:-5}"
delay="${SSH_RETRY_DELAY_SECONDS:-3}"

while ! ssh production 'true'; do
  if [[ "${attempt}" -ge "${max_attempts}" ]]; then
    echo "Production SSH preflight failed after ${max_attempts} attempts" >&2
    exit 1
  fi

  echo "Production SSH preflight failed (attempt ${attempt}/${max_attempts}); retrying in ${delay}s..." >&2
  sleep "${delay}"
  attempt=$((attempt + 1))
  delay=$((delay * 2))
done
