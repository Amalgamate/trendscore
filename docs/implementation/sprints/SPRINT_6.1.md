# Sprint 6.1 — Analytics & Intelligence

**Phase:** 6 (FINAL)  
**Sprint:** 6.1  
**Completed:** August 2026  
**Goal:** Admin presence analytics dashboard, AI early warning, NEMIS integration, county reporting foundation.

---

## Tasks Completed

| Task | Deliverable | Tests | Status |
|---|---|---|---|
| 6.1 | PresenceAnalytics — 6 aggregation functions | 12 unit tests | ✅ DONE |
| 6.2 | EarlyWarningService — 4 signal detectors | Verified by diagnostics | ✅ DONE |
| 6.3 | NEMISService — term attendance export | 7 unit tests | ✅ DONE |
| 6.4 | AnalyticsController — 10 endpoints | — | ✅ DONE |
| — | analytics.routes.ts | — | ✅ DONE |
| — | VIEW_PRESENCE_ANALYTICS + SUPER_ADMIN_ONLY permissions | — | ✅ DONE |
| — | Early warning nightly cron (23:00 UTC) | — | ✅ DONE |

---

## Files Created

```
server/src/domains/presence/presence.analytics.ts         ← 6 analytics functions
server/src/domains/presence/presence.analytics.test.ts    ← 12 unit tests
server/src/domains/presence/early-warning.service.ts      ← 4-signal early warning
server/src/domains/presence/nemis.service.ts              ← NEMIS term export
server/src/domains/presence/nemis.service.test.ts         ← 7 unit tests
server/src/domains/presence/analytics.controller.ts       ← 10 endpoints
server/src/routes/analytics.routes.ts                     ← route definitions
```

## Files Modified

```
server/src/config/permissions.ts   ← VIEW_PRESENCE_ANALYTICS, SUPER_ADMIN_ONLY
server/src/routes/index.ts         ← /api/v1/analytics registered
server/src/cron-worker.ts          ← early warning nightly cron
```

---

## Analytics Endpoints (10 total under /api/v1/analytics/)

| Route | Description |
|---|---|
| `GET /attendance/daily?daysBack=14` | Daily rates for past N days |
| `GET /attendance/weekly?weeksBack=8` | Weekly absence trend |
| `GET /attendance/by-grade` | Today's rate broken down by grade |
| `GET /late-patterns?daysBack=14` | Late arrival patterns by grade |
| `GET /school/overview` | Combined dashboard snapshot |
| `GET /boarding/compliance?daysBack=7` | Roll call compliance |
| `GET /at-risk?daysBack=28&limit=50` | At-risk learners ranked by score |
| `POST /early-warning/run` | Trigger all checks manually |
| `GET /early-warning/violations` | List unresolved violations |
| `POST /early-warning/violations/:id/resolve` | Resolve a violation |
| `GET /nemis/report?term=TERM_1&academicYear=2026` | NEMIS term export |

---

## Presence Analytics Functions

| Function | Description |
|---|---|
| `getDailyAttendanceRates()` | Daily rates per day with present/absent/late/unmarked counts |
| `getWeeklyAbsenceTrend()` | ISO week labels with avg rate + total absences |
| `getAtRiskLearners()` | Ranked by absence rate with risk score and level |
| `getGradeAttendanceSummary()` | Per-grade present count + rate for today |
| `getLateArrivalPatterns()` | Late count by grade over rolling window |
| `getBoardingComplianceStats()` | Roll call completion + absent counts per dorm |

---

## Early Warning Signals (4)

| Signal | Rule Code | Trigger |
|---|---|---|
| Chronic absence | CHRONIC_ABSENT | >20% absence rate over 28 days, ≥5 marked days |
| Late pattern | LATE_PATTERN | Late 3+ times in rolling 5 days |
| Dorm abscond | DORM_ABSCOND | Present in class but absent from night roll call |
| Bus no arrival | BUS_NO_ARRIVAL | BUS_BOARDED but no CLASS_ATTENDANCE within 90 min |

All signals create PresenceRuleViolations (de-duplicated) and notify class teacher + head teacher.

---

## NEMIS Integration

- Generates per-learner attendance summary for a term
- Uses `upiNumber` as NEMIS identifier
- Reports: daysPresent, daysAbsent, daysLate, attendanceRate, term, academicYear
- Marks `NOT_ASSIGNED` when learner has no UPI number
- Summary includes learnersWithUpi / learnersWithoutUpi (data quality indicator)
- Actual API submission deferred until NEMIS credentials are available

---

## Cumulative Test Count — All Phases

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
| presence.analytics | 12 |
| nemis.service | 7 |
| **TOTAL** | **213** |

---

## Phase 6 Status

✅ 213 tests passing  
✅ Zero TypeScript diagnostics across all files  
✅ 117 migrations applied — DB up to date  
✅ No new migrations needed (reads from existing tables)

---

## All Phases Complete

| Phase | Theme | Status |
|---|---|---|
| Phase 0 | Security & Critical Gaps | ✅ |
| Phase 1 | Presence Platform Foundation | ✅ |
| Phase 2 | Transport Events | ✅ |
| Phase 3 | Guardian Portal | ✅ |
| Phase 4 | Biometrics Completion | ✅ |
| Phase 5 | Boarding Module | ✅ |
| Phase 6 | Analytics & Intelligence | ✅ |
