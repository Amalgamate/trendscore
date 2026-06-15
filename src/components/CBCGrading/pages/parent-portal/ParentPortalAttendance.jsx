/**
 * Parent Portal Attendance Screen
 * View child's attendance details
 */

import React from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';

const ParentPortalAttendance = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => onNavigate('parent-portal-home')}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
            <p className="text-xs text-gray-500">Attendance record</p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <Calendar size={20} />
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-900 mb-1">Attendance Details Coming Soon</h3>
          <p className="text-sm text-gray-500">Calendar view and attendance details will be available soon</p>
        </div>
      </div>
    </div>
  );
};

export default ParentPortalAttendance;
