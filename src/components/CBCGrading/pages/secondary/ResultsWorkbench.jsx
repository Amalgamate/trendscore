import React, { useMemo } from 'react';
import { ArrowRight, BarChart3, FileText, Grid, LineChart, Users } from 'lucide-react';

const contentByVariant = {
  mean: {
    title: 'Mean Grades Workbench',
    description: 'Use the existing assessment analytics screens to compute and review grade averages by class and learning area.',
    icon: BarChart3,
  },
  rankings: {
    title: 'Class Rankings Workbench',
    description: 'Generate ranked views from summative and termly reports, then review learner positioning by class.',
    icon: Users,
  },
  subject: {
    title: 'Subject Analysis Workbench',
    description: 'Inspect learning area performance trends and compare outcomes using matrix and detailed reports.',
    icon: Grid,
  },
  forecast: {
    title: 'Performance Forecast Workbench',
    description: 'Use assessment trend outputs to project learner and class outcomes from accumulated records.',
    icon: LineChart,
  },
};

const ActionCard = ({ icon: Icon, title, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left rounded-2xl border bg-white p-4 shadow-sm hover:bg-gray-50 transition"
  >
    <div className="flex items-start gap-3">
      <div className="rounded-xl border bg-indigo-50 border-indigo-200 p-2 text-indigo-800">
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="mt-1 text-xs font-medium text-gray-600">{description}</div>
      </div>
      <ArrowRight className="text-gray-400" size={18} />
    </div>
  </button>
);

const ResultsWorkbench = ({ variant = 'mean', pageParams = {}, onNavigate }) => {
  const cfg = contentByVariant[variant] || contentByVariant.mean;
  const HeaderIcon = cfg.icon;
  const contextSummary = useMemo(() => {
    const parts = [];
    if (pageParams?.term) parts.push(String(pageParams.term).replace('_', ' '));
    if (pageParams?.academicYear) parts.push(String(pageParams.academicYear));
    if (pageParams?.stream) parts.push(`Stream ${pageParams.stream}`);
    if (pageParams?.learningArea) parts.push(pageParams.learningArea);
    return parts.join(' • ');
  }, [pageParams]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <HeaderIcon className="text-indigo-700" size={22} />
          <h1 className="text-2xl font-semibold text-gray-900">{cfg.title}</h1>
        </div>
        <p className="mt-1 text-sm font-medium text-gray-600">{cfg.description}</p>
        {contextSummary ? (
          <div className="mt-2 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-700">
            Context: {contextSummary}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          icon={Grid}
          title="Assessment Matrix"
          description="Open the matrix report to compare performance distribution."
          onClick={() => onNavigate?.('assess-summary-report', pageParams)}
        />
        <ActionCard
          icon={FileText}
          title="Detailed Summative Reports"
          description="Review detailed learner and class performance outputs."
          onClick={() => onNavigate?.('assess-summative-report', pageParams)}
        />
        <ActionCard
          icon={BarChart3}
          title="Summative Assessment Analytics"
          description="Open summative workflows and analytics views."
          onClick={() => onNavigate?.('assess-summative-assessment', pageParams)}
        />
        <ActionCard
          icon={LineChart}
          title="Termly Report"
          description="Generate termly outputs and use them for trend interpretation."
          onClick={() => onNavigate?.('assess-termly-report', pageParams)}
        />
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-indigo-700">Tip</div>
        <div className="mt-1 text-sm font-medium text-indigo-900/90">
          Use filters for Grade 10–12 and Secondary institution scope to keep results isolated to Senior School.
        </div>
      </div>
    </div>
  );
};

export default ResultsWorkbench;
