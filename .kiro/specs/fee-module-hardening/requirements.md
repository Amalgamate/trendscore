# Requirements Document

## Introduction

The fee/finance module of TrendSCORE is operationally critical but carries several reliability, security, and maintainability risks that must be addressed before the platform scales to more schools. This feature covers eight targeted hardening improvements:

1. Replace aggregate-max invoice and receipt numbering with database-safe sequences.
2. Add full test coverage for all payment-processing flows.
3. Remove or restrict `limit=all` from normal invoice listing endpoints.
4. Split `fee.controller.ts` (~1 800 lines, 22 methods) into focused controllers and services.
5. Harden the `resetAllAccounting` endpoint with additional guards, confirmation, and audit logging.
6. Make manual `totalAmount` edits on an invoice create a `FeeInvoiceRevision` audit record.
7. Enforce parent-user data isolation across all fee endpoints.
8. Replace the synchronous `exportInvoices` CSV dump with an async background job.

---

## Glossary

- **FeeController**: The current monolithic controller at `server/src/controllers/fee.controller.ts`.
- **FeeInvoice**: The Prisma model `FeeInvoice` (table `fee_invoices`) representing a student fee invoice.
- **FeePayment**: The Prisma model `FeePayment` (table `fee_payments`) representing a payment against an invoice.
- **FeeInvoiceRevision**: The Prisma model `FeeInvoiceRevision` (table `fee_invoice_revisions`) storing point-in-time snapshots of invoice field changes.
- **InvoiceNumber**: The human-readable invoice reference string, e.g. `INV-2025-000042`, stored in `FeeInvoice.invoiceNumber`.
- **ReceiptNumber**: The human-readable receipt reference string, e.g. `RCP-2025-000042`, stored in `FeePayment.receiptNumber`.
- **DB_Sequence**: A PostgreSQL `SEQUENCE` object (or equivalent advisory-lock mechanism) that guarantees monotonic, gap-free, collision-free integer generation.
- **Aggregate-Max Pattern**: The current approach — `SELECT MAX(invoiceNumber)` then increment — which is vulnerable to race conditions under concurrent writes.
- **InvoiceListEndpoint**: The `GET /api/fees/invoices` route backed by `FeeController.getAllInvoices`.
- **ExportEndpoint**: The `GET /api/fees/invoices/export` route backed by `FeeController.exportInvoices`.
- **ExportJob**: An asynchronous background task (queue-based or `setImmediate`/worker) that generates a CSV or Excel file and stores it for download, decoupled from the HTTP request lifecycle.
- **ResetEndpoint**: The `POST /api/fees/maintenance/reset-all` route backed by `FeeController.resetAllAccounting`.
- **SUPER_ADMIN**: A `UserRole` value with the highest system privilege; required for destructive finance operations.
- **PARENT**: A `UserRole` value representing a student guardian with read-only access limited to their own children's records.
- **PaymentAllocation**: The process of distributing a received cash amount between tuition balance and transport balance on an invoice.
- **OverpaidInvoice**: An invoice where `paidAmount > totalAmount`, producing a credit balance.
- **WaivedInvoice**: An invoice that has one or more approved `FeeWaiver` records reducing the effective balance.
- **SponsorPayment**: A `FeePayment` with `payerType = 'SPONSOR'` applied to `sponsorBalance` rather than the student balance.
- **ReversedPayment**: A `FeePayment` with `archived = true` resulting from the reversal flow.
- **ConfirmToken**: A short string that must be submitted alongside a destructive request to prove explicit intent.

---

## Requirements

### Requirement 1: Database-Safe Invoice and Receipt Numbering

**User Story:** As a school finance administrator, I want invoice and receipt numbers to be unique and gap-free even when multiple staff members submit payments simultaneously, so that financial records are trustworthy and auditable.

#### Acceptance Criteria

