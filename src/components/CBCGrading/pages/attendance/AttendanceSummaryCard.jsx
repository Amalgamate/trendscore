/**
 * AttendanceSummaryCard
 * KPI-style card showing a single attendance metric.
 * Used in both desktop and mobile contexts.
 */

import React from 'react';
import { cn } from '../../../../utils/cn';

const VARIANT_STYLES = {
  present: {
    bg:    'bg-emerald-50',
    text:  'text-emerald-700',
    value: 'text-emerald-600',
    bar:   'bg-emerald-500',
    dot:   'bg-emerald-500',
  },
  absent: {
    bg:    'bg-rose-50',
    text:  'text-rose-700',
    value: 'text-rose-600',
    bar:   'bg-rose-500',
    dot:   'bg-rose-500',
  },
  late: {
    bg:    'bg-amber-50',
    text:  'text-amber-700',
    value: 'text-amber-600',
    bar:   'bg-amber-500',
    dot:   'bg-amber-500',
  },
  sick: {
    bg:    'bg-orange-50',
    text:  'text-orange-700',
    value: 'text-orange-600',
    bar:   'bg-orange-500',
    dot:   'bg-orange-500',
  },
  excused: {
    bg:    'bg-sky-50',
    text:  'text-sky-700',
    value: 'text-sky-600',
    bar:   'bg-sky-500',
    dot:   'bg-sky-500',
  },
  total: {
    bg:    'bg-gray-50',
    text:  'text-gray-600',
    value: 'text-gray-900',
    bar:   'bg-brand-purple',
    dot:   'bg-gray-400',
  },
  rate: {
    bg:    'bg-brand-purple/5',
    text:  'text-brand-purple/80',
    value: 'text-brand-purple',
    bar:   'bg-brand-purple',
    dot:   'bg-brand-purple',
  },
};

export function AttendanceSummaryCard({
  label,
  value,
  variant = 'total',
  total,
  icon: Icon,
  compact = false,
  className,
}) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.total;
  const percentage = total && total > 0 ? Math.round((Number(value) / total) * 100) : null;

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl',
        styles.bg, className
      )}>
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', styles.dot)} />
        <span className={cn('text-sm font-semibold tabular-nums', styles.value)}>
          {typeof value === 'number' && variant === 'rate' ? `${value}%` : value}
        </span>
        <span className={cn('text-xs truncate', styles.text)}>{label}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1',
      className
    )}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        {Icon && (
          <div className={cn('p-1.5 rounded-lg', styles.bg)}>
            <Icon size={14} className={styles.text} />
          </div>
        )}
      </div>

      <p className={cn('text-2xl font-bold tabular-nums', styles.value)}>
        {typeof value === 'number' && variant === 'rate' ? `${value}%` : value}
      </p>

      {percentage !== null && (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{percentage}% of class</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', styles.bar)}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceSummaryCard;
