import React, { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Lightbulb, Star, Zap } from 'lucide-react';
import { pathwayPlannerAPI } from '../../../../../services/api';
import DiscoverMePanel from '../../../shared/DiscoverMePanel';

const PATHWAY_META = {
  STEM: { label: 'STEM', sub: 'Science, Technology, Engineering & Mathematics', color: '#1d4ed8', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', bar: 'bg-blue-500', icon: '🔬' },
  'Social Sciences': { label: 'Social Sciences', sub: 'Languages, Humanities, Business & Law', color: '#b45309', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', bar: 'bg-amber-500', icon: '📚' },
  'Arts and Sports Science': { label: 'Arts & Sports Science', sub: 'Creative Arts, Performing Arts & Sports', color: '#065f46', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', bar: 'bg-emerald-500', icon: '🎨' },
};
PATHWAY_META.SOCIAL_SCIENCES = PATHWAY_META['Social Sciences'];
PATHWAY_META.ARTS_SPORTS = PATHWAY_META['Arts and Sports Science'];

function ConfidenceBar({ value = 0 }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Confidence</span>
        <span className="text-sm font-black" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ClusterBreakdown({ breakdown = {} }) {
  const clusters = [
    { key: 'STEM', label: 'STEM', color: '#1d4ed8', score: breakdown.STEM || 0 },
    { key: 'Social', label: 'Social Sci.', color: '#b45309', score: breakdown.Social || 0 },
    { key: 'Arts', label: 'Arts & Sports', color: '#065f46', score: breakdown.Arts || 0 },
  ];
  return (
    <div className="space-y-2">
      {clusters.map(({ key, label, color, score }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] font-semibold text-gray-600">{label}</span>
            <span className="text-[11px] font-bold text-gray-800">{score}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(score, 100)}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CareerList({ careers = [] }) {
  if (!careers.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {careers.map((c, i) => (
        <span key={i} className="rounded-full border border-[#06285a]/20 bg-[#06285a]/5 px-2.5 py-0.5 text-[11px] font-semibold text-[#06285a]">
          {c}
        </span>
      ))}
    </div>
  );
}

function GrowthTips({ tips = [] }) {
  if (!tips.length) return null;
  return (
    <ul className="space-y-1.5">
      {tips.map((tip, i) => (
        <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
          <Star size={11} className="flex-shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
          <span>{tip}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RecommendationTab({ learnerId, mode, recommendation, profile, onSaved }) {
  const [showDetails, setShowDetails] = useState(false);
  const meta = PATHWAY_META[recommendation?.predictedPathway] || null;
  const pending = recommendation?.predictedPathway === 'Analysis Pending' || !recommendation?.predictedPathway;

  if (mode === 'discover') {
    return (
      <DiscoverMePanel
        learnerId={learnerId}
        compact={false}
        onSaved={onSaved}
      />
    );
  }

  return (
    <div className={`p-4 ${meta ? `${meta.bg} ${meta.border}` : 'bg-white border-gray-200'}`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {meta && <span className="text-2xl" role="img" aria-label={meta.label}>{meta.icon}</span>}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Recommended Pathway</p>
            {pending ? (
              <p className="text-sm font-bold text-gray-500 mt-1">Analysis Pending</p>
            ) : (
              <>
                <p className={`text-lg font-black mt-0.5 ${meta?.text || 'text-gray-900'}`}>{recommendation.predictedPathway}</p>
                {meta && <p className="text-[11px] text-gray-500 mt-0.5">{meta.sub}</p>}
              </>
            )}
          </div>
        </div>
        {!pending && recommendation && (
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
            className="flex-shrink-0 rounded-xl border border-gray-200 bg-white/70 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 flex items-center gap-1"
          >
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showDetails ? 'Less' : 'Details'}
          </button>
        )}
      </div>

      {/* Confidence bar */}
      {!pending && recommendation?.confidence != null && (
        <div className="mt-3">
          <ConfidenceBar value={recommendation.confidence} />
        </div>
      )}

      {/* Expandable details */}
      {showDetails && recommendation && !pending && (
        <div className="mt-4 border-t border-gray-200 pt-4 space-y-4 bg-gray-50/50 rounded-xl p-4 -mx-4 mb-4">
          {recommendation.clusterBreakdown && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <TrendingUp size={11} aria-hidden="true" /> Subject Cluster Scores
              </p>
              <ClusterBreakdown breakdown={recommendation.clusterBreakdown} />
            </div>
          )}

          {recommendation.justification && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Lightbulb size={11} aria-hidden="true" /> Why this pathway?
              </p>
              <p className="text-[12px] text-gray-700 leading-relaxed">{recommendation.justification}</p>
            </div>
          )}

          {recommendation.careerRecommendations?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <Star size={11} aria-hidden="true" /> Career Paths
              </p>
              <CareerList careers={recommendation.careerRecommendations} />
            </div>
          )}

          {recommendation.growthAreas?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <Zap size={11} aria-hidden="true" /> How to Grow
              </p>
              <GrowthTips tips={recommendation.growthAreas} />
            </div>
          )}
        </div>
      )}

      {/* Pending state */}
      {!pending && !recommendation && (
        <div className="mt-4">
          <div className="bg-white/70 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">No recommendation available yet. Complete your Discover Me profile to generate one.</p>
          </div>
        </div>
      )}
    </div>
  );
}