# Presence & Movement v2 — Data Model

```text
Attendance / BiometricLog / DormRollCallEntry / ExeatRequest / TransportBoardingEvent
                                  │ authoritative source records
                                  ▼
                           PresenceOutbox → PresenceEvent
                                                   │
                   LearnerPresenceProfile ─────────┼── PresenceExpectation
                   PresenceLocation ───────────────┼── PresenceCurrentState
                                                   └── PresenceException
```

Source rows remain authoritative. `PresenceEvent` is an immutable, attributable fact projection; corrections supersede a fact instead of erasing it. Expectations/current state are rebuildable materializations.

| Entity | Key purpose |
|---|---|
| `LearnerPresenceProfile` | effective-dated DAY/BOARDING mode and policy set. |
| `PresenceLocation` | normalized gate/dorm/class/bus/stop; optional geometry. |
| evolved `PresenceEvent` | typed event/context/status; occurred/received time; source; verification/trust; location; correlation/causation; supersession. |
| `PresenceOutbox` | atomically persisted source event awaiting publication/retry. |
| `PresenceExpectation` | person, checkpoint/window, policy version, PENDING/MET/MISSED/EXCUSED/WAIVED and supporting fact. |
| `PresenceCurrentState` | current qualified state, confidence, as-of/valid-until and evidence facts. |
| `PresenceException` | type/severity, link to expectation/fact, owner and audited lifecycle. |
| transport stops/manifests/telemetry | topology, daily intent snapshot and vehicle-only GPS facts. |

Lifecycle: source transaction + outbox → schema/tenant/idempotency validation → immutable fact with trust → expectation match → current-state resolution → deduplicated exception → audited correction/recompute.

Example event:

```json
{"eventType":"BUS_BOARD","personId":"learner-42","occurredAt":"2026-08-12T04:58:00Z","locationId":"stop-kahawa","source":{"module":"TRANSPORT","recordId":"board-9"},"verification":"QR","trust":"HIGH","correlationId":"trip-outbound-7"}
```

Add columns/tables as nullable/additive first, backfill only reliable data, dual-write behind flags and validate parity before constraints. Do not alter `Attendance` uniqueness, delete `PresenceRuleViolation`, or modify biometric template encryption.
