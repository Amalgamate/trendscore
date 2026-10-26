# TrendSCORE Admin App — Flutter Product and Implementation Specification

**Status:** Product/engineering specification for implementation  
**Audience:** Flutter implementation agent, backend/API engineers, product owner, QA  
**Product:** TrendSCORE school operations companion app  
**Initial platform:** Android phones and tablets; keep the implementation portable to iOS  
**Excluded persona:** Driver (no driver login, driver dashboard, trip/run execution, or driver device approval flow)

## 1. Mission

Build a clean, secure Flutter app that gives school owners, administrators, operational staff, and tutors the mobile workflows they need from TrendSCORE. It must connect to the correct school deployment, use the existing authenticated APIs, and show each person only the data and actions authorized for their account.

This is a companion to the TrendSCORE school portal, not a separate source of school data or permissions. It must not make a new parallel user, class, subject, assessment, or attendance system.

The first release should prioritize dependable daily work over trying to reproduce every web module. The app should make it easy to answer “what needs my attention?” and complete the next action without navigating the full web menu.

## 2. Product boundaries and non-goals

### In scope

- School connection and sign-in for authorized school personnel.
- Role-aware home, notifications, and task/attention lists.
- Tutors' assigned class and subject work, learners, attendance, assessments, and LMS work where enabled.
- Leadership/admin summaries, approvals, school records, reports, and permitted operational actions.
- Staff workflows limited to the user's actual role and server permissions.
- Secure session persistence, school identity persistence, clear offline/error handling, and audit-friendly writes.

### Explicitly out of scope

- Driver persona or driver sign-in, driver run lists, trip start/finish, route execution, GPS transmission, or driver device approval.
- Parent or student portals and student/parent self-service sign-in.
- A new permissions model, shadow database, or client-side authorization that overrides the API.
- Hardcoded school URLs, school codes, credentials, API keys, signing secrets, or production data.
- A claim that a workflow is supported before its deployed API contract and school module access are verified.

Transport/facility information may be exposed to an authorized administrator or staff member only if an existing API and permission allow it. It must not surface driver-only workflows.

## 3. Repository and integration baseline

The current repository is a React/Vite web application and Express/TypeScript API. Its role definitions include `SUPER_ADMIN`, `ADMIN`, `HEAD_TEACHER`, `DEPUTY_HEAD_TEACHER`, `HEAD_OF_CURRICULUM`, `TEACHER`, `ACCOUNTANT`, `RECEPTIONIST`, `LIBRARIAN`, `NURSE`, `SECURITY`, `DRIVER`, `COOK`, `CLEANER`, `GROUNDSKEEPER`, and `IT_SUPPORT`, among others. The existing `DRIVER` role must be excluded from this product.

The repository scan did not find a Flutter `pubspec.yaml` or a tracked Flutter source tree. Create the new app as a clean project at `apps/admin_app/`. Do not copy signing material or credentials from driver-related metadata. Keep app signing setup separate and document it without committing secrets.

Before coding screens, the implementation agent must:

1. Read this spec, `README.md`, `docs/CODEBASE_INDEX.md`, and `docs/TRENDSCORE_DESIGN_SYSTEM_SPECIFICATION_V2.md`.
2. Inventory the exact deployed API request/response contracts for each first-release workflow by reading the matching Express routes, middleware, controllers, services, validators, and API tests. Record the source files and any contract gaps in `apps/admin_app/README.md` or a short API map.
3. Confirm how a school code resolves to the correct school host/base URL. Existing school deployments are subdomain-based and the core API does not show a confirmed generic school-code-to-host endpoint in the inspected route list. Do not assume `/api/driver-connection/resolve` belongs to the admin app or reuse a driver-only contract without verification. If a shared resolver is absent, report the needed backend contract instead of faking host discovery.
4. Confirm the deployed `/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout`, and CSRF/session behavior before selecting token/cookie storage. Do not infer Flutter cookie behavior from the browser app.
5. Keep backend authorization authoritative. A hidden button is not authorization; every write must still be rejected by the API when the user lacks permission.

The existing `GET /api/teacher/context` is a useful tutor-scope contract. It returns whether the user is restricted, class-teacher classes, subject assignments, assigned class IDs, and grades. Current API documentation indicates teacher-scoped roles include `TEACHER`, `HEAD_TEACHER`, and `HEAD_OF_CURRICULUM`, while privileged roles can receive unrestricted context. Confirm the implementation and each assessment endpoint's subject-ownership checks before relying on that behavior.

