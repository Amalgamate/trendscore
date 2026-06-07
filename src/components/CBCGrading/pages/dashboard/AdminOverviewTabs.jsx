import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  GraduationCap,
} from 'lucide-react';

const OVERVIEW_TABS = [
  { id: 'general', label: 'General Overview', icon: Activity },
  { id: 'financials', label: 'Financials', icon: DollarSign, path: 'finance-dashboard' },
  { id: 'academic', label: 'Academic Performance', icon: GraduationCap, path: 'academic-intelligence' },
  { id: 'operations', label: 'School Operations', icon: Clock, path: 'attendance-reports' },
  { id: 'calendar', label: 'School Calendar', icon: Calendar, path: 'planner-calendar' },
  { id: 'insights', label: 'AI Smart Insights', icon: BarChart3, path: 'academic-ai-insights' },
  { id: 'hr', label: 'HR Overview', icon: Briefcase, path: 'hr-dashboard' },
];

const fallbackFormatKes = (amount = 0) => `KES ${(Number(amount) || 0).toLocaleString()}`;
const fallbackFormatPercent = (value = 0) => `${Math.max(0, Math.min(100, Number(value) || 0))}%`;

const MiniMetric = ({ label, value, note }) => (
  <div className="border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
    <p className="mt-2 text-xl font-black leading-none text-slate-950">{value}</p>
    {note && <p className="mt-2 text-xs font-semibold text-slate-500">{note}</p>}
  </div>
);

