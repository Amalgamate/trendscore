# Zawadi Platform Console

Standalone control panel for the Zawadi SaaS platform.

## Running with Auth (Recommended)

The console now ships with a lightweight Express auth server. Install dependencies once:

```bash
cd platform-console
npm install
```

Then start it:

```bash
node server.js
```

Open: **http://localhost:3100**

The login overlay will appear over the blurred dashboard.

### Auth environment

Create a local `.env` file or pass these environment variables when starting the server:

```bash
CONSOLE_JWT_SECRET=replace-with-a-long-random-secret
CONSOLE_SUPER_ADMIN_EMAIL=admin@example.com
CONSOLE_SUPER_ADMIN_PASSWORD=replace-with-a-strong-password
CONSOLE_PLATFORM_OWNER_EMAIL=owner@example.com
CONSOLE_PLATFORM_OWNER_PASSWORD=replace-with-a-strong-password
CONSOLE_JWT_EXPIRES_IN=8h
CONSOLE_COOKIE_SECURE=false
```

Do not commit real console passwords or JWT secrets to GitHub.

### Session behaviour
- JWT stored in an httpOnly cookie (not accessible via JS)
- Sessions expire after 8 hours
- On reload, the page silently checks `/api/me` — if the cookie is still valid, login is skipped
- Super Admin: full access to all sections including Controls
- Platform Owner: read-only access; Controls section is locked

---

## Running with Docker

```bash
docker build -t zawadi-console:local .
docker run --rm --env-file .env -p 3100:3100 zawadi-console:local
```

---

## Live Deployment

The GitHub workflow builds `ghcr.io/amalgamate/zawadi-console:latest`.
The deployment script runs it on port `3100` using this server-side env file:

```bash
/srv/zawadi/apps/.env.console
```

Point `admin.trendscore.co.ke` via NGINX Proxy Manager when ready:

```
Forward host: 185.127.16.124
Forward port: 3100
Scheme: http
```

After HTTPS is enabled in NGINX Proxy Manager, set `CONSOLE_COOKIE_SECURE=true`
in `/srv/zawadi/apps/.env.console`.

Promote Release assets (updated by CI on each deploy):

```bash
/srv/zawadi/apps/deploy/deploy-release.sh
/srv/zawadi/apps/deploy/instances.manifest.json
```

---

## File structure

```
platform-console/
  server.js        ← Express auth server (JWT + cookie)
  auth-config.js   ← Reads users, roles, JWT secret from env vars
  login.js         ← Client-side login overlay logic
  login.css        ← Glass overlay styles
  index.html       ← Console shell + login overlay markup
  styles.css       ← Dashboard styles
  app.js           ← Dashboard data + navigation logic
```

## Next Phase

- Replace demo data with a live console backend API
- Connect Docker status, real storage metrics, deploy history
- Audited start, stop, restart, backup, redeploy controls
- NGINX Proxy Manager at admin.trendscore.co.ke
