#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ssh-retry.sh
source "${SCRIPT_DIR}/ssh-retry.sh"

test -n "${DEPLOY_HOST:-}" || { echo "DEPLOY_HOST secret is required" >&2; exit 1; }
test -n "${DEPLOY_USER:-}" || { echo "DEPLOY_USER secret is required" >&2; exit 1; }
test -n "${DEPLOY_SSH_KEY:-}" || { echo "DEPLOY_SSH_KEY secret is required" >&2; exit 1; }

CLEAN_HOST="${DEPLOY_HOST#http://}"
CLEAN_HOST="${CLEAN_HOST#https://}"
CLEAN_HOST="${CLEAN_HOST%%/*}"
test -n "${CLEAN_HOST}"

mkdir -p ~/.ssh
chmod 700 ~/.ssh
printf '%s\n' "${DEPLOY_SSH_KEY}" > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key

{
  echo "Host production"
  echo "  HostName ${CLEAN_HOST}"
  echo "  User ${DEPLOY_USER}"
  echo "  IdentityFile ~/.ssh/deploy_key"
  echo "  IdentitiesOnly yes"
  echo "  BatchMode yes"
  echo "  StrictHostKeyChecking accept-new"
  echo "  ConnectTimeout 20"
  echo "  ConnectionAttempts 1"
  echo "  ServerAliveInterval 15"
  echo "  ServerAliveCountMax 4"
  echo "  TCPKeepAlive yes"
  echo "  ControlMaster auto"
  echo "  ControlPersist 10m"
  echo "  ControlPath ~/.ssh/trendscore-%C"
} > ~/.ssh/config
chmod 600 ~/.ssh/config

echo "SSH configured for ${DEPLOY_USER}@${CLEAN_HOST}"
echo "Opening one authenticated, reusable deployment connection"
run_with_ssh_retry "SSH deployment preflight" ssh production true
ssh -O check production 2>/dev/null || true