1. THE System SHALL generate each `InvoiceNumber` using a `DB_Sequence` (PostgreSQL `SEQUENCE` or row-level locking) so that two concurrent invoice creation requests can never produce the same number.
2. THE System SHALL generate each `ReceiptNumber` using the same `DB_Sequence` mechanism so that two concurrent payment recording requests can never produce the same receipt number.
3. WHEN a `DB_Sequence`-based number generation call succeeds, THE System SHALL assign the resulting number without retrying, eliminating the current optimistic-retry loop.
4. THE System SHALL preserve the existing number format `INV-{year}-{6-digit-padded-sequence}` for invoice numbers and `RCP-{year}-{6-digit-padded-sequence}` for receipt numbers.
5. WHEN the sequence for a given `academicYear` does not yet exist, THE System SHALL initialise it automatically on first use.
6. THE Sequence_Generator SHALL be exercised by a property-based test that creates invoices and payments concurrently and asserts that all generated numbers are unique across all concurrent writes.

---

### Requirement 2: Full Test Coverage for Payment Processing Flows

**User Story:** As a developer on the TrendSCORE team, I want comprehensive automated tests for every payment-processing scenario, so that regressions in financial logic are caught before they reach production.

#### Acceptance Criteria

1. THE Test_Suite SHALL include unit or integration tests that cover the standard (partial) payment flow: recording a payment against a PENDING invoice moves it to PARTIAL status when `paidAmount < totalAmount`.
2. THE Test_Suite SHALL include tests that cover the full-payment flow: recording a payment that settles the remaining balance moves the invoice to PAID status.
3. THE Test_Suite SHALL include tests that cover the overpayment flow: recording a payment that exceeds `totalAmount` sets the invoice status to OVERPAID and produces a positive credit balance.
4. THE Test_Suite SHALL include tests that cover the waiver flow: an approved `FeeWaiver` reduces the effective balance and, when combined with payments that settle the remainder, sets the invoice to PAID.
5. THE Test_Suite SHALL include tests that cover the sponsor payment flow: a payment with `payerType = 'SPONSOR'` decrements `sponsorBalance` and leaves the student `balance` unchanged.
6. THE Test_Suite SHALL include tests that cover the reversal flow: archiving a `FeePayment` via the reversal endpoint increments the invoice balance by the reversed amount and recalculates invoice status.
7. WHEN a test records multiple sequential payments on the same invoice, THE Test_Suite SHALL assert that the running `balance` decreases correctly after each payment.
8. THE Test_Suite SHALL include a property-based test asserting that for any valid `amount` in `[0.01, totalAmount × 2]`, the resulting `paidAmount + balance` always equals the original `totalAmount` after allocation — the allocation invariant.
9. IF a payment amount of zero is submitted, THEN THE Payment_Recorder SHALL reject the request with HTTP 400 before writing any database record.

---

### Requirement 3: Restrict Unbounded Invoice Listing Queries

**User Story:** As a platform operator, I want the invoice listing endpoint to enforce a maximum page size, so that a single API call cannot load the entire invoice table and cause memory exhaustion or timeout.

#### Acceptance Criteria

1. THE InvoiceListEndpoint SHALL enforce a maximum `limit` of 200 records per request; requests with `limit` greater than 200 SHALL be silently capped to 200.
2. WHEN a request omits the `limit` parameter, THE InvoiceListEndpoint SHALL default to a limit of 50 records.
3. THE InvoiceListEndpoint SHALL reject requests with the query string `limit=all` with HTTP 400 and a descriptive error message.
4. WHERE a client requires aggregate totals without downloading invoice rows, THE System SHALL provide the existing `GET /api/fees/invoices/aggregates` endpoint as the designated alternative to `limit=all`.
5. THE ExportEndpoint SHALL not stream CSV data directly within an HTTP response handler; WHEN an export is requested, THE ExportEndpoint SHALL enqueue an `ExportJob` and return HTTP 202 with a job ID.
6. WHEN an `ExportJob` completes, THE ExportJob_Runner SHALL store the resulting file (CSV or Excel) and make a download URL available via a `GET /api/fees/invoices/export/:jobId` endpoint.
7. IF an `ExportJob` has not completed within 5 minutes, THEN THE ExportJob_Runner SHALL mark the job as FAILED and THE ExportEndpoint SHALL return an appropriate error when the job ID is polled.
8. THE ExportEndpoint SHALL enforce the same authentication and role requirements as the existing invoice-listing endpoint.

