# TrendScore — Codebase Index

A structural map of the repository. Use this to orient yourself before diving into code.

> **What it is:** TrendScore is a **CBE-ready School ERP for modern African schools** (Kenyan focus) — academics, CBE assessment, fees & M-Pesa, finance, HR, communication, operations, approvals/governance, and analytics from one platform.
>
> Website: https://www.trendscore.co.ke/ · Managed by Amalgamate.

---

## 1. Repository Shape

Monorepo with two first-class apps plus deployment plumbing.

| Path | Role |
| --- | --- |
| `src/` | **React frontend** — School ERP UI (Vite + React 18 + Tailwind + Zustand). |
| `server/` | **Backend API** — Express + TypeScript + Prisma ORM, PostgreSQL. |
| `public/` | Static assets, service worker, web manifest. |
| `deploy/` | Deployment docs + `instances.manifest.json` (per-school targets). |
| `.github/workflows/` | CI, Docker publishing, school-instance promotion. |
| `scripts/` | Build/CI helpers, icon generation, demo seeding. |
| `platform-console/` | Separate platform-level console (secondary). |
| `assets/`, `data/`, `backups/`, `tmp/` | Local-only / generated artifacts (see `.gitignore`). |

Top-level docs of note: `README.md`, `PARENT_PORTAL_*.md`, `MOBILESASA_*.md`, `TIMETABLE_PDF_EXPORT.md`, `AUDIT_MOBILESASA_SMS_INTEGRATION_READINESS.md`.

---

## 2. Tech Stack

**Frontend** (`package.json`)
- React 18, Vite 8, React Router 6 (`HashRouter`)
- State: **Zustand** stores (`src/store/`), React Context (`src/contexts/`)
- UI: **Tailwind CSS** + Radix UI primitives + Lucide icons + `class-variance-authority`
- Charts: **recharts** · Calendar: `react-big-calendar`, `react-day-picker`
- Realtime: **socket.io-client** · Payments/comms: axios
- Doc/media: `jspdf`, `html2canvas`, `pdfjs-dist`, `exceljs`, `mammoth`, `qrcode.react`
- Tests: **Vitest** + Testing Library

**Backend** (`server/package.json`)
- Node.js, **Express**, **TypeScript**
- **Prisma ORM** on PostgreSQL
- Realtime: **Socket.io**
- Payments: M-Pesa/Daraja (+ IntaSend, KopoKopo resolvers)
- Comms: Email (Resend), SMS (MobileSMSA), WhatsApp
- Media: Cloudinary · Caching: Redis-ready (dev fallback)
- Tests: **Jest**

---

## 3. Frontend Map (`src/`)

### Entry & shell
- `index.jsx` — React root.
- `App.jsx` — top-level: `HashRouter`, auth gating, branding/CSS-variable theming, session-lifecycle (inactivity logout + force-logout polling), splash screen, lazy routes.
- `components/common/SplashScreen.jsx` — boots and pre-loads data before revealing the app.
- `components/CBCGrading/CBCGradingSystem.jsx` — **the authenticated app shell** (layout + routing for everything under `/app/*`).

> Note: despite the "CBCGrading" folder name, this is the **entire ERP shell**, not just grading.

### Routing & pages
- `components/CBCGrading/layout/PageRouter.jsx` — central page registry; maps route keys → lazy-loaded page components.
- `components/CBCGrading/pages/` — **all ERP pages** live here, organized as flat files plus subfolders by module (see §5).

### Layout
`components/CBCGrading/layout/`: `Header.jsx`, `Sidebar.jsx`, `MobileAppShell.jsx`, `PageRouter.jsx`, `CommandPalette.jsx`, `GlobalModals.jsx`, `MobilePortalAppBar.jsx`, `HorizontalSubmenu.jsx`, plus notification/fee/git popups.

### State management
- **Zustand** (`src/store/`): `useAuthStore`, `useBootstrapStore`, `useUIStore`, `useSubjectStore`.
- **Context** (`src/contexts/`): `AuthContext`, `SchoolDataContext`, `FeeActionsContext`, `UserNotificationContext`, `ChatContext`, `RolePreviewContext`.
- **Hooks** (`src/hooks/`): `useAuth`, `useApi`, `usePermissions`, `useSubdomain`, `useMobileDetection`, `usePWAInstall`, `useTeacherContext`, `useSummativeTestForm`, etc.

