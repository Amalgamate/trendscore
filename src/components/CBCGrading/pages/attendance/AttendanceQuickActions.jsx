/**
 * AttendanceQuickActions
 * The primary "Mark All Present" action button and supporting shortcuts.
 * This is the most important UI element — bold, central, unmissable.
 */

import React from 'react';
import { CheckCheck, Loader2 } from 'lucide-react';
import { cn } from '../../../../utils/cn';

export function AttendanceMarkAllButton({ onClick, disabled, loading, count, className, label = 'Mark All Present' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full flex items-center justify-center gap-3',
        'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700',
        'text-white font-bold rounded-2xl',
        'transition-all duration-150 active:scale-[0.99]',
        'shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'py-4 px-6 text-lg',
        className
      )}
      aria-label={`Mark all ${count} learners present`}
    >
      {loading ? (
        <Loader2 size={22} className="animate-spin" />
      ) : (
        <CheckCheck size={22} />
      )}
      <span>{label}</span>
      {count > 0 && (
        <span className="ml-1 bg-white/20 text-white text-sm font-semibold px-2.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Compact variant for use after mark-all (in the header area).
 */
export function AttendanceMarkAllCompact({ onClick, disabled, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl',
        'bg-emerald-50 text-emerald-700 border border-emerald-200',
        'hover:bg-emerald-100 transition-colors text-sm font-semibold',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      <CheckCheck size={15} />
      Mark All Present
    </button>
  );
}

export default AttendanceMarkAllButton;
