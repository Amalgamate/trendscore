# Hostel / Boarding School Audit — TrendScore

**Date:** August 2026  
**Status:** Read-only forensic review. No code was modified.

---

## 1. Summary

**Hostel/boarding functionality does not exist** in TrendScore. No dormitory management, roll call, bed allocation, house master assignment, exeat, or weekend leave system was found anywhere in the codebase.

The word "boarding" appears only in:
- `seed-fee-types.ts` — as a `FeeCategory.BOARDING` for fee categorisation
- Seed data for senior school database entries — to classify whether a school is a day/boarding school
- `FeeCategory` enum in the schema

This confirms the system is aware that boarding schools exist (as a classification) but has not implemented any boarding operational modules.

---

## 2. Evidence of Absence

The following searches returned no results or only tangential fee references:

| Search Term | Result |
|---|---|
| `hostel` | 0 results in server code |
| `dorm` | 0 results |
| `roll call` / `rollcall` | 0 results |
| `exeat` | 0 results |
| `house master` / `housemaster` | 0 results |
| `bed allocation` | 0 results |
| `dormitory` | 0 results |
| `boarding` | Fee category only |
| `weekend leave` | 0 results |
| `report back` | 0 results |

---

## 3. Boarding-Relevant Existing Infrastructure

While no boarding module exists, the following existing systems could serve as building blocks:

| Existing Feature | Boarding Use Case |
|---|---|
| `Attendance` model | Could be extended for dorm roll call (different `source` / `context`) |
| `LeaveRequest` (HR module) | Pattern could be adapted for student exeat/weekend leave |
| `StaffAttendanceLog` + source field | Pattern for house master check-ins |
| `SmsService` | Parent notifications for exeat approvals, report-back reminders |
| `NotificationService` | Push notifications for roll call events |
| `UserNotification` system | House master / admin alerts |
| `BiometricDevice` + `BiometricLog` | Could record dorm entry/exit scans |
| `FeeCategory.BOARDING` | Boarding fees already categorised |

---

## 4. What a Full Boarding Module Would Require

### Database Models (All Missing)

```
Dormitory          { id, name, type (BOYS/GIRLS), capacity, schoolId }
DormitoryBed       { id, dormitoryId, bedNumber, status (OCCUPIED/VACANT) }
DormitoryAssignment { id, dormitoryId, bedId, learnerId, from, to, active }
HouseMaster        { userId, dormitoryId, role (PRIMARY/DUTY) }
ExeatRequest       { id, learnerId, requestedAt, departureDate, returnDate,
                     reason, parentPhone, status, approvedBy, approvedAt }
DormRollCall       { id, dormitoryId, date, session (MORNING/NIGHT), conductedBy }
DormRollCallEntry  { id, rollCallId, learnerId, status, remarks }
DiningAttendance   { id, learnerId, date, session (BREAKFAST/LUNCH/DINNER), present }
```

### API Layer (All Missing)

- Dormitory CRUD
- Bed allocation / transfer
- Exeat request → approval workflow
- Roll call session creation + marking
- Dining attendance capture
- Boarding reports (occupancy, absent, exeat status)

### Communication (Missing)

- Parent notified when exeat approved/denied
- Parent notified when student fails to report back after leave
- House master alerted when roll call has unexplained absences

---

## 5. Boarding School Readiness Assessment

Can TrendScore currently support a boarding school without major redesign?

| Boarding Requirement | Current State | Gap Severity |
|---|---|---|
| Dorm assignment/bed management | ❌ Missing | HIGH |
| Dorm roll call | ❌ Missing | HIGH |
| Exeat / weekend leave | ❌ Missing | HIGH |
| Dining attendance | ❌ Missing | HIGH |
| House master roles | ❌ Missing | HIGH |
| Prep attendance | ❌ Missing | MEDIUM |
| Parent confirmation of return | ❌ Missing | MEDIUM |
| Boarding fee collection | ✅ FeeCategory.BOARDING exists | LOW |
| Clinic presence tracking | ❌ Missing | MEDIUM |

**Assessment:** TrendScore is not boarding-ready. A boarding module would need to be built from scratch, though it can share infrastructure (auth, SMS, notifications, attendance patterns).

---

## 6. Recommended Approach

A boarding module should be treated as a **standalone feature module** that publishes events into the presence system (if one is built). It should not be bolted onto the student attendance model — dormitory roll call and school gate attendance are different contexts.

**Suggested phased approach:**
1. Phase 1: Dormitory setup (dorms, beds, assignments, house masters)
2. Phase 2: Roll call (MORNING / NIGHT, simple mark present/absent)
3. Phase 3: Exeat management (request → approval → return)
4. Phase 4: Dining and prep attendance
5. Phase 5: Parent portal integration (view exeat, confirm return)
