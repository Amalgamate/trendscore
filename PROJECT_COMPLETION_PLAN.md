# TrendSCORE — Project Completion Implementation Plan

**Assessment date:** 10 September 2026
**Assessed by:** Claude (fresh, code-and-docs-grounded review of this repository)
**Purpose:** Single source of truth for what's left to finish TrendSCORE, organized into stages with self-marking checklists.

---

## How to use this document

- Every task is a Markdown checkbox: `- [ ]` = not done, `- [x]` = done.
- Tick a box by editing this file directly (change `[ ]` to `[x]`) as work lands — in an editor, in a PR description, or by asking an AI assistant to "mark task X done in PROJECT_COMPLETION_PLAN.md."
- Each **Stage** has a `Status:` line — update it by hand (`Not started` / `In progress` / `Blocked` / `Done`) and the **Progress Summary** table below when a stage's boxes change materially.
- Stages link to the deeper existing planning docs in `docs/` where one already exists — this file is the tracker/index, not a duplicate of that detail.
- New sub-tasks can be appended under any stage as work is scoped further; don't renumber existing items once work has started against them.

---

## Methodology

This is a fresh assessment, not a copy of any single prior report. It was built by:

1. Reading `README.md`'s module-readiness table (the project's own current self-assessment).
2. Walking the actual repository structure — `src/`, `server/src/routes`, `server/src/domains`, `server/src/modules` — to confirm which modules have real route/controller/service coverage.
3. Cross-checking every module marked **WIP** or **Not started** against the relevant deep-dive document already in `docs/` (pathways, M-Pesa/finance, marketplace, AI infrastructure, biometrics, LMS).
4. Converting each doc's open items into checklist tasks here, grouped into delivery tiers by business risk and dependency order — not just copied in README order.

Where a module is marked **Complete**, this plan does not re-litigate it; it lists only ongoing maintenance/QA obligations, since "complete" in this codebase means "end-to-end workflow implemented," not "never needs school-specific validation."

---

## Progress Summary

| Tier | Stage | Status | Notes |
|---|---|---|---|
| 0 | Fees, Invoicing, M-Pesa & Reconciliation | In progress | Highest business risk — money |
| 1 | Guided Pathways interface alignment | In progress | Most mature backlog, ~50% of sub-phases done |
| 2 | Central Marketplace | Not started | Correction items block launch |
| 2 | LMS / Digital Learning Hub experience layer | In progress | Breadth built, experience gaps remain |
| 3 | Biometric & Face Attendance rollout | In progress | Product built; rollout is per-school ops |
| 4 | AI Copilot | In progress | Phase 1 backend foundation shipped |
| 5 | WhatsApp production consolidation | In progress | Dual-strategy works; inbound self-service missing |
| 6 | Complete modules — maintenance & QA | Ongoing | See Stage 6 for the full list |
| 7 | Not-started roadmap items | Not started | External accounting, USSD, Voice/VOIP, native apps, Creators Hub |

*(Update this table's Status column whenever a stage's checklist changes meaningfully.)*

---

## Tier 0 — Fees, Invoicing, M-Pesa & Reconciliation

**Status:** In progress
**Why first:** This is the only tier where bugs or gaps directly touch school revenue and parent trust. Reference: `docs/MPESA_FUTURE_TERM_PAYMENTS_IMPLEMENTATION_REPORT.md`.

### Already in place
- [x] Unified M-Pesa service with Daraja, Kopo Kopo and IntaSend providers
- [x] Daraja OAuth, STK Push and STK status query
- [x] Protected initiation/status endpoints and public callback endpoint
- [x] Persisted `MpesaTransaction` and raw `MpesaCallback` records
- [x] Posting successful invoice-bound payments into `FeePayment` with invoice status updates
- [x] Unmatched-payment handling for organic merchant payments
- [x] Parent payment modal with phone entry, STK initiation and status polling
- [x] Receipt SMS handling

