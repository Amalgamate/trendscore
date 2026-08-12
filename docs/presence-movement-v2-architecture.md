# TrendSCORE Learner Presence & Movement v2 — Architecture Audit

## Executive summary

**Agreement: 85%.** The proposal's product model is right: attendance, identity evidence, boarding, transport, movement and current presence must not become independent systems. TrendSCORE already has the beginning of that architecture: `PresenceEvent`, `PresenceRule`, violations/failures, a shared `PresenceService`, timeline, boarding workflows, transport trips and boarding events.

The important adjustment is to preserve each source module as authoritative. Presence should be an attributable event projection and interpretation layer, not a replacement database for attendance, biometric scans, exeats or transport operations. The next milestone is expected-versus-observed state on top of the current event projection—not a rewrite.

## Current architecture discovered

| Area | Current implementation | Finding |
|---|---|---|
| Attendance | `Attendance` has one learner/day record, locking, statuses, reports and `CLASS_ATTENDANCE` projection | It is daily attendance, not per-period attendance: its unique key prevents multiple class periods. |
| Biometrics | device registry, encrypted credentials, face sessions, logs, bridge and offline terminal | Strong foundation. A verified scan becomes gate entry/exit, but terminal purpose/location semantics are missing. |
| Presence | `PresenceEvent`, `PresenceRule`, violation/failure tables, timeline, analytics/dashboard | A real shared event projection exists; dashboard still reports attendance, not current state. |
| Boarding | dorms/beds/assignments, exeat, roll call, dining/prep, parent SMS and overdue worker | Mature source workflows. Positive outcomes emit events; many negative outcomes stay only in source rows. |
| Transport | vehicles, routes, assignments, trips, boarding events and trips API | Trips/scan API exist, but no stops, manifest snapshot, driver scan UI, real GPS or transport expectation engine. |
| Staff | HR staff attendance and clock event projection | Share infrastructure but use a roster/shift policy, not learner presence rules. |

The app still has legacy `/api/transport`, `/api/attendance`, `/api/biometric` routes alongside newer `/api/v1/presence`, `/api/v1/transport/trips` and `/api/v1/boarding`. Preserve them until compatible v2 consumers exist.

## Gap, duplication and conflicts

- `PresenceDashboard` uses presence APIs but reports class-attendance counts and calls an empty attendance list “all learners accounted for.” Rename it to Attendance Overview until v2 state is live.
- Legacy `HostelAllocation` is under `pages/transport` even though Boarding owns newer dorm assignments. Move its navigation only after feature-parity confirmation.
- The legacy transport manager and new trip APIs are separate generations; the frontend transport API has no trip/manifest methods.
- `PresenceEvent` uses free-text type/context/state fields; it lacks trust/confidence, explicit effective/superseded lifecycle, correlation/causation IDs and normalized locations.
- Its `[schoolId, personId, eventType, timestamp]` uniqueness may collapse distinct simultaneous scans. Source-record idempotency should be primary.
- Some event writes are fire-and-forget despite the service design saying transactional; failures are recorded but projection can lag a successful source write.
- Day/boarding mode is inferred from assignments, not modeled or effective-dated. No expected checkpoint model exists.
- Transport lacks stops/windows, direction/day assignments, manifest snapshots, telemetry/geofences and unexpected/missed passenger workflows.
- Socket.IO provides notification/chat rooms only. No school presence event feed exists, despite the dashboard claiming real-time updates.

## Recommended Presence & Movement architecture

Use source → fact → interpretation:

1. Attendance, biometric, boarding and transport write their authoritative source record.
2. A transactional outbox/projector emits immutable presence facts with provenance.
3. A policy planner materializes learner expectations for time windows/checkpoints.
4. Resolver processes facts against expectations into current qualified state and exceptions.

Keep source screens distinct but use shared learner context: timeline, latest trusted status, expectations and exception queue.

## Recommended navigation/UI hierarchy

- **Presence & Movement:** overview, exception queue, movement register, learner timeline.
- **Attendance:** daily/class register, staff attendance, reports and settings.
- **Identity & Biometrics:** enrollment, terminals, data feed/logs and bridge.
- **Boarding:** overview, dormitories/allocations, roll call, dining/prep and exeat.
- **Transport:** overview, routes/stops, vehicles/drivers, trips/manifests, scan mode, GPS and reports.

## Day, boarding and staff behaviour matrix

| Person/workflow | Expected checkpoints | Principal exceptions |
|---|---|---|
| Day learner | arrival, class attendance, approved exit | late/missing arrival, unexpected exit, unaccounted. |
| Day learner on bus | assigned pickup/board, school arrival, class, afternoon board/alight | missed/extra boarding, no arrival after bus, late. |
| Boarder | morning/night roll call, class, configured dining/prep | missing roll call, conflicting off-campus evidence, overdue exeat. |
| Staff | roster/leave/clock in/out | shift compliance; do not infer learner-style location. |

