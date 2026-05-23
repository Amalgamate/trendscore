#!/usr/bin/env bash
set -euo pipefail

# Provision one application stack from JSON payload.
# Payload keys:
#   name, domain, type, appType, version, image, fePort, bePort, db, requestedBy
# Example:
#   ./provision-instance.sh '{"name":"School D","domain":"schoold.elimucrown.co.ke","fePort":3003,"bePort":5003,"db":"trends_core_school_d","requestedBy":"admin@elimucrown.co.ke"}'

PAYLOAD_JSON="${1:-}"
if [[ -z "${PAYLOAD_JSON}" ]]; then
  echo "missing payload json" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for payload parsing" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker cli is required on runtime host" >&2
  exit 2
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "docker compose is missing in the console runtime. Install Docker Compose plugin and redeploy console image." >&2
  exit 2
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required for secret generation" >&2
  exit 2
fi

# Directory/layout defaults align with deploy-server.sh conventions.
APPS_DIR="${APPS_DIR:-/srv/zawadi/apps}"
STACK_COMPOSE_FILE="${STACK_COMPOSE_FILE:-${APPS_DIR}/docker-compose.stack.yml}"
ODOO_COMPOSE_FILE="${ODOO_COMPOSE_FILE:-${APPS_DIR}/docker-compose.odoo.yml}"
WORDPRESS_COMPOSE_FILE="${WORDPRESS_COMPOSE_FILE:-${APPS_DIR}/docker-compose.wordpress.yml}"
ENV_DIR="${ENV_DIR:-${APPS_DIR}/env}"
WORDPRESS_PHP_DIR="${WORDPRESS_PHP_DIR:-${APPS_DIR}/wordpress-php}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-ghcr.io/amalgamate/zawadi-frontend:latest}"
BACKEND_IMAGE="${BACKEND_IMAGE:-ghcr.io/amalgamate/zawadi-backend:latest}"
DEFAULT_HOST_IP="${DEFAULT_HOST_IP:-185.127.16.124}"
WORDPRESS_CONFIG_EXTRA_DEFAULT="${WORDPRESS_CONFIG_EXTRA_DEFAULT:-define('FS_METHOD','direct');}"

range_for_app() {
  local app="$1"
  local slot="$2"
  case "${app}:${slot}" in
    school:fe) echo "3000 3499" ;;
    school:be) echo "5000 5499" ;;
    odoo:fe) echo "3500 3999" ;;
    wordpress:fe) echo "4000 4499" ;;
    *) echo "0 0" ;;
  esac
}

mkdir -p "${ENV_DIR}"

