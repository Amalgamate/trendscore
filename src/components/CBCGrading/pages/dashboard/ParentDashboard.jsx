/**
 * Parent Dashboard
 * Child-centric overview - focused on children's attendance, results, fees, and school communications
 */

import React, { useEffect, useState, Suspense } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { useRolePreview } from '../../../../contexts/RolePreviewContext';
import {
  AppCard,
  EmptyState
} from '@/design-system/components';

import {
  AlertTriangle,
  User,
  CheckCircle2,
  TrendingUp,
  FileText,
  BookOpen,
  Bell,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  CreditCard,
  Calendar,
  Users
} from 'lucide-react';

// Intelligence Engine Widgets
import AIInsights from '../../widgets/AIInsights';
import AcademicInsights from '../../widgets/AcademicInsights';
import RiskAlerts from '../../widgets/RiskAlerts';

const ParentDashboard = ({ user, onNavigate }) => {
  const rolePreview = useRolePreview();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setApiError(null);
      const response = await dashboardAPI.getParentMetrics?.() || { success: true, data: {} };
      if (response.success) {
        setMetrics(response.data);
      } else {
        setApiError(response.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Failed to load parent metrics:', error);
      if (rolePreview?.isPreviewingRole) {
        setMetrics({});
        setApiError(null);
        return;
      }
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rolePreview?.isPreviewingRole]);

  // Mock data - child-centric
  const myChildren = [
    { id: 1, name: 'Sarah Kipchoge', grade: 'Grade 5A', school: 'Primary School', avatar: 'SK', attendance: 92 },
    { id: 2, name: 'James Kipchoge', grade: 'Grade 3B', school: 'Primary School', avatar: 'JK', attendance: 88 },
    { id: 3, name: 'Maria Kipchoge', grade: 'Grade 1A', school: 'Primary School', avatar: 'MK', attendance: 95 },
  ];

  const attendanceByChild = [
    { id: 1, childName: 'Sarah Kipchoge', grade: 'Grade 5A', attendance: 92, daysPresent: 184, daysMissed: 16 },
    { id: 2, childName: 'James Kipchoge', grade: 'Grade 3B', attendance: 88, daysPresent: 176, daysMissed: 24 },
    { id: 3, childName: 'Maria Kipchoge', grade: 'Grade 1A', attendance: 95, daysPresent: 190, daysMissed: 10 },
  ];

  const feeBalances = [
    { id: 1, childName: 'Sarah Kipchoge', grade: 'Grade 5A', totalFees: 45000, paid: 45000, outstanding: 0, status: 'paid' },
    { id: 2, childName: 'James Kipchoge', grade: 'Grade 3B', totalFees: 40000, paid: 25000, outstanding: 15000, status: 'pending' },
    { id: 3, childName: 'Maria Kipchoge', grade: 'Grade 1A', totalFees: 35000, paid: 20000, outstanding: 15000, status: 'overdue' },
  ];

  const latestResults = [
    { id: 1, childName: 'Sarah Kipchoge', subject: 'Mathematics', grade: 'A', date: '2026-05-28' },
    { id: 2, childName: 'Sarah Kipchoge', subject: 'English', grade: 'A', date: '2026-05-28' },
    { id: 3, childName: 'James Kipchoge', subject: 'Science', grade: 'B', date: '2026-05-25' },
    { id: 4, childName: 'Maria Kipchoge', subject: 'Art & Craft', grade: 'A', date: '2026-05-24' },
  ];

  const homework = [
    { id: 1, childName: 'Sarah Kipchoge', subject: 'Mathematics', title: 'Chapter 5 Exercise', dueDate: '2026-06-03', submitted: false },
    { id: 2, childName: 'James Kipchoge', subject: 'English', title: 'Essay - My Holiday', dueDate: '2026-06-04', submitted: true },
    { id: 3, childName: 'Maria Kipchoge', subject: 'Reading', title: 'Read Chapter 3', dueDate: '2026-06-03', submitted: false },
  ];

  const schoolNotices = [
    { id: 1, title: 'Sports Day - June 15', date: '2 days ago', type: 'event' },
    { id: 2, title: 'End of Term Holidays - June 20', date: '5 days ago', type: 'holiday' },
    { id: 3, title: 'Parent Teacher Meeting - June 10', date: '1 week ago', type: 'meeting' },
    { id: 4, title: 'School Fees Payment Reminder', date: '1 week ago', type: 'fees' },
  ];

  const messages = [
    { id: 1, from: 'Sarah\'s Teacher', subject: 'Great progress in Mathematics', time: '1 day ago', type: 'positive' },
    { id: 2, from: 'James\'s Teacher', subject: 'Assignment submission reminder', time: '2 days ago', type: 'reminder' },
    { id: 3, from: 'School Admin', subject: 'Important: Updated school fees structure', time: '3 days ago', type: 'admin' },
  ];

  const getAttendanceColor = (attendance) => {
    if (attendance >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (attendance >= 75) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getGradeColor = (grade) => {
    const value = String(grade || '').toUpperCase();
    if (value.startsWith('A')) return 'text-emerald-600 bg-emerald-50';
    if (value.startsWith('B')) return 'text-blue-600 bg-blue-50';
    if (value.startsWith('C')) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getFeeStatus = (status) => {
    switch (status) {
      case 'paid': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'overdue': return 'text-rose-600 bg-rose-50 border-rose-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getNoticeIcon = (type) => {
    switch (type) {
      case 'event': return <Calendar size={16} />;
      case 'holiday': return <Calendar size={16} />;
      case 'meeting': return <Users size={16} />;
      case 'fees': return <CreditCard size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const getNoticeColor = (type) => {
    switch (type) {
      case 'event': return 'bg-blue-50 text-blue-600';
      case 'holiday': return 'bg-emerald-50 text-emerald-600';
      case 'meeting': return 'bg-purple-50 text-purple-600';
      case 'fees': return 'bg-orange-50 text-orange-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-6"><div className="h-96 bg-gray-200 rounded-xl" /></div>;
  }

  if (apiError && !metrics) {
    return (
      <EmptyState
        icon={<AlertTriangle size={48} />}
        title="Dashboard unavailable"
        description={apiError}
        action={{
          label: 'Retry',
          onClick: loadMetrics
        }}
      />
    );
  }

  const totalOutstanding = feeBalances.reduce((sum, fb) => sum + fb.outstanding, 0);
  const avgAttendance = Math.round(attendanceByChild.reduce((sum, a) => sum + a.attendance, 0) / attendanceByChild.length);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name?.split(' ')[0] || 'Parent'}</h1>
        <p className="text-sm text-gray-600 mt-1">Overview of your {myChildren.length} children's progress</p>
      </div>

      {/* Parent Overview - Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase">Children</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{myChildren.length}</p>
            </div>
            <Users size={24} className="text-blue-600 opacity-50" />
          </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase">Avg Attendance</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{avgAttendance}%</p>
            </div>
            <CheckCircle2 size={24} className="text-emerald-600 opacity-50" />
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${totalOutstanding > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase">Outstanding Fees</p>
              <p className={`text-3xl font-bold mt-1 ${totalOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                KES {totalOutstanding.toLocaleString()}
              </p>
            </div>
            <CreditCard size={24} className={totalOutstanding > 0 ? 'text-rose-600 opacity-50' : 'text-emerald-600 opacity-50'} />
          </div>
        </div>
      </div>

      {/* My Children */}
      <AppCard 
        title="My Children"
        subtitle={`${myChildren.length} children enrolled`}
      >
        <div className="space-y-2">
          {myChildren.map((child) => (
            <button
              key={child.id}
              onClick={() => onNavigate('learners-list')}
              className="w-full p-4 rounded-lg border border-slate-200 hover:bg-gray-50 transition text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-brand-purple/10 flex items-center justify-center">
                    <User size={18} className="text-brand-purple" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{child.name}</h4>
                    <p className="text-xs text-gray-500">{child.grade} • {child.school}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-500">Attendance</p>
                  <p className="text-sm font-bold text-emerald-600">{child.attendance}%</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </AppCard>

      {/* Attendance & Fee Balances - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Attendance Overview"
          subtitle={`Average: ${avgAttendance}%`}
        >
          <div className="space-y-2">
            {attendanceByChild.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate('attendance-analytics')}
                className={`w-full p-4 rounded-lg border transition-all text-left ${getAttendanceColor(item.attendance)}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{item.childName}</h4>
                    <p className="text-xs opacity-75">{item.grade}</p>
                    <p className="text-xs opacity-75 mt-1">{item.daysPresent} present • {item.daysMissed} missed</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{item.attendance}%</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('attendance-analytics')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View Attendance Details →
          </button>
        </AppCard>

        <AppCard 
          title="Fee Balances"
          subtitle={`Outstanding: KES ${totalOutstanding.toLocaleString()}`}
        >
          <div className="space-y-2">
            {feeBalances.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate('fees-management')}
                className={`w-full p-4 rounded-lg border transition-all text-left ${getFeeStatus(item.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{item.childName}</h4>
                    <p className="text-xs opacity-75">{item.grade}</p>
                    <p className="text-xs opacity-75 mt-1">Paid: KES {item.paid.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    {item.outstanding > 0 ? (
                      <>
                        <p className="text-xs opacity-75 font-semibold">Outstanding</p>
                        <p className="text-lg font-bold">KES {item.outstanding.toLocaleString()}</p>
                      </>
                    ) : (
                      <CheckCircle2 size={20} />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('fees-management')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            Manage Fees →
          </button>
        </AppCard>
      </div>

      {/* Latest Results & Homework - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Latest Results"
          subtitle="Recent assessment grades"
        >
          <div className="space-y-2">
            {latestResults.length > 0 ? (
              latestResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onNavigate('results-analytics')}
                  className="w-full p-4 rounded-lg border border-slate-200 hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{result.childName}</p>
                      <h4 className="font-semibold text-gray-900">{result.subject}</h4>
                      <p className="text-xs text-gray-500 mt-1">{result.date}</p>
                    </div>
                    <div className={`px-3 py-2 rounded-lg font-bold ${getGradeColor(result.grade)}`}>
                      {result.grade}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState icon={<TrendingUp size={40} />} title="No results yet" description="Grades will appear here" />
            )}
          </div>
          <button
            onClick={() => onNavigate('results-analytics')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Results →
          </button>
        </AppCard>

        <AppCard 
          title="Homework"
          subtitle={`${homework.filter(h => !h.submitted).length} pending submissions`}
        >
          <div className="space-y-2">
            {homework.map((hw) => (
              <button
                key={hw.id}
                onClick={() => onNavigate('homework-tracker')}
                className={`w-full p-4 rounded-lg border transition-all text-left ${hw.submitted ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs opacity-75">{hw.childName}</p>
                    <h4 className="font-semibold mt-1">{hw.title}</h4>
                    <p className="text-xs opacity-75 mt-1">{hw.subject} • Due {hw.dueDate}</p>
                  </div>
                  {hw.submitted ? (
                    <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('homework-tracker')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Homework →
          </button>
        </AppCard>
      </div>

      {/* School Notices & Messages - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="School Notices"
          subtitle="Latest announcements"
        >
          <div className="space-y-2">
            {schoolNotices.map((notice) => (
              <button
                key={notice.id}
                onClick={() => onNavigate('notices-board')}
                className="w-full p-4 rounded-lg border border-slate-200 hover:bg-gray-50 transition text-left"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${getNoticeColor(notice.type)}`}>
                    {getNoticeIcon(notice.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900">{notice.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{notice.date}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('notices-board')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Notices →
          </button>
        </AppCard>

        <AppCard 
          title="Messages"
          subtitle={`${messages.length} messages`}
        >
          <div className="space-y-2">
            {messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => onNavigate('comm-notices')}
                className="w-full p-4 rounded-lg border border-slate-200 hover:bg-gray-50 transition text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 flex-shrink-0">
                    <MessageSquare size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{msg.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">From: {msg.from}</p>
                    <p className="text-xs text-gray-400 mt-1">{msg.time}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('comm-notices')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Messages →
          </button>
        </AppCard>
      </div>

      {/* AI Learner Insights Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
          <AIInsights contextType="parent" contextId={user?.id} />
        </Suspense>

        {/* Academic Insights */}
        <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
          <AcademicInsights contextType="parent" contextId={user?.id} />
        </Suspense>
      </div>
    </div>
  );
};

export default ParentDashboard;