### Services / API
- `src/services/api/` — axios instance + endpoint modules.
- `src/services/classAPI.js`, `schoolContext.js`, `supportApi.js`, `intelligence/` (academic-intelligence client).
- `src/utils/` — `cbeGrading.js`, `sessionLifecycle.js`, `brandingUtils.js`, `simplePdfGenerator.js`, `feeTemplateGenerator.js`, `grading/`, `validation/`.

### Design system & UI primitives
- `src/components/ui/` — Radix-based primitives (button, dialog, select, tabs, table, calendar, popover, dropdown-menu, etc.).
- `src/design-system/` — tokens / theming layer.
- `src/index.css` — Tailwind + brand CSS variables (driven dynamically from `/schools/public/branding`).

### Config
`src/config/`: `permissions.js` (roles + permissions + hierarchy), `productIdentity.js` (brand name handling), `learningAreasConfig.json`, `secondaryNav.js`, `tertiaryNav.js`.

### Roles (from `src/config/permissions.js`)
`SUPER_ADMIN · ADMIN · HEAD_TEACHER · HEAD_OF_CURRICULUM · TEACHER · ACCOUNTANT · RECEPTIONIST · PARENT · STUDENT`
Role-based dashboards: `components/CBCGrading/dashboard/widgets/{admin,headteacher,teacher,accountant,parent,student}/`, configured via `dashboard/configs/RoleDashboardConfig.ts` + `dashboard/WidgetRegistry.ts`.

---

## 4. Backend Map (`server/`)

### Entry & bootstrap
- `src/index.ts` — process entry (env, DB connect, server start).
- `src/server.ts` — Express app: request-id, pino logging, helmet, CORS, rate limit, response sanitization, body parsers, mounts `/api` routes.
- `src/cron-worker.ts` — scheduled jobs (pledge reminders, etc.).
- **Institution context pipeline** (key concept): `schoolContext.middleware.ts` → `institutionContextResolver.middleware.ts` populate `req.school` and `req.resolvedInstitutionType` for all downstream routes.

### Route registration — `src/routes/index.ts`
Public: `/health`, `/auth`, `/onboarding`, `/books`, `/library`, `/schools`, `/biometric`, `/mpesa`, `/auth/csrf`.
Protected (after `authenticate`): `/admin`, `/users`, `/learners`, `/classes`, `/attendance`, `/assessments`, `/reports`, `/fees`, `/cbc`, `/grading`, `/config`, `/learning-areas`, `/pathways`, `/senior-pathways`, `/workflow`, `/approvals`, `/approval-workflows`, `/dashboard`, `/documents`, `/planner`, `/duty-rosters`, `/schemes`, `/backup`, `/hr`, `/accounting`, `/finance`, `/inventory`, `/subject-assignments`, `/communication`, `/notices`, `/pdf`, `/id-templates`, `/transport`, `/lms`, `/secondary`, `/tertiary`, `/teacher`, `/ai`, `/chat`, `/git-notifications`, `/diagnostics`, `/migrations`, and more.

> Module gating is enforced by `requireApp('<app-id>')` (feature flags) and `requireInstitutionType('SECONDARY' | 'TERTIARY')`.

### Layered structure (`server/src/`)
- `controllers/` — request handlers (one per domain, ~60 files).
- `routes/` — Express routers (mirrors controllers).
- `services/` — business logic & data access (the bulk of behavior; ~60 files).
- `middleware/` — auth, CSRF, rate limiting, permissions, school/institution context, upload, validation, trial guard, subscription, workflow authorization.
- `validators/`, `types/`, `contracts/` — request validation + shared types/API contracts.
- `templates/` — email/document templates.
- `utils/`, `config/`, `scripts/`, `tools/` — helpers.
- `__tests__/`, `tests/` — Jest tests (incl. `cbe-grading.util.spec.ts`).

