#!/usr/bin/env bash
# Deploy Trends CORE to one or more isolated school instances.
# Intended to run ON THE DEPLOY SERVER (via SSH from GitHub Actions).
#
# Required env:
#   DEPLOY_TARGET   demo | pilot | school | all_schools
#   IMAGE_TAG       e.g. sha-<git-sha> or v1.2.3
#
# Optional env:
#   SCHOOL_ID       instance id from deploy/instances.manifest.json (required for DEPLOY_TARGET=school)
#   MANIFEST_PATH   path to manifest JSON (default: ./deploy/instances.manifest.json)
#   APPS_DIR, MAIN_DIR, BACKUP_DIR  override manifest defaults
#   DEPLOY_CONSOLE  true|false — also roll console image (default false for school targets)
#   DRY_RUN         true — print plan only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST_PATH="${MANIFEST_PATH:-${REPO_ROOT}/deploy/instances.manifest.json}"

DEPLOY_TARGET="${DEPLOY_TARGET:-}"
IMAGE_TAG="${IMAGE_TAG:-}"
SCHOOL_ID="${SCHOOL_ID:-}"
DEPLOY_CONSOLE="${DEPLOY_CONSOLE:-false}"
DRY_RUN="${DRY_RUN:-false}"

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_cmd jq
require_cmd curl
[[ -f "${MANIFEST_PATH}" ]] || fail "Manifest not found: ${MANIFEST_PATH}"

APPS_DIR="${APPS_DIR:-$(jq -r '.defaults.apps_dir' "${MANIFEST_PATH}")}"
MAIN_DIR="${MAIN_DIR:-$(jq -r '.defaults.main_dir' "${MANIFEST_PATH}")}"
ENV_DIR="${ENV_DIR:-$(jq -r '.defaults.env_dir' "${MANIFEST_PATH}")}"
BACKUP_DIR="${BACKUP_DIR:-$(jq -r '.defaults.backup_dir' "${MANIFEST_PATH}")}"
STACK_COMPOSE_FILE="${STACK_COMPOSE_FILE:-${APPS_DIR}/$(jq -r '.defaults.stack_compose_file' "${MANIFEST_PATH}")}"
FRONTEND_IMAGE_BASE="${FRONTEND_IMAGE_BASE:-$(jq -r '.defaults.frontend_image' "${MANIFEST_PATH}")}"
BACKEND_IMAGE_BASE="${BACKEND_IMAGE_BASE:-$(jq -r '.defaults.backend_image' "${MANIFEST_PATH}")}"
CONSOLE_IMAGE_BASE="${CONSOLE_IMAGE_BASE:-$(jq -r '.defaults.console_image' "${MANIFEST_PATH}")}"
HEALTH_HOST="${HEALTH_HOST:-$(jq -r '.defaults.health_host' "${MANIFEST_PATH}")}"

FRONTEND_IMAGE="${FRONTEND_IMAGE_BASE}:${IMAGE_TAG}"
BACKEND_IMAGE="${BACKEND_IMAGE_BASE}:${IMAGE_TAG}"
CONSOLE_IMAGE="${CONSOLE_IMAGE_BASE}:${IMAGE_TAG}"

[[ -n "${DEPLOY_TARGET}" ]] || fail "DEPLOY_TARGET is required"
[[ -n "${IMAGE_TAG}" ]] || fail "IMAGE_TAG is required"
if [[ "${DEPLOY_TARGET}" == "school" && -z "${SCHOOL_ID}" ]]; then
  fail "SCHOOL_ID is required when DEPLOY_TARGET=school"
fi

discover_running_stacks() {
  sudo docker ps \
    --filter "label=com.docker.compose.service=frontend" \
    --format '{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.project.config_files"}}|{{.Label "com.docker.compose.project.environment_file"}}' \
    | awk -F'|' 'NF>=3 && $2 ~ /docker-compose\.stack\.yml$/ && length($1)>0 && length($3)>0 {print $1 "|" $3}' \
    | sort -u
}

