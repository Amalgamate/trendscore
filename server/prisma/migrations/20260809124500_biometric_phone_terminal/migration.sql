-- Replay-safe phone terminal activation and offline event synchronization.

CREATE TABLE "biometric_device_activations" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "biometric_device_activations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "biometric_device_activations_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "biometric_device_activations_code_hash_key"
  ON "biometric_device_activations"("code_hash");
CREATE INDEX "biometric_device_activations_device_id_expires_at_idx"
  ON "biometric_device_activations"("device_id", "expires_at");

ALTER TABLE "biometric_logs"
  ADD COLUMN "event_id" TEXT,
  ADD COLUMN "modality" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "match_confidence" DOUBLE PRECISION,
  ADD COLUMN "liveness_status" TEXT,
  ADD COLUMN "liveness_confidence" DOUBLE PRECISION,
  ADD COLUMN "offline_captured" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "result_payload" JSONB;

CREATE UNIQUE INDEX "biometric_logs_deviceId_event_id_key"
  ON "biometric_logs"("deviceId", "event_id");
