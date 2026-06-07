/**
 * Super Admin Dashboard
 * System administration workspace for platform governance and operational control.
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { AppCard, EmptyState } from '@/design-system/components';
import DashboardSummary from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';
import AdminOverviewTabs from './AdminOverviewTabs';
import {
  Activity,
  AlertTriangle,
  Building2,
  DatabaseBackup,
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
  const [activeOverviewTab, setActiveOverviewTab] = useState('general');

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('super-admin', [
    { id: 'executive-summary', label: 'Executive Summary', description: 'Platform-wide administrative snapshot' },
    { id: 'system-control', label: 'System Control', description: 'Settings, logs, backup, and maintenance' },
    { id: 'identity-access', label: 'Identity & Access', description: 'Users, roles, and security controls' },
    { id: 'institution-operations', label: 'Institution Operations', description: 'School, academic, finance, and staff administration' },
    { id: 'admin-quick-actions', label: 'Quick Actions', description: 'High-priority super admin shortcuts' },
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
  const formatPercent = (value = 0) => `${Math.max(0, Math.min(100, Number(value) || 0))}%`;

  const collectionRate = (stats.feeCollected + stats.feePending) > 0
    ? Math.round((stats.feeCollected / (stats.feeCollected + stats.feePending)) * 100)
    : 0;

  const toolGroups = {
    system: [
      { label: 'System Logs', description: 'Review platform logs and operational events', icon: Activity, path: 'settings-system-logs' },
      { label: 'Backup & Restore', description: 'Control backup, restore, and reset workflows', icon: DatabaseBackup, path: 'system-maintenance' },
      { label: 'System Settings', description: 'Manage core platform settings', icon: ServerCog, path: 'settings-school' },
      { label: 'Branding', description: 'Control school branding and public identity', icon: Building2, path: 'settings-branding' },
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
    <div className="space-y-6">
      {refreshing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
          <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">Syncing system metrics...</p>
        </div>
      )}

      <AdminOverviewTabs
        activeTab={activeOverviewTab}
        onTabChange={setActiveOverviewTab}
        onNavigate={onNavigate}
        stats={stats}
        metrics={metrics}
        formatKesAmount={formatKesAmount}
        formatPercent={formatPercent}
      />

      {activeOverviewTab === 'general' && (
      <>
      <DashboardSection id="executive-summary" controls={sectionControls}>
        <DashboardSummary
          title="Executive Summary"
          description="Administrative control points that need first visibility."
          showHeader={false}
          items={[
            { label: 'Users', value: stats.activeStudents + stats.activeTeachers, subvalue: 'active learners and staff', icon: <Users size={26} />, tone: 'indigo', onClick: () => onNavigate('settings-users') },
            { label: 'Staff', value: `${stats.activeTeachers}/${stats.totalTeachers}`, subvalue: 'active staff', icon: <ShieldCheck size={26} />, tone: 'purple', onClick: () => onNavigate('hr-staff-profiles') },
            { label: 'Collection Rate', value: `${collectionRate}%`, subvalue: `${formatKesAmount(stats.feePending)} pending`, icon: <Activity size={26} />, tone: collectionRate >= 80 ? 'emerald' : 'amber', onClick: () => onNavigate('accounting-reports') },
            { label: 'Academic Risk', value: stats.atRiskStudents + stats.totalMissedExams, subvalue: 'risk and pending assessment signals', icon: <AlertTriangle size={26} />, tone: stats.atRiskStudents + stats.totalMissedExams > 0 ? 'orange' : 'teal', onClick: () => onNavigate('assess-summary-report') },
          ]}
        />
      </DashboardSection>

      <DashboardSection id="system-control" controls={sectionControls}>
        <AppCard title="System Control" subtitle="Settings, logs, backups, and platform maintenance">
          {renderToolGrid(toolGroups.system)}
        </AppCard>
      </DashboardSection>

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

      <DashboardSection id="admin-quick-actions" controls={sectionControls}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Users', icon: Users, path: 'settings-users' },
            { label: 'Logs', icon: Activity, path: 'settings-system-logs' },
            { label: 'Backup', icon: DatabaseBackup, path: 'system-maintenance' },
            { label: 'Maintenance', icon: Wrench, path: 'system-maintenance' },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onNavigate(action.path)}
              className="rounded-lg border border-slate-200 p-4 text-center transition hover:border-brand-purple/50 hover:bg-brand-purple/5"
            >
              <action.icon size={24} className="mx-auto mb-2 text-brand-purple" />
              <p className="text-xs font-semibold text-gray-900">{action.label}</p>
            </button>
          ))}
        </div>
      </DashboardSection>

      <DashboardSectionControls {...sectionControls} />
      </>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
