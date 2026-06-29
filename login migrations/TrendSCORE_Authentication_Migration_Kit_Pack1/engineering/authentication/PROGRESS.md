# Progress Log

## 2026-06-28
Project initialized.

Completed:
- Migration workspace created.
- Control documents added:
  - RULES.md
  - LOCK_FILE.md
  - PHASE_TEMPLATE.md
- Phase 0 discovery checklist completed.
- Phase 0 discovery report completed.

Next:
- Execute Phase 1 as a refactor-only pass with zero behavior changes.
- Complete Phase 1 checklist and report.
- Run targeted verification.

## 2026-06-28 Phase 1 Start

User approved continuous progress. Phase 1 unlocked as the active phase.

Completed:
- Extracted `AuthTokenService`.
- Extracted `AuthLoginService`.
- Reduced `AuthController` login/token responsibilities.
- Added targeted service tests.
- Ran TypeScript verification.

Tests:
- `npx tsc --noEmit`
- `npx jest src/__tests__/authToken.service.spec.ts src/__tests__/authLogin.service.spec.ts --runInBand`

Next:
- Phase 2 is now defined.
- Phase 2 should introduce the identity/phone OTP foundation without breaking existing login.
- Unlock Phase 2 only when ready to make additive backend/database changes.

## 2026-06-28 Phase 2 Start

User approved continuing into Phase 2. Phase 2 unlocked as the active phase.

Completed:
- Added additive `auth_otp_challenges` schema and migration.
- Added canonical Kenyan phone normalization utility.
- Added `AuthPhoneOtpService`.
- Added additive phone OTP request and verify endpoints.
- Added OTP hash storage, expiry, attempt, resend, and lockout controls.
- Added Phase 2 tests.

Tests:
- `npx prisma generate`
- `npx prisma validate`
- `npx tsc --noEmit`
- `npx jest src/__tests__/authToken.service.spec.ts src/__tests__/authLogin.service.spec.ts src/__tests__/phone.util.spec.ts src/__tests__/authPhoneOtp.service.spec.ts src/__tests__/authPhoneOtp.validation.spec.ts --runInBand`

Next:
- Define Phase 3 before session issuance or UI changes.
- Phase 3 should decide how verified phone OTP becomes an authenticated parent session.
- Phase 3 should wire parent access to family relationships, not only `Learner.parentId`.

## 2026-06-28 Phase 3 Start

User approved continuing into Phase 3. Phase 3 unlocked as the active phase.

Completed:
- Added Phase 3 parent phone OTP login control documents.
- Centralized authenticated session creation in `AuthLoginService`.
- Updated parent phone OTP verification to issue the shared authenticated session for active parent accounts.
- Reused existing JWT, refresh token, and cookie handling.
- Added account, role, lock, and school active validation before token issuance.
- Consumed OTP challenges after successful login.
- Added audit logging for `PARENT_LOGIN_VIA_OTP`.
- Added Phase 3 tests.

Tests:
- `npx tsc --noEmit`
- `npx jest src/__tests__/authToken.service.spec.ts src/__tests__/authLogin.service.spec.ts src/__tests__/phone.util.spec.ts src/__tests__/authPhoneOtp.service.spec.ts src/__tests__/authPhoneOtp.validation.spec.ts --runInBand`

Next:
- Stop after Phase 3 as requested.
- Define Phase 4 before UI, PWA, parent dashboard routing, or family-access expansion work.

## 2026-06-28 Phase 4-6 Combined Unlock

User requested combining Phases 4, 5, and 6 and unlocking them together.

Completed:
- Added combined Phase 4-6 phase document.
- Added combined Phase 4-6 checklist.
- Added combined Phase 4-6 report template.
- Updated `LOCK_FILE.md` to make Phase 4-6 the active phase.
- Kept Phase 7 and later locked.

Next:
- Implement only the combined Phase 4-6 scope.
- Stop before Phase 7 unless explicitly unlocked.

## 2026-06-28 Phase 4-6 Combined Complete

Completed:
- Added phone OTP login mode to the existing login card.
- Added frontend auth client methods for phone OTP request and verify.
- Reused existing auth success/session path for phone OTP login.
- Preserved existing email/password login as the default mode.
- Persisted the resolved role landing page so parent OTP login lands on the parent portal route through the existing dashboard resolver.
- Verified PWA/build readiness through production build.
- Completed combined Phase 4-6 checklist and report.
- Kept Phase 7 locked.

Tests:
- `npx eslint src/components/auth/LoginForm.jsx src/services/api/auth.api.js src/App.jsx`
- `npx tsc --noEmit`
- `npx jest src/__tests__/authToken.service.spec.ts src/__tests__/authLogin.service.spec.ts src/__tests__/phone.util.spec.ts src/__tests__/authPhoneOtp.service.spec.ts src/__tests__/authPhoneOtp.validation.spec.ts --runInBand --forceExit`
- `npm run build`
- `npx vitest run src/components/CBCGrading/utils/appAccess.test.js`

Notes:
- Live SMS/OTP verification was not run locally because it requires SMS credentials and a real active parent account.

