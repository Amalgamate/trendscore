# TrendSCORE 2.0 — Event Architecture

**Document ID:** EVENT-001  
**Version:** 1.0  
**Status:** DRAFT — Pending Architecture Review  
**Date:** August 2026  
**Parent Document:** `00_MASTER_ARCHITECTURE_SPECIFICATION.md §9`

---

## 1. Event Emission Contract

All domain modules that generate presence facts must call `PresenceService.emit()` with a fully-populated event payload. The service method signature:

```typescript
class PresenceService {
  async emit(event: PresenceEventInput): Promise<PresenceEvent>
}

interface PresenceEventInput {
  schoolId: string;              // Required
  personId: string;              // Required — internal UUID
  personType: PersonType;        // Required
  eventType: PresenceEventType;  // Required
  context: PresenceContext;      // Required
  timestamp: Date;               // Required — when it actually happened
  recordedBy?: string;           // Optional — userId if manual
  deviceId?: string;             // Optional — biometric_devices.id
  location?: string;             // Optional — human-readable string
  direction?: 'IN' | 'OUT';      // Optional — for gate/bus/dorm events
  status?: EventStatus;          // Optional — defaults to CONFIRMED
  sourceModule: SourceModule;    // Required
  sourceRecordId?: string;       // Optional but encouraged
  metadata?: Record<string, any>; // Optional
}
```

The service writes to `presence_events` and returns the created event with its generated `id`, `recordedAt`, and `version`.

---

## 2. Event Enumeration Reference

### PersonType
```
LEARNER
STAFF
VISITOR
```

### PresenceEventType
```
CLASS_ATTENDANCE      — Marked present in class (manual or biometric)
GATE_ENTRY            — Entered school gate
GATE_EXIT             — Exited school gate
BUS_BOARDED           — Boarded school transport
BUS_ALIGHTED          — Alighted from transport
DORM_ROLL_CALL        — Present at dormitory roll call
DINING_ATTENDED       — Present at meal service
PREP_ATTENDED         — Present at prep session
ASSEMBLY_ATTENDED     — Present at assembly
LIBRARY_VISITED       — Entered library or checked out book
CLINIC_VISITED        — Visited clinic / sick bay
EXEAT_DEPARTED        — Departed on authorized leave
EXEAT_RETURNED        — Returned from leave
CLOCK_IN              — Staff clocked in
CLOCK_OUT             — Staff clocked out
VISITOR_ENTRY         — Visitor entered campus
VISITOR_EXIT          — Visitor exited campus
```

### PresenceContext
```
SCHOOL
CLASS
BUS
DORMITORY
DINING_HALL
LIBRARY
CLINIC
ASSEMBLY
PREP_HALL
GATE
OFF_CAMPUS
EXEAT
```

### EventStatus
```
CONFIRMED       — Event is verified
PENDING         — Event awaiting verification
DISPUTED        — Event is under dispute / correction
```

### SourceModule
```
ATTENDANCE
HR_STAFF
BIOMETRIC
TRANSPORT
BOARDING
LIBRARY
VISITOR
SYSTEM
```

---

## 3. Event Emission Examples

### Example 1 — Manual Attendance Mark

When `AttendanceController.markAttendance()` creates an attendance record:

```typescript
// AttendanceController.markAttendance()
const attendance = await prisma.attendance.create({ ... });

await PresenceService.emit({
  schoolId: req.user.schoolId,
  personId: learnerId,
  personType: 'LEARNER',
  eventType: 'CLASS_ATTENDANCE',
  context: 'CLASS',
  timestamp: attendanceDate,
  recordedBy: currentUserId,
  status: 'CONFIRMED',
  sourceModule: 'ATTENDANCE',
  sourceRecordId: attendance.id,
  metadata: {
    classId,
    attendanceStatus: status  // PRESENT|ABSENT|LATE|EXCUSED|SICK
  }
});
```

### Example 2 — Biometric Gate Scan

When `BiometricService.processAttendanceLog()` receives a device scan:

