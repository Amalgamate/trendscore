# Phase 7-8 Report

Date: 2026-06-28

## Summary

Combined Phase 7-8 is complete.

Parent learner access now supports both the legacy direct `Learner.parentId` relationship and active family-account learner links. This was implemented without UI changes, database schema changes, token changes, OTP changes, or changes to non-parent login flows.

## Files Changed

- `server/src/services/parent-access.service.ts`
- `server/src/middleware/permissions.middleware.ts`
- `server/src/controllers/learner.controller.ts`
- `server/src/controllers/dashboard.controller.ts`
- `server/src/controllers/fee.controller.ts`
- `server/src/controllers/attendance.controller.ts`
- `server/src/__tests__/parentAccess.service.spec.ts`
- `server/src/__tests__/parentAccess.guard.spec.ts`
- `server/src/__tests__/parentDashboardAccess.spec.ts`
- Phase 7-8 control documents

## Database Changes

None.

## API Changes

No public API contract changes.

## Authorization Changes

- Added a shared parent access service.
- Preserved direct parent access through `Learner.parentId`.
- Added parent learner access through active `FamilyMember.userId -> FamilyAccount -> LearnerFamilyLink`.
- Required active family member, family account, login permission, and report-view permission for family-linked access.
- Kept unrelated learners blocked.
- Kept teacher/admin/staff learner access behavior unchanged.

## Backward Compatibility

- Existing parent direct-child access remains valid.
- Existing teacher/admin/staff access behavior remains unchanged.
- Existing email/password login remains unchanged.
- Existing phone OTP login remains unchanged.
- Existing JWT and refresh-token behavior remains unchanged.
- Missing family tables are tolerated by falling back to direct parent access.

## Tests

- `npx tsc --noEmit`
- `npx jest src/__tests__/parentAccess.service.spec.ts src/__tests__/parentAccess.guard.spec.ts src/__tests__/parentDashboardAccess.spec.ts src/__tests__/authToken.service.spec.ts src/__tests__/authLogin.service.spec.ts src/__tests__/authPhoneOtp.service.spec.ts --runInBand --forceExit`

Result:
- TypeScript passed.
- Jest passed: 6 suites, 25 tests.

## Risks And Notes

- This phase does not create family links; it only honors existing links.
- Parent dashboard cache keys remain parent-specific. If family links are changed by admins, cache expiry or existing cache invalidation controls determine when a parent sees the update.
- No browser/UI validation was required because this phase is backend authorization and query compatibility only.

## Rollback

Rollback by reverting the Phase 7-8 service, guard, controller, test, and documentation changes.

## Acceptance Criteria

- Parent can access direct `Learner.parentId` learners.
- Parent can access active family-linked learners.
- Parent cannot access unrelated learners.
- Parent dashboard includes direct and family-linked learners.
- Parent learner profile/update, invoice, assessment, and attendance checks use the shared access service.
- Teacher/admin/staff behavior remains unchanged.
- No UI files changed.
- No database schema changes made.
- Targeted tests and server typecheck pass.

## Ready for Phase 9?

Yes. Phase 9 remains locked until its phase document, checklist, report template, and explicit unlock are added.
