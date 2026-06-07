import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  GraduationCap,
  Package,
  ChevronDown,
} from 'lucide-react';
import { DashboardSectionControls } from './DashboardSections';

const OVERVIEW_TABS = [
  { id: 'general', label: 'General Overview', icon: Activity, color: { active: 'blue', border: 'border-blue-600', bg: 'bg-blue-50', text: 'text-blue-900', icon: 'text-blue-600' } },
  { id: 'financials', label: 'Financials', icon: DollarSign, path: 'finance-dashboard', color: { active: 'green', border: 'border-green-600', bg: 'bg-green-50', text: 'text-green-900', icon: 'text-green-600' } },
  { id: 'academic', label: 'Academic Performance', icon: GraduationCap, path: 'academic-intelligence', color: { active: 'purple', border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-900', icon: 'text-purple-600' } },
  { id: 'operations', label: 'School Operations', icon: Clock, path: 'attendance-reports', color: { active: 'orange', border: 'border-orange-600', bg: 'bg-orange-50', text: 'text-orange-900', icon: 'text-orange-600' } },
  { id: 'calendar', label: 'School Calendar', icon: Calendar, path: 'planner-calendar', color: { active: 'red', border: 'border-red-600', bg: 'bg-red-50', text: 'text-red-900', icon: 'text-red-600' } },
  { id: 'insights', label: 'AI Smart Insights', icon: BarChart3, path: 'academic-ai-insights', color: { active: 'amber', border: 'border-amber-600', bg: 'bg-amber-50', text: 'text-amber-900', icon: 'text-amber-600' } },
  { id: 'hr', label: 'HR Overview', icon: Briefcase, path: 'hr-dashboard', color: { active: 'cyan', border: 'border-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-900', icon: 'text-cyan-600' } },
  { id: 'inventory', label: 'Inventory', icon: Package, path: 'inventory-items', color: { active: 'pink', border: 'border-pink-600', bg: 'bg-pink-50', text: 'text-pink-900', icon: 'text-pink-600' } },
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
  tabColor = { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' },
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
    inventory: {
      title: 'Inventory overview',
      description: 'Stock, stores, asset register, and requisition control points.',
      action: { label: 'Open Inventory Items', path: 'inventory-items' },
      metrics: [
        { label: 'Items', value: 'Catalog', note: 'Manage stock and school supplies' },
        { label: 'Movements', value: 'Tracked', note: 'Review stock movement history' },
        { label: 'Assets', value: 'Register', note: 'Manage assigned school assets' },
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
          className={`inline-flex min-h-[38px] items-center justify-center border ${tabColor.border} ${tabColor.bg} px-4 text-xs font-black ${tabColor.text} transition hover:opacity-90`}
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
  sectionControls,
  stats,
  metrics,
  formatKesAmount,
  formatPercent,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState('general');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const activeTab = controlledActiveTab || internalActiveTab;

  const handleTabClick = (tab) => {
    setInternalActiveTab(tab.id);
    onTabChange?.(tab.id);
    setIsDropdownOpen(false);
  };

  const activeTabObj = OVERVIEW_TABS.find(tab => tab.id === activeTab);
  const tabColor = activeTabObj?.color || { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' };

  return (
    <nav 
      className="w-full border-b border-slate-200 bg-white" 
      aria-label="Dashboard overview tabs"
    >
      {/* Desktop Tabs */}
      <div className="hidden md:block overflow-x-auto">
        <div className="flex min-w-max px-[var(--app-gutter-x)]">
          {OVERVIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const color = tab.color;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[46px] min-w-[158px] items-center justify-center gap-2 border-r border-slate-200 px-3 text-xs font-black transition last:border-r-0 ${
                  isActive
                    ? `border-b-4 ${color.border} ${color.bg} ${color.text}`
                    : `border-b-2 border-transparent ${color.bg}/30 ${color.text}/70 hover:${color.bg}/50`
                }`}
              >
                <Icon size={16} className={isActive ? color.icon : `${color.icon}/70`} />
                <span className="whitespace-normal leading-tight">{tab.label}</span>
              </button>
            );
          })}
          {sectionControls && <DashboardSectionControls {...sectionControls} variant="menu" />}
        </div>
      </div>

      {/* Mobile Dropdown */}
      <div className="md:hidden px-[var(--app-gutter-x)] py-3">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 font-black text-sm transition ${
              isDropdownOpen
                ? `${tabColor.border} ${tabColor.bg} ${tabColor.text}`
                : `border-slate-200 bg-white text-slate-900 hover:${tabColor.bg}/20`
            }`}
          >
            <span className="flex items-center gap-2">
              {activeTabObj?.icon && <activeTabObj.icon size={16} className={tabColor.icon} />}
              {activeTabObj?.label}
            </span>
            <ChevronDown size={16} className={`transition ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-slate-200 rounded-lg shadow-lg">
              {OVERVIEW_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const color = tab.color;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 text-left transition hover:${color.bg}/30 last:border-b-0 ${
                      isActive
                        ? `${color.bg} ${color.text} font-black`
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={16} className={isActive ? color.icon : 'text-slate-500'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default AdminOverviewTabs;
