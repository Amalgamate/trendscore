/**
 * AttendanceRiskCard
 * Highlights learners with poor attendance in the right panel / insights.
 */

import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '../../../../utils/cn';

function getRiskLevel(rate) {
  if (rate < 60) return { label: 'Critical', color: 'rose',   icon: AlertTriangle };
  if (rate < 75) return { label: 'High Risk', color: 'red',    icon: AlertTriangle };
  if (rate < 85) return { label: 'At Risk',   color: 'amber',  icon: TrendingDown };
  return              { label: 'Watch',       color: 'orange', icon: TrendingDown };
}

const RISK_COLORS = {
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-700',   bar: 'bg-rose-500',   badge: 'bg-rose-100 text-rose-700' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
};

export function AttendanceRiskCard({ learner, attendanceRate, daysAbsent, className }) {
  const risk = getRiskLevel(attendanceRate);
  const colors = RISK_COLORS[risk.color];
  const RiskIcon = risk.icon;
  const initials = `${learner?.firstName?.[0] || ''}${learner?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border',
      colors.bg, 'border-current/10',
      className
    )}>
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-white/60 flex items-center justify-center text-xs font-bold text-gray-700 flex-shrink-0 border border-white/80">
        {learner?.photoUrl ? (
          <img src={learner.photoUrl} alt={initials} className="w-full h-full rounded-full object-cover" />
        ) : initials}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', colors.text)}>
          {learner?.firstName} {learner?.lastName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1 bg-white/60 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', colors.bar)}
              style={{ width: `${Math.min(attendanceRate, 100)}%` }}
            />
          </div>
          <span className={cn('text-xs font-semibold tabular-nums flex-shrink-0', colors.text)}>
            {attendanceRate}%
          </span>
        </div>
      </div>

      {/* Risk badge */}
      <div className={cn(
        'flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold',
        colors.badge
      )}>
        <RiskIcon size={10} />
        {risk.label}
      </div>
    </div>
  );
}

export default AttendanceRiskCard;
