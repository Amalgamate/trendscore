import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, BookOpen, CalendarDays, CheckCircle2, GraduationCap, Users } from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import RoleActionWorkspace from './RoleActionWorkspace';

const ACTIONS = [
  { page: 'attendance-daily', label: 'Review attendance', detail: 'Check registers that need attention.', icon: CheckCircle2, color: 'bg-teal-700' },
  { page: 'digital-diary', label: 'Review class diaries', detail: 'Follow class notes and homework progress.', icon: BookOpen, color: 'bg-purple-600' },
  { page: 'assess-mobile-dashboard', label: 'Review assessment', detail: 'See scores and classes awaiting assessment.', icon: BarChart3, color: 'bg-rose-600' },
  { page: 'learners-list', label: 'Find a learner', detail: 'Open learner records and class details.', icon: Users, color: 'bg-blue-600' },
  { page: 'planner-timetable', label: 'Check the timetable', detail: 'Review lessons and school scheduling.', icon: CalendarDays, color: 'bg-amber-600' },
  { page: 'operations-insights', label: 'View school priorities', detail: 'Check today’s operational follow-up.', icon: AlertCircle, color: 'bg-slate-700' },
];

const number = (value) => Number(value || 0).toLocaleString();

export default function DeputyHeadDashboard({ user, onNavigate }) {
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
    { label: 'Learners', value: loading ? '—' : number(stats.activeLearners ?? stats.activeStudents), icon: Users, color: 'text-blue-700' },
    { label: 'Present today', value: loading ? '—' : number(stats.presentToday), icon: CheckCircle2, color: 'text-teal-700' },
    { label: 'Assessment avg.', value: loading ? '—' : `${Math.round(Number(stats.averageAssessmentScore || 0))}%`, icon: BarChart3, color: 'text-rose-700' },
  ];

  return <RoleActionWorkspace title="Deputy Head Workspace" user={user} onNavigate={onNavigate} icon={GraduationCap} prompt="What needs your attention today?" actions={actions} snapshots={snapshots} loading={loading} error={error} onRetry={loadMetrics} />;
}
