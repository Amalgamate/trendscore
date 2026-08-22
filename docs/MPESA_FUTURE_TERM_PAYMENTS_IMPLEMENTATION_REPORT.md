# TrendSCORE M-PESA Payments & Future-Term Prepayments Report

**Prepared:** 22 August 2026  
**Scope:** Parent-app STK Push, payments after balances are cleared, future-term allocation, trackable payment links, callbacks, reconciliation, onboarding, controls, and rollout.

## 1. Executive recommendation

TrendSCORE should implement a **school-owned collections model**:

- Every school supplies and owns its M-PESA PayBill/short code and settlement account.
- TrendSCORE initiates and tracks payments, but money settles directly to the school.
- Daraja is the preferred direct integration for schools able to obtain production credentials.
- An approved payment service provider such as Kopo Kopo or IntaSend can remain an optional faster-onboarding/fallback route, subject to commercial and settlement review.
- Every incoming payment first enters an immutable learner/family payment ledger. A separate allocation engine applies it to invoices or retains it as unapplied credit.
- A parent with a zero balance sees **Pay ahead**, not a dead end. They may choose a published future term, an amount, a learner, or a family credit balance.
- A TrendSCORE payment link is a signed, expiring, revocable link to a branded payment session. Opening it shows the learner/school/payment purpose and then initiates STK Push. It is tracked independently of the M-PESA transaction.

This design solves overpayments, future terms, delayed callbacks, multi-child payments, links, refunds, and reconciliation without inventing fake invoices.

## 2. What TrendSCORE already has

The repository is not starting from zero. It already includes:

- a unified M-PESA service with Daraja, Kopo Kopo and IntaSend providers;
- Daraja OAuth, STK Push and STK status query;
- protected initiation/status endpoints and a public callback endpoint;
- persisted `MpesaTransaction` and raw `MpesaCallback` records;
- posting successful invoice-bound payments into `FeePayment` and updating invoice balances/status;
- unmatched-payment handling for organic merchant payments;
- a parent payment modal with phone entry, STK initiation and status polling;
- receipt SMS handling.

### Important current gaps

1. **A payment requires an outstanding invoice.** The parent flow explicitly fails when none exists and replaces payment controls with “All fees are cleared.” This prevents prepayment.
2. **There is no learner/family credit ledger.** `FeePayment` requires `invoiceId`; money cannot safely remain unapplied for a future invoice.
3. **Multi-child collection is not truly allocated.** The UI currently attributes a combined payment to the first child with a balance, despite presenting distribution choices.
4. **Initiation accepts client-provided `invoiceId`, amount and student context.** The server must validate parent-to-learner access, invoice ownership, school, amount policy and allocation intent before calling a provider.
5. **Provider/config selection is global (`findFirst`).** It needs explicit school/tenant scoping and encrypted secrets.
6. **Daraja configuration is environment-only while the settings schema also contains M-PESA fields.** These competing sources of truth should be consolidated.
7. **The callback URL has a placeholder fallback.** Production must fail closed if a real HTTPS URL is not configured.
8. **Payment completion can be posted by both callback and status-query paths.** Receipt uniqueness helps, but one idempotent settlement function should own all posting.
9. **Polling has no visible timeout/recovery flow.** A payment can remain pending after the modal closes or connectivity drops; server-side reconciliation must finish it.
10. **The displayed receipt is derived from the checkout ID.** The user should receive the actual M-PESA receipt after callback.

## 3. Product experience

### 3.1 Parent app

The fees page should always offer:

- **Pay balance** — settle one or all current invoices;
- **Pay another amount** — partial payment or overpayment;
- **Pay ahead** — select Term 1/2/3 and academic year from school-published fee schedules;
- **Add learner credit** — when the future fee is not yet published;
- **Family payment** — allocate one payment across siblings before confirmation;
- **Share payment link** — parent sends a secure link to a sponsor/relative;
- **Receipts and allocations** — show received, allocated, credit remaining, and reversals/refunds.

Suggested checkout:

1. Choose learner(s) and purpose.
2. Show current balances, available credit, future published fees and allocation order.
3. Enter amount and M-PESA number; normalize and mask it.
4. Show a final confirmation: school, learners, term/purpose, amount, fee/charge policy and phone.
5. Initiate STK once, show a countdown and allow one controlled resend after timeout.
6. Confirm from the webhook; polling/SSE is only a UI recovery mechanism.
7. Display the real M-PESA receipt plus TrendSCORE receipt and allocation breakdown.

Never ask for, receive, log or store an M-PESA PIN.

### 3.2 Prepayment rules

Use two distinct concepts:

