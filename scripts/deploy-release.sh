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
# Console chroot occasionally drops SCHOOL_ID from env; accept positional fallback.
if [[ -n "${1:-}" && -z "${SCHOOL_ID}" ]]; then
  SCHOOL_ID="$1"
fi
DEPLOY_CONSOLE="${DEPLOY_CONSOLE:-false}"
DEPLOY_CONSOLE_ONLY="${DEPLOY_CONSOLE_ONLY:-false}"
DRY_RUN="${DRY_RUN:-false}"

log() { printf '[deploy] %s\n' "$*" >&2; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_cmd jq
require_cmd curl

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    "$@"
  fi
}

docker_cmd() {
  run_as_root docker "$@"
}

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

[[ -n "${IMAGE_TAG}" ]] || fail "IMAGE_TAG is required"
if [[ "${DEPLOY_CONSOLE_ONLY}" == "true" ]]; then
  [[ "${DRY_RUN}" == "true" ]] && { log "DRY_RUN: would deploy console only with tag ${IMAGE_TAG}"; exit 0; }
  log "════════════════════════════════════════════════════════════"
  log "Console-only deploy (no school stacks)"
  log "  Image tag : ${IMAGE_TAG}"
  log "════════════════════════════════════════════════════════════"
  deploy_console || fail "Console deploy failed"
  log "SUCCESS: platform console deployed with tag ${IMAGE_TAG}"
  exit 0
fi
[[ -n "${DEPLOY_TARGET}" ]] || fail "DEPLOY_TARGET is required"
if [[ "${DEPLOY_TARGET}" == "school" && -z "${SCHOOL_ID}" ]]; then
  fail "SCHOOL_ID is required when DEPLOY_TARGET=school"
fi

log "Mode=${DEPLOY_TARGET} school_id=${SCHOOL_ID:-<unset>} manifest=${MANIFEST_PATH}"

discover_running_stacks() {
  docker_cmd ps \
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
      resolve_school_target "${SCHOOL_ID}" || fail "Unknown school_id (manifest or running stack): ${SCHOOL_ID}"
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

resolve_school_target() {
  local id="$1"
  local row match
  match="$(jq -c --arg id "${id}" '.instances[] | select(.id == $id)' "${MANIFEST_PATH}" 2>/dev/null || true)"
  if [[ -n "${match}" ]]; then
    row="$(hydrate_stack_row "${match}")"
    [[ -n "${row}" ]] || fail "Could not resolve manifest entry for school_id=${id}"
    printf '%s\n' "${row}"
    return 0
  fi

  while IFS='|' read -r project env_file; do
    [[ -n "${project}" ]] || continue
    local slug="${project#zawadi-}"
    if [[ "${slug}" == "${id}" || "${project}" == "${id}" || "${project}" == "zawadi-${id}" ]]; then
      jq -nc \
        --arg id "${slug}" \
        --arg project "${project}" \
        --arg env_file "${env_file}" \
        '{id: $id, label: $project, tier: "production", kind: "stack", compose_project: $project, env_file: $env_file}'
      return 0
    fi
  done < <(discover_running_stacks)
  return 1
}

hydrate_stack_row() {
  local row="$1"
  local kind id env_file project public_domain label
  kind="$(printf '%s' "${row}" | jq -r '.kind')"
  id="$(printf '%s' "${row}" | jq -r '.id')"
  if [[ "${kind}" != "stack" ]]; then
    printf '%s' "${row}"
    return 0
  fi
  env_file="$(printf '%s' "${row}" | jq -r '.env_file // empty')"
  if [[ -n "${env_file}" && -f "${env_file}" ]]; then
    printf '%s' "${row}"
    return 0
  fi
  log "Hydrating ${id}: manifest env missing (${env_file:-none}), checking discovery..."
  while IFS='|' read -r discovered_project discovered_env; do
    [[ -n "${discovered_project}" ]] || continue
    local slug="${discovered_project#zawadi-}"
    if [[ "${slug}" == "${id}" || "${discovered_project}" == "zawadi-${id}" ]]; then
      label="$(printf '%s' "${row}" | jq -r '.label // empty')"
      public_domain="$(printf '%s' "${row}" | jq -r '.public_domain // empty')"
      jq -nc \
        --arg id "${id}" \
        --arg label "${label:-${id}}" \
        --arg project "${discovered_project}" \
        --arg env_file "${discovered_env}" \
        --arg public_domain "${public_domain}" \
        '{id: $id, label: $label, tier: "production", kind: "stack", compose_project: $project, env_file: $env_file, public_domain: (if $public_domain != "" then $public_domain else empty end)}'
      return 0
    fi
  done < <(discover_running_stacks)
  printf '%s' "${row}"
}

read_env_value() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "${file}" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r' || true
}