const AdminMiniReport = ({
  activeTab,
  stats = {},
  metrics = {},
  onNavigate,
  formatKesAmount = fallbackFormatKes,
  formatPercent = fallbackFormatPercent,
}) => {
  if (activeTab === 'general') return null;

  const collectionRate = (stats.feeCollected + stats.feePending) > 0
    ? Math.round((stats.feeCollected / (stats.feeCollected + stats.feePending)) * 100)
    : 0;
  const attendanceRate = stats.totalStudents > 0
    ? Math.round((stats.presentToday / ((stats.presentToday + stats.absentToday) || stats.totalStudents)) * 100)
    : 0;
  const assessmentRate = stats.totalStudents > 0
    ? Math.round(((stats.totalStudents - stats.totalMissedExams) / stats.totalStudents) * 100)
    : 0;
  const staffActiveRate = stats.totalTeachers > 0
    ? Math.round((stats.activeTeachers / stats.totalTeachers) * 100)
    : 0;
  const topClass = metrics?.topPerformingClasses?.[0];
  const streamCount = metrics?.financials?.streamBreakdown?.length || 0;
  const attentionCount = [
    stats.totalMissedExams > 0,
    stats.feePending > 0,
    stats.atRiskStudents > 0,
  ].filter(Boolean).length;

  const reports = {
    financials: {
      title: 'Financials overview',
      description: 'Collection position, outstanding balances, and finance coverage for the current period.',
      action: { label: 'Open Finance Dashboard', path: 'finance-dashboard' },
      metrics: [
        { label: 'Collected', value: formatKesAmount(stats.feeCollected), note: 'Recorded fee collection' },
        { label: 'Outstanding', value: formatKesAmount(stats.feePending), note: 'Pending follow-up balance' },
        { label: 'Collection Rate', value: formatPercent(collectionRate), note: `${streamCount} streams in breakdown` },
      ],
    },
    academic: {
      title: 'Academic performance overview',
      description: 'Assessment completion, learner risk, and class performance signals.',
      action: { label: 'Open Academic Intelligence', path: 'academic-intelligence' },
      metrics: [
        { label: 'Assessment Progress', value: formatPercent(assessmentRate), note: `${stats.totalMissedExams || 0} unassessed learners` },
        { label: 'Assessed Classes', value: stats.totalAssessedClasses || 0, note: 'Classes with recorded assessments' },
        { label: 'Top Class', value: topClass?.grade || 'No data', note: topClass?.avg ? `${Math.round(topClass.avg)} average score` : 'Awaiting performance feed' },
      ],
    },
    operations: {
      title: 'School operations overview',
      description: 'Daily attendance, staffing availability, and operational attention points.',
      action: { label: 'Open Attendance Reports', path: 'attendance-reports' },
      metrics: [
        { label: 'Attendance Rate', value: formatPercent(attendanceRate), note: `${stats.presentToday || 0} present today` },
        { label: 'Absent Today', value: stats.absentToday || 0, note: 'Learners needing follow-up' },
        { label: 'Staff Active Rate', value: formatPercent(staffActiveRate), note: `${stats.activeTeachers || 0}/${stats.totalTeachers || 0} active staff` },
      ],
    },
    calendar: {
      title: 'School calendar overview',
      description: 'Planner, timetable, and agenda entry points for the current operating cycle.',
      action: { label: 'Open School Calendar', path: 'planner-calendar' },
      metrics: [
        { label: 'Calendar', value: 'Planner', note: 'School events and dates' },
        { label: 'Timetable', value: 'Active', note: 'Class and staff schedules' },
        { label: 'Agenda', value: 'Ready', note: 'Daily planning workspace' },
      ],
    },
    insights: {
      title: 'AI smart insights overview',
      description: 'Priority signals from risk, assessment, finance, and activity feeds.',
      action: { label: 'Open AI Insights', path: 'academic-ai-insights' },
      metrics: [
        { label: 'Risk Learners', value: stats.atRiskStudents || 0, note: 'Learners requiring support' },
        { label: 'Attention Areas', value: attentionCount, note: 'Active dashboard warnings' },
        { label: 'Recent Activity', value: metrics?.recentActivity ? 'Live' : 'No feed', note: 'Admissions and assessment updates' },
      ],
    },
    hr: {
      title: 'HR overview',
      description: 'Staffing position, active tutors, and workforce coverage.',
      action: { label: 'Open HR Dashboard', path: 'hr-dashboard' },
      metrics: [
        { label: 'Total Staff', value: stats.totalTeachers || 0, note: 'Staff records in scope' },
        { label: 'Active Staff', value: stats.activeTeachers || 0, note: 'Currently active staff' },
        { label: 'Coverage', value: formatPercent(staffActiveRate), note: `${Math.max(0, (stats.totalTeachers || 0) - (stats.activeTeachers || 0))} inactive or pending` },
      ],
    },
  };

  const report = reports[activeTab];
  if (!report) return null;

  return (
    <section className="border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">{report.title}</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">{report.description}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.(report.action.path)}
          className="inline-flex min-h-[38px] items-center justify-center border border-indigo-200 bg-indigo-50 px-4 text-xs font-black text-indigo-900 transition hover:bg-indigo-100"
        >
          {report.action.label}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {report.metrics.map((item) => (
          <MiniMetric key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
};

const AdminOverviewTabs = ({
  activeTab: controlledActiveTab,
  onTabChange,
  onNavigate,
  stats,
  metrics,
  formatKesAmount,
  formatPercent,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState('general');
  const activeTab = controlledActiveTab || internalActiveTab;

  const handleTabClick = (tab) => {
    setInternalActiveTab(tab.id);
    onTabChange?.(tab.id);
  };

  return (
    <div className="space-y-3">
      <nav className="overflow-x-auto border border-slate-200 bg-white" aria-label="Dashboard overview tabs">
        <div className="flex min-w-max">
          {OVERVIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[46px] min-w-[158px] items-center justify-center gap-2 border-r border-slate-200 px-3 text-xs font-black transition last:border-r-0 ${
                  isActive
                    ? 'border-b-2 border-indigo-700 bg-white text-indigo-900'
                    : 'border-b-2 border-transparent bg-white text-slate-950 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-indigo-700' : 'text-slate-600'} />
                <span className="whitespace-normal leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <AdminMiniReport
        activeTab={activeTab}
        stats={stats}
        metrics={metrics}
        onNavigate={onNavigate}
        formatKesAmount={formatKesAmount}
        formatPercent={formatPercent}
      />
    </div>
  );
};

export default AdminOverviewTabs;
