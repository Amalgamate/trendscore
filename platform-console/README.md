# TrendScore Platform Console

Standalone control panel for the TrendScore SaaS platform.

## Running with Auth (Recommended)

The console now ships with a lightweight Express auth server. Install dependencies once:

```bash
cd platform-console
npm install
```

Then start it (the npm script enables Node's SQLite runtime for the central billing store):

```bash
npm start
```

Use Node.js 22.5 or newer. The platform billing registry is stored in
`CONSOLE_DATA_DIR/platform-billing.sqlite`; production deployment mounts
`/app/data` to the console's persistent host data directory.

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
CONSOLE_FINANCE_APPROVER_EMAIL=finance@example.com
CONSOLE_FINANCE_APPROVER_PASSWORD=replace-with-a-strong-password
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
- Finance Approver: billing and logs access; can approve flagged quote discounts but cannot create or issue billing records

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
- Convert approved contract terms into reviewed draft invoices, then add PDF/email delivery after accounting and eTIMS decisions are signed off

## Billing operations and integrations

- Agent commission defaults to 25% of each payment on the school's first paid invoice, including installments, then 10% of later school payments. Super admins can set different first and recurring rates per agent. Payments attribute by lead, tenant key, or a unique exact school-name match; ambiguous fuzzy matches are not auto-credited.
- An unassigned CRM lead can be linked to an active agent with **Assign agent**. This creates the agent-school portfolio link used by CRM status sync and commission attribution.
- **Record Manual Payout** is bookkeeping for money already sent outside this console. It requires a receipt reference and explicit confirmation; it does not transfer funds. Real agent withdrawals use the separate Daraja B2C endpoint and remain pending until Safaricom confirms the result.
- Lead conversion in **Leads & CRM** records the customer approver, acceptance method, and an evidence reference. It creates the billing customer, active termly contract with saved price lines, accepted quote, and an unissued draft onboarding invoice.
- Provisioning script is included in the console image at `/app/scripts/provision-instance.sh`. Set `CONSOLE_INSTANCE_PROVISION_SCRIPT=/app/scripts/provision-instance.sh` in the console environment to enable the provisioning endpoint. The endpoint remains disabled when that variable is absent.
- In **Billing → Customers**, select a configured school term and prepare renewal draft invoices from active contracts. The **Automatic term renewal drafts** switch is off by default; when enabled, the console checks configured term billing dates daily. It creates drafts only. Admins still review, issue, and email each invoice.
- In **Billing → Customers**, set each school's canonical **Paybill account name** and give the school that exact name to enter in the Paybill account field. Do not ask schools to enter invoice numbers. Daraja C2B callbacks can be registered after the server has an acquired shortcode, valid credentials, and a public HTTPS callback URL. Set `MPESA_DARAJA_ENV` (`sandbox` or `production`), `MPESA_DARAJA_CONSUMER_KEY`, `MPESA_DARAJA_CONSUMER_SECRET`, `MPESA_DARAJA_SHORTCODE`, `MPESA_DARAJA_CALLBACK_BASE_URL`, and a long random `MPESA_DARAJA_CALLBACK_TOKEN`. There is no shortcode default; C2B remains unconfigured until the real Paybill is supplied. The admin registration action registers callbacks and enables C2B. A receipt auto-allocates only when its school account name matches one customer and that customer has exactly one outstanding issued invoice; unmatched, ambiguous, multiple-invoice, or excess payments appear in the review queue.
- Agent withdrawals use Daraja B2C and are recorded as pending until a provider result callback confirms success or failure. Configure `MPESA_DARAJA_INITIATOR_NAME`, a Safaricom-encrypted `MPESA_DARAJA_SECURITY_CREDENTIAL`, and the HTTPS callback settings above. B2C is disabled until the operator explicitly sets `MPESA_B2C_ENABLED=true`. Test in sandbox before configuring production credentials.
- Provider credentials and callback URL tokens belong in the protected console environment file, never in the browser or repository. The console shows readiness without exposing secret values.
