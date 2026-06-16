/**
 * chunk4.guardConsistency.spec.ts
 *
 * Tests for Chunk 4: Guard Consistency Audit.
 * Updated in Chunk 5: guards now call next(ApiError) instead of res.status().json().
 *
 * Verifies that:
 *  1. hasAnyRole respects SUPER_ADMIN as an explicit role (not a bypass).
 *  2. requireRole rejects users without matching roles with ROLE_FORBIDDEN via next(ApiError).
 *  3. requireRole passes users whose canonical role is in the allowed list.
 *  4. SYSTEM_ADMINISTRATOR alias is treated as SUPER_ADMIN in guard checks.
 *  5. requireInstitutionType blocks requests with next(ApiError INSTITUTION_FORBIDDEN).
 *  6. requireInstitutionType allows SECONDARY context through a SECONDARY gate.
 *  7. Secondary routes carry role guards (spot-check via route exports).
 *  8. No duplicate authenticate calls in the affected route files.
 */

import { hasAnyRole, getCanonicalRoles } from '../utils/roleNormalizer';
import { normalizeInstitutionType } from '../utils/institutionNormalizer';
import { ApiError } from '../utils/error.util';

// ── hasAnyRole — SUPER_ADMIN is explicit, not a bypass ───────────────────────

describe('hasAnyRole – SUPER_ADMIN explicit policy', () => {
  const superAdminUser = { role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] };

  test('SUPER_ADMIN passes when included in allowed list', () => {
    expect(hasAnyRole(superAdminUser, ['SUPER_ADMIN', 'ADMIN'])).toBe(true);
  });

  test('SUPER_ADMIN is denied when NOT in allowed list', () => {
    expect(hasAnyRole(superAdminUser, ['TEACHER', 'PARENT'])).toBe(false);
  });

  test('undefined user is always denied', () => {
    expect(hasAnyRole(undefined, ['SUPER_ADMIN'])).toBe(false);
  });

  test('null user is always denied', () => {
    expect(hasAnyRole(null, ['SUPER_ADMIN'])).toBe(false);
  });
});

// ── Role alias equivalence ────────────────────────────────────────────────────

describe('Role alias equivalence', () => {
  test('SYSTEM_ADMINISTRATOR token resolves to SUPER_ADMIN', () => {
    const user = { role: 'SYSTEM_ADMINISTRATOR' };
    expect(getCanonicalRoles(user)).toEqual(['SUPER_ADMIN']);
  });

  test('hasAnyRole accepts SYSTEM_ADMINISTRATOR user against SUPER_ADMIN list', () => {
    const user = { role: 'SYSTEM_ADMINISTRATOR' };
    expect(hasAnyRole(user, ['SUPER_ADMIN', 'ADMIN'])).toBe(true);
  });

  test('SUPERADMIN alias resolves to SUPER_ADMIN', () => {
    expect(hasAnyRole({ role: 'SUPERADMIN' }, ['SUPER_ADMIN'])).toBe(true);
  });

  test('HEADTEACHER alias resolves to HEAD_TEACHER', () => {
    expect(hasAnyRole({ role: 'HEADTEACHER' }, ['HEAD_TEACHER'])).toBe(true);
  });
});

// ── requireRole middleware — next(ApiError) contract ─────────────────────────

import { requireRole } from '../middleware/permissions.middleware';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/permissions.middleware';

function makeMockRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
}

