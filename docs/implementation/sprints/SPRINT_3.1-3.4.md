# Sprint 3.1–3.4 — Guardian Portal

**Phase:** 3  
**Sprints:** 3.1 through 3.4 (completed together)  
**Completed:** August 2026  
**Goal:** Two-way parent communication, chronic absenteeism detection, WhatsApp Business migration path, inbound SMS infrastructure.

---

## Tasks Completed

| Task | Deliverable | Tests | Status |
|---|---|---|---|
| 3.1 | Inbound SMS callback endpoint (AT + MobileSasa) | — | ✅ DONE |
| 3.1 | ParentSmsReply model + SmsReplyService | 17 unit tests | ✅ DONE |
| 3.2 | Parent absence acknowledgement via SMS reply | Covered in service tests | ✅ DONE |
| 3.2 | Parent call-back request forwarded to teacher | Covered in service tests | ✅ DONE |
| 3.3 | ChronicAbsentWorker (weekly Monday cron) | 9 unit tests | ✅ DONE |
| 3.3 | PresenceRuleViolation de-duplication | Covered in worker tests | ✅ DONE |
| 3.4 | WhatsAppBusinessService (official Cloud API) | 19 unit tests | ✅ DONE |
| 3.4 | WABA feature flag — only activates when env vars set | ✅ DONE | |
| DB | parent_sms_replies table + migration applied | — | ✅ DONE |

---

## Files Created

```
server/src/domains/communication/sms-reply.service.ts         ← inbound SMS handler
server/src/domains/communication/sms-reply.service.test.ts    ← 17 unit tests
server/src/domains/communication/sms-callback.controller.ts   ← webhook controller
server/src/domains/communication/whatsapp-business.service.ts ← WABA adapter
server/src/domains/communication/whatsapp-business.service.test.ts ← 19 unit tests
server/src/domains/attendance/chronic-absent.worker.ts        ← weekly cron
server/src/domains/attendance/chronic-absent.worker.test.ts   ← 9 unit tests
server/src/routes/webhooks.routes.ts                          ← public webhook routes
server/prisma/migrations/20260804030000_phase3_parent_sms_replies/migration.sql
```

## Files Modified

```
server/src/cron-worker.ts      ← ChronicAbsentWorker wired at 04:00 UTC Mondays
server/src/routes/index.ts     ← /api/webhooks registered (public, before auth)
server/.env.example            ← SMS_CALLBACK_SECRET, WABA_* vars documented
```

---

## API Endpoints Live

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/webhooks/sms/inbound/africastalking` | POST | None (IP whitelist at proxy) | Africa's Talking inbound SMS |
| `/api/webhooks/sms/inbound/mobilesasa` | POST | HMAC signature | MobileSasa inbound SMS |

---

## Two-Way SMS Flow

```
Parent receives absent child SMS (09:30 EAT daily)
    ↓
Parent replies "OK" / "sawa" / "noted"
    ↓
POST /api/webhooks/sms/inbound/{provider}
    ↓
SmsReplyService.processInbound()
    ├── Intent parsed: ACKNOWLEDGE_ABSENCE
    ├── Phone → LearnerId resolved (outbound SMS → phone lookup fallback)
    ├── ParentSmsReply record created
    └── Teacher notified (in-app): "Parent of Alice acknowledged today's absence"
```

## Chronic Absent Cron

- **Schedule:** Monday 07:00 EAT (04:00 UTC)
- **Threshold:** 20% absence rate over 4 weeks (configurable via `presence_rules.config`)
- **De-duplication:** Only creates violation if no unresolved `CHRONIC_ABSENT` violation exists
- **Notifications:** Class teacher + head teacher receive in-app alert with absence rate

## WhatsApp Business

- Feature-flagged: only activates when `WABA_PHONE_NUMBER_ID` + `WABA_ACCESS_TOKEN` are set
- `isWabaConfigured()` returns false until credentials are in env — no impact on schools without WABA
- `sendAbsentNotification()` tries the `school_absent_child` template first, falls back to plain text
- Existing Baileys/wwebjs service remains untouched
- Webhook verification endpoint: `GET /api/webhooks/whatsapp` (to be added in next iteration)

---

## Cumulative Test Count

| Suite | Tests |
|---|---|
| biometric.encryption | 14 |
| attendance.lock | 24 |
| absent-learner.worker | 15 |
| presence.service | 11 |
| timeline.engine | 21 |
| trip.service | 14 |
| sms-reply.service | 17 |
| chronic-absent.worker | 9 |
| whatsapp-business.service | 19 |
| **TOTAL** | **144** |

---

## Intent Recognition (Swahili + English)

| Message | Classified as |
|---|---|
| OK, okay, noted, received, acknowledged | ACKNOWLEDGE_ABSENCE |
| sawa, nimepokea, nimeona | ACKNOWLEDGE_ABSENCE (Swahili) |
| call me, please call | REQUEST_CALL |
| nipigie, niite | REQUEST_CALL (Swahili) |
| anything else | OTHER |

---

## Phase 3 Status

✅ All deliverables complete  
✅ 116 migrations applied, DB up to date  
✅ Zero TypeScript diagnostics  
✅ 144 total tests passing