### Notable services
Payments: `mpesa.service.ts`, `daraja.service.ts`, `payment-resolver.service.ts`, `intasend.service.ts`, `kopokopo.service.ts`.
Comms: `email.service.ts`, `email-resend.service.ts`, `sms.service.ts`, `whatsapp.service.ts`, `notification.service.ts`.
Assessment: `grading.service.ts`, `calculation.service.ts`, `performance.service.ts`, `report.service.ts`.
Pathways: `pathway-*.service.ts`, `senior-pathway-*.service.ts`.
Governance: `approvalEngine.service.ts`, `workflow.service.ts`, `audit.service.ts`.
Platform: `school-provisioning.service.ts`, `school-deletion.service.ts`, `subdomain.service.ts`.

---

## 5. Domain Modules (cross-cutting frontend ↔ backend ↔ DB)

| Module | Frontend (`components/CBCGrading/pages/…`) | Backend |
| --- | --- | --- |
| **Dashboard** | `dashboard/`, `Dashboard.jsx` | `dashboard.controller.ts` |
| **Learners & admissions** | `AdmissionsPage`, `LearnersList`, `TransfersInPage`, `TransferOutPage`, `ExitedLearnersPage`, `PromotionPage`, `profiles/` | `learner.controller.ts`, `admissionNumber.service.ts` |
| **Academics / CBE** | `FormativeAssessment`, `SummativeAssessment*`, `SummativeTests*`, `LearningAreasManagement`, `PerformanceScale`, `CoreCompetenciesAssessment`, `ValuesAssessment`, `CoCurricularActivities` | `assessmentController.ts`, `cbcController.ts`, `grading.controller.ts`, `grading.service.ts` |
| **Reports** | `reports/`, `TermlyReport`, `FormativeReport`, `SummativeReport`, `CustomReportsPage`, `ProgressReports` | `reportController.ts`, `report.service.ts`, `pdf.service.ts` |
| **Fees & payments** | `fees/`, `FeeCollectionPage`, `FeeStructurePage`, `FeeTypesPage`, `FeeReportsPage`, `RecordPaymentPage`, `StudentStatementsPage`, `WaiversPage`, `InvoiceDetailPage` | `fee.controller.ts`, `fee.service.ts`, `payment.controller.ts`, `mpesa.controller.ts` |
| **Accounting** | `accounting/` | `accounting.controller.ts`, `accounting.service.ts` |
| **HR & payroll** | `hr/`, `TeachersList`, `AddEditTeacherPage` | `hr.controller.ts`, `hr.service.ts`, `staffId.service.ts` |
| **Attendance** | `attendance/`, `DailyAttendanceAPI`, `AttendanceReports` | `attendance.controller.ts`, `biometric.controller.ts` |
| **Planner & timetable** | `planner/`, `TimetablePage`, `AnnualPlannerPage`, `DutyRosterPage` | `planner.controller.ts`, `dutyRoster.controller.ts` |
| **Transport** | `transport/` | `transport.controller.ts` |
| **Inventory & assets** | `ClassInventoryTab`, `InventoryList`, `FacilityManager`, `UniformAllocationPage` | `inventory.controller.ts` |
| **Library** | `library/` | `library.controller.ts`, `libraryAutomation.controller.ts` |
| **LMS / Learning Hub** | `lms/`, `LearningHubPage`, `LMSManager`, `CourseManager`, `ContentLibrary` | `lms.controller.ts`, `lms.service.ts` |
| **Communication** | `MessagesPage`, `NoticesPage`, `BroadcastMessagesPage`, `MessageHistoryPage`, `layout/MobileCommunicationCenter.jsx` | `communication.controller.ts`, `notice.controller.ts`, `broadcast.controller.ts`, `chat.controller.ts` |
| **Approvals & governance** | `ApprovalsPage/` | `approval.controller.ts`, `approvalWorkflow.controller.ts`, `approvalEngine.service.ts`, `workflow.service.ts` |
| **Academic Intelligence** | `academic-intelligence/` | `ai.controller.ts`, `insights.service.ts`, `pathwayRecommendation.controller.ts` |
| **Secondary / Senior pathways** | `secondary/` | `secondary.controller.ts`, `seniorPathway.controller.ts`, `pathway.controller.ts` |
| **Parent Portal** | `parent-portal/`, `parent/` | `parent.service.ts`, `studentAccount.service.ts` |
| **Student Portal** | `student/` | — |
| **Settings / Admin** | `settings/`, `SystemMaintenancePage`, `SystemControlPage`, `DocumentCenter`, `IDPrintingPage` | `school.controller.ts`, `admin.controller.ts`, `config.controller.ts`, `setupController.ts`, `systemLogs.controller.ts`, `backup.controller.ts` |
| **Tertiary** | (tertiary nav foundations) | `tertiary.controller.ts` |
| **Support** | `SupportHub`, `KnowledgeBase` | `support.controller.ts` |

