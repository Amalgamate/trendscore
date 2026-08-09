# TrendSCORE 2.0 — Technical Architecture

**Document ID:** TECH-001  
**Version:** 1.0  
**Status:** DRAFT — Pending Architecture Review  
**Date:** August 2026  
**Parent Document:** `00_MASTER_ARCHITECTURE_SPECIFICATION.md`

---

## 1. Runtime Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Backend runtime | Node.js | LTS (20.x) | Express HTTP server |
| Backend framework | Express | 4.x | Existing, stable |
| Language | TypeScript | 5.x | Strict mode on all new files |
| ORM | Prisma | 5.x | Single schema file until multi-file GA |
| Database | PostgreSQL | 15+ | Hosted on Supabase |
| Cache | Redis | 7.x | Session cache, rate limiting, config TTL |
| Frontend framework | React | 18.x | Vite build toolchain |
| Frontend language | TypeScript / JSX | 5.x | |
| CSS | Tailwind CSS | 3.x | |
| Real-time | Socket.io | 4.x | Bidirectional events per userId room |
| Push notifications | web-push | VAPID | W3C Push API |
| Process manager | PM2 | 5.x | `ecosystem.config.js` |
| Containers | Docker | — | Dockerfile + docker-compose |

---

## 2. Process Architecture

TrendSCORE runs as two Node.js processes under PM2:

```
PM2 Cluster
├── server (HTTP + Socket.io)      ← handles all API requests
│     └── server/src/index.ts
└── cron-worker (background jobs)  ← runs all scheduled tasks
      └── server/src/cron-worker.ts
```

**Why separate cron worker?**  
Background jobs (SMS dispatch, library fines, pledge reminders) must not compete with HTTP request throughput. A separate process means a long-running cron task cannot delay an API response.

**Socket.io and multi-process:**  
If the HTTP server is eventually scaled to multiple instances, Socket.io will require a Redis adapter (`@socket.io/redis-adapter`) to broadcast across instances. This is pre-wired by ensuring the Redis client is already a dependency. No code change is needed in the Notification service — only the socket initialisation changes.

---

## 3. Request Lifecycle

```
Client Request
      │
      ▼
Express Router (server/src/routes/index.ts)
      │
      ▼
Auth Middleware (authenticate)         ← verifies JWT, attaches req.user
      │
      ▼
Permission Middleware (requirePermission) ← checks permission string
      │
      ▼
Rate Limit Middleware
      │
      ▼
Validation Middleware (Zod schema)
      │
      ▼
Audit Log Middleware (auditLog)         ← records write operations
      │
      ▼
asyncHandler wrapper
      │
      ▼
Controller method
      │
      ├── calls Service method(s)
      │         │
      │         ├── Prisma transaction
      │         │     ├── Primary domain write
      │         │     └── PresenceService.emit() [if applicable]
      │         │
      │         └── Side effects (SMS, notification) — outside transaction
      │
      └── res.json(envelope)
```

**Critical rule:** Side effects (SMS, push notifications, Socket.io emit) always happen **outside** the Prisma transaction. A notification failure must never roll back a domain write.

---

## 4. Cron Worker Architecture

```
cron-worker.ts
├── Scheduler (node-cron)
│     ├── Daily 09:30 EAT  — AbsentLearnerSmsWorker    [Phase 0]
│     ├── Daily 05:00 UTC  — PledgeReminderWorker       [existing]
│     ├── Daily 21:05 UTC  — LibraryLateFineWorker      [existing]
│     ├── Daily 05:00 UTC  — LibraryOverdueSmsWorker    [existing]
│     ├── Daily 17:00 UTC  — DutyRosterTomorrowWorker   [existing]
│     ├── Daily 03:00 UTC  — DutyRosterSameDayWorker    [existing]
│     ├── Sunday 15:00 UTC — DutyRosterWeeklyWorker     [existing]
│     ├── Every 5 min      — ApprovalExpiryWorker       [existing]
│     ├── Daily 17:00 UTC  — LMSAssignmentDueWorker     [existing]
│     ├── Daily 06:00 EAT  — ExeatOverdueWorker         [Phase 5]
│     ├── Daily 22:30 EAT  — NightRollCallAbsenceWorker [Phase 5]
│     └── Monday 07:00 EAT — ChronicAbsenceWorker       [Phase 3]
│
└── Worker contract (all workers must implement):
      - Log start with [CRON] prefix and worker name
      - Log end with record count processed
      - Log errors with error detail but without PII
      - Return gracefully on zero records (no error)
      - Be idempotent — safe to run twice in the same window
```

