-- Migration: add_approval_engine
-- Adds the Centralized Approval & Notification Engine schema
-- Includes: enums, ApprovalWorkflow, ApprovalStep, ApprovalRequest, ApprovalAction tables
-- Also extends NotificationType enum with APPROVAL value
-- Also adds back-relations (approvalRequests, approvalActions) to users table (no DDL needed — handled by Prisma relations)

-- ── Extend NotificationType enum ─────────────────────────────────────────────
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPROVAL';

-- ── New Enums ─────────────────────────────────────────────────────────────────
CREATE TYPE "ApprovalModule" AS ENUM (
  'ACADEMICS',
  'FEES',
  'ACCOUNTING',
  'HR',
  'INVENTORY',
  'USERS',
  'GENERAL'
);

CREATE TYPE "ApprovalRequestType" AS ENUM (
  'SCORE_UNLOCK',
  'FEE_ADJUSTMENT',
  'FEE_WAIVER',
  'EXPENSE_APPROVAL',
  'BUDGET_APPROVAL',
  'PAYMENT_REVERSAL',
  'ROLE_CHANGE',
  'LEAVE_APPROVAL',
  'REPORT_PUBLISHING',
  'STOCK_ADJUSTMENT'
);

CREATE TYPE "ApprovalMode" AS ENUM (
  'SINGLE',
  'SEQUENTIAL',
  'PARALLEL'
);

CREATE TYPE "ApprovalStatus" AS ENUM (
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'COMPLETED'
);

CREATE TYPE "ApprovalActionType" AS ENUM (
  'APPROVE',
  'REJECT',
  'OVERRIDE',
  'CANCEL'
);

-- ── approval_workflows ────────────────────────────────────────────────────────
CREATE TABLE "approval_workflows" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"               TEXT NOT NULL,
  "module"             "ApprovalModule" NOT NULL,
  "requestType"        "ApprovalRequestType" NOT NULL,
  "description"        TEXT,
  "active"             BOOLEAN NOT NULL DEFAULT true,
  "approvalMode"       "ApprovalMode" NOT NULL DEFAULT 'SINGLE',
  "minApprovals"       INTEGER NOT NULL DEFAULT 1,
  "relockAfterMinutes" INTEGER,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_workflows_module_requestType_key" ON "approval_workflows"("module", "requestType");
CREATE INDEX "approval_workflows_module_active_idx" ON "approval_workflows"("module", "active");

-- ── approval_steps ────────────────────────────────────────────────────────────
CREATE TABLE "approval_steps" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workflowId"      TEXT NOT NULL,
  "stepNumber"      INTEGER NOT NULL,
  "approverType"    TEXT NOT NULL,
  "approverRoles"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "approverUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minApprovals"    INTEGER NOT NULL DEFAULT 1,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_steps_workflowId_stepNumber_key" ON "approval_steps"("workflowId", "stepNumber");
CREATE INDEX "approval_steps_workflowId_idx" ON "approval_steps"("workflowId");

ALTER TABLE "approval_steps"
  ADD CONSTRAINT "approval_steps_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── approval_requests ─────────────────────────────────────────────────────────
CREATE TABLE "approval_requests" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workflowId"          TEXT NOT NULL,
  "module"              "ApprovalModule" NOT NULL,
  "requestType"         "ApprovalRequestType" NOT NULL,
  "requestedById"       TEXT NOT NULL,
  "schoolId"            TEXT,
  "status"              "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "currentStepNumber"   INTEGER NOT NULL DEFAULT 1,
  "resolvedApproverIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "comments"            TEXT,
  "metadata"            JSONB NOT NULL,
  "expiresAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_requests_status_schoolId_idx" ON "approval_requests"("status", "schoolId");
CREATE INDEX "approval_requests_requestedById_idx" ON "approval_requests"("requestedById");
CREATE INDEX "approval_requests_module_requestType_idx" ON "approval_requests"("module", "requestType");
CREATE INDEX "approval_requests_expiresAt_status_idx" ON "approval_requests"("expiresAt", "status");

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON UPDATE CASCADE;

-- ── approval_actions ──────────────────────────────────────────────────────────
CREATE TABLE "approval_actions" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "requestId"  TEXT NOT NULL,
  "stepNumber" INTEGER NOT NULL,
  "approverId" TEXT NOT NULL,
  "action"     "ApprovalActionType" NOT NULL,
  "comment"    TEXT,
  "actedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_actions_requestId_idx" ON "approval_actions"("requestId");
CREATE INDEX "approval_actions_approverId_idx" ON "approval_actions"("approverId");

ALTER TABLE "approval_actions"
  ADD CONSTRAINT "approval_actions_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_actions"
  ADD CONSTRAINT "approval_actions_approverId_fkey"
  FOREIGN KEY ("approverId") REFERENCES "users"("id") ON UPDATE CASCADE;
