# TrendSCORE Platform Console — Completion Plan (self-checking)

**Created:** 19 September 2026
**Scope:** `platform-console/` plus everything it controls or depends on (`deploy/`, `scripts/deploy-release.sh`, `.github/workflows/{docker-publish,promote-release,provision-school}.yml`)
**Basis:** initial read-only code audit + 2026 research (see section 9), refreshed by a static review on 23 September 2026. Targeted local hardening edits now exist in the worktree; tests and production behavior have not been verified in this pass. Client billing design and delivery gates are tracked in [`PLATFORM_CLIENT_INVOICING_PLAN.md`](PLATFORM_CLIENT_INVOICING_PLAN.md).
**Purpose:** get the console *working without mistakes*, then grow it from a demo dashboard into the control plane of a complete, invoice-issuing, compliant business.

---

## 1. How this plan checks itself

These rules are what make it "self-checking" instead of a wish list.

- **R1. A box is ticked only with evidence.** Format: `- [x] **P1-04** Title — evidence: <PR / CI run / URL / date>`. `npm run plan:status` (task P0-06) fails if any `[x]` line has no `evidence:`.
- **R2. Red first.** Every audit finding (section 4) gets an automated check (`V-xx`, section 7) that FAILS today. A finding is closed only when its check is green in CI. No check, no closure.
- **R3. Gates are hard stops.** Each stage ends with a Gate. Do not start the next *engineering* stage until the Gate is green. Business stage (5) runs in parallel.
- **R4. Nothing reaches production except through the pipeline.** No hand-edits on the server, no console-driven shortcuts. Every production change is a PR + CI run + (for production) a named human approval.
- **R5. Three kinds of proof.** (A) automated: script/test/CI output. (B) observable: curl output or screenshot saved to `docs/evidence/`. (C) human sign-off: name + date in the task line.
- **R6. One source of truth per fact.** Tenants, domains, ports, approved contract prices and platform invoices each live in exactly one place (the central console billing store after Stage 2). School-to-parent fee invoices remain in each school's tenant. Duplicates are bugs.
- **R7. Honest UI.** If the screen says something happened, the API result proves it. No "demo mode" text on live actions, no defaulted numbers presented as real.
- **R8. Agents and tools are constrained.** AI coding agents may open PRs and run checks. They never hold production credentials, never merge to `main`, never approve production deploys. Many tools have touched this repo (`.claude`, `.codex`, `.kilo`, `.kiro`, `.verdent`, ...): the harness, not memory, is what keeps them consistent.

---

## 2. Definition of done — "Console v1.0"

The console is finished when **all** of these are true and provable:

- [ ] **A-01** No unauthenticated request returns data, source code or config. (V-01..V-03)
- [ ] **A-02** Every operator has a personal account with MFA; the role matrix is enforced by tests. (V-04..V-06)
- [ ] **A-03** The console has no root-equivalent access to the host. Production changes flow only through approved, logged pipeline runs.
- [ ] **A-04** Every destructive action needs server-side confirmation and a verified recent backup. (V-07, V-10)
- [ ] **A-05** Every number on screen traces to the database or a live probe. Zero demo data in the production bundle. (V-12)
- [ ] **A-06** The tenant registry is the only source of truth; the drift report is empty.
- [ ] **A-07** Any school can be invoiced, pay by M-Pesa, and be reconciled with zero manual database edits; ledger invariants hold. (V-20)
- [ ] **A-08** Every issued invoice carries its eTIMS reference (or is flagged in the weekly exception report); credit notes follow eTIMS rules.
- [ ] **A-09** Overdue schools go read-only per policy and are restored automatically on payment. Data is never lost or held hostage.
- [ ] **A-10** Release flow is canary -> smoke tests -> approval -> waves -> auto-rollback, proven by a game day.
- [ ] **A-11** Offsite encrypted backups exist and an automated restore drill passed within the last 7 days; RPO/RTO are measured, not guessed.
- [ ] **A-12** Legal pack in place: ODPC registration, a signed DPA with every active school, breach playbook rehearsed once.

---

## 3. Honest proposal (the short version)

