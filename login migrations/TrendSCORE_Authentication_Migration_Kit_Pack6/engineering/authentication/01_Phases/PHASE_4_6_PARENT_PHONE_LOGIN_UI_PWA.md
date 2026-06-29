# Phase 4-6 - Parent Phone Login UI, Routing, And PWA Readiness

## Phase Goal

Ship the user-facing parent Phone + OTP login path and verify it works end to end from login screen to authenticated parent experience, while preserving existing email/password login.

## Why This Phase Exists

Phase 3 made parent phone OTP login work at the API/session layer. The next useful release block is the visible login entry point, parent routing behavior, and PWA readiness checks needed for real parent use. Combining Phases 4, 5, and 6 avoids artificial handoffs while keeping later phases locked.

## Files Allowed To Modify

- `src/**` files directly related to authentication, login, parent portal entry, PWA install/readiness, and auth API client calls
- `server/src/**` auth files only for compatibility fixes discovered during UI integration
- targeted frontend/backend auth tests
- targeted PWA/readiness tests or verification scripts
- migration documentation under `login migrations/**/engineering/authentication/**`

## Files Forbidden

- finance modules
- assessment modules
- attendance modules
- timetable modules
- teacher login behavior
- staff login behavior
- student login behavior
- database redesign
- family architecture redesign
- unrelated dashboard redesign
- package files unless explicitly approved

## Database Changes Allowed?

No.

Use the Phase 2 and Phase 3 backend foundation as-is unless a blocking compatibility bug is found. Any schema change requires a new explicit approval.

## API Changes Allowed?

Yes, compatibility fixes only.

Allowed:

- Adjust phone OTP client/server response handling if required by the UI.
- Add non-breaking response metadata if needed for parent routing.

Forbidden:

- Change `/api/auth/login` behavior.
- Change `/api/auth/refresh` behavior.
- Change JWT payload shape.
- Add a second token model.
- Add a second refresh endpoint.
- Enable phone OTP login for non-parent roles.

## UI Changes Allowed?

Yes.

Allowed:

- Add Phone + OTP parent login controls to the existing login experience.
- Keep existing email/password login visible and working.
- Add OTP request, verify, resend, loading, cooldown, error, and success states.
- Route authenticated parents to the existing parent dashboard/portal path.
- Verify mobile/PWA login usability and readiness.

Forbidden:

- Redesign unrelated pages.
- Remove existing login controls.
- Force all users into phone login.
- Change staff/student/admin login behavior.

## Scope

Combined scope for Phases 4, 5, and 6:

- Parent phone login UI.
- OTP request/verify frontend wiring.
- Shared auth state/session handling after phone OTP login.
- Parent post-login route confirmation.
- Mobile and PWA readiness audit/fixes for the login path.
- Automated and manual verification.

Out of scope:

- Family architecture redesign.
- New parent dashboard features.
- Non-parent phone login.
- Broad visual redesign.

## Tests Required

- Existing email/password login regression.
- Parent phone OTP request UI test where practical.
- Parent phone OTP verify/session UI test where practical.
- Auth API client test or targeted unit coverage.
- Parent route/auth-state test where practical.
- TypeScript/build verification.
- Mobile/PWA manual or automated readiness check.

## Acceptance Criteria

- Existing email/password login still works.
- Parent phone OTP login can be initiated from the login experience.
- OTP verification creates an authenticated frontend session.
- Parent users land in the expected parent experience.
- Refresh/logout behavior still works after phone OTP login.
- Non-parent users are not offered or authenticated through parent phone OTP.
- Mobile login layout is usable.
- PWA readiness issues introduced by this phase are resolved.
- Phase 7 remains locked.

## Rollback Strategy

Revert the Phase 4-6 UI/client/routing changes. The Phase 3 backend can remain deployed because it is additive and parent-only.

## Definition Of Done

- Combined Phase 4-6 checklist is complete.
- Combined Phase 4-6 report is complete.
- Build/type checks pass.
- Targeted auth tests pass.
- Manual or automated parent phone OTP login verification is recorded.
- Existing email/password login regression is recorded.
- Phase 7 remains locked.

## Next Phase Prerequisites

Phase 7 may begin only after:

- Combined Phase 4-6 report says `Ready for Phase 7: Yes`.
- User approves starting Phase 7.
- Phase 7 phase document exists.
- Phase 7 checklist exists.
- Phase 7 report template exists.
- `LOCK_FILE.md` is updated to make Phase 7 active.
