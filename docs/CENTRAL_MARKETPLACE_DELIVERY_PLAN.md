# Central Marketplace Delivery Plan

## Purpose

Deliver one central TrendScore Marketplace that receives approved content from school portals and makes it available according to an explicit visibility policy:

- **Private** — creator and approvers only.
- **School-only** — users in the creator's school only.
- **Selected schools** — users in explicitly selected schools.
- **Platform-wide** — approved TrendScore users across eligible schools and the main TrendScore Marketplace website.

This replaces the current school-scoped Marketplace as the source of truth for cross-school discovery and commerce. The main website must consume the central Marketplace API; it must never connect directly to individual school databases.

## Current audit baseline

### Already present

- LMS Marketplace database models for listings, purchases, seller earnings, platform fees, ratings, and download limits.
- API routes for listing creation, browse, approval/rejection, purchase, M-Pesa callback, downloads, ratings, and analytics.
- LMS screens for browsing listings, creating listings, purchases, and seller analytics.
- Enterprise access guard (`lms-enterprise`) for Marketplace endpoints.
- M-Pesa initiation and callback integration path.

### Must be corrected before launch

- LMS Settings currently sends `allowedFileTypes` as text while the database requires a string array, causing Settings saves to fail.
- LMS settings toggles are not enforced by navigation or Marketplace backend rules.
- Marketplace client screens use an inconsistent API response shape, causing valid API data to appear empty or failed.
- Free listings incorrectly follow the paid M-Pesa path.
- Current listings are scoped to a single `schoolId`; there is no central catalogue for the main website.
- There is no selected-school audience model, platform moderation workflow, copyright/takedown process, or seller payout process.

## Product rules to approve

Before implementation, confirm these rules:

- A school owner sets the broadest visibility its staff may request.
- A teacher may make content more private, but cannot publish it beyond the school owner's policy.
- School-only content requires school approval only.
- Selected-school and platform-wide content require school approval and TrendScore moderation.
- Platform-wide content is visible only to authenticated, eligible TrendScore users unless a separate public catalogue is approved.
- Every listing declares ownership/licensing and accepts content standards.
- Paid-content refunds, fees, payout timing, and tax responsibilities are defined before payments are enabled.

## Target architecture

```text
School Portal (teacher / owner)
       |
       | authenticated Marketplace API requests
       v
Central Marketplace Service + Database
       |                 |                  |
       v                 v                  v
Main Marketplace Site  File access       M-Pesa / payouts
                       (signed URLs)
```

### Service boundary

- Keep school operational data in each school tenant.
- Copy only marketplace metadata and the required resource reference into the central service.
- Store files in managed object storage and use short-lived signed URLs.
- Use service-to-service credentials for portal-to-marketplace communication.
- Use central buyer entitlements for downloads; do not trust client-side visibility flags.

## Delivery checklist

### Phase 1 — Product and policy decisions

- [ ] Approve visibility levels and who can access each one.
- [ ] Define teacher, school approver, TrendScore moderator, buyer, and finance roles.
- [ ] Define pricing, free-content rules, seller share, platform fee, refunds, and payout frequency.
- [ ] Define copyright declaration, reporting, takedown, and appeal policy.
- [ ] Decide whether platform-wide listings are authenticated-only or publicly searchable.

**Exit criterion:** written Marketplace policy and role matrix approved.

### Phase 2 — Stabilise the current LMS Marketplace foundation

- [ ] Fix LMS Settings response handling and `allowedFileTypes` type conversion.
- [ ] Enforce `enableLearning`, `enableMarketplace`, `enableRevisionLibrary`, approval, and free-content settings in the API and navigation.
- [ ] Correct Marketplace API response handling in listing, browse, purchase, download, and analytics screens.
- [ ] Implement a true free-acquisition path with immediate entitlement and no M-Pesa request.
- [ ] Add integration tests for listing, school approval, free access, paid purchase, callback, and download.

**Exit criterion:** a school can safely create, approve, access, and download a school-only free resource end-to-end.

### Phase 3 — Central Marketplace data and API

- [ ] Create central Marketplace service/database schema.
- [ ] Add creator school, owner school, requested visibility, approved visibility, audience schools, moderation status, licence, and publication records.
- [ ] Create a migration/export path for existing school-scoped listings where appropriate.
- [ ] Define versioned API contracts for school portals and the main website.
- [ ] Add central audit logs, immutable approval history, and service authentication.
- [ ] Add Docker configuration, migrations, health checks, backups, and monitoring.

**Exit criterion:** central service can accept a school publication request without exposing tenant database access.

### Phase 4 — School publishing and governance

- [ ] Add school marketplace policy settings: enabled status, permitted visibility levels, approvers, revenue share, and whether paid listings are allowed.
- [ ] Add teacher submission flow with requested audience and licence declaration.
- [ ] Add school review queue: approve, reject, request changes, unpublish, and suspend.
- [ ] Add selected-school picker with explicit recipient school IDs.
- [ ] Ensure teachers cannot publish more broadly than school policy permits.

**Exit criterion:** Zawadi can publish school-only and selected-school content with an auditable school approval trail.

### Phase 5 — TrendScore moderation and main website

- [ ] Add platform moderation queue for platform-wide listings.
- [ ] Add quality, rights, safety, pricing, and metadata review actions.
- [ ] Add reporting, takedown, suspension, and appeal workflows.
- [ ] Build main website catalogue, search, filters, details page, seller profile, and buyer library using the central API.
- [ ] Clearly label listing scope and access requirements on every card and listing page.

**Exit criterion:** approved platform-wide listings are discoverable on the main site and unavailable to ineligible users.

### Phase 6 — Entitlements, payments, and payouts

- [ ] Implement central entitlement records for free and paid acquisitions.
- [ ] Complete M-Pesa checkout, callback verification, idempotency, receipts, failed-payment recovery, and refunds.
- [ ] Enforce signed downloads, access expiry, and download limits centrally.
- [ ] Add ratings/reviews with abuse controls.
- [ ] Add seller balances, statements, payout requests, finance approval, and payout reconciliation.

**Exit criterion:** one paid listing can be purchased, reconciled, downloaded, refunded, and reflected in seller/platform balances.

### Phase 7 — Security, QA, and launch

- [ ] Test tenant isolation, visibility enforcement, permission escalation, signed URL expiry, and approval bypass attempts.
- [ ] Test duplicate payments, callback replay, failed callbacks, refunds, and concurrent purchases.
- [ ] Test teacher, owner, moderator, buyer, parent, and student journeys.
- [ ] Add operational dashboards for moderation backlog, payment failures, download failures, and payout liabilities.
- [ ] Pilot free school-only content at Zawadi.
- [ ] Pilot platform-wide free content with selected schools.
- [ ] Enable paid listings only after payment and payout reconciliation passes.

**Exit criterion:** acceptance checklist passes and release approval is recorded.

## Recommended rollout order

1. Stabilise the existing LMS Marketplace foundation.
2. Pilot free, school-only content at Zawadi.
3. Introduce selected-school sharing.
4. Launch approved, platform-wide free resources on the main website.
5. Enable paid listings after finance, refund, and payout controls are verified.

## Definition of done

The Marketplace is complete only when content visibility is enforced server-side, approvals are auditable, buyers receive central entitlements, downloads are secure, payment callbacks are idempotent, school and platform governance work, and the main website reads from the same central catalogue as the school portals.
