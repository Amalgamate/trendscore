# ADR-001 — Monolith over Microservices

**Status:** ACCEPTED  
**Date:** August 2026  
**Author:** Chief Software Architect  
**Supersedes:** —  
**Referenced in:** MAS §17, TECH-001 §2

---

## Context

TrendSCORE serves individual schools as tenants. The team is small (fewer than 10 engineers). Operational infrastructure is managed by a small DevOps capacity.

As TrendSCORE 2.0 introduces new domains (Presence Platform, Boarding, Transport Events, Biometrics), the question arises: should these be extracted as separate services?

---

## Decision

TrendSCORE 2.0 remains a **layered monolith**. Domain separation is enforced through code conventions (bounded contexts, no cross-domain DB queries, event-based cross-cutting concerns) rather than network boundaries.

The cron worker is deliberately separated as a second process — this captures the key benefit of process isolation for background jobs without the overhead of a full microservices architecture.

---

## Alternatives Considered

### Option A — Full Microservices

Each domain (Attendance, HR, Biometrics, Transport, Boarding, Presence) as a separate deployable service.

**Pros:**
- Independent scaling per domain
- Fault isolation between services
- Independent deployment cadence

**Cons:**
- Requires service mesh or API gateway
- Distributed tracing infrastructure needed
- Each inter-service call adds latency and failure mode
- Database-per-service means complex distributed transactions (attendance + presence event atomicity)
- Team must maintain N deployment pipelines, N docker images, N sets of health checks
- Debugging across service boundaries requires centralised logging (Datadog, ELK, etc.)
- Prohibitively complex for a team of fewer than 10 at current school volume

### Option B — Modular Monolith with Two Processes (Chosen)

Single deployable application with domain-enforced boundaries internally. Background processing in a separate process.

**Pros:**
- Single deployment pipeline
- Atomic cross-domain writes (Prisma $transaction)
- Easy local development
- Simpler debugging — single log stream
- Domain separation enforced by code review, not network topology

**Cons:**
- Cannot scale individual domains independently
- A bug in one domain can affect response latency of others
- Single-process HTTP server is a bottleneck if load grows significantly

### Option C — Monolith + BFF (Backend for Frontend)

Keep the monolith but add a separate BFF (Backend for Frontend) for the parent mobile portal.

**Assessment:** Premature optimisation. The parent portal's API surface is small and well-defined. It can be implemented as a distinct route group within the monolith with its own permission scope. Revisit if the parent portal's scale or latency requirements diverge significantly.

---

## Consequences

- Cross-cutting concerns (Presence Platform) are implemented as service layers within the monolith
- Socket.io will require a Redis adapter if the HTTP server is scaled horizontally
- Schema migrations must handle all domains simultaneously — requires the discipline documented in DB-001
- The monolith constraint makes it essential to enforce bounded context rules in code review

---

## Revisit Trigger

- Team grows beyond 10 engineers maintaining different domains independently
- More than 50 school tenants with meaningfully different scaling requirements per domain
- Regulatory requirement to isolate biometric processing in a separate compute boundary
