-- Additive authentication OTP challenge storage for phone-based identity flows.

CREATE TYPE "AuthOtpPurpose" AS ENUM ('PARENT_PHONE_LOGIN', 'PHONE_VERIFICATION');
CREATE TYPE "AuthOtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED', 'CONSUMED');

CREATE TABLE "auth_otp_challenges" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "phoneRaw" TEXT NOT NULL,
  "phoneNormalized" TEXT NOT NULL,
  "purpose" "AuthOtpPurpose" NOT NULL DEFAULT 'PARENT_PHONE_LOGIN',
  "status" "AuthOtpStatus" NOT NULL DEFAULT 'PENDING',
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "maxResends" INTEGER NOT NULL DEFAULT 3,
  "lockedUntil" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "auth_otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_otp_challenges_phoneNormalized_purpose_status_idx"
  ON "auth_otp_challenges"("phoneNormalized", "purpose", "status");

CREATE INDEX "auth_otp_challenges_userId_idx"
  ON "auth_otp_challenges"("userId");

CREATE INDEX "auth_otp_challenges_expiresAt_idx"
  ON "auth_otp_challenges"("expiresAt");

CREATE INDEX "auth_otp_challenges_createdAt_idx"
  ON "auth_otp_challenges"("createdAt");

ALTER TABLE "auth_otp_challenges"
  ADD CONSTRAINT "auth_otp_challenges_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
