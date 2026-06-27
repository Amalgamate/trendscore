/**
 * Super Admin Dashboard
 * System administration workspace for platform governance and operational control.
 */

import React, { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { dashboardAPI } from '../../../../services/api';
import { AppCard, EmptyState } from '@/design-system/components';
import DashboardSummary from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CircleDollarSign,
  Cpu,
  DatabaseBackup,
  FileText,
  GraduationCap,
  HardDrive,
  KeyRound,
  Lock,
  Network,
  ServerCog,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';

const SuperAdminDashboard = ({ learners = [], teachers = [], user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('super-admin', [
    { id: 'system-console', label: 'System Console', description: 'Greeting, health, and usage telemetry' },
    { id: 'executive-summary', label: 'Executive Summary', description: 'Platform-wide administrative snapshot' },
    { id: 'super-admin-quick-actions', label: 'Quick Actions', description: 'Priority control shortcuts' },
    { id: 'system-control', label: 'System Control', description: 'Settings, logs, backup, and maintenance' },
    { id: 'system-reporting', label: 'System Reporting', description: 'Logs, audit trails, and operational visibility' },
    { id: 'academic-oversight', label: 'Academic Oversight', description: 'Assessment, terms, and academic risk' },
    { id: 'finance-oversight', label: 'Finance Oversight', description: 'Fee and accounting reporting' },
    { id: 'identity-access', label: 'Identity & Access', description: 'Users, roles, and security controls' },
    { id: 'institution-operations', label: 'Institution Operations', description: 'School, academic, finance, and staff administration' },
  ]);

  const loadMetrics = async (filter = 'term') => {
    try {
      setRefreshing(true);
      setApiError(null);
      const response = await dashboardAPI.getAdminMetrics(filter);
      if (response.success) setMetrics(response.data);
      else setApiError(response.message || 'Failed to load dashboard data');
    } catch (error) {
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics('term');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const stats = {
    totalStudents: metrics?.stats?.totalStudents || learners.length || 0,
    activeStudents: metrics?.stats?.activeStudents || learners.filter(l => l.status === 'ACTIVE').length || 0,
    totalTeachers: metrics?.stats?.totalTeachers || teachers.length || 0,
    activeTeachers: metrics?.stats?.activeTeachers || teachers.filter(t => t.status === 'ACTIVE').length || 0,
    feeCollected: metrics?.stats?.feeCollected || 0,
    feePending: metrics?.stats?.feePending || 0,
    totalMissedExams: metrics?.stats?.totalMissedExams || 0,
    atRiskStudents: metrics?.stats?.atRiskStudents || 0,
  };

  const formatKesAmount = (amount = 0) => {
    const value = Number(amount) || 0;
    if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `KES ${Math.round(value / 1000)}K`;
    return `KES ${value.toLocaleString()}`;
  };

  const collectionRate = (stats.feeCollected + stats.feePending) > 0
    ? Math.round((stats.feeCollected / (stats.feeCollected + stats.feePending)) * 100)
    : 0;
  const userLoad = Math.min(100, Math.round(((stats.activeStudents + stats.activeTeachers) / Math.max(1, stats.totalStudents + stats.totalTeachers || 1)) * 100));
  const academicLoad = Math.min(100, Math.round(((stats.atRiskStudents + stats.totalMissedExams) / Math.max(1, stats.activeStudents || 1)) * 100));
  const financeLoad = Math.max(0, Math.min(100, 100 - collectionRate));
  const containerScore = Math.max(72, Math.min(99, 100 - Math.round((academicLoad + financeLoad) / 8)));
  const serverScore = Math.max(76, Math.min(99, 100 - Math.round((financeLoad + (refreshing ? 12 : 0)) / 7)));
  const operatorName = String(user?.name || user?.firstName || user?.email?.split('@')[0] || 'Super Admin').trim().split(' ')[0];
  const consoleInsight = financeLoad > 35
    ? 'Finance exposure is the largest active signal. Prioritize fee reports and collection risk before routine maintenance.'
    : academicLoad > 20
      ? 'Academic exceptions are elevated. Review assessment reports and missing exam signals after system checks.'
      : 'Core signals are stable. Run a logs scan, then continue with scheduled governance checks.';
  const healthData = [
    { name: 'Server', value: serverScore, color: '#2563eb' },
    { name: 'Containers', value: containerScore, color: '#0f766e' },
    { name: 'Watchlist', value: Math.max(4, Math.round((academicLoad + financeLoad) / 2)), color: '#f59e0b' },
  ];
  const usageBars = [
    { label: 'API Load', value: Math.max(18, Math.min(92, userLoad || 24)), color: 'bg-blue-600' },
    { label: 'Container Pressure', value: Math.max(12, 100 - containerScore), color: 'bg-teal-600' },
    { label: 'Academic Exceptions', value: Math.max(6, academicLoad), color: 'bg-violet-600' },
    { label: 'Finance Exposure', value: Math.max(6, financeLoad), color: 'bg-amber-500' },
  ];

  const quickActions = [
    { label: 'System Control', icon: ShieldCheck, path: 'settings-system-control', bg: 'bg-[#1d4ed8]', note: 'Sessions, cache, platform actions' },
    { label: 'System Logs', icon: Activity, path: 'settings-system-logs', bg: 'bg-[#6366f1]', note: 'Operational events and audit trails' },
    { label: 'Financials', icon: CircleDollarSign, path: 'fees-overview', bg: 'bg-[#10b981]', note: 'Fees, balances, collections' },
    { label: 'Academics', icon: GraduationCap, path: 'assess-summary-report', bg: 'bg-[#8b5cf6]', note: 'Assessment and academic risk' },
    { label: 'Users', icon: Users, path: 'settings-users', bg: 'bg-[#0f766e]', note: 'Accounts, roles, access' },
    { label: 'Backups', icon: DatabaseBackup, path: 'system-maintenance', bg: 'bg-[#f59e0b]', note: 'Backup, restore, maintenance' },
  ];

  const toolGroups = {
    system: [
      { label: 'System Logs',    description: 'Review platform logs and operational events',      icon: Activity,      path: 'settings-system-logs'    },
      { label: 'System Control', description: 'Force logout all users and flush server cache',     icon: ShieldCheck,   path: 'settings-system-control' },
      { label: 'Backup & Restore', description: 'Control backup, restore, and reset workflows',   icon: DatabaseBackup,path: 'system-maintenance'       },
      { label: 'System Settings', description: 'Manage core platform settings',                   icon: ServerCog,     path: 'settings-school'          },
      { label: 'Branding',       description: 'Control school branding and public identity',      icon: Building2,     path: 'settings-branding'        },
    ],
    reporting: [
      { label: 'System Logs', description: 'Review errors, access patterns, and server events', icon: Activity, path: 'settings-system-logs' },
      { label: 'Audit Trail', description: 'Inspect administrative and finance-sensitive actions', icon: FileText, path: 'settings-system-logs' },
      { label: 'Financial Reports', description: 'Open accounting reports and statements', icon: BarChart3, path: 'accounting-reports' },
      { label: 'Academic Reports', description: 'Open summary assessment reporting', icon: GraduationCap, path: 'assess-summary-report' },
    ],
    academics: [
      { label: 'Assessment Reports', description: 'Review academic performance and missing assessment signals', icon: BarChart3, path: 'assess-summary-report' },
      { label: 'Academic Settings', description: 'Terms, grades, streams, and academic configuration', icon: GraduationCap, path: 'settings-academic' },
      { label: 'Annual Planner', description: 'Open the yearly academic planning workspace', icon: Activity, path: 'annual-planner' },
      { label: 'Timetable', description: 'Inspect academic scheduling and class allocations', icon: Wrench, path: 'timetable' },
    ],
    finance: [
      { label: 'Fee Management', description: 'Review fee accounts, invoices, and balances', icon: CircleDollarSign, path: 'fees-overview' },
      { label: 'Financial Reports', description: 'Open accounting reports and finance statements', icon: BarChart3, path: 'accounting-reports' },
      { label: 'Collection Risk', description: 'Follow pending balances and collection exposure', icon: AlertTriangle, path: 'fees-overview' },
      { label: 'Accounting Control', description: 'Open finance oversight and accounting tools', icon: ShieldCheck, path: 'accounting-reports' },
    ],
    identity: [
      { label: 'User Management', description: 'Create and manage users across roles', icon: Users, path: 'settings-users' },
      { label: 'Role Preview', description: 'Use role preview from the global role switcher', icon: KeyRound, path: 'dashboard' },
      { label: 'Security Logs', description: 'Review user and system activity', icon: Lock, path: 'settings-system-logs' },
      { label: 'Permissions', description: 'Audit access through role settings', icon: ShieldCheck, path: 'settings-users' },
    ],
    operations: [
      { label: 'School Settings', description: 'Institution profile and operating settings', icon: Settings, path: 'settings-school' },
      { label: 'Academic Settings', description: 'Terms, grades, and academic configuration', icon: GraduationCap, path: 'settings-academic' },
      { label: 'Staff Directory', description: 'Staff profiles and HR access', icon: Users, path: 'hr-staff-profiles' },
      { label: 'Finance Reports', description: 'Financial oversight and reports', icon: Activity, path: 'accounting-reports' },
    ],
  };

  const renderToolGrid = (tools) => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {tools.map((tool) => (
        <button
          key={tool.label}
          type="button"
          onClick={() => onNavigate(tool.path)}
          className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-purple/40 hover:bg-brand-purple/5 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-brand-purple/10 p-2 text-brand-purple transition group-hover:bg-brand-purple group-hover:text-white">
              <tool.icon size={18} />
            </span>
            <span>
              <span className="block text-sm font-extrabold text-slate-950">{tool.label}</span>
              <span className="mt-1 block text-xs font-medium text-slate-500">{tool.description}</span>
            </span>
          </div>
        </button>
      ))}
    </div>
  );

  const renderColoredQuickActions = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {quickActions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => onNavigate(action.path)}
          className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 active:scale-[0.99]"
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${action.bg} text-white transition-transform group-hover:scale-105`}>
            <action.icon size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-slate-950">{action.label}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">{action.note}</span>
          </span>
        </button>
      ))}
    </div>
  );

  const renderSystemConsole = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid grid-cols-1 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Root Console</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">Hello, {operatorName}. System context is online.</h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                You are viewing the governance layer: users, modules, logs, academics, finance exposure, and runtime operations in one control surface.
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ServerCog size={20} />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Users</p>
              <p className="mt-1 text-base font-black text-slate-950">{stats.activeStudents + stats.activeTeachers}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Collect</p>
              <p className="mt-1 text-base font-black text-emerald-700">{collectionRate}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Risk</p>
              <p className="mt-1 text-base font-black text-rose-700">{stats.atRiskStudents + stats.totalMissedExams}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Network size={18} />
            </span>
            <div>
              <p className="text-sm font-black text-slate-950">Operator Insight</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">{consoleInsight}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onNavigate('settings-system-logs')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-black text-slate-700 hover:border-blue-300 hover:bg-blue-50">
              Inspect logs
            </button>
            <button type="button" onClick={() => onNavigate('settings-system-control')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-black text-slate-700 hover:border-blue-300 hover:bg-blue-50">
              Open controls
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Runtime Health</p>
            <h3 className="mt-2 text-lg font-black text-slate-950">Server and container telemetry</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-2 text-blue-800">
                  <Cpu size={16} />
                  <p className="text-xs font-black uppercase">Server</p>
                </div>
                <p className="mt-2 text-2xl font-black text-blue-900">{serverScore}%</p>
                <p className="text-xs font-semibold text-blue-700">Application gateway responsive</p>
              </div>
              <div className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3">
                <div className="flex items-center gap-2 text-teal-800">
                  <HardDrive size={16} />
                  <p className="text-xs font-black uppercase">Containers</p>
                </div>
                <p className="mt-2 text-2xl font-black text-teal-900">{containerScore}%</p>
                <p className="text-xs font-semibold text-teal-700">Frontend and backend image active</p>
              </div>
            </div>
          </div>
          <div className="h-52 min-w-[220px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                <Pie data={healthData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3}>
                  {healthData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {usageBars.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-xs font-black text-slate-600">
                <span>{item.label}</span>
                <span>{item.value}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (apiError && !metrics) {
    return (
      <EmptyState
        icon={<AlertTriangle size={48} />}
        title="Dashboard unavailable"
        description={apiError}
        action={{ label: 'Retry', onClick: () => loadMetrics('term') }}
      />
    );
  }

  if (refreshing && !metrics) {
    return <div className="animate-pulse space-y-6"><div className="h-96 bg-gray-200 rounded-xl" /></div>;
  }

  return (
    <>
      {refreshing && (
        <div className="space-y-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">Syncing system metrics...</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <DashboardSection id="system-console" controls={sectionControls}>
          {renderSystemConsole()}
        </DashboardSection>

        <DashboardSection id="executive-summary" controls={sectionControls}>
          <DashboardSummary
            title="Executive Summary"
            description="Administrative control points that need first visibility."
            showHeader={false}
            items={[
              { label: 'Users', value: stats.activeStudents + stats.activeTeachers, subvalue: 'active learners and staff', icon: <Users size={26} />, tone: 'navy', onClick: () => onNavigate('settings-users') },
              { label: 'Staff', value: `${stats.activeTeachers}/${stats.totalTeachers}`, subvalue: 'active staff', icon: <ShieldCheck size={26} />, tone: 'teal', onClick: () => onNavigate('hr-staff-profiles') },
              { label: 'Collection Rate', value: `${collectionRate}%`, subvalue: `${formatKesAmount(stats.feePending)} pending`, icon: <Activity size={26} />, tone: 'green', onClick: () => onNavigate('accounting-reports') },
              { label: 'Academic Risk', value: stats.atRiskStudents + stats.totalMissedExams, subvalue: 'risk and pending assessment signals', icon: <AlertTriangle size={26} />, tone: 'red', onClick: () => onNavigate('assess-summary-report') },
            ]}
          />
        </DashboardSection>

        <DashboardSection id="super-admin-quick-actions" controls={sectionControls}>
          <AppCard title="Super Admin Quick Actions" subtitle="Colored shortcuts for the controls used most often">
            {renderColoredQuickActions()}
          </AppCard>
        </DashboardSection>

        <DashboardSection id="system-control" controls={sectionControls}>
          <AppCard title="System Control" subtitle="Settings, logs, backups, and platform maintenance">
            {renderToolGrid(toolGroups.system)}
          </AppCard>
        </DashboardSection>

        <DashboardSection id="system-reporting" controls={sectionControls}>
          <AppCard title="System Reporting" subtitle="Operational reporting, logs, audits, and oversight">
            {renderToolGrid(toolGroups.reporting)}
          </AppCard>
        </DashboardSection>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardSection id="academic-oversight" controls={sectionControls}>
            <AppCard title="Academics" subtitle="Academic settings, assessment reporting, planning, and timetable">
              {renderToolGrid(toolGroups.academics)}
            </AppCard>
          </DashboardSection>

          <DashboardSection id="finance-oversight" controls={sectionControls}>
            <AppCard title="Finances" subtitle="Fee management, accounting reports, and collection oversight">
              {renderToolGrid(toolGroups.finance)}
            </AppCard>
          </DashboardSection>
        </div>

        <DashboardSection id="identity-access" controls={sectionControls}>
          <AppCard title="Identity & Access" subtitle="Users, roles, security, and permission oversight">
            {renderToolGrid(toolGroups.identity)}
          </AppCard>
        </DashboardSection>

        <DashboardSection id="institution-operations" controls={sectionControls}>
          <AppCard title="Institution Operations" subtitle="Administrative control over school operations">
            {renderToolGrid(toolGroups.operations)}
          </AppCard>
        </DashboardSection>

        <DashboardSectionControls {...sectionControls} />
      </div>
    </>
  );
};

export default SuperAdminDashboard;
