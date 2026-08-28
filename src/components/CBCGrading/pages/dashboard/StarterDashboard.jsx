import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  GraduationCap,
  MessageSquare,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { hasPageAccess } from '../../utils/appAccess';
import { dashboardAPI } from '../../../../services/api/dashboard.api';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const uniqueCount = (items, key) => {
  const values = new Set(
    (items || [])
      .map((item) => String(item?.[key] || '').trim())
      .filter(Boolean)
  );
  return values.size;
};

// Solid color palette — same across all dashboards
const SOLID_COLORS = {
  navy:    '#172554',
  violet:  '#4C1D95',
  emerald: '#1B5E20',
  amber:   '#78350F',
};

const StatCard = ({ label, value, detail, icon: Icon, color }) => (
  <div className="relative overflow-hidden p-5 text-white select-none" style={{ backgroundColor: color }}>
    <div className="pointer-events-none absolute -bottom-4 -right-4 text-white/10">
      <Icon size={90} strokeWidth={1} />
    </div>
    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70 mb-3">{label}</p>
    <div className="flex items-end justify-between gap-2">
      <p className="text-4xl font-black tracking-tight leading-none text-white">{value}</p>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-white/20 border border-white/30">
        <Icon size={18} strokeWidth={2.2} className="text-white/90" />
      </span>
    </div>
    {detail && <p className="mt-1.5 text-sm font-semibold text-white/70">{detail}</p>}
  </div>
);

const StarterDashboard = ({
  learners = [],
  pagination,
  teachers = [],
  user,
  onNavigate,
  brandingSettings,
}) => {
  const [liveMetrics, setLiveMetrics] = useState(null);

  useEffect(() => {
    let active = true;

    dashboardAPI.getStarterMetrics()
      .then((response) => {
        if (active) setLiveMetrics(response?.data || response || null);
      })
      .catch((error) => {
        console.error('Failed to load starter dashboard metrics:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalLearners = Number(pagination?.total || learners.length || 0);
    return [
      {
        label: 'Students',
        value: formatNumber(liveMetrics?.students ?? totalLearners),
        detail: 'Active student records',
        icon: Users,
        color: SOLID_COLORS.navy,
      },
      {
        label: 'Staff',
        value: formatNumber(liveMetrics?.staff ?? teachers.length),
        detail: 'Teaching team records',
        icon: GraduationCap,
        color: SOLID_COLORS.violet,
      },
      {
        label: 'Grades',
        value: formatNumber(liveMetrics?.grades ?? uniqueCount(learners, 'grade')),
        detail: 'Grades with students',
        icon: BookOpen,
        color: SOLID_COLORS.emerald,
      },
      {
        label: 'Streams',
        value: formatNumber(liveMetrics?.streams ?? uniqueCount(learners, 'stream')),
        detail: 'Class streams in use',
        icon: CheckSquare,
        color: SOLID_COLORS.amber,
      },
    ];
  }, [learners, liveMetrics, pagination?.total, teachers.length]);

  const accessUser = user || {};
  const actions = [
    { label: 'Students List', path: 'learners-list', icon: Users, description: 'View and update student records' },
    { label: 'Add Student', path: 'learners-admissions', icon: UserPlus, description: 'Create a new student profile' },
    { label: 'Attendance', path: 'attendance-daily', icon: CalendarDays, description: 'Mark today\'s attendance' },
    { label: 'Assessments', path: 'assess-mobile-dashboard', icon: CheckSquare, description: 'Open assessment overview' },
    { label: 'Messages', path: 'comm-messages', icon: MessageSquare, description: 'Read and send school messages' },
    { label: 'School Settings', path: 'settings-school', icon: Settings, description: 'Manage school profile' },
  ].filter((action) => hasPageAccess(accessUser, action.path));

  const firstName = String(user?.firstName || user?.name || '').trim().split(/\s+/)[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-full bg-slate-100 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <h1 className="text-xl font-black tracking-tight text-slate-950">{greeting}, {firstName}</h1>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-950">Quick Actions</h2>
                <p className="text-sm font-medium text-slate-500">Use the most common starter workflows.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.path}
                    type="button"
                    onClick={() => onNavigate?.(action.path)}
                    className="group rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-purple/30 hover:bg-white hover:shadow-sm"
                  >
                    <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-brand-purple ring-1 ring-slate-200 transition group-hover:ring-brand-purple/30">
                      <Icon size={17} />
                    </span>
                    <p className="text-sm font-black text-slate-900">{action.label}</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{action.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-950">Starter Scope</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
              This package is intentionally lean and focused on day-to-day school operations.
            </p>
            <div className="mt-4 space-y-2">
              {['Student records', 'Attendance', 'Assessments', 'Messages', 'School setup'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                  <CheckSquare size={15} className="text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default StarterDashboard;
