# TrendScore — AI Infrastructure & Readiness Report

**Phase 0.5 Assessment**  
**Date:** August 2026  
**Status:** Original investigation complete; Phase 1 backend foundation implemented and hardened  
**Deliverable:** Master Reference for Future AI Development

> **Implementation update — 8 August 2026:** The original assessment below is retained as the baseline snapshot. TrendSCORE now has an authenticated `/api/ai/chat` orchestrator, provider routing, a tool registry, seven Pathways tools, role and learner-ownership enforcement, pathway-stage guards, CSRF protection, exact-input confirmations stored in Redis with a development memory fallback, persistent `AuditLog` records for tool outcomes, tenant/user-scoped conversation history, and a frontend assistant with explicit confirmation controls. Focused TypeScript, persistence, security and UI lint gates pass. Production rollout still requires live-provider end-to-end testing, production Redis configuration, AI-specific rate limits/usage budgets, and operational monitoring.

---

## Executive Summary

TrendScore is a **mature, production-grade school management system** built on Node.js/Express (backend) and React/Vite (frontend), with a PostgreSQL database managed via Prisma ORM. The codebase is extensive (~80 route modules, ~80 controllers, ~80 services, 100+ Prisma models) and already contains **surprising AI readiness** — including an active AI Bridge service (Anthropic/OpenAI), rule-based AI assistants, WhatsApp (both Baileys and WABA), M-Pesa STK Push, biometric integration, and a Presence Engine event architecture.

**Key Finding:** TrendScore is **not starting from zero**. Approximately 60% of the infrastructure needed for conversational AI already exists. The critical gaps are: (1) no vector database or RAG pipeline, (2) no message broker for async AI processing, (3) no LLM tool-calling framework, and (4) no voice/audio processing pipeline.

---

## 1. Project Architecture

### Stack Overview
| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS, Radix UI, Zustand, Socket.IO Client |
| **Backend** | Express.js 4, TypeScript 5, Prisma ORM 5 |
| **Database** | PostgreSQL (via `DATABASE_URL`) |
| **Cache** | Redis (ioredis) with in-memory fallback |
| **Real-time** | Socket.IO 4 |
| **File Storage** | Cloudinary |
| **Email** | Resend + Nodemailer (legacy fallback) |
| **Container** | Docker + docker-compose |
| **Process Mgr** | PM2 (ecosystem.config.js) |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  Web App (React) │ Mobile (Capacitor) │ WhatsApp │ SMS     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / WSS
┌────────────────────────▼────────────────────────────────────┐
│                     API GATEWAY                              │
│  Express.js + Helmet + CORS + Rate Limit + Compression       │
│  Auth Middleware (JWT) + School Context + Institution Type   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
│   ROUTES     │  │  SERVICES   │  │  DOMAINS   │
│  (~80 files) │  │ (~80 files) │  │(attendance,│
│  REST API    │  │  Business   │  │biometrics, │
│              │  │   Logic     │  │presence,   │
│              │  │             │  │transport)  │
└───────┬──────┘  └──────┬──────┘  └─────┬──────┘
        │                │               │
        └────────────────┼───────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   DATA LAYER                                 │