1. **Order of work: Safe -> True -> Paid -> Reliable -> Scalable.** Today the console is a demo shell wired to real, dangerous controls. Fix that before adding features.
2. **Shrink the console's infrastructure powers, grow its business powers.** Standard 2026 SaaS design separates a *control plane* (tenants, plans, billing, provisioning, metering) from the *data plane* (the school app). Your console should be the control plane: it triggers and displays operations, but should not itself be root on the server.
3. **Use GitHub Actions as the execution plane.** You already have provision/promote/destroy workflows. Add Environment approvals and let the console dispatch and display them. This removes the Docker-socket-plus-privileged-chroot design.
4. **Invoicing: build a thin ledger, do not build tax integrations yet.** eTIMS is mandatory for every business, and self-integration needs KRA certification. At your invoice volume (dozens per term), issue via the KRA eTIMS portal and store the reference in the ledger. Automate only when volume justifies it (trigger in section 8).
5. **Two money flows, never mixed.** (a) TrendSCORE's own revenue from schools (this plan, Stage 3). (b) Schools' fee collection from parents (existing Tier 0 plan): must settle to each school's own paybill. TrendSCORE never holds school money.
6. **Suspension means read-only, never off.** Children's records are involved; stopping containers or deleting data is a legal and reputational risk.
7. **Your biggest business risk is one VPS.** ~15 school stacks, images, volumes and backups share one machine and one disk. A disk-full event has already interrupted migrations (see comment in `deploy-release.sh`). Offsite backups and tested restores come before growth.
8. **Price with evidence.** The console's demo plans (KES 8k-25k per month) are placeholders. Market anchors seen in research: roughly KES 30k-90k per term for full suites, plus free/low-cost entrants. Validate with real customers before publishing.

---

## 4. Decisions (defaults chosen so work is not blocked — change any of them in writing)

| ID | Decision | Default | Revisit when |
|---|---|---|---|
| D-01 | Console datastore | Postgres (own container/database, backed up offsite) | never for v1 |
| D-02 | Billing engine | Thin ledger inside the console; no ERP adoption yet | > ~100 invoices/month or an accountant requires an ERP |
| D-03 | Execution plane | GitHub Actions `workflow_dispatch` + Environment approvals; fallback: tiny host agent with a command allowlist | never use Docker socket with `--privileged`/chroot again |
| D-04 | eTIMS | Phase A: KRA portal/client + reference stored in ledger. Phase B options: certified third-party integrator, ERPNext (Navari `kenya-compliance` OSCU app), Odoo Kenya localisation (check edition), or self-certify (KRA asks for proof of 3+ technical staff) | trigger in section 8 |
| D-05 | Payments to TrendSCORE | Own paybill/till: C2B + STK push now; Ratiba autopay pilot; cards later only if asked | schools ask for cards |
| D-06 | Tenancy | Stay silo (stack per school) | trigger in section 8 |
| D-07 | Overdue policy | Reminder day +7, warning +14, read-only +30; auto-restore on payment; needs contract clause | after first term of data |
| D-08 | Pricing model | Hybrid: base per term by learner band + metered add-ons (SMS, WhatsApp, AI credits, storage, biometric devices); annual prepay discount | after price validation (P5-11) |
| D-09 | Operator auth | Personal accounts, TOTP MFA now, passkeys later | — |
| D-10 | Backup location | Encrypted, S3-compatible, region chosen after counsel review (P5-06) | — |

---

## 5. Findings register (from the audit)

Each finding must map to a closing check. `Closes with` lists the tasks; `Check` is the automated test.