## 4. Personas, role mapping, and permission rules

“Owner”, “admin”, “staff”, and “tutor” are product personas, not permission grants. Map a signed-in account to the actual role/roles and server-provided permissions. The user record may have a primary role and additional roles; preserve both and do not flatten them into a broad app persona.

### Owner

The school owner needs an executive overview: enrollment and attendance trends, assessment progress, finance summaries where authorized, approvals, operational risks, and key school health indicators. The backend role catalogue does not currently define an `OWNER` role even though some frontend configuration mentions it. **Do not add an `OWNER` role or equate it with `SUPER_ADMIN` without an explicit product/backend decision.** Until identity mapping is confirmed, treat owner as a persona assembled from an existing account's verified roles and permissions. Keep platform-wide cross-school access restricted to the existing authorized platform role, never inferred from a school-owner label.

### Administrators

- `ADMIN` / School Admin: school-scoped administration and management actions allowed by server permissions and enabled modules.
- `SUPER_ADMIN`: retain the existing platform-level authority and tenant safeguards. Do not expose cross-school selection unless the current API explicitly supports and authorizes it.
- `HEAD_TEACHER`, `DEPUTY_HEAD_TEACHER`, and `HEAD_OF_CURRICULUM`: leadership/curriculum workflows allowed by their actual authorization. Do not assume these roles are interchangeable with `ADMIN`.

### Staff

“Staff” is not a blanket access role. Examples of existing roles are `ACCOUNTANT`, `RECEPTIONIST`, `LIBRARIAN`, `NURSE`, `SECURITY`, and `IT_SUPPORT`. Build navigation and actions from server permissions and role-specific capabilities. A receptionist should not gain payroll, clinical, or gradebook access merely because the app calls them staff. Show a clear “Your account has no access to this feature” state instead of a broken or empty screen.

### Tutors / teachers

Map tutors to the existing `TEACHER` identity unless the API provides a distinct tutor role. Tutors should see:

- Every class/learning area they are currently assigned to as subject teacher, even if they are not the class teacher.
- Their class-teacher learners and class work when they hold a class-teacher assignment.
- Learner details, attendance, assessment entry, and LMS content only for the assigned class/subject scope and only where the endpoint grants access.
- Their timetable, notices, messages, and own profile/leave workflows if those APIs and permissions are available.

Assignment scope must come from the authoritative teacher context/assignment APIs, not from a locally cached list, selected grade, or role name alone. A combined head-teacher/teacher account should keep the teacher role's assigned-work context while using leadership permissions only for authorized broader workflows.

### Driver exclusion invariant

The app must not offer a driver login route or render any `DRIVER`-only page, menu item, task, API action, or permission fallback. If a `DRIVER`-only account attempts to sign in, show a neutral message that the account is not eligible for this app and direct them to the appropriate school contact. Do not expose the reason in a way that leaks account existence before authentication.

## 5. Capability matrix

The matrix is a product target, not a substitute for server authorization. “Permission-scoped” means the app must ask the server or use the established permission payload and only show actions it authorizes. Any mismatch between this target and deployed API behavior is a documented backend gap, not a reason to grant client-side access.

| Capability | Owner persona | Admin / school leadership | Operational staff | Tutor / teacher |
|---|---|---|---|---|
| Role-aware dashboard and notifications | School-wide summary within grants | School/department summary within grants | Job-specific queue and summary | Assigned teaching work and due actions |
| Learner search and profile | Read school overview if granted | Manage/read per permission | Only operational fields needed for the role | Assigned class/subject learners; minimize sensitive fields |
| Classes and subject assignments | Read overview | Manage if authorized | Usually not available | Read own assignments; no self-allocation |
| Attendance | View summary if granted | View/manage if authorized | Only if role permits | Mark/view assigned learners if authorized |
| Assessment and grades | View summaries if granted | Configure/review if authorized | No access unless explicitly granted | Record/view marks for assigned subject/class; honor locks and ownership |
| LMS | View school-level progress if granted | Manage/monitor if authorized | No access unless explicitly granted | Create/publish lessons and assignments, review submissions for own assigned teaching scope |
| Fees and finance | Summary or reports if granted | School-level finance if granted | Accountant/receptionist-specific operations | No fee balances by default |
| Staff and user management | View/manage only if mapped permission grants it | Administer within school scope if authorized | Own profile or assigned HR actions | Own profile and own leave actions |
| Reports and exports | Executive reports if granted | Reports allowed by role | Job-specific reports | Own classes/subjects; protect learner data |
| Approvals | View/decide assigned or permitted requests | Manage assigned workflow steps | Act only on assigned requests | Act only where the workflow assigns them |
| School settings / module access | Only if the mapped account is authorized | Admin-only controls per API | No access by default | No access by default |
| Transport/facilities | Summary only if granted | Management views/actions if granted | Limited assigned operations if granted | No driver functionality; other access only if explicitly allowed |

