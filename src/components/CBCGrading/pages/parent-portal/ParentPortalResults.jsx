/**
 * Parent Portal Results Screen
 * View child's academic results and assessment details
 */

import React from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';

const ParentPortalResults = ({ onNavigate }) => {
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
            <h1 className="text-xl font-bold text-gray-900">Results</h1>
            <p className="text-xs text-gray-500">Academic performance</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <TrendingUp size={40} className="mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-900 mb-1">Results Coming Soon</h3>
          <p className="text-sm text-gray-500">Detailed results view will be available soon</p>
        </div>
      </div>
    </div>
  );
};

export default ParentPortalResults;
