import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileText, Loader2, X } from 'lucide-react';
import { reportAPI } from '../../../../services/api';
import TermlyReportTemplate from '../../templates/TermlyReportTemplate';
import {
  TERM_ORDER,
  scoreColor,
  termLabel,
  useLearnerResults,
} from '../results/useLearnerResults';
import {
  ResultsEmptyState,
  ResultsErrorState,
  ResultsLoadingState,
  TermAccordion,
} from '../results/ResultsShared';

const academicYears = () => {
  const current = new Date().getFullYear();
  // Keep the complete school-age history reachable from one stable selector.
  return Array.from({ length: 14 }, (_, index) => String(current - index));
};

const unwrapData = (response) => response?.data?.data || response?.data || null;

export const buildAssessmentCards = (report) => {
  const rows = Array.isArray(report?.results) ? report.results : [];
  return rows.map((row) => ({
    id: row.testId || row.id,
    title: row.test?.title || 'Assessment',
    learningArea: row.test?.learningAreaRef?.name || row.test?.learningArea || 'Learning Area',
    testDate: row.test?.testDate || null,
    marksObtained: row.marksObtained,
    totalMarks: row.test?.totalMarks,
    percentage: row.percentage,
    grade: row.cbcGrade || row.grade || row.remarks || null,
    comment: row.teacherComment || null,
    statusCode: row.assessmentStatusCode || null,
  }));
};

export const calculateYearAverage = (terms = []) => {
  const scores = terms.map((term) => Number(term.avg)).filter(Number.isFinite);
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
};

function ReportModal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${wide ? 'max-w-[900px]' : 'max-w-2xl'} overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#3B1FA3]">Report card</p>
            <h3 className="text-sm font-black text-gray-900">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Close report card">
            <X size={18} />
          </button>
        </div>
        <div className={wide ? 'overflow-x-auto bg-gray-100 py-4' : 'p-4'}>{children}</div>
      </div>
    </div>
  );
}

function AssessmentCardPreview({ learner, assessment, year, term }) {
  const percentage = assessment.percentage == null ? null : Math.round(Number(assessment.percentage));
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="bg-[#3B1FA3] px-5 py-5 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Individual assessment report</p>
        <h4 className="mt-1 text-xl font-black">{assessment.title}</h4>
        <p className="mt-1 text-xs text-white/75">{termLabel(term)} · {year}</p>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-xs">
          <div><p className="text-[9px] font-bold uppercase text-gray-400">Learner</p><p className="font-black text-gray-900">{learner.name}</p></div>
          <div><p className="text-[9px] font-bold uppercase text-gray-400">Learning area</p><p className="font-black text-gray-900">{assessment.learningArea}</p></div>
          <div><p className="text-[9px] font-bold uppercase text-gray-400">Assessment date</p><p className="font-black text-gray-900">{assessment.testDate ? new Date(assessment.testDate).toLocaleDateString('en-GB') : 'Not recorded'}</p></div>
          <div><p className="text-[9px] font-bold uppercase text-gray-400">Grade</p><p className="font-black text-gray-900">{learner.grade || '—'}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-gray-200 p-3"><p className="text-[9px] font-bold uppercase text-gray-400">Score</p><p className="text-xl font-black text-gray-900">{assessment.statusCode || `${assessment.marksObtained ?? '—'}/${assessment.totalMarks ?? '—'}`}</p></div>
          <div className="rounded-xl border border-gray-200 p-3"><p className="text-[9px] font-bold uppercase text-gray-400">Percentage</p><p className={`text-xl font-black ${scoreColor(percentage)}`}>{percentage == null ? '—' : `${percentage}%`}</p></div>
          <div className="rounded-xl border border-gray-200 p-3"><p className="text-[9px] font-bold uppercase text-gray-400">Achievement</p><p className="text-xl font-black text-[#3B1FA3]">{assessment.grade || '—'}</p></div>
        </div>
        {assessment.comment && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-[9px] font-bold uppercase text-blue-500">Teacher comment</p><p className="mt-1 text-sm text-blue-950">{assessment.comment}</p></div>}
      </div>
    </div>
  );
}

