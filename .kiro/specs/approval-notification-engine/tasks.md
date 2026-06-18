# Implementation Plan: Centralized Approval & Notification Engine

## Overview

This plan implements the Centralized Approval & Notification Engine for TrendSCORE in 15 task groups ordered by dependency. The backend database schema and core engine service must be built first, followed by API routes, then frontend components. The score unlock teacher UX is the last integration step, wiring the frontend to the completed engine.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "6"] },
    { "wave": 4, "tasks": ["4", "5"] },
    { "wave": 5, "tasks": ["7"] },
    { "wave": 6, "tasks": ["8", "9"] },
    { "wave": 7, "tasks": ["10"] },
    { "wave": 8, "tasks": ["11", "12", "13", "14"] },
    { "wave": 9, "tasks": ["15"] }
  ]
}
```

## Tasks

# Tasks: Centralized Approval & Notification Engine

---

- [x] 1. Database Schema & Migration
  - [x] 1.1 Add `APPROVAL` to the `NotificationType` enum in `schema.prisma`
  - [x] 1.2 Add `ApprovalModule`, `ApprovalRequestType`, `ApprovalMode`, `ApprovalStatus`, `ApprovalActionType` enums to `schema.prisma`
  - [x] 1.3 Add `ApprovalWorkflow`, `ApprovalStep`, `ApprovalRequest`, `ApprovalAction` models to `schema.prisma`
  - [x] 1.4 Add `approvalRequests` and `approvalActions` back-relations to the `User` model in `schema.prisma`
  - [x] 1.5 Run `prisma migrate dev --name add_approval_engine` to generate and apply the migration
  - [x] 1.6 Regenerate the Prisma client with `prisma generate`
  - **Requirements**: R1.1, R2.1, R3.1, R3.2, R5.9, R11.2

- [x] 2. Seed Default Score Unlock Workflow
  - [x] 2.1 Create `server/prisma/seeders/approvalWorkflows.seed.ts` — upsert the default SCORE_UNLOCK workflow with a single ROLE-based step (ADMIN + HEAD_TEACHER), `relockAfterMinutes: 60`, mode SINGLE
  - [x] 2.2 Wire the seed file into the main `server/prisma/seed.ts` so it runs on `prisma db seed`
  - **Requirements**: R1.3, R2.1, R4.3

- [x] 3. ApprovalEngineService — Core
  - [x] 3.1 Create `server/src/services/approvalEngine.service.ts` with the `ApprovalEngineService` class
  - [x] 3.2 Implement `submitRequest()` — find active workflow, resolve approvers, create `ApprovalRequest`, set `expiresAt`, call `notifyApprovers()`
  - [x] 3.3 Implement `resolveApprovers()` private method — query users by role or user IDs, scoped to school, return IDs array
  - [x] 3.4 Implement duplicate-request guard in `submitRequest()` — return error if a PENDING or APPROVED request already exists for the same assessmentId (for SCORE_UNLOCK) or equivalent key for other types
  - [x] 3.5 Implement `actOnRequest()` — validate actor is in resolvedApproverIds (or SUPER_ADMIN), record `ApprovalAction`, advance workflow state, call `runApprovalHook()` when fully approved, call `notifyRequester()`
  - [x] 3.6 Implement `cancelRequest()` — allow requester to cancel own PENDING request
  - [x] 3.7 Implement `listRequests()` with filters (status, module, requestedById, schoolId, date range)
  - [x] 3.8 Implement `getRequest()` with full relations (actions, workflow, requestedBy)
  - [x] 3.9 Implement `getDashboardStats()` — counts for pending, awaitingMyAction, mySubmitted, approvedToday, rejectedToday
  - [x] 3.10 Implement `processExpiredRequests()` — query APPROVED requests where `expiresAt <= now()`, transition to EXPIRED, call `runExpiryHook()`, notify requester
  - **Requirements**: R2.5, R2.6, R3.1–R3.7, R3.8, R5.2–R5.7

- [x] 4. ApprovalEngineService — Notifications & Hooks
  - [x] 4.1 Implement `notifyApprovers()` private method — call existing `NotificationService.createNotification()` for each resolved approver with type `APPROVAL`, `showAsPopup: true`, deep-link to request
  - [x] 4.2 Implement `notifyRequester()` private method — notify requester on APPROVED, REJECTED, EXPIRED using existing `NotificationService`
  - [x] 4.3 Implement `scoreUnlockApprovalHandler` hook — calls existing `WorkflowService.unlockAssessment()` using request metadata
  - [x] 4.4 Implement `scoreRelockHandler` expiry hook — calls existing `WorkflowService.lockAssessment()` using request metadata
  - [x] 4.5 Define `APPROVAL_HOOKS` and `EXPIRY_HOOKS` registries as maps from `ApprovalRequestType` to handler; stub all non-SCORE_UNLOCK types as no-ops for now
  - [x] 4.6 Implement `runApprovalHook()` and `runExpiryHook()` private methods — look up and call the registered handler
  - **Requirements**: R4.3, R4.5, R4.6, R4.8, R5.1–R5.7

- [x] 5. ApprovalEngineService — Audit Logging
  - [x] 5.1 Call existing `auditService.logChange()` on every state transition inside `actOnRequest()` and `processExpiredRequests()` — use entityType `ApprovalRequest`, entityId = request.id
  - [x] 5.2 Log workflow configuration changes (create/update/deactivate) via `auditService` inside the workflow controller
  - **Requirements**: R8.1, R7.5

- [x] 6. Workflow Configuration Service Methods
  - [x] 6.1 Add `createWorkflow(data)` method to `ApprovalEngineService` — create workflow + steps in a transaction
  - [x] 6.2 Add `updateWorkflow(id, data)` method — update workflow metadata
  - [x] 6.3 Add `updateWorkflowSteps(workflowId, steps)` method — replace all steps for a workflow in a transaction
  - [x] 6.4 Add `toggleWorkflow(id)` method — flip active boolean
  - [x] 6.5 Add `listWorkflows(filters?)` method — return all workflows with step counts
  - **Requirements**: R1.2, R1.4, R1.5, R7.1–R7.5

- [x] 7. Backend Controllers & Routes
  - [x] 7.1 Create `server/src/controllers/approval.controller.ts` — handlers: `submitRequest`, `listRequests`, `getMyRequests`, `getRequest`, `approveRequest`, `rejectRequest`, `overrideRequest`, `cancelRequest`, `getDashboard`, `getHistory`
  - [x] 7.2 Create `server/src/controllers/approvalWorkflow.controller.ts` — handlers: `listWorkflows`, `createWorkflow`, `updateWorkflow`, `toggleWorkflow`, `getWorkflowSteps`, `updateWorkflowSteps`
  - [x] 7.3 Create `server/src/routes/approval.routes.ts` — wire controllers to paths under `/approvals`, apply `authenticate` + `schoolContextMiddleware`, apply `requireRole` per endpoint per R9.1 permissions table
  - [x] 7.4 Create `server/src/routes/approvalWorkflow.routes.ts` — wire controllers under `/approval-workflows`, restrict to ADMIN and SUPER_ADMIN
  - [x] 7.5 Register both route files in `server/src/routes/index.ts`
  - **Requirements**: R6.1–R6.7, R7.1–R7.5, R9.1, R11.4

- [x] 8. Cron Worker Integration
  - [x] 8.1 Import `ApprovalEngineService` in `server/src/cron-worker.ts`
  - [x] 8.2 Add a `*/5 * * * *` cron schedule that calls `approvalEngine.processExpiredRequests()` with error logging
  - **Requirements**: R4.6, R4.7, R11.3

- [x] 9. Frontend API Service
  - [x] 9.1 Create `src/services/api/approval.api.js` — implement all API call functions: `submit`, `list`, `myRequests`, `dashboard`, `get`, `approve`, `reject`, `override`, `cancel`, `history`, `listWorkflows`, `createWorkflow`, `updateWorkflow`, `toggleWorkflow`, `getWorkflowSteps`, `updateWorkflowSteps`
  - [x] 9.2 Export `approvalAPI` from `src/services/api/index.js`
  - **Requirements**: R11.4

- [x] 10. Shared UI Components
  - [x] 10.1 Create `src/components/CBCGrading/pages/ApprovalsPage/components/ApprovalStatusBadge.jsx` — color-coded status badge using the design-specified colors
  - [x] 10.2 Create `src/components/CBCGrading/pages/ApprovalsPage/components/ApprovalRequestCard.jsx` — list row card showing status badge, requester, request type, current approver, step progress, date created, and inline Approve/Reject buttons visible only to assigned approvers
  - [x] 10.3 Create `src/components/CBCGrading/pages/ApprovalsPage/components/ApproverStepVisualizer.jsx` — shows step-by-step progress (e.g. Step 1 of 2 with user names)
  - [x] 10.4 Create `src/components/CBCGrading/pages/ApprovalsPage/components/RequestMetadataPanel.jsx` — renders module-specific metadata fields (e.g. class, subject, assessment for SCORE_UNLOCK)
  - **Requirements**: R10.1, R10.2, R10.4

- [x] 11. Approval Dashboard Page
  - [x] 11.1 Create `src/components/CBCGrading/pages/ApprovalsPage/ApprovalDashboard.jsx` — fetch and display KPI cards (Pending, Awaiting My Action, My Submitted, Approved Today, Rejected Today)
  - [x] 11.2 Implement filterable request list in `ApprovalDashboard` — filters for status, module, date range; use `ApprovalRequestCard` for each row
  - [x] 11.3 Implement inline approve/reject action in `ApprovalRequestCard` — POST to `/approvals/:id/approve` or `/approvals/:id/reject`, refresh list on success
  - [x] 11.4 Create `src/components/CBCGrading/pages/ApprovalsPage/ApprovalRequestDetail.jsx` — full detail view with metadata panel, step visualizer, action timeline, and approve/reject/override buttons
  - [x] 11.5 Create `src/components/CBCGrading/pages/ApprovalsPage/index.jsx` — main page with tab navigation: Dashboard | Workflows (admin-only) | History
  - **Requirements**: R6.1–R6.7, R9.1, R10.1–R10.5

- [x] 12. Workflow Management UI
  - [x] 12.1 Create `src/components/CBCGrading/pages/ApprovalsPage/WorkflowsManager.jsx` — table listing all workflows with name, module, request type, mode, active status, and Edit/Toggle buttons; visible only to ADMIN/SUPER_ADMIN
  - [x] 12.2 Create `src/components/CBCGrading/pages/ApprovalsPage/WorkflowForm.jsx` — form for creating/editing a workflow with fields: name, module, request type, description, approval mode, min approvals, relock duration; includes step builder (add/remove steps with approver type, roles/users, min approvals per step)
  - [x] 12.3 Wire `WorkflowsManager` into the Approvals page tabs (visible only when user is ADMIN or SUPER_ADMIN)
  - **Requirements**: R1.2, R7.1–R7.5, R9.1

- [x] 13. Approval History Page
  - [x] 13.1 Create `src/components/CBCGrading/pages/ApprovalsPage/ApprovalHistoryPage.jsx` — table of all historical requests with filters for module, user, approver, workflow, status, and date range
  - [x] 13.2 Display each history row with: request type, module, requester, final status, approver(s), created date, resolved date
  - **Requirements**: R8.1–R8.4

- [x] 14. Score Unlock Prompt (Teacher UX)
  - [x] 14.1 Create `src/components/shared/ScoreUnlockPrompt.jsx` — dialog shown when a teacher tries to edit a locked score; shows "Scores are locked. Request Unlock?" with a single "Request Unlock" button and a cancel link
  - [x] 14.2 Implement the submit flow in `ScoreUnlockPrompt` — POST to `/approvals` with module `ACADEMICS`, requestType `SCORE_UNLOCK`, metadata (assessmentId, assessmentType, classId, subjectId, term, academicYear)
  - [x] 14.3 Show pending state after submission — replace button with a status badge and "Waiting for approval..." message
  - [x] 14.4 Listen on the notification socket in `ScoreUnlockPrompt` — when a notification arrives with `metadata.requestId` matching the submitted request and status `APPROVED`, call the `onUnlockGranted` callback to allow editing
  - [x] 14.5 Integrate `ScoreUnlockPrompt` into the summative test score entry component — detect locked status before allowing edits, show the prompt instead
  - **Requirements**: R4.1–R4.4, R10.3

- [x] 15. Navigation & Routing
  - [x] 15.1 Add `{ id: 'settings-approvals', label: 'Approvals', path: 'settings-approvals', permission: 'SCHOOL_SETTINGS' }` to the `settings` section in `src/config/secondaryNav.js`
  - [x] 15.2 Add the same entry to the primary school nav config (the CBC primary nav equivalent of `secondaryNav.js`)
  - [x] 15.3 Register the `settings-approvals` route in `CBCGradingSystem.jsx` pointing to `ApprovalsPage/index.jsx`
  - **Requirements**: R6.1, R11.7


## Notes

- Tasks 1–8 are backend-only. Tasks 9–15 are frontend-only. No task spans both concerns.
- Task 1 (migration) must be completed before any other task. The Prisma client must be regenerated before the service code compiles.
- Tasks 3 and 4 can be developed together since they are in the same file.
- Tasks 10–13 (frontend components) can be developed in parallel once Task 9 (API client) is done.
- Task 14 (ScoreUnlockPrompt) depends on Task 9 but can be developed independently of Tasks 11–13.
- The existing `WorkflowService` is not replaced — Task 4.3 and 4.4 call into it. This preserves the emergency admin unlock path.
- All notifications reuse the existing `NotificationService`. No new notification infrastructure is added.
