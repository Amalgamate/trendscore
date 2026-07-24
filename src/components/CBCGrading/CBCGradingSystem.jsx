import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import HorizontalSubmenu from './layout/HorizontalSubmenu';
import MobileAppShell from './layout/MobileAppShell';
import MobileBottomNav from './dashboard/mobile/MobileBottomNav';
import PageRouter from './layout/PageRouter';
import GlobalModals from './layout/GlobalModals';
import ErrorBoundary from './shared/ErrorBoundary';
import CommandPalette from './layout/CommandPalette';
import GitPopupAlert from './layout/GitPopupAlert';
import GitNotificationDialog from './layout/GitNotificationDialog';
import ModuleHelpAssistant from '../help/ModuleHelpAssistant';
import RoleOnboarding from '../help/RoleOnboarding';
import ImpersonationBanner from '../../components/ImpersonationBanner';
import { useImpersonation } from '../../contexts/ImpersonationContext';

// Hooks
import { useNotifications } from './hooks/useNotifications';
import { useLearnerActions } from './hooks/useLearnerActions';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useUIStore } from '../../store/useUIStore';

// Bootstrap store — data pre-loaded during splash
import { useBootstrapStore } from '../../store/useBootstrapStore';
import { MOBILE_MEDIA_QUERY } from '../../constants/breakpoints';

// Utils
import { clearAllSchoolData } from '../../utils/schoolDataCleanup';
import { refreshBus } from '../../utils/refreshBus';
import axiosInstance from '../../services/api/axiosConfig';
import { hasPageAccess, isParentPortalPage, resolveDashboardPage, userHasParentPortalAccess } from './utils/appAccess';
import { resolveLearnerSaveIntent } from './utils/learnerSaveIntent';
import { useModuleAccess } from '../../contexts/ModuleAccessContext';

const extractApiErrorMessage = (err, fallback = 'Request failed') => {
  const data = err?.response?.data;
  if (typeof data?.error?.message === 'string' && data.error.message.trim()) return data.error.message;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const first = data.errors[0];
    if (typeof first === 'string') return first;
    if (typeof first?.message === 'string') return first.message;
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
};

const extractLearner403Message = (err) => {
  const status = err?.response?.status;
  if (status !== 403) return null;
  const data = err?.response?.data || {};
  const base = typeof data?.message === 'string' && data.message.trim()
    ? data.message.trim()
    : 'You do not have permission to modify this learner record.';
  return `${base} If this is unexpected, contact an admin or headteacher to grant learner access.`;
};

/**
 * CBCGradingSystem — Orchestration Layer
 *
 * Data strategy:
 *   - On first load the SplashScreen has already pre-fetched learners,
 *     teachers, classes, streams and subjects into useBootstrapStore.
 *   - This component reads from that store so pages get data instantly.
 *   - After mutations (add/edit/delete) the relevant bootstrap slice is
 *     refreshed in the background so subsequent navigations stay current.
 */
