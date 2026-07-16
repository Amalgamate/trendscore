#!/usr/bin/env sh
set -eu
grep -R 'type="object"' -n /mnt/extra-addons/hospital*/views || true
grep -R 'def action_' -n /mnt/extra-addons/hospital*/models || true
