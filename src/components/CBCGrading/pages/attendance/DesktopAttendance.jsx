/**
 * DesktopAttendance — Redesigned desktop attendance experience.
 *
 * Layout:
 *   [Header: Class Selector + Date + Save]
 *   [KPI Cards row]
 *   [Mark All Present — large, top-center]
 *   [Main: Exceptions Workspace] | [Right Panel: Insights]
 *
 * Core principle: Mark All Present → Edit Exceptions → Save
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, Save, Loader2, RefreshCw, CheckCheck, ChevronDown,
  X, Users, Bell, Filter, Calendar, BarChart2
} from 'lucide-react';
import { cn } from '../../../../utils/cn';
import { useAttendance } from '../../hooks/useAttendanceAPI';
import { useAuth } from '../../../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { useInstitutionLabels } from '../../../../hooks/useInstitutionLabels';

import { AttendanceSummaryCard } from './AttendanceSummaryCard';
import { AttendanceExceptionCard } from './AttendanceExceptionCard';
import { AttendanceInsightsPanel } from './AttendanceInsightsPanel';
import { AttendanceMarkAllButton, AttendanceMarkAllCompact } from './AttendanceQuickActions';
import { EXCEPTION_STATUSES, AttendanceStatusBadge } from './AttendanceStatusChip';
import LoadingSpinner from '../../shared/LoadingSpinner';

export function DesktopAttendance() {
  const { user } = useAuth();
  const labels = useInstitutionLabels();
  const { showSuccess, showError } = useNotifications();
  const isTeacher = user?.role === 'TEACHER';

  // Context state
  const [activeClass, setActiveClass] = useState(null);
  const [activeDate, setActiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});
  const [allMarkedPresent, setAllMarkedPresent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [exceptionFilter, setExceptionFilter] = useState('all');
  const [notifyAbsent, setNotifyAbsent] = useState(true);
  const [showAllLearners, setShowAllLearners] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const {
    classes,
    loading: hookLoading,
    getDailyClassReport,
    markBulkAttendance,
  } = useAttendance();

  const getClassId = (c) => c?.id || c?._id || '';

  // ── auto-select first class for teachers ────────────────────────────────
  useEffect(() => {
    if (isTeacher && classes.length > 0 && !activeClass) {
      setActiveClass(classes[0]);
    }
  }, [isTeacher, classes, activeClass]);

  // ── load report when class or date changes ───────────────────────────────
  const loadReport = useCallback(async (classItem, date) => {
    if (!classItem) return;
    setIsLoadingReport(true);
    setHasLoaded(false);
    setAllMarkedPresent(false);
    setPendingChanges({});
    setSearchTerm('');
    setExceptionFilter('all');
    try {
      const report = await getDailyClassReport(getClassId(classItem), date);
      if (report) {
        setDailyReport(report);
        const existing = {};
        report.learners.forEach(l => {
          if (l.attendance) {
            existing[l.id] = { status: l.attendance.status, remarks: l.attendance.remarks || '' };
          }
        });
        setPendingChanges(existing);
        if (
          Object.keys(existing).length === report.learners.length &&
          report.learners.length > 0 &&
          Object.values(existing).every(e => e.status === 'PRESENT')
        ) {
          setAllMarkedPresent(true);
        }
        setHasLoaded(true);
      }
    } catch {
      showError('Failed to load attendance register');
    } finally {
      setIsLoadingReport(false);
    }
  }, [getDailyClassReport, showError]);

  useEffect(() => {
    if (activeClass) {
      loadReport(activeClass, activeDate);
    }
  }, [activeClass, activeDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── computed ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const values = Object.values(pendingChanges);
    const total   = dailyReport?.learners?.length || 0;
    const present = values.filter(p => p.status === 'PRESENT').length;
    const absent  = values.filter(p => p.status === 'ABSENT').length;
    const late    = values.filter(p => p.status === 'LATE').length;
    const sick    = values.filter(p => p.status === 'SICK').length;
    const excused = values.filter(p => p.status === 'EXCUSED').length;
    const marked  = Object.keys(pendingChanges).length;
    const rate    = marked > 0 ? Math.round((present / marked) * 100) : 0;
    return { present, absent, late, sick, excused, marked, total, rate };
  }, [pendingChanges, dailyReport]);

  const exceptions = useMemo(() => {
    if (!dailyReport?.learners) return [];
    return dailyReport.learners.filter(l => {
      const status = pendingChanges[l.id]?.status;
      return status !== 'PRESENT';
    });
  }, [dailyReport, pendingChanges]);

  const displayedLearners = useMemo(() => {
    const base = showAllLearners
      ? (dailyReport?.learners || [])
      : exceptions;

    let list = base;
    if (exceptionFilter !== 'all') {
      list = list.filter(l => pendingChanges[l.id]?.status === exceptionFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(l =>
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
        l.admissionNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [showAllLearners, dailyReport, exceptions, exceptionFilter, searchTerm, pendingChanges]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleMarkAllPresent = useCallback(() => {
    if (!dailyReport?.learners) return;
    const allPresent = {};
    dailyReport.learners.forEach(l => {
      allPresent[l.id] = { status: 'PRESENT', remarks: '' };
    });
    setPendingChanges(allPresent);
    setAllMarkedPresent(true);
  }, [dailyReport]);

  const handleStatusChange = useCallback((learnerId, status) => {
    setPendingChanges(prev => ({
      ...prev,
      [learnerId]: { status, remarks: prev[learnerId]?.remarks || '' },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeClass) return;
    setIsSaving(true);
    const records = Object.entries(pendingChanges).map(([learnerId, data]) => ({
      learnerId,
      status: data.status,
      remarks: data.remarks || undefined,
    }));
    if (records.length === 0) {
      showError('No attendance records to save');
      setIsSaving(false);
      return;
    }
    const result = await markBulkAttendance(activeDate, getClassId(activeClass), records);
    if (result?.success) {
      showSuccess(`Attendance saved — ${stats.present} present, ${stats.absent} absent`);
    } else {
      showError(result?.error || 'Failed to save attendance');
    }
    setIsSaving(false);
  }, [activeClass, activeDate, pendingChanges, markBulkAttendance, showSuccess, showError, stats]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-0">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        {/* Title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-brand-purple/10 rounded-xl flex items-center justify-center">
            <CheckCheck size={18} className="text-brand-purple" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Daily Attendance</h1>
            <p className="text-xs text-gray-500">Mark All Present → Edit Exceptions → Save</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Class selector */}
        {!isTeacher && (
          <div className="relative">
            <select
              value={activeClass ? getClassId(activeClass) : ''}
              onChange={e => {
                const c = classes.find(cl => getClassId(cl) === e.target.value);
                setActiveClass(c || null);
              }}
              className="h-10 pl-3 pr-8 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 bg-white focus:outline-none focus:border-brand-purple/40 appearance-none min-w-[160px]"
            >
              <option value="">Select class</option>
              {classes.map(c => (
                <option key={getClassId(c)} value={getClassId(c)}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}
        {isTeacher && activeClass && (
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-purple/5 rounded-xl border border-brand-purple/10">
            <span className="text-sm font-semibold text-brand-purple">{activeClass.name}</span>
          </div>
        )}

        {/* Date picker */}
        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-xl bg-white">
          <Calendar size={14} className="text-gray-400" />
          <input
            type="date"
            value={activeDate}
            onChange={e => setActiveDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="text-sm font-medium text-gray-900 bg-transparent outline-none"
          />
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={() => activeClass && loadReport(activeClass, activeDate)}
          disabled={isLoadingReport || !activeClass}
          className="h-10 w-10 flex items-center justify-center border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
          title="Reload register"
        >
          <RefreshCw size={15} className={cn('text-gray-500', isLoadingReport && 'animate-spin')} />
        </button>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || Object.keys(pendingChanges).length === 0}
          className={cn(
            'h-10 px-5 rounded-xl font-semibold text-sm flex items-center gap-2',
            'bg-brand-purple text-white',
            'hover:bg-brand-purple/90 transition-all active:scale-95',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'shadow-md shadow-brand-purple/20'
          )}
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Attendance
        </button>
      </div>

      {/* ── Loading state ── */}
      {(hookLoading || isLoadingReport) && (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}

      {/* ── No class selected ── */}
      {!hookLoading && !isLoadingReport && !activeClass && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16">
          <div className="w-16 h-16 bg-brand-purple/10 rounded-2xl flex items-center justify-center">
            <Users size={28} className="text-brand-purple" />
          </div>
          <div>
            <p className="font-bold text-gray-700 text-lg">Select a class to begin</p>
            <p className="text-sm text-gray-400 mt-1">Use the class selector above</p>
          </div>
        </div>
      )}

      {/* ── Main workspace ── */}
      {!hookLoading && !isLoadingReport && activeClass && hasLoaded && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* KPI row */}
          <div className="flex-shrink-0 px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <AttendanceSummaryCard
              label="Present"
              value={stats.present}
              variant="present"
              total={stats.total}
            />
            <AttendanceSummaryCard
              label="Absent"
              value={stats.absent}
              variant="absent"
              total={stats.total}
            />
            <AttendanceSummaryCard
              label="Late"
              value={stats.late}
              variant="late"
              total={stats.total}
            />
            <AttendanceSummaryCard
              label="Not Marked"
              value={stats.total - stats.marked}
              variant="total"
              total={stats.total}
            />
            <AttendanceSummaryCard
              label="Attendance Rate"
              value={stats.rate}
              variant="rate"
            />
          </div>

          {/* ── Mark All Present — primary action ── */}
          {!allMarkedPresent && (
            <div className="flex-shrink-0 px-6 pb-4">
              <div className="max-w-lg mx-auto">
                <AttendanceMarkAllButton
                  onClick={handleMarkAllPresent}
                  count={stats.total}
                />
                <p className="text-center text-xs text-gray-400 mt-2">
                  Marks all {stats.total} learners present. Then edit any exceptions below.
                </p>
              </div>
            </div>
          )}

          {/* ── Workspace (exceptions + insights) ── */}
          <div className="flex-1 overflow-hidden flex gap-0 px-6 pb-6 min-h-0">
            {/* Left: exceptions workspace */}
            <div className="flex-1 flex flex-col gap-3 min-w-0 pr-4">
              {/* Workspace header */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {allMarkedPresent ? (
                  <>
                    <div className="flex items-center gap-2 flex-1">
                      <div className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-2">
                        <CheckCheck size={15} />
                        All {stats.total} marked present
                      </div>
                      <AttendanceMarkAllCompact onClick={handleMarkAllPresent} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-gray-700 flex-1">
                    {stats.marked > 0
                      ? `${stats.marked} of ${stats.total} learners marked`
                      : `${stats.total} learners — use "Mark All Present" above`}
                  </p>
                )}

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setShowAllLearners(false)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                      !showAllLearners
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    Exceptions {exceptions.length > 0 && `(${exceptions.length})`}
                  </button>
                  <button
                    onClick={() => setShowAllLearners(true)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                      showAllLearners
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    All Learners
                  </button>
                </div>
              </div>

              {/* Search + filter bar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    placeholder={`Search ${labels.learners?.toLowerCase() || 'learners'}...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-purple/40 transition-colors"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X size={13} className="text-gray-400" />
                    </button>
                  )}
                </div>

                {/* Status filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <FilterPill
                    label="All"
                    count={showAllLearners ? stats.total : exceptions.length}
                    isActive={exceptionFilter === 'all'}
                    onClick={() => setExceptionFilter('all')}
                  />
                  {EXCEPTION_STATUSES.map(s => {
                    const count = (showAllLearners ? dailyReport?.learners : exceptions)
                      ?.filter(l => pendingChanges[l.id]?.status === s).length || 0;
                    if (count === 0) return null;
                    return (
                      <FilterPill
                        key={s}
                        label={s.replace('_', ' ')}
                        count={count}
                        isActive={exceptionFilter === s}
                        onClick={() => setExceptionFilter(s)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Parent notification option */}
              {stats.absent > 0 && (
                <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="notify-absent"
                    checked={notifyAbsent}
                    onChange={e => setNotifyAbsent(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <Bell size={13} className="text-amber-600" />
                  <label htmlFor="notify-absent" className="text-xs font-medium text-amber-800 cursor-pointer">
                    Notify parents of {stats.absent} absent learner{stats.absent !== 1 ? 's' : ''} after saving
                  </label>
                </div>
              )}

              {/* Learner grid */}
              <div className="flex-1 overflow-y-auto">
                {displayedLearners.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    {allMarkedPresent && !showAllLearners ? (
                      <>
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                          <CheckCheck size={24} className="text-emerald-500" />
                        </div>
                        <p className="font-bold text-gray-700">No exceptions</p>
                        <p className="text-sm text-gray-400 mt-1">All learners are marked present</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                          <Search size={22} className="text-gray-400" />
                        </div>
                        <p className="font-bold text-gray-600">No results found</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 pr-1">
                    {displayedLearners.map(learner => (
                      <AttendanceExceptionCard
                        key={learner.id}
                        learner={learner}
                        currentStatus={pendingChanges[learner.id]?.status}
                        onChange={status => handleStatusChange(learner.id, status)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Insights panel */}
            <div className="w-72 flex-shrink-0 overflow-y-auto pl-4 border-l border-gray-100">
              <AttendanceInsightsPanel
                pendingChanges={pendingChanges}
                dailyReport={dailyReport}
                historicalStats={null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, count, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
        isActive
          ? 'bg-brand-purple text-white'
          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
      )}
    >
      {label}
      <span className={cn(
        'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
        isActive ? 'bg-white/20' : 'bg-gray-100'
      )}>
        {count}
      </span>
    </button>
  );
}

export default DesktopAttendance;
