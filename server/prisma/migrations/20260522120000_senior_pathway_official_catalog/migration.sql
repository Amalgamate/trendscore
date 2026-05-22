-- Senior School official pathway catalog foundation.
-- Additive only: keeps legacy pathway/category/learning-area tables intact.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubjectType') THEN
    CREATE TYPE "SubjectType" AS ENUM (
      'EXAMINABLE_CORE',
      'EXAMINABLE_OPTIONAL',
      'SUPPORT_SUBJECT',
      'NON_EXAMINABLE'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PathwaySelectionStatus') THEN
    CREATE TYPE "PathwaySelectionStatus" AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'TEACHER_REVIEW',
      'PARENT_REVIEW',
      'APPROVED',
      'REJECTED',
      'LOCKED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "pathway_tracks" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "pathwayId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pathway_tracks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pathway_tracks_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "pathways"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pathway_tracks_pathwayId_code_key" ON "pathway_tracks"("pathwayId", "code");
CREATE INDEX IF NOT EXISTS "pathway_tracks_pathwayId_idx" ON "pathway_tracks"("pathwayId");

CREATE TABLE IF NOT EXISTS "official_learning_areas" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "officialCode" TEXT NOT NULL,
  "officialName" TEXT NOT NULL,
  "subjectType" "SubjectType" NOT NULL,
  "pathwayId" TEXT,
  "trackId" TEXT,
  "examinable" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "official_learning_areas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "official_learning_areas_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "pathways"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "official_learning_areas_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "pathway_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "official_learning_areas_officialCode_key" ON "official_learning_areas"("officialCode");
CREATE INDEX IF NOT EXISTS "official_learning_areas_subjectType_idx" ON "official_learning_areas"("subjectType");
CREATE INDEX IF NOT EXISTS "official_learning_areas_pathwayId_idx" ON "official_learning_areas"("pathwayId");
CREATE INDEX IF NOT EXISTS "official_learning_areas_trackId_idx" ON "official_learning_areas"("trackId");

CREATE TABLE IF NOT EXISTS "learning_area_aliases" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "officialLearningAreaId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "source" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_area_aliases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learning_area_aliases_officialLearningAreaId_fkey" FOREIGN KEY ("officialLearningAreaId") REFERENCES "official_learning_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "learning_area_aliases_alias_key" ON "learning_area_aliases"("alias");
CREATE INDEX IF NOT EXISTS "learning_area_aliases_officialLearningAreaId_idx" ON "learning_area_aliases"("officialLearningAreaId");

CREATE TABLE IF NOT EXISTS "subject_combination_rules" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "pathwayId" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "officialSource" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subject_combination_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subject_combination_rules_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "pathways"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subject_combination_rules_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "pathway_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "subject_combination_rules_code_key" ON "subject_combination_rules"("code");
CREATE INDEX IF NOT EXISTS "subject_combination_rules_pathwayId_idx" ON "subject_combination_rules"("pathwayId");
CREATE INDEX IF NOT EXISTS "subject_combination_rules_trackId_idx" ON "subject_combination_rules"("trackId");

CREATE TABLE IF NOT EXISTS "subject_combination_rule_items" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "ruleId" TEXT NOT NULL,
  "officialLearningAreaId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "subject_combination_rule_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subject_combination_rule_items_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "subject_combination_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "subject_combination_rule_items_officialLearningAreaId_fkey" FOREIGN KEY ("officialLearningAreaId") REFERENCES "official_learning_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "subject_combination_rule_items_ruleId_officialLearningAreaId_key" ON "subject_combination_rule_items"("ruleId", "officialLearningAreaId");
CREATE INDEX IF NOT EXISTS "subject_combination_rule_items_officialLearningAreaId_idx" ON "subject_combination_rule_items"("officialLearningAreaId");

CREATE TABLE IF NOT EXISTS "school_learning_area_offerings" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "schoolId" TEXT,
  "officialLearningAreaId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "capacity" INTEGER,
  "teacherCount" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_learning_area_offerings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_learning_area_offerings_officialLearningAreaId_fkey" FOREIGN KEY ("officialLearningAreaId") REFERENCES "official_learning_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_learning_area_offerings_schoolId_officialLearningAreaId_key" ON "school_learning_area_offerings"("schoolId", "officialLearningAreaId");
CREATE INDEX IF NOT EXISTS "school_learning_area_offerings_schoolId_idx" ON "school_learning_area_offerings"("schoolId");
CREATE INDEX IF NOT EXISTS "school_learning_area_offerings_officialLearningAreaId_idx" ON "school_learning_area_offerings"("officialLearningAreaId");

CREATE TABLE IF NOT EXISTS "learner_pathway_selections" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "learnerId" TEXT NOT NULL,
  "pathwayId" TEXT NOT NULL,
  "trackId" TEXT,
  "combinationRuleId" TEXT,
  "status" "PathwaySelectionStatus" NOT NULL DEFAULT 'DRAFT',
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learner_pathway_selections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learner_pathway_selections_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learner_pathway_selections_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "pathways"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "learner_pathway_selections_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "pathway_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "learner_pathway_selections_combinationRuleId_fkey" FOREIGN KEY ("combinationRuleId") REFERENCES "subject_combination_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "learner_pathway_selections_learnerId_idx" ON "learner_pathway_selections"("learnerId");
CREATE INDEX IF NOT EXISTS "learner_pathway_selections_pathwayId_idx" ON "learner_pathway_selections"("pathwayId");
CREATE INDEX IF NOT EXISTS "learner_pathway_selections_trackId_idx" ON "learner_pathway_selections"("trackId");
CREATE INDEX IF NOT EXISTS "learner_pathway_selections_combinationRuleId_idx" ON "learner_pathway_selections"("combinationRuleId");
CREATE INDEX IF NOT EXISTS "learner_pathway_selections_status_idx" ON "learner_pathway_selections"("status");

CREATE TABLE IF NOT EXISTS "learner_pathway_selection_items" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "selectionId" TEXT NOT NULL,
  "officialLearningAreaId" TEXT NOT NULL,
  "subjectType" "SubjectType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learner_pathway_selection_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learner_pathway_selection_items_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "learner_pathway_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learner_pathway_selection_items_officialLearningAreaId_fkey" FOREIGN KEY ("officialLearningAreaId") REFERENCES "official_learning_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "learner_pathway_selection_items_selectionId_officialLearningAreaId_key" ON "learner_pathway_selection_items"("selectionId", "officialLearningAreaId");
CREATE INDEX IF NOT EXISTS "learner_pathway_selection_items_officialLearningAreaId_idx" ON "learner_pathway_selection_items"("officialLearningAreaId");

CREATE TABLE IF NOT EXISTS "pathway_approvals" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "selectionId" TEXT NOT NULL,
  "approverRole" TEXT NOT NULL,
  "approverId" TEXT,
  "status" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "pathway_approvals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pathway_approvals_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "learner_pathway_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pathway_approvals_selectionId_idx" ON "pathway_approvals"("selectionId");
CREATE INDEX IF NOT EXISTS "pathway_approvals_status_idx" ON "pathway_approvals"("status");

CREATE TABLE IF NOT EXISTS "pathway_selection_history" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "selectionId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "snapshot" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pathway_selection_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pathway_selection_history_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "learner_pathway_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pathway_selection_history_selectionId_idx" ON "pathway_selection_history"("selectionId");
CREATE INDEX IF NOT EXISTS "pathway_selection_history_action_idx" ON "pathway_selection_history"("action");
