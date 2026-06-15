/**
 * Parent Portal Home Screen
 * Modern mobile-first home experience like a banking app
 * Focuses on most important information: child, fees, results, attendance, announcements
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowRight, AlertCircle, TrendingUp, Calendar, Bell,
  MessageSquare, DollarSign, CheckCircle2, Clock, Eye,
  MapPin, GraduationCap, ChevronRight, RefreshCw
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';

// ─── Helper Components ──────────────────────────────────────────────

function LoadingCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

function HeroChildCard({ child, onSelectChild }) {
  const getStatusColor = (isPresent) => {
    return isPresent 
      ? 'bg-emerald-100 text-emerald-700' 
      : 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="relative bg-gradient-to-br from-brand-purple to-purple-700 rounded-3xl p-6 text-white overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
      
      <div className="relative z-10">
        {/* Child Avatar */}
        <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-bold mb-4">
          {child?.name?.[0] || '?'}
        </div>

        {/* Child Info */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold">{child?.name || 'Child Name'}</h2>
          <p className="text-white/80 text-sm mt-1">{child?.grade} · {child?.className || 'Class'}</p>
          {child?.admissionNumber && (
            <p className="text-white/70 text-xs mt-2">Adm #{child.admissionNumber}</p>
          )}
        </div>

        {/* Status and Term */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(child?.isPresent)}`}>
            {child?.isPresent ? '✓ Present Today' : '○ Not Present'}
          </div>
          {child?.currentTerm && (
            <div className="px-3 py-1.5 rounded-full bg-white/20 text-xs font-semibold text-white">
              {child.currentTerm}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-white/70 text-xs mb-1">Attendance</p>
            <p className="text-xl font-bold">{child?.attendanceRate || 0}%</p>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-xs mb-1">Avg Score</p>
            <p className="text-xl font-bold">{child?.averageScore || '-'}%</p>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-xs mb-1">Balance</p>
            <p className="text-xl font-bold">KES {Number(child?.feeBalance || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeeSummaryCard({ feesData, onPayNow }) {
  const outstandingBalance = Number(feesData?.outstandingBalance || 0);
  const amountDue = Number(feesData?.amountDue || 0);
  const nextPaymentDate = feesData?.nextPaymentDate;

  // Calculate progress percentage
  const totalFees = Number(feesData?.totalFees || 0);
  const paid = totalFees - outstandingBalance;
  const progressPercent = totalFees > 0 ? (paid / totalFees * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Outstanding Balance</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            KES {outstandingBalance.toLocaleString()}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
          <DollarSign size={20} />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-600">Payment Progress</p>
          <p className="text-xs font-semibold text-gray-900">{Math.round(progressPercent)}%</p>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Fee Details */}
      <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-500 mb-1">Amount Due</p>
          <p className="text-lg font-bold text-gray-900">KES {amountDue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Next Payment Date</p>
          <p className="text-lg font-bold text-gray-900">{nextPaymentDate || 'TBD'}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPayNow}
          className="flex-1 bg-brand-purple text-white font-semibold py-3 rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-2"
        >
          Pay Now <ArrowRight size={16} />
        </button>
        <button className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
          Statement
        </button>
      </div>
    </div>
  );
}

function AssessmentCard({ assessmentData }) {
  const subjects = (assessmentData?.subjects || []).slice(0, 4);
  
  const getGradeColor = (score) => {
    const numScore = Number(score || 0);
    if (numScore >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (numScore >= 70) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (numScore >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Latest Assessment</h3>
        <TrendingUp size={18} className="text-brand-purple" />
      </div>

      {subjects.length > 0 ? (
        <>
          <div className="space-y-2 mb-4">
            {subjects.map((subject, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{subject.name || subject.title}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg font-bold text-sm border ${getGradeColor(subject.score)}`}>
                  {Math.round(subject.score || 0)}%
                </div>
              </div>
            ))}
          </div>
          <button className="w-full text-brand-purple font-semibold py-2 text-sm hover:bg-brand-purple/5 rounded-lg transition flex items-center justify-center gap-2">
            View Full Results <ChevronRight size={16} />
          </button>
        </>
      ) : (
        <p className="text-center py-6 text-gray-400 text-sm">No assessment data available</p>
      )}
    </div>
  );
}

