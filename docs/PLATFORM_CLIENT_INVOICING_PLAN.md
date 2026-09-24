# TrendSCORE Client Invoicing Plan

**Status:** Customer/contract registry, quote-to-draft conversion, and a draft invoice PDF preview are implemented; final invoice issuance, delivery, payments, and eTIMS remain outstanding.
**Scope:** TrendSCORE billing its school customers for platform services, managed centrally from the platform admin console.

## Goal

An operator should be able to configure a school customer and its signed commercial terms once, then review or issue accurate invoices, email a PDF with a readable text message, record/reconcile payments, and see who is overdue. Recurring invoice creation should be automatic only after the workflow is proven safe. Follow the practical Odoo pattern: customer and contract records feed invoice creation, an issued invoice can be printed or emailed, payment is reconciled separately, and overdue follow-ups are tracked.

## Keep the two money flows separate

1. **Platform customer billing:** TrendSCORE invoices a school for TrendSCORE products/services. This is the feature planned here and belongs in the central control plane.
2. **School fee billing:** A school invoices parents/learners using its own tenant's `FeeInvoice` and `FeePayment` records. It remains in that school's tenant and settlement path. Do not reuse those invoices, account balances, or eTIMS flags for TrendSCORE customer billing.

The existing console pricing screen contained fixed sample tiers and invented revenue/renewal figures, with browser-only “paid” edits. Those are not a price book or accounting records. Keep the console free of prices and billing metrics until actual contract/invoice data exists.

## Operator experience

1. **Customer profile:** legal/customer name, billing and service addresses, billing contacts, preferred email, currency, payment terms, tax identifiers/classification where applicable, and status. Keep customer records distinct from technical tenant/domain records, linked by a stable tenant/customer key.
2. **Approved catalogue and contract:** products/services and versioned, approved prices; signed contract reference; selected items/quantities; billing frequency (monthly, termly, annual, or one-off); start/end/renewal dates; billing anchor; discount and tax configuration; payment terms; and invoice recipients. Never invent a default price during provisioning.
3. **Invoice register:** draft, issued, sent, partially paid, paid, overdue, credited/voided states; search by customer, invoice number, date, and status; customer ledger and aging view. Offer create draft, preview, approve/issue, download PDF, email, resend, record payment, and credit-note actions according to role.
4. **Invoice document/email:** render a PDF from a frozen issued-invoice snapshot (seller/buyer details, invoice number and dates, item description/quantity/unit price, discounts, tax breakdown, total, balance, terms, payment instructions, and applicable statutory details). Send with both plain-text and HTML email bodies, attach the PDF, log delivery attempts/errors, and support safe retry. SMS/WhatsApp should be an optional later short notice with a secure invoice link, not a substitute for the emailed document.
5. **Payment and reminders:** initially record bank/M-Pesa/manual payments and allocate them to invoices (including partial and unapplied amounts); reconcile to statements as available. Show due-date aging. Configure reminders before/after due date, attach or link outstanding invoices, retain a delivery/audit trail, and allow an operator to review exceptions. Do not claim a payment is settled without reconciliation evidence.

## Lifecycle and safeguards

- Contract schedule creates a **draft** for a period. A daily scheduler must be idempotent: a unique contract + billing-period key prevents duplicate invoices on retries.
- The operator reviews draft details and tax treatment, then issues/posts the invoice. Posted invoices are immutable; correct errors with a credit note/replacement rather than editing history.
- Assign invoice numbers from the central legal-entity sequence under accounting advice. Store a snapshot of customer, contract lines, prices, tax inputs, and totals at issue time so later edits do not rewrite old documents.
- Email sending is a separate state/action from invoice creation. Log recipient, timestamp, message/template version, PDF hash/reference, provider response, and retry status without putting sensitive data or credentials in logs.
- Use an outbox/job table with bounded retries and visible failed jobs. A repeated email job must not issue a second invoice.
- Start with scheduled **draft generation and review**. Move to approved auto-issue/email only after pilot acceptance, exception handling, and accounting approval. Automatic collection is a separate later project requiring a payment provider, customer authorization, and reconciliation controls.
- Restrict price/contract approval, invoice issue/credit, payment recording, and configuration by role; record actor and before/after audit events.

## eTIMS and accounting gate

KRA states that persons engaged in business are required to onboard and issue electronic tax invoices. Before production issuance, confirm the applicable taxpayer setup, required invoice fields/tax treatment, and integration route with the finance/tax adviser. KRA describes system-to-system integration paths including OSCU and VSCU; select and validate the appropriate route, credentials, certification/onboarding, failure handling, and reconciliation before implementation. The existing school-fee compliance service is explicitly simulated and must not be represented as a real KRA integration or copied as proof of compliance. Do not hard-code tax rates or promise invoice validity until reviewed by the responsible adviser.

## Central source of truth and records

Keep the platform billing ledger in a central control-plane database/API with audited migrations and backups, not in any school's application database or browser local state. Minimum records:

- `BillingCustomer`, `BillingContact`, and link to platform tenant/customer identity
- `Product`, versioned `PriceBook`/`PriceBookEntry`, `Contract`, `ContractLine`, and billing schedule
- `CustomerInvoice`, immutable `InvoiceLine`/tax snapshot, numbering sequence, and credit note
- `Payment`, `PaymentAllocation`, reconciliation reference, and receipt
- `InvoiceDocument`, email/outbox delivery attempt, reminder policy/attempt, and provider result
- eTIMS submission/response/idempotency record where applicable, plus append-only audit events

Use database constraints for invoice-period uniqueness, money precision/currency, valid state transitions, and references. Keep learner fee billing in its existing tenant schema and access boundary.

