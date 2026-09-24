# TrendSCORE Client Invoicing Plan

**Status:** Customer/contract registry, quote-to-draft conversion, and a draft invoice PDF preview are implemented; final invoice issuance, delivery, payments, and eTIMS remain outstanding.
**Scope:** TrendSCORE billing its school customers for platform services, managed centrally from the platform admin console.

**Current storage baseline:** Customer, contract, quote, delivery-attempt, and draft-invoice records currently live in a persistent SQLite file mounted by the platform-console container. Before adding concurrent issuance, payment posting, or scheduled billing, verify backup/restore and single-writer assumptions. Prefer moving the central financial ledger to a managed transactional database with migrations and tested recovery before enabling multiple console replicas or automation.

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

## Admin console information architecture

Build billing as a focused workspace within the platform console, with a persistent local tab bar below the page title. Keep each tab's search, filters, sort order, and pagination independent. On narrow screens, make the tabs horizontally scrollable or present them as a labeled select control; do not hide actions in an unlabeled icon-only menu. Every register row should open a detail view with a stable URL where practical, and primary actions should remain visible in the detail header.

### Overview

Purpose: show what needs attention across the platform billing ledger, with every total derived from persisted records.

- Summary cards: draft invoices, issued balance, overdue balance, and payments received in the selected period. If the ledger cannot calculate a value, show an unavailable state instead of a guessed zero or sample metric.
- Action queues: drafts awaiting review, failed invoice emails, overdue invoices, and unallocated payments.
- Recent activity: quotes accepted, invoices issued/sent, and payments recorded, with actor and timestamp.
- Date range and currency are visible. KES-only is the current implementation; do not aggregate currencies if additional currencies are introduced.
- Cards link to the corresponding filtered register. No dashboard card directly changes a financial record.

### Customers

Purpose: maintain who TrendSCORE bills and the evidence behind the commercial relationship.

- Customer register: name, linked school/tenant, billing contact, currency, open balance, and active/inactive state. Support search by school, customer, tenant key, email, and tax identifier; avoid exposing full tax identifiers in broad list views.
- Customer profile sections: Overview, Contacts, Contracts, Quotes, Invoices, Payments, and Activity. Keep a visible link to the technical tenant record without treating the tenant as the legal customer by default.
- Capture legal and display names, billing and service addresses, billing contacts, recipient emails, phone, tax identifiers/classification, payment terms, currency, and status.
- Show a ledger timeline with document and payment references. Customer edits affect future work only; they never rewrite an issued invoice snapshot.
- Customer creation remains available alongside suggestions from provisioned schools, with duplicate detection before save.

### Quotes

Purpose: prepare and track a commercial offer before it becomes an obligation.

- Register filters: draft, sent, accepted, declined, expired, converted; customer; created/valid-through date; quote number.
- Quote detail: customer snapshot, enrollment and pricing assumptions, itemized lines, validity, notes, PDF, delivery attempts, and acceptance evidence.
- Actions: create, edit only while draft, preview/download, send or safely retry, record acceptance/decline with date and evidence, and convert an accepted quote once into a draft invoice.
- Preserve the current pricing choice (flat tier or progressive bands), setup fee, cadence, and add-on selection on each quote. Flag these inputs as subject to the signed agreement until an approved price book exists.

### Invoices

Purpose: review a draft, issue a stable financial document, deliver it, and manage corrections.

- Register filters: draft, issued, sent, partially paid, paid, overdue, void, credited; customer; invoice number; issue/due date; balance range. Overdue is derived from due date and balance, not set by a user toggle.
- Draft detail: source quote/contract, editable fields that are not yet approved, seller and buyer details, line/tax calculation, payment terms, due date, PDF preview, and an explicit review checklist.
- Issue flow: show a final review screen, require an authorized user to confirm, assign the legal-entity invoice number atomically, snapshot all fields and totals, write an audit event, and make the issued document immutable.
- Issued invoice detail: issue/due dates, original amount, balance, separate delivery and payment timelines, PDF download, email/retry controls, and correction/credit-note relationship.
- Keep invoice lifecycle, email delivery, payment settlement, and tax submission as separate fields/timelines. For example, an invoice can be issued, email-failed, partially paid, and awaiting eTIMS response at the same time.
- Do not label a draft PDF “invoice” without a prominent draft watermark; do not allow a draft to be mistaken for a payable or tax document.

### Products & pricing

Purpose: govern what can be quoted and at which approved rate.

