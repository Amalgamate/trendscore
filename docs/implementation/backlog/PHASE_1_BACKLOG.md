# Phase 1 Backlog — Presence Platform Foundation

**Phase:** 1  
**Theme:** Add the event layer without changing existing module behaviour  
**Target:** Weeks 4–7 (starts after Phase 0 sign-off)  
**Prerequisite:** Phase 0 Definition of Done complete  

---

## Sprint 1.1 — Presence Events Infrastructure

### TASK-101 Create presence_events table and PresenceService
**Effort:** M (3 days)  
**Refs:** EVENT-001, DB-001 M-006 to M-009, MAS §5.2  
**Acceptance criteria:**
- Migrations: `presence_events`, `presence_rules`, `presence_rule_violations`, `presence_event_failures`
- `PresenceService` class in `server/src/domains/presence/presence.service.ts`
- `emit()` method with full idempotency (dedup by personId + eventType + timestamp)
- Failure path: writes to `presence_event_failures`, logs error, does NOT throw
- Key rotation version field in event record
- Unit test: duplicate event returns existing record (no error)
- Unit test: failure path writes to failures table and does not propagate exception

### TASK-102 Wire AttendanceController to emit CLASS_ATTENDANCE
**Effort:** S (1 day)  
**Refs:** EVENT-001 §3 Example 1  
**Acceptance criteria:**
- `markAttendance()` emits after successful attendance create/update
- `markBulkAttendance()` emits per-learner inside the transaction
- Presence event `metadata` includes `classId`, `attendanceStatus`
- Existing attendance tests still pass — no behaviour change

### TASK-103 Wire HRService to emit CLOCK_IN and CLOCK_OUT
**Effort:** S (1 day)  
**Refs:** EVENT-001 §3 Example 5  
**Acceptance criteria:**
- `clockInStaff()` emits `CLOCK_IN` on successful log creation
- `clockOutStaff()` emits `CLOCK_OUT` on successful log update
- Presence event `personType = 'STAFF'`
- Existing HR tests still pass

### TASK-104 Wire BiometricService to emit GATE_ENTRY / GATE_EXIT
**Effort:** S (1 day)  
**Refs:** EVENT-001 §3 Example 2  
**Acceptance criteria:**
- `processAttendanceLog()` emits presence event after biometric log creation
- Direction `IN` → `GATE_ENTRY`, context `GATE`
- Direction `OUT` → `GATE_EXIT`, context `GATE`
- `deviceId` populated on event
- Existing biometric tests still pass

---

## Sprint 1.2 — Timeline Engine

### TASK-105 Implement TimelineEngine
**Effort:** M (3 days)  
**Refs:** MAS §5.2, EVENT-001 §10  
**Acceptance criteria:**
- `TimelineEngine.buildTimeline(personId, date)` returns array of `TimelineEntry`
- `TimelineEntry` shape: `{ timestamp, eventType, context, location, description, source }`
- `description` is human-readable: `"Marked Present — Grade 5B"`, `"Arrived at School Gate"`, `"Boarded Route 3 Bus"`
- Events sorted chronologically (earliest first)
- Returns empty array if no events (not an error)
- Unit test: mixed event types produce correct descriptions in correct order
- Unit test: empty date returns empty array

### TASK-106 Implement PresenceController and timeline route
**Effort:** S (1 day)  
**Refs:** MAS §5.3, API-001  
**Acceptance criteria:**
- `GET /api/v1/presence/learner/:learnerId/today` — returns today's timeline
- `GET /api/v1/presence/learner/:learnerId/timeline?date=YYYY-MM-DD` — specific date
- Permission: `VIEW_PRESENCE_TIMELINE`
- Parent access: scoped to their linked children only (via `parentAccessService`)
- Teacher access: scoped to their assigned class learners
- Admin access: any learner
- Response follows standard envelope: `{ success, data: { date, events: TimelineEntry[] } }`
- Integration test: teacher can see class learner timeline, cannot see other class

---

## Sprint 1.3 — Parent Access and Idempotency Validation

### TASK-107 Presence idempotency stress test
**Effort:** S (1 day)  
**Refs:** EVENT-001 §4  
**Acceptance criteria:**
- Integration test: same event emitted 3 times in rapid succession
- Result: exactly 1 row in `presence_events`
- No errors thrown on duplicates
- `presence_event_failures` table remains empty

### TASK-108 Parent-facing timeline smoke test
**Effort:** S (1 day)  
**Refs:** MAS §5.6  
**Acceptance criteria:**
- Create test scenario: learner with CLASS_ATTENDANCE + GATE_ENTRY + CLOCK_OUT (staff for comparison)
- Parent user can call `GET /api/v1/presence/learner/:id/today`
- Response contains events from all wired sources
- Response does NOT include staff CLOCK_IN events for the learner
- Timeline shows correct chronological order
- Other parent's child: 403 response

### TASK-109 School snapshot endpoint
**Effort:** M (2 days)  
**Refs:** MAS §5.3  
**Acceptance criteria:**
- `GET /api/v1/presence/school/snapshot` — requires `VIEW_ALL_PRESENCE` permission
- Returns: `{ date, totalLearners, presentCount, absentCount, lateCount, unmarkedCount, staffPresent, staffAbsent }`
- `absentCount` = learners with `CLASS_ATTENDANCE` where status is ABSENT
- `unmarkedCount` = active learners with NO presence event of type CLASS_ATTENDANCE today
- Response cached in Redis for 2 minutes (snapshot is acceptable at slight delay)
- Integration test: correct counts after seeding attendance data

---

## Phase 1 Definition of Done

- [x] TASK-101 through TASK-106, TASK-109 complete ✅
- [x] 85/85 tests passing — no regression ✅
- [x] `presence_events` schema added ✅
- [ ] `presence_events` table accumulating real data on staging — **PENDING: migrate deploy**
- [ ] Parent can call timeline endpoint and receive events from at least 2 sources — **PENDING: staging**
- [ ] School snapshot returns accurate counts — **PENDING: staging**
- [ ] Performance test: timeline for 365 days responds in < 300ms — **PENDING: staging**
- [ ] TASK-107: Idempotency stress test on staging — **PENDING**
- [ ] TASK-108: Parent-facing timeline smoke test on staging — **PENDING**
- [ ] Architecture review sign-off before Phase 2 begins