```typescript
await PresenceService.emit({
  schoolId: device.schoolId,
  personId: learner.id,
  personType: 'LEARNER',
  eventType: direction === 'IN' ? 'GATE_ENTRY' : 'GATE_EXIT',
  context: 'GATE',
  timestamp: deviceTimestamp,
  deviceId: device.id,
  direction,
  status: 'CONFIRMED',
  sourceModule: 'BIOMETRIC',
  sourceRecordId: biometricLog.id,
  metadata: {
    deviceName: device.name,
    scanQuality: 95
  }
});
```

### Example 3 — Bus Boarding

When a driver confirms a learner has boarded:

```typescript
const boardingEvent = await prisma.transportBoardingEvent.create({ ... });

await PresenceService.emit({
  schoolId: trip.schoolId,
  personId: learnerId,
  personType: 'LEARNER',
  eventType: 'BUS_BOARDED',
  context: 'BUS',
  timestamp: new Date(),
  recordedBy: driverUserId,
  status: 'CONFIRMED',
  sourceModule: 'TRANSPORT',
  sourceRecordId: boardingEvent.id,
  metadata: {
    tripId: trip.id,
    routeName: route.name,
    direction: trip.direction  // OUTBOUND|INBOUND
  }
});
```

### Example 4 — Dorm Roll Call

When a house master conducts night roll call:

```typescript
const rollCallEntry = await prisma.dormRollCallEntry.create({ ... });

await PresenceService.emit({
  schoolId: rollCall.schoolId,
  personId: learnerId,
  personType: 'LEARNER',
  eventType: 'DORM_ROLL_CALL',
  context: 'DORMITORY',
  timestamp: rollCall.startedAt,
  recordedBy: houseMasterUserId,
  status: 'CONFIRMED',
  sourceModule: 'BOARDING',
  sourceRecordId: rollCallEntry.id,
  location: dormitory.name,
  metadata: {
    session: 'NIGHT',  // MORNING|NIGHT
    rollCallStatus: entry.status  // PRESENT|ABSENT|EXCUSED|EXEAT
  }
});
```

### Example 5 — Staff Clock-In

When `HRService.clockInStaff()` creates a staff attendance log:

```typescript
const log = await prisma.staffAttendanceLog.create({ ... });

await PresenceService.emit({
  schoolId: req.user.schoolId,
  personId: userId,
  personType: 'STAFF',
  eventType: 'CLOCK_IN',
  context: 'SCHOOL',
  timestamp: log.clockInAt,
  status: 'CONFIRMED',
  sourceModule: 'HR_STAFF',
  sourceRecordId: log.id,
  metadata: {
    source: 'BIOMETRIC',  // or 'APP' or 'MANUAL'
    geofenceResult: log.geofenceResult,
    ipAddress: log.ipAddress
  }
});
```

---

## 4. Idempotency and Deduplication

The `presence_events` table enforces uniqueness on `(personId, eventType, timestamp)` with a 5-minute window for identical timestamps.

**Implementation:**
```sql
CREATE UNIQUE INDEX idx_presence_events_dedup
  ON presence_events(person_id, event_type, timestamp)
  WHERE status = 'CONFIRMED';
```

If the same event is submitted twice (e.g. retry from a device), the second call returns the existing event. This prevents duplicate presence records from device retries or double-clicks in the UI.

**Service method behavior:**
```typescript
async emit(event: PresenceEventInput): Promise<PresenceEvent> {
  try {
    return await prisma.presenceEvent.create({ data: event });
  } catch (error) {
    if (error.code === 'P2002') {  // Unique constraint violation
      // Return existing event instead of throwing
      return await prisma.presenceEvent.findFirst({
        where: {
          personId: event.personId,
          eventType: event.eventType,
          timestamp: event.timestamp
        }
      });
    }
    throw error;
  }
}
```

---

## 5. Transaction Boundary Strategy

**Rule:** `PresenceService.emit()` runs inside the same transaction as the primary domain write.

```typescript
// ✅ Correct pattern
const result = await prisma.$transaction(async (tx) => {
  const attendance = await tx.attendance.create({ ... });
  const presenceEvent = await PresenceService.emit({ ... }, tx);
  return { attendance, presenceEvent };
});
```

If presence event emission fails, the entire transaction rolls back. This prevents orphaned domain records (an attendance mark with no presence event).

