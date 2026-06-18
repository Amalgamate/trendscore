/**
 * AttendanceExceptionCard
 * Card for a single learner in the exceptions workspace.
 * Optimized for speed: one-tap status change, no dropdowns, no modals.
 */

import React from 'react';
import { cn } from '../../../../utils/cn';
import { AttendanceStatusBadge, QUICK_STATUSES, AttendanceStatusChip } from './AttendanceStatusChip';

export function AttendanceExceptionCard({
  learner,
  currentStatus,
  currentRemarks = '',
  onChange,
  onRemarksChange,
  compact = false,
  disabledStatuses = new Set(),
}) {
  const initials = `${learner.firstName?.[0] || ''}${learner.lastName?.[0] || ''}`.toUpperCase();
  const needsRemarks = ['LATE', 'EXCUSED'].includes(currentStatus);

  return (
    <div className={cn(
      'bg-white border border-gray-200 rounded-xl transition-all duration-150',
      'hover:border-brand-purple/20 hover:shadow-sm',
      compact ? 'p-3' : 'p-4'
    )}>
      {/* Learner identity row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div className={cn(
          'flex-shrink-0 rounded-full bg-brand-purple/10 text-brand-purple font-semibold flex items-center justify-center',
          compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
        )}>
          {learner.photoUrl ? (
            <img
              src={learner.photoUrl}
              alt={`${learner.firstName} ${learner.lastName}`}
              className="w-full h-full rounded-full object-cover"
            />
          ) : initials}
        </div>

        {/* Name + admission number */}
        <div className="flex-1 min-w-0">
          <p className={cn('font-semibold text-gray-900 truncate', compact ? 'text-sm' : 'text-sm')}>
            {learner.firstName} {learner.lastName}
          </p>
          <p className="text-xs text-gray-500 font-mono">{learner.admissionNumber}</p>
        </div>

        {/* Current status badge */}
        {currentStatus && (
          <AttendanceStatusBadge status={currentStatus} size="sm" />
        )}
      </div>

      {/* Status chips — one tap changes status */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_STATUSES.map(status => (
          <AttendanceStatusChip
            key={status}
            status={status}
            isSelected={currentStatus === status}
            onClick={onChange}
            disabled={disabledStatuses.has(status)}
            compact
          />
        ))}
      </div>

      {needsRemarks && (
        <div className="mt-3">
          <input
            type="text"
            value={currentRemarks}
            onChange={(event) => onRemarksChange?.(event.target.value)}
            placeholder={currentStatus === 'LATE' ? 'Note lateness reason...' : 'Note excuse...'}
            className="w-full h-9 rounded-lg border border-amber-200 bg-amber-50/50 px-3 text-xs text-gray-800 outline-none focus:border-amber-400 focus:bg-white"
          />
        </div>
      )}
    </div>
  );
}

export default AttendanceExceptionCard;
