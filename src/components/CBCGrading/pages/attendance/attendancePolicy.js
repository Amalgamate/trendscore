import { DEFAULT_ATTENDANCE_SETTINGS, formatAttendanceLockTime } from './attendanceSettings';

export const ATTENDANCE_LOCK_LABEL = formatAttendanceLockTime(DEFAULT_ATTENDANCE_SETTINGS.lockTime);
export const LOCKED_ATTENDANCE_STATUSES = new Set(['PRESENT']);
const ALL_ATTENDANCE_STATUSES = new Set(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

export function getLockedAttendanceStatuses(settings = DEFAULT_ATTENDANCE_SETTINGS) {
  return settings?.allowLateAfterLock === false ? ALL_ATTENDANCE_STATUSES : LOCKED_ATTENDANCE_STATUSES;
}

function parseLockTime(value) {
  const [hour, minute] = String(value || DEFAULT_ATTENDANCE_SETTINGS.lockTime)
    .split(':')
    .map((part) => Number.parseInt(part, 10));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return [7, 30];
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return [7, 30];
  return [hour, minute];
}

export function getAttendancePolicyState(dateValue, now = new Date(), settings = DEFAULT_ATTENDANCE_SETTINGS) {
  const effectiveSettings = { ...DEFAULT_ATTENDANCE_SETTINGS, ...(settings || {}) };
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date(now);
  const lockAt = new Date(date);
  const [lockHour, lockMinute] = parseLockTime(effectiveSettings.lockTime);
  lockAt.setHours(lockHour, lockMinute, 0, 0);

  return {
    lockAt,
    isLocked: Boolean(effectiveSettings.lockEnabled) && now >= lockAt,
    lockLabel: formatAttendanceLockTime(effectiveSettings.lockTime),
    settings: effectiveSettings,
  };
}

export function getCompletionTimeFromLearners(learners = []) {
  const markedTimes = learners
    .map((learner) => learner?.attendance?.markedAt)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (markedTimes.length === 0) return null;
  return new Date(Math.max(...markedTimes.map((date) => date.getTime())));
}

export function formatCompletionTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