- **Term prepayment:** the school has published a future-term fee schedule or invoice. Allocate specifically to that learner/term/year.
- **Unapplied credit:** the future charge is not known. Hold the money as learner or family credit, then allocate automatically when the invoice is issued according to the school’s documented policy.

Recommended default allocation order:

1. explicit parent-selected invoice/term;
2. oldest due mandatory invoice for that learner;
3. next published future term selected by the parent;
4. remaining amount to unapplied learner credit.

Do not silently move credit between siblings. Require a parent allocation instruction or an authorized finance action with an audit trail.

School policy must define whether prepayments are refundable, transferable, usable for optional items, and how graduating/withdrawing learners are handled. Finance/legal advisers should confirm the accounting and tax/eTIMS treatment before launch.

## 4. Trackable payment links

Build first-party links such as `https://pay.trendscore.co.ke/p/{opaque-token}`. Do not expose learner IDs, invoice IDs, admission numbers or phone numbers in the URL.

Each link should support:

- school, learner/family, purpose, target term/year and optional fixed amount;
- fixed, minimum/maximum, or payer-entered amount;
- expiry time, usage limit, active/revoked state and optional one-time use;
- optional recipient label and masked learner identity;
- UTM/campaign/source metadata (SMS, WhatsApp, email, reminder batch);
- created, delivered, opened, checkout-started, STK-sent, completed, failed and expired events;
- conversion reporting without counting an “open” as a payment;
- redirect/deep-link back to the parent app and a web fallback for non-users.

The public session should apply rate limits, bot protection after suspicious activity, generic errors, CSRF protection where relevant, signed server-side state and strict PII minimization. Before STK Push, the payer should verify a safe learner hint (for example first name plus masked admission suffix), not see a full student record.

IntaSend also exposes a Payment Links API with amount, currency, redirect URL and usage limit. This can accelerate an aggregator route, but TrendSCORE-owned links are still recommended because they preserve provider portability and school-specific allocation logic.

## 5. Proposed technical architecture

### 5.1 New/changed records

- `SchoolPaymentConfig`: `schoolId`, provider, business short code/till, transaction type, encrypted credential references, callback configuration, environment, enabled state, settlement metadata, last verification time.
- `PaymentIntent`: school, payer/user, currency, requested amount, phone hash/masked phone, purpose, idempotency key, provider, provider request IDs, status, expiry and failure reason.
- `PaymentAllocationInstruction`: intent, learner, invoice (optional), term/year (optional), amount, priority and allocation status.
- `Collection`: immutable successful receipt-level record with provider receipt, paid amount/time, payer phone (encrypted/masked), raw provider reference, reversals and reconciliation state.
- `LearnerCreditLedger`: double-entry-style credit/debit entries; never update a single “credit balance” without ledger history.
- `PaymentAllocation`: collection/credit-to-invoice allocations with allocated/reversed amounts.
- `PaymentLink` and `PaymentLinkEvent`: opaque token hash, rules, lifecycle and attribution events.
- `ProviderWebhookEvent`: provider event ID/payload hash, received/processed timestamps, attempt count and processing result.
- `SettlementReconciliation`: statement item, matching outcome, discrepancies and resolver audit.

Keep `FeePayment` as the invoice allocation/accounting output, not the source of truth for the cash collection itself.

### 5.2 API surface

- `POST /api/payments/intents` — authenticated parent/admin creates a validated intent and allocations.
- `POST /api/payments/intents/:id/stk` — initiates once with an idempotency key.
- `GET /api/payments/intents/:id` — safe current status and receipt/allocation result.
- `POST /api/payments/links` — authorized staff/parent creates a link.
- `GET /pay/:token` — public safe payment-session view.
- `POST /pay/:token/intents` — public rate-limited intent creation.
- `POST /api/webhooks/mpesa/:schoolWebhookKey` — provider callback; acknowledge quickly, persist first, process idempotently.
- finance endpoints for credits, allocation, transfer, refund/reversal and reconciliation.

### 5.3 Settlement state machine

Use explicit states: `CREATED → INITIATING → PENDING_CUSTOMER → SUCCEEDED | FAILED | CANCELLED | EXPIRED | UNKNOWN`, with separate `allocationStatus` and `reconciliationStatus`.

One idempotent settlement service must:

1. lock/find the intent by provider identifiers;
2. verify school/provider, expected currency and amount policy;
3. deduplicate by provider receipt and event ID;
4. create the immutable collection;
5. apply explicit allocations in a database transaction;
6. put any remainder into the credit ledger;
7. post accounting entries;
8. commit;
9. send receipt notifications after commit.

Both callbacks and status reconciliation call this same function. The browser never posts a payment merely because it saw a “success” screen.

### 5.4 Reconciliation

