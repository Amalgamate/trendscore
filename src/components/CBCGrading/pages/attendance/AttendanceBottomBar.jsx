/**
 * AttendanceBottomBar
 * Sticky footer always visible during attendance capture.
 * Shows live Present/Absent/Late counts and the Save button.
 */

import React from 'react';
import { Save, Loader2 } from 'lucide-react';
import { cn } from '../../../../utils/cn';

export function AttendanceBottomBar({ stats, onSave, isSaving, disabled }) {
  const { present = 0, absent = 0, late = 0, total = 0 } = stats;

  return (
    <div className={cn(
      'sticky bottom-16 left-0 right-0 z-40 md:bottom-0',
      'bg-white/95 backdrop-blur-sm border-t border-gray-200',
      'px-4 pb-safe pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]',
    )}>
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        {/* Live counters */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <CountPill
            label="Present"
            value={present}
            color="emerald"
          />
          {absent > 0 && (
            <CountPill label="Absent" value={absent} color="rose" />
          )}
          {late > 0 && (
            <CountPill label="Late" value={late} color="amber" />
          )}
          {total > 0 && (
            <span className="text-xs text-gray-400 ml-1">
              {Math.round((present / total) * 100)}%
            </span>
          )}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || disabled}
          className={cn(
            'flex-shrink-0 h-11 px-5 rounded-xl font-semibold text-sm',
            'bg-brand-purple text-white',
            'flex items-center gap-2 transition-all duration-150',
            'hover:bg-brand-purple/90 active:scale-95',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'shadow-md shadow-brand-purple/20'
          )}
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save Attendance
        </button>
      </div>
    </div>
  );
}

function CountPill({ label, value, color }) {
  const colorMap = {
    emerald: 'bg-emerald-100 text-emerald-700',
    rose:    'bg-rose-100 text-rose-700',
    amber:   'bg-amber-100 text-amber-700',
  };
  return (
    <div className={cn(
      'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
      colorMap[color] || 'bg-gray-100 text-gray-600'
    )}>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

export default AttendanceBottomBar;
