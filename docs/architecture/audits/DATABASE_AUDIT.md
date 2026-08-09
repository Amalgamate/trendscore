# Database Audit — TrendScore

**Date:** August 2026  
**Status:** Read-only forensic review. Schema inspected from `server/prisma/schema.prisma`.

---

## 1. Overview

TrendScore uses **PostgreSQL** via **Prisma ORM**. The schema is a single large file. No schema sharding or module-level schema organisation exists.

**Database connection:** Supabase (inferred from `DATABASE_URL` + `DIRECT_URL` env vars — Supabase uses a pooled URL + direct URL pattern).

---

## 2. Attendance-Related Tables

### 2.1 `attendances` (Student Attendance)

```
id          UUID PK
learnerId   UUID FK → learners.id
classId     UUID? FK → classes.id
date        Date (db.Date — date-only, no time component)
status      AttendanceStatus enum
remarks     String?
markedAt    DateTime
markedBy    String (userId — no FK constraint!)
```

**Unique constraint:** `(learnerId, date)`

**Indexes:**
- `(learnerId, date)` via unique constraint
- `classId` — not confirmed in schema snippet, likely missing

**Problems:**
- `markedBy` is a plain `String`, not a foreign key to `users`. If a user is deleted, the reference dangles.
- No `updatedAt` field — no way to know when an attendance record was last changed.
- No `source` field — no way to distinguish manual vs biometric vs QR vs bulk import.
- No `schoolId` — relies on class-to-school chain for multi-tenancy (works but indirect).
- `classId` is optional — attendance records can exist without a class reference.

**Relationships:**
```
Attendance → Learner (required)
Attendance → Class (optional)
Attendance → User as teacher (via markedBy string — no FK)
```

---

### 2.2 `staff_attendance_logs` (Staff Clock-In/Out)

```
id           UUID PK
userId       UUID FK → users.id
schoolId     UUID? FK → schools.id
date         Date
status       StaffAttendanceStatus
clockInAt    DateTime?
clockOutAt   DateTime?
totalMinutes Int?
source       String? (BIOMETRIC / MANUAL / APP)
metadata     Json?
geofenceResult   String?
geofenceDecision String?
ipAddress    String?
```

**Unique constraint:** `(userId, date)`

**Indexes:** Covered by unique constraint

**Problems:**
- `schoolId` is optional — should be required for multi-school deployments.
- `totalMinutes` is stored but could be computed from clockInAt/clockOutAt (denormalisation).
- No `remarks` field — admin cannot add a note when manually overriding.
- No `approvedBy` field — manual overrides have no approval trail.

---

### 2.3 `staff_attendance_attempt_logs` (Staff Change Audit)

```
id                 UUID PK
userId             UUID FK → users.id (the staff member)
attendanceId       UUID FK → staff_attendance_logs.id
correctedBy        String (userId — no FK)
previousStatus     StaffAttendanceStatus?
newStatus          StaffAttendanceStatus
previousClockInAt  DateTime?
newClockInAt       DateTime?
previousClockOutAt DateTime?
newClockOutAt      DateTime?
reason             String?
createdAt          DateTime
```

**Indexes:** `(attendanceId, createdAt)`

**Note:** This is a solid audit table. The `correctedBy` has the same dangling string issue as `markedBy`.

---

### 2.4 `biometric_devices`

```
id        UUID PK
deviceId  String unique (hardware-assigned ID)
name      String
type      String
location  String?
ipAddress String?
token     String? (shared secret for webhook auth)
status    String
lastSeen  DateTime
createdAt DateTime
updatedAt DateTime
```

**Missing:** `schoolId`, `serialNumber`, `firmwareVersion`

---

### 2.5 `biometric_credentials`

```
id          UUID PK
userId      String? (staff)
learnerId   String? (learner)
type        String
template    String (PROBLEM: binary template stored as string, unencrypted)
fingerIndex Int?
quality     Int?
```

**Indexes:** `userId`, `learnerId`

**Missing:** `enrolledAt`, `deviceId`, `status`, `encryptedAt`

**Critical issue:** Templates unencrypted in database.

---

### 2.6 `biometric_logs`

```
id           UUID PK
deviceId     UUID FK → biometric_devices.id
personId     String (admissionNumber or staffId — NOT a UUID FK)
personType   String (LEARNER / STAFF)
timestamp    DateTime
direction    String (IN / OUT)
status       String (PENDING / PROCESSED / FAILED)
errorMessage String?
```

**Indexes:** `deviceId`, `status`, `timestamp`

**Missing:** `schoolId`, `retryCount`, `retryAt`, `rawPayload`

---

## 3. Transport Tables

### 3.1 `transport_vehicles`

```
id                 UUID PK
registrationNumber String unique
capacity           Int
driverName         String
driverPhone        String?
status             String
createdAt / updatedAt
archived           Boolean
```

**Missing:** `schoolId`, GPS device ID, insurance expiry, inspection date

---

### 3.2 `transport_routes`

```
id          UUID PK
name        String
description String?
amount      Decimal (fee per term)
vehicleId   UUID? FK → transport_vehicles.id
status      String
createdAt / updatedAt
archived    Boolean
```

