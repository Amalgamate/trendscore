/**
 * BiometricAttendanceService
 *
 * Handles the translation of a raw biometric scan into an attendance record
 * with time-aware status detection (PRESENT vs LATE).
 *
 * Called by BiometricService.processAttendanceLog() after a device scan is
 * authenticated and the raw BiometricLog record has been created.
 *
 * Status logic:
 *  - Scan before or at lock time              → PRESENT
 *  - Scan after lock time, within grace window → LATE
 *  - Scan after grace window ends             → LATE (still recorded)
 *  - OUT direction                            → no status change to daily record
 *
 * This replaces the naive "always PRESENT" behaviour from the Phase 0 stub.
 */

import prisma from '../../config/database';
import { AttendanceStatus } from '@prisma/client';
import logger from '../../utils/logger';

// EAT = UTC+3
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return isNaN(h) || isNaN(m) ? 0 : h * 60 + m;
}

function timestampToEATMinutes(ts: Date): number {
  const eatMs   = ts.getTime() + EAT_OFFSET_MS;
  const eatDate = new Date(eatMs);
  return eatDate.getUTCHours() * 60 + eatDate.getUTCMinutes();
}

/**
 * Determine the correct attendance status for a biometric IN scan.
 * Returns PRESENT if before or at lock time, LATE if after.
 */
export function resolveAttendanceStatus(
  scanTimestamp:  Date,
  lockEnabled:    boolean,
  lockTimeHHMM:   string,
): AttendanceStatus {
  if (!lockEnabled) return AttendanceStatus.PRESENT;

  const lockMinutes = parseTimeToMinutes(lockTimeHHMM);
  const scanMinutes = timestampToEATMinutes(scanTimestamp);

  return scanMinutes <= lockMinutes ? AttendanceStatus.PRESENT : AttendanceStatus.LATE;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export interface BiometricScanInput {
  admissionNumber: string;
  direction:       'IN' | 'OUT';
  timestamp:       Date;
  deviceId:        string;
  schoolId:        string | null;
}

export interface BiometricScanResult {
  learnerId:      string;
  attendanceId:   string | null;
  status:         AttendanceStatus | null;
  action:         'created' | 'skipped_existing' | 'skipped_out' | 'error';
  message:        string;
}

export async function handleBiometricLearnerScan(
  input: BiometricScanInput,
): Promise<BiometricScanResult> {
  const learner = await prisma.learner.findFirst({
    where: { admissionNumber: input.admissionNumber },
    select: { id: true, grade: true },
  });

  if (!learner) {
    throw new Error(`Learner not found: admissionNumber=${input.admissionNumber}`);
  }

  // OUT scans don't affect the daily attendance status
  if (input.direction === 'OUT') {
    return {
      learnerId:    learner.id,
      attendanceId: null,
      status:       null,
      action:       'skipped_out',
      message:      'OUT scan recorded but daily status unchanged',
    };
  }

  const utcToday = new Date(
    Date.UTC(
      input.timestamp.getUTCFullYear(),
      input.timestamp.getUTCMonth(),
      input.timestamp.getUTCDate(),
    ),
  );

  // Don't overwrite an existing manual record
  const existing = await prisma.attendance.findUnique({
    where: { learnerId_date: { learnerId: learner.id, date: utcToday } },
  });

  if (existing) {
    return {
      learnerId:    learner.id,
      attendanceId: existing.id,
      status:       existing.status,
      action:       'skipped_existing',
      message:      `Attendance already recorded (${existing.status}) — biometric scan ignored`,
    };
  }

  // Fetch school lock config
  const school = input.schoolId
    ? await prisma.school.findUnique({
        where: { id: input.schoolId },
        select: { attendanceLockEnabled: true, attendanceLockTime: true },
      })
    : await prisma.school.findFirst({
        where: { archived: false, active: true },
        select: { attendanceLockEnabled: true, attendanceLockTime: true },
        orderBy: { createdAt: 'asc' },
      });

  const lockEnabled  = school?.attendanceLockEnabled ?? true;
  const lockTime     = school?.attendanceLockTime    ?? '07:30';
  const finalStatus  = resolveAttendanceStatus(input.timestamp, lockEnabled, lockTime);

  // Resolve a system user for markedBy (FK requirement)
  const systemUser = await prisma.user.findFirst({
    where: { OR: [{ role: 'SUPER_ADMIN' }, { role: 'ADMIN' }] },
    select: { id: true },
  });

  if (!systemUser) {
    throw new Error('No admin user found for markedBy — cannot create attendance record');
  }

  const eatTime = new Date(input.timestamp.getTime() + EAT_OFFSET_MS);
  const timeStr = `${String(eatTime.getUTCHours()).padStart(2,'0')}:${String(eatTime.getUTCMinutes()).padStart(2,'0')}`;

  const attendance = await prisma.attendance.create({
    data: {
      learnerId: learner.id,
      date:      utcToday,
      status:    finalStatus,
      source:    'BIOMETRIC',
      remarks:   `Biometric ${input.direction} at ${timeStr} EAT`,
      markedBy:  systemUser.id,
    },
  });

  logger.info('[BiometricAttendance] Attendance created', {
    learnerId: learner.id,
    status: finalStatus,
    lockTime,
    scanTime: timeStr,
  });

  return {
    learnerId:    learner.id,
    attendanceId: attendance.id,
    status:       finalStatus,
    action:       'created',
    message:      `Marked ${finalStatus} via biometric scan at ${timeStr} EAT`,
  };
}
