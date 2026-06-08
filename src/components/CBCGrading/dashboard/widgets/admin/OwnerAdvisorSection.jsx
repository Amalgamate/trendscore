/**
 * OwnerAdvisorSection
 * Dashboard Sections › OwnerAdvisorSection
 *
 * "PERSONAL ADVISOR — RECOMMENDED ACTIONS" panel.
 * Placed directly below the executive summary cards on the General Overview tab.
 *
 * Currently driven by mock data. Wire `recommendations` prop (OwnerRecommendation[])
 * from a live insights API to replace the mock.
 *
 * Reusable across:
 *   - School Owner / Admin Dashboard   (AdminDashboard.jsx)
 *   - Head Teacher Dashboard           (HeadTeacherDashboard.jsx)
 *   - Accountant Dashboard             (AccountantDashboard.jsx)
 *   - Super Admin Dashboard
 */

import React from 'react';
import {
  AlertTriangle,
  DollarSign,
  BookOpen,
  Calendar,
  Sparkles,
} from 'lucide-react';
import OwnerRecommendationCard from './OwnerRecommendationCard';

// ─── Mock data (swap with API response when ready) ────────────────────────────
export const MOCK_OWNER_RECOMMENDATIONS = [
  {
    id: 'rec-attendance-drop',
    type: 'attendance',
    title: 'Grade 8 Attendance Dropped 8%',
    description: 'Recommended: Schedule parent communication.',
    actionLabel: 'View Students',
    actionRoute: 'learners-list',
    priority: 'high',
    icon: AlertTriangle,
    color: 'red',
  },
  {
    id: 'rec-fee-outstanding',
    type: 'finance',
    title: 'KES 420,000 Outstanding from 28 Families',
    description: 'Recommended: Send fee reminder.',
    actionLabel: 'Send Reminder',
    actionRoute: 'finance-fees',
    priority: 'high',
    icon: DollarSign,
    color: 'orange',
  },
  {
    id: 'rec-math-decline',
    type: 'academic',
    title: 'Mathematics Performance Declined in Grade 9',
    description: 'Recommended: Review subject analysis.',
    actionLabel: 'Open Analysis',
    actionRoute: 'academic-intelligence',
    priority: 'medium',
    icon: BookOpen,
    color: 'blue',
  },
  {
    id: 'rec-fee-deadline',
    type: 'finance',
    title: 'Fee Deadline in 4 Days for 62 Families',
    description: 'Recommended: Send payment reminders.',
    actionLabel: 'Send Reminder',
    actionRoute: 'finance-fees',
    priority: 'medium',
    icon: Calendar,
    color: 'green',
  },
];

// ─── Empty state ──────────────────────────────────────────────────────────────
const AdvisorEmpty = () => (
  <div className="col-span-full flex flex-col items-center justify-center py-10 text-center text-gray-400">
    <Sparkles size={28} className="mb-2 text-brand-purple/30" />
    <p className="text-sm font-semibold">No recommendations at this time.</p>
    <p className="text-xs mt-1">The advisor will surface actions as data is analysed.</p>
  </div>
);

// ─── Section heading ──────────────────────────────────────────────────────────
const AdvisorHeading = () => (
  <div className="flex items-center gap-2">
    <Sparkles size={14} className="text-brand-purple shrink-0" />
    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-purple">
      Personal Advisor
    </p>
    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
      — Recommended Actions
    </span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * OwnerAdvisorSection
 *
 * @param {Object}   props
 * @param {OwnerRecommendation[]} [props.recommendations] — defaults to mock data
 * @param {Function} [props.onNavigate]  — (route: string) => void
 * @param {boolean}  [props.loading]
 */
const OwnerAdvisorSection = ({
  recommendations = MOCK_OWNER_RECOMMENDATIONS,
  onNavigate,
  loading = false,
}) => {
  return (
    <section aria-label="Personal Advisor — Recommended Actions" className="space-y-3">
      {/* Section heading */}
      <AdvisorHeading />

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {recommendations.length === 0 ? (
          <AdvisorEmpty />
        ) : (
          recommendations.map((rec) => (
            <OwnerRecommendationCard
              key={rec.id}
              recommendation={rec}
              loading={loading}
              onAction={(route) => onNavigate?.(route)}
            />
          ))
        )}
      </div>
    </section>
  );
};

export default OwnerAdvisorSection;
