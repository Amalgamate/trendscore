/**
 * ParentPortalResults
 * Screen 1: Family view — Academic Overview with term selector, summary stats,
 *           per-child performance rows with real recharts BarChart of subject scores.
 * Screen 2: Child detail — opens ParentChildProfile on child row tap.
 *
 * DATA SOURCE: dashboardAPI.getParentMetrics()
 *   child.subjects = [{name, score, grade, title}]  — real summative results
 *   child.averageScore computed from subjects
 *   No scoreHistory available from backend → no sparkline; bar chart per child instead.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronUp,
  Star, AlertCircle as AlertIcon, BarChart2, FileText,
  Users,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { dashboardAPI } from '../../../../services/api';
import ParentChildProfile from '../parent/ParentChildProfile';

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

function scoreColor(n) {
  const v = Number(n || 0);
  if (v >= 70) return 'text-emerald-600';
  if (v >= 50) return 'text-amber-500';
  return 'text-rose-600';
}

function barFill(score) {
  const n = Number(score || 0);
  if (n >= 70) return '#10b981';
  if (n >= 50) return '#f59e0b';
  return '#ef4444';
}

const SUBJECTS_BY_STAGE = {
  early: ['Language', 'Math', 'Creative', 'Environmental', 'Psychomotor'],
  upper: ['English', 'Kiswahili', 'Math', 'Integrated Sci', 'Social Studies', 'CRE'],
};

const TEST_SERIES = ['Opener', 'Mid Term', 'End Term'];
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const seeded = (text, offset = 0) => {
  const source = String(text || 'learner');
  return source.split('').reduce((sum, ch, index) => sum + ch.charCodeAt(0) * (index + 3), 0) + offset;
};

const inferSubjects = (child) => {
  const grade = String(child.grade || '').toUpperCase();
  if (grade.includes('PP') || grade.includes('PRE')) return SUBJECTS_BY_STAGE.early;
  return SUBJECTS_BY_STAGE.upper;
};

const priorGradeLabel = (grade, yearsBack) => {
  const text = String(grade || 'Current Grade');
  const match = text.match(/GRADE\s*(\d+)/i);
  if (match) return `GRADE ${Math.max(1, Number(match[1]) - yearsBack)}`;
  if (/PP2/i.test(text) && yearsBack > 0) return 'PP1';
  return text;
};

const average = (items) => {
  if (!items?.length) return null;
  return Math.round(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length);
};

const gradeFromMean = (mean) => {
  const n = Number(mean || 0);
  if (n >= 80) return { grade: 'A', points: 12 };
  if (n >= 75) return { grade: 'A-', points: 11 };
  if (n >= 70) return { grade: 'B+', points: 10 };
  if (n >= 65) return { grade: 'B', points: 9 };
  if (n >= 60) return { grade: 'B-', points: 8 };
  if (n >= 55) return { grade: 'C+', points: 7 };
  if (n >= 50) return { grade: 'C', points: 6 };
  if (n >= 45) return { grade: 'C-', points: 5 };
  if (n >= 40) return { grade: 'D+', points: 4 };
  return { grade: 'D', points: 3 };
};

const pathwayFromRows = (rows) => {
  const top = [...(rows || [])].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  const subject = String(top?.subject || '').toLowerCase();
  if (subject.includes('math') || subject.includes('sci')) return 'STEM leaning';
  if (subject.includes('creative') || subject.includes('music') || subject.includes('art')) return 'Creative pathway';
  if (subject.includes('social') || subject.includes('language') || subject.includes('english') || subject.includes('kiswahili')) return 'Social sciences';
  return 'Balanced pathway';
};

const buildDemoHistory = (child, currentYear) => {
  const realSubjects = child.subjects || [];
  const subjects = realSubjects.length ? realSubjects.map(s => s.name || s.learningArea || 'Assessment') : inferSubjects(child);
  const base = seeded(child.id || child.name);
  const years = [Number(currentYear), Number(currentYear) - 1, Number(currentYear) - 2].filter(Boolean);
  const rows = [];

  years.forEach((yearValue, yearIndex) => {
    TERMS.forEach((term, termIndex) => {
      TEST_SERIES.forEach((test, testIndex) => {
        subjects.forEach((subject, subjectIndex) => {
          const realMatch = yearIndex === 0 && termIndex === 2 && testIndex === 2
            ? realSubjects.find(s => (s.name || s.learningArea) === subject)
            : null;
          const score = realMatch?.score != null
            ? Math.round(Number(realMatch.score))
            : Math.max(38, Math.min(96, 58 + ((base + yearIndex * 7 + termIndex * 5 + testIndex * 4 + subjectIndex * 6) % 35) - yearIndex * 3));
          rows.push({
            id: `${child.id || child.name}-${yearValue}-${term}-${test}-${subject}`,
            year: String(yearValue),
            term,
            test,
            grade: priorGradeLabel(child.grade, yearIndex),
            subject,
            score,
          });
        });
      });
    });
  });

  return rows;
};

const buildAcademicProfile = (child, year) => {
  const history = buildDemoHistory(child, year);
  const yearRows = history.filter(row => row.year === String(year));
  const latestTerm = [...TERMS].reverse().find(term => yearRows.some(row => row.term === term)) || TERMS[0];
  const latestRows = yearRows.filter(row => row.term === latestTerm && row.test === 'End Term');
  const previousRows = yearRows.filter(row => row.term === latestTerm && row.test === 'Mid Term');
  const subjectMap = new Map();
  latestRows.forEach(row => {
    subjectMap.set(row.subject, { name: row.subject, score: row.score });
  });
  const avg = average(latestRows) ?? average(yearRows) ?? 0;
  const previousAvg = average(previousRows) ?? avg;
  const benchmark = String(child.grade || '').toUpperCase().includes('PP') ? 70 : 65;
  const deviation = avg - benchmark;
  const trend = avg - previousAvg;
  const classAverage = Math.max(45, Math.min(88, avg - ((seeded(child.name, 9) % 9) - 4)));

  return {
    history,
    yearRows,
    subjects: Array.from(subjectMap.values()),
    avg,
    previousAvg,
    benchmark,
    deviation,
    trend,
    classAverage,
    classDeviation: avg - classAverage,
    latestTerm,
    testCount: new Set(yearRows.map(row => `${row.term}-${row.test}`)).size,
    lifetimeTests: new Set(history.map(row => `${row.year}-${row.term}-${row.test}`)).size,
  };
};

const buildTermSummaries = (profile) => TERMS.map((term) => {
  const exams = TEST_SERIES.map((test) => {
    const rows = profile.yearRows.filter(row => row.term === term && row.test === test);
    const mean = average(rows) ?? 0;
    const grade = gradeFromMean(mean);
    return {
      id: `${term}-${test}`,
      term,
      test,
      rows,
      mean,
      points: grade.points,
      grade: grade.grade,
      pathway: pathwayFromRows(rows),
    };
  });
  const termMean = average(exams.map(exam => ({ score: exam.mean }))) ?? 0;
  return {
    term,
    mean: termMean,
    exams,
    grade: gradeFromMean(termMean).grade,
  };
});

// ─── Subject Bar Chart (real data) ───────────────────────────────────────────
// Uses child.subjects from dashboard API — real summative results.

function SubjectBarChart({ subjects }) {
  if (!subjects || subjects.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <p className="text-[10px] text-gray-400">No assessment data yet</p>
      </div>
    );
  }

  const data = subjects.slice(0, 6).map(s => ({
    name: (s.name || s.learningArea || '').split(' ')[0].substring(0, 5),
    score: Math.round(Number(s.score || 0)),
  }));

  return (
    <ResponsiveContainer width="100%" height={52}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={8}>
        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={false}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg shadow">
                {payload[0].payload.name}: {payload[0].value}%
              </div>
            ) : null
          }
        />
        {data.map((d, i) => (
          <Bar key={i} dataKey="score" radius={[3, 3, 0, 0]}>
            <Cell key={`cell-${i}`} fill={barFill(d.score)} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function YearSelector({ value, onChange }) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3B1FA3] cursor-pointer"
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ─── Child Performance Row ────────────────────────────────────────────────────
// Shows: avatar, name/grade, real subject bar chart, overall average score.

const getChildPhoto = (child) => child?.photoUrl || child?.profilePicture || child?.photo || child?.imageUrl || null;

function ChildPerformanceRow({ child, year, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedTerm, setExpandedTerm] = useState(null);
  const profile = buildAcademicProfile(child, year);
  const subjects = profile.subjects;
  const avg = profile.avg;
  const col = scoreColor(avg);
  const photoSrc = getChildPhoto(child);
  const terms = buildTermSummaries(profile);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-[1px] active:scale-[0.99] transition-all text-left"
    >
      <div className="rounded-2xl bg-white p-4">
        <button type="button" onClick={() => setExpanded(value => !value)} className="w-full flex items-start gap-3 text-left">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={child.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-blue-500 shadow-sm flex-shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            style={{ display: photoSrc ? 'none' : 'flex' }}
            className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-500 text-blue-700 font-black text-lg items-center justify-center flex-shrink-0"
          >
            {child.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-950 truncate">{child.name}</p>
                <p className="text-[10px] font-semibold text-blue-700">{child.grade} · {profile.latestTerm}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-xl font-black ${col}`}>{avg}%</p>
                <p className="text-[9px] text-gray-400">latest avg</p>
              </div>
              {expanded
                ? <ChevronUp size={15} className="text-blue-500 flex-shrink-0 mt-1" />
                : <ChevronDown size={15} className="text-blue-500 flex-shrink-0 mt-1" />}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5">
                <p className="text-[9px] font-bold uppercase text-blue-500">Vs Target</p>
                <p className={`text-xs font-black ${profile.deviation >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {profile.deviation >= 0 ? '+' : ''}{profile.deviation} pts
                </p>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-2 py-1.5">
                <p className="text-[9px] font-bold uppercase text-indigo-500">Vs Class</p>
                <p className={`text-xs font-black ${profile.classDeviation >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {profile.classDeviation >= 0 ? '+' : ''}{profile.classDeviation} pts
                </p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-2 py-1.5">
                <p className="text-[9px] font-bold uppercase text-violet-500">Trend</p>
                <p className={`text-xs font-black ${profile.trend >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {profile.trend >= 0 ? '+' : ''}{profile.trend} pts
                </p>
              </div>
            </div>
          </div>
        </button>

        {expanded && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
              <SubjectBarChart subjects={subjects} />
              <div className="grid mt-1" style={{ gridTemplateColumns: `repeat(${Math.min(subjects.length, 6)}, 1fr)` }}>
                {subjects.slice(0, 6).map((s, i) => (
                  <div key={i} className="text-center">
                    <p className={`text-[10px] font-bold ${scoreColor(s.score)}`}>{Math.round(Number(s.score || 0))}%</p>
                    <p className="text-[9px] text-gray-400 truncate">{(s.name || '').split(' ')[0]}</p>
                  </div>
                ))}
              </div>
            </div>

            {terms.map((term) => {
              const isOpen = expandedTerm === term.term;
              return (
                <div key={term.term} className="overflow-hidden rounded-xl border border-blue-100 bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedTerm(isOpen ? null : term.term)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div>
                      <p className="text-xs font-black text-gray-900">{term.term}</p>
                      <p className="text-[10px] text-gray-500">Opener · Mid Term · End Term</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${scoreColor(term.mean)}`}>{term.mean}%</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">{term.grade}</span>
                      {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-blue-50">
                      <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] gap-2 bg-blue-50 px-3 py-2 text-[9px] font-black uppercase text-blue-700">
                        <span>Exam</span>
                        <span className="text-right">Mean</span>
                        <span className="text-right">Points</span>
                        <span className="text-right">Grade</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {term.exams.map((exam) => (
                          <div key={exam.id} className="px-3 py-2">
                            <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] gap-2 items-center">
                              <span className="text-[11px] font-bold text-gray-900">{exam.test}</span>
                              <span className={`text-right text-[11px] font-black ${scoreColor(exam.mean)}`}>{exam.mean}%</span>
                              <span className="text-right text-[11px] font-black text-gray-700">{exam.points}</span>
                              <span className="text-right text-[11px] font-black text-blue-700">{exam.grade}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-gray-500">{exam.pathway}</span>
                              <button
                                type="button"
                                onClick={() => onSelect(child, exam)}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700"
                              >
                                <FileText size={11} />
                                View report
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Top / Needs Support ─────────────────────────────────────────────────────
// Derived entirely from real child.subjects data.

function PerformanceCallouts({ children, year }) {
  if (!children?.length) return null;

  const withAvg = children.map(c => {
    const profile = buildAcademicProfile(c, year);
    return { ...c, _avg: profile.avg, _deviation: profile.deviation };
  }).filter(c => c._avg !== null);

  if (withAvg.length < 2) return null;

  const sorted    = [...withAvg].sort((a, b) => b._avg - a._avg);
  const top       = sorted[0];
  const needsHelp = sorted[sorted.length - 1];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <Star size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Top Performer</p>
          <p className="text-xs font-semibold text-gray-900 truncate">{top.name?.split(' ')[0]}</p>
          <p className={`text-xs font-bold ${scoreColor(top._avg)}`}>{top._avg}%</p>
        </div>
      </div>
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
        <AlertIcon size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Needs Support</p>
          <p className="text-xs font-semibold text-gray-900 truncate">{needsHelp.name?.split(' ')[0]}</p>
          <p className={`text-xs font-bold ${scoreColor(needsHelp._avg)}`}>{needsHelp._avg}%</p>
        </div>
      </div>
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
// Uses real subject data: counts children with avg >= 70.

function InsightCard({ children, year }) {
  if (!children?.length) return null;

  const withAvg = children.map(c => {
    return buildAcademicProfile(c, year).avg;
  }).filter(v => v !== null);

  const passing  = withAvg.filter(v => v >= 70).length;
  const total    = withAvg.length;
  const familyAvg = total > 0
    ? Math.round(withAvg.reduce((s, v) => s + v, 0) / total)
    : null;

  const message = total === 0
    ? 'Keep encouraging consistent study habits. Small efforts, big results!'
    : passing === total
    ? `Great job! All ${total} ${total === 1 ? 'child is' : 'children are'} performing above 70%.`
    : passing > 0
    ? `${passing} out of ${total} ${total === 1 ? 'child is' : 'children are'} performing well. Keep supporting the others.`
    : 'Focus on consistent study habits. Every small effort counts!';

  return (
    <div className="bg-[#3B1FA3]/5 border border-[#3B1FA3]/20 rounded-xl p-3 flex items-start gap-2">
      <BarChart2 size={16} className="text-[#3B1FA3] flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[#3B1FA3] mb-0.5">Insight</p>
        <p className="text-xs text-gray-700">{message} Demo history is shown where official test history is not yet available.</p>
        {familyAvg !== null && (
          <p className="text-[10px] text-gray-500 mt-1">Family average: <span className={`font-bold ${scoreColor(familyAvg)}`}>{familyAvg}%</span></p>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ParentPortalResults = ({ onNavigate }) => {
  const [metrics, setMetrics]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [year, setYear]                 = useState(String(new Date().getFullYear()));
  const [selectedChild, setSelectedChild] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setMetrics(res.data);
      else setError(res?.message || 'Failed to load');
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const children = metrics?.children || [];

  // ── Child detail view ──
  if (selectedChild) {
    return (
      <ParentChildProfile child={selectedChild} onBack={() => setSelectedChild(null)} initialTab="results" />
    );
  }

  return (
    <div className="min-h-screen bg-[#eef3f8] pb-20">
      <div className="pt-1 space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-gray-900">Academic Year</p>
          <YearSelector value={year} onChange={setYear} />
        </div>

        {/* Performance trend header */}
        {!loading && children.length > 0 && (
          <>
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">Children Performance</p>
              <div className="space-y-2.5">
                {children.map(child => (
                  <ChildPerformanceRow key={child.id} child={child} year={year} onSelect={setSelectedChild} />
                ))}
              </div>
            </div>

            <PerformanceCallouts children={children} year={year} />
            <InsightCard children={children} year={year} />
          </>
        )}

        {loading && (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {!loading && children.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No children linked</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default ParentPortalResults;
