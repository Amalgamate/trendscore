# Phase 1 - Authentication Core Refactor

## Phase Goal

Separate authentication responsibilities without changing external behavior.

## Why This Phase Exists

The current auth controller mixes orchestration, password validation, JWT creation, cookie handling, refresh-token rotation, OTP triggering decisions, and session invalidation. A safer passwordless migration needs these responsibilities isolated before new flows are introduced.

## Files Allowed To Modify

Allowed only after Phase 0 is complete and Phase 1 is unlocked:

- `server/src/controllers/auth.controller.ts`
- `server/src/routes/auth.routes.ts`
- `server/src/middleware/auth.middleware.ts`
- `server/src/utils/jwt.util.ts`
- `server/src/services/auth-session.service.ts`
- new auth service files under `server/src/services/`
- targeted auth tests under `server/src/__tests__/`
- migration documentation under `login migrations/**/engineering/authentication/**`

## Files Forbidden

- `server/prisma/**`
- `src/**`
- `public/**`
- parent portal UI
- login UI
- OTP UI
- finance modules
- assessment modules
- attendance modules
- deployment files
- package files unless explicitly approved

## Database Changes Allowed?

No.

Do not change Prisma schema, migrations, tables, or seed data.

## API Changes Allowed?

No.

All existing auth routes, request bodies, response fields, token fields, cookie names, status codes, and error messages must remain backward compatible.

## UI Changes Allowed?

No.

Do not change login, OTP, parent portal, PWA, or notification UI.

## Scope

Allowed:

- Extract `AuthService` or focused helper services if needed.
- Centralize JWT creation and verification.
- Centralize auth cookie set/clear behavior.
- Centralize refresh-token revocation and rotation behavior.
- Move business logic out of controllers.
- Add targeted tests for preserved behavior.
- Remove duplicated auth helpers only when covered by tests and only inside auth scope.

Forbidden:

- New login flow.
- Phone-only login.
- Passwordless behavior.
- OTP redesign.
- Device trust.
- Database changes.
- UI changes.
- Public API contract changes.
- Role model changes.
- Parent relationship model changes.
- Production deployment changes.

## Tests Required

At minimum:

- Auth controller or service tests for login success and failure.
- Refresh-token rotation/revocation behavior.
- Logout behavior.
- `/auth/me` behavior.
- Existing auth-related tests must still pass.

If automated tests cannot be run, the report must explain why and include manual verification steps.

## Acceptance Criteria

- Controllers orchestrate only and delegate auth logic.
- JWT logic is centralized.
- Cookie logic is centralized.
- Refresh-token logic is centralized.
- Existing login behavior is unchanged.
- Existing OTP-after-password behavior is unchanged.
- Existing refresh behavior is unchanged.
- Existing logout behavior is unchanged.
- No route paths are renamed.
- No response fields are removed.
- No database changes are made.
- No UI changes are made.
- Tests pass or skipped tests are justified.

## Rollback Strategy

Rollback by reverting the Phase 1 commit or restoring the touched auth files to their pre-phase versions. Because no database or API contract changes are allowed, rollback must not require data repair.

## Deliverables

- Updated architecture notes.
- Passing or documented tests.
- Phase 1 checklist.
- Phase 1 report.
- Zero behavior changes.

## Definition Of Done

- Authentication behaves exactly as before with cleaner structure.
- `PHASE_1_CHECKLIST.md` is fully completed.
- `PHASE_1_REPORT.md` is complete.
- `STATUS.md` and `PROGRESS.md` are updated.
- Report explicitly states whether Phase 2 is safe to begin.

## Next Phase Prerequisites

Phase 2 may begin only after:

- Phase 1 report says `Ready for Phase 2: Yes`.
- User approves starting Phase 2.
- `LOCK_FILE.md` is updated to make Phase 2 active.
