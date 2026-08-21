import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Eye, RefreshCw } from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';
import { LearnerAttendanceCard } from '../parent-portal/ParentPortalAttendance';

const StudentAttendance = ({ onNavigate }) => {
  const [learner, setLearner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await dashboardAPI.getStudentMetrics();
      if (response?.success === false) throw new Error(response.message || 'Could not load attendance');
      const data = response?.data || {};
      const stats = data.stats || {};
      setLearner({
        ...(data.learner || {}),
        attendanceRate: stats.attendanceRate ?? stats.attendance ?? 0,
        attendanceSummary: {
          presentDays: stats.attendancePresent ?? 0,
          absentDays: stats.attendanceAbsent ?? 0,
          lateDays: stats.attendanceLate ?? 0,
          totalDays: stats.attendanceTotal ?? 0,
        },
      });
    } catch (err) {
      setError(err?.message || 'Could not load your attendance report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            aria-label="Back to dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:text-blue-700"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays size={17} className="text-blue-700" />
              <h1 className="text-lg font-black text-[#06285a]">My Attendance</h1>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Understand your attendance health and recent school records.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#06285a] transition hover:border-blue-300 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Eye size={18} className="mt-0.5 shrink-0 text-blue-700" />
        <div>
          <p className="text-sm font-black text-blue-950">A shared attendance record</p>
          <p className="mt-1 text-xs leading-relaxed text-blue-800">
            This is the same attendance information available to your parent or guardian. If something looks incorrect, discuss it with them and your class teacher.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : learner?.id ? (
        <LearnerAttendanceCard
          child={learner}
          onNavigate={onNavigate}
          initiallyExpanded
          showParentActions={false}
        />
      ) : !error ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No learner attendance record is linked to this account yet.
        </div>
      ) : null}
    </div>
  );
};

export default StudentAttendance;
