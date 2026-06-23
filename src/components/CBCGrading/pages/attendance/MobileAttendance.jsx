/**
 * MobileAttendance — Redesigned mobile attendance experience.
 *
 * Flow:
 *  Screen 1: My Classes Today  → tap class
 *  Screen 2: Mark All Present + exceptions editor
 *  Screen 3: Review & Submit
 *
 * Core principle: Mark All Present → Edit Exceptions → Save
 * Target: Full class of 40 learners in <30 seconds.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ArrowLeft, Search, CheckCheck, ChevronRight,
  Users, Filter, X, Bell
} from 'lucide-react';
import { cn } from '../../../../utils/cn';
import { useAttendance } from '../../hooks/useAttendanceAPI';
import { useAuth } from '../../../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { useInstitutionLabels } from '../../../../hooks/useInstitutionLabels';
import { toInputDate } from '../../utils/dateHelpers';
import { approvalAPI } from '../../../../services/api/approval.api';

import { AttendanceClassCard } from './AttendanceClassCard';
import { AttendanceExceptionCard } from './AttendanceExceptionCard';
import { AttendanceBottomBar } from './AttendanceBottomBar';
import { AttendanceMarkAllButton, AttendanceMarkAllCompact } from './AttendanceQuickActions';
import { AttendanceStatusBadge, EXCEPTION_STATUSES } from './AttendanceStatusChip';
import LoadingSpinner from '../../shared/LoadingSpinner';
import {
  formatCompletionTime,
  getAttendancePolicyState,
  getCompletionTimeFromLearners,
  getLockedAttendanceStatuses,
} from './attendancePolicy';
import { DEFAULT_ATTENDANCE_SETTINGS, loadAttendanceSettings } from './attendanceSettings';

const ATTENDANCE_UNLOCK_APPROVER_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
]);

const getApprovalRequests = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.requests)) return data.requests;
  return [];
};

const matchesAttendanceUnlock = (request, classId, date) => {
  const metadata = request?.metadata || {};
  return (
    request?.requestType === 'ATTENDANCE_UNLOCK' &&
    metadata?.classId === classId &&
    metadata?.date === date
  );
};

const isApprovedUnlockActive = (request) => {
  if (request?.status !== 'APPROVED') return false;
  if (!request?.expiresAt) return true;
  return new Date(request.expiresAt).getTime() > Date.now();
};

// ─── screen states ─────────────────────────────────────────────────────────
const SCREEN = {
  CLASSES:    'CLASSES',    // Screen 1: My Classes Today
  TAKE:       'TAKE',       // Screen 2: Take Attendance
  REVIEW:     'REVIEW',     // Screen 3: Review & Submit
};

export function MobileAttendance() {
  const { user } = useAuth();
  const labels = useInstitutionLabels();
  const { showSuccess, showError } = useNotifications();
  const isTeacher = user?.role === 'TEACHER';
  const userRole = String(user?.role || '').toUpperCase();
  const canApproveAttendanceUnlock = ATTENDANCE_UNLOCK_APPROVER_ROLES.has(userRole);

  const [screen, setScreen] = useState(SCREEN.CLASSES);
  const [activeClass, setActiveClass] = useState(null);
  const [activeDate, setActiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});
  const [allMarkedPresent, setAllMarkedPresent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [exceptionFilter, setExceptionFilter] = useState('all'); // 'all' | status key
  const [attendanceSettings, setAttendanceSettings] = useState(DEFAULT_ATTENDANCE_SETTINGS);
  const [notifyAbsent, setNotifyAbsent] = useState(DEFAULT_ATTENDANCE_SETTINGS.notifyAbsentDefault);
  const [unlockRequested, setUnlockRequested] = useState(false);
  const [unlockRequest, setUnlockRequest] = useState(null);
  const [isLoadingUnlockRequest, setIsLoadingUnlockRequest] = useState(false);
  const [isApprovingUnlock, setIsApprovingUnlock] = useState(false);
  const [classSummaries, setClassSummaries] = useState({});

  const {
    classes,
    loading: hookLoading,
    getDailyClassReport,
    markBulkAttendance,
  } = useAttendance();

  // ── helpers ──────────────────────────────────────────────────────────────
  const getClassId = (c) => c?.id || c?._id || '';

  const loadAttendanceUnlockRequest = useCallback(async (classItem, date) => {
    const classId = getClassId(classItem);
    if (!classId || !date) return;
    setIsLoadingUnlockRequest(true);
    try {
      const params = {
        module: 'ATTENDANCE',
        requestType: 'ATTENDANCE_UNLOCK',
        status: 'PENDING',
      };
      const [pendingResponse, approvedResponse] = await Promise.all([
        canApproveAttendanceUnlock ? approvalAPI.list(params) : approvalAPI.myRequests(params),
        canApproveAttendanceUnlock
          ? approvalAPI.list({ ...params, status: 'APPROVED' })
          : approvalAPI.myRequests({ ...params, status: 'APPROVED' }),
      ]);
      const requests = [
        ...getApprovalRequests(pendingResponse),
        ...getApprovalRequests(approvedResponse),
      ];
      const match = requests.find(request => matchesAttendanceUnlock(request, classId, date));
      setUnlockRequest(match || null);
      setUnlockRequested(Boolean(match && ['PENDING', 'APPROVED'].includes(match.status)));
    } catch (err) {
      console.warn('[Attendance] Failed to load unlock request:', err);
      setUnlockRequest(null);
    } finally {
      setIsLoadingUnlockRequest(false);
    }
  }, [canApproveAttendanceUnlock]);

  const stats = useMemo(() => {
    const values = Object.values(pendingChanges);
    const present = values.filter(p => p.status === 'PRESENT').length;
    const absent  = values.filter(p => p.status === 'ABSENT').length;
    const late    = values.filter(p => p.status === 'LATE').length;
    const sick    = values.filter(p => p.status === 'SICK').length;
    const total   = dailyReport?.learners?.length || 0;
    return { present, absent, late, sick, total };
  }, [pendingChanges, dailyReport]);

  useEffect(() => {
    let cancelled = false;
    loadAttendanceSettings()
      .then((settings) => {
        if (cancelled) return;
        setAttendanceSettings(settings);
        setNotifyAbsent(settings.notifyAbsentDefault);
      })
      .catch((err) => {
        console.warn('[Attendance] Failed to load attendance settings:', err);
      });
    return () => { cancelled = true; };
  }, []);

  const policy = useMemo(
    () => getAttendancePolicyState(activeDate, new Date(), attendanceSettings),
    [activeDate, attendanceSettings]
  );
  const isAttendanceUnlocked = useMemo(() => isApprovedUnlockActive(unlockRequest), [unlockRequest]);
  const effectivePolicy = useMemo(
    () => ({ ...policy, isLocked: policy.isLocked && !isAttendanceUnlocked }),
    [isAttendanceUnlocked, policy]
  );
  const lockedStatuses = useMemo(
    () => getLockedAttendanceStatuses(attendanceSettings),
    [attendanceSettings]
  );

  const completedAt = useMemo(
    () => getCompletionTimeFromLearners(dailyReport?.learners || []),
    [dailyReport]
  );

  // Learners who have a non-PRESENT status (or unmarked)
  const exceptions = useMemo(() => {
    if (!dailyReport?.learners) return [];
    return dailyReport.learners.filter(l => {
      const status = pendingChanges[l.id]?.status;
      return status !== 'PRESENT';
    });
  }, [dailyReport, pendingChanges]);

  const filteredLearners = useMemo(() => {
    let list = dailyReport?.learners || [];
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
  }, [dailyReport, exceptionFilter, searchTerm, pendingChanges]);

  const allLearners = useMemo(() => {
    if (!dailyReport?.learners) return [];
    const q = searchTerm.toLowerCase();
    if (!q) return dailyReport.learners;
    return dailyReport.learners.filter(l =>
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
      l.admissionNumber?.toLowerCase().includes(q)
    );
  }, [dailyReport, searchTerm]);

  // ── actions ───────────────────────────────────────────────────────────────
  const getClassLearnerCount = useCallback((classItem) => (
    Number(
      classItem?.learnerCount ??
      classItem?.studentCount ??
      classItem?._count?.learners ??
      classItem?._count?.students ??
      classItem?._count?.enrollments ??
      0
    ) || 0
  ), []);

  const getClassPresentCount = useCallback((classItem) => (
    Number(
      classSummaries[getClassId(classItem)]?.present ??
      classItem?.presentCount ??
      classItem?.attendancePresent ??
      classItem?.attendanceSummary?.present ??
      0
    ) || 0
  ), [classSummaries]);

  const getClassSummary = useCallback((classItem) => classSummaries[getClassId(classItem)] || null, [classSummaries]);

  useEffect(() => {
    if (screen !== SCREEN.CLASSES || !classes.length) return;
    let cancelled = false;

    const loadClassSummaries = async () => {
      const entries = await Promise.all(classes.map(async (classItem) => {
        const classId = getClassId(classItem);
        if (!classId) return null;
        const report = await getDailyClassReport(classId, activeDate);
        if (!report) return null;
        const learners = report.learners || [];
        const present = learners.filter((learner) => learner.attendance?.status === 'PRESENT').length;
        const completedAt = getCompletionTimeFromLearners(learners);
        return [classId, {
          total: report.totalLearners || learners.length,
          marked: report.marked || learners.filter((learner) => learner.attendance).length,
          present,
          completedAt: formatCompletionTime(completedAt),
        }];
      }));

      if (!cancelled) {
        setClassSummaries(Object.fromEntries(entries.filter(Boolean)));
      }
    };

    loadClassSummaries();
    return () => { cancelled = true; };
  }, [screen, classes, activeDate, getDailyClassReport]);

  const handleSelectClass = useCallback(async (classItem) => {
    setIsLoading(true);
    setActiveClass(classItem);
    setScreen(SCREEN.TAKE);
    setAllMarkedPresent(false);
    setPendingChanges({});
    setSearchTerm('');
    setExceptionFilter('all');
    setUnlockRequested(false);
    setUnlockRequest(null);

    try {
      const report = await getDailyClassReport(getClassId(classItem), activeDate);
      if (report) {
        setDailyReport(report);
        // Pre-fill any existing attendance
        const existing = {};
        report.learners.forEach(l => {
          if (l.attendance) {
            existing[l.id] = { status: l.attendance.status, remarks: l.attendance.remarks || '' };
          }
        });
        setPendingChanges(existing);
        // If all were already present, mark that
        if (
          Object.keys(existing).length === report.learners.length &&
          Object.values(existing).every(e => e.status === 'PRESENT')
        ) {
          setAllMarkedPresent(true);
        }
      }
      await loadAttendanceUnlockRequest(classItem, activeDate);
    } catch {
      showError('Failed to load attendance register');
      setScreen(SCREEN.CLASSES);
    } finally {
      setIsLoading(false);
    }
  }, [activeDate, getDailyClassReport, loadAttendanceUnlockRequest, showError]);

  const handleMarkAllPresent = useCallback(() => {
    if (effectivePolicy.isLocked) {
      showError(`Mark all present is locked after ${policy.lockLabel}. Mark late learners individually or request unlock.`);
      return;
    }
    if (!dailyReport?.learners) return;
    const allPresent = {};
    dailyReport.learners.forEach(l => {
      allPresent[l.id] = { status: 'PRESENT', remarks: '' };
    });
    setPendingChanges(allPresent);
    setAllMarkedPresent(true);
  }, [dailyReport, effectivePolicy.isLocked, policy.lockLabel, showError]);

  const handleStatusChange = useCallback((learnerId, status) => {
    if (effectivePolicy.isLocked && lockedStatuses.has(status)) {
      showError(attendanceSettings.allowLateAfterLock
        ? `Present marking is locked after ${policy.lockLabel}. Use Late or another exception status.`
        : `Attendance marking is locked after ${policy.lockLabel}. Request unlock to make changes.`);
      return;
    }
    setPendingChanges(prev => ({
      ...prev,
      [learnerId]: { status, remarks: prev[learnerId]?.remarks || '' },
    }));
  }, [attendanceSettings.allowLateAfterLock, effectivePolicy.isLocked, lockedStatuses, policy.lockLabel, showError]);

  const handleRemarksChange = useCallback((learnerId, remarks) => {
    setPendingChanges(prev => ({
      ...prev,
      [learnerId]: { status: prev[learnerId]?.status || 'LATE', remarks },
    }));
  }, []);

  const handleRequestUnlock = useCallback(async () => {
    if (!activeClass) return;
    setUnlockRequested(true);
    try {
      const response = await approvalAPI.submit({
        module: 'ATTENDANCE',
        requestType: 'ATTENDANCE_UNLOCK',
        metadata: {
          classId: getClassId(activeClass),
          className: activeClass.name,
          date: activeDate,
          lockLabel: policy.lockLabel,
          teacherId: user?.id || user?.userId,
        },
        comments: `Unlock attendance for ${activeClass.name} on ${activeDate}`,
      });
      const request = response?.data || response;
      setUnlockRequest(request || null);
      showSuccess('Unlock request sent. An administrator can approve attendance edits.');
    } catch (err) {
      setUnlockRequested(false);
      showError(err?.message || 'Failed to request attendance unlock.');
    }
  }, [activeClass, activeDate, policy.lockLabel, showError, showSuccess, user?.id, user?.userId]);

  const handleApproveUnlock = useCallback(async () => {
    if (!activeClass) return;
    setIsApprovingUnlock(true);
    try {
      let requestToApprove = unlockRequest;
      if (!requestToApprove?.id) {
        const submitResponse = await approvalAPI.submit({
          module: 'ATTENDANCE',
          requestType: 'ATTENDANCE_UNLOCK',
          metadata: {
            classId: getClassId(activeClass),
            className: activeClass.name,
            date: activeDate,
            lockLabel: policy.lockLabel,
            teacherId: user?.id || user?.userId,
          },
          comments: `Direct unlock attendance for ${activeClass.name} on ${activeDate}`,
        });
        requestToApprove = submitResponse?.data || submitResponse;
        setUnlockRequested(true);
      }

      if (!requestToApprove?.id) {
        throw new Error('Invalid unlock request response.');
      }

      const response = await approvalAPI.approve(requestToApprove.id, {
        comment: 'Approved from attendance register.',
      });
      const request = response?.data || response;
      setUnlockRequest(request || { ...requestToApprove, status: 'APPROVED' });
      showSuccess('Attendance unlock approved.');
    } catch (err) {
      showError(err?.message || 'Failed to approve attendance unlock.');
    } finally {
      setIsApprovingUnlock(false);
    }
  }, [activeClass, activeDate, policy.lockLabel, showError, showSuccess, unlockRequest, user?.id, user?.userId]);

  const handleSave = useCallback(async () => {
    if (!activeClass) return;
    setIsSaving(true);
    // SCHOOL_ACTIVITY and SUSPENDED are UI-only labels not in the DB enum.
    // Map them to EXCUSED so the server validation passes; remarks carry the context.
    const STATUS_MAP = { SCHOOL_ACTIVITY: 'EXCUSED', SUSPENDED: 'EXCUSED' };
    const records = Object.entries(pendingChanges).map(([learnerId, data]) => ({
      learnerId,
      status: STATUS_MAP[data.status] || data.status,
      remarks: data.remarks || (data.status === 'SCHOOL_ACTIVITY' ? 'School activity' : data.status === 'SUSPENDED' ? 'Suspended' : undefined),
    }));
    const missingRemarks = attendanceSettings.requireRemarksForLateExcused
      ? records.filter(record =>
          ['LATE', 'EXCUSED'].includes(record.status) && !String(record.remarks || '').trim()
        )
      : [];
    if (missingRemarks.length > 0) {
      showError('Add a lateness or excuse note before saving.');
      setIsSaving(false);
      return;
    }
    if (records.length === 0) {
      showError('No attendance records to save');
      setIsSaving(false);
      return;
    }
    const result = await markBulkAttendance(activeDate, getClassId(activeClass), records);
    if (result?.success) {
      showSuccess('Attendance saved!');
      setClassSummaries(prev => ({
        ...prev,
        [getClassId(activeClass)]: {
          total: stats.total,
          marked: records.length,
          present: stats.present,
          completedAt: formatCompletionTime(new Date()),
        },
      }));
      setScreen(SCREEN.REVIEW);
    } else {
      showError(result?.error || 'Failed to save attendance');
    }
    setIsSaving(false);
  }, [activeClass, activeDate, attendanceSettings.requireRemarksForLateExcused, pendingChanges, markBulkAttendance, showSuccess, showError, stats.present, stats.total]);

  // ── today's greeting ──────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const firstName = user?.firstName || user?.name?.split(' ')[0] || 'Teacher';

  // ── render ────────────────────────────────────────────────────────────────

  // SCREEN 1: My Classes Today
  if (screen === SCREEN.CLASSES) {
    return (
      <div className="flex flex-col min-h-0 pb-24">
        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <p className="text-xs text-gray-500 font-medium">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Select a class to take attendance</p>
        </div>

        {/* Date selector */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</span>
            <input
              type="date"
              value={activeDate}
              onChange={e => setActiveDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none"
            />
          </div>
        </div>

        {/* Classes list */}
        {hookLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : classes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-16 h-16 bg-brand-purple/10 rounded-2xl flex items-center justify-center mb-4">
              <Users size={28} className="text-brand-purple" />
            </div>
            <p className="font-semibold text-gray-700">No classes assigned</p>
            <p className="text-sm text-gray-500 mt-1">
              Contact your administrator to assign a class.
            </p>
          </div>
        ) : (
          <div className="px-4 space-y-3">
            {classes.map(classItem => {
              const summary = getClassSummary(classItem);
              return (
                <AttendanceClassCard
                  key={getClassId(classItem)}
                  classItem={classItem}
                  onTake={handleSelectClass}
                  presentCount={getClassPresentCount(classItem)}
                  markedCount={summary?.marked || 0}
                  totalCount={summary?.total || getClassLearnerCount(classItem)}
                  completedAt={summary?.marked > 0 ? summary?.completedAt : ''}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // SCREEN 2: Take Attendance
  if (screen === SCREEN.TAKE) {
    return (
      <div className="flex flex-col min-h-0 pb-28">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setScreen(SCREEN.CLASSES)}
              className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Back to classes"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{activeClass?.name}</p>
              <p className="text-xs text-gray-500">
                {new Date(activeDate + 'T00:00:00').toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short'
                })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-full">
              <Users size={13} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">{stats.total}</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* ── Mark All Present (primary action) ── */}
            {!allMarkedPresent && (
              <div className="px-4 pt-5 pb-4">
                <AttendanceMarkAllButton
                  onClick={handleMarkAllPresent}
                  count={stats.total}
                  disabled={!dailyReport || effectivePolicy.isLocked}
                  label={effectivePolicy.isLocked ? `Locked after ${policy.lockLabel}` : 'Mark All Present'}
                />
                <p className="text-center text-xs text-gray-400 mt-2">
                  {effectivePolicy.isLocked
                    ? (attendanceSettings.allowLateAfterLock ? 'Late and exception marking remain available.' : 'All attendance changes require unlock.')
                    : 'Then edit exceptions below'}
                </p>
              </div>
            )}

            {/* ── Post mark-all header ── */}
            {allMarkedPresent && (
              <div className="px-4 pt-4 pb-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCheck size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-800">
                      All {stats.total} learners marked present
                    </p>
                    <p className="text-xs text-emerald-600">
                      {completedAt ? `Completed at ${formatCompletionTime(completedAt)}` : 'Edit exceptions below, then save'}
                    </p>
                  </div>
                  <AttendanceMarkAllCompact
                    onClick={handleMarkAllPresent}
                    disabled={effectivePolicy.isLocked}
                    className="text-xs !py-1"
                  />
                </div>
              </div>
            )}

            {policy.isLocked && (
              <div className="px-4 pb-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-900">
                    {isAttendanceUnlocked ? 'Attendance temporarily unlocked' : 'All-present marking locked'}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    {isAttendanceUnlocked
                      ? 'Approved unlock is active. Make the correction and save before it expires.'
                      : attendanceSettings.allowLateAfterLock
                        ? `After ${policy.lockLabel}, mark late learners individually and add the lateness excuse.`
                        : `After ${policy.lockLabel}, request unlock to make attendance changes.`}
                  </p>
                  {canApproveAttendanceUnlock ? (
                    <button
                      type="button"
                      onClick={handleApproveUnlock}
                      className="mt-3 h-9 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-60"
                      disabled={isApprovingUnlock || isLoadingUnlockRequest || isAttendanceUnlocked}
                    >
                      {isAttendanceUnlocked
                        ? 'Unlock active'
                        : isApprovingUnlock
                          ? 'Unlocking...'
                          : unlockRequest?.status === 'PENDING'
                            ? 'Approve Unlock'
                            : 'Unlock Attendance'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestUnlock}
                      className="mt-3 h-9 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800 disabled:opacity-60"
                      disabled={unlockRequested || isLoadingUnlockRequest || isAttendanceUnlocked}
                    >
                      {isAttendanceUnlocked ? 'Unlock active' : unlockRequested ? 'Unlock requested' : 'Request Unlock'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Editable learner register after mark-all ── */}
            {allMarkedPresent && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-bold text-gray-900 flex-1">
                    Learners
                  </h2>
                  {exceptions.length > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {exceptions.length} exceptions
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 -mt-2 mb-3">
                  Review the register and tap the few learners who are absent, late, sick, or excused.
                </p>

                {/* Search */}
                <div className="relative mb-3">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    placeholder={`Search ${labels.learners?.toLowerCase() || 'learners'}...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-purple/40 focus:bg-white transition-colors"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  )}
                </div>

                {/* Filter chips */}
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3 hide-scrollbar-completely">
                  <FilterChip
                    label="All"
                    count={stats.total}
                    isActive={exceptionFilter === 'all'}
                    onClick={() => setExceptionFilter('all')}
                  />
                  <FilterChip
                    label="Present"
                    count={stats.present}
                    isActive={exceptionFilter === 'PRESENT'}
                    onClick={() => setExceptionFilter('PRESENT')}
                  />
                  {EXCEPTION_STATUSES.map(s => {
                    const count = exceptions.filter(l => pendingChanges[l.id]?.status === s).length;
                    if (count === 0) return null;
                    return (
                      <FilterChip
                        key={s}
                        label={s.replace('_', ' ')}
                        count={count}
                        isActive={exceptionFilter === s}
                        onClick={() => setExceptionFilter(s)}
                      />
                    );
                  })}
                </div>

                {/* Learner list */}
                {filteredLearners.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search size={20} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">
                      No learners match this filter
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLearners.map(learner => (
                      <AttendanceExceptionCard
                        key={learner.id}
                        learner={learner}
                        currentStatus={pendingChanges[learner.id]?.status}
                        currentRemarks={pendingChanges[learner.id]?.remarks || ''}
                        onChange={status => handleStatusChange(learner.id, status)}
                        onRemarksChange={remarks => handleRemarksChange(learner.id, remarks)}
                        disabledStatuses={effectivePolicy.isLocked ? lockedStatuses : undefined}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── All learners view (before mark-all) ── */}
            {!allMarkedPresent && dailyReport?.learners && (
              <div className="px-4 pb-4">
                <p className="text-sm font-semibold text-gray-500 mb-3">
                  Or mark learners individually:
                </p>
                <div className="relative mb-3">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  {allLearners.map(learner => (
                    <AttendanceExceptionCard
                      key={learner.id}
                      learner={learner}
                      currentStatus={pendingChanges[learner.id]?.status}
                      currentRemarks={pendingChanges[learner.id]?.remarks || ''}
                      onChange={status => handleStatusChange(learner.id, status)}
                      onRemarksChange={remarks => handleRemarksChange(learner.id, remarks)}
                      disabledStatuses={effectivePolicy.isLocked ? lockedStatuses : undefined}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Parent notification option */}
        {stats.absent > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyAbsent}
                onChange={e => setNotifyAbsent(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <Bell size={13} className="text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                Notify parents of {stats.absent} absent {stats.absent === 1 ? 'learner' : 'learners'}
              </span>
            </label>
          </div>
        )}

        {/* Sticky bottom bar */}
        <AttendanceBottomBar
          stats={stats}
          onSave={handleSave}
          isSaving={isSaving}
          disabled={Object.keys(pendingChanges).length === 0}
        />
      </div>
    );
  }

  // SCREEN 3: Review
  if (screen === SCREEN.REVIEW) {
    const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    return (
      <div className="flex flex-col min-h-0 pb-6">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setScreen(SCREEN.CLASSES)}
            className="flex items-center gap-2 text-sm text-brand-purple font-semibold mb-4"
          >
            <ArrowLeft size={16} />
            Back to Classes
          </button>
          <h1 className="text-xl font-bold text-gray-900">Attendance Submitted</h1>
          <p className="text-sm text-gray-500 mt-1">{activeClass?.name} · {activeDate}</p>
        </div>

        {/* Summary */}
        <div className="px-4 py-5 space-y-4">
          {/* Rate ring */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold',
              pct >= 90 ? 'bg-emerald-100 text-emerald-700' :
              pct >= 75 ? 'bg-amber-100 text-amber-700' :
              'bg-rose-100 text-rose-700'
            )}>
              {pct}%
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">Attendance Rate</p>
              <p className="text-sm text-gray-500">
                {stats.present} of {stats.total} learners present
              </p>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <ReviewStat label="Present" value={stats.present} color="emerald" />
            <ReviewStat label="Absent"  value={stats.absent}  color="rose" />
            <ReviewStat label="Late"    value={stats.late}    color="amber" />
            <ReviewStat label="Sick"    value={stats.sick}    color="orange" />
          </div>

          {/* Exceptions list */}
          {exceptions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-700">Exceptions ({exceptions.length})</p>
              </div>
              <div className="divide-y divide-gray-50">
                {exceptions.map(l => (
                  <div key={l.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-sm text-gray-900 flex-1 font-medium">
                      {l.firstName} {l.lastName}
                    </span>
                    <AttendanceStatusBadge
                      status={pendingChanges[l.id]?.status}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setScreen(SCREEN.CLASSES)}
            className="w-full h-12 rounded-xl bg-brand-purple text-white font-bold text-sm hover:bg-brand-purple/90 transition-colors"
          >
            Done — Back to Classes
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function FilterChip({ label, count, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
        isActive
          ? 'bg-brand-purple text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      )}
    >
      {label}
      <span className={cn(
        'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
        isActive ? 'bg-white/20' : 'bg-white'
      )}>
        {count}
      </span>
    </button>
  );
}

function ReviewStat({ label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700',
    rose:    'bg-rose-50 text-rose-700',
    amber:   'bg-amber-50 text-amber-700',
    orange:  'bg-orange-50 text-orange-700',
  };
  return (
    <div className={cn('rounded-xl p-3', colors[color] || 'bg-gray-50 text-gray-700')}>
      <p className="text-xs font-semibold opacity-70">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default MobileAttendance;