- Run pending-status recovery frequently for recent transactions with capped exponential backoff.
- Import/query merchant statements daily and match on receipt, short code, amount and time.
- Surface missing callback, amount mismatch, duplicate receipt, unmatched account, reversal and settlement mismatch queues.
- Produce a daily per-school control report: initiated, successful, allocated, credited, failed, reversed, unmatched and bank-settled totals.
- Keep raw webhook payloads under a defined retention policy, with restricted access and redacted logs.

## 6. Daraja/provider approach

Safaricom’s current public developer platform is **Daraja 3.0**, offering sandbox apps, production go-live and M-PESA APIs. TrendSCORE should use the currently documented endpoints/credentials from the school’s Daraja app rather than hard-code version assumptions. Relevant capabilities for this project are OAuth, Lipa na M-PESA Online/STK Push, STK query, C2B confirmation/validation where applicable, transaction status/reconciliation and reversal workflows.

Recommended provider policy:

- **Default:** school-owned Safaricom PayBill + Daraja production app.
- **Optional aggregator:** Kopo Kopo/IntaSend where a school wants faster onboarding, unified reporting or hosted links and accepts provider fees/settlement terms.
- **Fallback:** do not automatically reroute the same payment to another merchant after an ambiguous timeout; first reconcile to avoid double charging.

## 7. What each school must provide

### A. Business and KYC pack for Safaricom/provider onboarding

Exact requirements vary by legal form and provider, but prepare:

- legal school/organization name and any registered trading name;
- Certificate of Incorporation/Registration (or the applicable registration document);
- current CR12 and beneficial-ownership information/BOF1 where applicable;
- KRA PIN certificate for the organization and requested directors/owners;
- IDs/passports and KRA PINs for directors, owners, authorized signatories and administrator as requested;
- valid county business permit;
- Ministry of Education registration/licence or equivalent school authorization;
- board resolution/M-PESA authorization letter stating purpose, bank details, authorized operators and contacts;
- completed Safaricom/provider application, terms and signed tariff guide;
- official school letterhead, stamp/seal and physical/postal address;
- active website/app link and organization profile if treated as online/e-commerce;
- any provider AML/KYC questionnaire and additional documents requested for the legal category.

Safaricom’s 2024 requirements say PayBill portal access needs the M-PESA Business Administrator form. Its 2025 application form requests organizational/contact/finance/administrator details and settlement details.

### B. Settlement and M-PESA details

- school-owned PayBill/short code (preferred), or till where the chosen flow supports it;
- account/settlement choice and bank name, branch, account name and account number;
- certified bank letter, bank statement or cancelled cheque as requested;
- nominated M-PESA portal administrator: name, ID, DOB, phone, username and official email;
- finance and technical contact names, official emails and phones;
- signed decision on who pays transaction/aggregator charges;
- expected monthly value, peak daily value and transaction count;
- currency (KES), minimum/maximum parent payment and refund limits;
- access for the school’s authorized team to merchant statements and M-PESA portal.

### C. Daraja/technical activation details

- production Daraja app owned/approved for that school and its consumer key/secret, supplied through a secure secret-onboarding channel—not email, spreadsheets or support chat;
- production Lipa na M-PESA passkey, business short code and allowed transaction type;
- provider-issued credentials/subscription keys if an aggregator is selected;
- approved public HTTPS callback/confirmation/validation URLs (TrendSCORE supplies these);
- registered technical contact and go-live approval evidence;
- sandbox/UAT account and test acceptance sign-off;
- IP allowlisting, webhook signing key or provider security settings where supported;
- confirmation that credential rotation and administrator recovery have been tested.

TrendSCORE should store credentials in a secrets manager, with school-scoped references in the database, encryption, access audit, rotation and no secret values returned to the frontend.

### D. School finance rules and master data

- academic calendar: terms, years, opening dates and invoice publication dates;
- approved current and future fee structures by grade/learner category;
- whether a parent may pay an unpublished future term;
- allocation priority for current debt, transport, tuition, optional fees and future terms;
- whether credit is learner-specific or family-level;
- sibling transfer rules and approvers;
- overpayment, withdrawal, graduation, refund, reversal and chargeback policy;
- minimum/maximum instalment and whether partial payments are allowed;
- sponsor/third-party payer rules;
- receipt numbering, narration, accounting accounts/cost centres and eTIMS/tax treatment confirmed by the school’s advisers;
- finance users and segregation of duties: viewer, allocator, refund requester, refund approver, reconciler and auditor;
- reminder cadence, SMS/WhatsApp/email templates, sender IDs and languages;
- record-retention and privacy policy plus consent wording for payer phone data.

### E. Learner data quality/sign-off