- Catalogue entries have a stable code, customer-facing name/description, billing unit, cadence eligibility, tax category, and active state.
- Price entries are versioned with currency, effective dates, approval actor/time, and source agreement. Editing a price creates a new version; old quote and invoice snapshots remain unchanged.
- Encode the stated student bands, one-off setup, termly Communications package (including the 1,000 SMS allowance), and extra modules only after the business owner resolves whether student band rates apply to all students or progressively by band, and approves the setup amount and termly/one-off add-on rules.
- Contracts live on the customer profile and select catalogue/price versions, dates, billing schedule, recipients, and signed-agreement reference. The register may be surfaced inside this tab if contract volume warrants it.
- No automatic pricing fallback: a missing, expired, or unapproved price blocks quote creation and tells the operator what must be configured.

### Payments

Purpose: record money received and show how it settles invoices.

- Payment register: received date, method, reference, payer, amount, allocated amount, unapplied amount, and reconciliation state.
- Record a payment once, then allocate it to one or more invoices; permit partial allocations and unapplied credits with clear warnings. Enforce that allocations cannot exceed the available payment or invoice balance without an explicit reversal workflow.
- Payment detail includes allocations, receipt, evidence/reference, reconciliation status, and audit trail. Reversals create compensating records rather than deleting history.
- A manual payment entry is not proof of bank reconciliation. Keep “recorded” and “reconciled” distinct, and calculate invoice balance from posted allocations.

### Reports

Purpose: answer operational finance questions from the same central ledger.

- Start with invoice register export, customer statements, balances by customer, and aging buckets based on due date.
- Show report date, filters, currency, and inclusion rules. Provide a row-level path back to the source invoice or payment.
- Build reports after invoice/payment data is trustworthy; never create demo totals to fill an empty dashboard.

### Settings

Purpose: control the legal entity and delivery behavior used by future documents.

- Seller identity and address, tax PIN/classification, invoice numbering sequence, default due terms, bank/M-Pesa instructions, approved currencies, email sender and reply-to, and eTIMS configuration.
- Show configuration readiness and last update actor/time. Require an authorized finance/admin role and confirmation for settings that affect issued documents.
- Version seller/tax/payment details for new documents. Do not mutate the issuer snapshot on existing issued documents.
- Keep API keys and credentials in server-side secrets/environment configuration; display presence and last validation, never secret values.

## Roles and visual interaction rules

- **Platform Owner:** read-only access to customers, quotes, invoices, payments, reports, and activity.
- **Billing Operator:** manage customer/contact details, prepare quotes and invoice drafts, send quotes, record receipts, and view reports; cannot approve prices, issue invoices, post credits, or change legal settings.
- **Finance Approver:** approve price versions, issue invoices, approve credit notes/reversals, and configure seller/tax/payment settings. An approval action records the actor and timestamp.
- **Super Admin:** technical administration and break-glass access, still audited. Do not make routine billing actions admin-only if a billing role can be granted safely.
- Use clear status chips with text, not color alone. Place filters above the register, keep primary actions consistent, and use destructive-action confirmation with the document number and effect stated plainly.
- Every empty state explains the next valid action. Every error preserves entered form data where safe and names the failed step. Delivery retries are available from an invoice/quote timeline and never create another financial document.

## Invoice and delivery state model

Do not use one `status` field to represent four independent processes. Model and present these separately:

1. **Invoice lifecycle:** draft → issued → void/credited (correction relationship retained; issued records are immutable).
2. **Delivery state:** not sent, queued, sent, failed, retrying, with recipient and attempt history. Sending does not issue an invoice.
3. **Settlement state:** unpaid, partially paid, paid, overpaid/unallocated, or reversed; derive the amount due from payment allocations.
4. **Tax submission state:** not applicable/not submitted, queued, accepted, rejected, or pending reconciliation, only after an approved eTIMS integration exists.

“Sent” and “overdue” should be display badges or derived attributes alongside the independent lifecycle/settlement states, not mutually exclusive invoice lifecycle values. This prevents a successful email from overwriting payment state and prevents a payment from implying successful delivery or tax submission.

## Recommended delivery sequence

