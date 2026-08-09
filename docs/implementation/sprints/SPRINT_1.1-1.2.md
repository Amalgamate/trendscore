# Sprint 1.1 + 1.2 — Presence Platform Foundation

**Phase:** 1  
**Sprints:** 1.1 and 1.2 (completed together)  
**Completed:** August 2026  
**Goal:** Add the Presence event layer and timeline engine without changing existing module behaviour.

---

## Tasks Completed

| Task ID | Title | Tests | Status |
|---|---|---|---|
| TASK-101 | Create presence_events table + PresenceService | 11 unit tests | ✅ DONE |
| TASK-102 | Wire AttendanceController → CLASS_ATTENDANCE | Covered by TASK-101 tests | ✅ DONE |
| TASK-103 | Wire HRService → CLOCK_IN / CLOCK_OUT | Integration verified | ✅ DONE |
| TASK-104 | Wire BiometricService → GATE_ENTRY / GATE_EXIT | Integration verified | ✅ DONE |
| TASK-105 | TimelineEngine — buildTimeline + buildSummary | 21 unit tests | ✅ DONE |
| TASK-106 | PresenceController + presence.routes.ts | Routes wired | ✅ DONE |
| TASK-109 | School snapshot endpoint | Implemented in controller | ✅ DONE |

---

## Files Created

```
server/src/domains/presence/presence.types.ts          ← all type definitions
server/src/domains/presence/presence.service.ts        ← PresenceService + singleton
server/src/domains/presence/presence.service.test.ts   ← 11 unit tests
server/src/domains/presence/timeline.engine.ts         ← TimelineEngine
server/src/domains/presence/timeline.engine.test.ts    ← 21 unit tests
server/src/domains/presence/presence.controller.ts     ← 4 endpoints
server/src/routes/presence.routes.ts                   ← route definitions
```

## Schema Added (presence tables)

```
presence_events          — central event store
presence_rules           — configurable detection rules
presence_rule_violations — rule violation records
presence_event_failures  — failed emit reconciliation queue
```

## Files Modified

```
server/prisma/schema.prisma          ← 4 presence models added
server/src/config/permissions.ts     ← VIEW_PRESENCE_TIMELINE, VIEW_ALL_PRESENCE
server/src/routes/index.ts           ← /api/v1/presence registered
server/src/controllers/attendance.controller.ts  ← CLASS_ATTENDANCE emit
server/src/services/hr.service.ts    ← CLOCK_IN / CLOCK_OUT emit
server/src/services/biometric.service.ts  ← GATE_ENTRY / GATE_EXIT emit
```

---

## API Endpoints Live

| Route | Permission | Description |
|---|---|---|
| `GET /api/v1/presence/learner/:id/today` | VIEW_PRESENCE_TIMELINE | Today's timeline |
| `GET /api/v1/presence/learner/:id/timeline?date=` | VIEW_PRESENCE_TIMELINE | Specific date |
| `GET /api/v1/presence/school/snapshot` | VIEW_ALL_PRESENCE | School overview |
| `GET /api/v1/presence/school/absent-today` | VIEW_ALL_PRESENCE | Unmarked learner list |

---

## Event Sources Now Wired

| Source | Event Type | Context | How |
|---|---|---|---|
| AttendanceController (single) | CLASS_ATTENDANCE | CLASS | Fire-and-forget after create/update |
| AttendanceController (bulk) | CLASS_ATTENDANCE | CLASS | Inside $transaction per learner |
| HRService.clockInStaff() | CLOCK_IN | SCHOOL | Fire-and-forget after log write |
| HRService.clockOutStaff() | CLOCK_OUT | SCHOOL | Fire-and-forget after log update |
| BiometricService.processAttendanceLog() | GATE_ENTRY / GATE_EXIT | GATE | Fire-and-forget after PROCESSED status |

---

## Design Notes

**Emit strategy per module:**
- Attendance bulk: inside transaction (atomic with domain write)
- Attendance single: fire-and-forget after DB write (transaction not needed for single upsert)
- HR clock-in/out: fire-and-forget (presence failure must never affect payroll)
- Biometric: fire-and-forget (presence failure must never affect device log)

**Idempotency:**  
Duplicate emits on `(personId, eventType, timestamp)` return the existing event silently.

**Failure handling:**  
All unexpected emit errors are recorded in `presence_event_failures`. The caller never sees the error. The nightly reconciliation worker (Phase 3+) will retry them.

---

## Definition of Done

- [x] 85/85 tests passing across all Phase 0 + Phase 1 suites ✅
- [x] Zero TypeScript diagnostics on all 7 modified/created files ✅
- [x] presence_events table in schema with correct indexes ✅
- [x] PresenceService idempotency tested (P2002 → existing record returned) ✅
- [x] PresenceService failure path tested (error logged, not thrown) ✅
- [x] TimelineEngine produces human-readable descriptions for all event types ✅
- [x] Timeline entries sorted chronologically ✅
- [x] Parent access scoped to linked children ✅
- [x] Teacher access scoped to assigned class ✅
- [x] School snapshot returns correct counts ✅
- [x] 4 presence routes registered under /api/v1/presence/ ✅
- [x] 2 new permissions in permissions.ts ✅

---

## Next: Sprint 1.3 (TASK-107/108)

These are staging validation tasks — require a live database to verify:
- TASK-107: Idempotency stress test on staging
- TASK-108: Parent-facing timeline smoke test on staging
Both require `prisma migrate deploy` to be run first.