export default function ParentReportCards({ learner }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { loading, error, summary } = useLearnerResults(learner.id, year);
  const [assessmentReports, setAssessmentReports] = useState({});
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [termReport, setTermReport] = useState(null);
  const [termReportLoading, setTermReportLoading] = useState(false);
  const [termReportError, setTermReportError] = useState('');

  useEffect(() => {
    let active = true;
    setAssessmentLoading(true);
    Promise.all(TERM_ORDER.map(async (term) => {
      try {
        const response = await reportAPI.getSummativeReport(learner.id, { term, academicYear: year });
        return [term, unwrapData(response)];
      } catch {
        return [term, null];
      }
    })).then((entries) => {
      if (active) setAssessmentReports(Object.fromEntries(entries));
    }).finally(() => {
      if (active) setAssessmentLoading(false);
    });
    return () => { active = false; };
  }, [learner.id, year]);

  const yearAverage = useMemo(() => calculateYearAverage(summary.terms), [summary.terms]);

  const openTermReport = useCallback(async (term) => {
    setTermReportLoading(true);
    setTermReportError('');
    try {
      const response = await reportAPI.getTermlyReport(learner.id, { term, academicYear: year });
      const data = unwrapData(response);
      if (!data) throw new Error('Report card data is unavailable');
      setTermReport({ term, data });
    } catch (requestError) {
      setTermReportError(requestError?.message || 'Could not load the term report card');
    } finally {
      setTermReportLoading(false);
    }
  }, [learner.id, year]);

  if (loading) return <ResultsLoadingState />;
  if (error) return <ResultsErrorState message={error} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#3B1FA3]">Academic history</p>
          <h3 className="text-base font-black text-gray-900">Assessment report cards</h3>
          <p className="text-xs text-gray-500">Individual assessments, complete terms and historical years.</p>
        </div>
        <label className="text-[10px] font-bold uppercase text-gray-500">
          Academic year
          <select value={year} onChange={(event) => setYear(event.target.value)} className="ml-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800">
            {academicYears().map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      {summary.hasData ? (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-gradient-to-br from-[#3B1FA3] to-indigo-600 p-4 text-white">
            <div><p className="text-[9px] font-bold uppercase tracking-wider text-white/65">Whole year</p><p className="text-3xl font-black">{yearAverage ?? '—'}%</p><p className="text-[10px] text-white/70">Average across recorded terms</p></div>
            <div className="text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-white/65">Coverage</p><p className="text-3xl font-black">{summary.terms.length}/3</p><p className="text-[10px] text-white/70">Terms with published results</p></div>
          </div>

          {[...summary.terms].reverse().map((term, index) => {
            const assessments = buildAssessmentCards(assessmentReports[term.term]);
            return (
              <section key={term.term} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
                <TermAccordion term={term} defaultOpen={index === 0} highlight={index === 0} />
                <button type="button" onClick={() => openTermReport(term.term)} disabled={termReportLoading} className="flex w-full items-center justify-between rounded-xl bg-[#3B1FA3] px-4 py-3 text-left text-white disabled:opacity-60">
                  <span className="flex items-center gap-2"><FileText size={16} /><span><span className="block text-xs font-black">View complete {termLabel(term.term)} report card</span><span className="block text-[9px] text-white/70">Official performance, competencies, values and comments</span></span></span>
                  {termReportLoading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                </button>
                <div className="pt-1">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Individual assessments</p>
                  {assessmentLoading ? <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[#3B1FA3]" /></div> : assessments.length ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {assessments.map((assessment) => (
                        <button key={assessment.id} type="button" onClick={() => setSelectedAssessment({ assessment, term: term.term })} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 text-left hover:border-[#3B1FA3]/40 hover:bg-purple-50/30">
                          <span className="min-w-0"><span className="block truncate text-xs font-black text-gray-900">{assessment.title}</span><span className="block truncate text-[10px] text-gray-500">{assessment.learningArea}{assessment.testDate ? ` · ${new Date(assessment.testDate).toLocaleDateString('en-GB')}` : ''}</span></span>
                          <span className="ml-3 flex-shrink-0 text-right"><span className={`block text-sm font-black ${scoreColor(assessment.percentage)}`}>{assessment.statusCode || `${Math.round(Number(assessment.percentage || 0))}%`}</span><span className="block text-[9px] font-bold text-[#3B1FA3]">{assessment.grade || 'View'}</span></span>
                        </button>
                      ))}
                    </div>
                  ) : <p className="rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-400">No individual assessments published for this term.</p>}
                </div>
              </section>
            );
          })}
        </>
      ) : <ResultsEmptyState year={year} />}

      {termReportError && <ResultsErrorState message={termReportError} />}

      {selectedAssessment && (
        <ReportModal title={selectedAssessment.assessment.title} onClose={() => setSelectedAssessment(null)}>
          <AssessmentCardPreview learner={learner} assessment={selectedAssessment.assessment} year={year} term={selectedAssessment.term} />
        </ReportModal>
      )}
      {termReport && (
        <ReportModal title={`${termLabel(termReport.term)} ${year} official report`} onClose={() => setTermReport(null)} wide>
          <TermlyReportTemplate reportData={termReport.data} id={`parent-termly-report-${year}-${termReport.term}`} />
        </ReportModal>
      )}
    </div>
  );
}
