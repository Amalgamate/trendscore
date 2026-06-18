# Design Document: Centralized Approval & Notification Engine

## Overview

This document describes the technical design for a centralized, module-agnostic Approval & Notification Engine built into TrendSCORE. The engine provides reusable approval workflow infrastructure that all modules (Academics, Finance, Fees, Accounting, HR, Inventory, Users) consume through a single `ApprovalEngineService`.

The design is intentionally additive — it introduces three new database models, one new service, two new route files, and a set of frontend components. Nothing existing is removed. Existing services (`NotificationService`, `auditService`, `WorkflowService`, Socket.IO, `requireRole` middleware) are reused directly.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend                                                                   │
│                                                                             │
│  Module UIs (Scores, Fees, HR…)  ──►  ApprovalRequestButton (shared)       │
│                                          │                                  │
│  School Settings → Approvals  ◄──────────┤                                 │
│    ├── ApprovalsPage (dashboard)          │                                 │
│    ├── WorkflowsPage (config)             │                                 │
│    └── ApprovalHistoryPage                │                                 │
│                                           ▼                                 │
│                                  approval.api.js  ──────────────────────►  │
└──────────────────────────────────────────────────────────────────────────── ┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend                                                                    │
│                                                                             │
│  /api/approvals/*  ──► approval.controller.ts                               │
│  /api/approval-workflows/*  ──► approvalWorkflow.controller.ts              │
│                                        │                                   │
│                                        ▼                                   │
│                           ApprovalEngineService                             │
│                                        │                                   │
│          ┌─────────────────────────────┤─────────────────────────────┐     │
│          ▼                             ▼                             ▼     │
│  NotificationService          auditService                  prisma DB     │
│  (existing — no changes)      (existing — no changes)                     │
│          │                                                                 │
│          ▼                                                                 │
│  Socket.IO (existing)  ──► user room  ──►  UserNotificationContext (FE)   │
│                                                                            │
│  cron-worker.ts  ──►  ApprovalEngineService.expireUnlocks()               │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Models (added to `schema.prisma`)

```prisma
// ── Approval Engine ────────────────────────────────────────────────────────

enum ApprovalModule {
  ACADEMICS
  FEES
  ACCOUNTING
  HR
  INVENTORY
  USERS
  GENERAL
}

enum ApprovalRequestType {
  SCORE_UNLOCK
  FEE_ADJUSTMENT
  FEE_WAIVER
  EXPENSE_APPROVAL
  BUDGET_APPROVAL
  PAYMENT_REVERSAL
  ROLE_CHANGE
  LEAVE_APPROVAL
  REPORT_PUBLISHING
  STOCK_ADJUSTMENT
}

enum ApprovalMode {
  SINGLE
  SEQUENTIAL
  PARALLEL
}

enum ApprovalStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  EXPIRED
  CANCELLED
  COMPLETED
}

enum ApprovalActionType {
  APPROVE
  REJECT
  OVERRIDE
  CANCEL
}

model ApprovalWorkflow {
  id                   String              @id @default(uuid())
  name                 String
  module               ApprovalModule
  requestType          ApprovalRequestType
  description          String?
  active               Boolean             @default(true)
  approvalMode         ApprovalMode        @default(SINGLE)
  minApprovals         Int                 @default(1)
  relockAfterMinutes   Int?                // null = no auto-expiry
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  steps                ApprovalStep[]
  requests             ApprovalRequest[]

  @@unique([module, requestType])
  @@index([module, active])
  @@map("approval_workflows")
}

model ApprovalStep {
  id               String           @id @default(uuid())
  workflowId       String
  stepNumber       Int
  approverType     String           // 'ROLE' | 'USER'
  approverRoles    String[]         @default([])   // UserRole values
  approverUserIds  String[]         @default([])   // User IDs
  minApprovals     Int              @default(1)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  workflow         ApprovalWorkflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@unique([workflowId, stepNumber])
  @@index([workflowId])
  @@map("approval_steps")
}

model ApprovalRequest {
  id                  String              @id @default(uuid())
  workflowId          String
  module              ApprovalModule
  requestType         ApprovalRequestType
  requestedById       String
  schoolId            String?             // tenancy scope
  status              ApprovalStatus      @default(PENDING)
  currentStepNumber   Int                 @default(1)
  resolvedApproverIds String[]            @default([])   // snapshot at submission time
  comments            String?
  metadata            Json                // module-specific payload
  expiresAt           DateTime?           // null = no auto-expiry
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  workflow            ApprovalWorkflow    @relation(fields: [workflowId], references: [id])
  requestedBy         User                @relation("ApprovalRequestor", fields: [requestedById], references: [id])
  actions             ApprovalAction[]

  @@index([status, schoolId])
  @@index([requestedById])
  @@index([module, requestType])
  @@index([expiresAt, status])
  @@map("approval_requests")
}

model ApprovalAction {
  id          String             @id @default(uuid())
  requestId   String
  stepNumber  Int
  approverId  String
  action      ApprovalActionType
  comment     String?
  actedAt     DateTime           @default(now())

  request     ApprovalRequest    @relation(fields: [requestId], references: [id], onDelete: Cascade)
  approver    User               @relation("ApprovalActioner", fields: [approverId], references: [id])

  @@index([requestId])
  @@index([approverId])
  @@map("approval_actions")
}
```

### Existing Model Changes

**`UserNotification`** — extend `NotificationType` enum to add `APPROVAL`:
```prisma
enum NotificationType {
  INFO
  SUCCESS
  WARNING
  ERROR
  WAIVER
  GIT_UPDATE
  APPROVAL    // ← new
}
```

**`User`** — add two new relations (back-references for the new models):
```prisma
approvalRequests   ApprovalRequest[]  @relation("ApprovalRequestor")
approvalActions    ApprovalAction[]   @relation("ApprovalActioner")
```

---

## Backend Components

### 1. `ApprovalEngineService` (`server/src/services/approvalEngine.service.ts`)

The single entry point for all approval operations. All other services call this.

```typescript
interface SubmitApprovalParams {
  workflowModule: ApprovalModule;
  requestType: ApprovalRequestType;
  requestedById: string;
  schoolId: string;
  metadata: Record<string, any>;   // module-specific (e.g. { assessmentId, classId, … })
  comments?: string;
}

interface ActOnApprovalParams {
  requestId: string;
  actorId: string;
  action: 'APPROVE' | 'REJECT' | 'OVERRIDE';
  comment?: string;
}

class ApprovalEngineService {
  // Submit a new approval request — returns the created ApprovalRequest
  async submitRequest(params: SubmitApprovalParams): Promise<ApprovalRequest>

  // Approve / reject / override — returns updated ApprovalRequest
  async actOnRequest(params: ActOnApprovalParams): Promise<ApprovalRequest>

  // Cancel own pending request
  async cancelRequest(requestId: string, userId: string): Promise<ApprovalRequest>

  // List requests visible to a user (role-scoped)
  async listRequests(filters: RequestFilters, userId: string): Promise<ApprovalRequest[]>

  // Get a single request (with actions)
  async getRequest(requestId: string, userId: string): Promise<ApprovalRequest>

  // Dashboard KPIs
  async getDashboardStats(userId: string, schoolId: string): Promise<DashboardStats>

  // Called by cron — expire approved requests past expiresAt and trigger handlers
  async processExpiredRequests(): Promise<void>

  // Private: resolve approvers for a workflow step
  private async resolveApprovers(step: ApprovalStep, schoolId: string): Promise<string[]>

  // Private: notify approvers of a new request
  private async notifyApprovers(request: ApprovalRequest, approverIds: string[]): Promise<void>

  // Private: notify requester of approval outcome
  private async notifyRequester(request: ApprovalRequest, action: string, comment?: string): Promise<void>

  // Private: run post-approval hooks (e.g. unlock scores)
  private async runApprovalHook(request: ApprovalRequest): Promise<void>

  // Private: run expiry hooks (e.g. re-lock scores)
  private async runExpiryHook(request: ApprovalRequest): Promise<void>
}
```

**Approval hook registry** — a static map from `ApprovalRequestType` to handler functions. Score unlock handler calls existing `WorkflowService.unlockAssessment()` internally:

```typescript
const APPROVAL_HOOKS: Record<ApprovalRequestType, (request: ApprovalRequest) => Promise<void>> = {
  SCORE_UNLOCK: scoreUnlockApprovalHandler,
  // others stubbed for future modules
};

const EXPIRY_HOOKS: Record<ApprovalRequestType, (request: ApprovalRequest) => Promise<void>> = {
  SCORE_UNLOCK: scoreRelockHandler,
};
```

### 2. Controllers

**`approval.controller.ts`** — handles CRUD for requests:
- `POST /api/approvals` — submit request
- `GET /api/approvals` — list (filtered)
- `GET /api/approvals/dashboard` — KPI stats
- `GET /api/approvals/:id` — single request
- `POST /api/approvals/:id/approve` — approve
- `POST /api/approvals/:id/reject` — reject
- `POST /api/approvals/:id/override` — SUPER_ADMIN override
- `POST /api/approvals/:id/cancel` — cancel own request
- `GET /api/approvals/history` — audit history

**`approvalWorkflow.controller.ts`** — handles workflow config:
- `GET /api/approval-workflows` — list all
- `POST /api/approval-workflows` — create
- `PUT /api/approval-workflows/:id` — update
- `PATCH /api/approval-workflows/:id/toggle` — activate/deactivate
- `GET /api/approval-workflows/:id/steps` — get steps
- `PUT /api/approval-workflows/:id/steps` — replace steps

### 3. Routes

**`approval.routes.ts`**:
```typescript
router.use(authenticate);
router.use(schoolContextMiddleware);

router.post('/',                  requireAnyRole(['TEACHER','ADMIN','SUPER_ADMIN',...]), submitRequest);
router.get('/',                   requireAnyRole(['ADMIN','SUPER_ADMIN','HEAD_TEACHER',...]), listRequests);
router.get('/dashboard',          requireAnyRole(['ADMIN','SUPER_ADMIN','HEAD_TEACHER']), getDashboard);
router.get('/my-requests',        listMyRequests);          // any authenticated user
router.get('/history',            requireAnyRole(['ADMIN','SUPER_ADMIN','HEAD_TEACHER']), getHistory);
router.get('/:id',                getRequest);
router.post('/:id/approve',       actOnRequest('APPROVE'));
router.post('/:id/reject',        actOnRequest('REJECT'));
router.post('/:id/override',      requireRole(['SUPER_ADMIN']), actOnRequest('OVERRIDE'));
router.post('/:id/cancel',        cancelRequest);
```

**`approvalWorkflow.routes.ts`**:
```typescript
router.use(authenticate);
router.use(requireRole(['ADMIN', 'SUPER_ADMIN']));

router.get('/',        listWorkflows);
router.post('/',       createWorkflow);
router.put('/:id',     updateWorkflow);
router.patch('/:id/toggle', toggleWorkflow);
router.get('/:id/steps',    getSteps);
router.put('/:id/steps',    updateSteps);
```

### 4. Cron Integration (`cron-worker.ts`)

Add to existing cron worker — runs every 5 minutes to expire unlocks:

```typescript
import { ApprovalEngineService } from './services/approvalEngine.service';
const approvalEngine = new ApprovalEngineService();

// Every 5 minutes — check for expired approval windows (score unlock, etc.)
cron.schedule('*/5 * * * *', () => {
  approvalEngine.processExpiredRequests().catch(err => {
    logger.error('[CRON] Approval expiry processing error:', err);
  });
});
```

### 5. Score Unlock Hook Integration

The existing `WorkflowService.unlockAssessment()` is retained for the emergency admin direct-unlock path, but teacher-initiated unlocks now flow through the engine:

```typescript
// scoreUnlockApprovalHandler — called when SCORE_UNLOCK request is APPROVED
async function scoreUnlockApprovalHandler(request: ApprovalRequest): Promise<void> {
  const { assessmentId, assessmentType } = request.metadata as ScoreUnlockMetadata;
  await workflowService.unlockAssessment({
    assessmentId,
    assessmentType,
    userId: request.requestedById,   // system acts on behalf of requester
    reason: `Approved via approval engine — request ${request.id}`
  });
}

