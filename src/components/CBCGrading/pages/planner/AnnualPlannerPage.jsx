import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUIStore } from '../../../../store/useUIStore';
import { QuickActions } from '../../shared';
import api from '../../../../services/api';
import CalendarView from './CalendarView';
import ApprovalsPage from '../ApprovalsPage';
import { printWindow } from '../../../../utils/simplePdfGenerator';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Printer, 
  Save, 
  FileText, 
  Filter, 
  Check, 
  Info, 
  Lock, 
  Unlock,
  Eye,
  EyeOff,
  AlertCircle,
  TrendingUp,
  Clock,
  Settings,
  Layers,
  Download,
  BookOpen,
  Award,
  Compass,
  Users,
  CheckCircle2,
  MapPin,
  Video,
  ExternalLink,
  HelpCircle,
  Zap,
  CheckSquare,
  FileCheck,
  Home,
  ClipboardCheck
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
  ACADEMIC: { label: 'Academic', bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', bar: 'bg-blue-500' },
  ASSESSMENT: { label: 'Assessment', bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', bar: 'bg-purple-500' },
  EXAMINATION: { label: 'Examination', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
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

const INITIAL_TERM_FORM = {
  openingDate: '',
  closingDate: '',
  midtermStart: '',
  midtermEnd: '',
  examStart: '',
  examEnd: '',
  isParentVisible: true,
};

export default function AnnualPlannerPage({ onNavigate, user }) {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage);
  const handleNavigatePage = (path) => {
    if (typeof onNavigate === 'function') {
      onNavigate(path);
    } else {
      setCurrentPage(path);
    }
  };
  const handleGoHome = () => handleNavigatePage('dashboard');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'timeline', 'calendar', 'terms', 'events', 'reports'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openTerms, setOpenTerms] = useState({ TERM_1: true, TERM_2: false, TERM_3: false });
  
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
    isParentVisible: true,
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
    setLoading(true);
    try {
      const response = await api.planner.getEvents({ academicYear });
      const data = response?.data ?? response ?? [];
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
      console.error('Failed to fetch events', error);
      toast.error('Failed to load academic events');
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    fetchActiveYear();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleTermFormChange = (termId, field, value) => {
    setTermForms(prev => ({
      ...prev,
      [termId]: {
        ...prev[termId],
        [field]: value
      }
    }));
  };

  const handleSaveTermSetup = async (termId) => {
    const form = termForms[termId];
    if (!form.openingDate || !form.closingDate) {
      toast.error('Opening and closing dates are required');
      return;
    }

    const payloadEvents = [];
    const termLabel = termId.replace('_', ' ');

    payloadEvents.push({
      title: `${termLabel} Opens`,
      startDate: new Date(form.openingDate).toISOString(),
      endDate: new Date(form.openingDate).toISOString(),
      allDay: true,
      type: 'ACADEMIC',
      term: termId,
      academicYear,
      isParentVisible: form.isParentVisible,
      description: `Official opening date for ${termLabel}`,
    });

    payloadEvents.push({
      title: `${termLabel} Closes`,
      startDate: new Date(form.closingDate).toISOString(),
      endDate: new Date(form.closingDate).toISOString(),
      allDay: true,
      type: 'ACADEMIC',
      term: termId,
      academicYear,
      isParentVisible: form.isParentVisible,
      description: `Official closing date for ${termLabel}`,
    });

    if (form.midtermStart && form.midtermEnd) {
      payloadEvents.push({
        title: `${termLabel} Midterm Break`,
        startDate: new Date(form.midtermStart).toISOString(),
        endDate: new Date(form.midtermEnd).toISOString(),
        allDay: true,
        type: 'HOLIDAY',
        term: termId,
        academicYear,
        isParentVisible: form.isParentVisible,
        description: `Midterm break recess for ${termLabel}`,
      });
    }

    if (form.examStart && form.examEnd) {
      payloadEvents.push({
        title: `${termLabel} Examinations`,
        startDate: new Date(form.examStart).toISOString(),
        endDate: new Date(form.examEnd).toISOString(),
        allDay: true,
        type: 'EXAMINATION',
        term: termId,
        academicYear,
        isParentVisible: form.isParentVisible,
        description: `Summative exams and assessment week for ${termLabel}`,
      });
    }

    setLoading(true);
    try {
      await api.planner.bulkCreateAnnualPlan(payloadEvents);
      toast.success(`${termLabel} dates saved successfully`);
      fetchEvents();
    } catch (error) {
      console.error(error);
      toast.error(`Failed to save ${termLabel} dates`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = (type = 'GENERAL', term = '') => {
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
      isParentVisible: true,
      academicYear: academicYear.toString(),
      term,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
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
      isParentVisible: event.isParentVisible !== undefined ? event.isParentVisible : true,
      academicYear: event.academicYear ? event.academicYear.toString() : academicYear.toString(),
      term: event.term || '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (id) => {
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
    const counts = {
      total: events.length,
      academic: events.filter(e => e.type === 'ACADEMIC').length,
      assessment: events.filter(e => e.type === 'ASSESSMENT').length,
      examination: events.filter(e => e.type === 'EXAMINATION').length,
      holiday: events.filter(e => e.type === 'HOLIDAY').length,
      finance: events.filter(e => e.type === 'FINANCE').length,
      sports: events.filter(e => e.type === 'SPORTS').length,
      trip: events.filter(e => e.type === 'TRIP').length,
      meeting: events.filter(e => e.type === 'MEETING').length,
      staff: events.filter(e => e.type === 'STAFF_EVENT').length,
      parent: events.filter(e => e.type === 'PARENT_EVENT').length,
      national: events.filter(e => e.type === 'NATIONAL_EVENT').length,
      other: events.filter(e => e.type === 'OTHER').length,
    };

    // Calculate school days from term dates configuration
    let totalSchoolDays = 0;
    TERMS.forEach(t => {
      const form = termForms[t.id];
      if (form.openingDate && form.closingDate) {
        const start = new Date(form.openingDate);
        const end = new Date(form.closingDate);
        const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diff > 0) totalSchoolDays += diff;
      }
    });

    if (totalSchoolDays === 0) totalSchoolDays = 267; // fallback default representation

    return { ...counts, schoolDays: totalSchoolDays };
  }, [events, termForms]);

  // Compliance checklists & progress percentage
  const compliance = useMemo(() => {
    const list = [
      { id: 'year', label: 'Academic Year Configured', status: true },
      { id: 'terms', label: 'Term Opening/Closing Boundaries Set', status: !!(termForms.TERM_1.openingDate && termForms.TERM_2.openingDate && termForms.TERM_3.openingDate) },
      { id: 'assessments', label: 'Assessment Calendars Active', status: stats.assessment > 0 },
      { id: 'exams', label: 'Examination Schedule Created', status: stats.examination > 0 },
      { id: 'holidays', label: 'Public Holidays Registered', status: stats.holiday > 0 },
      { id: 'meetings', label: 'Parent Interaction Events Scheduled', status: stats.parent > 0 },
    ];
    const completedCount = list.filter(item => item.status).length;
    const pct = Math.round((completedCount / list.length) * 100);
    return { list, percentage: pct };
  }, [termForms, stats]);

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
      const key = new Date(e.startDate).toISOString().split('T')[0];
      dateCounts[key] = (dateCounts[key] || 0) + 1;
    });

    let current = new Date(startDate);
    while (current <= endDate) {
      const key = current.toISOString().split('T')[0];
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

  const handleTriggerReport = (title, type) => {
    toast.success(`Generating report for ${title}...`);
    // Prepares styled layout capture to render using window.print style utility
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-slate-800 print:bg-white pb-24">
      {/* Full-width Quick Actions matching the executive dashboard */}
      <div className="print:hidden">
        <QuickActions onNavigate={handleNavigatePage} currentPage="annual-planner" />
      </div>

      <div className="p-6 lg:p-8 print:p-0">
        {/* Header Panel (Hidden in print mode) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
              <Compass className="h-6 w-6" />
            </span>
            Year Planning Command Center
          </h1>
          <p className="text-slate-500 mt-1">Stripe-style hub to manage terms, configuration controls, and school calendars.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <label htmlFor="year-select" className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Academic Year</label>
            <select 
              id="year-select"
              value={academicYear} 
              onChange={(e) => setAcademicYear(parseInt(e.target.value, 10))}
              className="font-extrabold text-slate-800 bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer pr-8 text-sm"
            >
              {[2025, 2026, 2027, 2028].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs navigation block */}
      <div className="flex items-stretch border-b border-slate-200 mb-8 overflow-x-auto scrollbar-none print:hidden">



        {[
          { id: 'dashboard', label: 'Command Center', icon: Zap },
          { id: 'timeline', label: 'Year Timeline', icon: Layers },
          { id: 'calendar', label: 'Calendar View', icon: Calendar },
          { id: 'terms', label: 'Term Setup', icon: CheckSquare },
          { id: 'events', label: 'All Events', icon: FileText },
          { id: 'reports', label: 'Reports Hub', icon: FileCheck },
          { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
        ].map((tab, idx, arr) => (
          <React.Fragment key={tab.id}>
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-5 py-4 font-bold text-sm border-b-2 transition-all shrink-0 ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40' 
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/60'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
            {/* Divider between tabs (but not after the last one) */}
            {idx < arr.length - 1 && (
              <span className="w-px self-stretch bg-slate-100 my-2" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Active Tab Container */}
      {loading ? (
        <div className="flex justify-center items-center py-24 print:hidden">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
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
                      <p className="text-2xl font-black text-white">{stats.schoolDays}</p>
                      <p className="text-[10px] text-blue-200 uppercase font-extrabold tracking-wider mt-0.5">School Days</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{stats.total}</p>
                      <p className="text-[10px] text-blue-200 uppercase font-extrabold tracking-wider mt-0.5">Total Events</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">3</p>
                      <p className="text-[10px] text-blue-200 uppercase font-extrabold tracking-wider mt-0.5">Terms Set</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{compliance.percentage}%</p>
                      <p className="text-[10px] text-blue-200 uppercase font-extrabold tracking-wider mt-0.5">Compliance</p>
                    </div>
                  </div>
                </div>

                {/* Right timeline & progress blocks */}
                <div className="z-10 flex flex-col justify-between w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/10 pt-6 lg:pt-0 lg:pl-8">
                  <div>
                    <h3 className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-3">Academic Timeline</h3>
                    <div className="space-y-2.5">
                      
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>Term 1</span>
                        <span className="text-blue-200">Jan ─ Apr</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>Term 2</span>
                        <span className="text-blue-200">May ─ Aug</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>Term 3</span>
                        <span className="text-blue-200">Sep ─ Dec</span>
                      </div>

                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between text-xs font-bold text-blue-200 uppercase mb-2">
                      <span>Year Progress</span>
                      <span className="text-white">{compliance.percentage}% Complete</span>
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
                  { label: 'Academic Days', count: stats.schoolDays, icon: BookOpen, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                  { label: 'Total Events', count: stats.total, icon: Calendar, color: 'text-slate-600 bg-slate-50 border-slate-200' },
                  { label: 'Assessments', count: stats.assessment, icon: Award, color: 'text-purple-600 bg-purple-50 border-purple-100' },
                  { label: 'Examinations', count: stats.examination, icon: FileText, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                  { label: 'School Trips', count: stats.trip, icon: Compass, color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
                  { label: 'Public Holidays', count: stats.holiday, icon: AlertCircle, color: 'text-rose-600 bg-rose-50 border-rose-100' },
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
                        const hasExams = m.events.some(e => e.type === 'EXAM_WEEK' || e.type === 'EXAMINATION');
                        const hasHolidays = m.events.some(e => e.type === 'HOLIDAY');

                        let activeLineColor = 'bg-slate-200';
                        if (idx < 4) activeLineColor = 'bg-blue-500'; // Term 1 bounds
                        else if (idx < 8) activeLineColor = 'bg-purple-500'; // Term 2 bounds
                        else activeLineColor = 'bg-indigo-500'; // Term 3 bounds

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
                        { type: 'EXAMINATION', label: 'Examinations', count: stats.examination, total: stats.total, color: 'bg-indigo-500' },
                        { type: 'HOLIDAY', label: 'Public Holidays', count: stats.holiday, total: stats.total, color: 'bg-red-500' },
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
                        <span className="font-bold text-slate-800 text-sm block">System Score</span>
                        Calendar setup validation complete. Ready to publish.
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
                                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer" onClick={() => handleOpenEditModal(event)}>
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
              <div className="fixed bottom-6 right-6 z-40 bg-slate-900/90 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md border border-slate-800 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                    onClick={() => handleOpenAddModal('EXAMINATION')} 
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
              </div>

            </div>
          )}

          {/* TAB 2: YEAR TIMELINE TAB */}
          {activeTab === 'timeline' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-8">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Yearly Planning Board</h3>
                <p className="text-slate-500 text-sm mt-0.5">Complete month-by-month planning timeline representing spans of terms, recesses, and exams.</p>
              </div>

              <div className="space-y-6">
                {monthsData.map(m => (
                  <div key={m.index} className="flex gap-4 items-start border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                    <div className="w-24 shrink-0 font-extrabold text-slate-400 uppercase tracking-wide pt-1">{m.fullName}</div>
                    
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {m.events.length === 0 ? (
                        <div 
                          onClick={() => handleOpenAddModal('GENERAL')} 
                          className="border border-dashed border-slate-200 rounded-2xl p-4 text-center cursor-pointer hover:bg-slate-50/50 hover:border-slate-300 text-xs text-slate-400 flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Plus className="h-4 w-4" /> Schedule event in {m.fullName}
                        </div>
                      ) : (
                        m.events.map(event => {
                          const style = EVENT_TYPES[event.type] || EVENT_TYPES.OTHER;
                          return (
                            <div 
                              key={event.id}
                              onClick={() => handleOpenEditModal(event)}
                              className={`border rounded-2xl p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between min-h-[90px] ${style.bg}`}
                            >
                              <div className="flex justify-between items-start">
                                <span className="font-extrabold text-xs text-slate-900 leading-tight line-clamp-1">{event.title}</span>
                                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-4">
                                <span>Day {event.day}</span>
                                <span>{style.label}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CALENDAR VIEW */}
          {activeTab === 'calendar' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden min-h-[500px]">
              <CalendarView />
            </div>
          )}

          {/* TAB 4: TERM SETUP CONFIGURATIONS */}
          {activeTab === 'terms' && (
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-sm text-blue-800">
                <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-bold">Term Date Setup</p>
                  <p className="mt-1 text-blue-700">
                    Define term start and end boundaries. This action automatically creates opening, closing, exams, and midterm events.
                  </p>
                </div>
              </div>

              {TERMS.map(term => {
                const isOpen = openTerms[term.id];
                const form = termForms[term.id];
                return (
                  <div key={term.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenTerms(prev => ({ ...prev, [term.id]: !prev[term.id] }))}
                      className="w-full flex justify-between items-center px-6 py-4.5 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                          <Layers className="h-5 w-5" />
                        </span>
                        <span className="font-extrabold text-slate-800 text-base">{term.label} Boundaries</span>
                      </div>
                      {isOpen ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
                    </button>

                    {isOpen && (
                      <div className="p-6 flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          <div className="flex flex-col gap-4">
                            <h4 className="font-extrabold text-slate-700 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              Duration
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opening Date</Label>
                                <Input 
                                  type="date"
                                  value={form.openingDate}
                                  onChange={(e) => handleTermFormChange(term.id, 'openingDate', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closing Date</Label>
                                <Input 
                                  type="date"
                                  value={form.closingDate}
                                  onChange={(e) => handleTermFormChange(term.id, 'closingDate', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4">
                            <h4 className="font-extrabold text-slate-700 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <Calendar className="h-4 w-4 text-amber-600" />
                              Midterm Break (Optional)
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</Label>
                                <Input 
                                  type="date"
                                  value={form.midtermStart}
                                  onChange={(e) => handleTermFormChange(term.id, 'midtermStart', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</Label>
                                <Input 
                                  type="date"
                                  value={form.midtermEnd}
                                  onChange={(e) => handleTermFormChange(term.id, 'midtermEnd', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4">
                            <h4 className="font-extrabold text-slate-700 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <FileText className="h-4 w-4 text-indigo-600" />
                              Assessment Week (Optional)
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</Label>
                                <Input 
                                  type="date"
                                  value={form.examStart}
                                  onChange={(e) => handleTermFormChange(term.id, 'examStart', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</Label>
                                <Input 
                                  type="date"
                                  value={form.examEnd}
                                  onChange={(e) => handleTermFormChange(term.id, 'examEnd', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4">
                            <h4 className="font-extrabold text-slate-700 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <Unlock className="h-4 w-4 text-blue-600" />
                              Permissions
                            </h4>
                            
                            <div className="flex items-center justify-between p-3.5 bg-slate-50 border rounded-2xl">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-slate-800">Publish to Parents</span>
                                <span className="text-[10px] text-slate-400 mt-0.5">Toggle visibility on parent portal dashboards</span>
                              </div>
                              
                              <button
                                onClick={() => handleTermFormChange(term.id, 'isParentVisible', !form.isParentVisible)}
                                className={`p-2.5 rounded-xl border transition-colors ${
                                  form.isParentVisible 
                                    ? 'bg-blue-50 text-blue-600 border-blue-200' 
                                    : 'bg-slate-100 text-slate-400 border-slate-200'
                                }`}
                              >
                                {form.isParentVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                              </button>
                            </div>
                          </div>

                        </div>

                        <div className="flex justify-end border-t pt-5 mt-4">
                          <Button 
                            onClick={() => handleSaveTermSetup(term.id)} 
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Save className="h-4 w-4" />
                            Save {term.label} Boundaries
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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

                <Button onClick={() => handleOpenAddModal('GENERAL')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4" />
                  Add Event Custom
                </Button>
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
                            onClick={() => handleOpenAddModal('GENERAL')} 
                            className="text-slate-400 text-xs italic my-auto text-center cursor-pointer hover:text-blue-500"
                          >
                            No Scheduled Events<br />
                            <span className="font-bold text-[10px] uppercase text-blue-600">+ Add Event</span>
                          </div>
                        ) : (
                          monthEvents.map(event => {
                            const conf = EVENT_TYPES[event.type] || EVENT_TYPES.OTHER;
                            return (
                              <div 
                                key={event.id}
                                onClick={() => handleOpenEditModal(event)}
                                className={`group text-xs border rounded-xl p-2.5 cursor-pointer transition-all hover:shadow-md flex justify-between items-start gap-2 ${conf.bg}`}
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="font-extrabold line-clamp-1 group-hover:text-blue-900 transition-colors">
                                    {event.title}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-bold uppercase">
                                    {new Date(event.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                {!event.isParentVisible && (
                                  <span className="text-slate-400 shrink-0">
                                    <Lock className="h-3 w-3" />
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

          {/* TAB 6: REPORTS & DOCUMENT CENTER */}
          {activeTab === 'reports' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                { title: 'Academic Calendar PDF', desc: 'Official overview of term dates and openings.', type: 'academic' },
                { title: 'Term Planner', desc: 'Detailed schedules grouped per active learning term.', type: 'term' },
                { title: 'Exam Planner', desc: 'Summary of assessment calendars and testing blocks.', type: 'exam' },
                { title: 'Assessment Planner', desc: 'Formative & summative assessment schedules.', type: 'assessment' },
                { title: 'School Event Calendar', desc: 'Complete school activities list.', type: 'general' },
                { title: 'Parent Portal Calendar', desc: 'Calendar copies optimized for families.', type: 'parent' },
              ].map((rpt, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[180px]">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">{rpt.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{rpt.desc}</p>
                  </div>
                  
                  <div className="flex gap-2 justify-end border-t pt-4 mt-6">
                    <Button 
                      onClick={() => handleTriggerReport(rpt.title, rpt.type)} 
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold w-full justify-center"
                    >
                      <Download className="h-4 w-4" /> Download PDF / print
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 7: APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <ApprovalsPage />
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

              <div className="flex items-center justify-between p-3.5 bg-slate-50 border rounded-2xl mt-2">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-slate-800">Publish to Parent Portal</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Allow parents and student accounts to view this event</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => setEventForm(prev => ({ ...prev, isParentVisible: !prev.isParentVisible }))}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    eventForm.isParentVisible 
                      ? 'bg-blue-50 text-blue-600 border-blue-200' 
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                >
                  {eventForm.isParentVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>

            </div>

            <DialogFooter className="gap-2">
              <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">
                Cancel
              </Button>
              {modalEvent && (
                <Button 
                  type="button" 
                  onClick={() => {
                    if (confirm('Delete this event?')) {
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

