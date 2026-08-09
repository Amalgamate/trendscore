# Final Architecture Recommendation — TrendScore

**Date:** August 2026  
**Author:** Architecture Review  
**Status:** Read-only forensic review. No code was modified.

---

## 1. Current Architecture

### Strengths

- **Modular controller structure** — 60+ controllers, each scoped to a domain
- **Prisma ORM** — type-safe DB access, migration history, good tooling
- **Role-based permissions** — middleware-enforced with granular permission strings
- **Multi-provider SMS** — Africa's Talking + MobileSasa, with env-var fallback
- **Real-time notifications** — Socket.io + Web Push, both wired and working
- **Approval workflow engine** — multi-step, configurable, notification-integrated
- **Staff attendance is mature** — clock-in/out, geofence, payroll integration, change history
- **Assessment SMS audit trail** — complete and production-grade
- **Transport billing** — correctly integrated with fee invoices
- **Cron infrastructure** — node-cron, multiple scheduled jobs

### Weaknesses

- **No unified presence layer** — attendance data lives in 3+ isolated tables with no cross-module view
- **Biometric implementation is a stub** — no real device SDK, templates unencrypted
- **No absent-child SMS** — the most expected communication feature is missing
- **No hostel module** — boarding school operations are completely absent
- **No transport attendance events** — buses move but no one knows who boarded
- **WhatsApp via wwebjs** — fragile unofficial library, not production-safe at scale
- **Attendance lock time config exists but is not enforced** — dead config
- **No chronic absenteeism detection**
- **Frontend attendance UI not in pages/** — unclear where it lives

### Technical Debt

| Item | Risk |
|---|---|
| Biometric templates stored unencrypted | CRITICAL — legal/GDPR risk |
| `markedBy` on attendances is a string, not FK | LOW — dangling reference on user delete |
| `passengerId` on transport assignments is untyped | LOW — orphan risk |
| WhatsApp wwebjs session | MEDIUM — can break without warning |
| No SMS retry mechanism | MEDIUM — failed messages silently lost |
| `Promise.all()` bulk attendance without transaction | LOW — partial failure possible |
| Cron has no absent-learner job | HIGH — operational gap |

### Risks

1. Biometric data in plaintext is a compliance risk if production is live
2. WhatsApp wwebjs can be disconnected by WhatsApp at any time
3. Growing schema in a single file becomes hard to reason about

---

## 2. Existing Attendance Capability

### Current Maturity

| Dimension | Score | Notes |
|---|---|---|
| Student attendance marking | 8/10 | Solid, bulk and single, teacher-scoped |
| Attendance reporting | 7/10 | Stats, daily register, learner summary |
| Parent visibility | 6/10 | API works, no automatic notification |
| Staff attendance | 9/10 | Clock-in/out, geofence, payroll, audit trail |
| Biometric | 3/10 | Infrastructure only, no SDK |
| Cross-module presence | 1/10 | Does not exist |
| Notifications on absence | 1/10 | Does not exist |

### Missing Functionality

- Automatic absent-learner parent notification (SMS + push)
- Attendance lock time enforcement
- Chronic absenteeism alerts
- Biometric → time-aware status (LATE vs PRESENT)
- Transport boarding events
- All boarding school contexts

### Scalability

The `attendances` table uses a unique constraint on `(learnerId, date)` and a daily date type. At 1,000 learners over 200 school days per year, that's 200,000 rows/year. This is trivially small for PostgreSQL. No scalability concern at current scope.

### Maintainability

The attendance controller and service are clean, well-commented TypeScript. The biometric service is clean but incomplete. The HR service handles staff attendance well. No significant maintainability concerns.

---

## 3. Biometrics

### Current Implementation Status

| Component | Status |
|---|---|
| Device registry | ✅ API exists |
| Credential enrollment | ❌ Stub only |
| Webhook receiver | ✅ Working |
| Staff attendance via biometric | ✅ Working |
| Learner attendance via biometric | ⚠️ Functional but limited |
| Template encryption | ❌ MISSING — critical |
| Device management UI | ❌ Missing |
| SDK integration | ❌ Missing |
| Sync for offline devices | ❌ Missing |

### Can It Be Salvaged?

**Yes.** The webhook architecture, device model, and log lifecycle are sound. The required work is:
1. Schema enhancement (6–8 new/modified fields)
2. Template encryption service (AES-256 + key management)
3. ZKTeco SDK adapter (or similar push SDK)
4. Admin UI (device list, log viewer, enrollment wizard)
5. Learner attendance time-awareness

This is **completion work, not a rewrite**.

### Recommended Device Integrations

**Priority 1:** ZKTeco (most widely deployed in Kenyan schools, supports HTTP push)  
**Priority 2:** Hikvision (for gate cameras + facial recognition)  
**Priority 3:** NFC/RFID card reader (lowest cost, no biometric needed for basic access control)

### Recommended Architecture

```
┌─────────────────────────────────────────┐
│  Hardware Devices                        │
│  ZKTeco / Hikvision / NFC Reader         │
└───────────┬─────────────────────────────┘
            │ HTTP Push (existing webhook)
            │ OR
            │ SDK Pull (new BiometricSyncWorker)
            ▼
┌─────────────────────────────────────────┐
│  BiometricService                        │
│  - Device validation                     │
│  - Raw log creation (PENDING)            │
│  - Dispatch to Learner / Staff handler   │
│  - Encrypt templates at rest             │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  AttendanceService / StaffHRService      │
│  - Time-aware status (LATE detection)    │
│  - Standard attendance record            │
└─────────────────────────────────────────┘
```

---

## 4. Parent Communication

### Current Capabilities

- ✅ Parents can view attendance via API
- ✅ Assessment results sent via SMS
- ✅ Fee invoices sent via SMS
- ✅ In-app notifications if parent has account
- ❌ No absent-child notification
- ❌ No two-way SMS
- ❌ No WhatsApp (reliably)

### Recommended Improvements

1. **Add absent-learner SMS cron** — runs at 09:30 EAT daily, sends SMS to parent for each absent child with no excuse on file. Highest ROI improvement.

2. **Inbound SMS callback** — Africa's Talking and MobileSasa both support this. Parent replies to absent SMS with "OK" to acknowledge. System records acknowledgement.

3. **Extend push notifications** — absent child, report card ready, fee due.

4. **WhatsApp migration** — replace wwebjs with WhatsApp Business API (official). Higher setup cost but stable and scalable.

### SMS Architecture (Current + Recommended)

```
Current:  One-way outbound only
          SmsService → Provider API → Parent's phone

Recommended:
          SmsService → Provider API → Parent's phone
                ↑                          |
                └── Inbound callback ←────┘
                    POST /api/communication/sms-callback
                    Parsed → ParentReplyService
                    Stored → parent_sms_replies table
```

### Two-Way Messaging Feasibility

**Fully feasible** with existing providers. Implementation effort: 3–5 days. Requires:
- Callback endpoint registration with provider
- Phone-number based message threading
- Reply intent classification (acknowledge absence, request call, etc.)

---

## 5. Transport Integration

### Current State

Transport manages vehicles, routes, and static learner assignments. It correctly bills transport fees. It does not track any daily movements.

### Future Opportunities

- **Daily trip model** → enables attendance via bus (who boarded today?)
- **Driver mobile check-in** → low-cost boarding confirmation
- **Hardware RFID on bus** → automatic boarding scan, feeds biometric webhook
- **GPS integration** → parent ETA notifications, route tracking

None of these require changing the current transport data model — they are additive.

---

## 6. Boarding School Readiness

Can TrendScore support a boarding school without major redesign?

**No — not currently.**

The following are entirely absent: dormitory management, roll call, exeat, dining attendance, house master roles, prep attendance, clinic presence.

**However:** The architecture is hospitable to a boarding module. It would not require restructuring existing modules. It would add new tables, new controllers, and new cron jobs, consuming existing infrastructure (SMS, notifications, attendance patterns, user roles).

**Estimated boarding module scope:** Medium (4–8 weeks for a full Phase 1 implementation covering dorms, roll call, and exeat).

---

## 7. Strategic Recommendation

### The Three Options

**Option A: Improve the Current Attendance Module**
- Fix the known gaps (lock enforcement, absent SMS, biometric completion)
- Leave architecture as-is
- Suitable for day schools only

**Option B: Refactor Attendance into a Presence Engine**
- Add a `presence_events` table and `PresenceService`
- Wire all existing modules to emit presence events (non-breaking)
- Build new modules (hostel, transport trips) as native presence emitters
- Unified parent view: "Where is my child?"
- Foundation for boarding school, gate management, clinic, assembly

**Option C: Introduce a Guardian Module**
- A dedicated module for parent-facing communication
- Aggregates attendance, biometric, transport, and boarding data
- Adds two-way SMS, WhatsApp, and parent acknowledgement
- Can be built on top of Option A or B

---

### Recommendation: Option B with Option C as a second phase

**Option B (Presence Engine) is the strategic direction.** Here is why:

| Factor | Option A | Option B | Option C |
|---|---|---|---|
| Migration complexity | LOW | LOW-MEDIUM | MEDIUM |
| Breaking changes | None | None | None |
| Boarding school support | ❌ No path | ✅ Natural fit | ⚠️ Partial |
| Parent experience | Marginal improvement | Major improvement | Major improvement |
| Long-term maintainability | Fragmented | Unified | Depends on B |
| Time to first value | Fast | Medium | Medium |
| Reuse of existing work | High | High | High |

**The Presence Engine does not replace existing attendance** — it absorbs it. The daily teacher register still works exactly as it does today. The biometric webhook still works. The staff clock-in still works. What changes is that all three now publish to a common event store, which makes the parent view, boarding school support, and anomaly detection possible without every feature building its own isolated reporting.

**Migration complexity is low** because:
- Existing tables are not changed
- Existing APIs are not broken
- The engine is additive — a new table + a service call in existing write paths
- It can be introduced incrementally, one module at a time

### Recommended Execution Sequence

1. **Sprint 1 — Fix Critical Gaps** (no architecture change)
   - Biometric template encryption
   - Absent learner SMS cron
   - Attendance lock time enforcement in controller

2. **Sprint 2 — Presence Foundation**
   - Add `presence_events` table
   - Add `PresenceService.emit()`
   - Wire attendance, staff clock-in, biometric webhook

3. **Sprint 3 — Transport Events**
   - Add `TransportTrip` and `TransportBoardingEvent`
   - Wire to PresenceService

4. **Sprint 4 — Parent Guardian View (Option C begins)**
   - Parent endpoint: `GET /api/presence/learner/:id/today`
   - Absent-child push notification
   - Inbound SMS acknowledgement

5. **Sprint 5 — Boarding Phase 1**
   - Dormitory setup, bed allocation, roll call
   - Exeat management
   - House master roles

6. **Sprint 6 — Biometric Completion**
   - ZKTeco SDK adapter
   - Device management UI
   - Enrollment workflow

---

### Final Summary

TrendScore has a solid, production-grade foundation. The attendance system works. The SMS infrastructure works. The staff module is mature. The main gaps are:

1. No biometric SDK integration (template stub exists, needs completion)
2. No absent-child notification (the most expected feature is missing)
3. No hostel module (boarding schools currently unsupported)
4. No transport attendance events (buses don't generate presence data)
5. No unified presence layer (three isolated silos)

None of these require a ground-up rewrite. The existing codebase is worth building on. The Presence Engine strategy extends rather than replaces what exists.
