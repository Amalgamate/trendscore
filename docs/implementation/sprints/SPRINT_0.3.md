# Sprint 0.3 — Absent Learner Notification

**Phase:** 0 (Security & Critical Gaps)  
**Sprint:** 0.3  
**Completed:** August 2026  
**Goal:** Send SMS to parents when a learner is absent. Retry failed SMS automatically.

---

## Sprint Tasks

| Task ID | Title | Estimate | Status | Notes |
|---|---|---|---|---|
| TASK-007 | Absent learner SMS cron worker | L | ✅ DONE | 15 unit tests passing |
| TASK-008 | SMS retry on failure | M | ✅ DONE | 3-attempt exponential back-off |
| Schema | Add retryAt to sms_outbound_audits | XS | ✅ DONE | |

---

## Files Created

```
server/src/domains/attendance/absent-learner.worker.ts        ← daily SMS worker
server/src/domains/attendance/absent-learner.worker.test.ts   ← 15 unit tests
server/src/domains/communication/sms-retry.worker.ts          ← hourly retry worker
```

## Files Modified

```
server/src/cron-worker.ts        ← two new cron jobs wired in
server/prisma/schema.prisma      ← retryAt field added to SmsOutboundAudit
```

---

## Cron Schedule

| Job | Schedule | EAT | UTC |
|---|---|---|---|
| AbsentLearnerSmsWorker | `30 6 * * *` | 09:30 | 06:30 |
| SmsRetryWorker | `0 * * * *` | Every hour | Every hour |

---

## Absent Learner Logic

1. Skip if not a working day (school.staffWorkingDays config)
2. Skip if school.attendanceNotifyAbsentDefault is false
3. Find learners with NO attendance record today OR with ABSENT status
4. Skip learners with PRESENT / LATE / EXCUSED / SICK
5. Resolve parent phone: primaryContactPhone → guardianPhone → motherPhone → fatherPhone
6. Skip learners already notified today (idempotent — safe to run twice)
7. Send SMS via SmsService, write audit record to sms_outbound_audits
8. Process in batches of 50 with 100ms delay between batches

## SMS Retry Logic

- Eligible: status=FAILED, retryCount<3, age>5min, retryAt<=now
- Back-off: 5min → 15min → 45min
- After 3 failures: PERMANENTLY_FAILED + admin in-app notification
- Admin notification masks phone number (privacy)

---

## Definition of Done

- [x] 15/15 unit tests for worker pure logic ✅
- [x] 53/53 total Phase 0 tests passing ✅
- [x] Non-working day skips verified ✅
- [x] Phone fallback chain verified ✅
- [x] SMS message format includes school name, learner name, grade, date ✅
- [x] Deduplication: safe to run twice in same day ✅
- [x] Retry back-off logic: 5/15/45 minutes ✅
- [x] Admin notified on permanent failure ✅
- [x] Zero TypeScript diagnostics ✅
- [x] Cron jobs wired in cron-worker.ts ✅
