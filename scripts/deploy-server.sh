#!/usr/bin/env bash
set -euo pipefail

# Deploy the latest published GHCR images to all live Zawadi instances.
# Usage:
#   bash scripts/deploy-server.sh
# Optional env:
#   SERVER_HOST=185.127.16.124
#   SERVER_USER=deploy
#   APPS_DIR=/srv/zawadi/apps
#   MAIN_DIR=/srv/zawadi/apps/zawadijrn
#   CONSOLE_IMAGE=ghcr.io/amalgamate/zawadi-console:latest
#   CONSOLE_PORT=3100
#   CONSOLE_ENV_FILE=/srv/zawadi/apps/.env.console
#   CONSOLE_DATA_DIR=/srv/zawadi/apps/console-data
#   CONSOLE_INSTANCE_PROVISION_SCRIPT=/srv/zawadi/apps/scripts/provision-instance.sh
#   CONSOLE_NGINX_SITES_DIR=/etc/nginx/sites-enabled

SERVER_HOST="${SERVER_HOST:-185.127.16.124}"
SERVER_USER="${SERVER_USER:-deploy}"
APPS_DIR="${APPS_DIR:-/srv/zawadi/apps}"
MAIN_DIR="${MAIN_DIR:-/srv/zawadi/apps/zawadijrn}"
CONSOLE_IMAGE="${CONSOLE_IMAGE:-ghcr.io/amalgamate/zawadi-console:latest}"
CONSOLE_PORT="${CONSOLE_PORT:-3100}"
CONSOLE_ENV_FILE="${CONSOLE_ENV_FILE:-${APPS_DIR}/.env.console}"
CONSOLE_DATA_DIR="${CONSOLE_DATA_DIR:-${APPS_DIR}/console-data}"
CONSOLE_NGINX_SITES_DIR="${CONSOLE_NGINX_SITES_DIR:-/etc/nginx/sites-enabled}"

echo "[deploy] Host: ${SERVER_USER}@${SERVER_HOST}"
echo "[deploy] Images: ghcr.io/amalgamate/zawadi-frontend:latest, ghcr.io/amalgamate/zawadi-backend:latest, ${CONSOLE_IMAGE}"

ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=10 "${SERVER_USER}@${SERVER_HOST}" "APPS_DIR='${APPS_DIR}' MAIN_DIR='${MAIN_DIR}' CONSOLE_IMAGE='${CONSOLE_IMAGE}' CONSOLE_PORT='${CONSOLE_PORT}' CONSOLE_ENV_FILE='${CONSOLE_ENV_FILE}' CONSOLE_DATA_DIR='${CONSOLE_DATA_DIR}' CONSOLE_NGINX_SITES_DIR='${CONSOLE_NGINX_SITES_DIR}' bash --noprofile --norc -s" <<'REMOTE'
set -euo pipefail

deploy_main() {
  echo "[deploy] Main instance: pull images"
  cd "${MAIN_DIR}"
  sudo docker compose pull backend frontend

  echo "[deploy] Main instance: sync database schema"
  sudo docker compose run -T --rm backend npx prisma db push --skip-generate < /dev/null

  echo "[deploy] Main instance: recreate app containers"
  sudo docker compose up -d --pull always --force-recreate backend frontend
}

deploy_school_stack() {
  local project="$1"
  local env_file="$2"

  echo "[deploy] ${project}: pull images"
  cd "${APPS_DIR}"
  sudo docker compose --env-file "${env_file}" -p "${project}" -f docker-compose.stack.yml pull backend frontend

  echo "[deploy] ${project}: sync database schema"
  sudo docker compose --env-file "${env_file}" -p "${project}" -f docker-compose.stack.yml run -T --rm backend npx prisma db push --skip-generate < /dev/null

  echo "[deploy] ${project}: recreate app containers"
  sudo docker compose --env-file "${env_file}" -p "${project}" -f docker-compose.stack.yml up -d --pull always --force-recreate backend frontend
}

