# Phase 2 - Identity And OTP Foundation

## Phase Goal

Add the backend foundation for phone-based identity and secure OTP lifecycle without replacing the existing email/password login flow.

## Why This Phase Exists

Passwordless parent login requires a durable identity model and secure OTP storage before the UI can safely offer phone-only login. This phase prepares the backend foundation while preserving current authentication behavior.

## Files Allowed To Modify

Allowed only after Phase 2 is unlocked:

- `server/prisma/schema.prisma`
- new Prisma migration under `server/prisma/migrations/`
- `server/src/services/auth-*.service.ts`
- `server/src/controllers/auth.controller.ts`
- `server/src/routes/auth.routes.ts`
- `server/src/utils/phone*.ts`
- targeted auth tests under `server/src/__tests__/`
- migration documentation under `login migrations/**/engineering/authentication/**`

## Files Forbidden

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

Yes, but only additive changes.

Allowed:

- Add new identity/OTP/session support tables.
- Add indexes required for phone lookup and OTP safety.
- Add nullable fields needed for backward-compatible migration.

Forbidden:

- Drop columns.
- Rename existing columns.
- Make existing nullable columns required.
- Change existing enum values in a breaking way.
- Delete or rewrite existing user records.

## API Changes Allowed?

Yes, additive only.

Allowed:

- Add new phone OTP request endpoint.
- Add new phone OTP verification endpoint.
- Add response fields only if existing clients are unaffected.

Forbidden:

- Remove existing routes.
- Change existing `/api/auth/login` behavior.
- Change existing OTP-after-password behavior.
- Remove existing token response fields.
- Rename existing response fields.

## UI Changes Allowed?

No.

No frontend login, OTP, parent portal, or PWA UI changes in this phase.

## Scope

Allowed:

- Introduce canonical phone normalization utility.
- Introduce secure OTP hash storage.
- Introduce OTP expiry, attempt count, resend count, and lockout metadata.
- Introduce identity lookup service for parent phone numbers.
- Add additive endpoints for phone OTP start and verify.
- Add tests for phone normalization, OTP hashing/expiry/attempts, and endpoint contracts.

Forbidden:

- Replacing current login.
- Forcing parents to use phone-only login.
- Removing password login.
- UI changes.
- PWA install changes.
- Notification preference changes.
- Family relationship authorization rewrite.

## Tests Required

At minimum:

- Phone normalization unit tests.
- OTP lifecycle unit tests.
- Phone OTP request endpoint tests.
- Phone OTP verification endpoint tests.
- Existing auth service tests.
- TypeScript compile.

## Acceptance Criteria

- Existing email/password login still works.
- Existing OTP-after-password flow still works.
- Existing refresh/logout behavior still works.
- Phone normalization has deterministic tests.
- OTPs are not stored in plaintext.
- OTP expiry is enforced.
- OTP attempt limits are enforced.
- OTP resend controls are enforced.
- New API endpoints are additive and documented.
- No UI files are changed.

## Rollback Strategy

Rollback by reverting Phase 2 code and migration. Because Phase 2 must use additive schema changes only, rollback can leave unused tables in place temporarily if production safety requires it.

## Definition Of Done

- Phase 2 checklist is complete.
- Phase 2 report is complete.
- TypeScript passes.
- Targeted auth tests pass.
- Existing Phase 1 service tests pass.
- No UI changes are present.
- Report says whether Phase 3 is safe to begin.

## Next Phase Prerequisites

Phase 3 may begin only after:

- Phase 2 report says `Ready for Phase 3: Yes`.
- User approves starting Phase 3.
- `LOCK_FILE.md` is updated to make Phase 3 active.

