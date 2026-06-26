/**
 * LearnerAcademicTab
 * Rich academic results display for the Student Profile.
 * - Groups results by Term + Academic Year
 * - Shows subject, score, grade, CBC rubric badge
 * - Paper snapshot upload: attach a photo proof per result
 * - Filter by term/year
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  GraduationCap, BarChart3, Award,
  Camera, X, Loader2, CheckCircle2,
  ChevronDown, ChevronUp, Filter, AlertCircle,
  Calendar,
} from 'lucide-react';
import api from '../../../../services/api';

// Helpers
const gradeColor = (grade) => {
  const g = String(grade || '').toUpperCase();
  if (g.startsWith('EE')) return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
  if (g.startsWith('ME')) return { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200'    };
  if (g.startsWith('AE')) return { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200'   };
  if (g.startsWith('BE')) return { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200'    };
  // Numeric-style grades
  if (g.startsWith('A')) return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
  if (g.startsWith('B')) return { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200'    };
  if (g.startsWith('C')) return { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200'   };
  return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
};

const scoreBarColor = (pct) => {
  const n = Number(pct || 0);
  if (n >= 75) return 'bg-emerald-500';
  if (n >= 50) return 'bg-blue-500';
  if (n >= 40) return 'bg-amber-400';
  return 'bg-rose-500';
};

const formatTerm = (t) => String(t || '').replace('_', ' ');
const formatTestType = (t) => String(t || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Paper snapshot button
function PaperSnapshot({ result, learnerId, onSnapshotSaved }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(result.paperSnapshotUrl || null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Only JPG, PNG, WebP or GIF'); return;
    }
    if (file.size > 8 * 1024 * 1024) { setError('Max 8MB'); return; }
    setError(null);
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      // Save via PATCH /api/assessments/summative/results/:id/snapshot
      const res = await api.patch(`/assessments/summative/results/${result.id}/snapshot`, { snapshotUrl: b64 });
      if (res?.success) {
        setPreview(b64);
        onSnapshotSaved?.(result.id, b64);
      } else {
        setError(res?.message || 'Upload failed');
      }
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [result.id, onSnapshotSaved]);

  return (
    <div className="flex items-center gap-2">
      {preview ? (
        <button
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
          title="View paper snapshot"
        >
          <CheckCircle2 size={12} /> Paper Verified
        </button>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Attach paper snapshot as proof"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          {uploading ? 'Uploading...' : 'Add Proof'}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && <span className="text-xs text-rose-500">{error}</span>}

      {/* Preview modal */}
      {showPreview && preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Paper Snapshot - {result.test?.learningArea} ({formatTerm(result.test?.term)} {result.test?.academicYear})</p>
              <button onClick={() => setShowPreview(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X size={16} />
              </button>
            </div>
            <img src={preview} alt="Paper snapshot" className="w-full max-h-[70vh] object-contain" />
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                This image was uploaded as proof of the paper-based score record.
              </p>
              <button
                onClick={() => { setShowPreview(false); fileRef.current?.click(); }}
                className="mt-2 text-xs text-[#4F46E5] font-semibold hover:underline"
              >Replace snapshot</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Single result row
function ResultRow({ result, learnerId, onSnapshotSaved }) {
  const pct = Number(result.percentage || 0);
  const gc = gradeColor(result.grade);
  const barColor = scoreBarColor(pct);

  return (
    <div className="flex items-center gap-4 py-3 px-4 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
      {/* Subject */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {result.test?.learningArea || 'Unknown Subject'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatTestType(result.test?.testType)} | {result.test?.testDate ? new Date(result.test.testDate).toLocaleDateString() : '-'}
          {result.recorder && ` | Recorded by ${result.recorder.firstName}`}
        </p>
      </div>

      {/* Score bar */}
      <div className="w-28 hidden sm:block">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-600 w-8 text-right">{pct > 0 ? `${Math.round(pct)}%` : '-'}</span>
        </div>
        {result.score != null && result.test?.totalMarks && (
          <p className="text-[10px] text-gray-400 mt-0.5">{result.score}/{result.test.totalMarks} marks</p>
        )}
      </div>

      {/* Grade badge */}
      <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${gc.bg} ${gc.text} ${gc.border} min-w-[44px] text-center`}>
        {result.grade || '-'}
      </div>

      {/* Paper snapshot */}
      <PaperSnapshot result={result} learnerId={learnerId} onSnapshotSaved={onSnapshotSaved} />
    </div>
  );
}

// Term group
function TermGroup({ term, year, results, learnerId, onSnapshotSaved }) {
  const [expanded, setExpanded] = useState(true);
  const avg = results.reduce((s, r) => s + Number(r.percentage || 0), 0) / (results.length || 1);
  const gc = gradeColor(avg >= 75 ? 'EE' : avg >= 50 ? 'ME' : avg >= 40 ? 'AE' : 'BE');
  const snapshotCount = results.filter(r => r.paperSnapshotUrl).length;

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      {/* Group header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4F46E5]/10 flex items-center justify-center">
            <Calendar size={14} className="text-[#4F46E5]" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{formatTerm(term)} | {year}</p>
            <p className="text-xs text-gray-400">{results.length} subject{results.length !== 1 ? 's' : ''} | Avg: {Math.round(avg)}%
              {snapshotCount > 0 && ` | ${snapshotCount} paper proof${snapshotCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${gc.bg} ${gc.text} ${gc.border}`}>
            Avg {Math.round(avg)}%
          </span>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Results list */}
      {expanded && (
        <div className="divide-y divide-gray-50 px-2">
          {results.map((r, i) => (
            <ResultRow key={r.id || i} result={r} learnerId={learnerId} onSnapshotSaved={onSnapshotSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

// Summary stats
function AcademicSummary({ assessments }) {
  if (!assessments.length) return null;
  const withPct = assessments.filter(r => r.percentage != null);
  const avg = withPct.length ? withPct.reduce((s, r) => s + Number(r.percentage), 0) / withPct.length : 0;
  const top = [...withPct].sort((a, b) => b.percentage - a.percentage)[0];
  const bottom = [...withPct].sort((a, b) => a.percentage - b.percentage)[0];
  const proofCount = assessments.filter(r => r.paperSnapshotUrl).length;

  const cards = [
    { label: 'Overall Avg', value: `${Math.round(avg)}%`, icon: BarChart3, color: 'text-[#4F46E5]', bg: 'bg-indigo-50' },
    { label: 'Best Subject', value: top?.test?.learningArea?.split(' ')[0] || '-', sub: top ? `${Math.round(top.percentage)}%` : '', icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Needs Focus', value: bottom?.test?.learningArea?.split(' ')[0] || '-', sub: bottom ? `${Math.round(bottom.percentage)}%` : '', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Paper Proofs', value: `${proofCount}/${assessments.length}`, icon: Camera, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={16} className={c.color} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium">{c.label}</p>
              <p className="text-base font-bold text-gray-900 truncate">{c.value}</p>
              {c.sub && <p className="text-[10px] text-gray-400">{c.sub}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Main component
export default function LearnerAcademicTab({ assessments: initialAssessments, learnerId, loading }) {
  const [assessments, setAssessments] = useState(initialAssessments || []);
  const [filterTerm, setFilterTerm] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  // Keep in sync when parent refreshes
  React.useEffect(() => { setAssessments(initialAssessments || []); }, [initialAssessments]);

  const handleSnapshotSaved = useCallback((resultId, url) => {
    setAssessments(prev => prev.map(r => r.id === resultId ? { ...r, paperSnapshotUrl: url } : r));
  }, []);

  // Get unique terms and years for filter dropdowns
  const terms = [...new Set(assessments.map(r => r.test?.term).filter(Boolean))];
  const years = [...new Set(assessments.map(r => r.test?.academicYear).filter(Boolean))].sort((a, b) => b - a);

  const filtered = assessments.filter(r => {
    if (filterTerm !== 'all' && r.test?.term !== filterTerm) return false;
    if (filterYear !== 'all' && String(r.test?.academicYear) !== filterYear) return false;
    return true;
  });

  // Group by term + year
  const groups = filtered.reduce((acc, r) => {
    const key = `${r.test?.term || 'UNKNOWN'}_${r.test?.academicYear || ''}`;
    if (!acc[key]) acc[key] = { term: r.test?.term, year: r.test?.academicYear, results: [] };
    acc[key].results.push(r);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4F46E5]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <AcademicSummary assessments={assessments} />

      {/* Filters + info bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Filter size={12} />
            <span className="font-semibold">Filter:</span>
          </div>
          <select
            value={filterTerm}
            onChange={e => setFilterTerm(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 bg-white"
          >
            <option value="all">All Terms</option>
            {terms.map(t => <option key={t} value={t}>{formatTerm(t)}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 bg-white"
          >
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Camera size={12} />
          <span>{assessments.filter(r => r.paperSnapshotUrl).length}/{assessments.length} paper proofs</span>
        </div>
      </div>

      {/* Term groups */}
      {Object.keys(groups).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groups).map(([key, group]) => (
            <TermGroup
              key={key}
              term={group.term}
              year={group.year}
              results={group.results}
              learnerId={learnerId}
              onSnapshotSaved={handleSnapshotSaved}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center">
          <GraduationCap size={40} className="mb-3 text-gray-200" />
          <p className="text-sm font-semibold text-gray-500">No assessment records found</p>
          <p className="text-xs text-gray-400 mt-1">Results will appear here once teachers record summative scores.</p>
        </div>
      )}
    </div>
  );
}
