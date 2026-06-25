/**
 * useTeacherContext
 *
 * Fetches and caches the authenticated teacher's scoped context:
 *   - isClassTeacher     : true when they hold a homeroom assignment
 *   - classTeacherOf     : { id, name, grade, stream, learnerCount } | null
 *   - subjectAssignments : [{ grade, learningAreaId, learningAreaName, classId }]
 *   - assignedClassIds   : string[]
 *   - assignedGrades     : string[]
 *   - restricted         : false for ADMIN / HEAD_TEACHER / SUPER_ADMIN
 *
 * Non-TEACHER roles receive { restricted: false } immediately without a
 * network call.
 *
 * Usage:
 *   const { isClassTeacher, classTeacherOf, isSubjectTeacher, loading } = useTeacherContext();
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { teacherAPI } from '../services/api/teacher.api';

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min — mirrors backend TTL

let _cache = null;
let _cacheTs = 0;

const DEFAULT_CONTEXT = {
  restricted: false,
  isClassTeacher: false,
  classTeacherOf: null,
  subjectAssignments: [],
  assignedClassIds: [],
  assignedGrades: [],
};

export const useTeacherContext = () => {
  const { user } = useAuth();
  const role = user?.role;
  const isTeacher = role === 'TEACHER';

  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(isTeacher);
  const [error, setError] = useState(null);

  const fetchContext = useCallback(async () => {
    if (!isTeacher) {
      setContext(DEFAULT_CONTEXT);
      setLoading(false);
      return;
    }

    // Return in-process cache to avoid duplicate requests
    const now = Date.now();
    if (_cache && now - _cacheTs < CACHE_TTL_MS) {
      setContext(_cache);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await teacherAPI.getMyContext();
      const data = res?.data ?? DEFAULT_CONTEXT;

      _cache = data;
      _cacheTs = Date.now();
      setContext(data);
      setError(null);
    } catch (err) {
      console.error('[useTeacherContext]', err);
      setError(err);
      setContext(DEFAULT_CONTEXT);
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  /**
   * Returns true if the teacher is assigned to teach `subjectName` for `grade`.
   * Non-restricted roles always return true.
   */
  const isSubjectTeacher = useCallback(
    (subjectName, grade) => {
      if (!context || !context.restricted) return true;
      if (!subjectName && !grade) return true;
      return context.subjectAssignments.some((a) => {
        const gradeMatch = !grade || a.grade === grade;
        const nameMatch =
          !subjectName ||
          a.learningAreaName?.toLowerCase() === String(subjectName).toLowerCase();
        return gradeMatch && nameMatch;
      });
    },
    [context]
  );

  /**
   * Returns true if the teacher is the class (homeroom) teacher for `classId` or `grade`.
   */
  const isClassTeacherFor = useCallback(
    (classIdOrGrade) => {
      if (!context || !context.isClassTeacher || !context.classTeacherOf) return false;
      return (
        context.classTeacherOf.id === classIdOrGrade ||
        context.classTeacherOf.grade === classIdOrGrade
      );
    },
    [context]
  );

  const result = useMemo(
    () => ({
      loading,
      error,
      restricted: context?.restricted ?? false,
      isClassTeacher: context?.isClassTeacher ?? false,
      classTeacherOf: context?.classTeacherOf ?? null,
      subjectAssignments: context?.subjectAssignments ?? [],
      assignedClassIds: context?.assignedClassIds ?? [],
      assignedGrades: context?.assignedGrades ?? [],
      isSubjectTeacher,
      isClassTeacherFor,
      refresh: fetchContext,
    }),
    [loading, error, context, isSubjectTeacher, isClassTeacherFor, fetchContext]
  );

  return result;
};

/** Imperatively clear the in-memory cache (call after assignments change) */
export const invalidateTeacherContextCache = () => {
  _cache = null;
  _cacheTs = 0;
};

export default useTeacherContext;
