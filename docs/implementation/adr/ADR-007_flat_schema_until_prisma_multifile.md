# ADR-007 — Flat Schema File Until Prisma Multi-File Is Stable

**Status:** ACCEPTED  
**Date:** August 2026  
**Author:** Chief Software Architect  
**Referenced in:** MAS §7.9, MAS §17

---

## Context

The Prisma schema (`server/prisma/schema.prisma`) is a single large file containing all models. As TrendSCORE 2.0 adds new tables (presence events, boarding module, transport trips — 22+ new migrations), this file will grow further and become harder to navigate.

Prisma 5+ introduced multi-file schema support as a preview feature. The question is whether to adopt it now.

---

## Decision

The schema **remains as a single file** until Prisma declares multi-file schema support as **Generally Available (GA)**. The target domain-split structure is documented in MAS §7.9 as the future state, but not executed yet.

---

## Alternatives Considered

### Option A — Split Now Using Preview Feature

Use `prisma.config.ts` and the `schemaPath` array to split into domain-scoped files now.

**Pros:**
- Better organisation immediately
- Developers can find their domain's models faster
- Smaller diffs per migration

**Cons:**
- Preview features can change APIs between minor versions without deprecation warnings
- Prisma's migration tooling with multi-file schema has known edge cases in preview
- CI/CD migrations (`prisma migrate deploy`) behaviour with multi-file is not yet fully documented for production
- Risk of a breaking Prisma upgrade during a production migration window
- The audit found no evidence of problems navigating the current schema — the pain is anticipated, not yet real

### Option B — Manual Include Script

Write a build script that concatenates domain schema files into one `schema.prisma` before Prisma operations.

**Rejected:** Fragile, non-standard, breaks IDE Prisma language server support, confusing for new developers.

### Option C — Stay Single File with Better Organisation (Chosen)

Maintain the single file with clear section comments. Add all new models with their section headers. The file is large but navigable.

**Pros:**
- No risk from experimental Prisma features
- Consistent with existing codebase conventions
- IDE support (VSCode Prisma extension) fully supported on single file
- Migration tooling is battle-tested on single-file schemas

**Cons:**
- File will grow to 3000+ lines
- Harder to get a mental model of a single domain's schema without scrolling

---

## Consequences

- All new Prisma models are added to `server/prisma/schema.prisma` with clear section comments:
  ```
  // ── Presence Platform ────────────────────────────────────────────────────
  model PresenceEvent { ... }
  model PresenceRule { ... }
  
  // ── Boarding Module ───────────────────────────────────────────────────────
  model Dormitory { ... }
  ```
- Each new domain section includes a brief comment describing what the section covers
- The schema is never auto-formatted in a way that removes section comments
- This decision is reviewed when Prisma multi-file reaches GA

---

## Revisit Trigger

- Prisma announces multi-file schema as GA (no longer preview)
- Schema reaches 5000+ lines and developer complaints about navigation become frequent
- A Prisma upgrade in a staging environment proves multi-file is stable enough for production risk
