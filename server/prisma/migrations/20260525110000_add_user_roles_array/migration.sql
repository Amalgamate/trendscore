-- Add roles[] array column to match schema.prisma User.roles
-- Existing systems historically used User.role only; backfill roles from role.

ALTER TABLE "users"
ADD COLUMN "roles" "UserRole"[];

UPDATE "users"
SET "roles" = ARRAY["role"]
WHERE "roles" IS NULL;

ALTER TABLE "users"
ALTER COLUMN "roles" SET NOT NULL,
ALTER COLUMN "roles" SET DEFAULT ARRAY[]::"UserRole"[];

