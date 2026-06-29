/**
 * roleNormalizer.ts
 *
 * Single source of truth for role alias resolution and canonical role helpers.
 *
 * Rules:
 * - Normalize exactly once — in authenticate() / optionalAuthenticate() before
 *   req.user is set.
 * - All downstream guards read req.user.role / req.user.roles which are
 *   already canonical. They must NOT call normalizeRole themselves.
 * - Add new aliases here only. Never add alias logic in controllers or guards.
 */

import type { Role } from '../config/permissions';

// ── Alias map ─────────────────────────────────────────────────────────────────
// Keys are uppercase trimmed raw strings that may appear in legacy tokens or DB.
// Values are the canonical Role strings defined in config/permissions.ts.

export const ROLE_ALIAS_MAP: Readonly<Record<string, string>> = {
  SYSTEM_ADMIN:          'SUPER_ADMIN',
  SYSTEM_ADMINISTRATOR: 'SUPER_ADMIN',
  SUPERADMIN:           'SUPER_ADMIN',
  HEADTEACHER:          'HEAD_TEACHER',
  HEADOFCURRICULUM:     'HEAD_OF_CURRICULUM',
};

// ── Core normalizer ───────────────────────────────────────────────────────────

/**
 * Normalizes a raw role value to its canonical form.
 * Applies alias resolution, uppercasing, and whitespace trimming.
 * Returns the input unchanged (uppercased) when no alias matches.
 */
export function normalizeRole(raw: unknown): string {
  const upper = String(raw ?? '').trim().toUpperCase();
  return ROLE_ALIAS_MAP[upper] ?? upper;
}

// ── Request helper ────────────────────────────────────────────────────────────

/**
 * Returns the canonical roles array for a decoded or req.user object.
 * Prefers the `roles` array; falls back to the scalar `role` field.
 * Returns [] when the user is absent.
 *
 * After Chunk 2 is deployed, req.user is always pre-normalized so this
 * function is primarily a convenience wrapper — not a normalization step.
 */
export function getCanonicalRoles(
  user: { role?: unknown; roles?: unknown[] } | undefined | null
): Role[] {
  if (!user) return [];
  const source =
    Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : user.role
      ? [user.role]
      : [];
  return source.map(normalizeRole).filter(Boolean) as Role[];
}

// ── Guard helper ──────────────────────────────────────────────────────────────

/**
 * Returns true when the user holds at least one of the allowed canonical roles.
 *
 * Usage in guards / controllers (after Chunk 2):
 *   if (!hasAnyRole(req.user, ['SUPER_ADMIN', 'ADMIN'])) { ... }
 *
 * The function re-derives canonical roles from the user object so it is safe
 * even when called before full Chunk-2 rollout, but in steady-state the
 * req.user roles are already canonical and no re-mapping occurs.
 */
export function hasAnyRole(
  user: { role?: unknown; roles?: unknown[] } | undefined | null,
  allowed: string[]
): boolean {
  if (!user || !allowed.length) return false;
  const canonical = getCanonicalRoles(user);
  const allowedSet = new Set(allowed.map(normalizeRole));
  return canonical.some(r => allowedSet.has(r));
}