discover_school_stacks() {
  # Discover compose stack projects dynamically from running frontend containers.
  # Output format: "project|env_file"
  sudo docker ps \
    --filter "label=com.docker.compose.service=frontend" \
    --format '{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.project.config_files"}}|{{.Label "com.docker.compose.project.environment_file"}}' \
    | awk -F'|' 'NF>=3 && $2 ~ /docker-compose\.stack\.yml$/ && length($1)>0 && length($3)>0 {print $1 "|" $3}' \
    | sort -u
}

deploy_console() {
  echo "[deploy] Platform console: pull image"
  sudo docker pull "${CONSOLE_IMAGE}"

  if ! sudo test -f "${CONSOLE_ENV_FILE}"; then
    echo "[deploy] Missing console environment file: ${CONSOLE_ENV_FILE}" >&2
    echo "[deploy] Create it with CONSOLE_JWT_SECRET and at least one console user before deploying." >&2
    exit 1
  fi

  echo "[deploy] Platform console: recreate container on :${CONSOLE_PORT}"
  sudo mkdir -p "${CONSOLE_DATA_DIR}"
  sudo docker rm -f zawadi-console >/dev/null 2>&1 || true
  sudo docker run -d \
    --name zawadi-console \
    --restart always \
    --label com.zawadi.service=platform-console \
    --env-file "${CONSOLE_ENV_FILE}" \
    -e CONSOLE_DATA_DIR=/app/data \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "${APPS_DIR}:${APPS_DIR}" \
    -v "${CONSOLE_DATA_DIR}:/app/data" \
    -v "${CONSOLE_NGINX_SITES_DIR}:${CONSOLE_NGINX_SITES_DIR}:ro" \
    -p "${CONSOLE_PORT}:3100" \
    "${CONSOLE_IMAGE}"
}

healthcheck() {
  local port="$1"
  echo "[deploy] Health check :${port}"
  for attempt in {1..30}; do
    if curl -fsS "http://185.127.16.124:${port}/api/health" >/dev/null; then
      return 0
    fi
    echo "[deploy] Health check :${port} waiting (${attempt}/30)"
    sleep 2
  done

  curl -fsS "http://185.127.16.124:${port}/api/health" >/dev/null
}

site_healthcheck() {
  local port="$1"
  echo "[deploy] Site health check :${port}"
  for attempt in {1..30}; do
    if curl -fsS "http://185.127.16.124:${port}/health" >/dev/null; then
      return 0
    fi
    echo "[deploy] Site health check :${port} waiting (${attempt}/30)"
    sleep 2
  done

  curl -fsS "http://185.127.16.124:${port}/health" >/dev/null
}

container_backend_healthcheck() {
  local container="$1"
  local port
  port="$(sudo docker port "${container}" 5000/tcp | awk -F: 'NR==1{print $NF}')"
  if [[ -z "${port}" ]]; then
    echo "[deploy] Could not resolve backend port for ${container}" >&2
    exit 1
  fi
  healthcheck "${port}"
}

deploy_main

echo "[deploy] Discovering dynamic school stacks"
mapfile -t STACKS < <(discover_school_stacks)
if [[ "${#STACKS[@]}" -eq 0 ]]; then
  echo "[deploy] No dynamic school stacks discovered." >&2
else
  for row in "${STACKS[@]}"; do
    project="${row%%|*}"
    env_file="${row#*|}"
    echo "[deploy] Discovered stack: ${project} (${env_file})"
    deploy_school_stack "${project}" "${env_file}"
  done
fi

deploy_console

echo "[deploy] Container status"
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

container_backend_healthcheck "zawadi-backend"
for row in "${STACKS[@]}"; do
  project="${row%%|*}"
  backend_container="$(sudo docker ps --filter "label=com.docker.compose.project=${project}" --filter "label=com.docker.compose.service=backend" --format '{{.Names}}' | head -n1)"
  if [[ -n "${backend_container}" ]]; then
    container_backend_healthcheck "${backend_container}"
  else
    echo "[deploy] Skipping backend healthcheck for ${project}: backend container not found" >&2
  fi
done
site_healthcheck "${CONSOLE_PORT}"

echo "[deploy] Done."
exit 0
REMOTE
