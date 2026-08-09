# TrendSCORE 2.0 — Database Evolution Plan

**Document ID:** DB-001  
**Version:** 1.0  
**Status:** DRAFT — Pending Architecture Review  
**Date:** August 2026  
**Parent Document:** `00_MASTER_ARCHITECTURE_SPECIFICATION.md §7`

---

## 1. Governing Rules

1. **No table is dropped** in TrendSCORE 2.0
2. **No column is renamed** without a two-migration deprecation cycle
3. **Every migration is single-concern** — one table or one feature per file
4. **Every destructive migration** requires a backup checkpoint and rollback script
5. **Migration naming:** `YYYYMMDD_NNN_snake_case_description`
6. **All new columns** default to nullable initially; made required only after backfill migration
7. **All new FK columns** are nullable initially to allow gradual backfill

---

## 2. Phase 0 — Critical Security Migrations

These run before any feature work. Production deployment requires a backup.

### M-001 — Add encryption metadata to biometric_credentials
```
ALTER TABLE biometric_credentials
  ADD COLUMN encrypted_at   TIMESTAMP,
  ADD COLUMN key_version     INT       DEFAULT 1,
  ADD COLUMN enrolled_at     TIMESTAMP DEFAULT NOW(),
  ADD COLUMN status          TEXT      DEFAULT 'ACTIVE',
  ADD COLUMN device_id       TEXT;     -- FK added in M-003
```
Rollback: DROP COLUMNs (safe, no data lost)

### M-002 — Migrate biometric template column to binary
```
ALTER TABLE biometric_credentials
  ALTER COLUMN template TYPE BYTEA USING template::BYTEA;
```
**Pre-migration:** Run encryption batch script (see Security spec §4)  
**Pre-migration:** Full database backup  
Rollback: Restore from backup (data-altering migration)

### M-003 — Add schoolId and FK to biometric tables
```
ALTER TABLE biometric_devices ADD COLUMN school_id TEXT;
ALTER TABLE biometric_logs    ADD COLUMN school_id TEXT;
-- Backfill via admin script
-- Later migration adds NOT NULL constraint after backfill
```

### M-004 — Attendance table improvements
```
ALTER TABLE attendances
  ADD COLUMN source      TEXT DEFAULT 'MANUAL',   -- MANUAL|BIOMETRIC|BULK|IMPORT
  ADD COLUMN updated_at  TIMESTAMP DEFAULT NOW();
```
Rollback: DROP COLUMNs

### M-005 — Fix markedBy to soft-FK (add index for lookup)
```
CREATE INDEX idx_attendances_marked_by ON attendances(marked_by);
-- Note: full FK constraint deferred — user deletes are rare and existing data
-- cannot be retroactively validated. Index enables lookup performance.
```

---

## 3. Phase 1 — Presence Platform Tables

### M-006 — Create presence_events
```sql
CREATE TABLE presence_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        TEXT NOT NULL,
  person_id        TEXT NOT NULL,
  person_type      TEXT NOT NULL,              -- LEARNER|STAFF|VISITOR
  event_type       TEXT NOT NULL,
  context          TEXT NOT NULL,
  timestamp        TIMESTAMPTZ NOT NULL,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by      TEXT,
  device_id        TEXT,
  location         TEXT,
  direction        TEXT,                        -- IN|OUT
  status           TEXT NOT NULL DEFAULT 'CONFIRMED',
  source_module    TEXT NOT NULL,
  source_record_id TEXT,
  metadata         JSONB,
  version          INT NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_presence_events_dedup
  ON presence_events(person_id, event_type, timestamp)
  WHERE status = 'CONFIRMED';

CREATE INDEX idx_presence_events_person_ts   ON presence_events(person_id, timestamp DESC);
CREATE INDEX idx_presence_events_school_ts   ON presence_events(school_id, timestamp DESC);
CREATE INDEX idx_presence_events_event_type  ON presence_events(event_type, timestamp DESC);
CREATE INDEX idx_presence_events_source      ON presence_events(source_module, source_record_id);
```
Rollback: DROP TABLE presence_events (safe, no other tables reference it initially)