// scoreRelockHandler — called when SCORE_UNLOCK request expires
async function scoreRelockHandler(request: ApprovalRequest): Promise<void> {
  const { assessmentId, assessmentType } = request.metadata as ScoreUnlockMetadata;
  await workflowService.lockAssessment({
    assessmentId,
    assessmentType,
    userId: 'SYSTEM',
    reason: `Auto-relock — approval window expired (request ${request.id})`
  });
}
```

### 6. `notifyRoles` Extension

`NotificationService.notifyRoles()` already accepts role arrays. The engine uses it with the `APPROVAL` type and `showAsPopup: true`:

```typescript
await NotificationService.createNotification({
  userId: approverId,
  title: 'New Approval Request',
  message: `New ${requestType} request from ${requesterName}`,
  type: NotificationType.APPROVAL,
  link: `/app/settings-approvals?requestId=${request.id}`,
  showAsPopup: true,
  metadata: { requestId: request.id, module, requestType }
});
```

---

## Frontend Components

### Directory Structure

```
src/components/CBCGrading/pages/
├── ApprovalsPage/
│   ├── index.jsx                     ← main dashboard page
│   ├── ApprovalDashboard.jsx         ← KPI cards + request list
│   ├── ApprovalRequestDetail.jsx     ← single request view + actions
│   ├── WorkflowsManager.jsx          ← workflow CRUD (admin)
│   ├── WorkflowForm.jsx              ← create/edit workflow + steps
│   ├── ApprovalHistoryPage.jsx       ← filtered history view
│   └── components/
│       ├── ApprovalStatusBadge.jsx   ← color-coded badge
│       ├── ApprovalRequestCard.jsx   ← list row with inline approve/reject
│       ├── ApproverStepVisualizer.jsx ← sequential/parallel step display
│       └── RequestMetadataPanel.jsx  ← renders module-specific metadata

