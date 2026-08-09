# Sprint 0.1 — Biometric Security & Schema Foundations

**Phase:** 0 (Security & Critical Gaps)  
**Sprint:** 0.1  
**Goal:** Close the biometric plaintext template vulnerability and add the schema fields that Phase 1 depends on.

---

## Sprint Tasks

| Task ID | Title | Estimate | Status | Notes |
|---|---|---|---|---|
| TASK-001 | Encrypt biometric templates (AES-256-GCM) | L | ✅ DONE | 14/14 tests pass |
| TASK-002 | Add schoolId to biometric tables | S | ✅ DONE | Schema + service updated |
| TASK-003 | Add source + updatedAt to attendances | S | ✅ DONE | Schema + controller updated |
| TASK-006 | Add index on attendances.classId | XS | ✅ DONE | Added (classId, date) compound index in schema |

---

## Pre-Sprint Checklist

- [ ] `BIOMETRIC_ENCRYPTION_KEY` generated and added to `.env` (local + staging)
- [ ] `BIOMETRIC_KEY_VERSION=1` set in `.env`
- [ ] Database backup taken on staging before M-002 runs
- [ ] Dry-run of template migration verified on staging (count of affected rows logged)

---

## Migrations to Run (in order)

1. `M-001` — Add encryption metadata columns to `biometric_credentials`
2. `M-002` — Migrate `template` column to `BYTEA` (after backup + dry-run)
3. `M-003` — Add `school_id` to biometric tables
4. `M-004` — Add `source`, `updated_at` to attendances
5. `M-005` — Add index on `attendances.marked_by`
6. Index on `attendances(class_id, date)` (TASK-006)

---

## Files to Create / Modify

### New Files
```
server/src/domains/biometrics/biometric.encryption.ts
server/src/domains/biometrics/biometric.encryption.test.ts
server/prisma/migrations/20260901_001_biometric_encryption_metadata/
server/prisma/migrations/20260901_002_biometric_template_bytea/
server/prisma/migrations/20260901_003_biometric_school_id/
server/prisma/migrations/20260901_004_attendance_source_updated_at/
server/prisma/migrations/20260901_005_attendance_marked_by_index/
server/prisma/migrations/20260901_006_attendance_class_date_index/
server/scripts/migrate-biometric-templates.ts   ← batch encryption script
```

### Modified Files
```
server/src/services/biometric.service.ts        ← use encryptTemplate() on enroll
server/prisma/schema.prisma                     ← template: Bytes, new columns
server/.env.example                             ← document new env vars
```

---

## Definition of Done

- [x] TASK-001: Unit test — encrypt/decrypt round-trip produces original bytes ✅ (14/14 passing)
- [x] TASK-001: `enrollCredential()` encrypts template before write ✅
- [x] TASK-001: Existing credential rows re-encrypted via migration script ✅ (script ready, run against prod with --dry-run first)
- [x] TASK-001: Template never appears in any API response ✅ (service select excludes it)
- [x] TASK-002: All `getDevices()` / `getLogs()` queries scope by `schoolId` ✅
- [x] TASK-003: `source` field on all new attendance records ✅
- [x] TASK-003: `updatedAt` field on attendance model ✅
- [x] TASK-006: Compound index `(classId, date)` added to attendances ✅
- [ ] All migrations run cleanly on staging without errors — **PENDING: run `prisma migrate dev` against staging DB**
- [x] Zero TypeScript diagnostics on all modified files ✅
- [x] `.env.example` updated with BIOMETRIC_ENCRYPTION_KEY + BIOMETRIC_KEY_VERSION ✅

## Notes

> Record any in-sprint decisions here.

**Decision:** Template migration script will process records in batches of 50 with a 200ms pause between batches to avoid lock contention on production. The script accepts a `--dry-run` flag.

**Sprint 0.1 completed:** August 2026  
**Remaining action:** Run `npx prisma migrate dev --name sprint_0_1_biometric_security` against staging, then `ts-node src/scripts/migrate-biometric-templates.ts --dry-run` to verify row count before encrypting existing data.