- unique admission/account identifier for every learner;
- verified learner-to-parent/guardian relationships;
- normalized primary/alternate payer phone numbers with consent;
- sibling/family grouping rules;
- opening balances, historic unapplied credits and outstanding invoices reconciled and signed off;
- process for unmatched payments and responsible finance owner.

## 8. Security and operational controls

- Enforce tenant/school scope on every intent, invoice, learner, link and callback.
- Authorize that the logged-in parent is linked to every selected learner.
- Calculate payable/allocation values server-side; never trust frontend balances.
- Use idempotency keys on intent creation/initiation and unique provider receipt/event constraints.
- Rate-limit by user, IP, token and normalized phone; cap resend attempts.
- Encrypt secrets and sensitive phone data; expose only masks. Redact authorization headers, PIN-like fields and credentials from logs.
- Use an opaque per-school callback key as an initial routing control and provider signatures/IP validation where officially supported; never treat obscurity alone as authentication.
- Persist webhook events before processing, respond quickly, retry internally and maintain a dead-letter review queue.
- Apply maker-checker approval to refunds, reversals, manual allocation and credit transfers.
- Maintain immutable audit events for configuration changes and all money movements.
- Monitor callback failures, pending-age percentiles, success rate by provider/error code, duplicates, mismatch value and reconciliation lag.
- Complete a DPIA/privacy review, incident runbook, backup/restore test and penetration test before production.

## 9. Delivery plan

### Phase 0 — decisions and onboarding (1–3 weeks, provider timing may extend this)

- Decide direct Daraja versus aggregator per school and confirm the non-custodial settlement model.
- Collect the onboarding pack and finance policies.
- Obtain sandbox/production credentials and agree transaction charges.
- Reconcile learner/invoice opening data.

### Phase 1 — payment core (2–3 weeks)

- Add tenant-scoped configuration, payment intents, collections, webhook events and one idempotent settlement service.
- Harden parent authorization, amount validation, callback processing, receipt display and pending recovery.
- Migrate the existing STK flow to the new service without changing the parent experience initially.

### Phase 2 — credits and future terms (2–3 weeks)

- Add the credit ledger, allocation engine and accounting entries.
- Add Pay Ahead to the cleared-state UI.
- Implement real multi-child allocations and finance credit management.

### Phase 3 — links and communications (1–2 weeks)

- Add signed tracked links, public checkout, campaign events and SMS/WhatsApp/email templates.
- Add expiry/revocation/usage rules and conversion reporting.

### Phase 4 — reconciliation and controlled pilot (2–3 weeks)

- Add statement reconciliation, exception queues and daily reports.
- Pilot with one school, a limited parent group and small transaction limits.
- Test success, insufficient funds, cancellation, timeout, duplicate callback, lost callback, overpayment, future allocation, sibling allocation, reversal and refund.
- Reconcile every pilot shilling to the merchant statement and accounting ledger before expanding.

## 10. Acceptance criteria

- A cleared parent can successfully pay ahead and sees credit/future allocation.
- One payment can be allocated exactly across multiple children and the receipt shows the split.
- Reopening/retrying never creates a duplicate collection or fee posting.
- Callback loss is recovered automatically without browser involvement.
- The actual M-PESA receipt is displayed and searchable.
- A payment link is revocable/expiring and its full funnel is reportable.
- No school can access another school’s configuration, learner, link or transaction.
- Successful collection totals equal allocated payments plus unapplied credit; daily merchant statements reconcile to recorded collections/reversals.
- Refunds, reversals, transfers and manual allocations require authorization and remain auditable.
- Credentials can be rotated without a code release.

## 11. Immediate decisions required

1. Will every school use its own PayBill (recommended), or will an aggregator onboard them as sub-merchants?
2. Is credit learner-specific by default, or can parents deliberately create family-level credit?
3. May parents prepay only published fees, or also place open credit for unpublished terms?
4. What is the exact allocation priority and refund/transfer policy?
5. Who bears provider charges?
6. Which channels launch first: in-app, SMS link, WhatsApp link, email link?
7. Who in each school owns reconciliation and who approves exceptions/refunds?

## 12. Current official references

- [Safaricom Daraja 3.0 developer portal](https://developer.safaricom.co.ke/)
- [Safaricom Lipa na M-PESA requirements (2024)](https://www.safaricom.co.ke/images/Downloads/Lipa-na-M-PESA-Requirements-2024.pdf)
- [Safaricom Business M-PESA Service Application Form (2025)](https://www.safaricom.co.ke/images/Downloads/M-PESA-C2B-Service-Application-Form-2025.pdf)
- [IntaSend Payment Links API](https://developers.intasend.com/reference/api_v1_paymentlinks_create)

Provider APIs, commercial terms, KYC requirements and security mechanisms can change. Reconfirm the final production checklist with Safaricom/provider during each school’s go-live.
