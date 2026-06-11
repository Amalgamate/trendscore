#!/usr/bin/env bash
# Copy deploy manifest + script to the production server (SSH host alias: production).
# Installs a persistent copy under /srv/zawadi/apps/deploy for the platform console.
set -euo pipefail

REMOTE_DEPLOY_DIR="${REMOTE_DEPLOY_DIR:-/srv/zawadi/apps/deploy}"
TMP_MANIFEST="/tmp/trendscore-instances.manifest.json"
TMP_SCRIPT="/tmp/trendscore-deploy-release.sh"
TMP_MAIN_COMPOSE="/tmp/trendscore-main-docker-compose.yml"
TMP_STACK_COMPOSE="/tmp/trendscore-stack-docker-compose.yml"

scp deploy/instances.manifest.json "production:${TMP_MANIFEST}"
scp scripts/deploy-release.sh "production:${TMP_SCRIPT}"
scp docker-compose.yml "production:${TMP_MAIN_COMPOSE}"
scp deploy/portainer/docker-compose.stack.yml "production:${TMP_STACK_COMPOSE}"

ssh production "set -euo pipefail
  sudo mkdir -p '${REMOTE_DEPLOY_DIR}'
  sudo cp '${TMP_MANIFEST}' '${REMOTE_DEPLOY_DIR}/instances.manifest.json'
  sudo cp '${TMP_SCRIPT}' '${REMOTE_DEPLOY_DIR}/deploy-release.sh'
  sudo cp '${TMP_MAIN_COMPOSE}' '/srv/zawadi/apps/zawadijrn/docker-compose.yml'
  sudo cp '${TMP_STACK_COMPOSE}' '/srv/zawadi/apps/docker-compose.stack.yml'
  sudo chmod 755 '${REMOTE_DEPLOY_DIR}/deploy-release.sh'
  echo 'Deploy assets installed:'
  ls -la '${REMOTE_DEPLOY_DIR}/'
  echo 'Main demo compose installed:'
  ls -la '/srv/zawadi/apps/zawadijrn/docker-compose.yml'
  echo 'School stack compose installed:'
  ls -la '/srv/zawadi/apps/docker-compose.stack.yml'
"
