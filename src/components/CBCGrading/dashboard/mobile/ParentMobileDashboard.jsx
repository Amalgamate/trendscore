/**
 * Parent Mobile Dashboard
 * Child-centric mobile view for parents
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { Users, CheckCircle2, AlertTriangle, CreditCard, MessageSquare } from 'lucide-react';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';
import MobileBottomNav from './MobileBottomNav';

/**
 * Parent Mobile Dashboard
 * Child-centric mobile view with attendance and fee metrics
 * @param {Object} props - Component props
 * @param {Object} props.user - User object
 * @param {Function} props.onNavigate - Navigation callback
 * @param {string} props.currentPath - Current page path
 */
const ParentMobileDashboard = ({ user, onNavigate, currentPath }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getParentMetrics?.() || { success: true, data: {} };
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

  const parentMetrics = [
    { label: 'Children', value: stats.childrenCount || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Attendance', value: `${stats.avgAttendance || 0}%`, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Outstanding Fees', value: `KES ${(stats.outstandingFees || 0).toLocaleString()}`, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
    { label: 'Messages', value: stats.newMessages || 0, icon: MessageSquare, color: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <div className="pb-20">
      {/* Greeting banner */}
      <GreetingToast user={user} fallbackName="Parent" description="Family Dashboard · Children's Overview" />

      {/* Header */}
      <div className="px-4 py-4 bg-brand-purple text-white">
        <h1 className="text-xl font-bold">Family Dashboard</h1>
        <p className="text-xs text-white/70 mt-0.5 uppercase tracking-wider font-semibold">Children's Overview</p>
      </div>

      {/* Parent Metrics */}
      <div className="px-3 py-4 space-y-3">
        {parentMetrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div key={idx} className={`${metric.color} p-3 rounded-lg flex items-center gap-3`}>
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
        <p className="text-xs font-semibold text-gray-600 uppercase px-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
          >
            View Children
          </button>
          <button
            onClick={() => onNavigate('comm-messages')}
            className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition"
          >
            Fees
          </button>
          <button
            onClick={() => onNavigate('events-calendar')}
            className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
          >
            Attendance
          </button>
          <button
            onClick={() => onNavigate('comm-messages')}
            className="p-3 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition"
          >
            Messages
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <MobileBottomNav role={user?.role} currentPath={currentPath} onNavigate={onNavigate} />
    </div>
  );
};

export default ParentMobileDashboard;