# Parse and sanitize payload via jq.
mapfile -t PARSED < <(printf '%s' "${PAYLOAD_JSON}" | jq -r '
  def clean: (tostring | gsub("^\\s+|\\s+$"; ""));
  def slug:
    clean
    | ascii_downcase
    | gsub("[^a-z0-9]+"; "-")
    | gsub("^-+|-+$"; "");

  . as $p
  | ($p.name // "" | clean) as $name
  | if $name == "" then error("name is required") else . end
  | ($name | slug) as $slug
  | if $slug == "" then error("name produced empty slug") else . end
  | ($p.domain // "" | clean) as $domain
  | ($p.requestedBy // "" | clean) as $requestedBy
  | ($p.type // "" | clean) as $type
  | (($p.appType // "school") | clean | ascii_downcase) as $appType
  | ($p.version // "" | clean) as $version
  | ($p.image // "" | clean) as $image
  | ($p.db // "" | clean) as $dbName
  | [
      $name,
      $slug,
      (if $domain == "" then "\($slug).elimucrown.co.ke" else $domain end),
      (if $requestedBy == "" then "console" else $requestedBy end),
      (if $type == "" then "PRIMARY_CBC" else $type end),
      (if ($appType == "") then "school" else $appType end),
      $version,
      $image,
      (if $dbName == "" then "zawadi_\($slug|gsub("-"; "_"))" else $dbName end),
      ((($p.fePort // 0) | tonumber? // 0) | tostring),
      ((($p.bePort // 0) | tonumber? // 0) | tostring)
    ][]
')

if [[ "${#PARSED[@]}" -lt 11 ]]; then
  echo "invalid json payload" >&2
  exit 2
fi

SCHOOL_NAME="${PARSED[0]}"
SCHOOL_SLUG="${PARSED[1]}"
SCHOOL_DOMAIN="${PARSED[2]}"
REQUESTED_BY="${PARSED[3]}"
SCHOOL_TYPE="${PARSED[4]}"
APP_TYPE="${PARSED[5]}"
APP_VERSION="${PARSED[6]}"
APP_IMAGE="${PARSED[7]}"
DB_NAME="${PARSED[8]}"
REQ_FE_PORT="${PARSED[9]}"
REQ_BE_PORT="${PARSED[10]}"

if [[ "${APP_TYPE}" != "school" && "${APP_TYPE}" != "odoo" && "${APP_TYPE}" != "wordpress" ]]; then
  echo "unsupported appType: ${APP_TYPE}" >&2
  exit 2
fi

if [[ -z "${APP_IMAGE}" ]]; then
  if [[ "${APP_TYPE}" == "school" ]]; then
    APP_IMAGE="${FRONTEND_IMAGE}"
  elif [[ "${APP_TYPE}" == "odoo" ]]; then
    APP_IMAGE="odoo:18.0"
  else
    APP_IMAGE="wordpress:latest"
  fi
fi

PROJECT_NAME="zawadi-${SCHOOL_SLUG}"
ENV_FILE="${ENV_DIR}/.${PROJECT_NAME}.env"
REUSED_ENV_FILE=false

if [[ "${APP_TYPE}" == "school" && ! -f "${STACK_COMPOSE_FILE}" ]]; then
  echo "stack compose file not found: ${STACK_COMPOSE_FILE}" >&2
  exit 2
fi

if [[ -f "${ENV_FILE}" ]]; then
  REUSED_ENV_FILE=true
  echo "[provision] reusing existing env file: ${ENV_FILE}"
fi

port_in_use() {
  local p="$1"
  docker ps --format '{{.Ports}}' | grep -E "(^|[ ,:])${p}->|:${p}-" >/dev/null 2>&1
}

next_free_port() {
  local start="$1"
  local finish="${2:-65000}"
  local p="$start"
  while port_in_use "$p"; do
    p=$((p+1))
    if [[ "$p" -gt "${finish}" ]]; then
      echo "no free port found in range ${start}-${finish}" >&2
      exit 4
    fi
  done
  echo "$p"
}

port_in_range() {
  local p="$1"
  local min="$2"
  local max="$3"
  [[ "${p}" =~ ^[0-9]+$ ]] && [[ "${p}" -ge "${min}" ]] && [[ "${p}" -le "${max}" ]]
}

env_value() {
  local key="$1"
  local fallback="${2:-}"
  local value
  value="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '\r' || true)"
  if [[ -z "${value}" ]]; then
    echo "${fallback}"
  else
    echo "${value}"
  fi
}

odoo_base_installed() {
  local project="$1"
  local compose_file="$2"
  local env_file="$3"
  local db_name="$4"
  local db_user="$5"

  "${COMPOSE_CMD[@]}" --env-file "${env_file}" -p "${project}" -f "${compose_file}" exec -T db \
    psql -U "${db_user}" -d "${db_name}" -tAc "select 1 from pg_tables where schemaname='public' and tablename='ir_module_module';" \
    | tr -d '[:space:]' | grep -q '^1$'
}

bootstrap_odoo_base_if_needed() {
  local project="$1"
  local compose_file="$2"
  local env_file="$3"
  local db_name="$4"
  local db_user="$5"

  if odoo_base_installed "${project}" "${compose_file}" "${env_file}" "${db_name}" "${db_user}"; then
    echo "[provision] odoo base schema already present for ${db_name}"
    return 0
  fi

  echo "[provision] odoo base schema missing for ${db_name}; initializing"
  "${COMPOSE_CMD[@]}" --env-file "${env_file}" -p "${project}" -f "${compose_file}" run -T --rm odoo \
    odoo -d "${db_name}" -i base --without-demo=all --stop-after-init < /dev/null

  if ! odoo_base_installed "${project}" "${compose_file}" "${env_file}" "${db_name}" "${db_user}"; then
    echo "[provision] odoo base schema initialization failed for ${db_name}" >&2
    return 1
  fi

  echo "[provision] odoo base schema initialized for ${db_name}"
}

read FE_MIN FE_MAX < <(range_for_app "${APP_TYPE}" fe)
read BE_MIN BE_MAX < <(range_for_app "${APP_TYPE}" be)

if [[ "${REQ_FE_PORT}" =~ ^[0-9]+$ ]] && [[ "${REQ_FE_PORT}" -gt 0 ]]; then
  FE_PORT="${REQ_FE_PORT}"
  if ! port_in_range "${FE_PORT}" "${FE_MIN}" "${FE_MAX}"; then
    echo "frontend/http port must be in range ${FE_MIN}-${FE_MAX} for ${APP_TYPE}" >&2
    exit 4
  fi
else
  FE_PORT="$(next_free_port "${FE_MIN}" "${FE_MAX}")"
fi

if [[ "${APP_TYPE}" == "school" && "${REQ_BE_PORT}" =~ ^[0-9]+$ ]] && [[ "${REQ_BE_PORT}" -gt 0 ]]; then
  BE_PORT="${REQ_BE_PORT}"
  if ! port_in_range "${BE_PORT}" "${BE_MIN}" "${BE_MAX}"; then
    echo "backend port must be in range ${BE_MIN}-${BE_MAX} for ${APP_TYPE}" >&2
    exit 4
  fi
else
  if [[ "${APP_TYPE}" == "school" ]]; then
    BE_PORT="$(next_free_port "${BE_MIN}" "${BE_MAX}")"
  else
    BE_PORT="0"
  fi
fi

if [[ "${FE_PORT}" == "${BE_PORT}" ]]; then
  BE_PORT="$(next_free_port $((BE_PORT+1)) "${BE_MAX}")"
fi

if port_in_use "${FE_PORT}"; then
  echo "frontend port already in use: ${FE_PORT}" >&2
  exit 4
fi
if [[ "${APP_TYPE}" == "school" ]] && port_in_use "${BE_PORT}"; then
  echo "backend port already in use: ${BE_PORT}" >&2
  exit 4
fi

if [[ "${REUSED_ENV_FILE}" == "false" ]]; then
DB_USER="zawadi"
DB_PASSWORD="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"
JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(openssl rand -hex 32)"

FRONTEND_URL="http://${DEFAULT_HOST_IP}:${FE_PORT}"
API_URL="http://${DEFAULT_HOST_IP}:${BE_PORT}/api"
CORS_ORIGIN="${FRONTEND_URL}"
SECURE_COOKIES=false
NODE_ENV_RUNTIME=development
if [[ "${FRONTEND_URL}" == https://* ]]; then
  SECURE_COOKIES=true
  NODE_ENV_RUNTIME=production
fi

cat > "${ENV_FILE}" <<EOF
APP_TYPE=${APP_TYPE}
APP_VERSION=${APP_VERSION}
SCHOOL_CODE=${SCHOOL_SLUG}
FRONTEND_IMAGE=${FRONTEND_IMAGE}
BACKEND_IMAGE=${BACKEND_IMAGE}
ODOO_IMAGE=${APP_IMAGE}
WORDPRESS_IMAGE=${APP_IMAGE}
FRONTEND_PORT=${FE_PORT}
BACKEND_PORT=${BE_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SUPER_ADMIN_EMAIL=admin@trendscore.app
SUPER_ADMIN_PASSWORD=Admin@123!
CREATE_EXTRA_DEMO_USERS=false
DEMO_USER_PASSWORD=Demo@123!
FRONTEND_URL=${FRONTEND_URL}
API_URL=${API_URL}
CORS_ORIGIN=${CORS_ORIGIN}
HTTPS_ONLY=false
SECURE_COOKIES=${SECURE_COOKIES}
NODE_ENV=${NODE_ENV_RUNTIME}
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
EOF

if [[ "${APP_TYPE}" == "wordpress" ]]; then
  echo "WORDPRESS_CONFIG_EXTRA=${WORDPRESS_CONFIG_EXTRA_DEFAULT}" >> "${ENV_FILE}"
  echo "WORDPRESS_UPLOADS_INI=${WORDPRESS_PHP_DIR}/${PROJECT_NAME}/uploads.ini" >> "${ENV_FILE}"
fi

echo "[provision] env file created: ${ENV_FILE}"
else
  # Existing env file is source of truth for retry runs.
  APP_TYPE="$(env_value APP_TYPE school)"
  if [[ -z "${APP_TYPE}" ]]; then
    APP_TYPE="school"
  fi
  FE_PORT="$(env_value FRONTEND_PORT "${FE_PORT}")"
  BE_PORT="$(env_value BACKEND_PORT "${BE_PORT}")"
  DB_NAME="$(env_value DB_NAME "${DB_NAME}")"
fi

# Ensure runtime variables are always loaded from env file for new and reused runs.
DB_USER="$(env_value DB_USER "${DB_USER:-zawadi}")"
DB_PASSWORD="$(env_value DB_PASSWORD "${DB_PASSWORD:-}")"

if [[ "${APP_TYPE}" == "wordpress" ]]; then
  if grep -q '^WORDPRESS_CONFIG_EXTRA=' "${ENV_FILE}"; then
    sed -i "s#^WORDPRESS_CONFIG_EXTRA=.*#WORDPRESS_CONFIG_EXTRA=${WORDPRESS_CONFIG_EXTRA_DEFAULT}#" "${ENV_FILE}"
  else
    echo "WORDPRESS_CONFIG_EXTRA=${WORDPRESS_CONFIG_EXTRA_DEFAULT}" >> "${ENV_FILE}"
  fi
  WORDPRESS_UPLOADS_INI="${WORDPRESS_PHP_DIR}/${PROJECT_NAME}/uploads.ini"
  if grep -q '^WORDPRESS_UPLOADS_INI=' "${ENV_FILE}"; then
    WORDPRESS_UPLOADS_INI="$(env_value WORDPRESS_UPLOADS_INI "${WORDPRESS_UPLOADS_INI}")"
  else
    echo "WORDPRESS_UPLOADS_INI=${WORDPRESS_UPLOADS_INI}" >> "${ENV_FILE}"
  fi
  mkdir -p "$(dirname "${WORDPRESS_UPLOADS_INI}")"
  cat > "${WORDPRESS_UPLOADS_INI}" <<'EOF'
upload_max_filesize=64M
post_max_size=64M
memory_limit=256M
max_execution_time=300
max_input_time=300
EOF
fi

pushd "${APPS_DIR}" >/dev/null

echo "[provision] creating/updating stack ${PROJECT_NAME}"
if [[ "${APP_TYPE}" == "school" ]]; then
  "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -p "${PROJECT_NAME}" -f "${STACK_COMPOSE_FILE}" up -d db backend frontend

  echo "[provision] applying prisma schema"
  "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -p "${PROJECT_NAME}" -f "${STACK_COMPOSE_FILE}" run -T --rm backend npx prisma db push --skip-generate < /dev/null

  echo "[provision] ensuring active school row exists"
  "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -p "${PROJECT_NAME}" -f "${STACK_COMPOSE_FILE}" exec -T db \
    psql -U "${DB_USER}" -d "${DB_NAME}" -c \
    "insert into schools (id,name,active,status,archived,\"updatedAt\") values ('${SCHOOL_SLUG}','${SCHOOL_NAME}',true,'ACTIVE',false,now()) on conflict (id) do update set name=excluded.name, active=true, status='ACTIVE', archived=false, \"updatedAt\"=now();"

  echo "[provision] restarting app containers"
  "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -p "${PROJECT_NAME}" -f "${STACK_COMPOSE_FILE}" up -d --force-recreate backend frontend
elif [[ "${APP_TYPE}" == "odoo" ]]; then
  if [[ ! -f "${ODOO_COMPOSE_FILE}" ]]; then
    cat > "${ODOO_COMPOSE_FILE}" <<'EOF'
services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - odoo_db_data:/var/lib/postgresql/data

  odoo:
    image: ${ODOO_IMAGE:-odoo:18.0}
    restart: always
    depends_on:
      - db
    ports:
      - "${FRONTEND_PORT}:8069"
    environment:
      HOST: db
      PORT: 5432
      USER: ${DB_USER}
      PASSWORD: ${DB_PASSWORD}
    volumes:
      - odoo_data:/var/lib/odoo

volumes:
  odoo_db_data:
  odoo_data:
EOF
  fi
  "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -p "${PROJECT_NAME}" -f "${ODOO_COMPOSE_FILE}" up -d db odoo
  bootstrap_odoo_base_if_needed "${PROJECT_NAME}" "${ODOO_COMPOSE_FILE}" "${ENV_FILE}" "${DB_NAME}" "${DB_USER}"
  "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -p "${PROJECT_NAME}" -f "${ODOO_COMPOSE_FILE}" up -d --force-recreate odoo
elif [[ "${APP_TYPE}" == "wordpress" ]]; then
  cat > "${WORDPRESS_COMPOSE_FILE}" <<'EOF'
services:
  db:
    image: mysql:8.0
    restart: always
    command: --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
    volumes:
      - wordpress_db_data:/var/lib/mysql

  wordpress:
    image: ${WORDPRESS_IMAGE:-wordpress:latest}
    command:
      - sh
      - -c
      - chown -R www-data:www-data /var/www/html/wp-content && docker-entrypoint.sh apache2-foreground
    restart: always
    depends_on:
      - db
    ports:
      - "${FRONTEND_PORT}:80"
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_NAME: ${DB_NAME}
      WORDPRESS_DB_USER: ${DB_USER}
      WORDPRESS_DB_PASSWORD: ${DB_PASSWORD}
      WORDPRESS_CONFIG_EXTRA: ${WORDPRESS_CONFIG_EXTRA}
    volumes:
      - wordpress_data:/var/www/html
      - ${WORDPRESS_UPLOADS_INI}:/usr/local/etc/php/conf.d/uploads.ini:ro

volumes:
  wordpress_db_data:
  wordpress_data:
EOF
  "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -p "${PROJECT_NAME}" -f "${WORDPRESS_COMPOSE_FILE}" up -d db wordpress
fi

popd >/dev/null

# Health checks
check_url() {
  local url="$1"
  local label="$2"
  local n
  for n in {1..30}; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "[provision] ${label} ok: ${url}"
      return 0
    fi
    sleep 2
  done
  echo "[provision] ${label} failed: ${url}" >&2
  return 1
}

if [[ "${APP_TYPE}" == "school" ]]; then
  check_url "http://${DEFAULT_HOST_IP}:${BE_PORT}/api/health" "backend health"
  check_url "http://${DEFAULT_HOST_IP}:${FE_PORT}/" "frontend health"
elif [[ "${APP_TYPE}" == "odoo" ]]; then
  check_url "http://${DEFAULT_HOST_IP}:${FE_PORT}/web/login" "odoo health"
elif [[ "${APP_TYPE}" == "wordpress" ]]; then
  check_url "http://${DEFAULT_HOST_IP}:${FE_PORT}/wp-login.php" "wordpress health"
fi

RESULT_JSON=$(jq -n \
  --arg projectName "${PROJECT_NAME}" \
  --arg envFile "${ENV_FILE}" \
  --arg schoolName "${SCHOOL_NAME}" \
  --arg domain "${SCHOOL_DOMAIN}" \
  --arg institutionType "${SCHOOL_TYPE}" \
  --arg appType "${APP_TYPE}" \
  --arg appVersion "${APP_VERSION}" \
  --arg appImage "${APP_IMAGE}" \
  --argjson frontendPort "${FE_PORT}" \
  --argjson backendPort "$(if [[ "${APP_TYPE}" == "school" ]]; then echo "${BE_PORT}"; else echo "null"; fi)" \
  --arg dbName "${DB_NAME}" \
  --arg requestedBy "${REQUESTED_BY}" \
  --argjson reusedEnvFile "$( [[ "${REUSED_ENV_FILE}" == "true" ]] && echo true || echo false )" \
  '{ok:true, projectName:$projectName, envFile:$envFile, schoolName:$schoolName, domain:$domain, institutionType:$institutionType, appType:$appType, appVersion:$appVersion, appImage:$appImage, frontendPort:$frontendPort, backendPort:$backendPort, dbName:$dbName, requestedBy:$requestedBy, reusedEnvFile:$reusedEnvFile}')

echo "${RESULT_JSON}"
