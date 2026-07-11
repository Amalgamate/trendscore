/**
 * MyAssignments — Student's assignments across all enrolled courses
 * Tabs: Active | Submitted | Graded
 */
import React, { useState, useEffect } from 'react';
import { ClipboardList, Calendar, CheckCircle, Clock, Award, Send, Eye } from 'lucide-react';
import axiosInstance from '../../../../services/api/axiosConfig';
import SubmissionModal from './SubmissionModal';

const TABS = [
  { id: 'active',    label: 'Active',    icon: Clock },
  { id: 'submitted', label: 'Submitted', icon: Send },
  { id: 'graded',    label: 'Graded',    icon: Award },
];

const MyAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [submitting, setSubmitting] = useState(null); // assignment being submitted

  const fetchAssignments = () => {
    axiosInstance.get('/lms/my-assignments')
      .then(r => setAssignments(r.data?.data || []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAssignments(); }, []);

  const now = new Date();

  const filtered = assignments.filter(a => {
    const sub = a.mySubmission;
    if (tab === 'active') return !sub && (!a.dueDate || new Date(a.dueDate) > now);
    if (tab === 'submitted') return sub && (sub.marks === null || sub.marks === undefined);
    if (tab === 'graded') return sub && sub.marks !== null && sub.marks !== undefined;
    return true;
  });

  const counts = {
    active:    assignments.filter(a => !a.mySubmission && (!a.dueDate || new Date(a.dueDate) > now)).length,
    submitted: assignments.filter(a => a.mySubmission && (a.mySubmission.marks === null || a.mySubmission.marks === undefined)).length,
    graded:    assignments.filter(a => a.mySubmission?.marks !== null && a.mySubmission?.marks !== undefined).length,
  };

  const isOverdue = (a) => a.dueDate && new Date(a.dueDate) < now && !a.mySubmission;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList size={22} className="text-purple-600" /> My Assignments
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{assignments.length} total assignment{assignments.length !== 1 ? 's' : ''} across your courses</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${active ? 'border-purple-600 text-purple-700 bg-purple-50/50' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              >
                <Icon size={14} /> {t.label}
                {counts[t.id] > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${active ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {counts[t.id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading assignments…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">
              {tab === 'active' ? 'No active assignments right now.' : tab === 'submitted' ? 'No submitted assignments awaiting grading.' : 'No graded assignments yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[color:var(--table-border)]">
                <tr>
                  <th className="px-5 py-3.5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Assignment</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Class</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Due</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Points</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-semibold text-[color:var(--table-header-fg)] uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-purple-50/20 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-800">{a.title}</p>
                      {a.instructions && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{a.instructions}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-600">{a.class?.name}</p>
                      <p className="text-xs text-gray-400">{a.learningArea?.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      {a.dueDate ? (
                        <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue(a) ? 'text-red-500' : 'text-gray-600'}`}>
                          <Calendar size={11} />
                          {new Date(a.dueDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                          {isOverdue(a) && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold uppercase">Overdue</span>}
                        </span>
                      ) : <span className="text-xs text-gray-400">No deadline</span>}
                    </td>
                    <td className="px-5 py-4">
                      {tab === 'graded' && a.mySubmission?.marks !== null && a.mySubmission?.marks !== undefined ? (
                        <span className="text-sm font-semibold text-purple-700">{a.mySubmission.marks}/{a.totalMarks}</span>
                      ) : (
                        <span className="text-sm font-medium text-gray-600">{a.totalMarks} pts</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {!a.mySubmission ? (
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider ${isOverdue(a) ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isOverdue(a) ? 'Overdue' : 'Pending'}
                        </span>
                      ) : a.mySubmission.marks !== null && a.mySubmission.marks !== undefined ? (
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                          <CheckCircle size={10} /> Graded
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider bg-amber-100 text-amber-700 w-fit block">
                          Awaiting Grade
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {!a.mySubmission && (
                        <button
                          onClick={() => setSubmitting(a)}
                          className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                        >
                          <Send size={11} /> Submit
                        </button>
                      )}
                      {a.mySubmission && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Eye size={10} /> Submitted {a.mySubmission.submittedAt ? new Date(a.mySubmission.submittedAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submission modal */}
      {submitting && (
        <SubmissionModal
          assignment={submitting}
          onClose={() => setSubmitting(null)}
          onSubmitted={() => { setSubmitting(null); fetchAssignments(); }}
        />
      )}
    </div>
  );
};

export default MyAssignments;
