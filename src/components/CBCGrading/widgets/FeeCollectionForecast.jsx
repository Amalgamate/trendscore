/**
 * Fee Collection Forecast Widget
 * Displays fee collection trends and predictions
 * @component
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getIntelligenceEngine } from '../../../services/intelligence/IntelligenceEngine';

/**
 * Fee Collection Forecast Widget
 * @param {Object} props - Component props
 * @param {string} props.contextType - 'school' or 'class'
 * @param {string|number} props.contextId - ID of the context
 */
const FeeCollectionForecast = ({ contextType = 'school', contextId = 'default' }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const engine = getIntelligenceEngine();
        const data = await engine.getFinancialInsights(contextType, contextId);
        setInsights(data);
      } catch (error) {
        console.error('Failed to fetch fee insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [contextType, contextId]);

  if (loading) {
    return <div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />;
  }

  if (!insights?.feeCollection) {
    return null;
  }

  const { feeCollection } = insights;
  const { currentMetrics, forecast, trends } = feeCollection;

  // Mock chart data
  const chartData = [
    { month: 'Month 1', actual: 1200, target: 1667 },
    { month: 'Month 2', actual: 1100, target: 1667 },
    { month: 'Month 3', actual: 900, target: 1667 },
    { month: 'Forecast', actual: forecast?.nextMonthRevenue / 1000 || 0, target: 1667, forecast: true },
  ];

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high':
        return 'text-emerald-600 bg-emerald-50';
      case 'medium':
        return 'text-amber-600 bg-amber-50';
      default:
        return 'text-red-600 bg-red-50';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Fee Collection Forecast</h3>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded ${getConfidenceColor(forecast?.confidence)}`}>
            {forecast?.confidence?.toUpperCase()} Confidence
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b border-gray-200">
        <div>
          <p className="text-xs text-gray-600 mb-1">Collection Rate</p>
          <p className="text-xl font-bold text-emerald-600">
            {(currentMetrics.collectionRate * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Outstanding</p>
          <p className="text-xl font-bold text-red-600">
            KES {(currentMetrics.outstanding / 1000000).toFixed(1)}M
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Trend</p>
          <p className={`text-lg font-bold ${trends?.trend === 'declining' ? 'text-red-600' : 'text-emerald-600'}`}>
            {trends?.trend === 'declining' ? '↓' : '↑'} {Math.abs(trends?.trendMagnitude || 0).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar dataKey="actual" fill="#10b981" name="Collected (KES '000)" />
            <Bar dataKey="target" fill="#cbd5e1" name="Target (KES '000)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast */}
      <div className="px-4 py-3 bg-blue-50 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-600 mb-2">Next Month Prediction</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Expected Collection</span>
            <span className="font-semibold text-blue-600">
              KES {(forecast?.nextMonthRevenue / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Best Case</span>
            <span className="font-semibold text-emerald-600">
              KES {(forecast?.nextMonthRevenue * 1.15 / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Worst Case</span>
            <span className="font-semibold text-red-600">
              KES {(forecast?.nextMonthRevenue * 0.8 / 1000).toFixed(0)}k
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeeCollectionForecast;
