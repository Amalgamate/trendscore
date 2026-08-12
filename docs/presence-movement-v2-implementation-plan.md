# Presence & Movement v2 — Safe Implementation Plan

## Phase 0 — Stabilize and measure

Inventory production use, test tenancy/timezones, expose projection lag/failures and reconcile events to source records. No behaviour change.

## Phase 1 — Core event foundation

Add vocabulary/constants, terminal purpose/location, outbox/projector, source idempotency and correction lifecycle. Preserve all current event columns and emitters.

## Phase 2 — Attendance integration

Reliably project daily register changes and distinguish daily/class/period semantics. Keep locks, reports and parent notifications.

## Phase 3 — Biometric integration

Record identity evidence first, then map terminal policy to semantic observations. Preserve liveness/confidence/offline/manual-review states.

## Phase 4 — Boarding integration

Infer presence profiles from active dorm assignments, project all roll-call outcomes and authorized exeats, then run rules in shadow mode.

## Phase 5 — Transport register

Add stops, effective assignments and manifests; deliver trip/driver scan UI and audited missed/unexpected passenger workflow. Retain legacy transport API.

## Phase 6 — GPS

Add telemetry/geofences only after provider/device contracts, retention policy and test data. GPS never creates learner presence alone.

## Phase 7 — Intelligence

Materialize expectations/current state, establish false-positive targets and resolution workflow, then enable overview and real-time feeds.

## Phase 8 — Parent communication and AI

Use consent-aware, deduplicated policy notifications through existing adapters. Add AI summaries only with deterministic evidence and audit trails.

Every phase requires feature flags, additive migration review, role/privacy tests, source/projection parity checks, observability and rollback.
