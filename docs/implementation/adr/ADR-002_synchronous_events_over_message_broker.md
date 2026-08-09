# ADR-002 — Synchronous In-Process Events over Message Broker

**Status:** ACCEPTED  
**Date:** August 2026  
**Author:** Chief Software Architect  
**Referenced in:** MAS §9.1, MAS §17, EVENT-001 §1

---

## Context

The Presence Platform requires that when any domain module records a presence fact (attendance mark, clock-in, bus boarding, dorm roll call), a corresponding `PresenceEvent` is written to the central `presence_events` table.

The core question: how should the domain module notify the Presence Platform that an event occurred?

---

## Decision

Presence events are written **synchronously inside the same Prisma transaction** as the primary domain write. `PresenceService.emit()` is a direct method call — not a message published to a queue or broker.

```typescript
const result = await prisma.$transaction(async (tx) => {
  const attendance = await tx.attendance.create({ ... });
  await presenceService.emit({ ... }, tx);
  return attendance;
});
```

---

## Alternatives Considered

### Option A — Redis Streams / Bull Queue (Async)

Domain module pushes event to a Redis queue. A consumer worker picks up the event and writes to `presence_events`.

**Pros:**
- Decouples producer from consumer
- Consumer can be scaled independently
- Domain write succeeds even if presence write is slow

**Cons:**
- Adds Redis as a required infrastructure dependency for presence to work (currently Redis is optional)
- Events are no longer atomic with the domain write — attendance can be marked without a corresponding presence event if the queue is unavailable
- Consumer lag means the parent timeline is stale until the queue is drained
- Adds significant complexity to local development setup
- Debugging requires tracing across the queue boundary

### Option B — PostgreSQL LISTEN/NOTIFY

Domain module inserts attendance record. A DB trigger fires `NOTIFY`. A listener process picks up the notification and writes the presence event.

**Pros:**
- No additional infrastructure beyond the existing database
- Genuinely async

**Cons:**
- Pg NOTIFY delivers the notification ID only — the listener must re-query the database for the payload
- Adds complexity to connection management (persistent LISTEN connection)
- Missed notifications if listener is down (LISTEN/NOTIFY has no message persistence)
- Harder to test in isolation

### Option C — Synchronous Direct Call (Chosen)

`PresenceService.emit()` is called directly inside the domain service method, in the same transaction.

**Pros:**
- Atomic: attendance record and presence event are written together or not at all
- No additional infrastructure
- Trivial to test: mock `presenceService.emit` in unit tests
- Parent timeline is immediately consistent after the domain write
- Simple to reason about and debug

**Cons:**
- Presence write adds latency to the domain write (negligible: a single PostgreSQL INSERT)
- If the presence table has a constraint failure (duplicate dedup), the event emit returns gracefully — this is designed for
- Does not scale to async fan-out (multiple consumers of one event)

---

## Consequences

- Atomicity is guaranteed: no attendance mark without a presence event, and vice versa
- `PresenceService.emit()` failure handling must be non-blocking — failure logs to `presence_event_failures` and does not rollback the domain write
- Side effects (SMS, push notifications) remain OUTSIDE the transaction — they are triggered after the transaction commits
- A nightly `PresenceReconciliationWorker` processes any records in `presence_event_failures`

---

## Revisit Trigger

- Presence event volume exceeds 1 million rows/day across all schools
- A requirement emerges for multiple independent consumers of the same event (e.g. analytics service, third-party integration)
- Presence write latency measurably degrades domain write performance under load test