| ID | Finding | Evidence | Closes with | Check |
|---|---|---|---|---|
| F-01 | Static exposure risk was reduced: only `public/` is served now. Keep the unauthenticated-file checks as regression gates. | `server.js` static middleware at end of file | P0-02, P1-01 | V-01, V-02 |
| F-02 | Console is root on host: docker.sock mount + `--privileged -v /:/host chroot`; container runs as root | `runDeployReleaseOnHost`, `deploy_console` | P1-04 | V-19 |
| F-03 | Port 3100 published on all interfaces over HTTP; `CONSOLE_COOKIE_SECURE` defaults false | README + `deploy_console` `-p` flag | P0-02, P1-02 | V-15, V-19 |
| F-04 | Login has constant-time string comparison and in-process email lockout now; shared env passwords, no MFA/personal accounts, and no revocation remain | `/api/login`, `auth-config.js` | P1-03 | V-04..V-06 |
| F-05 | Provisioning no longer accepts a DB password input or prints the admin password, but still uses `latest`, a shared initial-admin secret, and a demo-user default | `provision-school.yml` | P1-08 | V-17 |
| F-06 | Hard-coded fallback biometric encryption key in two committed files (same key for every school lacking one) | `deploy-release.sh`, `provision-school.yml` | P1-09 | V-18 |
| F-07 | Bulk controls now fail closed and direct `drop` is disabled; targeted start/stop/restart still run against Docker without server-side confirmation or backup verification | `applyInstanceAction`, `/api/controls/*` | P1-05 | V-07, V-10, V-11 |
| F-08 | Mock instance/deployment/audit/lead records and the false demo-success path were removed from the browser UI. Pricing/module data and some inferred health/storage presentation still need source-of-truth review. | `public/app.js` | P1-06 | V-12 |
| F-09 | Pricing remains sample data and edits stay in browser memory. Storage UI now shows host/Docker totals and attributed school-project volumes only; DB/uploads/backups are not separately measured. | `public/app.js`, `server.js` | P2-08, P3-* | V-12 |
| F-10 | `/api/controls/:action` now returns 501 for bulk controls until explicit targets and workflow-backed actions exist | `server.js` | P1-05 | V-11 |
| F-11 | `/api/instances/create` returns 501 without a provision script nobody supplies; compose preview uses DB password = DB name; non-school app images unverified | `server.js`, `app.js` | P1-08, P4-02 | V-17 |
| F-12 | `deploy_console` called before it is defined; two divergent copies of deploy script (`deploy/` and `scripts/`, CI ships `scripts/`) | `deploy-release.sh` | P4-01 | V-16 |
| F-13 | `imageTag` unvalidated, flows into `sed -i` on env files | `/api/deploy/promote` | P1-07 | V-08 |
| F-14 | Promote runs synchronously in one HTTP request (up to 45 min/target), no lock, no canary gate | `/api/deploy/promote` | P1-07, P4-02 | V-09 |
| F-15 | Leads: JSON file read-modify-write (races), body spread into record, client-supplied ids, plaintext PII, not backed up | `/api/leads` | P2-04 | V-14 |
| F-16 | Audit log is a mutable JSON file capped at 2000; "read-only" owner role can still edit leads and read raw logs | `pushAudit`, role checks | P1-11, P2-05 | V-13, V-06 |
| F-17 | Session countdown restarts on page reload (client-derived) | `login.js` | P1-03 | manual + unit |
| F-18 | Browser-side tenant domain overrides and guessed domains were removed; the server still has legacy overrides alongside manifest/Nginx domain resolution | `server.js`, `public/app.js` | P2-02 | V-12 |
| F-19 | Repo hygiene remains to review; console tests now exist but were not run in this audit continuation | repo | P0-07, P1-10 | V-18 |
| F-20 | Single VPS; backups on the same host/disk; disk-full has interrupted migrations | `backup_database`, script comment | P4-04, P4-05, P4-08 | V-21 |
| F-21 | Biometric processing region defaults to `ap-south-1` (Mumbai) in provisioning — children's biometric data leaving Kenya needs a legal review | `provision-school.yml` | P5-06 | manual (C) |

---

## 6. Stages and tasks

Estimates assume 1-2 engineers with AI assistance and are planning guesses, not commitments.

### Stage 0 — Safety net (week 1)

**Why first:** nothing below is safe to change without a rollback and a test harness.

- [ ] **P0-01** Tag and snapshot: tag the running console image `pre-remediation`, copy the console data dir, and prove rollback by redeploying the old tag on the demo host. Proof (B): rollback log.
- [ ] **P0-02** Emergency containment, no code changes, **do today**:
  - `curl -I https://admin.trendscore.co.ke/data/leads.store.json` (and `/data/audit.store.json`, `/server.js`, `/deploy/instances.manifest.json`). Save output. Anything but 404/401 = incident: block it at the reverse proxy immediately.
  - Stop publishing port 3100 to the world. Put the console on the same Docker network as the reverse proxy and forward to the container name. (Do not rely on UFW: Docker-published ports can bypass it.)
  - Rotate `CONSOLE_JWT_SECRET` and both console passwords; set `CONSOLE_COOKIE_SECURE=true` once HTTPS is confirmed.
  - Run `git ls-files | findstr /i env` and confirm no real secrets are tracked (note `.env.backup` at repo root).
  Proof (B): before/after curl output in `docs/evidence/`.