## 6. First-release priorities

Build in vertical slices. First-release scope is deliberately bounded; do not attempt to duplicate the entire web ERP.

### P0 — Foundations

- School connect/code entry and school identity confirmation. Resolve a code once, display the selected school's official name/logo/domain, and persist only the validated school endpoint/identity. Support a clear change-school flow that clears the prior user's session and cached data.
- Sign in, session restoration/refresh, logout, forced re-authentication, password-change-required flow if supported, and understandable invalid-credentials/network/server errors.
- Fetch `/api/auth/me` (or confirmed equivalent) after login; build navigation from the returned role/permissions/module access.
- User profile, notification inbox/count, and a role-appropriate home page with loading, empty, offline, and retry states.
- No cross-school data leakage during connect, login, logout, account switch, cache restore, or background resume.

### P1 — Tutor daily work

- Assigned classes and subjects using the teacher context API and confirmed class/subject learner APIs.
- Learner roster search and learner profile with only the fields necessary for teaching.
- Attendance for an assigned class/date with review-before-submit, bulk save where the API supports it, duplicate-submit protection, and clear saved/failed status.
- Assessment selection and mark entry only for assigned class/subject/term/test; enforce server locks, subject ownership, max score, and audit rules. Use explicit save feedback and protect unsaved edits.
- LMS lessons, assignments, submissions, and marking only if the LMS module is enabled and those endpoints authorize the teacher's scope.
- Timetable, urgent school notices, own profile, and own leave request only after API contract verification.

### P1 — Owner/admin operations

- Action-first dashboard, concise trends/KPIs, approvals requiring the signed-in user's action, and recent activity where supported.
- Learner/staff lookup and school-level summaries permitted by role.
- Basic staff/user administration only when endpoint workflows are complete on mobile (view/search first; destructive/credential actions require explicit confirmation and audit support).
- Finance summaries/reports only for accounts authorized to see them; avoid exposing student fee balances on general dashboards.
- Operational summaries for modules such as transport/facilities only if enabled and authorized; no driver app workflows.

### P2 — Expansion

Add workflows only after API inventory, school/module enablement, permissions, and accessibility review: broader finance, HR, inventory, facilities, transport management, detailed reporting, exports, biometric operations, and advanced configuration. Do not make an offline-capable write workflow without conflict/idempotency support from its API.

## 7. Navigation and screen requirements

Use a small, stable bottom navigation, typically **Home**, **Work**, **Inbox**, and **More**. The exact labels may change after usability review, but do not reproduce the web app's many horizontal module menus. Filter available destinations from role permissions and enabled school modules.

### Shared screens

1. **Connect school:** short explanation, school code field, connect action, progress, retryable errors, and selected school confirmation. Never ask for a URL if the established workflow is code-based.
2. **Sign in:** school identity, email/phone/username field supported by the API, password, show/hide password, forgot-password path if available, and accessible error feedback.
3. **Home:** role-appropriate greeting; prioritized tasks; a few useful counts; primary quick action; pull-to-refresh; no fake values.
4. **Inbox/notifications:** read/unread, deep link to an authorized task, pagination, and clear empty/error states.
5. **More/profile:** school identity, current roles, account settings, app version, help/contact, change school (with session/cache clear), and sign out.

### Tutor work area

- **My teaching:** assigned classes and learning areas, with class/grade/stream labels and assignment freshness.
- **Class detail:** roster, quick search, today/timetable context, attendance, assessment, and LMS entry points based on access.
- **Attendance:** date and class context always visible; accessible status controls; review changes before sending; confirmation with saved count and per-record errors if partial success is possible.
- **Assessment:** selection flow should guide grade/class → learning area → term/year → assessment/test. Limit lists to authorized assignments, surface the missing prerequisite/setup action, and preserve unsaved marks on transient failure.
- **LMS:** teaching content and submission queues tied to assigned teaching scope.

### Leadership and staff work area

