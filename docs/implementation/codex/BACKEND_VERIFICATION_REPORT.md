# TrendSCORE 2.0 Backend Verification Report

Date: 2026-08-04
Scope: read-only backend verification from `server/`, plus this report.

## Executive Summary

Status: **FAIL - test blockers found**

The Phase 0-6 implementation files listed in the verification brief are present, and several structural checks pass: TypeScript, Prisma schema validation, migration status, route registration, cron scheduling, permissions, presence event emitters, and the requested biometric/webhook security wiring.

However, the backend is **not ready to proceed to UI build as verified** because the required Jest suite completes with failing tests.

## Verification Results

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | Type check: `npx tsc --noEmit` | **PASS** | Passed after fixing the block-comment parse issue in `server/src/domains/biometrics/biometric-sync.worker.ts`, the biometric log `schoolId` type mismatch, and the report-dashboard union narrowing. |
| 2 | Unit tests: `node_modules\.bin\jest --no-coverage --runInBand` | **FAIL** | Jest completed in 284 seconds. Result: 57 suites passed, 7 failed, 2 skipped; 651 tests passed, 25 failed, 4 skipped; 680 total. Expected result was 213 passing tests, 0 failing. |
| 3 | Prisma schema integrity: `npx prisma validate` | **PASS WITH WARNING** | Schema is valid. Prisma warns that at least one relation uses `onDelete: SetNull` while the referenced field is required. One concrete instance is `Payment.recorder` / `recordedBy` around `server/prisma/schema.prisma:1613`. |
| 4 | Migration status: `npx prisma migrate status` | **PASS** | Connected to PostgreSQL database `zawadi_sms` at `localhost:5432`. Prisma found 117 migrations and reported: `Database schema is up to date!` |
| 5 | Route registration | **PASS** | `server/src/routes/index.ts` registers `/webhooks` before `authenticate`, then registers protected `/v1/presence`, `/v1/transport/trips`, `/v1/boarding`, and `/v1/analytics` after `router.use(authenticate)`. `/biometric` is registered and its protected routes add route-level authentication. |
| 6 | Cron jobs | **PASS** | `server/src/cron-worker.ts` schedules all requested workers: absent learner SMS, SMS retry, chronic absenteeism, biometric sync, biometric log retry, exeat overdue, and early warning checks with the expected cron expressions. |
| 7 | Permissions | **PASS** | All requested permissions exist in `server/src/config/permissions.ts`: presence, transport, boarding, exeat, and `SUPER_ADMIN_ONLY`. |
| 8 | Presence event emitters | **PASS** | Emitters were found for class attendance, HR clock in/out, biometric gate in/out, transport boarding/alighting, dorm roll call, exeat departure/return, dining attendance, and prep attendance. |
| 9 | Security audit | **PASS WITH NOTES** | `BiometricCredential.template` is `Bytes`; biometric encryption helpers are imported and used in `server/src/services/biometric.service.ts`; `/api/v1/*` routes are protected by the global `authenticate`; `/api/webhooks/sms/inbound/*` does not require JWT authentication. Note: `/api/biometric/log` remains public by design and relies on device-token handling in the controller, so that path should be separately pen-tested. |

## Blocking Errors

### 1. Jest suite failures

Command:

```powershell
node_modules\.bin\jest --no-coverage --runInBand
```

Result:

- Test Suites: 7 failed, 2 skipped, 57 passed, 64 of 66 total.
- Tests: 25 failed, 4 skipped, 651 passed, 680 total.
- Time: 284.267 seconds.

Observed failure categories:

- `tests/hr.service.test.ts`: HR payroll/attendance mocks do not match current service calls. Failures include `attendanceLogs is not iterable` and `prisma.staffAttendanceLog.create is not a function`.
- `src/__tests__/authPhoneOtp.service.spec.ts`: expected SMS-unavailable/configuration behavior differs from current returned values.
- `src/__tests__/authLogin.service.spec.ts`: password login test setup now receives `Invalid credentials`.
- `tests/lms.e2e.test.ts`: `/api/lms/my-assignments` expected 200 but returned 400.
- `tests/assessment.e2e.test.ts`: summative test creation expected 201 but returned 409 conflict.
- `tests/biometric.e2e.test.ts`: biometric device registration/enrollment expected 201 but returned 400, causing the later device-token assertion to fail.
- `src/__tests__/authPhoneOtp.validation.spec.ts`: validation parse results now include `rememberMe: false`, while tests expected no `rememberMe` field.

Recommendation: fix these test/code contract mismatches, then rerun the Jest suite until it reaches the expected zero-failure gate.

## Fixed During Follow-Up

The initial TypeScript gate failed because `server/src/domains/biometrics/biometric-sync.worker.ts` contained `*/15` inside a block comment, which prematurely closed the comment. That source comment was updated.

The next TypeScript pass exposed two real type issues, both fixed:

- `server/src/controllers/biometric.controller.ts`: `req.user.schoolId` was replaced with the existing `resolveSchoolId()` pattern because the authenticated user type does not include `schoolId`.
- `server/src/services/reportDashboard.service.ts`: teacher scope mapping now narrows schedule vs subject-assignment result shapes before reading branch-specific fields.

## Passed Structural Checks

Implementation file existence:

All files and migration folders named in the Phase 0-6 brief exist in the repository.

Route registration:

- `/api/webhooks` is mounted before global authentication.
- `/api/biometric` is mounted and route-level authentication exists for device management, enrollment, credential, and log-query routes.
- `/api/v1/presence` is mounted after global authentication.
- `/api/v1/transport/trips` is mounted after global authentication.
- `/api/v1/boarding` is mounted after global authentication.
- `/api/v1/analytics` is mounted after global authentication.

Cron scheduling:

- `AbsentLearnerSmsWorker`: `30 6 * * *`
- `SmsRetryWorker`: `0 * * * *`
- `ChronicAbsentWorker`: `0 4 * * 1`
- `BiometricSyncWorker`: `*/15 * * * *`
- `BiometricLogRetryWorker`: `0 2 * * *`
- `ExeatOverdueWorker`: `0 3 * * *`
- `EarlyWarningService`: `0 23 * * *`

Security:

- `server/prisma/schema.prisma` defines `BiometricCredential.template` as `Bytes`.
- `server/src/services/biometric.service.ts` imports and uses `encryptTemplate` before storing biometric templates.
- `/api/v1/*` modules are mounted after `router.use(authenticate)` in `server/src/routes/index.ts`.
- SMS inbound webhooks are public in `server/src/routes/webhooks.routes.ts`, matching the requirement that they do not require user-session authentication.

## Recommendation

Do **not** proceed to UI build yet as a verified backend handoff.

Minimum release-gate actions:

1. Triage and fix the 25 Jest failures.
2. Rerun `cd server && node_modules\.bin\jest --no-coverage --runInBand` and confirm zero failures.
3. Keep `cd server && npx tsc --noEmit` passing.
4. Review the Prisma `onDelete: SetNull` warning, especially required relation fields such as `recordedBy`, before relying on destructive user/payment deletion flows.
