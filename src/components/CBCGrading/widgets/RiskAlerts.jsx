/**
 * Risk Alerts Widget
 * Displays at-risk learners and critical alerts
 * @component
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, ChevronRight } from 'lucide-react';
import { getIntelligenceEngine } from '../../../services/intelligence/IntelligenceEngine';

/**
 * Risk Alerts Widget
 * @param {Object} props - Component props
 * @param {string} props.contextType - 'school', 'class', or 'learner'
 * @param {string|number} props.contextId - ID of the context
 */
const RiskAlerts = ({ contextType = 'school', contextId = 'default', refreshKey = 0 }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        const engine = getIntelligenceEngine();
        const data = await engine.getRiskInsights(contextType, contextId);
        setInsights(data);
        setError(null);
      } catch (error) {
        setError(error.message);
        console.error('Failed to fetch risk insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [contextType, contextId, refreshKey, retryKey]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !insights?.risk) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Risk Alerts</h3>
          </div>
        </div>
        <div className="p-4 text-center text-gray-500">
          <p className="text-sm">Unable to load risk alerts</p>
          <button
            type="button"
            onClick={() => setRetryKey((current) => current + 1)}
            className="mt-3 text-xs font-medium text-brand-purple hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { risk, alerts } = insights;
  const distribution = risk.distribution || {};
  const hasNoRiskLearners = !risk.riskScores || risk.riskScores.length === 0;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'high':
        return 'bg-orange-50 border-orange-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <TrendingDown className="w-4 h-4 text-orange-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header with Risk Distribution */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Risk Alerts</h3>
          </div>
          <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
            {distribution.critical || 0} Critical
          </span>
        </div>

        {/* Risk Distribution Bars */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-16">Critical</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600"
                style={{ width: `${Math.min(100, ((distribution.critical || 0) / (distribution.total || 1)) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-red-600">{distribution.critical || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-16">High</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500"
                style={{ width: `${Math.min(100, ((distribution.high || 0) / (distribution.total || 1)) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-orange-600">{distribution.high || 0}</span>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {hasNoRiskLearners ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">No learners flagged at risk</p>
          </div>
        ) : alerts && alerts.length > 0 ? (
          alerts.slice(0, 8).map((alert, idx) => (
            <div key={idx} className={`p-3 border-l-4 ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-start gap-3">
                <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-1">{alert.title}</p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{alert.description}</p>
                  {alert.action && (
                    <p className="text-xs text-brand-purple font-medium mt-2 flex items-center gap-1">
                      <span>{alert.action}</span>
                      <ChevronRight className="w-3 h-3" />
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">No critical risks identified</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {alerts && alerts.length > 8 && (
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-600">
            +{alerts.length - 8} more alerts
          </p>
        </div>
      )}
    </div>
  );
};

export default RiskAlerts;
