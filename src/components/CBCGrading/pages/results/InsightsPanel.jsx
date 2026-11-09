/**
 * InsightsPanel — Renders actionable insight cards from useAcademicInsights.
 *
 * Displays:
 *   - Decline alerts (red) with teacher comments and recommendations
 *   - Improvement celebrations (green) with milestones
 *   - Trajectory projections (blue) with projected scores
 *   - Standards-aligned summaries (amber/info) with CBC band breakdowns
 *
 * Each card type has a distinct visual treatment so parents can scan
 * and prioritize at a glance. Critical items are expanded by default.
 *
 * Batch 7, Parent Academic Analytics Tier 1.
 */

import React, { useState } from 'react';
import {
  TrendingDown, TrendingUp, Target, Award, AlertTriangle,
  ChevronDown, ChevronUp, Lightbulb,
} from 'lucide-react';
import { termLabel } from '../results/useLearnerResults';

// ─── Insight card for a single insight ────────────────────────────────────────

function InsightCardItem({ insight, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const config = getCardConfig(insight);
  const Icon = config.icon;
  const hasDetail = insight.detail || insight.recommendation || insight.teacherComment;

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden transition-all`}
    >
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => hasDetail ? setExpanded(v => !v) : undefined}
        className={`w-full flex items-start gap-2.5 px-3 py-3 text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
        disabled={!hasDetail}
      >
        <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg ${config.iconBg} flex items-center justify-center`}>
          <Icon size={15} className={config.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {insight.subject && (
              <span className={`text-[10px] font-black uppercase tracking-wider ${config.labelColor}`}>
                {insight.subject}
              </span>
            )}
            {insight.severity === 'critical' && (
              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-200 text-rose-800">
                Urgent
              </span>
            )}
            {insight.type === 'improvement' && insight.milestone && (
              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                Milestone
              </span>
            )}
          </div>
          <p className={`text-xs font-semibold ${config.textColor} mt-0.5 leading-snug`}>
            {insight.message}
          </p>
        </div>
        {hasDetail && (
          <div className="flex-shrink-0 mt-1">
            {expanded
              ? <ChevronUp size={14} className="text-gray-400" />
              : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-gray-200/50">
          {insight.detail && (
            <p className="text-[11px] text-gray-600 leading-relaxed pt-2">
              {insight.detail}
            </p>
          )}
          {insight.teacherComment && (
            <div className="rounded-lg bg-white/60 border border-gray-200/50 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Teacher's Note</p>
              <p className="text-[11px] text-gray-700 italic leading-relaxed">"{insight.teacherComment}"</p>
            </div>
          )}
          {insight.recommendation && (
            <div className="rounded-lg bg-white/60 border border-gray-200/50 px-2.5 py-2 flex items-start gap-2">
              <Lightbulb size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Recommendation</p>
                <p className="text-[11px] text-gray-700 leading-relaxed">{insight.recommendation}</p>
              </div>
            </div>
          )}
          {insight.projection && (
            <div className="flex items-center gap-2 pt-1">
              <div className="rounded-lg bg-white/60 border border-gray-200/50 px-2.5 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Projected for {termLabel(insight.projection.term)}</p>
                <p className="text-sm font-black text-gray-900">{insight.projection.projectedScore}%</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card visual config per insight type+severity ─────────────────────────────

function getCardConfig(insight) {
  if (insight.type === 'decline') {
    if (insight.severity === 'critical') {
      return {
        icon: TrendingDown,
        border: 'border-rose-300',
        bg: 'bg-rose-50',
        iconBg: 'bg-rose-200',
        iconColor: 'text-rose-700',
        labelColor: 'text-rose-700',
        textColor: 'text-rose-900',
      };
    }
    return {
      icon: TrendingDown,
      border: 'border-amber-300',
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-200',
      iconColor: 'text-amber-700',
      labelColor: 'text-amber-700',
      textColor: 'text-amber-900',
    };
  }
  if (insight.type === 'improvement') {
    return {
      icon: TrendingUp,
      border: 'border-emerald-300',
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-200',
      iconColor: 'text-emerald-700',
      labelColor: 'text-emerald-700',
      textColor: 'text-emerald-900',
    };
  }
  if (insight.type === 'projection') {
    return {
      icon: Target,
      border: 'border-blue-300',
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-200',
      iconColor: 'text-blue-700',
      labelColor: 'text-blue-700',
      textColor: 'text-blue-900',
    };
  }
  if (insight.type === 'standard') {
    if (insight.severity === 'warning') {
      return {
        icon: AlertTriangle,
        border: 'border-amber-300',
        bg: 'bg-amber-50',
        iconBg: 'bg-amber-200',
        iconColor: 'text-amber-700',
        labelColor: 'text-amber-700',
        textColor: 'text-amber-900',
      };
    }
    return {
      icon: Award,
      border: 'border-emerald-300',
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-200',
      iconColor: 'text-emerald-700',
      labelColor: 'text-emerald-700',
      textColor: 'text-emerald-900',
    };
  }
  // Default
  return {
    icon: Lightbulb,
    border: 'border-gray-200',
    bg: 'bg-gray-50',
    iconBg: 'bg-gray-200',
    iconColor: 'text-gray-600',
    labelColor: 'text-gray-600',
    textColor: 'text-gray-800',
  };
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function InsightsPanel({ insights, hasInsights }) {
  if (!hasInsights || !insights?.length) return null;

  // Count by type for the header summary
  const declines = insights.filter(i => i.type === 'decline');
  const improvements = insights.filter(i => i.type === 'improvement');
  const projections = insights.filter(i => i.type === 'projection');
  const standards = insights.filter(i => i.type === 'standard');

  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const improvementCount = improvements.length;

  // Build header message
  let headerText;
  let headerIcon;
  let headerColor;

  if (criticalCount > 0) {
    headerText = `${criticalCount} ${criticalCount === 1 ? 'subject needs' : 'subjects need'} urgent attention`;
    headerIcon = AlertTriangle;
    headerColor = 'text-rose-700';
  } else if (declines.length > 0) {
    headerText = `${declines.length} ${declines.length === 1 ? 'subject is' : 'subjects are'} declining`;
    headerIcon = TrendingDown;
    headerColor = 'text-amber-700';
  } else if (improvementCount > 0) {
    headerText = `Great progress in ${improvementCount} ${improvementCount === 1 ? 'subject' : 'subjects'}`;
    headerIcon = TrendingUp;
    headerColor = 'text-emerald-700';
  } else {
    headerText = 'Performance analysis';
    headerIcon = Target;
    headerColor = 'text-[#3B1FA3]';
  }

  const HeaderIcon = headerIcon;

  return (
    <div className="space-y-2.5">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        <HeaderIcon size={14} className={headerColor} />
        <p className={`text-xs font-black ${headerColor}`}>{headerText}</p>
        {(declines.length > 0 || improvements.length > 0) && (
          <div className="flex items-center gap-1.5 ml-auto">
            {declines.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {declines.length} down
              </span>
            )}
            {improvements.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                {improvements.length} up
              </span>
            )}
          </div>
        )}
      </div>

      {/* Insight cards — critical items expanded by default */}
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <InsightCardItem
            key={`${insight.type}-${insight.subject || i}`}
            insight={insight}
            defaultExpanded={insight.severity === 'critical'}
          />
        ))}
      </div>
    </div>
  );
}
