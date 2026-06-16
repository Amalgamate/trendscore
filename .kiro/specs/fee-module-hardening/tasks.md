# Implementation Plan

## Overview

Hardens the TrendSCORE fee module by replacing race-prone aggregate-MAX sequence numbering with a database-safe `FeeNumberSequence` table, splitting the monolithic `fee.controller.ts` into focused controllers, enforcing parent isolation on invoice queries, adding audit trails for manual amount edits, adding a challenge-token gate on the reset-all endpoint, and wiring an async CSV export job.

## Task Dependency Graph

```json
{
  "waves": [
    ["1"],
    ["2"],
    ["3"],
    ["4"],
    ["5", "6", "7", "8"],
    ["9"],
    ["10"]
  ]
}
```

## Tasks

- [ ] 1. Add FeeNumberSequence, ResetChallenge, and FeeExportJob to Prisma schema
  - [ ] 1.1 Add `FeeNumberSequence` model to `server/prisma/schema.prisma` with fields: `id`, `type` (String), `year` (Int), `nextVal` (Int @default(1)), `updatedAt`; unique constraint on `[type, year]`; map to `fee_number_sequences`
  - [ ] 1.2 Add `ResetChallenge` model to `server/prisma/schema.prisma` with fields: `id`, `token` (String @unique), `userId`, `ipAddress`, `expiresAt`, `consumed` (Boolean @default(false)), `createdAt`; map to `reset_challenges`
  - [ ] 1.3 Add `FeeExportJob` model to `server/prisma/schema.prisma` with fields: `id`, `status` (String @default("QUEUED")), `filters` (Json), `filePath` (String?), `downloadUrl` (String?), `errorMessage` (String?), `requestedBy`, `institutionScope` (String?), `createdAt`, `updatedAt`, `expiresAt` (DateTime?); index on `[status]`; map to `fee_export_jobs`
  - [ ] 1.4 Run `npx prisma migrate dev --name fee_hardening_sequences_jobs` in `server/` to create the migration and regenerate the Prisma client

- [ ] 2. Implement database-safe sequence number generation in fee.service.ts
  - Depends on: Task 1
  - [ ] 2.1 Remove the duplicate `getNextInvoiceNumber` and `createInvoiceWithSafeNumber` helper functions from `server/src/services/fee.service.ts`
  - [ ] 2.2 Add exported `generateInvoiceNumber(academicYear: number, tx?: any): Promise<string>` to `fee.service.ts` — upserts a `FeeNumberSequence` row for `{type: 'INVOICE', year: academicYear}` using `prisma.$transaction` + raw `UPDATE ... SET nextVal = nextVal + 1 RETURNING nextVal` (or Prisma update + increment within a serializable transaction), formats as `INV-{year}-{6-digit-padded}`
  - [ ] 2.3 Add exported `generateReceiptNumber(tx?: any): Promise<string>` to `fee.service.ts` — same mechanism for `{type: 'RECEIPT', year: currentYear}`, formats as `RCP-{year}-{6-digit-padded}`
  - [ ] 2.4 Update `FeeService.generateInvoiceForLearner()` in `fee.service.ts` to call `generateInvoiceNumber()` directly instead of using the removed `createInvoiceWithSafeNumber`

- [ ] 3. Replace aggregate-max numbering in fee.controller.ts with sequence helpers
  - Depends on: Task 2
  - [ ] 3.1 Remove the `getNextInvoiceNumber`, `createInvoiceWithSafeNumber`, `parseInvoiceNumber`, `INVOICE_NUMBER_RETRY_COUNT`, and `RECEIPT_NUMBER_RETRY_COUNT` declarations from the top of `server/src/controllers/fee.controller.ts`
  - [ ] 3.2 Import `generateInvoiceNumber` and `generateReceiptNumber` from `fee.service.ts` in `fee.controller.ts`
  - [ ] 3.3 Update `createInvoice()` method to call `generateInvoiceNumber(academicYear, tx)` inside the transaction instead of `createInvoiceWithSafeNumber`
  - [ ] 3.4 Update `bulkGenerateInvoices()` method to call `generateInvoiceNumber()` per invoice inside the transaction loop
  - [ ] 3.5 Update `recordPayment()` method to call `generateReceiptNumber(tx)` inside the transaction instead of the aggregate-max + retry loop
  - [ ] 3.6 Remove all `RECEIPT_NUMBER_RETRY_COUNT` retry loops from `recordPayment()`; errors are now thrown immediately (no retry needed)

