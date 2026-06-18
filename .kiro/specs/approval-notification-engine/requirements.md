# Requirements Document

## Introduction

This document defines the requirements for a Centralized Approval & Notification Engine for TrendSCORE — a school management system. The engine is a generic, reusable platform that all modules (Academics, Finance, Fees, Accounting, HR, Users, Inventory) can use to submit, route, and process approval requests. It is not a one-off score-unlock feature. The first concrete implementation is Score Unlock in the Academics module.

The requirements were written after a full audit of existing infrastructure: the `WorkflowService`, `NotificationService`, Socket.IO setup, `UserNotification` model, `ChangeHistory` model, permission middleware, and `UserNotificationContext`. Where existing services can be reused they are explicitly called out. Where new database models and services are needed they are clearly specified.

## Glossary

- **Approval Engine** — the centralized `ApprovalEngineService` and associated DB models that handle all approval workflows across modules.
- **Workflow** — an `ApprovalWorkflow` configuration record that defines how a specific type of request (e.g. Score Unlock) is routed and approved.
- **Request** — an `ApprovalRequest` record created when a user needs something approved (e.g. unlock a set of scores).
- **Step** — an `ApprovalStep` within a workflow, defining who approves at a given stage.
- **Action** — an `ApprovalAction` record capturing a single approve/reject/override event by an approver.
- **Relock** — automatic re-locking of scores after an unlock window expires.
- **Module** — a functional area of the system: `ACADEMICS`, `FEES`, `ACCOUNTING`, `HR`, `INVENTORY`, `USERS`.
- **SEQUENTIAL** — approval mode where each step must be satisfied before the next is activated.
- **PARALLEL** — approval mode where all steps are active simultaneously.
- **SINGLE** — approval mode with a single step and a single required approval.

---

# Requirements: Centralized Approval & Notification Engine

## Audit Summary

Before writing these requirements, the following existing components were audited:

### What Already Exists
- **`WorkflowService`** — assessment-specific workflow (submit → approve → publish → lock/unlock). Hardcoded to `SummativeTest` and `FormativeAssessment`. Approval roles are hard-coded arrays. `notifyApprovers` and `notifyApprovalStatus` are stubs (`// TODO`).
- **`NotificationService`** — full-featured: DB persistence (`UserNotification`), Socket.IO real-time emit per user room, Web Push (VAPID), `notifyRoles()` helper. Ready to reuse as-is.
- **`auditService`** — thin wrapper over `ChangeHistory` (entityType, entityId, action, field, oldValue, newValue, changedBy, reason). Reusable.
- **`UserNotification` model** — `userId`, `title`, `message`, `type`, `link`, `isRead`, `readAt`, `showAsPopup`, `metadata`, `createdAt`. Already wired to Socket.IO and Web Push.
- **`UserNotificationContext`** — full client-side notification provider with socket dedup, optimistic mark-read, push subscription. Ready to consume approval notifications.
- **Socket.IO** — authenticated, per-user rooms (`socket.join(userId)`). Online users receive events immediately; offline users get them on next login via DB.
- **`UserRole` enum** — `SUPER_ADMIN`, `ADMIN`, `HEAD_TEACHER`, `TEACHER`, `PARENT`, `ACCOUNTANT`, `RECEPTIONIST`, `LIBRARIAN`, `NURSE`, etc.
- **`permissions.middleware.ts`** — `requireRole()`, `requirePermission()`, `requireAnyPermission()` middleware. Reuse directly.
- **`ChangeHistory` model** — entity-agnostic audit log. Reusable for approval history.
- **`PathwayApproval`** — a module-specific approval table, not generic. Cannot be reused as the engine.

### What Does NOT Exist Yet
- A generic, configurable `ApprovalWorkflow` definition table
- A generic `ApprovalRequest` table that all modules can submit to
- `ApprovalStep` / approver assignment per workflow
- Auto-relock mechanism (cron/timer)
- Score unlock as an approval-driven operation
- Approval dashboard UI
- Workflow management UI (School Settings → Approvals)

