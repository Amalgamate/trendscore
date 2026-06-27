-- CreateEnum
CREATE TYPE "FamilyAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FamilyMemberRole" AS ENUM ('PRIMARY_GUARDIAN', 'GUARDIAN', 'SPONSOR', 'EMERGENCY_CONTACT');

-- CreateEnum
CREATE TYPE "FamilyMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "family_accounts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "familyCode" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "displayName" TEXT,
  "primaryPhone" TEXT,
  "status" "FamilyAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "archivedBy" TEXT,

  CONSTRAINT "family_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "familyAccountId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "normalizedPhone" TEXT NOT NULL,
  "relationship" TEXT,
  "role" "FamilyMemberRole" NOT NULL DEFAULT 'GUARDIAN',
  "status" "FamilyMemberStatus" NOT NULL DEFAULT 'INVITED',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "canLogin" BOOLEAN NOT NULL DEFAULT true,
  "canPayFees" BOOLEAN NOT NULL DEFAULT true,
  "canViewReports" BOOLEAN NOT NULL DEFAULT true,
  "canReceiveSms" BOOLEAN NOT NULL DEFAULT true,
  "verifiedAt" TIMESTAMP(3),
  "invitedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_family_links" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "familyAccountId" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "relationship" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "learner_family_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_accounts_familyCode_key" ON "family_accounts"("familyCode");

-- CreateIndex
CREATE INDEX "family_accounts_primaryPhone_idx" ON "family_accounts"("primaryPhone");

-- CreateIndex
CREATE INDEX "family_accounts_status_archived_idx" ON "family_accounts"("status", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_userId_key" ON "family_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_familyAccountId_normalizedPhone_key" ON "family_members"("familyAccountId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "family_members_normalizedPhone_idx" ON "family_members"("normalizedPhone");

-- CreateIndex
CREATE INDEX "family_members_familyAccountId_isPrimary_idx" ON "family_members"("familyAccountId", "isPrimary");

-- CreateIndex
CREATE INDEX "family_members_status_idx" ON "family_members"("status");

-- CreateIndex
CREATE UNIQUE INDEX "learner_family_links_familyAccountId_learnerId_key" ON "learner_family_links"("familyAccountId", "learnerId");

-- CreateIndex
CREATE INDEX "learner_family_links_learnerId_idx" ON "learner_family_links"("learnerId");

-- CreateIndex
CREATE INDEX "learner_family_links_familyAccountId_isPrimary_idx" ON "learner_family_links"("familyAccountId", "isPrimary");

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_familyAccountId_fkey" FOREIGN KEY ("familyAccountId") REFERENCES "family_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_family_links" ADD CONSTRAINT "learner_family_links_familyAccountId_fkey" FOREIGN KEY ("familyAccountId") REFERENCES "family_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_family_links" ADD CONSTRAINT "learner_family_links_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing parent users into one family account per normalized phone.
WITH parent_users AS (
  SELECT
    "id",
    "firstName",
    "lastName",
    "phone",
    "emailVerified",
    "createdAt",
    CASE
      WHEN length(regexp_replace(COALESCE("phone", ''), '\D', '', 'g')) = 10
        AND regexp_replace(COALESCE("phone", ''), '\D', '', 'g') LIKE '0%'
        THEN '254' || substr(regexp_replace(COALESCE("phone", ''), '\D', '', 'g'), 2)
      WHEN length(regexp_replace(COALESCE("phone", ''), '\D', '', 'g')) = 9
        AND regexp_replace(COALESCE("phone", ''), '\D', '', 'g') ~ '^[17]'
        THEN '254' || regexp_replace(COALESCE("phone", ''), '\D', '', 'g')
      ELSE regexp_replace(COALESCE("phone", ''), '\D', '', 'g')
    END AS "normalizedPhone"
  FROM "users"
  WHERE "role" = 'PARENT'
    AND COALESCE("archived", false) = false
    AND COALESCE("phone", '') <> ''
),
family_seeds AS (
  SELECT DISTINCT ON ("normalizedPhone")
    gen_random_uuid()::text AS "familyAccountId",
    "normalizedPhone",
    trim(COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')) AS "displayName",
    "createdAt"
  FROM parent_users
  WHERE "normalizedPhone" <> ''
  ORDER BY "normalizedPhone", "createdAt" ASC
),
inserted_families AS (
  INSERT INTO "family_accounts" ("id", "displayName", "primaryPhone", "createdAt", "updatedAt")
  SELECT
    "familyAccountId",
    NULLIF("displayName", '') || ' Family',
    "normalizedPhone",
    "createdAt",
    CURRENT_TIMESTAMP
  FROM family_seeds
  RETURNING "id", "primaryPhone"
),
primary_parent_users AS (
  SELECT DISTINCT ON (pu."normalizedPhone")
    pu.*
  FROM parent_users pu
  WHERE pu."normalizedPhone" <> ''
  ORDER BY pu."normalizedPhone", pu."createdAt" ASC
),
inserted_members AS (
  INSERT INTO "family_members" (
    "id",
    "familyAccountId",
    "userId",
    "name",
    "phone",
    "normalizedPhone",
    "relationship",
    "role",
    "status",
    "isPrimary",
    "verifiedAt",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid()::text,
    f."id",
    pu."id",
    COALESCE(NULLIF(trim(COALESCE(pu."firstName", '') || ' ' || COALESCE(pu."lastName", '')), ''), 'Parent'),
    pu."phone",
    pu."normalizedPhone",
    'Guardian',
    'PRIMARY_GUARDIAN'::"FamilyMemberRole",
    'ACTIVE'::"FamilyMemberStatus",
    true,
    CASE WHEN pu."emailVerified" THEN CURRENT_TIMESTAMP ELSE NULL END,
    pu."createdAt",
    CURRENT_TIMESTAMP
  FROM primary_parent_users pu
  JOIN inserted_families f ON f."primaryPhone" = pu."normalizedPhone"
  RETURNING "familyAccountId", "userId"
),
parent_family_links AS (
  SELECT
    pu."id" AS "userId",
    f."id" AS "familyAccountId"
  FROM parent_users pu
  JOIN inserted_families f ON f."primaryPhone" = pu."normalizedPhone"
)
INSERT INTO "learner_family_links" (
  "id",
  "familyAccountId",
  "learnerId",
  "relationship",
  "isPrimary",
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  pfl."familyAccountId",
  l."id",
  COALESCE(l."guardianRelation", 'Guardian'),
  true,
  CURRENT_TIMESTAMP
FROM "learners" l
JOIN parent_family_links pfl ON pfl."userId" = l."parentId"
ON CONFLICT ("familyAccountId", "learnerId") DO NOTHING;
