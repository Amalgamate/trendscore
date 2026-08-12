#!/usr/bin/env bash
set -euo pipefail

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
ssh-keyscan -H "${CLEAN_HOST}" >> ~/.ssh/known_hosts 2>/dev/null || true

{
  echo "Host production"
  echo "  HostName ${CLEAN_HOST}"
  echo "  User ${DEPLOY_USER}"
  echo "  IdentityFile ~/.ssh/deploy_key"
  echo "  IdentitiesOnly yes"
  echo "  StrictHostKeyChecking accept-new"
  echo "  ConnectTimeout 20"
  echo "  ConnectionAttempts 3"
  echo "  ServerAliveInterval 15"
  echo "  ServerAliveCountMax 3"
} > ~/.ssh/config

echo "SSH configured for ${DEPLOY_USER}@${CLEAN_HOST}"
