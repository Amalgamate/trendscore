# Communication Audit — TrendScore

**Date:** August 2026  
**Status:** Read-only forensic review. No code was modified.

---

## 1. Summary

TrendScore has **three communication channels** active:
1. **SMS** — via Africa's Talking or MobileSasa (configurable per school)
2. **In-App Notifications** — via Socket.io (real-time) + database persistence
3. **Web Push** — via Web Push API + VAPID keys

**WhatsApp** has a service file and partial implementation (`server/src/services/whatsapp.service.ts`, `server/whatsapp-auth/`) using `wwebjs` (WhatsApp Web library). Its production status is unclear.

**Email** has two service files (`email.service.ts`, `email-resend.service.ts`). The Resend-based service appears to be the active implementation.

---

## 2. SMS

### Providers Supported

| Provider | Status | Notes |
|---|---|---|
| Africa's Talking | ✅ Active | Sends via `https://api.africastalking.com/version1/messaging` |
| MobileSasa | ✅ Active | Sends via `POST /v1/send/bulk` |

Both providers are selected via `communicationConfig.smsProvider` in the database. Config is cached in memory for 5 minutes.

**Env-var fallback:** If no DB config exists, the service falls back to `AT_API_KEY`/`AT_USERNAME` or `MOBILESASA_API_KEY` env vars. This enables OTP SMS to work before school admin configures their account.

### What SMS Is Used For

| Trigger | Template | Recipient | Status |
|---|---|---|---|
| Assessment result dispatch | Structured multi-line with subject scores | Parent | ✅ Active |
| Fee invoice generated | Invoice number, amount, due date | Parent | ✅ Active |
| Performance review created/updated | HR review notification | Staff | ✅ Active |
| Library overdue fines | Overdue items list | Member (parent/staff) | ✅ Active (cron) |
| Pledge payment reminder | Instalment due reminder | Parent | ✅ Active (cron) |
| Duty roster reminder | Tomorrow/today duty reminder | Teacher | ✅ Active (cron) |
| OTP auth | Login/verification code | User/parent | ✅ Active |
| Welcome SMS | School onboarding | New admin | ✅ Active |

**Absent learner SMS:** ❌ **NOT implemented.** No trigger exists to notify parents when a child is marked absent.

### SMS Audit Trail

`assessment_sms_audits` table tracks all assessment SMS:
- Full message content, recipient, template type
- `smsStatus`: SENT / FAILED
- `failureReason` if failed
- `sentByUserId`

No equivalent audit table exists for fee, OTP, library, or pledge SMS.

### Known Issues

| Issue | Severity |
|---|---|
| No retry logic for failed SMS | HIGH |
| No per-message audit for non-assessment SMS | MEDIUM |
| No delivery receipt (DLR) callback handling | MEDIUM |
| Phone validation rejects some valid numbers (operator code check) | LOW |
| `sendBulkSms` uses sequential loop with 50ms delay — not truly parallel | LOW |

---

## 3. In-App Notifications

**Service:** `server/src/services/notification.service.ts`

### Architecture

```
createNotification()
    │
    ├─► DB: prisma.userNotification.create()
    ├─► Socket.io: io.to(userId).emit('notification:new', notification)
    └─► Web Push: sendPushToUser() — background, non-blocking
```

### Notification Types

```
INFO | SUCCESS | WARNING | ERROR | WAIVER | GIT_UPDATE | APPROVAL
```

### What Triggers In-App Notifications

- Approval workflow events (submitted, approved, rejected, expired, overridden)
- Git update notifications (developer tool)
- Fee waivers

**Missing triggers:**
- Absent learner
- Assessment published
- Report card ready
- Fee due reminder
- Staff leave approved/rejected

### Approval Sync

`syncApprovalNotificationsForUser()` runs on every notification fetch — ensures pending approvals surface even if real-time emission was missed. This is a useful safety net.

---

## 4. Web Push

**Implementation:** `web-push` library + VAPID keys  
**Database:** `push_subscriptions` table (endpoint, p256dh, auth, userId, userAgent)  
**Stale subscription cleanup:** Automatically removes expired (410/404) subscriptions

**Status:** Fully wired and operational. Fires after every `createNotification()` call.

---

## 5. Email

### Services

| File | Provider | Status |
|---|---|---|
| `server/src/services/email.service.ts` | Unknown (legacy, likely Nodemailer) | ⚠️ Unclear |
| `server/src/services/email-resend.service.ts` | Resend | ✅ Appears active |

No detailed inspection of email service was done in this pass. Requires further review.

---

## 6. WhatsApp

| File | Notes |
|---|---|
| `server/src/services/whatsapp.service.ts` | wwebjs-based WhatsApp Web automation |
| `server/whatsapp-auth/` | Session auth storage |
| `server/src/.wwebjs_auth/` | Alternate auth path |
| `server/src/controllers/whatsapp-status.controller.ts` | Status endpoint |

**wwebjs** operates as a WhatsApp Web session — not via the official WhatsApp Business API. This approach:
- Requires a QR code scan to initialise
- Can be blocked by WhatsApp at any time
- Is not suitable for production at scale

**Status:** Partially implemented. Whether it is actively used in production is unclear. The auth files are present, suggesting it has been connected at some point.

---

## 7. Parent Communication — Current Capabilities

| Capability | Status |
|---|---|
| View learner attendance (API) | ✅ Available |
| Receive assessment result SMS | ✅ Available |
| Receive fee invoice SMS | ✅ Available |
| In-app notifications (parent account) | ✅ If parent has a user account |
| Absent child notification | ❌ Not implemented |
| Two-way SMS (reply from parent) | ❌ Not implemented |
| WhatsApp communication | ⚠️ Partial |
| Parent portal (web interface) | ⚠️ Partial — auth exists, data endpoints unclear |

---

## 8. Cron-Driven Communication Jobs

| Job | Schedule | Channel |
|---|---|---|
| Pledge reminders | Daily 08:00 EAT | SMS |
| Library overdue SMS | Daily 08:00 EAT | SMS |
| Library auto-fine assessment | Daily 00:05 EAT | Internal |
| Library member suspension | Daily 00:10 EAT | Internal |
| Duty roster tomorrow reminder | 20:00 EAT | In-app (+ SMS inferred) |
| Duty roster same-day reminder | 06:00 EAT | In-app (+ SMS inferred) |
| Duty roster weekly summary | Sunday 18:00 EAT | In-app |
| LMS assignment due tomorrow | Daily 20:00 EAT | In-app notification |
| Absent learner SMS | ❌ MISSING | — |

---

## 9. Two-Way SMS Feasibility

Both Africa's Talking and MobileSasa support inbound SMS via webhook callbacks. Implementing two-way messaging would require:

1. A callback URL registered with the provider (e.g. `/api/communication/sms-callback`)
2. A parser to match inbound SMS replies to outbound messages (by phone number + message context)
3. A reply handler (e.g. parent replies "OK" to acknowledge absence notification)
4. Audit logging of inbound messages

This is feasible within the existing architecture without major changes.

---

## 10. Recommendations

| Action | Priority |
|---|---|
| Add absent learner SMS notification (cron, after attendance window closes) | HIGH |
| Add inbound SMS callback handler for parent acknowledgement | HIGH |
| Extend audit logging to all SMS types (not just assessment) | MEDIUM |
| Add SMS retry for FAILED records | MEDIUM |
| Evaluate replacing wwebjs with WhatsApp Business API | MEDIUM |
| Add missed notification triggers (absence, assessment, leave) | MEDIUM |
| Add email audit trail equivalent to SMS audit | LOW |
