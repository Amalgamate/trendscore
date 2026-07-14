-- Version the non-Pathways schema alignment that was previously mixed into
-- _stage1_diff.sql.

ALTER TYPE "AuthOtpPurpose" ADD VALUE IF NOT EXISTS 'STUDENT_PHONE_PASSWORD_LOGIN';

-- uuid() is a Prisma client default for these fields. Preserve every existing
-- value while removing database defaults that caused migration drift.
ALTER TABLE "family_accounts"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "familyCode" DROP DEFAULT;
ALTER TABLE "family_members" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "learner_family_links" ALTER COLUMN "id" DROP DEFAULT;

