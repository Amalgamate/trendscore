/**
 * Parent Portal Children Screen
 * Display all children as cards with key stats
 * Tap to switch child context across portal
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Users, TrendingUp, CreditCard, Calendar,
  Plus, Phone, Mail, MessageSquare
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';

// ─── Helper Components ──────────────────────────────────────────────

function ChildCard({ child, onSelectChild, isSelected }) {
  const stats = [
    {
      label: 'Attendance',
      value: `${Number(child.attendanceRate || 0)}%`,
      icon: Calendar,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Fee Balance',
      value: `KES ${Number(child.feeBalance || 0).toLocaleString()}`,
      icon: CreditCard,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Avg Score',
      value: `${Math.round(child.averageScore || 0)}%`,
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-50',
    },
  ];

  return (
    <div
      onClick={() => onSelectChild(child.id)}
      className={`bg-white rounded-2xl border-2 overflow-hidden transition-all cursor-pointer ${
        isSelected
          ? 'border-brand-purple shadow-lg'
          : 'border-gray-200 hover:shadow-md'
      }`}
    >
      {/* Header with gradient */}
      <div className="h-24 bg-gradient-to-r from-brand-purple/20 to-purple-100 relative overflow-hidden">
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-2 right-2 w-16 h-16 bg-white/30 rounded-full" />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 relative -mt-8">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-xl bg-white border-2 border-white shadow-md flex items-center justify-center text-brand-purple font-bold text-lg mb-3">
          {child.name?.[0] || '?'}
        </div>

        {/* Child Info */}
        <h3 className="text-lg font-bold text-gray-900">{child.name}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{child.grade} • {child.className || 'Class'}</p>

        {child.admissionNumber && (
          <p className="text-xs text-gray-400 mt-1">Adm #{child.admissionNumber}</p>
        )}

        {/* Class Teacher */}
        {child.classTeacher && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Class Teacher</p>
            <p className="text-sm font-semibold text-gray-900">{child.classTeacher}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className={`${stat.color} rounded-lg p-2 text-center`}>
                <Icon size={14} className="mx-auto mb-1" />
                <p className="text-[10px] font-semibold line-clamp-1">{stat.value}</p>
                <p className="text-[9px] opacity-70 line-clamp-1">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className="mt-3 px-3 py-1.5 bg-brand-purple/10 text-brand-purple text-xs font-semibold rounded-lg text-center">
            ✓ Currently Selected
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentPortalChildren = ({ user, onNavigate }) => {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChildren = async () => {
      try {
        const response = await dashboardAPI.getParentMetrics?.() || { success: true, data: {} };
        if (response.success) {
          const childrenList = response.data?.children || [];
          setChildren(childrenList);
          if (childrenList.length > 0 && !selectedChildId) {
            setSelectedChildId(childrenList[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load children:', error);
      } finally {
        setLoading(false);
      }
    };
    loadChildren();
  }, []);

  const handleSelectChild = (childId) => {
    setSelectedChildId(childId);
  };

  const handleViewChild = (childId) => {
    // Navigate to child detail view if available
    // For now, this could be integrated with the overall portal navigation
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => onNavigate('parent-portal-home')}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">My Children</h1>
            <p className="text-xs text-gray-500">{children.length} child{children.length !== 1 ? 'ren' : ''} linked</p>
          </div>
          <div className="p-2 rounded-lg bg-brand-purple/10 text-brand-purple">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : children.length > 0 ? (
          <>
            {children.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                onSelectChild={handleSelectChild}
                isSelected={selectedChildId === child.id}
              />
            ))}

            {/* Info Section */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <h3 className="font-semibold text-blue-900 mb-2">📚 About This View</h3>
              <p className="text-sm text-blue-800">
                Select a child to view their profile in detail. Each card shows key metrics:
                attendance rate, outstanding fees, and average academic score.
              </p>
            </div>

            {/* Contact School Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Contact</h3>
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                  <Phone size={18} className="text-emerald-600" />
                  <div className="text-left text-sm">
                    <p className="font-semibold text-gray-900">Call School</p>
                    <p className="text-xs text-gray-500">+254 712 345 678</p>
                  </div>
                </button>
                <button className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                  <MessageSquare size={18} className="text-blue-600" />
                  <div className="text-left text-sm">
                    <p className="font-semibold text-gray-900">Message</p>
                    <p className="text-xs text-gray-500">Contact now</p>
                  </div>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Users size={40} className="mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold text-gray-900 mb-1">No Children Linked</h3>
            <p className="text-sm text-gray-500 mb-4">
              Contact your school to link children to your parent account
            </p>
            <button className="px-4 py-2 bg-brand-purple text-white rounded-lg font-semibold text-sm hover:bg-purple-700 transition">
              Contact Support
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentPortalChildren;