---

## 6. Data Model (Prisma — `server/prisma/schema.prisma`)

~3800 lines, **~110 models** + ~90 enums. Core clusters:

- **Identity & org:** `User`, `School`, `App`, `SchoolAppConfig`, `AppAuditLog`, `AdmissionSequence`, `StaffSequence`.
- **Academic structure:** `Class`, `Stream`, `ClassSchedule`, `ClassFacility`, `ClassEnrollment`, `LearningArea`, `OfficialLearningArea`, `LearningAreaAlias`, `SubjectCategory`, `SubjectAssignment`, `SubjectCombinationRule*`, `TermConfig`, `AggregationConfig`, `ScaleGroup`, `GradingSystem`, `GradingRange`, `StreamConfig`, `MeanGrade`.
- **Learners & pathways:** `Learner`, `Pathway`, `PathwayTrack`, `LearnerPathwaySelection*`, `PathwayApproval`, `PathwaySelectionHistory`, `LearnerSubjectSelection`, `SchoolLearningAreaOffering`.
- **Assessment:** `FormativeAssessment`, `SummativeTest`, `SummativeResult`, `SummativeResultHistory`, `CoreCompetency`, `ValuesAssessment`, `CoCurricularActivity`, `TermlyReportComment`, `ChangeHistory`, `AssessmentSmsAudit`.
- **Fees & finance:** `FeeType`, `FeeStructure`, `FeeStructureItem`, `FeeInvoice`, `FeeInvoiceRevision`, `FeeNumberSequence`, `FeePayment`, `FeeWaiver`, `FeePledge`, `FeeComment`, `LearnerFeeConfiguration`, `MpesaTransaction`, `MpesaCallback`, `UnmatchedPayment`; accounting: `Account`, `Journal`, `JournalEntry`, `JournalItem`, `FiscalYear`, `Vendor`, `Expense`, `BankStatement`, `BankStatementLine`.
- **HR:** `LeaveType`, `LeaveRequest`, `PayrollRecord`, `StaffAllowance`, `StaffDeduction`, `StaffAttendanceLog`, `StaffAttendanceAttemptLog`, `StaffDocument`, `PerformanceReview`.
- **Comms:** `Message`, `MessageReceipt`, `BroadcastCampaign`, `BroadcastRecipient`, `SmsDeliveryLog`, `CommunicationConfig`, `Conversation`, `ConversationParticipant`, `ChatMessage`, `ChatMessageReaction`, `UserNotification`, `PushSubscription`.
- **Operations:** `Attendance`, `Event`, `ContactGroup`, `InventoryCategory/Store/Item`, `StockMovement`, `StockRequisition*`, `FixedAsset`, `AssetAssignment`, `Book`, `BookCopy`, `LibraryMember`, `BookLoan`, `Fine`, `TransportVehicle/Route/Assignment`, `DutyRoster`, `DutyRosterAssignment`, `DutyNotificationLog`, `BiometricDevice/Credential/Log`.
- **Content & LMS:** `LMSCourse`, `LMSContent`, `LMSEnrollment`, `LMSProgress`, `AIGeneratedContent`, `SchemeOfWork`, `SchemeOfWorkWeek`.
- **Docs & ops:** `Document`, `IDCardTemplate`, `AuditLog`, `SystemChangelog`, `SupportTicket`, `SupportMessage`.
- **Tertiary:** `TertiaryDepartment`, `TertiaryProgram`, `TertiaryUnit`, `UnitEnrollment`, `UnitResult`.
- **Governance:** `ApprovalWorkflow`, `ApprovalStep`, `ApprovalRequest`, `ApprovalAction`.

