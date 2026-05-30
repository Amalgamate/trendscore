/**
 * Dashboard Page
 * Main dashboard with statistics and overview
 */

import React from 'react';
import {
  Users, GraduationCap, BookOpen, Activity, Calendar, ShieldCheck, Zap, Target
} from 'lucide-react';
import CompactMetricBanner from './dashboard/CompactMetricBanner';
import DashboardResponsiveWrapper from '../DashboardResponsiveWrapper';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { useState, useEffect } from 'react';

// --- Mock Data for Dashboard Charts ---
const demographicsData = [
  { name: 'Boys', value: 450, color: '#8b5cf6' }, // brand-purple
  { name: 'Girls', value: 520, color: '#14b8a6' }, // brand-teal
];

const performanceData = [
  { term: 'Term 1', score: 68 },
  { term: 'Term 2', score: 72 },
  { term: 'Term 3', score: 78 },
];

const financeData = [
  { name: 'Grade 1', collected: 80, pending: 20 },
  { name: 'Grade 2', collected: 65, pending: 35 },
  { name: 'Grade 3', collected: 90, pending: 10 },
  { name: 'Grade 4', collected: 55, pending: 45 },
];

const Dashboard = ({ learners, teachers, onNavigate }) => {
  const activeLearners = learners?.filter(l => l.status === 'Active' || l.status === 'ACTIVE').length || 0;
  const activeTeachers = teachers?.filter(t => t.status === 'Active' || t.status === 'ACTIVE').length || 0;
  const [showEmptyHint, setShowEmptyHint] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('onboarding_dismissed');
    setShowEmptyHint(activeLearners === 0 && !dismissed);
  }, [activeLearners]);

  const dismissEmptyHint = () => {
    setShowEmptyHint(false);
    sessionStorage.setItem('onboarding_dismissed', 'true');
  };

  return (
    <DashboardResponsiveWrapper
      onNavigate={() => { }}
      currentPage="dashboard"
      metrics={{
        activeLearnersValue: activeLearners,
        activeLearnersChange: null,
        assessmentsValue: '-',
        assessmentsChange: null,
        attendanceValue: '-',
        attendanceChange: null
      }}
    >
      <div className="space-y-6">
        {showEmptyHint && (
          <div className="rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Get started with your school</p>
              <p className="text-xs text-gray-600 mt-1">
                No active learners yet. Register your first student in Admissions to populate the dashboard.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {typeof onNavigate === 'function' && (
                <button
                  type="button"
                  onClick={() => onNavigate('learners-admissions')}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded-md bg-brand-purple text-white hover:bg-brand-purple/90"
                >
                  Add learners
                </button>
              )}
              <button
                type="button"
                onClick={dismissEmptyHint}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded-md border border-gray-300 text-gray-700 hover:bg-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {/* Compact Metrics Banner */}
        <CompactMetricBanner
          metrics={[
            {
              title: 'Enrollment',
              value: activeLearners,
              subtitle: 'Active Students',
              icon: Users,
              trend: null,
              trendValue: null
            },
            {
              title: 'Faculty',
              value: activeTeachers,
              subtitle: 'Teaching Staff',
              icon: GraduationCap,
              trend: null,
              trendValue: null
            },
            {
              title: 'Units',
              value: '-',
              subtitle: 'Active Learning Areas',
              icon: BookOpen,
              trend: null,
              trendValue: null
            },
            {
              title: 'Performance',
              value: '-',
              subtitle: 'Avg Attendance',
              icon: Activity,
              trend: null,
              trendValue: null
            }
          ]}
          gradientFrom="from-brand-purple"
          gradientVia="via-purple-500"
          gradientTo="to-pink-500"
        />

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Demographics Pie */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-4">Demographics</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demographicsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {demographicsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '500' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance Trend Area */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-4">Academic Trend</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="term" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="score" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Finance Overview Bar */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-4">Fee Collection (%)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} tickFormatter={(val) => `${val}%`} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '500' }} />
                  <Bar dataKey="collected" name="Collected" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={12} stackId="a" />
                  <Bar dataKey="pending" name="Pending" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={12} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Service Console */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-widest">Enterprise Service Console</h3>
                <ShieldCheck size={16} className="text-brand-purple" />
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-100 rounded-lg hover:border-brand-purple/20 hover:bg-brand-purple/5 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-brand-purple/10 text-brand-purple rounded group-hover:bg-brand-purple group-hover:text-white transition-all">
                        <Users size={18} />
                      </div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase">Registry Support</h4>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">Coordinate student admissions, portfolio updates and academic transitions.</p>
                  </div>

                  <div className="p-4 border border-gray-100 rounded-lg hover:border-brand-teal/20 hover:bg-brand-teal/5 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-brand-teal/10 text-brand-teal rounded group-hover:bg-brand-teal group-hover:text-white transition-all">
                        <Target size={18} />
                      </div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase">Assessment Hub</h4>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">Manage CBC formative assessments and end-of-term summative evaluations.</p>
                  </div>

                  <div className="p-4 border border-gray-100 rounded-lg hover:border-amber-500/20 hover:bg-amber-500/5 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-amber-500/10 text-amber-600 rounded group-hover:bg-amber-500 group-hover:text-white transition-all">
                        <Zap size={18} />
                      </div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase">Ops Framework</h4>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">Review daily attendance logs, schedule changes and institutional milestones.</p>
                  </div>

                  <div className="p-4 border border-gray-100 rounded-lg hover:border-indigo-500/20 hover:bg-indigo-500/5 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded group-hover:bg-indigo-500 group-hover:text-white transition-all">
                        <Calendar size={18} />
                      </div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase">Planner</h4>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">Access the unified academic calendar and term-based operational roadmaps.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Activity Log */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-widest">System Broadcasts</h3>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="px-6 py-8 text-center text-gray-400 text-xs italic">No active broadcasts for your role</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardResponsiveWrapper>
  );
};

export default Dashboard;
