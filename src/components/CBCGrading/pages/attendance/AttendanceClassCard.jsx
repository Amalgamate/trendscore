/**
 * AttendanceClassCard
 * Mobile "My Classes Today" screen — one card per class.
 * Shows class name, learner count, and attendance status.
 */

import React from 'react';
import { Users, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { cn } from '../../../../utils/cn';

const STATUS_CONFIG = {
  completed: {
    label:   'Done',
    classes: 'bg-emerald-100 text-emerald-700',
    icon:    CheckCircle,
    ring:    'ring-emerald-200',
  },
  partial: {
    label:   'In Progress',
    classes: 'bg-amber-100 text-amber-700',
    icon:    Clock,
    ring:    'ring-amber-200',
  },
  pending: {
    label:   'Pending',
    classes: 'bg-gray-100 text-gray-600',
    icon:    Clock,
    ring:    'ring-gray-200',
  },
};

export function AttendanceClassCard({ classItem, onTake, presentCount, totalCount, completedAt }) {
  const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const isCompleted = presentCount === totalCount && totalCount > 0;
  const isPartial = presentCount > 0 && !isCompleted;
  const statusKey = isCompleted ? 'completed' : isPartial ? 'partial' : 'pending';
  const statusCfg = STATUS_CONFIG[statusKey];
  const StatusIcon = statusCfg.icon;

  return (
    <button
      type="button"
      onClick={() => onTake(classItem)}
      className={cn(
        'w-full text-left bg-white border-2 rounded-2xl p-4 transition-all duration-150',
        'hover:border-brand-purple/30 hover:shadow-md active:scale-[0.99]',
        isCompleted ? 'border-emerald-200' : 'border-gray-200',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Class avatar + name */}
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ring-2',
            isCompleted
              ? 'bg-emerald-500 text-white ring-emerald-200'
              : 'bg-brand-purple/10 text-brand-purple ring-brand-purple/20'
          )}>
            {classItem.name?.substring(0, 2).toUpperCase() || 'CL'}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-base leading-tight">{classItem.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{classItem.grade?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0',
          statusCfg.classes
        )}>
          <StatusIcon size={11} />
          {statusCfg.label}
        </div>
      </div>

      {/* Progress row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Users size={14} className="text-gray-400" />
          <span className="font-semibold text-gray-900">{totalCount}</span>
          <span>learners</span>
        </div>

        {presentCount > 0 && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-emerald-600 font-semibold">
              {presentCount} present
            </span>
          </>
        )}

        {/* Progress bar */}
        {presentCount > 0 && (
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden ml-auto">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isCompleted ? 'bg-emerald-500' : 'bg-brand-purple'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* CTA arrow */}
      <div className="flex items-center justify-end mt-2">
        <span className="text-xs text-brand-purple font-semibold flex items-center gap-1">
          {isCompleted ? `Completed${completedAt ? ` at ${completedAt}` : ''}` : 'Take attendance'}
          <ChevronRight size={13} />
        </span>
      </div>
    </button>
  );
}

export default AttendanceClassCard;