- **Overview:** decisions and exceptions first; detailed analytics are secondary.
- **Approvals:** assigned/pending actions, details, consequences, decision confirmation, and status history.
- **Lookup:** fast learner/staff search with role-aware fields and server-side pagination/search where available.
- **Operational tasks:** only tasks backed by current enabled APIs and permissions.

## 8. Flutter engineering requirements

### Architecture

- Use a feature-first structure with clear `core/`, `features/`, `data/`, `domain/`, and `presentation/` boundaries. Keep widgets out of API and authorization logic.
- Choose one state-management solution and one router for the app; document the choice in the initial architecture note. Use typed immutable models, repository interfaces, and injectable API clients. Avoid multiple competing state patterns.
- Use a centralized API client with base URL/tenant context, authentication, timeouts, safe error parsing, request IDs where available, and retry rules limited to safe/idempotent reads.
- Keep DTOs separate from UI models. Parse optional/null/unexpected fields defensively; the web/API history includes dynamic and evolving response shapes.
- Add a CI-friendly environment/config setup for local, staging, and production. No production base URL or credential should be a developer-only magic constant.
- Keep the app buildable and documented from `apps/admin_app/`; do not refactor the web app as a prerequisite unless a confirmed API contract requires a separately reviewed backend change.

### Security and privacy

- Store refresh/session credentials only in platform secure storage using the API's confirmed auth contract. Never store passwords, school code secrets, or bearer tokens in ordinary preferences, logs, analytics, crash reports, or screenshots.
- If the backend uses cookies, verify cookie persistence and CSRF protection on Android/iOS. Do not silently substitute local bearer-token auth.
- Bind all cached records to both authenticated user ID and resolved school ID. On logout, account switch, school switch, role/permission change, or auth failure, clear sensitive cache and pending data for the old identity.
- Use TLS with normal platform certificate validation. Do not disable certificate checks or add permissive redirects to bypass 307/host-routing errors.
- Minimize local student/health/finance data. Use short cache lifetimes and avoid caching sensitive records unless there is a clear workflow and protected storage policy.
- Do not place passwords or student PII in logs. Redact request/response bodies by default.
- Require explicit confirmation for irreversible or consequential changes; show the exact affected record/action before submission. Honor API audit requirements.

### Offline and resilience behavior

- Display connection state without blocking cached, non-sensitive read-only views where safe.
- Do not silently claim that an offline change has been saved. Either prevent unsupported writes while offline or show a durable queued state with an explicit retry and idempotency protection if the backend supports it.
- For assessment and attendance writes, prevent duplicate submissions, retain drafts safely for the current user/school, and reconcile server validation errors field by field.
- Distinguish no data, not assigned, module disabled, permission denied, network failure, validation failure, and server failure. Never convert all failures to “Internal server error.”
- Provide bounded retry with backoff for safe reads; don't retry financial, assessment, approval, or other consequential writes blindly.

## 9. Design and accessibility direction

Follow `docs/TRENDSCORE_DESIGN_SYSTEM_SPECIFICATION_V2.md`: calm, professional, mobile-first, consistent tokens, restrained surfaces, semantic status colors, minimal decoration, and clear operational hierarchy. The screen should feel native to Flutter while remaining recognizably TrendSCORE through school branding and established brand colors.

- Use school branding returned by the public school configuration API only after confirming the endpoint and allowed assets.
- Use a compact typography and spacing scale, consistent buttons/forms/cards/status chips, visible focus, and clear destructive-action styling.
- Target WCAG 2.2 AA where applicable and Flutter accessibility guidance: semantic labels, TalkBack/VoiceOver support, scalable text, sufficient contrast, 44–48 logical-pixel touch targets, keyboard navigation for tablets, and reduced motion.
- Support small phones, large phones, and tablets. Use adaptive layouts, not a scaled desktop layout. Avoid wide data tables on phones; use readable cards or deliberate horizontal scrolling.
- Provide skeleton/loading, empty, permission-denied, offline, validation, retry, and success states consistently.

## 10. API contract and authorization policy

The implementation agent must maintain an endpoint inventory with columns: workflow, method/path, auth required, role/permission guard, module gate, request schema, response shape, tenant scope, write/idempotency behavior, and source file/test reference.

Known contracts to verify include:

