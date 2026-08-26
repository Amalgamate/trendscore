/**
 * Learners List Page
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Upload, Eye, Edit, Trash2, LogOut, ChevronLeft, ChevronRight, Search, RefreshCw, Users, MoreVertical, MessageCircle, MessageSquare, X, Loader2, Send, Filter, Plus, Bus, UserCheck, UserX, Venus, Mars } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import EmptyState from '../shared/EmptyState';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuth } from '../../../hooks/useAuth';
import { getSelectedInstitutionType } from '../../../services/schoolContext';
import { configAPI, communicationAPI, learnerAPI } from '../../../services/api';
import BulkOperationsModal from '../shared/bulk/BulkOperationsModal';
import VirtualizedTable from '../shared/VirtualizedTable';
import { formatPhoneNumber } from '../../../utils/phoneFormatter';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { MOBILE_MEDIA_QUERY } from '../../../constants/breakpoints';
import { buildLearnerQueryParams } from './learnersListQuery';
import { useNotifications } from '../hooks/useNotifications';

const LearnersList = ({
  learners,
  loading,
  pagination,
  onFetchLearners,
  onAddLearner,
  onEditLearner,
  onViewLearner,
  onMarkAsExited,
  onDeleteLearner,
  onRefresh,
  onBulkDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStream, setFilterStream] = useState('all');
  const [availableStreams, setAvailableStreams] = useState([]);
  const [fallbackGrades, setFallbackGrades] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedLearners, setSelectedLearners] = useState([]);
  const [selectAllDatabase, setSelectAllDatabase] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const [totalStudentsCount, setTotalStudentsCount] = useState(null);
  const [learnerStats, setLearnerStats] = useState(null);

  const activeFilterCount = (filterGrade !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0) + (filterStream !== 'all' ? 1 : 0);
  const clearAllFiltersLearners = () => { setFilterGrade('all'); setFilterStatus('all'); setFilterStream('all'); };
  const [isDeleting, setIsDeleting] = useState(false);
  const [transportTogglingId, setTransportTogglingId] = useState(null);
  const [localTransportState, setLocalTransportState] = useState({});
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState(null);
  const [quickMessage, setQuickMessage] = useState('');
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [contactType, setContactType] = useState('sms'); // 'sms' or 'whatsapp'
  const { can, isRole } = usePermissions();
  const { user } = useAuth();
  const { grades } = useSchoolData();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const { showSuccess, showError } = useNotifications();

  const handleTransportToggle = async (e, learner) => {
    e.stopPropagation();
    const newValue = !(localTransportState[learner.id] ?? learner.isTransportStudent);
    setTransportTogglingId(learner.id);
    setLocalTransportState(prev => ({ ...prev, [learner.id]: newValue }));
    try {
      await learnerAPI.update(learner.id, { isTransportStudent: newValue });
      showSuccess(`${learner.firstName} ${newValue ? 'marked as transport student' : 'removed from transport'}`);
    } catch (err) {
      // Revert on failure
      setLocalTransportState(prev => ({ ...prev, [learner.id]: !newValue }));
      showError(err?.message || 'Failed to update transport status');
    } finally {
      setTransportTogglingId(null);
    }
  };

  const formatGradeLabel = (g) => {
    const s = String(g || '');
    if (!s) return '';
    if (s === 'PLAYGROUP') return 'Playgroup';
    if (s === 'PP1' || s === 'PP2') return s;
    if (s.startsWith('GRADE_')) return `Grade ${s.replace('GRADE_', '')}`;
    if (s.startsWith('GRADE') && /^\d+$/.test(s.replace('GRADE', ''))) return `Grade ${s.replace('GRADE', '')}`;
    return s.replace(/_/g, ' ');
  };

  const selectedInstitutionType = String(getSelectedInstitutionType() || user?.institutionType || '').toUpperCase();
  const isSecondaryPortal = selectedInstitutionType === 'SECONDARY' || selectedInstitutionType === 'HIGH_SCHOOL';
  const isSecondaryGrade = (gradeValue) => {
    const g = String(gradeValue || '').trim().toUpperCase();
    return g.startsWith('FORM') || ['GRADE_10', 'GRADE_11', 'GRADE_12', 'GRADE10', 'GRADE11', 'GRADE12'].includes(g);
  };

  const gradeOptions = useMemo(() => {
    // 1. Get unique grades from both context (classes) and the API fallback
    const combined = [
      ...(Array.isArray(grades) ? grades : []),
      ...(Array.isArray(fallbackGrades) ? fallbackGrades : [])
    ];
    
    // 2. Filter by school level (Junior vs Senior)
    // If badge is JUNIOR, hide Senior grades (GRADE_10-12 / FORM_1-4)
    // If badge is SENIOR, hide Junior grades (PP-GRADE_9)
    const unique = Array.from(new Set(combined.filter(Boolean).map(g => String(g).trim())));
    
    return unique.filter(g => {
      const isSS = isSecondaryGrade(g);
      return isSecondaryPortal ? isSS : !isSS;
    }).sort((a, b) => {
        // Basic smart sort: PP -> Grade -> Form
        if (a === b) return 0;
        const rank = (val) => {
            if (val === 'PLAYGROUP') return 1;
            if (val === 'PP1') return 2;
            if (val === 'PP2') return 3;
            if (val.startsWith('GRADE_')) return 10 + parseInt(val.replace('GRADE_', ''));
            if (val.startsWith('GRADE')) return 10 + parseInt(val.replace('GRADE', ''));
            if (val.startsWith('FORM_')) return 30 + parseInt(val.replace('FORM_', ''));
            return 99;
        };
        return rank(a) - rank(b);
    });
  }, [grades, fallbackGrades, isSecondaryPortal]);

  // Check permissions
  const canCreateLearner = can('CREATE_LEARNER') || isRole('TEACHER');
  const canEditLearner = can('EDIT_LEARNER');
  const canDeleteLearner = can('DELETE_LEARNER');
  const isTeacher = isRole('TEACHER');

  // Fetch streams on mount (single-tenant: no schoolId needed)
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const resp = await configAPI.getStreamConfigs();
        const arr = resp?.data || [];
        setAvailableStreams(arr.filter(s => s.active !== false));
      } catch (error) {
        console.error('Failed to fetch streams:', error);
      }
    };
    fetchStreams();
  }, []);

  // Ensure grade filter options are always available (fallback to /config/grades)
  useEffect(() => {
    const loadFallbackGrades = async () => {
      try {
        const resp = await configAPI.getGrades();
        const arr = resp?.data || [];
        if (Array.isArray(arr)) setFallbackGrades(arr);
      } catch (e) {
        // Leave fallbackGrades empty; UI will still function with "All Grades".
      }
    };
    loadFallbackGrades();
  }, [grades, user?.institutionType]);

  useEffect(() => {
    let isMounted = true;
    const loadTotalStudents = async () => {
      try {
        const stats = await learnerAPI.getStats();
        const data = stats?.data;
        const total = data?.active ?? data?.totalActive ?? data?.total;
        if (isMounted && Number.isFinite(total)) {
          setTotalStudentsCount(total);
        }
        if (isMounted && data) {
          setLearnerStats(data);
        }
      } catch (error) {
        // Keep fallback to pagination total when stats endpoint is unavailable.
      }
    };
    loadTotalStudents();
    return () => {
      isMounted = false;
    };
  }, []);

  // Server-side filtering effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFetchLearners) {
        onFetchLearners(buildLearnerQueryParams({
          page: 1,
          searchTerm,
          paginationLimit: pagination?.limit || 50,
          filterGrade,
          filterStatus,
          filterStream,
        }));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, filterGrade, filterStatus, filterStream, onFetchLearners, pagination?.limit]);

  const handlePageChange = (newPage) => {
    if (onFetchLearners) {
      onFetchLearners(buildLearnerQueryParams({
        page: newPage,
        searchTerm,
        paginationLimit: pagination?.limit || 50,
        filterGrade,
        filterStatus,
        filterStream,
      }));
    }
  };

  const displayLearners = useMemo(() => {
    const source = Array.isArray(learners) ? learners : [];
    return source.filter((learner) => {
      const learnerIsSecondary = isSecondaryGrade(learner?.grade);
      return isSecondaryPortal ? learnerIsSecondary : !learnerIsSecondary;
    });
  }, [learners, isSecondaryPortal]);
  const visibleStudentsCount = displayLearners.length;

  const canTeacherModify = (learner) => {
    if (!isTeacher) return true; // Admins etc can always modify
    const isCreator = learner.createdBy === user?.id;
    const isClassTeacher = learner.enrollments?.some(e => e.class?.teacherId === user?.id);
    return isCreator || isClassTeacher;
  };

  const getRelationshipLabel = (type) => {
    const normalizedType = String(type || '').toUpperCase();
    if (normalizedType === 'FATHER') return 'Father';
    if (normalizedType === 'MOTHER') return 'Mother';
    if (normalizedType === 'GUARDIAN') return 'Guardian';
    return type || 'Parent';
  };

  const handleReset = () => {
    setSearchTerm('');
    setFilterGrade('all');
    setFilterStatus('all');
    setSelectedLearners([]);
  };

  const handleOpenQuickContact = (guardian) => {
    setSelectedGuardian(guardian);
    setQuickMessage('');
    setContactType('sms');
    setShowQuickContact(true);
  };

  const handleSendQuickMessage = async () => {
    if (!selectedGuardian || !quickMessage.trim()) {
      showError('Please select a parent/guardian and enter a message');
      return;
    }

    setIsSendingSMS(true);
    try {
      const phoneNumber = selectedGuardian.phone || selectedGuardian.primaryContactPhone;
      const formattedPhone = formatPhoneNumber(phoneNumber);

      if (contactType === 'whatsapp') {
        // Open WhatsApp directly
        const encodedMessage = encodeURIComponent(quickMessage);
        window.open(`https://wa.me/${formattedPhone.replace(/\D/g, '')}?text=${encodedMessage}`, '_blank');
        setShowQuickContact(false);
        setQuickMessage('');
      } else {
        // Send SMS
        const response = await communicationAPI.sendTestSMS({
          phoneNumber: formattedPhone,
          message: quickMessage,
          schoolId: user?.schoolId
        });

        if (response && (response.message || response.success)) {
          showSuccess('Message sent successfully');
          setShowQuickContact(false);
          setQuickMessage('');
        } else {
          showError('Failed to send message. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showError(`Error sending message: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSendingSMS(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLearners(displayLearners.map(l => l.id));
    } else {
      setSelectedLearners([]);
    }
  };

  const handleSelectLearner = (id) => {
    if (selectedLearners.includes(id)) {
      setSelectedLearners(selectedLearners.filter(learnerId => learnerId !== id));
    } else {
      setSelectedLearners([...selectedLearners, id]);
    }
  };

  const refreshData = () => {
    if (onFetchLearners) {
      onFetchLearners(buildLearnerQueryParams({
        page: pagination?.page || 1,
        searchTerm,
        paginationLimit: pagination?.limit || 50,
        filterGrade,
        filterStatus,
        filterStream,
      }));
    }
  };

  const handleIndividualDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }

    try {
      if (onBulkDelete) {
        await onBulkDelete([id]);
        refreshData();
      } else {
        await onDeleteLearner(id);
      }
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  };

  const handleBulkDelete = async () => {
    const countToDelete = selectAllDatabase ? pagination?.total : selectedLearners.length;
    if (!window.confirm(`Are you sure you want to delete ${countToDelete} students? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      if (onBulkDelete) {
        let learnerIdsToDelete = selectedLearners;

        // If selectAllDatabase is true, fetch all learners matching current filters
        if (selectAllDatabase) {
          const params = {
            limit: 1000, // Fetch up to 1000 learners per page
            search: searchTerm || undefined,
            grade: filterGrade !== 'all' ? filterGrade : undefined,
            status: filterStatus !== 'all' ? filterStatus : undefined,
            stream: filterStream !== 'all' ? filterStream : undefined
          };

          // Remove undefined values
          Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

          const response = await learnerAPI.getAll(params);
          if (response.success && response.data) {
            learnerIdsToDelete = response.data.map(learner => learner.id);
          }
        }

        await onBulkDelete(learnerIdsToDelete);
      } else {
        await Promise.all(selectedLearners.map(id => onDeleteLearner(id)));
      }
      setSelectedLearners([]);
      setSelectAllDatabase(false);
      refreshData();
    } catch (error) {
      console.error('Error deleting students:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── KPI card data derived from learnerStats ─────────────────────────────
  const kpiActive   = learnerStats?.active   ?? totalStudentsCount ?? pagination?.total ?? visibleStudentsCount;
  const kpiMale     = learnerStats?.byGender?.MALE   ?? 0;
  const kpiFemale   = learnerStats?.byGender?.FEMALE ?? 0;
  const kpiExited   = learnerStats?.byStatus?.EXITED ?? 0;
  const kpiTotal    = learnerStats?.total ?? kpiActive;

  // Solid card colors matching the dashboard palette
  const KPI_COLORS = {
    navy:    '#172554',
    teal:    '#0F766E',
    forest:  '#1B5E20',
    crimson: '#9F1239',
  };

  const KpiCard = ({ color, icon: Icon, label, value, sub }) => (
    <div
      className="relative overflow-hidden p-5 text-white select-none"
      style={{ backgroundColor: color }}
    >
      {/* watermark */}
      <div className="pointer-events-none absolute -bottom-4 -right-4 text-white/10">
        <Icon size={90} strokeWidth={1} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70 mb-3">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-4xl font-black tracking-tight leading-none text-white">{value ?? '—'}</p>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-white/20 border border-white/30">
          <Icon size={18} strokeWidth={2.2} className="text-white/90" />
        </span>
      </div>
      {sub && <p className="mt-1.5 text-sm font-semibold text-white/70">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard color={KPI_COLORS.navy}    icon={Users}     label="Total Enrolled"  value={kpiTotal}   sub="All students" />
        <KpiCard color={KPI_COLORS.teal}    icon={UserCheck} label="Active Students" value={kpiActive}  sub="Currently enrolled" />
        <KpiCard color={KPI_COLORS.forest}  icon={Mars}      label="Boys"            value={kpiMale}    sub={kpiTotal > 0 ? `${Math.round((kpiMale / kpiTotal) * 100)}% of enrolment` : null} />
        <KpiCard color={KPI_COLORS.crimson} icon={Venus}     label="Girls"           value={kpiFemale}  sub={kpiTotal > 0 ? `${Math.round((kpiFemale / kpiTotal) * 100)}% of enrolment` : null} />
      </div>
      {/* Compact Quick Actions Toolbar */}
      <div className="toolbar-card">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">

          <div className="flex flex-row gap-2 w-full xl:w-auto flex-1 items-center">
            {/* Search */}
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or admission number..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple text-sm text-gray-700 placeholder-gray-400"
              />
            </div>

            {/* Grade Filter Dropdown */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowGlobalFilters(!showGlobalFilters)}
                className={`h-11 px-4 border rounded-xl font-medium flex items-center gap-2 transition-all ${filterGrade !== 'all' ? 'bg-brand-purple/5 border-brand-purple text-brand-purple' : 'bg-white border-gray-200 text-gray-700 hover:border-brand-purple hover:text-brand-purple'}`}
                aria-label="Filter by grade"
              >
                <Filter size={16} className={filterGrade !== 'all' ? 'text-brand-purple' : 'text-gray-400'} />
                <span className="text-sm">
                  {filterGrade !== 'all' ? formatGradeLabel(filterGrade) : 'Grade'}
                </span>
                {filterGrade !== 'all' && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear grade filter"
                    onClick={(e) => { e.stopPropagation(); setFilterGrade('all'); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), setFilterGrade('all'))}
                    className="ml-0.5 text-brand-purple/50 hover:text-brand-purple"
                  >
                    <X size={13} />
                  </span>
                )}
              </button>

              {showGlobalFilters && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowGlobalFilters(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[160px] animate-fade-in origin-top-right">
                    <button
                      onClick={() => { setFilterGrade('all'); setShowGlobalFilters(false); }}
                      className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${filterGrade === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      All Grades
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    {gradeOptions.map(g => (
                      <button
                        key={g}
                        onClick={() => { setFilterGrade(g); setShowGlobalFilters(false); }}
                        className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${filterGrade === g ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        {formatGradeLabel(g)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons & Metrics */}
          <div className="flex gap-2 w-full xl:w-auto justify-end items-center mt-2 md:mt-0 border-t border-gray-100 md:border-0 pt-3 md:pt-0">
            {/* Metrics */}
            <div className="hidden lg:flex items-center gap-4 mr-2 border-r pr-4 border-gray-200 h-10">
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wider">Total Students</p>
                <p className="text-xl font-semibold text-gray-800 leading-none">
                  {totalStudentsCount ?? pagination?.total ?? visibleStudentsCount}
                </p>
              </div>
            </div>

            {canCreateLearner ? (
              <>
                {isMobile && (
                  <button
                    type="button"
                    onClick={onAddLearner}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-purple px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple/90 active:scale-[0.98]"
                  >
                    <Plus size={15} />
                    Add Student
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowQuickActions(!showQuickActions)}
                    className="p-2 bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition"
                    title="Quick Actions"
                  >
                    <MoreVertical size={20} />
                  </button>
                  {showQuickActions && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowQuickActions(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1">
                        <button
                          onClick={() => {
                            setShowQuickActions(false);
                            setShowBulkModal(true);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Upload size={16} />
                          Bulk Operations
                        </button>
                      </div>
                    </>
                  )}
                </div>

              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {(selectedLearners.length > 0 || selectAllDatabase) && (
        <div className="bg-brand-purple/5 border border-brand-purple/10 rounded-xl p-4 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            {selectAllDatabase ? (
              <>
                <span className="bg-brand-purple text-white text-sm font-medium px-3 py-1 rounded-full">
                  ALL
                </span>
                <span className="text-brand-purple font-medium">
                  All {pagination?.total || 0} Students Selected
                </span>
                <button
                  onClick={() => setSelectAllDatabase(false)}
                  className="text-xs font-medium text-brand-purple hover:bg-brand-purple/10 px-2 py-1 rounded transition"
                  title="Deselect all students"
                >
                  Deselect All
                </button>
              </>
            ) : (
              <>
                <span className="bg-brand-purple text-white text-sm font-medium px-3 py-1 rounded-full">
                  {selectedLearners.length}
                </span>
                <span className="text-brand-purple font-medium">Students Selected</span>
                {selectedLearners.length < (pagination?.total || displayLearners.length) && (
                  <button
                    onClick={() => setSelectAllDatabase(true)}
                    className="text-xs font-medium text-brand-purple hover:bg-brand-purple/10 px-2 py-1 rounded transition"
                    title={`Select all ${pagination?.total || 0} students in database`}
                  >
                    Select All {pagination?.total || 0}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedLearners([]);
                setSelectAllDatabase(false);
              }}
              className="px-4 py-2 text-brand-purple hover:bg-brand-purple/10 rounded-lg transition text-sm font-medium"
            >
              Cancel
            </button>
            {canCreateLearner && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-sm disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Trash2 size={18} />
                )}
                <span>Delete Selected</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Learners List/Table */}
      {loading && displayLearners.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-teal"></div>
        </div>
      ) : displayLearners.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Students Found"
          message={searchTerm || filterGrade !== 'all' || filterStatus !== 'all'
            ? "No students match your search criteria."
            : "No students have been added yet."}
          actionText={!searchTerm && filterGrade === 'all' && filterStatus === 'all' && canCreateLearner ? "Add Your First Student" : null}
          onAction={canCreateLearner ? onAddLearner : undefined}
        />
      ) : isMobile ? (
        // ******************** MOBILE CARDS VIEW ********************
        <div className="space-y-3 pb-8">
          {displayLearners.map(learner => (
            <div
              key={learner.id}
              onClick={() => onViewLearner(learner)}
              className={`bg-white p-4 rounded-xl shadow-sm border ${selectedLearners.includes(learner.id) ? 'border-brand-purple bg-brand-purple/5' : 'border-gray-100'} cursor-pointer active:scale-[0.99] transition-transform`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox (if needed for bulk on mobile) & Avatar */}
                <div onClick={(e) => e.stopPropagation()} className="pt-1">
                  <input
                    type="checkbox"
                    checked={selectedLearners.includes(learner.id)}
                    onChange={(e) => { e.stopPropagation(); handleSelectLearner(learner.id); }}
                    className="w-4 h-4 text-brand-teal border-gray-300 rounded focus:ring-brand-teal"
                  />
                </div>
                <div className="w-10 h-10 bg-brand-purple/10 text-brand-purple rounded-xl border border-brand-purple/20 flex-shrink-0 flex items-center justify-center font-medium text-base">
                  {learner.avatar && (learner.avatar.startsWith('http') || learner.avatar.startsWith('/') || learner.avatar.startsWith('data:image')) ? (
                    <img src={learner.avatar} alt="avatar" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    `${learner.firstName?.charAt(0) || ''}${learner.lastName?.charAt(0) || ''}`
                  )}
                </div>

                {/* Primary Student Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-medium text-gray-900 truncate">{learner.firstName} {learner.lastName}</h3>
                    <StatusBadge status={learner.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">{learner.admissionNumber}</span>
                    <span>•</span>
                    <span>{learner.grade.replace('GRADE_', 'G')} {learner.stream}</span>
                    <span>•</span>
                    <span>{learner.gender === 'MALE' ? 'M' : 'F'}</span>
                  </div>

                  {/* Guardian Info Compact */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                    {learner.primaryContactType && (
                      <span className="text-[10px] font-semibold text-gray-500 flex-shrink-0">
                        {getRelationshipLabel(learner.primaryContactType)}
                      </span>
                    )}
                    <span className="text-xs font-semibold truncate text-gray-700">
                      {learner.primaryContactName || learner.guardianName || (learner.parent ? `${learner.parent.firstName} ${learner.parent.lastName}` : '-')}
                    </span>
                    <div className="ml-auto flex gap-1">
                      {/* Contact Quick Actions on Mobile Card */}
                      {(learner.primaryContactPhone || learner.guardianPhone || (learner.parent && learner.parent.phone)) && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenQuickContact({
                                name: learner.primaryContactName || learner.guardianName || (learner.parent ? `${learner.parent.firstName} ${learner.parent.lastName}` : ''),
                                phone: learner.primaryContactPhone || learner.guardianPhone || (learner.parent ? learner.parent.phone : '')
                              });
                            }}
                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const phoneNumber = learner.primaryContactPhone || learner.guardianPhone || (learner.parent ? learner.parent.phone : '');
                              const formattedPhone = formatPhoneNumber(phoneNumber);
                              window.open(`https://wa.me/${formattedPhone.replace(/\D/g, '')}`, '_blank');
                            }}
                            className="p-1.5 bg-green-50 text-green-600 rounded-lg"
                          >
                            <MessageSquare size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions mobile */}
                  {(canEditLearner || canDeleteLearner) && (
                    <div className="flex gap-2 mt-3 justify-end items-center">
                      {canEditLearner && (isTeacher ? canTeacherModify(learner) : true) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditLearner(learner); }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                        >
                          Edit
                        </button>
                      )}

                      {canDeleteLearner && (isTeacher ? canTeacherModify(learner) : true) && (
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Delete this student?')) { handleIndividualDelete(learner.id); }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Mobile Pagination Controls */}
          {pagination && pagination.pages > 1 && (
            <div className="pt-4 flex justify-between items-center px-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm disabled:opacity-50"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="text-xs font-medium text-gray-500">
                Pg {pagination.page} of {pagination.pages}
              </div>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm disabled:opacity-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      ) : (
        // ******************** DESKTOP TABLE VIEW ********************
        <div className={`bg-white rounded-xl shadow-md overflow-hidden ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          <VirtualizedTable
            data={displayLearners}
            rowHeight={58} // Height of a single row matching design
            visibleHeight={600}
            header={
              <tr>
                <th className="px-3 py-1.5 w-4">
                  <input
                    type="checkbox"
                    checked={displayLearners.length > 0 && selectedLearners.length === displayLearners.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-brand-teal border-gray-300 rounded focus:ring-brand-teal"
                  />
                </th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Student</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Admission No</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Grade</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Parent</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase">Actions</th>
              </tr>
            }
            renderRow={(learner) => (
              <tr key={learner.id} onClick={() => onViewLearner(learner)} className={`hover:bg-gray-50 cursor-pointer transition ${selectedLearners.includes(learner.id) ? 'bg-brand-purple/5' : ''}`}>
                <td className="px-3 py-1.5 border-r border-gray-100">
                  <input
                    type="checkbox"
                    checked={selectedLearners.includes(learner.id)}
                    onChange={(e) => { e.stopPropagation(); handleSelectLearner(learner.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-brand-teal border-gray-300 rounded focus:ring-brand-teal"
                  />
                </td>
                <td className="px-3 py-1.5 border-r border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple flex justify-center items-center font-medium text-xs border border-brand-purple/20 flex-shrink-0">
                      {learner.avatar && (learner.avatar.startsWith('http') || learner.avatar.startsWith('/') || learner.avatar.startsWith('data:image')) ? (
                        <img src={learner.avatar} alt="avatar" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        `${learner.firstName?.charAt(0) || ''}${learner.lastName?.charAt(0) || ''}`
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{learner.firstName} {learner.lastName}</p>
                      <p className="text-xs text-gray-500">{learner.gender}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-1.5 border-r border-gray-100 text-gray-600">{learner.admissionNumber}</td>
                <td className="px-3 py-1.5 border-r border-gray-100 font-semibold">{learner.grade} {learner.stream}</td>
                <td className="px-3 py-1.5 border-r border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        {learner.primaryContactType && (
                          <span className="text-[10px] font-semibold text-gray-400 uppercase">{getRelationshipLabel(learner.primaryContactType)}:</span>
                        )}
                        <p className="text-sm font-semibold">{learner.primaryContactName || learner.guardianName || (learner.parent ? `${learner.parent.firstName} ${learner.parent.lastName}` : '-')}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">{learner.primaryContactPhone || learner.guardianPhone || (learner.parent ? learner.parent.phone : '-')}</p>
                        {(learner.primaryContactPhone || learner.guardianPhone || (learner.parent && learner.parent.phone)) && (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenQuickContact({
                                  name: learner.primaryContactName || learner.guardianName || (learner.parent ? `${learner.parent.firstName} ${learner.parent.lastName}` : ''),
                                  phone: learner.primaryContactPhone || learner.guardianPhone || (learner.parent ? learner.parent.phone : '')
                                });
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition"
                              title="Send SMS"
                            >
                              <MessageCircle size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const phoneNumber = learner.primaryContactPhone || learner.guardianPhone || (learner.parent ? learner.parent.phone : '');
                                const formattedPhone = formatPhoneNumber(phoneNumber);
                                window.open(`https://wa.me/${formattedPhone.replace(/\D/g, '')}`, '_blank');
                              }}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition"
                              title="Open WhatsApp"
                            >
                              <MessageSquare size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewLearner(learner); }}
                      className="p-1.5 text-brand-teal hover:bg-brand-teal/10 rounded-lg transition"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    {(canEditLearner || canDeleteLearner) && (
                      <>
                        {canEditLearner && (isTeacher ? canTeacherModify(learner) : true) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEditLearner(learner); }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canEditLearner && learner.status === 'Active' && (isTeacher ? canTeacherModify(learner) : true) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onMarkAsExited(learner.id); }}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                            title="Mark as Exited"
                          >
                            <LogOut size={16} />
                          </button>
                        )}
                        {canEditLearner && (isTeacher ? canTeacherModify(learner) : true) && (() => {
                          const isTransport = localTransportState[learner.id] ?? !!learner.isTransportStudent;
                          const isToggling = transportTogglingId === learner.id;
                          return (
                            <button
                              onClick={(e) => handleTransportToggle(e, learner)}
                              disabled={isToggling}
                              className={`p-1.5 rounded-lg transition disabled:opacity-50 ${
                                isTransport
                                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                              }`}
                              title={isTransport ? 'Transport student — click to remove' : 'Mark as transport student'}
                            >
                              {isToggling
                                ? <Loader2 size={16} className="animate-spin" />
                                : <Bus size={16} />
                              }
                            </button>
                          );
                        })()}
                        {canDeleteLearner && (isTeacher ? canTeacherModify(learner) : true) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleIndividualDelete(learner.id); }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          />

          {/* Desktop Pagination Controls */}
          {pagination && pagination.pages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} students
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium text-brand-purple"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <div className="flex items-center px-2 text-sm font-medium text-gray-700">
                  Page {pagination.page} of {pagination.pages}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium text-brand-purple"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Contact Modal */}
      {showQuickContact && selectedGuardian && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-brand-purple/10 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Quick Message</h3>
                <p className="text-sm text-gray-500 font-medium mt-1">{selectedGuardian.name}</p>
              </div>
              <button
                onClick={() => setShowQuickContact(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Contact Type Tabs */}
              <div className="flex gap-2 border-b border-gray-200">
                <button
                  onClick={() => setContactType('sms')}
                  className={`flex items-center gap-2 px-4 py-2 pb-3 font-semibold border-b-2 transition ${contactType === 'sms'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <MessageCircle size={16} />
                  SMS
                </button>
                <button
                  onClick={() => setContactType('whatsapp')}
                  className={`flex items-center gap-2 px-4 py-2 pb-3 font-semibold border-b-2 transition ${contactType === 'whatsapp'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <MessageSquare size={16} />
                  WhatsApp
                </button>
              </div>

              {/* Phone Display */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">To:</p>
                <p className="text-sm font-medium text-gray-800">{selectedGuardian.phone}</p>
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Message</label>
                <textarea
                  value={quickMessage}
                  onChange={(e) => setQuickMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent text-sm font-medium resize-none"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">{quickMessage.length} characters</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-2 justify-end">
              <button
                onClick={() => setShowQuickContact(false)}
                className="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendQuickMessage}
                disabled={isSendingSMS || !quickMessage.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSendingSMS ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Operations Modal */}
      <BulkOperationsModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Student Operations"
        entityType="learners"
        onUploadComplete={() => {
          setShowBulkModal(false);
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};

export default LearnersList;

