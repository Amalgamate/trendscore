/**
 * AttendanceStatusChip
 * One-tap status selector chip — core of the exceptions workflow.
 * Variants: compact (for learner cards), pill (for summaries)
 */

import React from 'react';
import { cn } from '../../../../utils/cn';

export const ATTENDANCE_STATUSES = {
  PRESENT:           { label: 'Present',         shortLabel: 'P',  color: 'emerald', emoji: '✓' },
  ABSENT:            { label: 'Absent',           shortLabel: 'A',  color: 'rose',    emoji: '✕' },
  LATE:              { label: 'Late',             shortLabel: 'L',  color: 'amber',   emoji: '⏰' },
  SICK:              { label: 'Sick',             shortLabel: 'S',  color: 'orange',  emoji: '🤒' },
  EXCUSED:           { label: 'Excused',          shortLabel: 'E',  color: 'sky',     emoji: '📋' },
  SCHOOL_ACTIVITY:   { label: 'School Activity',  shortLabel: 'SA', color: 'violet',  emoji: '🏫' },
  SUSPENDED:         { label: 'Suspended',        shortLabel: 'SU', color: 'red',     emoji: '⛔' },
};

// Only show these in the exceptions panel (PRESENT is handled by Mark All button)
export const EXCEPTION_STATUSES = ['ABSENT', 'LATE', 'SICK', 'EXCUSED', 'SCHOOL_ACTIVITY', 'SUSPENDED'];

// Quick-select statuses for learner cards (most common)
export const QUICK_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'SICK', 'EXCUSED'];

const COLOR_CLASSES = {
  emerald: {
    active:   'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200',
    inactive: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    pill:     'bg-emerald-100 text-emerald-700',
    dot:      'bg-emerald-500',
  },
  rose: {
    active:   'bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-200',
    inactive: 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50',
    pill:     'bg-rose-100 text-rose-700',
    dot:      'bg-rose-500',
  },
  amber: {
    active:   'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200',
    inactive: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
    pill:     'bg-amber-100 text-amber-700',
    dot:      'bg-amber-500',
  },
  orange: {
    active:   'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-200',
    inactive: 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50',
    pill:     'bg-orange-100 text-orange-700',
    dot:      'bg-orange-500',
  },
  sky: {
    active:   'bg-sky-500 text-white border-sky-500 shadow-sm shadow-sky-200',
    inactive: 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50',
    pill:     'bg-sky-100 text-sky-700',
    dot:      'bg-sky-500',
  },
  violet: {
    active:   'bg-violet-500 text-white border-violet-500 shadow-sm shadow-violet-200',
    inactive: 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50',
    pill:     'bg-violet-100 text-violet-700',
    dot:      'bg-violet-500',
  },
  red: {
    active:   'bg-red-600 text-white border-red-600 shadow-sm shadow-red-200',
    inactive: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
    pill:     'bg-red-100 text-red-700',
    dot:      'bg-red-600',
  },
};

/**
 * Button chip for changing a learner's status.
 * @param {string} status - The status this chip represents
 * @param {boolean} isSelected - Whether this status is currently active
 * @param {function} onClick - Called with status when clicked
 * @param {boolean} compact - Smaller form factor for tight layouts
 */
export function AttendanceStatusChip({ status, isSelected, onClick, compact = false }) {
  const config = ATTENDANCE_STATUSES[status];
  if (!config) return null;
  const colors = COLOR_CLASSES[config.color];

  return (
    <button
      type="button"
      onClick={() => onClick(status)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-150 select-none active:scale-95',
        compact
          ? 'h-7 px-2.5 text-[11px]'
          : 'h-9 px-3.5 text-xs',
        isSelected ? colors.active : colors.inactive
      )}
      aria-pressed={isSelected}
    >
      <span>{config.shortLabel}</span>
      {!compact && <span>{config.label}</span>}
    </button>
  );
}

/**
 * Display-only badge showing a learner's current status.
 */
export function AttendanceStatusBadge({ status, size = 'md' }) {
  const config = ATTENDANCE_STATUSES[status];
  if (!config) return null;
  const colors = COLOR_CLASSES[config.color];

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-semibold',
      size === 'sm'  && 'px-2 py-0.5 text-[10px]',
      size === 'md'  && 'px-2.5 py-1 text-xs',
      size === 'lg'  && 'px-3 py-1.5 text-sm',
      colors.pill
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colors.dot)} />
      {config.label}
    </span>
  );
}

export default AttendanceStatusChip;
