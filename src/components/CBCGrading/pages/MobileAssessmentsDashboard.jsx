import React, { useMemo } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle,
  ClipboardList,
  FileText,
  Heart,
  PenLine,
  Settings,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { getCurrentAcademicYear, getCurrentTerm } from '../utils/academicYear';
import { getLearnerGrade, getLearnerStream, groupLearners, normalizeGender, uniqueCount } from './academic-intelligence/SimpleTablePage';

const TERM_LABELS = {
  TERM_1: 'Term 1',
  TERM_2: 'Term 2',
  TERM_3: 'Term 3',
};

const getTermLabel = (term) => TERM_LABELS[term] || String(term || '').replace(/_/g, ' ') || 'Current Term';

const Sparkline = ({ color = '#6d5dfc', values = [5, 8, 7, 12, 10, 16, 18] }) => {
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 36 - (value / max) * 28;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 42" className="h-10 w-24" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const StatCard = ({ icon: Icon, label, value, helper, color, bg, values }) => (
  <div className="flex min-h-[100px] items-center gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ color, backgroundColor: bg }}>
      <Icon size={24} strokeWidth={2.4} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none text-slate-950">{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</p>
    </div>
    <Sparkline color={color} values={values} />
  </div>
);

const ActionTile = ({ icon: Icon, label, helper, tone, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-[96px] items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon size={22} strokeWidth={2.4} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-black text-slate-950">{label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
    </div>
    <ArrowRight size={18} className="text-slate-300 transition group-hover:text-violet-600" />
  </button>
);

const SectionHeader = ({ title, helper, action }) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="text-base font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
    </div>
    {action}
  </div>
);

