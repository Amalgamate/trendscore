-- Seed the default score-unlock approval workflow during deploy.
-- This keeps production instances usable even when the general seed script is not run.

WITH workflow AS (
  INSERT INTO "approval_workflows" (
    "name",
    "module",
    "requestType",
    "description",
    "active",
    "approvalMode",
    "minApprovals",
    "relockAfterMinutes",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    'Score Unlock Approval',
    'ACADEMICS',
    'SCORE_UNLOCK',
    'Approve teacher requests to temporarily unlock locked assessment scores for editing.',
    true,
    'SINGLE',
    1,
    60,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("module", "requestType") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "active" = true,
    "approvalMode" = EXCLUDED."approvalMode",
    "minApprovals" = EXCLUDED."minApprovals",
    "relockAfterMinutes" = EXCLUDED."relockAfterMinutes",
    "updatedAt" = CURRENT_TIMESTAMP
  RETURNING "id"
)
INSERT INTO "approval_steps" (
  "workflowId",
  "stepNumber",
  "approverType",
  "approverRoles",
  "approverUserIds",
  "minApprovals",
  "createdAt",
  "updatedAt"
)
SELECT
  workflow."id",
  1,
  'ROLE',
  ARRAY['ADMIN', 'HEAD_TEACHER']::TEXT[],
  ARRAY[]::TEXT[],
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM workflow
ON CONFLICT ("workflowId", "stepNumber") DO UPDATE SET
  "approverType" = EXCLUDED."approverType",
  "approverRoles" = EXCLUDED."approverRoles",
  "approverUserIds" = EXCLUDED."approverUserIds",
  "minApprovals" = EXCLUDED."minApprovals",
  "updatedAt" = CURRENT_TIMESTAMP;
