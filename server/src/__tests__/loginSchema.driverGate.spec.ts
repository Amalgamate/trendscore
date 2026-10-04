/**
 * Regression guard for the driver-app device-approval gate.
 *
 * This exists because of a bug that unit tests could not see. The gate in
 * authController.login() was correct and fully unit-tested, but a LIVE request
 * with a deviceId still returned 200 with a token.
 *
 * Cause: /api/auth/login runs through `validate(loginSchema)`, and that
 * middleware does `req.body = data` (validation.middleware.ts:79) — i.e. it
 * REPLACES the body with Zod's parsed output. Zod strips keys the schema does
 * not declare, so `deviceId` and `driverCode` were deleted before the controller
 * ran. The controller-level tests passed because they called it directly with
 * a hand-built request that bypassed the middleware.
 *
 * So this test asserts the SCHEMA keeps those keys, which is the actual
 * contract the gate depends on.
 */

import { loginSchema } from '../utils/validation.util';

describe('loginSchema — driver device fields', () => {
  const base = { email: 'driver@school.test', password: 'pw' };

  it('PRESERVES deviceId and driverCode instead of stripping them', () => {
    // The whole point: if this ever returns undefined, login() cannot gate.
    const parsed = loginSchema.parse({ ...base, driverCode: 'zawadi', deviceId: 'dev-1' });
    expect(parsed.deviceId).toBe('dev-1');
    expect(parsed.driverCode).toBe('zawadi');
  });

  it('trims the values', () => {
    const parsed = loginSchema.parse({ ...base, driverCode: '  zawadi  ', deviceId: ' dev-2 ' });
    expect(parsed.driverCode).toBe('zawadi');
    expect(parsed.deviceId).toBe('dev-2');
  });

  it('still allows a plain web-portal login with neither field', () => {
    const parsed = loginSchema.parse(base);
    expect(parsed.deviceId).toBeUndefined();
    expect(parsed.driverCode).toBeUndefined();
    expect(parsed.email).toBe('driver@school.test');
  });

  it('still requires email or phone', () => {
    expect(loginSchema.safeParse({ password: 'pw', deviceId: 'dev-1' }).success).toBe(false);
  });

  it('rejects an absurdly long deviceId rather than passing it through', () => {
    expect(loginSchema.safeParse({ ...base, deviceId: 'x'.repeat(200) }).success).toBe(false);
  });
});