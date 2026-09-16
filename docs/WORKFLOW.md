# Deployment Workflow

This document defines how TrendScore school applications are published, validated, and deployed.

## Runtime Areas

| Area | Images | Users | Deployment model |
| --- | --- | --- | --- |
| School app | `zawadi-frontend`, `zawadi-backend` | Teachers, parents, school admins | Manual single-school deployment |
| Platform console | `zawadi-console` | Operators and platform admins | Separate console deployment path |

Image publishing and school deployment are intentionally separated.

## 1. Publish Images

`Publish Docker Images` builds and publishes:

- `ghcr.io/amalgamate/zawadi-frontend`
- `ghcr.io/amalgamate/zawadi-backend`
- `ghcr.io/amalgamate/zawadi-console`

Images are tagged as:

- `latest` on the default branch,
- `sha-<commit>` for the exact commit,
- `v*.*.*` for release tags.

Publishing images does not automatically deploy schools.

## 2. Deploy One School Manually

Use the `Promote Release` workflow from GitHub Actions.

Typed inputs:

| Input | Example | Notes |
| --- | --- | --- |
| `school_slug` | `demo`, `lions-complex`, `zawadi-junior` | Free text. No static school dropdown is maintained in YAML. |
| `environment` | `demo`, `pilot`, `production` | Must match the school entry in `deploy/instances.manifest.json`. |
| `branch` | `main` | The workflow deploys the `sha-<commit>` image for this branch/ref. |

Validation runs before SSH deployment:

```bash
node scripts/validate-deployment-target.js "$school_slug" \
  --environment "$environment" \
  --branch "$branch" \
  --manifest deploy/instances.manifest.json
```

The script confirms:

1. the typed school slug exists,
2. the school is active,
3. deployment is allowed,
4. the requested environment matches the manifest,
5. the exact school/container/domain details can be resolved.

If validation fails, deployment stops immediately.

## 3. Matched Target Output

Before deployment starts, the workflow prints:

- School name
- Domain
- Server/container name
- Environment
- Branch
- Commit SHA
- Image tag

The server deploy command is then scoped to the matched school:

```bash
DEPLOY_TARGET=school \
SCHOOL_ID=<validated-school-id> \
IMAGE_TAG=sha-<commit> \
MANIFEST_PATH=/srv/zawadi/apps/deploy/instances.manifest.json \
bash /srv/zawadi/apps/deploy/deploy-release.sh
```

## 4. Demo Deployment

Demo uses the same `Promote Release` workflow as every other school:

| Input | Value |
| --- | --- |
| `school_slug` | `demo` |
| `environment` | `demo` |
| `branch` | `main` or the branch/ref to promote |

The demo target is an isolated stack:

- `compose_project`: `zawadi-demoschool`
- `env_file`: `/srv/zawadi/apps/env/.zawadi-demoschool.env`
- public domain: `demoschool.trendscore.co.ke`

Do not point `demo` at the `zawadijrn` main stack. JRN production and demo must be promoted independently through the same workflow with different inputs.

## 5. Manifest Source of Truth

Schools are defined in `deploy/instances.manifest.json`.

Required fields:

```json
{
  "id": "new-school",
  "label": "New School",
  "tier": "production",
  "active": true,
  "deployment_allowed": true,
  "kind": "stack",
  "compose_project": "zawadi-new-school",
  "env_file": "/srv/zawadi/apps/env/.zawadi-new-school.env",
  "public_domain": "new-school.trendscore.co.ke",
  "aliases": ["new-school-main"]
}
```

Guidelines:

1. `id` is the canonical deployment ID.
2. `aliases` are operator-friendly typed slugs.
3. `active: false` blocks deployment.
4. `deployment_allowed: false` blocks deployment.
5. `tier` should match the typed environment.
6. No school list should be hardcoded in workflow YAML.

## 6. Safety Rules

1. Deployments are manual-only.
2. Always validate against the manifest before SSH deployment.
3. Deploy one matched school at a time.
4. Do not maintain static school dropdowns in GitHub Actions YAML.
5. Use `sha-<commit>` tags so frontend and backend images stay aligned.
