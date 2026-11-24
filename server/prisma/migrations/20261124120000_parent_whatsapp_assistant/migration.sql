CREATE TABLE "parent_whatsapp_links" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parent_whatsapp_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parent_whatsapp_links_userId_key" ON "parent_whatsapp_links"("userId");
CREATE UNIQUE INDEX "parent_whatsapp_links_phone_key" ON "parent_whatsapp_links"("phone");
CREATE INDEX "parent_whatsapp_links_enabled_updatedAt_idx" ON "parent_whatsapp_links"("enabled", "updatedAt");

ALTER TABLE "parent_whatsapp_links"
  ADD CONSTRAINT "parent_whatsapp_links_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
