#!/usr/bin/env bash
# Transfer school-scoped AWS settings from a protected GitHub Environment to
# the deploy host without placing credentials in command arguments or logs.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ssh-retry.sh
source "${SCRIPT_DIR}/ssh-retry.sh"

log() { printf '[aws-config] %s\n' "$*" >&2; }
fail() { printf '[aws-config] ERROR: %s\n' "$*" >&2; exit 1; }

SCHOOL_ID="${SCHOOL_ID:-}"
AWS_REGION="${AWS_REGION:-}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"
AWS_REKOGNITION_LIVENESS_ROLE_ARN="${AWS_REKOGNITION_LIVENESS_ROLE_ARN:-}"

if [[ -z "${AWS_REGION}${AWS_ACCESS_KEY_ID}${AWS_SECRET_ACCESS_KEY}${AWS_REKOGNITION_LIVENESS_ROLE_ARN}" ]]; then
  log "No protected AWS configuration is defined for this GitHub Environment; leaving the school environment unchanged"
  exit 0
fi

[[ "${SCHOOL_ID}" =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "SCHOOL_ID is missing or invalid"
[[ -n "${AWS_REGION}" ]] || fail "AWS_REGION environment variable is required"
[[ -n "${AWS_ACCESS_KEY_ID}" ]] || fail "AWS_ACCESS_KEY_ID environment secret is required"
[[ -n "${AWS_SECRET_ACCESS_KEY}" ]] || fail "AWS_SECRET_ACCESS_KEY environment secret is required"
[[ -n "${AWS_REKOGNITION_LIVENESS_ROLE_ARN}" ]] || fail "AWS_REKOGNITION_LIVENESS_ROLE_ARN environment variable is required"

[[ "${AWS_REGION}" =~ ^[a-z]{2}(-gov)?-[a-z]+-[0-9]+$ ]] || fail "AWS_REGION has an invalid format"
[[ "${AWS_ACCESS_KEY_ID}" =~ ^[A-Z0-9]{16,128}$ ]] || fail "AWS_ACCESS_KEY_ID has an invalid format"
[[ "${AWS_SECRET_ACCESS_KEY}" =~ ^[A-Za-z0-9/+=]{32,128}$ ]] || fail "AWS_SECRET_ACCESS_KEY has an invalid format"
[[ "${AWS_REKOGNITION_LIVENESS_ROLE_ARN}" =~ ^arn:(aws|aws-us-gov|aws-cn):iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$ ]] \
  || fail "AWS_REKOGNITION_LIVENESS_ROLE_ARN has an invalid format"

for value in "${AWS_REGION}" "${AWS_ACCESS_KEY_ID}" "${AWS_SECRET_ACCESS_KEY}" "${AWS_REKOGNITION_LIVENESS_ROLE_ARN}"; do
  [[ "${value}" != *$'\n'* && "${value}" != *$'\r'* ]] || fail "AWS configuration values must be single-line"
done

RUN_KEY="${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}"
LOCAL_CONFIG="$(mktemp "${RUNNER_TEMP:-/tmp}/trendscore-aws-config.XXXXXX")"
REMOTE_CONFIG="/tmp/trendscore-aws-config-${RUN_KEY}.env"
chmod 600 "${LOCAL_CONFIG}"

cleanup() {
  rm -f "${LOCAL_CONFIG}"
  ssh production "rm -f '${REMOTE_CONFIG}'" >/dev/null 2>&1 || true
}
trap cleanup EXIT

{
  printf 'AWS_REGION=%s\n' "${AWS_REGION}"
  printf 'AWS_ACCESS_KEY_ID=%s\n' "${AWS_ACCESS_KEY_ID}"
  printf 'AWS_SECRET_ACCESS_KEY=%s\n' "${AWS_SECRET_ACCESS_KEY}"
  printf 'AWS_REKOGNITION_LIVENESS_ROLE_ARN=%s\n' "${AWS_REKOGNITION_LIVENESS_ROLE_ARN}"
} > "${LOCAL_CONFIG}"

log "Uploading protected AWS configuration for school ${SCHOOL_ID}"
run_with_ssh_retry "Protected AWS configuration upload" \
  scp -q -p "${LOCAL_CONFIG}" "production:${REMOTE_CONFIG}"

log "Applying protected AWS configuration to the manifest-approved school environment"
run_with_ssh_retry "Protected AWS configuration apply" \
  ssh production "sudo /srv/zawadi/apps/deploy/configure-school-aws-env.sh '${SCHOOL_ID}' '${REMOTE_CONFIG}'"

log "Protected AWS configuration synchronized for school ${SCHOOL_ID}"
