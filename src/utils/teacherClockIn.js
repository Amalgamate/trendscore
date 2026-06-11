import { hrAPI } from '../services/api';

const CLOCK_IN_PREFIX = 'teacher_clockin';

const toDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveTeacherId = (user) => user?.id || user?.userId || user?.email || 'unknown';

const buildClockInKey = (teacherId, dateKey = toDateKey()) => `${CLOCK_IN_PREFIX}:${teacherId}:${dateKey}`;

const mapBackendClockInRecord = (backendData, fallbackTeacherId, fallbackDateKey) => {
  const attendance = backendData?.attendance || backendData?.data?.attendance || backendData;
  if (!attendance) return null;

  const clockInAt = attendance.clockInAt || attendance.timestamp;
  const dateKey = attendance.date ? toDateKey(new Date(attendance.date)) : (fallbackDateKey || getTodayDateKey());

  return {
    teacherId: attendance.userId || fallbackTeacherId,
    dateKey,
    timestamp: clockInAt || new Date().toISOString(),
    clockOutAt: attendance.clockOutAt || null,
    source: attendance.source || 'web',
    metadata: attendance.metadata || null,
    payrollCreated: !!backendData?.payrollCreated,
    payrollRecordId: backendData?.payroll?.id || null,
    workedMinutesDelta: backendData?.workedMinutesDelta ?? null,
    workedDaysIncremented: backendData?.workedDaysIncremented ?? null
  };
};

const persistLocalClockInRecord = (record) => {
  if (!record?.teacherId || !record?.dateKey) return;
  localStorage.setItem(buildClockInKey(record.teacherId, record.dateKey), JSON.stringify(record));
};

const notifyClockInChange = (record) => {
  window.dispatchEvent(new CustomEvent('teacherClockInChanged', { detail: record }));
};

export const getTodayDateKey = () => toDateKey(new Date());

export const getCurrentWeekday = () => {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
};

export const getClockInRecord = (teacherId, dateKey = getTodayDateKey()) => {
  try {
    const raw = localStorage.getItem(buildClockInKey(teacherId, dateKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const isTeacherClockedIn = (teacherId, dateKey = getTodayDateKey()) => {
  const record = getClockInRecord(teacherId, dateKey);
  return !!record && !record.clockOutAt;
};

export const clockInTeacher = (user, metadata = {}) => {
  const teacherId = resolveTeacherId(user);
  const dateKey = getTodayDateKey();

  // Extract location fields forwarded by the caller (e.g. OwnerMobileDashboard)
  // so the server can enforce the geofence authoritatively.
  const { latitude, longitude, accuracyMeters, capturedAt, source, ...restMetadata } = metadata;

  const localRecord = {
    teacherId,
    dateKey,
    timestamp: new Date().toISOString(),
    source: source || 'web',
    metadata: {
      role: user?.role,
      ...restMetadata
    }
  };

  persistLocalClockInRecord(localRecord);
  notifyClockInChange(localRecord);

  const apiPayload = {
    timestamp: localRecord.timestamp,
    source: localRecord.source,
    metadata: localRecord.metadata,
    ...(latitude !== undefined && longitude !== undefined
      ? { latitude, longitude, accuracyMeters, capturedAt }
      : {})
  };

  hrAPI.clockInStaff(apiPayload)
    .then((response) => {
      if (!response?.success) return;
      const syncedRecord = mapBackendClockInRecord(response.data, teacherId, dateKey);
      if (!syncedRecord) return;
      persistLocalClockInRecord(syncedRecord);
      notifyClockInChange(syncedRecord);
    })
    .catch(() => {
      // Keep local clock-in state if backend is unavailable
    });

  return localRecord;
};

export const clockOutTeacher = (user, metadata = {}) => {
  const teacherId = resolveTeacherId(user);
  const dateKey = getTodayDateKey();
  const current = getClockInRecord(teacherId, dateKey);

  if (!current || current.clockOutAt) {
    return current || null;
  }

  // Extract location fields forwarded by the caller so the server can enforce
  // the geofence on clock-out authoritatively.
  const { latitude, longitude, accuracyMeters, capturedAt, source, ...restMetadata } = metadata;

  const localRecord = {
    ...current,
    clockOutAt: new Date().toISOString(),
    source: source || current.source || 'web',
    metadata: {
      ...(current.metadata || {}),
      role: user?.role,
      ...restMetadata
    }
  };

  persistLocalClockInRecord(localRecord);
  notifyClockInChange(localRecord);

  const apiPayload = {
    timestamp: localRecord.clockOutAt,
    source: localRecord.source,
    metadata: localRecord.metadata,
    ...(latitude !== undefined && longitude !== undefined
      ? { latitude, longitude, accuracyMeters, capturedAt }
      : {})
  };

  hrAPI.clockOutStaff(apiPayload)
    .then((response) => {
      if (!response?.success) return;
      const syncedRecord = mapBackendClockInRecord(response.data, teacherId, dateKey);
      if (!syncedRecord) return;
      persistLocalClockInRecord(syncedRecord);
      notifyClockInChange(syncedRecord);
    })
    .catch(() => {
      // Keep local clock-out state if backend is unavailable
    });

  return localRecord;
};

export const syncCurrentUserClockInStatus = async (user) => {
  const teacherId = resolveTeacherId(user);
  const dateKey = getTodayDateKey();

  try {
    const response = await hrAPI.getTodayClockIn();
    const backendRecord = mapBackendClockInRecord(response?.data, teacherId, dateKey);

    if (backendRecord) {
      persistLocalClockInRecord(backendRecord);
      notifyClockInChange(backendRecord);
      return {
        teacherId,
        dateKey,
        clockedIn: !backendRecord.clockOutAt,
        clockedToday: true,
        clockedOut: !!backendRecord.clockOutAt,
        record: backendRecord
      };
    }
  } catch {
    // Fall back to local storage state
  }

  return getCurrentUserClockInStatus(user);
};

export const getCurrentUserClockInStatus = (user) => {
  const teacherId = resolveTeacherId(user);
  const dateKey = getTodayDateKey();
  const record = getClockInRecord(teacherId, dateKey);
  const clockedToday = !!record;
  const clockedOut = !!record?.clockOutAt;

  return {
    teacherId,
    dateKey,
    clockedIn: !!record && !clockedOut,
    clockedToday,
    clockedOut,
    record
  };
};
