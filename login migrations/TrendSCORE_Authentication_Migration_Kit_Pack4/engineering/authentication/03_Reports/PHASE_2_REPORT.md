# Phase 2 Report

## Summary

Phase 2 added the backend foundation for phone-based parent OTP identity without replacing or changing the existing email/password login flow.

Implemented:

- Canonical Kenyan phone normalization utility.
- Additive `auth_otp_challenges` table and Prisma model.
- Additive `/api/auth/phone-otp/request` endpoint.
- Additive `/api/auth/phone-otp/verify` endpoint.
- Hashed OTP storage using HMAC-SHA256.
- OTP expiry, attempt limits, resend cooldown, resend limits, and lockout state.
- Targeted tests for phone normalization, OTP lifecycle, and endpoint payload validation.

Not implemented in this phase:

- No phone-only session issuance.
- No frontend login UI.
- No existing OTP-after-password behavior changes.
- No parent family authorization rewrite.

## Files Changed

- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260628120000_add_auth_otp_challenges/migration.sql`
- `server/src/controllers/auth.controller.ts`
- `server/src/routes/auth.routes.ts`
- `server/src/services/auth-phone-otp.service.ts`
- `server/src/utils/phone.util.ts`
- `server/src/utils/validation.util.ts`
- `server/src/__tests__/phone.util.spec.ts`
- `server/src/__tests__/authPhoneOtp.service.spec.ts`
- `server/src/__tests__/authPhoneOtp.validation.spec.ts`
- Phase documentation under `login migrations/**`

## Database Changes

Additive only.

New enums:

- `AuthOtpPurpose`
- `AuthOtpStatus`

New table:

- `auth_otp_challenges`

Key fields:

- `phoneRaw`
- `phoneNormalized`
- `purpose`
- `status`
- `codeHash`
- `expiresAt`
- `attempts`
- `maxAttempts`
- `resendCount`
- `maxResends`
- `lockedUntil`
- `lastSentAt`
- optional `userId`

Indexes:

- `(phoneNormalized, purpose, status)`
- `userId`
- `expiresAt`
- `createdAt`

No existing table, column, enum value, or data path was removed.

## API Changes

Additive only.

New routes:

- `POST /api/auth/phone-otp/request`
- `POST /api/auth/phone-otp/verify`

`/phone-otp/request`:

```json
{
  "phone": "0712345678"
}
```

Response:

```json
{
  "success": true,
  "challengeId": "uuid",
  "phone": "+254712345678",
  "expiresAt": "date",
  "resendAfterSeconds": 60,
  "message": "If a parent account exists for this phone number, an OTP has been sent."
}
```

`/phone-otp/verify`:

```json
{
  "challengeId": "uuid",
  "phone": "0712345678",
  "code": "123456"
}
```

Response:

```json
{
  "success": true,
  "challengeId": "uuid",
  "phone": "+254712345678",
  "verified": true,
  "userId": "parent-user-id-or-null",
  "message": "OTP verified. Phone login session issuance is not enabled in this phase."
}
```

The verify endpoint intentionally does not return `token` or `refreshToken` in Phase 2.

## Phone Normalization

Added `normalizeKenyanPhone()` and `getKenyanPhoneLookupCandidates()`.

Supported formats:

- `0712345678`
- `712345678`
- `254712345678`
- `+254 712 345 678`
- `0112345678`

Canonical storage format for OTP challenges:

- `+254XXXXXXXXX`

## OTP Lifecycle

OTP lifecycle rules:

- 6 digit code.
- HMAC-SHA256 hash stored in `codeHash`.
- Plaintext OTP is never stored.
- Expiry uses `OTP_CONFIG.expiryMinutes`.
- Max attempts: 5.
- Resend cooldown: 60 seconds.
- Max resends: 3.
- Lockout duration: 15 minutes after max resend or attempts.
- SMS is sent only when an active parent account is found for the phone number.
- Response remains generic to avoid account enumeration.

## Behavior Compatibility Notes

Preserved behavior:

- Existing `/api/auth/login` behavior unchanged.
- Existing `/api/auth/otp/send` and `/api/auth/otp/verify` behavior unchanged.
- Existing refresh/logout behavior unchanged.
- Existing token response fields unchanged.
- Existing login UI untouched.
- No frontend code changed.

New phone OTP endpoints are additive and do not issue login sessions yet.

## Tests Executed

- `npx prisma generate`
- `npx prisma validate`
- `npx tsc --noEmit`
- `npx jest src/__tests__/authToken.service.spec.ts src/__tests__/authLogin.service.spec.ts src/__tests__/phone.util.spec.ts src/__tests__/authPhoneOtp.service.spec.ts src/__tests__/authPhoneOtp.validation.spec.ts --runInBand`

Result:

- Prisma Client generated successfully.
- Prisma schema valid.
- TypeScript passed.
- 5 Jest suites passed.
- 23 tests passed.

Note:

- `npx prisma validate` emitted a warning about `SetNull` referential action on the optional `AuthOtpChallenge.user` relation. The schema is valid and the relation is intentionally nullable so OTP audit rows can remain if a user is removed.

## Risks

- Full backend test suite was not run.
- New migration has not been applied to a live database in this phase.
- Phone OTP verification does not yet issue sessions, by design.
- Existing parent records may contain inconsistent phone formats; lookup candidates cover common formats, but real production data should be audited before UI launch.
- The new phone OTP path sends SMS only for matched active parent accounts to reduce SMS abuse, while keeping a generic response.

## Rollback Plan

Code rollback:

- Revert Phase 2 files listed above.

Database rollback:

- The migration is additive. If rollback is needed after applying it, leave `auth_otp_challenges` unused temporarily or drop the new table/enums during a controlled maintenance window.

No existing table or data must be repaired because no existing schema was modified destructively.

## Acceptance Criteria Status

- Existing login behavior preserved: complete.
- Existing OTP-after-password behavior preserved: complete.
- Existing refresh/logout behavior preserved: complete.
- Canonical phone normalization added: complete.
- OTP hash storage added: complete.
- OTP expiry/attempt/resend controls added: complete.
- Additive phone OTP endpoints added: complete.
- Endpoint contract tests added: complete.
- TypeScript passes: complete.
- Targeted tests pass: complete.
- No UI changes: complete.
- No destructive database changes: complete.

## Ready for Phase 3?
Yes.

Reason: The backend foundation is in place for phone OTP verification. Phase 3 can safely plan session issuance and parent-family identity resolution, still behind additive endpoints and without removing existing login.
