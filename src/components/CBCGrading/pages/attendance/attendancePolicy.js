const LOCK_HOUR = 7;
const LOCK_MINUTE = 30;

export const ATTENDANCE_LOCK_LABEL = '7:30 AM';
export const LOCKED_ATTENDANCE_STATUSES = new Set(['PRESENT']);

export function getAttendancePolicyState(dateValue, now = new Date()) {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date(now);
  const lockAt = new Date(date);
  lockAt.setHours(LOCK_HOUR, LOCK_MINUTE, 0, 0);

  return {
    lockAt,
    isLocked: now >= lockAt,
    lockLabel: ATTENDANCE_LOCK_LABEL,
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