compose_with_pinned_images() {
  local kind="$1"
  local project="${2:-}"
  local stack_env="${3:-}"
  shift 3

  if [[ "${kind}" == "main" ]]; then
    pin_runtime_images_in_env "${MAIN_DIR}/.env"
    cd "${MAIN_DIR}"
    docker_cmd compose "$@"
  else
    pin_runtime_images_in_env "${stack_env}"
    cd "${APPS_DIR}"
    docker_cmd compose --env-file "${stack_env}" \
      -p "${project}" -f "${STACK_COMPOSE_FILE}" "$@"
  fi
}

publish_frontend_static() {
  local kind="$1"
  local static_dir="${2:-}"
  local public_domain="${3:-}"

  [[ "${kind}" == "main" ]] || return 0

  local container="zawadi-frontend"
  local image
  image="$(docker_cmd inspect "${container}" --format '{{.Config.Image}}' 2>/dev/null || true)"
  [[ -n "${image}" ]] && log "Frontend container image: ${image}"

  local -a targets=()
  local root legacy duplicate=0 t
  if [[ -n "${static_dir}" ]]; then
    append_unique_target targets "${static_dir}"
  fi
  while IFS= read -r root; do
    append_unique_target targets "${root}"
  done < <(discover_nginx_static_roots "${public_domain}")
  while IFS= read -r legacy; do
    append_unique_target targets "${legacy}"
  done < <(discover_legacy_frontend_dirs)
  while IFS= read -r live_dir; do
    append_unique_target targets "${live_dir}"
  done < <(discover_live_frontend_publish_dirs "${public_domain}")

  [[ "${#targets[@]}" -gt 0 ]] || {
    log "No static publish targets configured"
    return 0
  }

  log "Static publish targets: ${targets[*]}"
  local target verified=0
  for target in "${targets[@]}"; do
    log "━━ Publish static frontend: ${container} → ${target} ━━"
    run_as_root mkdir -p "${target}"
    docker_cmd cp "${container}:/usr/share/nginx/html/." "${target}/"
    if id www-data >/dev/null 2>&1; then
      run_as_root chown -R www-data:www-data "${target}" 2>/dev/null || true
    fi
    if verify_static_bundle "${target}"; then
      verified=1
    fi
  done

  [[ "${verified}" -eq 1 ]] || fail "Published bundle still contains Apps menu"

  if command -v nginx >/dev/null 2>&1; then
    if run_as_root nginx -t >/dev/null 2>&1; then
      run_as_root systemctl reload nginx >/dev/null 2>&1 && log "Nginx reloaded"
    else
      log "WARNING: nginx -t failed; skipped reload"
    fi
  fi

  if [[ -n "${public_domain}" ]]; then
    verify_live_site_bundle "${public_domain}" || fail "Live site still serving Apps menu for ${public_domain}"
  fi
}

