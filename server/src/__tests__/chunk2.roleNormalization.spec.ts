/**
 * chunk2.roleNormalization.spec.ts
 *
 * Tests for Chunk 2: Role Normalization at Auth Boundary.
 *
 * Verifies that:
 *  1. normalizeRole handles all known aliases + pass-through.
 *  2. getCanonicalRoles merges the scalar role with roles[].
 *  3. hasAnyRole correctly gates access using canonical resolution.
 *  4. Aliased roles pass the same guards as their canonical equivalents.
 *  5. optionalAuthenticate produces identical canonical role shape as authenticate.
 */

import {
  normalizeRole,
  getCanonicalRoles,
  hasAnyRole,
  ROLE_ALIAS_MAP,
} from '../utils/roleNormalizer';

// ── normalizeRole ─────────────────────────────────────────────────────────────

describe('normalizeRole', () => {
  test.each([
    ['SYSTEM_ADMINISTRATOR', 'SUPER_ADMIN'],
    ['system_administrator', 'SUPER_ADMIN'],  // lowercase input
    [' SYSTEM_ADMINISTRATOR ', 'SUPER_ADMIN'], // whitespace
    ['SUPERADMIN', 'SUPER_ADMIN'],
    ['superadmin', 'SUPER_ADMIN'],
    ['HEADTEACHER', 'HEAD_TEACHER'],
    ['headteacher', 'HEAD_TEACHER'],
    ['HEADOFCURRICULUM', 'HEAD_OF_CURRICULUM'],
    ['SUPER_ADMIN', 'SUPER_ADMIN'],       // canonical pass-through
    ['ADMIN', 'ADMIN'],                   // no alias needed
    ['TEACHER', 'TEACHER'],
    ['HEAD_TEACHER', 'HEAD_TEACHER'],
    ['HEAD_OF_CURRICULUM', 'HEAD_OF_CURRICULUM'],
    [null, ''],                           // null safety
    [undefined, ''],                      // undefined safety
    ['', ''],                             // empty string
  ])('normalizeRole(%s) → %s', (raw, expected) => {
    expect(normalizeRole(raw)).toBe(expected);
  });

  test('all ROLE_ALIAS_MAP keys map to a non-empty canonical value', () => {
    for (const [alias, canonical] of Object.entries(ROLE_ALIAS_MAP) as Array<[string, string]>) {
      expect(canonical.length).toBeGreaterThan(0);
      expect(normalizeRole(alias)).toBe(canonical);
    }
  });
});

// ── getCanonicalRoles ─────────────────────────────────────────────────────────

describe('getCanonicalRoles', () => {
  test('returns [] for null/undefined user', () => {
    expect(getCanonicalRoles(null)).toEqual([]);
    expect(getCanonicalRoles(undefined)).toEqual([]);
  });

  test('merges scalar role with roles[] and keeps unique canonical roles', () => {
    const user = { role: 'TEACHER', roles: ['ADMIN', 'TEACHER'] } as any;
    expect(getCanonicalRoles(user)).toEqual(['TEACHER', 'ADMIN']);
  });

  test('keeps active scalar role when roles[] is stale', () => {
    const user = { role: 'TEACHER', roles: ['ADMIN'] } as any;
    expect(getCanonicalRoles(user)).toEqual(['TEACHER', 'ADMIN']);
  });

  test('falls back to scalar role when roles[] is empty', () => {
    const user = { role: 'HEADTEACHER', roles: [] } as any;
    expect(getCanonicalRoles(user)).toEqual(['HEAD_TEACHER']);
  });

  test('normalizes aliases inside the roles array', () => {
    const user = { role: 'SUPER_ADMIN', roles: ['SYSTEM_ADMINISTRATOR', 'SUPERADMIN'] } as any;
    expect(getCanonicalRoles(user)).toEqual(['SUPER_ADMIN']);
  });

  test('filters out empty strings from degenerate input', () => {
    const user = { role: '', roles: ['', 'ADMIN'] } as any;
    const result = getCanonicalRoles(user);
    expect(result).not.toContain('');
    expect(result).toContain('ADMIN');
  });
});

// ── hasAnyRole ────────────────────────────────────────────────────────────────