const Donut = ({ complete, pending }) => {
  const total = complete + pending;
  const completePercent = total ? Math.round((complete / total) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#6d4dfc 0 ${completePercent}%, #f97316 ${completePercent}% 100%)` }}
      >
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="text-2xl font-black text-slate-950">{completePercent}%</span>
          <span className="text-xs font-semibold text-slate-500">Ready</span>
        </div>
      </div>
      <div className="min-w-[160px] space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-bold text-slate-700"><i className="h-3 w-3 rounded-full bg-[#6d4dfc]" /> Prepared</span>
          <span className="font-black text-slate-900">{complete}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-bold text-slate-700"><i className="h-3 w-3 rounded-full bg-[#f97316]" /> Pending</span>
          <span className="font-black text-slate-900">{pending}</span>
        </div>
      </div>
    </div>
  );
};

const TrendChart = ({ total }) => {
  const points = [0.25, 0.4, 0.55, 0.62, 0.78, 1].map((factor) => Math.max(0, Math.round(total * factor)));
  const max = Math.max(...points, 1);
  const svgPoints = points.map((value, index) => {
    const x = 42 + index * 92;
    const y = 210 - (value / max) * 150;
    return { x, y, value };
  });
  const line = svgPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const fill = `42,210 ${line} ${svgPoints[svgPoints.length - 1].x},210`;

  return (
    <svg viewBox="0 0 560 240" className="h-[250px] w-full" aria-label="Assessment readiness trend">
      {[0, 1, 2, 3].map((lineIndex) => (
        <line key={lineIndex} x1="42" x2="520" y1={60 + lineIndex * 45} y2={60 + lineIndex * 45} stroke="#e5e7eb" strokeDasharray="4 5" />
      ))}
      <polygon points={fill} fill="url(#assessmentTrendFill)" />
      <polyline points={line} fill="none" stroke="#6d4dfc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {svgPoints.map((point, index) => (
        <g key={index}>
          <circle cx={point.x} cy={point.y} r="6" fill="#fff" stroke="#6d4dfc" strokeWidth="4" />
          <text x={point.x} y={point.y - 14} textAnchor="middle" className="fill-slate-800 text-[12px] font-bold">{point.value}</text>
          <text x={point.x} y="228" textAnchor="middle" className="fill-slate-500 text-[12px] font-bold">Step {index + 1}</text>
        </g>
      ))}
      <defs>
        <linearGradient id="assessmentTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const MobileAssessmentsDashboard = ({ learners = [], onNavigate }) => {
  const overview = useMemo(() => {
    const learnerList = Array.isArray(learners) ? learners : [];
    const grades = groupLearners(learnerList, getLearnerGrade);
    const streams = uniqueCount(learnerList.map(getLearnerStream));
    const boys = learnerList.filter((learner) => normalizeGender(learner.gender) === 'Boys').length;
    const girls = learnerList.filter((learner) => normalizeGender(learner.gender) === 'Girls').length;
    const configuredAreas = grades.length;
    const pendingAreas = Math.max(0, 4 - configuredAreas);
    const currentTerm = getCurrentTerm();

    return {
      learners: learnerList.length,
      grades: grades.length,
      streams,
      boys,
      girls,
      configuredAreas,
      pendingAreas,
      academicYear: getCurrentAcademicYear(),
      term: getTermLabel(currentTerm),
      activeGrade: grades[0]?.label || 'No grade selected',
    };
  }, [learners]);

  const go = (page) => () => onNavigate?.(page);

  return (
    <div className="min-h-[calc(100vh-96px)] bg-slate-50 p-3 md:p-5">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-950">
              <span>Assessment</span>
              <span className="font-black">•</span>
              <span className="font-black uppercase tracking-[0.12em] text-indigo-800">Assessment Overview</span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">Prepare tests, record marks, monitor assessment readiness and open reports from one place.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={go('assess-summative-tests')} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:border-violet-300 hover:text-violet-700">
              <Settings size={16} />
              Configure Tests
            </button>
            <button type="button" onClick={go('assess-summative-assessment')} className="inline-flex h-10 items-center gap-2 rounded-md bg-violet-600 px-4 text-xs font-black text-white shadow-sm hover:bg-violet-700">
              <PenLine size={16} />
              Record Marks
            </button>
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex min-w-max items-center justify-center gap-4">
            <label className="flex h-11 items-center border border-slate-300 bg-white px-4">
              <select aria-label="Academic year" className="min-w-[126px] bg-transparent text-sm font-semibold text-slate-950 outline-none" defaultValue={overview.academicYear}>
                <option value={overview.academicYear}>{overview.academicYear}</option>
              </select>
            </label>
            <label className="flex h-11 items-center border border-slate-300 bg-white px-4">
              <select aria-label="Term" className="min-w-[126px] bg-transparent text-sm font-semibold text-slate-950 outline-none" defaultValue={overview.term}>
                <option value={overview.term}>{overview.term}</option>
              </select>
            </label>
            <label className="flex h-11 items-center border border-slate-300 bg-white px-4">
              <select aria-label="Section" className="min-w-[126px] bg-transparent text-sm font-semibold text-slate-950 outline-none" defaultValue="all">
                <option value="all">All Sections</option>
                <option value="pre-primary">Pre Primary</option>
                <option value="lower">Lower Primary</option>
                <option value="upper">Upper Primary</option>
                <option value="junior-sec">Junior Sec</option>
              </select>
            </label>
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-md border border-violet-300 bg-white px-4 text-sm font-black text-violet-700">
              <Target size={16} />
              Filters
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Learners Ready" value={overview.learners} helper={`${overview.grades} grades - ${overview.streams} streams`} color="#7c3aed" bg="#f1e9ff" values={[6, 8, 10, 13, 12, 17, 20]} />
          <StatCard icon={BookOpen} label="Grade Coverage" value={overview.grades} helper={overview.activeGrade} color="#3678f5" bg="#e8f0ff" values={[1, 2, 2, 3, 4, 4, 5]} />
          <StatCard icon={ClipboardList} label="Assessment Setup" value={overview.configuredAreas} helper={`${overview.pendingAreas} pending setup areas`} color="#16a34a" bg="#e7f8ee" values={[1, 1, 2, 2, 3, 3, 4]} />
          <StatCard icon={FileText} label="Reports" value="0" helper="No scored reports yet" color="#f97316" bg="#fff1e7" values={[0, 0, 0, 1, 1, 1, 2]} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.35fr_1fr]">
          <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
            <SectionHeader title="Assessment Readiness" helper="Setup completion across the selected period." />
            <Donut complete={overview.configuredAreas} pending={overview.pendingAreas} />
            <button type="button" onClick={go('assess-summative-tests')} className="mt-5 flex w-full items-center justify-between rounded-lg bg-violet-50 px-4 py-3 text-xs font-black text-violet-700">
              <span>Continue test configuration</span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
            <SectionHeader
              title="Assessment Timeline"
              helper={`${overview.term} - ${overview.academicYear}`}
              action={(
                <select aria-label="Timeline interval" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none">
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
              )}
            />
            <TrendChart total={overview.learners} />
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
              <TrendingUp size={18} className="text-violet-600" />
              <span className="font-black text-emerald-600">Ready</span>
              <span>Assessment workspace is available for setup and scoring.</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
            <SectionHeader title="Assessment Performance" helper="Current scoring overview." />
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="relative mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <ClipboardList size={52} strokeWidth={1.8} />
                <div className="absolute bottom-5 right-4 rounded-full bg-white p-1 text-indigo-600 shadow-sm">
                  <BarChart3 size={26} />
                </div>
              </div>
              <p className="text-base font-black text-slate-950">No scored results</p>
              <p className="mt-1 max-w-[230px] text-xs font-semibold text-slate-500">Open Record Marks when test setup is ready.</p>
              <button type="button" onClick={go('assess-summative-assessment')} className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-violet-600 px-4 text-xs font-black text-white hover:bg-violet-700">
                Record Marks
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ActionTile icon={Target} label="Summative Tests" helper="Create and deploy exams or tests." tone="bg-violet-50 text-violet-700" onClick={go('assess-summative-tests')} />
          <ActionTile icon={PenLine} label="Record Marks" helper="Enter learner scores by class and subject." tone="bg-blue-50 text-blue-700" onClick={go('assess-summative-assessment')} />
          <ActionTile icon={CheckCircle} label="Formative" helper="Track continuous classroom assessment." tone="bg-emerald-50 text-emerald-700" onClick={go('assess-formative')} />
          <ActionTile icon={FileText} label="Reports" helper="Open summary and learner reports." tone="bg-orange-50 text-orange-700" onClick={go('assess-summary-report')} />
          <ActionTile icon={Star} label="Core Competencies" helper="Assess CBC competency development." tone="bg-yellow-50 text-yellow-700" onClick={go('assess-core-competencies')} />
          <ActionTile icon={Heart} label="Values" helper="Review national values and conduct signals." tone="bg-rose-50 text-rose-700" onClick={go('assess-values')} />
          <ActionTile icon={ShieldCheck} label="Performance Scales" helper="Manage grading rubrics and levels." tone="bg-teal-50 text-teal-700" onClick={go('assess-performance-scale')} />
          <ActionTile icon={Settings} label="Learning Areas" helper="Manage subjects and learning areas." tone="bg-slate-100 text-slate-700" onClick={go('assess-learning-areas')} />
        </section>
      </div>
    </div>
  );
};

export default MobileAssessmentsDashboard;
