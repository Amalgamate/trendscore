/**
 * StudentMobileDashboard — Full mobile-native dashboard for STUDENT role.
 * Shows: greeting, today's schedule (from timetable), coursework summary,
 * attendance ring, recent scores, and quick actions.
 * No MobileBottomNav — MobileAppShell provides it.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen, TrendingUp, CheckCircle2, AlertCircle,
  Trophy, CalendarDays, ChevronRight, RefreshCw, Award,
  FileText, BarChart3, Target,
} from 'lucide-react';
import axiosInstance from '../../../../services/api/axiosConfig';
import { dashboardAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtNum = (n) => Number(n || 0).toLocaleString();

function scoreColor(n) {
  const v = Number(n || 0);
  if (v >= 70) return 'text-emerald-600';
  if (v >= 50) return 'text-amber-500';
  return 'text-rose-600';
}

// ─── Attendance Ring ──────────────────────────────────────────────────────────

function AttendanceRing({ rate = 0, size = 72 }) {
  const r     = (size / 2) - 6;
  const circ  = 2 * Math.PI * r;
  const filled = (rate / 100) * circ;
  const color = rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 13, fontWeight: 700, fill: '#111827' }}>
        {rate}%
      </text>
      <text x={size/2} y={size/2 + 13} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 8, fill: '#6b7280' }}>
        Attend.
      </text>
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, colorClass = 'bg-blue-50 text-blue-600' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col gap-1.5">
      <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center`}>
        <Icon size={15} />
      </div>
      <p className="text-lg font-black text-gray-900 leading-none">{value}</p>
      <p className="text-[10px] font-bold text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-[9px] text-gray-400 leading-tight">{sub}</p>}
    </div>
  );
}

// ─── Subject Score Row ────────────────────────────────────────────────────────

function SubjectRow({ subject, score, grade, onPress }) {
  const pct = Number(score || 0);
  const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{subject}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-black ${scoreColor(pct)}`}>{pct > 0 ? `${Math.round(pct)}%` : '—'}</p>
        {grade && <p className="text-[10px] text-gray-400">{grade}</p>}
      </div>
    </button>
  );
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({ course, onNavigate }) {
  const pct = course.progressPercent || 0;
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <button
      type="button"
      onClick={() => onNavigate?.('student-course-view', { courseId: course.courseId })}
      className="flex-shrink-0 w-44 bg-white border border-gray-100 rounded-xl p-3 text-left hover:border-purple-200 transition-all"
    >
      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
        <BookOpen size={14} />
      </div>
      <p className="text-[11px] font-bold text-gray-900 truncate leading-tight mb-0.5">{course.title}</p>
      <p className="text-[10px] text-gray-400 truncate mb-2">{course.subject || course.grade}</p>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-gray-500 mt-1">{Math.round(pct)}% complete</p>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentMobileDashboard = ({ user, onNavigate }) => {
  const [metrics, setMetrics]   = useState(null);
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [metricsRes, coursesRes] = await Promise.allSettled([
        dashboardAPI.getStudentMetrics?.() || Promise.resolve({ success: true, data: {} }),
        axiosInstance.get('/lms/my-courses').then(r => r.data?.data || []).catch(() => []),
      ]);
      if (metricsRes.status === 'fulfilled' && metricsRes.value?.success) {
        setMetrics(metricsRes.value.data);
      }
      if (coursesRes.status === 'fulfilled') {
        setCourses(Array.isArray(coursesRes.value) ? coursesRes.value : []);
      }
    } catch (e) {
      setError(e?.message || 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats     = metrics?.stats || {};
  const subjects  = metrics?.subjects || metrics?.recentSubjects || [];
  const attendance = Math.round(Number(stats.attendanceRate || stats.attendance || 0));
  const avgScore   = Math.round(Number(stats.averageScore || stats.overallAverage || 0));
  const firstName  = user?.firstName || user?.name?.split(' ')[0] || 'Student';
  const hour       = new Date().getHours();
  const greeting   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">

      {/* ── Greeting Header ── */}
      <div className="bg-[#3B1FA3] px-5 pt-5 pb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/60 text-xs font-medium">{greeting},</p>
            <h1 className="text-white text-xl font-black leading-tight">{firstName} 👋</h1>
            <p className="text-white/60 text-[11px] mt-0.5">
              {user?.grade || user?.currentGrade ? `Grade ${user.grade || user.currentGrade}` : 'Student Portal'}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white/70 hover:bg-white/25 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Quick summary strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Attendance', value: loading ? '…' : `${attendance}%`, icon: CheckCircle2 },
            { label: 'Avg Score',  value: loading ? '…' : (avgScore > 0 ? `${avgScore}%` : '—'), icon: TrendingUp },
            { label: 'Courses',    value: loading ? '…' : fmtNum(courses.length || stats.courseCount), icon: BookOpen },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                <Icon size={14} className="text-white/60 mx-auto mb-1" />
                <p className="text-white text-base font-black leading-none">{s.value}</p>
                <p className="text-white/50 text-[9px] font-semibold mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
          <p className="text-xs text-rose-700 flex-1">{error}</p>
          <button type="button" onClick={load} className="text-[10px] text-rose-600 font-bold underline">Retry</button>
        </div>
      )}

      <div className="px-4 pt-4 space-y-5">

        {/* Dedicated student tabs already provide these actions. Keep the
            overview focused instead of repeating the navigation grid. */}
        {false && <div>
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'My Courses',     icon: BookOpen,    path: 'student-courses',     bg: 'bg-blue-50 text-blue-600' },
              { label: 'Assignments',    icon: FileText,    path: 'student-assignments', bg: 'bg-amber-50 text-amber-600' },
              { label: 'My Progress',    icon: BarChart3,   path: 'student-progress',    bg: 'bg-emerald-50 text-emerald-600' },
              { label: 'Timetable',      icon: CalendarDays, path: 'planner-timetable',  bg: 'bg-violet-50 text-violet-600' },
            ].map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => onNavigate?.(a.path)}
                  className="bg-white border border-gray-100 rounded-xl p-3.5 flex items-center gap-3 text-left hover:border-gray-200 active:scale-[0.98] transition-all"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{a.label}</span>
                  <ChevronRight size={13} className="ml-auto text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>}

        {/* Attendance + Stat Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center gap-1">
            <AttendanceRing rate={loading ? 0 : attendance} />
            <p className="text-[10px] font-bold text-gray-500 text-center">School Attendance</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <StatCard
              icon={Target}
              label="Assignments Due"
              value={loading ? '…' : fmtNum(stats.dueSoonCount || stats.pendingAssignments)}
              sub="in next 7 days"
              colorClass="bg-rose-50 text-rose-600"
            />
          </div>
        </div>

        {/* My Courses */}
        {false && (loading || courses.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black text-gray-900">My Courses</p>
              <button
                type="button"
                onClick={() => onNavigate?.('student-courses')}
                className="text-xs text-[#3B1FA3] font-bold flex items-center gap-0.5"
              >
                View all <ChevronRight size={12} />
              </button>
            </div>
            {loading ? (
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                {[1,2,3].map(i => <Skeleton key={i} className="flex-shrink-0 w-44 h-28 rounded-xl" />)}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                {courses.slice(0, 5).map(c => (
                  <CourseCard key={c.courseId || c.id} course={c} onNavigate={onNavigate} />
                ))}
                {courses.length > 5 && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('student-courses')}
                    className="flex-shrink-0 w-44 bg-gray-50 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 py-6 text-gray-400 hover:border-gray-300 transition-colors"
                  >
                    <ChevronRight size={18} />
                    <span className="text-[10px] font-semibold">+{courses.length - 5} more</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Subject Scores */}
        {(loading || subjects.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black text-gray-900">Recent Results</p>
              <button
                type="button"
                onClick={() => onNavigate?.('student-progress')}
                className="text-xs text-[#3B1FA3] font-bold flex items-center gap-0.5"
              >
                All results <ChevronRight size={12} />
              </button>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 divide-y divide-gray-50">
              {loading
                ? [1,2,3].map(i => <Skeleton key={i} className="h-8 w-full my-1" />)
                : subjects.slice(0, 6).map((s, i) => (
                    <SubjectRow
                      key={s.id || i}
                      subject={s.name || s.learningArea || s.subject}
                      score={s.score || s.percentage}
                      grade={s.grade || s.letterGrade}
                      onPress={() => onNavigate?.('student-progress')}
                    />
                  ))
              }
            </div>
          </div>
        )}

        {/* Achievements / badges */}
        {stats.badgesEarned > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
            <Award size={20} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800">
                {stats.badgesEarned} badge{stats.badgesEarned !== 1 ? 's' : ''} earned!
              </p>
              <p className="text-[10px] text-amber-700">Keep up the great work.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('student-progress')}
              className="ml-auto text-[10px] font-bold text-amber-700 underline"
            >
              View
            </button>
          </div>
        )}

        {/* Empty state when no data at all */}
        {!loading && !error && courses.length === 0 && subjects.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <BookOpen size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 mb-1">No data yet</p>
            <p className="text-xs text-gray-400">Your courses and results will appear here once your teacher assigns them.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default StudentMobileDashboard;
