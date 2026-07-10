import React from 'react';
import { ArrowRight, ClipboardList, FileText, Users } from 'lucide-react';

const reportOptions = [
  {
    id: 'official-report-card',
    title: 'Official Report Card',
    badge: 'Parent-facing',
    description: 'Detailed termly report with summative, formative, attendance, comments, values, competencies and co-curricular records.',
    icon: FileText,
    actionLabel: 'Open report cards',
    page: 'assess-termly-report',
  },
  {
    id: 'summative-learner-sheet',
    title: 'Summative Learner Sheet',
    badge: 'Compact sheet',
    description: 'Focused test performance sheet for one or many learners, with grade, stream, test group, SMS, WhatsApp and combined PDF tools.',
    icon: ClipboardList,
    actionLabel: 'Open learner sheets',
    page: 'assess-summative-report',
    params: { reportType: 'LEARNER_REPORT' },
  },
];

const LearnerReportsPage = ({ onNavigate, pageParams = {} }) => {
  const openReport = (option) => {
    onNavigate?.(option.page, {
      ...pageParams,
      ...(option.params || {}),
    });
  };

  return (
    <div className="min-h-full bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
                <Users size={23} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Academic Reports</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Learner Reports</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                  Choose the report output first, then continue with the existing generation flow. Report cards are the official parent-facing record; learner sheets are compact summative outputs.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {reportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => openReport(option)}
                className="group min-h-[220px] rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700">
                    <Icon size={23} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {option.badge}
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-xl font-black text-slate-950 group-hover:text-blue-700">{option.title}</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{option.description}</p>
                </div>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-blue-700">
                  {option.actionLabel}
                  <ArrowRight size={17} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LearnerReportsPage;
