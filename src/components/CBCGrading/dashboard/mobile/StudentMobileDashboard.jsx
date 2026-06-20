/**
 * Student Mobile Dashboard
 * Learner-focused mobile view for students
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { BookOpen, TrendingUp, AlertTriangle, Trophy } from 'lucide-react';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';

/**
 * Student Mobile Dashboard
 * Learner-focused mobile view with courses and progress metrics
 * @param {Object} props - Component props
 * @param {Object} props.user - User object
 * @param {Function} props.onNavigate - Navigation callback
 * @param {string} props.currentPath - Current page path
 */
const StudentMobileDashboard = ({ user, onNavigate }) => {
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
    <div className="min-h-full pb-20 text-white">
      {/* Greeting banner */}
      <GreetingToast user={user} fallbackName="Student" description="Learning Dashboard · Your Progress" onNavigate={onNavigate} />

      {/* Student Metrics */}
      <div className="px-3 py-4 space-y-3">
        {studentMetrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div key={idx} className={`${idx % 2 ? 'ts-mobile-card-orange' : 'ts-mobile-card'} p-3 rounded-lg flex items-center gap-3`}>
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
        <p className="ts-mobile-section-title text-xs font-semibold uppercase px-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigate('student-courses')}
            className="ts-mobile-action p-3 rounded-lg text-xs font-semibold transition"
          >
            Courses
          </button>
          <button
            onClick={() => onNavigate('student-assignments')}
            className="ts-mobile-action-solid p-3 rounded-lg text-xs font-semibold transition"
          >
            Assignments
          </button>
          <button
            onClick={() => onNavigate('student-quizzes')}
            className="ts-mobile-action p-3 rounded-lg text-xs font-semibold transition"
          >
            Quizzes
          </button>
          <button
            onClick={() => onNavigate('student-profile')}
            className="ts-mobile-action-solid p-3 rounded-lg text-xs font-semibold transition"
          >
            Progress
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentMobileDashboard;
