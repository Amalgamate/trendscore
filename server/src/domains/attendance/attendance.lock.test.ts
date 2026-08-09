/**
 * Unit tests for attendance lock enforcement.
 * No database required — pure business logic.
 */

import {
  checkAttendanceLock,
  enforceRemarksRule,
  buildLockClosedError,
  SchoolAttendanceLockConfig,
} from './attendance.lock';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_CONFIG: SchoolAttendanceLockConfig = {
  attendanceLockEnabled: true,
  attendanceLockTime: '09:00',          // lock at 09:00 EAT
  attendanceUnlockWindowMinutes: 60,    // grace window: 09:00–10:00
  attendanceAllowLateAfterLock: true,   // allow marking as LATE within grace
  attendanceRequireRemarksForLateExcused: true,
};

// Helper: convert "HH:MM" to total minutes
function hhmm(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// ── checkAttendanceLock ────────────────────────────────────────────────────────

describe('checkAttendanceLock', () => {

  describe('lock disabled', () => {
    it('allows any time when lock is disabled', () => {
      const config = { ...BASE_CONFIG, attendanceLockEnabled: false };
      const result = checkAttendanceLock('TEACHER', config, hhmm('14:00'));
      expect(result.allowed).toBe(true);
      expect(result.forceStatusLate).toBe(false);
    });
  });

  describe('before lock time', () => {
    it('allows TEACHER before lock time', () => {
      const result = checkAttendanceLock('TEACHER', BASE_CONFIG, hhmm('08:00'));
      expect(result.allowed).toBe(true);
      expect(result.forceStatusLate).toBe(false);
    });

    it('allows TEACHER exactly at lock time', () => {
      const result = checkAttendanceLock('TEACHER', BASE_CONFIG, hhmm('09:00'));
      expect(result.allowed).toBe(true);
      expect(result.forceStatusLate).toBe(false);
    });
  });

  describe('within grace window (09:01 – 10:00)', () => {
    it('allows with forceStatusLate=true when allowLateAfterLock is on', () => {
      const result = checkAttendanceLock('TEACHER', BASE_CONFIG, hhmm('09:30'));
      expect(result.allowed).toBe(true);
      expect(result.forceStatusLate).toBe(true);
    });

    it('blocks when allowLateAfterLock is false, even within grace window', () => {
      const config = { ...BASE_CONFIG, attendanceAllowLateAfterLock: false };
      const result = checkAttendanceLock('TEACHER', config, hhmm('09:30'));
      expect(result.allowed).toBe(false);
      expect(result.forceStatusLate).toBe(false);
    });

    it('allows at exactly lock + unlockWindow boundary', () => {
      // 09:00 + 60min = 10:00
      const result = checkAttendanceLock('TEACHER', BASE_CONFIG, hhmm('10:00'));
      expect(result.allowed).toBe(true);
      expect(result.forceStatusLate).toBe(true);
    });
  });

  describe('past grace window (after 10:00)', () => {
    it('blocks TEACHER after grace window', () => {
      const result = checkAttendanceLock('TEACHER', BASE_CONFIG, hhmm('10:01'));
      expect(result.allowed).toBe(false);
    });

    it('blocks TEACHER late afternoon', () => {
      const result = checkAttendanceLock('TEACHER', BASE_CONFIG, hhmm('14:00'));
      expect(result.allowed).toBe(false);
    });
  });

  describe('bypass roles', () => {
    it('always allows SUPER_ADMIN regardless of time', () => {
      const result = checkAttendanceLock('SUPER_ADMIN', BASE_CONFIG, hhmm('14:00'));
      expect(result.allowed).toBe(true);
      expect(result.forceStatusLate).toBe(false);
    });

    it('always allows ADMIN regardless of time', () => {
      const result = checkAttendanceLock('ADMIN', BASE_CONFIG, hhmm('15:30'));
      expect(result.allowed).toBe(true);
    });

    it('always allows HEAD_TEACHER regardless of time', () => {
      const result = checkAttendanceLock('HEAD_TEACHER', BASE_CONFIG, hhmm('11:00'));
      expect(result.allowed).toBe(true);
    });
  });

  describe('result fields', () => {
    it('returns lockTime and currentTimeEAT in result', () => {
      const result = checkAttendanceLock('TEACHER', BASE_CONFIG, hhmm('08:45'));
      expect(result.lockTime).toBe('09:00');
      expect(result.currentTimeEAT).toBe('08:45');
    });

    it('returns correctly formatted time for single-digit hours', () => {
      const result = checkAttendanceLock('TEACHER', BASE_CONFIG, hhmm('08:05'));
      expect(result.currentTimeEAT).toBe('08:05');
    });
  });

  describe('zero grace window', () => {
    it('blocks immediately after lock when grace=0 and allowLate=true', () => {
      const config = { ...BASE_CONFIG, attendanceUnlockWindowMinutes: 0 };
      const result = checkAttendanceLock('TEACHER', config, hhmm('09:01'));
      expect(result.allowed).toBe(false);
    });
  });
});

// ── enforceRemarksRule ────────────────────────────────────────────────────────

describe('enforceRemarksRule', () => {
  it('does nothing when requireRemarks is false', () => {
    expect(() => enforceRemarksRule('LATE', '', false)).not.toThrow();
  });

  it('does nothing for PRESENT even without remarks', () => {
    expect(() => enforceRemarksRule('PRESENT', '', true)).not.toThrow();
  });

  it('throws when LATE has no remarks and requireRemarks=true', () => {
    expect(() => enforceRemarksRule('LATE', '', true)).toThrow('Remarks are required');
  });

  it('throws when LATE has only whitespace remarks', () => {
    expect(() => enforceRemarksRule('LATE', '   ', true)).toThrow('Remarks are required');
  });

  it('throws when EXCUSED has no remarks and requireRemarks=true', () => {
    expect(() => enforceRemarksRule('EXCUSED', undefined, true)).toThrow('Remarks are required');
  });

  it('does not throw when LATE has substantive remarks', () => {
    expect(() => enforceRemarksRule('LATE', 'Traffic jam on the highway', true)).not.toThrow();
  });

  it('does not throw when EXCUSED has substantive remarks', () => {
    expect(() => enforceRemarksRule('EXCUSED', 'Medical appointment', true)).not.toThrow();
  });

  it('does not throw for ABSENT even without remarks', () => {
    expect(() => enforceRemarksRule('ABSENT', '', true)).not.toThrow();
  });

  it('does not throw for SICK even without remarks', () => {
    expect(() => enforceRemarksRule('SICK', '', true)).not.toThrow();
  });
});

// ── buildLockClosedError ──────────────────────────────────────────────────────

describe('buildLockClosedError', () => {
  it('returns ApiError with status 422', () => {
    const result = { allowed: false, forceStatusLate: false, lockTime: '09:00', currentTimeEAT: '11:00' };
    const err = buildLockClosedError(result);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('ATTENDANCE_WINDOW_CLOSED');
    expect(err.message).toContain('09:00');
    expect(err.message).toContain('11:00');
  });
});
