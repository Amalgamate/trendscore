# Finance completion checklist

Goal: provide a reliable, auditable school-finance workflow from fee setup through payment, reconciliation, and reporting. This checklist is the completion gate; a screen or endpoint counts as complete only when its role scope, API behavior, notifications, and verification are covered.

## Agreed role/action policy

| Role | Fee information | Payments | Finance controls |
|---|---|---|---|
| Platform super admin | School-scoped global view | Record/resolve when acting in school context | Platform support; audit every impersonated/actioned change |
| School admin | All learners and school-wide reports | Record and review | Fee setup; approve refunds and adjustments |
| Head teacher | All learners and school-wide fee view | No routine cashier work | Approve refunds and adjustments; no journal/CoA control by default |
| Accountant | All learners and finance reports | Record, reconcile, submit refunds | Fee setup, expenses, vendors, journals, reports; cannot approve own request |
| Receptionist | Any learner selected for a cashier task; no global reports/exports | Record a payment for any learner | No fee setup, accounting, refund approval, or broad reporting |
| Teacher | Learners in assigned classes only | No financial mutations | Read-only fee information for assigned learners |
| Parent | Linked children/family members only | Pay linked child invoices through Daraja | May submit a refund request for own child; cannot approve |
| Student | No finance information by default | None | None |

Refund and fee-adjustment approvals are performed by school `ADMIN` or `HEAD_TEACHER`. The requester cannot approve their own request. Daraja is the only supported M-Pesa provider; IntaSend and other unused providers are to be retired after caller/configuration/data migration checks.

## 1. Access and audit

- [x] Encode the agreed role/action matrix in backend permissions and frontend navigation; focused permission/access tests are being added and remain a stage gate.
- [x] Align frontend navigation permissions with backend permissions for the covered finance routes.
- [x] Scope parent invoice and payment access to linked children; refund submissions verify the linked learner.
- [x] Restrict teacher fee queries to active learners in active assigned classes.
- [x] Allow receptionist search across learners for cashier tasks while hiding reports, exports, fee setup, accounting, and refund approval.
- [ ] Audit all mutations, actor, approver, reason, and before/after values; make high-risk actions maker-checker.
- [ ] Verify school context on all authenticated finance endpoints and prevent cross-school record access.

## 2. Fees and invoices

- [ ] Verify fee structures by grade, term, year, item, and active dates.
- [ ] Verify admission invoice generation, bulk generation, idempotency, carry-forward, and missing-configuration feedback.
- [x] Recheck active invoice eligibility inside a serializable, year-locked single/bulk generation transaction; cancelled and archived invoices no longer block re-issuance.
- [x] Add a database partial unique index for active learner/structure/term/year invoices with a non-destructive migration preflight; the local database currently has zero duplicate groups.
- [ ] Verify scholarships, bursaries, sponsorships, individual adjustments, approval, invoice revision, and revocation.
- [ ] Verify invoice correction, cancellation, archival, statements, balances, and ageing calculations.
- [ ] Make each UI action return a clear success/failure message and next step.

## 3. Payments and credits

- [ ] Support cash, M-Pesa, bank transfer, cheque, card, and other/manual references with controlled receipt numbering.
- [ ] Bind each STK attempt to its invoice, amount, phone, initiating user, school, and provider checkout ID.
- [ ] Make callbacks/status polling idempotent; validate provider amount, invoice, and receipt before posting.
- [x] Reject successful STK callbacks with missing receipt/amount or an amount mismatch; leave the transaction pending with review evidence.
- [x] Validate C2B confirmation transaction type and positive finite amount before learner matching; callback suite covers four rejected payload forms and one valid Pay Bill payload.
- [ ] Post each payment once to the fee ledger and accounting journal; test rollback and retry behavior.
- [x] Make fee payment and M-Pesa charge journal posting reuse receipt-keyed entries; duplicate STK callbacks retry missing ledger work without repeating the SMS receipt.
- [ ] Verify overpayment credit, sponsor payments, family/sibling allocation, payment reversal, and duplicate prevention.
- [ ] Generate a receipt and send a friendly in-app notification; record SMS/WhatsApp delivery separately from payment success.

## 4. Refunds and approvals

- [x] Add a finance UI for refund review, history, and status, plus a parent payment-history and refund-request flow scoped to linked children.
- [ ] Require reason, source payment, amount, method, and supporting reference; prevent duplicate/over-limit refunds.
- [ ] Separate requester from approver; do not assume platform super-admin is the school-level approver.
- [ ] On approval, reconcile invoice and ledger exactly once, initiate supported payout or mark manual processing, and track provider outcomes.
- [ ] Notify requester, finance approver, and parent at the correct stages without exposing confidential detail.

## 5. Expenses, suppliers, and accounting