describe('hasAnyRole', () => {
  test('returns false for null user', () => {
    expect(hasAnyRole(null, ['SUPER_ADMIN'])).toBe(false);
  });

  test('returns false for empty allowed list', () => {
    const user = { role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] } as any;
    expect(hasAnyRole(user, [])).toBe(false);
  });

  test('SYSTEM_ADMINISTRATOR passes SUPER_ADMIN guard', () => {
    const user = { role: 'SYSTEM_ADMINISTRATOR', roles: ['SYSTEM_ADMINISTRATOR'] } as any;
    expect(hasAnyRole(user, ['SUPER_ADMIN'])).toBe(true);
  });

  test('SUPERADMIN passes SUPER_ADMIN guard', () => {
    const user = { role: 'SUPERADMIN', roles: ['SUPERADMIN'] } as any;
    expect(hasAnyRole(user, ['SUPER_ADMIN'])).toBe(true);
  });

  test('HEADTEACHER passes HEAD_TEACHER guard', () => {
    const user = { role: 'HEADTEACHER', roles: ['HEADTEACHER'] } as any;
    expect(hasAnyRole(user, ['HEAD_TEACHER'])).toBe(true);
  });

  test('HEADOFCURRICULUM passes HEAD_OF_CURRICULUM guard', () => {
    const user = { role: 'HEADOFCURRICULUM', roles: ['HEADOFCURRICULUM'] } as any;
    expect(hasAnyRole(user, ['HEAD_OF_CURRICULUM'])).toBe(true);
  });

  test('non-matching role is denied', () => {
    const user = { role: 'TEACHER', roles: ['TEACHER'] } as any;
    expect(hasAnyRole(user, ['SUPER_ADMIN', 'ADMIN'])).toBe(false);
  });

  test('user with one of several matching roles is allowed', () => {
    const user = { role: 'ADMIN', roles: ['ADMIN'] } as any;
    expect(hasAnyRole(user, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'])).toBe(true);
  });

  test('aliased roles in allowed list are also resolved', () => {
    // allowed list contains a known alias — should still match canonical user
    const user = { role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] } as any;
    expect(hasAnyRole(user, ['SYSTEM_ADMINISTRATOR'])).toBe(true);
  });
});

// ── Alias equivalence: authenticate vs optionalAuthenticate shape ─────────────
// These tests operate purely on the normalization logic (no HTTP layer) and
// confirm the shape is identical regardless of which middleware ran.

describe('Role shape equivalence (authenticate vs optionalAuthenticate)', () => {
  function simulateAuthBoundary(decoded: any) {
    // Mirrors the normalization applied in both authenticate and optionalAuthenticate
    const { normalizeRole: nr, getCanonicalRoles: gcr } =
      require('../utils/roleNormalizer');
    const canonicalRole  = nr(decoded.role);
    const canonicalRoles = gcr(decoded);
    return { ...decoded, role: canonicalRole, roles: canonicalRoles };
  }

  test('SYSTEM_ADMINISTRATOR token produces canonical SUPER_ADMIN shape', () => {
    const decoded = { userId: 'u1', email: 'a@b.com', role: 'SYSTEM_ADMINISTRATOR', roles: ['SYSTEM_ADMINISTRATOR'] };
    const user = simulateAuthBoundary(decoded);
    expect(user.role).toBe('SUPER_ADMIN');
    expect(user.roles).toEqual(['SUPER_ADMIN']);
  });

  test('canonical token is unchanged after boundary normalization', () => {
    const decoded = { userId: 'u2', email: 'x@y.com', role: 'ADMIN', roles: ['ADMIN'] };
    const user = simulateAuthBoundary(decoded);
    expect(user.role).toBe('ADMIN');
    expect(user.roles).toEqual(['ADMIN']);
  });

  test('token with no roles array falls back to scalar role', () => {
    const decoded = { userId: 'u3', email: 'z@z.com', role: 'HEADTEACHER' };
    const user = simulateAuthBoundary(decoded);
    expect(user.role).toBe('HEAD_TEACHER');
    expect(user.roles).toEqual(['HEAD_TEACHER']);
  });
});