---

### Requirement 4: Split FeeController into Focused Controllers and Services

**User Story:** As a backend developer, I want the fee module code to be split into logically cohesive units, so that each file has a single responsibility and is easier to test, review, and maintain.

#### Acceptance Criteria

1. THE System SHALL introduce at least three separate controller files to replace the current monolithic `FeeController`, covering the domains: (a) fee structures, (b) invoice management, and (c) payment processing.
2. THE New_Controllers SHALL share no direct cross-controller method calls; shared logic SHALL be extracted into service functions or utility modules.
3. THE FeeService SHALL expose a reusable `generateInvoiceNumber(academicYear)` function consumed by all controllers and services that create invoices.
4. THE FeeService SHALL expose a reusable `generateReceiptNumber()` function consumed by all controllers and services that create payment records.
5. WHEN the refactoring is complete, THE System SHALL pass all existing fee-related e2e tests without modification.
6. THE New_Controllers SHALL each contain no more than 400 lines of TypeScript source code, excluding blank lines and comments.
7. THE All_Fee_Routes SHALL continue to be served from `fee.routes.ts` with identical URL paths and HTTP methods as before the refactoring.

---

### Requirement 5: Harden the Reset-All Accounting Endpoint

**User Story:** As a platform operator, I want the reset-all accounting endpoint to require multiple safeguards before executing, so that production financial data cannot be accidentally or maliciously wiped.

#### Acceptance Criteria

1. THE ResetEndpoint SHALL require the authenticated user to hold the `SUPER_ADMIN` role; requests from any other role SHALL be rejected with HTTP 403.
2. THE ResetEndpoint SHALL require two confirmation tokens in the request body: (a) a static token `RESET_ALL_ACCOUNTING_CONFIRMED` and (b) a time-based one-time token generated by a prior `POST /api/fees/maintenance/reset-all/challenge` step.
3. WHEN the challenge endpoint is called, THE System SHALL generate a single-use token valid for no more than 5 minutes and record the requesting `userId` and `ipAddress` in the audit log.
4. THE ResetEndpoint SHALL verify that the one-time token was issued to the same `userId` and `ipAddress` that is submitting the reset request.
5. WHEN the reset executes successfully, THE System SHALL write an `AuditLog` entry with `action = 'TOTAL_ACCOUNTING_RESET'`, the operator's `userId`, `ipAddress`, and a timestamp.
6. WHEN the reset executes successfully, THE System SHALL write an `AuditLog` entry listing the counts of every model that was deleted (invoices, payments, waivers, journal entries, expenses, payroll records, bank statements).
7. THE ResetEndpoint SHALL be protected by a rate limit of no more than 1 request per 10 minutes per IP address.
8. IF the one-time token has expired or has already been consumed, THEN THE ResetEndpoint SHALL reject the request with HTTP 400 and a clear expiry message, without executing any deletion.

---

### Requirement 6: Invoice TotalAmount Edits Must Create Revision Records

**User Story:** As an auditor, I want every manual change to an invoice's total amount to be recorded in the revision history, so that I can trace who changed what and why at any point in time.

#### Acceptance Criteria

1. WHEN the `PATCH /api/fees/invoices/:id` endpoint changes `totalAmount`, THE Invoice_Editor SHALL create a `FeeInvoiceRevision` record before applying the update.
2. THE FeeInvoiceRevision record SHALL contain: the previous `totalAmount`, the new `totalAmount`, the `userId` of the editor, a mandatory `reason` string, the current `revisionNumber` incremented by 1, and the full JSON snapshot of the invoice fields at the time of the change.
3. THE Invoice_Editor SHALL reject a `totalAmount` edit request that does not include a non-empty `reason` field, returning HTTP 400.
4. THE Invoice_Editor SHALL increment the `FeeInvoice.revisionNumber` field atomically in the same database transaction as the `FeeInvoiceRevision` creation and the `totalAmount` update.
5. WHEN the `dueDate` field is edited without changing `totalAmount`, THE Invoice_Editor SHALL NOT create a `FeeInvoiceRevision` record.
6. THE Test_Suite SHALL include a test that edits `totalAmount` on an invoice and then asserts that one `FeeInvoiceRevision` row exists for that invoice with the correct before/after values and incremented `revisionNumber`.
7. IF a `totalAmount` edit is attempted on an invoice with `status = 'CANCELLED'`, THEN THE Invoice_Editor SHALL reject the request with HTTP 400 before creating any revision record.