│  PostgreSQL (Prisma) │ Redis Cache │ Cloudinary │ Filesystem│
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              BACKGROUND PROCESSES                            │
│  Cron Worker (node-cron) │ WhatsApp (Baileys) │ Socket.IO   │
└─────────────────────────────────────────────────────────────┘
```

### AI-Relevant Architectural Observations
- **Service layer exists** but is inconsistent — some controllers call Prisma directly, others use services.
- **No dependency injection container** — services are instantiated as singletons or imported directly.
- **No repository pattern** — Prisma client is used directly throughout.
- **No message broker** — background work is done via cron jobs and in-process workers.
- **School context middleware** (`schoolContextMiddleware` + `institutionContextResolver`) already provides multi-tenancy primitives.

---

## 2. Existing APIs

### API Inventory
The system has **80+ route modules** organized by domain:

| Category | Routes |
|----------|--------|
| **Core** | auth, users, learners, classes, streams, schools, config |
| **Academic** | assessments, cbc, grading, learning-areas, pathways, secondary, tertiary, reports |
| **Attendance** | attendance, presence, biometric |
| **Finance** | fees, finance, accounting, payments, mpesa, invoices |
| **Communication** | notifications, broadcasts, communication, sms, notices, chat |
| **HR/Staff** | hr, staff, duty-rosters, leave, payroll, performance |
| **LMS** | lms, assignments, lessons, resources, planner, schemes |
| **Library** | library, library-automation |
| **Transport** | transport, trips |
| **Boarding** | boarding, exeat |
| **Inventory** | inventory |
| **AI/Data** | ai, analytics, dashboard, insights |
| **Support** | support, tickets, approval-workflows, approvals |
| **System** | health, diagnostics, backups, migrations, system-logs, git-notifications |
| **Bulk** | bulk imports for learners, teachers, parents, fees, assessments, accounting |

### API Characteristics
- **Protocol:** REST over HTTPS
- **Auth:** JWT Bearer tokens OR cookie-based (`accessToken`)
- **Format:** JSON (50MB body limit)
- **Versioning:** No explicit API versioning; uses `/v1/` prefix for new modules (presence, transport trips, boarding, analytics)
- **Rate Limiting:** IP-based (1000 req/15min globally) + enhanced rate limit middleware
- **CORS:** Configured with origin whitelist, credentials enabled
- **Feature Gating:** `requireApp()` middleware gates routes by app/module subscription

### AI Readiness: APIs
**Score: 7/10** — The API surface is broad and well-organized. Most endpoints follow a consistent pattern. However, there is **no OpenAPI/Swagger spec**, no formal API contract testing (though `audit:api-contract` script exists), and no GraphQL. For AI tool calling, the REST endpoints can be wrapped, but a dedicated tool schema would need to be built.

---

## 3. WhatsApp Infrastructure

### Dual-Strategy Implementation
TrendScore has **two WhatsApp integrations** with graceful fallback:

#### A. Baileys (Unofficial WebSocket)
- **Library:** `@whiskeysockets/baileys` v7.0.0-rc.9
- **Auth:** Multi-file auth state persisted to `./whatsapp-auth/` (survives restarts)
- **Features:** Text, media (images/documents), bulk messaging, QR code pairing
- **Reconnect Logic:** Automatic with exponential backoff (2-3s delay), handles logged-out state
- **Rate Limiting:** 1-second delay between bulk messages
- **Status:** Operational but requires phone to be online

#### B. WhatsApp Business API (WABA — Official)
- **Library:** Custom axios-based adapter (`whatsapp-business.service.ts`)
- **Auth:** Meta Graph API with permanent access token
- **Features:** Text messages, template messages (for 24h+ window), webhook verification
- **Fallback:** If WABA fails or is unconfigured, system falls back to Baileys
- **Feature Flag:** Activates only when `WABA_PHONE_NUMBER_ID` is set

### WhatsApp Capabilities Matrix

| Feature | Baileys | WABA | AI Relevance |
|---------|---------|------|-------------|
| Text messages | ✅ | ✅ | Primary conversational interface |
| Media (images) | ✅ | ✅ | Report sharing |
| Documents/PDF | ✅ | ❌ (templates only) | Receipts, reports |
| Audio/Voice | ❌ | ❌ | **Gap: No voice note support** |
| Buttons | ❌ | ✅ (templates) | Interactive menus |
| Lists | ❌ | ✅ (templates) | Menu selection |
| Replies | ✅ | ✅ | Threading |
| Group support | ✅ | ❌ | Broadcasts only |
| Status handling | ❌ | ❌ | Not implemented |
| Session persistence | ✅ (file) | ✅ (Meta) | Both survive restarts |

### Assessment
**Score: 6/10** — WhatsApp is functional for notifications and basic two-way messaging. To become a **primary conversational AI interface**, it needs: (1) inbound message routing to an AI handler, (2) session/context management per parent, (3) voice note support, (4) button/list interactivity for guided flows.

---

## 4. SMS Infrastructure

### Provider Architecture
- **Primary Providers:** Africa's Talking + MobileSasa
- **Config Storage:** Encrypted in `communicationConfig` table (Prisma), with 5-minute memory cache
- **Fallback:** Environment variables (`AT_API_KEY`, `MOBILESASA_API_KEY`) if DB config missing
- **Phone Validation:** Strict Kenyan format validation (9-digit core, prefixes 0/1/6/7)

### Capabilities
- Single SMS, bulk SMS, assessment report SMS, fee invoice SMS
- MobileSasa balance checking and top-up via M-Pesa STK Push
- **Audit logging:** All SMS stored in `AssessmentSmsAudit` with status tracking
- **Retry worker:** `sms-retry.worker.ts` runs hourly for failed messages

### Assessment
**Score: 7/10** — SMS is production-ready with dual providers, audit trails, and retry logic. It serves as an excellent **fallback channel** when WhatsApp is unavailable. For AI, SMS can deliver short responses but is not suitable for conversational interfaces due to cost and length constraints.

---

## 5. Payment Infrastructure

### Payment Providers
| Provider | Use Case | Status |
|----------|----------|--------|
| **M-Pesa Daraja** | STK Push, fee payments | ✅ Active |
| **IntaSend** | Alternative payments | ✅ Available |
| **KopoKopo** | Collections | ✅ Available |
| **MobileSasa** | SMS credit top-up | ✅ Active |

### M-Pesa Daraja Implementation
- **Endpoints:** STK Push initiation, status query, callback handling
- **Security:** Password derived from `shortCode + passKey + timestamp`, base64 encoded
- **Transaction Tracking:** `MpesaTransaction` model with PENDING/COMPLETED/FAILED states
- **Callbacks:** Webhook endpoint at `/api/webhooks/mpesa`

### AI Payment Safety
**Current State:** Payments are **NOT AI-invokable**. The Daraja service requires explicit human confirmation (STK Push is sent to parent's phone). For AI to safely invoke payments:
- ✅ Transaction ledger exists
- ✅ Audit trail exists
- ❌ No AI-specific authorization layer
- ❌ No payment amount confirmation flow
- ❌ No LLM tool guardrails

### Assessment
**Score: 6/10** — Payments are robust for human-initiated flows. Making them AI-safe requires adding confirmation middleware, amount validation, and a "human-in-the-loop" pattern before any AI can trigger STK Push.

---

## 6. Authentication

### Auth Stack
| Component | Implementation |
|-----------|---------------|
| **Primary Auth** | JWT (access token) + cookie |
| **Refresh** | `JWT_REFRESH_SECRET` with refresh tokens |
| **Password** | bcrypt (salt rounds: default) |
| **OTP** | Phone-based OTP with `SKIP_OTP` dev flag |
| **Session Revocation** | Redis-backed global invalidation list |
| **Impersonation** | Admin can impersonate users; tokens revocable via Redis |
| **CSRF** | Token-based CSRF protection |
| **Rate Limiting** | IP-based (1000/15min) + enhanced middleware |

### Role System
- **Roles:** SUPERADMIN, ADMIN, PRINCIPAL, TEACHER, PARENT, STUDENT, BURSAR, LIBRARIAN, HR, HOD, etc.
- **Multi-role:** Users can have `roles[]` array; normalization happens at auth boundary
- **Feature Permissions:** `requireApp()` middleware checks module subscriptions

### WhatsApp ↔ Parent Linkage
- **Current:** Parents are `User` records with `role: PARENT`. Learners link via `learner.parentId`.
- **Family Accounts:** `FamilyAccount` + `FamilyMember` models enable multiple guardians per learner
- **Phone Matching:** WhatsApp/SMS sends to `guardianPhone`, `primaryContactPhone`, or `familyAccount.primaryPhone`
- **Multi-child:** ✅ Supported via `FamilyAccount.learners[]` and `LearnerFamilyLink`

### Assessment
**Score: 8/10** — Authentication is mature and secure. The family account model is exactly what's needed for AI-driven parent experiences. Gap: No OAuth for third-party AI services, no SSO for parents.

---

## 7. Database

### Database: PostgreSQL
- **ORM:** Prisma 5.22 with `prisma-client-js`
- **Migrations:** 20+ tracked migrations in `prisma/migrations/`
- **Schema Size:** ~5,833 lines, ~100+ models

### Schema Quality
| Aspect | Status | Notes |
|--------|--------|-------|
| **Indexes** | ✅ Good | Composite indexes on common query patterns |
| **Relations** | ✅ Rich | Deep relational graph (User → Learner → Enrollment → Class → Schedule) |
| **Soft Deletes** | ✅ Partial | `archived`/`archivedAt`/`archivedBy` pattern on most models |
| **Audit Fields** | ✅ | `createdAt`, `updatedAt` on virtually all models |
| **History Tables** | ✅ | `SummativeResultHistory`, `PathwaySelectionHistory`, `ChangeHistory` |
| **JSON Fields** | ✅ | `customGradingScale`, `metadata`, `etimsConfig`, `nemisConfig` |
| **Views** | ❌ | No database views found |
| **Stored Procs** | ❌ | None; all logic in application layer |
| **Triggers** | ❌ | None in Prisma schema |
| **Constraints** | ✅ | `@unique`, `@@unique`, foreign key constraints |

### Key Models for AI
| Model | AI Relevance |
|-------|-------------|
| `User` / `Learner` | Parent/student identity |
| `FamilyAccount` / `FamilyMember` | Multi-guardian linkage |
| `Attendance` / `StaffAttendanceLog` | Presence data |
| `SummativeResult` / `FormativeAssessment` | Academic performance |
| `FeeInvoice` / `FeePayment` / `MpesaTransaction` | Financial data |
| `PresenceEvent` | Event sourcing for all presence facts |
| `UserNotification` | In-app notification bell |
| `Conversation` / `ChatMessage` | In-app messaging |
| `Document` | File metadata |
| `AIGeneratedContent` | **Existing AI content store** |

### Assessment
**Score: 7/10** — PostgreSQL is well-structured with good indexing and soft-delete patterns. However, the schema is a **single flat file** (5,833 lines) which is becoming unwieldy. For AI: no `pgvector` extension, no full-text search indexes, no vector embeddings storage. These are needed for RAG.

---

## 8. Notification System

### Channels
| Channel | Implementation | Status |
|---------|---------------|--------|
| **In-App** | `UserNotification` table + Socket.IO room emit | ✅ Real-time |
| **Email** | Resend (primary) + Nodemailer (legacy) + React Email templates | ✅ Active |
| **SMS** | Africa's Talking + MobileSasa | ✅ Active |
| **Push** | Web Push (VAPID) with `web-push` library | ✅ Active |
| **WhatsApp** | Baileys + WABA | ✅ Active |
| **Socket.IO** | Room-based (user ID rooms, ticket rooms, chat rooms) | ✅ Active |

### Notification Architecture
- **Creation Flow:** `NotificationService.createNotification()` → DB write → Socket.IO emit → Web Push background send
- **Deduping:** Approval notifications deduplicated by `(requestId, event)` metadata
- **Sync:** `syncApprovalNotificationsForUser()` backfills missed notifications on fetch

### Assessment
**Score: 8/10** — Notifications are multi-channel and event-driven (via Socket.IO). The architecture supports adding AI-generated notifications easily. Gap: No centralized event bus — each service calls NotificationService directly.

---

## 9. Event Architecture

### Current State
TrendScore has **domain-specific event patterns** but no centralized message broker.

#### What Exists:
| Component | Implementation |
|-----------|---------------|
| **Presence Engine** | `PresenceService.emit()` — synchronous event sourcing within DB transactions |
| **Socket.IO** | Real-time events to connected clients |
| **Cron Jobs** | `node-cron` in dedicated `cron-worker.ts` process |
| **Domain Workers** | Attendance, SMS retry, biometric sync, chronic absenteeism, exeat overdue |
| **Webhooks** | M-Pesa callbacks, biometric device push, WABA inbound |

#### What Is Missing:
| Component | Gap |
|-----------|-----|
| **Message Broker** | No RabbitMQ, Kafka, or SQS |
| **Pub/Sub** | No pub/sub abstraction |
| **Event Bus** | No centralized event bus |
| **Queue System** | No job queue (Bull, Bee, etc.) |
| **Async Workers** | All workers are cron-based, not event-triggered |

### Presence Engine (Event Sourcing)
The **Presence Engine** is TrendScore's most sophisticated event architecture:
- **Synchronous emission** inside DB transactions
- **Idempotent** — duplicate `(personId, eventType, timestamp)` suppressed
- **Failure isolation** — events that fail are recorded in `presenceEventFailures`
- **Source record projection** — updates existing events when source records change

### Assessment
**Score: 5/10** — The Presence Engine is well-designed, but the overall system lacks a general-purpose event bus. For AI, this means: (1) AI requests cannot be queued for async processing, (2) no event-driven triggers for AI workflows, (3) no retry mechanism for failed AI calls. **Recommended upgrade:** Add a job queue (BullMQ with Redis) for AI tasks.

---

## 10. AI Readiness

### What Already Exists

#### A. AI Bridge Service (`ai-bridge.service.ts`)
- **Providers:** Anthropic (Claude) — default; OpenAI (GPT) — fallback
- **Features:** Chat completions, JSON mode, system prompts, token usage tracking
- **Fallback:** `generateCompletionWithFallback()` returns deterministic fallback if LLM fails
- **Configuration:** `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`

#### B. Rule-Based AI Assistant (`ai-assistant.service.ts`)
- **Teacher Feedback Generator:** Deterministic comment generation from performance bands
- **Risk Analyzer:** Categorizes learners into Low/Medium/High risk based on score trends
- **Pathway Predictor:** CBC cluster analysis (STEM/Social/Arts) with confidence scoring
- **Important:** No external AI API called — all rule-based

#### C. LMS AI Service (`lms-ai.service.ts`)
- AI-enhanced learning content (details not fully investigated)

#### D. AI Routes (`ai.routes.ts`)
- `GET /api/ai/feedback/:learnerId` — Generate teacher feedback
- `GET /api/ai/analyze-risk/:learnerId` — Risk analysis
- `GET /api/ai/trend/:learnerId` — Performance trend

### What Is Missing
| Capability | Status | Impact |
|-----------|--------|--------|
| **LLM Tool Calling** | ❌ | AI cannot invoke APIs |
| **RAG / Vector DB** | ❌ | No document understanding |
| **Intent Detection** | ❌ | No NLP classifier |
| **Conversation Memory** | ❌ | No persistent chat context |
| **Multi-turn Dialogue** | ❌ | WhatsApp/SMS are stateless |
| **Voice Processing** | ❌ | No STT/TTS |
| **Document Understanding** | ❌ | No OCR or PDF parsing |
| **AI Guardrails** | ❌ | No prompt injection protection |

### Code Quality for AI Extension
| Pattern | Status |
|---------|--------|
| Dependency Injection | ❌ No container; direct imports |
| Service Layer | ⚠️ Mixed; some controllers call Prisma directly |
| Repository Pattern | ❌ Prisma used directly everywhere |
| Interfaces | ⚠️ Some; mostly implicit |
| Separation of Concerns | ✅ Good domain separation |

### Assessment
**Score: 5/10** — The AI Bridge is a solid foundation. The rule-based assistants prove the business logic is understood. However, there's a **big gap between "having an LLM client" and "having an AI system."** Missing: tool framework, RAG, conversation state, intent routing.

---

## 11. Search Capabilities

### Current Search
- **API Search:** Basic Prisma `where` clauses with `contains` (case-insensitive)
- **Filtering:** Query parameters mapped to Prisma filters
- **Full-Text Search:** ❌ Not implemented
- **pgvector:** ❌ Not installed
- **ElasticSearch:** ❌ Not used
- **Meilisearch:** ❌ Not used

### Caching
- **Redis:** Distributed cache with in-memory fallback
- **Patterns:** Config cache (5min TTL), school context cache
- **Cache invalidation:** Prefix-based deletion available

### Assessment
**Score: 3/10** — Search is basic database filtering. For RAG, the system needs: (1) `pgvector` extension for embeddings, (2) full-text search (PostgreSQL `tsvector` or external engine), (3) document indexing pipeline.

---

## 12. Document Infrastructure

### File Storage
- **Provider:** Cloudinary (configured via `CLOUDINARY_URL`)
- **Upload:** Multer middleware + `document.service.ts`
- **Supported Types:** Images, videos, raw files (PDF, Word, etc.)
- **Features:** Folder organization, unique public IDs, signed URLs, bulk upload/delete

### Document Models
- `Document` — Generic document metadata (learner documents, staff documents)
- `StaffDocument` — HR-specific documents
- `LMSContent` / `LearningResource` — Educational content

### Missing Capabilities
| Feature | Status |
|---------|--------|
| PDF indexing | ❌ |
| Word document parsing | ❌ |
| OCR | ❌ |
| Document search | ❌ |
| Medical notes storage | ✅ (via `Learner.medicalConditions`) |
| Policies storage | ❌ No dedicated model |

### Assessment
**Score: 4/10** — Files can be stored but not understood. For AI document processing, a pipeline needs to be built: upload → parse (OCR/extract) → chunk → embed → store in vector DB.

---

## 13. Media Infrastructure

### Current Capabilities
| Media | Status | Implementation |
|-------|--------|---------------|
| **Image upload** | ✅ | Cloudinary + multer |
| **Image processing** | ✅ | `sharp` (devDependency) |
| **Video** | ✅ | Cloudinary supports it |
| **PDF generation** | ✅ | jspdf, html2canvas |
| **Voice notes** | ❌ | Not implemented |
| **Speech-to-Text** | ❌ | Not implemented |
| **Text-to-Speech** | ❌ | Not implemented |
| **Audio storage** | ⚠️ | Cloudinary can store, no player |

### Assessment
**Score: 3/10** — Images and documents are covered. Voice is a major gap for conversational AI in markets where parents prefer speaking to typing.

---

## 14. AI Tool Candidates

### High-Value, Low-Risk Tools (Implement First)
| Tool | Business Value | Difficulty | Risk | Dependencies |
|------|---------------|------------|------|-------------|
| `GetStudentAttendance()` | ⭐⭐⭐ | Low | Low | Attendance API exists |
| `GetFeeBalance()` | ⭐⭐⭐ | Low | Low | Fee API exists |
| `GetExamResults()` | ⭐⭐⭐ | Low | Low | Assessment API exists |
| `GetStudentTimeline()` | ⭐⭐⭐ | Medium | Low | Presence Engine |
| `SendAnnouncement()` | ⭐⭐ | Low | Low | Broadcast API exists |
| `NotifyTeacher()` | ⭐⭐ | Low | Low | Notification service |

### High-Value, High-Risk Tools (Require Guardrails)
| Tool | Business Value | Difficulty | Risk | Dependencies |
|------|---------------|------------|------|-------------|
| `SendSTKPush()` | ⭐⭐⭐ | Medium | **HIGH** | Payment confirmation flow |
| `ApproveLeave()` | ⭐⭐ | Medium | Medium | Approval workflow engine |
| `CreateIncident()` | ⭐⭐ | Medium | Medium | Write access to DB |
| `MarkAttendance()` | ⭐⭐⭐ | Medium | **HIGH** | Biometric verification |
| `UpdateFeeWaiver()` | ⭐ | High | **HIGH** | Financial authorization |

### Assessment
**Score: 6/10** — Read-only tools are ready to wrap. Write tools (especially payments and attendance) require human-in-the-loop confirmation before AI can safely invoke them.

---

## 15. Parent Experience

### Current Parent Portal
- **Auth:** Parent users can log in with username/password or phone + OTP
- **Access Control:** `ParentAccessService` enforces which learners a parent can view
- **Family Accounts:** Multiple guardians can access the same learner(s)
- **Features:** View attendance, fee balance, exam results, notices, transport

### Communication Channels to Parents
| Channel | Status |
|---------|--------|
| In-app notifications | ✅ |
| SMS (assessment reports, fee reminders) | ✅ |
| WhatsApp (reports, announcements) | ✅ |
| Email | ✅ |
| Push notifications | ✅ |

### AI Replacement Opportunities
1. **Fee Balance Queries** — "How much do I owe?" → Currently requires login; AI can answer via WhatsApp
2. **Attendance Notifications** — Already automated; AI can add context ("Your child was late 3 times this week")
3. **Report Interpretation** — AI can explain grades in plain language
4. **Payment Assistance** — AI can guide through M-Pesa payment

### Assessment
**Score: 6/10** — Parent experience is functional but portal-based. AI can dramatically improve this by moving interactions to WhatsApp (where parents already are).

---

## 16. Teacher Experience

### Current Teacher Workflow
| Task | Implementation |
|------|---------------|
| **Attendance** | Daily register marking + biometric sync |
| **Homework** | LMS assignment creation + submission tracking |
| **Communication** | In-app chat + broadcast notices |
| **Mark Entry** | CBC formative/summative assessment entry |
| **Reports** | Auto-generated termly reports with AI comments |
| **Approvals** | Leave requests, fee waivers via approval engine |

### AI Opportunities
- **Auto-generated report comments** — ✅ Already rule-based; can upgrade to LLM
- **Attendance insights** — "Which students are chronically absent?"
- **Performance alerts** — "3 students in your class dropped below 40%"
- **Lesson planning** — AI-assisted scheme of work generation

### Assessment
**Score: 7/10** — Teachers already benefit from automation (biometric attendance, auto-reports). AI can enhance decision-making but the core workflow is solid.

---

## 17. Principal Dashboard

### Current Analytics
- **Routes:** `/api/v1/analytics`, `/api/dashboard`
- **Reports:** Attendance summaries, fee collection, exam performance, staff metrics
- **KPIs:** Present in dashboard controllers
- **Approvals:** Approval engine with workflow steps
- **Alerts:** Early warning service for presence anomalies

### AI Opportunities
- **Executive summaries** — "This week: attendance dropped 5%, fee collection is at 78%, 2 staff are on leave"
- **Predictive alerts** — "Based on trends, you may have a cash flow issue next month"
- **Comparative analysis** — "Your Grade 4 math scores are below county average"

### Assessment
**Score: 6/10** — Dashboard exists with good data. AI can add narrative generation and predictive insights.

---

## 18. Existing Biometrics

### Architecture
- **Adapter Pattern:** `zkteco.adapter.ts` translates device protocols to TrendScore format
- **Devices:** ZKTeco fingerprint/face recognition devices
- **Modes:** PUSH (device POSTs to server) + PULL (server polls device)
- **Sync Worker:** Runs every 15 minutes for PULL mode
- **Retry Worker:** Daily retry for failed biometric logs
- **Encryption:** Biometric data encryption utility exists
- **Verification Types:** Fingerprint, Face, Card, Password

### Presence Engine Integration
- Biometric scans emit `PresenceEvent` records
- Timeline engine reconstructs attendance from presence events
- Works with both staff and learner attendance

### Assessment
**Score: 8/10** — Biometrics are well-integrated. The Presence Engine can be reused for AI-driven attendance queries. The ZKTeco adapter pattern makes it extensible to other device brands.

---

## 19. Offline Capability

### Current State
| Aspect | Status |
|--------|--------|
| **PWA/Service Worker** | ❌ Not implemented |
| **Local Storage** | ❌ No offline data persistence |
| **Queueing** | ❌ No offline action queue |
| **Conflict Resolution** | ❌ Not needed — no offline sync |
| **Biometric Offline** | ⚠️ Device stores locally, syncs when online |
| **WhatsApp Offline** | ✅ Messages queue on phone, deliver when online |

### Assessment
**Score: 2/10** — The web app has no offline capability. WhatsApp itself works offline (messages queue on the phone), which is a major advantage for using WhatsApp as the primary AI interface in low-connectivity areas.

---

## 20. Scalability

### Current Architecture Limits
| Metric | Current | Limit |
|--------|---------|-------|
| **Server** | Single Node.js process | Vertical scaling only |
| **Database** | Single PostgreSQL instance | Read replicas not configured |
| **Cache** | Redis (optional, with memory fallback) | Single instance |
| **File Storage** | Cloudinary (external, scales) | ✅ Scales |
| **WhatsApp** | Single Baileys session | One session per deployment |
| **Cron Jobs** | Single cron-worker process | Single point of failure |

### Multi-School Scalability
The schema has a `School` model, but the architecture appears designed for **single-tenant or limited multi-tenant** deployment:
- `schoolContextMiddleware` resolves a single school per request
- No explicit tenant isolation at the database level
- Single WhatsApp session per deployment

### Concurrent Users
- **Socket.IO:** Supports many concurrent connections but single server
- **API:** Express.js can handle thousands of req/s but single process
- **Database:** PostgreSQL connection pool managed by Prisma

### Recommendations for Scale
| Users | Required Changes |
|-------|-----------------|
| **100 schools** | Load balancer + 2-3 API instances, read replica |
| **500 schools** | Multi-instance WhatsApp (session pooling), Redis cluster |
| **1,000 schools** | Microservices split (AI service separate), Kafka for events |
| **10,000 parents concurrent** | Horizontal pod autoscaling, CDN for static assets |

### Assessment
**Score: 5/10** — The codebase is modular enough to split, but the current deployment is monolithic. For AI introduction, the immediate concern is that LLM calls are slow (~1-3s) and will block the event loop if not handled asynchronously.

---

## 21. Security Review

### What Is Implemented
| Control | Implementation |
|---------|---------------|
| **Secrets** | Environment variables, encryption key for sensitive data |
| **Tokens** | JWT with expiry, refresh tokens, global revocation list |
| **Encryption** | `encryption.util.ts` for DB field encryption |
| **PII** | Soft deletes, archived flags, role-based access |
| **Audit Trails** | `ChangeHistory`, `AssessmentSmsAudit`, `AppAuditLog` |
| **Rate Limiting** | IP-based + enhanced middleware |
| **Headers** | Helmet, security headers, CORS, CSRF |
| **Input Sanitization** | Response sanitization middleware |
| **Biometric Security** | Encryption at rest, no raw biometric storage |

### AI-Specific Security Risks
| Risk | Status | Mitigation Needed |
|------|--------|-------------------|
| **Prompt Injection** | ❌ Unprotected | Input validation on all AI prompts |
| **WhatsApp Impersonation** | ⚠️ Partial | Verify sender JID against registered parent phones |
| **Replay Attacks** | ✅ Protected | JWT expiry + nonce checking |
| **Tool Authorization** | ❌ Missing | AI tool invocation must check user permissions |
| **Data Leakage** | ⚠️ Partial | LLM prompts must not include other students' data |
| **Rate Limiting (AI)** | ❌ Missing | Per-user AI query limits needed |

### Assessment
**Score: 6/10** — Standard security is solid. AI-specific security (prompt injection, tool authorization, AI rate limiting) is not yet implemented and must be built before production AI deployment.

---

## 22. Technical Debt

### Quick Wins (1-2 weeks)
1. **Split Prisma schema** — ADR-007 acknowledges this; use Prisma's multi-file feature
2. **Standardize service imports** — Some controllers call Prisma directly
3. **Add API documentation** — Generate OpenAPI spec from routes
4. **Environment cleanup** — `.env` has minimal config; expand validation

### Medium-Term (1-2 months)
1. **Add job queue** — BullMQ with Redis for async AI processing
2. **Implement repository pattern** — Abstract Prisma behind interfaces
3. **Add API versioning strategy** — Standardize v1/v2 approach
4. **Improve test coverage** — Jest is configured but coverage gaps exist

### Major Refactors (3-6 months)
1. **Extract AI to microservice** — Separate AI orchestrator from monolith
2. **Add message broker** — Kafka/RabbitMQ for event-driven architecture
3. **Multi-tenancy hardening** — Database-level tenant isolation
4. **WhatsApp session pooling** — Support multiple schools with separate WhatsApp numbers

### Avoidable Rewrites
- ❌ **Do NOT rewrite the backend** — Express.js + Prisma is perfectly adequate
- ❌ **Do NOT replace PostgreSQL** — It scales well and supports pgvector
- ❌ **Do NOT replace Baileys entirely** — WABA fallback strategy is correct
- ❌ **Do NOT rewrite authentication** — JWT + family accounts is solid

---

## 23. AI Roadmap

### Phase 1: AI Infrastructure (Weeks 1-4)
- Add `pgvector` extension to PostgreSQL
- Set up vector storage table (`DocumentEmbedding`)
- Install job queue (BullMQ + Redis)
- Build AI middleware (rate limiting, prompt injection guard)
- **Estimated Effort:** 2-3 engineers, 4 weeks
- **Dependencies:** None
- **Risk:** Low
- **Rollback:** Remove middleware, disable queue

### Phase 2: Intent Detection (Weeks 3-6)
- Build intent classifier (rule-based → LLM-based)
- Create conversation state machine
- Add WhatsApp inbound message routing to AI handler
- **Estimated Effort:** 2 engineers, 3 weeks
- **Dependencies:** Phase 1
- **Risk:** Medium (parent experience changes)
- **Rollback:** Route back to human support

### Phase 3: Tool Calling (Weeks 5-8)
- Define tool schema for all read-only APIs
- Build tool executor with permission checking
- Integrate with AI Bridge
- **Estimated Effort:** 2 engineers, 4 weeks
- **Dependencies:** Phase 2
- **Risk:** Medium
- **Rollback:** Disable tool execution

### Phase 4: Attendance Assistant (Weeks 7-10)
- "Who is absent today?" — WhatsApp query → attendance data
- "Notify parents of absent students" — AI-triggered notification
- **Estimated Effort:** 1-2 engineers, 3 weeks
- **Dependencies:** Phase 3
- **Risk:** Low
- **Rollback:** Revert to manual attendance reports

### Phase 5: Finance Assistant (Weeks 9-12)
- "What is my balance?" — Parent WhatsApp query
- "Send fee reminder to unpaid parents" — AI-triggered bulk message
- **Estimated Effort:** 2 engineers, 3 weeks
- **Dependencies:** Phase 3
- **Risk:** Low (read-only); Medium if STK Push enabled
- **Rollback:** Disable finance queries

### Phase 6: Transport Assistant (Weeks 11-14)
- "Where is the school bus?" — GPS integration (if available)
- "My child is not on the bus" — Alert escalation
- **Estimated Effort:** 1-2 engineers, 3 weeks
- **Dependencies:** Phase 3
- **Risk:** Low
- **Rollback:** Disable transport queries

### Phase 7: Teacher AI (Weeks 13-18)
- Auto-generate report comments via LLM (upgrade from rule-based)
- "Which students need intervention?" — Risk analysis
- "Draft a lesson plan for..." — AI-assisted planning
- **Estimated Effort:** 2 engineers, 5 weeks
- **Dependencies:** Phase 1
- **Risk:** Medium (teacher workflow change)
- **Rollback:** Revert to rule-based comments

### Phase 8: Principal AI (Weeks 17-22)
- Daily/weekly executive summaries
- Predictive alerts for cash flow, attendance trends
- Comparative benchmarking
- **Estimated Effort:** 2 engineers, 5 weeks
- **Dependencies:** Phase 7
- **Risk:** Low
- **Rollback:** Disable summaries

### Phase 9: Voice Notes (Weeks 21-26)
- Speech-to-text for WhatsApp voice messages
- Text-to-speech for responses (optional)
- **Estimated Effort:** 2 engineers, 5 weeks
- **Dependencies:** Phase 2
- **Risk:** Medium (cost, accuracy)
- **Rollback:** Text-only mode

### Phase 10: RAG (Weeks 25-32)
- Document ingestion pipeline (PDF, Word, policies)
- Vector embedding generation
- Retrieval-augmented generation for school policies, curriculum
- **Estimated Effort:** 2-3 engineers, 7 weeks
- **Dependencies:** Phase 1
- **Risk:** Medium
- **Rollback:** Disable document search

---

## Final Assessment Scorecard

| Area | Score (1-10) | Notes |
|------|-------------|-------|
| **API Architecture** | 7 | Broad, consistent REST API; lacks OpenAPI and versioning |
| **WhatsApp Integration** | 6 | Baileys + WABA dual strategy; needs inbound AI routing |
| **Payments** | 6 | M-Pesa STK Push ready; needs AI guardrails |
| **Attendance** | 8 | Biometric + manual + Presence Engine; excellent foundation |
| **Biometrics** | 8 | ZKTeco adapter, sync workers, encryption |
| **Notifications** | 8 | Multi-channel, real-time, deduplicated |
| **Authentication** | 8 | JWT, family accounts, OTP, impersonation |
| **Database** | 7 | Well-structured PostgreSQL; needs pgvector for RAG |
| **Security** | 6 | Solid standard security; AI-specific risks unaddressed |
| **AI Readiness** | 5 | AI Bridge exists but no tool framework, RAG, or memory |
| **Scalability** | 5 | Monolithic; fine for current scale, needs horizontal scaling for 500+ schools |
| **Developer Experience** | 6 | Good tooling (Prisma, TypeScript); large flat schema is painful |

**Overall Readiness Score: 6.3/10**

---

## Reuse vs. Build Recommendations

### ✅ Reuse Without Modification
1. **Authentication system** — JWT, family accounts, role normalization
2. **Notification service** — Multi-channel delivery already built
3. **Payment infrastructure** — M-Pesa integration is solid
4. **Biometric integration** — ZKTeco adapter + Presence Engine
5. **AI Bridge** — LLM client abstraction is well-designed
6. **Rule-based AI assistants** — Can be augmented, not replaced
7. **Prisma ORM** — Mature, typed, migration-ready
8. **Redis cache** — With fallback, production-stable

### 🔧 Wrap Instead of Rewrite
1. **APIs as AI Tools** — Build a tool-schema wrapper around existing REST endpoints
2. **WhatsApp Service** — Wrap with conversation state management
3. **SMS Service** — Wrap with AI-generated message templating
4. **Document Service** — Wrap with parsing + embedding pipeline
5. **Parent Access Service** — Wrap with AI permission checker

### ➕ Extend
1. **AI routes** — Add tool-calling endpoints, conversation management
2. **Presence Engine** — Add AI-triggered events (anomaly detection)
3. **Cron worker** — Add AI-specific background jobs
4. **Notification service** — Add AI-generated content channel
5. **Middleware** — Add AI rate limiting, prompt injection detection

### 🔨 Refactor Before AI
1. **Add job queue** — Required for async AI processing
2. **Split Prisma schema** — Required for maintainability at scale
3. **Add pgvector** — Required for RAG
4. **Build AI middleware** — Required for security
5. **Standardize service layer** — Required for reliable tool calling

### 🚫 Never Touch (Production-Ready)
1. **M-Pesa Daraja integration** — Critical financial path
2. **Biometric sync workers** — Critical attendance path
3. **Authentication middleware** — Critical security path
4. **Presence Engine core** — Critical event sourcing
5. **Assessment result calculations** — Critical academic integrity

---

## Conclusion

TrendScore is **closer to AI readiness than most production systems**. The existence of an AI Bridge, Presence Engine, dual WhatsApp strategy, and family account architecture means the foundation is strong. The critical path to AI is:

1. **Infrastructure:** Add job queue + pgvector + AI middleware
2. **Intelligence:** Build intent detection + tool framework
3. **Channels:** Wire WhatsApp inbound to AI handler
4. **Safety:** Implement AI-specific security before any write operations

**The recommended approach is incremental:** Start with read-only AI assistants (attendance queries, fee balance) via WhatsApp, then gradually add write capabilities with human confirmation, and finally introduce RAG and voice.

---

*Report generated by systematic codebase investigation. No code was modified during this assessment.*