resolve_manifest_targets() {
  case "${DEPLOY_TARGET}" in
    demo)
      jq -c '.instances[] | select(.tier == "demo")' "${MANIFEST_PATH}"
      ;;
    pilot)
      jq -c '.instances[] | select(.tier == "pilot")' "${MANIFEST_PATH}"
      ;;
    school)
      local match
      match="$(jq -c --arg id "${SCHOOL_ID}" '.instances[] | select(.id == $id)' "${MANIFEST_PATH}")"
      if [[ -z "${match}" ]]; then
        fail "Unknown school_id in manifest: ${SCHOOL_ID}"
      fi
      local kind
      kind="$(printf '%s' "${match}" | jq -r '.kind')"
      [[ "${kind}" == "stack" ]] || fail "Instance ${SCHOOL_ID} must be kind=stack for targeted deploy"
      printf '%s\n' "${match}"
      ;;
    all_schools)
      jq -c '.instances[] | select(.kind == "stack")' "${MANIFEST_PATH}"
      ;;
    *)
      fail "Invalid DEPLOY_TARGET: ${DEPLOY_TARGET}"
      ;;
  esac
}

merge_discovered_stacks() {
  local discovery_enabled
  discovery_enabled="$(jq -r '.discovery.enabled // true' "${MANIFEST_PATH}")"
  [[ "${discovery_enabled}" == "true" ]] || return 0
  [[ "${DEPLOY_TARGET}" == "all_schools" ]] || return 0

  local exclude_projects
  exclude_projects="$(jq -r '.discovery.exclude_compose_projects[]? // empty' "${MANIFEST_PATH}")"

  while IFS='|' read -r project env_file; do
    [[ -n "${project}" ]] || continue
    if grep -qx "${project}" <<< "${exclude_projects}"; then
      continue
    fi
    if jq -e --arg p "${project}" 'map(select(.compose_project == $p)) | length > 0' <<< "${TARGETS_BUFFER}" >/dev/null; then
      continue
    fi
    local slug="${project#zawadi-}"
    TARGETS_BUFFER="$(jq -c \
      --arg id "${slug}" \
      --arg project "${project}" \
      --arg env_file "${env_file}" \
      '. + [{id: $id, label: $project, tier: "production", kind: "stack", compose_project: $project, env_file: $env_file}]' \
      <<< "${TARGETS_BUFFER:-[]}")"
  done < <(discover_running_stacks)
}

read_env_value() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "${file}" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r' || true
}

write_deploy_env_file() {
  local path="$1"
  printf 'FRONTEND_IMAGE=%s\nBACKEND_IMAGE=%s\n' "${FRONTEND_IMAGE}" "${BACKEND_IMAGE}" > "${path}"
}

compose_with_pinned_images() {
  local kind="$1"
  local project="${2:-}"
  local stack_env="${3:-}"
  shift 3

  local deploy_env
  deploy_env="$(mktemp /tmp/trendscore-deploy-env.XXXXXX)"
  write_deploy_env_file "${deploy_env}"

  if [[ "${kind}" == "main" ]]; then
    cd "${MAIN_DIR}"
    sudo docker compose --env-file "${deploy_env}" "$@"
  else
    cd "${APPS_DIR}"
    sudo docker compose --env-file "${stack_env}" --env-file "${deploy_env}" \
      -p "${project}" -f "${STACK_COMPOSE_FILE}" "$@"
  fi

  rm -f "${deploy_env}"
}

verify_target() {
  local id="$1"
  local kind="$2"
  local project="${3:-}"
  local env_file="${4:-}"

  log "━━ Verify: ${id} (${kind}) ━━"
  if [[ "${kind}" == "main" ]]; then
    [[ -d "${MAIN_DIR}" ]] || { log "Main directory missing: ${MAIN_DIR}"; return 1; }
    [[ -f "${MAIN_DIR}/docker-compose.yml" || -f "${MAIN_DIR}/docker-compose.yaml" ]] \
      || { log "No docker-compose.yml in ${MAIN_DIR}"; return 1; }
    return 0
  fi

  [[ -n "${project}" ]] || { log "Stack ${id}: missing compose_project"; return 1; }
  [[ -f "${env_file}" ]] || { log "Stack ${id}: env file not found: ${env_file}"; return 1; }
  [[ -f "${STACK_COMPOSE_FILE}" ]] || { log "Stack compose file missing: ${STACK_COMPOSE_FILE}"; return 1; }
  if ! sudo docker ps --filter "label=com.docker.compose.project=${project}" --format '{{.Names}}' | grep -q .; then
    log "WARNING: no running containers for project ${project} (deploy will still proceed)"
  fi
}