- [ ] **P0-03** Refactor `server.js` into `createApp({ docker, fs, env, clock })` plus modules (`auth`, `store`, `deploy`, `docker-adapter`) so tests can inject fakes and `app.listen` only runs in `main`.
- [ ] **P0-04** Build the verify harness (`platform-console/tests/`, Node built-in `node:test`). Implement every check in section 7 and commit them **failing**. Proof (A): CI run showing the expected red list.
- [ ] **P0-05** CI gate: job `console-verify` required on PRs; `docker-publish.yml` must not publish the console image unless it passes.
- [ ] **P0-06** `npm run plan:status`: parses this file, prints progress per stage, fails on `[x]` without `evidence:`.
- [ ] **P0-07** Repo controls: branch protection on `main`, CODEOWNERS for `platform-console/`, `deploy/`, `.github/workflows/`; delete confirmed-dead files (`fix.js`, `patch-appjs.js`, `patch-kanban-css.js`, unused `nginx.conf`) after checking they are unreferenced; add `.env.*` patterns to `.gitignore`.

**Gate 0:** rollback proven; harness runs in CI and shows the red list; P0-02 evidence saved; branch protection on.

### Stage 1 — Make it safe (weeks 2-3)

- [ ] **P1-01** Serve only a `public/` directory (move `index.html`, CSS, client JS). (F-01) -> V-01, V-02 green.
- [ ] **P1-02** Network and transport: no published port; HTTPS only; `trust proxy`; secure cookies enforced (startup fails in production otherwise); `helmet` with CSP and HSTS; `SameSite=Strict` kept. (F-03) -> V-15, V-19.
- [ ] **P1-03** Auth v2 (F-04, F-17): personal accounts in the DB, argon2id hashes, TOTP MFA required for owner/ops, login rate limit + lockout, server-side session table with revocation, `/api/me` returns real expiry, break-glass account stored offline. Roles: `owner`, `ops`, `finance`, `support`, `viewer`; write the permission matrix and test it table-driven (every route x every role).
- [ ] **P1-04** Remove root-equivalent access (F-02): status via a read-only docker-socket-proxy; all mutations (deploy, provision, destroy) via GitHub Actions dispatch with Environment approval; console shows run link/status; delete the `--privileged` chroot path and the raw socket mount; run the console as non-root with a read-only filesystem.
- [ ] **P1-05** Destructive-action protocol (F-07, F-10): two-step server-side challenge (typed tenant name + MFA re-auth); requires a verified backup < 24h old; remove start-all/stop-all/redeploy-all from the UI; `drop` becomes "decommission" (soft stop + archive; hard delete only after 30 days with owner approval); the console container is never a target; unknown control actions return 404; Docker errors propagate as failures.
- [ ] **P1-06** Truthful UI (F-08): delete every "demo" string on live paths; toasts and audit status come from the API result; failures are visible.
- [ ] **P1-07** Input validation and job control (F-13, F-14): `imageTag` must match `^[A-Za-z0-9._-]{1,128}$`; school ids from the registry only; one production job at a time (409 otherwise); jobs are asynchronous with status endpoint and streamed logs (no 45-minute HTTP requests).
- [ ] **P1-08** Provisioning secrets (F-05, F-11): no default passwords anywhere; per-school random credentials delivered once; nothing secret in workflow inputs or run summaries; fix the compose-preview password pattern.
- [ ] **P1-09** Biometric key (F-06): remove the hard-coded fallback; provisioning fails closed if no per-school key; inventory which existing schools use the shared key; write and rehearse a re-key migration on the demo school (back up first; do **not** just overwrite keys or existing data becomes unreadable).
- [ ] **P1-10** Secrets hygiene: `gitleaks` in CI; rotate every secret that has ever appeared in the repo or workflow logs; move console env to Docker secrets/files.
- [ ] **P1-11** Interim audit integrity (F-16): append-only hash-chained log with an offsite copy until Stage 2 moves it to the database.

**Gate 1:** V-01..V-19 green in CI; external port scan shows only 80/443 (+ SSH restricted); all secrets rotated; a written pen-test checklist run and signed (C).