discover_nginx_static_roots() {
  local domain="$1"
  [[ -n "${domain}" ]] || return 0

  local dir conf
  for dir in /etc/nginx/sites-enabled /etc/nginx/sites-available /etc/nginx/conf.d; do
    [[ -d "${dir}" ]] || continue
    for conf in "${dir}"/*; do
      [[ -f "${conf}" ]] || continue
      run_as_root grep -q "${domain}" "${conf}" 2>/dev/null || continue
      run_as_root grep -E '^[[:space:]]*root[[:space:]]+' "${conf}" 2>/dev/null \
        | sed -E 's/^[[:space:]]*root[[:space:]]+([^;[:space:]]+).*$/\1/' \
        | tr -d '"' | tr -d "'"
    done
  done

  run_as_root grep -rl "${domain}" /etc/nginx 2>/dev/null | while IFS= read -r conf; do
    [[ -f "${conf}" ]] || continue
    run_as_root grep -E '^[[:space:]]*root[[:space:]]+' "${conf}" 2>/dev/null \
      | sed -E 's/^[[:space:]]*root[[:space:]]+([^;[:space:]]+).*$/\1/' \
      | tr -d '"' | tr -d "'"
  done | sort -u
}

discover_legacy_frontend_dirs() {
  local search_roots=(/srv /var/www /var /opt /home /usr/share/nginx /usr/share)
  local root asset
  for root in "${search_roots[@]}"; do
    [[ -d "${root}" ]] || continue
    while IFS= read -r asset; do
      [[ -n "${asset}" ]] || continue
      if run_as_root grep -q 'settings-apps' "${asset}" 2>/dev/null; then
        dirname "$(dirname "${asset}")"
      fi
    done < <(run_as_root find "${root}" -type f -path '*/assets/CBCGradingSystem*.js' 2>/dev/null)
  done | sort -u
}

discover_live_frontend_publish_dirs() {
  local domain="$1"
  [[ -n "${domain}" ]] || return 0

  local html index_js
  html="$(curl -fsS -H "Host: ${domain}" http://127.0.0.1/ 2>/dev/null || true)"
  if [[ -z "${html}" ]]; then
    html="$(curl -fsSk "https://${domain}/" 2>/dev/null || true)"
  fi
  index_js="$(printf '%s' "${html}" | grep -oE 'assets/index-[^"]+\.js' | head -1 | sed 's|^assets/||')"
  [[ -n "${index_js}" ]] || return 0

  log "Live site bundle marker: ${index_js}"
  run_as_root find /srv /var /opt /home /usr /root -type f -name "${index_js}" 2>/dev/null \
    | while IFS= read -r file; do
        dirname "${file}"
      done | sort -u
}

pin_runtime_images_in_env() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || return 0
  if run_as_root grep -q '^FRONTEND_IMAGE=' "${env_file}" 2>/dev/null; then
    run_as_root sed -i "s|^FRONTEND_IMAGE=.*|FRONTEND_IMAGE=${FRONTEND_IMAGE}|" "${env_file}"
  else
    printf 'FRONTEND_IMAGE=%s\n' "${FRONTEND_IMAGE}" | run_as_root tee -a "${env_file}" >/dev/null
  fi
  if run_as_root grep -q '^BACKEND_IMAGE=' "${env_file}" 2>/dev/null; then
    run_as_root sed -i "s|^BACKEND_IMAGE=.*|BACKEND_IMAGE=${BACKEND_IMAGE}|" "${env_file}"
  else
    printf 'BACKEND_IMAGE=%s\n' "${BACKEND_IMAGE}" | run_as_root tee -a "${env_file}" >/dev/null
  fi
}

verify_live_site_bundle() {
  local domain="$1"
  local html chunk asset_dir
  html="$(curl -fsS -H "Host: ${domain}" http://127.0.0.1/ 2>/dev/null || true)"
  if [[ -z "${html}" ]]; then
    html="$(curl -fsSk "https://${domain}/" 2>/dev/null || true)"
  fi
  chunk="$(printf '%s' "${html}" | grep -oE 'CBCGradingSystem-[^"]+\.js' | head -1 | sed 's|^assets/||')"
  [[ -n "${chunk}" ]] || {
    log "WARNING: could not resolve live CBC bundle for ${domain}"
    return 0
  }

  while IFS= read -r asset_dir; do
    [[ -f "${asset_dir}/assets/${chunk}" ]] || continue
    if grep -q 'settings-apps' "${asset_dir}/assets/${chunk}" 2>/dev/null; then
      log "Live bundle still contains Apps menu: ${asset_dir}/assets/${chunk}"
      return 1
    fi
    log "Live bundle verified for ${domain}: ${asset_dir}/assets/${chunk}"
    return 0
  done < <(discover_live_frontend_publish_dirs "${domain}")

  log "WARNING: could not verify live bundle path on disk for ${domain}"
  return 0
}