function AttendanceCard({ attendanceData }) {
  const attendance = Number(attendanceData?.percentage || 0);
  const present = Number(attendanceData?.presentDays || 0);
  const late = Number(attendanceData?.lateDays || 0);
  const absent = Number(attendanceData?.absentDays || 0);

  const getAttendanceColor = (percent) => {
    if (percent >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (percent >= 75) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Attendance</h3>
        <Calendar size={18} className="text-emerald-600" />
      </div>

      {/* Attendance percentage */}
      <div className={`p-4 rounded-xl border mb-4 ${getAttendanceColor(attendance)}`}>
        <p className="text-xs opacity-75 font-medium mb-1">Overall Attendance</p>
        <p className="text-3xl font-bold">{attendance}%</p>
      </div>

      {/* Attendance breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-xs text-emerald-600 font-semibold mb-1">Present</p>
          <p className="text-lg font-bold text-emerald-700">{present}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-xs text-amber-600 font-semibold mb-1">Late</p>
          <p className="text-lg font-bold text-amber-700">{late}</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 text-center">
          <p className="text-xs text-rose-600 font-semibold mb-1">Absent</p>
          <p className="text-lg font-bold text-rose-700">{absent}</p>
        </div>
      </div>

      <button className="w-full text-brand-purple font-semibold py-2 text-sm hover:bg-brand-purple/5 rounded-lg transition flex items-center justify-center gap-2">
        View Attendance <ChevronRight size={16} />
      </button>
    </div>
  );
}

function AnnouncementsCard({ announcements }) {
  const recentAnnouncements = (announcements || []).slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Announcements</h3>
        <Bell size={18} className="text-violet-600" />
      </div>

      {recentAnnouncements.length > 0 ? (
        <>
          <div className="space-y-2 mb-4">
            {recentAnnouncements.map((announcement, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer">
                <div className="w-2 h-2 rounded-full bg-brand-purple mt-1.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{announcement.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{announcement.timeLabel || 'Recent'}</p>
                </div>
                {announcement.unread && (
                  <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
          <button className="w-full text-brand-purple font-semibold py-2 text-sm hover:bg-brand-purple/5 rounded-lg transition flex items-center justify-center gap-2">
            View All <ChevronRight size={16} />
          </button>
        </>
      ) : (
        <p className="text-center py-6 text-gray-400 text-sm">No announcements</p>
      )}
    </div>
  );
}

function QuickActionsBar({ onNavigate }) {
  const actions = [
    { id: 'fees', label: 'Pay Fees', icon: DollarSign, action: () => onNavigate('parent-portal-fees') },
    { id: 'results', label: 'Results', icon: TrendingUp, action: () => onNavigate('parent-portal-results') },
    { id: 'attendance', label: 'Attendance', icon: CheckCircle2, action: () => onNavigate('parent-portal-attendance') },
    { id: 'messages', label: 'Messages', icon: MessageSquare, action: () => onNavigate('parent-portal-messages') },
    { id: 'transport', label: 'Transport', icon: MapPin, action: () => onNavigate('parent-portal-transport') },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={action.action}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
          >
            <Icon size={20} className="text-brand-purple" />
            <span className="text-xs font-semibold text-gray-700 text-center">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentPortalHome = ({ user, onNavigate }) => {
  const [metrics, setMetrics] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await dashboardAPI.getParentMetrics?.() || { success: true, data: {} };
        if (response.success) {
          setMetrics(response.data);
          // Auto-select first child
          if (response.data?.children?.length > 0 && !selectedChildId) {
            setSelectedChildId(response.data.children[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMetrics();
  }, []);

  const children = metrics?.children || [];
  const selectedChild = children.find(c => c.id === selectedChildId) || children[0];

  const handlePayNow = () => {
    onNavigate('parent-portal-fees');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1>
          <p className="text-sm text-gray-500 mt-1">{user?.name || 'Parent'}</p>
        </div>
      </div>

      {/* Child Selector */}
      {children.length > 1 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Select Child</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full font-semibold text-sm transition ${
                  selectedChild?.id === child.id
                    ? 'bg-brand-purple text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {child.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-5 space-y-4">
        {loading ? (
          <>
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </>
        ) : selectedChild ? (
          <>
            {/* Hero Child Card */}
            <HeroChildCard child={selectedChild} onSelectChild={setSelectedChildId} />

            {/* Fee Summary Card */}
            <FeeSummaryCard
              feesData={{
                outstandingBalance: selectedChild.feeBalance || 0,
                amountDue: selectedChild.amountDue || 0,
                nextPaymentDate: selectedChild.nextPaymentDate,
                totalFees: selectedChild.totalFees || 0,
              }}
              onPayNow={handlePayNow}
            />

            {/* Latest Assessment */}
            <AssessmentCard assessmentData={{
              subjects: selectedChild.subjects || [],
            }} />

            {/* Attendance */}
            <AttendanceCard attendanceData={{
              percentage: selectedChild.attendanceRate || 0,
              presentDays: selectedChild.attendanceSummary?.presentDays || 0,
              lateDays: selectedChild.attendanceSummary?.lateDays || 0,
              absentDays: selectedChild.attendanceSummary?.absentDays || 0,
            }} />

            {/* Announcements */}
            <AnnouncementsCard announcements={metrics?.notices || []} />

            {/* Quick Actions */}
            <div className="pt-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Quick Actions</p>
              <QuickActionsBar onNavigate={onNavigate} />
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No children linked to this account</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentPortalHome;