### Stage 2 — Make it true (weeks 3-5)

- [ ] **P2-01** Console database + migrations + included in offsite backups (D-01).
- [ ] **P2-02** Tenant registry (F-18): `tenants` table (slug, name, tier, status, domains, compose project, ports, env-file reference, version, plan, created/archived). Import `instances.manifest.json` once, then retire the manifest, `SCHOOL_DOMAIN_OVERRIDES` (both copies) and runtime guessing.
- [ ] **P2-03** Drift report: containers with no tenant, tenants with no containers, port conflicts, version skew. Shown in UI and alerted.
- [ ] **P2-04** Leads to the DB (F-15): server-generated ids, field allowlist, optimistic concurrency, PII encrypted at rest, migrate from JSON, backed up.
- [ ] **P2-05** Audit to the DB (F-16): append-only, hash chain, actor = person, retention set with the accountant (financial events kept longest), CSV/JSON export.
- [ ] **P2-06** Real per-tenant telemetry: version, last deploy, health, disk, last backup + last verified restore, active users (7d), fee payments processed. Aggregate counts only; the console must not read school PII.
- [ ] **P2-07** Module toggles: wire to real tenant feature flags or remove them. No fake switches.
- [ ] **P2-08** Delete all demo arrays and defaulted billing values from `app.js` (F-09); every KPI reads the API.

**Gate 2:** V-12 green; drift report empty; console DB restore-tested; no hard-coded tenant data in the repo.

### Stage 3 — Make it paid: quote-to-cash (weeks 5-9)

**3A Model and rules**
 - [ ] **P3-01** Approved catalogue and contract price book: versioned entries/effective dates and tax configuration, implemented per `PLATFORM_CLIENT_INVOICING_PLAN.md`; no sample amounts presented as customer agreements.
- [ ] **P3-02** Customers linked to tenants: billing contacts, school KRA PIN, PO numbers, payment terms.
- [ ] **P3-03** Subscription engine: configurable academic-term calendar, proration, renew/cancel/pause, contract term, auto-renew, grace.
- [ ] **P3-04** Invoice ledger: statuses `draft -> issued -> paid/void`; immutable after issue; sequential numbering; line items; VAT from config with defined rounding; credit notes; PDF carrying paybill + account reference = invoice number; delivery log (email/WhatsApp).
- [ ] **P3-05** eTIMS Phase A: an invoice cannot move to `issued/sent` without eTIMS reference fields (serial/FDN, QR, control-unit number). Workflow: draft -> issue in KRA eTIMS -> paste references -> send. Weekly exception report of invoices lacking references. Credit notes must be raised from the same eTIMS solution that issued the original (per integration guidance). Tax adviser signs off the invoice template (C).
- [ ] **P3-06** Usage meters for SMS, WhatsApp, AI credits, storage, biometric devices; prepaid packs or overage; usage statements; caps and alerts so nobody gets bill shock.

**3B Payments**
- [ ] **P3-07** M-Pesa C2B on TrendSCORE's **own** shortcode (separate from schools' fee shortcodes): validation + confirmation endpoints, idempotent on transaction id, auto-allocate by account reference, unmatched-payments queue.
- [ ] **P3-08** STK push "Pay now" from the invoice link, status polling, receipts.
- [ ] **P3-09** Ratiba autopay pilot (confirm Daraja Ratiba availability on your shortcode first): bursar consent flow, failure handling.
- [ ] **P3-10** Bank/cheque receipts with attachments and CSV statement import/matching.
- [ ] **P3-11** Daily reconciliation job (provider transactions vs ledger), mismatch alerts, month-end period lock.

**3C Lifecycle and reporting**
- [ ] **P3-12** Dunning schedule and templates (SMS/email/WhatsApp), configurable, stops on payment.
- [ ] **P3-13** Read-only suspension via tenant feature flag with in-app banner (D-07); never stop containers or delete data; automatic restore on payment; manual override; needs the contract clause (P5-08).
- [ ] **P3-14** Reports: MRR/ARR, ARPA, net revenue retention, logo churn, aging buckets, collection rate, term forecast, accountant CSV, VAT summary.
- [ ] **P3-15** Ledger invariants + clock-travel term simulation (V-20).
- [ ] **P3-16** Pilot: invoice 3 schools through the system for one full term in parallel with your current method; reconcile the two; fix differences.

