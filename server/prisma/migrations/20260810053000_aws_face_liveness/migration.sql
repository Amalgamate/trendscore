-- Track one-time AWS Rekognition Face Liveness sessions without persisting
-- reference images or audit images in TrendSCORE.
CREATE TABLE "biometric_face_sessions" (
    "id" TEXT NOT NULL,
    "aws_session_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "device_id" TEXT,
    "person_type" TEXT,
    "person_id" TEXT,
    "direction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biometric_face_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "biometric_face_sessions_aws_session_id_key"
ON "biometric_face_sessions"("aws_session_id");

CREATE INDEX "biometric_face_sessions_school_id_purpose_status_idx"
ON "biometric_face_sessions"("school_id", "purpose", "status");

CREATE INDEX "biometric_face_sessions_device_id_created_at_idx"
ON "biometric_face_sessions"("device_id", "created_at");

CREATE INDEX "biometric_face_sessions_expires_at_idx"
ON "biometric_face_sessions"("expires_at");

ALTER TABLE "biometric_credentials"
ADD COLUMN "provider" TEXT,
ADD COLUMN "consent_recorded_at" TIMESTAMP(3),
ADD COLUMN "consent_recorded_by_id" TEXT;