1. **Product and accounting decisions:** settle seller identity, tax/eTIMS route, number policy, payment instructions, standard terms, approved rate semantics, and role owners. Create representative approved contracts and invoice examples.
2. **Navigation and truthful registers:** add the Billing workspace tabs, global search where useful, customer profiles, invoice register/detail, and empty/loading/error states. Keep all totals ledger-backed.
3. **Price governance and contract schedule:** version prices, approval history, contract lines/schedule, and idempotent draft generation. Start with operator-triggered draft generation; no auto-issue.
4. **Invoice approval and issuance:** final review checklist, authorization, legal invoice numbering, immutable snapshot, audit log, and void/credit relationship. Do not enable this production action until the accounting/eTIMS gate is signed off.
5. **Delivery and payments:** archive reproducible issued PDFs, send/retry with an outbox, record payment and allocations, receipts, reversals, and reconciliation status.
6. **Reports and controlled automation:** aging, statements, reminders, scheduler dry run, then a small human-approved pilot. Consider automated issue/send only after measurable pilot acceptance and a pause/exception process.

## Product decisions required before final UI and issue workflow

- Seller legal entity, registered/trading name, address, tax PIN, and whether multiple entities/currencies will bill.
- eTIMS onboarding and approved integration path; invoice fields and tax treatment confirmed by the responsible tax/finance adviser.
- Invoice numbering sequence and treatment of voids, credit notes, and replacements.
- Payment methods, bank/M-Pesa instructions, standard due date/terms, and what evidence marks a payment reconciled.
- Whether 0-300/301-500/501-1000/above-1000 student rates apply as one selected rate to every student or progressively by band; setup amount; module cadence; and treatment of SMS beyond the included allowance.
- Billing Operator and Finance Approver identities, approval thresholds, and separation of duties.

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

**Implementation checkpoint (23 September 2026):** Stage 0 removed the sample pricing UI. The first Stage 2 slice added central SQLite customer/contract records on the console persistent data volume, authenticated APIs, and admin-console customer/contract forms.

**Quote checkpoint (24 September 2026):** The console now supports draft quotes based on the KSh student rate bands, a user-selected flat-tier or progressive calculation, an explicit one-off setup fee, the termly Communications package, and named KSh 5,000 extra modules. Quote snapshots capture the selected enrollment, calculation rule, line items, and customer details. Quotes can be downloaded as PDF, emailed as a PDF attachment with plain-text and HTML summaries through Resend, recorded as accepted, and converted idempotently into a draft invoice. Draft invoices now have a branded, multi-page PDF preview with customer and source-quote details, itemized amounts, totals, and clear draft/tax-status wording. The app labels quotes and draft invoices as not tax invoices; invoice issuing, invoice email delivery, payments, and eTIMS are still outstanding. The configured console environment must supply `RESEND_API_KEY` and `BILLING_FROM_EMAIL` (or `EMAIL_FROM`) to enable sending.

**Current baseline (25 September 2026):** The customer/contract, school-suggestion, quote, quote-email, quote-acceptance, quote-to-draft, draft-PDF-preview, and Billing workspace navigation/register slices have been deployed to the platform console. Overview counts are derived from current records; customers, quotes, and invoices have search/status filters. Payments, approved price governance, invoice issuance/delivery, finance reports, and editable legal settings remain planned and are shown as unavailable/read-only. No invoice is currently issued or emailed; the existing PDF is a draft preview.

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

- [x] Add initial central SQLite customer/contract/quote/draft-invoice records and authenticated console APIs on the persistent console data volume.
- [x] Build initial console customer/contract views and link customer creation to provisioned-school suggestions.
- [x] Add Billing workspace tabs, ledger-backed overview counts, searchable customer/quote/invoice registers, and honest placeholders for workflows not yet supported by APIs.
- [ ] Decide the durable financial-ledger database and recovery model before concurrent issue/payment operations; add migrations, RBAC, audit trail, approved versioned catalogue, and contract schedules.
- [ ] Validate tenant linkage, role boundaries, and cross-customer access on the central billing APIs.
- [ ] Import only verified customer/contract facts; do not migrate browser-only demo plan amounts as real agreements.

**Gate:** database/API tests prove tenant isolation, permissions, immutable price snapshots, audit events, and schedule idempotency.

### Stage 3 — invoice, PDF, email, and payment workflow

- [x] Convert an accepted quote idempotently into a draft invoice and provide a branded PDF preview.
- [ ] Generate drafts from approved contract schedules; provide a review checklist and explicit issue approval.
- [ ] Number and freeze issued invoices; archive reproducible issue-time PDF snapshots.
- [ ] Email issued invoices as plain text + HTML with PDF; capture delivery status, safe retries, and an auditable outbox.
- [ ] Record partial/full payments, allocations, receipts, and reconciliation references; calculate aging from due date and balances.
- [ ] Add credit-note/replacement corrections and enforce immutable issued invoices.

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
