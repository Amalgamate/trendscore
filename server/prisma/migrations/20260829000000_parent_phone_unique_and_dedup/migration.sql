-- Migration: parent_phone_unique_and_dedup
-- 
-- Goals:
--   1. Add a partial unique index on users.phone for PARENT role accounts only.
--      This prevents two active parent accounts from sharing the same phone number.
--      Archived accounts are excluded so the merge script can safely archive losers
--      without needing to clear their phone first.
--   2. Ensure FamilyMember.normalizedPhone already has @@unique([familyAccountId, normalizedPhone])
--      — this was added in 20260627110000_add_family_accounts and is already in place.
--
-- NOTE: This migration does NOT add a full unique constraint on users.phone because
--       staff and student accounts may share phones with parents in edge cases.
--       The partial index scoped to role='PARENT' + archived=false is sufficient.

-- ── Step 1: Partial unique index on parent phone ───────────────────────────────
-- Only one active (non-archived) parent per normalised phone.
-- The merge script must normalise all phones to 254XXXXXXXXX BEFORE this runs.
CREATE UNIQUE INDEX IF NOT EXISTS "users_parent_phone_unique"
  ON "users" ("phone")
  WHERE "role" = 'PARENT'
    AND "archived" = false
    AND "phone" IS NOT NULL
    AND "phone" <> '';

-- ── Step 2: Partial unique index on parent email ───────────────────────────────
-- After the merge script nulls out synthetic emails and assigns par-* emails,
-- we still want the base @unique on email (already exists as a full constraint).
-- Nothing to add here — email is already globally unique in the schema.

-- ── Step 3: Index to speed up duplicate-detection queries ─────────────────────
CREATE INDEX IF NOT EXISTS "users_parent_name_role_idx"
  ON "users" (LOWER("firstName"), LOWER("lastName"), "role")
  WHERE "archived" = false;
