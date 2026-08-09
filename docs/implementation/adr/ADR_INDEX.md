# Architecture Decision Records — Index

This folder contains all Architecture Decision Records (ADRs) for TrendSCORE.

An ADR documents a significant architectural decision: the context, the alternatives considered, the decision made, and its consequences.

Once accepted, an ADR is never deleted. If a decision is reversed, a new ADR supersedes the original and both are kept.

---

## Status Legend

| Status | Meaning |
|---|---|
| PROPOSED | Under discussion — not yet accepted |
| ACCEPTED | Decision made, in effect |
| SUPERSEDED | Replaced by a newer ADR (reference given) |
| DEPRECATED | No longer applicable |

---

## ADR Register

| ID | Title | Status | Date | Reference |
|---|---|---|---|---|
| ADR-001 | Monolith over Microservices | ACCEPTED | Aug 2026 | MAS §17 |
| ADR-002 | Synchronous In-Process Events over Message Broker | ACCEPTED | Aug 2026 | MAS §17 |
| ADR-003 | Webhook-First Biometric Architecture | ACCEPTED | Aug 2026 | MAS §17 |
| ADR-004 | Prisma as the Only ORM | ACCEPTED | Aug 2026 | MAS §17 |
| ADR-005 | AES-256-GCM for Biometric Template Encryption | ACCEPTED | Aug 2026 | MAS §17 |
| ADR-006 | Feature Flags for Progressive Module Rollout | ACCEPTED | Aug 2026 | MAS §17 |
| ADR-007 | Flat Schema File Until Prisma Multi-File Is Stable | ACCEPTED | Aug 2026 | MAS §17 |

---

## How to Add a New ADR

1. Create a new file: `ADR-NNN_short_title.md`
2. Use the template below
3. Add it to this index
4. Reference it from the relevant section of the MAS or companion spec

---

## ADR Template

```markdown
# ADR-NNN — Title

**Status:** PROPOSED | ACCEPTED | SUPERSEDED | DEPRECATED  
**Date:** YYYY-MM-DD  
**Author:** [Name or role]  
**Supersedes:** ADR-XXX (if applicable)  
**Superseded by:** ADR-XXX (if applicable)

## Context

[What is the situation or problem that requires a decision?]

## Decision

[What was decided?]

## Alternatives Considered

### Option A — [Name]
[Description, pros, cons]

### Option B — [Name]
[Description, pros, cons]

## Consequences

[What are the results of this decision? What becomes easier? What becomes harder?]

## Revisit Trigger

[Under what circumstances should this decision be re-evaluated?]
```