append_unique_target() {
  local -n _targets_ref=$1
  local candidate="$2"
  local existing
  [[ -n "${candidate}" ]] || return 0
  for existing in "${_targets_ref[@]}"; do
    [[ "${existing}" == "${candidate}" ]] && return 0
  done
  _targets_ref+=("${candidate}")
}

verify_static_bundle() {
  local dir="$1"
  local index="${dir}/index.html"
  [[ -f "${index}" ]] || {
    log "Missing index.html in ${dir}"
    return 1
  }

  if grep -rql 'settings-apps' "${dir}/assets/" 2>/dev/null; then
    log "Apps menu still present under ${dir}/assets"
    return 1
  fi

  log "Verified: Apps menu removed in ${dir}"
  return 0
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
  [[ -f "${env_file}" ]] || {
    log "Stack ${id}: env file not found: ${env_file}"
    log "Hint: if this school uses the canary/main stack, promote Canary (demo) instead of ${id}."
    return 1
  }
  [[ -f "${STACK_COMPOSE_FILE}" ]] || { log "Stack compose file missing: ${STACK_COMPOSE_FILE}"; return 1; }
  if ! docker_cmd ps --filter "label=com.docker.compose.project=${project}" --format '{{.Names}}' | grep -q .; then
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
  run_as_root mkdir -p "${dest}"

  log "━━ Backup: ${id} → ${dest} ━━"

  if [[ "${kind}" == "main" ]]; then
    cd "${MAIN_DIR}"
    local db_user db_name
    db_user="$(read_env_value "${MAIN_DIR}/.env" DB_USER)"
    db_name="$(read_env_value "${MAIN_DIR}/.env" DB_NAME)"
    db_user="${db_user:-postgres}"
    db_name="${db_name:-zawadi_sms}"
    docker_cmd compose exec -T db pg_dump -U "${db_user}" "${db_name}" \
      | run_as_root tee "${dest}/database.sql" >/dev/null
    echo "${dest}/database.sql" | run_as_root tee "${dest}/LATEST" >/dev/null
    return 0
  fi

  cd "${APPS_DIR}"
  local db_user db_name
  db_user="$(read_env_value "${env_file}" DB_USER)"
  db_name="$(read_env_value "${env_file}" DB_NAME)"
  db_user="${db_user:-postgres}"
  db_name="${db_name:-postgres}"
  docker_cmd compose --env-file "${env_file}" -p "${project}" -f "${STACK_COMPOSE_FILE}" \
    exec -T db pg_dump -U "${db_user}" "${db_name}" \
    | run_as_root tee "${dest}/database.sql" >/dev/null
  echo "${dest}/database.sql" | run_as_root tee "${dest}/LATEST" >/dev/null
}

pull_images() {
  local kind="$1"
  local project="${2:-}"
  local env_file="${3:-}"

  log "━━ Pull images: ${FRONTEND_IMAGE} / ${BACKEND_IMAGE} ━━"
  if ! docker_cmd pull "${FRONTEND_IMAGE}"; then
    fail "Failed to pull frontend image: ${FRONTEND_IMAGE}"
  fi
  if ! docker_cmd pull "${BACKEND_IMAGE}"; then
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
      run -T --no-deps --rm backend npx prisma migrate deploy < /dev/null
    return 0
  fi

  compose_with_pinned_images "${kind}" "${project}" "${env_file}" \
    run -T --no-deps --rm backend npx prisma migrate deploy < /dev/null
}