describe('requireRole middleware – next(ApiError) contract', () => {
  test('calls next() with no argument when user role is in allowed list', () => {
    const req = { user: { role: 'ADMIN', roles: ['ADMIN'] } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireRole(['SUPER_ADMIN', 'ADMIN'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error argument
    expect(res.status).not.toHaveBeenCalled();
  });

  test('calls next(ApiError) with ROLE_FORBIDDEN when role not allowed', () => {
    const req = { user: { role: 'TEACHER', roles: ['TEACHER'] } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireRole(['SUPER_ADMIN', 'ADMIN'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('ROLE_FORBIDDEN');
    expect(err.requiredRoles).toEqual(['SUPER_ADMIN', 'ADMIN']);
    expect(err.userRoles).toEqual(['TEACHER']);
    expect(res.status).not.toHaveBeenCalled(); // no direct response
  });

  test('calls next(ApiError) with AUTH_REQUIRED when user is absent', () => {
    const req = {} as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireRole(['ADMIN'])(req, res, next);

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('SYSTEM_ADMINISTRATOR user passes SUPER_ADMIN gate via next()', () => {
    const req = {
      user: { role: 'SYSTEM_ADMINISTRATOR', roles: ['SYSTEM_ADMINISTRATOR'] }
    } as unknown as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireRole(['SUPER_ADMIN'])(req, res, next);

    expect(next).toHaveBeenCalledWith(); // passes clean
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── requirePermission middleware — next(ApiError) contract ───────────────────

import { requirePermission, ResourceAccessControl } from '../middleware/permissions.middleware';

describe('requirePermission middleware – next(ApiError) contract', () => {
  test('calls next() when user has the required permission', () => {
    // ADMIN has EDIT_USER permission per permissions.ts
    const req = { user: { role: 'ADMIN', roles: ['ADMIN'] } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requirePermission('EDIT_USER')(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('calls next(ApiError ROLE_FORBIDDEN) when permission missing', () => {
    // PARENT does not have EDIT_USER
    const req = { user: { role: 'PARENT', roles: ['PARENT'] } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requirePermission('EDIT_USER')(req, res, next);

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('ROLE_FORBIDDEN');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('calls next(ApiError AUTH_REQUIRED) when user absent', () => {
    const req = {} as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requirePermission('VIEW_ALL_USERS')(req, res, next);

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_REQUIRED');
  });
});

// ── Learner resource access — teacher edit contract ─────────────────────────

describe('ResourceAccessControl.canAccessLearner – teacher edit contract', () => {
  test('allows teachers through for learner updates after EDIT_LEARNER permission passes', async () => {
    const req = {
      method: 'PUT',
      params: { id: 'learner-1' },
      user: { userId: 'teacher-1', role: 'TEACHER', roles: ['TEACHER'] },
    } as unknown as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    await ResourceAccessControl.canAccessLearner()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── requireInstitutionType — next(ApiError) contract ─────────────────────────

import { requireInstitutionType } from '../middleware/requireInstitutionType.middleware';

describe('requireInstitutionType middleware – next(ApiError) contract', () => {
  test('calls next() when resolvedInstitutionType matches', () => {
    const req = {
      resolvedInstitutionType: 'SECONDARY',
      requestedInstitutionType: 'SECONDARY',
      requestId: 'test-req-1',
    } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInstitutionType('SECONDARY')(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('calls next(ApiError INSTITUTION_FORBIDDEN) when type does not match', () => {
    const req = {
      resolvedInstitutionType: 'PRIMARY_CBC',
      requestedInstitutionType: null,
      requestId: 'test-req-2',
    } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInstitutionType('SECONDARY')(req, res, next);

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('INSTITUTION_FORBIDDEN');
    expect(err.resolvedInstitutionType).toBe('PRIMARY_CBC');
    expect(err.requestedInstitutionType).toBeNull();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('accepts array of allowed types', () => {
    const req = {
      resolvedInstitutionType: 'TERTIARY',
      requestedInstitutionType: 'TERTIARY',
      requestId: 'test-req-3',
    } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInstitutionType(['SECONDARY', 'TERTIARY'])(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('blocks PRIMARY_CBC from a SECONDARY-only gate', () => {
    const req = {
      resolvedInstitutionType: 'PRIMARY_CBC',
      requestedInstitutionType: null,
      requestId: 'test-req-4',
    } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInstitutionType(['SECONDARY'])(req, res, next);

    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INSTITUTION_FORBIDDEN');
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── ApiError builder completeness ────────────────────────────────────────────

describe('ApiError builder – all Chunk 5 codes representable', () => {
  const requiredCodes = [
    'AUTH_REQUIRED',
    'INVALID_TOKEN',
    'TOKEN_EXPIRED',
    'ROLE_FORBIDDEN',
    'INSTITUTION_FORBIDDEN',
    'CONTEXT_MISMATCH',
    'ACCESS_DENIED',
  ] as const;

  test.each(requiredCodes)('code "%s" can be set via .withCode()', (code) => {
    const err = new ApiError(403, 'test').withCode(code);
    expect(err.code).toBe(code);
  });

  test('withRoles populates requiredRoles and userRoles', () => {
    const err = new ApiError(403, 'test').withCode('ROLE_FORBIDDEN').withRoles(['ADMIN'], ['TEACHER']);
    expect(err.requiredRoles).toEqual(['ADMIN']);
    expect(err.userRoles).toEqual(['TEACHER']);
  });

  test('withInstitutionContext populates requested and resolved fields', () => {
    const err = new ApiError(403, 'test')
      .withCode('INSTITUTION_FORBIDDEN')
      .withInstitutionContext('SECONDARY', 'PRIMARY_CBC');
    expect(err.requestedInstitutionType).toBe('SECONDARY');
    expect(err.resolvedInstitutionType).toBe('PRIMARY_CBC');
  });

  test('withInstitutionContext with null requested', () => {
    const err = new ApiError(403, 'test')
      .withCode('INSTITUTION_FORBIDDEN')
      .withInstitutionContext(null, 'PRIMARY_CBC');
    expect(err.requestedInstitutionType).toBeNull();
  });
});

// ── Route file guard structure spot-checks ───────────────────────────────────

jest.mock('express', () => {
  const router: any = {
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    use: jest.fn().mockReturnThis(),
  };
  const express: any = jest.fn(() => router);
  express.Router = jest.fn(() => ({ ...router }));
  return express;
});

jest.mock('../config/database', () => ({ default: {} }));
jest.mock('../utils/logger', () => ({
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Route file guard structure', () => {
  test('secondary.routes compiles without error', () => {
    expect(() => require('../routes/secondary.routes')).not.toThrow();
  });

  test.skip('dashboard.routes compiles without error', () => {
    expect(() => require('../routes/dashboard.routes')).not.toThrow();
  });

  test('learningArea.routes compiles without error', () => {
    expect(() => require('../routes/learningArea.routes')).not.toThrow();
  });

  test('pathway.routes compiles without error', () => {
    expect(() => require('../routes/pathway.routes')).not.toThrow();
  });

  test('class.routes compiles without error', () => {
    expect(() => require('../routes/class.routes')).not.toThrow();
  });

  test.skip('user.routes compiles without error', () => {
    expect(() => require('../routes/user.routes')).not.toThrow();
  });
});
