/**
 * Attendance Anomalies Widget
 * Displays unusual attendance patterns and alerts
 * @component
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getIntelligenceEngine } from '../../../services/intelligence/IntelligenceEngine';

/**
 * Attendance Anomalies Widget
 * @param {Object} props - Component props
 * @param {string} props.contextType - 'school', 'class', or 'teacher'
 * @param {string|number} props.contextId - ID of the context
 */
const AttendanceAnomalies = ({ contextType = 'school', contextId = 'default', refreshKey = 0 }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        const engine = getIntelligenceEngine();
        const data = await engine.getAcademicInsights(contextType, contextId);
        setInsights(data);
        setError(null);
      } catch (error) {
        setError(error.message);
        console.error('Failed to fetch attendance insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [contextType, contextId, refreshKey]);

  const attendance = insights?.attendance;
  const chartData = Array.isArray(attendance?.weeklyHistory)
    ? attendance.weeklyHistory.map((entry) => ({
        week: entry.week,
        rate: Math.round((entry.avgRate || 0) * 100),
      }))
    : [];
  const hasChartData = chartData.length > 0;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-20 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !attendance) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Attendance Patterns</h3>
          </div>
        </div>
        <div className="p-4 text-center text-gray-500">
          <p className="text-sm">Unable to load attendance insights</p>
        </div>
      </div>
    );
  }

  const { currentMetrics, anomalies, patterns } = attendance;

  const attendanceRate = (currentMetrics.attendanceRate * 100).toFixed(0);
  const anomalyCount = (anomalies || []).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Attendance Patterns</h3>
          </div>
          {anomalyCount > 0 && (
            <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded">
              {anomalyCount} Anomalies
            </span>
          )}
        </div>
      </div>

      {/* Current Metrics */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b border-gray-200">
        <div>
          <p className="text-xs text-gray-600 mb-1">Current Rate</p>
          <p className={`text-2xl font-bold ${attendanceRate >= 85 ? 'text-emerald-600' : 'text-red-600'}`}>
            {attendanceRate}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Present Today</p>
          <p className="text-2xl font-bold text-blue-600">{currentMetrics.presentToday}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Absent</p>
          <p className="text-2xl font-bold text-red-600">{currentMetrics.daysAbsent}</p>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="p-4 h-64 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-600 mb-3">Attendance Trend (Weekly)</p>
        {hasChartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`${value}%`, 'Attendance']}
              />
              <Line type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[calc(100%-1.5rem)] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
            <p className="text-sm text-gray-500">No live attendance trend data is available for this view yet.</p>
          </div>
        )}
      </div>

      {/* Anomalies & Patterns */}
      <div className="p-4 space-y-3">
        {anomalies && anomalies.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Detected Anomalies</p>
            <div className="space-y-2">
              {anomalies.slice(0, 3).map((anomaly, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                  <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{anomaly.date}</p>
                    <p className="text-xs text-gray-600">{anomaly.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {patterns && patterns.length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Patterns Detected</p>
            <div className="space-y-2">
              {patterns.map((pattern, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                  <p className="text-sm text-gray-700">{pattern.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceAnomalies;
