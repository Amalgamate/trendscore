# Design Document: Fee Module Hardening

## Overview

This document describes the implementation design for eight targeted hardening improvements to TrendSCORE's fee/finance module. The changes address reliability (sequence numbering), security (parent isolation, reset guards), scalability (pagination, async export), testability (full test coverage), auditability (revision records), and maintainability (controller split).

---

## Current State Analysis

### Files Being Modified

| File | Current Role | Problem |
|------|-------------|---------|
| `server/src/controllers/fee.controller.ts` | ~1 800-line monolith, 22 methods | Violates SRP; hard to test |
| `server/src/services/fee.service.ts` | Duplicate `getNextInvoiceNumber` | Race-condition max-aggregate pattern |
| `server/src/routes/fee.routes.ts` | All fee routes | Needs new reset-challenge + export-job routes |
| `server/prisma/schema.prisma` | Data model | Needs `FeeNumberSequence` + `FeeExportJob` + `ResetChallenge` models |

### Key Existing Models Referenced

- `FeeInvoice` — has `revisionNumber Int @default(0)` and `revisions FeeInvoiceRevision[]`
- `FeeInvoiceRevision` — exists with `invoiceId`, `revisionNumber`, `reason`, `previousSnapshot`, `revisedSnapshot`, `revisedById`
- `FeePayment` — has `receiptNumber String @unique`
- No `FeeNumberSequence`, `FeeExportJob`, or `ResetChallenge` models yet

---

## Design Decisions

### 1 — Database-Safe Sequence Numbers

**Problem:** `SELECT MAX(invoiceNumber)` + increment is a classic TOCTOU race. Two concurrent requests both read max=42, both produce INV-2025-000043, second write fails with P2002.

**Solution:** Introduce a `FeeNumberSequence` table with a row per `(type, year)` key, updated with `UPDATE ... SET nextVal = nextVal + 1 RETURNING nextVal` inside a transaction. This is a row-level advisory lock pattern that works on any Prisma-supported DB without requiring PostgreSQL-specific `CREATE SEQUENCE` DDL.

```
model FeeNumberSequence {
  id        String   @id @default(uuid())
  type      String   // 'INVOICE' | 'RECEIPT'
  year      Int
  nextVal   Int      @default(1)
  updatedAt DateTime @updatedAt

  @@unique([type, year])
  @@map("fee_number_sequences")
}
```

**New helper in `fee.service.ts`:**

```typescript
export async function generateInvoiceNumber(academicYear: number, tx?: PrismaTransactionClient): Promise<string>
export async function generateReceiptNumber(tx?: PrismaTransactionClient): Promise<string>
```

Both helpers upsert the sequence row within a transaction and atomically increment `nextVal`. The old `getNextInvoiceNumber` / `createInvoiceWithSafeNumber` helpers are removed from both `fee.controller.ts` and `fee.service.ts`.

---

### 2 — Full Test Coverage

**Location:** `server/src/__tests__/fee.payments.spec.ts`

**Approach:** Pure unit tests using jest `spyOn` to mock `prisma` and `accountingService`. No database required, so tests run in CI without Postgres.

**Test scenarios:**
- Partial payment → PARTIAL status
- Full settlement → PAID status
- Overpayment → OVERPAID + positive credit
- Waiver reduces effective balance → PAID when combined with payment
- Sponsor payment decrements `sponsorBalance`, leaves student `balance` unchanged
- Payment reversal increments balance, recalculates status
- Sequential payments: running balance decreases correctly after each
- Allocation invariant: `paidAmount + balance === originalTotalAmount`
- Zero-amount payment → HTTP 400 (validated at route layer)

---

### 3 — Restrict `limit=all`

**Current code in `getAllInvoices`:**
```typescript
const limit = limitParam === 'all' ? undefined : Math.min(200, ...);
```

**Change:**
- `limit=all` → return HTTP 400 with message directing to `/aggregates`
- Default limit: 50
- Max limit: 200 (already enforced, preserve)
- Parent role without `learnerId` → HTTP 400

