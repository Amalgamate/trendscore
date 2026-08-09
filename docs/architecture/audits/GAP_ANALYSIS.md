# Gap Analysis — TrendScore Attendance & Presence

**Date:** August 2026  
**Status:** Read-only forensic review. No code was modified.

---

## Feature Status Matrix

| Existing Feature | Status | Reusable | Needs Refactoring | Needs Rewrite | Priority |
|---|---|---|---|---|---|
| Student attendance (manual mark) | ✅ Working | Yes | Minor | No | — |
| Student bulk attendance | ✅ Working | Yes | Minor (wrap in transaction) | No | LOW |
| Student attendance stats/reports | ✅ Working | Yes | No | No | — |
| Parent views child attendance | ✅ Working | Yes | No | No | — |
| Absent parent notification (SMS) | ❌ Missing | — | — | New | HIGH |
| Attendance lock time enforcement | ⚠️ Config exists, not enforced | Partial | Needs controller hook | No | MEDIUM |
| Chronic absenteeism alert | ❌ Missing | — | — | New cron | MEDIUM |
| Staff clock-in / clock-out | ✅ Working | Yes | No | No | — |
| Staff geofence enforcement | ✅ Working | Yes | No | No | — |
| Staff attendance report | ✅ Working | Yes | No | No | — |
| Staff biometric clock-in | ⚠️ Service wired, no SDK | Partial | Add SDK adapter | No | MEDIUM |
| Learner biometric attendance | ⚠️ Stub only | Partial | Add SDK adapter + time detection | No | HIGH |
| Biometric device registry | ⚠️ API only, no UI | Partial | Add admin UI | No | HIGH |
| Biometric credential enrollment | ❌ Stub (no SDK, no encryption) | Schema only | Needs full implementation | Partial rewrite | HIGH |
| Biometric template encryption | ❌ Missing | — | — | Must add | CRITICAL |
| Biometric sync (device pull) | ❌ Missing | — | — | New service | MEDIUM |
| SMS — assessment reports | ✅ Working | Yes | No | No | — |
| SMS — fee invoices | ✅ Working | Yes | No | No | — |
| SMS — library reminders | ✅ Working | Yes | No | No | — |
| SMS — absent child to parent | ❌ Missing | SmsService reusable | — | New cron trigger | HIGH |
| SMS retry on failure | ❌ Missing | — | SmsService | New | MEDIUM |
| Inbound SMS callback | ❌ Missing | — | — | New | MEDIUM |
| In-app notifications | ✅ Working | Yes | No | No | — |
| Web push notifications | ✅ Working | Yes | No | No | — |
| WhatsApp | ⚠️ wwebjs partial | No | Migrate to official API | Yes | MEDIUM |
| Transport — vehicles/routes | ✅ Working | Yes | No | No | — |
| Transport — learner assignment | ✅ Working | Yes | No | No | — |
| Transport — billing integration | ✅ Working | Yes | No | No | — |
| Transport — daily trip / boarding event | ❌ Missing | — | — | New | HIGH |
| Transport — GPS tracking | ❌ Missing | — | — | New | LOW |
| Transport attendance events | ❌ Missing | — | — | New | HIGH |
| Hostel / dormitory management | ❌ Missing | — | — | New module | HIGH |
| Dorm roll call | ❌ Missing | Attendance model pattern | — | New | HIGH |
| Exeat / weekend leave | ❌ Missing | LeaveRequest pattern | — | New | HIGH |
| Dining attendance | ❌ Missing | Attendance model pattern | — | New | MEDIUM |
| Boarding parent portal | ❌ Missing | Parent access pattern | — | New | HIGH |
| Parent portal — attendance view | ✅ Working (API) | Yes | No | No | — |
| Parent portal — two-way SMS | ❌ Missing | — | — | New | MEDIUM |
| Parent portal — notifications | ✅ Working (in-app) | Yes | No | No | — |
| Library attendance tracking | ✅ (via library member visits) | Partial | — | No | LOW |
| Clinic presence | ❌ Missing | — | — | New | LOW |
| Gate visitor management | ❌ Missing | — | — | New | LOW |
| Assembly attendance | ❌ Missing | — | — | New | MEDIUM |
| Unified Presence Engine | ❌ Not built | Event infrastructure needed | — | New | FUTURE |

---

## Critical Gaps (Must Fix Before Any New Feature)

1. **Biometric template encryption** — storing biometric data in plaintext is a legal and security risk
2. **Absent learner SMS** — parents have no automatic notification when a child is absent
3. **Attendance lock time enforcement** — the config is there but not used

---

## High Priority Gaps (Core Attendance Maturity)

4. Biometric learner attendance — time-aware (LATE detection)
5. Biometric device management UI
6. Transport boarding events
7. Hostel module (entire module missing)

---

## Medium Priority Gaps (Platform Maturity)

8. SMS retry mechanism
9. Inbound SMS (parent reply/acknowledgement)
10. Chronic absenteeism cron
11. WhatsApp migration to official API
12. Biometric device sync (pull mode)

---

## Low Priority / Future

13. GPS transport tracking
14. Assembly attendance
15. Clinic presence
16. Gate visitor management
17. Unified Presence Engine
