/**
 * SubjectAllocationPage
 *
 * Redesigned to show one row per (class × learning area) combination.
 * Each active class — including every stream — appears as its own group,
 * so "Grade 1 Blue" and "Grade 1 Red" each get their own assignment rows.
 *
 * Row key:   `${classId}:${areaId}`
 * Assignment lookup:  match on (learningAreaId + classId) first;
 *                     fall back to (learningAreaId + grade, classId=null)
 *                     for legacy grade-level assignments.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Loader2,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '../../../../components/ui';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { getGradeLabel, GRADES } from '../../../../constants/grades';
import { useSchoolData } from '../../../../contexts/SchoolDataContext';
import { cn } from '../../../../utils/cn';

// ── helpers ───────────────────────────────────────────────────────────────────

const DAY_ALIAS = {
  MONDAY: 'MONDAY', MON: 'MONDAY',
  TUESDAY: 'TUESDAY', TUE: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY', WED: 'WEDNESDAY',
  THURSDAY: 'THURSDAY', THU: 'THURSDAY',
  FRIDAY: 'FRIDAY', FRI: 'FRIDAY',
  SATURDAY: 'SATURDAY', SAT: 'SATURDAY',
  SUNDAY: 'SUNDAY', SUN: 'SUNDAY',
};

const normalizeDay = (day) =>
  DAY_ALIAS[String(day || '').trim().toUpperCase()] || String(day || '').trim().toUpperCase();

const toMinutes = (v) => {
  if (!v) return -1;
  const [h = '0', m = '0'] = String(v).split(':');
  return Number(h) * 60 + Number(m);
};

const teacherName = (t) =>
  t ? `${t.firstName || ''} ${t.lastName || ''}`.trim() : null;

/**
 * Format a class for the Grade column: "Grade 3 · Blue" or just "Grade 3"
 */
const classLabel = (cls) => {
  const grade = getGradeLabel(cls.grade) || cls.grade;
  return cls.stream ? `${grade} · ${cls.stream}` : grade;
};

/**
 * Colour palette for grade-group headers — cycles through preset colours.
 */
const GROUP_COLORS = [
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
];
const colorAt = (i) => GROUP_COLORS[i % GROUP_COLORS.length];

// ── main component ────────────────────────────────────────────────────────────