- [ ] 4. Split fee.controller.ts into focused controllers
  - Depends on: Task 3
  - [ ] 4.1 Create `server/src/services/feeInvoice.service.ts` exporting shared helpers: `normalizeEnumValue()`, `getPreviousTermContext()`, `applyInvoiceInstitutionScope()`, `getInstitutionType()`
  - [ ] 4.2 Create `server/src/controllers/feeStructure.controller.ts` containing `FeeStructureController` class with methods: `getAllFeeStructures`, `createFeeStructure`, `updateFeeStructure`, `deleteFeeStructure` — extracted from `fee.controller.ts` verbatim; import shared helpers from `feeInvoice.service.ts`
  - [ ] 4.3 Create `server/src/controllers/feeInvoice.controller.ts` containing `FeeInvoiceController` class with methods: `getAllInvoices`, `getInvoiceAggregates`, `getLearnerInvoices`, `createInvoice`, `updateInvoice`, `reviseInvoiceFromConfiguration`, `cancelInvoice`, `bulkGenerateInvoices`, `resetInvoices`, `sendInvoiceReminder`, `bulkSendReminders` — extracted from `fee.controller.ts`
  - [ ] 4.4 Create `server/src/controllers/feePayment.controller.ts` containing `FeePaymentController` class with methods: `recordPayment`, `reversePayment`, `getPaymentStats` — extracted from `fee.controller.ts`
  - [ ] 4.5 Create `server/src/controllers/feeMaintenance.controller.ts` containing `FeeMaintenanceController` class with stub methods `resetAllAccounting` and `resetChallenge` (to be hardened in Task 7); extract existing `resetAllAccounting` logic here
  - [ ] 4.6 Update `server/src/routes/fee.routes.ts` to import from the four new controllers; remove import of `FeeController` from `fee.controller.ts`
  - [ ] 4.7 Replace `server/src/controllers/fee.controller.ts` content with re-export shim: `export { FeeStructureController as FeeController } from './feeStructure.controller'` plus named re-exports of all new controllers, preserving backwards compatibility for any other imports
  - [ ] 4.8 Run `npx tsc --noEmit` in `server/` to verify no TypeScript errors

- [ ] 5. Restrict limit=all and enforce parent isolation in getAllInvoices
  - Depends on: Task 4
  - [ ] 5.1 In `feeInvoice.controller.ts` `getAllInvoices()`: replace the `limitParam === 'all' ? undefined : ...` branch with: if `limitParam === 'all'` throw `ApiError(400, "limit=all is not supported. Use GET /api/fees/invoices/aggregates for totals.")`
  - [ ] 5.2 In `feeInvoice.controller.ts` `getAllInvoices()`: add parent isolation guard — if `req.user!.role === 'PARENT'` and no `learnerId` query param, throw `ApiError(400, 'Specify a learnerId to view invoices as a parent user')`
  - [ ] 5.3 Add `assertParentOwnership(userId: string, learnerId: string): Promise<void>` helper to `feeInvoice.service.ts` — queries `prisma.learner.findUnique`, checks `parentId === userId`, throws `ApiError(403, ...)` if not
  - [ ] 5.4 In `feeInvoice.controller.ts` `getAllInvoices()`: if `role === 'PARENT'` and `learnerId` provided, call `assertParentOwnership(userId, learnerId)` before executing the query
  - [ ] 5.5 In `feeInvoice.controller.ts` `getLearnerInvoices()`: ensure the existing `parentId` check calls the same `assertParentOwnership` helper (refactor to reuse)
  - [ ] 5.6 In `feeInvoice.controller.ts` `getInvoiceAggregates()`: add same parent guard — require `learnerId` for PARENT role and call `assertParentOwnership`

