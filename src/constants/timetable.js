/**
 * Timetable Module Constants
 * Single source of truth for timetable-related constants across the application.
 * Replaces inline arrays and magic strings duplicated in TimetableEngineSetup.jsx,
 * TimetableDraftEditor.jsx, TimetableView.jsx, TimetablePage.jsx, and
 * change-requests.service.ts.
 */

// ── School Days ───────────────────────────────────────────────────────────────

/**
 * Ordered weekday names in title case — use for display and iteration.
 * @type {string[]}
 */
export const SCHOOL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * Ordered weekday names in UPPER_CASE — matches the `day` field on ClassSchedule /
 * TimetableEntry Prisma models.
 * @type {string[]}
 */
export const SCHOOL_DAYS_UPPER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

/**
 * Abbreviated display labels keyed by both title-case and upper-case day names.
 * Useful for compact grid headers.
 * @type {Object.<string, string>}
 * @example
 * SCHOOL_DAYS_SHORT['Monday']  // 'Mon'
 * SCHOOL_DAYS_SHORT['MONDAY']  // 'Mon'
 */
export const SCHOOL_DAYS_SHORT = {
  Monday:    'Mon',
  Tuesday:   'Tue',
  Wednesday: 'Wed',
  Thursday:  'Thu',
  Friday:    'Fri',
  MONDAY:    'Mon',
  TUESDAY:   'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY:  'Thu',
  FRIDAY:    'Fri',
};

/**
 * Maps upper-case day names (as stored in the DB) to title-case display names.
 * Used by TimetableView to render day headings from ClassSchedule records.
 * @type {Object.<string, string>}
 * @example
 * SCHOOL_DAYS_FULL['MONDAY']  // 'Monday'
 */
export const SCHOOL_DAYS_FULL = {
  MONDAY:    'Monday',
  TUESDAY:   'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY:  'Thursday',
  FRIDAY:    'Friday',
  SATURDAY:  'Saturday',
  SUNDAY:    'Sunday',
};

/**
 * Numeric sort order for all days of the week, keyed by upper-case name.
 * Saturday and Sunday are included so schedule data that spans the full week
 * sorts predictably.
 * @type {Object.<string, number>}
 * @example
 * entries.sort((a, b) => SCHOOL_DAY_ORDER[a.day] - SCHOOL_DAY_ORDER[b.day]);
 */
export const SCHOOL_DAY_ORDER = {
  MONDAY:    0,
  TUESDAY:   1,
  WEDNESDAY: 2,
  THURSDAY:  3,
  FRIDAY:    4,
  SATURDAY:  5,
  SUNDAY:    6,
};

// ── Timetable Version Lifecycle ───────────────────────────────────────────────

/**
 * Ordered list of all possible TimetableVersion statuses.
 * The sequence represents the standard promotion path from creation to archival.
 * @type {string[]}
 */
export const TIMETABLE_VERSION_STATUSES = [
  'DRAFT',
  'GENERATED',
  'DEPARTMENT_REVIEW',
  'DEPUTY_REVIEW',
  'PRINCIPAL_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'LOCKED',
  'ARCHIVED',
];

// ── Change Request Statuses ───────────────────────────────────────────────────

/**
 * All possible statuses for a teacher schedule-change request.
 * @type {string[]}
 */
export const CHANGE_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

// ── Period Types ──────────────────────────────────────────────────────────────

/**
 * All period types recognised by the bell-schedule engine.
 * Only `LESSON` periods are counted towards instructional time; the rest are
 * non-teaching slots.
 * @type {string[]}
 */
export const PERIOD_TYPES = [
  'LESSON',
  'BREAK',
  'LUNCH',
  'REGISTRATION',
  'ASSEMBLY',
];

// ── Bell Schedule Presets ─────────────────────────────────────────────────────

/**
 * Quick-fill presets for the bell-schedule creation form, grouped by school level.
 * Each preset sets sensible defaults for period duration, count, and start time.
 *
 * @typedef {Object} SchedulePreset
 * @property {string} label     - Display name for the school level (e.g. 'Lower Primary')
 * @property {string} sub       - Grade range subtitle shown below the label
 * @property {number} duration  - Default period duration in minutes
 * @property {number} count     - Default number of periods per day
 * @property {string} startTime - Default first-period start time in 24-hour HH:MM format
 * @property {string} name      - Pre-filled bell schedule name
 * @property {string} desc      - Short description shown on the preset card
 *
 * @type {SchedulePreset[]}
 */
export const SCHEDULE_PRESETS = [
  {
    label:     'Lower Primary',
    sub:       'PP1–Gr 3',
    duration:  30,
    count:     8,
    startTime: '08:00',
    name:      'Lower Primary Bell Schedule',
    desc:      '30m · 8 periods',
  },
  {
    label:     'Upper Primary',
    sub:       'Gr 4–6',
    duration:  40,
    count:     9,
    startTime: '08:00',
    name:      'Upper Primary Bell Schedule',
    desc:      '40m · 9 periods',
  },
  {
    label:     'Secondary',
    sub:       'Gr 7–12',
    duration:  45,
    count:     8,
    startTime: '08:00',
    name:      'Secondary Bell Schedule',
    desc:      '45m · 8 periods',
  },
];

// ── Room Types ────────────────────────────────────────────────────────────────

/**
 * All recognised room/venue types for the timetable rooms registry.
 * `CLASSROOM` is the default type; all others are specialist facilities
 * that can be flagged as requiring booking.
 * @type {string[]}
 */
export const ROOM_TYPES = [
  'CLASSROOM',
  'SCIENCE_LAB',
  'ICT_LAB',
  'LIBRARY',
  'MUSIC_ROOM',
  'ART_ROOM',
  'WORKSHOP',
  'AGRICULTURE_FIELD',
  'SWIMMING_POOL',
  'MULTIPURPOSE_HALL',
  'SPORTS_GROUND',
  'OTHER',
];
