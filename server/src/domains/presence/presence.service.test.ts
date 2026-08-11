/**
 * Unit tests for PresenceService
 *
 * Prisma is fully mocked — no DB connection required.
 * We test: emit(), idempotency (P2002 handling), failure recording, synthetic event.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    presenceEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    presenceEventFailure: {
      create: jest.fn(),
    },
    school: {
      findFirst: jest.fn(),
    },
  },
}));

// Must import after mock
import prisma from '../../config/database';
import { PresenceService } from './presence.service';
import { PresenceEventInput } from './presence.types';

const mockPrisma = prisma as any;

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const BASE_EVENT: PresenceEventInput = {
  schoolId:      'school-1',
  personId:      'learner-1',
  personType:    'LEARNER',
  eventType:     'CLASS_ATTENDANCE',
  context:       'CLASS',
  timestamp:     new Date('2026-08-04T06:00:00.000Z'),
  recordedBy:    'teacher-1',
  sourceModule:  'ATTENDANCE',
  sourceRecordId: 'attendance-record-1',
  metadata:      { classId: 'class-1', attendanceStatus: 'PRESENT' },
};

const STORED_EVENT = {
  id:           'event-uuid-1',
  ...BASE_EVENT,
  status:       'CONFIRMED',
  version:      1,
  recordedAt:   new Date(),
  createdAt:    new Date(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PresenceService.emit()', () => {
  let service: PresenceService;

  beforeEach(() => {
    service = new PresenceService();
    jest.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('creates a new presence event on first call', async () => {
    mockPrisma.presenceEvent.create.mockResolvedValueOnce(STORED_EVENT);

    const result = await service.emit(BASE_EVENT);

    expect(mockPrisma.presenceEvent.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('event-uuid-1');
    expect(result.eventType).toBe('CLASS_ATTENDANCE');
    expect(result.personId).toBe('learner-1');
  });

  it('sets default status to CONFIRMED when not specified', async () => {
    mockPrisma.presenceEvent.create.mockResolvedValueOnce(STORED_EVENT);
    await service.emit(BASE_EVENT);

    const callArg = mockPrisma.presenceEvent.create.mock.calls[0][0].data;
    expect(callArg.status).toBe('CONFIRMED');
  });

  it('sets provided status when specified', async () => {
    mockPrisma.presenceEvent.create.mockResolvedValueOnce({ ...STORED_EVENT, status: 'PENDING' });
    await service.emit({ ...BASE_EVENT, status: 'PENDING' });

    const callArg = mockPrisma.presenceEvent.create.mock.calls[0][0].data;
    expect(callArg.status).toBe('PENDING');
  });

  it('sets null for optional fields when not provided', async () => {
    mockPrisma.presenceEvent.create.mockResolvedValueOnce(STORED_EVENT);
    const minimalEvent: PresenceEventInput = {
      schoolId:     'school-1',
      personId:     'learner-1',
      personType:   'LEARNER',
      eventType:    'CLASS_ATTENDANCE',
      context:      'CLASS',
      timestamp:    new Date(),
      sourceModule: 'ATTENDANCE',
    };
    await service.emit(minimalEvent);

    const callArg = mockPrisma.presenceEvent.create.mock.calls[0][0].data;
    expect(callArg.recordedBy).toBeNull();
    expect(callArg.deviceId).toBeNull();
    expect(callArg.location).toBeNull();
    expect(callArg.direction).toBeNull();
    expect(callArg.sourceRecordId).toBeNull();
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  it('returns existing event on P2002 duplicate constraint error', async () => {
    const p2002Error = { code: 'P2002', message: 'Unique constraint failed' };
    mockPrisma.presenceEvent.create.mockRejectedValueOnce(p2002Error);
    mockPrisma.presenceEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(STORED_EVENT);

    const result = await service.emit(BASE_EVENT);

    expect(mockPrisma.presenceEvent.create).toHaveBeenCalledTimes(1);
    // One source-projection lookup before create, then one idempotency lookup
    // after the simulated concurrent insert wins the unique-key race.
    expect(mockPrisma.presenceEvent.findFirst).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('event-uuid-1');
    // Should NOT have written to failures table
    expect(mockPrisma.presenceEventFailure.create).not.toHaveBeenCalled();
  });

  it('queries existing event with correct fields on P2002', async () => {
    const p2002Error = { code: 'P2002' };
    mockPrisma.presenceEvent.create.mockRejectedValueOnce(p2002Error);
    mockPrisma.presenceEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(STORED_EVENT);

    await service.emit(BASE_EVENT);

    expect(mockPrisma.presenceEvent.findFirst).toHaveBeenCalledWith({
      where: {
        schoolId:  BASE_EVENT.schoolId,
        personId:  BASE_EVENT.personId,
        eventType: BASE_EVENT.eventType,
        timestamp: BASE_EVENT.timestamp,
      },
    });
  });

  it('updates an existing source projection when attendance is corrected', async () => {
    mockPrisma.presenceEvent.findFirst.mockResolvedValueOnce(STORED_EVENT);
    mockPrisma.presenceEvent.update.mockResolvedValueOnce({
      ...STORED_EVENT,
      metadata: { attendanceStatus: 'PRESENT' },
      version: 2,
    });

    const result = await service.emit({
      ...BASE_EVENT,
      metadata: { attendanceStatus: 'PRESENT' },
    });

    expect(mockPrisma.presenceEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.presenceEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: STORED_EVENT.id },
    }));
    expect(result.version).toBe(2);
  });

  // ── Failure recording ─────────────────────────────────────────────────────

  it('records failure and does NOT throw on unexpected DB error', async () => {
    const dbError = new Error('Connection timeout');
    mockPrisma.presenceEvent.create.mockRejectedValueOnce(dbError);
    mockPrisma.presenceEventFailure.create.mockResolvedValueOnce({ id: 'failure-1' });

    // Must not throw
    await expect(service.emit(BASE_EVENT)).resolves.toBeDefined();
    expect(mockPrisma.presenceEventFailure.create).toHaveBeenCalledTimes(1);
  });

  it('failure record contains sourceModule and payload', async () => {
    const dbError = new Error('DB error');
    mockPrisma.presenceEvent.create.mockRejectedValueOnce(dbError);
    mockPrisma.presenceEventFailure.create.mockResolvedValueOnce({ id: 'failure-1' });

    await service.emit(BASE_EVENT);

    const failureData = mockPrisma.presenceEventFailure.create.mock.calls[0][0].data;
    expect(failureData.sourceModule).toBe('ATTENDANCE');
    expect(failureData.errorMessage).toBe('DB error');
    expect(failureData.retryCount).toBe(0);
    expect(failureData.resolved).toBe(false);
  });

  it('returns synthetic event when DB error occurs (non-null return)', async () => {
    const dbError = new Error('DB unavailable');
    mockPrisma.presenceEvent.create.mockRejectedValueOnce(dbError);
    mockPrisma.presenceEventFailure.create.mockResolvedValueOnce({ id: 'f1' });

    const result = await service.emit(BASE_EVENT);

    expect(result).toBeDefined();
    expect(result.personId).toBe(BASE_EVENT.personId);
    expect(result.eventType).toBe(BASE_EVENT.eventType);
    expect(result.id).toMatch(/^synthetic-/);
  });

  it('does NOT throw even when failure recording itself fails', async () => {
    const dbError = new Error('DB error');
    mockPrisma.presenceEvent.create.mockRejectedValueOnce(dbError);
    mockPrisma.presenceEventFailure.create.mockRejectedValueOnce(new Error('Failures table also down'));

    await expect(service.emit(BASE_EVENT)).resolves.toBeDefined();
  });

  // ── Transaction client ────────────────────────────────────────────────────

  it('uses provided transaction client instead of global prisma', async () => {
    const txCreate = jest.fn().mockResolvedValueOnce(STORED_EVENT);
    const mockTx = { presenceEvent: { create: txCreate, findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() } };

    await service.emit(BASE_EVENT, mockTx as any);

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(mockPrisma.presenceEvent.create).not.toHaveBeenCalled();
  });
});
