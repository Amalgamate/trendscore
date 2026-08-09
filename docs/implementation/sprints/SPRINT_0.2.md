# Sprint 0.2 — Attendance Reliability

**Phase:** 0 (Security & Critical Gaps)  
**Sprint:** 0.2  
**Completed:** August 2026  
**Goal:** Enforce attendance lock time, wrap bulk attendance in a transaction, add sms_outbound_audit table.

---

## Sprint Tasks

| Task ID | Title | Estimate | Status | Notes |
|---|---|---|---|---|
| TASK-004 | Enforce attendance lock time | M | ✅ DONE | 24 unit tests passing |
| TASK-005 | Wrap bulk attendance in transaction | S | ✅ DONE | Prisma.$transaction, sequential loop |
| Schema | Add sms_outbound_audit table | XS | ✅ DONE | Ready for Sprint 0.3 |

---

## Files Created

```
server/src/domains/attendance/attendance.lock.ts       ← lock enforcement logic
server/src/domains/attendance/attendance.lock.test.ts  ← 24 unit tests
```

## Files Modified

```
server/src/controllers/attendance.controller.ts  ← lock + transaction + remarks enforcement
server/prisma/schema.prisma                      ← SmsOutboundAudit model added
```

---

## Definition of Done

- [x] TASK-004: `checkAttendanceLock()` — 24 unit tests passing ✅
- [x] TASK-004: TEACHER blocked after lock + grace window ✅
- [x] TASK-004: SUPER_ADMIN / ADMIN / HEAD_TEACHER bypass lock ✅
- [x] TASK-004: Grace window forces LATE status, not a block ✅
- [x] TASK-004: `attendanceRequireRemarksForLateExcused` enforced ✅
- [x] TASK-005: `markBulkAttendance()` uses `prisma.$transaction()` ✅
- [x] TASK-005: Sequential loop (not Promise.all) — consistent rollback behaviour ✅
- [x] Schema: `SmsOutboundAudit` model added with indexes ✅
- [x] Zero TypeScript diagnostics on all modified files ✅
- [x] 38/38 tests passing across Sprint 0.1 + 0.2 test suites ✅

---

## Key Design Decisions

**Lock enforcement is in the controller, not the route middleware.**  
The lock requires a DB query for school config. Putting it in middleware would add a DB round-trip to every attendance route. Only write routes need it — reads are never locked.

**Bulk attendance uses a sequential loop inside $transaction, not Promise.all.**  
`Promise.all` inside a Prisma transaction causes connection pool conflicts. Sequential writes inside one transaction are correct and fast enough at class scale (max ~60 learners).

**Status validation runs before the transaction opens.**  
Validating remarks requirements for all records upfront prevents a mid-transaction throw that would roll back partial work unnecessarily.
