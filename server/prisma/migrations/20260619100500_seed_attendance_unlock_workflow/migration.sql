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
    'Attendance Unlock Approval',
    'ATTENDANCE',
    'ATTENDANCE_UNLOCK',
    'Approve requests to temporarily unlock locked attendance registers for correction.',
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
