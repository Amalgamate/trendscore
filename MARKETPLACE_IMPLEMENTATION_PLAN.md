# Phase 4 — Marketplace: Implementation Plan

Status as of this plan: schema and notification hooks exist; `lms-marketplace.service.ts` does not exist; all marketplace controller handlers in `lms.controller.ts` are `501 Not Implemented` stubs; no marketplace frontend exists; `PageRouter.jsx` still routes `learning-marketplace` to `LMSPlaceholder`.

This plan builds the Marketplace backend first (this session's target), then the frontend in a follow-up session.

---

## 1. Architecture decisions (read before building)

The original task plan assumed three things that don't hold in this codebase. Rather than silently deviate, here's the call being made on each, and why:

### 1.1 No `Wallet` model exists
There is no wallet/ledger model in `schema.prisma`. Rather than add one (a schema migration, which is a bigger and riskier change than this pass warrants), seller balance will be **computed on read** as:

```
SUM(MarketplacePurchase.sellerEarnings) WHERE sellerId = X AND status = 'COMPLETED'
```

This is exposed via `getSellerBalance(sellerId)` in the service. If Rico later wants real payouts/withdrawals tracked, a `Wallet` + `WalletTransaction` model can be added then — this plan does not block that.

### 1.2 No `MARKETPLACE_LISTING` type in `ApprovalRequestType`/`ApprovalModule` enums
The plan called for listing approval to route through `approvalEngine.service.ts`. Adding a new enum value requires a schema migration too. Instead, listing approval is implemented as a **self-contained status transition** inside `lms-marketplace.service.ts` (`PENDING_APPROVAL → APPROVED/PUBLISHED` or `REJECTED`), gated at the route level by the existing `MARKETPLACE_APPROVE` permission. Functionally equivalent for now; can be migrated into the generic approval engine later without changing the public API.

### 1.3 M-Pesa callback correlation
Safaricom is configured with a **single global callback URL** (`/api/mpesa/callback`, handled by the existing `mpesa.controller.ts` / `mpesa.service.ts`), not a per-feature one. The already-routed `/api/lms/marketplace/mpesa-callback` endpoint would never actually be hit by Safaricom under the current config, so building purchase completion only there would silently never fire in production.

Fix: reuse `mpesaService.initiateStkPush()` for marketplace purchases (same as fee payments), store the returned `checkoutRequestId` on `MarketplacePurchase.transactionId`, and add a small, additive hook into the **existing** `mpesa.controller.ts` callback handler: after it finishes its normal fee-invoice handling (which is skipped entirely when `invoiceId` is not set, so no risk of touching fee logic), it also calls `LMSMarketplaceService.completeByCheckoutRequestId(checkoutRequestId, result)`. The dedicated `/api/lms/marketplace/mpesa-callback` route stays wired as a defensive/idempotent secondary entry point.

---

## 2. Files to create/modify

| File | Action |
|---|---|
| `server/src/services/lms-marketplace.service.ts` | **Create** — all marketplace business logic |
| `server/src/controllers/lms.controller.ts` | **Modify** — replace 10 marketplace `501` stubs with real handlers |
| `server/src/controllers/mpesa.controller.ts` | **Modify** — add one hook call into the existing callback handler |
| `server/prisma/schema.prisma` | **No changes** (by design — see §1) |

---

## 3. Task list

### 3.1 Core listing & approval
- [ ] `createListing(data, sellerId, schoolId)` — validate title/resourceId/listingType/price-if-paid; create with `status=PENDING_APPROVAL`; invalidate marketplace cache
- [ ] `approveListing(listingId, approverId, schoolId)` — `PENDING_APPROVAL → APPROVED → PUBLISHED`, set `publishedAt`, notify seller via `LMSNotificationService`, audit log `MARKETPLACE_LISTING_APPROVED`, invalidate cache
- [ ] `rejectListing(listingId, approverId, reason, schoolId)` — set `REJECTED`, store reason, notify seller
- [ ] `browseListings(filters, schoolId)` — `PUBLISHED` only, paginated, filter by type/price range/subject/grade, cache `lms:marketplace:{filterHash}` (TTL 3 min)
- [ ] `getListingDetail(id, schoolId)`
- [ ] `getMyListings(sellerId, schoolId)` — all statuses, own listings only

### 3.2 Revenue split (pure function, easiest to verify)
- [ ] `calculateRevenueSplit(price, revenueSharePct)` → `{ sellerEarnings, platformFee }`, rounded to 0.01, `sellerEarnings + platformFee === price`
- [ ] Sanity-check at 0%, 100%, and fractional percentages before wiring it into the purchase flow

### 3.3 Purchase flow
- [ ] `initiatePurchase(listingId, buyerId, buyerPhone, schoolId)`:
  - Reject if listing not `PUBLISHED`
  - Reject (409) if buyer already has a `COMPLETED` purchase for this listing
  - Compute revenue split
  - Call `mpesaService.initiateStkPush({ phoneNumber, amount, firstName, lastName })` (no `invoiceId` — keeps the generic callback's fee-payment branch inert for this transaction)
  - Create `MarketplacePurchase` with `status=PENDING`, `transactionId=<checkoutRequestId>`
  - Return `{ purchaseId, checkoutRequestId }`
- [ ] `completeByCheckoutRequestId(checkoutRequestId, result)` — looked up from the generic M-Pesa callback:
  - Find pending `MarketplacePurchase` by `transactionId`
  - On success: `status=COMPLETED`, notify buyer + seller via `LMSNotificationService.onMarketplacePurchaseComplete`
  - On failure: `status=FAILED`, notify buyer
- [ ] `handleMpesaCallback(callbackData)` — thin parser for the dedicated route, delegates to the same completion function (defensive/idempotent)
- [ ] Hook into `mpesa.controller.ts`: one added call, guarded in try/catch, logged on failure, never throws back to Safaricom

### 3.4 Downloads & ratings
- [ ] `getMyPurchases(buyerId, schoolId)`
- [ ] `downloadPurchasedResource(purchaseId, buyerId)` — verify `COMPLETED`, check `downloadCount < maxDownloads`, check `accessExpiresAt`, signed Cloudinary URL, increment `downloadCount`; else throw `ApiError(402).withCode('LMS_PURCHASE_REQUIRED')`
- [ ] `rateResource(purchaseId, rating, buyerId)` — rolling average update on listing, increment `ratingCount`

### 3.5 Wallet (computed, not stored)
- [ ] `getSellerBalance(sellerId, schoolId)` — sum of `sellerEarnings` on `COMPLETED` purchases for the seller's listings
- [ ] `getMarketplaceAnalytics(sellerId, schoolId)` — total sales, revenue earned, top listings, download counts (feeds the Phase 5 analytics handler too)

### 3.6 Controller wiring
- [ ] Replace stubs in `lms.controller.ts`: `createListing`, `approveListing`, `rejectListing`, `browseListings`, `getListingDetail`, `initiatePurchase`, `handleMpesaCallback`, `getMyListings`, `getMyPurchases`, `rateResource`
- [ ] Confirm `handleMpesaCallback` route stays public (no `authenticate` middleware) per existing route file

### 3.7 Verification pass (manual, no test framework changes)
- [ ] Create → approve → browse → purchase (sandbox) → callback fires on the **generic** `/api/mpesa/callback` → purchase flips to `COMPLETED`
- [ ] Duplicate purchase attempt returns 409
- [ ] Download without purchase returns 402 `LMS_PURCHASE_REQUIRED`
- [ ] Revenue split arithmetic checked at 0%, 100%, and a fractional percentage
- [ ] Reject flow stores reason and notifies seller correctly

---

## 4. Explicitly out of scope for this pass
- Marketplace frontend (`MarketplacePage.jsx`, `PurchaseModal.jsx`, etc.) — separate follow-up
- Real `Wallet` model / payout tracking — future enhancement, not blocking
- Migrating listing approval into `approvalEngine.service.ts` — future enhancement, not blocking
- AI Assistant backend, Gamification backend, Analytics frontend — tracked separately, not part of Marketplace