const SubjectAllocationPage = () => {
  const [loading, setLoading]               = useState(true);
  const [teachers, setTeachers]             = useState([]);
  const [learningAreas, setLearningAreas]   = useState([]);
  const [assignments, setAssignments]       = useState([]);
  const [classes, setClasses]               = useState([]);   // active classes with stream
  const [classSchedules, setClassSchedules] = useState([]);

  const [searchTerm, setSearchTerm]             = useState('');
  const [gradeFilter, setGradeFilter]           = useState('all');
  const [collapsedGroups, setCollapsedGroups]   = useState(new Set());
  const [showAssignModal, setShowAssignModal]   = useState(false);
  const [selectedRow, setSelectedRow]           = useState(null); // { class, area }
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [submitting, setSubmitting]             = useState(false);

  const { showSuccess, showError } = useNotifications();
  const { grades: dynamicGrades }  = useSchoolData();

  const activeGradeValues = useMemo(() => {
    if (Array.isArray(dynamicGrades) && dynamicGrades.length > 0) return dynamicGrades;
    return GRADES.map((g) => g.value);
  }, [dynamicGrades]);

  const activeGradeLabelsUpper = useMemo(
    () => new Set(GRADES.map((g) => String(g.label || '').toUpperCase())),
    [],
  );

  // ── data fetching ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teachersResp, areasResp, assignmentsResp, classesResp] = await Promise.all([
        api.teachers.getAll({ limit: 1000 }),
        api.config.getLearningAreas(),
        api.subjectAssignments.getAll(),
        api.classes.getAll({ active: true }),
      ]);

      const teachersData  = Array.isArray(teachersResp?.data)  ? teachersResp.data  : [];
      const allAreas      = Array.isArray(areasResp?.data)      ? areasResp.data
                          : Array.isArray(areasResp)            ? areasResp
                          : [];

      // Filter to only the grades this school actually uses
      const areasData = allAreas.filter((area) => {
        const g = String(area?.gradeLevel || '').trim();
        if (!g) return false;
        if (activeGradeValues.includes(g)) return true;
        return activeGradeLabelsUpper.has(g.toUpperCase());
      });

      const assignmentsData = Array.isArray(assignmentsResp?.data) ? assignmentsResp.data : [];
      const classesData     = Array.isArray(classesResp?.data)     ? classesResp.data     : [];

      setTeachers(teachersData);
      setLearningAreas(areasData);
      setAssignments(assignmentsData);
      setClasses(classesData);

      // Fetch schedules per class (needed for timetable + current-lesson columns)
      const scheduleResponses = await Promise.all(
        classesData.map(async (classItem) => {
          try {
            const resp      = await api.classes.getSchedules(classItem.id);
            const schedules = Array.isArray(resp?.data) ? resp.data : [];
            return schedules.map((s) => ({
              ...s,
              classId:         classItem.id,
              className:       classItem.name,
              classGrade:      classItem.grade,
              classStream:     classItem.stream,
              classTeacherName: teacherName(classItem.teacher),
            }));
          } catch {
            return [];
          }
        }),
      );
      setClassSchedules(scheduleResponses.flat());
    } catch (err) {
      console.error('Failed to fetch allocation data:', err);
      showError(err.message || 'Failed to load subject allocation data');
    } finally {
      setLoading(false);
    }
  }, [showError, activeGradeValues, activeGradeLabelsUpper]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── row building ────────────────────────────────────────────────────────────
  //
  // One row per (class × learning area that belongs to that class's grade).
  // Rows are grouped by classId so we can render collapsible grade/stream sections.

  const allRows = useMemo(() => {
    const now        = new Date();
    const today      = normalizeDay(now.toLocaleDateString('en-US', { weekday: 'long' }));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Sort classes: by grade code then stream alphabetically
    const sortedClasses = [...classes].sort((a, b) => {
      const g = a.grade.localeCompare(b.grade);
      if (g !== 0) return g;
      return (a.stream || '').localeCompare(b.stream || '');
    });

    return sortedClasses.flatMap((cls) => {
      // Learning areas that belong to this class's grade
      const gradeAreas = learningAreas.filter(
        (area) => area.gradeLevel === cls.grade,
      );

      return gradeAreas.map((area) => {
        // 1. Look for a class-scoped assignment first
        const classAssignment = assignments.find(
          (a) => a.learningAreaId === area.id && a.classId === cls.id,
        );
        // 2. Fall back to a legacy grade-level assignment (classId = null)
        const gradeAssignment = assignments.find(
          (a) => a.learningAreaId === area.id && a.grade === cls.grade && !a.classId,
        );
        const activeAssignment = classAssignment || gradeAssignment || null;

        // Timetable: schedules for this specific class + learning area
        const relatedSchedules = classSchedules.filter(
          (s) => s.classId === cls.id && s.learningAreaId === area.id,
        );
        const todaysSlots = relatedSchedules
          .filter((s) => normalizeDay(s.day) === today)
          .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

        const currentLesson = todaysSlots.find((s) => {
          const start = toMinutes(s.startTime);
          const end   = toMinutes(s.endTime);
          return start >= 0 && end >= 0 && nowMinutes >= start && nowMinutes < end;
        }) || null;

        const timetableSummary = todaysSlots.length > 0
          ? todaysSlots.slice(0, 2).map((s) => `${s.startTime}–${s.endTime}`).join(' • ')
          : relatedSchedules.length > 0
            ? `${relatedSchedules.length} slot(s) configured`
            : 'No timetable slot';

        const currentLessonLabel = currentLesson
          ? `${currentLesson.subject || area.name} (${currentLesson.startTime}–${currentLesson.endTime})`
          : 'No lesson now';

        const currentTeacherLabel =
          teacherName(currentLesson?.teacher) ||
          currentLesson?.classTeacherName ||
          '—';

        return {
          rowKey:           `${cls.id}:${area.id}`,
          class:            cls,
          area,
          activeAssignment,
          activeTeacher:    teacherName(activeAssignment?.teacher) || '—',
          timetableSummary,
          currentLesson:    currentLessonLabel,
          currentTeacher:   currentTeacherLabel,
        };
      });
    });
  }, [classes, learningAreas, assignments, classSchedules]);

  // ── grade filter options (unique grades present in classes) ─────────────────

  const gradeOptions = useMemo(() => {
    const seen = new Set();
    return classes
      .map((c) => c.grade)
      .filter((g) => { if (seen.has(g)) return false; seen.add(g); return true; })
      .sort();
  }, [classes]);

  // ── search + grade filter ───────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    let rows = allRows;

    if (gradeFilter !== 'all') {
      rows = rows.filter((r) => r.class.grade === gradeFilter);
    }

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      rows = rows.filter((r) =>
        r.area.name?.toLowerCase().includes(term) ||
        r.area.shortName?.toLowerCase().includes(term) ||
        r.class.name?.toLowerCase().includes(term) ||
        r.class.stream?.toLowerCase().includes(term) ||
        getGradeLabel(r.class.grade)?.toLowerCase().includes(term) ||
        r.activeTeacher?.toLowerCase().includes(term) ||
        r.currentTeacher?.toLowerCase().includes(term),
      );
    }

    return rows;
  }, [allRows, searchTerm, gradeFilter]);

  // ── group by class for collapsible sections ─────────────────────────────────

  const groupedByClass = useMemo(() => {
    const map = new Map(); // classId → { cls, rows[] }
    filteredRows.forEach((row) => {
      const id = row.class.id;
      if (!map.has(id)) map.set(id, { cls: row.class, rows: [] });
      map.get(id).rows.push(row);
    });
    return Array.from(map.values());
  }, [filteredRows]);

  // ── actions ─────────────────────────────────────────────────────────────────

  const toggleGroup = (classId) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });

  const openAssignModal = (row) => {
    setSelectedRow(row);
    setTeacherSearchTerm('');
    setShowAssignModal(true);
  };

  const handleRemove = async (assignmentId) => {
    if (!assignmentId) return;
    if (!window.confirm('Remove this subject assignment?')) return;
    try {
      await api.subjectAssignments.delete(assignmentId);
      showSuccess('Assignment removed');
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (err) {
      showError(err.message || 'Failed to remove assignment');
    }
  };

  const handleAssign = async (teacherId) => {
    if (!selectedRow || !teacherId) return;
    setSubmitting(true);
    try {
      await api.subjectAssignments.create({
        teacherId,
        learningAreaId: selectedRow.area.id,
        grade:          selectedRow.class.grade,
        classId:        selectedRow.class.id,   // class-scoped assignment
      });
      showSuccess('Teacher assigned successfully');
      setShowAssignModal(false);
      setTeacherSearchTerm('');
      await fetchData();
    } catch (err) {
      showError(err.message || 'Failed to assign teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTeachers = useMemo(() => {
    const term = teacherSearchTerm.trim().toLowerCase();
    return teachers.filter((t) => {
      if (!term) return true;
      return (
        `${t.firstName || ''} ${t.lastName || ''}`.toLowerCase().includes(term) ||
        (t.staffId || '').toLowerCase().includes(term)
      );
    });
  }, [teachers, teacherSearchTerm]);

  // ── loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="text-lg font-medium">Loading subject allocation…</p>
      </div>
    );
  }

  // ── render ──────────────────────────────────────────────────────────────────

  const totalAssigned = allRows.filter((r) => r.activeAssignment).length;

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-medium text-gray-800 flex items-center gap-2">
            <GraduationCap className="text-purple-600" />
            Subject Allocation
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Assign teachers to learning areas per class. Each stream is listed separately.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100 w-fit">
          {totalAssigned} / {allRows.length} subjects assigned
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search subject, class, stream or teacher…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Grade filter */}
          <div className="relative">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 outline-none focus:border-purple-400 appearance-none"
            >
              <option value="all">All Grades</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>{getGradeLabel(g) || g}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* ── No classes configured ── */}
        {classes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <BookOpen size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="font-medium">No active classes found</p>
            <p className="text-sm mt-1">Create classes in the Classes module — streams will appear here automatically.</p>
          </div>
        )}

        {/* ── No rows after filter ── */}
        {classes.length > 0 && filteredRows.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            <p className="font-medium">No results match your search</p>
            <p className="text-sm mt-1">Try a different term or grade.</p>
          </div>
        )}

        {/* ── Table grouped by class ── */}
        {groupedByClass.length > 0 && (
          <div className="space-y-3">
            {groupedByClass.map(({ cls, rows }, groupIdx) => {
              const isCollapsed = collapsedGroups.has(cls.id);
              const assignedCount = rows.filter((r) => r.activeAssignment).length;
              const colorCls = colorAt(groupIdx);

              return (
                <div key={cls.id} className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">

                  {/* Group header — click to collapse/expand */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(cls.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition hover:brightness-95',
                      `border-b border-gray-100 bg-gray-50`,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold',
                        colorCls,
                      )}>
                        <GraduationCap size={11} />
                        {classLabel(cls)}
                      </span>
                      {cls.stream && (
                        <span className="text-xs text-gray-400 font-medium">
                          {cls.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-medium">
                        {assignedCount}/{rows.length} assigned
                      </span>
                      {/* mini progress bar */}
                      <div className="w-20 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all"
                          style={{ width: rows.length > 0 ? `${Math.round((assignedCount / rows.length) * 100)}%` : '0%' }}
                        />
                      </div>
                      <ChevronRight
                        size={15}
                        className={cn('text-gray-400 transition-transform', !isCollapsed && 'rotate-90')}
                      />
                    </div>
                  </button>

                  {/* Row table — hidden when collapsed */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/60 border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-400">
                            <th className="px-4 py-2">Learning Area</th>
                            <th className="px-4 py-2">Active Teacher</th>
                            <th className="px-4 py-2">Timetable Today</th>
                            <th className="px-4 py-2">Current Lesson</th>
                            <th className="px-4 py-2">Current Teacher</th>
                            <th className="px-4 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr
                              key={row.rowKey}
                              className={cn(
                                'border-b border-gray-50 last:border-0 align-top hover:bg-gray-50/60 transition-colors',
                                row.activeAssignment ? 'bg-white' : 'bg-amber-50/20',
                              )}
                            >
                              {/* Learning area */}
                              <td className="px-4 py-3">
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 text-base leading-none">{row.area.icon || '📚'}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{row.area.name}</p>
                                    {row.area.shortName && (
                                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">
                                        {row.area.shortName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Active teacher */}
                              <td className="px-4 py-3">
                                {row.activeAssignment ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                    <CheckCircle2 size={11} />
                                    {row.activeTeacher}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">Not assigned</span>
                                )}
                              </td>

                              {/* Timetable */}
                              <td className="px-4 py-3 text-xs text-gray-600">{row.timetableSummary}</td>

                              {/* Current lesson */}
                              <td className="px-4 py-3 text-xs text-gray-600">{row.currentLesson}</td>

                              {/* Current teacher */}
                              <td className="px-4 py-3 text-xs text-gray-600">{row.currentTeacher}</td>

                              {/* Actions */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs px-2.5"
                                    onClick={() => openAssignModal(row)}
                                  >
                                    <UserPlus size={12} className="mr-1" />
                                    {row.activeAssignment ? 'Reassign' : 'Assign'}
                                  </Button>
                                  {row.activeAssignment?.id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleRemove(row.activeAssignment.id)}
                                    >
                                      <X size={12} />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Assign Teacher Modal ── */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md overflow-hidden p-0 rounded-2xl border-none shadow-2xl">

          <div className="bg-purple-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium flex items-center gap-2">
                <UserPlus size={20} />
                Assign Teacher
              </DialogTitle>
              {selectedRow && (
                <div className="mt-2 space-y-0.5">
                  <p className="text-sm font-semibold text-white">
                    {selectedRow.area.name}
                  </p>
                  <p className="text-xs text-purple-200">
                    {classLabel(selectedRow.class)}
                    {selectedRow.class.stream && (
                      <span className="ml-1 opacity-80">· {selectedRow.class.name}</span>
                    )}
                  </p>
                </div>
              )}
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search by name or staff ID…"
                value={teacherSearchTerm}
                onChange={(e) => setTeacherSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm bg-gray-50 border-gray-200 rounded-xl"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredTeachers.map((teacher) => {
                const alreadyAssigned = selectedRow && assignments.some(
                  (a) =>
                    a.teacherId      === teacher.id &&
                    a.learningAreaId === selectedRow.area.id &&
                    a.classId        === selectedRow.class.id,
                );

                return (
                  <div
                    key={teacher.id}
                    onClick={() => !alreadyAssigned && !submitting && handleAssign(teacher.id)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl border transition-all',
                      alreadyAssigned
                        ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                        : 'border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 cursor-pointer',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold">
                        {teacher.firstName?.charAt(0)}{teacher.lastName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {teacher.firstName} {teacher.lastName}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                          {teacher.staffId || 'Teacher'}
                        </p>
                      </div>
                    </div>
                    {alreadyAssigned && <CheckCircle2 className="text-emerald-500" size={18} />}
                    {submitting && <Loader2 className="animate-spin text-purple-400" size={16} />}
                  </div>
                );
              })}

              {filteredTeachers.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No teachers found</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="bg-gray-50 px-5 py-3 border-t border-gray-100">
            <Button
              variant="ghost"
              onClick={() => setShowAssignModal(false)}
              className="rounded-xl text-sm font-medium"
              disabled={submitting}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubjectAllocationPage;