restart_services() {
  local kind="$1"
  local project="${2:-}"
  local env_file="${3:-}"

  log "━━ Restart containers ━━"

  if [[ "${kind}" == "main" ]]; then
    compose_with_pinned_images "${kind}" "${project}" "${env_file}" \
      up -d --no-deps --force-recreate backend frontend
    return 0
  fi

  compose_with_pinned_images "${kind}" "${project}" "${env_file}" \
    up -d --no-deps --force-recreate backend frontend
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
    backend_container="$(docker_cmd ps \
      --filter "label=com.docker.compose.project=${project}" \
      --filter "label=com.docker.compose.service=backend" \
      --format '{{.Names}}' | head -n1)"
  fi

  [[ -n "${backend_container}" ]] || { log "Backend container not found for ${id}"; return 1; }

  local port
  port="$(docker_cmd port "${backend_container}" 5000/tcp | awk -F: 'NR==1{print $NF}')"
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

  docker_cmd pull "${CONSOLE_IMAGE}"
  run_as_root mkdir -p "${console_data}"
  docker_cmd rm -f zawadi-console >/dev/null 2>&1 || true
  docker_cmd run -d \
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
  local static_dir="${5:-}"
  local public_domain="${6:-}"

  verify_target "${id}" "${kind}" "${project}" "${env_file}" || return 1
  if [[ "${DRY_RUN}" == "true" ]]; then
    log "DRY_RUN: skip backup/migrate/restart for ${id}"
    return 0
  fi
  backup_database "${id}" "${kind}" "${project}" "${env_file}" || return 1
  pull_images "${kind}" "${project}" "${env_file}" || return 1
  run_migrations "${kind}" "${project}" "${env_file}" || return 1
  restart_services "${kind}" "${project}" "${env_file}" || return 1
  publish_frontend_static "${kind}" "${static_dir}" "${public_domain}" || return 1
  health_check_instance "${id}" "${kind}" "${project}" || return 1
}

# ── Resolve targets ───────────────────────────────────────────────────────────
TARGETS_BUFFER="[]"
while IFS= read -r line; do
  [[ -n "${line}" ]] || continue
  [[ "${line}" == \{* ]] || continue
  TARGETS_BUFFER="$(jq -c --argjson row "${line}" '. + [$row]' <<< "${TARGETS_BUFFER}")"
done < <(resolve_manifest_targets)

merge_discovered_stacks

TARGET_COUNT="$(jq 'length' <<< "${TARGETS_BUFFER}")"
if [[ "${TARGET_COUNT}" -lt 1 ]]; then
  if [[ "${DEPLOY_TARGET}" == "school" ]]; then
    fail "No deployment target for school_id=${SCHOOL_ID:-<unset>}. If this site is demoschool/canary, promote Canary — Demo School (demo). Otherwise ensure ${MANIFEST_PATH} lists this id and stack zawadi-${SCHOOL_ID} exists on the host."
  fi
  fail "No deployment targets resolved for DEPLOY_TARGET=${DEPLOY_TARGET}"
fi

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
  row="$(hydrate_stack_row "${row}")"
  id="$(printf '%s' "${row}" | jq -r '.id')"
  kind="$(printf '%s' "${row}" | jq -r '.kind')"
  project="$(printf '%s' "${row}" | jq -r '.compose_project // empty')"
  env_file="$(printf '%s' "${row}" | jq -r '.env_file // empty')"
  static_dir="$(printf '%s' "${row}" | jq -r '.static_publish_dir // empty')"
  public_domain="$(printf '%s' "${row}" | jq -r '.public_domain // empty')"
  if [[ -z "${static_dir}" && "${kind}" == "main" ]]; then
    static_dir="$(jq -r '.defaults.static_publish_dir // empty' "${MANIFEST_PATH}")"
  fi
  if [[ -z "${public_domain}" && "${kind}" == "main" ]]; then
    public_domain="$(jq -r '.defaults.public_domain // empty' "${MANIFEST_PATH}")"
  fi
  if deploy_one "${id}" "${kind}" "${project}" "${env_file}" "${static_dir}" "${public_domain}"; then
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
