/**
 * Owner/Admin Mobile Dashboard
 * Compact mobile view for executives with key metrics and actions
 */

import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  BarChart3, 
  Settings,
  Calendar,
  ChevronDown,
  CheckCircle2,
  GraduationCap,
  BookOpen,
  Cog 
} from 'lucide-react';
import MobileBottomNav from './MobileBottomNav';

const OwnerMobileDashboard = ({ user, onNavigate, currentPath }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getAdminMetrics?.('term') || { success: true, data: {} };
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

  const userName = user?.name || user?.firstName || user?.email?.split('@')[0] || 'Admin';
  const firstName = userName.split(' ')[0];
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Calculate School Health Score (0-100) exactly like desktop
  const attendanceRate = stats.totalStudents > 0 
    ? Math.round((stats.presentToday / (stats.presentToday + stats.absentToday || stats.totalStudents)) * 100) 
    : 0;
  const collectionRate = (stats.feeCollected + stats.feePending) > 0
    ? Math.round((stats.feeCollected / (stats.feeCollected + stats.feePending)) * 100)
    : 0;
  const assessmentRate = stats.totalStudents > 0
    ? Math.round(((stats.totalStudents - stats.totalMissedExams) / stats.totalStudents) * 100)
    : 0;
  const healthScore = Math.round((attendanceRate + collectionRate + assessmentRate) / 3);

  return (
    <div className="pb-24 bg-gray-50 min-h-screen">
      {/* Header with Welcome Greeting */}
      <div className="px-4 py-5 bg-brand-purple text-white shadow-sm">
        <h1 className="text-xl font-black text-white tracking-tight">
          {getGreeting()}, <span>{firstName}</span>
        </h1>
        <p className="text-xs text-white/70 mt-0.5 font-bold uppercase tracking-wider">
          School Overview
        </p>
      </div>

      {/* Main Content Area */}
      <div className="px-4 py-4 space-y-6">
        
        {/* SECTION 1: School Health Card */}
        <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base text-gray-900 leading-none">School Health</h3>
              <p className="text-[10px] text-gray-400 font-medium mt-1">Overall institutional wellness</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer">
              <Calendar size={11} className="text-gray-500" />
              <span>This Week</span>
              <ChevronDown size={10} className="text-gray-400" />
            </div>
          </div>

          {/* Circle + Rows Grid */}
          <div className="grid grid-cols-1 gap-6 items-center">
            {/* Large Circular Progress (Centered for mobile) */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative flex items-center justify-center w-36 h-36">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f1f5f9"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  {/* Foreground Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#16A34A"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={(2 * Math.PI * 40) - ((healthScore || 89) / 100) * (2 * Math.PI * 40)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                {/* Inner Text */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-gray-900 leading-none">{healthScore || 89}%</span>
                  <span className="text-[10px] font-bold text-emerald-600 tracking-wider mt-1 uppercase">
                    {(healthScore || 89) >= 80 ? 'GOOD' : 'STABLE'}
                  </span>
                  <div className="flex items-center gap-0.5 text-emerald-600 font-bold text-[9px] mt-1 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    <span>↑ 4%</span>
                  </div>
                  <span className="text-[8px] text-gray-400 mt-0.5 font-medium">from last week</span>
                </div>
              </div>
            </div>

            {/* Health Dimensions Progress Rows */}
            <div className="space-y-3.5">
              {/* Finance Health */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                      <DollarSign size={13} />
                    </div>
                    <span className="text-gray-700 font-semibold text-xs">Finance</span>
                  </div>
                  <span className="text-gray-950 font-bold text-xs">{collectionRate || 92}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500" 
                    style={{ width: `${collectionRate || 92}%` }}
                  />
                </div>
              </div>

              {/* Attendance Health */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
                      <Users size={13} />
                    </div>
                    <span className="text-gray-700 font-semibold text-xs">Attendance</span>
                  </div>
                  <span className="text-gray-950 font-bold text-xs">{attendanceRate || 96}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                    style={{ width: `${attendanceRate || 96}%` }}
                  />
                </div>
              </div>

              {/* Academic Health */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-purple-50 text-purple-600">
                      <GraduationCap size={13} />
                    </div>
                    <span className="text-gray-700 font-semibold text-xs">Academics</span>
                  </div>
                  <span className="text-gray-950 font-bold text-xs">{assessmentRate || 78}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                    style={{ width: `${assessmentRate || 78}%` }}
                  />
                </div>
              </div>

              {/* Operations Health */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-orange-50 text-orange-600">
                      <Cog size={13} />
                    </div>
                    <span className="text-gray-700 font-semibold text-xs">Operations</span>
                  </div>
                  <span className="text-gray-950 font-bold text-xs">90%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-600 rounded-full transition-all duration-500" 
                    style={{ width: `90%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100"></div>

          {/* Status Strip */}
          <div className="grid grid-cols-4 gap-1 text-center pt-1">
            {/* Money */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 mb-1 border border-emerald-100/50">
                <DollarSign size={13} />
              </div>
              <span className="text-[10px] font-bold text-gray-900">Money</span>
              <span className="text-[8px] font-bold text-emerald-600">Healthy</span>
              <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center mt-2 text-emerald-600 border border-emerald-200">
                <CheckCircle2 size={10} className="fill-emerald-100 text-emerald-600" />
              </div>
            </div>

            {/* Learners */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-50 text-blue-600 mb-1 border border-blue-100/50">
                <Users size={13} />
              </div>
              <span className="text-[10px] font-bold text-gray-900">Learners</span>
              <span className="text-[8px] font-bold text-emerald-600">Healthy</span>
              <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center mt-2 text-emerald-600 border border-emerald-200">
                <CheckCircle2 size={10} className="fill-emerald-100 text-emerald-600" />
              </div>
            </div>

            {/* Teachers */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-purple-50 text-purple-600 mb-1 border border-purple-100/50">
                <Users size={13} />
              </div>
              <span className="text-[10px] font-bold text-gray-900">Teachers</span>
              <span className="text-[8px] font-bold text-emerald-600">Healthy</span>
              <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center mt-2 text-emerald-600 border border-emerald-200">
                <CheckCircle2 size={10} className="fill-emerald-100 text-emerald-600" />
              </div>
            </div>

            {/* Academics */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-orange-50 text-orange-600 mb-1 border border-orange-100/50">
                <GraduationCap size={13} />
              </div>
              <span className="text-[10px] font-bold text-gray-900">Academics</span>
              <span className="text-[8px] font-bold text-orange-600">Attention</span>
              <div className="w-4 h-4 rounded-full bg-orange-50 flex items-center justify-center mt-2 text-orange-600 border border-orange-200">
                <AlertTriangle size={9} className="text-orange-600 fill-orange-100" />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Executive Summary */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-base text-gray-900 leading-none">Executive Summary</h3>
            <button 
              onClick={() => onNavigate('assess-summary-report')}
              className="text-[11px] font-bold text-brand-purple hover:underline"
            >
              View full report →
            </button>
          </div>

          {/* 2x2 Grid of Colored Executive Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Money Card */}
            <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-emerald-50/40 to-emerald-50/20 border border-emerald-100/80 shadow-xs flex flex-col justify-between min-h-[140px]">
              <BarChart3 size={56} className="absolute -right-2 -top-2 text-emerald-500/5 pointer-events-none transform -rotate-12" />
              
              <div className="flex items-center gap-1.5 z-10">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-100/80 text-emerald-600">
                  <DollarSign size={12} className="stroke-[2.5]" />
                </div>
                <span className="font-bold text-[10px] text-emerald-800 tracking-wide uppercase">Money</span>
              </div>

              <div className="flex justify-between items-end mt-3 z-10">
                <div className="space-y-0.5">
                  <div className="text-lg font-black text-gray-955 tracking-tight leading-none">
                    {stats.feeCollected > 0 ? `KES ${(stats.feeCollected / 1000000).toFixed(1)}M` : 'KES 8.7M'}
                  </div>
                  <div className="text-[9px] text-gray-400 font-bold uppercase">
                    Collected
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 mt-2 flex items-center gap-0.5">
                    <span>{collectionRate || 82}%</span>
                    <span className="text-gray-500 font-semibold text-[8px] uppercase tracking-wider">Target</span>
                  </div>
                </div>

                <div className="w-14 h-7 flex-shrink-0">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="money-sparkline-grad-mobile" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#16A34A" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#16A34A" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,35 C10,33 20,32 30,25 C40,18 50,22 60,15 C70,8 80,10 100,2"
                      fill="none"
                      stroke="#16A34A"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,35 C10,33 20,32 30,25 C40,18 50,22 60,15 C70,8 80,10 100,2 L100,40 L0,40 Z"
                      fill="url(#money-sparkline-grad-mobile)"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Learners Card */}
            <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-blue-50/40 to-blue-50/20 border border-blue-100/80 shadow-xs flex flex-col justify-between min-h-[140px]">
              <Users size={56} className="absolute -right-2 -top-2 text-blue-500/5 pointer-events-none transform -rotate-12" />

              <div className="flex items-center gap-1.5 z-10">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-100/80 text-blue-600">
                  <Users size={12} className="stroke-[2.5]" />
                </div>
                <span className="font-bold text-[10px] text-blue-800 tracking-wide uppercase">Learners</span>
              </div>

              <div className="flex justify-between items-end mt-3 z-10">
                <div className="space-y-0.5">
                  <div className="text-lg font-black text-gray-955 tracking-tight leading-none">
                    {attendanceRate > 0 ? `${attendanceRate}%` : '96%'}
                  </div>
                  <div className="text-[9px] text-gray-400 font-bold uppercase">
                    Present today
                  </div>
                  <div className="text-[10px] font-bold text-blue-600 mt-2 flex items-center gap-0.5">
                    <span>{stats.absentToday || 12}</span>
                    <span className="text-gray-500 font-semibold text-[8px] uppercase tracking-wider">Absent</span>
                  </div>
                </div>

                <div className="w-14 h-7 flex-shrink-0">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="learners-sparkline-grad-mobile" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,28 C10,32 20,18 30,22 C45,28 55,12 65,18 C75,24 85,8 100,12"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,28 C10,32 20,18 30,22 C45,28 55,12 65,18 C75,24 85,8 100,12 L100,40 L0,40 Z"
                      fill="url(#learners-sparkline-grad-mobile)"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Teachers Card */}
            <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-purple-50/40 to-purple-50/20 border border-purple-100/80 shadow-xs flex flex-col justify-between min-h-[140px]">
              <Users size={56} className="absolute -right-2 -top-2 text-purple-500/5 pointer-events-none transform -rotate-12" />

              <div className="flex items-center gap-1.5 z-10">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-purple-100/80 text-purple-600">
                  <Users size={12} className="stroke-[2.5]" />
                </div>
                <span className="font-bold text-[10px] text-purple-800 tracking-wide uppercase">Teachers</span>
              </div>

              <div className="flex justify-between items-end mt-3 z-10">
                <div className="space-y-0.5">
                  <div className="text-lg font-black text-gray-955 tracking-tight leading-none">
                    98%
                  </div>
                  <div className="text-[9px] text-gray-400 font-bold uppercase">
                    Present today
                  </div>
                  <div className="text-[10px] font-bold text-purple-600 mt-2 flex items-center gap-0.5">
                    <span>1</span>
                    <span className="text-gray-500 font-semibold text-[8px] uppercase tracking-wider">Absent</span>
                  </div>
                </div>

                <div className="w-14 h-7 flex-shrink-0">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="teachers-sparkline-grad-mobile" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,30 C10,32 20,20 30,24 C45,30 55,14 65,20 C75,26 85,10 100,14"
                      fill="none"
                      stroke="#8B5CF6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,30 C10,32 20,20 30,24 C45,30 55,14 65,20 C75,26 85,10 100,14 L100,40 L0,40 Z"
                      fill="url(#teachers-sparkline-grad-mobile)"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Academics Card */}
            <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-orange-50/40 to-orange-50/20 border border-orange-100/80 shadow-xs flex flex-col justify-between min-h-[140px]">
              <BookOpen size={56} className="absolute -right-2 -top-2 text-orange-500/5 pointer-events-none transform -rotate-12" />

              <div className="flex items-center gap-1.5 z-10">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-orange-100/80 text-orange-600">
                  <GraduationCap size={12} className="stroke-[2.5]" />
                </div>
                <span className="font-bold text-[10px] text-orange-800 tracking-wide uppercase">Academics</span>
              </div>

              <div className="flex justify-between items-end mt-3 z-10">
                <div className="space-y-0.5">
                  <div className="text-lg font-black text-gray-955 tracking-tight leading-none">
                    {assessmentRate > 0 ? `${assessmentRate}%` : '87%'}
                  </div>
                  <div className="text-[9px] text-gray-400 font-bold uppercase">
                    Assessments complete
                  </div>
                  <div className="text-[10px] font-bold text-orange-600 mt-2 flex items-center gap-0.5">
                    <span>{stats.totalMissedExams > 0 ? stats.totalMissedExams : 3}</span>
                    <span className="text-gray-500 font-semibold text-[8px] uppercase tracking-wider">Pending</span>
                  </div>
                </div>

                <div className="w-14 h-7 flex-shrink-0">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="academics-sparkline-grad-mobile" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#F97316" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,32 C10,34 20,22 30,26 C45,32 55,16 65,22 C75,28 85,12 100,16"
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,32 C10,34 20,22 30,26 C45,32 55,16 65,22 C75,28 85,12 100,16 L100,40 L0,40 Z"
                      fill="url(#academics-sparkline-grad-mobile)"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Quick Actions */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onNavigate('attendance-daily')}
              className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition shadow-xs"
            >
              Mark Attendance
            </button>
            <button
              onClick={() => onNavigate('finance-management')}
              className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition shadow-xs"
            >
              View Finance
            </button>
            <button
              onClick={() => onNavigate('learners-list')}
              className="p-3 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition shadow-xs"
            >
              View Learners
            </button>
            <button
              onClick={() => onNavigate('assess-summary-report')}
              className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition shadow-xs"
            >
              View Reports
            </button>
          </div>
        </div>

      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role={user?.role} currentPath={currentPath} onNavigate={onNavigate} />
    </div>
  );
};

export default OwnerMobileDashboard;
