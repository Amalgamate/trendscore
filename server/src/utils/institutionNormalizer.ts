/**
 * institutionNormalizer.ts
 *
 * Single source of truth for institution type alias resolution and canonical
 * institution helpers.
 *
 * Rules:
 * - Normalize exactly once — in institutionContextResolver middleware.
 * - All downstream guards/controllers read req.resolvedInstitutionType only.
 * - Never add alias logic in controllers or guards.
 * - Add new aliases here only, when observed in real data.
 */

// ── Canonical values ──────────────────────────────────────────────────────────

export const CANONICAL_INSTITUTION_TYPES = ['PRIMARY_CBC', 'SECONDARY', 'TERTIARY'] as const;

export type CanonicalInstitutionType = typeof CANONICAL_INSTITUTION_TYPES[number];

export const DEFAULT_INSTITUTION_TYPE: CanonicalInstitutionType = 'PRIMARY_CBC';

// ── Alias map ─────────────────────────────────────────────────────────────────
// Keys: uppercase trimmed raw strings observed in legacy tokens, DB, or headers.
// Values: canonical CanonicalInstitutionType strings.
// Only add an alias when the variant is confirmed in production data.

export const INSTITUTION_TYPE_ALIAS_MAP: Readonly<Record<string, CanonicalInstitutionType>> = {
  HIGH_SCHOOL: 'SECONDARY',
};

// ── Core normalizer ───────────────────────────────────────────────────────────

/**
 * Normalizes a raw institution type value to its canonical form.
 * Returns null when the value is not a recognized canonical type or alias.
 * Callers decide how to handle null (reject, fall through, use default).
 */
export function normalizeInstitutionType(raw: unknown): CanonicalInstitutionType | null {
  const upper = String(raw ?? '').trim().toUpperCase();
  if (!upper) return null;

  // Direct canonical hit
  if ((CANONICAL_INSTITUTION_TYPES as readonly string[]).includes(upper)) {
    return upper as CanonicalInstitutionType;
  }

  // Alias resolution
  return INSTITUTION_TYPE_ALIAS_MAP[upper] ?? null;
}

/**
 * Normalizes a raw institution type value, returning the safe default when
 * the value is absent or unrecognized.
 */
export function normalizeInstitutionTypeOrDefault(raw: unknown): CanonicalInstitutionType {
  return normalizeInstitutionType(raw) ?? DEFAULT_INSTITUTION_TYPE;
}

/**
 * Returns true when the given value resolves to a valid canonical institution type.
 */
export function isValidInstitutionType(raw: unknown): boolean {
  return normalizeInstitutionType(raw) !== null;
}

/**
 * Reads the resolved institution type from a request object.
 *
 * After institutionContextResolver middleware runs (mounted globally in server.ts),
 * req.resolvedInstitutionType is guaranteed to be a canonical value.
 * Use this everywhere instead of inlining the fallback chain
 *   (req.resolvedInstitutionType || req.school?.institutionType || 'PRIMARY_CBC')
 *
 * Accepts any object with an optional resolvedInstitutionType so controllers
 * don't need to import a specific Express AuthRequest type.
 */
/**
 * Accepts any object shape — the resolvedInstitutionType may be the canonical
 * union on properly-typed AuthRequest, or the generic string from Express
 * augmentation. Both work at runtime.
 */
export function getInstitutionType(req: {
  resolvedInstitutionType?: string | null;
}): CanonicalInstitutionType {
  const raw = req.resolvedInstitutionType;
  return normalizeInstitutionType(raw) ?? DEFAULT_INSTITUTION_TYPE;
}
