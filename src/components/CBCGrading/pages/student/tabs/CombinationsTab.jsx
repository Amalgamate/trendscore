import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, Loader2, AlertCircle, BookOpen, Lock, CheckCircle2 } from 'lucide-react';
import api from '../../../../../services/api';
import { careerAPI } from '../../../../../services/api';
import PathwaySelectionStep from '../PathwaySelectionStep';

function normalizePathwayCode(value) {
  return String(value || '').toUpperCase().replace(/&/g, 'AND').replace(/[\s-]+/g, '_');
}

const PATHWAY_META = {
  STEM: { icon: '🔬', color: '#1d4ed8', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  SOCIAL_SCIENCES: { icon: '📚', color: '#b45309', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  ARTS_SPORTS: { icon: '🎨', color: '#065f46', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
};

export default function CombinationsTab({ learnerId, recommendation, selection, stage, mode = 'explore' }) {
  const [combinations, setCombinations] = useState([]);
  const [selectedComboId, setSelectedComboId] = useState('');
  const [combinationImpact, setCombinationImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load combinations
  useEffect(() => {
    if (!learnerId) return;
    let cancelled = false;
    setLoading(true);
    api.seniorPathways.getCombinations()
      .then((res) => {
        if (!cancelled) setCombinations(res?.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load combinations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [learnerId]);

  // Filter combinations based on recommendation
  const filteredCombinations = useMemo(() => {
    if (!recommendation?.predictedPathway) return combinations.slice(0, 12);
    const recommended = normalizePathwayCode(recommendation.predictedPathway);
    const pathwayAliases = recommended === 'SOCIAL_SCIENCES' || recommended === 'SOCIAL_SCIENCE'
      ? ['SOCIAL_SCIENCES', 'SOCIAL_SCIENCE']
      : recommended.includes('ARTS') ? ['ARTS_SPORTS', 'ARTS_AND_SPORTS_SCIENCE'] : [recommended];
    const matched = combinations.filter((combo) => pathwayAliases.includes(normalizePathwayCode(combo.pathway?.code || combo.pathway?.name)));
    return (matched.length ? matched : combinations).slice(0, 12);
  }, [combinations, recommendation?.predictedPathway]);

  // Load combination impact when selection changes
  useEffect(() => {
    if (!learnerId || !selectedComboId) { setCombinationImpact(null); return; }
    let cancelled = false;
    careerAPI.getSavedCareers(learnerId)
      .then((response) => {
        const careerIds = (response?.data || []).map((item) => item.careerId);
        if (!careerIds.length) return null;
        return careerAPI.getCombinationImpact(learnerId, careerIds, [selectedComboId]);
      })
      .then((response) => { if (!cancelled) setCombinationImpact(response?.data?.[0] || null); })
      .catch(() => { if (!cancelled) setCombinationImpact(null); });
    return () => { cancelled = true; };
  }, [learnerId, selectedComboId]);

  if (stage === 'senior' && mode === 'selection') {
    // Senior student - show PathwaySelectionStep for actual selection
    return (
      <PathwaySelectionStep
        learnerId={learnerId}
        existingSelection={selection}
        onSuccess={() => {}}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/4 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-1/5" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">
          {stage === 'junior' ? 'Explore subject combinations' : 'Your subject combination'}
        </p>
        <p className="mt-1 text-[11px] text-gray-600">
          {stage === 'junior'
            ? 'These are planning options for senior school. Exploring one does not submit or lock a subject selection.'
            : 'Your confirmed subject combination for senior school.'}
        </p>
      </div>

      {stage === 'junior' && selection && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
          <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 size={16} /> You have a confirmed selection
          </p>
          <p className="mt-1 text-[11px] text-emerald-700">{selection.pathway?.name} › {selection.track?.name}</p>
          <p className="text-[11px] text-emerald-700">Combination: <span className="font-semibold">{selection.combinationRule?.name}</span></p>
        </div>
      )}

      {filteredCombinations.length === 0 ? (
        <p className="text-xs text-gray-400">Combination reference data is not available yet.</p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {filteredCombinations.map((combo) => (
            <label
              key={combo.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                selectedComboId === combo.id ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:border-violet-200'
              }`}
            >
              <input
                type="radio"
                name="junior-combination"
                checked={selectedComboId === combo.id}
                onChange={() => setSelectedComboId(combo.id)}
                className="mt-1 text-violet-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-gray-900 truncate">{combo.name}</p>
                <p className="text-[10px] text-gray-500">{combo.pathway?.name} › {combo.track?.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(combo.items || []).map((item) => (
                    <span
                      key={item.id || item.officialLearningArea?.id}
                      className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-gray-600"
                    >
                      {item.officialLearningArea?.officialName}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      {combinationImpact?.careers?.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-[10px] font-black uppercase text-indigo-700">Career door analysis</p>
          <div className="mt-2 space-y-1">
            {combinationImpact.careers.map((item) => (
              <div key={item.career.id} className="flex justify-between gap-2 rounded-lg bg-white p-2">
                <div>
                  <p className="text-[10px] font-bold text-gray-800">{item.career.title}</p>
                  <p className="text-[9px] text-gray-500">{item.explanation}</p>
                </div>
                <span className={`h-fit rounded-full px-2 py-0.5 text-[8px] font-black ${
                  item.classification.includes('SUPPORTS') ? 'bg-emerald-100 text-emerald-700' :
                  item.classification === 'MAY_RESTRICT' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {item.classification.replaceAll('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stage === 'junior' && (
        <button
          type="button"
          onClick={() => {}}
          className="w-full rounded-xl border border-violet-200 bg-violet-50 py-2 text-[11px] font-black text-violet-700"
        >
          Return to Career Studio
        </button>
      )}
    </div>
  );
}