## Delivery stages and self-checking gates

**Implementation checkpoint (23 September 2026):** Stage 0 removed the sample pricing UI. The first Stage 2 slice is now present in the worktree: central SQLite customer/contract records on the console persistent data volume, authenticated APIs, and admin-console customer/contract forms. Invoice issuance, price books/amounts, PDF/email, payments, reminders, and eTIMS remain unimplemented. End-to-end role and persistence validation is pending.

**Quote checkpoint (24 September 2026):** The console now supports draft quotes based on the KSh student rate bands, a user-selected flat-tier or progressive calculation, an explicit one-off setup fee, the termly Communications package, and named KSh 5,000 extra modules. Quote snapshots capture the selected enrollment, calculation rule, line items, and customer details. Quotes can be downloaded as PDF, emailed as a PDF attachment with plain-text and HTML summaries through Resend, recorded as accepted, and converted idempotently into a draft invoice. Draft invoices now have a branded, multi-page PDF preview with customer and source-quote details, itemized amounts, totals, and clear draft/tax-status wording. The app labels quotes and draft invoices as not tax invoices; invoice issuing, invoice email delivery, payments, and eTIMS are still outstanding. The configured console environment must supply `RESEND_API_KEY` and `BILLING_FROM_EMAIL` (or `EMAIL_FROM`) to enable sending.

The rate rule defaults to one tier rate applied to all students and can be switched to progressive bands on each quote. The setup fee is required per quote and may be explicitly set to zero. Student cadence and extra-module cadence are selected per quote. These defaults are operational choices; confirm the signed commercial terms before treating them as final price-book policy. Tax is not added to quotes.

### Stage 0 — remove misleading billing presentation (current UI cleanup)

- [x] Remove static sample prices, demo revenue/renewal counts, fake plan assignment, and browser-only payment actions.
- [x] Remove plan selection from school provisioning; provisioning records technical tenant setup, while a contract is a separate business action.
- [ ] Verify static console script parses and that no active HTML/JS references remain to the removed pricing UI.

### Stage 1 — accounting/product decisions

- [ ] Confirm seller legal entity, currencies, approved catalogue/price book, contract terms, numbering policy, tax handling, payment terms, and credit-note policy with business/accounting owners.
- [ ] Confirm KRA eTIMS onboarding/integration route and acceptance criteria with a qualified adviser and KRA/provider documentation.
- [ ] Approve customer billing data fields, retention/access policy, sender domain, and email delivery provider/configuration.

**Gate:** signed-off decisions and sample contract/invoice examples, with tax/eTIMS fields explicitly reviewed.

### Stage 2 — central ledger and customer/contract console

- [ ] Build central schema/API, migrations, RBAC, audit trail, customer records, approved versioned catalogue, and contracts/schedules.
- [ ] Build console forms and customer/contract views; remove remaining fake status fallbacks; validate tenant linkage and prevent cross-customer access.
- [ ] Import only verified customer/contract facts; do not migrate browser-only demo plan amounts as real agreements.

**Gate:** database/API tests prove tenant isolation, permissions, immutable price snapshots, audit events, and schedule idempotency.

### Stage 3 — invoice, PDF, email, and payment workflow

- [ ] Generate draft invoices from one-off actions and schedules; provide preview and explicit issue approval.
- [ ] Generate and archive reproducible PDF snapshots; email plain text + HTML with PDF; capture delivery status and safe retries.
- [ ] Record partial/full payments, allocations, receipts, and reconciliation references; calculate aging from due date and balances.
- [ ] Add correction through credit note/replacement and enforce immutable issued invoices.

**Gate:** end-to-end pilot fixtures reconcile invoice lines/tax/total/PDF, delivery attempts, partial payment, credit note, and aged balance.

### Stage 4 — compliance integration and controlled automation

- [ ] Integrate the approved eTIMS route with unique request IDs, stored responses, duplicate prevention, retry/reconciliation queue, and visible failure state.
- [ ] Run scheduler in dry-run/draft-review mode across a full billing period and reconcile expected vs generated invoices.
- [ ] Pilot a small number of real customer invoices with human approval; verify email delivery, eTIMS response, payment posting, and finance sign-off.
- [ ] Enable auto-issue/email by customer or contract only after a documented go/no-go review; retain pause switch and exception queue.
- [ ] Add configurable follow-up reminders and reporting; keep suspension/collection actions as explicit policy-controlled decisions.

**Gate:** no duplicate invoices on retries, all pilot balances reconcile, delivery/eTIMS exceptions are actionable, and the finance owner signs off.

## Acceptance criteria

- A repeat scheduler run cannot create another invoice for the same contract period.
- Issued invoice/PDF values are stable if the customer, contract, or catalogue changes later.
- Email retry can resend a document but cannot create a new invoice; failure is visible to an operator.
- A partial payment changes the outstanding balance accurately; “paid” is reached only when fully allocated/reconciled under the chosen policy.
- Every invoice, credit, payment, eTIMS action, and reminder has an actor or system identity, timestamp, and audit evidence.
- Platform invoices cannot read/write a school's learner-fee invoices or another customer's billing data.
- Console totals/aging are computed from ledger records; empty or unavailable data is shown as such, never as sample revenue.

## Reference workflow

The Odoo-inspired pattern is customer/contract → invoice draft → reviewed/issued invoice → PDF/email → payment and reconciliation → aging/follow-up. Odoo's documentation supports invoice validation and email sending, separate payment reconciliation, recurring subscription invoicing, and configurable overdue follow-ups. Adopt the workflow concepts; do not assume Odoo's accounting or statutory configuration automatically fits TrendSCORE.
