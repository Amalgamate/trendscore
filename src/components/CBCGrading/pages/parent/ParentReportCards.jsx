/**
 * ParentReportCards — Scoresheet table view
 *
 * Layout: cross-term scoresheet table (Option A)
 *   Rows    = subjects (union across all recorded terms)
 *   Columns = Term 1 · Term 2 · Term 3 · Year Avg
 *   Cell    = CBC grade badge + percentage
 *
 * One "View Official Report Card" button per term opens the full
 * TermlyReportTemplate with Download PDF / Print. No other redundancy.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Printer, TrendingDown, TrendingUp, X } from 'lucide-react';
import { reportAPI } from '../../../../services/api';
import { captureSingleReport, printWindow } from '../../../../utils/simplePdfGenerator';
import TermlyReportTemplate from '../../templates/TermlyReportTemplate';
import {
  TERM_ORDER,
  cbcBandMeta,
  scoreColor,
  termLabel,
  useLearnerResults,
} from '../results/useLearnerResults';

// ─── Constants ────────────────────────────────────────────────────────────────

const academicYears = () => {
  const current = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => String(current - i));
};

const unwrapData = (r) => r?.data?.data || r?.data || null;

function waitForElement(id, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const el = document.getElementById(id);
      if (el) return resolve(el);
      if (Date.now() - started > timeoutMs) return reject(new Error('Report card is not ready to download'));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// ─── Grade badge ──────────────────────────────────────────────────────────────

function GradeBadge({ grade, size = 'md' }) {
  if (!grade) return <span className="text-gray-300 font-bold">—</span>;
  const meta = cbcBandMeta(grade.replace(/\d/g, '').trim()) || cbcBandMeta(grade.slice(0, 2));
  if (!meta) return <span className="text-xs font-bold text-gray-600">{grade}</span>;
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className={`inline-flex items-center rounded-full font-black tracking-wide ${px} ${meta.cls}`}>
      {grade}
    </span>
  );
}

// ─── Trend indicator ──────────────────────────────────────────────────────────

function TrendBadge({ trend }) {
  if (trend == null) return null;
  if (trend > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
      <TrendingUp size={11} />+{trend}
    </span>
  );
  if (trend < 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-500">
      <TrendingDown size={11} />{trend}
    </span>
  );
  return <span className="text-[10px] font-bold text-gray-400">→</span>;
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

function ScoreCell({ subject, term, subjectData }) {
  if (!subjectData) {
    return (
      <td className="px-3 py-3 text-center border-b border-gray-100">
        <span className="text-gray-200 font-bold text-sm">—</span>
      </td>
    );
  }

  const pct = subjectData.percentage;
  const grade = subjectData.cbcGrade;

  return (
    <td className="px-3 py-3 text-center border-b border-gray-100 group">
      <div className="flex flex-col items-center gap-1">
        <GradeBadge grade={grade} size="sm" />
        <span className={`text-sm font-black ${scoreColor(pct)}`}>{pct}%</span>
      </div>
    </td>
  );
}

// ─── Scoresheet table ─────────────────────────────────────────────────────────

function ScoresheetTable({ terms, onOpenReport, termReportLoading }) {
  // Build union of all subjects across all terms, preserving insertion order
  const allSubjects = useMemo(() => {
    const seen = new Set();
    const list = [];
    TERM_ORDER.forEach(t => {
      const termData = terms.find(td => td.term === t);
      (termData?.subjects || []).forEach(s => {
        if (!seen.has(s.name)) { seen.add(s.name); list.push(s.name); }
      });
    });
    return list;
  }, [terms]);

  // Map: termKey → { subjectName → subjectData }
  const termSubjectMap = useMemo(() => {
    const map = {};
    TERM_ORDER.forEach(t => {
      const termData = terms.find(td => td.term === t);
      map[t] = {};
      (termData?.subjects || []).forEach(s => { map[t][s.name] = s; });
    });
    return map;
  }, [terms]);

  // Which terms have data
  const activeTerm = (t) => terms.some(td => td.term === t);

  // Year average per subject
  const yearAvgForSubject = (subjectName) => {
    const scores = TERM_ORDER
      .filter(activeTerm)
      .map(t => termSubjectMap[t][subjectName]?.percentage)
      .filter(v => v != null);
    return scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
  };

  // Term averages
  const termAvg = (t) => {
    const td = terms.find(d => d.term === t);
    return td?.avg ?? null;
  };

  const yearAvgOverall = useMemo(() => {
    const avgs = TERM_ORDER.filter(activeTerm).map(termAvg).filter(v => v != null);
    return avgs.length ? Math.round(avgs.reduce((s, v) => s + v, 0) / avgs.length) : null;
  }, [terms]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Sticky scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          {/* Header */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500 w-[44%]">
                Subject
              </th>
              {TERM_ORDER.map(t => (
                <th key={t} className={`px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest w-[14%] ${activeTerm(t) ? 'text-[#3B1FA3]' : 'text-gray-300'}`}>
                  {termLabel(t).replace('Term ', 'T')}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-500 w-[14%]">
                Avg
              </th>
            </tr>
          </thead>

          <tbody>
            {allSubjects.map((subject, rowIdx) => {
              const yearAvg = yearAvgForSubject(subject);
              return (
                <tr
                  key={subject}
                  className={`transition-colors hover:bg-[#3B1FA3]/3 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  {/* Subject name */}
                  <td className="px-4 py-3 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-800">{subject}</span>
                  </td>

                  {/* Per-term cells */}
                  {TERM_ORDER.map(t => (
                    <ScoreCell
                      key={t}
                      subject={subject}
                      term={t}
                      subjectData={termSubjectMap[t][subject]}
                    />
                  ))}

                  {/* Year average */}
                  <td className="px-3 py-3 text-center border-b border-gray-100 border-l border-gray-100">
                    {yearAvg != null
                      ? <span className={`text-sm font-black ${scoreColor(yearAvg)}`}>{yearAvg}%</span>
                      : <span className="text-gray-200 font-bold text-sm">—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer — term averages */}
          <tfoot>
            <tr className="bg-[#3B1FA3]/5 border-t-2 border-[#3B1FA3]/20">
              <td className="px-4 py-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#3B1FA3]">Term Average</span>
              </td>
              {TERM_ORDER.map(t => {
                const avg = termAvg(t);
                return (
                  <td key={t} className="px-3 py-3 text-center">
                    {avg != null
                      ? <span className={`text-sm font-black ${scoreColor(avg)}`}>{avg}%</span>
                      : <span className="text-gray-300 font-bold text-sm">—</span>
                    }
                  </td>
                );
              })}
              <td className="px-3 py-3 text-center border-l border-[#3B1FA3]/10">
                {yearAvgOverall != null
                  ? <span className={`text-sm font-black ${scoreColor(yearAvgOverall)}`}>{yearAvgOverall}%</span>
                  : <span className="text-gray-300 font-bold text-sm">—</span>
                }
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Official report card actions per term */}
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Official Report Cards</p>
        <div className="flex flex-wrap gap-2">
          {TERM_ORDER.filter(activeTerm).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onOpenReport(t)}
              disabled={termReportLoading === t}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B1FA3] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#2d1680] transition-colors disabled:opacity-60"
            >
              {termReportLoading === t
                ? <Loader2 size={11} className="animate-spin" />
                : <FileText size={11} />
              }
              {termLabel(t)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Report modal ─────────────────────────────────────────────────────────────

function ReportModal({ title, children, onClose }) {
  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-[900px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#3B1FA3]">Official Report Card</p>
            <h3 className="text-sm font-black text-gray-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-x-auto bg-gray-100 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function GradeLegend() {
  const bands = [
    { code: 'EE', label: 'Exceeds Expectation',   cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
    { code: 'ME', label: 'Meets Expectation',      cls: 'bg-blue-100 text-blue-800 border border-blue-200' },
    { code: 'AE', label: 'Approaches Expectation', cls: 'bg-amber-100 text-amber-800 border border-amber-200' },
    { code: 'BE', label: 'Below Expectation',      cls: 'bg-rose-100 text-rose-800 border border-rose-200' },
  ];
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Grade Key</p>
      <div className="flex flex-wrap gap-2">
        {bands.map(b => (
          <div key={b.code} className="flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${b.cls}`}>{b.code}</span>
            <span className="text-[10px] text-gray-500">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ParentReportCards({ learner }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { loading, error, summary } = useLearnerResults(learner.id, year);

  const [termReport, setTermReport]         = useState(null);
  const [termReportLoading, setTermReportLoading] = useState(null); // term key or null
  const [termReportError, setTermReportError]     = useState('');
  const [pdfStatus, setPdfStatus]           = useState('');

  const openTermReport = useCallback(async (term) => {
    setTermReportLoading(term);
    setTermReportError('');
    try {
      const res  = await reportAPI.getTermlyReport(learner.id, { term, academicYear: year });
      const data = unwrapData(res);
      if (!data) throw new Error('Report card data is unavailable');
      setTermReport({ term, data });
    } catch (e) {
      setTermReportError(e?.message || 'Could not load the report card');
    } finally {
      setTermReportLoading(null);
    }
  }, [learner.id, year]);

  const downloadReportPdf = useCallback(async (term) => {
    const firstName = (learner.firstName || learner.name || 'Learner').split(' ')[0];
    const filename  = `ReportCard_${firstName}_${termLabel(term)}_${year}.pdf`;
    await waitForElement(`parent-termly-report-${year}-${term}`);
    await captureSingleReport(`parent-termly-report-${year}-${term}`, filename);
  }, [learner, year]);

  const handleDownload = useCallback(async () => {
    if (!termReport) return;
    setPdfStatus('downloading');
    try {
      await downloadReportPdf(termReport.term);
    } catch (e) {
      setTermReportError(e?.message || 'Could not download results');
    } finally {
      setPdfStatus('');
    }
  }, [termReport, downloadReportPdf]);

  const handleDownloadResults = useCallback(async () => {
    const term = summary.latest?.term;
    if (!term) return;
    setPdfStatus('downloading');
    setTermReportError('');
    try {
      let report = termReport?.term === term ? termReport : null;
      if (!report) {
        const res  = await reportAPI.getTermlyReport(learner.id, { term, academicYear: year });
        const data = unwrapData(res);
        if (!data) throw new Error('Report card data is unavailable');
        report = { term, data };
        setTermReport(report);
      }
      await downloadReportPdf(term);
    } catch (e) {
      setTermReportError(e?.message || 'Could not download results');
    } finally {
      setPdfStatus('');
    }
  }, [summary.latest?.term, termReport, learner.id, year, downloadReportPdf]);

  const handlePrint = useCallback(async () => {
    if (!termReport) return;
    setPdfStatus('printing');
    const firstName = (learner.firstName || learner.name || 'Learner').split(' ')[0];
    await printWindow(
      `parent-termly-report-${year}-${termReport.term}`,
      { title: `${firstName} — ${termLabel(termReport.term)} ${year}` }
    );
    setPdfStatus('');
  }, [termReport, learner, year]);

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700">{error}</div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Header: title + year selector ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-black text-gray-900">Academic Scoresheet</h3>
          <p className="text-xs text-gray-400 mt-0.5">{learner.name} · {learner.grade}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 shadow-sm"
          >
            {academicYears().map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            type="button"
            onClick={handleDownloadResults}
            disabled={!summary.hasData || !summary.latest || !!pdfStatus}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B1FA3] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#2d1680] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {pdfStatus === 'downloading' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {pdfStatus === 'downloading' ? 'Generating…' : 'Download Results'}
          </button>
        </div>
      </div>

      {/* ── Year summary strip ─────────────────────────────────────────── */}
      {summary.hasData && (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Year Average',
              value: (() => {
                const avgs = summary.terms.map(t => t.avg).filter(v => v != null);
                return avgs.length ? `${Math.round(avgs.reduce((s, v) => s + v, 0) / avgs.length)}%` : '—';
              })(),
              sub: 'Across all terms',
              color: 'text-[#3B1FA3]',
            },
            {
              label: 'Latest Term',
              value: summary.latest ? `${summary.latest.avg}%` : '—',
              sub: summary.latest ? termLabel(summary.latest.term) : '—',
              color: scoreColor(summary.latest?.avg),
            },
            {
              label: 'Trend',
              value: summary.trend != null ? (summary.trend >= 0 ? `+${summary.trend}` : `${summary.trend}`) : '—',
              sub: 'vs previous term',
              color: summary.trend == null ? 'text-gray-400' : summary.trend >= 0 ? 'text-emerald-600' : 'text-rose-500',
              icon: summary.trend != null ? (summary.trend >= 0 ? TrendingUp : TrendingDown) : null,
            },
          ].map(({ label, value, sub, color, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-white border border-gray-200 px-3 py-3 text-center shadow-sm">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {Icon && <Icon size={14} className={color} />}
                <p className={`text-xl font-black ${color}`}>{value}</p>
              </div>
              <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Scoresheet table or empty state ───────────────────────────── */}
      {summary.hasData ? (
        <ScoresheetTable
          terms={summary.terms}
          onOpenReport={openTermReport}
          termReportLoading={termReportLoading}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-sm font-bold text-gray-500">No results published for {year}</p>
          <p className="text-xs text-gray-400 mt-1">Results will appear here once the school publishes them.</p>
        </div>
      )}

      {/* ── Grade key ─────────────────────────────────────────────────── */}
      {summary.hasData && <GradeLegend />}

      {/* ── Errors ────────────────────────────────────────────────────── */}
      {termReportError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {termReportError}
        </div>
      )}

      {/* ── Official report card modal ────────────────────────────────── */}
      {termReport && (
        <ReportModal
          title={`${termLabel(termReport.term)} ${year} — ${learner.name}`}
          onClose={() => { setTermReport(null); setPdfStatus(''); }}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-end gap-2 px-4 pb-3 border-b border-gray-200 bg-white sticky top-[57px] z-10">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!!pdfStatus}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Printer size={13} />
              {pdfStatus === 'printing' ? 'Opening…' : 'Print'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!!pdfStatus}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B1FA3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2d1680] disabled:opacity-50 transition-colors"
            >
              {pdfStatus === 'downloading' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {pdfStatus === 'downloading' ? 'Generating…' : 'Download PDF'}
            </button>
          </div>

          {/* Rendered report */}
          <TermlyReportTemplate
            reportData={termReport.data}
            id={`parent-termly-report-${year}-${termReport.term}`}
          />
        </ReportModal>
      )}
    </div>
  );
}