### Reuse Decisions
- **Reuse** `NotificationService` for all approval notifications — no new notification system
- **Reuse** Socket.IO infrastructure — no new real-time transport
- **Reuse** `UserNotification` model — add `APPROVAL` notification type
- **Reuse** `auditService` / `ChangeHistory` for approval audit trail
- **Reuse** `requireRole()` / `requirePermission()` middleware for all approval routes
- **Extend** existing `WorkflowService` to delegate score unlock to the new engine
- **Do NOT** duplicate notification delivery, socket setup, or audit logging

---

## Requirements

### R1 — Approval Workflow Definition

**R1.1** The system shall provide an `ApprovalWorkflow` configuration entity with the following fields:
- `id`, `name`, `module` (e.g. `ACADEMICS`, `FEES`, `ACCOUNTING`, `HR`, `INVENTORY`, `USERS`), `requestType` (e.g. `SCORE_UNLOCK`, `FEE_ADJUSTMENT`, `EXPENSE_APPROVAL`), `description`, `active` (boolean), `approvalMode` (`SINGLE` | `SEQUENTIAL` | `PARALLEL`), `minApprovals` (integer, default 1), `relockAfterMinutes` (optional integer for time-bounded unlock), `createdAt`, `updatedAt`.

**R1.2** Only `SUPER_ADMIN` and `ADMIN` roles shall be permitted to create, edit, activate, or deactivate approval workflows.

**R1.3** The system shall ship with a pre-seeded `SCORE_UNLOCK` workflow for the `ACADEMICS` module, active by default, configured as `SINGLE` approval mode.

**R1.4** Workflow names and request types shall be unique per module.

**R1.5** Deactivating a workflow shall not affect in-flight approval requests; those shall complete under the workflow configuration active at time of submission.

---

### R2 — Approver Configuration

**R2.1** Each workflow shall support one or more `ApprovalStep` entries. Each step shall have: `stepNumber` (integer, 1-based), `approverType` (`ROLE` | `USER`), `approverRoles` (array of `UserRole` values, used when type is `ROLE`), `approverUserIds` (array of user IDs, used when type is `USER`), `minApprovals` (integer, default 1).

**R2.2** For `SEQUENTIAL` mode, steps shall be processed in `stepNumber` order. Step N+1 is only activated after step N is satisfied.

**R2.3** For `PARALLEL` mode, all steps shall be activated simultaneously. The request is approved when the total approvals across all steps meets the workflow `minApprovals` threshold.

**R2.4** For `SINGLE` mode, a single step with a single approver or role is sufficient.

**R2.5** Approver configuration shall resolve role-based approvers at request-submission time by looking up active users with the matching role(s). The resolved user IDs shall be stored on the request for traceability.

**R2.6** If no matching approvers are found at submission time for a role-based step, the request shall be created with status `PENDING` but a warning shall be logged. The admin dashboard shall surface such orphaned requests.

---

### R3 — Approval Request Lifecycle

**R3.1** All modules shall create approval requests through a single shared `ApprovalRequest` entity with these fields:
- `id`, `workflowId`, `module`, `requestType`, `requestedById` (User), `status` (`DRAFT` | `PENDING` | `APPROVED` | `REJECTED` | `EXPIRED` | `CANCELLED` | `COMPLETED`), `currentStepNumber`, `metadata` (JSON — module-specific payload), `comments`, `expiresAt` (optional, computed from `relockAfterMinutes`), `createdAt`, `updatedAt`.

**R3.2** Each approval action taken on a request shall be recorded in an `ApprovalAction` entity: `id`, `requestId`, `stepNumber`, `approverId`, `action` (`APPROVE` | `REJECT` | `OVERRIDE`), `comment`, `actedAt`.

**R3.3** A request moves to `APPROVED` status when all required approval steps are satisfied per the workflow mode.

**R3.4** Any approver at the current step may reject a request. Rejection shall set status to `REJECTED` immediately, regardless of mode.

**R3.5** A `SUPER_ADMIN` may override any request to `APPROVED` or `REJECTED` at any time, regardless of step or workflow configuration.

**R3.6** The requester may cancel their own `PENDING` request. Cancellation sets status to `CANCELLED`.

