/**
 * Teacher Mobile Dashboard
 * Daily workflow mobile view for teachers
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { Clock, FileText, Users, AlertTriangle } from 'lucide-react';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';
import ClockInStatusWidget from '../widgets/teacher/ClockInStatusWidget';

/**
 * Teacher Mobile Dashboard
 * Teaching workflow mobile view with class and grading metrics
 * @param {Object} props - Component props
 * @param {Object} props.user - User object
 * @param {Function} props.onNavigate - Navigation callback
 * @param {string} props.currentPath - Current page path
 */
const TeacherMobileDashboard = ({ user, onNavigate }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getTeacherMetrics?.() || { success: true, data: {} };
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

  const teachingMetrics = [
    { label: 'Today\'s Classes', value: stats.todaysClasses || 0, icon: Clock, color: 'bg-blue-50 text-blue-600' },
    { label: 'Attendance Due', value: stats.attendanceDue || 0, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
    { label: 'To Mark', value: stats.assessmentsPending || 0, icon: FileText, color: 'bg-violet-50 text-violet-600' },
    { label: 'Learners', value: stats.myStudents || 0, icon: Users, color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="pb-20">
      {/* Greeting banner */}
      <GreetingToast user={user} fallbackName="Teacher" description="Teaching Dashboard · Daily Workflow" />

      {/* Teaching Metrics */}
      <div className="px-3 py-4 space-y-3">
        <ClockInStatusWidget user={user} onNavigate={onNavigate} />
        {teachingMetrics.map((metric, idx) => {
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
            Attendance
          </button>
          <button
            onClick={() => onNavigate('assess-summative-assessment')}
            className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
          >
            Grade Papers
          </button>
          <button
            onClick={() => onNavigate('planner-timetable')}
            className="p-3 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition"
          >
            Timetable
          </button>
          <button
            onClick={() => onNavigate('teacher-learner-analysis')}
            className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition"
          >
            Learners
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherMobileDashboard;
