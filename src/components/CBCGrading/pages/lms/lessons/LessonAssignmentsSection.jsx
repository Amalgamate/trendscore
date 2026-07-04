import React, { useEffect, useMemo, useState } from 'react';
import { Check, FileText, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { cn } from '../../../../../utils/cn';

const getAssignmentBlocks = (blocks = []) => blocks.filter((block) => block.type === 'ASSIGNMENT');

const normalizeBlocksForSave = (blocks) => blocks.map((block, index) => {
  const normalized = {
    type: block.type,
    order: index + 1,
    content: block.content || {},
  };
  if (
    block.id &&
    !String(block.id).startsWith('assignment-') &&
    !String(block.id).startsWith('new-') &&
    !String(block.id).startsWith('dup-')
  ) {
    normalized.id = block.id;
  }
  return normalized;
});

const formatDate = (value) => {
  if (!value) return 'No due date';
  return new Date(value).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
};

export default function LessonAssignmentsSection({
  lesson,
  blocks,
  onBlocksUpdate,
  onNavigate,
}) {
  const [showSelector, setShowSelector] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const assignmentBlocks = useMemo(() => getAssignmentBlocks(blocks), [blocks]);
  const linkedAssignmentIds = useMemo(
    () => new Set(assignmentBlocks.map((block) => block.content?.assignmentId).filter(Boolean)),
    [assignmentBlocks],
  );

  useEffect(() => {
    if (!showSelector) return;
    let cancelled = false;

    const loadAssignments = async () => {
      setLoading(true);
      setError('');
      try {
        const filters = {
          limit: 50,
          ...(lesson?.classId && { classId: lesson.classId }),
          ...(lesson?.learningAreaId && { learningAreaId: lesson.learningAreaId }),
          ...(lesson?.termId && { termId: lesson.termId }),
        };
        const response = await lmsAPI.getAssignments(filters);
        const list = response?.data?.assignments || response?.assignments || [];
        if (!cancelled) setAssignments(list);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load assignments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAssignments();
    return () => { cancelled = true; };
  }, [lesson?.classId, lesson?.learningAreaId, lesson?.termId, showSelector]);

  const saveBlocks = async (nextBlocks) => {
    onBlocksUpdate?.(nextBlocks);
    if (lesson?.id) {
      await lmsAPI.upsertLessonBlocks(lesson.id, normalizeBlocksForSave(nextBlocks));
    }
  };

  const handleAddAssignment = async (assignment) => {
    if (!assignment?.id || linkedAssignmentIds.has(assignment.id)) return;
    setSavingId(assignment.id);
    try {
      const nextBlocks = [
        ...blocks,
        {
          id: `assignment-${Date.now()}`,
          type: 'ASSIGNMENT',
          order: blocks.length + 1,
          content: {
            assignmentId: assignment.id,
            title: assignment.title,
            dueDate: assignment.dueDate || null,
            totalMarks: assignment.totalMarks || null,
          },
        },
      ];
      await saveBlocks(nextBlocks);
      setShowSelector(false);
    } catch (err) {
      setError(err?.message || 'Failed to add assignment');
    } finally {
      setSavingId(null);
    }
  };

  const handleRemoveAssignment = async (blockId) => {
    const nextBlocks = blocks
      .filter((block) => block.id !== blockId)
      .map((block, index) => ({ ...block, order: index + 1 }));
    await saveBlocks(nextBlocks);
  };

  const visibleAssignments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((assignment) => (
      assignment.title?.toLowerCase().includes(q) ||
      assignment.learningArea?.name?.toLowerCase().includes(q) ||
      assignment.class?.name?.toLowerCase().includes(q)
    ));
  }, [assignments, query]);

  return (
    <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Assignments</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Link student work directly into this lesson.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSelector(true)}
            disabled={!lesson}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ff7900] px-3 py-2 text-xs font-bold text-[#ff7900] hover:bg-[#ff7900]/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('learning-assignment-create')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ff7900] px-3 py-2 text-xs font-bold text-white hover:bg-[#ff7900]/90"
          >
            <FileText size={14} />
            Create
          </button>
        </div>
      </div>

      {!lesson ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          Create the lesson first, then attach assignments.
        </p>
      ) : assignmentBlocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          No assignments linked to this lesson yet.
        </p>
      ) : (
        <div className="space-y-2">
          {assignmentBlocks.map((block) => (
            <div key={block.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <FileText size={16} className="text-[#ff7900]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {block.content?.title || block.content?.assignmentId || 'Assignment'}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(block.content?.dueDate)}
                  {block.content?.totalMarks ? ` · ${block.content.totalMarks} marks` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAssignment(block.id)}
                className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                aria-label="Remove assignment"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showSelector && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h4 className="font-bold text-slate-900">Add assignment to lesson</h4>
              <button type="button" onClick={() => setShowSelector(false)} className="rounded-lg p-2 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search assignments..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-[#ff7900] focus:bg-white"
                />
              </div>
              {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            </div>
            <div className="max-h-[52vh] overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-500">
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Loading assignments...
                </div>
              ) : visibleAssignments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                  No matching assignments found.
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleAssignments.map((assignment) => {
                    const linked = linkedAssignmentIds.has(assignment.id);
                    return (
                      <button
                        key={assignment.id}
                        type="button"
                        onClick={() => handleAddAssignment(assignment)}
                        disabled={linked || savingId === assignment.id}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition',
                          linked ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-white hover:border-[#ff7900]/40 hover:bg-orange-50/40',
                        )}
                      >
                        <FileText size={17} className={linked ? 'text-emerald-600' : 'text-[#ff7900]'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{assignment.title}</p>
                          <p className="text-xs text-slate-500">
                            {assignment.class?.name || 'Class'} · {assignment.learningArea?.name || 'Subject'} · {formatDate(assignment.dueDate)}
                          </p>
                        </div>
                        {savingId === assignment.id ? (
                          <Loader2 size={16} className="animate-spin text-[#ff7900]" />
                        ) : linked ? (
                          <Check size={16} className="text-emerald-600" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
