-- Drop schoolId from transport_vehicles and transport_routes.
--
-- Each school runs its own isolated database (one Docker stack per school).
-- schoolId is meaningless in a single-tenant database and was never populated.
-- The column caused a Prisma findUnique error on schools whose database
-- pre-dates the 20260804020000_phase2_transport_trips migration.
--
-- Using IF EXISTS so this migration is safe to run on databases that never
-- received the phase2 migration (the column simply won't be there).

-- ── transport_vehicles ────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "transport_vehicles_school_id_idx";
ALTER TABLE "transport_vehicles" DROP COLUMN IF EXISTS "school_id";

-- ── transport_routes ──────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "transport_routes_school_id_idx";
ALTER TABLE "transport_routes" DROP COLUMN IF EXISTS "school_id";
