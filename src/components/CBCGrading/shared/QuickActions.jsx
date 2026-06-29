import React from 'react';
import {
  Activity,
  CircleDollarSign,
  GraduationCap,
  Clock,
  Calendar,
  Bookmark,
  Users,
  Home,
} from 'lucide-react';
import { useModuleAccess } from '../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../utils/appAccess';

const QuickActions = ({ onNavigate, currentPage, user }) => {
  const { activeSlugs } = useModuleAccess();
  const accessUser = { ...(user || {}), enabledApps: activeSlugs };
  const actions = [
    { label: 'Annual Planner', icon: Activity, path: 'annual-planner', bg: 'bg-[#1d4ed8]', activeBg: 'bg-blue-50 text-blue-800 border-blue-200' },
    { label: 'Financials', icon: CircleDollarSign, path: 'fees-overview', bg: 'bg-[#10b981]', activeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { label: 'Approvals', icon: GraduationCap, path: 'settings-approvals', bg: 'bg-[#6366f1]', activeBg: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { label: 'Leave Management', icon: Clock, path: 'hr-leave', bg: 'bg-[#f59e0b]', activeBg: 'bg-amber-50 text-amber-700 border-amber-100' },
    { label: 'Time Table', icon: Calendar, path: 'timetable', bg: 'bg-[#8b5cf6]', activeBg: 'bg-purple-50 text-purple-700 border-purple-100' },
    { label: 'Pledge Management', icon: Bookmark, path: 'fees-invoices', bg: 'bg-[#e05f00]', activeBg: 'bg-orange-50 text-orange-700 border-orange-100' },
    { label: 'User Management', icon: Users, path: 'settings-users', bg: 'bg-[#0f766e]', activeBg: 'bg-teal-50 text-teal-700 border-teal-100' },
  ].filter((action) => hasPageAccess(accessUser, action.path));

  return (
    <div className="hidden md:block bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-start lg:justify-center py-2.5 px-4 md:px-6 overflow-x-auto scrollbar-none">

        {/* Home Button */}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('dashboard')}
          title="Home — Dashboard"
          className={`group flex h-9 w-9 shrink-0 items-center justify-center rounded-xl active:scale-95 transition-all duration-200 mr-1 ${
            currentPage === 'dashboard' || !currentPage
              ? 'text-blue-700 bg-blue-50/80 border border-blue-100/50 shadow-sm'
              : 'text-blue-600 hover:bg-blue-50'
          }`}
        >
          <Home size={18} className="group-hover:scale-110 transition-transform" />
        </button>

        {/* Divider after Home */}
        <span className="h-6 w-px bg-slate-200 mx-3 shrink-0" />

        {/* Module shortcuts with dividers */}
        {actions.map((a, idx) => {
          const Icon = a.icon;
          const isActive = currentPage === a.path;
          return (
            <React.Fragment key={a.label}>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate(a.path)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border active:scale-95 transition-all duration-200 shrink-0 ${
                  isActive
                    ? `${a.activeBg} font-semibold shadow-sm`
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-100'
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.bg} text-white shadow-sm transition-transform duration-300 group-hover:scale-105`}>
                  <Icon size={15} className="text-white" />
                </div>
                <span className="text-xs font-semibold tracking-wide">{a.label}</span>
              </button>
              {/* Divider between items (not after the last one) */}
              {idx < actions.length - 1 && (
                <span className="h-5 w-px bg-slate-150 mx-0.5 shrink-0" style={{ backgroundColor: '#e8ecf0' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;
