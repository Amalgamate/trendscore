/**
 * AttendanceClassCard
 * Mobile "My Classes Today" screen — one card per class.
 * Shows class name, learner count, present/absent metrics, and attendance status.
 */

import React from 'react';
import { Users, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { cn } from '../../../../utils/cn';

const STATUS_CONFIG = {
  submitted: {
    label:   'Marked',
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    icon:    CheckCircle2,
    ring:    'ring-emerald-200',
  },
  inProgress: {
    label:   'Ongoing',
    classes: 'bg-amber-50 text-amber-800 border border-amber-300',
    icon:    Clock,
    ring:    'ring-amber-200',
  },
  pending: {
    label:   'Pending',
    classes: 'bg-rose-50 text-rose-700 border border-rose-200',
    icon:    Clock,
    ring:    'ring-rose-200',
  },
};

export function AttendanceClassCard({
  classItem,
  onTake,
  presentCount = 0,
  markedCount = 0,
  totalCount = 0,
  completedAt,
  isTakingAttendance = false,
}) {
  const isSubmitted = markedCount > 0 || Boolean(completedAt);
  const statusKey = isTakingAttendance ? 'inProgress' : isSubmitted ? 'submitted' : 'pending';
  const statusCfg = STATUS_CONFIG[statusKey];
  const StatusIcon = statusCfg.icon;

  const effectiveTotal = totalCount || 0;
  const effectivePresent = isSubmitted ? Math.min(presentCount, effectiveTotal) : 0;
  const effectiveAbsent = isSubmitted ? Math.max(0, effectiveTotal - effectivePresent) : 0;
  const pct = effectiveTotal > 0 ? Math.round((effectivePresent / effectiveTotal) * 100) : 0;

  return (
    <button
      type="button"
      onClick={() => onTake(classItem)}
      className={cn(
        'w-full text-left bg-white border rounded-2xl p-4 transition-all duration-150 shadow-sm',
        'hover:border-blue-300 hover:shadow-md active:scale-[0.99]',
        isSubmitted ? 'border-emerald-200/90' : 'border-slate-200/90',
      )}
    >
      {/* Header row: Class Avatar + Name + Status Pill */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        {/* Class avatar + name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ring-2',
            isSubmitted
              ? 'bg-emerald-600 text-white ring-emerald-100'
              : 'bg-blue-50 text-blue-700 ring-blue-100'
          )}>
            {classItem.name?.substring(0, 2).toUpperCase() || 'CL'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-base leading-tight truncate">{classItem.name}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{classItem.grade?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {/* Status badge: Pending (red), Ongoing (golden yellow), Marked (green) */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0',
          statusCfg.classes
        )}>
          <StatusIcon size={12} strokeWidth={2.2} />
          {statusCfg.label}
        </div>
      </div>

      {/* Learners total */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Users size={13} className="text-slate-400" />
        <span className="font-bold text-slate-900">{effectiveTotal}</span>
        <span>learners</span>
      </div>

      {/* Present & Absent Metrics in smaller numbers */}
      <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-100">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold',
          isSubmitted
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
            : 'bg-slate-100 text-slate-500'
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', isSubmitted ? 'bg-emerald-500' : 'bg-slate-400')} />
          {effectivePresent} Present
        </span>

        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold',
          isSubmitted && effectiveAbsent > 0
            ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
            : 'bg-slate-100 text-slate-500'
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', isSubmitted && effectiveAbsent > 0 ? 'bg-rose-500' : 'bg-slate-400')} />
          {effectiveAbsent} Absent
        </span>

        {isSubmitted && effectiveTotal > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600">{pct}%</span>
            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* CTA action: 'View attendance' if done, 'Take attendance' if pending */}
      <div className="flex items-center justify-end mt-2.5 pt-1">
        <span className={cn(
          'text-xs font-bold flex items-center gap-1 transition-colors',
          isSubmitted ? 'text-emerald-700 hover:text-emerald-800' : 'text-blue-700 hover:text-blue-800'
        )}>
          {isTakingAttendance
            ? 'Continue attendance'
            : isSubmitted
              ? 'View attendance'
              : 'Take attendance'}
          <ChevronRight size={13} strokeWidth={2.4} />
        </span>
      </div>
    </button>
  );
}

export default AttendanceClassCard;