---

### 4 — Controller Split

**New file structure:**

```
server/src/controllers/
  fee.controller.ts          ← (deleted / reduced to re-export shim for backwards compat)
  feeStructure.controller.ts ← getAllFeeStructures, createFeeStructure, updateFeeStructure, deleteFeeStructure
  feeInvoice.controller.ts   ← getAllInvoices, getInvoiceAggregates, getLearnerInvoices, createInvoice,
                                updateInvoice, reviseInvoiceFromConfiguration, cancelInvoice,
                                bulkGenerateInvoices, resetInvoices, sendInvoiceReminder, bulkSendReminders
  feePayment.controller.ts   ← recordPayment, reversePayment, getPaymentStats
  feeExport.controller.ts    ← exportInvoices (now async), exportJobStatus
  feeMaintenance.controller.ts ← resetAllAccounting, resetChallenge
```

`fee.routes.ts` is updated to import from these new controllers. The old `fee.controller.ts` is replaced.

**Shared helpers** extracted into `server/src/services/feeInvoice.service.ts`:
- `generateInvoiceNumber()`
- `generateReceiptNumber()`
- `applyInvoiceInstitutionScope()`
- `normalizeEnumValue()`
- `getPreviousTermContext()`

---

### 5 — Harden Reset-All

**New schema models:**

```prisma
model ResetChallenge {
  id          String   @id @default(uuid())
  token       String   @unique
  userId      String
  ipAddress   String
  expiresAt   DateTime
  consumed    Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([token])
  @@map("reset_challenges")
}
```

**New routes:**
- `POST /api/fees/maintenance/reset-all/challenge` — issues a single-use token (5-minute TTL), logs userId + IP
- `POST /api/fees/maintenance/reset-all` — requires `{ confirmToken: 'RESET_ALL_ACCOUNTING_CONFIRMED', challengeToken: '<uuid>' }`, verifies same userId + IP, marks token consumed, executes deletion, writes audit log rows

**Rate limiting:** 1 req / 10 min per IP on both challenge and reset endpoints (already using `enhanced-rateLimit.middleware`).

---

### 6 — Invoice TotalAmount Revision Records

**Change to `updateInvoice()`:**

When `totalAmount` changes:
1. Read current invoice snapshot
2. Create `FeeInvoiceRevision` with `previousSnapshot`, `revisedSnapshot`, `reason` (required), incremented `revisionNumber`
3. Update invoice `totalAmount`, `balance`, `revisionNumber` — all in one `$transaction`
4. Reject if `reason` is missing or empty
5. Reject if invoice `status === 'CANCELLED'`

**Schema change to `updateInvoiceSchema` in `fee.routes.ts`:**
```typescript
const updateInvoiceSchema = z.object({
  dueDate: z.string().optional(),
  totalAmount: z.number().positive().optional(),
  reason: z.string().min(1).optional()
}).refine(
  (data) => data.dueDate !== undefined || data.totalAmount !== undefined,
  { message: 'Provide at least one field to update: dueDate or totalAmount' }
).refine(
  (data) => !(data.totalAmount !== undefined && !data.reason),
  { message: 'reason is required when changing totalAmount' }
);
```

---

### 7 — Parent Data Isolation

**Current:** `getLearnerInvoices` checks `parentId`. `getAllInvoices` does not check parent at all.

**Changes:**
1. `getAllInvoices` — if `role === 'PARENT'` and no `learnerId` param → HTTP 400
2. `getAllInvoices` — if `role === 'PARENT'` and `learnerId` param → verify learner's `parentId === userId`, else HTTP 403
3. Every fee endpoint accepting `learnerId` path/query param checks parent ownership if `role === 'PARENT'`
4. Parent cannot call `/invoices/aggregates` without a `learnerId` filter

