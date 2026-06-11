# Deployment model

See **[WORKFLOW.md](./WORKFLOW.md)** for the segmented canary → promote process (school app vs platform console).

## Image publishing

**Publish Docker Images** builds and pushes `ghcr.io/amalgamate/zawadi-frontend`, `zawadi-backend`, and `zawadi-console` with tags `latest` and `sha-<commit>`.

Deployments are manual-only. Pushing to `main` can publish images, but it does not deploy schools automatically.

## Manual school deployment

Use the **Promote Release** workflow (`workflow_dispatch`):

| Input | Description |
|-------|-------------|
| `school_slug` | Typed school slug, alias, compose project, or domain prefix. Examples: `demo`, `lions-complex`, `zawadi-junior` |
| `environment` | Typed environment such as `demo`, `pilot`, or `production` |
| `branch` | Branch/ref whose `sha-<commit>` image tag should be deployed |

The workflow runs `scripts/validate-deployment-target.js` before SSH deployment. Validation checks `deploy/instances.manifest.json` and stops immediately if:

- the school slug is unknown,
- the school is inactive,
- deployment is disabled for the school,
- the requested environment does not match the target manifest entry.

The workflow prints the matched school name, domain, server/container name, environment, branch, commit, and image tag before deployment. It then deploys only the matched school ID using `DEPLOY_TARGET=school`.

### GitHub Environments (approval gates)

Configure these in **Settings → Environments** with required reviewers where noted:

| Environment | Used for |
|-------------|----------|
| `deploy-demo` | Manual demo/canary deployment |
| `deploy-pilot` | Pilot schools (`tier: "pilot"` in manifest) |
| `deploy-production-school` | Single school promote |

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
  "active": true,
  "deployment_allowed": true,
  "kind": "stack",
  "compose_project": "zawadi-merti-cs",
  "env_file": "/srv/zawadi/apps/env/.zawadi-merti-cs.env"
}
```

- `active: false` blocks deployment.
- `deployment_allowed: false` blocks deployment.
- `aliases` can be used for operator-friendly typed slugs, for example `lions-complex` for a manifest ID such as `lionscomplex`.
- **demo** — `kind: "stack"` uses `zawadi-demoschool` with its own env file, DB volume, ports, and nginx route. It must not share the `zawadijrn` production stack.

Set `ALLOW_PUBLIC_REGISTRATION` is unrelated; for deploys set secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`.

## Server-side manual run

```bash
export DEPLOY_TARGET=school
export IMAGE_TAG=sha-<commit>
export SCHOOL_ID=merti-cs
export MANIFEST_PATH=/srv/zawadi/apps/deploy/instances.manifest.json
bash /srv/zawadi/apps/deploy/deploy-release.sh

# Platform console only (no school stacks)
export DEPLOY_CONSOLE_ONLY=true
export IMAGE_TAG=sha-<commit>
bash /srv/zawadi/apps/deploy/deploy-release.sh
```