- [ ] 6. Make manual totalAmount edits create FeeInvoiceRevision records
  - Depends on: Task 4
  - [ ] 6.1 Update `updateInvoiceSchema` in `fee.routes.ts` to add `reason: z.string().min(1).optional()` and a `.refine()` that requires `reason` when `totalAmount` is provided
  - [ ] 6.2 In `feeInvoice.controller.ts` `updateInvoice()`: if `totalAmount` is being changed and `invoice.status === 'CANCELLED'`, throw `ApiError(400, 'Cannot edit totalAmount on a cancelled invoice')`
  - [ ] 6.3 In `feeInvoice.controller.ts` `updateInvoice()`: when `totalAmount` is being changed, wrap all DB writes in a `prisma.$transaction`: (a) create `FeeInvoiceRevision` with `previousSnapshot = JSON.stringify(current invoice)`, `revisedSnapshot = JSON.stringify({...invoice, totalAmount: newTotal})`, `reason`, `revisionNumber = invoice.revisionNumber + 1`, `revisedById = userId`; (b) update `FeeInvoice` with new `totalAmount`, `balance`, incremented `revisionNumber`
  - [ ] 6.4 Ensure `updateInvoice()` only creates the revision record when `totalAmount` actually changes (not when only `dueDate` is updated)

- [ ] 7. Harden the reset-all accounting endpoint
  - Depends on: Task 4, Task 1
  - [ ] 7.1 Add `POST /api/fees/maintenance/reset-all/challenge` route to `fee.routes.ts` wired to `feeMaintenanceController.resetChallenge`, guarded by `requireRole(['SUPER_ADMIN'])` and rate limit of 1/10min per IP
  - [ ] 7.2 Implement `resetChallenge()` in `feeMaintenance.controller.ts`: generate a UUID token, insert `ResetChallenge` row with `userId`, `ipAddress` (from `req.ip`), `expiresAt = now + 5min`, `consumed = false`; write an `AuditLog` entry; return `{ challengeToken, expiresAt }`
  - [ ] 7.3 Update `resetAllAccounting()` in `feeMaintenance.controller.ts`: require request body `{ confirmToken: 'RESET_ALL_ACCOUNTING_CONFIRMED', challengeToken: '<uuid>' }`; look up the `ResetChallenge` row; verify not consumed, not expired, same `userId`, same `ipAddress`; throw `ApiError(400, ...)` on any mismatch
  - [ ] 7.4 On successful verification in `resetAllAccounting()`: mark `ResetChallenge.consumed = true`, execute the deletion transaction (existing logic), write two `AuditLog` entries (action = `TOTAL_ACCOUNTING_RESET` with userId/IP/timestamp, and a second with deletion counts per model)
  - [ ] 7.5 Update the rate limit on `POST /api/fees/maintenance/reset-all` in `fee.routes.ts` to `windowMs: 600_000, maxRequests: 1` (1 per 10 minutes per IP)

- [ ] 8. Implement async export job for large fee reports
  - Depends on: Task 1, Task 4
  - [ ] 8.1 Create `server/src/controllers/feeExport.controller.ts` with `FeeExportController` class
  - [ ] 8.2 Implement `enqueueExport(req, res)` method: create a `FeeExportJob` row with `status = 'QUEUED'`, `filters = req.query`, `requestedBy = userId`, `institutionScope`; respond HTTP 202 with `{ jobId, status: 'QUEUED', pollUrl: /api/fees/invoices/export/${job.id} }`; call `setImmediate(() => runExportJob(job.id))`
  - [ ] 8.3 Implement private `runExportJob(jobId: string)` function in `feeExport.controller.ts`: update status to `PROCESSING`; build Prisma `where` clause from stored filters; stream in batches of 1 000 rows using `skip`/`take`; write CSV to `/tmp/fee-exports/${jobId}.csv`; update job to `COMPLETE` with `filePath`, `downloadUrl = /api/fees/invoices/export/${jobId}/download`, `expiresAt = now + 30min`; on any error update job to `FAILED` with `errorMessage`
  - [ ] 8.4 Implement `getExportJobStatus(req, res)` method: find `FeeExportJob` by `:jobId`; return `{ jobId, status, downloadUrl?, errorMessage?, expiresAt? }`; HTTP 404 if not found
  - [ ] 8.5 Implement `downloadExport(req, res)` method: verify job is `COMPLETE` and `expiresAt > now`; stream file from `filePath` with `Content-Disposition: attachment` and `Content-Type: text/csv`; HTTP 410 if expired
  - [ ] 8.6 Add a `setTimeout`-based watchdog in `runExportJob()`: if a job remains in `PROCESSING` for more than 5 minutes, mark it `FAILED`
  - [ ] 8.7 Add routes to `fee.routes.ts`: replace `GET /invoices/export` with `POST /invoices/export` → `feeExportController.enqueueExport`; `GET /invoices/export/:jobId` → `feeExportController.getExportJobStatus`; `GET /invoices/export/:jobId/download` → `feeExportController.downloadExport`
  - [ ] 8.8 Ensure the export enforces authentication and institution scope (same roles as the old export endpoint: `requirePermission('FEE_MANAGEMENT')`)

