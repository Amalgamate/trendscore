-- Biometric installation security and per-school ownership.
--
-- Device tokens migrate gradually: legacy plaintext values remain usable until
-- the device authenticates successfully or an administrator rotates the token.
-- At that point the application stores only a SHA-256 digest in token_hash.

ALTER TABLE "biometric_devices"
  ALTER COLUMN "token" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "installation_status" TEXT NOT NULL DEFAULT 'REGISTERED',
  ADD COLUMN IF NOT EXISTS "installation_guide_version" TEXT NOT NULL DEFAULT '2026.08',
  ADD COLUMN IF NOT EXISTS "installed_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "installed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_connection_test_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_connection_test_status" TEXT,
  ADD COLUMN IF NOT EXISTS "last_connection_test_message" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "biometric_devices_token_hash_key"
  ON "biometric_devices"("token_hash");

ALTER TABLE "biometric_credentials"
  ADD COLUMN IF NOT EXISTS "school_id" TEXT;

-- Existing deployments currently resolve one active school per database. This
-- backfill preserves those credentials while new writes always carry schoolId.
UPDATE "biometric_credentials"
SET "school_id" = (
  SELECT "id"
  FROM "schools"
  WHERE "active" = TRUE AND "archived" = FALSE
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "school_id" IS NULL;

CREATE INDEX IF NOT EXISTS "biometric_credentials_school_id_idx"
  ON "biometric_credentials"("school_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'biometric_devices_school_id_fkey'
  ) THEN
    ALTER TABLE "biometric_devices"
      ADD CONSTRAINT "biometric_devices_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'biometric_credentials_school_id_fkey'
  ) THEN
    ALTER TABLE "biometric_credentials"
      ADD CONSTRAINT "biometric_credentials_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'biometric_logs_school_id_fkey'
  ) THEN
    ALTER TABLE "biometric_logs"
      ADD CONSTRAINT "biometric_logs_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
