# ADR-004 — Prisma as the Only ORM

**Status:** ACCEPTED  
**Date:** August 2026  
**Author:** Chief Software Architect  
**Referenced in:** MAS §17, TECH-001 §5

---

## Context

TrendSCORE's backend uses Prisma throughout its 60+ controllers and services. As the system grows and new modules are added, some complex queries (analytics aggregations, presence event queries with multi-dimensional filters) could be argued to be better expressed in raw SQL or a query builder.

The question: should we introduce a second data access library for complex queries?

---

## Decision

**Prisma is the only ORM and data access layer.** Complex queries that cannot be expressed cleanly in Prisma's fluent API are written using `prisma.$queryRaw()` with parameterised inputs. Raw query methods are isolated in dedicated `*.repository.ts` files in their respective domain folder.

---

## Alternatives Considered

### Option A — Knex.js for Complex Queries

Add Knex as a secondary query builder alongside Prisma for analytics and reporting queries.

**Pros:** More expressive for complex SQL, familiar to SQL developers

**Cons:**
- Two mental models for database access in the same codebase
- Developers must decide which library to use — decision fatigue and inconsistency
- Type safety is weaker in Knex (no generated types)
- Two connection pool configurations to manage
- Knex and Prisma can conflict on transaction boundaries

### Option B — Raw pg Driver for Analytics

Use the `pg` driver directly for analytics queries (reporting, snapshots).

**Pros:** Maximum SQL flexibility, no abstraction overhead

**Cons:**
- Loses all Prisma type safety and generated types
- No migration management through pg directly
- Manual result mapping required
- Harder to test (no Prisma mock)

### Option C — Prisma Only with $queryRaw for Complex Cases (Chosen)

All data access through Prisma. Complex aggregations use `$queryRaw` with explicit type annotations. These are isolated in `*.repository.ts` files.

**Pros:**
- Single library, single mental model, consistent across 60+ existing files
- `$queryRaw` supports any SQL while keeping Prisma's connection management
- Parameterised queries prevent SQL injection
- Repository pattern isolates complex queries — they're findable and testable

**Cons:**
- `$queryRaw` results require manual type casting (`Prisma.sql` template literal)
- Some complex CTEs are verbose to write through Prisma

---

## Consequences

- Any new data access code uses Prisma
- Complex analytics queries go in `{domain}.repository.ts` files using `$queryRaw`
- All `$queryRaw` queries must use `Prisma.sql` template literals (parameterised) — never string concatenation
- A `findMany` without a meaningful `where` clause requires a code comment explaining why it's acceptable
- The `take` limit is mandatory on all `findMany` queries that could return unbounded rows

---

## Revisit Trigger

- Prisma's query performance becomes a measurable bottleneck on analytics queries (>500ms for reporting endpoints)
- A time-series analytics requirement emerges that is genuinely better served by a dedicated analytics database (ClickHouse, TimescaleDB)