**Gate 3:** create school -> subscribe -> invoice -> pay in Daraja sandbox -> reconcile -> receipt, with **zero manual DB edits**; V-20 green; pilot reconciled to the shilling; accountant has reviewed exports.

### Stage 4 — Make it reliable (weeks 4-8, parallel with 2-3)

- [ ] **P4-01** One deploy script, one location (`deploy/`); CI copies it; delete the duplicate; fix the `deploy_console` ordering bug; add `shellcheck` and DRY_RUN tests with a fake `docker`. (F-12) -> V-16.
- [ ] **P4-02** Release pipeline: build -> canary (demo school) -> automated smoke suite (login, health + readiness, a fee-page render, migration status) -> Environment approval -> waves (2 pilot schools, then the rest) -> automatic rollback on failed health. "All schools at once" is never the default. (F-14)
- [ ] **P4-03** Migration policy: expand/contract, N-1 app compatibility, verified pre-migration backup, dry-run migrations on a restored copy.
- [ ] **P4-04** Offsite encrypted backups (restic/age to object storage): daily, retention (e.g. 30 days + 12 monthly), write-only credentials; include env files, console DB, registry. (F-20)
- [ ] **P4-05** Restore drills: weekly automated restore of a rotating tenant into a scratch DB with sanity checks (treat a failure as an incident); quarterly full timed drill by someone who did not write the runbook; record measured RPO/RTO.
- [ ] **P4-06** Monitoring: external uptime per tenant domain, TLS expiry, disk at 70%/85%, container restart loops, backup freshness, error rates; alerts to WhatsApp/SMS with escalation to a named person.
- [ ] **P4-07** Status page + incident process: severities, message templates, post-incident review within 5 days with owned actions.
- [ ] **P4-08** Capacity and resilience: image-prune policy, per-tenant resource limits, provider snapshots, a documented rebuild/second-server plan with triggers (section 8). SLA promises must match reality.
- [ ] **P4-09** Supply chain: pin GitHub Actions by SHA, dependency updates, image scanning, SBOM, non-root images.
- [ ] **P4-10** Runbooks for the top failures: disk full, failed migration, tenant down, DB restore, cert expired, M-Pesa callbacks failing, WhatsApp session dropped, console down, credential compromise, accidental deletion.

**Gate 4:** a game day passes: break a canary deploy on purpose and watch it auto-roll-back; restore a tenant from offsite backup within the measured RTO; alerts reach a human within 5 minutes.

### Stage 5 — Complete business layer (start week 1, run in parallel; owner: founder)

**5A Legal, tax, compliance**
- [ ] **P5-01** Facts sheet: company registration, KRA PIN, VAT status (sources disagree on the threshold, so get it confirmed), eTIMS onboarding status, income-tax regime, statutory registrations if you employ people.
- [ ] **P5-02** Retain a Kenyan tax adviser; monthly VAT/eTIMS review; VAT returns due by the 20th of the following month.
- [ ] **P5-03** Get written advice on whether schools' fee invoices/receipts to parents carry eTIMS obligations, and what the product must support. Do not assume.
- [ ] **P5-04** ODPC: register as a data processor (and tell schools they likely need controller registration); display the certificate; diarise renewal 30 days before expiry.
- [ ] **P5-05** DPA with every school: roles, sub-processor list (hosting, SMS provider, WhatsApp/Meta, AWS Rekognition, AI providers), security measures, deletion/return on exit. Default: no learner PII in AI prompts.
- [ ] **P5-06** DPIA for biometrics and children's data; counsel review of the `ap-south-1` Rekognition default (F-21); parental-consent flows for images and biometrics; retention and deletion schedule.
- [ ] **P5-07** Breach playbook: internal target to alert affected schools within 24h; controller-to-ODPC 72h; templates, contact tree, log. Rehearse once.
- [ ] **P5-08** Contract pack: MSA, order form, SLA (realistic for current infrastructure), acceptable use, overdue/suspension and termination clauses, data return on exit, e-signature process (confirm validity with your lawyer).
- [ ] **P5-09** Money guardrail: TrendSCORE does not hold school fee money; each school uses its own paybill. Get a legal check before any change that would pool funds.

