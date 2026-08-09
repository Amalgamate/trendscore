-- Phase 0 Sprint 0.3 — SMS Outbound Audit Table
-- Generalised SMS audit log for all trigger types (absent learner, fee, etc.)
-- The existing assessment_sms_audits table is untouched.

CREATE TABLE IF NOT EXISTS "sms_outbound_audits" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"        TEXT,
  "trigger_type"     TEXT        NOT NULL,
  "recipient_phone"  TEXT        NOT NULL,
  "recipient_name"   TEXT,
  "learner_id"       TEXT,
  "user_id"          TEXT,
  "template_key"     TEXT,
  "message_body"     TEXT        NOT NULL,
  "provider"         TEXT,
  "provider_msg_id"  TEXT,
  "status"           TEXT        NOT NULL DEFAULT 'PENDING',
  "retry_count"      INTEGER     NOT NULL DEFAULT 0,
  "retry_at"         TIMESTAMP(3),
  "failure_reason"   TEXT,
  "sent_at"          TIMESTAMP(3),
  "sent_by_user_id"  TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sms_outbound_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sms_outbound_audits_school_trigger_created_idx"
  ON "sms_outbound_audits"("school_id", "trigger_type", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "sms_outbound_audits_status_retry_idx"
  ON "sms_outbound_audits"("status", "retry_count")
  WHERE "status" IN ('FAILED', 'PENDING');

CREATE INDEX IF NOT EXISTS "sms_outbound_audits_phone_created_idx"
  ON "sms_outbound_audits"("recipient_phone", "created_at" DESC);
