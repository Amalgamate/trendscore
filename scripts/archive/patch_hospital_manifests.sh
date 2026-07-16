#!/usr/bin/env sh
set -eu
find /mnt/extra-addons -name __manifest__.py -exec sed -i 's/18\.0\.1\.0\.0/19.0.1.0.0/g' {} +
grep -R "'version'" -n /mnt/extra-addons/*/__manifest__.py