- Authentication routes in `server/src/routes/auth.routes.ts`; auth APIs are also wrapped in `src/services/api/auth.api.js` for the web client.
- Authenticated profile/context (`/api/auth/me`) and teacher scope (`GET /api/teacher/context`).
- Subject assignments under `/api/subject-assignments` and the controllers/services enforcing them.
- Assessments, attendance, LMS, dashboards, notifications, approvals, users, learners, and classes under their route modules. Verify each mobile workflow's exact route and required guards instead of assuming route names from UI labels.
- App/module gating in `server/src/routes/index.ts` (for example `requireApp('gradebook')`, `requireApp('attendance')`, and `requireApp('lms-professional')`). A user role alone does not mean the school has that module enabled.

Rules:

1. The server is the final authority for role, permission, tenant, assignment, module, and record scope.
2. Client capability checks only control presentation and improve usability. They never replace API checks.
3. Never send a school ID supplied by the client as authority when the authenticated host/context already determines the school.
4. Treat 401 as expired/invalid session, 403 as permission denial, 404 as missing/unavailable resource, 409 as conflict, 422/400 as validation, 429 as rate limit, and 5xx as service failure only after confirming the actual API error contract.
5. For every write, map the form fields to the server validator and display validation messages without discarding user input.
6. If a needed endpoint is missing or inconsistent, document the gap and propose the smallest backward-compatible API change. No schema migration or school-wide production rollout is part of app implementation unless separately approved.

## 11. Definition of done

The app is ready for pilot review only when all are true:

- A clean Flutter project builds from its documented setup and has no embedded signing secrets.
- School connect resolves the intended deployment and confirms school identity; switching schools clears prior identity-bound state.
- Login, restore, expiry, logout, password-change-required, and denied-account flows follow the confirmed API contract.
- Test accounts for each included persona show the correct workspaces; staff roles do not inherit broad admin access; a tutor with subject assignments but no class-teacher assignment can see the assigned subject learners/assessment workflow.
- The app has no driver-facing capability and rejects a driver-only account from this app.
- Role, school module, class, subject, and learner restrictions are enforced server-side. UI does not leak data through search, deep links, notifications, local cache, or back navigation.
- All list and form screens have loading, empty, error, retry, and permission states; write success is confirmed by the server response.
- Assessment and attendance edits cannot be silently lost or duplicated on refresh, app resume, timeout, or retry.
- Sensitive fields and logs are reviewed for data minimization and redaction.
- Usability review covers Android phones/tablets, large text, screen readers, and constrained network conditions.
- A release checklist covers app identifier, icons, versioning, HTTPS endpoints, privacy disclosures, signing, backup of signing credentials, and staged pilot distribution.

## 12. Implementation-agent operating instructions

1. Start by reporting the API inventory, confirmed owner-role mapping, school-code resolution contract, and any blockers. Keep product assumptions visible.
2. Implement the app in small end-to-end increments, beginning with connection/auth/session and then tutor scope. Do not make placeholder screens look like finished features.
3. Use repository interfaces and real API fixtures/contracts. Do not ship mock dashboards, fake counts, hardcoded classes, or sample learner data in production builds.
4. Preserve existing web workflows and school data. Do not run migrations, modify school databases, deploy backend changes, publish an APK, or change production settings as part of this spec's implementation without a separately authorized rollout request.
5. Do not add or expose `DRIVER`, parent, or student personas to make routing easier. Do not widen API permissions to make screens work.
6. Keep implementation clean: consistent naming, small focused widgets, no duplicated HTTP clients, no secrets in source control, no unexplained generated files, and a concise `apps/admin_app/README.md` for setup/build/release.
7. Before declaring a workflow complete, record the API endpoint, role/scope behavior, error states, and manual acceptance steps. Clearly distinguish tested behavior from unverified backend assumptions.

## 13. Open decisions to resolve before implementation

- Is “Owner” a school-level persona mapped to `ADMIN`/another existing role, or does the product require a new persisted `OWNER` role? Do not decide this in the client.
- Which accounts qualify as “staff” for the first release? The app should include currently defined operational roles only through their existing permission grants.
- What is the authoritative school-code resolver for this shared app, and what response fields identify the school/base URL? If no general contract exists, backend/platform work is a prerequisite.
- Does Flutter authenticate using cookies/CSRF or a mobile token flow? Confirm production behavior and supported refresh/revocation before building persistence.
- Which modules are required at pilot launch: academics/assessment/LMS only, or also finance, HR, approvals, and operations?
- Should school switching be available to a single account associated with multiple schools? If so, define explicit server authorization and require a fresh school-bound session.

Until these decisions are answered by existing contracts or product direction, implement only the confirmed baseline and record the rest as blockers; never guess at access or tenant identity.
