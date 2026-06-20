/**
 * Parent Mobile Dashboard
 * Child-centric mobile view for parents
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { Users, CheckCircle2, AlertTriangle, MessageSquare, ChevronRight } from 'lucide-react';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';
import ParentChildProfile from '../../pages/parent/ParentChildProfile';

const ParentMobileDashboard = ({ user, onNavigate }) => {
  const [metrics, setMetrics]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selectedChild, setSelectedChild] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getParentMetrics?.() || { success: true, data: {} };
        if (response.success) setMetrics(response.data);
      } catch (error) {
        console.error('Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // If a child is selected → show the child profile view
  if (selectedChild) {
    return (
      <ParentChildProfile
        child={selectedChild}
        onBack={() => setSelectedChild(null)}
      />
    );
  }

  // Use the same data structure as ParentDashboard (desktop)
  const children     = metrics?.children || [];
  const stats        = metrics?.stats    || {};
  const messages     = metrics?.messages || [];

  const childrenCount   = children.length;
  const avgAttendance   = stats.avgAttendance ?? 0;
  const totalBalance    = stats.totalBalance  ?? 0;
  const messageCount    = messages.length;

  const parentMetrics = [
    { label: 'Children',          value: childrenCount,                          icon: Users,        color: 'bg-blue-50 text-blue-600'    },
    { label: 'Attendance',        value: `${avgAttendance}%`,                    icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Outstanding Fees',  value: `KES ${totalBalance.toLocaleString()}`, icon: AlertTriangle,color: 'bg-amber-50 text-amber-600'   },
    { label: 'Messages',          value: messageCount,                           icon: MessageSquare,color: 'bg-violet-50 text-violet-600'  },
  ];

  return (
    <div className="min-h-full pb-20 text-white">
      {/* Greeting banner */}
      <GreetingToast user={user} fallbackName="Parent" description="Family Dashboard · Children's Overview" onNavigate={onNavigate} />

      {/* Parent Metrics */}
      <div className="px-3 py-4 space-y-3">
        {parentMetrics.map((metric, idx) => {
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

      {/* Children Cards — tap to open full child profile */}
      {!loading && children.length > 0 && (
        <div className="px-3 pb-2 space-y-2">
          <p className="ts-mobile-section-title text-xs font-semibold uppercase px-2 tracking-wider">My Children</p>
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className="ts-mobile-card w-full rounded-xl p-3 flex items-center gap-3 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-full bg-brand-purple/10 flex items-center justify-center shrink-0 text-brand-purple font-bold text-base">
                {child.name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{child.name}</p>
                <p className="text-xs text-gray-500">{child.grade} · {child.className || child.admissionNumber}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-emerald-600 font-semibold">{child.attendanceRate ?? 0}% attendance</span>
                  {Number(child.feeBalance) > 0 && (
                    <span className="text-[10px] text-rose-600 font-semibold">KES {Number(child.feeBalance).toLocaleString()} due</span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {!loading && children.length === 0 && (
        <div className="ts-mobile-card-soft mx-3 rounded-xl border-dashed p-6 text-center">
          <Users size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs font-medium">No children linked to this account</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-3 py-3 space-y-2">
        <p className="ts-mobile-section-title text-xs font-semibold uppercase px-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigate('parent-portal-children')}
            className="ts-mobile-action p-3 rounded-lg text-xs font-semibold transition"
          >
            View Children
          </button>
          <button
            onClick={() => onNavigate('parent-portal-fees')}
            className="ts-mobile-action-solid p-3 rounded-lg text-xs font-semibold transition"
          >
            Fees
          </button>
          <button
            onClick={() => onNavigate('parent-portal-attendance')}
            className="ts-mobile-action-solid p-3 rounded-lg text-xs font-semibold transition"
          >
            Attendance
          </button>
          <button
            onClick={() => onNavigate('parent-portal-messages')}
            className="ts-mobile-action p-3 rounded-lg text-xs font-semibold transition"
          >
            Messages
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParentMobileDashboard;
