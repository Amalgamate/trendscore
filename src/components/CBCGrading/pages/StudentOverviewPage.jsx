import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, CheckCircle2, FileText, UserPlus, Users, UserX } from 'lucide-react';
import { learnerAPI } from '../../../services/api';

const unwrap = (response) => response?.data ?? response ?? {};

const displayLabel = (value) => String(value || 'Unassigned')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const StudentOverviewPage = ({ learners = [], onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    learnerAPI.getStats()
      .then((response) => {
        if (!cancelled) setStats(unwrap(response));
      })
      .catch(() => {
        // The cards still have a useful local fallback when the aggregate
        // endpoint is unavailable.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const fallback = useMemo(() => {
    const active = learners.filter((learner) => String(learner.status || '').toUpperCase() === 'ACTIVE');
    const byGrade = active.reduce((result, learner) => {
      const grade = learner.grade || 'Unassigned';
      result[grade] = (result[grade] || 0) + 1;
      return result;
    }, {});
    return { total: learners.length, active: active.length, byGrade };
  }, [learners]);

  const total = stats?.total ?? fallback.total;
  const active = stats?.active ?? fallback.active;
  const exited = stats?.byStatus?.EXITED ?? stats?.byStatus?.EXited ?? 0;
  const gradeRows = Object.entries(stats?.byGrade || fallback.byGrade)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 8);

  const cards = [
    { label: 'Total Students', value: total, icon: Users, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Active', value: active, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Exited / Inactive', value: Math.max(0, total - active) || exited, icon: UserX, tone: 'bg-amber-50 text-amber-700' },
  ];

  const actions = [
    { label: 'Open Students List', path: 'learners-list', icon: Users },
    { label: 'Register a Student', path: 'learners-admissions', icon: UserPlus },
    { label: 'View Student Reports', path: 'learners-reports', icon: BarChart3 },
    { label: 'Student Documents', path: 'docs-center', params: { category: 'students' }, icon: FileText },
  ];

  return (
    <div className="min-h-full bg-[var(--app-page-bg)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Student Management</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Students Overview</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                A live view of the current student register, enrolment pipeline and student services.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('learners-admissions')}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:opacity-90"
            >
              <UserPlus size={17} />
              Add Student
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {cards.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon size={19} /></span>
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
              </div>
              <p className="mt-4 text-3xl font-black text-slate-950">{loading ? '—' : value.toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Active students by grade</h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Current register distribution</p>
              </div>
              <BarChart3 size={20} className="text-indigo-500" />
            </div>
            <div className="mt-5 space-y-3">
              {gradeRows.length ? gradeRows.map(([grade, count]) => {
                const percentage = active ? Math.round((count / active) * 100) : 0;
                return (
                  <div key={grade}>
                    <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
                      <span>{displayLabel(grade)}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, percentage)}%` }} />
                    </div>
                  </div>
                );
              }) : <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">No student data is available yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Student actions</h2>
            <div className="mt-4 space-y-2">
              {actions.map(({ label, path, params, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onNavigate?.(path, params)}
                  className="group flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50"
                >
                  <span className="flex items-center gap-3 text-sm font-bold text-slate-700"><Icon size={17} className="text-indigo-600" />{label}</span>
                  <ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentOverviewPage;
