/**
 * Unit tests for driverConnection.service — the school-code resolver and the
 * device approval gate. Prisma fully mocked; no DB required.
 *
 * The security property under test: the client supplies a CODE, never a URL, so
 * the origin is always rebuilt server-side from the deployment domain. Several
 * cases exist specifically to prove a hostile input cannot steer the app
 * somewhere else.
 */

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    school: { findFirst: jest.fn(), findMany: jest.fn() },
    driverDevice: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

import prisma from '../config/database';
import { driverConnectionService } from '../services/driverConnection.service';
import { normalizeSchoolCode, isReservedSubdomain, DEPLOYMENT_DOMAIN } from '../config/schoolDomains';

const db = prisma as unknown as {
  school: { findFirst: jest.Mock; findMany: jest.Mock };
  driverDevice: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
};

const SCHOOL = {
  id: 'school-1',
  name: 'Zawadi CBC Academy',
  motto: 'Knowledge is power',
  logoUrl: 'https://cdn.test/logo.png',
  brandColor: '#030B82',
};

beforeEach(() => jest.clearAllMocks());

describe('normalizeSchoolCode', () => {
  it('accepts a normal code and lowercases it', () => {
    expect(normalizeSchoolCode('Zawadi')).toBe('zawadi');
    expect(normalizeSchoolCode('  zawadi  ')).toBe('zawadi');
    expect(normalizeSchoolCode('zawadi-2')).toBe('zawadi-2');
  });

  it.each([
    ['a URL', 'https://evil.example.com'],
    ['a host with a path', 'evil.example.com/api'],
    ['a subdomain prefix', 'x.zawadi'],
    ['a scheme-relative path', '//evil.com'],
    ['a bare dot', 'zawadi.'],
    ['a leading hyphen', '-zawadi'],
    ['trailing hyphen', 'zawadi-'],
    ['a space inside', 'za wadi'],
    ['an over-long value', 'a'.repeat(40)],
    ['a non-string', 42],
  ])('rejects %s', (_label, input) => {
    expect(normalizeSchoolCode(input)).toBeNull();
  });
});

describe('isReservedSubdomain', () => {
  it('rejects words the platform itself uses', () => {
    expect(isReservedSubdomain('admin')).toBe(true);
    expect(isReservedSubdomain('api')).toBe(true);
    expect(isReservedSubdomain('www')).toBe(true);
  });

  it('allows an ordinary school code', () => {
    expect(isReservedSubdomain('zawadi')).toBe(false);
  });
});

describe('driverConnectionService.originFor', () => {
  it('always builds the origin from the server-owned domain', () => {
    expect(driverConnectionService.originFor('zawadi'))
      .toBe(`https://zawadi.${DEPLOYMENT_DOMAIN}/api`);
  });
});

describe('driverConnectionService.validateCode', () => {
  it('rejects a reserved word with the same message as a malformed code', () => {
    // Identical messaging so probing cannot distinguish "reserved" from
    // "malformed" and so enumerate the reserved list.
    let reservedMsg = '';
    let malformedMsg = '';
    try { driverConnectionService.validateCode('admin'); } catch (e: any) { reservedMsg = e.message; }
    try { driverConnectionService.validateCode('not a code'); } catch (e: any) { malformedMsg = e.message; }
    expect(reservedMsg).toBe(malformedMsg);
    expect(reservedMsg).not.toBe('');
  });
});

