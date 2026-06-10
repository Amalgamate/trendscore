# Deployment model

See **[WORKFLOW.md](./WORKFLOW.md)** for the segmented canary → promote process (school app vs platform console).

## Automatic (push to `main`)

1. **Publish Docker Images** builds and pushes `ghcr.io/amalgamate/zawadi-frontend`, `zawadi-backend`, and `zawadi-console` with tags `latest` and `sha-<commit>`.
2. **Deploy Demo (main only)** runs after a successful publish and deploys **only** the canary (`tier: "demo"` in `deploy/instances.manifest.json`) and rolls the **platform console** to the same tag.

Production and pilot schools are **not** updated on git push.

## Manual promote

Use the **Promote Release** workflow (`workflow_dispatch`):

| Input | Description |
|-------|-------------|
| `image_tag` | Tag to deploy (use the `sha-<commit>` from CI, or a release tag) |
| `deployment_target` | `demo`, `pilot`, `selected_school`, or `all_schools` |
| `school_id` | Required for `selected_school` — must match `id` in the manifest |

### GitHub Environments (approval gates)

Configure these in **Settings → Environments** with required reviewers where noted:

| Environment | Used for |
|-------------|----------|
| `deploy-demo` | Auto demo deploy + optional manual demo promote |
| `deploy-pilot` | Pilot schools (`tier: "pilot"` in manifest) |
| `deploy-production-school` | Single school promote |
| `deploy-production-all` | All school stacks (manifest + discovered) |

### Per-instance pipeline

Each target runs in isolation (own compose project, `.env`, database volume):

1. Verify target configuration  
2. PostgreSQL backup → `/srv/zawadi/backups/<instance-id>/<timestamp>/`  
3. Pull pinned frontend/backend images  
4. `npx prisma migrate deploy`  
5. Recreate backend + frontend containers  
6. HTTP health check on `/api/health`  
7. Job summary reports success or failure  

## Instance manifest

Edit `deploy/instances.manifest.json`:

```json
{
  "id": "merti-cs",
  "label": "Merti Complex School",
  "tier": "production",
  "kind": "stack",
  "compose_project": "zawadi-merti-cs",
  "env_file": "/srv/zawadi/apps/env/.zawadi-merti-cs.env"
}
```

- **demo** — `kind: "main"` uses `defaults.main_dir` (canary / demoschool).  
- **pilot** — all entries with `tier: "pilot"`.  
- **all_schools** — all `kind: "stack"` entries in the manifest, plus any running school stack discovered on the server (excluding `discovery.exclude_compose_projects`).

Set `ALLOW_PUBLIC_REGISTRATION` is unrelated; for deploys set secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`.

## Server-side manual run

```bash
export DEPLOY_TARGET=demo          # demo | pilot | school | all_schools
export IMAGE_TAG=sha-<commit>
export SCHOOL_ID=merti-cs          # when DEPLOY_TARGET=school
export MANIFEST_PATH=/srv/zawadi/apps/deploy/instances.manifest.json
bash /srv/zawadi/apps/deploy/deploy-release.sh

# Platform console only (no school stacks)
export DEPLOY_CONSOLE_ONLY=true
export IMAGE_TAG=sha-<commit>
bash /srv/zawadi/apps/deploy/deploy-release.sh
```