**Exception:** If the presence event write fails due to idempotency (event already exists), this is not an error — the existing event is returned, and the transaction proceeds.

---

## 6. Event Failure Reconciliation

If `PresenceService.emit()` throws an unexpected error (database unavailable, constraint violation not due to dedup), the error is caught and recorded in `presence_event_failures`:

```typescript
catch (error) {
  await prisma.presenceEventFailure.create({
    data: {
      schoolId: event.schoolId,
      sourceModule: event.sourceModule,
      sourceRecordId: event.sourceRecordId,
      attemptedAt: new Date(),
      errorMessage: error.message,
      payload: event,
      retryCount: 0
    }
  });
  // Log but do not throw — domain write proceeds
  logger.error('[PresenceService] Event emission failed', { error, event });
}
```

A nightly reconciliation worker (`PresenceReconciliationWorker`) processes the `presence_event_failures` table, retries failed events (up to 3 attempts), and alerts on persistent failures.

---

## 7. Event Versioning

The `version` field in every event is set to `1` by default. When the event schema evolves:

1. Increment the version number for new events
2. Old events remain at their original version
3. Consumers (TimelineEngine, RulesEngine) must handle all versions

**Example evolution:** If `metadata` structure changes materially (e.g. adding required nested fields), bump version to `2`. TimelineEngine checks `event.version` and applies the correct parser.

---

## 8. Event Subscribers

| Subscriber | When it runs | What it does |
|---|---|---|
| RulesEngine | Immediately after event write | Evaluates rules; creates violation records |
| PresenceNotificationRouter | On rule violation | Dispatches SMS/push/in-app notifications |
| TimelineEngine | On-demand (API call) | Reads events from DB to build timeline |
| PresenceAnalytics | Nightly (scheduled aggregation) | Computes daily/weekly attendance rates |

**Note:** The current architecture does not use async pub/sub. "Subscribers" are service methods called directly or cron workers that query the table.

---

## 9. Metadata Field Usage

The `metadata` field is a JSONB column for module-specific extras. It must not contain:

- Personally identifiable information (names, phone numbers, addresses)
- Binary data
- Nested objects deeper than 3 levels

**Recommended metadata examples:**

```json
// Attendance event
{ "classId": "uuid", "attendanceStatus": "LATE", "remarks": "Traffic" }

// Biometric event
{ "deviceName": "Gate A Terminal", "scanQuality": 98, "templateId": "uuid" }

// Transport event
{ "tripId": "uuid", "routeName": "Route 3", "direction": "OUTBOUND", "driverName": "John Doe" }

// Boarding event
{ "session": "NIGHT", "dormName": "Block A", "rollCallStatus": "PRESENT" }
```

---

## 10. Event Query Patterns

### Get learner's timeline for a day
```typescript
const events = await prisma.presenceEvent.findMany({
  where: {
    personId: learnerId,
    timestamp: {
      gte: startOfDay,
      lte: endOfDay
    }
  },
  orderBy: { timestamp: 'asc' }
});
```

### Get all absent learners today (no CLASS_ATTENDANCE by lock time)
```typescript
const presentLearners = await prisma.presenceEvent.findMany({
  where: {
    schoolId,
    eventType: 'CLASS_ATTENDANCE',
    timestamp: { gte: startOfDay, lte: endOfDay },
    status: 'CONFIRMED'
  },
  select: { personId: true }
});
const presentIds = new Set(presentLearners.map(e => e.personId));
// All active learners NOT in presentIds are absent
```

### Get boarding learners who were in class but missed night roll call
```typescript
const dayPresent = await prisma.presenceEvent.findMany({
  where: {
    schoolId,
    eventType: 'CLASS_ATTENDANCE',
    timestamp: { gte: startOfDay, lte: endOfDay }
  },
  select: { personId: true }
});
const nightPresent = await prisma.presenceEvent.findMany({
  where: {
    schoolId,
    eventType: 'DORM_ROLL_CALL',
    timestamp: { gte: nightRollCallTime },
    'metadata.session': 'NIGHT'
  },
  select: { personId: true }
});
// dayPresent ∖ nightPresent = potential absconders
```

---
