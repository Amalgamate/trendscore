/**
 * Attendance Lock Enforcement
 *
 * Evaluates whether attendance marking is permitted at the current time,
 * based on the school's attendance lock configuration.
 *
 * Config fields used from the School model:
 *   attendanceLockEnabled              — master on/off switch
 *   attendanceLockTime                 — "HH:MM" string, EAT (UTC+3)
 *   attendanceUnlockWindowMinutes      — grace window after lock (default 60 min)
 *   attendanceAllowLateAfterLock       — if true, force PRESENT→LATE past the lock window
 *                                        (does NOT block explicit LATE/EXCUSED saves)
 *   attendanceRequireRemarksForLateExcused — if true, remarks required for LATE or EXCUSED
 *
 * Exception statuses (LATE, EXCUSED, ABSENT) are ALWAYS saveable after the lock,
 * regardless of allowLateAfterLock. The lock only gates PRESENT bulk marking.
 *
 * Roles that bypass the lock entirely:
 *   SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */

import { ApiError } from '../../utils/error.util';

// Roles that are never blocked by the lock window
const LOCK_BYPASS_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']);

// EAT = UTC+3
const EAT_OFFSET_MINUTES = 3 * 60;

export interface SchoolAttendanceLockConfig {
  attendanceLockEnabled: boolean;
  attendanceLockTime: string;             // "HH:MM"
  attendanceUnlockWindowMinutes: number;
  attendanceAllowLateAfterLock: boolean;
  attendanceRequireRemarksForLateExcused: boolean;
}

/** Statuses that are treated as exceptions and always saveable after the lock. */
export const EXCEPTION_STATUSES = new Set(['LATE', 'EXCUSED', 'ABSENT']);

export interface LockCheckResult {
  /** Whether marking is permitted to proceed */
  allowed: boolean;
  /**
   * When true the caller must force the status to LATE regardless of
   * what the client submitted — lock has passed but allowLateAfterLock is on.
   */
  forceStatusLate: boolean;
  lockTime: string;
  currentTimeEAT: string;
}

/**
 * Parse a "HH:MM" time string into total minutes since midnight.
 */
function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Get the current time in EAT as total minutes since midnight.
 */
function nowEATMinutes(): number {
  const nowUtcMs = Date.now();
  const eatMs = nowUtcMs + EAT_OFFSET_MINUTES * 60 * 1000;
  const eatDate = new Date(eatMs);
  return eatDate.getUTCHours() * 60 + eatDate.getUTCMinutes();
}

/**
 * Format total minutes since midnight as "HH:MM".
 */
function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Check whether attendance marking is currently allowed.
 *
 * @param role             - The current user's role string
 * @param config           - The school's attendance lock configuration
 * @param submittedStatuses - Optional set of statuses being saved. When ALL
 *                            submitted statuses are exceptions (LATE, EXCUSED,
 *                            ABSENT) the lock is bypassed — exceptions are
 *                            always saveable regardless of lock config.
 * @param teacherExempt    - When true, the teacher has been individually
 *                            exempted from the lock on their class/subject
 *                            assignment. Bypasses the lock entirely.
 * @param nowMinutes       - Optional override for current time in minutes (for testing)
 * @returns                LockCheckResult
 */
export function checkAttendanceLock(
  role: string,
  config: SchoolAttendanceLockConfig,
  submittedStatuses?: string[],
  teacherExempt?: boolean,
  nowMinutes?: number,
): LockCheckResult {
  const currentMinutes = nowMinutes ?? nowEATMinutes();
  const lockMinutes = parseTimeToMinutes(config.attendanceLockTime);

  const result: LockCheckResult = {
    allowed: true,
    forceStatusLate: false,
    lockTime: config.attendanceLockTime,
    currentTimeEAT: minutesToHHMM(currentMinutes),
  };

  // Lock not enabled — always allowed
  if (!config.attendanceLockEnabled) {
    return result;
  }

  // Privileged roles bypass the lock entirely
  if (LOCK_BYPASS_ROLES.has(role)) {
    return result;
  }

  // Teacher has been individually exempted on this class/subject assignment
  if (teacherExempt) {
    return result;
  }

  // Still within the allowed window before lock time
  if (currentMinutes <= lockMinutes) {
    return result;
  }

  // Past lock time — exception-only saves (LATE, EXCUSED, ABSENT) are always
  // allowed regardless of allowLateAfterLock. These are deliberate per-learner
  // markings, not bulk-present changes that the lock is designed to gate.
  const allExceptions =
    Array.isArray(submittedStatuses) &&
    submittedStatuses.length > 0 &&
    submittedStatuses.every((s) => EXCEPTION_STATUSES.has(s));
  if (allExceptions) {
    return result;
  }

  // Past lock time — check grace window
  const minutesOverLock = currentMinutes - lockMinutes;
  const withinGraceWindow = minutesOverLock <= config.attendanceUnlockWindowMinutes;

  if (withinGraceWindow) {
    // Within grace window — allow but force LATE if allowLateAfterLock is on
    if (config.attendanceAllowLateAfterLock) {
      return { ...result, allowed: true, forceStatusLate: true };
    }
    // Grace window but allowLateAfterLock is off — blocked
    return { ...result, allowed: false };
  }

  // Past grace window — if allowLateAfterLock is true, still allow LATE marking
  // all day. A late student can arrive at any time, not just within 60 min of the
  // lock. This keeps marking open for latecomers while still blocking "bulk present"
  // on the frontend.
  if (config.attendanceAllowLateAfterLock) {
    return { ...result, allowed: true, forceStatusLate: true };
  }

  // Fully locked — no marking allowed
  return { ...result, allowed: false };
}

/**
 * Validate that LATE or EXCUSED statuses include remarks when required.
 * Throws ApiError if the constraint is violated.
 */
export function enforceRemarksRule(
  status: string,
  remarks: string | undefined | null,
  requireRemarks: boolean,
): void {
  if (!requireRemarks) return;
  const requiresRemarks = status === 'LATE' || status === 'EXCUSED';
  if (requiresRemarks && (!remarks || remarks.trim().length === 0)) {
    throw new ApiError(
      400,
      `Remarks are required when marking a learner as ${status}`,
    );
  }
}

/**
 * Build the standard 422 error for a closed attendance window.
 */
export function buildLockClosedError(result: LockCheckResult): ApiError {
  return new ApiError(
    422,
    `Attendance window is closed. Lock time was ${result.lockTime} (current time: ${result.currentTimeEAT} EAT)`,
  ).withCode('ATTENDANCE_WINDOW_CLOSED');
}