**5B Go-to-market and pricing**
- [ ] **P5-10** Ideal customer profile and segments (private junior/primary CBC, secondary, school chains); pick 3 reference customers.
- [ ] **P5-11** Price validation: interview 5 customers and 5 prospects/lost deals; build a unit-economics sheet (infra per tenant, SMS/WhatsApp/AI cost, support hours); propose good/better/best + add-ons (D-08); publish price list and discount rules.
- [ ] **P5-12** Trial and onboarding offer (one-term trial? paid migration? annual prepay discount for cash flow).
- [ ] **P5-13** Console CRM: real pipeline stages, source tracking, win/loss reasons, one-click conversion into provisioning.

**5C Onboarding, success, support**
- [ ] **P5-14** Onboarding runbook and checklist with a target go-live time; import templates; training sessions; signed go-live sign-off.
- [ ] **P5-15** Customer health score (logins, fee-module use, invoices sent, parent-portal adoption); alerts on decline; renewal reminders 60/30/7 days before term start.
- [ ] **P5-16** Support: channels (WhatsApp Business, email, phone), response targets by plan, ticket tool, knowledge base, escalation to engineering, satisfaction survey.

**5D Finance and operating cadence**
- [ ] **P5-17** Monthly close checklist: invoices vs eTIMS references, reconciliation, VAT return, aging review, cash forecast (revenue is lumpy around term starts, so hold a reserve).
- [ ] **P5-18** Weekly metrics pack: MRR, collections, churn, uptime, incidents, restore-drill status, backlog.
- [ ] **P5-19** Operating model: roles/RACI, decision log, on-duty rota, written rules for AI agents (see R8).

**Gate 5:** A-12 satisfied; price list published; first pilot school invoiced and paid through the ledger; first restore drill and breach rehearsal logged.

### Stage 6 — Scale (do not build until a trigger fires; see section 8)

- [ ] **P6-01** eTIMS automation (Phase B)
- [ ] **P6-02** Pooled/bridge tenancy for small schools
- [ ] **P6-03** Second server / warm standby / second region
- [ ] **P6-04** Formal security certification (ISO 27001-style) if selling to chains or government
- [ ] **P6-05** Reseller/partner tooling

---

## 7. Verify harness — checks to write in P0-04 (all red at first)

| ID | Assertion |
|---|---|
| V-01 | Unauthenticated `GET /data/leads.store.json`, `/data/audit.store.json`, `/data/deployments.store.json` -> 404 |
| V-02 | Unauthenticated `GET /server.js`, `/auth-config.js`, `/package.json`, `/deploy/instances.manifest.json` -> 404 |
| V-03 | Every `/api/*` route except login/health -> 401 without a session |
| V-04 | N failed logins -> 429/lockout; success path unaffected |
| V-05 | Password verification uses constant-time comparison on hashes (unit test) |
| V-06 | Role matrix: every route x every role returns exactly what the matrix says (table-driven) |
| V-07 | Destructive endpoints reject requests lacking a valid server-issued confirmation token |
| V-08 | `imageTag` outside `^[A-Za-z0-9._-]{1,128}$` -> 400 |
| V-09 | Second concurrent production job -> 409 |
| V-10 | Bulk/destructive actions never include the console's own container |
| V-11 | A failed Docker/pipeline operation returns non-2xx and writes an audit row with status Failed |
| V-12 | Production bundle contains no demo data or "demo mode" strings; no hard-coded tenant domains |
| V-13 | Audit chain verifies end-to-end; tampering is detected |
| V-14 | Lead create/update rejects unknown fields and client-supplied ids |
| V-15 | Production startup fails without secure cookie, HTTPS-only config, or a secret of at least 32 bytes |
| V-16 | Deploy script passes `bash -n` + `shellcheck`; DRY_RUN console-only path exits 0 |
| V-17 | Workflows/scripts contain no default passwords and print no secrets |
| V-18 | Secret scan (gitleaks) clean; no hard-coded 64-hex keys |
| V-19 | No `--privileged`, raw docker.sock mount, or `-p 3100:3100` on all interfaces in console deployment |
| V-20 | Ledger invariants: allocations never exceed invoices; issued invoices immutable; every payment has a provider transaction id; replaying the ledger reproduces balances; term simulation passes |
| V-21 | Latest offsite backup is younger than 26h and the last restore drill is younger than 7 days |