describe('driverConnectionService.resolve', () => {
  it('returns the origin and branding for a known code', async () => {
    db.school.findFirst.mockResolvedValueOnce(SCHOOL);
    const result = await driverConnectionService.resolve('Zawadi');
    expect(result.schoolCode).toBe('zawadi');
    expect(result.schoolId).toBe('school-1');
    expect(result.apiOrigin).toBe(`https://zawadi.${DEPLOYMENT_DOMAIN}/api`);
    expect(result.branding.displayName).toBe('Zawadi CBC Academy');
    expect(result.branding.brandColorHex).toBe('#030B82');
  });

  it('404s an unknown code without revealing anything else', async () => {
    db.school.findFirst.mockResolvedValueOnce(null);
    await expect(driverConnectionService.resolve('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('uses the isolated tenant school when the verified subdomain is its code', async () => {
    db.school.findFirst.mockResolvedValueOnce(null);
    db.school.findMany.mockResolvedValueOnce([{ ...SCHOOL, schoolCode: null }]);
    const result = await driverConnectionService.resolve('ibse', 'ibse.trendscore.co.ke');
    expect(result.schoolCode).toBe('ibse');
    expect(result.apiOrigin).toBe('https://ibse.trendscore.co.ke/api');
    expect(result.branding.displayName).toBe(SCHOOL.name);
  });

  it('does not resolve a code on a different school host', async () => {
    await expect(driverConnectionService.resolve('ibse', 'zawadi.trendscore.co.ke'))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(db.school.findFirst).not.toHaveBeenCalled();
  });

  it('only ever matches on the shared schoolCode + active', async () => {
    db.school.findFirst.mockResolvedValueOnce(null);
    await driverConnectionService.resolve('zawadi').catch(() => {});
    expect(db.school.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolCode: 'zawadi', active: true } }),
    );
  });
});
describe('driverConnectionService.registerDevice', () => {
  it('creates a PENDING device for a known code', async () => {
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce(null);
    db.driverDevice.create.mockResolvedValueOnce({
      status: 'PENDING',
      requestedAt: new Date('2026-10-03T10:00:00Z'),
    });

    const result = await driverConnectionService.registerDevice('zawadi', 'dev-1', 'Rico Pixel');

    expect(result.status).toBe('PENDING');
    expect(db.driverDevice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId: 'school-1', deviceId: 'dev-1' }),
      }),
    );
  });

  it('is idempotent — a repeated request does not create a second row', async () => {
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce({ id: 'd-1', status: 'PENDING', requestedAt: new Date() });

    const result = await driverConnectionService.registerDevice('zawadi', 'dev-1');

    expect(result.status).toBe('PENDING');
    expect(db.driverDevice.create).not.toHaveBeenCalled();
  });

  it('does NOT let a re-registration un-approve an approved device', async () => {
    // Otherwise anyone who learns the code could knock a working phone offline
    // by re-registering it.
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce({ id: 'd-1', status: 'APPROVED', requestedAt: new Date() });

    const result = await driverConnectionService.registerDevice('zawadi', 'dev-1');

    expect(result.status).toBe('APPROVED');
    expect(db.driverDevice.create).not.toHaveBeenCalled();
  });

  it('requires a device id', async () => {
    await expect(driverConnectionService.registerDevice('zawadi', '')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s an unknown school code', async () => {
    db.school.findFirst.mockResolvedValueOnce(null);
    await expect(driverConnectionService.registerDevice('nope', 'dev-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('driverConnectionService.assertDeviceApproved', () => {
  it('passes when the device is APPROVED', async () => {
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce({ status: 'APPROVED', lastSeenAt: null });
    db.driverDevice.update.mockResolvedValueOnce({});
    await expect(driverConnectionService.assertDeviceApproved('zawadi', 'dev-1')).resolves.toBeUndefined();
  });

  it('blocks a PENDING phone with 403 DEVICE_NOT_APPROVED', async () => {
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce({ status: 'PENDING', lastSeenAt: null });
    db.driverDevice.update.mockResolvedValueOnce({});

    await expect(driverConnectionService.assertDeviceApproved('zawadi', 'dev-1'))
      .rejects.toMatchObject({ statusCode: 403, code: 'DEVICE_NOT_APPROVED' });
  });

  it('blocks a phone that never registered', async () => {
    // Unknown device must not be treated as approved.
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce(null);
    await expect(driverConnectionService.assertDeviceApproved('zawadi', 'never-seen'))
      .rejects.toMatchObject({ statusCode: 403, code: 'DEVICE_NOT_APPROVED' });
  });

  it('blocks a REVOKED phone with its own message', async () => {
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce({ status: 'REVOKED', lastSeenAt: null });
    db.driverDevice.update.mockResolvedValueOnce({});

    await expect(driverConnectionService.assertDeviceApproved('zawadi', 'dev-1'))
      .rejects.toMatchObject({ statusCode: 403, code: 'DEVICE_NOT_APPROVED', message: expect.stringContaining('removed') });
  });
});

describe('driverConnectionService.deviceStatus', () => {
  it('reports PENDING for a device that has never registered', async () => {
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce(null);
    await expect(driverConnectionService.deviceStatus('zawadi', 'dev-x')).resolves.toBe('PENDING');
  });

  it('reports APPROVED and stamps lastSeenAt', async () => {
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce({ status: 'APPROVED', lastSeenAt: null });
    db.driverDevice.update.mockResolvedValueOnce({});

    await expect(driverConnectionService.deviceStatus('zawadi', 'dev-1')).resolves.toBe('APPROVED');
    expect(db.driverDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSeenAt: expect.any(Date) }) }),
    );
  });

  it('reports REVOKED', async () => {
    db.school.findFirst.mockResolvedValueOnce({ id: 'school-1' });
    db.driverDevice.findUnique.mockResolvedValueOnce({ status: 'REVOKED', lastSeenAt: null });
    db.driverDevice.update.mockResolvedValueOnce({});
    await expect(driverConnectionService.deviceStatus('zawadi', 'dev-1')).resolves.toBe('REVOKED');
  });
});
