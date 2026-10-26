# Platform Billing — Completion Roadmap

Scope: `platform-console` (client billing for TrendSCORE schools). Separate from school `FeeInvoice`.
Date: 2026-10-06. Currency: KES only.

## 0. Current state (done)
- Customers, contracts, quotes (draft → sent → accepted → converted), draft/issued invoices, email delivery (Resend), PDFs, manual payments with partial allocation, receipts, audit trail.
- Billing reset to zero (super_admin, typed `RESET BILLING`, backup to `billing-backups/` first).
- Create-instance prompt: **Bill now** (customer + draft quote) or **Bill later**.
- Not verified by running: `npm test` has not been run on these changes.

## 1. Price model — align with the real price list (P0)
Problem: quote engine prices per student (bands). Business price list is flat per school.

| Item | Private | Public primary |
|---|---|---|
| Setup (once) | 15,000 | 10,000 |
| CORE per term | 10,000 | 5,000 |
| Add-on module per term | 5,000 each | n/a (confirm) |
| Communication | 10,000 incl. 1,000 SMS; free if school has own SMS provider | same |

Tasks
1. `billing_products` table (code, name, kind: setup/term/module/sms, school_type, price, active) + admin UI to edit prices; every quote stores a price snapshot.
2. Replace `calculateQuote` band logic with catalogue-based lines. School type + module checklist drive the quote. Student count becomes optional metadata.
3. Create-instance form: school type + modules instead of student count/setup fee; "Bill now/later" stays.
4. Discount line with mandatory reason (old CORE price was 20,000); optional approval flag.
5. Migrate/flag existing quotes made with bands (they are snapshots, leave untouched).

## 2. Recurring term billing (P0)
1. Term calendar setting (3 terms/year: start, billing date, due date).
2. Contract becomes the source: customer, school type, active modules, start date, status, agent.
3. "Generate term invoices" job: one draft invoice per active contract per term, idempotent (unique contract+term). Review queue → bulk issue → bulk email.
4. Proration policy for mid-term go-live and mid-term module add (decide: full first term vs prorate).
5. Lifecycle: trial → active → suspended → ended; billing starts only at go-live.

## 3. Payments and reconciliation (P0/P1)
1. M-PESA Paybill 508885 via Daraja C2B confirmation URL; account number = school/invoice code.
2. Auto-allocate exact matches; "unallocated payments" queue for the rest; duplicate guard on M-PESA receipt code.
3. Overpayment → customer credit balance, applied to next invoice.
4. Payment reversal/refund with reason + audit.
5. Receipts auto-emailed on payment.

## 4. Corrections and documents (P1)
1. Credit notes against issued invoices (full/partial), numbered, PDF, emailed.
2. Void only for drafts; issued invoices are corrected by credit note.
3. Customer statement PDF (invoices, payments, balance).
4. Number sequences configurable (INV-/CN-/RCT-), gap-free.

## 5. Collections (P1)
1. Reminder schedule (e.g. -7, 0, +7, +14, +30 days) by email/SMS; stops on payment; log each send.
2. Aging report (current/30/60/90+) per school and per agent.
3. Grace-period → warning → optional suspension flag (read-only/locked). Needs owner sign-off before enforcement; wire to instance control.

## 6. Agents and commission (P1/P2)
Business rules: agents follow up and bill their schools; commission accrues only when the client pays; payout a day later via M-PESA; Communication excluded; moving from 25% one-off to recurring.
1. `billing_agents`, customer→agent link, commission plan (rate, one-off vs recurring, excluded products).
2. Accrue commission on payment allocation (not on issue); reverse on payment reversal/credit note.
3. Agent statement and payout batches with M-PESA reference.
4. Agent portal (agents.trendscore.co.ke): read-only own schools, invoices, balances, earnings.
5. Open: commission % and recurring duration.

## 7. Reporting (P2)
MRR, active schools, churn, setup vs recurring revenue, collection rate, revenue by school type/module/agent, CSV export, accountant export.

## 8. Compliance and safety (P1)
1. Decide VAT status; seller legal identity/KRA PIN on documents.
2. eTIMS integration before calling any document a tax invoice (do not label as tax invoice until done).
3. Reset safeguard: block or archive-only once any invoice has been issued/paid (current reset is unrestricted for super_admin).
4. Role split: finance vs super_admin; `platform_owner` stays read-only.
5. Immutable audit for money events; backups scheduled, not only on reset.

## 9. Quality gates
- Tests: reset, bill-now/later create, idempotent customer/quote, catalogue pricing, term generation idempotency, payment allocation/reversal, credit notes, commission accrual.
- Run `npm test` in `platform-console`; manual run-through on a copy of the data.
- Known weak spot to fix: auto-create fails if admin email is malformed (instance exists, billing warns) — make email optional on the customer.
- Confirm provisioning script returns an instance id matching the deploy-target id used by the billing school picker.

## Suggested order
1. Price catalogue + create form (§1)
2. Contracts + term invoice generation (§2)
3. M-PESA reconciliation (§3)
4. Credit notes, statements, reminders, aging (§4–5)
5. Agent commission + portal (§6)
6. Reporting, eTIMS, suspension (§7–8)

## Decisions needed
- Are public primary schools billed through this system, and do they get add-on modules?
- Proration policy for mid-term starts and added modules.
- Agent commission percentage and whether recurring has an end.
- Invoice at signup or at go-live.
- VAT registered? eTIMS timeline.
- Whether overdue schools get suspended, and after how many days.