backup_database() {
  local id="$1"
  local kind="$2"
  local project="${3:-}"
  local env_file="${4:-}"
  local ts
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  local dest="${BACKUP_DIR}/${id}/${ts}"
  sudo mkdir -p "${dest}"

  log "━━ Backup: ${id} → ${dest} ━━"

  if [[ "${kind}" == "main" ]]; then
    cd "${MAIN_DIR}"
    local db_user db_name
    db_user="$(read_env_value "${MAIN_DIR}/.env" DB_USER)"
    db_name="$(read_env_value "${MAIN_DIR}/.env" DB_NAME)"
    db_user="${db_user:-postgres}"
    db_name="${db_name:-zawadi_sms}"
    sudo docker compose exec -T db pg_dump -U "${db_user}" "${db_name}" \
      | sudo tee "${dest}/database.sql" >/dev/null
    echo "${dest}/database.sql" | sudo tee "${dest}/LATEST" >/dev/null
    return 0
  fi

  cd "${APPS_DIR}"
  local db_user db_name
  db_user="$(read_env_value "${env_file}" DB_USER)"
  db_name="$(read_env_value "${env_file}" DB_NAME)"
  db_user="${db_user:-postgres}"
  db_name="${db_name:-postgres}"
  sudo docker compose --env-file "${env_file}" -p "${project}" -f "${STACK_COMPOSE_FILE}" \
    exec -T db pg_dump -U "${db_user}" "${db_name}" \
    | sudo tee "${dest}/database.sql" >/dev/null
  echo "${dest}/database.sql" | sudo tee "${dest}/LATEST" >/dev/null
}

pull_images() {
  local kind="$1"
  local project="${2:-}"
  local env_file="${3:-}"

  log "━━ Pull images: ${FRONTEND_IMAGE} / ${BACKEND_IMAGE} ━━"
  if ! sudo docker pull "${FRONTEND_IMAGE}"; then
    fail "Failed to pull frontend image: ${FRONTEND_IMAGE}"
  fi
  if ! sudo docker pull "${BACKEND_IMAGE}"; then
    fail "Failed to pull backend image: ${BACKEND_IMAGE}"
  fi

  if [[ "${kind}" == "main" ]]; then
    compose_with_pinned_images "${kind}" "${project}" "${env_file}" pull backend frontend
    return 0
  fi

  compose_with_pinned_images "${kind}" "${project}" "${env_file}" pull backend frontend
}

run_migrations() {
  local kind="$1"
  local project="${2:-}"
  local env_file="${3:-}"

  log "━━ Migrations (prisma migrate deploy) ━━"

  if [[ "${kind}" == "main" ]]; then
    compose_with_pinned_images "${kind}" "${project}" "${env_file}" \
      run -T --rm backend npx prisma migrate deploy < /dev/null
    return 0
  fi

  compose_with_pinned_images "${kind}" "${project}" "${env_file}" \
    run -T --rm backend npx prisma migrate deploy < /dev/null
}

restart_services() {
  local kind="$1"
  local project="${2:-}"
  local env_file="${3:-}"

  log "━━ Restart containers ━━"

  if [[ "${kind}" == "main" ]]; then
    compose_with_pinned_images "${kind}" "${project}" "${env_file}" \
      up -d --force-recreate backend frontend
    return 0
  fi

  compose_with_pinned_images "${kind}" "${project}" "${env_file}" \
    up -d --force-recreate backend frontend
}

health_check_instance() {
  local id="$1"
  local kind="$2"
  local project="${3:-}"

  log "━━ Health check: ${id} ━━"
  local backend_container=""
  if [[ "${kind}" == "main" ]]; then
    backend_container="zawadi-backend"
  else
    backend_container="$(sudo docker ps \
      --filter "label=com.docker.compose.project=${project}" \
      --filter "label=com.docker.compose.service=backend" \
      --format '{{.Names}}' | head -n1)"
  fi

  [[ -n "${backend_container}" ]] || { log "Backend container not found for ${id}"; return 1; }

  local port
  port="$(sudo docker port "${backend_container}" 5000/tcp | awk -F: 'NR==1{print $NF}')"
  [[ -n "${port}" ]] || { log "Could not resolve backend port for ${backend_container}"; return 1; }

  local url="http://${HEALTH_HOST}:${port}/api/health"
  for attempt in $(seq 1 30); do
    if body="$(curl -fsS --max-time 15 "${url}" 2>/dev/null)"; then
      if echo "${body}" | grep -q '"success":true'; then
        log "OK ${url}"
        return 0
      fi
      log "Unexpected health body: ${body}"
      return 1
    fi
    log "Waiting for ${url} (${attempt}/30)"
    sleep 2
  done
  log "Health check failed: ${url}"
  return 1
}

