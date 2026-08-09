import React, { useCallback, useMemo, useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { getIntelligenceEngine } from '../../../../services/intelligence/IntelligenceEngine';
import AIInsightsWidget from '../../widgets/AIInsights';
import RiskAlerts from '../../widgets/RiskAlerts';
import FeeCollectionForecast from '../../widgets/FeeCollectionForecast';
import AttendanceAnomalies from '../../widgets/AttendanceAnomalies';
import AcademicInsights from '../../widgets/AcademicInsights';
import { useAuth } from '../../../../hooks/useAuth';
import { useTeacherContext } from '../../../../hooks/useTeacherContext';

const TEACHER_ROLES = new Set(['TEACHER']);
const ADMIN_ROLES = new Set(['ADMIN', 'HEAD_TEACHER', 'SUPER_ADMIN']);

const AIInsights = () => {
  const { user } = useAuth();
  const { classTeacherOf, assignedClassIds, loading: teacherCtxLoading } = useTeacherContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Determine context: teachers get class scope; admins get school scope
  const { contextType, contextId } = useMemo(() => {
    const role = user?.role;
    if (TEACHER_ROLES.has(role)) {
      // Use the teacher's primary homeroom class, fall back to first assigned class
      const primaryClassId = classTeacherOf?.id ?? assignedClassIds?.[0] ?? null;
      if (primaryClassId) {
        return { contextType: 'class', contextId: primaryClassId };
      }
    }
    // ADMIN / HEAD_TEACHER / SUPER_ADMIN (or teacher with no class assigned yet)
    return { contextType: 'school', contextId: 'default' };
  }, [user?.role, classTeacherOf, assignedClassIds]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const engine = getIntelligenceEngine();
      await engine.getInsights(contextType, contextId, { forceRefresh: true });
      setRefreshKey((current) => current + 1);
    } catch (error) {
      console.error('Failed to refresh intelligence insights:', error);
    } finally {
      setRefreshing(false);
    }
  }, [contextType, contextId]);

  // Wait for teacher context to resolve before rendering widgets
  if (teacherCtxLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Loading context…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
            <Zap size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-950">Intelligence Engine</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Live risk, fee, attendance, and academic widgets powered by the current intelligence summary.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <AIInsightsWidget contextType={contextType} contextId={contextId} refreshKey={refreshKey} />
        <RiskAlerts contextType={contextType} contextId={contextId} refreshKey={refreshKey} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FeeCollectionForecast contextType={contextType} contextId={contextId} refreshKey={refreshKey} />
        <AttendanceAnomalies contextType={contextType} contextId={contextId} refreshKey={refreshKey} />
      </div>

      <AcademicInsights contextType={contextType} contextId={contextId} refreshKey={refreshKey} />
    </div>
  );
};

export default AIInsights;
