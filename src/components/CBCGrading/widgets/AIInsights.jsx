/**
 * AI Insights Widget
 * Displays natural language summary and key metrics from Intelligence Engine
 * @component
 */

import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { getIntelligenceEngine } from '../../../services/intelligence/IntelligenceEngine';

/**
 * AI Insights Widget Component
 * @param {Object} props - Component props
 * @param {string} props.contextType - 'school', 'class', or 'learner'
 * @param {string|number} props.contextId - ID of the context
 * @param {string} props.variant - 'default', 'compact', or 'detailed'
 */
const AIInsights = ({ contextType = 'school', contextId = 'default', variant = 'default' }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const engine = getIntelligenceEngine();
        const data = await engine.getInsights(contextType, contextId);
        setInsights(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch insights:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [contextType, contextId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-gradient-to-r from-brand-purple to-brand-teal rounded-full animate-pulse" />
          <p className="text-sm text-gray-600">Analyzing insights…</p>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !insights?.summary) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">Unable to load insights</p>
        </div>
      </div>
    );
  }

  const { executive, keyMetrics, recommendations } = insights.summary;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-purple/10 to-brand-teal/10 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-brand-purple" />
          <h3 className="font-semibold text-gray-900">AI Insights</h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Executive Summary */}
        <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-brand-purple">
          <p className="text-sm text-gray-700 leading-relaxed">{executive}</p>
        </div>

        {/* Key Metrics */}
        {keyMetrics && Object.keys(keyMetrics).length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(keyMetrics).map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 uppercase font-semibold mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-lg font-bold text-brand-purple">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Recommended Actions</p>
            <div className="space-y-2">
              {recommendations.slice(0, 3).map((rec, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                    <p className="text-xs text-gray-600">{rec.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
          Updated {new Date(insights.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
