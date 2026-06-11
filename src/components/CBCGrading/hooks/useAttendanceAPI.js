/**
 * useAttendance Hook (Backend Connected)
 * Manage attendance tracking with real backend API calls
 */

import { useState, useCallback, useEffect } from 'react';
import { attendanceAPI } from '../../../services/api';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { useAuth } from '../../../hooks/useAuth';
import toast from 'react-hot-toast';

const normalizeId = (value) => String(value ?? '').trim();

const getClassId = (classItem) => classItem?.id || classItem?._id || classItem?.classId || '';

const getClassGrade = (classItem) =>
  classItem?.grade ||
  classItem?.classGrade ||
  classItem?.level ||
  classItem?.gradeLevel ||
  classItem?.classLevel ||
  '';

const getStreamName = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return (
      value.name ||
      value.stream ||
      value.label ||
      value.streamName ||
      value.value ||
      value.title ||
      value.code ||
      ''
    ).toString().trim();
  }
  return String(value).trim();
};

const getClassStream = (classItem) =>
  getStreamName(
    classItem?.stream ||
    classItem?.classStream ||
    classItem?.streamName ||
    classItem?.streamLabel ||
    classItem?.streamValue ||
    classItem?.streamConfig ||
    classItem?.streamObj
  );

export const useAttendance = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [streams, setStreams] = useState([]);
  const {
    classes: contextClasses,
    grades: contextGrades,
    streams: contextStreams,
    loading: schoolDataLoading,
  } = useSchoolData();
  const { user } = useAuth();

  const isTeacher = user?.role === 'TEACHER';
  // The login response stores the user's primary key as `id`.
  // `userId` may exist on older cached objects — check both to be safe.
  const currentUserId = user?.id ?? user?.userId ?? '';

  /**
   * Sync context classes and grades
   */
  useEffect(() => {
    if (!schoolDataLoading) {
      const resolvedClasses = isTeacher
        ? (contextClasses || []).filter((classItem) => {
          // If we can't determine the current user's ID, show all classes
          // rather than showing none (fail-open is safer than fail-closed here).
          if (!currentUserId) return true;
          // Only check the two fields that actually exist on the API response:
          //   - teacherId  → the raw FK stored on the class record
          //   - teacher.id → the joined User record's id
          const assignedTeacherIds = [
            classItem?.teacherId,
            classItem?.teacher?.id,
          ]
            .map(normalizeId)
            .filter(Boolean);
          return assignedTeacherIds.includes(normalizeId(currentUserId));
        })
        : (contextClasses || []);

      const classDerivedGrades = [...new Set(resolvedClasses.map((classItem) => getClassGrade(classItem)).filter(Boolean))];
      const contextDerivedGrades = Array.isArray(contextGrades) ? contextGrades.filter(Boolean) : [];
      const resolvedGrades = isTeacher
        ? classDerivedGrades
        : [...new Set([...(contextDerivedGrades || []), ...(classDerivedGrades || [])])];

      const classDerivedStreams = [...new Set(
        resolvedClasses
          .map((classItem) => getClassStream(classItem))
          .filter(Boolean)
      )];
      const contextDerivedStreams = Array.isArray(contextStreams)
        ? contextStreams
            .map((streamItem) => {
              return getStreamName(streamItem);
            })
            .filter(Boolean)
        : [];
      const resolvedStreams = [...new Set([...(contextDerivedStreams || []), ...(classDerivedStreams || [])])];

      setClasses(resolvedClasses);
      setGrades(resolvedGrades);
      setStreams(resolvedStreams);

      if (isTeacher) {
        const selectedClassExists = resolvedClasses.some((classItem) => getClassId(classItem) === selectedClass);
        if (!selectedClassExists) {
          setSelectedClass(getClassId(resolvedClasses[0]) || '');
        }
      }
    }
  }, [contextClasses, contextGrades, contextStreams, schoolDataLoading, isTeacher, currentUserId, selectedClass]);

  /**
   * Fetch attendance records
   * @param {Object} params - Query parameters
   */
  const fetchAttendance = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await attendanceAPI.getRecords(params);
      if (response.success) {
        setAttendanceRecords(response.data);
        return response.data;
      }
    } catch (err) {
      setError(err.message);
      if (err.message?.includes('not assigned as class teacher')) {
         toast.error('Access Denied: You are not assigned as a Class Teacher.');
      } else {
         console.error('Error fetching attendance:', err);
         toast.error('Failed to fetch attendance data.');
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Mark attendance for a single learner
   * @param {Object} attendanceData - { learnerId, date, status, classId, remarks }
   */
  const markAttendance = useCallback(async (attendanceData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await attendanceAPI.mark({
        ...attendanceData,
        date: attendanceData.date || selectedDate,
      });

      if (response.success) {
        // Update local state with the new/updated record
        setAttendanceRecords(prev => {
          const existingIndex = prev.findIndex(
            r => r.learnerId === attendanceData.learnerId &&
              r.date === (attendanceData.date || selectedDate)
          );

          if (existingIndex >= 0) {
            // Update existing
            const updated = [...prev];
            updated[existingIndex] = response.data;
            return updated;
          } else {
            // Add new
            return [...prev, response.data];
          }
        });

        return { success: true, data: response.data };
      }
    } catch (err) {
      setError(err.message);
      console.error('Error marking attendance:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  /**
   * Mark attendance for multiple learners (bulk)
   * @param {string} date - Date
   * @param {string} classId - Class ID
   * @param {Array} attendanceRecords - Array of { learnerId, status, remarks }
   */
  const markBulkAttendance = useCallback(async (date, classId, attendanceRecordsList) => {
    setLoading(true);
    setError(null);
    try {
      const response = await attendanceAPI.markBulk({
        date: date || selectedDate,
        classId,
        attendanceRecords: attendanceRecordsList,
      });

      if (response.success) {
        // Refresh attendance for this date and class
        await fetchAttendance({ date: date || selectedDate, classId });
        return {
          success: true,
          data: response.data,
          message: response.message
        };
      }
    } catch (err) {
      setError(err.message);
      console.error('Error marking bulk attendance:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [selectedDate, fetchAttendance]);

  /**
   * Get daily class attendance report
   * @param {string} classId - Class ID
   * @param {string} date - Date (YYYY-MM-DD)
   */
  const getDailyClassReport = useCallback(async (classId, date) => {
    setLoading(true);
    setError(null);
    try {
      const response = await attendanceAPI.getDailyClassReport(
        classId,
        date || selectedDate
      );

      if (response.success) {
        return response.data;
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching daily class report:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  /**
   * Get attendance statistics
   * @param {Object} params - Query parameters (startDate, endDate, classId, learnerId)
   */
  const getAttendanceStats = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await attendanceAPI.getStats(params);

      if (response.success) {
        return response.data;
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching attendance stats:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get learner attendance summary
   * @param {string} learnerId - Learner ID
   * @param {Object} params - Query parameters (startDate, endDate)
   */
  const getLearnerSummary = useCallback(async (learnerId, params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await attendanceAPI.getLearnerSummary(learnerId, params);

      if (response.success) {
        return response.data;
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching learner summary:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get attendance record for a specific learner on a date
   * @param {string} learnerId - Learner ID
   * @param {string} date - Date
   */
  const getAttendanceRecord = useCallback((learnerId, date) => {
    return attendanceRecords.find(
      record => record.learnerId === learnerId &&
        record.date.split('T')[0] === date
    ) || null;
  }, [attendanceRecords]);

  /**
   * Get attendance by date
   * @param {string} date - Date
   */
  const getAttendanceByDate = useCallback((date) => {
    return attendanceRecords.filter(
      record => record.date.split('T')[0] === date
    );
  }, [attendanceRecords]);

  return {
    // State
    attendanceRecords,
    loading,
    error,
    selectedDate,
    selectedClass,
    classes,
    grades,
    streams,

    // Setters
    setSelectedDate,
    setSelectedClass,
    setAttendanceRecords,

    // API Actions
    fetchAttendance,
    markAttendance,
    markBulkAttendance,
    getDailyClassReport,
    getAttendanceStats,
    getLearnerSummary,

    // Local helpers
    getAttendanceRecord,
    getAttendanceByDate,
  };
};