Extracted helper:
```typescript
async function assertParentOwnership(userId: string, learnerId: string): Promise<void>
```
Throws `ApiError(403, ...)` if the learner's `parentId !== userId`.

---

### 8 — Async Export Job

**New schema model:**

```prisma
model FeeExportJob {
  id          String   @id @default(uuid())
  status      String   @default("QUEUED")   // QUEUED | PROCESSING | COMPLETE | FAILED
  filters     Json
  filePath    String?
  downloadUrl String?
  errorMessage String?
  requestedBy String
  institutionScope String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  expiresAt   DateTime?

  @@index([status])
  @@map("fee_export_jobs")
}
```

**Routes:**
- `POST /api/fees/invoices/export` → creates job row, returns `{ jobId, status: 'QUEUED', pollUrl }` HTTP 202
- `GET /api/fees/invoices/export/:jobId` → returns job status + `downloadUrl` when complete
- `GET /api/fees/invoices/export/:jobId/download` → streams file (if complete and not expired)

**Runner (`feeExport.controller.ts`):** Uses `setImmediate` to run in background. Processes in batches of 1 000 rows using `skip`/`take` cursor. Writes CSV to a temp directory (`/tmp/fee-exports/`). Sets `expiresAt = now + 30min`.

**Timeout:** A cron or `setTimeout` marks jobs still in `PROCESSING` after 5 minutes as `FAILED`.

---

## File Change Summary

| File | Action |
|------|--------|
| `server/prisma/schema.prisma` | Add `FeeNumberSequence`, `ResetChallenge`, `FeeExportJob` models |
| `server/prisma/migrations/...` | New migration for the three models |
| `server/src/services/fee.service.ts` | Add `generateInvoiceNumber`, `generateReceiptNumber`; remove old aggregate-max helpers |
| `server/src/services/feeInvoice.service.ts` | New — shared helpers: `applyInvoiceInstitutionScope`, `normalizeEnumValue`, `assertParentOwnership`, `getPreviousTermContext` |
| `server/src/controllers/fee.controller.ts` | Replace with re-export shim OR delete and update imports in routes |
| `server/src/controllers/feeStructure.controller.ts` | New — 4 methods from old FeeController |
| `server/src/controllers/feeInvoice.controller.ts` | New — invoice CRUD, bulk, cancel, remind methods |
| `server/src/controllers/feePayment.controller.ts` | New — recordPayment, reversePayment, getPaymentStats |
| `server/src/controllers/feeExport.controller.ts` | New — async export enqueue + status + download |
| `server/src/controllers/feeMaintenance.controller.ts` | New — resetAllAccounting (hardened) + challenge |
| `server/src/routes/fee.routes.ts` | Update imports; add challenge + export-job routes; add parent isolation; restrict limit=all |
| `server/src/__tests__/fee.payments.spec.ts` | New — full payment flow test suite |
| `server/src/__tests__/fee.sequence.spec.ts` | New — sequence uniqueness property test |
| `server/src/__tests__/fee.parentIsolation.spec.ts` | New — parent data isolation tests |
| `server/src/__tests__/fee.revision.spec.ts` | New — totalAmount revision record tests |
| `server/src/__tests__/fee.export.spec.ts` | New — async export job tests |

---

## Routing Compatibility

All existing URL paths are preserved exactly. New routes added:
- `POST /api/fees/maintenance/reset-all/challenge`
- `POST /api/fees/invoices/export` (changed from GET to POST for job submission)
- `GET /api/fees/invoices/export/:jobId`
- `GET /api/fees/invoices/export/:jobId/download`

The old `GET /api/fees/invoices/export` is removed (was streaming CSV synchronously).

---

## Testing Strategy

- All new unit tests use jest mocks for Prisma — no live DB required
- `fee.sequence.spec.ts` runs concurrent promise races against a mock to prove no duplicates
- Integration smoke tests leverage the existing Jest + supertest setup
- Each spec file is self-contained and matches the `server/src/__tests__/` naming convention
