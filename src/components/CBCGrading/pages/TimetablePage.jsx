import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Download, Filter, Loader2, Plus, Settings2, Share2, X } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import Toast from '../shared/Toast';
import api from '../../../services/api';
import { getCurrentWeekday, isTeacherClockedIn } from '../../../utils/teacherClockIn';
import { generateHighFidelityPDF } from '../../../utils/simplePdfGenerator';
import TimetablePDFWrapper from '../shared/TimetablePDFWrapper';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuth } from '../../../hooks/useAuth';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { MOBILE_MEDIA_QUERY } from '../../../constants/breakpoints';
import TimetableEngineSetup from './timetable/TimetableEngineSetup';

const DEFAULT_TIME_SLOTS = [
  { startTime: '08:00', endTime: '08:45' },
  { startTime: '08:45', endTime: '09:30' },
  { startTime: '09:30', endTime: '10:15' },
  { startTime: '10:15', endTime: '11:00' },
  { startTime: '11:00', endTime: '11:45' },
  { startTime: '11:45', endTime: '12:30' },
  { startTime: '12:30', endTime: '13:15' },
  { startTime: '13:15', endTime: '14:00' },
  { startTime: '14:00', endTime: '14:45' },
  { startTime: '14:45', endTime: '15:30' }
];

const parseTimeToMinutes = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;

  const twelveHourMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHourMatch) {
    const hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const meridiem = twelveHourMatch[3].toUpperCase();
    let normalizedHours = hours % 12;
    if (meridiem === 'PM') normalizedHours += 12;
    return (normalizedHours * 60) + minutes;
  }

  const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);
    return (hours * 60) + minutes;
  }

  return Number.NaN;
};

const toDisplayTime = (value) => {
  const minutes = parseTimeToMinutes(value);
  if (Number.isNaN(minutes)) return String(value || '').trim();

  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = ((hours24 + 11) % 12) + 1;
  return `${hours12}:${String(mins).padStart(2, '0')} ${meridiem}`;
};

