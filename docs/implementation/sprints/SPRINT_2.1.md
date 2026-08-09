# Sprint 2.1 — Transport Events

**Phase:** 2  
**Sprint:** 2.1  
**Completed:** August 2026  
**Goal:** Transport module generates presence data. Bus boarding/alighting tracked daily. BUS_NO_ARRIVAL anomaly detection foundation laid.

---

## Tasks Completed

| Task ID | Title | Tests | Status |
|---|---|---|---|
| Schema | TransportTrip + TransportBoardingEvent models | — | ✅ DONE |
| Schema | schoolId on TransportVehicle + TransportRoute | — | ✅ DONE |
| TripService | Full CRUD + boarding logic + presence emit | 14 unit tests | ✅ DONE |
| TripController | 7 endpoints (trip management + boarding) | — | ✅ DONE |
| trips.routes.ts | Route definitions under /api/v1/transport/trips/ | — | ✅ DONE |
| Permissions | MANAGE_TRANSPORT_TRIPS, VIEW_TRANSPORT_TRIPS, RECORD_BOARDING_EVENTS | — | ✅ DONE |

---

## Files Created

```
server/src/domains/transport/trip.service.ts          ← TripService + business logic
server/src/domains/transport/trip.service.test.ts     ← 14 unit tests
server/src/domains/transport/trip.controller.ts       ← TripController
server/src/routes/trips.routes.ts                     ← route definitions
```

## Schema Changes

```
TransportVehicle   + schoolId (nullable)
TransportRoute     + schoolId (nullable), trips relation
TransportTrip      NEW — daily run concept
TransportBoardingEvent  NEW — per-learner boarding/alighting
```

## Files Modified

```
server/prisma/schema.prisma          ← 2 new models, schoolId on existing models
server/src/config/permissions.ts     ← 3 transport trip permissions
server/src/routes/index.ts           ← /api/v1/transport/trips registered
```

---

## API Endpoints Live

| Route | Method | Permission | Description |
|---|---|---|---|
| `/api/v1/transport/trips` | POST | MANAGE_TRANSPORT_TRIPS | Create or get trip for route/date/direction |
| `/api/v1/transport/trips` | GET | VIEW_TRANSPORT_TRIPS | List trips for a route |
| `/api/v1/transport/trips/:id` | GET | VIEW_TRANSPORT_TRIPS | Single trip with boarding events |
| `/api/v1/transport/trips/:id/status` | PATCH | MANAGE_TRANSPORT_TRIPS | Update trip status |
| `/api/v1/transport/trips/:id/manifest` | GET | VIEW_TRANSPORT_TRIPS | Driver boarding manifest |
| `/api/v1/transport/trips/:id/board` | POST | RECORD_BOARDING_EVENTS | Record single boarding/alighting |
| `/api/v1/transport/trips/:id/board/bulk` | POST | RECORD_BOARDING_EVENTS | Bulk boarding confirmation |

---

## Presence Events Emitted

| Event | Trigger |
|---|---|
| `BUS_BOARDED` | `recordBoardingEvent({ eventType: 'BOARDED' })` |
| `BUS_ALIGHTED` | `recordBoardingEvent({ eventType: 'ALIGHTED' })` |

Both events carry `metadata.tripId`, `metadata.routeName`, `metadata.direction`, `metadata.vehicleReg`.

---

## Driver Workflow

```
Admin creates Trip (POST /api/v1/transport/trips)
    ↓
Driver views manifest (GET /:id/manifest)
    ↓
Driver confirms all students boarded (POST /:id/board/bulk)
    ↓
Trip auto-transitions SCHEDULED → IN_PROGRESS
    ↓
BUS_BOARDED presence event per learner
    ↓
Parent timeline: "Boarded Route 3 Bus (to school)"
```

## Key Test Coverage

- `getOrCreateTrip`: returns existing, creates new, throws on bad route
- `updateTripStatus`: updates with timestamps, throws on unknown trip
- `recordBoardingEvent`: creates event, transitions status, emits BUS_BOARDED/BUS_ALIGHTED, throws on unassigned learner, throws on cancelled trip, presence failure is non-blocking
- `bulkRecordBoarding`: ok for assigned, skipped for unassigned

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
| **TOTAL** | **99** |

---

## Migration Command (staging)

```bash
cd server
npx prisma migrate dev --name phase_2_transport_trips
```

This will create migrations for:
- `schoolId` on `transport_vehicles` and `transport_routes`  
- New `transport_trips` table
- New `transport_boarding_events` table