**R3.7** If `expiresAt` is set and the current time exceeds it while the request is `APPROVED`, the engine shall automatically transition the request to `EXPIRED` and trigger any registered expiry handlers (e.g. score re-lock).

**R3.8** Approval requests shall be scoped to a school (multi-tenant safe). A user from School A shall never see or act on requests from School B.

---

### R4 — Score Unlock (First Implementation)

**R4.1** When a teacher attempts to edit a score that is in `LOCKED` status, the UI shall present a prompt: "Scores are locked. Request Unlock?" with a single "Request Unlock" button. No reason/comment shall be required from the teacher.

**R4.2** Clicking "Request Unlock" shall automatically capture and submit an approval request with the following metadata: `teacherId`, `classId`, `subjectId`, `assessmentId`, `assessmentType`, `term`, `academicYear`. No global unlock shall ever be triggered.

**R4.3** The approval request shall use the pre-seeded `SCORE_UNLOCK` workflow. If the workflow is inactive or misconfigured, the system shall return a clear error to the teacher rather than silently failing.

**R4.4** A teacher shall not be able to submit a duplicate unlock request for the same assessment while a `PENDING` or `APPROVED` request already exists.

**R4.5** Upon approval, the engine shall unlock only the specific assessment identified in the request metadata (specific class + subject + assessment). Global or grade-wide unlock shall be forbidden.

**R4.6** The unlock shall remain active for the duration configured in the `SCORE_UNLOCK` workflow's `relockAfterMinutes` field (options: 30, 60, 120 minutes, end-of-day, or custom). After expiry, scores shall automatically relock and the request status shall move to `EXPIRED`.

**R4.7** End-of-day expiry shall be interpreted as 23:59:59 on the calendar day the approval was granted, in the school's local timezone.

**R4.8** The existing `WorkflowService.unlockAssessment()` method shall be replaced by a call to the approval engine. Direct admin unlock (emergency) shall remain available but shall be routed through the engine as an `OVERRIDE` action for audit purposes.

---

### R5 — Notifications

**R5.1** The system shall reuse the existing `NotificationService` for all approval-related notifications. No new notification delivery infrastructure shall be created.

**R5.2** When an approval request is created, every resolved approver shall receive a `UserNotification` with `showAsPopup: true`, type `APPROVAL`, and a deep-link to the request detail view.

**R5.3** Online approvers shall receive the notification via the existing Socket.IO `notification:new` event in real time.

**R5.4** Offline approvers shall receive the notification as an unread DB record, surfaced on their next login via the existing `UserNotificationContext` fetch.

**R5.5** When a request is approved, the requester shall receive a notification: "Your [request type] request has been approved."

**R5.6** When a request is rejected, the requester shall receive a notification including the rejection comment if provided.

**R5.7** When a request expires (auto-relock), the requester shall receive a notification: "Your score unlock has expired. Scores have been re-locked."

**R5.8** Notification deep-links shall navigate directly to the relevant request in the approval module. Clicking a notification shall mark it as read.

**R5.9** The `NotificationType` enum shall be extended to include `APPROVAL` without breaking existing notification consumers.

---

### R6 — Approval Dashboard

**R6.1** An approval dashboard shall be accessible at School Settings → Approvals for users with `ADMIN`, `SUPER_ADMIN`, or `HEAD_TEACHER` roles.

**R6.2** The dashboard shall display summary KPI cards: Pending, Awaiting My Action, My Submitted Requests, Approved Today, Rejected Today.

**R6.3** The dashboard shall display a filterable list of all approval requests visible to the current user, with filters: Status (Pending / Approved / Rejected / Expired / Cancelled), Module, Date range.

**R6.4** Teachers shall access a limited view showing only their own submitted requests and statuses. They shall not see requests from other users.

**R6.5** Each request row shall display: status badge (color-coded per R9.2), request type, module, requester name, current approver, date created, and age.

**R6.6** Approvers shall be able to approve or reject a request directly from the list row without navigating to a detail view.

**R6.7** The dashboard shall include a workflow statistics section showing approval volumes and average processing time, filterable by module and date range.

