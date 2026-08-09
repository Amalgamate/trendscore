# TrendSCORE 2.0 — Master Architecture Specification (MAS)

**Document ID:** MAS-001  
**Version:** 1.0  
**Status:** DRAFT — Pending Architecture Review  
**Date:** August 2026  
**Classification:** Internal — Governing Document  
**Owner:** Chief Software Architect

> **This document supersedes all prior architectural recommendations.**
> Audit documents in `/docs/architecture/audits/` are verified evidence.
> Where audit recommendations conflict with long-term architectural goals,
> this specification takes precedence. Factual audit findings are preserved
> and referenced throughout.

---

## Table of Contents

1. [Vision](#1-vision)
2. [Architectural Principles](#2-architectural-principles)
3. [Current System Assessment](#3-current-system-assessment)
4. [Target Architecture](#4-target-architecture)
5. [Presence Platform](#5-presence-platform)
6. [Domain-Driven Design](#6-domain-driven-design)
7. [Database Evolution](#7-database-evolution)
8. [API Standards](#8-api-standards)
9. [Event Architecture](#9-event-architecture)
10. [Security](#10-security)
11. [Repository Organisation](#11-repository-organisation)
12. [Coding Standards](#12-coding-standards)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment Strategy](#14-deployment-strategy)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Risks](#16-risks)
17. [Architecture Decision Records](#17-architecture-decision-records)

---

## 1. Vision

### 1.1 Product Vision

TrendSCORE is the operating system for African schools.

Not a gradebook. Not an attendance register. An intelligent, unified platform that gives every teacher, administrator, parent, and student a single coherent view of school life — from the moment a learner boards the bus in the morning to the moment they complete their evening prep.

TrendSCORE 2.0 extends this vision with a foundational capability that has been absent: **knowing where everyone is, all the time, across every context of school life** — and acting intelligently on that knowledge.

### 1.2 Mission

To provide every school — from a single-classroom primary to a large boarding secondary — with production-grade software that:

- Eliminates paper-based attendance, manual registers, and fragmented communication
- Gives parents real-time, trustworthy visibility into their child's school day
- Enables school leaders to act on early warning signals before problems become crises
- Supports the full diversity of Kenyan school types: day, boarding, mixed, primary, secondary, CBC, and legacy curriculum

### 1.3 Long-Term Goals (5-Year Horizon)

| Year | Goal |
|---|---|
| 2026 | Stabilise existing production modules; close critical security gaps; launch Presence Platform foundation |
| 2027 | Complete biometric integration; launch boarding school module; parent Guardian portal |
| 2028 | Multi-school / county deployment; analytics platform; AI early warning |
| 2029 | Transport GPS integration; open API marketplace; third-party device ecosystem |
| 2030 | National NEMIS integration; county-level reporting; TrendSCORE as infrastructure standard |

---

## 2. Architectural Principles

These principles are non-negotiable. Every implementation decision must be tested against them. Any deviation requires a documented Architecture Decision Record (ADR) with explicit justification.

### P1 — Never Rewrite Stable Modules

If a module is in production and working, it is extended, not replaced. Existing controllers, services, routes, and database tables are the foundation. New capabilities are layered on top through additive patterns: new tables, new event emitters, new service methods alongside existing ones.

*Applies to:* AttendanceController, HRService (staff attendance), SmsService, NotificationService, TransportController, all fee-related modules.

### P2 — Event-Driven Architecture for Cross-Module Concerns

Any time one module needs to know about something that happened in another module, it subscribes to an event — it does not reach into the other module's service or table directly. Presence, notifications, and audit trails are all event-driven concerns.

*Cross-module direct DB queries are a code smell. Direct service method calls across bounded contexts require justification.*

### P3 — Module Ownership and Clear Boundaries

Every module owns its data. No two modules write to the same primary table. Reads across boundaries happen through published APIs or event subscriptions, never through shared ORM queries into another module's tables.

*Example: The Boarding module does not query `attendances`. It emits a DORM_ROLL_CALL event. The Presence Platform aggregates it.*

### P4 — Backward Compatibility Is Non-Negotiable

No existing API response shape may change in a breaking way. New fields may be added. Existing fields may not be removed or renamed without a versioned deprecation cycle. Database columns may not be dropped without a multi-migration strategy that spans at least two releases.

### P5 — Security-First

Security concerns are not deferred. Every new feature is designed with authentication, authorisation, audit logging, and data protection as first-class requirements, not afterthoughts. Biometric data, personal data, and financial data receive elevated treatment by default.

*The biometric template encryption gap identified in the audit is a P0 fix before any new biometric work proceeds.*

### P6 — API-First Design

Every new capability is designed as an API before any UI work begins. The API is the product. UI is a consumer. This enables mobile apps, third-party integrations, and the parent portal to all consume the same contracts.

### P7 — Database Evolution Over Replacement

The PostgreSQL schema evolves through Prisma migrations. No table is dropped and recreated. All migrations are additive-first (add column, add table, add index). Destructive migrations (rename, drop) follow a staged deprecation process with explicit ADRs.

### P8 — Observability by Default

Every service method that performs a significant operation logs at the appropriate level. Every cron job logs start, end, and result. Every external API call (SMS, email, payment) logs the outcome. Errors include enough context to diagnose without access to production data.

### P9 — Multi-Tenancy by Design

Every new table and every new service method is aware of `schoolId`. The platform serves multiple schools. A query that does not scope by schoolId where appropriate is a defect.

### P10 — Progressive Enhancement for School Complexity

Features are designed to work for a simple day school out of the box and unlock advanced capabilities (boarding, biometric, GPS) as school configuration is enabled. The system must not force boarding school complexity onto a 3-classroom rural primary.

---

## 3. Current System Assessment

*Based entirely on verified audit findings. See `/docs/architecture/audits/` for source evidence.*

### 3.1 Strengths

| Strength | Evidence |
|---|---|
| Modular controller architecture (60+ controllers) | Codebase inspection |
| Prisma ORM with typed migrations | `server/prisma/schema.prisma` |
| Granular permission middleware | `permissions.middleware.ts` |
| Multi-provider SMS with env-var fallback | `sms.service.ts` |
| Real-time notifications (Socket.io + Web Push) | `notification.service.ts` |
| Multi-step approval workflow engine | `approvalEngine.service.ts` |
| Staff attendance: mature, geofenced, payroll-integrated | `hr.service.ts`, audit |
| Assessment SMS audit trail | `assessment_sms_audits` table |
| Transport billing integrated with fee invoices | `transport.controller.ts` |
| Cron infrastructure with multiple scheduled jobs | `cron-worker.ts` |
| Biometric webhook infrastructure (device-agnostic) | `biometric.service.ts` |
| Family access model (multi-guardian) | `parent-access.service.ts` |

### 3.2 Weaknesses

| Weakness | Severity | Audit Source |
|---|---|---|
| No unified presence layer — 3+ isolated attendance silos | HIGH | PRESENCE_ENGINE_PROPOSAL |
| Biometric templates stored unencrypted | CRITICAL | BIOMETRICS_AUDIT |
| No absent-child SMS notification | HIGH | COMMUNICATION_AUDIT |
| No hostel/boarding module | HIGH | HOSTEL_AUDIT |
| No transport attendance events | HIGH | TRANSPORT_AUDIT |
| WhatsApp via wwebjs (unofficial, fragile) | MEDIUM | COMMUNICATION_AUDIT |
| Attendance lock time config not enforced | MEDIUM | ATTENDANCE_AUDIT |
| No chronic absenteeism detection | MEDIUM | GAP_ANALYSIS |
| No SMS retry mechanism | MEDIUM | COMMUNICATION_AUDIT |
| `markedBy` on attendances is a plain string (no FK) | LOW | DATABASE_AUDIT |
| `passengerId` on transport assignments untyped | LOW | DATABASE_AUDIT |
| Single large Prisma schema file | LOW | DATABASE_AUDIT |

### 3.3 Technical Debt Register

| Item | Classification | Priority |
|---|---|---|
| Biometric templates unencrypted in `biometric_credentials` | Security debt | P0 — fix before new biometric work |
| Absent learner SMS not implemented | Feature debt | P1 |
| Bulk attendance not wrapped in transaction | Reliability debt | P2 |
| WhatsApp wwebjs library | Infrastructure debt | P2 |
| SMS failures not retried | Reliability debt | P2 |
| `markedBy` string field without FK | Schema debt | P3 |
| Growing schema in one file | Maintainability debt | P3 |
| No `schoolId` on biometric devices | Schema debt | P2 |
| Attendance lock time config dead | Feature debt | P1 |

### 3.4 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Biometric data breach (templates unencrypted) | MEDIUM | CRITICAL | Encrypt immediately — P0 |
| WhatsApp wwebjs disconnected by WhatsApp | HIGH | MEDIUM | Migrate to official WABA API |
| Schema growth makes migrations error-prone | MEDIUM | MEDIUM | Split schema into domain files |
| Multi-school data leak (missing schoolId scoping) | LOW | CRITICAL | Audit all queries in new modules |
| Cron job failures silently drop SMS | MEDIUM | MEDIUM | Add alerting on cron failures |

---

## 4. Target Architecture

### 4.1 Architecture Overview

TrendSCORE 2.0 is a layered monolith with event-driven cross-cutting concerns. It is not a microservices system. The decision to remain a monolith is explicit and justified in ADR-001.

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                    │
│  React SPA (Vite)  ·  Parent Mobile PWA  ·  Driver Mobile Web   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS / WebSocket
┌─────────────────────────────▼───────────────────────────────────┐
│  API GATEWAY LAYER (Express)                                     │
│  Authentication  ·  Rate Limiting  ·  Audit Logging  ·  CORS    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  DOMAIN LAYER                                                    │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │Attendance│ │  Staff   │ │Transport │ │    Boarding      │  │
│  │ Domain   │ │  HR      │ │ Domain   │ │    Domain        │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
│       │            │            │                 │             │
│  ┌────▼─────────────▼────────────▼─────────────────▼─────────┐ │
│  │            PRESENCE PLATFORM (Cross-Cutting)               │ │
│  │  PresenceService  ·  TimelineEngine  ·  RulesEngine        │ │
│  └────────────────────────────┬───────────────────────────────┘ │
│                               │                                 │
│  ┌──────────┐ ┌──────────┐ ┌─▼────────┐ ┌──────────────────┐  │
│  │ Finance  │ │  LMS     │ │Biometric │ │  Communication   │  │
│  │ Domain   │ │  Domain  │ │ Domain   │ │  Domain          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  INFRASTRUCTURE LAYER                                            │
│  PostgreSQL (Supabase)  ·  Redis Cache  ·  Socket.io            │
│  SMS Providers  ·  Web Push  ·  Email (Resend)                  │
│  Biometric Device Bridge  ·  Cron Worker                        │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Module Hierarchy

#### Core Domains (Existing — Stable)
- **Academic** — assessments, grading, CBC, schemes of work, timetable
- **Student Management** — learners, admissions, enrollments, pathways
- **Finance** — fees, invoices, payments, M-Pesa, waiver, payroll
- **Staff / HR** — staff directory, leave, payroll, performance, clock-in/out
- **Communication** — SMS, email, push, in-app notifications, broadcast
- **Library** — books, members, loans, fines, automation
- **LMS** — lessons, assignments, submissions, marketplace
- **Transport** — vehicles, routes, assignments, billing

#### Evolving Domains (Partial — To Complete)
- **Attendance** — student daily attendance (manual + biometric bridge)
- **Biometrics** — devices, credentials, logs, SDK adapters

#### New Domains (To Build)
- **Boarding** — dormitories, beds, roll call, exeat, dining, prep
- **Visitor / Gate** — visitor registration, entry/exit, ID verification
- **Presence Platform** — cross-cutting event aggregation (see Section 5)

#### Infrastructure Domains (Shared)
- **Auth** — authentication, OTP, sessions, impersonation
- **Notifications** — in-app, push, socket delivery
- **Approvals** — multi-step workflow engine
- **Audit** — change history, system logs
- **Config** — school settings, communication config, term config

### 4.3 Interaction Model

Modules interact in three ways only:

1. **Direct service call** — within the same bounded context
2. **Presence event emission** — when a module produces a presence fact
3. **REST API call** — when a module exposes data for another module's UI to display

Cross-module direct database queries are forbidden in new code.

---

## 5. Presence Platform

The Presence Platform is the most significant architectural addition in TrendSCORE 2.0. It is a cross-cutting service layer — not a module — that sits beneath all domain modules and aggregates presence facts from every source.

### 5.1 Responsibilities

The Presence Platform is responsible for:

1. **Recording** every presence event from every module in a single, standardised table
2. **Routing** notifications triggered by presence events (absent child, late arrival, exeat overdue)
3. **Deriving** a person's current presence state from their event history
4. **Providing** a unified timeline API for the parent portal
5. **Detecting** anomalies via a rules engine (e.g. boarded bus but never reached class)
6. **Reporting** aggregate presence metrics for school leadership

The Presence Platform does **not** own primary attendance data. It aggregates copies of presence facts. Domain modules remain the source of truth for their own data.

### 5.2 Core Services

#### PresenceService

The single emission point. All domain modules call `PresenceService.emit(event)`. It writes to `presence_events` and triggers downstream routing.

```
Methods:
  emit(event: PresenceEvent): Promise<PresenceEvent>
  getPersonTimeline(personId, date): Promise<PresenceEvent[]>
  getCurrentStatus(personId): Promise<PresenceStatus>
  getSchoolSnapshot(schoolId, date): Promise<PresenceSnapshot>
```

#### TimelineEngine

Assembles a chronological, human-readable presence timeline for a person on a given day. Used by the parent portal.

```
Methods:
  buildTimeline(personId, date): Promise<TimelineEntry[]>
  buildSummary(personId, startDate, endDate): Promise<TimelineSummary>
```

A `TimelineEntry` carries: timestamp, eventType, context, location, description (human-readable), source (MANUAL / BIOMETRIC / DRIVER / SYSTEM).

#### RulesEngine

Evaluates configurable rules against the presence event stream. Rules fire notifications and alerts.

```
Built-in rules:
  ABSENT_NO_EXCUSE          — Learner has no CLASS_ATTENDANCE by lock time, no excuse recorded
  BUS_NO_ARRIVAL            — BUS_BOARDED but no CLASS_ATTENDANCE within 90 minutes
  EXEAT_OVERDUE             — EXEAT_DEPARTED but no EXEAT_RETURNED by return date
  DORM_ABSCOND              — No DORM_ROLL_CALL at night but was present in class during day
  LATE_PATTERN              — LATE attendance on 3+ days in a rolling 5-day window
  CHRONIC_ABSENT            — Absence rate exceeds school-configured threshold (default 20%)
```

Rules are stored in `presence_rules` table, configurable per school.

#### PresenceNotificationRouter

Subscribes to rule violations and dispatches to the appropriate channel (SMS, push, in-app) for the appropriate recipient (parent, teacher, house master, admin).

```
Routes:
  ABSENT_NO_EXCUSE     → SMS to parent + in-app to class teacher
  BUS_NO_ARRIVAL       → SMS to parent + in-app to admin
  EXEAT_OVERDUE        → SMS to parent + in-app to house master + in-app to admin
  CHRONIC_ABSENT       → in-app to class teacher + head teacher
  LATE_PATTERN         → in-app to class teacher
```

### 5.3 Presence Controllers

```
GET  /api/presence/learner/:id/today        — Parent/teacher: today's timeline
GET  /api/presence/learner/:id/summary      — Summary for date range
GET  /api/presence/school/snapshot          — Admin: full school presence snapshot
GET  /api/presence/school/absent-today      — Admin: list of absent learners today
GET  /api/presence/rules                    — Admin: list configured rules
PUT  /api/presence/rules/:id                — Admin: update rule threshold
```

### 5.4 Presence Workers (Cron)

| Worker | Schedule | Purpose |
|---|---|---|
| AbsentLearnerSmsWorker | Daily 09:30 EAT | Send absent SMS to parents after attendance window closes |
| ExeatOverdueWorker | Daily 06:00 EAT | Detect learners who haven't returned from leave |
| ChronicAbsentWorker | Weekly Monday 07:00 EAT | Identify learners exceeding absence threshold |
| BusNoArrivalWorker | Runs 90 min after each trip departs | Detect boarded-but-not-arrived anomalies |
| NightRollCallWorker | Daily 22:00 EAT | Detect boarding learners absent from night roll call |

### 5.5 Event Publishers (by Domain)

| Domain | Events Published |
|---|---|
| Attendance (student) | CLASS_ATTENDANCE |
| HR (staff) | CLOCK_IN, CLOCK_OUT |
| Biometrics | GATE_ENTRY, GATE_EXIT (+ delegates to domain handlers) |
| Transport | BUS_BOARDED, BUS_ALIGHTED |
| Boarding | DORM_ROLL_CALL, DINING_ATTENDED, PREP_ATTENDED, EXEAT_DEPARTED, EXEAT_RETURNED |
| Library | LIBRARY_VISITED |
| Visitor/Gate | VISITOR_ENTRY, VISITOR_EXIT |
| Clinic (future) | CLINIC_VISITED |

### 5.6 Parent Timeline (Guardian View)

The parent-facing timeline presents a day-by-day narrative:

```
Today — [Child Name]

07:14  Boarded School Bus (Route 3 — Ngong Road)
07:52  Arrived at School (Gate Entry)
08:01  Marked Present — Grade 5B
12:30  Library Visit
14:00  After-School Club — Drama
17:20  Boarded School Bus (Route 3 — homebound)
```

For boarding schools, the timeline extends to:
```
20:30  Present — Evening Prep
22:00  Present — Night Roll Call (Dorm B)
```

The timeline is populated by the TimelineEngine from `presence_events`. Parents do not have direct access to any domain table.

### 5.7 Presence Analytics

Available to school administrators:

- Daily attendance rate (per class, per grade, school-wide)
- Weekly absence trend
- Chronic absentee list with risk score
- Late arrival pattern by class
- Transport utilisation vs attendance correlation
- Boarding roll call compliance rate

---

## 6. Domain-Driven Design

### 6.1 Bounded Contexts

Each bounded context owns its data, defines its own language, and publishes its output through well-defined interfaces.

---

#### Context: Attendance

**Owns:** `attendances`, `attendance_lock_config` (derived from school config)  
**Responsibility:** Recording whether a learner was present, absent, late, excused, or sick on a school day. Enforcing lock time windows. Providing daily registers and summary statistics to teachers.  
**Publishes:** `CLASS_ATTENDANCE` presence event on every mark.  
**Does not own:** Biometric data, parent notification logic, transport boarding.  
**Language:** mark, register, attendance date, lock time, status, bulk mark.

---

#### Context: Staff HR

**Owns:** `staff_attendance_logs`, `staff_attendance_attempt_logs`, `leave_requests`, `leave_types`, `payroll_records`, `performance_reviews`, `staff_allowances`, `staff_deductions`  
**Responsibility:** Staff daily clock-in/out, leave management, payroll generation, performance tracking, geofence and IP enforcement.  
**Publishes:** `CLOCK_IN`, `CLOCK_OUT` presence events.  
**Language:** clock-in, clock-out, geofence, leave balance, payslip, basic salary, deduction.

---

#### Context: Biometrics

**Owns:** `biometric_devices`, `biometric_credentials`, `biometric_logs`  
**Responsibility:** Device registry, biometric template enrollment (encrypted), raw event reception, dispatch to domain handlers, SDK adapters for hardware vendors.  
**Publishes:** `GATE_ENTRY`, `GATE_EXIT` — delegates `CLASS_ATTENDANCE` / `CLOCK_IN` to domain handlers.  
**Does not own:** Attendance records, staff logs. It triggers them.  
**Language:** device, terminal, enrollment, template, scan, direction (IN/OUT), log, sync.

---

#### Context: Transport

**Owns:** `transport_vehicles`, `transport_routes`, `transport_assignments`, `transport_trips` (new), `transport_boarding_events` (new)  
**Responsibility:** Fleet management, learner/staff route assignment, capacity enforcement, transport billing, daily trip tracking, boarding confirmation.  
**Publishes:** `BUS_BOARDED`, `BUS_ALIGHTED` presence events.  
**Language:** vehicle, route, assignment, trip, boarding, alighting, pickup point, driver.

---

#### Context: Boarding

**Owns:** `dormitories`, `dormitory_beds`, `dormitory_assignments`, `house_master_assignments`, `exeat_requests`, `dorm_roll_calls`, `dorm_roll_call_entries`, `dining_attendance`, `prep_attendance`  
**Responsibility:** Dormitory allocation, nightly and morning roll calls, exeat request and approval workflow, dining and prep attendance, house master management.  
**Publishes:** `DORM_ROLL_CALL`, `DINING_ATTENDED`, `PREP_ATTENDED`, `EXEAT_DEPARTED`, `EXEAT_RETURNED`.  
**Language:** dormitory, dorm, bed, house master, roll call, exeat, prep, matron.

---

#### Context: Finance

**Owns:** `fee_invoices`, `fee_payments`, `fee_structures`, `fee_types`, `fee_waivers`, `fine`, `accounting_entries`  
**Responsibility:** Invoice generation, payment recording, M-Pesa integration, transport billing sync, fee waiver workflow.  
**Consumes:** Transport assignment events (billing sync). Does not interact with attendance directly.  
**Language:** invoice, payment, balance, waiver, instalment, fine, ledger.

---

#### Context: Communication

**Owns:** `communication_config`, `assessment_sms_audits`, `parent_sms_replies` (new), `user_notifications`, `push_subscriptions`  
**Responsibility:** Outbound SMS/email/push, inbound SMS parsing, notification delivery and persistence, broadcast messaging, communication configuration.  
**Consumes:** Presence events (via PresenceNotificationRouter). Does not produce presence events.  
**Language:** SMS, push, in-app, broadcast, template, delivery status, retry, inbound reply.

---

#### Context: Presence

**Owns:** `presence_events`, `presence_rules`, `presence_rule_violations`  
**Responsibility:** Aggregating all presence facts from all domains, running the rules engine, providing timeline APIs, triggering notification routing.  
**Consumes:** Events from all other domains. Calls CommunicationService for notification delivery.  
**Does not own:** Primary data in any domain. It is an aggregator, not a source of truth.  
**Language:** event, timeline, context, snapshot, rule, violation, anomaly.

---

#### Context: Library

**Owns:** `library_members`, `books`, `book_loans`, `library_fines`, `library_automation_config`  
**Responsibility:** Book catalogue, member management, loan lifecycle, fine assessment and automation, overdue SMS.  
**Publishes:** `LIBRARY_VISITED` presence event on loan/return.

---

#### Context: LMS

**Owns:** `learning_lessons`, `learning_assignments`, `learning_submissions`, `learning_resources`, `lms_enrollments`, `marketplace_listings`  
**Responsibility:** Digital learning content, assignment distribution, submission marking, marketplace, learning analytics.  
**Publishes:** (Indirect) lesson completion can proxy as online presence indicator.

---

#### Context: Visitor / Gate

*(New — future context)*  
**Owns:** `visitors`, `visitor_logs`, `gate_events`  
**Responsibility:** Visitor pre-registration, ID capture, gate entry/exit recording, restricted person alerts.  
**Publishes:** `VISITOR_ENTRY`, `VISITOR_EXIT` presence events.

---

#### Context: Shared / Platform

**Owns:** `users`, `schools`, `streams`, `classes`, `class_enrollments`, `term_configs`, `approval_requests`, `approval_actions`, `audit_logs`, `system_logs`  
**Responsibility:** Authentication, authorisation, school configuration, academic structure, cross-cutting approval engine, system audit.  
**Rules:** All other contexts depend on Shared. Shared never depends on domain contexts.

---

## 7. Database Evolution

### 7.1 Governing Principles

- The current PostgreSQL schema is the starting point, not a problem to solve
- No table is dropped in TrendSCORE 2.0
- Migrations are sequential and individually reversible
- Each migration is scoped to a single concern (one table, one index, one constraint)
- Migration naming convention: `YYYYMMDD_NNN_description` (e.g. `20260901_001_add_presence_events`)
- All migrations are reviewed before execution against production

### 7.2 Critical Migrations (Pre-Development)

These must ship before any new feature work begins:

| Priority | Migration | Purpose |
|---|---|---|
| P0 | Encrypt existing `biometric_credentials.template` values | Close security gap |
| P0 | Add `encryptedAt`, `keyVersion` to `biometric_credentials` | Encryption metadata |
| P1 | Add `source` to `attendances` (MANUAL / BIOMETRIC / BULK / IMPORT) | Audit trail |
| P1 | Add `updatedAt` to `attendances` | Change tracking |
| P1 | Add `schoolId` to `biometric_devices`, `biometric_logs` | Multi-tenancy |
| P2 | Add FK constraint for `attendances.markedBy → users.id` (nullable) | Referential integrity |

### 7.3 Presence Platform Migrations

| Sequence | Migration |
|---|---|
| 001 | Create `presence_events` table |
| 002 | Create `presence_rules` table |
| 003 | Create `presence_rule_violations` table |
| 004 | Add indexes: `(personId, timestamp)`, `(schoolId, timestamp)`, `(eventType, timestamp)` |

### 7.4 Transport Evolution Migrations

| Sequence | Migration |
|---|---|
| 005 | Create `transport_trips` table |
| 006 | Create `transport_boarding_events` table |
| 007 | Add `schoolId` to `transport_vehicles`, `transport_routes` |

### 7.5 Communication Migrations

| Sequence | Migration |
|---|---|
| 008 | Create `parent_sms_replies` table |
| 009 | Create `sms_outbound_audit` table (generalises assessment_sms_audits) |

### 7.6 Boarding Module Migrations

| Sequence | Migration |
|---|---|
| 010 | Create `dormitories` table |
| 011 | Create `dormitory_beds` table |
| 012 | Create `dormitory_assignments` table |
| 013 | Create `house_master_assignments` table |
| 014 | Create `exeat_requests` table |
| 015 | Create `dorm_roll_calls` table |
| 016 | Create `dorm_roll_call_entries` table |
| 017 | Create `dining_attendance` table |
| 018 | Create `prep_attendance` table |

### 7.7 Biometric Completion Migrations

| Sequence | Migration |
|---|---|
| 019 | Alter `biometric_credentials.template` type to `Bytes` (binary) |
| 020 | Add `enrolledAt`, `status`, `deviceId`, `keyVersion` to `biometric_credentials` |
| 021 | Add `retryCount`, `retryAt`, `rawPayload` to `biometric_logs` |
| 022 | Add `serialNumber`, `firmwareVersion`, `syncMode` to `biometric_devices` |

### 7.8 Rollback Strategy

Every migration that adds a column or table has a corresponding rollback that drops the column/table. Migrations that modify existing data (e.g. encryption of biometric templates) must:

1. Be executed with a backup checkpoint before running
2. Process records in batches (never all at once)
3. Be idempotent — safe to run twice
4. Produce a count report: rows processed, rows skipped, rows failed

No destructive migration ships to production without a signed-off rollback script.

### 7.9 Schema Organisation (Future State)

As the schema grows, split into domain-scoped files loaded by a master schema:
```
server/prisma/
  schema/
    shared.prisma      — User, School, Stream, Class, Enrollment
    attendance.prisma  — Attendance, AttendanceStatus
    hr.prisma          — StaffAttendanceLog, LeaveRequest, Payroll
    biometric.prisma   — BiometricDevice, BiometricCredential, BiometricLog
    transport.prisma   — TransportVehicle, TransportRoute, TransportAssignment, Trip
    boarding.prisma    — Dormitory, ExeatRequest, RollCall
    presence.prisma    — PresenceEvent, PresenceRule
    finance.prisma     — FeeInvoice, FeePayment, FeeStructure
    communication.prisma — CommunicationConfig, SmsAudit
    lms.prisma
    library.prisma
  schema.prisma        — @import aggregator (when Prisma supports multi-file)
```
*Note: Prisma multi-file schema support is experimental as of 2026. The split is the target state; migration to it follows Prisma's roadmap.*

---

## 8. API Standards

### 8.1 Naming

- Base path: `/api/v1/` for all new endpoints (see 8.2 for versioning)
- Existing endpoints at `/api/` retain their paths — no breaking renames
- Resource names are **plural nouns**: `/api/presence/events`, `/api/boarding/dormitories`
- Sub-resources use nested paths: `/api/boarding/dormitories/:id/beds`
- Actions that are not CRUD use verb-prefixed paths: `/api/attendance/lock`, `/api/biometric/sync`
- No abbreviations in route names (not `/api/att`, use `/api/attendance`)

### 8.2 Versioning

- Existing APIs at `/api/` are frozen at their current shape
- New modules launch at `/api/v1/`
- A breaking change to an existing `/api/` endpoint requires a `/api/v1/` variant and a deprecation notice in the response headers: `Deprecation: true`, `Sunset: <date>`
- Version is in the URL path, not the header
- All versions are supported for a minimum of 12 months after a newer version is released

### 8.3 Request / Response Standards

**Success response envelope:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message",
  "meta": {
    "count": 100,
    "page": 1,
    "pageSize": 20,
    "totalCount": 450
  }
}
```

**Error response envelope:**
```json
{
  "success": false,
  "error": {
    "code": "ATTENDANCE_LOCK_CLOSED",
    "message": "Attendance window has closed for today",
    "field": "date",
    "details": {}
  }
}
```

- Errors always include a machine-readable `code` string
- Error codes are documented per-module
- HTTP status codes are used correctly: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorised, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable Entity, 500 Internal Server Error

### 8.4 DTOs and Validation

- All incoming request bodies are validated with Zod schemas
- DTOs are defined as TypeScript interfaces in `src/types/`
- No raw `req.body` access without prior validation
- Validation schemas co-located with their routes or in a `validators/` directory
- Input strings are trimmed before validation
- Dates are validated as ISO 8601; all stored/compared in UTC

### 8.5 Pagination

- All list endpoints support `page` and `pageSize` query parameters
- Default `pageSize` is 20; maximum is 100
- Response includes `meta.totalCount` for UI pagination controls
- Cursor-based pagination is preferred for high-volume feeds (e.g. presence events)

### 8.6 Permissions

- Every route declares its required permission string
- Permission strings follow the pattern: `VERB_RESOURCE` (e.g. `MARK_ATTENDANCE`, `VIEW_PRESENCE_TIMELINE`, `MANAGE_BIOMETRIC_DEVICES`)
- New modules must enumerate all their permissions in a permissions registry file
- No route is accessible without authentication except documented public webhooks
- Public webhooks (e.g. biometric device log, SMS callback) use device tokens or HMAC signatures — not user sessions

### 8.7 Rate Limiting

- Write operations (POST, PUT, PATCH, DELETE): 60 requests/minute per user
- Read operations (GET): 300 requests/minute per user
- Public webhook endpoints: 500 requests/minute per device token
- SMS/email triggers: 10 per minute per user to prevent abuse

---

## 9. Event Architecture

### 9.1 Design Philosophy

TrendSCORE 2.0 uses **in-process synchronous events with database persistence**, not a message broker. This is an explicit architectural decision (see ADR-002). Events are written to the `presence_events` table inside the same Prisma transaction as the primary domain write. This provides:

- Atomicity: the attendance record and its presence event are written together or not at all
- No infrastructure dependency: no Kafka, RabbitMQ, or Redis Streams required
- Debuggability: events are queryable rows, not invisible queue messages
- Simplicity: the pattern is a service call, not a broker subscription

When/if TrendSCORE scales to a multi-school SaaS platform requiring true async fan-out, this decision is revisited in a future ADR.

### 9.2 Standard Presence Event Payload

```typescript
interface PresenceEvent {
  id: string;                    // UUID, generated on write
  schoolId: string;              // Required — multi-tenancy key
  personId: string;              // Internal UUID of the person
  personType: PersonType;        // LEARNER | STAFF | VISITOR
  eventType: PresenceEventType;  // See 9.3
  context: PresenceContext;      // See 9.4
  timestamp: Date;               // When the event actually occurred
  recordedAt: Date;              // When it was written to the database
  recordedBy?: string;           // userId if manually recorded
  deviceId?: string;             // biometric_devices.id if automated
  location?: string;             // Human-readable location label
  direction?: 'IN' | 'OUT';      // For gate/bus/dorm events
  status: EventStatus;           // CONFIRMED | PENDING | DISPUTED
  sourceModule: SourceModule;    // Which domain emitted this
  sourceRecordId?: string;       // FK to the originating record
  metadata?: Record<string, unknown>; // Module-specific extras
  version: number;               // Schema version, default 1
}
```

### 9.3 Event Type Enumeration

```
CLASS_ATTENDANCE    GATE_ENTRY          GATE_EXIT
BUS_BOARDED         BUS_ALIGHTED        DORM_ROLL_CALL
DINING_ATTENDED     PREP_ATTENDED       ASSEMBLY_ATTENDED
LIBRARY_VISITED     CLINIC_VISITED      EXEAT_DEPARTED
EXEAT_RETURNED      CLOCK_IN            CLOCK_OUT
VISITOR_ENTRY       VISITOR_EXIT
```

### 9.4 Context Enumeration

```
SCHOOL    CLASS     BUS         DORMITORY    DINING_HALL
LIBRARY   CLINIC    ASSEMBLY    PREP_HALL    GATE
OFF_CAMPUS EXEAT
```

### 9.5 Source Module Enumeration

```
ATTENDANCE    HR_STAFF     BIOMETRIC    TRANSPORT
BOARDING      LIBRARY      VISITOR      SYSTEM
```

### 9.6 Event Publishers Contract

Every domain module that emits presence events must:

1. Call `PresenceService.emit()` inside the same transaction as the primary write
2. Pass a `sourceRecordId` pointing to the domain table row
3. Handle `emit()` failures gracefully — a failed presence event must not rollback the primary domain operation (presence is additive, not authoritative)
4. Log the failure with enough context for manual reconciliation

### 9.7 Idempotency

Events are idempotent by `(personId, eventType, timestamp)`. If the same event is submitted twice within a 5-minute window, the second write is a no-op and returns the existing event. This handles device retries without creating duplicate presence records.

### 9.8 Event Versioning

The `version` field allows the event schema to evolve. Current version is `1`. If the payload structure changes materially, `version` increments. The TimelineEngine and RulesEngine must handle all supported versions. Old events are never re-written to a new version.

### 9.9 Retry and Failure Strategy

Since events are written synchronously inside Prisma transactions, they either succeed with the primary write or fail with it. There is no async retry queue. However:

- A `presence_event_failures` table captures cases where `emit()` threw after the primary write succeeded
- A nightly reconciliation worker checks this table and re-emits failed events
- Events older than 30 days in the failure table are moved to an archive table

---

## 10. Security

### 10.1 Authentication

- JWT-based sessions with short-lived access tokens (15 minutes) and refresh tokens (7 days)
- OTP-based phone verification for parent login (existing `auth-phone-otp.service.ts`)
- Student portal login via admission number + password (existing `studentPhoneLogin`)
- Multi-role support: a user may hold multiple roles simultaneously
- Session invalidation on password change or explicit logout
- Login attempt limiting: account locked after 5 failed attempts within 15 minutes

### 10.2 Authorisation

- Permission-based RBAC enforced at the route middleware layer
- Permission strings are the unit of control, not role names (roles are role-to-permissions mappings)
- Every route explicitly declares its required permission
- Teachers are scope-restricted to their assigned classes — enforced in service methods, not just routes
- Parents are scope-restricted to their linked learners via `parentAccessService`
- House masters (boarding) are scope-restricted to their assigned dormitories
- Device tokens (biometric webhook, SMS callback) are verified by token value, not by user session

### 10.3 Biometric Security

This is the highest-risk area identified in the audit.

**Immediate requirements (P0):**
- All new `biometric_credentials.template` values stored encrypted with AES-256-GCM
- A `keyVersion` field tracks which encryption key was used
- Key rotation is possible without re-enrolling devices (decrypt with old key, re-encrypt with new key)
- Encryption keys are stored in environment variables or a secrets manager — never in the database
- Raw biometric templates are never transmitted in API responses — only credential metadata (id, type, enrolledAt, quality)

**Device authentication:**
- Each device has a unique `token` (32-byte random, generated at registration)
- The token is transmitted in `Authorization: Bearer <token>` header on webhook calls
- Tokens are rotated on request by admin
- Failed device authentication attempts are logged and rate-limited

### 10.4 Data Protection

- Personal data (name, phone, email, DOB) is stored as-is — encryption at rest is handled by Supabase
- Phone numbers in SMS audit tables are masked in logs: `+2547****890`
- Parent SMS replies containing sensitive content are not echoed in admin views
- Student photos are stored with Cloudinary — public IDs retained in DB, not raw URLs unless needed
- NEMIS data (upiNumber) is treated as sensitive — not included in bulk export responses

### 10.5 API Security

- All routes require HTTPS (enforced at reverse proxy / Supabase level)
- CORS is configured with an explicit allowlist — no wildcard origin in production
- Content Security Policy headers set on all responses
- SQL injection: not applicable — Prisma uses parameterised queries exclusively
- Rate limiting applied globally and per-route (Section 8.7)
- Input validation with Zod on all write endpoints prevents injection via payload
- Request size limits enforced (max 10MB for file upload endpoints, 1MB for all others)

### 10.6 Secrets Management

- Environment variables for all secrets (database URLs, API keys, VAPID keys, encryption keys)
- `.env` files are never committed — `.env.example` with placeholder values is the documented contract
- Biometric encryption keys use a separate `BIOMETRIC_ENCRYPTION_KEY` env var, not shared with other services
- SMS API keys stored encrypted in `communication_config.smsApiKey` (AES encrypted with `ENCRYPTION_KEY` env var)

### 10.7 Audit Logging

Every write operation in a sensitive context produces an audit log entry:
- User/admin actions: `change_history` table
- Biometric events: `biometric_logs` table
- Attendance corrections: `staff_attendance_attempt_logs`
- Financial operations: accounting ledger
- Approval decisions: `approval_actions`
- System events: `system_logs`

New modules must define their audit events explicitly before implementation begins.

---

## 11. Repository Organisation

### 11.1 Current Structure (As-Found)

```
TrendSCORE/
  src/                    ← React frontend
  server/                 ← Express backend
    src/
      controllers/        ← One file per domain controller
      services/           ← One file per service
      routes/             ← One file per route group
      middleware/
      utils/
      types/
    prisma/
      schema.prisma
      migrations/
```

This flat structure works at the current scale. It will become difficult to navigate as new domains are added.

### 11.2 Target Backend Structure

The target structure organises by domain first, then by layer:

```
server/src/
  domains/
    attendance/
      attendance.controller.ts
      attendance.service.ts
      attendance.routes.ts
      attendance.types.ts
      attendance.validators.ts
    presence/
      presence.service.ts
      presence.controller.ts
      presence.routes.ts
      timeline.engine.ts
      rules.engine.ts
      presence.workers.ts
      presence.types.ts
    biometrics/
      biometric.controller.ts
      biometric.service.ts
      biometric.routes.ts
      biometric.encryption.ts
      adapters/
        zkteco.adapter.ts
        hikvision.adapter.ts
    transport/
      transport.controller.ts
      transport.service.ts
      transport.routes.ts
      trips/
        trip.controller.ts
        trip.service.ts
    boarding/
      boarding.controller.ts
      boarding.service.ts
      boarding.routes.ts
      exeat/
      rollcall/
      dining/
    hr/
      hr.controller.ts
      hr.service.ts
      hr.routes.ts
    communication/
      sms.service.ts
      email.service.ts
      notification.service.ts
      whatsapp.service.ts
      inbound/
        sms-callback.controller.ts
        sms-reply.service.ts
    finance/
    library/
    lms/
    academic/
    visitor/
  shared/
    config/
    middleware/
    utils/
    types/
  infrastructure/
    database.ts
    redis.ts
    socket.ts
    cron-worker.ts
```

**Migration path:** The move to domain-grouped structure is incremental. New modules are created in `domains/`. Existing modules are migrated when they next receive significant changes. No big-bang refactor.

### 11.3 Target Frontend Structure

```
src/
  domains/
    attendance/
      components/
      hooks/
      pages/
      services/
    presence/
      components/
      hooks/
      pages/
    boarding/
    transport/
    hr/
    finance/
    lms/
    library/
  shared/
    components/
    hooks/
    utils/
    types/
  design-system/
  app/
    App.jsx
    router.tsx
```

### 11.4 Documentation Structure

```
docs/
  architecture/           ← Governing specifications (this file)
    00_MASTER_ARCHITECTURE_SPECIFICATION.md
    01_TECHNICAL_ARCHITECTURE.md
    02_DATABASE_EVOLUTION.md
    03_EVENT_ARCHITECTURE.md
    04_API_STANDARDS.md
    05_SECURITY.md
    audits/               ← Historical forensic evidence (read-only)
  implementation/
    backlog/              ← Prioritised feature backlog items
    sprints/              ← Sprint planning documents
    codex/                ← Codex agent task files
    kiro/                 ← Kiro agent task files
    adr/                  ← Architecture Decision Records
  decisions/              ← Major product decisions
```

---

## 12. Coding Standards

### 12.1 Language and Runtime

- TypeScript strict mode on all new files (`"strict": true` in tsconfig)
- Node.js LTS version
- ES modules in backend (existing CommonJS interop maintained for legacy files)
- React 18+ on frontend

### 12.2 Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Files | kebab-case | `attendance.service.ts` |
| Classes | PascalCase | `AttendanceService` |
| Interfaces | PascalCase, no `I` prefix | `PresenceEvent`, not `IPresenceEvent` |
| Enums | PascalCase (type), SCREAMING_SNAKE (values) | `AttendanceStatus.PRESENT` |
| Functions / methods | camelCase | `markAttendance()` |
| Variables | camelCase | `attendanceDate` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Database tables | snake_case | `presence_events` |
| Prisma models | PascalCase | `PresenceEvent` |
| API routes | kebab-case | `/api/v1/dorm-roll-calls` |
| Environment variables | SCREAMING_SNAKE | `BIOMETRIC_ENCRYPTION_KEY` |

### 12.3 Service Layer Standards

- Services are classes, instantiated once and exported as singletons
- Service methods are async, return typed values (no `any` return types)
- Every service method that writes to the database accepts a Prisma transaction client parameter when it may be called inside a transaction
- Services do not access `req` or `res` — that is the controller's job
- Services do not import other domain services directly for cross-context operations — they call `PresenceService.emit()` or trigger communication through the notification service

### 12.4 Controller Layer Standards

- Controllers are thin — they parse, validate, call service, respond
- No business logic in controllers
- All async controller methods use `asyncHandler` wrapper (already in place)
- Controller methods are bound in route registration (`controller.method.bind(controller)`)
- Response shapes follow the standard envelope (Section 8.3)

### 12.5 Repository / Data Access Standards

- Prisma is the only ORM. No raw SQL except for complex analytics queries, and those must be in a dedicated `analytics.repository.ts`
- All queries that could return many rows have a `take` limit to prevent accidental full-table scans
- `findMany` without a `where` clause requires explicit justification in a code comment
- All `findFirst` calls that must return a result use `findFirstOrThrow` or explicit null checks
- UTC dates: all dates stored in UTC, all date arithmetic in UTC, all comparisons in UTC

### 12.6 Error Handling

- `ApiError` class for known domain errors (already in place)
- Unknown errors are caught by the global error middleware and logged with stack trace
- No `console.log` in new code — all logging through the `logger` utility
- Error messages facing the user are human-readable. Error messages facing the system include context (userId, entityId, operation)

### 12.7 Logging

- Log levels: `error`, `warn`, `info`, `debug`
- Production: `info` and above
- Development: `debug` and above
- Log format: structured JSON in production, pretty-printed in development
- Every cron job: `info` at start and end, `error` on failure
- Every external API call (SMS, email, payment): `info` on success, `error` on failure with response body

### 12.8 Comments

- JSDoc comments on all public service methods
- No inline comments that repeat what the code says
- Inline comments explain *why*, not *what*
- `TODO:` comments must include a ticket/issue reference: `// TODO: TS-142 — add retry logic`

---

## 13. Testing Strategy

### 13.1 Philosophy

Tests are written to give confidence that the system behaves correctly under realistic conditions. The goal is not 100% line coverage — it is confidence in critical paths. Tests that test the obvious are noise. Tests that guard against regression, edge cases, and security boundaries are valuable.

### 13.2 Test Pyramid

```
          /\
         /  \  E2E Tests (small set, happy paths)
        /────\
       /      \  Integration Tests (API-level, DB-in-loop)
      /────────\
     /          \  Unit Tests (services, engines, utilities)
    /────────────\
```

### 13.3 Unit Tests

**Target:** All service methods with non-trivial logic  
**Framework:** Jest (already in place)  
**Pattern:** Arrange / Act / Assert  
**Mocking:** Prisma is mocked via `jest.mock`; external services (SMS, email) are mocked

Priority unit test targets:
- `PresenceService.emit()` — idempotency, version handling, failure recording
- `RulesEngine` — each rule evaluated correctly against sample event sets
- `TimelineEngine` — correct chronological ordering, correct human-readable descriptions
- `BiometricService.processAttendanceLog()` — device validation, LATE detection logic
- `SmsService.validatePhoneNumber()` — edge cases already exist, extend coverage
- `AttendanceController.markBulkAttendance()` — transaction rollback on partial failure

### 13.4 Integration Tests

**Target:** API routes with real database interactions  
**Framework:** Jest + Supertest + test database  
**Scope:** Every new module ships with integration tests covering its happy path, validation errors, and permission enforcement

Priority integration test targets:
- `/api/attendance/bulk` — verify bulk upsert, verify presence event created
- `/api/biometric/log` — verify device token auth, verify attendance created, verify log status
- `/api/presence/learner/:id/today` — verify timeline construction from mixed sources
- `/api/boarding/exeat` — full request → approval → departure → return flow

### 13.5 End-to-End Tests

**Target:** Critical user journeys only  
**Framework:** Playwright  
**Scope:** Maintain a small, stable set of E2E tests for the highest-risk flows:

- Teacher marks daily attendance → parent receives notification
- Admin registers biometric device → device logs attendance → attendance record created
- Parent views child's daily presence timeline
- Boarding staff conducts dorm roll call → absent student triggers alert

E2E tests run on a staging environment, not in CI on every PR (too slow). They run on release candidates.

### 13.6 Security Tests

- OWASP Top 10 checklist reviewed for every new API module before shipping
- Authorisation boundary tests: verify that a teacher cannot access another teacher's class, a parent cannot access another parent's child
- Biometric token forgery test: verify that a device with an invalid token is rejected
- Input fuzzing on all public-facing endpoints (biometric webhook, SMS callback)

### 13.7 Performance Tests

- Bulk attendance endpoint: test with 200 learners in one request
- Presence timeline: test with 365 days of events per learner
- Daily snapshot: test with 1,000 learners and a mix of event sources
- Cron jobs: test with a school of 500 learners to verify completion within schedule window

### 13.8 Regression Policy

Any production bug fix must include a test that would have caught the bug. No exceptions. The test is committed with the fix.

---

## 14. Deployment Strategy

### 14.1 Branch Strategy

```
main          ← Production. Protected. Only receives tagged releases.
staging       ← Pre-production. Mirrors production schema. Used for E2E and UAT.
develop       ← Integration branch. All feature branches merge here first.
feature/*     ← Individual feature work. Short-lived.
fix/*         ← Bug fixes. Can target develop or main (for hotfixes).
```

Rules:
- No direct commits to `main` or `staging`
- Feature branches are created from `develop`
- PRs to `develop` require at least one peer review and passing CI
- PRs to `main` require architecture sign-off for schema changes or new modules

### 14.2 Release Flow

```
feature/XYZ ──► develop ──► staging (UAT + E2E) ──► main (tagged release)
                                │
                         Migration review
                         Security review
                         Performance test
```

Release tags follow semantic versioning: `v2.0.0`, `v2.1.0`, `v2.1.1`

- Major: breaking API changes or major new module
- Minor: new features, non-breaking
- Patch: bug fixes, security patches

### 14.3 Database Migration Strategy

1. Migrations are written separately from feature code
2. Every migration is reviewed and approved before merging to `staging`
3. Migrations run automatically on `staging` deploy via `prisma migrate deploy`
4. Production migrations run in a maintenance window with a backup checkpoint
5. No migration is bundled with feature code in the same PR
6. Data-altering migrations (e.g. encrypting templates) have a separate `--dry-run` mode that counts affected rows

### 14.4 Feature Flags

For large features that span multiple sprints, feature flags are used to merge incomplete code into `develop` without activating it in production:

- Flags stored in `school_feature_flags` table (per-school toggle)
- New modules default to `disabled` until explicitly enabled by school admin or platform admin
- Feature flag checks in controller entry points, not scattered through services

Current candidates for feature-flagged rollout:
- Presence Platform (enable per school)
- Boarding module (only for boarding schools)
- Biometric integration (only for schools with hardware)
- WhatsApp Business (only for schools with WABA credentials)

### 14.5 Rollback Plan

- Every release has a documented rollback procedure
- Schema migrations must have a rollback script tested on staging
- Application rollback: redeploy previous Docker image tag
- Data rollback: restore from pre-migration backup checkpoint
- SMS/notification rollback: no action needed (sent messages cannot be unsent; fix forward)

### 14.6 Docker and Infrastructure

- The application runs in Docker (Dockerfile already present)
- `docker-compose.yml` for local development
- `deploy/docker-compose.stack.yml` for production stack deployment
- Environment-specific config via `.env.production` (not committed)
- Multi-school deployment via `deploy/instances.manifest.json`

---

## 15. Implementation Roadmap

### Phase 0 — Security and Critical Gaps (Weeks 1–3)
*No new features. Fix what is broken or dangerous.*

| Sprint | Deliverable | Dependencies |
|---|---|---|
| 0.1 | Biometric template encryption (AES-256-GCM) | Encryption key in env |
| 0.1 | Schema migrations: `source`, `updatedAt` on attendances | None |
| 0.1 | Schema migrations: `schoolId` on biometric tables | None |
| 0.2 | Attendance lock time enforcement in AttendanceController | School config |
| 0.2 | Bulk attendance wrapped in Prisma transaction | None |
| 0.3 | Absent learner SMS cron worker (09:30 EAT daily) | SmsService, cron-worker |
| 0.3 | SMS retry on failure (3 retries, exponential backoff) | SmsService |

**Milestone 0:** All critical security and reliability gaps closed. No new features shipped.

---

### Phase 1 — Presence Platform Foundation (Weeks 4–7)
*Add the event layer without changing existing module behaviour.*

| Sprint | Deliverable | Dependencies |
|---|---|---|
| 1.1 | `presence_events` table + `PresenceService.emit()` | Phase 0 complete |
| 1.1 | Wire `AttendanceController` to emit `CLASS_ATTENDANCE` | PresenceService |
| 1.1 | Wire `HRService.clockInStaff/clockOutStaff` to emit | PresenceService |
| 1.2 | Wire `BiometricService.processAttendanceLog` to emit | PresenceService |
| 1.2 | `TimelineEngine.buildTimeline()` | presence_events data |
| 1.3 | `GET /api/v1/presence/learner/:id/today` endpoint | TimelineEngine |
| 1.3 | Parent can view child's daily presence timeline | Endpoint |
| 1.3 | `PresenceService` idempotency (dedup by personId+eventType+timestamp) | presence_events |

**Milestone 1:** Presence events flowing from 3 sources. Parent can see child's daily timeline.

---

### Phase 2 — Transport Events (Weeks 8–10)

| Sprint | Deliverable | Dependencies |
|---|---|---|
| 2.1 | `TransportTrip` model + CRUD API | Phase 1 |
| 2.1 | `TransportBoardingEvent` model | TransportTrip |
| 2.2 | Driver mobile check-in UI (minimal, phone-friendly) | Trip model |
| 2.2 | Boarding events emit `BUS_BOARDED` / `BUS_ALIGHTED` | PresenceService |
| 2.3 | `BUS_NO_ARRIVAL` rule in RulesEngine | RulesEngine |
| 2.3 | Parent notified if child boarded bus but no class attendance | RulesEngine + SMS |

**Milestone 2:** Transport generates presence data. Bus anomalies trigger parent alerts.

---

### Phase 3 — Guardian Portal (Weeks 11–14)

| Sprint | Deliverable | Dependencies |
|---|---|---|
| 3.1 | Inbound SMS callback endpoint + reply parsing | SMS provider webhook |
| 3.1 | `parent_sms_replies` table + ParentReplyService | Callback endpoint |
| 3.2 | Parent acknowledges absence via SMS reply | ParentReplyService |
| 3.2 | Presence analytics: daily rate, chronic absentee list | presence_events |
| 3.3 | Chronic absenteeism cron (weekly, configurable threshold) | RulesEngine |
| 3.3 | `GET /api/v1/presence/school/absent-today` (admin) | presence_events |
| 3.4 | WhatsApp Business API adapter (replaces wwebjs) | WABA credentials |

**Milestone 3:** Two-way parent communication. Admin absence dashboard. WhatsApp reliable.

---

### Phase 4 — Biometrics Completion (Weeks 15–20)

| Sprint | Deliverable | Dependencies |
|---|---|---|
| 4.1 | Biometric device management UI (admin) | biometric_devices API |
| 4.1 | ZKTeco SDK adapter (HTTP push mode) | ZKTeco docs |
| 4.2 | ZKTeco sync worker (poll mode for offline devices) | SDK adapter |
| 4.2 | Enrollment UI + enrollment workflow | SDK adapter |
| 4.3 | Learner biometric LATE detection (time-aware) | School lock time config |
| 4.3 | Biometric log viewer (admin) + retry for FAILED logs | biometric_logs |

**Milestone 4:** Biometrics production-ready. Enrollment possible. LATE detection working.

---

### Phase 5 — Boarding Module (Weeks 21–30)

| Sprint | Deliverable | Dependencies |
|---|---|---|
| 5.1 | Dormitory + bed management CRUD | Schema migrations |
| 5.1 | House master role assignment | User roles |
| 5.2 | Dorm roll call (morning + evening) | Dormitory model |
| 5.2 | Roll call emits `DORM_ROLL_CALL` presence event | PresenceService |
| 5.3 | Exeat request + approval workflow | Approval engine |
| 5.3 | Exeat departure/return emits presence events | PresenceService |
| 5.4 | Dining attendance capture | Dormitory model |
| 5.4 | Prep attendance capture | Dormitory model |
| 5.5 | Night roll call absent student alert | RulesEngine |
| 5.5 | Exeat overdue alert | RulesEngine |
| 5.6 | Parent boarding portal view (exeat status, roll call history) | Parent access |

**Milestone 5:** Full boarding school operational support.

---

### Phase 6 — Analytics and Intelligence (Weeks 31–36)

| Sprint | Deliverable | Dependencies |
|---|---|---|
| 6.1 | Admin presence analytics dashboard | presence_events aggregates |
| 6.2 | AI early warning: at-risk student identification | Attendance + presence history |
| 6.3 | NEMIS integration (attendance reporting) | NEMIS API |
| 6.4 | County-level reporting for multi-school deployments | Multi-school config |

**Milestone 6:** Data-driven school leadership. National integration ready.

---

## 16. Risks

### 16.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Biometric data breach before encryption shipped | MEDIUM | CRITICAL | Phase 0.1 is P0 — must ship before any other work |
| Presence event dual-write creates data inconsistency | LOW | MEDIUM | Wrap in transaction; presence failure is non-blocking |
| Schema growth makes migrations unmanageable | MEDIUM | MEDIUM | Strict one-concern-per-migration policy; schema split roadmap |
| Biometric device SDK unavailable / too expensive | MEDIUM | MEDIUM | Design adapter pattern; fallback to webhook-only mode |
| ZKTeco HTTP push requires firmware version not available on older devices | MEDIUM | MEDIUM | Support both push and pull modes in adapter |
| WhatsApp Business API application rejected | LOW | LOW | wwebjs remains as fallback until WABA approved |
| Prisma multi-file schema support still experimental | HIGH | LOW | Schema stays single file until Prisma declares it stable |

### 16.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Schools resist change from paper registers | HIGH | MEDIUM | Progressive rollout; feature flags per school |
| Absent SMS triggers parent panic without context | MEDIUM | MEDIUM | Include learner name, class, contact number in message |
| Parent two-way SMS misrouted (phone number matching failure) | LOW | MEDIUM | Thread by phone number + 24h window; manual override |
| Boarding schools have complex exeat rules that don't fit generic model | HIGH | MEDIUM | Configurable exeat types per school |
| Teachers mark all present without actually taking register | HIGH | MEDIUM | Attendance analytics flags statistically implausible patterns |

### 16.3 Migration Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Biometric template encryption migration corrupts existing data | LOW | CRITICAL | Batch processing; dry-run first; backup before run |
| Adding `schoolId` to biometric tables breaks existing queries | MEDIUM | MEDIUM | Add as nullable first; backfill; then make required in next migration |
| Bulk attendance transaction wrapping causes timeout on large classes | LOW | LOW | Set transaction timeout; batch in groups of 50 |

### 16.4 Operational Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Absent SMS cron fails silently | MEDIUM | HIGH | Add cron failure alerting to admin dashboard |
| SMS provider outage during morning absent window | LOW | MEDIUM | Queue failed sends for retry; fallback to push notification |
| Biometric device goes offline during school day | HIGH | LOW | Device offline is normal; logs batch when reconnected |
| Presence event table grows beyond query performance | LOW | MEDIUM | Monthly partition strategy; index on (schoolId, timestamp) |

---

## 17. Architecture Decision Records

Each ADR documents a significant architectural decision, the context it was made in, the alternatives considered, and the reasoning for the choice.

---

### ADR-001 — Monolith over Microservices

**Status:** Accepted  
**Date:** August 2026

**Context:** TrendSCORE serves individual schools. Each school runs as a tenant. The team is small. Operational complexity is a real constraint.

**Decision:** TrendSCORE 2.0 remains a layered monolith. Domain separation is enforced through code conventions (bounded contexts, no cross-domain DB queries) rather than network boundaries.

**Alternatives considered:**
- *Microservices*: Would provide per-service scalability but requires service mesh, distributed tracing, API gateway, and significantly increases deployment and debugging complexity for a small team.
- *Modular monolith with process separation*: Splitting the cron worker into a separate process (already done) captures the main benefit of isolation without full microservice overhead.

**Consequences:** Cross-cutting concerns (Presence Platform) must be implemented as service layers within the monolith, not as separate services. This is acceptable at the current scale. Revisit at >50 schools or when a team of 10+ engineers is maintaining the system.

---

### ADR-002 — Synchronous In-Process Events over Message Broker

**Status:** Accepted  
**Date:** August 2026

**Context:** The Presence Platform requires events to flow from domain modules (Attendance, HR, Biometrics) to the presence event store. An event broker (Kafka, RabbitMQ, Redis Streams) could decouple producers from consumers but adds infrastructure complexity.

**Decision:** Presence events are written synchronously inside the same Prisma transaction as the primary domain write. `PresenceService.emit()` is a direct method call, not a publish to a queue.

**Alternatives considered:**
- *Redis Streams*: Would allow async fan-out but requires Redis to be highly available and adds lag to notification delivery.
- *PostgreSQL LISTEN/NOTIFY*: Interesting option but harder to test and adds complexity to connection management.
- *Bull queue*: Overkill for the event volume at current scale.

**Consequences:** If the presence event write fails, the domain write is not rolled back (presence failure is non-blocking). A `presence_event_failures` table captures these for reconciliation. This is acceptable — a failed presence event is operationally recoverable, whereas rolling back an attendance mark is worse.

**Revisit trigger:** If presence event volume exceeds 1 million rows/day or if fan-out to multiple async consumers is needed.

---

### ADR-003 — Webhook-First Biometric Architecture

**Status:** Accepted  
**Date:** August 2026

**Context:** Different schools will deploy different biometric hardware. ZKTeco, Hikvision, NFC readers, and fingerprint terminals all have different protocols.

**Decision:** The biometric integration is webhook-first. Any device that can POST to `/api/biometric/log` is supported. Vendor-specific SDK adapters are optional additions for richer functionality (enrollment, device management). The core attendance path does not require any specific vendor.

**Alternatives considered:**
- *Vendor-lock (ZKTeco only)*: Simpler initially but limits market.
- *Client SDK in browser*: Not practical for hardware devices.

**Consequences:** Device enrollment requires either a vendor SDK adapter or a manual credential upload. The generic webhook covers the attendance recording use case without any SDK. Vendor adapters are added progressively.

---

### ADR-004 — Prisma as the Only ORM

**Status:** Accepted  
**Date:** August 2026

**Context:** The codebase uses Prisma throughout. Introducing raw SQL or a second ORM for specific queries would fragment the data access layer.

**Decision:** Prisma is the only data access mechanism. Complex analytics queries that cannot be expressed cleanly in Prisma are written as Prisma `$queryRaw` calls with parameterised inputs and placed in dedicated `*.repository.ts` files.

**Alternatives considered:**
- *Knex for complex queries*: Would work but creates a second dependency and two mental models for database access.
- *Direct pg driver*: More control but loses type safety and migration management.

**Consequences:** Some complex aggregations are harder to write in Prisma. This is an acceptable trade-off for consistency and type safety across 60+ controllers.

---

### ADR-005 — AES-256-GCM for Biometric Template Encryption

**Status:** Accepted  
**Date:** August 2026

**Context:** The audit identified that biometric templates are stored as plaintext strings in `biometric_credentials.template`. This is a critical security gap.

**Decision:** All biometric templates are encrypted with AES-256-GCM before storage. The encryption key is stored in the `BIOMETRIC_ENCRYPTION_KEY` environment variable. A `keyVersion` field allows key rotation without re-enrollment. Templates are stored as `Bytes` (binary) in the database, not as strings.

**Alternatives considered:**
- *Hashing only*: Templates cannot be hashed — they must be compared for verification. Hashing destroys the template.
- *Envelope encryption with KMS*: Better for enterprise scale but adds dependency on AWS KMS or similar. Revisit when compliance mandates it.
- *Column-level encryption via Supabase*: Possible but less portable and harder to key-rotate independently.

**Consequences:** Template comparison requires decrypt-then-compare. This adds CPU overhead but is acceptable given the low frequency of biometric comparisons at school scale.

---

### ADR-006 — Feature Flags for Progressive Module Rollout

**Status:** Accepted  
**Date:** August 2026

**Context:** New modules (Boarding, Biometrics, Presence) are not relevant to all schools. A day school does not need dormitory management. A school without hardware does not need biometric device management.

**Decision:** New modules are controlled by per-school feature flags stored in a `school_feature_flags` table. Feature flag checks live at the controller entry point. Disabled module routes return 403 with a clear message.

**Alternatives considered:**
- *Always-on for all schools*: Creates UI noise and confused admins at schools that don't need the module.
- *Separate deployments per school type*: Impossible to maintain as the codebase diverges.

**Consequences:** Feature flag checks must be maintained as modules evolve. A module's routes must consistently check their flag. Failure to check results in unauthorised access to half-built features.

---

### ADR-007 — Flat Schema File Until Prisma Multi-File Is Stable

**Status:** Accepted  
**Date:** August 2026

**Context:** The Prisma schema is a single large file (`server/prisma/schema.prisma`). Multi-file schema support is available as a preview feature in Prisma 5+.

**Decision:** The schema remains as a single file until Prisma declares multi-file schema support as generally available (GA). The target split into domain-scoped files is documented in Section 7.9 but not executed yet.

**Alternatives considered:**
- *Split now using preview feature*: Risk of incompatibilities in migration tooling.
- *Manual file include scripts*: Too fragile, not officially supported.

**Consequences:** The schema file will grow. Navigation is aided by clear section comments (already present). Revisit when Prisma multi-file reaches GA.

---

## Document Control

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | August 2026 | Chief Software Architect | Initial draft — pending architecture review |

**Next review:** Before Phase 0 implementation begins.  
**Distribution:** All development team members, product owner.  
**Location:** `/docs/architecture/00_MASTER_ARCHITECTURE_SPECIFICATION.md`

---

*End of Master Architecture Specification v1.0*
