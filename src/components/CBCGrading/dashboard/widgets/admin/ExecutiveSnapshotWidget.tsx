import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, DollarSign, Activity, CreditCard } from 'lucide-react';
import { dashboardAPI } from '../../../../../services/api';

const ExecutiveSnapshotWidget = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await dashboardAPI.getAdminMetrics('term');
        if (response?.success) {
          setMetrics(response.data);
        }
      } catch (error) {
        console.error('Failed to load executive snapshot metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-36 bg-gray-50 border border-gray-100 rounded-2xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  const stats = {
    students: metrics?.stats?.totalStudents || 0,
    teachers: metrics?.stats?.totalTeachers || 0,
    staffOnLeave: metrics?.stats?.staffOnLeave ?? null,
    collectionRate: metrics?.stats?.feeCollected && metrics?.stats?.feePending
      ? Math.round((metrics.stats.feeCollected / (metrics.stats.feeCollected + metrics.stats.feePending)) * 100)
      : 0,
    expenses: metrics?.financials?.totalExpenses || 0
  };

  const formatCurrency = (val: number) => {
    if (val === 0) return 'KES 0';
    if (val >= 1000000) return `KES ${(val / 1000000).toFixed(1)}M`;
    return `KES ${val.toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* Students Card - Blue */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-white">
        <div className="absolute -bottom-4 -right-4 text-white/10">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <Users size={24} className="text-blue-500" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-wide text-white/90">Students</span>
          </div>
        </div>
        <div className="relative z-10 mt-6">
          <h3 className="text-4xl font-black tracking-tight">{stats.students.toLocaleString()}</h3>
          <p className="text-sm font-medium text-blue-100 mt-2 flex items-center gap-1">
            ↑ +42 this term
          </p>
        </div>
      </div>

      {/* Staff Card - Purple */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-white">
        <div className="absolute -bottom-4 -right-4 text-white/10">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
        </div>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <GraduationCap size={24} className="text-violet-500" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-wide text-white/90">Staff</span>
          </div>
        </div>
        <div className="relative z-10 mt-6">
          <h3 className="text-4xl font-black tracking-tight">{stats.teachers.toLocaleString()}</h3>
          <p className="text-sm font-medium text-violet-100 mt-2 flex items-center gap-1">
            {stats.staffOnLeave === null
              ? 'Loading…'
              : stats.staffOnLeave === 0
              ? 'All present today'
              : `${stats.staffOnLeave} on leave today`
            }
          </p>
        </div>
      </div>

      {/* Revenue Card - Green */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-white">
        <div className="absolute -bottom-4 -right-4 text-white/10">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <DollarSign size={24} className="text-emerald-500" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-wide text-white/90">Collection Rate</span>
          </div>
        </div>
        <div className="relative z-10 mt-6">
          <h3 className="text-4xl font-black tracking-tight">{stats.collectionRate}%</h3>
          <p className="text-sm font-medium text-emerald-100 mt-2 flex items-center gap-1">
            {stats.collectionRate >= 75 ? '↑ On Target' : '↓ Below Target'}
          </p>
        </div>
      </div>

      {/* Expenses Card - Orange */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-white">
        <div className="absolute -bottom-4 -right-4 text-white/10">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <CreditCard size={24} className="text-orange-500" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-wide text-white/90">School Expenses</span>
          </div>
        </div>
        <div className="relative z-10 mt-6">
          <h3 className="text-4xl font-black tracking-tight">{formatCurrency(stats.expenses)}</h3>
          <p className="text-sm font-medium text-orange-100 mt-2 flex items-center gap-1">
            This term
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveSnapshotWidget;
