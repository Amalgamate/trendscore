import React, { useMemo, useState } from 'react';
import api from '../../../services/api';
import { getAcademicYearOptions, getCurrentAcademicYear, getCurrentTerm } from '../utils/academicYear';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import ExcelJS from 'exceljs';
import { ArrowLeft, FileSpreadsheet, Printer } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { key: 'OVERALL', label: 'Overall' },
  { key: 'STEM', label: 'STEM' },
  { key: 'SOCIAL', label: 'Social Sciences' },
  { key: 'ARTS', label: 'Arts & Sports' },
];

const FALLBACK_TERMS = [
  { value: 'TERM_1', label: 'Term 1' },
  { value: 'TERM_2', label: 'Term 2' },
  { value: 'TERM_3', label: 'Term 3' },
];

const CATEGORY_KEYWORDS = {
  STEM: [
    'MATHEMATICS', 'MATH', 'MAT',
    'INTEGRATED SCIENCE', 'INT SCI', 'I-SCI',
    'SCIENCE AND TECHNOLOGY', 'SCITECH', 'SCIENCE & TECHNOLOGY',
    'PRE-TECHNICAL STUDIES', 'PRE-TECH', 'P-TECH',
    'AGRICULTURE', 'AGRI', 'HOMESCIENCE', 'H SCI',
  ],
  SOCIAL: [
    'ENGLISH', 'ENG', 'KISWAHILI', 'KIS',
    'SOCIAL STUDIES', 'SST', 'RELIGIOUS EDUCATION', 'REL',
    'CHRISTIAN RELIGIOUS EDUCATION', 'CRE', 'ISLAMIC RELIGIOUS EDUCATION', 'IRE', 'RE',
    'HISTORY', 'GEOGRAPHY',
  ],
  ARTS: [
    'CREATIVE ARTS AND SPORTS', 'CREATIVE', 'CREA', 'CREATIVE ARTS & SPORTS',
    'ART AND CRAFT', 'ART', 'MUSIC', 'MUS',
    'PHYSICAL AND HEALTH EDUCATION', 'PHE', 'MOVEMENT AND CREATIVE ACTIVITIES',
  ],
};

const normalizeText = (v) => String(v || '').trim().toUpperCase();

const mapRow = (r) => {
  const learningArea = r?.learningArea || r?.area || r?.test?.learningArea || '';
  const score = Number(r?.score ?? r?.totalScore ?? r?.marksAwarded ?? r?.marksObtained ?? 0);
  const totalMarks = Number(r?.totalMarks ?? r?.maxMarks ?? r?.test?.totalMarks ?? r?.maxScore ?? 0);
  const percentage = Number.isFinite(Number(r?.percentage))
    ? Number(r?.percentage)
    : (totalMarks > 0 ? (score / totalMarks) * 100 : 0);
  return {
    learningArea,
    score,
    totalMarks,
    percentage,
  };
};

const computeMetric = (rows, categoryKey) => {
  const parsed = rows.map(mapRow).filter((r) => r.totalMarks > 0);
  if (parsed.length === 0) return null;
  const selected = categoryKey === 'OVERALL'
    ? parsed
    : parsed.filter((row) => CATEGORY_KEYWORDS[categoryKey].some((k) => normalizeText(row.learningArea).includes(k)));
  if (selected.length === 0) return null;
  const total = selected.reduce((sum, r) => sum + r.score, 0);
  const max = selected.reduce((sum, r) => sum + r.totalMarks, 0);
  if (max <= 0) return null;
  return Math.round((total / max) * 100);
};

const takeRanked = (rows, count, mode, includeTies) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => (mode === 'TOP' ? b.score - a.score : a.score - b.score));
  const base = sorted.slice(0, Math.max(1, count));
  if (!includeTies || base.length === 0) return base;
  const threshold = base[base.length - 1].score;
  return sorted.filter((r) => (mode === 'TOP' ? r.score >= threshold : r.score <= threshold));
};

