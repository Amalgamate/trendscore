/**
 * AttendanceInsightsPanel
 * Desktop right-panel showing live summary, at-risk learners, and trends.
 * Appears alongside the exceptions workspace.
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Award, Users } from 'lucide-react';
import { cn } from '../../../../utils/cn';
import { AttendanceSummaryCard } from './AttendanceSummaryCard';
import { AttendanceRiskCard } from './AttendanceRiskCard';

export function AttendanceInsightsPanel({
  pendingChanges,
  dailyReport,
  historicalStats,
  className,
}) {
  const learners = dailyReport?.learners || [];
  const total = learners.length;

  const stats = useMemo(() => {
    const present  = Object.values(pendingChanges).filter(p => p.status === 'PRESENT').length;
    const absent   = Object.values(pendingChanges).filter(p => p.status === 'ABSENT').length;
    const late     = Object.values(pendingChanges).filter(p => p.status === 'LATE').length;
    const sick     = Object.values(pendingChanges).filter(p => p.status === 'SICK').length;
    const excused  = Object.values(pendingChanges).filter(p => p.status === 'EXCUSED').length;
    const marked   = Object.keys(pendingChanges).length;
    const rate     = marked > 0 ? Math.round((present / marked) * 100) : 0;
    return { present, absent, late, sick, excused, marked, rate };
  }, [pendingChanges]);

  // Identify risk learners from historical stats
  const riskLearners = useMemo(() => {
    if (!historicalStats?.learnerRates) return [];
    return historicalStats.learnerRates
      .filter(r => r.rate < 85)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 5)
      .map(r => ({
        ...r,
        learner: learners.find(l => l.id === r.learnerId),
      }))
      .filter(r => r.learner);
  }, [historicalStats, learners]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Today's Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Today's Summary
        </p>
        <div className="space-y-2">
          <AttendanceSummaryCard
            label="Present"
            value={stats.present}
            variant="present"
            total={total}
            compact
          />
          {stats.absent > 0 && (
            <AttendanceSummaryCard
              label="Absent"
              value={stats.absent}
              variant="absent"
              total={total}
              compact
            />
          )}
          {stats.late > 0 && (
            <AttendanceSummaryCard
              label="Late"
              value={stats.late}
              variant="late"
              total={total}
              compact
            />
          )}
          {stats.sick > 0 && (
            <AttendanceSummaryCard
              label="Sick"
              value={stats.sick}
              variant="sick"
              total={total}
              compact
            />
          )}
          {stats.excused > 0 && (
            <AttendanceSummaryCard
              label="Excused"
              value={stats.excused}
              variant="excused"
              total={total}
              compact
            />
          )}
        </div>

        {/* Rate ring */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-600">Attendance Rate</span>
          <span className={cn(
            'text-xl font-bold tabular-nums',
            stats.rate >= 90 ? 'text-emerald-600' :
            stats.rate >= 75 ? 'text-amber-600' :
            'text-rose-600'
          )}>
            {stats.rate}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              stats.rate >= 90 ? 'bg-emerald-500' :
              stats.rate >= 75 ? 'bg-amber-500' :
              'bg-rose-500'
            )}
            style={{ width: `${stats.rate}%` }}
          />
        </div>
      </div>

      {/* Historical trends (if available) */}
      {historicalStats && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Trends
          </p>
          <div className="space-y-2.5">
            {historicalStats.vsYesterday !== undefined && (
              <TrendRow
                label="vs Yesterday"
                delta={historicalStats.vsYesterday}
              />
            )}
            {historicalStats.vsLastWeek !== undefined && (
              <TrendRow
                label="vs Last Week"
                delta={historicalStats.vsLastWeek}
              />
            )}
            {historicalStats.termRate !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Term average</span>
                <span className="text-sm font-semibold text-gray-900">
                  {historicalStats.termRate}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* At-risk learners */}
      {riskLearners.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-rose-500" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Attendance Risk
            </p>
          </div>
          <div className="space-y-2">
            {riskLearners.map(({ learner, rate, learnerId }) => (
              <AttendanceRiskCard
                key={learnerId}
                learner={learner}
                attendanceRate={rate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Class total */}
      <div className="bg-brand-purple/5 border border-brand-purple/10 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-brand-purple/70" />
          <div>
            <p className="text-xs text-brand-purple/70 font-semibold">Class Total</p>
            <p className="text-lg font-bold text-brand-purple">{total} learners</p>
          </div>
        </div>
        {stats.marked < total && (
          <p className="text-xs text-amber-600 mt-2 font-medium">
            ⚠ {total - stats.marked} learners unmarked
          </p>
        )}
      </div>
    </div>
  );
}

function TrendRow({ label, delta }) {
  const isPositive = delta >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={cn(
        'flex items-center gap-1 text-sm font-semibold',
        isPositive ? 'text-emerald-600' : 'text-rose-600'
      )}>
        <Icon size={13} />
        {isPositive ? '+' : ''}{delta}%
      </span>
    </div>
  );
}

export default AttendanceInsightsPanel;