- [ ] 9. Write full test suite for payment flows
  - Depends on: Task 3, Task 5, Task 6
  - [ ] 9.1 Create `server/src/__tests__/fee.payments.spec.ts` — mock `prisma` via `jest.spyOn`; test partial payment (PENDING → PARTIAL when `paidAmount < totalAmount`)
  - [ ] 9.2 Add test for full payment: payment exactly settles remaining balance → invoice status becomes `PAID`
  - [ ] 9.3 Add test for overpayment: payment exceeds `totalAmount` → status `OVERPAID`, credit balance is positive
  - [ ] 9.4 Add test for waiver flow: approved waiver reduces effective balance; combined with payment that settles remainder → PAID
  - [ ] 9.5 Add test for sponsor payment: `payerType = 'SPONSOR'` decrements `sponsorBalance` only; student `balance` unchanged
  - [ ] 9.6 Add test for payment reversal: archiving a `FeePayment` via reversal endpoint increments invoice balance by reversed amount, recalculates status
  - [ ] 9.7 Add test for sequential payments: two payments on same invoice — assert running `balance` decreases correctly after each
  - [ ] 9.8 Add property-based test (parameterized loop over amounts in `[0.01 ... totalAmount * 2]`) asserting `paidAmount + balance === originalTotalAmount` after allocation (allocation invariant)
  - [ ] 9.9 Create `server/src/__tests__/fee.sequence.spec.ts` — test that concurrent calls to `generateInvoiceNumber` for the same `academicYear` (using mocked Prisma update-increment) always return unique values
  - [ ] 9.10 Create `server/src/__tests__/fee.parentIsolation.spec.ts` — test: Parent A cannot GET invoices for Parent B's learner (HTTP 403); Parent without learnerId param gets HTTP 400
  - [ ] 9.11 Create `server/src/__tests__/fee.revision.spec.ts` — test: editing `totalAmount` creates one `FeeInvoiceRevision` row with correct before/after and incremented `revisionNumber`; editing only `dueDate` does NOT create a revision; editing cancelled invoice returns 400
  - [ ] 9.12 Create `server/src/__tests__/fee.export.spec.ts` — test: POST export returns 202 with jobId; GET export/:jobId returns QUEUED status; after job runs returns COMPLETE with downloadUrl
  - [ ] 9.13 Run `npm test` in `server/` and confirm all new tests pass; fix any failures

- [ ] 10. Final integration check
  - Depends on: Tasks 1-9
  - [ ] 10.1 Run `npx tsc --noEmit` in `server/` — resolve all TypeScript errors
  - [ ] 10.2 Run `npm test` in `server/` — confirm full test suite passes with no regressions
  - [ ] 10.3 Verify that all existing fee routes still respond at the same URL paths by reviewing `fee.routes.ts` against the pre-refactor route list
  - [ ] 10.4 Confirm `limit=all` on `GET /api/fees/invoices` now returns HTTP 400
  - [ ] 10.5 Confirm `POST /api/fees/maintenance/reset-all` without a valid `challengeToken` returns HTTP 400

## Notes

- Tasks 7 and 8 both depend on Task 1 (for the new Prisma models) and Task 4 (for the split controllers), so they can be worked in parallel after Task 4 completes.
- Task 9 can begin after Tasks 3, 5, and 6 are complete; it does not need Tasks 7 or 8 to be finished.
- The Prisma migration in Task 1.4 must run before any code that references the new models is deployed.
- The `fee.controller.ts` re-export shim (Task 4.7) ensures any external code importing `FeeController` keeps working without changes.
