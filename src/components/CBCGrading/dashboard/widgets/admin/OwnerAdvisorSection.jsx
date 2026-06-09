/**
 * OwnerAdvisorSection
 * Dashboard Sections › OwnerAdvisorSection
 *
 * "PERSONAL ADVISOR — RECOMMENDED ACTIONS" panel.
 * Fully wired to dashboardAPI.getInsights() — no hardcoded data.
 *
 * Maps live Insight { category, severity, title, description, recommendation }
 * → OwnerRecommendationCard props.
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  DollarSign,
  BookOpen,
  Calendar,
  Users,
  Activity,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { dashboardAPI } from '../../../../../services/api';
import OwnerRecommendationCard from './OwnerRecommendationCard';

// ─── Map insight → card visual tokens ────────────────────────────────────────
// category  → { icon, color, actionLabel, actionRoute }
const CATEGORY_MAP = {
  attendance: {
    icon:        AlertTriangle,
    color:       'red',
    actionLabel: 'View Students',
    actionRoute: 'learners-list',
  },
  financial: {
    icon:        DollarSign,
    color:       'orange',
    actionLabel: 'View Fees',
    actionRoute: 'finance-fees',
  },
  academic: {
    icon:        BookOpen,
    color:       'blue',
    actionLabel: 'Open Analysis',
    actionRoute: 'academic-intelligence',
  },
  staffing: {
    icon:        Users,
    color:       'green',
    actionLabel: 'View Staff',
    actionRoute: 'teachers-list',
  },
  operations: {
    icon:        Activity,
    color:       'green',
    actionLabel: 'View Details',
    actionRoute: 'settings-system-logs',
  },
};

// severity → priority (card uses 'high' | 'medium' | 'low')
const SEVERITY_PRIORITY = {
  critical: 'high',
  warning:  'medium',
  info:     'low',
  positive: 'low',
};

function mapInsightToRecommendation(insight) {
  const tokens = CATEGORY_MAP[insight.category] ?? CATEGORY_MAP.operations;
  return {
    id:          insight.id,
    type:        insight.category,
    title:       insight.title,
    description: insight.recommendation || insight.description,
    actionLabel: tokens.actionLabel,
    actionRoute: tokens.actionRoute,
    priority:    SEVERITY_PRIORITY[insight.severity] ?? 'medium',
    icon:        tokens.icon,
    color:       tokens.color,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const AdvisorHeading = ({ onRefresh, refreshing }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Sparkles size={14} className="text-brand-purple shrink-0" />
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-purple">
        Personal Advisor
      </p>
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
        — Recommended Actions
      </span>
    </div>
    <button
      onClick={onRefresh}
      disabled={refreshing}
      className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-brand-purple transition-colors disabled:opacity-40"
      title="Refresh insights"
    >
      <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  </div>
);

const AdvisorEmpty = () => (
  <div className="col-span-full flex flex-col items-center justify-center py-10 text-center text-gray-400">
    <Sparkles size={28} className="mb-2 text-brand-purple/30" />
    <p className="text-sm font-semibold">All clear — no actions required.</p>
    <p className="text-xs mt-1">The advisor will surface recommendations as data changes.</p>
  </div>
);

const SkeletonCard = () => (
  <div className="rounded-xl border border-gray-100 bg-white p-4 flex flex-col gap-3 animate-pulse">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 w-4/5 bg-gray-100 rounded" />
        <div className="h-3 w-3/5 bg-gray-100 rounded" />
      </div>
    </div>
    <div className="h-3 w-2/3 bg-gray-100 rounded" />
    <div className="h-8 w-28 bg-gray-100 rounded-lg mt-auto" />
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const OwnerAdvisorSection = ({ onNavigate }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]       = useState(false);
  const [error,           setError]            = useState(null);

  const load = async (fresh = false) => {
    if (fresh) setRefreshing(true);
    else       setLoading(true);
    setError(null);

    try {
      const res = await dashboardAPI.getInsights(fresh);
      if (res?.success && Array.isArray(res.data?.insights)) {
        // Take the top 4 by severity (critical first, then warning, info, positive)
        const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, positive: 3 };
        const sorted = [...res.data.insights]
          .sort((a, b) =>
            (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
          )
          .slice(0, 4);
        setRecommendations(sorted.map(mapInsightToRecommendation));
      } else {
        setRecommendations([]);
      }
    } catch {
      setError('Could not load advisor insights.');
      setRecommendations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-label="Personal Advisor — Recommended Actions" className="space-y-3">
      <AdvisorHeading onRefresh={() => load(true)} refreshing={refreshing} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          [0,1,2,3].map(i => <SkeletonCard key={i} />)
        ) : error ? (
          <div className="col-span-full flex items-center gap-2 text-xs text-rose-500 py-4">
            <AlertTriangle size={14} /> {error}
          </div>
        ) : recommendations.length === 0 ? (
          <AdvisorEmpty />
        ) : (
          recommendations.map(rec => (
            <OwnerRecommendationCard
              key={rec.id}
              recommendation={rec}
              onAction={route => onNavigate?.(route)}
            />
          ))
        )}
      </div>
    </section>
  );
};

export default OwnerAdvisorSection;
