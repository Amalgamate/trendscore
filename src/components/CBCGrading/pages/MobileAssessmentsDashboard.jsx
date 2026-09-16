import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Users,
} from 'lucide-react';
import { dashboardAPI } from '../../../services/api';
import { getCurrentAcademicYear, getCurrentTerm } from '../utils/academicYear';
import { getLearnerGrade, getLearnerStream, groupLearners, uniqueCount } from './academic-intelligence/SimpleTablePage';
import StatCard from '../shared/StatsCard';
import SummaryReportPage from './reports/SummaryReportPage';

const MobileAssessmentsDashboard = ({ learners = [], onNavigate }) => {
  const [filters, setFilters] = useState({
    academicYear: getCurrentAcademicYear(),
    term: getCurrentTerm(),
  });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cardsHidden, setCardsHidden] = useState(false);

  const fallback = useMemo(() => {
    const learnerList = Array.isArray(learners) ? learners : [];
    const grades = groupLearners(learnerList, getLearnerGrade);
    const streams = uniqueCount(learnerList.map(getLearnerStream));
    return { learners: learnerList.length, grades: grades.length, streams };
  }, [learners]);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardAPI.getAssessmentOperations(filters);
      setDashboard(response?.data || null);
    } catch (err) {
      setError(err?.message || 'Failed to load assessment dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.academicYear, filters.term]);

  const summary = dashboard?.summary || {};
  const go = (page) => () => onNavigate?.(page);

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[var(--app-page-bg)] p-3 md:p-5">
      <div className="mx-auto max-w-[1500px] space-y-4">
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {!cardsHidden && (
          <section className="grid gap-3 grid-cols-2">
            <StatCard
              icon={Users}
              label="Learners in Scope"
              value={summary.learners ?? fallback.learners}
              helper={`${fallback.grades} grades · ${fallback.streams} streams`}
              accent="bg-blue-700"
            />
            <StatCard
              icon={BookOpen}
              label="Tests Configured"
              value={summary.tests ?? 0}
              helper={`${summary.subjects ?? 0} learning areas`}
              accent="bg-teal-700"
              onClick={go('assess-summative-tests')}
              className="cursor-pointer"
            />
          </section>
        )}

        {loading && (
          <div className="rounded-lg border border-slate-100 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">Loading live assessment metrics...</div>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
          <SummaryReportPage
            pageParams={{
              term: filters.term,
              academicYear: filters.academicYear,
            }}
            cardsHidden={cardsHidden}
            onToggleCards={() => setCardsHidden((hidden) => !hidden)}
          />
        </section>

      </div>
    </div>
  );
};

export default MobileAssessmentsDashboard;