Rules must be effective-dated, calendar-aware and scoped by cohort, class, dormitory or route. An expected presence is a scheduled claim, not an inferred event.

## Presence/Event domain model and minimal safe schema change

Keep current source tables and add only additive structures:

- `LearnerPresenceProfile`: learner, `DAY|BOARDING`, policy, effective dates.
- `PresenceLocation`: normalized gate/dorm/class/bus/stop and optional geometry.
- Evolve `PresenceEvent`: typed event/context/status, occurred/received timestamps, location reference, verification/trust/confidence, correlation/causation and supersession lifecycle; retain legacy columns during migration.
- `PresenceOutbox`: source transaction, payload, publish/retry state.
- `PresenceExpectation`: person/date/checkpoint/window/policy/status and supporting events.
- `PresenceCurrentState`: recalculable state, confidence/as-of time and evidence IDs.
- `PresenceException`: typed open/acknowledged/resolved/dismissed workflow; evolve/federate `PresenceRuleViolation` rather than deleting it.
- Transport: `TransportStop`, ordered `RouteStop`, effective route assignments, `TripManifestEntry`, telemetry and richer boarding event fields.

Add nullable columns/tables and indexes; infer/backfill from reliable sources; dual-write behind feature flags; reconcile; only then constrain fields. Do not change `Attendance` uniqueness, delete source tables, or modify biometric template storage.

## Transport attendance workflow

1. Planner snapshots active effective assignments into outbound/inbound manifests, with stops and windows.
2. Driver starts trip; GPS telemetry is recorded separately from learner facts.
3. QR/ID/manual scan at pickup creates `BUS_BOARD` linked to trip, manifest entry and stop. Out-of-manifest scans open an exception and require supervised override.
4. School arrival is satisfied by alighting or trusted gate evidence; class attendance remains an academic fact.
5. Afternoon repeats for campus departure, board, stop and alight.
6. Complete trip locks normal manifest edits but allows audited correction/dispute.
7. GPS corroborates vehicle progress/ETA; it must not claim a learner is onboard without learner-level evidence.

## Biometric, boarding, timeline and intelligence

Biometrics should first emit `BIOMETRIC_IDENTIFIED` with modality, terminal, location, match/liveness and trust. A terminal-purpose policy maps that evidence to gate, dorm or dining observations; no scan is assumed to be a gate scan. Boarding remains authoritative for allocation, exeat and roll-call; project all outcomes, while treating exeat as an authorized expectation waiver/interval.

Timeline should combine facts, state intervals, scheduled checkpoints, source/verification/confidence and corrections. Initial exception rules: missing/late arrival, missing class, missed dorm roll call, overdue exeat, missed assigned bus, unexpected boarding, unapproved exit, conflicting locations and unaccounted learner. Each needs grace periods, evidence threshold, deduplication, owner and resolution reason.

Use role-specific access (attendance marker, gate operator, driver, house master, transport manager, safeguarding officer, parent) and protect raw biometric/location data. Publish post-commit projected events to school/learner Socket.IO rooms; REST remains reconciliation. SMS/WhatsApp/push should be policy adapters. AI may summarize evidence but cannot determine presence or discipline.

## Migration strategy and phased plan

1. Harden existing projection: vocabulary, terminal purpose/location, source idempotency, outbox/retry, parity tests.
2. Add profiles/locations/effective assignments and reconciliation reports; do not enforce rules.
3. Add expectations/current state/exceptions in shadow mode and measure false positives.
4. Integrate attendance, biometric, boarding and manifests one source at a time while retaining all legacy writes/APIs.
5. Add v2 screens under flags; migrate navigation only at workflow parity.
6. Add GPS and high-impact communications after data quality/privacy/escalation workflows are proven.

## Risks

False unaccounted alerts, tenant scoping in legacy services, timezone boundaries, duplicate/offline scans, staff/learner identity ambiguity, biometric privacy, event lag and destructive migration are the main risks. Track projection lag/failures, reconciliation mismatches, false positives, override rates and unresolved-exception aging.

## RECOMMENDED ACTION PLAN

1. **KEEP:** all source workflows/tables, `PresenceService`, timeline, biometric security, notification service, migration history and legacy APIs.
2. **MERGE:** learner context and exception workflow—not independent source modules; converge legacy/new transport UI on trips/manifests.
3. **RENAME:** current Presence Overview to Attendance Overview until state exists, then Presence & Movement Overview.
4. **MOVE:** hostel allocation navigation to Boarding; GPS under Transport; biometrics remains identity.
5. **BUILD:** outbox, expectation/state/exception layers, locations, stops/manifests, driver scanning and eventual event feed.
6. **DO NOT TOUCH YET:** attendance key/reports, biometric credential storage, parent alert semantics, source tables/endpoints or production migrations.
7. **ORDER:** projection hardening → profiles/assignments → shadow expectations → manifests/scans → state/exceptions → dashboard/navigation → GPS → communications/AI.