**Index:** `vehicleId`

---

### 3.3 `transport_assignments`

```
id            UUID PK
routeId       UUID FK → transport_routes.id
passengerId   String (learner UUID or staff UUID — no FK)
passengerType String (LEARNER / STAFF)
pickupPoint   String?
dropoffPoint  String?
status        String
createdAt / updatedAt
archived      Boolean
```

**Indexes:** `routeId`, `passengerId`

**Problem:** `passengerId` is not a typed FK. A deleted learner leaves an orphaned assignment.

**Missing:** No attendance event table for transport. Boarding/alighting events are not recorded.

---

## 4. Communication Tables

### 4.1 `assessment_sms_audits`

Full audit trail for assessment result SMS. Contains:
- `learnerId`, `assessmentType`, `term`, `academicYear`
- `parentPhone`, `parentName`, `learnerName`, `learnerGrade`
- `templateType`, `messageContent`, `channel`
- `smsMessageId`, `smsStatus`, `failureReason`
- `sentByUserId`

**Status:** ✅ Well designed audit table.

### 4.2 `communication_configs` (inferred)

Referenced by `SmsService`. Stores provider settings: `smsEnabled`, `smsProvider`, `smsApiKey` (encrypted), `smsUsername`, `smsSenderId`, `smsBaseUrl`.

### 4.3 `user_notifications`

```
id         UUID PK
userId     UUID FK → users.id
title      String
message    String
type       NotificationType (INFO/SUCCESS/WARNING/ERROR/WAIVER/GIT_UPDATE/APPROVAL)
link       String?
isRead     Boolean
readAt     DateTime?
showAsPopup Boolean
metadata   Json?
createdAt  DateTime
```

**Used for:** In-app bell notifications, real-time socket.io events, web push trigger.

### 4.4 `push_subscriptions`

```
id        UUID PK
userId    UUID FK → users.id
endpoint  String unique
p256dh    String
auth      String
userAgent String?
```

---

## 5. Parent-Related Tables

### 5.1 `learners.parentId`

A direct FK from Learner to User for simple parent linking.

### 5.2 `family_members` + `family_accounts` + `learner_family_links`

A more sophisticated family account system for multi-parent/guardian access. Supports:
- Multiple parents per learner
- Per-member permissions (canLogin, canViewReports)
- Family account status (ACTIVE/SUSPENDED)

**Status:** Present in schema. `parentAccessService.ts` uses both paths.

---

## 6. ER Diagram — Attendance-Related Entities

```
schools ──────────────────────────────────────┐
    │                                          │
    └─► staff_attendance_logs (schoolId?)      │
                                               │
users ──────────────────────► staff_attendance_logs (userId)
  │                        └► staff_attendance_attempt_logs (userId, correctedBy)
  │                        └► attendances (markedBy — string, no FK)
  │
learners ──────────────────► attendances (learnerId)
  │                      └► biometric_credentials (learnerId)
  │                      └► transport_assignments (passengerId)
  │
classes ────────────────────► attendances (classId?)
  │
biometric_devices ─────────► biometric_logs (deviceId)
                                   │
                                   └─ personId (string, resolves to learner or staff)
                                   
transport_vehicles ────────► transport_routes (vehicleId?)
                                   │
                                   └─► transport_assignments (routeId)
```

---

## 7. Missing Indexes

| Table | Column(s) | Why Needed |
|---|---|---|
| `attendances` | `(date, classId)` | Daily class register query |
| `attendances` | `(learnerId, date)` | Already covered by unique constraint |
| `attendances` | `classId` | Filtering by class |
| `staff_attendance_logs` | `(date, status)` | Daily absent staff query |
| `biometric_logs` | `(personId, timestamp)` | Per-person log queries |
| `transport_assignments` | `(passengerId, archived)` | Learner route lookup |

---

## 8. Missing Foreign Keys

| Table | Column | Should Reference |
|---|---|---|
| `attendances` | `markedBy` | `users.id` |
| `staff_attendance_attempt_logs` | `correctedBy` | `users.id` |
| `transport_assignments` | `passengerId` | Polymorphic — design constraint |
| `biometric_logs` | `personId` | Polymorphic — design constraint |

---

## 9. Duplicate / Redundant Data

| Issue | Tables | Recommendation |
|---|---|---|
| `totalMinutes` is computable from clockInAt - clockOutAt | `staff_attendance_logs` | Acceptable denormalisation for performance |
| `isTransportStudent` boolean | `learners` | Redundant with transport_assignments — kept for query optimisation |
| `transportBilled / transportPaid / transportBalance` | `fee_invoices` | Denormalisation of transport fee state — acceptable |

---

## 10. Summary Assessment

| Area | Health | Notes |
|---|---|---|
| Student attendance DB | 🟡 Good with gaps | Missing source, updatedAt, schoolId |
| Staff attendance DB | 🟢 Good | Well structured with audit trail |
| Biometric DB | 🔴 Needs work | Template security, missing schoolId, no retry |
| Transport DB | 🟡 Good with gaps | No attendance events, no GPS |
| Communication DB | 🟢 Good | SMS audit table is well designed |
| Parent DB | 🟢 Good | Two-path model works |