export default function CBCGradingSystem({ user, onLogout, brandingSettings, setBrandingSettings }) {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const mainContentRef = useRef(null);
  const bannerRef = useRef(null);
  const { activeSlugs } = useModuleAccess();
  const accessUser = useMemo(() => ({ ...(user || {}), enabledApps: activeSlugs }), [activeSlugs, user]);

  // Impersonation session state
  const { isImpersonating, impersonatedUser, stopImpersonation, isLoading: impersonationLoading } = useImpersonation();
  const parentPortal = userHasParentPortalAccess(accessUser);
  const getAllowedPage = useCallback((page) => (
    hasPageAccess(accessUser, page) ? page : resolveDashboardPage(accessUser)
  ), [accessUser]);

  // ── UI State ─────────────────────────────────────────────────────────────
  const {
    sidebarOpen, setSidebarOpen,
    currentPage, setCurrentPage,
    pageParams,
  } = useUIStore();

  const isTabletOrLower = useMediaQuery('(max-width: 1023px)');

  useEffect(() => {
    if (isTabletOrLower) {
      setSidebarOpen(false);
    }
  }, [isTabletOrLower, setSidebarOpen]);

  // ── Bootstrap data (pre-loaded during splash) ────────────────────────────
  const {
    learners:  bootstrapLearners,
    teachers:  bootstrapTeachers,
    ready:     bootstrapReady,
    refreshLearners: storeRefreshLearners,
    refreshTeachers: storeRefreshTeachers,
  } = useBootstrapStore();

  // ── Local state that mirrors the bootstrap store ─────────────────────────
  // We keep local state so mutations (add/edit/delete) can optimistically
  // update the list without waiting for a round-trip.
  const [learners, setLearners]   = useState(bootstrapLearners ?? []);
  const [teachers, setTeachers]   = useState(bootstrapTeachers ?? []);
  const [parents,  setParents]    = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 1 });
  const [teacherPagination, setTeacherPagination] = useState({ total: 0, page: 1, limit: 50 });
  const [parentPagination, setParentPagination]   = useState({ total: 0, page: 1, limit: 20 });
  const [learnersLoading, setLearnersLoading] = useState(!bootstrapReady);

  // Sync local state when bootstrap store populates (first load or refresh)
  useEffect(() => {
    if (bootstrapLearners !== null) {
      setLearners(bootstrapLearners);
      setPagination(prev => ({ ...prev, total: bootstrapLearners.length }));
      setLearnersLoading(false);
    }
  }, [bootstrapLearners]);

  useEffect(() => {
    if (bootstrapTeachers !== null) {
      setTeachers(bootstrapTeachers);
      setTeacherPagination(prev => ({ ...prev, total: bootstrapTeachers.length }));
    }
  }, [bootstrapTeachers]);

  // ── Fetch helpers (used for re-fetch after mutations) ─────────────────────
  const fetchLearnersFromApi = useCallback(async (params = {}) => {
    setLearnersLoading(true);
    try {
      const qs = new URLSearchParams({ limit: 200, ...params }).toString();
      const res = await axiosInstance.get(`/learners?${qs}`);
      const data = res.data?.data ?? [];
      setLearners(data);
      if (res.data?.pagination) setPagination(res.data.pagination);
      // Update bootstrap store so next nav gets fresh data instantly
      storeRefreshLearners(() => Promise.resolve(data));
      return data;
    } catch (err) {
      console.error('fetchLearners error:', err);
      return [];
    } finally {
      setLearnersLoading(false);
    }
  }, [storeRefreshLearners]);

  const fetchTeachersFromApi = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/users?role=TEACHER&limit=200');
      const data = res.data?.data ?? [];
      setTeachers(data);
      if (res.data?.pagination) setTeacherPagination(res.data.pagination);
      storeRefreshTeachers(() => Promise.resolve(data));
      return data;
    } catch (err) {
      console.error('fetchTeachers error:', err);
      return teachers;
    }
  }, [teachers, storeRefreshTeachers]);

  const fetchParentsFromApi = useCallback(async (params = {}) => {
    try {
      const qs = new URLSearchParams({ limit: 200, ...params }).toString();
      const res = await axiosInstance.get(`/users/role/PARENT?${qs}`);
      const data = res.data?.data ?? [];
      const normalizedParents = data.map((parent) => {
        const fullName = [parent.firstName, parent.middleName, parent.lastName].filter(Boolean).join(' ').trim();
        const learners = Array.isArray(parent.learners) ? parent.learners : [];
        return {
          ...parent,
          name: fullName || parent.email || parent.phone || 'Parent/Guardian',
          relationship: 'Parent/Guardian',
          occupation: parent.occupation || 'N/A',
          county: parent.county || 'Nairobi',
          learners,
          learnerIds: learners.map((learner) => learner.admissionNumber).filter(Boolean)
        };
      });
      setParents(normalizedParents);
      if (res.data?.pagination) setParentPagination(res.data.pagination);
      return normalizedParents;
    } catch (err) {
      console.error('fetchParents error:', err);
      return [];
    }
  }, []);

  // ── Dialog & Modal States ─────────────────────────────────────────────────
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction]         = useState(null);
  const [showParentModal, setShowParentModal]     = useState(false);
  const [editingParent, setEditingParent]         = useState(null);
  const [editingTeacher, setEditingTeacher]       = useState(null);
  const [editingLearner, setEditingLearner]       = useState(null);

  const notify = useNotifications();

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleNavigate = useCallback((page, params = {}) => {
    // Communications opens on the inbox; notices remain a separate destination.
    const requestedPage = page === 'communication' ? 'comm-messages' : page;
    const allowedPage = getAllowedPage(requestedPage);
    if (params.learner) setEditingLearner(params.learner);
    if (allowedPage === 'learners-admissions' && !params.learner && !params.learnerId) {
      localStorage.removeItem('admission-form-draft');
      setEditingLearner(null);
    }
    if (params.teacher) setEditingTeacher(params.teacher);
    setCurrentPage(allowedPage, allowedPage === requestedPage ? params : {});
    try {
      const newUrl = `${window.location.pathname}${window.location.search}#/app#${allowedPage}`;
      window.history.pushState({ appPage: allowedPage, appParams: allowedPage === requestedPage ? params : {} }, '', newUrl);
    } catch (e) {
      console.error('History push failed:', e);
    }
  }, [getAllowedPage, setCurrentPage]);

  // Intercept browser back/forward
  useEffect(() => {
    if (!window.history.state?.appPage) {
      window.history.replaceState({ appPage: currentPage, appParams: pageParams }, '', window.location.href);
    }
    const handlePopState = (event) => {
      const state = event.state;
      if (state?.appPage) {
        const allowedPage = getAllowedPage(state.appPage);
        if (allowedPage === state.appPage && state.appParams?.learner) setEditingLearner(state.appParams.learner);
        useUIStore.setState({ currentPage: allowedPage, pageParams: allowedPage === state.appPage ? (state.appParams || {}) : {} });
      } else {
        const landingPage = resolveDashboardPage(accessUser);
        window.history.pushState({ appPage: landingPage, appParams: {} }, '', window.location.href);
        useUIStore.setState({ currentPage: landingPage, pageParams: {} });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [accessUser, getAllowedPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.role === 'ACCOUNTANT' && window.location.pathname.includes('/app/accountant/dashboard')) {
      setCurrentPage('finance-dashboard');
      return;
    }
    if (user?.role === 'ACCOUNTANT' && currentPage === 'dashboard') {
      setCurrentPage('finance-dashboard');
      return;
    }
    if (!parentPortal && isParentPortalPage(currentPage)) {
      setCurrentPage(resolveDashboardPage(accessUser));
      return;
    }
    // Redirect parents away from the generic dashboard to the parent portal home.
    if (parentPortal && currentPage === 'dashboard') {
      setCurrentPage('parent-portal-home');
      return;
    }
    if (!hasPageAccess(accessUser, currentPage)) {
      setCurrentPage(resolveDashboardPage(accessUser));
    }
  }, [accessUser, currentPage, parentPortal, setCurrentPage]);

  // Lazy-load parents on first visit to a parents page
  const parentsLoaded = useRef(false);
  useEffect(() => {
    const parentsPages = ['parents-list', 'parent-profile', 'dashboard'];
    if (!parentPortal && parentsPages.includes(currentPage) && !parentsLoaded.current) {
      parentsLoaded.current = true;
      fetchParentsFromApi();
    }
  }, [currentPage, parentPortal, fetchParentsFromApi]);

  // ── Learner mutation helpers ───────────────────────────────────────────────
  const createLearner = useCallback(async (data) => {
    try {
      const res = await axiosInstance.post('/learners', data);
      if (res.data?.success) {
        await fetchLearnersFromApi(); // refresh the list
        return { success: true, data: res.data.data };
      }
      return { success: false, error: res.data?.message || 'Failed to create learner' };
    } catch (err) {
      const forbiddenMessage = extractLearner403Message(err);
      if (forbiddenMessage) {
        return { success: false, error: forbiddenMessage };
      }
      const message = extractApiErrorMessage(err, 'Failed to create learner');
      console.error('❌ createLearner failed:', message, err?.response?.data || err);
      return { success: false, error: message };
    }
  }, [fetchLearnersFromApi]);

  const updateLearner = useCallback(async (id, data) => {
    try {
      const res = await axiosInstance.put(`/learners/${id}`, data);
      if (res.data?.success) {
        setLearners(prev => prev.map(l => l.id === id ? { ...l, ...res.data.data } : l));
        storeRefreshLearners(() => Promise.resolve(
          learners.map(l => l.id === id ? { ...l, ...res.data.data } : l)
        ));
        return { success: true, data: res.data.data };
      }
      return { success: false, error: res.data?.message };
    } catch (err) {
      const forbiddenMessage = extractLearner403Message(err);
      if (forbiddenMessage) {
        return { success: false, error: forbiddenMessage };
      }
      return { success: false, error: extractApiErrorMessage(err, 'Failed to update learner') };
    }
  }, [learners, storeRefreshLearners]);

  const deleteLearner = useCallback(async (id) => {
    try {
      const res = await axiosInstance.delete(`/learners/${id}`);
      if (res.data?.success) {
        setLearners(prev => prev.filter(l => l.id !== id));
        return { success: true };
      }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const bulkDeleteLearners = useCallback(async (ids) => {
    const results = await Promise.all(ids.map(id => deleteLearner(id)));
    await fetchLearnersFromApi();
    const failed = results.filter(r => !r.success);
    return failed.length === 0
      ? { success: true }
      : { success: false, error: `${failed.length} deletions failed` };
  }, [deleteLearner, fetchLearnersFromApi]);

  const promoteLearners = useCallback(async (learnerIds, newGrade) => {
    try {
      const res = await axiosInstance.post('/learners/bulk-promote', {
        learnerIds, nextGrade: newGrade,
      });
      if (res.data?.success) {
        await fetchLearnersFromApi();
        return { success: true };
      }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchLearnersFromApi]);

  const transferOutLearner = useCallback(async (transferData) => {
    try {
      const res = await axiosInstance.post('/learners/transfer-out', transferData);
      if (res.data?.success) {
        await fetchLearnersFromApi();
        return { success: true };
      }
      return { success: false, error: res.data?.message || 'Failed to process transfer out' };
    } catch (err) {
      return { success: false, error: extractApiErrorMessage(err, 'Failed to process transfer out') };
    }
  }, [fetchLearnersFromApi]);

  // ── Teacher mutation helpers ───────────────────────────────────────────────
  const createTeacher = useCallback(async (data) => {
    try {
      const res = await axiosInstance.post('/auth/register', { ...data, role: 'TEACHER' });
      if (res.data?.success) {
        await fetchTeachersFromApi();
        refreshBus.emit('teachers');
        return { success: true, data: res.data.user };
      }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: extractApiErrorMessage(err, 'Failed to create tutor') };
    }
  }, [fetchTeachersFromApi]);

  const updateTeacher = useCallback(async (id, data) => {
    try {
      const res = await axiosInstance.put(`/users/${id}`, data);
      if (res.data?.success) {
        await fetchTeachersFromApi();
        refreshBus.emit('teachers');
        return { success: true, data: res.data.data };
      }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: extractApiErrorMessage(err, 'Failed to update tutor') };
    }
  }, [fetchTeachersFromApi]);

  const deleteTeacher = useCallback(async (id) => {
    try {
      const res = await axiosInstance.delete(`/users/${id}`);
      if (res.data?.success) { await fetchTeachersFromApi(); return { success: true }; }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: extractApiErrorMessage(err, 'Failed to delete tutor') };
    }
  }, [fetchTeachersFromApi]);

  const archiveTeacher = useCallback(async (id) => {
    try {
      const res = await axiosInstance.patch(`/users/${id}/archive`);
      if (res.data?.success) { await fetchTeachersFromApi(); return { success: true }; }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: extractApiErrorMessage(err, 'Failed to archive tutor') };
    }
  }, [fetchTeachersFromApi]);

  // ── Parent mutation helpers ───────────────────────────────────────────────
  const createParent = useCallback(async (data) => {
    try {
      const res = await axiosInstance.post('/auth/register', { ...data, role: 'PARENT' });
      if (res.data?.success) { await fetchParentsFromApi(); return { success: true }; }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: extractApiErrorMessage(err, 'Failed to create parent') };
    }
  }, [fetchParentsFromApi]);

  const updateParent = useCallback(async (id, data) => {
    try {
      const res = await axiosInstance.put(`/users/${id}`, data);
      if (res.data?.success) { await fetchParentsFromApi(); return { success: true }; }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchParentsFromApi]);

  const archiveParent = useCallback(async (id) => {
    try {
      const res = await axiosInstance.patch(`/users/${id}/archive`);
      if (res.data?.success) { await fetchParentsFromApi(); return { success: true }; }
      return { success: false, error: res.data?.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchParentsFromApi]);

  // ── Save teacher (create or update) ──────────────────────────────────────
  const handleSaveTeacher = async (tForm) => {
    const result = editingTeacher
      ? await updateTeacher(editingTeacher.id, tForm)
      : await createTeacher(tForm);
    if (result.success) {
      notify.showSuccess(`Tutor ${editingTeacher ? 'updated' : 'added'} successfully!`);
      setCurrentPage('teachers-list');
      setEditingTeacher(null);
    } else {
      notify.showError(`Error: ${result.error}`);
    }
  };

  const handleDeleteTeacher = (teacherId) => {
    setConfirmAction(() => async () => {
      const canHardDelete = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(user?.role);
      const result = canHardDelete
        ? await deleteTeacher(teacherId)
        : await archiveTeacher(teacherId);
      if (result.success) notify.showSuccess('Operation successful');
      else notify.showError(result.error || 'Operation failed');
      setShowConfirmDialog(false);
    });
    setShowConfirmDialog(true);
  };

  const handleSaveParent = async (pData) => {
    const result = editingParent
      ? await updateParent(editingParent.id, pData)
      : await createParent(pData);
    if (result.success) {
      notify.showSuccess(`Parent ${editingParent ? 'updated' : 'added'} successfully!`);
      setShowParentModal(false);
      setEditingParent(null);
      refreshBus.emit('parents');
    } else {
      notify.showError(`Error: ${result.error}`);
    }
  };

  // ── Learner actions (mark-exited, transfer-out, etc.) ─────────────────────
  const learnerActionData = useLearnerActions({
    learners,
    updateLearner,
    createLearner,
    deleteLearner,
    bulkDeleteLearners,
    promoteLearners,
    transferOutLearner,
    showSuccess: notify.showSuccess,
    showError:   notify.showError,
    setEditingLearner,
    setCurrentPage,
    setShowConfirmDialog,
    setConfirmAction,
    fetchLearners: fetchLearnersFromApi,
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setConfirmAction(() => () => {
      setShowConfirmDialog(false);
      clearAllSchoolData();
      onLogout();
    });
    setShowConfirmDialog(true);
  };

  // ── Bundle handlers for the router ───────────────────────────────────────
  const handlers = {
    handleNavigate,
    setCurrentPage,
    setEditingLearner,
    setEditingTeacher,
    setBrandingSettings,
    handleAddLearner: () => {
      localStorage.removeItem('admission-form-draft');
      setEditingLearner(null);
      setCurrentPage('learners-admissions');
    },
    ...learnerActionData,
    handleEditLearner: (learner) => { setEditingLearner(learner); setCurrentPage('learners-admissions'); },
    handleMarkAsExited: learnerActionData.handleMarkAsExited,
    handleViewLearner: (learner) => handleNavigate('learner-profile', { learner }),
    handleArchiveParent: (pid) => {
      setConfirmAction(() => async () => { await archiveParent(pid); setShowConfirmDialog(false); });
      setShowConfirmDialog(true);
    },
    fetchLearners:  fetchLearnersFromApi,
    fetchTeachers:  fetchTeachersFromApi,
    fetchParents:   fetchParentsFromApi,
    handleAddTeacher:  () => { setEditingTeacher(null); setCurrentPage('add-teacher'); },
    handleEditTeacher: (t) => { setEditingTeacher(t); setCurrentPage('add-teacher'); },
    handleViewTeacher: (t) => handleNavigate('teacher-profile', { teacher: t }),
    handleAddParent:   () => { setEditingParent(null); setShowParentModal(true); },
    handleEditParent:  (p) => { setEditingParent(p); setShowParentModal(true); },
    handleViewParent:  (p) => handleNavigate('parent-profile', { parent: p }),
    handleDeleteLearner: (id) => {
      setConfirmAction(() => async () => {
        await deleteLearner(id);
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
    },
    handleBulkDeleteLearners: bulkDeleteLearners,
    handleSaveLearner: async (data, options = {}) => {
      const { targetLearnerId, payload, missingEditId } = resolveLearnerSaveIntent(data, options, editingLearner);
      if (missingEditId) {
        const error = 'Cannot update student because the learner ID is missing. Please return to the student list and open Edit again.';
        notify.showError(error);
        return { success: false, error };
      }
      const result = targetLearnerId
        ? await updateLearner(targetLearnerId, payload)
        : await createLearner(payload);
      if (result.success) {
        notify.showSuccess(`Learner ${targetLearnerId ? 'updated' : 'added'} successfully!`);
        if (targetLearnerId) {
          setEditingLearner(result.data || { ...editingLearner, ...payload, id: targetLearnerId });
        } else {
          // For new admissions, return to list after successful create.
          setCurrentPage('learners-list');
          setEditingLearner(null);
        }
      } else {
        notify.showError(result.error || 'Failed to save learner');
      }
      return result;
    },
    handlePromoteLearners: promoteLearners,
    handleTransferOut: learnerActionData.handleTransferOut,
    handleSaveTeacher,
    handleDeleteTeacher,
    handleSaveParent,
    onLogout: handleLogout,
    ...notify,
  };

  // ── Git notification dialog (SUPER_ADMIN / ADMIN only) ────────────────────
  const [gitDialogOpen, setGitDialogOpen] = useState(false);

  // ── Layout ────────────────────────────────────────────────────────────────
  if (isMobile) {
    // Parents get their own shell — white-background portal pages with a
    // shared MobileBottomNav rendered once here so every current and future
    // parent-portal page automatically gets it without per-page wiring.
    if (parentPortal) {
      return (
        <>
          <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--app-page-bg)]">
            {/* Scrollable content — pb-24 ensures content clears the bottom nav */}
            <div className="flex-1 overflow-y-auto pb-24">
              <ErrorBoundary>
                <PageRouter
                  currentPage={currentPage}
                  pageParams={pageParams}
                  user={accessUser}
                  learners={learners}
                  teachers={teachers}
                  parents={parents}
                  pagination={pagination}
                  teacherPagination={teacherPagination}
                  parentPagination={parentPagination}
                  learnersLoading={learnersLoading}
                  brandingSettings={brandingSettings}
                  editingLearner={editingLearner}
                  editingTeacher={editingTeacher}
                  handlers={handlers}
                />
              </ErrorBoundary>
            </div>
            {/* Single global bottom nav for all parent portal pages */}
            <MobileBottomNav
              role={accessUser?.role}
              currentPath={currentPage}
              onNavigate={handleNavigate}
            />
            <ModuleHelpAssistant currentPage={currentPage} user={accessUser} onNavigate={handleNavigate} />
            <RoleOnboarding currentPage={currentPage} user={accessUser} onNavigate={handleNavigate} />
          </div>
          <GlobalModals
            showConfirmDialog={showConfirmDialog} setShowConfirmDialog={setShowConfirmDialog}
            confirmAction={confirmAction}
            showParentModal={showParentModal} setShowParentModal={setShowParentModal}
            editingParent={editingParent} handleSaveParent={handleSaveParent}
            {...notify}
          />
        </>
      );
    }

    return (
      <MobileAppShell
        user={accessUser}
        brandingSettings={brandingSettings}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        currentPage={currentPage}
        setBrandingSettings={setBrandingSettings}
      >
        <ErrorBoundary>
          <PageRouter
            currentPage={currentPage}
            pageParams={pageParams}
            user={accessUser}
            learners={learners}
            teachers={teachers}
            parents={parents}
            pagination={pagination}
            teacherPagination={teacherPagination}
            parentPagination={parentPagination}
            learnersLoading={learnersLoading}
            brandingSettings={brandingSettings}
            editingLearner={editingLearner}
            editingTeacher={editingTeacher}
            handlers={handlers}
          />
        </ErrorBoundary>
        <GlobalModals
          showConfirmDialog={showConfirmDialog} setShowConfirmDialog={setShowConfirmDialog}
          confirmAction={confirmAction}
          showParentModal={showParentModal} setShowParentModal={setShowParentModal}
          editingParent={editingParent} handleSaveParent={handleSaveParent}
          {...notify}
        />
        <ModuleHelpAssistant currentPage={currentPage} user={accessUser} onNavigate={handleNavigate} />
        <RoleOnboarding currentPage={currentPage} user={accessUser} onNavigate={handleNavigate} />
      </MobileAppShell>
    );
  }

  const contentClassName = user?.role === 'ACCOUNTANT' && currentPage === 'finance-dashboard'
    ? 'min-h-full'
    : 'app-layout-content';

  return (
    <div className="flex h-screen bg-[var(--app-page-bg)] overflow-hidden font-inter border-t-2 border-[var(--brand-teal)]">
      {/* Impersonation banner — fixed above all content (Req 4.1, 4.4–4.6) */}
      {isImpersonating && impersonatedUser && (
        <ImpersonationBanner
          ref={bannerRef}
          impersonatedUser={impersonatedUser}
          onExit={stopImpersonation}
          isExiting={impersonationLoading}
        />
      )}
      <CommandPalette onNavigate={handleNavigate} />
      <Sidebar
        user={accessUser}
        brandingSettings={brandingSettings}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenGitDialog={() => setGitDialogOpen(true)}
      />
      <div className="flex-1 flex min-h-0 flex-col min-w-0 overflow-hidden relative">
        {!(user?.role === 'ACCOUNTANT' && currentPage === 'finance-dashboard') && (
          <>
            <Header user={accessUser} onLogout={handleLogout} onNavigate={handleNavigate} brandingSettings={brandingSettings} />
            <HorizontalSubmenu currentPage={currentPage} pageParams={pageParams} onNavigate={handleNavigate} />
          </>
        )}
        <main ref={mainContentRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[var(--app-page-bg)]">
          <div className={contentClassName}>
            <ErrorBoundary>
              <PageRouter
                currentPage={currentPage}
                pageParams={pageParams}
                user={accessUser}
                learners={learners}
                teachers={teachers}
                parents={parents}
                pagination={pagination}
                teacherPagination={teacherPagination}
                parentPagination={parentPagination}
                learnersLoading={learnersLoading}
                brandingSettings={brandingSettings}
                editingLearner={editingLearner}
                editingTeacher={editingTeacher}
                handlers={handlers}
              />
            </ErrorBoundary>
          </div>
        </main>
        <GlobalModals
          showConfirmDialog={showConfirmDialog} setShowConfirmDialog={setShowConfirmDialog}
          confirmAction={confirmAction}
          showParentModal={showParentModal} setShowParentModal={setShowParentModal}
          editingParent={editingParent} handleSaveParent={handleSaveParent}
          {...notify}
        />
        <ModuleHelpAssistant currentPage={currentPage} user={accessUser} onNavigate={handleNavigate} />
        <RoleOnboarding currentPage={currentPage} user={accessUser} onNavigate={handleNavigate} />
      </div>

      {/* Git Update Popup — shows automatically on login/refresh for any
          UserNotification where showAsPopup:true and isRead:false.
          markAsRead() persists the dismiss to DB so it never reappears. */}
      <GitPopupAlert />

      {/* Git Notification Compose Dialog — opened via Sidebar button
          (only rendered for SUPER_ADMIN / ADMIN). */}
      {['SUPER_ADMIN', 'ADMIN'].includes(user?.role) && (
        <GitNotificationDialog
          open={gitDialogOpen}
          onClose={() => setGitDialogOpen(false)}
        />
      )}
    </div>
  );
}
