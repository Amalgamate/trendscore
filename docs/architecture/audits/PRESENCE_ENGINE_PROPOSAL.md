# Presence Engine Proposal — TrendScore

**Date:** August 2026  
**Status:** Feasibility assessment only. No implementation.

---

## 1. What Is a Presence Engine?

A Presence Engine is a **centralised event bus** that any module in the system can publish to when it observes or records that a person is (or is not) at a location at a point in time. Instead of each module managing its own isolated "was this person here?" logic, all presence events converge to a single service that:

1. Records the event with a standardised schema
2. Routes notifications to relevant stakeholders
3. Provides a unified query API ("where is this student right now?")
4. Supports audit and reporting across all event types

---

## 2. Current Architecture Assessment

Today, TrendScore manages "where is this person?" across **multiple isolated systems:**

| Module | Presence Data | Isolation |
|---|---|---|
| Student Attendance | `attendances` table (daily, manual mark) | ❌ Isolated |
| Staff Attendance | `staff_attendance_logs` (clock-in/out, biometric) | ❌ Isolated |
| Biometric Logs | `biometric_logs` (raw device events) | ❌ Isolated |
| Transport | Learner assigned to route (static, no events) | ❌ No events |
| Library | Visit records | ❌ Isolated |
| LMS | Assignment submissions (proxy for online presence) | ❌ Isolated |

**Problems with this:** No cross-module presence query, no unified parent view ("my child was in school, on the bus, in the library"), no way to detect anomalies across contexts.

---

## 3. Proposed Standard Event Schema

Every module that knows about presence would emit events conforming to:

```typescript
interface PresenceEvent {
  id: string;               // UUID
  schoolId: string;         // Multi-tenancy
  personId: string;         // Learner or User UUID
  personType: 'LEARNER' | 'STAFF' | 'VISITOR' | 'VEHICLE';
  eventType: PresenceEventType;
  context: PresenceContext;
  timestamp: DateTime;      // When the event occurred
  recordedAt: DateTime;     // When it was recorded in the system
  recordedBy?: string;      // userId if manual
  deviceId?: string;        // biometric_devices.id if automated
  location?: string;        // Optional location label
  direction?: 'IN' | 'OUT';
  status: 'CONFIRMED' | 'PENDING' | 'DISPUTED';
  metadata?: Record<string, any>;
}
```

### Presence Event Types

```
GATE_ENTRY          // Arrived at school gate
GATE_EXIT           // Left school gate
CLASS_ATTENDANCE    // Marked present in class
BUS_BOARDED         // Boarded school bus
BUS_ALIGHTED        // Left school bus
DORM_ROLL_CALL      // Present at dorm roll call
DINING_ATTENDED     // Present at meal
LIBRARY_VISITED     // Present in library
ASSEMBLY_ATTENDED   // Present at assembly
CLINIC_VISITED      // Present in clinic / sick bay
PREP_ATTENDED       // Present at prep session
EXEAT_DEPARTED      // Boarded leave
EXEAT_RETURNED      // Returned from leave
CLOCK_IN            // Staff clock-in
CLOCK_OUT           // Staff clock-out
VISITOR_ENTRY       // Visitor arrived
VISITOR_EXIT        // Visitor departed
```

### Presence Contexts

```
SCHOOL | CLASS | BUS | DORMITORY | DINING_HALL | LIBRARY | CLINIC
ASSEMBLY | PREP_HALL | GATE | OFF_CAMPUS | EXEAT
```

---

## 4. Feasibility Assessment

### Can Existing Modules Publish Presence Events?

| Module | Can Publish Events | Migration Complexity | Breaking Change? |
|---|---|---|---|
| Student Attendance (manual mark) | ✅ Yes — emit on create/update | LOW | No |
| Staff Clock-in/out | ✅ Yes — emit on every log | LOW | No |
| Biometric webhook | ✅ Yes — already has all fields | LOW | No |
| Transport (after trip model added) | ✅ Yes — emit on boarding | MEDIUM | No |
| Library visits | ✅ Yes — emit on loan/visit | LOW | No |
| Hostel roll call (new module) | ✅ Yes — native to design | LOW — design it in | No |
| LMS (online attendance proxy) | ⚠️ Indirectly — lesson completion | LOW | No |

**Conclusion: All modules can publish events without breaking existing functionality.** The Presence Engine is additive — existing tables stay; the engine is a subscriber + aggregator.

### Can the Existing Attendance Implementation Evolve Into This?

**Yes, with the following approach:**

The `attendances` table becomes one **source** of presence events, not the only source. Rather than replacing it, a new `presence_events` table (or an event queue) is introduced. Existing writes to `attendances` trigger a corresponding presence event write (either in the same transaction or via a service call).

This preserves backward compatibility — all existing APIs return the same data. The presence engine adds a new parallel read layer.

---

## 5. Implementation Approach (Phased)

### Phase 0 — Foundation (No breaking changes)

1. Add `presence_events` table to schema
2. Add `PresenceService` with `emit(event: PresenceEvent)` method
3. Wire `AttendanceController` to call `PresenceService.emit()` on every mark
4. Wire `HRService.clockInStaff()` and `clockOutStaff()` to emit
5. Wire `BiometricService.processAttendanceLog()` to emit

Result: Presence engine starts collecting events. No existing feature changes.

### Phase 1 — Transport

1. Add `TransportTrip` + `TransportBoardingEvent` models
2. Wire boarding events to emit `BUS_BOARDED` / `BUS_ALIGHTED`

### Phase 2 — Parent View

1. Parent portal endpoint: `GET /api/presence/learner/:id/today`
2. Returns aggregated timeline: "Arrived at school 07:42, Boarded bus 07:15..."

### Phase 3 — Boarding School

1. Hostel roll call emits `DORM_ROLL_CALL`
2. Exeat emits `EXEAT_DEPARTED` / `EXEAT_RETURNED`
3. Dining emits `DINING_ATTENDED`

### Phase 4 — Anomaly Detection

1. Cron: Learner has no `GATE_ENTRY` by 08:00 but no absence recorded → alert
2. Cron: Learner has `BUS_BOARDED` but no `CLASS_ATTENDANCE` → alert
3. Cron: Exeat return overdue → parent notification

---

## 6. Risk Assessment

| Risk | Mitigation |
|---|---|
| Dual-write inconsistency (attendance + presence event) | Wrap in Prisma transaction |
| Presence table grows very large | Partition by date, index by (personId, date), TTL for old events |
| Over-engineering for day schools | Make presence engine opt-in per school type |
| Team unfamiliarity with event-driven patterns | Start with simple DB inserts, not message broker |

---

## 7. Verdict

**A Presence Engine is feasible and low-risk to introduce incrementally.** No existing module needs to be rewritten. The engine grows by wiring more emitters over time. The payoff is a unified parent view, cross-module anomaly detection, and a boarding school foundation.

The recommended approach is **Option B: Refactor Attendance into a Presence Engine** (see `FINAL_ARCHITECTURE_RECOMMENDATION.md`), phased over several releases.
