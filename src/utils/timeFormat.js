/**
 * Shared time parsing and formatting utilities for the timetable module.
 *
 * Centralises helpers previously duplicated across:
 *   - TimetablePage.jsx       (parseTimeToMinutes, toDisplayTime, normalizeSlotKeyPart, buildSlotKey, buildTimeLine, sortTimeLabels)
 *   - TimetableView.jsx       (fmt12, minutesFromMidnight, durationLabel, todayDayName)
 *   - TimetableEngineSetup.jsx (buildPeriods)
 */

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Convert a time string to total minutes since midnight.
 *
 * Handles both 12-hour format ("8:45 AM") and 24-hour format ("08:45").
 * Returns `NaN` for any input that cannot be parsed.
 *
 * @param {string} value - Time string in 12-hour or 24-hour format.
 * @returns {number} Minutes since midnight, or `NaN` if the input is invalid.
 */
export const parseTimeToMinutes = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;

  const twelveHourMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHourMatch) {
    const hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const meridiem = twelveHourMatch[3].toUpperCase();
    let normalizedHours = hours % 12;
    if (meridiem === 'PM') normalizedHours += 12;
    return (normalizedHours * 60) + minutes;
  }

  const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);
    return (hours * 60) + minutes;
  }

  return Number.NaN;
};

/**
 * Convert integer minutes since midnight to a zero-padded 24-hour string.
 *
 * @param {number} minutes - Minutes since midnight (e.g. 495).
 * @returns {string} Time string in "HH:MM" format (e.g. "08:15").
 */
export const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Return integer minutes since midnight for a 24-hour time string.
 *
 * Similar to `parseTimeToMinutes` but typed for 24-hour input and returns 0
 * for null/undefined values (safe for arithmetic in sort comparators).
 *
 * @param {string} time24 - Time string in "HH:MM" 24-hour format.
 * @returns {number} Minutes since midnight, or 0 if the input is falsy.
 */
export const minutesFromMidnight = (time24) => {
  if (!time24) return 0;
  const [h, m] = time24.split(':').map(Number);
  return h * 60 + (m || 0);
};

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Convert a time string (12-hour or 24-hour) to a 12-hour display string.
 *
 * Returns the original value unchanged when the input cannot be parsed.
 *
 * @param {string} value - Time string in any supported format.
 * @returns {string} Time in "H:MM AM/PM" format (e.g. "8:45 AM").
 */
export const toDisplayTime = (value) => {
  const minutes = parseTimeToMinutes(value);
  if (Number.isNaN(minutes)) return String(value || '').trim();

  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = ((hours24 + 11) % 12) + 1;
  return `${hours12}:${String(mins).padStart(2, '0')} ${meridiem}`;
};

/**
 * Convert a 24-hour time string to a 12-hour display string with AM/PM suffix.
 *
 * Returns an empty string for null/undefined input.
 *
 * @param {string} time24 - Time string in "HH:MM" 24-hour format.
 * @returns {string} Time in "H:MM AM/PM" format (e.g. "8:45 AM").
 */
export const fmt12 = (time24) => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

/**
 * Build a human-readable time range label from two time strings.
 *
 * @param {string} startTime - Start time (any supported format).
 * @param {string} endTime   - End time (any supported format).
 * @returns {string} Label in "H:MM AM - H:MM PM" format (e.g. "8:00 AM - 8:45 AM").
 */
export const buildTimeLine = (startTime, endTime) => `${toDisplayTime(startTime)} - ${toDisplayTime(endTime)}`;

/**
 * Return a human-readable duration label for a time range.
 *
 * @param {string} start - Start time in "HH:MM" 24-hour format.
 * @param {string} end   - End time in "HH:MM" 24-hour format.
 * @returns {string} Duration label such as "40min" or "1h 20m", or "" if non-positive.
 */
export const durationLabel = (start, end) => {
  const diff = minutesFromMidnight(end) - minutesFromMidnight(start);
  if (diff <= 0) return '';
  return diff < 60 ? `${diff}min` : `${Math.floor(diff / 60)}h${diff % 60 ? ` ${diff % 60}m` : ''}`;
};

// ─── Slot key helpers ─────────────────────────────────────────────────────────

/**
 * Normalise any time representation to a zero-padded "HH:MM" 24-hour string
 * suitable for use as a map / object key.
 *
 * Falls back to an uppercased version of the raw value when parsing fails.
 *
 * @param {string} value - Time string in any supported format.
 * @returns {string} Normalised 24-hour key part (e.g. "08:45").
 */
export const normalizeSlotKeyPart = (value) => {
  const minutes = parseTimeToMinutes(value);
  if (Number.isNaN(minutes)) return String(value || '').trim().toUpperCase();
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Build a stable slot key from a start and end time pair.
 *
 * Both values are normalised to 24-hour "HH:MM" before joining with a hyphen,
 * so "8:00 AM - 8:45 AM" and "08:00-08:45" produce the same key.
 *
 * @param {string} startTime - Start time (any supported format).
 * @param {string} endTime   - End time (any supported format).
 * @returns {string} Slot key in "HH:MM-HH:MM" format (e.g. "08:00-08:45").
 */
export const buildSlotKey = (startTime, endTime) => `${normalizeSlotKeyPart(startTime)}-${normalizeSlotKeyPart(endTime)}`;

// ─── Sorting ──────────────────────────────────────────────────────────────────

/**
 * Sort an array of time-line label strings by their start time component.
 *
 * Time-line labels are in "H:MM AM - H:MM PM" format as produced by
 * `buildTimeLine`. Strings that cannot be parsed sort lexicographically.
 *
 * @param {string[]} timeLabels - Array of time-line strings to sort.
 * @returns {string[]} A new sorted array (the original is not mutated).
 */
export const sortTimeLabels = (timeLabels) => {
  return [...timeLabels].sort((a, b) => {
    const aStart = String(a || '').split('-')[0]?.trim() || a;
    const bStart = String(b || '').split('-')[0]?.trim() || b;
    const aMinutes = parseTimeToMinutes(aStart);
    const bMinutes = parseTimeToMinutes(bStart);
    if (Number.isNaN(aMinutes) || Number.isNaN(bMinutes)) return String(a).localeCompare(String(b));
    return aMinutes - bMinutes;
  });
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Return the uppercase day name for today's date.
 *
 * @returns {string} Uppercase day name, e.g. "MONDAY".
 */
export const todayDayName = () => {
  const idx = new Date().getDay(); // 0=Sun … 6=Sat
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][idx];
};

// ─── Bell schedule helpers ────────────────────────────────────────────────────

/**
 * Generate an array of period objects for a bell schedule.
 *
 * Periods are laid out consecutively starting from `startTime`, each
 * `duration` minutes long. Used when creating a new bell schedule in the
 * timetable engine setup.
 *
 * @param {string} startTime - First period start time in "HH:MM" 24-hour format.
 * @param {number} duration  - Duration of each period in minutes.
 * @param {number} count     - Number of periods to generate.
 * @returns {Array<{ name: string, sequence: number, startTime: string, endTime: string, type: string, instructional: boolean }>}
 */
export const buildPeriods = (startTime, duration, count) => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const firstMinute = (startHour * 60) + startMinute;
  return Array.from({ length: count }, (_, index) => {
    const start = firstMinute + (index * duration);
    const end = start + duration;
    const format = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    return { name: `Period ${index + 1}`, sequence: index + 1, startTime: format(start), endTime: format(end), type: 'LESSON', instructional: true };
  });
};
