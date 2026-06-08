/**
 * Student Mobile Dashboard
 * Learner-focused mobile view for students
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { BookOpen, FileText, TrendingUp, AlertTriangle, Trophy } from 'lucide-react';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';
import MobileBottomNav from './MobileBottomNav';

/**
 * Student Mobile Dashboard
 * Learner-focused mobile view with courses and progress metrics
 * @param {Object} props - Component props
 * @param {Object} props.user - User object
 * @param {Function} props.onNavigate - Navigation callback
 * @param {string} props.currentPath - Current page path
 */
const StudentMobileDashboard = ({ user, onNavigate, currentPath }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getStudentMetrics?.() || { success: true, data: {} };
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

  const studentMetrics = [
    { label: 'Courses', value: stats.courseCount || 0, icon: BookOpen, color: 'bg-blue-50 text-blue-600' },
    { label: 'Due Soon', value: stats.dueSoonCount || 0, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
    { label: 'Overall Progress', value: `${stats.overallProgress || 0}%`, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Quiz Average', value: `${stats.quizAverage || 0}%`, icon: Trophy, color: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <div className="pb-20">
      {/* Greeting banner */}
      <GreetingToast user={user} fallbackName="Student" description="Learning Dashboard · Your Progress" />

      {/* Header */}
      <div className="px-4 py-4 bg-brand-purple text-white">
        <h1 className="text-xl font-bold">Learning Dashboard</h1>
        <p className="text-xs text-white/70 mt-0.5 uppercase tracking-wider font-semibold">Your Progress</p>
      </div>

      {/* Student Metrics */}
      <div className="px-3 py-4 space-y-3">
        {studentMetrics.map((metric, idx) => {
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
            onClick={() => onNavigate('student-courses')}
            className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
          >
            Courses
          </button>
          <button
            onClick={() => onNavigate('student-assignments')}
            className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
          >
            Assignments
          </button>
          <button
            onClick={() => onNavigate('student-quizzes')}
            className="p-3 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition"
          >
            Quizzes
          </button>
          <button
            onClick={() => onNavigate('student-profile')}
            className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition"
          >
            Progress
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <MobileBottomNav role={user?.role} currentPath={currentPath} onNavigate={onNavigate} />
    </div>
  );
};

export default StudentMobileDashboard;
