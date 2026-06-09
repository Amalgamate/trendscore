-- Add mpesaSandbox column to communication_configs if it doesn't exist.
-- Fixes: The column `communication_configs.mpesaSandbox` does not exist.
ALTER TABLE "communication_configs"
  ADD COLUMN IF NOT EXISTS "mpesaSandbox" BOOLEAN NOT NULL DEFAULT false;
