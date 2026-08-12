import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Search, Users } from 'lucide-react';
import { learnerAPI } from '../../../services/api';

const unwrapRows = (response) => {
  const payload = response?.data ?? response;
  return Array.isArray(payload) ? payload : (payload?.data || []);
};

const label = (value) => String(value || 'Unassigned')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const StudentReportsPage = ({ learners: initialLearners = [] }) => {
  const [learners, setLearners] = useState(initialLearners);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    learnerAPI.getAll({ limit: 1000 })
      .then((response) => {
        if (!cancelled) setLearners(unwrapRows(response));
      })
      .catch(() => {
        // Keep the bootstrap register as a useful fallback.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const grades = useMemo(() => [...new Set(learners.map((learner) => learner.grade).filter(Boolean))].sort(), [learners]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return learners.filter((learner) => {
      const name = [learner.firstName, learner.middleName, learner.lastName].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || name.includes(query) || String(learner.admissionNumber || '').toLowerCase().includes(query);
      const matchesGrade = grade === 'ALL' || learner.grade === grade;
      const matchesStatus = status === 'ALL' || String(learner.status || '').toUpperCase() === status;
      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [grade, learners, search, status]);

  const byGrade = useMemo(() => filtered.reduce((result, learner) => {
    const key = learner.grade || 'Unassigned';
    if (!result[key]) result[key] = { total: 0, active: 0, male: 0, female: 0 };
    result[key].total += 1;
    if (String(learner.status || '').toUpperCase() === 'ACTIVE') result[key].active += 1;
    if (String(learner.gender || '').toUpperCase() === 'MALE') result[key].male += 1;
    if (String(learner.gender || '').toUpperCase() === 'FEMALE') result[key].female += 1;
    return result;
  }, {}), [filtered]);

  const downloadCsv = () => {
    const rows = [
      ['Student', 'Admission Number', 'Grade', 'Stream', 'Gender', 'Status', 'Parent/Guardian', 'Contact'],
      ...filtered.map((learner) => [
        [learner.firstName, learner.middleName, learner.lastName].filter(Boolean).join(' '),
        learner.admissionNumber,
        learner.grade,
        learner.stream,
        learner.gender,
        learner.status,
        learner.primaryContactName || learner.guardianName || learner.parent?.firstName,
        learner.primaryContactPhone || learner.guardianPhone || learner.parent?.phone,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `student-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full bg-[var(--app-page-bg)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><FileText size={22} /></span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Student Management</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Student Reports</h1>
              </div>
            </div>
            <button type="button" onClick={downloadCsv} disabled={!filtered.length} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Download size={17} /> Export CSV
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or admission number" className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </label>
            <select value={grade} onChange={(event) => setGrade(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400">
              <option value="ALL">All grades</option>
              {grades.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400">
              <option value="ALL">All statuses</option>
              {['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'EXITED', 'GRADUATED'].map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Students matched</p><p className="mt-2 text-3xl font-black text-slate-950">{loading ? '—' : filtered.length.toLocaleString()}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Active</p><p className="mt-2 text-3xl font-black text-emerald-700">{filtered.filter((learner) => String(learner.status || '').toUpperCase() === 'ACTIVE').length.toLocaleString()}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Grades represented</p><p className="mt-2 text-3xl font-black text-indigo-700">{Object.keys(byGrade).length.toLocaleString()}</p></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4"><Users size={18} className="text-indigo-600" /><h2 className="text-lg font-black text-slate-950">Register summary by grade</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-5 py-3">Grade</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Active</th><th className="px-5 py-3">Male</th><th className="px-5 py-3">Female</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(byGrade).sort(([, left], [, right]) => right.total - left.total).map(([key, value]) => <tr key={key} className="hover:bg-slate-50"><td className="px-5 py-3 font-bold text-slate-800">{label(key)}</td><td className="px-5 py-3 font-semibold text-slate-700">{value.total}</td><td className="px-5 py-3 font-semibold text-emerald-700">{value.active}</td><td className="px-5 py-3 text-slate-600">{value.male}</td><td className="px-5 py-3 text-slate-600">{value.female}</td></tr>)}
                {!Object.keys(byGrade).length && <tr><td colSpan="5" className="px-5 py-12 text-center font-semibold text-slate-500">No students match the selected filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentReportsPage;
