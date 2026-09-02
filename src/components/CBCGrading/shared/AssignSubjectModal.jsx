/**
 * AssignSubjectModal
 * Lets an admin / head teacher assign or remove subject (learning area) allocations
 * for a specific teacher directly from their profile page.
 *
 * Props:
 *   isOpen    {boolean}
 *   onClose   {() => void}
 *   teacher   { id, firstName, lastName }
 *   onSaved   {() => void}  — called after any successful add/remove to trigger a refresh
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import api from '../../../services/api';
import { cn } from '../../../utils/cn';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (grade) =>
  String(grade || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Common CBC grade codes — used to populate the grade selector.
// The admin can also type a custom value via the "Other" option.
const GRADE_OPTIONS = [
  'PLAYGROUP', 'PP1', 'PP2',
  'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6',
  'GRADE_7', 'GRADE_8', 'GRADE_9',
  'GRADE10', 'GRADE11', 'GRADE12',
];

// ── sub-components ────────────────────────────────────────────────────────────

const Spinner = ({ size = 16 }) => (
  <Loader2 size={size} className="animate-spin" />
);

// ── main component ────────────────────────────────────────────────────────────

const AssignSubjectModal = ({ isOpen, onClose, teacher, onSaved }) => {
  // ── existing assignments ──────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // ── learning areas list ───────────────────────────────────────────────────
  const [learningAreas, setLearningAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);

  // ── form state ────────────────────────────────────────────────────────────
  const [selectedGrade, setSelectedGrade] = useState('');
  const [customGrade, setCustomGrade] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const grade = selectedGrade === '__custom__' ? customGrade.trim() : selectedGrade;

  // ── load data when modal opens ────────────────────────────────────────────
  const loadAssignments = useCallback(async () => {
    if (!teacher?.id) return;
    setLoadingAssignments(true);
    try {
      const res = await api.subjectAssignments.getAll({ teacherId: teacher.id });
      setAssignments(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load subject assignments:', err);
    } finally {
      setLoadingAssignments(false);
    }
  }, [teacher?.id]);

  const loadLearningAreas = useCallback(async () => {
    setLoadingAreas(true);
    try {
      const res = await api.getLearningAreas({}, { fresh: false });
      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setLearningAreas(rows);
    } catch (err) {
      console.error('Failed to load learning areas:', err);
    } finally {
      setLoadingAreas(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !teacher) return;
    setError('');
    setSuccessMsg('');
    setSelectedGrade('');
    setCustomGrade('');
    setSelectedAreaId('');
    loadAssignments();
    loadLearningAreas();
  }, [isOpen, teacher, loadAssignments, loadLearningAreas]);

  // ── derived: areas already assigned for the chosen grade ─────────────────
  const assignedAreaIdsForGrade = useMemo(() => {
    if (!grade) return new Set();
    return new Set(
      assignments
        .filter((a) => a.grade === grade)
        .map((a) => a.learningAreaId)
    );
  }, [assignments, grade]);

  // ── add assignment ────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!grade || !selectedAreaId) {
      setError('Please select both a grade and a subject.');
      return;
    }
    if (assignedAreaIdsForGrade.has(selectedAreaId)) {
      setError('This subject is already assigned to the teacher for this grade.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.subjectAssignments.create({
        teacherId: teacher.id,
        learningAreaId: selectedAreaId,
        grade,
      });
      setSuccessMsg('Subject assigned successfully.');
      setSelectedAreaId('');
      await loadAssignments();
      onSaved?.();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to assign subject. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── remove assignment ─────────────────────────────────────────────────────
  const handleRemove = async (assignmentId) => {
    setRemovingId(assignmentId);
    setError('');
    try {
      await api.subjectAssignments.delete(assignmentId);
      setSuccessMsg('Assignment removed.');
      await loadAssignments();
      onSaved?.();
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err) {
      setError(err?.message || 'Failed to remove assignment.');
    } finally {
      setRemovingId(null);
    }
  };

  if (!isOpen) return null;

  // Group existing assignments by grade for a clean display
  const byGrade = assignments.reduce((acc, a) => {
    const g = a.grade || 'Unknown';
    if (!acc[g]) acc[g] = [];
    acc[g].push(a);
    return acc;
  }, {});

  const sortedGrades = Object.keys(byGrade).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-brand-teal/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-teal/10 flex items-center justify-center text-brand-teal">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Assign Subjects</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {teacher?.firstName} {teacher?.lastName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── add new assignment form ── */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Add a subject assignment
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Grade picker */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Grade
                </label>
                <div className="relative">
                  <select
                    value={selectedGrade}
                    onChange={(e) => {
                      setSelectedGrade(e.target.value);
                      setError('');
                    }}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 appearance-none"
                  >
                    <option value="">Select grade…</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>{fmt(g)}</option>
                    ))}
                    <option value="__custom__">Other (type below)</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>

                {selectedGrade === '__custom__' && (
                  <input
                    type="text"
                    value={customGrade}
                    onChange={(e) => setCustomGrade(e.target.value)}
                    placeholder="e.g. GRADE_4"
                    className="mt-2 w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                  />
                )}
              </div>

              {/* Learning area picker */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Subject / Learning Area
                </label>
                <div className="relative">
                  {loadingAreas ? (
                    <div className="h-10 rounded-xl border border-gray-200 bg-gray-50 flex items-center px-3 gap-2 text-sm text-gray-400">
                      <Spinner size={14} /> Loading subjects…
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedAreaId}
                        onChange={(e) => {
                          setSelectedAreaId(e.target.value);
                          setError('');
                        }}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 appearance-none"
                      >
                        <option value="">Select subject…</option>
                        {learningAreas.map((la) => (
                          <option key={la.id} value={la.id}>
                            {la.name}
                            {la.shortName && la.shortName !== la.name ? ` (${la.shortName})` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* feedback */}
            {error && (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </div>
            )}
            {successMsg && (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <Check size={13} className="shrink-0" />
                {successMsg}
              </div>
            )}

            {/* add button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !grade || !selectedAreaId}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand-teal text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-teal/90 transition"
              >
                {saving ? <Spinner size={14} /> : <Plus size={14} />}
                Assign Subject
              </button>
            </div>
          </div>

          {/* ── current assignments ── */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Current subject assignments
            </p>

            {loadingAssignments ? (
              <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                <Spinner size={18} />
                <span className="text-sm">Loading assignments…</span>
              </div>
            ) : sortedGrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                  <GraduationCap size={22} className="text-gray-200" />
                </div>
                <p className="text-sm font-medium text-gray-600">No subjects assigned yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Use the form above to add the first subject.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedGrades.map((g) => (
                  <div key={g} className="overflow-hidden rounded-xl border border-gray-100">
                    {/* grade header */}
                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                      <GraduationCap size={13} className="text-brand-teal shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-600">
                        {fmt(g)}
                      </span>
                      <span className="ml-auto text-[10px] font-medium text-gray-400">
                        {byGrade[g].length} subject{byGrade[g].length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* subject rows */}
                    {byGrade[g].map((a, idx) => {
                      const areaName = a.learningArea?.name || a.learningAreaName || '—';
                      const shortName = a.learningArea?.shortName;
                      const isLast = idx === byGrade[g].length - 1;
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 bg-white hover:bg-brand-teal/[0.02] transition',
                            !isLast && 'border-b border-gray-50'
                          )}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10">
                            <BookOpen size={13} className="text-brand-teal" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{areaName}</p>
                            {shortName && shortName !== areaName && (
                              <p className="text-[11px] text-gray-400">{shortName}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemove(a.id)}
                            disabled={removingId === a.id}
                            title="Remove assignment"
                            className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                          >
                            {removingId === a.id ? <Spinner size={13} /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── footer ── */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default AssignSubjectModal;