const CustomReportsPage = ({ onNavigate, user, brandingSettings }) => {
  const { grades, streams, terms } = useSchoolData();
  const [grade, setGrade] = useState('');
  const [stream, setStream] = useState('');
  const [term, setTerm] = useState(getCurrentTerm());
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [rankMode, setRankMode] = useState('TOP');
  const [rankCount, setRankCount] = useState(10);
  const [includeTies, setIncludeTies] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState(['OVERALL', 'STEM', 'SOCIAL']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [results, setResults] = useState({});
  const effectiveTerms = (Array.isArray(terms) && terms.length > 0) ? terms : FALLBACK_TERMS;
  const schoolName = (brandingSettings?.schoolName || user?.school?.name || 'SCHOOL').toUpperCase();

  const availableStreams = useMemo(() => {
    if (!grade) return streams || [];
    return (streams || []).filter((s) => {
      const sg = normalizeText(s?.grade || s?.gradeLevel || '');
      return !sg || sg === normalizeText(grade);
    });
  }, [grade, streams]);

  const toggleCategory = (key) => {
    setSelectedCategories((prev) => (
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    ));
  };

  const runReport = async () => {
    if (!grade) {
      setError('Select a grade first.');
      return;
    }
    if (!term) {
      setError('Select a term first.');
      return;
    }
    if (selectedCategories.length === 0) {
      setError('Select at least one category.');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Loading learners...');
    try {
      const normalizedGrade = normalizeText(grade);
      const learnerResp = await api.learners.getAll({
        grade: normalizedGrade,
        ...(stream && stream !== 'all' ? { stream } : {}),
        limit: 1000,
      });
      const learnerRows = learnerResp?.data || [];
      if (!learnerRows.length) {
        setResults({});
        setStatus('No learners found for selected filters.');
        setLoading(false);
        return;
      }

      setStatus('Loading summative results...');
      const bulkParams = {
        grade: normalizedGrade,
        term,
        academicYear,
      };
      if (stream && stream !== 'all') bulkParams.stream = stream;
      const bulkResp = await api.assessments.getBulkResults(bulkParams);
      const bulkRows = bulkResp?.data || bulkResp?.results || [];

      const byLearner = new Map();
      bulkRows.forEach((row) => {
        const learnerId = row?.learnerId;
        if (!learnerId) return;
        if (!byLearner.has(learnerId)) byLearner.set(learnerId, []);
        byLearner.get(learnerId).push({
          ...row,
          score: row?.score ?? row?.marksObtained ?? row?.marksAwarded ?? 0,
          totalMarks: row?.totalMarks ?? row?.test?.totalMarks ?? row?.maxScore ?? 0,
          learningArea: row?.learningArea || row?.test?.learningArea || '',
        });
      });

      const metricRows = learnerRows.map((learner, idx) => {
        const learnerResults = byLearner.get(learner.id) || [];
        setStatus(`Analyzing learner results... ${idx + 1}/${learnerRows.length}`);
        const scores = {};
        selectedCategories.forEach((category) => {
          scores[category] = computeMetric(learnerResults, category);
        });
        return {
          learnerId: learner.id,
          learnerName: `${learner.firstName || ''} ${learner.lastName || ''}`.trim(),
          admNo: learner.admissionNo || learner.admissionNumber || learner.admission_number || learner.admNo || learner.admNumber || '—',
          stream: learner.stream || '—',
          scores,
        };
      });

      const nextResults = {};
      selectedCategories.forEach((category) => {
        const rankedSource = metricRows
          .filter((row) => Number.isFinite(row.scores[category]))
          .map((row) => ({
            ...row,
            score: row.scores[category],
          }));
        nextResults[category] = takeRanked(rankedSource, rankCount, rankMode, includeTies);
      });
      setResults(nextResults);
      setStatus(`Done. Processed ${metricRows.length} learner record(s).`);
    } catch (err) {
      setError(err?.message || 'Failed to generate custom report.');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (typeof onNavigate === 'function') onNavigate('assess-summative-report');
    else window.history.back();
  };

  const handlePrintPdf = () => window.print();

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Top Bottom Performers');
    ws.addRow([schoolName]);
    ws.addRow([`TOP / BOTTOM PERFORMERS - ${String(term || '').replace('_', ' ')} ${academicYear}`]);
    ws.addRow([`Grade: ${String(grade || '').replace('_', ' ')}${stream ? ` | Stream: ${stream}` : ''}`]);
    ws.addRow([`Generated: ${new Date().toLocaleString()}`]);
    ws.addRow([]);

    selectedCategories.forEach((category) => {
      const title = CATEGORY_OPTIONS.find((c) => c.key === category)?.label || category;
      ws.addRow([`${title} (${rankMode} ${rankCount}${includeTies ? ', ties included' : ''})`]);
      ws.addRow(['Rank', 'Learner', 'Adm No', 'Stream', 'Score']);
      (results[category] || []).forEach((row, idx) => {
        ws.addRow([idx + 1, row.learnerName, row.admNo, row.stream, `${row.score}%`]);
      });
      ws.addRow([]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `top_bottom_performers_${String(term || '').toLowerCase()}_${academicYear}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-140px)] p-4 md:p-6">
      <div className="max-w-[1280px] mx-auto space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 mb-3 no-print">
            <button
              type="button"
              onClick={handleBack}
              className="h-9 px-3 rounded border border-slate-300 bg-white text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="h-9 px-3 rounded border border-slate-300 bg-white text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
              >
                <FileSpreadsheet size={14} />
                Excel
              </button>
              <button
                type="button"
                onClick={handlePrintPdf}
                className="h-9 px-3 rounded border border-slate-300 bg-white text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50"
              >
                <Printer size={14} />
                PDF
              </button>
            </div>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Top / Bottom Performers</h1>
          <p className="text-xs text-slate-500 mt-1">Build ranking reports for top or bottom learners across multiple categories.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-9 px-2.5 border border-slate-300 rounded text-xs">
              <option value="">Grade</option>
              {(grades || []).map((g) => {
                const value = typeof g === 'string' ? g : (g.value || g.id || g.name);
                const label = typeof g === 'string' ? g : (g.label || g.name || value);
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>

            <select value={stream} onChange={(e) => setStream(e.target.value)} className="h-9 px-2.5 border border-slate-300 rounded text-xs">
              <option value="">All Streams</option>
              {availableStreams.map((s) => {
                const value = s?.value || s?.name || s?.id;
                const label = s?.name || s?.label || value;
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>

            <select value={term} onChange={(e) => setTerm(e.target.value)} className="h-9 px-2.5 border border-slate-300 rounded text-xs">
              {effectiveTerms.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <select value={academicYear} onChange={(e) => setAcademicYear(Number(e.target.value))} className="h-9 px-2.5 border border-slate-300 rounded text-xs">
              {getAcademicYearOptions().map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>

            <select value={rankMode} onChange={(e) => setRankMode(e.target.value)} className="h-9 px-2.5 border border-slate-300 rounded text-xs">
              <option value="TOP">Top</option>
              <option value="BOTTOM">Bottom</option>
            </select>

            <input
              type="number"
              min={1}
              max={100}
              value={rankCount}
              onChange={(e) => setRankCount(Number(e.target.value || 1))}
              className="h-9 px-2.5 border border-slate-300 rounded text-xs"
              placeholder="N"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleCategory(opt.key)}
                className={`px-3 h-8 rounded-full text-xs font-medium border ${selectedCategories.includes(opt.key) ? 'bg-brand-teal text-white border-brand-teal' : 'bg-white text-slate-700 border-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={includeTies} onChange={(e) => setIncludeTies(e.target.checked)} />
            Include ties at cutoff
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runReport}
              disabled={loading}
              className="h-9 px-4 rounded bg-brand-teal text-white text-xs font-medium hover:bg-brand-teal/90 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Custom Report'}
            </button>
            {status && <span className="text-xs text-slate-600">{status}</span>}
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>

        <div className="space-y-4">
          {selectedCategories.map((category) => {
            const title = CATEGORY_OPTIONS.find((c) => c.key === category)?.label || category;
            const rows = results[category] || [];
            return (
              <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
                  <span className="text-xs text-slate-500">{rankMode === 'TOP' ? 'Top' : 'Bottom'} {rankCount}{includeTies ? ' (ties included)' : ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-4 py-2">Rank</th>
                        <th className="text-left px-4 py-2">Learner</th>
                        <th className="text-left px-4 py-2">Adm No</th>
                        <th className="text-left px-4 py-2">Stream</th>
                        <th className="text-right px-4 py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No data</td></tr>
                      ) : rows.map((row, idx) => (
                        <tr key={`${category}-${row.learnerId}`} className="border-t border-slate-100">
                          <td className="px-4 py-2">{idx + 1}</td>
                          <td className="px-4 py-2 font-medium text-slate-800">{row.learnerName || 'Unnamed learner'}</td>
                          <td className="px-4 py-2">{row.admNo}</td>
                          <td className="px-4 py-2">{row.stream}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-900">{row.score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CustomReportsPage;
