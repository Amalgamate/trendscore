#!/usr/bin/env sh
set -eu
grep -R "hospital.admission\|hospital.patient\|_inherit = .*hospital.bed" -n \
  /mnt/extra-addons/hospital_base \
  /mnt/extra-addons/hospital_patient \
  /mnt/extra-addons/hospital_ipd | head -n 120
