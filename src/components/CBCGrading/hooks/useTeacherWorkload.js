import { useState, useEffect, useCallback, useMemo } from 'react';
import { classAPI, teacherAPI } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';

const normalizeGradeCode = (grade) => String(grade || '').trim().replace(/\s+/g, '_').toUpperCase();

/**
 * useTeacherWorkload Hook
 * Fetches and manages the assigned classes and subject schedules for a teacher.
 * Useful for restricting UI selections to only what the teacher is assigned to.
 */
export const useTeacherWorkload = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [workload, setWorkload] = useState(null);
    const [schedules, setSchedules] = useState([]);
    const [teacherContext, setTeacherContext] = useState(null);
    const [error, setError] = useState(null);

    const teacherId = user?.id || user?.userId;
    const isTeacher = user?.role === 'TEACHER';

    const fetchWorkload = useCallback(async () => {
        if (!teacherId || !isTeacher) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const [workloadResp, schedulesResp, contextResp] = await Promise.all([
                classAPI.getTeacherWorkload(teacherId),
                classAPI.getTeacherSchedules(teacherId),
                teacherAPI.getMyContext()
            ]);

            setWorkload(workloadResp.data || workloadResp);
            setSchedules(schedulesResp.data || schedulesResp || []);
            setTeacherContext(contextResp.data || contextResp || null);
            setError(null);
        } catch (err) {
            console.error('Error fetching teacher workload:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [teacherId, isTeacher]);

    useEffect(() => {
        fetchWorkload();
    }, [fetchWorkload]);

    // Assigned grades list (unique)
    const assignedGrades = useMemo(() => {
        const classGrades = (workload?.classes || [])
            .map((classItem) => classItem?.grade)
            .filter(Boolean);

        const scheduleGrades = (schedules || [])
            .map((schedule) => schedule?.class?.grade || schedule?.grade)
            .filter(Boolean);

        const contextGrades = (teacherContext?.assignedGrades || [])
            .filter(Boolean);

        return [...new Set([...classGrades, ...scheduleGrades, ...contextGrades].map(normalizeGradeCode).filter(Boolean))];
    }, [workload, schedules, teacherContext]);

    // Check if assigned to a specific grade
    const isAssignedToGrade = useCallback((grade) => {
        if (!isTeacher) return true; // Admin/HoC always "assigned"
        return assignedGrades.includes(normalizeGradeCode(grade));
    }, [isTeacher, assignedGrades]);

    // Get subjects for a specific grade
    const getAssignedSubjectsForGrade = useCallback((grade) => {
        if (!isTeacher) return null; // Admin/HoC sees all (null means don't filter)
        const normalizedGrade = normalizeGradeCode(grade);

        // Class teachers can assess all subjects for their own class/grade.
        // The mark-entry screen still shows a warning when they enter a subject
        // where they are not the named subject teacher.
        const isClassTeacher = teacherContext?.classTeacherOf
            ? normalizeGradeCode(teacherContext.classTeacherOf.grade) === normalizedGrade
            : false;
        if (isClassTeacher) {
            return null;
        }

        const gradeSchedules = schedules.filter(s =>
            normalizeGradeCode(s.class?.grade || s.grade) === normalizedGrade
        );

        const contextSubjects = (teacherContext?.subjectAssignments || [])
            .filter((assignment) => normalizeGradeCode(assignment?.grade) === normalizedGrade)
            .map((assignment) => assignment?.learningAreaName)
            .filter(Boolean);

        if (gradeSchedules.length > 0) {
            const subjects = gradeSchedules
                .map((schedule) => schedule?.subject || schedule?.learningArea?.name || schedule?.learningArea?.shortName)
                .filter(Boolean);

            const mergedSubjects = [...new Set([...subjects, ...contextSubjects].filter(Boolean))];
            return mergedSubjects.length > 0 ? mergedSubjects : null;
        }

        if (contextSubjects.length > 0) {
            return [...new Set(contextSubjects)];
        }

        // Fallback: If assigned as a class teacher for this grade but no specific subjects are in the schedule
        // In many primary settings, the class teacher handles all subjects
        if (!teacherContext && assignedGrades.includes(normalizedGrade)) {
            return null; // Return null to allow all subjects
        }

        return []; // Truly no assignments for this grade
    }, [isTeacher, schedules, assignedGrades, teacherContext]);

    // Check if the teacher has any assignments at all
    const hasAnyAssignments = useMemo(() => {
        return assignedGrades.length > 0 || schedules.length > 0;
    }, [assignedGrades, schedules]);

    // Primary Assignment for auto-prefill
    const primaryGrade = useMemo(() => assignedGrades[0] || null, [assignedGrades]);

    const primaryStream = useMemo(() => {
        const firstClass = workload?.classes?.[0];
        if (firstClass?.stream) return firstClass.stream;

        const firstScheduleClass = schedules.find((schedule) => schedule?.class?.stream)?.class;
        return firstScheduleClass?.stream || null;
    }, [workload, schedules]);

    return {
        workload,
        teacherContext,
        loading,
        error,
        isTeacher,
        teacherId,
        assignedGrades,
        hasAnyAssignments,
        primaryGrade,
        primaryStream,
        isAssignedToGrade,
        getAssignedSubjectsForGrade,
        refresh: fetchWorkload
    };
};

export default useTeacherWorkload;
