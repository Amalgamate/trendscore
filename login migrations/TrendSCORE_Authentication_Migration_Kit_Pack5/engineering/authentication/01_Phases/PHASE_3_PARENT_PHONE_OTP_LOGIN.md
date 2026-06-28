# Phase 3 - Parent Phone OTP Login

## Phase Goal

Allow a verified parent phone OTP to create the same authenticated session structure as the existing email/password login flow.

## Why This Phase Exists

Phase 2 verified phone ownership but intentionally stopped before session issuance. This phase connects successful parent OTP verification to the existing JWT, refresh token, cookie, audit, and session response flow without changing password login.

## Files Allowed To Modify

- `server/src/services/auth-*.service.ts`
- `server/src/controllers/auth.controller.ts`
- `server/src/routes/auth.routes.ts`
- `server/src/middleware/auth.middleware.ts` only if required for compatibility
- targeted auth tests under `server/src/__tests__/`
- migration documentation under `login migrations/**/engineering/authentication/**`

## Files Forbidden

- `src/**`
- `public/**`
- finance modules
- assessment modules
- attendance modules
- timetable modules
- teacher login changes
- staff login changes
- student login changes
- database redesign
- family architecture redesign
- package files unless explicitly approved

## Database Changes Allowed?

No database redesign.

Allowed:

- Use the existing Phase 2 OTP challenge table.
- Use existing user, school, refresh-token, and audit infrastructure.

Forbidden:

- Drop columns.
- Rename columns.
- Add a second token model.
- Add a second refresh endpoint.
- Rewrite family relationships.

## API Changes Allowed?

Yes, additive and backward-compatible only.

Allowed:

- Change `/api/auth/phone-otp/verify` from verification-only to parent login after successful OTP.
- Return the existing auth response shape for phone OTP login.

Forbidden:

- Change `/api/auth/login`.
- Change `/api/auth/refresh`.
- Change JWT payload shape.
- Remove existing token response fields.
- Rename existing response fields.

## UI Changes Allowed?

No.

No login UI, parent portal UI, or PWA UI changes in this phase.

## Scope

Allowed:

- Parent-only phone OTP login.
- Shared session creation.
- Existing JWT generation.
- Existing refresh token generation and rotation.
- Existing auth cookie strategy.
- Parent account validation.
- School active validation.
- Audit logging for `PHONE_OTP`.
- Tests for successful and rejected OTP login paths.

Forbidden:

- Enabling phone OTP for non-parent roles.
- Removing password login.
- Creating a parallel token strategy.
- Adding frontend screens.
- Redesigning family authorization.

## Tests Required

- Successful phone OTP parent login.
- Disabled parent rejection.
- Wrong role rejection.
- Locked account rejection.
- Expired OTP rejection.
- Invalid OTP rejection.
- Refresh token generation coverage.
- JWT validation coverage.
- Session creation coverage.
- Audit log creation coverage.
- Regression test for existing password login.
- TypeScript compile.

## Acceptance Criteria

- Phone OTP login authenticates only parents.
- Phone OTP login issues JWT access tokens.
- Phone OTP login issues refresh tokens.
- Phone OTP login uses the same cookie configuration as password login.
- Phone OTP login uses the same authenticated response shape as password login.
- Existing email/password login still works.
- Existing refresh token rotation still works.
- Existing JWT middleware still works.
- Audit log records parent OTP login.
- Phase 4 remains locked.

## Rollback Strategy

Revert Phase 3 service, controller, route-comment, test, and documentation changes. Phase 2 OTP verification can remain in place because the database changes were already additive.

## Definition Of Done

- Phase 3 checklist is complete.
- Phase 3 report is complete.
- TypeScript passes.
- Targeted auth tests pass.
- Existing password login regression test passes.
- No frontend files are changed.
- Report says whether Phase 4 is safe to plan.

## Next Phase Prerequisites

Phase 4 may begin only after:

- Phase 3 report says `Ready for Phase 4: Yes`.
- User approves starting Phase 4.
- Phase 4 phase document exists.
- Phase 4 checklist exists.
- Phase 4 report template exists.
- `LOCK_FILE.md` is updated to make Phase 4 active.