### M-007 — Create presence_rules
```sql
CREATE TABLE presence_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  rule_code       TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, rule_code)
);
```

### M-008 — Create presence_rule_violations
```sql
CREATE TABLE presence_rule_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  rule_id         TEXT NOT NULL REFERENCES presence_rules(id),
  person_id       TEXT NOT NULL,
  person_type     TEXT NOT NULL,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolution      TEXT,
  notified        BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_presence_violations_person ON presence_rule_violations(person_id, detected_at DESC);
CREATE INDEX idx_presence_violations_school ON presence_rule_violations(school_id, resolved_at);
```

### M-009 — Create presence_event_failures (reconciliation table)
```sql
CREATE TABLE presence_event_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT,
  source_module   TEXT NOT NULL,
  source_record_id TEXT,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message   TEXT,
  payload         JSONB,
  retry_count     INT NOT NULL DEFAULT 0,
  resolved        BOOLEAN NOT NULL DEFAULT FALSE
);
```

---

## 4. Phase 2 — Transport Trip Tables

### M-010 — Create transport_trips
```sql
CREATE TABLE transport_trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  route_id        TEXT NOT NULL REFERENCES transport_routes(id),
  date            DATE NOT NULL,
  direction       TEXT NOT NULL,         -- OUTBOUND (morning) | INBOUND (afternoon)
  departed_at     TIMESTAMPTZ,
  arrived_at      TIMESTAMPTZ,
  driver_user_id  TEXT,                  -- optional, links to users.id
  status          TEXT NOT NULL DEFAULT 'SCHEDULED',  -- SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED
  notes           TEXT,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route_id, date, direction)
);

CREATE INDEX idx_transport_trips_route_date ON transport_trips(route_id, date DESC);
CREATE INDEX idx_transport_trips_school     ON transport_trips(school_id, date DESC);
```

### M-011 — Create transport_boarding_events
```sql
CREATE TABLE transport_boarding_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         TEXT NOT NULL REFERENCES transport_trips(id),
  learner_id      TEXT NOT NULL,         -- references learners.id
  event_type      TEXT NOT NULL,         -- BOARDED|ALIGHTED
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method          TEXT NOT NULL DEFAULT 'MANUAL',  -- MANUAL|SCAN|CONFIRMED
  recorded_by     TEXT,
  device_id       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boarding_events_trip     ON transport_boarding_events(trip_id);
CREATE INDEX idx_boarding_events_learner  ON transport_boarding_events(learner_id, recorded_at DESC);
```

### M-012 — Add schoolId to transport tables
```sql
ALTER TABLE transport_vehicles  ADD COLUMN school_id TEXT;
ALTER TABLE transport_routes    ADD COLUMN school_id TEXT;
-- Backfill: set school_id from config or first school in DB
```

---

## 5. Phase 3 — Communication Tables

### M-013 — Create parent_sms_replies
```sql
CREATE TABLE parent_sms_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  from_phone      TEXT NOT NULL,
  message_body    TEXT NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider        TEXT,                  -- africastalking|mobilesasa
  provider_msg_id TEXT,
  intent          TEXT,                  -- ACKNOWLEDGE_ABSENCE|REQUEST_CALL|OTHER
  linked_learner_id TEXT,               -- resolved from phone lookup
  linked_notification_id TEXT,
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_replies_phone   ON parent_sms_replies(from_phone, received_at DESC);
CREATE INDEX idx_sms_replies_school  ON parent_sms_replies(school_id, processed);
```

