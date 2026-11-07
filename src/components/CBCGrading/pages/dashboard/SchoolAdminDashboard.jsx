import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, BookOpen, Bus, CheckCircle2, CircleDollarSign, GraduationCap, Users, Wallet } from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import RoleActionWorkspace from './RoleActionWorkspace';

const ACTIONS = [
  { page: 'learners-list', label: 'Manage learners', detail: 'Find learner records and update school details.', icon: Users, color: 'bg-blue-600' },
  { page: 'teachers-list', label: 'Manage staff', detail: 'Review staff records and school access.', icon: GraduationCap, color: 'bg-emerald-600' },
  { page: 'digital-diary', label: 'Review class diaries', detail: 'Check class notes and homework progress.', icon: BookOpen, color: 'bg-purple-600' },
  { page: 'fees-overview', label: 'Review school fees', detail: 'Check collections and outstanding balances.', icon: CircleDollarSign, color: 'bg-violet-600' },
  { page: 'attendance-daily', label: 'Check attendance', detail: 'Review today’s learner and staff attendance.', icon: CheckCircle2, color: 'bg-teal-700' },
  { page: 'assess-mobile-dashboard', label: 'Review assessment', detail: 'See scores and classes needing assessment.', icon: BarChart3, color: 'bg-rose-600' },
  { page: 'transport-manager', label: 'Manage transport', detail: 'Open routes, vehicles and transport learners.', icon: Bus, color: 'bg-orange-600' },
  { page: 'accounting-expenses', label: 'Review expenses', detail: 'Check school spending and pending bills.', icon: Wallet, color: 'bg-indigo-700' },
  { page: 'operations-insights', label: 'View school insights', detail: 'See today’s operational priorities.', icon: AlertCircle, color: 'bg-slate-700' },
];

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatMoney = (value) => `KES ${Math.round(Number(value || 0)).toLocaleString()}`;

export default function SchoolAdminDashboard({ user, onNavigate }) {
  const { activeSlugs } = useModuleAccess();
  const accessUser = useMemo(() => ({ ...(user || {}), enabledApps: activeSlugs }), [activeSlugs, user]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardAPI.getAdminMetrics('term');
      if (!response?.success) throw new Error(response?.message || 'School overview is unavailable.');
      setMetrics(response.data || {});
    } catch (loadError) {
      setError(loadError?.message || 'Could not load the school overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const stats = metrics?.stats || {};
  const actions = ACTIONS.filter((action) => hasPageAccess(accessUser, action.page));
  const snapshots = [
    { label: 'Learners', value: loading ? '—' : formatNumber(stats.activeLearners), icon: Users, color: 'text-blue-700' },
    { label: 'Staff present', value: loading ? '—' : formatNumber(stats.presentTeachers ?? stats.activeTeachers), icon: GraduationCap, color: 'text-emerald-700' },
    { label: 'Fees due', value: loading ? '—' : formatMoney(stats.feePending), icon: CircleDollarSign, color: 'text-violet-800' },
  ];

  return <RoleActionWorkspace title="School admin" user={user} onNavigate={onNavigate} icon={GraduationCap} prompt="What would you like to review?" actions={actions} snapshots={snapshots} loading={loading} error={error} onRetry={loadMetrics} />;
}
