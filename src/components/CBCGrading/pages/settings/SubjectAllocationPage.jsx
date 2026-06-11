import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus, Search, GraduationCap, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../../../components/ui';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { getGradeLabel, GRADES } from '../../../../constants/grades';
import { useSchoolData } from '../../../../contexts/SchoolDataContext';

const dayAlias = {
  MONDAY: 'MONDAY',
  MON: 'MONDAY',
  TUESDAY: 'TUESDAY',
  TUE: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  WED: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  THU: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  FRI: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SAT: 'SATURDAY',
  SUNDAY: 'SUNDAY',
  SUN: 'SUNDAY'
};

const normalizeDay = (day) => {
  if (!day) return '';
  return dayAlias[String(day).trim().toUpperCase()] || String(day).trim().toUpperCase();
};

const toMinutes = (timeVal) => {
  if (!timeVal) return -1;
  const [h = '0', m = '0'] = String(timeVal).split(':');
  return Number(h) * 60 + Number(m);
};

const SubjectAllocationPage = () => {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [learningAreas, setLearningAreas] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [classSchedules, setClassSchedules] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showSuccess, showError } = useNotifications();
  const { grades: dynamicGrades } = useSchoolData();

  const activeGradeValues = useMemo(() => {
    // Prefer runtime grades (PRIMARY_CBC vs SECONDARY) to avoid filtering out everything.
    if (Array.isArray(dynamicGrades) && dynamicGrades.length > 0) return dynamicGrades;
    return GRADES.map((g) => g.value);
  }, [dynamicGrades]);

  const activeGradeLabelsUpper = useMemo(() => {
    // Labels for fallback matching when backend returns "Grade 1" style values.
    // For dynamic grades, we don't have labels here, so we rely on value matches.
    return new Set(GRADES.map((g) => String(g.label || '').toUpperCase()));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {

      const [teachersResp, areasResp, assignmentsResp, classesResp] = await Promise.all([
        api.teachers.getAll({ limit: 1000 }),
        api.config.getLearningAreas(),
        api.subjectAssignments.getAll(),
        api.classes.getAll({ active: true })
      ]);

      const teachersData = Array.isArray(teachersResp?.data) ? teachersResp.data : [];
      const allAreas = Array.isArray(areasResp?.data)
        ? areasResp.data
        : Array.isArray(areasResp)
          ? areasResp
          : [];

      // Filter out legacy grades (Creche, Reception, Transition)
      const areasData = allAreas.filter((area) => {
        const gradeLevel = String(area?.gradeLevel || '').trim();
        if (!gradeLevel) return false;
        if (activeGradeValues.includes(gradeLevel)) return true;
        // Backwards compat: some datasets store grade as a label (e.g. "Grade 1")
        return activeGradeLabelsUpper.has(gradeLevel.toUpperCase());
      });
      const assignmentsData = Array.isArray(assignmentsResp?.data) ? assignmentsResp.data : [];
      const classesData = Array.isArray(classesResp?.data) ? classesResp.data : [];

      setTeachers(teachersData);
      setLearningAreas(areasData);
      setAssignments(assignmentsData);

      const scheduleResponses = await Promise.all(
        classesData.map(async (classItem) => {
          try {
            const resp = await api.classes.getSchedules(classItem.id);
            const schedules = Array.isArray(resp?.data) ? resp.data : [];
            return schedules.map((schedule) => ({
              ...schedule,
              classId: classItem.id,
              className: classItem.name,
              classGrade: classItem.grade,
              classTeacherName: classItem.teacher
                ? `${classItem.teacher.firstName || ''} ${classItem.teacher.lastName || ''}`.trim()
                : null
            }));
          } catch {
            return [];
          }
        })
      );

      setClassSchedules(scheduleResponses.flat());
    } catch (error) {
      console.error('Failed to fetch allocation data:', error);
      showError(error.message || 'Failed to load subject allocation data');
    } finally {
      setLoading(false);
    }
  }, [showError, activeGradeValues, activeGradeLabelsUpper]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRemove = async (assignmentId) => {
    if (!assignmentId) return;
    if (!window.confirm('Are you sure you want to remove this assignment?')) return;

    try {
      await api.subjectAssignments.delete(assignmentId);
      showSuccess('Assignment removed successfully');
      setAssignments((prev) => prev.filter((item) => item.id !== assignmentId));
    } catch (error) {
      showError(error.message || 'Failed to remove assignment');
    }
  };

  const handleAssign = async (teacherId) => {
    if (!selectedSubject || !teacherId) return;

    setSubmitting(true);
    try {
      await api.subjectAssignments.create({
        teacherId,
        learningAreaId: selectedSubject.id,
        grade: selectedSubject.gradeLevel
      });

      showSuccess('Teacher assigned successfully');
      setShowAssignModal(false);
      setTeacherSearchTerm('');
      await fetchData();
    } catch (error) {
      showError(error.message || 'Failed to assign teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const subjectRows = useMemo(() => {
    const now = new Date();
    const today = normalizeDay(now.toLocaleDateString('en-US', { weekday: 'long' }));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return (learningAreas || []).map((area) => {
      const rowAssignments = (assignments || []).filter(
        (assignment) => assignment.learningAreaId === area.id && assignment.grade === area.gradeLevel
      );
      const activeAssignment = rowAssignments[0] || null;

      const relatedSchedules = (classSchedules || []).filter(
        (schedule) => schedule.learningAreaId === area.id && schedule.classGrade === area.gradeLevel
      );

      const todaysSchedules = relatedSchedules
        .filter((schedule) => normalizeDay(schedule.day) === today)
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

      const currentLesson = todaysSchedules.find((slot) => {
        const start = toMinutes(slot.startTime);
        const end = toMinutes(slot.endTime);
        return start >= 0 && end >= 0 && nowMinutes >= start && nowMinutes < end;
      }) || null;

      const activeTeacher = activeAssignment?.teacher
        ? `${activeAssignment.teacher.firstName || ''} ${activeAssignment.teacher.lastName || ''}`.trim()
        : '—';

      const currentTeacher = currentLesson?.teacher
        ? `${currentLesson.teacher.firstName || ''} ${currentLesson.teacher.lastName || ''}`.trim()
        : currentLesson?.classTeacherName || '—';

      const timetableSummary = todaysSchedules.length > 0
        ? todaysSchedules.slice(0, 2).map((slot) => `${slot.className} ${slot.startTime}-${slot.endTime}`).join(' • ')
        : relatedSchedules.length > 0
          ? `${relatedSchedules.length} slot(s) configured`
          : '—';

      return {
        ...area,
        activeAssignment,
        activeTeacher,
        timetableSummary,
        currentLesson: currentLesson
          ? `${currentLesson.subject || area.name} (${currentLesson.startTime}-${currentLesson.endTime})`
          : '—',
        currentTeacher: currentTeacher || '—'
      };
    });
  }, [learningAreas, assignments, classSchedules]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return subjectRows;

    return subjectRows.filter((row) => {
      return (
        row.name?.toLowerCase().includes(term) ||
        row.shortName?.toLowerCase().includes(term) ||
        getGradeLabel(row.gradeLevel)?.toLowerCase().includes(term) ||
        row.activeTeacher?.toLowerCase().includes(term) ||
        row.currentTeacher?.toLowerCase().includes(term)
      );
    });
  }, [searchTerm, subjectRows]);

  const filteredTeachers = useMemo(() => {
    const term = teacherSearchTerm.trim().toLowerCase();
    return (teachers || []).filter((teacher) => {
      if (!term) return true;
      return (
        `${teacher.firstName || ''} ${teacher.lastName || ''}`.toLowerCase().includes(term) ||
        (teacher.staffId || '').toLowerCase().includes(term)
      );
    });
  }, [teacherSearchTerm, teachers]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="text-lg font-medium">Loading subject allocation...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-medium text-gray-800 flex items-center gap-2">
            <GraduationCap className="text-purple-600" />
            Subject Allocation
          </h2>
          <p className="text-sm text-gray-500">Learning areas, active teacher, class timetable, current lesson and current teacher.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-100 w-fit">
          <span>{assignments.length} assignments active</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search by subject, grade, active/current teacher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredRows.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p className="font-medium">No learning areas available for allocation</p>
            <p className="text-sm mt-1">Add learning areas in the Learning Areas tab first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-100 text-xs uppercase tracking-wide text-gray-600">
                  <th className="p-3">Grade</th>
                  <th className="p-3">Learning Area</th>
                  <th className="p-3">Active Teacher</th>
                  <th className="p-3">Class Timetable</th>
                  <th className="p-3">Current Lesson</th>
                  <th className="p-3">Current Teacher</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/70 align-top">
                    <td className="p-3 text-sm font-semibold text-gray-700">{getGradeLabel(row.gradeLevel)}</td>
                    <td className="p-3">
                      <div className="flex items-start gap-2">
                        <span>{row.icon || '📚'}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{row.name}</p>
                          {row.shortName && <p className="text-xs text-gray-500">{row.shortName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-700">{row.activeTeacher || '—'}</td>
                    <td className="p-3 text-sm text-gray-700">{row.timetableSummary}</td>
                    <td className="p-3 text-sm text-gray-700">{row.currentLesson}</td>
                    <td className="p-3 text-sm text-gray-700">{row.currentTeacher}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setSelectedSubject(row);
                            setTeacherSearchTerm('');
                            setShowAssignModal(true);
                          }}
                        >
                          <UserPlus size={14} className="mr-1" />
                          Assign
                        </Button>
                        {row.activeAssignment?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemove(row.activeAssignment.id)}
                          >
                            <X size={14} className="mr-1" />
                            Remove
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

      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md overflow-hidden p-0 rounded-2xl border-none shadow-2xl">
          <div className="bg-purple-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium flex items-center gap-2">
                <UserPlus />
                Assign Teacher
              </DialogTitle>
              <p className="text-purple-100 text-xs mt-1 font-medium opacity-90">
                {selectedSubject?.name} • {getGradeLabel(selectedSubject?.gradeLevel || '')}
              </p>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search by name or staff ID..."
                value={teacherSearchTerm}
                onChange={(e) => setTeacherSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredTeachers.map((teacher) => {
                const alreadyAssigned = assignments.some(
                  (assignment) => assignment.teacherId === teacher.id &&
                    assignment.learningAreaId === selectedSubject?.id &&
                    assignment.grade === selectedSubject?.gradeLevel
                );

                return (
                  <div
                    key={teacher.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${alreadyAssigned
                      ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                      : 'border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 cursor-pointer'
                      }`}
                    onClick={() => !alreadyAssigned && !submitting && handleAssign(teacher.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium shadow-sm">
                        {teacher.firstName?.charAt(0)}{teacher.lastName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{teacher.firstName} {teacher.lastName}</p>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{teacher.staffId || 'Teacher'}</p>
                      </div>
                    </div>
                    {alreadyAssigned ? <CheckCircle2 className="text-green-500" size={20} /> : null}
                  </div>
                );
              })}

              {filteredTeachers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No teachers found</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="bg-gray-50 p-4 border-t border-gray-100">
            <Button variant="ghost" onClick={() => setShowAssignModal(false)} className="rounded-xl font-medium" disabled={submitting}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubjectAllocationPage;
