# ADR-006 — Feature Flags for Progressive Module Rollout

**Status:** ACCEPTED  
**Date:** August 2026  
**Author:** Chief Software Architect  
**Referenced in:** MAS §14.4, MAS §17

---

## Context

TrendSCORE 2.0 introduces new modules that are not relevant to all schools:
- Boarding module — only for boarding schools
- Biometric integration — only for schools with hardware devices
- Presence Platform — relevant to all schools but should be opt-in during rollout
- WhatsApp Business — only for schools with WABA credentials

Shipping these modules as always-on for all schools would confuse administrators, expose half-built interfaces, and potentially surface errors in schools that have no need for the feature.

---

## Decision

New modules are controlled by **per-school feature flags** stored in a `school_feature_flags` table. Feature flag checks are evaluated at the controller entry point and return `403 FEATURE_DISABLED` if the module is not enabled for that school.

---

## Alternatives Considered

### Option A — Separate Deployments per School Type

Maintain separate builds for day schools and boarding schools.

**Rejected:** Immediate divergence in codebase. N deployment pipelines. Bug fixes must be applied to N versions. Not sustainable.

### Option B — Always-On for All Schools

Ship all modules enabled for all schools.

**Cons:**
- A day school admin sees dormitory management, boarding roll call, exeat — all irrelevant and confusing
- Half-built boarding module creates broken UI for schools that have no boarding students
- No way to do a gradual rollout with specific schools as early adopters

### Option C — Environment-Level Feature Flags

Different environment variables per deployment enable/disable features.

**Cons:**
- A single TrendSCORE instance serves multiple schools — environment-level flags apply to all schools equally
- Cannot enable boarding for School A but not School B on the same deployment

### Option D — Per-School Database Flags (Chosen)

```sql
CREATE TABLE school_feature_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  TEXT NOT NULL,
  flag       TEXT NOT NULL,         -- e.g. 'BOARDING', 'BIOMETRICS', 'PRESENCE'
  enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_at TIMESTAMPTZ,
  enabled_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, flag)
);
```

**Pros:**
- Per-school granularity — enable boarding for School A, not School B
- Gradual rollout to specific pilot schools
- Can be toggled by super admin without a deployment
- Easy to audit (who enabled what, when)
- Feature flag check is a cheap DB query, cacheable in Redis

**Cons:**
- Additional DB table and query per controller entry point
- Adds a pattern that developers must remember to apply on new modules

---

## Consequences

- Every new module's controller entry point includes:
  ```typescript
  const isEnabled = await featureFlagService.isEnabled(req.user.schoolId, 'MODULE_NAME');
  if (!isEnabled) throw new ApiError(403, 'FEATURE_DISABLED', 'This module is not enabled for your school');
  ```
- The feature flag check is abstracted in `FeatureFlagService` — not raw DB queries in controllers
- Flag results are cached in Redis for 5 minutes (acceptable staleness for feature toggling)
- Default: all new module flags are `FALSE` (disabled) at creation
- Super admins can toggle flags from the platform console
- A school's own admin cannot toggle module flags — only super admins or platform admins

---

## Revisit Trigger

- The codebase matures to a point where module bundling (tree-shaking per school type) is more efficient than runtime flag checks
- A dedicated feature flag platform (LaunchDarkly, Unleash) becomes justified by team size
