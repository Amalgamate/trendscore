-- Streams are the authoritative school stream catalogue. A school may have
-- one active default stream, used only when an import row omits Stream.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Earlier releases wrote some stream settings to this legacy table. Preserve
-- them in the authoritative catalogue without overwriting an existing stream.
INSERT INTO "streams" ("id", "name", "active", "archived", "createdAt", "updatedAt")
SELECT 'legacy-stream-' || "id", "name", "active", "archived", "createdAt", "updatedAt"
FROM "stream_configs"
ON CONFLICT ("name") DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "streams_one_active_default_idx"
  ON "streams" ("isDefault")
  WHERE "isDefault" = true AND "active" = true AND "archived" = false;
