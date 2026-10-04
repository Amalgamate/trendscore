/**
 * Unit tests for TransportController vehicle↔driver assignment.
 * Prisma fully mocked — no DB required.
 *
 * A vehicle stores its driver twice: `driverId` (the real identity the driver
 * app signs in with) and the denormalised `driverName`/`driverPhone` kept for
 * the existing admin UI. Assigning therefore has to validate the user, enforce
 * the one-vehicle-per-driver rule, and re-sync the display copy.
 */

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    transportVehicle: {
      findUnique: jest.fn(),
      findFirst:  jest.fn(),
      findMany:   jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
    },
    transportRoute: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    termConfig: { findFirst: jest.fn() },
    feeInvoice: { count: jest.fn(), findUnique: jest.fn() },
    feeStructure: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../services/accounting.service', () => ({
  accountingService: { recordEntry: jest.fn() },
}));

import prisma from '../config/database';
import { TransportController } from './transport.controller';

const db = prisma as any;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTIVE_DRIVER = {
  id: 'driver-1', firstName: 'John', lastName: 'Otieno',
  phone: '+254712345678', role: 'DRIVER', roles: [] as string[],
  status: 'ACTIVE', archived: false,
};

const LIVE_VEHICLE = {
  id: 'v1', archived: false, registrationNumber: 'KBX 123A',
  driverName: 'Old Name', driverPhone: '0700000000', driverId: null,
};

// ---------------------------------------------------------------------------

describe('TransportController.assignVehicleDriver()', () => {
  let controller: TransportController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TransportController();
  });

  /**
   * The controller catches ApiError and writes an error body rather than
   * rethrowing, so assertions read the status/body off the response mock.
   */
  const callAssign = async (body: any, vehicle: any = LIVE_VEHICLE) => {
    db.transportVehicle.findUnique.mockResolvedValueOnce(vehicle);
    const req: any = { params: { id: 'v1' }, body };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await controller.assignVehicleDriver(req, res);
    const payload = res.json.mock.calls[0]?.[0] ?? {};
    return { payload, status: res.status.mock.calls[0]?.[0] ?? 200 };
  };

  it('links the driver and syncs the denormalised name and phone', async () => {
    db.user.findUnique.mockResolvedValueOnce(ACTIVE_DRIVER);
    db.transportVehicle.findFirst.mockResolvedValueOnce(null); // not on another vehicle
    db.transportVehicle.update.mockResolvedValueOnce({ id: 'v1', driverId: 'driver-1' });

    await callAssign({ driverId: 'driver-1' });

    const data = db.transportVehicle.update.mock.calls[0][0].data;
    expect(data).toEqual({
      driverId:    'driver-1',
      driverName:  'John Otieno',
      driverPhone: '+254712345678',
    });
  });

  it('rejects a user who does not hold the DRIVER role', async () => {
    db.user.findUnique.mockResolvedValueOnce({ ...ACTIVE_DRIVER, role: 'TEACHER' });

    const { payload, status } = await callAssign({ driverId: 'driver-1' });

    expect(status).toBe(400);
    expect(payload.message).toMatch(/DRIVER role/);
    expect(db.transportVehicle.update).not.toHaveBeenCalled();
  });

  it('accepts DRIVER held in the roles array rather than the role column', async () => {
    db.user.findUnique.mockResolvedValueOnce({ ...ACTIVE_DRIVER, role: 'TEACHER', roles: ['TEACHER', 'DRIVER'] });
    db.transportVehicle.findFirst.mockResolvedValueOnce(null);
    db.transportVehicle.update.mockResolvedValueOnce({ id: 'v1', driverId: 'driver-1' });

    await callAssign({ driverId: 'driver-1' });

    expect(db.transportVehicle.update.mock.calls[0][0].data.driverId).toBe('driver-1');
  });
it('rejects a driver already assigned to another live vehicle', async () => {
    db.user.findUnique.mockResolvedValueOnce(ACTIVE_DRIVER);
    db.transportVehicle.findFirst.mockResolvedValueOnce({ id: 'v2', registrationNumber: 'KBX 999Z' });

    const { payload, status } = await callAssign({ driverId: 'driver-1' });

    expect(status).toBe(400);
    // The message names the conflicting vehicle so the admin can act on it.
    expect(payload.message).toMatch(/KBX 999Z/);
    expect(db.transportVehicle.update).not.toHaveBeenCalled();
  });

  it('allows reassigning the driver already on this same vehicle', async () => {
    db.user.findUnique.mockResolvedValueOnce(ACTIVE_DRIVER);
    // Conflict lookup must exclude the vehicle being edited.
    db.transportVehicle.findFirst.mockResolvedValueOnce(null);
    db.transportVehicle.update.mockResolvedValueOnce({ id: 'v1', driverId: 'driver-1' });

    await callAssign({ driverId: 'driver-1' });

    expect(db.transportVehicle.findFirst.mock.calls[0][0].where.id).toEqual({ not: 'v1' });
  });

  it('rejects an archived driver account', async () => {
    db.user.findUnique.mockResolvedValueOnce({ ...ACTIVE_DRIVER, archived: true });

    const { status } = await callAssign({ driverId: 'driver-1' });
    expect(status).toBe(404);
  });

  it('rejects a suspended driver account', async () => {
    db.user.findUnique.mockResolvedValueOnce({ ...ACTIVE_DRIVER, status: 'SUSPENDED' });

    const { payload, status } = await callAssign({ driverId: 'driver-1' });
    expect(status).toBe(400);
    expect(payload.message).toMatch(/not active/);
  });

  it('rejects an unknown user id', async () => {
    db.user.findUnique.mockResolvedValueOnce(null);

    const { status } = await callAssign({ driverId: 'ghost' });
    expect(status).toBe(404);
  });

  it('unassigns by clearing the link while preserving the display fields', async () => {
    db.transportVehicle.update.mockResolvedValueOnce({ id: 'v1', driverId: null });

    await callAssign({ driverId: null });

    const data = db.transportVehicle.update.mock.calls[0][0].data;
    expect(data.driverId).toBeNull();
    // Display copy stays so the vehicle record remains readable.
    expect(data.driverName).toBeUndefined();
    expect(data.driverPhone).toBeUndefined();
  });

  it('refuses to assign against an archived vehicle', async () => {
    const { payload, status } = await callAssign(
      { driverId: 'driver-1' },
      { ...LIVE_VEHICLE, archived: true },
    );

    expect(status).toBe(404);
    expect(payload.message).toMatch(/Vehicle not found/);
  });
});

describe('TransportController.deleteVehicle()', () => {
  let controller: TransportController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TransportController();
  });

  it('releases the driver when archiving', async () => {
    db.transportVehicle.update.mockResolvedValueOnce({ id: 'v1' });

    const res: any = { json: jest.fn() };
    await controller.deleteVehicle({ params: { id: 'v1' } } as any, res);

    // driverId is @unique across ALL rows including archived ones. Leaving it
    // set would make the driver permanently un-assignable to a replacement
    // vehicle, so archiving must release the link.
    expect(db.transportVehicle.update.mock.calls[0][0].data).toEqual({
      archived: true,
      driverId: null,
    });
  });
});