# Release workflow (segmented)

This document defines how **school applications** and the **platform console** are built and deployed without stepping on each other.

## Segments

| Segment | Images | Serves | Typical URL |
|---------|--------|--------|-------------|
| **School app** | `zawadi-frontend`, `zawadi-backend` | Teachers, parents, school admins | `*.trendscore.co.ke` per school |
| **Platform console** | `zawadi-console` | Super-admin control panel only | `admin.trendscore.co.ke` |

One git commit produces **one tag** (`sha-<full-commit>`) for all three images.  
Schools and console share the tag family but deploy **independently**.

## Tiers

| Tier | Meaning | Auto on `main`? |
|------|---------|-----------------|
| **demo** (`kind: main`) | **Canary** — single tenant (`demoschool`) on the main stack | Yes |
| **pilot** | Early adopters (optional manifest entries) | No — Promote Release |
| **production** | Live school stacks (`kind: stack`) | No — Promote Release |

**Demo is not “all schools.”** It is one isolated instance used to verify a build before production promote.

## Standard workflow

### 1. Build (automatic)

Push to `main` → **Publish Docker Images**

- `ghcr.io/amalgamate/zawadi-frontend:sha-…`
- `ghcr.io/amalgamate/zawadi-backend:sha-…`
- `ghcr.io/amalgamate/zawadi-console:sha-…`

### 2. Canary (automatic)

**Deploy Demo (main only)** → only manifest `tier: "demo"`:

- Deploys **school app** to demoschool (main stack)
- Rolls **platform console** to the same tag (`DEPLOY_CONSOLE=true`)
- Installs `/srv/zawadi/apps/deploy/deploy-release.sh` + manifest for the admin UI

### 3. Verify (human)

Test on **https://demoschool.trendscore.co.ke** (school app, not the admin URL).

Record the tag, e.g. `sha-2113ff1…`.

### 4. Promote school app (manual)

**Promote Release** (GitHub Actions or admin → Promote Release):

| Target | What updates |
|--------|----------------|
| `demo` | Canary only |
| `pilot` | All `tier: pilot` in manifest |
| `selected_school` | One `school_id` from manifest |
| `all_schools` | All `kind: stack` in manifest + any discovered stacks |

Uses **frontend + backend** images only. Does not require console redeploy.

Each instance: backup DB → pull images → `prisma migrate deploy` → restart → health check.

### 5. Console-only update (optional)

If only the admin panel changed (no school app QA needed):

- Admin UI → **Platform console** card → **Update console**, or
- `DEPLOY_CONSOLE_ONLY=true IMAGE_TAG=sha-… bash deploy-release.sh`

Does **not** restart school stacks.

## Rules (avoid conflicts)

1. **Never** promote a tag to production schools without testing it on the canary (demo) first.
2. **Always** use the **same** `sha-…` tag for frontend and backend across all schools in one promote wave.
3. **Do not** assume “Deploy Demo” updates every school — it updates **canary + console** only.
4. **Manifest is source of truth** — `deploy/instances.manifest.json` lists production schools; discovery only adds unknown stacks on `all_schools`.
5. **Admin panel** promotes school apps via `deploy-release.sh`; it is not a fourth runtime image for schools.

## Instance manifest

Edit `deploy/instances.manifest.json` when adding a school:

```json
{
  "id": "new-school",
  "label": "New School Name",
  "tier": "production",
  "kind": "stack",
  "compose_project": "zawadi-new-school",
  "env_file": "/srv/zawadi/apps/env/.zawadi-new-school.env",
  "public_domain": "new-school.trendscore.co.ke"
}
```

## Quick reference

```bash
# School app → one production school
export DEPLOY_TARGET=school
export SCHOOL_ID=merti-cs
export IMAGE_TAG=sha-<commit>
export MANIFEST_PATH=/srv/zawadi/apps/deploy/instances.manifest.json
bash /srv/zawadi/apps/deploy/deploy-release.sh

# School app → all production stacks
export DEPLOY_TARGET=all_schools
export IMAGE_TAG=sha-<commit>
bash /srv/zawadi/apps/deploy/deploy-release.sh

# Console only
export DEPLOY_CONSOLE_ONLY=true
export IMAGE_TAG=sha-<commit>
bash /srv/zawadi/apps/deploy/deploy-release.sh
```

See also [DEPLOYMENT.md](./DEPLOYMENT.md) for GitHub Environments and CI job names.
