import { schoolAPI } from '../../../../services/api/school.api';

export const DEFAULT_ATTENDANCE_SETTINGS = {
  lockEnabled: true,
  lockTime: '07:30',
  unlockWindowMinutes: 60,
  allowLateAfterLock: true,
  requireRemarksForLateExcused: true,
  notifyAbsentDefault: true,
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const asBoolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

const asMinutes = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1440, Math.max(5, parsed));
};

export function normalizeAttendanceSettings(value = {}) {
  return {
    lockEnabled: asBoolean(value.lockEnabled, DEFAULT_ATTENDANCE_SETTINGS.lockEnabled),
    lockTime: TIME_PATTERN.test(value.lockTime || '') ? value.lockTime : DEFAULT_ATTENDANCE_SETTINGS.lockTime,
    unlockWindowMinutes: asMinutes(value.unlockWindowMinutes, DEFAULT_ATTENDANCE_SETTINGS.unlockWindowMinutes),
    allowLateAfterLock: asBoolean(value.allowLateAfterLock, DEFAULT_ATTENDANCE_SETTINGS.allowLateAfterLock),
    requireRemarksForLateExcused: asBoolean(
      value.requireRemarksForLateExcused,
      DEFAULT_ATTENDANCE_SETTINGS.requireRemarksForLateExcused
    ),
    notifyAbsentDefault: asBoolean(value.notifyAbsentDefault, DEFAULT_ATTENDANCE_SETTINGS.notifyAbsentDefault),
  };
}

export function attendanceSettingsFromSchool(school = {}) {
  return normalizeAttendanceSettings({
    lockEnabled: school.attendanceLockEnabled,
    lockTime: school.attendanceLockTime,
    unlockWindowMinutes: school.attendanceUnlockWindowMinutes,
    allowLateAfterLock: school.attendanceAllowLateAfterLock,
    requireRemarksForLateExcused: school.attendanceRequireRemarksForLateExcused,
    notifyAbsentDefault: school.attendanceNotifyAbsentDefault,
  });
}

export function attendanceSettingsToSchoolPayload(settings) {
  const normalized = normalizeAttendanceSettings(settings);
  return {
    attendanceLockEnabled: normalized.lockEnabled,
    attendanceLockTime: normalized.lockTime,
    attendanceUnlockWindowMinutes: normalized.unlockWindowMinutes,
    attendanceAllowLateAfterLock: normalized.allowLateAfterLock,
    attendanceRequireRemarksForLateExcused: normalized.requireRemarksForLateExcused,
    attendanceNotifyAbsentDefault: normalized.notifyAbsentDefault,
  };
}

export async function loadAttendanceSettings() {
  const response = await schoolAPI.getAll();
  const school = response?.data || response;
  return attendanceSettingsFromSchool(school);
}

export async function saveAttendanceSettings(settings) {
  const response = await schoolAPI.updateCurrent(attendanceSettingsToSchoolPayload(settings));
  const school = response?.data || response;
  return attendanceSettingsFromSchool(school);
}

export function formatAttendanceLockTime(value) {
  const lockTime = TIME_PATTERN.test(value || '') ? value : DEFAULT_ATTENDANCE_SETTINGS.lockTime;
  const [hourText, minuteText] = lockTime.split(':');
  const hour = Number.parseInt(hourText, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText} ${suffix}`;
}