- [ ] Verify vendor setup, expense capture, evidence/receipt attachment, payment account, and approval rules.
- [ ] Verify chart of accounts, journals, balanced entries, posting, reversals, and permissions.
- [ ] Ensure fee, payment, expense, refund, and adjustment events produce balanced and traceable journal entries.
- [ ] Verify cash/bank balances, receivables, payables, trial balance, income/expenditure, balance sheet, and report filters against known transactions.
- [ ] Distinguish operational school reporting from formal statutory/accountant-approved statements.

## 6. Reconciliation and reminders

- [ ] Verify CSV/statement imports, format errors, duplicate detection, match suggestions, manual matching, undo, and audit history.
- [ ] Show unmatched totals and clear next actions; reconcile provider settlement against bank statement, not only fee receipts.
- [ ] Verify reminder schedule, opt-out, quiet hours, duplicate suppression, delivery status, and communication history.
- [ ] Make provider configuration and delivery failures visible to authorized finance/admin users.

## 7. Experience and quality gates

- [ ] Keep finance navigation task-based and concise; make frequent actions easy on desktop and mobile/PWA.
- [ ] Use friendly, actionable notifications for saves, failures, approvals, payments, receipts, imports, and delivery outcomes.
- [ ] Add API/service tests for permission boundaries, ownership, idempotency, ledger balance, approval separation, and provider callbacks.
- [ ] Add UI tests for core finance paths and role-specific visibility.
- [ ] Run backend/frontend builds, focused tests, and API/UI reviews; the integrated code checks pass, but live role-by-role API/UI review remains open.
- [ ] Review and refactor duplicated/legacy finance paths only after their callers and data compatibility are mapped.

## Current first-pass findings

- Existing web/PWA surfaces: fee structures, invoices, payment recording, waivers, individual fee configuration, overpayment allocation, expenses, vendors, accounting, reconciliation, and reports.
- Existing backend: STK and callback handling, scheduled SMS reminders, refund service, statement matching, ledger posting, and approval primitives.
- Confirmed remaining risks: accounting/provider callbacks are still best-effort without a durable reconciliation queue; invoice creation, overpayment-credit, fee changes, expenses, and reports have not yet passed end-to-end API/UI acceptance. The M-Pesa initiation/status routes now check linked learner access, and a refund review UI plus parent refund-request UI now exist; both still require role-by-role runtime verification.
- Reconciliation audit (2026-11-11): the current `BankReconciliation` UI calls legacy `/accounting/bank-statements*` routes, while the more complete `/reconciliation/*` API is unused. The legacy response shape does not match the UI, statement account filtering is ignored, match suggestions return a differently named target, and CSV import is not wired. The richer service can partially commit imports, has race-prone duplicate matching, does not persist match target/type/actor/history, and cannot reliably undo. Permissions also disagree on who can finalize reconciliation. A focused canonicalization and transactional reconciliation stage is in progress.
- Recent implementation work: expense capture now validates active expense/payment accounts and creates the expense plus balanced posted journal entry atomically; focused expense tests pass (6). Overpayment credit now has positive-amount, family-link, balance-limit, serializable-update, and transport-subledger regression coverage. Fee-configuration approval now requires a pending item and a different approver; approved configurations are immutable, and approval/revocation revisions are being made atomic with tuition/transport ledger deltas. These changes remain subject to final integrated verification.
- Payment-to-ledger reliability implementation in progress (2026-11-11): manual payment recording and both single/bulk “mark paid” now create fee payment, invoice updates, journal posting, and applicable overpayment correction inside one serializable transaction. These paths normalize and validate the supported cash, M-Pesa, bank transfer, cheque, card, and other methods. M-Pesa callback posting remains receipt-idempotent and callback retries resume missing ledger legs; resolving an unmatched M-Pesa receipt now commits payment, invoice, overpayment credit, charge, and resolution status together. Refund approval now posts its reversal journal in the serializable transaction with the refund claim and invoice/payment corrections. The ledger (14), overpayment credit (19), refund (19), and M-Pesa callback (9) focused suites pass, and backend TypeScript passes. The original Jest heap failure was an infinite recursion in the ledger test's `$transaction` mock, now fixed by modeling a distinct transaction client.
- No live provider delivery, production-data reconciliation, full database restore, or statutory accounting certification is implied by code-level tests.
- Daraja-only cleanup removes unmounted IntaSend/KopoKopo routes/services and changes legacy provider configs to disabled Daraja setup via migration; schools with old provider credentials must re-enter Daraja credentials before M-Pesa collections resume.
- Verified 2026-11-11: integrated backend suites pass (9 suites / 99 tests), backend `tsc --noEmit` passes, Prisma validation/client generation pass, Vite production build passes, and `git diff --check` passes with only CRLF normalization warnings. Prisma validation still reports one existing `SetNull`/required-field warning. The local DB read-only duplicate-invoice check and advisory-lock query passed earlier; the new reconciliation migration has not been applied to a database. Vite also reports existing stale Browserslist data and oversized chunk warnings.
