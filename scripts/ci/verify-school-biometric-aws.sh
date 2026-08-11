#!/usr/bin/env bash
# Run the server-side biometric AWS diagnostic through the protected deploy SSH
# connection. The remote diagnostic reads credentials only from the container.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ssh-retry.sh
source "${SCRIPT_DIR}/ssh-retry.sh"

SCHOOL_ID="${SCHOOL_ID:-}"
[[ "${SCHOOL_ID}" =~ ^[a-z0-9][a-z0-9-]*$ ]] || {
  printf '[aws-verify] ERROR: SCHOOL_ID is missing or invalid\n' >&2
  exit 1
}

run_with_ssh_retry "AWS biometric verification" \
  ssh production "sudo /srv/zawadi/apps/deploy/verify-school-biometric-aws.sh '${SCHOOL_ID}'"
