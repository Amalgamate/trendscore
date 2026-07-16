import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Award, Heart, RefreshCw, Star, Users } from 'lucide-react';
import api from '../../../services/api';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const defaultTerm = currentMonth <= 4 ? 'TERM_1' : currentMonth <= 8 ? 'TERM_2' : 'TERM_3';
const ratingLabels = { EE: 'Exceeding', ME: 'Meeting', AE: 'Approaching', BE: 'Below' };

const CoverageCard = ({ icon: Icon, label, data, tone }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className={`rounded-xl p-3 ${tone}`}><Icon size={20} /></div>
      <span className="text-2xl font-black text-slate-950">{data?.rate ?? 0}%</span>
    </div>
    <h3 className="mt-4 text-sm font-black text-slate-900">{label}</h3>
    <p className="mt-1 text-xs font-semibold text-slate-500">{data?.recorded ?? 0} recorded · {data?.missing ?? 0} missing</p>
  </div>
);

const HolisticDevelopmentSummary = ({ learners = [], onNavigate, competencyOnly = false }) => {
  const [term, setTerm] = useState(defaultTerm);
  const [academicYear, setAcademicYear] = useState(currentYear);
  const [grade, setGrade] = useState('');
  const [stream, setStream] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const grades = useMemo(() => summary?.scope?.availableGrades || [...new Set(learners.map((learner) => learner.grade).filter(Boolean))].sort(), [learners, summary]);
  const streams = useMemo(() => summary?.scope?.availableStreams || [...new Set(learners.filter((learner) => !grade || learner.grade === grade).map((learner) => learner.stream).filter(Boolean))].sort(), [learners, grade, summary]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.cbc.getHolisticSummary({ term, academicYear, grade, stream })
      .then((response) => {
        if (active) setSummary(response?.data || null);
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Unable to load holistic records');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [term, academicYear, grade, stream]);

  const coverage = summary?.coverage || {};
  const missingLearners = summary?.missingLearners || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Whole learner evidence</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{competencyOnly ? 'Competency Analysis' : 'Holistic Development Summary'}</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Live coverage for the selected reporting period. Ratings remain domain-specific and are not combined into a single score.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select value={term} onChange={(event) => setTerm(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="TERM_1">Term 1</option><option value="TERM_2">Term 2</option><option value="TERM_3">Term 3</option>
          </select>
          <select value={academicYear} onChange={(event) => setAcademicYear(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <select value={grade} onChange={(event) => { setGrade(event.target.value); setStream(''); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="">All grades</option>{grades.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={stream} onChange={(event) => setStream(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="">All streams</option>{streams.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm font-bold text-slate-500"><RefreshCw className="animate-spin" size={18} /> Loading holistic records...</div>}
      {!loading && error && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">{error}</div>}

      {!loading && !error && summary && (
        <>
          {!competencyOnly && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <CoverageCard icon={Users} label="Learners in scope" data={{ rate: 100, recorded: summary.scope?.learnerCount, missing: 0 }} tone="bg-indigo-50 text-indigo-700" />
              <CoverageCard icon={Star} label="Core Competencies" data={coverage.competencies} tone="bg-amber-50 text-amber-700" />
              <CoverageCard icon={Heart} label="National Values" data={coverage.values} tone="bg-rose-50 text-rose-700" />
              <CoverageCard icon={Award} label="Co-Curricular" data={coverage.coCurricular} tone="bg-emerald-50 text-emerald-700" />
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><h3 className="text-sm font-black text-slate-950">Competency evidence</h3><p className="text-xs font-semibold text-slate-500">Coverage and rating-band distribution across learners in scope.</p></div>
              <Activity className="text-indigo-600" size={20} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Competency</th><th className="px-4 py-3">Coverage</th>{Object.entries(ratingLabels).map(([key, label]) => <th key={key} className="px-4 py-3">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(summary.competencies || []).map((item) => (
                    <tr key={item.key} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-bold text-slate-900">{item.label}</td><td className="px-4 py-4"><span className="font-black text-slate-900">{item.coverageRate}%</span><span className="ml-2 text-xs text-slate-500">{item.recorded}/{summary.scope?.learnerCount}</span></td>{Object.keys(ratingLabels).map((band) => <td key={band} className="px-4 py-4 font-bold text-slate-700">{item.distribution?.[band] || 0}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!competencyOnly && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-950">Records needing attention</h3><p className="text-xs font-semibold text-slate-500">Learners missing one or more holistic evidence areas.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{missingLearners.length} learners</span></div>
              {missingLearners.length === 0 ? <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">All learners in scope have records across the three holistic areas.</p> : (
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{missingLearners.slice(0, 24).map((learner) => <div key={learner.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-black text-slate-900">{learner.firstName} {learner.lastName}</p><p className="text-[11px] font-semibold text-slate-500">{learner.admissionNumber} · {learner.grade}{learner.stream ? ` ${learner.stream}` : ''}</p><p className="mt-2 text-xs font-bold text-amber-700">Missing: {learner.missing.join(', ')}</p></div>)}</div>
              )}
              {missingLearners.length > 24 && <p className="mt-3 text-xs font-semibold text-slate-500">Showing 24 of {missingLearners.length} learners. Narrow the grade or stream to review the rest.</p>}
              {onNavigate && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => onNavigate('assess-core-competencies')} className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">Record competencies</button><button onClick={() => onNavigate('assess-values')} className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-black text-rose-700">Record values</button><button onClick={() => onNavigate('assess-cocurricular')} className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">Record co-curricular</button></div>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HolisticDevelopmentSummary;
