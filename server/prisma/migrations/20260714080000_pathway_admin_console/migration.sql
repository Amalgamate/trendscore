CREATE TABLE IF NOT EXISTS "pathway_content_versions" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "snapshot" JSONB NOT NULL,
  "reason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pathway_content_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pathway_content_versions_entityType_entityId_version_key" ON "pathway_content_versions"("entityType", "entityId", "version");
CREATE INDEX IF NOT EXISTS "pathway_content_versions_entityType_status_idx" ON "pathway_content_versions"("entityType", "status");

CREATE TABLE IF NOT EXISTS "pathway_rule_sets" (
  "id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "config" JSONB NOT NULL,
  "reason" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pathway_rule_sets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pathway_rule_sets_domain_version_key" ON "pathway_rule_sets"("domain", "version");
CREATE INDEX IF NOT EXISTS "pathway_rule_sets_domain_status_idx" ON "pathway_rule_sets"("domain", "status");

CREATE TABLE IF NOT EXISTS "pathway_import_jobs" (
  "id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "payload" JSONB NOT NULL,
  "preview" JSONB,
  "errors" JSONB,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pathway_import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pathway_import_jobs_idempotencyKey_key" ON "pathway_import_jobs"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "pathway_import_jobs_domain_status_idx" ON "pathway_import_jobs"("domain", "status");
