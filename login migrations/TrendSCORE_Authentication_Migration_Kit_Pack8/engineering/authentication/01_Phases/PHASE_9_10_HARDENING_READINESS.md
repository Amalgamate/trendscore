# Combined Phase 9-10 - Authentication Hardening And Production Readiness

## Phase Goal

Complete a final hardening and readiness pass for the parent Phone + OTP authentication migration.

## Why This Phase Exists

Earlier phases added the backend OTP foundation, session issuance, frontend phone login, PWA build readiness, and family-linked parent access. The remaining work is to verify production safety, improve low-risk security gaps, and document release readiness without changing public authentication contracts.

## Files Allowed To Modify

- `server/src/controllers/auth.controller.ts`
- `server/src/services/auth-login.service.ts`
- `server/src/services/auth-phone-otp.service.ts`
- `server/src/services/auth-token.service.ts`
- `server/src/services/parent-access.service.ts`
- Authentication, OTP, and parent-access tests
- PWA/build verification notes
- Migration control documents

## Files Forbidden

- Finance feature logic, except existing tests if needed for auth regression
- Assessment feature logic, except existing tests if needed for auth regression
- Attendance feature logic, except existing tests if needed for auth regression
- Timetable feature logic
- Teacher login behavior changes
- Staff login behavior changes
- Student login behavior changes
- Family schema redesign
- Parent portal redesign

## Database Changes Allowed?

No.

## API Changes Allowed?

No public contract changes.

Internal-only hardening that preserves route names, response fields, cookies, JWT payloads, and refresh-token behavior is allowed.

## UI Changes Allowed?

No UI redesign.

Frontend changes are allowed only if needed for a small bug fix discovered during verification. Otherwise this phase is backend/tests/docs only.

## Tests Required

- Server TypeScript verification
- Existing auth service tests
- Phone OTP tests
- Parent access tests
- At least one production-readiness regression test for any hardening change
- Frontend build or targeted frontend verification if frontend files are changed

## Acceptance Criteria

- Existing email/password login remains unchanged.
- Existing refresh-token behavior remains unchanged.
- Existing parent Phone + OTP login remains unchanged.
- Parent family access remains unchanged.
- Any safe security hardening is covered by tests.
- PWA/build readiness is recorded.
- Live SMS limitations are documented.
- `STATUS.md` is updated.
- `PROGRESS.md` is updated.
- Combined Phase 9-10 report is completed.
- Later phases remain locked.

## Rollback Strategy

Rollback by reverting the Phase 9-10 hardening, test, and documentation changes. No database rollback should be required.

## Definition Of Done

Combined Phase 9-10 is complete only when tests pass, the report documents remaining production risks, and the lock file marks Phase 9-10 complete with no later phase unlocked.

## Next Phase Prerequisites

No next phase is automatically unlocked. Any future work must be explicitly defined and approved.