### Remaining work
- [ ] Remove the "invoice required" hard dependency — add a **Pay ahead** flow for zero-balance parents (choose future term/year from published fee schedules)
- [ ] Build a learner/family **credit ledger** so money can be held unapplied ahead of an invoice
- [ ] Fix multi-child collection so a combined payment is actually split/allocated across siblings, not attributed to the first child with a balance
- [ ] Add server-side validation of parent-to-learner access, invoice ownership, school and amount policy before any provider call (don't trust client-supplied `invoiceId`/amount)
- [ ] Scope provider/config selection per school/tenant (replace `findFirst`) with encrypted secrets
- [ ] Consolidate M-Pesa config source of truth (env vars vs. settings schema currently compete)
- [ ] Make the callback URL fail closed in production if no real HTTPS URL is configured
- [ ] Make payment settlement idempotent through one function, called by both callback and status-query paths
- [ ] Add server-side reconciliation for payments left pending after the parent closes the app or loses connectivity
- [ ] Show the real M-Pesa receipt number after callback instead of deriving one from the checkout ID
- [ ] Implement **Pay another amount**, **Add learner credit**, and **Share payment link** parent-facing flows
- [ ] Ship the "school-owned collections" model: each school supplies its own PayBill/short code, money settles directly to the school
- [ ] Final QA pass: overpayments, future terms, delayed callbacks, multi-child payments, payment links, refunds

---

## Tier 1 — Guided Pathways Interface Alignment

**Status:** In progress
**Why second:** Functional implementation is already complete per `docs/PATHWAYS_IMPLEMENTATION_PLAN.md`; what's left is interface alignment so each user type gets the right experience. Reference: `docs/PATHWAYS_INTERFACE_ALIGNMENT_TASKS.md` for full detail — this stage summarizes it.

- [x] **Phase 1 — Routing & access correction** (blocking phase) — done except:
  - [ ] Automated access tests for all seven role/institution combinations
- [~] **Phase 2 — Junior Transition Centre (Primary)** — renamed and core flows shown; still open:
  - [ ] Primary-specific landing dashboard (coverage, evidence, review, decision-plan widgets)
  - [ ] Correct ordering of the Grade 7–9 learner journey end to end
  - [ ] Readiness messaging for incomplete recommendation/preference/combination data
  - [ ] Staff filters by grade, class, recommendation state, transition readiness
- [x] **Phase 4 — Pathways Administration as first-class destination** — done except:
  - [ ] Subject-mapping controls in the career editor
- [~] **Phase 3 — Senior Pathway Progress Centre (Secondary)** — largely done; still open:
  - [ ] Filters by grade, pathway, track, combination, approval state, action status, intervention priority
- [~] **Phase 5 — Parent experience alignment** — Grade 10–12 parent view done; still open:
  - [ ] Grade 7–9 parent view (recommendation, career review, family preferences, school matches, combination implications, decision-plan review)
- [ ] **Phase 6 — Navigation, language & visual consistency** (not started)
  - [ ] Replace `sec-*` internal terminology in user-facing primary navigation
  - [ ] Stage-appropriate labels (Primary: Explore/Prepare/Compare/Decide; Secondary: Track/Review/Improve/Complete)
  - [ ] Standardize status chips, empty/loading/error states across roles
  - [ ] Confirm parity between desktop and mobile for essential operations
- [ ] **Phase 7 — End-to-end verification** (not started)
  - [ ] Primary CBC, Secondary, and System Admin end-to-end test scenarios
  - [ ] Responsive layout tests for student/parent/counsellor/admin
  - [ ] Permission, migration, TypeScript, ESLint, production-build gates
  - [ ] UAT with one primary-school and one secondary-school workflow before deployment

---

## Tier 2 — LMS, Digital Learning Hub & Central Marketplace

**Status:** In progress (LMS core) / Not started (Central Marketplace corrections)

### 2a. Central Marketplace
Reference: `docs/CENTRAL_MARKETPLACE_DELIVERY_PLAN.md`

- [x] LMS Marketplace DB models (listings, purchases, seller earnings, platform fees, ratings, download limits)
- [x] API routes for listing lifecycle, browse, approval, purchase, M-Pesa callback, downloads, ratings, analytics
- [x] LMS Marketplace screens (browse, create, purchase, seller analytics)
- [x] Enterprise access guard for Marketplace endpoints

**Must be corrected before launch:**
- [ ] Fix LMS Settings `allowedFileTypes` type mismatch (sent as text, DB expects string array) — currently breaks Settings saves
- [ ] Enforce LMS settings toggles in navigation and Marketplace backend rules
- [ ] Fix inconsistent Marketplace client API response shape (valid data appearing empty/failed)
- [ ] Route free listings around the M-Pesa payment path
- [ ] Build the **central catalogue** — move listings off single-`schoolId` scoping so the main TrendScore website has one source of truth
- [ ] Build the **selected-school audience model** (visibility beyond school-only, short of platform-wide)
- [ ] Build platform moderation workflow, copyright/takedown process, seller payout process
- [ ] Get product-rule sign-off (broadest visibility a teacher can request, approval requirements per visibility tier, refunds/fees/payout timing, licensing declaration)

### 2b. LMS / Digital Learning Hub experience layer
Reference: `docs/lms-gap-assessment-plan.md` and `lms-gap-assessment/lms-gap-assessment.html` for the full report.

- [x] Courses, lessons, assignments, submissions, marking, resources implemented
- [x] Progress tracking and analytics foundations exist
- [ ] Improve gamification visibility (the report's headline finding: mechanics exist but aren't surfaced well to learners)
- [ ] Build out interactive learning experiences (beyond static content delivery)
- [ ] Strengthen parent-facing guidance/visibility into LMS activity
- [ ] Build comparison flows called out in the gap report (read the full HTML report for the prioritized backlog before starting this sub-stage)
- [ ] Digital Campus expansion (per README, ongoing)

---

## Tier 3 — Biometric & Face Attendance Rollout

**Status:** In progress — product is built; what remains is largely per-school operational rollout, not new engineering.
Reference: `docs/BIOMETRIC_INSTALLATION_GUIDE.md`

- [x] Vendor-neutral canonical HTTPS payload spec
- [x] ZKTeco adapter (PUSH + PULL modes), sync worker (15-min), daily retry worker
- [x] Phone face-liveness terminal via AWS Rekognition, with offline IndexedDB queue and idempotent `eventId`
- [x] Per-school biometric encryption key model (`BIOMETRIC_ENCRYPTION_KEY`, `BIOMETRIC_KEY_VERSION`)
- [ ] Per-school rollout checklist execution: encryption-ready confirmation, NTP time sync, device registration, serial/location/firmware recording (repeat per school onboarded)
- [ ] AWS Rekognition production setup per school (IAM role, liveness/match thresholds validated against that school's approved risk assessment — defaults are 90/97)
- [ ] Desktop bridge / vendor-specific driver decision — currently explicitly *not* shipped; confirm this remains intentional or scope one
- [ ] Formal hardware installation sign-off process per school (this doc is a guide, not yet a tracked checklist per deployment)

---

## Tier 4 — AI Copilot

**Status:** In progress — Phase 1 backend foundation shipped; Phases 2–10 open.
Reference: `docs/AI_INFRASTRUCTURE_READINESS_REPORT.md` (scorecard: 6.3/10 overall readiness as of the report)

### Already in place
- [x] Authenticated `/api/ai/chat` orchestrator with provider routing (Anthropic default, OpenAI fallback)
- [x] Tool registry with seven Pathways tools, role and learner-ownership enforcement, pathway-stage guards
- [x] CSRF protection, exact-input confirmations (Redis-backed, memory fallback in dev)
- [x] Persistent `AuditLog` for tool outcomes; tenant/user-scoped conversation history
- [x] Frontend assistant with explicit confirmation controls
- [x] Rule-based assistants (teacher feedback generator, risk analyzer, pathway predictor) — deterministic, no external AI call

### Remaining — infrastructure hardening (blocks everything below)
- [ ] Live-provider end-to-end testing
- [ ] Production Redis configuration
- [ ] AI-specific rate limits / usage budgets
- [ ] Operational monitoring for AI calls
- [ ] `pgvector` extension + vector storage table (`DocumentEmbedding`)
- [ ] Job queue (BullMQ + Redis) for async AI processing
- [ ] AI middleware: prompt-injection guard, per-user AI rate limiting

### Remaining — roadmap phases (from the report's 10-phase plan; each ~3–7 weeks at 1–3 engineers)
- [ ] Phase 2 — Intent detection: classifier, conversation state machine, WhatsApp inbound → AI handler routing
- [ ] Phase 3 — Tool calling: schema for read-only APIs, tool executor with permission checks
- [ ] Phase 4 — Attendance assistant ("who is absent today", AI-triggered parent notification)
- [ ] Phase 5 — Finance assistant (balance queries; STK Push stays human-in-the-loop / high-risk)
- [ ] Phase 6 — Transport assistant (bus location/alerts, if GPS available)
- [ ] Phase 7 — Teacher AI (LLM-upgraded report comments, intervention flags, lesson-plan drafting)
- [ ] Phase 8 — Principal AI (executive summaries, predictive alerts, benchmarking)
- [ ] Phase 9 — Voice notes (WhatsApp STT/TTS)
- [ ] Phase 10 — RAG (document ingestion, embeddings, policy/curriculum retrieval)

**Guardrail note carried over from the report:** write-capable tools (`SendSTKPush`, `MarkAttendance`, `UpdateFeeWaiver`) are high-risk and require human-in-the-loop confirmation before any AI invocation — do not relax this while closing out Tier 0.

---

## Tier 5 — WhatsApp Production Consolidation

**Status:** In progress
Cross-referenced from the AI infrastructure report's WhatsApp section and the README's WIP notes.

- [x] Baileys (unofficial) integration: text, media, bulk messaging, QR pairing, auto-reconnect
- [x] WhatsApp Business API (WABA, official Meta Cloud API) integration: text, templates, webhook verification
- [x] Automatic fallback from WABA to Baileys when WABA is unconfigured/fails
- [ ] Production consolidation decision: when to prefer WABA vs Baileys per school, and retire ambiguity
- [ ] Inbound message routing to an AI/human handler (currently outbound-oriented)
- [ ] Per-parent session/context management for two-way conversations
- [ ] Voice note support (currently unsupported on both integrations)
- [ ] Button/list interactivity for guided flows (WABA templates only, not yet wired to product flows)
- [ ] Sender JID verification against registered parent phones (impersonation risk noted as only partially mitigated)
- [ ] WhatsApp session pooling for multi-school scale (currently one Baileys session per deployment)

---

## Tier 6 — Complete Modules: Maintenance & QA Only

**Status:** Ongoing
These modules are marked **Complete** in `README.md` — end-to-end workflows exist. Nothing here is a build gap; these are recurring validation obligations per the README's own status guide ("still requires each school's configuration, data, permissions, and release validation").

- [ ] Institution setup, branding, users, roles & permissions — verify per new school onboarding
- [ ] Learners, guardians, admissions, classes, streams, documents — verify per new school onboarding
- [ ] CBE academics, assessment, grading, report cards — verify each term/curriculum update
- [ ] Internal accounting and payroll posting — verify each fiscal period
- [ ] HR, staff, leave, attendance, payroll, duty roster — verify per school
- [ ] Timetable, planner, schemes of work, transport, boarding, inventory, assets, library — verify per school
- [ ] Notices, SMS, email, broadcasts, notifications, templates — verify provider configuration per school

*(These boxes intentionally stay unchecked as an ongoing checklist — check and immediately re-open, or replace with a per-school onboarding log if that's more useful in practice.)*

---

## Tier 7 — Not-Started Roadmap Items

**Status:** Not started — scoping only, sequence after Tiers 0–5.

- [ ] **External accounting connectors** (QuickBooks, Xero, Sage) — no adapter or sync workflow exists; needs scoping doc before build
- [ ] **USSD self-service** — no menu, session, identity or transaction flow exists; needs scoping doc
- [ ] **Voice / VOIP** — no SIP, WebRTC, telephony adapter, calling UI, recording or call-log workflow exists; needs scoping doc
- [ ] **Mobile native apps** — web app is responsive/PWA-capable; native apps not started; decide build-vs-wrap approach
- [ ] **Creators Hub** — product direction exists but no complete standalone workflow shipped; needs a delivery plan (similar in shape to `CENTRAL_MARKETPLACE_DELIVERY_PLAN.md`)

---

## Recommended Delivery Order

1. **Tier 0** — Fees/M-Pesa hardening (revenue integrity; blocks safe scale-up of paid features elsewhere, including Marketplace payments and AI finance tools)
2. **Tier 1** — Pathways interface alignment Phases 2, 5, 6, 7 (highest-maturity backlog, close it out)
3. **Tier 2a** — Marketplace correction items (the four "must fix before launch" bugs specifically, before the bigger central-catalogue build)
4. **Tier 3** — Biometric rollout (operational, can run in parallel with engineering tiers)
5. **Tier 5** — WhatsApp inbound routing (unlocks Tier 4 Phase 2 onward)
6. **Tier 4** — AI Copilot infrastructure hardening, then phases 2–4 (attendance/finance assistants reuse Tier 0/3 work)
7. **Tier 2b** — LMS experience layer
8. **Tier 4 (cont.)** — AI phases 5–10
9. **Tier 7** — Not-started roadmap items, each preceded by its own scoping doc

---

## Change Log

- **10 Sept 2026** — Initial fresh assessment and document created.