---

### R7 — Workflow Management UI

**R7.1** ADMIN and SUPER_ADMIN users shall be able to create, view, edit, and deactivate approval workflows from School Settings → Approvals → Workflows.

**R7.2** The workflow form shall capture: name, module, request type, description, active toggle, approval mode (Single / Sequential / Parallel), minimum approvals, and relock duration (for applicable workflows).

**R7.3** The workflow form shall include an approver configuration section where steps are added with approver type (Role or User), selected roles/users, and minimum approvals per step.

**R7.4** The system shall prevent deletion of workflows that have associated approval requests. Deactivation shall be used instead.

**R7.5** Workflow changes shall be logged to `ChangeHistory` via the existing `auditService`.

---

### R8 — Approval History

**R8.1** The system shall maintain a full audit trail for every approval request using the existing `ChangeHistory` model for workflow-level events, and the new `ApprovalAction` model for per-approver actions.

**R8.2** The history view shall display: request creator, workflow used, all assigned approvers, each action taken (approve/reject/override), timestamps, comments, related records (e.g. assessment ID), and final outcome.

**R8.3** History shall be filterable by: module, requester, approver, workflow, status, and date range.

**R8.4** History records shall never be deleted or modified. They are append-only.

---

### R9 — Permissions

**R9.1** Role-based access shall be enforced using the existing `requireRole()` middleware. No new permission infrastructure shall be created.

| Action | Permitted Roles |
|--------|----------------|
| Configure workflows | SUPER_ADMIN, ADMIN |
| Configure approvers | SUPER_ADMIN, ADMIN |
| View all approvals (school) | SUPER_ADMIN, ADMIN, HEAD_TEACHER |
| Override any request | SUPER_ADMIN |
| Approve assigned requests | Any role listed as approver in the workflow step |
| Submit requests | Any authenticated user (module-specific) |
| View own requests | Any authenticated user |
| Cancel own request | Requester only |

**R9.2** A user can only approve a request if they are listed as a resolved approver for the current step. Being a HEAD_TEACHER does not automatically grant approval rights unless that role is configured in the workflow step.

---

### R10 — User Experience

**R10.1** Every approval request card/row shall display a color-coded status badge:
- Pending = Yellow (`#F59E0B`)
- Approved = Green (`#10B981`)
- Rejected = Red (`#EF4444`)
- Expired = Gray (`#6B7280`)
- Cancelled = Gray (`#9CA3AF`)
- Completed = Blue (`#3B82F6`)

**R10.2** Request cards shall show: status badge, current approver name, step progress indicator (e.g. "Step 1 of 2"), and date created.

**R10.3** The score unlock request flow shall require no more than a single button click from the teacher. No forms, no reason fields, no confirmation dialogs beyond the initial prompt.

**R10.4** Approval actions (Approve / Reject) shall be available inline and shall not require a full page navigation.

**R10.5** The system shall not degrade or alter the existing Parent Portal, Teacher Portal, Admin Dashboard, routing, or notification bell behavior.

---

### R11 — Technical Constraints

**R11.1** The approval engine shall be implemented as a new `ApprovalEngineService` that any module can call. Existing module services (fee, inventory, HR, etc.) shall integrate by calling this service, not by building their own workflow logic.

**R11.2** The database schema shall add three new models: `ApprovalWorkflow`, `ApprovalRequest`, `ApprovalAction`. No existing models shall be removed or have fields removed.

**R11.3** The auto-relock cron job shall integrate with the existing `cron-worker.ts` file rather than spawning a new process.

**R11.4** All new API routes shall follow the existing RESTful pattern under `/api/approvals/` and `/api/approval-workflows/`.

**R11.5** The `NotificationType` enum extension (`APPROVAL`) shall be additive only. Existing notification consumers that do not handle `APPROVAL` type shall continue to function.

**R11.6** School-level tenancy shall be enforced on all approval queries. The `schoolId` shall be derived from the existing `institutionContextResolver` middleware.

**R11.7** The frontend approval module shall be placed at `src/components/CBCGrading/pages/` following the existing page component pattern, and registered in the school settings navigation.
