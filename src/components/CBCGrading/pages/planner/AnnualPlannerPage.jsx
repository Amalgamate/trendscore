import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../../../services/api';
import CalendarView from './CalendarView';
import EventAudiencePicker from './EventAudiencePicker';
import AcademicYearSetup from './AcademicYearSetup';
import { getDynamicAcademicYears } from '../../utils/academicYear';
import { usePermissions } from '../../../../hooks/usePermissions';
import { 
  Plus, 
  Calendar, 
  Printer, 
  FileText, 
  Filter, 
  Lock, 
  AlertCircle,
  BookOpen,
  Award,
  Compass,
  Users,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';

const EVENT_TYPES = {
  GENERAL: { label: 'General', bg: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-500', bar: 'bg-slate-500' },
  ACADEMIC: { label: 'Academic', bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', bar: 'bg-blue-500' },
  ASSESSMENT: { label: 'Assessment', bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', bar: 'bg-purple-500' },
  EXAM: { label: 'Examination', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
  EXAM_WEEK: { label: 'Exam week', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
  TERM_OPENING: { label: 'Term opening', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  TERM_CLOSING: { label: 'Term closing', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-500' },
  MIDTERM_BREAK: { label: 'Mid-term break', bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', bar: 'bg-orange-500' },
  HOLIDAY: { label: 'Holiday', bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', bar: 'bg-red-500' },
  FINANCE: { label: 'Finance', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  SPORTS: { label: 'Sports', bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', bar: 'bg-orange-500' },
  TRIP: { label: 'Trip', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500', bar: 'bg-cyan-500' },
  MEETING: { label: 'Meeting', bg: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500', bar: 'bg-violet-500' },
  STAFF_EVENT: { label: 'Staff Event', bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', bar: 'bg-rose-500' },
  PARENT_EVENT: { label: 'Parent Event', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-500' },
  NATIONAL_EVENT: { label: 'National Event', bg: 'bg-pink-50 text-pink-700 border-pink-200', dot: 'bg-pink-500', bar: 'bg-pink-500' },
  OTHER: { label: 'Other', bg: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-500', bar: 'bg-slate-500' },
};

const TERMS = [
  { id: 'TERM_1', label: 'Term 1' },
  { id: 'TERM_2', label: 'Term 2' },
  { id: 'TERM_3', label: 'Term 3' },
];

const AUDIENCE_LABELS = {
  STAFF: 'All staff',
  TEACHERS: 'Teachers',
  PARENTS: 'Parents',
  STUDENTS: 'Students',
  DRIVERS: 'Drivers',
};

/** Plain-language audience for tooltips, e.g. "Parents, 2 classes". */
const describeAudience = (event) => {
  const audience = Array.isArray(event.audience) ? event.audience : [];
  const classCount = Array.isArray(event.classIds) ? event.classIds.length : 0;
  const who = audience.length ? audience.map((a) => AUDIENCE_LABELS[a] || a).join(', ') : 'Everyone';
  return classCount ? `${who}, ${classCount} class${classCount === 1 ? '' : 'es'}` : who;
};

const dateKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDateKey = (key) => key
  ? new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  : 'Dates not set';

const countWeekdays = (startKey, endKey, excludedEvents = []) => {
  if (!startKey || !endKey || startKey > endKey) return null;
  const excludedDates = new Set();
  excludedEvents.forEach((event) => {
    if (!['HOLIDAY', 'MIDTERM_BREAK'].includes(event.type)) return;
    const start = dateKey(event.startDate);
    const end = dateKey(event.endDate) || start;
    if (!start || !end) return;
    for (let cursor = new Date(`${start}T12:00:00`); dateKey(cursor) <= end; cursor.setDate(cursor.getDate() + 1)) {
      excludedDates.add(dateKey(cursor));
    }
  });
  let total = 0;
  for (let cursor = new Date(`${startKey}T12:00:00`); dateKey(cursor) <= endKey; cursor.setDate(cursor.getDate() + 1)) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6 && !excludedDates.has(dateKey(cursor))) total += 1;
  }
  return total;
};

const scopesOverlap = (a, b) => {
  const aClasses = Array.isArray(a.classIds) ? a.classIds : [];
  const bClasses = Array.isArray(b.classIds) ? b.classIds : [];
  const aAudience = Array.isArray(a.audience) ? a.audience : [];
  const bAudience = Array.isArray(b.audience) ? b.audience : [];
  const classesOverlap = !aClasses.length || !bClasses.length || aClasses.some((id) => bClasses.includes(id));
  const staffGroupsOverlap = (aAudience.includes('STAFF') && bAudience.some((audience) => ['STAFF', 'TEACHERS', 'DRIVERS'].includes(audience)))
    || (bAudience.includes('STAFF') && aAudience.some((audience) => ['STAFF', 'TEACHERS', 'DRIVERS'].includes(audience)));
  const audienceOverlap = !aAudience.length || !bAudience.length
    || aAudience.some((audience) => bAudience.includes(audience))
    || staffGroupsOverlap;
  const sharedClassFamilyEvent = aClasses.length > 0 && bClasses.length > 0 && classesOverlap
    && [...aAudience, ...bAudience].some((audience) => ['PARENTS', 'STUDENTS'].includes(audience));
  const locationA = String(a.location || '').trim().toLowerCase();
  const locationB = String(b.location || '').trim().toLowerCase();
  const locationOverlap = Boolean(locationA && locationA === locationB);
  return (classesOverlap && (audienceOverlap || sharedClassFamilyEvent)) || locationOverlap;
};

const findEventConflicts = (events) => {
  const conflicts = [];
  const sorted = [...events].filter((event) => event.startDate && event.endDate && !['TERM_OPENING', 'TERM_CLOSING'].includes(event.type))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  for (let i = 0; i < sorted.length; i += 1) {
    const first = sorted[i];
    const firstStart = new Date(first.startDate);
    const firstEnd = new Date(first.endDate);
    for (let j = i + 1; j < sorted.length; j += 1) {
      const second = sorted[j];
      const secondStart = new Date(second.startDate);
      if (first.allDay ? dateKey(secondStart) > dateKey(firstEnd) : secondStart > firstEnd) break;
      const secondEnd = new Date(second.endDate);
      const overlap = first.allDay || second.allDay
        ? dateKey(firstStart) <= dateKey(secondEnd) && dateKey(secondStart) <= dateKey(firstEnd)
        : firstStart < secondEnd && secondStart < firstEnd;
      if (overlap && scopesOverlap(first, second)) conflicts.push({ first, second });
    }
  }
  return conflicts;
};

const INITIAL_TERM_FORM = {
  openingDate: '',
  closingDate: '',
  midtermStart: '',
  midtermEnd: '',
  examStart: '',
  examEnd: '',
  isParentVisible: true,
};

export default function AnnualPlannerPage({ initialTab = 'dashboard' } = {}) {
  // Term dates are term settings, which only school admins may change.
  const { isAnyRole } = usePermissions();
  const canSetUpYear = isAnyRole(['ADMIN', 'SUPER_ADMIN']);
  const canManageEvents = isAnyRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']);
  const canDeleteEvents = isAnyRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState(initialTab === 'terms' && canSetUpYear ? 'terms' : initialTab === 'events' ? 'events' : 'dashboard');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [setupDirty, setSetupDirty] = useState(false);
  const eventRequestSequence = useRef(0);
  
  // Term Setup forms state
  const [termForms, setTermForms] = useState({
    TERM_1: { ...INITIAL_TERM_FORM },
    TERM_2: { ...INITIAL_TERM_FORM },
    TERM_3: { ...INITIAL_TERM_FORM },
  });

  // Modal event for Custom Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEvent, setModalEvent] = useState(null); // null for create, event object for edit
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    allDay: false,
    type: 'GENERAL',
    location: '',
    meetingLink: '',
    audience: [],
    classIds: [],
    academicYear: '',
    term: '',
  });

  // Filters for Events Manager
  const [managerFilters, setManagerFilters] = useState({
    term: 'ALL',
    type: 'ALL',
  });

  const fetchActiveYear = async () => {
    try {
      const response = await api.config.getActiveTermConfig();
      const active = response?.data ?? response ?? null;
      if (active && active.academicYear) {
        setAcademicYear(active.academicYear);
      }
    } catch (error) {
      console.error('Failed to get active term config', error);
    }
  };

  const fetchEvents = useCallback(async () => {
    const requestId = ++eventRequestSequence.current;
    setLoading(true);
    try {
      const response = await api.planner.getEvents({ academicYear });
      const data = response?.data ?? response ?? [];
      if (requestId !== eventRequestSequence.current) return;
      setEvents(data);

      // Populate Term Setup forms
      const termsData = {
        TERM_1: { ...INITIAL_TERM_FORM },
        TERM_2: { ...INITIAL_TERM_FORM },
        TERM_3: { ...INITIAL_TERM_FORM },
      };

      data.forEach(event => {
        if (event.term && termsData[event.term]) {
          const term = event.term;
          const startStr = event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : '';
          const endStr = event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '';
          
          if (event.type === 'TERM_OPENING') {
            termsData[term].openingDate = startStr;
            termsData[term].isParentVisible = event.isParentVisible;
          } else if (event.type === 'TERM_CLOSING') {
            termsData[term].closingDate = startStr;
          } else if (event.type === 'MIDTERM_BREAK') {
            termsData[term].midtermStart = startStr;
            termsData[term].midtermEnd = endStr;
          } else if (event.type === 'EXAM_WEEK') {
            termsData[term].examStart = startStr;
            termsData[term].examEnd = endStr;
          }
        }
      });

      setTermForms(termsData);
    } catch (error) {
      if (requestId === eventRequestSequence.current) {
        console.error('Failed to fetch events', error);
        toast.error('Failed to load academic events');
      }
    } finally {
      if (requestId === eventRequestSequence.current) setLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    fetchActiveYear();
  }, []);

  useEffect(() => {
    if (initialTab === 'terms' && canSetUpYear) {
      setActiveTab('terms');
    } else if (initialTab === 'events') {
      setActiveTab('events');
    } else if (initialTab === 'dashboard' || !initialTab) {
      setActiveTab('dashboard');
    }
  }, [initialTab, canSetUpYear]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleOpenAddModal = (type = 'GENERAL', term = '') => {
    if (!canManageEvents) return;
    setModalEvent(null);
    setEventForm({
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      allDay: false,
      type,
      location: '',
      meetingLink: '',
      audience: [],
      classIds: [],
      academicYear: academicYear.toString(),
      term,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
    if (!canManageEvents) return;
    setModalEvent(event);
    setEventForm({
      title: event.title || '',
      description: event.description || '',
      startDate: event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : '',
      endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : '',
      allDay: event.allDay || false,
      type: event.type || 'GENERAL',
      location: event.location || '',
      meetingLink: event.meetingLink || '',
      audience: Array.isArray(event.audience) ? event.audience : [],
      classIds: Array.isArray(event.classIds) ? event.classIds : [],
      academicYear: event.academicYear ? event.academicYear.toString() : academicYear.toString(),
      term: event.term || '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (id) => {
    if (!canDeleteEvents) return;
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    setLoading(true);
    try {
      await api.planner.deleteEvent(id);
      toast.success('Event deleted successfully');
      fetchEvents();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete event');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomEvent = async (e) => {
    e.preventDefault();
    if (!canManageEvents) return;
    if (!eventForm.title || !eventForm.startDate || !eventForm.endDate) {
      toast.error('Title, start, and end dates are required');
      return;
    }

    const payload = {
      ...eventForm,
      startDate: new Date(eventForm.startDate).toISOString(),
      endDate: new Date(eventForm.endDate).toISOString(),
      academicYear: eventForm.academicYear ? parseInt(eventForm.academicYear, 10) : null,
      term: eventForm.term || null,
    };

    setLoading(true);
    try {
      if (modalEvent) {
        await api.planner.updateEvent(modalEvent.id, payload);
        toast.success('Event updated successfully');
      } else {
        await api.planner.createEvent(payload);
        toast.success('Event scheduled successfully');
      }
      setIsModalOpen(false);
      fetchEvents();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  // Memoized stats calculations for year planner
  const stats = useMemo(() => {
    const byType = (...types) => events.filter((event) => types.includes(event.type)).length;
    const counts = {
      total: events.length,
      academic: byType('ACADEMIC', 'TERM_OPENING', 'TERM_CLOSING'),
      assessment: byType('ASSESSMENT'),
      examination: byType('EXAM', 'EXAM_WEEK'),
      holiday: byType('HOLIDAY', 'MIDTERM_BREAK'),
      finance: byType('FINANCE'),
      sports: byType('SPORTS'),
      trip: byType('TRIP'),
      meeting: byType('MEETING'),
      staff: byType('STAFF_EVENT'),
      parent: byType('PARENT_EVENT'),
      national: byType('NATIONAL_EVENT'),
      other: byType('OTHER', 'GENERAL'),
    };

    const termDays = TERMS.map((term) => {
      const form = termForms[term.id];
      return { ...term, days: countWeekdays(form.openingDate, form.closingDate, events) };
    });
    const completeTerms = termDays.filter((term) => term.days !== null).length;
    const schoolDays = completeTerms === TERMS.length
      ? termDays.reduce((sum, term) => sum + (term.days || 0), 0)
      : null;
    return { ...counts, schoolDays, termDays, completeTerms };
  }, [events, termForms]);

  const conflicts = useMemo(() => findEventConflicts(events), [events]);

  // Compliance checklists & progress percentage
  const compliance = useMemo(() => {
    const list = [
      { id: 'year', label: 'All three term dates configured', status: stats.completeTerms === TERMS.length },
      { id: 'agenda', label: 'Upcoming events are scheduled', status: events.some((event) => new Date(event.startDate) >= new Date()) },
      { id: 'assessments', label: 'Assessment Calendars Active', status: stats.assessment > 0 },
      { id: 'exams', label: 'Examination Schedule Created', status: stats.examination > 0 },
      { id: 'holidays', label: 'Holidays and mid-term breaks recorded', status: stats.holiday > 0 },
      { id: 'meetings', label: 'Parent Interaction Events Scheduled', status: stats.parent > 0 },
      { id: 'conflicts', label: 'No overlapping audiences, classes, or locations', status: conflicts.length === 0 },
    ];
    const completedCount = list.filter(item => item.status).length;
    const pct = Math.round((completedCount / list.length) * 100);
    return { list, percentage: pct };
  }, [stats, conflicts, events]);

  // Group events for horizontal yearly timeline visualization
  const monthsData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(academicYear, i, 1);
      return {
        index: i,
        name: d.toLocaleString('default', { month: 'short' }),
        fullName: d.toLocaleString('default', { month: 'long' }),
        events: []
      };
    });

    events.forEach(event => {
      const d = new Date(event.startDate);
      if (d.getFullYear() === academicYear) {
        months[d.getMonth()].events.push({
          ...event,
          day: d.getDate()
        });
      }
    });

    return months;
  }, [events, academicYear]);

  // Calculate day-of-year activity densities (GitHub-style heatmap representation)
  const heatmapData = useMemo(() => {
    // Generate dates mapping for grid of current academic year
    const days = [];
    const startDate = new Date(academicYear, 0, 1);
    const endDate = new Date(academicYear, 11, 31);
    
    // Group events counts by YYYY-MM-DD
    const dateCounts = {};
    events.forEach(e => {
      const key = dateKey(e.startDate);
      dateCounts[key] = (dateCounts[key] || 0) + 1;
    });

    let current = new Date(startDate);
    while (current <= endDate) {
      const key = dateKey(current);
      days.push({
        dateStr: key,
        day: current.getDate(),
        month: current.getMonth(),
        count: dateCounts[key] || 0,
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [events, academicYear]);

  // Filtered upcoming events lists
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.startDate) >= now)
      .slice(0, 10);
  }, [events]);

  // Unsaved term-setup edits are lost when the year or tab changes, so ask first.
  const confirmDiscardSetup = () =>
    !(activeTab === 'terms' && setupDirty) ||
    window.confirm('You have unsaved changes to the academic year. Discard them?');

  const handleYearChange = (e) => {
    if (!confirmDiscardSetup()) return;
    setAcademicYear(parseInt(e.target.value, 10));
  };

  const handleTabChange = (tabId) => {
    if (tabId !== activeTab && !confirmDiscardSetup()) return;
    setActiveTab(tabId);
  };

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] text-slate-800 print:bg-white pb-24">
      <div className="p-6 lg:p-8 print:p-0">
      <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">Annual Planner</h1>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <label htmlFor="year-select" className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Academic Year</label>
            <select 
              id="year-select"
              value={academicYear} 
              onChange={handleYearChange}
              className="font-extrabold text-slate-800 bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer pr-8 text-sm"
            >
              {getDynamicAcademicYears({ minPast: 4, minFuture: 6, extraYears: [academicYear], order: 'desc' }).map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={() => window.print()} className="gap-2"><Printer size={15} /> Print report</Button>
          </div>
      </div>

      {/* Active Tab Container. Content stays mounted while events reload, so unsaved forms survive. */}
      {loading && (
        <div
          className="fixed top-0 inset-x-0 h-1 bg-blue-600/70 animate-pulse z-50 print:hidden"
          role="status"
          aria-label="Loading"
        />
      )}
      {(
        <div>

          {/* TAB 1: COMMAND CENTER (DASHBOARD HUB) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              
              {/* Hero Summary Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 lg:p-8 text-white shadow-md relative overflow-hidden flex flex-col lg:flex-row justify-between gap-8 min-h-[220px]">
                <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                
                {/* Left metrics block */}
                <div className="z-10 flex flex-col justify-between flex-1">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/10 uppercase tracking-wider">
                      Active Year
                    </span>
                    <h2 className="text-3xl font-black tracking-tight mt-3 text-white">Academic Year {academicYear}</h2>
                    <p className="text-blue-100 text-sm mt-1.5 max-w-md leading-relaxed font-medium">
                      Plan terms, examinations, holidays, assessments and school events from one central cockpit.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-2xl font-black text-white">{stats.schoolDays ?? '—'}</p>
                      <p className="text-[10px] text-blue-200 uppercase font-extrabold tracking-wider mt-0.5">Estimated Teaching Weekdays</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{stats.total}</p>
                      <p className="text-[10px] text-blue-200 uppercase font-extrabold tracking-wider mt-0.5">Total Events</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{stats.completeTerms}/3</p>
                      <p className="text-[10px] text-blue-200 uppercase font-extrabold tracking-wider mt-0.5">Terms Dated</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{compliance.percentage}%</p>
                      <p className="text-[10px] text-blue-200 uppercase font-extrabold tracking-wider mt-0.5">Readiness</p>
                    </div>
                  </div>
                </div>

                {/* Right timeline & progress blocks */}
                <div className="z-10 flex flex-col justify-between w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/10 pt-6 lg:pt-0 lg:pl-8">
                  <div>
                    <h3 className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-3">Academic Timeline</h3>
                    <div className="space-y-2.5">
                      {stats.termDays.map((term) => {
                        const form = termForms[term.id];
                        const range = form.openingDate && form.closingDate
                          ? `${new Date(`${form.openingDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${new Date(`${form.closingDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                          : 'Dates not set';
                        return <div key={term.id} className="flex items-center justify-between text-xs font-semibold text-white"><span>{term.label}</span><span className="text-blue-200">{range}</span></div>;
                      })}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between text-xs font-bold text-blue-200 uppercase mb-2">
                      <span>Planning Readiness</span>
                      <span className="text-white">{compliance.percentage}%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-white h-full rounded-full transition-all duration-500" 
                style={{ width: `${compliance.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Statistics (6 KPI Cards) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Teaching Weekdays*', count: stats.schoolDays ?? '—', icon: BookOpen, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                  { label: 'Total Events', count: stats.total, icon: Calendar, color: 'text-slate-600 bg-slate-50 border-slate-200' },
                  { label: 'Assessments', count: stats.assessment, icon: Award, color: 'text-purple-600 bg-purple-50 border-purple-100' },
                  { label: 'Examinations', count: stats.examination, icon: FileText, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                  { label: 'School Trips', count: stats.trip, icon: Compass, color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
                  { label: 'Holidays & Breaks', count: stats.holiday, icon: AlertCircle, color: 'text-rose-600 bg-rose-50 border-rose-100' },
                  { label: 'Possible Overlaps', count: conflicts.length, icon: AlertCircle, color: conflicts.length ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                ].map((kpi, idx) => {
                  const Icon = kpi.icon;
                  return (
                    <div 
                      key={idx} 
                      className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between min-h-[120px]"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-2xl font-black text-slate-900">{kpi.count}</span>
                        <span className={`p-2 rounded-xl border ${kpi.color}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide leading-tight mt-3">{kpi.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <section className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div><h3 className="font-extrabold text-slate-900">Term at a glance</h3><p className="text-xs text-slate-500 mt-1">Weekday estimate excludes weekends, holidays, and mid-term breaks.</p></div>
                    {canSetUpYear && <button type="button" onClick={() => handleTabChange('terms')} className="text-xs font-bold text-blue-700 hover:underline">Edit term dates</button>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Term</th><th className="px-5 py-3">Dates</th><th className="px-5 py-3">Teaching weekdays*</th><th className="px-5 py-3">Events</th><th className="px-5 py-3">Exams</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.termDays.map((term) => {
                          const form = termForms[term.id];
                          const termEvents = events.filter((event) => {
                            const eventDay = dateKey(event.startDate);
                            return eventDay && form.openingDate && form.closingDate && eventDay >= form.openingDate && eventDay <= form.closingDate;
                          });
                          const dateRange = form.openingDate && form.closingDate
                            ? `${formatDateKey(form.openingDate)} – ${formatDateKey(form.closingDate)}`
                            : 'Dates not set';
                          return (
                            <tr key={term.id}>
                              <td className="px-5 py-3 font-bold text-slate-800">{term.label}</td>
                              <td className="px-5 py-3 text-slate-600">{dateRange}</td>
                              <td className="px-5 py-3 font-semibold text-slate-800">{term.days ?? '—'}</td>
                              <td className="px-5 py-3 text-slate-600">{termEvents.length}</td>
                              <td className="px-5 py-3 text-slate-600">{termEvents.filter((event) => ['EXAM', 'EXAM_WEEK'].includes(event.type)).length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-extrabold text-slate-900">Schedule checks</h3><p className="text-xs text-slate-500 mt-1">Time overlaps for shared audiences, classes, or locations.</p></div>
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">{conflicts.length === 0 ? <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 size={16} />No overlapping events found.</p> : conflicts.slice(0, 8).map(({ first, second }) => <div key={`${first.id}-${second.id}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-900">{first.title} overlaps {second.title}</p><p className="text-[11px] text-amber-800 mt-1">{new Date(first.startDate).toLocaleDateString()} · {describeAudience(first)}. Review whether they can run together.</p>{canManageEvents && <button type="button" onClick={() => handleOpenEditModal(first)} className="mt-2 text-[11px] font-bold text-blue-700 hover:underline">Review first event</button>}</div>)}</div>
                </section>
              </div>

              <p className="text-[11px] text-slate-500">* Estimate counts Monday–Friday within saved term dates, less scheduled holidays and mid-term breaks. It does not account for school-specific Saturday instruction or unscheduled closures.</p>

              {/* Main Content Dashboard Layout Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Side Panels (2/3 width) */}
                <div className="lg:col-span-2 space-y-8">
                  
                  {/* Horizontal mini timeline section */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-base font-extrabold text-slate-900 mb-6">Year Progress Timeline</h3>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-8 pb-4 relative">
                      
                      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 -translate-y-0.5" />
                      
                      {monthsData.map((m, idx) => {
                        const hasOpening = m.events.some(e => e.type === 'TERM_OPENING');
                        const hasClosing = m.events.some(e => e.type === 'TERM_CLOSING');
                        const hasExams = m.events.some(e => e.type === 'EXAM' || e.type === 'EXAM_WEEK');
                        const hasHolidays = m.events.some(e => e.type === 'HOLIDAY');

                        const monthStart = new Date(academicYear, idx, 1);
                        const monthEnd = new Date(academicYear, idx + 1, 0);
                        const termIndex = stats.termDays.findIndex((term) => {
                          const range = termForms[term.id];
                          return range.openingDate && range.closingDate
                            && new Date(`${range.openingDate}T00:00:00`) <= monthEnd
                            && new Date(`${range.closingDate}T23:59:59`) >= monthStart;
                        });
                        const termColors = ['bg-blue-500', 'bg-purple-500', 'bg-indigo-500'];
                        const activeLineColor = termIndex >= 0 ? termColors[termIndex] : 'bg-slate-200';

                        return (
                          <div key={idx} className="flex flex-col items-center group relative flex-1">
                            
                            {/* Visual Timeline Nodes */}
                            <div className={`absolute top-0 h-1 -translate-y-0.5 w-full ${activeLineColor}`} />
                            
                            <div className="h-6 w-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center -translate-y-11.5 z-10 group-hover:border-blue-500 transition-all">
                              <span className="h-2.5 w-2.5 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                            </div>

                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{m.name}</span>
                            
                            {/* Monthly event dot summary markers */}
                            <div className="flex gap-1 mt-2.5">
                              {hasOpening && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Term opening" />}
                              {hasClosing && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" title="Term closing" />}
                              {hasExams && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" title="Exams week" />}
                              {hasHolidays && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Recess break" />}
                            </div>

                          </div>
                        );
                      })}

                    </div>
                  </div>

                  {/* GitHub style density heatmap section */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Activity Heatmap</h3>
                        <p className="text-slate-400 text-xs mt-0.5">Visualize scheduling densities across months</p>
                      </div>
                      
                      <div className="flex gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider items-center">
                        <span>Less</span>
                        <span className="h-3 w-3 bg-slate-100 rounded-sm" />
                        <span className="h-3 w-3 bg-blue-100 rounded-sm" />
                        <span className="h-3 w-3 bg-blue-300 rounded-sm" />
                        <span className="h-3 w-3 bg-blue-600 rounded-sm" />
                        <span>More</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-4">
                      {Array.from({ length: 12 }).map((_, monthIdx) => {
                        const name = new Date(academicYear, monthIdx, 1).toLocaleString('default', { month: 'short' });
                        const daysInMonth = heatmapData.filter(d => d.month === monthIdx);
                        
                        return (
                          <div key={monthIdx} className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">{name}</span>
                            <div className="grid grid-cols-5 gap-1.5 justify-center">
                              {daysInMonth.map((d, dIdx) => {
                                let bg = 'bg-slate-100 hover:bg-slate-200';
                                if (d.count >= 5) bg = 'bg-blue-600 hover:bg-blue-700';
                                else if (d.count >= 3) bg = 'bg-blue-300 hover:bg-blue-400';
                                else if (d.count >= 1) bg = 'bg-blue-100 hover:bg-blue-200';
                                return (
                                  <div 
                                    key={dIdx} 
                                    className={`h-3 w-3 rounded-sm transition-colors cursor-pointer ${bg}`}
                                    title={`${d.dateStr}: ${d.count} Event(s)`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Distribution Categories breakdown list */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-base font-extrabold text-slate-900 mb-6">Events Distribution Overview</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {[
                        { type: 'ACADEMIC', label: 'Academic Events', count: stats.academic, total: stats.total, color: 'bg-blue-500' },
                        { type: 'ASSESSMENT', label: 'Assessments', count: stats.assessment, total: stats.total, color: 'bg-purple-500' },
                        { type: 'EXAM', label: 'Examinations', count: stats.examination, total: stats.total, color: 'bg-indigo-500' },
                        { type: 'HOLIDAY', label: 'Holidays & Breaks', count: stats.holiday, total: stats.total, color: 'bg-red-500' },
                        { type: 'FINANCE', label: 'Finance Calendar', count: stats.finance, total: stats.total, color: 'bg-emerald-500' },
                        { type: 'SPORTS', label: 'Sports Slots', count: stats.sports, total: stats.total, color: 'bg-orange-500' },
                      ].map((item, idx) => {
                        const percent = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                        return (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-slate-600">{item.label}</span>
                              <span className="text-slate-900">{item.count} Events ({percent}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Right Side Panels (1/3 width) */}
                <div className="space-y-8">
                  
                  {/* Compliance Checklist with SVG circular progress ring */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[280px]">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Readiness Status</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Required setups for active planners</p>
                    </div>

                    <div className="flex items-center gap-6 my-6">
                      {/* SVG circle progress ring */}
                      <div className="relative h-20 w-20 shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-slate-100"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-blue-600 transition-all duration-500"
                            strokeDasharray={`${compliance.percentage}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-black text-slate-900">{compliance.percentage}%</span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 leading-relaxed">
                        <span className="font-bold text-slate-800 text-sm block">Planning readiness</span>
                        {conflicts.length ? `${conflicts.length} possible event overlap${conflicts.length === 1 ? '' : 's'} need review.` : 'No overlapping events found for shared audiences.'}
                      </div>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      {compliance.list.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs font-semibold">
                          {item.status ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                          )}
                          <span className={item.status ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming events timeline list */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-base font-extrabold text-slate-900 mb-6">Upcoming Agenda</h3>
                    
                    {upcomingEvents.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-6 text-center">No upcoming events listed</p>
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-slate-100">
                        {upcomingEvents.map(event => {
                          const conf = EVENT_TYPES[event.type] || EVENT_TYPES.OTHER;
                          const dateObj = new Date(event.startDate);
                          return (
                            <div key={event.id} className="relative group">
                              {/* Connector dot */}
                              <div className={`absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${conf.dot}`} />
                              
                              <div className="flex flex-col gap-0.5 text-xs">
                <span className={`font-bold text-slate-900 transition-colors ${canManageEvents ? 'group-hover:text-blue-600 cursor-pointer' : ''}`} onClick={canManageEvents ? () => handleOpenEditModal(event) : undefined}>
                                  {event.title}
                                </span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">
                                  {dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ─ {conf.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Floating Action Bar */}
              {canManageEvents && <div className="fixed bottom-6 right-6 z-40 bg-slate-900/90 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md border border-slate-800 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                <span className="text-xs font-bold text-slate-400 uppercase pl-1 border-r border-slate-700 pr-3">Quick Creator</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleOpenAddModal('ACADEMIC')} 
                    className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-blue-400"
                    title="Add Academic Event"
                  >
                    <BookOpen className="h-4.5 w-4.5" />
                  </button>
                  <button 
                    onClick={() => handleOpenAddModal('ASSESSMENT')} 
                    className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-purple-400"
                    title="Add Assessment"
                  >
                    <Award className="h-4.5 w-4.5" />
                  </button>
                  <button 
                    onClick={() => handleOpenAddModal('EXAM')}
                    className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-indigo-400"
                    title="Add Exam"
                  >
                    <FileText className="h-4.5 w-4.5" />
                  </button>
                  <button 
                    onClick={() => handleOpenAddModal('HOLIDAY')} 
                    className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-rose-400"
                    title="Add Public Holiday"
                  >
                    <AlertCircle className="h-4.5 w-4.5" />
                  </button>
                </div>
                <button 
                  onClick={() => handleOpenAddModal('GENERAL')} 
                  className="bg-blue-600 hover:bg-blue-700 p-2 rounded-xl text-white transition-colors flex items-center gap-1.5 text-xs font-bold px-3 shadow-md shadow-blue-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Schedule Slot
                </button>
              </div>}

            </div>
          )}

          {/* TAB 3: CALENDAR VIEW */}
          {activeTab === 'calendar' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden min-h-[500px]">
              <CalendarView />
            </div>
          )}

          {/* TAB 4: ACADEMIC YEAR SETUP (terms, breaks and exam weeks in one save) */}
          {activeTab === 'terms' && canSetUpYear && (
            <AcademicYearSetup academicYear={academicYear} onSaved={fetchEvents} onDirtyChange={setSetupDirty} />
          )}

          {/* TAB 5: EVENTS MANAGER TAB */}
          {activeTab === 'events' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              
              <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2 border rounded-2xl px-3.5 py-1.5 bg-slate-50 text-xs">
                    <span className="text-slate-400"><Filter className="h-4 w-4" /></span>
                    <label htmlFor="filter-term" className="sr-only">Filter by Term</label>
                    <select 
                      id="filter-term"
                      value={managerFilters.term} 
                      onChange={(e) => setManagerFilters(prev => ({ ...prev, term: e.target.value }))}
                      className="bg-transparent border-0 font-bold text-slate-700 focus:ring-0 focus:outline-none pr-8 cursor-pointer"
                    >
                      <option value="ALL">All Terms</option>
                      {TERMS.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 border rounded-2xl px-3.5 py-1.5 bg-slate-50 text-xs">
                    <label htmlFor="filter-type" className="sr-only">Filter by Type</label>
                    <select 
                      id="filter-type"
                      value={managerFilters.type} 
                      onChange={(e) => setManagerFilters(prev => ({ ...prev, type: e.target.value }))}
                      className="bg-transparent border-0 font-bold text-slate-700 focus:ring-0 focus:outline-none pr-8 cursor-pointer"
                    >
                      <option value="ALL">All Event Types</option>
                      {Object.keys(EVENT_TYPES).map(typeKey => (
                        <option key={typeKey} value={typeKey}>{EVENT_TYPES[typeKey].label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {canManageEvents && <Button onClick={() => handleOpenAddModal('GENERAL')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4" />
                  Add Event Custom
                </Button>}
              </div>

              {/* Grid month cards */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {monthsData.map(month => {
                  const monthEvents = month.events.filter(e => {
                    const matchesTerm = managerFilters.term === 'ALL' || e.term === managerFilters.term;
                    const matchesType = managerFilters.type === 'ALL' || e.type === managerFilters.type;
                    return matchesTerm && matchesType;
                  });

                  return (
                    <div 
                      key={month.index} 
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[220px]"
                    >
                      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-extrabold text-slate-800 flex justify-between items-center text-sm">
                        <span>{month.fullName}</span>
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                          {monthEvents.length}
                        </span>
                      </div>
                      <div className="p-4 flex-1 flex flex-col gap-2 overflow-y-auto max-h-[240px]">
                        {monthEvents.length === 0 ? (
                          <div 
                            onClick={canManageEvents ? () => handleOpenAddModal('GENERAL') : undefined}
                            className={`text-slate-400 text-xs italic my-auto text-center ${canManageEvents ? 'cursor-pointer hover:text-blue-500' : ''}`}
                          >
                            No Scheduled Events{canManageEvents && <><br /><span className="font-bold text-[10px] uppercase text-blue-600">+ Add Event</span></>}
                          </div>
                        ) : (
                          monthEvents.map(event => {
                            const conf = EVENT_TYPES[event.type] || EVENT_TYPES.OTHER;
                            return (
                              <div 
                                key={event.id}
                                onClick={canManageEvents ? () => handleOpenEditModal(event) : undefined}
                                className={`group text-xs border rounded-xl p-2.5 transition-all flex justify-between items-start gap-2 ${conf.bg} ${canManageEvents ? 'cursor-pointer hover:shadow-md' : ''}`}
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="font-extrabold line-clamp-1 group-hover:text-blue-900 transition-colors">
                                    {event.title}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-bold uppercase">
                                    {new Date(event.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                {(event.audience?.length > 0 || event.classIds?.length > 0) && (
                                  <span className="text-slate-400 shrink-0" title={`Visible to: ${describeAudience(event)}`}>
                                    {event.isParentVisible ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>
      )}

      {/* Modal Dialog for Add/Edit Custom Event */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveCustomEvent}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {modalEvent ? 'Edit Event details' : 'Schedule Annual Event'}
              </DialogTitle>
              <DialogDescription>
                Configure dates, location coordinates, meeting URLs and visibility constraints.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Event Title</Label>
                <Input
                  type="text"
                  placeholder="e.g. Assessment Week"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</Label>
                <Textarea
                  placeholder="Add schedules, classes and instructions..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">End Date</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Event Category</Label>
                  <select
                    value={eventForm.type}
                    onChange={(e) => setEventForm(prev => ({ ...prev, type: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.keys(EVENT_TYPES).map(typeKey => (
                      <option key={typeKey} value={typeKey}>{EVENT_TYPES[typeKey].label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scope Term</Label>
                  <select
                    value={eventForm.term}
                    onChange={(e) => setEventForm(prev => ({ ...prev, term: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">General (No Term)</option>
                    {TERMS.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location / Venue</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Science Lab"
                    value={eventForm.location}
                    onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Video URL</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Google Meet link"
                    value={eventForm.meetingLink}
                    onChange={(e) => setEventForm(prev => ({ ...prev, meetingLink: e.target.value }))}
                  />
                </div>
              </div>

              <EventAudiencePicker
                audience={eventForm.audience}
                classIds={eventForm.classIds}
                onChange={({ audience, classIds }) => setEventForm(prev => ({ ...prev, audience, classIds }))}
              />

            </div>

            <DialogFooter className="gap-2">
              <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">
                Cancel
              </Button>
              {modalEvent && canDeleteEvents && (
                <Button 
                  type="button" 
                  onClick={() => {
                    if (window.confirm('Delete this event?')) {
                      setIsModalOpen(false);
                      handleDeleteEvent(modalEvent.id);
                    }
                  }} 
                  variant="outline" 
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                >
                  Delete Event
                </Button>
              )}
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                {modalEvent ? 'Save Changes' : 'Schedule Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  </div>
  );
}
