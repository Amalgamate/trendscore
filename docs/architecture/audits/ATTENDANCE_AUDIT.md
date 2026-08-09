# Attendance Audit — TrendScore

**Date:** August 2026  
**Status:** Read-only forensic review. No code was modified.

---

## 1. Summary

TrendScore has a **functioning student attendance module** and a **functioning staff clock-in/clock-out module**. They are independent implementations that share some database primitives but are not architecturally unified. A third attendance pathway (biometric) exists as a stub that bridges into both.

---

## 2. Student Attendance

### Database Model

| Table | Purpose | Status |
|---|---|---|
| `attendances` | One row per learner per day. Stores status, date (UTC Date), classId, markedBy, markedAt, remarks | ✅ Active |
| `class_enrollments` | Links learners to classes | ✅ Active |
| `classes` | Class definitions with grade/stream/teacher | ✅ Active |

**Attendance Model fields:**
```
id, learnerId, classId?, date (Date), status (AttendanceStatus), remarks?, markedAt, markedBy
```

**AttendanceStatus enum:**
```
PRESENT | ABSENT | LATE | EXCUSED | SICK
```

**Unique constraint:** `learnerId + date` — only one attendance record per learner per day.

### API Layer

| Route | Method | Description | Access |
|---|---|---|---|
| `POST /api/attendance` | POST | Mark single learner | MARK_ATTENDANCE |
| `POST /api/attendance/bulk` | POST | Bulk mark class | MARK_ATTENDANCE |
| `GET /api/attendance` | GET | Query attendance records | VIEW_ALL/OWN |
| `GET /api/attendance/stats` | GET | Stats by status/class/date | VIEW_ALL/OWN |
| `GET /api/attendance/learner/:id` | GET | Learner-level summary | ALL + PARENT scoped |
| `GET /api/attendance/class/daily` | GET | Daily class register | VIEW_ALL/OWN |

**File:** `server/src/controllers/attendance.controller.ts`  
**File:** `server/src/routes/attendance.routes.ts`

### What Works

- Single and bulk mark with upsert logic (create or update on same date)
- N+1 query bug was previously fixed — pre-fetches all existing records in one query
- Date normalization to UTC midnight (prevents timezone drift bugs)
- Teacher scope enforcement — teachers can only mark/view their assigned class
- Parent read scope — parents can view their linked children's attendance
- Attendance statistics with status breakdown and rate calculation
- Daily class register endpoint (returns all learners + attendance for a date)
- Zod input validation, rate limiting, audit logging on all write routes

### What Is Missing / Incomplete

| Gap | Severity | Notes |
|---|---|---|
| No absence notification to parents | HIGH | No automatic SMS/push when learner is marked absent |
| No parent acknowledgement flow | HIGH | Parents cannot confirm they know child is absent |
| No attendance locking by time | MEDIUM | School config has `attendanceLockEnabled` + `attendanceLockTime` fields but the controller does not enforce them |
| No trend/chronic absenteeism alerts | MEDIUM | No cron job watches for learners exceeding absence thresholds |
| No half-day / session attendance | LOW | Only one record per day; AM/PM sessions not supported |
| No class-level mark-all-present shortcut | LOW | Must submit all records individually |
| Bulk upsert uses Promise.all() — no DB transaction | LOW | Partial failure is possible; errors are collected but not rolled back |
| No learner biometric cross-reference | MEDIUM | Biometric logs can create attendance records but there is no UI or report linking them |

---

## 3. Staff Attendance

### Database Models

| Table | Purpose | Status |
|---|---|---|
| `staff_attendance_logs` | One row per staff per day. Stores clockInAt, clockOutAt, status, source, metadata, schoolId, geofence result | ✅ Active |
| `staff_attendance_attempt_logs` | Audit trail for changes to staff attendance — change history with previous/new values | ✅ Active |

**StaffAttendanceStatus enum:**
```
PRESENT | ABSENT | LATE | PARTIAL_DAY | ON_LEAVE | PUBLIC_HOLIDAY | OFF_DAY
```

**Unique constraint:** `userId + date`

**Source field:** Tracks how the clock-in occurred — `BIOMETRIC` (device), `MANUAL` (admin marks), `APP` (self-service)

### API Layer (via HR Controller)

| Endpoint | Description |
|---|---|
| `POST /api/hr/clock-in` | Staff self-service clock-in with geofence/IP check |
| `GET /api/hr/today-clock-in` | Get today's log for the authenticated user |
| `POST /api/hr/clock-out` | Staff self-service clock-out |
| `GET /api/hr/attendance-report` | Admin report with userId/date range filter |
| `POST /api/hr/attendance/mark` | Admin manually marks a staff member's attendance |

**File:** `server/src/controllers/hr.controller.ts`  
**Service:** `server/src/services/hr.service.ts`

### What Works

- Clock-in / clock-out with minutes calculation
- Geofence enforcement (configurable: OFF / WARN / STRICT) using school lat/lng + radius
- IP whitelist enforcement (configurable)
- Payroll integration — attendance feeds into monthly payroll generation
- Leave management integration — leave approved = attendance auto-marked ON_LEAVE
- Change history via `StaffAttendanceAttemptLog`

### What Is Missing

| Gap | Severity |
|---|---|
| No pattern analysis / late arrival trends | MEDIUM |
| No automatic notification to HR when staff doesn't clock in by X time | MEDIUM |
| Biometric source recorded but no UI to view biometric-sourced records separately | LOW |

---

## 4. Biometric Bridge to Attendance

The biometric service (`server/src/services/biometric.service.ts`) handles attendance creation for both learners and staff when a device hit is received. See `BIOMETRICS_AUDIT.md` for full details.

---

## 5. Cron Jobs Related to Attendance

No cron jobs currently exist for student attendance. The `cron-worker.ts` handles:
- Pledge reminders
- Library overdue fines
- Duty roster notifications
- LMS assignment due reminders

**Missing cron jobs:**
- Absent learner SMS to parents (daily post-registration window)
- Chronic absenteeism alert (weekly threshold check)
- Staff late-arrival escalation

---

## 6. React Frontend

No dedicated `/attendance` page was found in `src/pages/`. The page tree contains only `src/pages/assessments/` and `src/pages/Auth.jsx` — suggesting the attendance UI is either embedded inside a shared dashboard component or is not yet broken into its own route page.

**Components to search:**  
`src/components/` — no attendance-specific subfolder found. Attendance UI is likely inline within a teacher dashboard component.

---

## 7. Recommended Actions

| Action | Priority |
|---|---|
| Add absent-parent SMS via cron (daily window after 09:00) | HIGH |
| Enforce `attendanceLockTime` / `attendanceLockEnabled` in controller | MEDIUM |
| Add chronic absenteeism cron (≥ 3 absences in 5 days) | MEDIUM |
| Create dedicated React page for attendance (`/attendance`) with daily register, stats, and history | MEDIUM |
| Wrap bulk attendance in a Prisma transaction | LOW |
| Add half-day / session-level attendance option | LOW (future) |
