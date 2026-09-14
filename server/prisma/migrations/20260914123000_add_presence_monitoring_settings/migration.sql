-- Repair presence-monitoring schema drift in existing school databases.
-- These fields are already represented in Prisma models and are additive,
-- nullable/defaulted so applying this migration does not alter prior data.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "presenceConsentAcceptedAt" TIMESTAMP(3);

ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "presenceMonitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "presenceHeartbeatMinutes" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "presenceStaleThresholdMinutes" INTEGER NOT NULL DEFAULT 25;
