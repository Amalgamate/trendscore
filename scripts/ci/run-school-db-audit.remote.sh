#!/usr/bin/env bash
set -euo pipefail

MANIFEST=/srv/zawadi/apps/deploy/instances.manifest.json
AUDITOR="/tmp/trendscore-db-audit-${AUDIT_RUN_ID:?}.cjs"
REPORT="/tmp/trendscore-db-audit-${AUDIT_RUN_ID}.jsonl"
trap 'sudo rm -f "$AUDITOR" "$REPORT"' EXIT

[[ -f "$MANIFEST" ]] || { echo "Missing server deployment manifest" >&2; exit 2; }
[[ -f /tmp/audit-school-db.cjs ]] || { echo "Missing uploaded audit program" >&2; exit 2; }
sudo install -m 0644 /tmp/audit-school-db.cjs "$AUDITOR"
sudo rm -f /tmp/audit-school-db.cjs
: >"$REPORT"

total=0
ok=0
warnings=0
failed=0
instances="$(jq -c '.instances[] | select(.active == true and .archived != true)' "$MANIFEST")"
known_projects="$(jq -r '.instances[] | select(.active == true and .archived != true) | .compose_project // empty' "$MANIFEST" | sort -u)"
while IFS= read -r project; do
  [[ -n "$project" ]] || continue
  if ! grep -Fxq "$project" <<<"$known_projects"; then
    id="${project#zawadi-}"
    discovered="$(jq -cn --arg id "$id" --arg project "$project" '{id:$id,tier:"unregistered",kind:"stack",compose_project:$project,unregistered:true}')"
    instances+=$'\n'"$discovered"
  fi
done < <(sudo docker ps --filter 'label=com.docker.compose.service=backend' --format '{{.Label "com.docker.compose.project"}}' | sort -u)

while IFS= read -r instance; do
  id="$(jq -r '.id' <<<"$instance")"
  kind="$(jq -r '.kind // "stack"' <<<"$instance")"
  project="$(jq -r '.compose_project // empty' <<<"$instance")"
  tier="$(jq -r '.tier // "unknown"' <<<"$instance")"
  total=$((total + 1))

  if [[ "$kind" == "main" ]]; then
    backend=zawadi-backend
  else
    backend="$(sudo docker ps --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=backend' --format '{{.Names}}' | head -n1)"
  fi

  if [[ -z "$backend" ]]; then
    row="$(jq -cn --arg school "$id" --arg tier "$tier" '{school:$school,tier:$tier,status:"ERROR",error:"backend container is not running"}')"
  else
    image="$(sudo docker inspect --format '{{.Config.Image}}' "$backend" 2>/dev/null || true)"
    image_tag="${image##*:}"
    if ! sudo docker cp "$AUDITOR" "$backend:/tmp/audit-school-db.cjs" >/dev/null; then
      row="$(jq -cn --arg school "$id" --arg tier "$tier" --arg image "$image_tag" '{school:$school,tier:$tier,image:$image,status:"ERROR",error:"could not stage read-only audit script"}')"
    else
      set +e
      row="$(sudo docker exec -e AUDIT_SCHOOL_ID="$id" -e AUDIT_IMAGE_TAG="$image_tag" "$backend" node /tmp/audit-school-db.cjs 2>&1)"
      audit_rc=$?
      set -e
      if ! jq -e 'type == "object" and has("status")' >/dev/null 2>&1 <<<"$row"; then
        row="$(jq -cn --arg school "$id" --arg tier "$tier" --arg image "$image_tag" --arg message "${row:0:500}" --argjson exitCode "$audit_rc" '{school:$school,tier:$tier,image:$image,status:"ERROR",error:$message,exitCode:$exitCode}')"
      else
        row="$(jq -c --arg tier "$tier" '. + {tier:$tier}' <<<"$row")"
      fi
    fi
    sudo docker exec -u 0 "$backend" rm -f /tmp/audit-school-db.cjs >/dev/null 2>&1 || true
  fi

  backup_status=INVALID_OR_MISSING
  backup_dir="/srv/zawadi/backups/$id"
  if sudo test -f "$backup_dir/LATEST"; then
    backup_file="$(sudo head -n1 "$backup_dir/LATEST" 2>/dev/null || true)"
    if [[ "$backup_file" = /* ]]; then
      backup_candidate="$backup_file"
    else
      backup_candidate="$backup_dir/$backup_file"
    fi
    backup_resolved="$(sudo readlink -f "$backup_candidate" 2>/dev/null || true)"
    backup_expected_root="$(sudo readlink -f "$backup_dir" 2>/dev/null || true)"
    if [[ -n "$backup_expected_root" && "$backup_resolved" == "$backup_expected_root"/* ]] \
      && sudo test -s "$backup_resolved" \
      && sudo grep -q '^-- PostgreSQL database dump' "$backup_resolved"; then
      backup_status=VALID
    fi
  fi
  row="$(jq -c --arg backup "$backup_status" '
    . + {latestBackup:$backup}
    | if $backup != "VALID" then
        .status = (if .status == "OK" then "WARN" else .status end)
        | .issues = ((.issues // {critical:[],warnings:[],info:[]})
          | .warnings = ((.warnings // []) + ["latest database backup pointer is missing or invalid"]))
      else . end' <<<"$row")"
  if [[ "$(jq -r '.unregistered // false' <<<"$instance")" == "true" ]]; then
    row="$(jq -c '
      .status = (if .status == "OK" then "WARN" else .status end)
      | .unregistered = true
      | .issues = ((.issues // {critical:[],warnings:[],info:[]})
        | .warnings = ((.warnings // []) + ["running school backend stack is missing from instances.manifest.json"]))' <<<"$row")"
  fi

  printf '%s\n' "$row" | tee -a "$REPORT"
  status="$(jq -r '.status' <<<"$row")"
  case "$status" in
    OK) ok=$((ok + 1)) ;;
    WARN) warnings=$((warnings + 1)) ;;
    *) failed=$((failed + 1)) ;;
  esac
done <<< "$instances"

echo "AUDIT_TOTALS total=$total ok=$ok warnings=$warnings failed=$failed"
[[ "$total" -gt 0 ]] || { echo "No active instances found" >&2; exit 2; }
[[ "$failed" -eq 0 && "$warnings" -eq 0 ]]
