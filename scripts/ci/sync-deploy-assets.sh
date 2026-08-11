#!/usr/bin/env bash
# Copy deploy manifest + script to the production server (SSH host alias: production).
# Installs a persistent copy under /srv/zawadi/apps/deploy for the platform console.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ssh-retry.sh
source "${SCRIPT_DIR}/ssh-retry.sh"

REMOTE_DEPLOY_DIR="${REMOTE_DEPLOY_DIR:-/srv/zawadi/apps/deploy}"
RUN_KEY="${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}"
LOCAL_STAGE="$(mktemp -d "${RUNNER_TEMP:-/tmp}/trendscore-deploy-assets.XXXXXX")"
LOCAL_BUNDLE="${LOCAL_STAGE}/deploy-assets.tgz"
REMOTE_BUNDLE="/tmp/trendscore-deploy-assets-${RUN_KEY}.tgz"
REMOTE_STAGE="/tmp/trendscore-deploy-assets-${RUN_KEY}"
trap 'rm -rf "${LOCAL_STAGE}"' EXIT

cp deploy/instances.manifest.json "${LOCAL_STAGE}/instances.manifest.json"
cp scripts/deploy-release.sh "${LOCAL_STAGE}/deploy-release.sh"
cp scripts/configure-school-aws-env.sh "${LOCAL_STAGE}/configure-school-aws-env.sh"
cp scripts/verify-school-biometric-aws.sh "${LOCAL_STAGE}/verify-school-biometric-aws.sh"
cp docker-compose.yml "${LOCAL_STAGE}/main-docker-compose.yml"
cp deploy/docker-compose.stack.yml "${LOCAL_STAGE}/stack-docker-compose.yml"
tar -C "${LOCAL_STAGE}" -czf "${LOCAL_BUNDLE}" \
  instances.manifest.json \
  deploy-release.sh \
  configure-school-aws-env.sh \
  verify-school-biometric-aws.sh \
  main-docker-compose.yml \
  stack-docker-compose.yml

run_with_ssh_retry "Deploy asset bundle upload" \
  scp "${LOCAL_BUNDLE}" "production:${REMOTE_BUNDLE}"

# Installing this bundle is idempotent, so it is safe to retry before the
# release command begins. The SSH control connection is reused by later steps.
run_with_ssh_retry "Deploy asset bundle install" ssh production "set -euo pipefail
  rm -rf '${REMOTE_STAGE}'
  mkdir -p '${REMOTE_STAGE}'
  tar -xzf '${REMOTE_BUNDLE}' -C '${REMOTE_STAGE}'
  sudo mkdir -p '${REMOTE_DEPLOY_DIR}'
  sudo install -m 0644 '${REMOTE_STAGE}/instances.manifest.json' '${REMOTE_DEPLOY_DIR}/instances.manifest.json'
  sudo install -m 0755 '${REMOTE_STAGE}/deploy-release.sh' '${REMOTE_DEPLOY_DIR}/deploy-release.sh'
  sudo install -m 0755 '${REMOTE_STAGE}/configure-school-aws-env.sh' '${REMOTE_DEPLOY_DIR}/configure-school-aws-env.sh'
  sudo install -m 0755 '${REMOTE_STAGE}/verify-school-biometric-aws.sh' '${REMOTE_DEPLOY_DIR}/verify-school-biometric-aws.sh'
  sudo install -m 0644 '${REMOTE_STAGE}/main-docker-compose.yml' '/srv/zawadi/apps/zawadijrn/docker-compose.yml'
  sudo install -m 0644 '${REMOTE_STAGE}/stack-docker-compose.yml' '/srv/zawadi/apps/docker-compose.stack.yml'
  rm -rf '${REMOTE_STAGE}'
  rm -f '${REMOTE_BUNDLE}'
  echo 'Deploy assets installed:'
  ls -la '${REMOTE_DEPLOY_DIR}/'
  echo 'Main demo compose installed:'
  ls -la '/srv/zawadi/apps/zawadijrn/docker-compose.yml'
  echo 'School stack compose installed:'
  ls -la '/srv/zawadi/apps/docker-compose.stack.yml'
"