const normalizeSlotKeyPart = (value) => {
  const minutes = parseTimeToMinutes(value);
  if (Number.isNaN(minutes)) return String(value || '').trim().toUpperCase();
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const buildSlotKey = (startTime, endTime) => `${normalizeSlotKeyPart(startTime)}-${normalizeSlotKeyPart(endTime)}`;

const buildTimeLine = (startTime, endTime) => `${toDisplayTime(startTime)} - ${toDisplayTime(endTime)}`;

const sortTimeLabels = (timeLabels) => {
  return [...timeLabels].sort((a, b) => {
    const aStart = String(a || '').split('-')[0]?.trim() || a;
    const bStart = String(b || '').split('-')[0]?.trim() || b;
    const aMinutes = parseTimeToMinutes(aStart);
    const bMinutes = parseTimeToMinutes(bStart);
    if (Number.isNaN(aMinutes) || Number.isNaN(bMinutes)) return String(a).localeCompare(String(b));
    return aMinutes - bMinutes;
  });
};

const getStartOfWeek = (date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const formatWeekRange = (weekStart) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);
  const startText = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endText = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startText} - ${endText}`;
};

const TIMETABLE_PDF_OPTIONS = {
  includeLetterhead: true,
  orientation: 'landscape',
  fitToPage: true,
};

const TimetablePage = () => {
  const [selectedDay, setSelectedDay] = useState(() => {
    return localStorage.getItem('cbc_timetable_selected_day') || 'Monday';
  });
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));

  useEffect(() => {
    localStorage.setItem('cbc_timetable_selected_day', selectedDay);
  }, [selectedDay]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [engineSetupOpen, setEngineSetupOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState(() => {
    return localStorage.getItem('cbc_timetable_selected_class') || 'all';
  });

  useEffect(() => {
    localStorage.setItem('cbc_timetable_selected_class', selectedClassId);
  }, [selectedClassId]);

  const { showSuccess, showError, showInfo, showToast, toastMessage, toastType, hideNotification } = useNotifications();

  // Form state
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('cbc_timetable_view_mode') || 'weekly';
  });

  useEffect(() => {
    localStorage.setItem('cbc_timetable_view_mode', viewMode);
  }, [viewMode]);
  const [timeLine, setTimeLine] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [room, setRoom] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [lessonDay, setLessonDay] = useState('Monday');
  const [isDownloadingWeekPdf, setIsDownloadingWeekPdf] = useState(false);
  const [isSharingWeekPdf, setIsSharingWeekPdf] = useState(false);
  const { can } = usePermissions();
  const { user } = useAuth();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const canEditTimetable = can('EDIT_TIMETABLE');
  // Only ADMIN and HEAD_TEACHER can make quick override edits to a published timetable
  const canOverride = ['ADMIN', 'HEAD_TEACHER', 'SUPER_ADMIN'].includes(user?.role);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [classesResp, teachersResp, subjectsResp, assignmentsResp] = await Promise.all([
        api.classes.getAll(),
        api.teachers.getAll(),
        api.config.getLearningAreas(),
        api.subjectAssignments.getAll()
      ]);

      const classesData = classesResp.data || [];
      setClasses(classesData);
      setTeachers(teachersResp.data || []);
      setSubjects(subjectsResp.data || []);
      setAssignments(assignmentsResp.data || []);

      if (classesData.length > 0) {
        // Option to view all or specific class
        // setSelectedClassId('all'); 
      }
    } catch (error) {
      showError('Failed to load timetable data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const [scheduleData, setScheduleData] = useState({});

  const normalizeGrade = (value) => {
    if (!value) return '';
    return String(value).trim().toUpperCase().replace(/\s+/g, '_');
  };

  const getSelectedClass = () => classes.find((c) => c.id === selectedClassId);

  const getPrefilledTeacherId = (learningAreaId) => {
    if (!learningAreaId) return '';
    const selectedClass = getSelectedClass();
    if (!selectedClass) return '';

    const classGrade = normalizeGrade(selectedClass.grade);
    const assignment = assignments.find((a) => (
      a.learningAreaId === learningAreaId
      && normalizeGrade(a.grade) === classGrade
      && a.active !== false
    ));

    return assignment?.teacherId || selectedClass.teacherId || '';
  };

  const parseTimeLine = (value) => {
    const segments = String(value || '').split('-').map((part) => part.trim());
    if (segments.length < 2 || !segments[0] || !segments[1]) return null;
    return { startTime: segments[0], endTime: segments[1] };
  };

  const getTimeSlotOptions = (day) => {
    const slotMap = new Map();

    DEFAULT_TIME_SLOTS.forEach((slot) => {
      const key = buildSlotKey(slot.startTime, slot.endTime);
      slotMap.set(key, {
        key,
        startTime: slot.startTime,
        endTime: slot.endTime,
        label: buildTimeLine(slot.startTime, slot.endTime)
      });
    });

    (scheduleData[day] || []).forEach((lesson) => {
      const parsed = parseTimeLine(lesson.time);
      if (!parsed) return;
      const key = buildSlotKey(parsed.startTime, parsed.endTime);
      if (!slotMap.has(key)) {
        slotMap.set(key, {
          key,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          label: buildTimeLine(parsed.startTime, parsed.endTime)
        });
      }
    });

    return Array.from(slotMap.values()).sort((a, b) => {
      const aMinutes = parseTimeToMinutes(a.startTime);
      const bMinutes = parseTimeToMinutes(b.startTime);
      if (Number.isNaN(aMinutes) || Number.isNaN(bMinutes)) {
        return a.label.localeCompare(b.label);
      }
      return aMinutes - bMinutes;
    });
  };

  const getUsedSlotKeysForDay = (day) => {
    return new Set(
      (scheduleData[day] || [])
        .map((lesson) => parseTimeLine(lesson.time))
        .filter(Boolean)
        .map((slot) => buildSlotKey(slot.startTime, slot.endTime))
    );
  };

  const getNextAvailableSlot = (day, excludeKey = '') => {
    const usedSlotKeys = getUsedSlotKeysForDay(day);
    const options = getTimeSlotOptions(day);
    return options.find((option) => !usedSlotKeys.has(option.key) || option.key === excludeKey) || null;
  };

  useEffect(() => {
    if (selectedClassId !== 'all') {
      fetchClassSchedule(selectedClassId);
    } else if (classes.length > 0) {
      fetchMasterSchedule();
    } else {
      setScheduleData({});
    }
  }, [selectedClassId, classes]);

  useEffect(() => {
    if (!isModalOpen || editingLesson || !subjectId || teacherId) return;
    const suggestedTeacherId = getPrefilledTeacherId(subjectId);
    if (suggestedTeacherId) {
      setTeacherId(suggestedTeacherId);
    }
  }, [isModalOpen, editingLesson, subjectId, teacherId, selectedClassId, assignments, classes]);

  const toLessonRow = (schedule, classInfo) => {
    const classLabel = classInfo?.name || [classInfo?.grade, classInfo?.stream].filter(Boolean).join(' ') || 'N/A';
    return {
      id: schedule.id,
      classId: classInfo?.id,
      className: classLabel,
      time: buildTimeLine(schedule.startTime || '', schedule.endTime || ''),
      subject: schedule.learningArea?.name || schedule.subject,
      subjectId: schedule.learningAreaId,
      teacherId: schedule.teacherId,
      teacherName: schedule.teacher ? `${schedule.teacher.firstName} ${schedule.teacher.lastName}` : 'Unassigned',
      grade: classLabel,
      room: schedule.room || 'N/A',
      isOverride: schedule.isOverride || false,
      overrideNote: schedule.overrideNote || '',
    };
  };

  const fetchMasterSchedule = async () => {
    try {
      const responses = await Promise.all(
        classes.map(async (classInfo) => {
          try {
            const response = await api.classes.getSchedules(classInfo.id);
            return { classInfo, schedules: response.data || [] };
          } catch (error) {
            console.error(`Failed to fetch timetable for ${classInfo.name || classInfo.id}`, error);
            return { classInfo, schedules: [] };
          }
        })
      );

      const grouped = responses.reduce((acc, { classInfo, schedules }) => {
        schedules.forEach((schedule) => {
          const day = schedule.day || 'Monday';
          if (!acc[day]) acc[day] = [];
          acc[day].push(toLessonRow(schedule, classInfo));
        });
        return acc;
      }, {});

      setScheduleData(grouped);
    } catch (error) {
      showError(`Failed to fetch master timetable: ${error.message || String(error)}`);
      console.error(error);
    }
  };

  const fetchClassSchedule = async (classId) => {
    try {
      const resp = await api.classes.getSchedules(classId);
      const schedules = resp.data || [];
      const selectedClass = classes.find((c) => c.id === classId);

      // Group by day
      const grouped = schedules.reduce((acc, s) => {
        const day = s.day || 'Monday';
        if (!acc[day]) acc[day] = [];
        acc[day].push(toLessonRow(s, selectedClass));
        return acc;
      }, {});

      setScheduleData(grouped);
    } catch (error) {
      showError(`Failed to fetch schedules: ${error.message || String(error)}`);
      console.error(error);
    }
  };

  const openEditModal = (lesson, day) => {
    if (!canEditTimetable) {
      showError('You do not have permission to edit the timetable.');
      return;
    }
    if (!canOverride) {
      showError('Only Admins and Head Teachers can make quick edits to a published timetable.');
      return;
    }
    if (selectedClassId === 'all') {
      if (!lesson.classId) {
        showError('Select a specific class before editing this lesson.');
        return;
      }
      setSelectedClassId(lesson.classId);
    }
    setEditingLesson(lesson);
    setTimeLine(lesson.time);
    setSubjectId(lesson.subjectId || '');
    setTeacherId(lesson.teacherId || '');
    setRoom(lesson.room || '');
    setOverrideNote('');
    setLessonDay(day);
    setIsModalOpen(true);
  };

  const openAddModal = (day, timeSlot) => {
    if (!canEditTimetable) {
      showError('You do not have permission to edit the timetable.');
      return;
    }
    if (!canOverride) {
      showError('Only Admins and Head Teachers can make quick edits to a published timetable.');
      return;
    }
    if (selectedClassId === 'all') {
      showError('Select a specific class before adding a lesson.');
      return;
    }

    setEditingLesson(null);
    setTimeLine(timeSlot);
    setSubjectId('');
    setTeacherId('');
    setRoom('');
    setOverrideNote('');
    setLessonDay(day);
    setSelectedDay(day);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEditTimetable) {
      showError('You do not have permission to edit the timetable.');
      return;
    }
    if (!timeLine || !subjectId || !selectedClassId || selectedClassId === 'all') {
      showError("Please select a Class, Subject and Time");
      return;
    }

    if (!overrideNote.trim()) {
      showError("Please provide a reason for this change (e.g. 'Teacher absent — cover arranged')");
      return;
    }

    const parsedTime = parseTimeLine(timeLine);
    if (!parsedTime) {
      showError('Please provide a valid time block in the format "Start - End"');
      return;
    }

    const selectedSlotKey = buildSlotKey(parsedTime.startTime, parsedTime.endTime);
    const usedSlotKeys = getUsedSlotKeysForDay(lessonDay);
    const editingSlot = editingLesson ? parseTimeLine(editingLesson.time) : null;
    const editingSlotKey = editingSlot ? buildSlotKey(editingSlot.startTime, editingSlot.endTime) : '';

    if (usedSlotKeys.has(selectedSlotKey) && selectedSlotKey !== editingSlotKey) {
      const nextAvailable = getNextAvailableSlot(lessonDay, editingSlotKey);
      if (nextAvailable) {
        setTimeLine(nextAvailable.label);
      }
      showError(`That slot is already booked. ${nextAvailable ? `Next available slot preselected: ${nextAvailable.label}` : 'No more free slots for this day.'}`);
      return;
    }

    if (lessonDay === getCurrentWeekday() && teacherId && !isTeacherClockedIn(teacherId)) {
      showError('Selected tutor is not clocked in for today. Ask the tutor to clock in before booking today\'s lesson.');
      return;
    }

    const selectedSubject = subjects.find((s) => s.id === subjectId);
    if (!selectedSubject?.name) {
      showError('Please select a valid subject');
      return;
    }

    const payload = {
      subject: selectedSubject.name,
      day: lessonDay,
      startTime: parsedTime.startTime,
      endTime: parsedTime.endTime,
      learningAreaId: subjectId,
      teacherId: teacherId || null,
      room: room || 'Classroom',
      overrideNote: overrideNote.trim() || undefined,
    };

    try {
      if (editingLesson) {
        await api.classes.updateSchedule(selectedClassId, editingLesson.id, payload);
        showSuccess("Lesson updated successfully");
      } else {
        await api.classes.addSchedule(selectedClassId, payload);
        showSuccess("Lesson scheduled successfully");
      }
      fetchClassSchedule(selectedClassId);
      setIsModalOpen(false);
    } catch (error) {
      showError(error.message || "Failed to save lesson");
    }
  };

  const getWeekPdfFilename = () => {
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    const classLabel = selectedClass
      ? (selectedClass.name || `${selectedClass.grade || ''}_${selectedClass.stream || ''}`.trim())
      : 'all_classes';
    const safeClass = String(classLabel || 'all_classes').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    return `timetable_week_${safeClass}_${new Date().toISOString().split('T')[0]}.pdf`;
  };

  const handleDownloadWeekPdf = async () => {
    if (isDownloadingWeekPdf || isSharingWeekPdf) return;
    if (viewMode !== 'weekly') {
      showError('Switch to Weekly view to download Week at a Glance PDF.');
      return;
    }

    const hasLessons = Object.values(scheduleData).flat().length > 0;
    if (!hasLessons) {
      showError('No timetable lessons found to export.');
      return;
    }

    try {
      showInfo('Generating Week at a Glance PDF...');
      setIsDownloadingWeekPdf(true);
      const result = await generateHighFidelityPDF('week-at-a-glance-content', getWeekPdfFilename(), {
        action: 'download',
        ...TIMETABLE_PDF_OPTIONS
      });

      if (result?.success) showSuccess('Week at a Glance downloaded as PDF.');
      else showError(result?.error || 'Failed to download Week at a Glance PDF.');
    } finally {
      setIsDownloadingWeekPdf(false);
    }
  };

  const handleShareWeekPdf = async () => {
    if (isSharingWeekPdf || isDownloadingWeekPdf) return;
    if (viewMode !== 'weekly') {
      showError('Switch to Weekly view to share Week at a Glance PDF.');
      return;
    }

    const hasLessons = Object.values(scheduleData).flat().length > 0;
    if (!hasLessons) {
      showError('No timetable lessons found to share.');
      return;
    }

    try {
      showInfo('Generating Week at a Glance PDF for sharing...');
      setIsSharingWeekPdf(true);
      const fileName = getWeekPdfFilename();
      const result = await generateHighFidelityPDF('week-at-a-glance-content', fileName, {
        action: 'blob',
        ...TIMETABLE_PDF_OPTIONS
      });

      if (!result?.success || !result?.blob) {
        showError(result?.error || 'Failed to generate PDF for sharing.');
        return;
      }

      const pdfFile = new File([result.blob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: 'Class Timetable - Week at a Glance',
            text: 'Weekly class timetable PDF'
          });
          showSuccess('Week at a Glance shared successfully.');
        } catch (error) {
          if (error?.name !== 'AbortError') {
            showError('Share was not completed.');
          }
        }
        return;
      }

      await generateHighFidelityPDF('week-at-a-glance-content', fileName, { action: 'download', ...TIMETABLE_PDF_OPTIONS });
      showSuccess('Sharing is not supported on this browser. PDF downloaded instead.');
    } finally {
      setIsSharingWeekPdf(false);
    }
  };

  const weeklyTimeSlots = sortTimeLabels(new Set([
    ...DEFAULT_TIME_SLOTS.map((slot) => buildTimeLine(slot.startTime, slot.endTime)),
    ...Object.values(scheduleData).flat().map((lesson) => lesson.time).filter(Boolean)
  ]));
  const mobileLessons = (scheduleData[selectedDay] || [])
    .slice()
    .sort((a, b) => {
      const aStart = String(a.time || '').split('-')[0]?.trim();
      const bStart = String(b.time || '').split('-')[0]?.trim();
      return parseTimeToMinutes(aStart) - parseTimeToMinutes(bStart);
    });
  const schoolName = user?.school?.name || user?.schoolName || 'School Timetable';
  const schoolLogoUrl = user?.school?.logoUrl || user?.school?.logo || user?.schoolLogo || '/branding/logo.png';
  const daySlotOptions = getTimeSlotOptions(lessonDay);
  const usedSlotKeys = getUsedSlotKeysForDay(lessonDay);
  const editingSlotKey = editingLesson ? (() => {
    const slot = parseTimeLine(editingLesson.time);
    return slot ? buildSlotKey(slot.startTime, slot.endTime) : '';
  })() : '';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
        <Loader2 className="animate-spin mb-4 text-brand-purple" size={48} />
        <p className="text-lg font-medium">Synchronizing Timetable...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <style>{`
        /* Timetable Matrix Styling - compact weekly grid */
        #week-at-a-glance-content {
          padding: 0;
          background: white;
          border-radius: 8px;
        }
        
        #week-at-a-glance-content table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #cbd5e1;
          table-layout: fixed;
        }
        
        #week-at-a-glance-content thead th {
          border: 1px solid #cbd5e1;
          padding: 13px 10px;
          min-width: 132px;
          text-align: left;
          font-weight: 800;
          color: #111827;
          background-color: #ffffff;
          font-size: 12px;
          line-height: 1.1;
          text-transform: uppercase;
        }
        
        #week-at-a-glance-content tbody td {
          border: 1px solid #cbd5e1;
          height: 58px;
          padding: 9px 10px;
          text-align: left;
          vertical-align: middle;
          background-color: #fff;
          font-size: 11px;
        }
        
        #week-at-a-glance-content tbody td:first-child {
          background-color: #ffffff;
          color: #111827;
          width: 128px;
          padding: 8px 10px;
        }
        
        #week-at-a-glance-content .time-block-cell {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 8px;
          min-width: 108px;
        }

        #week-at-a-glance-content .time-block-icon {
          width: 14px;
          height: 14px;
          color: #7c89a6;
          flex: 0 0 auto;
          margin-top: 1px;
        }

        #week-at-a-glance-content .time-block-text {
          color: #111827;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.25;
          text-align: left;
          white-space: normal;
        }

        #week-at-a-glance-content .lesson-card {
          background: none;
          color: #17213d;
          border: none;
          border-radius: 0;
          padding: 0;
          margin: 0;
          border-left: none;
          box-shadow: none;
          page-break-inside: avoid;
          display: block;
          width: 100%;
          text-align: left;
          cursor: default;
          transition: background-color 0.15s ease;
          font-size: 11px;
          line-height: 1.25;
        }
        
        #week-at-a-glance-content .lesson-card:hover {
          opacity: 1;
          transform: none;
          background-color: #f8fafc;
        }
        
        #week-at-a-glance-content .lesson-card-subject {
          font-weight: 800;
          font-size: 11px;
          margin-bottom: 6px;
          letter-spacing: 0;
          line-height: 1.2;
          color: #17213d;
        }
        
        #week-at-a-glance-content .lesson-card-details {
          font-size: 10px;
          opacity: 1;
          display: block;
          line-height: 1.25;
          margin-top: 2px;
          color: #56627d;
        }
        
        #week-at-a-glance-content .lesson-card-detail-item {
          display: inline;
          font-size: 10px;
          color: #56627d;
        }
        
        #week-at-a-glance-content .lesson-card-detail-item:not(:last-child)::after {
          content: " • ";
          margin: 0 6px;
          color: #17213d;
        }
        
        #week-at-a-glance-content .empty-slot {
          color: #cbd5e1;
          text-align: center;
          font-size: 11px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 40px;
        }

        #week-at-a-glance-content button.empty-slot {
          width: 100%;
          border: 0;
          background: transparent;
          cursor: pointer;
          transition: color 0.15s ease, background-color 0.15s ease;
        }

        #week-at-a-glance-content button.empty-slot:hover,
        #week-at-a-glance-content button.empty-slot:focus-visible {
          color: var(--color-brand-purple, #4f46e5);
          background-color: #f8fafc;
          outline: none;
        }

        /* Hide interactive UI elements in PDF */
        @media print {
          .no-print,
          .screen-only,
          button,
          .flex.justify-end {
            display: none !important;
          }

          #week-at-a-glance-content {
            padding: 0;
            margin: 0;
            overflow: visible;
          }
        }
      `}</style>
      {/* Actions Toolbar */}
      {!isMobile && (
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-medium text-gray-800">Class Timetable</h2>
          <p className="text-sm text-gray-500">Manage daily schedules and room allocations interactively</p>
        </div>
        <div className="flex items-center gap-3">
          {canEditTimetable && (
            <button
              type="button"
              onClick={() => setEngineSetupOpen(true)}
              className="h-10 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold flex items-center gap-2 hover:bg-indigo-100 transition-colors"
            >
              <Settings2 size={16} /> Engine setup
            </button>
          )}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-gray-700 focus:ring-0 mr-2"
            >
              <option value="all">Master View (Select a Class)</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name || `${c.grade} ${c.stream}`}</option>
              ))}
            </select>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'weekly' ? 'bg-white text-brand-purple shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Weekly
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'daily' ? 'bg-white text-brand-purple shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Daily
            </button>
          </div>
        </div>
      </div>
      )}

      <TimetableEngineSetup
        open={engineSetupOpen}
        onClose={() => setEngineSetupOpen(false)}
        teachers={teachers}
        learningAreas={subjects}
        canEdit={canEditTimetable}
      />

      {isMobile && (
        <div className="px-3 pt-3 pb-4 space-y-3">
          <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((current) => {
                const next = new Date(current);
                next.setDate(current.getDate() - 7);
                return next;
              })}
              className="h-12 rounded-lg border border-gray-200 bg-white text-[#17213d] flex items-center justify-center shadow-sm"
              aria-label="Previous week"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="h-12 rounded-lg border border-gray-200 bg-white text-[#17213d] flex items-center justify-center gap-3 px-3 shadow-sm">
              <Clock size={17} className="text-brand-purple" />
              <span className="text-sm font-semibold">{formatWeekRange(weekStart)}</span>
            </div>
            <button
              type="button"
              onClick={() => setWeekStart((current) => {
                const next = new Date(current);
                next.setDate(current.getDate() + 7);
                return next;
              })}
              className="h-12 rounded-lg border border-gray-200 bg-white text-[#17213d] flex items-center justify-center shadow-sm"
              aria-label="Next week"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-[#17213d] shadow-sm focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name || `${c.grade} ${c.stream}`}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const currentWeekday = getCurrentWeekday();
                setSelectedDay(days.includes(currentWeekday) ? currentWeekday : 'Monday');
              }}
              className="h-12 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-[#17213d] shadow-sm flex items-center justify-center gap-2"
            >
              <Filter size={17} />
              Today
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`h-9 shrink-0 rounded-full px-4 text-xs font-semibold transition ${
                  selectedDay === day
                    ? 'bg-brand-purple text-white'
                    : 'bg-white text-[#17213d] border border-gray-200'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {mobileLessons.length > 0 ? (
              mobileLessons.map((lesson) => {
                const canOpenLesson = canEditTimetable && canOverride && selectedClassId !== 'all';
                return (
                  <button
                    key={`${lesson.classId || selectedClassId}-${lesson.id}`}
                    type="button"
                    onClick={() => {
                      if (canOpenLesson) openEditModal(lesson, selectedDay);
                    }}
                    className={`grid w-full grid-cols-[112px_minmax(0,1fr)_28px] border-b border-gray-100 text-left last:border-b-0 ${canOpenLesson ? 'active:bg-gray-50' : 'cursor-default'}`}
                  >
                    <div className="flex gap-3 border-r border-gray-100 px-3 py-3 text-[#17213d]">
                      <Clock size={18} className="mt-0.5 shrink-0 text-brand-purple" />
                      <div className="text-xs font-bold leading-5">
                        {String(lesson.time || '').split('-').map((part) => (
                          <div key={part.trim()}>{part.trim()}</div>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 px-4 py-3">
                      <div className="truncate text-sm font-bold text-[#17213d] flex items-center gap-1.5">
                        {lesson.isOverride && (
                          <span title={`Manual override: ${lesson.overrideNote}`} className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        )}
                        {lesson.subject || 'Untitled Lesson'}
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#56627d]">
                        <span className="truncate">{lesson.teacherName || 'Unassigned'}</span>
                        <span aria-hidden="true">•</span>
                        <span className="truncate">{lesson.room || 'Room N/A'}</span>
                        {selectedClassId === 'all' && lesson.className && (
                          <>
                            <span aria-hidden="true">•</span>
                            <span className="truncate">{lesson.className}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-center text-[#17213d]">
                      {canOpenLesson && <ChevronRight size={20} />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-10 text-center">
                <div className="text-sm font-semibold text-[#17213d]">No lessons for {selectedDay}</div>
                <div className="mt-1 text-xs text-[#56627d]">Choose another day or class to view the timetable.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weekly Overview Grid */}
      {!isMobile && viewMode === 'weekly' && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">Week at a Glance</h3>
              <p className="text-sm text-gray-600">Your full week schedule overview</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareWeekPdf}
                disabled={isSharingWeekPdf || isDownloadingWeekPdf}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSharingWeekPdf ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                {isSharingWeekPdf ? 'Sharing…' : 'Share PDF'}
              </button>
              <button
                onClick={handleDownloadWeekPdf}
                disabled={isDownloadingWeekPdf || isSharingWeekPdf}
                className="flex items-center gap-2 px-3 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDownloadingWeekPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {isDownloadingWeekPdf ? 'Downloading…' : 'Download PDF'}
              </button>
            </div>
          </div>

          <div id="week-at-a-glance-content" className="overflow-x-auto">
            <TimetablePDFWrapper 
              schoolName={schoolName}
              selectedClass={getSelectedClass()?.name || `${getSelectedClass()?.grade} ${getSelectedClass()?.stream}`.trim() || 'All Classes'}
              weekInfo={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
              logoUrl={schoolLogoUrl}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-32">
                      TIME BLOCK
                    </th>
                    {days.map((day) => (
                      <th key={day}>
                        {day.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Keep the full timetable structure visible, including before lessons are added. */}
                  {weeklyTimeSlots.map(timeSlot => (
                    <tr key={timeSlot}>
                      <td>
                        <div className="time-block-cell">
                          <Clock className="time-block-icon" />
                          <span className="time-block-text">{timeSlot}</span>
                        </div>
                      </td>
                      {days.map((day) => {
                        const lessons = scheduleData[day]?.filter(l => l.time === timeSlot) || [];
                        return (
                          <td key={day}>
                            {lessons.length > 0 ? (
                              <div className="flex flex-col gap-0 w-full">
                                {lessons.map(lesson => (
                                  <div 
                                    key={lesson.id} 
                                    className={`lesson-card ${canEditTimetable && canOverride ? 'cursor-pointer' : ''}`}
                                    onClick={() => { if (canEditTimetable && canOverride) { setSelectedDay(day); openEditModal(lesson, day); } }}
                                  >
                                    <div className="lesson-card-subject flex items-center gap-1">
                                      {lesson.isOverride && (
                                        <span title={`Manual override: ${lesson.overrideNote}`} className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                      )}
                                      {lesson.subject}
                                    </div>
                                    <div className="lesson-card-details">
                                      <span className="lesson-card-detail-item">{lesson.teacherName}</span>
                                      <span className="lesson-card-detail-item">{lesson.room}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              canEditTimetable && canOverride ? (
                                <button
                                  type="button"
                                  className="empty-slot"
                                  onClick={() => openAddModal(day, timeSlot)}
                                  aria-label={`Add lesson on ${day} at ${timeSlot}`}
                                  title="Add lesson"
                                >
                                  <Plus size={16} aria-hidden="true" />
                                </button>
                              ) : (
                                <div className="empty-slot" />
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TimetablePDFWrapper>
          </div>
        </div>
      )}

      {/* Modal for Adding/Editing */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-medium text-gray-900">
                {editingLesson ? 'Edit Lesson' : 'Schedule New Lesson'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Day of Week</label>
                <select
                  value={lessonDay}
                  onChange={e => {
                    const nextDay = e.target.value;
                    setLessonDay(nextDay);
                    if (!editingLesson) {
                      const nextSlot = getNextAvailableSlot(nextDay);
                      setTimeLine(nextSlot?.label || '');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple bg-white"
                >
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Time Block</label>
                <select
                  value={timeLine}
                  onChange={e => setTimeLine(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple bg-white"
                  required
                >
                  <option value="">Select Time Slot</option>
                  {daySlotOptions.map((slot) => {
                    const isUsed = usedSlotKeys.has(slot.key) && slot.key !== editingSlotKey;
                    return (
                      <option key={slot.key} value={slot.label} disabled={isUsed}>
                        {slot.label}{isUsed ? ' (Booked)' : ''}
                      </option>
                    );
                  })}
                </select>
                {!editingLesson && !timeLine && (
                  <p className="mt-1 text-xs text-amber-700 font-medium">No free slots available for this day. Choose another day.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => {
                      const sid = e.target.value;
                      setSubjectId(sid);
                      const suggestedTeacherId = getPrefilledTeacherId(sid);
                      setTeacherId(suggestedTeacherId);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple bg-white"
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.gradeLevel})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tutor</label>
                  <select
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple bg-white"
                  >
                    <option value="">Select Tutor (Optional)</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Room/Location</label>
                <input type="text" value={room} onChange={e => setRoom(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple" placeholder="e.g. Room 101" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Reason for change <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={overrideNote}
                  onChange={e => setOverrideNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple"
                  placeholder="e.g. Teacher absent — cover arranged"
                  required
                  maxLength={300}
                />
                <p className="mt-1 text-xs text-gray-400">This is recorded as a manual override on the published timetable.</p>
              </div>
              {lessonDay === getCurrentWeekday() && teacherId && !isTeacherClockedIn(teacherId) && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold">
                  Selected tutor has not clocked in today. This booking cannot be saved until the tutor clocks in.
                </div>
              )}
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 bg-white border border-gray-200 rounded-lg font-medium">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 font-medium shadow-sm">
                  {editingLesson ? 'Save Changes' : 'Add to Timetable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={hideNotification}
      />
    </div>
  );
};

export default TimetablePage;
