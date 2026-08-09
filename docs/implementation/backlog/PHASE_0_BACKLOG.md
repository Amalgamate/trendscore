# Phase 0 Backlog — Security & Critical Gaps

**Phase:** 0  
**Theme:** Fix what is broken or dangerous before building anything new  
**Target:** 3 weeks  
**Principle:** No new features. No new pages. No new tables except the two below.

---

## Priority Legend

- 🔴 P0 — Must complete before any other work starts
- 🟠 P1 — Must complete before Phase 1 begins
- 🟡 P2 — Must complete within Phase 0

---

## Sprint 0.1 — Biometric Security & Schema Foundations

### TASK-001 🔴 Encrypt biometric templates at rest
**Effort:** M (3–4 days)  
**Refs:** BIOMETRICS_AUDIT.md §9, SEC-001 §4, DB-001 M-001/M-002  
**Acceptance criteria:**
- New `BiometricEncryptionService` with `encryptTemplate()` and `decryptTemplate()`
- `BIOMETRIC_ENCRYPTION_KEY` env var documented in `.env.example`
- `enrollCredential()` encrypts template before write
- `biometric_credentials.template` column migrated from `String` to `Bytes`
- `key_version`, `encrypted_at`, `enrolled_at`, `status` columns added
- Existing template rows: batch re-encrypt (process 100 at a time, dry-run flag first)
- Templates never appear in any API response or log output
- Unit test: encrypt → decrypt round-trip produces original bytes

### TASK-002 🔴 Add schoolId to biometric tables
**Effort:** S (1 day)  
**Refs:** DB-001 M-003  
**Acceptance criteria:**
- `school_id` column added to `biometric_devices` and `biometric_logs` (nullable initially)
- Backfill script sets `school_id` from the first school in DB (single-school deployment)
- `BiometricService.registerDevice()` requires `schoolId`
- All `getDevices()` and `getLogs()` queries scope by `schoolId`

### TASK-003 🟠 Add source and updatedAt to attendances
**Effort:** S (1 day)  
**Refs:** DB-001 M-004, ATTENDANCE_AUDIT.md §2  
**Acceptance criteria:**
- `source` column (TEXT, default `'MANUAL'`) added to `attendances`
- `updated_at` column (TIMESTAMPTZ) added to `attendances`
- `AttendanceController.markAttendance()` sets `source = 'MANUAL'`
- `AttendanceController.markBulkAttendance()` sets `source = 'BULK'`
- `BiometricService.handleLearnerAttendance()` sets `source = 'BIOMETRIC'`

---

## Sprint 0.2 — Attendance Reliability

### TASK-004 🟠 Enforce attendance lock time
**Effort:** M (2 days)  
**Refs:** ATTENDANCE_AUDIT.md §2, MAS §2 P1  
**Acceptance criteria:**
- `AttendanceController.markAttendance()` checks school's `attendanceLockEnabled` config
- If `attendanceLockEnabled = true` and current time is past `attendanceLockTime`:
  - Return `422 ATTENDANCE_WINDOW_CLOSED` with `lockTime` and `currentTime` in details
  - Exception: roles `ADMIN`, `SUPER_ADMIN`, `HEAD_TEACHER` bypass lock
- If `attendanceAllowLateAfterLock = true` (existing config field): allow with `status = LATE` forced
- `attendanceRequireRemarksForLateExcused`: if LATE or EXCUSED and no remarks → `400`
- Unit test: lock time enforcement per role
- Integration test: teacher cannot mark after lock; admin can

### TASK-005 🟠 Wrap bulk attendance in transaction
**Effort:** S (half day)  
**Refs:** ATTENDANCE_AUDIT.md §2, DATABASE_AUDIT.md §2  
**Acceptance criteria:**
- `markBulkAttendance()` uses `prisma.$transaction()` — all records in one atomic operation
- On any individual record failure: full batch rolls back
- Results object clearly reports why batch failed
- Integration test: partial failure rolls back all records

### TASK-006 🟡 Add index on attendances.classId
**Effort:** XS (1 hour)  
**Refs:** DATABASE_AUDIT.md §7  
**Acceptance criteria:**
- Migration adds `CREATE INDEX idx_attendances_class_date ON attendances(class_id, date)`
- No application code changes required

---

## Sprint 0.3 — Absent Learner Notification

### TASK-007 🔴 Absent learner SMS cron worker
**Effort:** L (4–5 days)  
**Refs:** COMMUNICATION_AUDIT.md §8, GAP_ANALYSIS.md, MAS §5.4  
**Acceptance criteria:**
- New cron job in `cron-worker.ts`: fires daily at 09:30 EAT (06:30 UTC)
- Queries all active learners who have no `CLASS_ATTENDANCE` record for today
- Excludes learners with `status = EXCUSED` or `status = SICK` already recorded
- For each absent learner: resolves parent phone (primaryContactPhone → guardianPhone → motherPhone → fatherPhone)
- Sends SMS using existing `SmsService` with a clear, school-named template
- Writes audit record to `sms_outbound_audit` table (M-014 from DB-001 — create this table first)
- Cron job logs: start, end, count sent, count failed
- Does NOT run on weekends or public holidays (check school's `staffWorkingDays` config)
- Rate: batches of 50, 100ms delay between batches
- Unit test: correct learner selection logic (present excluded, absent included, excused excluded)
- Integration test: correct SMS dispatched per absent learner

### TASK-008 🟡 SMS retry on failure
**Effort:** M (2 days)  
**Refs:** COMMUNICATION_AUDIT.md §8  
**Acceptance criteria:**
- `sms_outbound_audit` table created (DB-001 M-014)
- `SmsService.sendSms()` writes to `sms_outbound_audit` on every send attempt
- Failed sends (`status = FAILED`) eligible for retry if `retry_count < 3`
- New cron job: runs hourly, retries FAILED records older than 5 minutes
- Exponential back-off: retry at 5 min, 15 min, 45 min
- After 3 retries: status set to `PERMANENTLY_FAILED`, admin in-app notification
- Unit test: retry count increments correctly

---

## Phase 0 Definition of Done

- [ ] All TASK-001 through TASK-008 completed and merged
- [ ] All CI tests passing
- [ ] Biometric encryption verified on staging with real data
- [ ] Absent learner SMS cron tested end-to-end on staging (verified SMS received)
- [ ] Attendance lock time verified: teacher cannot mark late, admin can
- [ ] No regression in existing attendance, HR, or transport tests
- [ ] `.env.example` updated with all new environment variables
- [ ] Architecture review sign-off before Phase 1 begins
