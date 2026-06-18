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
import DashboardSummary from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';

import {
  AlertTriangle,
  User,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  Bell,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  CreditCard,
  Calendar,
  Users
} from 'lucide-react';

import AcademicInsights from '../../widgets/AcademicInsights';

const ParentDashboard = ({ user, onNavigate }) => {
  const rolePreview = useRolePreview();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('parent', [
    { id: 'executive-summary', label: 'Executive Summary', description: 'Children, attendance, fees, messages' },
    { id: 'my-children', label: 'My Children', description: 'Linked learner cards' },
    { id: 'attendance-fees', label: 'Attendance & Fees', description: 'Attendance overview and balances' },
    { id: 'results-homework', label: 'Results & Homework', description: 'Latest grades and assignments' },
    { id: 'notices-messages', label: 'Notices & Messages', description: 'School communication' },
    { id: 'academic-insights', label: 'Academic Insights', description: 'Academic trend panel' },
  ]);

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

  const formatDate = (value) => {
    if (!value) return 'No date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString();
  };

  const children = metrics?.children || [];

  const myChildren = children.map((child) => ({
    id: child.id,
    name: child.name,
    grade: child.grade,
    school: child.className || child.admissionNumber || 'Enrolled',
    attendance: Number(child.attendanceRate || 0),
  }));

  const attendanceByChild = children.map((child) => ({
    id: child.id,
    childName: child.name,
    grade: child.grade,
    attendance: Number(child.attendanceRate || 0),
    daysPresent: Number(child.attendanceSummary?.presentDays || 0),
    daysMissed: Number(child.attendanceSummary?.absentDays || 0),
  }));

  const feeBalances = children.map((child) => {
    const totalFees = (child.invoices || []).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const outstanding = Number(child.feeBalance || 0);
    return {
      id: child.id,
      childName: child.name,
      grade: child.grade,
      totalFees,
      paid: Math.max(0, totalFees - outstanding),
      outstanding,
      status: outstanding <= 0 ? 'paid' : 'pending',
    };
  });

  const latestResults = children.flatMap((child) =>
    (child.subjects || []).map((subject, idx) => ({
      id: `${child.id}-${idx}-${subject.title || subject.name}`,
      childName: child.name,
      subject: subject.name || subject.title || 'Assessment',
      grade: subject.grade || (subject.score != null ? `${Math.round(subject.score)}%` : 'No grade'),
      date: subject.date ? formatDate(subject.date) : 'Latest result',
    }))
  ).slice(0, 6);

  const homework = (metrics?.homework || []).map((item) => ({
    ...item,
    dueDate: item.dueDate ? formatDate(item.dueDate) : 'No due date',
    submitted: !!item.submitted,
  }));

  const schoolNotices = (metrics?.notices || []).map((notice) => ({
    id: notice.id,
    title: notice.title,
    date: notice.timeLabel || 'Published',
    type: notice.category || 'notice',
  }));

  const messages = metrics?.messages || [];

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

  const totalOutstanding = metrics?.stats?.totalBalance ?? feeBalances.reduce((sum, fb) => sum + fb.outstanding, 0);
  const avgAttendance = metrics?.stats?.avgAttendance ?? (
    attendanceByChild.length > 0
      ? Math.round(attendanceByChild.reduce((sum, a) => sum + a.attendance, 0) / attendanceByChild.length)
      : 0
  );

  return (
    <div className="space-y-6">
      <DashboardSection id="executive-summary" controls={sectionControls}>
      <DashboardSummary
        title="Executive Summary"
        description="The family view of attendance, fees, and school communication."
        items={[
          {
            label: 'Children',
            value: myChildren.length,
            subvalue: 'enrolled',
            icon: <Users size={26} />,
            tone: 'indigo',
            onClick: () => onNavigate('learners-list'),
          },
          {
            label: 'Attendance',
            value: `${avgAttendance}%`,
            subvalue: 'average attendance',
            icon: <CheckCircle2 size={26} />,
            tone: 'emerald',
          },
          {
            label: 'Outstanding Fees',
            value: `KES ${totalOutstanding.toLocaleString()}`,
            subvalue: totalOutstanding > 0 ? 'balance due' : 'cleared',
            icon: <CreditCard size={26} />,
            tone: totalOutstanding > 0 ? 'rose' : 'teal',
            onClick: () => onNavigate('fees-statements'),
          },
          {
            label: 'Messages',
            value: messages.length,
            subvalue: 'school updates',
            icon: <MessageSquare size={26} />,
            tone: 'purple',
          },
        ]}
      />
      </DashboardSection>

      {/* My Children */}
      <DashboardSection id="my-children" controls={sectionControls}>
      <AppCard 
        title="My Children"
        subtitle={`${myChildren.length} children enrolled`}
      >
        <div className="space-y-2">
          {myChildren.length > 0 ? (
            myChildren.map((child) => (
              <button
                key={child.id}
                onClick={() => onNavigate('learner-profile', { learner: children.find(c => c.id === child.id) })}
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
            ))
          ) : (
            <EmptyState icon={<User size={40} />} title="No linked children" description="Children linked to this parent account will appear here." />
          )}
        </div>
      </AppCard>
      </DashboardSection>

      {/* Attendance & Fee Balances - Side by Side */}
      <DashboardSection id="attendance-fees" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Attendance Overview"
          subtitle={`Average: ${avgAttendance}%`}
        >
          <div className="space-y-2">
            {attendanceByChild.length > 0 ? attendanceByChild.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate('events-calendar')}
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
            )) : (
              <EmptyState icon={<CheckCircle2 size={40} />} title="No attendance records" description="Attendance appears after it is marked." />
            )}
          </div>
          <button
            onClick={() => onNavigate('attendance-reports')}
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
            {feeBalances.length > 0 ? feeBalances.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate('fees-collection', { learnerId: item.id })}
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
            )) : (
              <EmptyState icon={<CreditCard size={40} />} title="No fee invoices" description="Fee balances will appear after invoices are created." />
            )}
          </div>
          <button
            onClick={() => onNavigate('fees-statements')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            Manage Fees →
          </button>
        </AppCard>
      </div>
      </DashboardSection>

      {/* Latest Results & Homework - Side by Side */}
      <DashboardSection id="results-homework" controls={sectionControls}>
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
                  onClick={() => onNavigate('assess-summative-report')}
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
            onClick={() => onNavigate('assess-summative-report')}
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
            {homework.length > 0 ? homework.map((hw) => (
                <button
                  key={hw.id}
                  onClick={() => onNavigate('comm-messages')}
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
              )) : (
                <EmptyState icon={<BookOpen size={40} />} title="No homework feed connected" description="There is no parent homework data source yet." />
              )}
          </div>
          <button
            onClick={() => onNavigate('comm-messages')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Homework →
          </button>
        </AppCard>
      </div>
      </DashboardSection>

      {/* School Notices & Messages - Side by Side */}
      <DashboardSection id="notices-messages" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="School Notices"
          subtitle="Latest announcements"
        >
          <div className="space-y-2">
            {schoolNotices.length > 0 ? schoolNotices.map((notice) => (
              <button
                key={notice.id}
                onClick={() => onNavigate('comm-messages')}
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
            )) : (
              <EmptyState icon={<Bell size={40} />} title="No notices" description="Published parent notices will appear here." />
            )}
          </div>
          <button
            onClick={() => onNavigate('comm-messages')}
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
            {messages.length > 0 ? messages.map((msg) => (
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
            )) : (
              <EmptyState icon={<MessageSquare size={40} />} title="No message feed connected" description="There is no parent dashboard messages data source yet." />
            )}
          </div>
          <button
            onClick={() => onNavigate('comm-notices')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold hover:bg-brand-purple/5 rounded-lg transition"
          >
            View All Messages →
          </button>
        </AppCard>
      </div>
      </DashboardSection>

      {/* AI Learner Insights Placeholder */}
      <DashboardSection id="academic-insights" controls={sectionControls}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
                  </Suspense>

        {/* Academic Insights */}
        <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
          <AcademicInsights contextType="parent" contextId={user?.id} />
        </Suspense>
      </div>
      </DashboardSection>

      <DashboardSectionControls {...sectionControls} />
    </div>
  );
};

export default ParentDashboard;
