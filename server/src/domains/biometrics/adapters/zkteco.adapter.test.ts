/**
 * Unit tests for ZKTeco adapter
 * axios mocked for pull-mode tests.
 */

jest.mock('axios');
import axios from 'axios';
import {
  normaliseZKTecoPushPayload,
  pullAttendanceLogs,
} from './zkteco.adapter';

const mockAxios = axios as jest.Mocked<typeof axios>;

// ── Push payload normalisation ────────────────────────────────────────────────

describe('normaliseZKTecoPushPayload()', () => {
  it('normalises standard push payload (pin + time + status 0 = IN)', () => {
    const result = normaliseZKTecoPushPayload({
      pin:      'ADM-001',
      time:     '2026-08-04 07:15:00',
      status:   0,
      verified: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.personId).toBe('ADM-001');
    expect(result!.direction).toBe('IN');
    expect(result!.verifyType).toBe('FINGERPRINT');
    expect(result!.timestamp).toBeInstanceOf(Date);
  });

  it('normalises alternate field names (employee_id + punch_time + punch_type)', () => {
    const result = normaliseZKTecoPushPayload({
      employee_id: 'EMP-042',
      punch_time:  '2026-08-04 17:30:00',
      punch_type:  '1', // OUT
      verified:    4,   // card
    });
    expect(result).not.toBeNull();
    expect(result!.personId).toBe('EMP-042');
    expect(result!.direction).toBe('OUT');
    expect(result!.verifyType).toBe('CARD');
  });

  it('returns null when pin/employee_id is missing', () => {
    const result = normaliseZKTecoPushPayload({ time: '2026-08-04 07:15:00', status: 0 });
    expect(result).toBeNull();
  });

  it('returns null when time/punch_time is missing', () => {
    const result = normaliseZKTecoPushPayload({ pin: 'ADM-001', status: 0 });
    expect(result).toBeNull();
  });

  it('returns null when timestamp cannot be parsed', () => {
    const result = normaliseZKTecoPushPayload({ pin: 'ADM-001', time: 'not-a-date', status: 0 });
    expect(result).toBeNull();
  });

  it('maps verified=15 to FACE', () => {
    const result = normaliseZKTecoPushPayload({ pin: 'ADM-001', time: '2026-08-04 07:15:00', verified: 15 });
    expect(result!.verifyType).toBe('FACE');
  });

  it('maps verified=0 to PASSWORD', () => {
    const result = normaliseZKTecoPushPayload({ pin: 'ADM-001', time: '2026-08-04 07:15:00', verified: 0 });
    expect(result!.verifyType).toBe('PASSWORD');
  });

  it('maps unknown verified codes to UNKNOWN', () => {
    const result = normaliseZKTecoPushPayload({ pin: 'ADM-001', time: '2026-08-04 07:15:00', verified: 99 });
    expect(result!.verifyType).toBe('UNKNOWN');
  });

  it('preserves raw payload in result', () => {
    const raw = { pin: 'ADM-001', time: '2026-08-04 07:15:00', status: 0, device_sn: 'SN001' };
    const result = normaliseZKTecoPushPayload(raw);
    expect(result!.rawPayload).toMatchObject({ device_sn: 'SN001' });
  });
});

// ── Pull mode ─────────────────────────────────────────────────────────────────

describe('pullAttendanceLogs()', () => {
  beforeEach(() => jest.clearAllMocks());

  const DEVICE = { ipAddress: '192.168.1.100', port: 4370 };
  const SINCE  = new Date('2026-08-04T04:00:00Z');
  const UNTIL  = new Date('2026-08-04T04:15:00Z');

  it('parses tab-delimited attlog response', async () => {
    mockAxios.get.mockResolvedValueOnce({
      data: 'ADM-001\t2026-08-04 07:05:00\t0\t1\nADM-002\t2026-08-04 07:10:00\t1\t1\n',
    });

    const records = await pullAttendanceLogs(DEVICE, SINCE, UNTIL);
    expect(records).toHaveLength(2);
    expect(records[0].pin).toBe('ADM-001');
    expect(records[0].direction).toBe('IN');
    expect(records[1].pin).toBe('ADM-002');
    expect(records[1].direction).toBe('OUT');
  });

  it('returns empty array for empty response', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: '' });
    const records = await pullAttendanceLogs(DEVICE, SINCE, UNTIL);
    expect(records).toHaveLength(0);
  });

  it('skips malformed lines (fewer than 3 columns)', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: 'ADM-001\tbadline\nADM-002\t2026-08-04 07:10:00\t0\t1\n' });
    const records = await pullAttendanceLogs(DEVICE, SINCE, UNTIL);
    expect(records).toHaveLength(1);
    expect(records[0].pin).toBe('ADM-002');
  });

  it('throws when device is unreachable', async () => {
    mockAxios.get.mockRejectedValueOnce({ message: 'ECONNREFUSED' });
    await expect(pullAttendanceLogs(DEVICE, SINCE, UNTIL)).rejects.toThrow('ZKTeco pull failed');
  });

  it('includes Authorization header when apiKey provided', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: '' });
    await pullAttendanceLogs({ ...DEVICE, apiKey: 'secret-key' }, SINCE, UNTIL);
    const config = mockAxios.get.mock.calls[0][1] as any;
    expect(config.headers.Authorization).toBe('Bearer secret-key');
  });
});