Seeders/migrations live in `server/prisma/` (`seed.ts`, `seed-*.ts`, `migrations/`).

---

## 7. Cross-Cutting Concerns & Patterns

- **Multi-school / multi-tenant:** every request resolves `req.school` + `req.resolvedInstitutionType`; data is school-scoped; subdomain support via `subdomain.service.ts` + `subdomain.middleware.ts`.
- **Module gating:** `requireApp('<app-id>')` feature flags + `requireInstitutionType(...)` gate routes by school type (PRIMARY / SECONDARY / TERTIARY).
- **RBAC:** roles + permission constants mirrored between `src/config/permissions.js` (FE) and `permissions.middleware.ts` (BE); enforced via `components/common/ProtectedRoute.jsx`, `Can.jsx`, `PermissionGuards.jsx`.
- **Branding:** frontend fetches `/schools/public/branding` and injects CSS variables (`--brand-primary`, etc.) + favicon/manifest at runtime.
- **Session lifecycle:** `src/utils/sessionLifecycle.js` — 30-min inactivity logout + server-side force-logout polling.
- **Approvals/governance:** central approval engine for sensitive actions (e.g., score unlock after lock); audit trail via `AuditLog` + `audit.service.ts`.
- **CBE grading correctness:** status-only results (absent/transferred/withdrawn/exempt) excluded from averages/ranking/analytics.

---

## 8. Common Workflows

| Task | How |
| --- | --- |
| Install (frontend) | `npm install` |
| Install (backend) | `cd server && npm install && npx prisma generate` |
| Run both dev servers | `npm run dev` (concurrently runs backend + Vite) |
| Fast dev (skip bootstrap/demo users) | `npm run dev:fast` |
| Build frontend | `npm run build` (writes build version + `vite build`) |
| Backend typecheck | `cd server && npx tsc --noEmit` |
| Validate schema | `cd server && npx prisma validate` |
| Run migrations | `cd server && npx prisma migrate deploy` |
| Seed demo users | `npm run seed:demo` |
| UI tests | `npm run test:ui` (Vitest) |
| Backend tests | `cd server && npx jest` (e.g., `cbe-grading.util.spec.ts`) |
| Lint / format | `npm run lint[:fix]`, `npm run format` |
| Free dev ports | `npm run kill-ports` (kills 3000/3001/3002/5000) |

---

## 9. Deployment

TrendScore ships as a **multi-tenant, per-school deployment** of the same Docker images, run on a single host VM via Docker Compose. Each school is an isolated stack with its own Postgres, Redis, backend, frontend, env file, ports, and secrets — they share only the VM host, the reverse proxy (Nginx), and the published images.

### 9.1 Three GitHub workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | every `push` + `pull_request` | Quality gate: frontend build; backend prisma validate/generate/migrate + typecheck + lint + tests (spins up Postgres 15 service). |
| `docker-publish.yml` | `push` to `main`, `v*.*.*` tags, manual | **Publishes images only.** Builds & pushes `zawadi-frontend`, `zawadi-backend`, `zawadi-console` to `ghcr.io/amalgamate/` tagged `latest` + `sha-<commit>` (+ `v*.*.*` for tags). **Does NOT deploy schools.** |
| `promote-release.yml` | manual (`workflow_dispatch`) | **Deploys one school.** Inputs: `school_slug`, `environment` (`demo`/`pilot`/`production`), `branch`. Validates → SSHes to server → runs `deploy-release.sh`. |

### 9.2 Images (GHCR)

- `ghcr.io/amalgamate/zawadi-frontend` — built from `Dockerfile` (nginx-served React bundle).
- `ghcr.io/amalgamate/zawadi-backend` — built from `server/Dockerfile` (Node/Express + Prisma).
- `ghcr.io/amalgamate/zawadi-console` — platform console (from `platform-console/Dockerfile`), separate deploy path.
- Tagging strategy pins FE + BE together via `sha-<commit>` so both stay aligned.

### 9.3 School registry — `deploy/instances.manifest.json`

