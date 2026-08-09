# Transport Audit — TrendScore

**Date:** August 2026  
**Status:** Read-only forensic review. No code was modified.

---

## 1. Summary

The transport module is **functionally complete for fleet management and student assignment**. It supports vehicles, routes, learner/staff assignment, capacity enforcement, and billing integration. What it **does not support** is attendance — there are no boarding events, no alighting events, and no real-time bus presence tracking.

---

## 2. Files Involved

| File | Purpose | Status |
|---|---|---|
| `server/src/controllers/transport.controller.ts` | Full CRUD for vehicles, routes, assignments; reports | ✅ Active |
| `server/src/routes/transport.routes.ts` | Route definitions | ✅ Active |
| `server/prisma/schema.prisma` → `TransportVehicle`, `TransportRoute`, `TransportAssignment` | Database models | ✅ Active |

No dedicated transport service file — all logic lives in the controller.

---

## 3. What Is Implemented

### Vehicles
- Create, read, update (registration, capacity, driver details, status), soft-delete (archive)
- Registration number uniqueness enforced
- Capacity tracked

### Routes
- Create, read, update (name, description, fee amount, vehicle assignment), soft-delete
- Route ↔ Vehicle relationship (optional — route can exist without a vehicle)
- Amount field (fee per term) used for billing integration

### Assignments (Passengers)
- Assign learner or staff to a route
- `passengerType` supports `LEARNER` and `STAFF`
- Duplicate check — one active assignment per passenger per route
- **Capacity enforcement** — rejects if vehicle is at capacity
- On learner assignment: auto-sets `learner.isTransportStudent = true`
- On learner assignment: updates open fee invoice with transport billing (mid-term sync)
- On learner removal: auto-clears `isTransportStudent` if no other assignments remain
- Assignment fields: `pickupPoint`, `dropoffPoint`

### Reports
- Fleet overview with utilisation per vehicle
- Route utilisation with fill % and capacity status
- Billing totals per route (billed / collected / outstanding / collection rate)
- Grade distribution of transport learners
- Full student transport roster
- Billing aggregated from `fee_invoices.transportBilled/Paid/Balance`

### Summary Stats
- Vehicle count, route count, assignment count
- Transport student count
- Over-capacity routes flag

---

## 4. What Is Missing

| Gap | Severity | Notes |
|---|---|---|
| No boarding/alighting attendance events | HIGH | Students are assigned to routes but no event is logged when they board or alight |
| No GPS support | HIGH | No device integration for real-time bus location |
| No trip management | MEDIUM | No concept of a daily trip — assignments are static roster records |
| No driver app or mobile API | MEDIUM | Drivers cannot report boarding events |
| No attendance integration | HIGH | Transport module cannot generate presence events for the attendance system |
| No `schoolId` on vehicles/routes | MEDIUM | Multi-school transport is unsupported |
| No vehicle maintenance tracking | LOW | Insurance, service, inspection dates not tracked |
| No staff transport report | LOW | Staff assignments exist but not surfaced in reports |
| No route stop management | LOW | Routes have pickup/dropoff per learner but no route stop sequence |

---

## 5. Current Data Flow

```
Admin creates Vehicle
    │
Admin creates Route → assigns Vehicle (optional)
    │
Admin assigns Learner to Route (pickupPoint, dropoffPoint)
    │
Billing: transport fee added to learner's open invoice
    │
Reports: utilisation, roster, billing summary
```

**Nothing happens at bus departure or arrival time.**

---

## 6. Transport as an Attendance Generator

The question is whether transport can produce **attendance events**. Currently it cannot. To achieve this, two approaches are possible:

### Option A — Manual Driver Check-in (Low Cost)
Driver uses a mobile-friendly web page or SMS code to confirm all students on board at departure. System records a `BOARDED` event per learner.

### Option B — Hardware Integration (Higher Cost)
RFID/NFC card readers on the bus scan learner cards as they board. Events push to `/api/biometric/log` with a new direction type (`BOARDED` / `ALIGHTED`). This reuses the existing biometric webhook.

### Option C — Parent Confirmation (No Hardware)
Parent confirms child boarded via WhatsApp / SMS reply. System records a `PARENT_CONFIRMED_BOARDED` event.

**Recommendation:** Option A is the lowest-friction starting point and builds toward Option B over time.

---

## 7. Feasibility: Transport as Presence Engine Source

If a daily trip concept were added:
```
TransportTrip {
  routeId, date, departedAt, arrivedAt, driverId, status
}
TransportBoardingEvent {
  tripId, learnerId, boardedAt, alightedAt, method (SCAN/MANUAL/CONFIRMED)
}
```

Boarding events could be translated to an attendance-adjacent record (or directly used to confirm a learner arrived at school via bus). This is architecturally feasible without breaking existing transport data.

---

## 8. Recommendations

| Action | Priority |
|---|---|
| Add `TransportTrip` model (daily trip concept) | HIGH (for attendance integration) |
| Add `TransportBoardingEvent` model (scan or manual board confirm) | HIGH |
| Add `schoolId` to vehicles and routes | MEDIUM |
| Build driver mobile check-in page (minimal, phone-friendly) | MEDIUM |
| Surface staff transport in reports | LOW |
| Add vehicle maintenance fields | LOW |
