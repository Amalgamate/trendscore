-- Manual data-preserving rollback.
ALTER TABLE "family_accounts"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN "familyCode" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "family_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "learner_family_links" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- PostgreSQL enum values cannot be safely removed while rows may use them.