src/components/shared/
└── ScoreUnlockPrompt.jsx             ← teacher one-click unlock dialog

src/services/api/
└── approval.api.js                   ← all approval API calls
```

### `approval.api.js`

```javascript
export const approvalAPI = {
  // Requests
  submit: (payload) => fetchWithAuth('/approvals', { method: 'POST', body: JSON.stringify(payload) }),
  list: (params) => fetchWithAuth(`/approvals?${new URLSearchParams(params)}`),
  myRequests: (params) => fetchWithAuth(`/approvals/my-requests?${new URLSearchParams(params)}`),
  dashboard: () => fetchWithAuth('/approvals/dashboard'),
  get: (id) => fetchWithAuth(`/approvals/${id}`),
  approve: (id, payload) => fetchWithAuth(`/approvals/${id}/approve`, { method: 'POST', body: JSON.stringify(payload) }),
  reject: (id, payload) => fetchWithAuth(`/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify(payload) }),
  override: (id, payload) => fetchWithAuth(`/approvals/${id}/override`, { method: 'POST', body: JSON.stringify(payload) }),
  cancel: (id) => fetchWithAuth(`/approvals/${id}/cancel`, { method: 'POST' }),
  history: (params) => fetchWithAuth(`/approvals/history?${new URLSearchParams(params)}`),
  // Workflows
  listWorkflows: () => fetchWithAuth('/approval-workflows'),
  createWorkflow: (payload) => fetchWithAuth('/approval-workflows', { method: 'POST', body: JSON.stringify(payload) }),
  updateWorkflow: (id, payload) => fetchWithAuth(`/approval-workflows/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  toggleWorkflow: (id) => fetchWithAuth(`/approval-workflows/${id}/toggle`, { method: 'PATCH' }),
  getWorkflowSteps: (id) => fetchWithAuth(`/approval-workflows/${id}/steps`),
  updateWorkflowSteps: (id, steps) => fetchWithAuth(`/approval-workflows/${id}/steps`, { method: 'PUT', body: JSON.stringify({ steps }) }),
};
```

### `ScoreUnlockPrompt.jsx`

Used inside score entry components when a teacher tries to edit a locked score:

```jsx
// Props: assessmentId, assessmentType, classId, subjectId, term, academicYear
// onUnlockGranted: callback — called when approval is APPROVED (via socket)
// onDismiss: close dialog without requesting

export function ScoreUnlockPrompt({ open, onDismiss, onUnlockGranted, context }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState(null);

  const handleRequest = async () => {
    setSubmitting(true);
    const result = await approvalAPI.submit({
      module: 'ACADEMICS',
      requestType: 'SCORE_UNLOCK',
      metadata: context
    });
    setRequestId(result.data.id);
    setSubmitted(true);
    setSubmitting(false);
  };

  // Listen for real-time approval via notification socket
  // When notification arrives with metadata.requestId === requestId and status === APPROVED,
  // call onUnlockGranted()

  return (
    <Dialog open={open} onClose={onDismiss}>
      {!submitted ? (
        <>
          <p>Scores are locked. Request Unlock?</p>
          <Button onClick={handleRequest} loading={submitting}>Request Unlock</Button>
          <Button variant="ghost" onClick={onDismiss}>Cancel</Button>
        </>
      ) : (
        <>
          <p>Unlock request sent. Waiting for approval...</p>
          <StatusBadge status="PENDING" />
        </>
      )}
    </Dialog>
  );
}
```

### `ApprovalStatusBadge.jsx`

```jsx
const STATUS_CONFIG = {
  PENDING:   { label: 'Pending',   color: '#F59E0B', bg: '#FEF3C7' },
  APPROVED:  { label: 'Approved',  color: '#10B981', bg: '#D1FAE5' },
  REJECTED:  { label: 'Rejected',  color: '#EF4444', bg: '#FEE2E2' },
  EXPIRED:   { label: 'Expired',   color: '#6B7280', bg: '#F3F4F6' },
  CANCELLED: { label: 'Cancelled', color: '#9CA3AF', bg: '#F9FAFB' },
  COMPLETED: { label: 'Completed', color: '#3B82F6', bg: '#DBEAFE' },
  DRAFT:     { label: 'Draft',     color: '#6B7280', bg: '#F3F4F6' },
};
```

### Navigation Registration

Add to the `settings` section in both `secondaryNav.js` and the primary nav config:

```javascript
{ id: 'settings-approvals', label: 'Approvals', path: 'settings-approvals', permission: 'SCHOOL_SETTINGS' }
```

Register the route inside `CBCGradingSystem.jsx` alongside other settings pages.

---

## Seed Data

A database seed (`server/prisma/seeders/approvalWorkflows.seed.ts`) creates the default `SCORE_UNLOCK` workflow:

```typescript
await prisma.approvalWorkflow.upsert({
  where: { module_requestType: { module: 'ACADEMICS', requestType: 'SCORE_UNLOCK' } },
  create: {
    name: 'Score Unlock',
    module: 'ACADEMICS',
    requestType: 'SCORE_UNLOCK',
    description: 'Approve teacher requests to temporarily unlock locked assessment scores',
    active: true,
    approvalMode: 'SINGLE',
    minApprovals: 1,
    relockAfterMinutes: 60,
    steps: {
      create: [{
        stepNumber: 1,
        approverType: 'ROLE',
        approverRoles: ['ADMIN', 'HEAD_TEACHER'],
        minApprovals: 1
      }]
    }
  },
  update: {}
});
```

---

## Migration

Single Prisma migration `add_approval_engine`:
1. Add `APPROVAL` to `NotificationType` enum
2. Create `ApprovalModule`, `ApprovalRequestType`, `ApprovalMode`, `ApprovalStatus`, `ApprovalActionType` enums
3. Create `approval_workflows`, `approval_steps`, `approval_requests`, `approval_actions` tables
4. Add FK relations back to `users` table

---

## Components and Interfaces

### Backend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `ApprovalEngineService` | `server/src/services/approvalEngine.service.ts` | All approval business logic, hook dispatch, notification dispatch |
| `approval.controller.ts` | `server/src/controllers/approval.controller.ts` | HTTP handlers for request CRUD and actions |
| `approvalWorkflow.controller.ts` | `server/src/controllers/approvalWorkflow.controller.ts` | HTTP handlers for workflow/step config |
| `approval.routes.ts` | `server/src/routes/approval.routes.ts` | Route registration under `/api/approvals` |
| `approvalWorkflow.routes.ts` | `server/src/routes/approvalWorkflow.routes.ts` | Route registration under `/api/approval-workflows` |
| Seed file | `server/prisma/seeders/approvalWorkflows.seed.ts` | Seeds default SCORE_UNLOCK workflow |
| Score Unlock Hook | Inside `approvalEngine.service.ts` | Calls existing `WorkflowService` on approval/expiry |
| Cron addition | `server/src/cron-worker.ts` | `*/5 * * * *` — processes expired approval windows |

### Frontend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `ApprovalsPage` | `src/components/CBCGrading/pages/ApprovalsPage/index.jsx` | Top-level approval module entry |
| `ApprovalDashboard` | `.../ApprovalDashboard.jsx` | KPI cards, filterable request list |
| `WorkflowsManager` | `.../WorkflowsManager.jsx` | Workflow CRUD UI for admins |
| `WorkflowForm` | `.../WorkflowForm.jsx` | Create/edit workflow + step builder |
| `ApprovalRequestDetail` | `.../ApprovalRequestDetail.jsx` | Single request detail with approve/reject |
| `ApprovalHistoryPage` | `.../ApprovalHistoryPage.jsx` | Audit history with filters |
| `ApprovalStatusBadge` | `.../components/ApprovalStatusBadge.jsx` | Color-coded status pill |
| `ApprovalRequestCard` | `.../components/ApprovalRequestCard.jsx` | List row with inline actions |
| `ApproverStepVisualizer` | `.../components/ApproverStepVisualizer.jsx` | Shows step progress visually |
| `ScoreUnlockPrompt` | `src/components/shared/ScoreUnlockPrompt.jsx` | Teacher one-click unlock dialog |
| `approval.api.js` | `src/services/api/approval.api.js` | All HTTP calls to the approval API |

### Key Interfaces

```typescript
// ApprovalEngineService public interface
interface SubmitApprovalParams {
  workflowModule: ApprovalModule;
  requestType: ApprovalRequestType;
  requestedById: string;
  schoolId: string;
  metadata: Record<string, any>;
  comments?: string;
}

interface ActOnApprovalParams {
  requestId: string;
  actorId: string;
  action: 'APPROVE' | 'REJECT' | 'OVERRIDE';
  comment?: string;
}

interface RequestFilters {
  status?: ApprovalStatus;
  module?: ApprovalModule;
  requestType?: ApprovalRequestType;
  requestedById?: string;
  approverId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  schoolId: string;
}

interface DashboardStats {
  pending: number;
  awaitingMyAction: number;
  mySubmitted: number;
  approvedToday: number;
  rejectedToday: number;
}

// Score Unlock metadata stored in ApprovalRequest.metadata
interface ScoreUnlockMetadata {
  assessmentId: string;
  assessmentType: 'formative' | 'summative';
  classId: string;
  subjectId: string;
  term: string;
  academicYear: number;
  teacherId: string;
}
```

---

## Data Models

### `ApprovalWorkflow`
Defines a reusable workflow configuration per module+requestType combination.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `name` | String | Human-readable, e.g. "Score Unlock" |
| `module` | ApprovalModule enum | ACADEMICS, FEES, etc. |
| `requestType` | ApprovalRequestType enum | SCORE_UNLOCK, FEE_ADJUSTMENT, etc. |
| `description` | String? | Optional description |
| `active` | Boolean | Default true |
| `approvalMode` | ApprovalMode enum | SINGLE, SEQUENTIAL, PARALLEL |
| `minApprovals` | Int | Default 1 |
| `relockAfterMinutes` | Int? | Null = no auto-expiry |
| `steps` | ApprovalStep[] | Relation |

### `ApprovalStep`
Defines who approves at each step of a workflow.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `workflowId` | String | FK → ApprovalWorkflow |
| `stepNumber` | Int | 1-based |
| `approverType` | String | 'ROLE' or 'USER' |
| `approverRoles` | String[] | Array of UserRole values |
| `approverUserIds` | String[] | Array of User IDs |
| `minApprovals` | Int | Default 1 |

### `ApprovalRequest`
A single approval request submitted by any module.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `workflowId` | String | FK → ApprovalWorkflow |
| `module` | ApprovalModule enum | Denormalized for query efficiency |
| `requestType` | ApprovalRequestType enum | Denormalized |
| `requestedById` | String | FK → User |
| `schoolId` | String? | Tenancy scope |
| `status` | ApprovalStatus enum | DRAFT/PENDING/APPROVED/etc. |
| `currentStepNumber` | Int | Which step is active |
| `resolvedApproverIds` | String[] | Snapshot of approver user IDs at submission |
| `comments` | String? | Requester notes |
| `metadata` | Json | Module-specific payload (e.g. ScoreUnlockMetadata) |
| `expiresAt` | DateTime? | Auto-computed from relockAfterMinutes |
| `actions` | ApprovalAction[] | Relation |

### `ApprovalAction`
Records every approve/reject/override action taken on a request.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `requestId` | String | FK → ApprovalRequest |
| `stepNumber` | Int | Which step the action was on |
| `approverId` | String | FK → User |
| `action` | ApprovalActionType enum | APPROVE/REJECT/OVERRIDE/CANCEL |
| `comment` | String? | Optional comment |
| `actedAt` | DateTime | When the action was taken |

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| No active workflow for module+requestType | Return 422 with `"No active workflow configured for SCORE_UNLOCK"` |
| Duplicate pending request (same assessment) | Return 409 with `"An open unlock request already exists for this assessment"` |
| Approver not in resolved approver list | Return 403 with `"You are not an assigned approver for this request"` |
| Request already in terminal state | Return 409 with current status in message |
| Workflow has no steps configured | Return 422 with `"Workflow has no approver steps configured"` |
| `NotificationService` fails | Log warning, do not fail the main operation — notifications are non-blocking |
| `auditService` fails | Log warning, do not fail the main operation — audit is best-effort |
| Score unlock hook fails | Return 500, mark request as APPROVED but log hook failure for manual remediation |
| Cron expiry fails on one request | Log error for that request, continue processing remaining expired requests |

All error responses follow the existing pattern: `{ success: false, message: string, code?: string }`.

---

## Correctness Properties

Property 1: A request can only be approved by a user whose ID appears in `resolvedApproverIds` for the current step, or by a `SUPER_ADMIN` via override. **Validates: Requirements R3.3, R9.2**

Property 2: A request in a terminal state (`APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`) cannot be acted on further. **Validates: Requirements R3.3, R3.4, R3.7**

Property 3: Score unlock never affects more than the specific `assessmentId` stored in `metadata` — global unlock is structurally impossible through the engine. **Validates: Requirements R4.5**

Property 4: `schoolId` is always present on request queries — cross-school data leakage is structurally impossible via the query layer. **Validates: Requirements R3.8**

Property 5: `resolvedApproverIds` is a snapshot taken at submission time; changing user roles after submission does not alter who can approve an in-flight request. **Validates: Requirements R2.5, R8.4**

Property 6: The `APPROVAL` notification type addition is backward-compatible — existing notification consumers that do not handle `APPROVAL` fall through to default behavior without error. **Validates: Requirements R5.9, R11.5**

---

## Testing Strategy

- **Unit tests**: `ApprovalEngineService` — test each state transition, hook dispatch, duplicate detection, and approver validation with mocked Prisma.
- **Integration tests**: Full request lifecycle (submit → approve → hook fires → notify) with a test database.
- **Route tests**: All controllers tested with `supertest` — auth guards, role checks, and response shapes.
- **Cron test**: Mock `Date.now()` to simulate expiry; verify `processExpiredRequests()` transitions status and fires relock hook.
- **Frontend**: `ScoreUnlockPrompt` renders correctly, submits to API, shows pending state after submission.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Three new models, not re-use of `PathwayApproval` | `PathwayApproval` is module-specific; a generic engine needs its own schema |
| Reuse `NotificationService` as-is | It already covers DB, Socket.IO, Web Push, popup — no new infrastructure needed |
| `schoolId` on `ApprovalRequest` | Multi-tenant safety; all queries filter by school derived from middleware |
| Hook registry pattern | Decouples the engine from module business logic; new modules register their own hooks |
| `resolvedApproverIds` snapshot | Captures who was an approver at submission time for audit purposes, even if roles change later |
| No deletion of `WorkflowService` | It handles the assessment workflow state machine; the engine handles approvals of unlock requests and delegates execution back to `WorkflowService` |
| Cron every 5 minutes | Score unlock windows (30m minimum) — 5 min polling gives ≤5 min relock delay. Acceptable trade-off vs. maintaining timers in memory |
