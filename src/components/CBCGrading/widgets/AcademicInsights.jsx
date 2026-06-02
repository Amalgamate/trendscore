/**
 * Academic Insights Widget
 * Displays academic performance trends and subject analysis
 * @component
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, TrendingUp, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getIntelligenceEngine } from '../../../services/intelligence/IntelligenceEngine';

/**
 * Academic Insights Widget
 * @param {Object} props - Component props
 * @param {string} props.contextType - 'school', 'class', or 'teacher'
 * @param {string|number} props.contextId - ID of the context
 */
const AcademicInsights = ({ contextType = 'school', contextId = 'default' }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const engine = getIntelligenceEngine();
        const data = await engine.getAcademicInsights(contextType, contextId);
        setInsights(data);
      } catch (error) {
        console.error('Failed to fetch academic insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [contextType, contextId]);

  if (loading) {
    return <div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />;
  }

  if (!insights?.academics) {
    return null;
  }

  const { academics, alerts } = insights;
  const { currentMetrics, subjectAnalysis, trends, predictions } = academics;

  // Chart data for subject performance
  const subjectChartData = subjectAnalysis?.byPerformance?.slice(0, 5).map(s => ({
    name: s.subject,
    grade: s.avgGrade,
    completion: (s.completion * 100),
  })) || [];

  const getTrendIcon = (direction) => {
    return direction === 'improving' ? (
      <TrendingUp className="w-4 h-4 text-emerald-600" />
    ) : (
      <AlertCircle className="w-4 h-4 text-red-600" />
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Academic Insights</h3>
        </div>
      </div>

      {/* Current Metrics */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b border-gray-200">
        <div>
          <p className="text-xs text-gray-600 mb-1">Average Grade</p>
          <p className="text-2xl font-bold text-blue-600">
            {currentMetrics.averageGrade?.toFixed(2) || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Completion Rate</p>
          <p className="text-2xl font-bold text-emerald-600">
            {(currentMetrics.assessmentCompletion * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Grade Trend</p>
          <div className="flex items-center gap-1">
            {getTrendIcon(trends?.gradeDirection)}
            <span className={`font-semibold ${trends?.gradeDirection === 'improving' ? 'text-emerald-600' : 'text-red-600'}`}>
              {trends?.gradeDirection === 'improving' ? 'Up' : 'Down'}
            </span>
          </div>
        </div>
      </div>

      {/* Subject Performance Chart */}
      {subjectChartData.length > 0 && (
        <div className="p-4 h-64 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-3">Subject Performance (Grade Average)</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 4]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="grade" fill="#3b82f6" name="Grade Average" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Analysis */}
      <div className="p-4 space-y-3">
        {/* Top & Bottom Subjects */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Subject Summary</p>
          <div className="space-y-2">
            {subjectAnalysis?.topSubject && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Top Performer</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-600">{subjectAnalysis.topSubject.subject}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                    {subjectAnalysis.topSubject.avgGrade.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {subjectAnalysis?.bottomSubject && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Needs Support</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-600">{subjectAnalysis.bottomSubject.subject}</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                    {subjectAnalysis.bottomSubject.avgGrade.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Predictions */}
        {predictions && (
          <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-400">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">End of Term Projection</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Projected Grade</span>
                <span className="font-semibold text-blue-600">
                  {predictions.projectedGradeByEndOfTerm?.toFixed(2) || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Confidence</span>
                <span className="font-semibold text-blue-600">
                  {(predictions.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts && alerts.filter(a => a.type === 'academic').length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Alerts</p>
            <div className="space-y-2">
              {alerts
                .filter(a => a.type === 'academic')
                .slice(0, 2)
                .map((alert, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900">{alert.title}</p>
                      <p className="text-xs text-gray-600">{alert.action}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademicInsights;