---

### Requirement 7: Parent User Data Isolation on Fee Endpoints

**User Story:** As a parent user, I want to be able to view fee records for my children only, so that one parent cannot access another family's financial information.

#### Acceptance Criteria

1. WHEN a user with `role = 'PARENT'` calls `GET /api/fees/invoices/learner/:learnerId`, THE Fee_API SHALL verify that the requested `learnerId` belongs to a `Learner` whose `parentId` equals the requesting user's `userId`; otherwise THE Fee_API SHALL return HTTP 403.
2. THE Fee_API SHALL enforce the same ownership check for any fee endpoint that accepts `learnerId` as a path parameter or query string when called by a `PARENT` role user.
3. WHEN a `PARENT` user calls `GET /api/fees/invoices` with a `learnerId` query parameter, THE InvoiceListEndpoint SHALL scope results to only the invoices belonging to that learner and SHALL reject the request with HTTP 403 if the learner is not the parent's child.
4. IF a `PARENT` user calls `GET /api/fees/invoices` without a `learnerId` query parameter, THEN THE InvoiceListEndpoint SHALL return HTTP 400 instructing the parent to specify a `learnerId`.
5. THE Fee_API SHALL not expose aggregate financial data across all learners to a `PARENT` role user at any endpoint.
6. THE Test_Suite SHALL include a test that creates two learners belonging to different parents, logs in as Parent A, and asserts HTTP 403 when Parent A attempts to retrieve invoices for Parent B's child.

---

### Requirement 8: Async Export Job for Large Fee Reports

**User Story:** As a finance officer, I want to request a fee report export and receive it as a downloadable file once it is ready, so that generating large exports does not time out or block the server.

#### Acceptance Criteria

1. WHEN a request is made to `POST /api/fees/invoices/export`, THE ExportEndpoint SHALL immediately return HTTP 202 with a JSON body containing `{ jobId, status: "QUEUED", pollUrl }` and SHALL not begin synchronous database queries within the request handler.
2. THE ExportJob_Runner SHALL process the export in a background context (e.g., `setImmediate`, worker thread, or queue consumer) and SHALL write the resulting CSV file to a temporary storage location accessible by the download endpoint.
3. WHEN the export contains more than 10 000 rows, THE ExportJob_Runner SHALL stream the data using database cursors or batched queries of at most 1 000 rows per database round-trip, so that peak memory usage does not scale with report size.
4. THE ExportJob SHALL support all existing filter parameters: `status`, `term`, `academicYear`, `grade`, `learnerId`.
5. WHEN the export job status is polled via `GET /api/fees/invoices/export/:jobId`, THE ExportJob_Status_Endpoint SHALL return one of: `QUEUED`, `PROCESSING`, `COMPLETE`, or `FAILED`.
6. WHEN the job status is `COMPLETE`, THE ExportJob_Status_Endpoint SHALL include a `downloadUrl` in the response that is valid for at least 30 minutes.
7. IF an `ExportJob` fails due to a database error, THEN THE ExportJob_Runner SHALL mark the job status as `FAILED`, persist the error message, and THE ExportJob_Status_Endpoint SHALL expose the error message in the response.
8. THE ExportJob_Runner SHALL enforce the same institution-scope filter as the inline export (i.e., primary/secondary/tertiary scoping) so that the exported data is consistent with what the user sees on the invoice list screen.
9. THE Test_Suite SHALL include a test that submits an export request and polls the status endpoint until the job reaches `COMPLETE` or `FAILED`, asserting that the final status is `COMPLETE` and that `downloadUrl` is present.