The **single source of truth** for deployment targets. No school list is hardcoded in workflow YAML — validation reads from this file.

**Current instances (as of manifest):**
| id | label | tier | kind | compose_project | domain |
| --- | --- | --- | --- | --- | --- |
| `demo` | Canary — Demo School | demo | stack | `zawadi-demoschool` | demoschool.trendscore.co.ke |
| `ighs` | IGHS | production | stack | `ighs` | ighs.trendscore.co.ke |
| `jrn` | JRN — Zawadi | production | main | `zawadijrn` | zawadi.trendscore.co.ke |
| `kambigarba-cs` | Kambi Garba CS | production | stack | `zawadi-kambigarba-cs` | kambigarba-cs.trendscore.co.ke |
| `lionscomplex` | Lions Complex | production | stack | `zawadi-lions-complex` | lionscomplex.trendscore.co.ke |
| `mck` | MCK | production | stack | `mck` | mck.trendscore.co.ke |
| `merti-cs` | Merti Complex School | production | stack | `mertics` | merti-cs.trendscore.co.ke |
| `waso-cs` | Waso CS | production | stack | `zawadi-waso-cs` | waso-cs.trendscore.co.ke |

**Key field semantics:**
- `kind: "main"` (only `jrn`) → deploys into the shared `zawadijrn` stack at `/srv/zawadi/apps/zawadijrn`; also publishes the built static bundle to nginx.
- `kind: "stack"` → deploys as an isolated Docker Compose project using `deploy/portainer/docker-compose.stack.yml`.
- `tier` maps to environment (demo/pilot/production) and selects the GitHub **Environment** approval gate.
- `active: false` OR `deployment_allowed: false` → blocks deployment.
- `aliases` → operator-friendly typed slugs (e.g. `lions-complex` for id `lionscomplex`).
- `discovery.enabled` → for `all_schools` runs, unknown running school stacks are auto-merged (manifest entries always win).

**To add a school:** append an object with `id`, `label`, `tier`, `active: true`, `deployment_allowed: true`, `kind`, `compose_project`, `env_file`, `public_domain` (see WORKFLOW.md §5 for the template).

### 9.4 The promote flow (end to end)

```
Operator triggers "Promote Release"
  inputs: school_slug=lions-complex, environment=production, branch=main
        │
        ▼
[1] validate job (ubuntu)  ──  resolve branch → commit_sha → image_tag=sha-<sha>
        runs scripts/validate-deployment-target.js:
          • slug found in manifest?      • active & deployment_allowed?
          • tier matches environment?    • emits github_environment (deploy-production-school)
        │
        ▼
[2] promote job (ubuntu) → uses GitHub Environment: deploy-demo / deploy-pilot / deploy-production-school
    (approval gate / required reviewers configured in GH Settings → Environments)
        │  scripts/ci/configure-deploy-ssh.sh   ← installs DEPLOY_HOST/USER/SSH_KEY → ~/.ssh/config "production"
        │  scripts/ci/sync-deploy-assets.sh     ← scp's manifest, deploy-release.sh, both compose files to /srv/zawadi/apps/deploy
        ▼
        ssh production  "DEPLOY_TARGET=school SCHOOL_ID=<id> IMAGE_TAG=sha-<sha> ...  bash deploy-release.sh"
```

### 9.5 On-server deploy pipeline — `scripts/deploy-release.sh`

Runs on the deploy host. For the matched school, in order (all-or-fail per instance):

1. **Resolve target** — manifest entry (or discovered running stack) → `{id, kind, compose_project, env_file, public_domain}`.
2. **Verify target** — compose file + env file exist; warns if no running containers.
3. **Backup DB** — `pg_dump` → `/srv/zawadi/backups/<id>/<UTC-timestamp>/database.sql` (+ `LATEST` symlink).
4. **Pull images** — `ghcr.io/amalgamate/zawadi-{frontend,backend}:sha-<commit>`.
5. **Pin images in env** — rewrites `FRONTEND_IMAGE=`/`BACKEND_IMAGE=` in the school's env file (this is what keeps the school on a pinned release).
6. **Migrate** — `docker compose run --rm backend npx prisma migrate deploy`.
7. **Restart** — brings up Redis first (if present), then force-recreates `backend` + `frontend`.
8. **Publish static frontend** (main only) — `docker cp` the nginx html bundle to the static publish dir + nginx roots; **verifies the new bundle** (rejects it if it still contains the legacy `settings-apps` menu); reloads nginx; verifies the live domain.
9. **Health check** — polls `/api/health` (must return `success:true`) AND `/api/schools/public/branding` (school schema readiness), up to 30 × 2s.

