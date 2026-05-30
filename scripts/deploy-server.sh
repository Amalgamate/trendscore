#!/usr/bin/env bash
set -euo pipefail

# Deprecated: this script deployed every live instance on the server.
# Use scripts/deploy-release.sh with an explicit DEPLOY_TARGET instead.
#
# Emergency full rollout (requires manual confirmation outside CI):
#   DEPLOY_TARGET=all_schools IMAGE_TAG=sha-<commit> bash scripts/deploy-release.sh

echo "[deploy-server] DEPRECATED — use scripts/deploy-release.sh" >&2
echo "[deploy-server] Example: DEPLOY_TARGET=demo IMAGE_TAG=sha-abc1234 bash scripts/deploy-release.sh" >&2
exit 1