---

## 5. Database Connection Architecture

```
Application
└── Prisma Client
      ├── DATABASE_URL      ← Supabase pooled connection (pgBouncer)
      └── DIRECT_URL        ← Supabase direct connection (migrations only)
```

**Why two URLs?**  
Supabase uses pgBouncer for connection pooling. Prisma migrations require a direct connection (pgBouncer does not support `SET` commands used in migration). `DATABASE_URL` is used for all queries; `DIRECT_URL` is used only by `prisma migrate`.

**Connection pool sizing:**  
Default Prisma pool is `(CPU cores × 2) + 1`. For a single-core server this is 3. For multi-core: adjust `connection_limit` in `DATABASE_URL` query string.

---

## 6. Caching Architecture

Redis is used in three ways:

| Use | Key pattern | TTL |
|---|---|---|
| SMS/Communication config | `global_config` | 5 minutes |
| Rate limiting counters | `ratelimit:{userId}:{route}` | 1 minute window |
| Session token blacklist | `blacklist:{token}` | Until token natural expiry |

Redis is optional — if `REDIS_URL` is not set, the application falls back to in-process memory for rate limiting and config cache. This allows development without Redis.

---

## 7. WebSocket Architecture

Socket.io rooms are scoped to `userId`. When a notification is created:

1. `NotificationService.createNotification()` emits to `io.to(userId)`
2. The client joined the `userId` room on connect (after JWT authentication)
3. If the socket is offline, the notification is persisted in `user_notifications` and delivered on next connect

```
Server socket events emitted:
  notification:new        — new bell notification
  presence:update         — real-time presence state change [Phase 1+]

Client socket events received:
  join:{userId}           — client announces its userId room
```

---

## 8. External Integrations

### SMS Providers
| Provider | Integration | Auth | Notes |
|---|---|---|---|
| Africa's Talking | REST API | API Key + Username | Primary for most schools |
| MobileSasa | REST API | Bearer token | Alternative, supports STK push |

Both providers support inbound SMS callbacks (Phase 3).

### Email
| Provider | Integration | Auth |
|---|---|---|
| Resend | REST API | API Key |

### Payment
| Provider | Integration | Notes |
|---|---|---|
| M-Pesa Daraja | REST API | STK push, C2B callbacks |
| Intasend | REST API | Card payments |
| KopoKopo | REST API | Till-based collections |

### Biometric Devices (Phase 4)
| Vendor | Integration Mode | Protocol |
|---|---|---|
| ZKTeco | Push (webhook) + Pull (SDK) | HTTP / ZKTeco SDK |
| Hikvision | Push (ISAPI events) | HTTP / ISAPI |
| Generic NFC/RFID | Push (webhook only) | HTTP |

---

## 9. Environment Configuration Contract

All secrets and environment-specific config are supplied via environment variables. The `.env.example` file is the authoritative list of required variables.

**Required for all environments:**
```
DATABASE_URL
DIRECT_URL
JWT_SECRET
ENCRYPTION_KEY           ← General app encryption (SMS API keys etc.)
BIOMETRIC_ENCRYPTION_KEY ← Dedicated key for biometric templates
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

**Optional (feature-gated):**
```
REDIS_URL
AT_API_KEY / AT_USERNAME        ← Africa's Talking fallback
MOBILESASA_API_KEY
RESEND_API_KEY
MPESA_*
ZKTECO_*                        ← Phase 4
WABA_*                          ← Phase 3 (WhatsApp Business)
```

---

## 10. Build and Local Development

```
# Backend
cd server
npm install
npx prisma migrate dev     ← Apply migrations + generate client
npm run dev                ← ts-node + nodemon

# Frontend
npm install
npm run dev                ← Vite dev server

# Run both (root)
# Run server and client separately — no concurrent root script exists currently
```

**Recommended:** Add a root-level `dev` script using `concurrently` to start both in one terminal. This is a developer experience improvement deferred to an implementation sprint.

---
