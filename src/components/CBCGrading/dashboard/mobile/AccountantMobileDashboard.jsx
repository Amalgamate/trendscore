/**
 * Accountant Mobile Dashboard
 * Finance-focused mobile view for accounting oversight
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { Wallet, TrendingUp, AlertTriangle, PieChart } from 'lucide-react';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';

/**
 * Accountant Mobile Dashboard
 * Finance-focused mobile view with collections and bank reconciliation metrics
 * @param {Object} props - Component props
 * @param {Object} props.user - User object
 * @param {Function} props.onNavigate - Navigation callback
 * @param {string} props.currentPath - Current page path
 */
const AccountantMobileDashboard = ({ user, onNavigate }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getAccountantMetrics?.() || { success: true, data: {} };
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
  const collectionRate = stats.collectionRate || 0;

  const financialMetrics = [
    { label: 'Expected', value: `KES ${(stats.totalExpected || 0).toLocaleString()}`, icon: Wallet, color: 'bg-blue-50 text-blue-600' },
    { label: 'Collected', value: `KES ${(stats.totalCollected || 0).toLocaleString()}`, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Outstanding', value: `KES ${(stats.outstanding || 0).toLocaleString()}`, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
    { label: 'Collection Rate', value: `${collectionRate}%`, icon: PieChart, color: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <div className="min-h-full pb-20 text-white">
      {/* Greeting banner */}
      <GreetingToast user={user} fallbackName="Accountant" description="Finance Dashboard · Collection Overview" onNavigate={onNavigate} />

      {/* Financial Metrics */}
      <div className="px-3 py-4 space-y-3">
        {financialMetrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div key={idx} className={`${idx % 2 ? 'ts-mobile-card-orange' : 'ts-mobile-card'} p-3 rounded-lg flex items-center gap-3`}>
              <Icon size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-xs opacity-75 font-medium">{metric.label}</p>
                <p className="text-base font-bold truncate">{loading ? '…' : metric.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-3 space-y-2">
        <p className="ts-mobile-section-title text-xs font-semibold uppercase px-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigate('fees-overview')}
            className="ts-mobile-action-solid p-3 rounded-lg text-xs font-semibold transition"
          >
            Collections
          </button>
          <button
            onClick={() => onNavigate('accounting-dashboard')}
            className="ts-mobile-action p-3 rounded-lg text-xs font-semibold transition"
          >
            Bank
          </button>
          <button
            onClick={() => onNavigate('fees-reports')}
            className="ts-mobile-action-solid p-3 rounded-lg text-xs font-semibold transition"
          >
            Reports
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className="ts-mobile-action p-3 rounded-lg text-xs font-semibold transition"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountantMobileDashboard;
