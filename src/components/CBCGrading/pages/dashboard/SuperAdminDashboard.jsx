/**
 * Super Admin Dashboard
 * System administration workspace for platform governance and operational control.
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { AppCard, EmptyState } from '@/design-system/components';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';
import { QuickActions } from '../../shared';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CircleDollarSign,
  DatabaseBackup,
  FileText,
  GraduationCap,
  KeyRound,
  Lock,
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

  const operatorName = String(user?.name || user?.firstName || user?.email?.split('@')[0] || 'Super Admin').trim().split(' ')[0];

  const quickActions = [
    { label: 'System Control', icon: ShieldCheck, path: 'settings-system-control', color: '#1d4ed8', note: 'Sessions, cache, platform actions' },
    { label: 'System Logs', icon: Activity, path: 'settings-system-logs', color: '#6366f1', note: 'Operational events and audit trails' },
    { label: 'Financials', icon: CircleDollarSign, path: 'fees-overview', color: '#10b981', note: 'Fees, balances, collections' },
    { label: 'Academics', icon: GraduationCap, path: 'assess-summary-report', color: '#8b5cf6', note: 'Assessment and academic risk' },
    { label: 'Users', icon: Users, path: 'settings-users', color: '#0f766e', note: 'Accounts, roles, access' },
    { label: 'Backups', icon: DatabaseBackup, path: 'system-maintenance', color: '#f59e0b', note: 'Backup, restore, maintenance' },
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
          className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
        >
          <action.icon
            size={18}
            className="shrink-0 transition-transform duration-200 group-hover:scale-110"
            style={{ color: action.color }}
          />
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-slate-950">{action.label}</span>
            <span className="mt-0.5 block text-xs font-semibold text-slate-500">{action.note}</span>
          </span>
        </button>
      ))}
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
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      {/* Greeting header */}
      <div className="px-6 lg:px-10 pt-7 pb-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Super Admin</p>
          <h1 className="mt-1.5 text-xl font-black text-slate-950">Hello, {operatorName}. System context is online.</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            You are viewing the governance layer: users, modules, logs, academics, finance exposure, and runtime operations.
          </p>
        </div>
        {refreshing && (
          <span className="text-xs font-semibold text-slate-400 animate-pulse shrink-0">Syncing…</span>
        )}
      </div>

      {/* Quick Actions navigation strip */}
      <QuickActions onNavigate={onNavigate} currentPage="dashboard" user={user} />

      <div className="px-6 lg:px-10 pt-8 space-y-6 pb-10">
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
    </div>
  );
};

export default SuperAdminDashboard;
