-- Phase 3 — Guardian Portal
-- Adds parent_sms_replies table for two-way SMS communication.
-- Additive only — no existing tables modified.

CREATE TABLE IF NOT EXISTS "parent_sms_replies" (
  "id"                       TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"                TEXT,
  "from_phone"               TEXT         NOT NULL,
  "message_body"             TEXT         NOT NULL,
  "received_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider"                 TEXT,
  "provider_msg_id"          TEXT,
  "intent"                   TEXT,
  "linked_learner_id"        TEXT,
  "linked_notification_id"   TEXT,
  "processed"                BOOLEAN      NOT NULL DEFAULT FALSE,
  "processed_at"             TIMESTAMP(3),
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "parent_sms_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "parent_sms_replies_phone_idx"
  ON "parent_sms_replies"("from_phone", "received_at" DESC);

CREATE INDEX IF NOT EXISTS "parent_sms_replies_school_processed_idx"
  ON "parent_sms_replies"("school_id", "processed");
