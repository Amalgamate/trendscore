/**
 * ParentPortalHomework
 *
 * Per-child assignment tracker for parents.
 * Fetches real assignment/submission data from
 * GET /api/lms/children/:learnerId/assignments (Batch 4 endpoint).
 *
 * Three honest states per child:
 *   1. "No assignments issued yet" — no published assignments for the class
 *   2. "All caught up 🎉"          — assignments exist but none are pending/overdue
 *   3. Assignment list             — sorted by due date, with status pills
 *
 * Status pills: Not submitted · Submitted · Late · Graded (with marks)
 * Overdue badge shown when dueDate has passed and nothing was submitted.
 *
 * Batch 5, Assessment UX Overhaul.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, BookOpen, CheckCircle2,
  Clock, AlertCircle, Star, Users,
} from 'lucide-react';
import api from '../../../../services/api';
import { dashboardAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

function statusConfig(statusSummary, isOverdue) {
  if (isOverdue) {
    return {
      label: 'Overdue',
      cls: 'bg-rose-100 text-rose-700 border border-rose-200',
      icon: AlertCircle,
    };
  }
  switch (statusSummary) {
    case 'MARKED':
      return { label: 'Graded', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: Star };
    case 'SUBMITTED':
      return { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 border border-blue-200', icon: CheckCircle2 };
    case 'LATE':
      return { label: 'Late', cls: 'bg-amber-100 text-amber-700 border border-amber-200', icon: Clock };
    default:
      return { label: 'Not submitted', cls: 'bg-gray-100 text-gray-600 border border-gray-200', icon: BookOpen };
  }
}

/** Count pending (not submitted, not overdue-only-no-submission) assignments */
function pendingCount(assignments) {
  return assignments.filter(
    (a) => a.statusSummary === 'NOT_SUBMITTED' && !a.isOverdue,
  ).length;
}

function overdueCount(assignments) {
  return assignments.filter((a) => a.isOverdue).length;
}

// ─── Assignment Row ────────────────────────────────────────────────────────────

function AssignmentRow({ assignment }) {
  const { label, cls, icon: Icon } = statusConfig(
    assignment.statusSummary,
    assignment.isOverdue,
  );
  const subject = assignment.learningArea?.name || '—';
  const marks   = assignment.mySubmission?.marks;
  const total   = assignment.totalMarks;

  return (
    <div className="px-3 py-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <BookOpen size={14} className="text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{assignment.title}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{subject} · Due {fmtDate(assignment.dueDate)}</p>
        {assignment.statusSummary === 'MARKED' && marks != null && total != null && (
          <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{marks}/{total} marks</p>
        )}
        {assignment.mySubmission?.feedback && (
          <p className="text-[10px] text-gray-500 italic mt-0.5 line-clamp-2">
            "{assignment.mySubmission.feedback}"
          </p>
        )}
      </div>
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${cls}`}>
        <Icon size={10} />
        {label}
      </span>
    </div>
  );
}

// ─── Child Homework Card ───────────────────────────────────────────────────────

function ChildHomeworkCard({ child }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [expanded, setExpanded]       = useState(false);
  const [filter, setFilter]           = useState('all'); // 'all' | 'pending' | 'graded'

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.lms.getChildAssignments(child.id);
      setAssignments(res?.data || []);
    } catch (e) {
      setError(e?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [child.id]);

  useEffect(() => { load(); }, [load]);

  const overdue  = overdueCount(assignments);
  const pending  = pendingCount(assignments);
  const photoSrc = child?.photoUrl || child?.profilePicture || null;

  const filtered = filter === 'pending'
    ? assignments.filter((a) => a.statusSummary === 'NOT_SUBMITTED' || a.isOverdue)
    : filter === 'graded'
    ? assignments.filter((a) => a.statusSummary === 'MARKED')
    : assignments;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={child.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-indigo-400 flex-shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div
          style={{ display: photoSrc ? 'none' : 'flex' }}
          className="w-10 h-10 rounded-full bg-indigo-50 border-2 border-indigo-400 text-indigo-700 font-bold text-sm items-center justify-center flex-shrink-0"
        >
          {child.name?.[0] || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 truncate">{child.name}</p>
          <p className="text-[10px] font-semibold text-indigo-600">{child.grade}</p>
        </div>

        {/* Summary badges */}
        {!loading && !error && assignments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {overdue > 0 && (
              <span className="rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-700">
                {overdue} overdue
              </span>
            )}
            {pending > 0 && overdue === 0 && (
              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-700">
                {pending} pending
              </span>
            )}
            {!overdue && !pending && (
              <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                All caught up
              </span>
            )}
          </div>
        )}

        {expanded
          ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" />
          : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {loading && (
            <div className="p-3 space-y-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-3">
              <p className="text-xs text-rose-600">{error}</p>
            </div>
          )}

          {!loading && !error && assignments.length === 0 && (
            <div className="px-4 py-6 text-center">
              <BookOpen size={22} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-gray-500">No assignments issued yet</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Assignments will appear here once the teacher publishes them.
              </p>
            </div>
          )}

          {!loading && !error && assignments.length > 0 && (
            <>
              {/* Filter tabs */}
              <div className="flex gap-2 px-3 pt-3">
                {[
                  { key: 'all',     label: `All (${assignments.length})` },
                  { key: 'pending', label: `Pending (${pendingCount(assignments) + overdueCount(assignments)})` },
                  { key: 'graded',  label: `Graded (${assignments.filter(a => a.statusSummary === 'MARKED').length})` },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      filter === key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <CheckCircle2 size={20} className="mx-auto mb-1.5 text-emerald-400" />
                  <p className="text-xs font-semibold text-gray-500">
                    {filter === 'pending' ? 'Nothing pending — all caught up 🎉' : 'No graded assignments yet'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 mt-2">
                  {filtered.map((a) => (
                    <AssignmentRow key={a.id} assignment={a} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ParentPortalHomework = ({ onNavigate }) => {
  const [children, setChildren]       = useState([]);
  const [loadingChildren, setLoading] = useState(true);
  const [error, setError]             = useState(null);

  const loadChildren = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setChildren(res.data?.children || []);
      else setError(res?.message || 'Failed to load');
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-20">
      <div className="pt-1 space-y-3">

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        {loadingChildren && (
          <div className="space-y-2.5">
            {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {!loadingChildren && children.length === 0 && !error && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No children linked</p>
          </div>
        )}

        {!loadingChildren && children.length > 0 && (
          <div className="space-y-2.5">
            {children.map((child) => (
              <ChildHomeworkCard key={child.id} child={child} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default ParentPortalHomework;
