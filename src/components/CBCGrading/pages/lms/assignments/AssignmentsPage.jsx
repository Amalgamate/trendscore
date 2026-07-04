/**
 * AssignmentsPage — Teacher/Student Assignment Manager
 * 
 * Teacher View:
 * - Paginated table of assignments (title, class, subject, due date, status, actions)
 * - Filters: status, class, subject, category
 * - Actions: View, Edit, Publish, Close, Delete
 * 
 * Student View (role-gated):
 * - Card grid of published assignments for student's class
 * - Shows: title, due date, status badge, submit button
 * - Click to open StudentAssignmentView or existing submission
 * 
 * Requirements: 3.1, 4.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Send,
} from 'lucide-react';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { Skeleton } from '../../../../ui';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusBadge = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'PUBLISHED') return { label: 'Live', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 };
  if (s === 'DRAFT') return { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600', icon: FileText };
  if (s === 'CLOSED') return { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-600', icon: AlertCircle };
  return { label: s, bg: 'bg-gray-100', text: 'text-gray-600', icon: FileText };
};

const submissionStatusBadge = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'MARKED') return { label: 'Marked', color: 'text-emerald-600' };
  if (s === 'SUBMITTED') return { label: 'Submitted', color: 'text-blue-600' };
  if (s === 'LATE') return { label: 'Late', color: 'text-amber-600' };
  if (s === 'DRAFT') return { label: 'Draft', color: 'text-slate-500' };
  if (s === 'PENDING') return { label: 'Pending', color: 'text-slate-500' };
  return { label: 'No submission', color: 'text-slate-400' };
};

// ─── Teacher View: Assignment Table ─────────────────────────────────────────

function AssignmentRow({ assignment, onView, onEdit, onPublish, onClose, onDelete }) {
  const status = statusBadge(assignment.status);
  const StatusIcon = status.icon;

  return (
    <div className="p-4 border-b border-slate-100 hover:bg-slate-50 transition">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title & Metadata */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-slate-900 truncate">{assignment.title}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">{assignment.class?.name || 'Class'}</span>
            {assignment.learningArea && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">{assignment.learningArea.name}</span>
              </>
            )}
            {assignment.dueDate && (
              <>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1">
                  <Clock size={12} className="text-slate-400" />
                  <span className="text-xs text-slate-500">{fmtDate(assignment.dueDate)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Status + Counts + Actions */}
        <div className="flex items-center gap-4">
          {/* Status Badge */}
          <div className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.text} flex items-center gap-1 whitespace-nowrap`}>
            <StatusIcon size={14} />
            {status.label}
          </div>

          {/* Submission Count */}
          {assignment._count?.submissions > 0 && (
            <div className="text-xs text-slate-600">
              <span className="font-semibold">{assignment._count.submissions}</span> submitted
            </div>
          )}

          {/* Actions Dropdown */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onView(assignment)}
              className="p-1.5 rounded hover:bg-slate-200 transition"
              title="View assignment"
            >
              <Eye size={16} className="text-slate-600" />
            </button>

            {assignment.status === 'DRAFT' && (
              <>
                <button
                  onClick={() => onEdit(assignment)}
                  className="p-1.5 rounded hover:bg-slate-200 transition"
                  title="Edit"
                >
                  <Edit2 size={16} className="text-slate-600" />
                </button>
                <button
                  onClick={() => onPublish(assignment)}
                  className="p-1.5 rounded hover:bg-emerald-100 transition"
                  title="Publish"
                >
                  <Send size={16} className="text-emerald-600" />
                </button>
              </>
            )}

            {assignment.status === 'PUBLISHED' && (
              <button
                onClick={() => onClose(assignment)}
                className="p-1.5 rounded hover:bg-amber-100 transition"
                title="Close"
              >
                <AlertCircle size={16} className="text-amber-600" />
              </button>
            )}

            <button
              onClick={() => onDelete(assignment)}
              className="p-1.5 rounded hover:bg-rose-100 transition"
              title="Delete"
            >
              <Trash2 size={16} className="text-rose-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherAssignmentTable({
  assignments,
  loading,
  onView,
  onEdit,
  onPublish,
  onClose,
  onDelete,
  onCreateNew,
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
        <FileText size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-600 font-medium">No assignments yet</p>
        <p className="text-sm text-slate-500 mt-1">Create your first assignment to get started</p>
        <button
          onClick={onCreateNew}
          className="mt-4 px-4 py-2 bg-[#ff7900] text-white rounded-lg hover:bg-[#ff7900]/90 transition text-sm font-medium"
        >
          + Create Assignment
        </button>
      </div>
    );
  }

  return (
    <div className="border border-slate-100 rounded-lg bg-white overflow-hidden">
      <div className="divide-y divide-slate-100">
        {assignments.map((assignment) => (
          <AssignmentRow
            key={assignment.id}
            assignment={assignment}
            onView={onView}
            onEdit={onEdit}
            onPublish={onPublish}
            onClose={onClose}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Student View: Assignment Card ──────────────────────────────────────────

function StudentAssignmentCard({ assignment, onSelect }) {
  const submissionStatus = submissionStatusBadge(assignment.mySubmission?.status || 'PENDING');
  const isLate = assignment.mySubmission?.isLate;

  return (
    <div
      onClick={onSelect}
      className="p-4 border border-slate-100 rounded-lg hover:shadow-md hover:border-[#ff7900]/40 transition-all bg-white cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-semibold text-sm text-slate-900">{assignment.title}</h4>
        <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${submissionStatus.color}`}>
          {submissionStatus.label}
          {isLate && ' 🚨'}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-500">{assignment.learningArea?.name}</p>

        {assignment.dueDate && (
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-slate-400" />
            <span className="text-xs text-slate-600">{fmtDate(assignment.dueDate)}</span>
          </div>
        )}

        {assignment.totalMarks && assignment.mySubmission?.marks !== undefined && assignment.mySubmission?.marks !== null && (
          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs">
              <span className="font-semibold text-emerald-600">{assignment.mySubmission.marks}</span>
              <span className="text-slate-500"> / {assignment.totalMarks} marks</span>
            </div>
          </div>
        )}
      </div>

      <button className="mt-3 w-full py-2 text-sm font-medium bg-[#ff7900]/10 text-[#ff7900] rounded hover:bg-[#ff7900]/20 transition flex items-center justify-center gap-2">
        <ChevronRight size={16} />
        {assignment.mySubmission ? 'View' : 'Submit'} Assignment
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function AssignmentsPage({ onNavigate }) {
  const { user } = usePermissions();
  const isStudent = user?.role === 'STUDENT';

  // State
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters (teacher view only)
  const [statusFilter, setStatusFilter] = useState(null);
  const [classFilter, setClassFilter] = useState(null);
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load data
  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (isStudent) {
        response = await lmsAPI.getStudentAssignments?.();
        // getStudentAssignments returns an array directly
        let data = Array.isArray(response?.data) ? response.data : [];

        // Client-side search filter
        if (searchQuery) {
          data = data.filter((a) =>
            a.title?.toLowerCase().includes(searchQuery.toLowerCase()),
          );
        }

        setAssignments(data);
      } else {
        const filters = {};
        if (statusFilter) filters.status = statusFilter;
        if (classFilter) filters.classId = classFilter;
        if (subjectFilter) filters.learningAreaId = subjectFilter;
        response = await lmsAPI.getAssignments?.(filters);
        // getAssignments returns { assignments: [], pagination: {} }
        let data = response?.data?.assignments || [];

        // Client-side search filter
        if (searchQuery) {
          data = data.filter((a) =>
            a.title?.toLowerCase().includes(searchQuery.toLowerCase()),
          );
        }

        setAssignments(data);
      }
    } catch (err) {
      console.error('Error loading assignments:', err);
      setError('Failed to load assignments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isStudent, statusFilter, classFilter, subjectFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAssignments();
    setRefreshing(false);
  };

  const handleCreateNew = () => {
    if (onNavigate) {
      onNavigate('learning-assignment-create');
    }
  };

  const handleEditAssignment = (assignment) => {
    if (onNavigate) {
      onNavigate('learning-assignment-edit', { assignmentId: assignment.id });
    }
  };

  const handleViewAssignment = (assignment) => {
    if (onNavigate) {
      if (isStudent) {
        onNavigate('learning-assignment-detail', { assignmentId: assignment.id });
      } else {
        onNavigate('learning-assignment-detail', { assignmentId: assignment.id });
      }
    }
  };

  const handlePublish = async (assignment) => {
    if (window.confirm(`Publish "${assignment.title}"? Students will receive notifications.`)) {
      try {
        await lmsAPI.publishAssignment?.(assignment.id);
        await loadAssignments();
      } catch (err) {
        alert('Failed to publish assignment');
      }
    }
  };

  const handleClose = async (assignment) => {
    if (window.confirm(`Close "${assignment.title}"? Students will no longer be able to submit.`)) {
      try {
        await lmsAPI.closeAssignment?.(assignment.id);
        await loadAssignments();
      } catch (err) {
        alert('Failed to close assignment');
      }
    }
  };

  const handleDelete = async (assignment) => {
    if (window.confirm(`Delete "${assignment.title}"? This cannot be undone.`)) {
      try {
        await lmsAPI.deleteAssignment?.(assignment.id);
        await loadAssignments();
      } catch (err) {
        alert('Failed to delete assignment');
      }
    }
  };

  if (error) {
    return (
      <div className="p-8 border border-rose-200 rounded-lg bg-rose-50">
        <AlertCircle size={32} className="mx-auto text-rose-500 mb-2" />
        <p className="text-sm text-rose-700">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-3 px-4 py-2 text-sm font-medium bg-rose-500 text-white rounded hover:bg-rose-600 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">
          {isStudent ? 'My Assignments' : 'Assignments'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {!isStudent && (
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-[#ff7900] text-white rounded-lg hover:bg-[#ff7900]/90 transition font-medium text-sm flex items-center gap-2"
            >
              <Plus size={18} />
              Create
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters (Teacher View Only) */}
      {!isStudent && (
        <div className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <Filter size={18} className="text-slate-400" />
          {/* Add more filter UI as needed */}
        </div>
      )}

      {/* Content */}
      {isStudent ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-lg" />
              ))}
            </>
          ) : assignments.length === 0 ? (
            <div className="col-span-full p-12 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
              <CheckCircle2 size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No assignments assigned yet</p>
            </div>
          ) : (
            assignments.map((assignment) => (
              <StudentAssignmentCard
                key={assignment.id}
                assignment={assignment}
                onSelect={() => handleViewAssignment(assignment)}
              />
            ))
          )}
        </div>
      ) : (
        <TeacherAssignmentTable
          assignments={assignments}
          loading={loading}
          onView={handleViewAssignment}
          onEdit={handleEditAssignment}
          onPublish={handlePublish}
          onClose={handleClose}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
        />
      )}
    </div>
  );
}