**Fail-fast safety:** if validation fails, no server contact is made. If a server deploy fails mid-pipeline, the DB backup under `/srv/zawadi/backups` is the rollback source. `DRY_RUN=true` prints the plan only.

### 9.6 Per-stack runtime — `deploy/portainer/docker-compose.stack.yml`

Each `kind: stack` school runs this compose file with its own `-p <project>` + `--env-file`. Services:
- **db** — `postgres:15-alpine`, healthcheck, persistent `db_data` volume.
- **redis** — `redis:7-alpine` (cache + rate-limit state), persistent volume.
- **backend** — pinned `BACKEND_IMAGE`, depends on healthy db+redis; reads JWT/encryption/VAPID/superadmin secrets + `DATABASE_URL`/`DIRECT_URL` from env; exposes `${BACKEND_PORT}:5000`.
- **frontend** — pinned `FRONTEND_IMAGE`, depends on backend; exposes `${FRONTEND_PORT}:80`.
- Isolated `app_net` bridge per project.

Frontend/backend stay behind the Nginx reverse proxy mapped to the school's `public_domain`. Backend ports are kept private; only 80/443 are public.

### 9.7 Provisioning a brand-new school — `scripts/provision-instance.sh`

Used by the platform console (not the promote flow). Takes a JSON payload (`name`, `domain`, `type`, `appType`, `fePort`, `bePort`, `db`, `requestedBy`):
- Allocates ports from fixed ranges (school FE 3000–3499, BE 5000–5499; also supports odoo/wordpress app types).
- Generates `DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` via `openssl rand`.
- Writes `env/.zawadi-<slug>.env`, brings up db+backend+frontend, runs `prisma db push`, inserts an `ACTIVE` row into `schools`, recreates containers, runs health checks, returns a JSON result.

### 9.8 Platform console deploy

Separate path: `DEPLOY_CONSOLE_ONLY=true bash deploy-release.sh` → pulls `zawadi-console:<tag>`, runs it as `zawadi-console` container (mounts docker.sock + apps dir, port 3100), health-checks `/health`. Console manages schools, sees running stacks, and can trigger provisioning.

### 9.9 Deployment docs & secrets

- **Docs:** `deploy/DEPLOYMENT.md`, `deploy/WORKFLOW.md`, `deploy/portainer/README.md`.
- **Required GitHub secrets:** `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (plus the three approval-gated Environments above).
- **Required GitHub Environments** (with required reviewers): `deploy-demo`, `deploy-pilot`, `deploy-production-school`.
- **Server-side manual run** (bypassing Actions): `DEPLOY_TARGET=school IMAGE_TAG=sha-<commit> SCHOOL_ID=<id> MANIFEST_PATH=... bash deploy-release.sh`.

### 9.10 First boot / superadmin

Set `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in the school env file (or `server/.env` locally) to bootstrap the superadmin on first run. Defaults in compose/provision are `admin@trendscore.app` / `Admin@123!` — change in production.

---

## 10. Quick Orientation Tips

- Looking for a **page**? Start at `src/components/CBCGrading/layout/PageRouter.jsx`, find the route key, follow the lazy import.
- Looking for an **API endpoint**? Start at `server/src/routes/index.ts`, find the mount, open that `*.routes.ts`, then its `*.controller.ts` → `*.service.ts`.
- Looking for a **data field**? `server/prisma/schema.prisma` is the source of truth (~110 models).
- Looking for **permissions/roles**? `src/config/permissions.js` (FE) + `server/src/middleware/permissions.middleware.ts` (BE).
- Looking for **module gating**? `requireApp(...)` calls in `routes/index.ts` + `App`/`SchoolAppConfig` models.
