-- A parent phone can change; the parent code is the stable login identifier.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_parentCode_key" ON "users"("parentCode");
