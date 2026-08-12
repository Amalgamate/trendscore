#!/usr/bin/env bash

# Retry only idempotent, pre-deployment SSH operations. Do not use this helper
# around the release command itself: a disconnected deployment may already have
# applied migrations or restarted services.
SSH_MAX_ATTEMPTS="${SSH_MAX_ATTEMPTS:-5}"
SSH_RETRY_BASE_DELAY_SECONDS="${SSH_RETRY_BASE_DELAY_SECONDS:-4}"
SSH_RETRY_MAX_DELAY_SECONDS="${SSH_RETRY_MAX_DELAY_SECONDS:-30}"

run_with_ssh_retry() {
  local label="$1"
  shift

  local attempt=1
  local delay="${SSH_RETRY_BASE_DELAY_SECONDS}"
  local exit_code=0

  while (( attempt <= SSH_MAX_ATTEMPTS )); do
    echo "[ssh] ${label} (attempt ${attempt}/${SSH_MAX_ATTEMPTS})"
    if "$@"; then
      return 0
    else
      exit_code=$?
    fi

    if (( attempt == SSH_MAX_ATTEMPTS )); then
      echo "::error::${label} failed after ${SSH_MAX_ATTEMPTS} attempts (exit ${exit_code}). Check sshd, fail2ban/firewall rules, MaxStartups, and host resource pressure." >&2
      return "${exit_code}"
    fi

    echo "::warning::${label} failed with exit ${exit_code}; retrying in ${delay}s." >&2
    sleep "${delay}"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
    if (( delay > SSH_RETRY_MAX_DELAY_SECONDS )); then
      delay="${SSH_RETRY_MAX_DELAY_SECONDS}"
    fi
  done
}
