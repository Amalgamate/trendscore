-- Add mpesaApiKey column to communication_configs if it doesn't exist.
-- The Prisma schema expects this field, and older local/live databases may not have it.
ALTER TABLE "communication_configs"
ADD COLUMN IF NOT EXISTS "mpesaApiKey" TEXT;
