#!/usr/bin/env bash
# Runs on the deployment host. Resolves the target environment from the signed
# deployment manifest, validates the uploaded values, and atomically replaces
# only the AWS-related keys. Secret values are never printed or sourced.
set -euo pipefail

SCHOOL_ID="${1:-}"
INPUT_FILE="${2:-}"
MANIFEST_PATH="${3:-/srv/zawadi/apps/deploy/instances.manifest.json}"

log() { printf '[aws-config] %s\n' "$*" >&2; }
fail() { printf '[aws-config] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${SCHOOL_ID}" =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "school id is missing or invalid"
[[ "${INPUT_FILE}" =~ ^/tmp/trendscore-aws-config-[0-9]+-[0-9]+\.env$ ]] || fail "input path is not an approved temporary path"
[[ -f "${INPUT_FILE}" && ! -L "${INPUT_FILE}" ]] || fail "protected input file is missing or unsafe"
[[ -f "${MANIFEST_PATH}" && ! -L "${MANIFEST_PATH}" ]] || fail "deployment manifest is missing or unsafe"
command -v jq >/dev/null 2>&1 || fail "jq is required"

TARGET_ROW="$(jq -cer --arg id "${SCHOOL_ID}" '.instances[] | select(.id == $id)' "${MANIFEST_PATH}")" \
  || fail "school is not present in the deployment manifest"
TARGET_KIND="$(jq -r '.kind // empty' <<< "${TARGET_ROW}")"

if [[ "${TARGET_KIND}" == "main" ]]; then
  MAIN_DIR="$(jq -r '.defaults.main_dir // empty' "${MANIFEST_PATH}")"
  TARGET_ENV_FILE="${MAIN_DIR}/.env"
else
  TARGET_ENV_FILE="$(jq -r '.env_file // empty' <<< "${TARGET_ROW}")"
fi

[[ "${TARGET_ENV_FILE}" == /srv/zawadi/apps/* ]] || fail "manifest environment path is outside the approved application directory"
[[ -f "${TARGET_ENV_FILE}" && ! -L "${TARGET_ENV_FILE}" ]] || fail "school environment file is missing or unsafe"
chmod 600 "${INPUT_FILE}"

declare -A VALUES=()
declare -A SEEN=()
ALLOWED_KEYS=(
  AWS_REGION
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_REKOGNITION_LIVENESS_ROLE_ARN
)

is_allowed_key() {
  local candidate="$1"
  local allowed
  for allowed in "${ALLOWED_KEYS[@]}"; do
    [[ "${candidate}" == "${allowed}" ]] && return 0
  done
  return 1
}

while IFS='=' read -r key value; do
  [[ -n "${key}" ]] || continue
  is_allowed_key "${key}" || fail "input contains an unsupported key"
  [[ -z "${SEEN[${key}]:-}" ]] || fail "input contains a duplicate key"
  SEEN["${key}"]=1
  VALUES["${key}"]="${value}"
done < "${INPUT_FILE}"

for key in "${ALLOWED_KEYS[@]}"; do
  [[ -n "${VALUES[${key}]:-}" ]] || fail "input is missing ${key}"
done

[[ "${VALUES[AWS_REGION]}" =~ ^[a-z]{2}(-gov)?-[a-z]+-[0-9]+$ ]] || fail "AWS_REGION has an invalid format"
[[ "${VALUES[AWS_ACCESS_KEY_ID]}" =~ ^[A-Z0-9]{16,128}$ ]] || fail "AWS_ACCESS_KEY_ID has an invalid format"
[[ "${VALUES[AWS_SECRET_ACCESS_KEY]}" =~ ^[A-Za-z0-9/+=]{32,128}$ ]] || fail "AWS_SECRET_ACCESS_KEY has an invalid format"
[[ "${VALUES[AWS_REKOGNITION_LIVENESS_ROLE_ARN]}" =~ ^arn:(aws|aws-us-gov|aws-cn):iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$ ]] \
  || fail "AWS_REKOGNITION_LIVENESS_ROLE_ARN has an invalid format"

TEMP_ENV="$(mktemp /tmp/trendscore-school-env.XXXXXX)"
cleanup() {
  rm -f "${TEMP_ENV}" "${INPUT_FILE}"
}
trap cleanup EXIT
chmod 600 "${TEMP_ENV}"

sudo cat "${TARGET_ENV_FILE}" | awk '
  BEGIN {
    split("AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_REKOGNITION_LIVENESS_ROLE_ARN AWS_REKOGNITION_COLLECTION_PREFIX AWS_REKOGNITION_LIVENESS_THRESHOLD AWS_REKOGNITION_MATCH_THRESHOLD", keys, " ")
    for (i in keys) drop[keys[i]] = 1
  }
  {
    key = $0
    sub(/=.*/, "", key)
    if (!(key in drop)) print $0
  }
' > "${TEMP_ENV}"

{
  printf 'AWS_REGION=%s\n' "${VALUES[AWS_REGION]}"
  printf 'AWS_ACCESS_KEY_ID=%s\n' "${VALUES[AWS_ACCESS_KEY_ID]}"
  printf 'AWS_SECRET_ACCESS_KEY=%s\n' "${VALUES[AWS_SECRET_ACCESS_KEY]}"
  printf 'AWS_SESSION_TOKEN=\n'
  printf 'AWS_REKOGNITION_LIVENESS_ROLE_ARN=%s\n' "${VALUES[AWS_REKOGNITION_LIVENESS_ROLE_ARN]}"
  printf 'AWS_REKOGNITION_COLLECTION_PREFIX=trendscore\n'
  printf 'AWS_REKOGNITION_LIVENESS_THRESHOLD=90\n'
  printf 'AWS_REKOGNITION_MATCH_THRESHOLD=97\n'
} >> "${TEMP_ENV}"

TARGET_OWNER="$(sudo stat -c '%u' "${TARGET_ENV_FILE}")"
TARGET_GROUP="$(sudo stat -c '%g' "${TARGET_ENV_FILE}")"
sudo install -m 0600 -o "${TARGET_OWNER}" -g "${TARGET_GROUP}" "${TEMP_ENV}" "${TARGET_ENV_FILE}"

for key in "${ALLOWED_KEYS[@]}"; do
  sudo grep -q "^${key}=" "${TARGET_ENV_FILE}" || fail "failed to persist ${key}"
done

log "AWS configuration updated for ${SCHOOL_ID}; values were not printed"