---

## 8. Scale triggers (research-informed; adjust with real data)

| Trigger | Action |
|---|---|
| > ~100 invoices/month, or an accountant/enterprise buyer demands system-to-system | Start eTIMS Phase B (P6-01) |
| > ~30 tenants, or disk > 70% sustained, or deploy waves take > 1 hour | Design bridge tenancy (shared compute, per-tenant DB) and second server |
| A customer requires data residency, own keys, or a security review | Offer silo tier at a price that covers it |
| Chains, government or IFMIS-linked buyers | Pursue formal certification (P6-04) |

---

## 9. Research notes and caveats

Research was done on 19 September 2026. Source quality varies (regulator and law-firm pages are stronger than vendor blogs). **Kenyan tax figures conflict between sources** (VAT registration threshold KES 5m vs 8m; turnover-tax rate; eTIMS penalty amounts; ODPC registration thresholds). This plan only relies on points that agree across sources and marks everything else "confirm with adviser".

Points that are consistent and relied on:
- eTIMS is mandatory for every person carrying on business (not only VAT-registered) since 1 Jan 2024; expenses without valid eTIMS invoices are non-deductible; KRA is moving to income/expense validation from 2026.
- System-to-system integration uses OSCU (online) or VSCU (bulk/offline); self-integrators and third-party vendors must be certified by KRA.
- Daraja exposes STK push, C2B, B2C and Ratiba (standing orders).
- ODPC registration is mandatory for eligible controllers/processors; schools are named in its 2026 enforcement notice; a school was fined KES 4.55m for posting minors' images without parental consent (2023).
- The Docker socket is root-equivalent; prefer a filtered socket proxy and bind admin interfaces to loopback or an internal network.
- Small teams should prove restores with automated scratch-DB restores and periodic timed drills.
- 2026 SaaS pricing has moved toward hybrid (base subscription plus usage/credits) instead of pure per-seat.

Sources consulted:
- KRA eTIMS: https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration ; https://etims.kra.go.ke/main/signup/indexLearnMore ; https://www.kra.go.ke/images/publications/OSCU_VSCU_Step-by-Step_Guide-on-how-to-sign-up.pdf
- KPMG Kenya eTIMS validation note: https://assets.kpmg.com/content/dam/kpmgsites/ke/pdf/thought_leaderships/tax/2026/eTIMS.pdf.coredownload.inline.pdf
- ERPNext OSCU app: https://github.com/navariltd/kenya-compliance ; Odoo Kenya localisation: https://www.odoo.com/documentation/18.0/applications/finance/fiscal_localizations/kenya.html
- Safaricom Ratiba: https://www.safaricom.co.ke/media-center-landing/press-releases/safaricom-rolls-out-a-standing-order-feature-for-m-pesa-users
- ODPC notice: https://www.kenyans.co.ke/news/123982-odpc-directs-entities-handling-peoples-data-register-or-face-ksh5-million-fine ; school fine: https://www.clydeco.com/en/insights/2023/10/data-protection-compliance-in-kenya-odpc
- Docker socket: https://dev.to/byte-guard/docker-security-best-practices-for-self-hosters-in-2026-35k3 ; https://github.com/tecnativa/docker-socket-proxy
- Market pricing: https://nitsolutions.co.ke/blog/2025/12/30/school-management-system-cost/ ; https://www.jibusms.com/school-management-software-pricing
- Pricing trends: https://blog.mean.ceo/saas-pricing-strategies-trends-september-2026/
- Restore drills: https://dev.to/moose978/disaster-recovery-and-backups-11l5

---

## 10. Weekly rhythm (keeps the plan honest)

| Day | Ritual | Output |
|---|---|---|
| Mon | Run `plan:status`, review metrics pack | Updated boxes with evidence; top 3 priorities |
| Wed | Release window (canary -> approval -> waves) | Release notes in audit log |
| Fri | Restore-check + backup freshness + open incidents review | V-21 green or an incident opened |
| Monthly | Close checklist (P5-17) | Reconciled books, VAT filed |
| Quarterly | Full restore drill, DR contact review, access review, plan revision | Signed drill report |

## 11. Change log

- **19 Sep 2026** — Initial plan created from the console audit and 2026 research.