Next:
- Define Phase 7 before any further production code changes.

## 2026-06-28 Phase 7-8 Combined Unlock

User requested proceeding with Phases 7 and 8 together.

Completed:
- Added combined Phase 7-8 phase document.
- Added combined Phase 7-8 checklist.
- Added combined Phase 7-8 report template.
- Updated `LOCK_FILE.md` to make Phase 7-8 the active phase.
- Kept Phase 9 and later locked.

Next:
- Implement only parent family access compatibility.
- Stop before Phase 9 unless explicitly unlocked.

## 2026-06-28 Phase 7-8 Combined Complete

Completed:
- Added shared `ParentAccessService` for parent learner access decisions.
- Preserved direct `Learner.parentId` access.
- Added active family-account learner access through existing family tables.
- Updated parent learner guards, parent dashboard learner query, parent learner profile/update checks, invoices, assessment access, and attendance summary checks.
- Added targeted parent access, guard, and dashboard tests.
- Completed combined Phase 7-8 checklist and report.
- Kept Phase 9 locked.

Tests:
- `npx tsc --noEmit`
- `npx jest src/__tests__/parentAccess.service.spec.ts src/__tests__/parentAccess.guard.spec.ts src/__tests__/parentDashboardAccess.spec.ts src/__tests__/authToken.service.spec.ts src/__tests__/authLogin.service.spec.ts src/__tests__/authPhoneOtp.service.spec.ts --runInBand --forceExit`

Next:
- Define Phase 9 control documents before any Phase 9 implementation.
- Unlock Phase 9 only after explicit approval.

## 2026-06-28 Phase 9-10 Combined Unlock

User requested combining Phases 9 and 10.

Completed:
- Added combined Phase 9-10 phase document.
- Added combined Phase 9-10 checklist.
- Added combined Phase 9-10 report template.
- Updated `LOCK_FILE.md` to make Phase 9-10 the active phase.
- Kept later phases locked.

Next:
- Complete authentication hardening and production-readiness verification.
- Stop after Phase 9-10 completion.

## 2026-06-28 Phase 9-10 Combined Complete

Completed:
- Reviewed remaining Phase 0 authentication risks.
- Enforced password lockout for password login after repeated failed attempts.
- Preserved invalid-password response behavior and existing login/session response shape.
- Kept expired lock cleanup before credential validation.
- Aligned auth cookie clearing attributes with auth cookie creation attributes.
- Reran auth, OTP, and parent-access tests.
- Verified server TypeScript.
- Verified production frontend/PWA build.
- Completed combined Phase 9-10 checklist and report.
- Kept later phases locked.

Tests:
- `npx jest src/__tests__/authLogin.service.spec.ts src/__tests__/authToken.service.spec.ts src/__tests__/authPhoneOtp.service.spec.ts src/__tests__/authPhoneOtp.validation.spec.ts src/__tests__/parentAccess.service.spec.ts src/__tests__/parentAccess.guard.spec.ts src/__tests__/parentDashboardAccess.spec.ts --runInBand --forceExit`
- `npx tsc --noEmit`
- `npm run build`

Notes:
- Live SMS OTP delivery was not run locally because it requires SMS credentials and a real active parent account.
- Build-generated service worker/version metadata was reverted after verification to avoid committing build-only noise.

## 2026-06-28 Unified Phone Login Correction

User clarified that the visible legacy email login method should not remain.

Completed:
- Removed the visible email/password tab from the login card.
- Made phone number the single visible login identifier.
- Kept OTP as the first path after phone entry.
- Added password fallback inside the same phone flow for users who do not receive OTP.
- Added WebOTP/browser OTP autofill support where available.
- Updated backend password login to accept `phone + password`.
- Updated public `/auth/login` validation to require phone for password fallback.
- Expanded phone OTP session issuance to all active user roles.

## 2026-06-28 Super Admin Setup OTP

User requested a universal setup OTP for the super admin phone.

Completed:
- Added fixed setup OTP `123456` for phone `0713612141`.
- Scoped the fixed OTP lookup to active `SUPER_ADMIN` accounts only.
- Blocked the fixed setup phone from authenticating non-super-admin accounts.
- Suppressed SMS sending for the fixed setup OTP path.

Tests:
- `npx tsc --noEmit`
- `npx jest src/__tests__/authPhoneOtp.service.spec.ts src/__tests__/authLogin.service.spec.ts src/__tests__/authToken.service.spec.ts --runInBand --forceExit`

Tests:
- `npx tsc --noEmit`
- `npx eslint src/components/auth/LoginForm.jsx src/services/api/auth.api.js`
- `npx jest src/__tests__/authLogin.service.spec.ts src/__tests__/authToken.service.spec.ts src/__tests__/authPhoneOtp.service.spec.ts src/__tests__/authPhoneOtp.validation.spec.ts src/__tests__/parentAccess.service.spec.ts src/__tests__/parentAccess.guard.spec.ts src/__tests__/parentDashboardAccess.spec.ts --runInBand --forceExit`
- `npm run build`
