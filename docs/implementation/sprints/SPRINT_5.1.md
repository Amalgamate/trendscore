# Sprint 5.1 — Boarding Module

**Phase:** 5  
**Sprint:** 5.1  
**Completed:** August 2026  
**Goal:** Full boarding school operational support — dormitories, beds, roll call, exeat, dining, prep, house masters, exeat overdue detection.

---

## Tasks Completed

| Task | Deliverable | Tests | Status |
|---|---|---|---|
| Schema | 9 boarding models added to schema.prisma | — | ✅ DONE |
| BoardingService | Full CRUD + lifecycle + presence event emission | 23 unit tests | ✅ DONE |
| BoardingController | 22 endpoints across all boarding operations | — | ✅ DONE |
| boarding.routes.ts | Routes under /api/v1/boarding/ | — | ✅ DONE |
| ExeatOverdueWorker | Daily 06:00 EAT cron — SMS + in-app alerts | — | ✅ DONE |
| Permissions | 7 new boarding permissions | — | ✅ DONE |
| Migration | 20260804050000_phase5_boarding_module applied | — | ✅ DONE |

---

## Schema Added

```
dormitories              — dorm registry (name, gender, capacity, block)
dormitory_beds           — individual bed tracking (VACANT/OCCUPIED/MAINTENANCE)
dormitory_assignments    — learner ↔ dorm/bed assignment per academic year
house_master_assignments — staff ↔ dorm (PRIMARY/DUTY/MATRON roles)
exeat_requests           — full lifecycle (PENDING→APPROVED→departed→returned)
dorm_roll_calls          — session-level roll call (MORNING/NIGHT)
dorm_roll_call_entries   — per-learner entry within a roll call
dining_attendance        — BREAKFAST/LUNCH/DINNER per learner per day
prep_attendance          — AFTERNOON/EVENING prep per learner per day
```

---

## API Endpoints (27 total under /api/v1/boarding/)

| Route | Method | Permission |
|---|---|---|
| `/` | GET | VIEW_BOARDING | Dashboard overview |
| `/dormitories` | GET/POST | VIEW_BOARDING / MANAGE_DORMITORIES |
| `/dormitories/:id` | PATCH | MANAGE_DORMITORIES |
| `/dormitories/:id/beds` | GET/POST | VIEW_BOARDING / MANAGE_DORMITORIES |
| `/dormitories/:id/house-masters` | GET | VIEW_BOARDING |
| `/assignments` | POST | ASSIGN_DORMITORY_BEDS |
| `/assignments/learner/:id` | GET | VIEW_BOARDING |
| `/house-masters` | POST | MANAGE_HOUSE_MASTERS |
| `/exeat` | GET/POST | VIEW_BOARDING / MANAGE_EXEAT_REQUESTS |
| `/exeat/:id/approve` | POST | MANAGE_EXEAT_REQUESTS |
| `/exeat/:id/depart` | POST | MANAGE_EXEAT_REQUESTS |
| `/exeat/:id/return` | POST | MANAGE_EXEAT_REQUESTS |
| `/roll-calls` | POST | CONDUCT_ROLL_CALL |
| `/roll-calls/:id` | GET | VIEW_BOARDING |
| `/roll-calls/:id/entries` | POST | CONDUCT_ROLL_CALL |
| `/roll-calls/:id/entries/bulk` | POST | CONDUCT_ROLL_CALL |
| `/roll-calls/:id/complete` | POST | CONDUCT_ROLL_CALL |
| `/dining` | POST | CONDUCT_ROLL_CALL |
| `/dining/bulk` | POST | CONDUCT_ROLL_CALL |
| `/prep` | POST | CONDUCT_ROLL_CALL |

---

## Presence Events Emitted by Boarding Module

| Operation | Event |
|---|---|
| markRollCallEntry (PRESENT) | DORM_ROLL_CALL → DORMITORY context |
| recordExeatDeparture | EXEAT_DEPARTED → EXEAT context |
| recordExeatReturn | EXEAT_RETURNED → EXEAT context |
| markDiningAttendance (present=true) | DINING_ATTENDED → DINING_HALL context |
| markPrepAttendance (present=true) | PREP_ATTENDED → PREP_HALL context |

---

## ExeatOverdueWorker

- **Schedule:** Daily 06:00 EAT (03:00 UTC)
- **Detects:** APPROVED exeats whose returnDate < today, departedAt set, returnedAt null, overdueNotified=false
- **Actions:** Parent SMS, in-app to house master + admin, PresenceRuleViolation (EXEAT_OVERDUE)
- **De-duplication:** overdueNotified=true prevents repeated alerts

---

## Cumulative Test Count

| Suite | Tests |
|---|---|
| biometric.encryption | 14 |
| attendance.lock | 24 |
| absent-learner.worker | 15 |
| presence.service | 11 |
| timeline.engine | 21 |
| trip.service | 14 |
| sms-reply.service | 17 |
| chronic-absent.worker | 9 |
| whatsapp-business.service | 19 |
| biometric-attendance.service | 14 |
| zkteco.adapter | 13 |
| boarding.service | 23 |
| **TOTAL** | **194** |

---

## Phase 5 Status

✅ 194 tests passing  
✅ Zero TypeScript diagnostics across all files  
✅ 117 migrations applied — DB up to date  
✅ All 5 boarding presence events wired  
✅ Exeat overdue detection live