deploy_console() {
  log "━━ Console: ${CONSOLE_IMAGE} ━━"
  local console_port="${CONSOLE_PORT:-3100}"
  local console_env="${CONSOLE_ENV_FILE:-${APPS_DIR}/.env.console}"
  local console_data="${CONSOLE_DATA_DIR:-${APPS_DIR}/console-data}"

  sudo docker pull "${CONSOLE_IMAGE}"
  sudo mkdir -p "${console_data}"
  sudo docker rm -f zawadi-console >/dev/null 2>&1 || true
  sudo docker run -d \
    --name zawadi-console \
    --restart always \
    --label com.zawadi.service=platform-console \
    --env-file "${console_env}" \
    -e CONSOLE_DATA_DIR=/app/data \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "${APPS_DIR}:${APPS_DIR}" \
    -v "${console_data}:/app/data" \
    -p "${console_port}:3100" \
    "${CONSOLE_IMAGE}"

  for attempt in $(seq 1 30); do
    if curl -fsS "http://${HEALTH_HOST}:${console_port}/health" >/dev/null 2>&1; then
      log "Console health OK :${console_port}"
      return 0
    fi
    sleep 2
  done
  log "Console health check failed on :${console_port}"
  return 1
}

deploy_one() {
  local id="$1"
  local kind="$2"
  local project="${3:-}"
  local env_file="${4:-}"

  verify_target "${id}" "${kind}" "${project}" "${env_file}" || return 1
  if [[ "${DRY_RUN}" == "true" ]]; then
    log "DRY_RUN: skip backup/migrate/restart for ${id}"
    return 0
  fi
  backup_database "${id}" "${kind}" "${project}" "${env_file}" || return 1
  pull_images "${kind}" "${project}" "${env_file}" || return 1
  run_migrations "${kind}" "${project}" "${env_file}" || return 1
  restart_services "${kind}" "${project}" "${env_file}" || return 1
  health_check_instance "${id}" "${kind}" "${project}" || return 1
}

# ── Resolve targets ───────────────────────────────────────────────────────────
TARGETS_BUFFER="[]"
while IFS= read -r line; do
  [[ -n "${line}" ]] || continue
  TARGETS_BUFFER="$(jq -c --argjson row "${line}" '. + [$row]' <<< "${TARGETS_BUFFER}")"
done < <(resolve_manifest_targets)

merge_discovered_stacks

TARGET_COUNT="$(jq 'length' <<< "${TARGETS_BUFFER}")"
[[ "${TARGET_COUNT}" -gt 0 ]] || fail "No deployment targets resolved for DEPLOY_TARGET=${DEPLOY_TARGET}"

log "════════════════════════════════════════════════════════════"
log "Deploy plan"
log "  Target mode : ${DEPLOY_TARGET}"
log "  Image tag   : ${IMAGE_TAG}"
log "  Instances   : ${TARGET_COUNT}"
log "  Dry run     : ${DRY_RUN}"
jq -r '.[] | "  - \(.id) (\(.kind), tier=\(.tier))"' <<< "${TARGETS_BUFFER}"
log "════════════════════════════════════════════════════════════"

FAILED=0
SUCCEEDED=0
while IFS= read -r row; do
  id="$(printf '%s' "${row}" | jq -r '.id')"
  kind="$(printf '%s' "${row}" | jq -r '.kind')"
  project="$(printf '%s' "${row}" | jq -r '.compose_project // empty')"
  env_file="$(printf '%s' "${row}" | jq -r '.env_file // empty')"
  if deploy_one "${id}" "${kind}" "${project}" "${env_file}"; then
    SUCCEEDED=$((SUCCEEDED + 1))
  else
    FAILED=$((FAILED + 1))
    log "FAILED: ${id}"
  fi
done < <(jq -c '.[]' <<< "${TARGETS_BUFFER}")

if [[ "${DEPLOY_CONSOLE}" == "true" && "${DRY_RUN}" != "true" ]]; then
  deploy_console || FAILED=$((FAILED + 1))
fi

if [[ "${FAILED}" -gt 0 ]]; then
  fail "${FAILED} instance(s) failed"
fi

log "════════════════════════════════════════════════════════════"
log "SUCCESS: ${SUCCEEDED}/${TARGET_COUNT} instance(s) deployed with tag ${IMAGE_TAG}"
log "════════════════════════════════════════════════════════════"