### M-014 — Create sms_outbound_audit (generalise assessment SMS audit)
```sql
-- Existing assessment_sms_audits remains unchanged.
-- New table covers all SMS types going forward.
CREATE TABLE sms_outbound_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  trigger_type    TEXT NOT NULL,     -- ABSENT_LEARNER|FEE_INVOICE|PLEDGE_REMINDER|etc.
  recipient_phone TEXT NOT NULL,
  recipient_name  TEXT,
  learner_id      TEXT,
  user_id         TEXT,
  template_key    TEXT,
  message_body    TEXT NOT NULL,
  provider        TEXT,
  provider_msg_id TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|SENT|FAILED|RETRY
  retry_count     INT NOT NULL DEFAULT 0,
  failure_reason  TEXT,
  sent_at         TIMESTAMPTZ,
  sent_by_user_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_audit_school_trigger ON sms_outbound_audit(school_id, trigger_type, created_at DESC);
CREATE INDEX idx_sms_audit_status         ON sms_outbound_audit(status, retry_count) WHERE status IN ('FAILED','PENDING');
```

---

## 6. Phase 5 — Boarding Module Tables

### M-015 — Create dormitories
```sql
CREATE TABLE dormitories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  gender      TEXT NOT NULL,             -- BOYS|GIRLS|MIXED
  capacity    INT NOT NULL DEFAULT 0,
  block       TEXT,
  notes       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);
```

### M-016 — Create dormitory_beds
```sql
CREATE TABLE dormitory_beds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dormitory_id    TEXT NOT NULL REFERENCES dormitories(id) ON DELETE CASCADE,
  bed_number      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'VACANT',  -- VACANT|OCCUPIED|MAINTENANCE
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dormitory_id, bed_number)
);
CREATE INDEX idx_beds_dormitory ON dormitory_beds(dormitory_id, status);
```

### M-017 — Create dormitory_assignments
```sql
CREATE TABLE dormitory_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dormitory_id    TEXT NOT NULL REFERENCES dormitories(id),
  bed_id          TEXT REFERENCES dormitory_beds(id),
  learner_id      TEXT NOT NULL,
  academic_year   INT NOT NULL,
  from_date       DATE NOT NULL,
  to_date         DATE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(learner_id, academic_year, active) DEFERRABLE
);
CREATE INDEX idx_dorm_assignments_learner ON dormitory_assignments(learner_id, active);
CREATE INDEX idx_dorm_assignments_dorm    ON dormitory_assignments(dormitory_id, active);
```

### M-018 — Create house_master_assignments
```sql
CREATE TABLE house_master_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dormitory_id    TEXT NOT NULL REFERENCES dormitories(id),
  user_id         TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'DUTY',  -- PRIMARY|DUTY|MATRON
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_house_master_primary ON house_master_assignments(dormitory_id, role)
  WHERE role = 'PRIMARY' AND active = TRUE;
```

### M-019 — Create exeat_requests
```sql
CREATE TABLE exeat_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         TEXT NOT NULL,
  learner_id        TEXT NOT NULL,
  requested_by      TEXT NOT NULL,     -- userId of requester (parent or house master)
  exeat_type        TEXT NOT NULL,     -- WEEKEND|MEDICAL|FAMILY|OTHER
  departure_date    DATE NOT NULL,
  return_date       DATE NOT NULL,
  reason            TEXT NOT NULL,
  parent_phone      TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|APPROVED|DENIED|CANCELLED
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  denial_reason     TEXT,
  departed_at       TIMESTAMPTZ,
  returned_at       TIMESTAMPTZ,
  overdue_notified  BOOLEAN NOT NULL DEFAULT FALSE,
  archived          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_exeat_learner  ON exeat_requests(learner_id, departure_date DESC);
CREATE INDEX idx_exeat_school   ON exeat_requests(school_id, status, return_date);
```

