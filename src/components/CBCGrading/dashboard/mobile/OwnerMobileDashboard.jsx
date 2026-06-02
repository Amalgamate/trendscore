/**
 * Owner/Admin Mobile Dashboard
 * Compact mobile view for executives with key metrics and actions
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { DollarSign, Users, TrendingUp, AlertTriangle, BarChart3, Settings } from 'lucide-react';
import MobileBottomNav from './MobileBottomNav';

const OwnerMobileDashboard = ({ user, onNavigate, currentPath }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getAdminMetrics?.('term') || { success: true, data: {} };
        if (response.success) {
          setMetrics(response.data);
        }
      } catch (error) {
        console.error('Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const stats = metrics?.stats || {};

  const quickMetrics = [
    { label: 'Present Today', value: stats.presentToday || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Revenue', value: `KES ${Math.round((stats.feeCollected || 0) / 1000)}k`, icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pending', value: `KES ${Math.round((stats.feePending || 0) / 1000)}k`, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
    { label: 'Growth', value: stats.studentTrend || '+0%', icon: TrendingUp, color: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-4 py-4 bg-gradient-to-r from-brand-purple to-brand-teal text-white">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-xs text-brand-purple/80 mt-1">School Overview</p>
      </div>

      {/* Quick Metrics */}
      <div className="px-3 py-4 space-y-3">
        {quickMetrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div key={idx} className={`${metric.color} p-3 rounded-lg flex items-center gap-3`}>
              <Icon size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-xs opacity-75 font-medium">{metric.label}</p>
                <p className="text-lg font-bold">{loading ? '…' : metric.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600 uppercase px-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigate('attendance-daily')}
            className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
          >
            Mark Attendance
          </button>
          <button
            onClick={() => onNavigate('finance-management')}
            className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
          >
            View Finance
          </button>
          <button
            onClick={() => onNavigate('learners-list')}
            className="p-3 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition"
          >
            View Learners
          </button>
          <button
            onClick={() => onNavigate('assess-summary-report')}
            className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition"
          >
            View Reports
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role={user?.role} currentPath={currentPath} onNavigate={onNavigate} />
    </div>
  );
};

export default OwnerMobileDashboard;