### M-020 — Create dorm_roll_calls and entries
```sql
CREATE TABLE dorm_roll_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  dormitory_id    TEXT NOT NULL REFERENCES dormitories(id),
  date            DATE NOT NULL,
  session         TEXT NOT NULL,          -- MORNING|NIGHT
  conducted_by    TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS|COMPLETED
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dormitory_id, date, session)
);

CREATE TABLE dorm_roll_call_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_call_id    TEXT NOT NULL REFERENCES dorm_roll_calls(id) ON DELETE CASCADE,
  learner_id      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PRESENT',  -- PRESENT|ABSENT|EXCUSED|EXEAT
  remarks         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_roll_call_entry_unique ON dorm_roll_call_entries(roll_call_id, learner_id);
```

### M-021 — Create dining_attendance
```sql
CREATE TABLE dining_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  learner_id      TEXT NOT NULL,
  date            DATE NOT NULL,
  session         TEXT NOT NULL,          -- BREAKFAST|LUNCH|DINNER
  present         BOOLEAN NOT NULL DEFAULT TRUE,
  recorded_by     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(learner_id, date, session)
);
CREATE INDEX idx_dining_school_date ON dining_attendance(school_id, date, session);
```

### M-022 — Create prep_attendance
```sql
CREATE TABLE prep_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  learner_id      TEXT NOT NULL,
  date            DATE NOT NULL,
  session         TEXT NOT NULL,          -- AFTERNOON|EVENING
  present         BOOLEAN NOT NULL DEFAULT TRUE,
  remarks         TEXT,
  recorded_by     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(learner_id, date, session)
);
```

---

## 7. Phase 4 — Biometric Completion Tables

### M-023 — Enhance biometric_devices
```sql
ALTER TABLE biometric_devices
  ADD COLUMN serial_number    TEXT,
  ADD COLUMN firmware_version TEXT,
  ADD COLUMN sync_mode        TEXT DEFAULT 'PUSH',  -- PUSH|PULL|BOTH
  ADD COLUMN school_id        TEXT;  -- backfill then make required
```

### M-024 — Add retry fields to biometric_logs
```sql
ALTER TABLE biometric_logs
  ADD COLUMN retry_count  INT NOT NULL DEFAULT 0,
  ADD COLUMN retry_at     TIMESTAMPTZ,
  ADD COLUMN raw_payload  JSONB;
```

---

## 8. Rollback Reference

| Migration | Rollback Complexity | Strategy |
|---|---|---|
| M-001 | LOW | DROP COLUMN |
| M-002 | CRITICAL | Restore from backup |
| M-003 to M-005 | LOW | DROP COLUMN / DROP INDEX |
| M-006 to M-009 | LOW | DROP TABLE (new tables only) |
| M-010 to M-012 | LOW | DROP TABLE / DROP COLUMN |
| M-013 to M-014 | LOW | DROP TABLE |
| M-015 to M-022 | LOW | DROP TABLE (cascade ordering) |
| M-023 to M-024 | LOW | DROP COLUMN |

**Cascade drop order for boarding tables (if full rollback needed):**
```
dorm_roll_call_entries → dorm_roll_calls
dormitory_assignments
house_master_assignments
dormitory_beds → dormitories
exeat_requests
dining_attendance
prep_attendance
```

---

## 9. Index Strategy Summary

| Table | Index columns | Purpose |
|---|---|---|
| `presence_events` | `(person_id, timestamp DESC)` | Timeline queries |
| `presence_events` | `(school_id, timestamp DESC)` | School snapshot |
| `presence_events` | `(person_id, event_type, timestamp)` UNIQUE | Deduplication |
| `transport_trips` | `(route_id, date DESC)` | Daily trip lookup |
| `transport_boarding_events` | `(learner_id, recorded_at DESC)` | Learner history |
| `exeat_requests` | `(school_id, status, return_date)` | Overdue scan |
| `dorm_roll_calls` | `(dormitory_id, date, session)` UNIQUE | One roll call per session |
| `sms_outbound_audit` | `(status, retry_count)` WHERE FAILED | Retry queue |

---
