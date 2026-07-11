/**
 * Academic Settings Page
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Save, BookOpen, Plus, Edit, Trash2, Users, Loader, X, UserPlus, Layers, Gauge, Hash } from 'lucide-react';
import ModuleTabNav from '../../shared/ModuleTabNav';
import { toast } from 'react-hot-toast';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../../../hooks/useAuth';
import { configAPI, authAPI, schoolAPI, userAPI, default as api } from '../../../../services/api';
import academicYearConfig from '../../utils/academicYear';
import { toInputDate } from '../../utils/dateHelpers';
import { gradeStructure } from '../../data/gradeStructure';
import { useSchoolData } from '../../../../contexts/SchoolDataContext';
import { refreshBus } from '../../../../utils/refreshBus';
import HierarchicalLearningAreas from './HierarchicalLearningAreas';
import SubjectAllocationPage from './SubjectAllocationPage';
import PerformanceLevelManager from './PerformanceLevelManager';
import Toast from '../../shared/Toast';

const AcademicSettings = () => {
  const { grades: dynamicGrades } = useSchoolData();
  const {
    showSuccess,
    showError,
    showToast,
    toastMessage,
    toastType,
    hideNotification
  } = useNotifications();
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize tab from URL params or localStorage, default to 'terms'
  const [activeTab, setActiveTabState] = useState(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab) return urlTab;
    return localStorage.getItem('cbc_academic_settings_tab') || 'terms';
  });

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
    localStorage.setItem('cbc_academic_settings_tab', tab);
  };

  // Sync state if URL changes (e.g. browser back button)
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTabState(urlTab);
    }
  }, [searchParams]);

  // Helper function to show success notifications with both toast and hook
  const notifySuccess = (message) => {
    toast.success(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#10b981',
        color: '#fff',
        fontWeight: '600',
        fontSize: '14px',
        padding: '16px',
        borderRadius: '8px'
      }
    });
    showSuccess(message);
  };

  const [termConfigs, setTermConfigs] = useState([]);
  const [streamConfigs, setStreamConfigs] = useState([]);
  const [classConfigs, setClassConfigs] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load Configs
  const loadConfigs = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoading(true);
      // School ID removed for single-tenant mode
      const [terms, streams, classes, teachersList] = await Promise.all([
        configAPI.getTermConfigs(),
        configAPI.getStreamConfigs(),
        configAPI.getClasses(),
        userAPI.getAll()
      ]);
      const termsArr = Array.isArray(terms) ? terms : (terms && terms.data) ? terms.data : [];
      const streamsArr = Array.isArray(streams) ? streams : (streams && streams.data) ? streams.data : [];
      const classesArr = Array.isArray(classes) ? classes : (classes && classes.data) ? classes.data : [];
      const teachersArr = Array.isArray(teachersList) ? teachersList : (teachersList && teachersList.data) ? teachersList.data : [];
      setTermConfigs(termsArr);
      setStreamConfigs(streamsArr || []);
      setClassConfigs(classesArr || []);
      setTeachers(teachersArr.filter(t => t.role === 'TEACHER' || t.role === 'HEAD_TEACHER') || []);
    } catch (error) {
      console.error('Failed to load configs:', error);
      showError('Failed to load settings. Check network and authentication.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Learning Areas from Database — single-tenant, no schoolId needed
  const loadLearningAreas = React.useCallback(async () => {
    try {
      const areas = await configAPI.getLearningAreas();
      const areasArr = Array.isArray(areas) ? areas : (areas && areas.data) ? areas.data : [];
      setLearningAreas(areasArr);
    } catch (error) {
      console.error('Failed to load learning areas:', error);
      setLearningAreas([]);
    }
  }, []);

  // Seed Learning Areas
  const handleSeedLearningAreas = React.useCallback(async () => {
    try {
      setSeedingLearningAreas(true);
      setSubmitting(true);
      setSelectedLearningAreas([]);
      const result = await configAPI.seedLearningAreas();

      // Show success with toast AND notification
      toast.success(`📚 Learning areas seeded! Created: ${result.created || 0}, Skipped: ${result.skipped || 0}`, {
        duration: 4000,
        position: 'top-right',
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: '600',
          fontSize: '14px',
          padding: '16px',
          borderRadius: '8px'
        }
      });

      await loadLearningAreas();
      refreshBus.emit('learning-areas');
    } catch (error) {
      console.error('Error seeding learning areas:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to seed learning areas';
      toast.error(`❌ ${errorMsg}`, {
        duration: 5000,
        position: 'top-right',
        style: { background: '#ef4444', color: '#fff', fontWeight: '600', fontSize: '14px', padding: '16px', borderRadius: '8px' }
      });
    } finally {
      setSeedingLearningAreas(false);
      setSubmitting(false);
    }
  }, [loadLearningAreas]);

  // Seed Classes — single-tenant, no schoolId needed
  const handleSeedClasses = React.useCallback(async () => {
    try {
      setSeedingClasses(true);
      setSubmitting(true);
      const result = await configAPI.seedClasses();
      const isSS = user?.institutionType === 'SECONDARY';
      notifySuccess(
        isSS
          ? `✏️ SS Classes (Grade 10–12) seeded! Created: ${result.created || 0}, Skipped: ${result.skipped || 0}`
          : `✏️ Classes seeded! Created: ${result.created || 0}, Skipped: ${result.skipped || 0}`
      );
      await loadConfigs();
      refreshBus.emit('classes');
    } catch (error) {
      console.error('Error seeding classes:', error);
      showError(error?.message || 'Failed to seed classes');
    } finally {
      setSeedingClasses(false);
      setSubmitting(false);
    }
  }, [loadConfigs, showSuccess, showError]);

  // Seed Streams — single-tenant, no schoolId needed
  const handleSeedStreams = React.useCallback(async () => {
    try {
      setSeedingStreams(true);
      setSubmitting(true);
      const result = await configAPI.seedStreams();
      notifySuccess(`🌊 Streams seeded! Created: ${result.created || 0}, Skipped: ${result.skipped || 0}`);
      await loadConfigs();
      refreshBus.emit('streams');
    } catch (error) {
      console.error('Error seeding streams:', error);
      showError(error?.message || 'Failed to seed streams');
    } finally {
      setSeedingStreams(false);
      setSubmitting(false);
    }
  }, [loadConfigs, showSuccess, showError]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    if (activeTab === 'streams' || activeTab === 'classes') {
      loadConfigs();
    }
  }, [activeTab, loadConfigs]);

  useEffect(() => {
    if (activeTab === 'learning-areas') {
      loadLearningAreas();
    }
  }, [activeTab, loadLearningAreas]);

  // State for manual academic year input if no terms exist
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Initialize learning areas from database
  const [learningAreas, setLearningAreas] = useState([]);
  const [selectedLearningAreas, setSelectedLearningAreas] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false); // Stream Modal
  const [showClassModal, setShowClassModal] = useState(false); // Class Modal
  const [editingArea, setEditingArea] = useState(null);
  const [editingStream, setEditingStream] = useState(null); // Stream Edit
  const [editingClass, setEditingClass] = useState(null); // Class Edit

  // Seeding states
  const [seedingLearningAreas, setSeedingLearningAreas] = useState(false);
  const [seedingClasses, setSeedingClasses] = useState(false);
  const [seedingStreams, setSeedingStreams] = useState(false);
  const [deletingLearningAreas, setDeletingLearningAreas] = useState(false);
  const [admissionSettings, setAdmissionSettings] = useState({
    mode: 'AUTO',
    formatType: 'ALPHANUMERIC',
    pattern: 'ADM-{YEAR}-{SEQ}',
    sequenceWidth: 4,
    startingNumber: 1000,
    resetRule: 'YEARLY',
    lockAfterFirstAdmission: true
  });
  const [admissionPreview, setAdmissionPreview] = useState('');
  const [admissionSequenceValue, setAdmissionSequenceValue] = useState(0);
  const [admissionBusy, setAdmissionBusy] = useState(false);

  useEffect(() => {
    const currentIds = new Set((learningAreas || []).map((area) => area.id));
    setSelectedLearningAreas((prev) => prev.filter((id) => currentIds.has(id)));
  }, [learningAreas]);

  useEffect(() => {
    const loadAdmissionControls = async () => {
      try {
        const local = localStorage.getItem('admission-numbering-settings');
        if (local) {
          const parsed = JSON.parse(local);
          setAdmissionSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        console.warn('Failed to read local admission settings', e);
      }

      try {
        const school = await schoolAPI.getAll();
        if (school?.data) {
          setAdmissionSettings((prev) => ({
            ...prev,
            mode: school.data.admissionNumberMode || prev.mode,
            pattern: school.data.admissionPattern || prev.pattern,
            sequenceWidth: Number(school.data.admissionSequenceWidth || prev.sequenceWidth),
            startingNumber: Number(school.data.admissionStartNumber || prev.startingNumber),
            resetRule: school.data.admissionResetRule || prev.resetRule,
            lockAfterFirstAdmission:
              typeof school.data.admissionNumberingLocked === 'boolean'
                ? school.data.admissionNumberingLocked
                : prev.lockAfterFirstAdmission
          }));
        }
      } catch (e) {
        console.warn('Failed to load school admission settings', e);
      }
    };
    loadAdmissionControls();
  }, []);

  useEffect(() => {
    if (activeTab !== 'admissions-numbering') return;
    const fetchAdmissionMeta = async () => {
      try {
        const [previewRes, seqRes] = await Promise.all([
          schoolAPI.getAdmissionNumberPreview(selectedYear),
          api.get(`/schools/admission-sequence/${selectedYear}`)
        ]);
        setAdmissionPreview(previewRes?.data?.preview || '');
        setAdmissionSequenceValue(seqRes?.data?.currentValue || 0);
      } catch (e) {
        console.warn('Failed to load admission numbering meta', e);
      }
    };
    fetchAdmissionMeta();
  }, [activeTab, selectedYear]);

  const handleSaveAdmissionControls = async () => {
    try {
      setAdmissionBusy(true);
      localStorage.setItem('admission-numbering-settings', JSON.stringify(admissionSettings));
      await api.put('/schools', {
        admissionNumberMode: admissionSettings.mode,
        admissionPattern: admissionSettings.pattern,
        admissionSequenceWidth: Number(admissionSettings.sequenceWidth),
        admissionStartNumber: Number(admissionSettings.startingNumber),
        admissionResetRule: admissionSettings.resetRule,
        admissionNumberingLocked: !!admissionSettings.lockAfterFirstAdmission
      });
      notifySuccess('Admissions numbering controls saved.');
    } catch (e) {
      showError('Failed to save admissions numbering controls');
    } finally {
      setAdmissionBusy(false);
    }
  };

  const handleResetAdmissionSequence = async () => {
    if (!window.confirm(`Reset admission sequence for ${selectedYear}?`)) return;
    try {
      setAdmissionBusy(true);
      await api.post('/schools/reset-sequence', { academicYear: selectedYear });
      notifySuccess(`Admission sequence reset for ${selectedYear}.`);
      const [previewRes, seqRes] = await Promise.all([
        schoolAPI.getAdmissionNumberPreview(selectedYear),
        api.get(`/schools/admission-sequence/${selectedYear}`)
      ]);
      setAdmissionPreview(previewRes?.data?.preview || '');
      setAdmissionSequenceValue(seqRes?.data?.currentValue || 0);
    } catch (e) {
      showError('Failed to reset admission sequence');
    } finally {
      setAdmissionBusy(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    gradeLevel: dynamicGrades.length > 0 ? dynamicGrades[0] : 'GRADE_1',
    color: '#3b82f6',
    icon: '📚',
    description: ''
  });



  const [streamFormData, setStreamFormData] = useState({
    name: '',
    active: true
  });

  const [classFormData, setClassFormData] = useState({
    name: '',
    grade: '',
    stream: '',
    teacherId: '',
    capacity: '40',
    room: '',
    academicYear: new Date().getFullYear(),
    term: 'TERM_1',
    active: true
  });

  // Local draft state for term edits — keyed by "YEAR-TERM"
  const [termDrafts, setTermDrafts] = useState({});

  // Get draft for a given year+term, falling back to the saved config
  const getTermDraft = (termName) => {
    const key = `${selectedYear}-${termName}`;
    if (termDrafts[key]) return termDrafts[key];
    return termConfigs.find(c => c.academicYear === selectedYear && c.term === termName) || {
      academicYear: selectedYear,
      term: termName,
      startDate: '',
      endDate: '',
      formativeWeight: 30,
      summativeWeight: 70,
      isActive: false
    };
  };

  const updateTermDraft = (termName, changes) => {
    const key = `${selectedYear}-${termName}`;
    setTermDrafts(prev => ({
      ...prev,
      [key]: { ...getTermDraft(termName), ...changes }
    }));
  };

  // Determine active term for the selected year, preferring unsaved local edits first.
  const getEffectiveActiveTerm = () => {
    const terms = ['TERM_1', 'TERM_2', 'TERM_3'];

    for (const termName of terms) {
      const key = `${selectedYear}-${termName}`;
      if (termDrafts[key] && termDrafts[key].isActive) return termName;
    }

    const savedActive = termConfigs.find((c) => c.academicYear === selectedYear && c.isActive);
    return savedActive?.term || null;
  };

  // Single-active-term behavior: selecting one term marks it active and others inactive.
  const handleSelectActiveTerm = (termName) => {
    const terms = ['TERM_1', 'TERM_2', 'TERM_3'];
    setTermDrafts((prev) => {
      const next = { ...prev };
      terms.forEach((name) => {
        const key = `${selectedYear}-${name}`;
        next[key] = {
          ...getTermDraft(name),
          isActive: name === termName
        };
      });
      return next;
    });
  };

  const handleSaveTerm = async (termName) => {
    const draft = getTermDraft(termName);
    // Validate weights
    const fw = Number(draft.formativeWeight ?? 30);
    const sw = Number(draft.summativeWeight ?? 70);
    if (Math.abs(fw + sw - 100) > 0.01) {
      showError(`Weights must sum to 100%. Current: ${fw + sw}%`);
      return;
    }
    try {
      setSubmitting(true);
      await configAPI.upsertTermConfig({
        ...draft,
        academicYear: selectedYear,
        term: termName,
        formativeWeight: fw,
        summativeWeight: sw,
      });
      // Clear draft so it re-reads from server
      setTermDrafts(prev => {
        const next = { ...prev };
        delete next[`${selectedYear}-${termName}`];
        return next;
      });
      notifySuccess(`Term ${termName.replace('_', ' ')} saved!`);
      await loadConfigs();
      refreshBus.emit('term-config');
    } catch (error) {
      showError(error.message || 'Failed to save term configuration');
    } finally {
      setSubmitting(false);
    }
  };



  const handleSaveStream = async () => {
    if (!streamFormData.name || !streamFormData.name.trim()) {
      showError('Stream name is required');
      return;
    }
    const isDuplicate = streamConfigs.some((s) =>
      (s.name || '').toLowerCase() === streamFormData.name.trim().toLowerCase() &&
      (!editingStream || s.id !== editingStream.id)
    );
    if (isDuplicate) {
      showError('Stream name already exists');
      return;
    }

    // Unified single-tenant mode
    try {
      setSubmitting(true);
      // removed debug log

      const payload = {
        ...streamFormData
      };

      if (editingStream) {
        await configAPI.upsertStreamConfig({ ...payload, id: editingStream.id });
        showSuccess('Stream updated successfully');
      } else {
        await configAPI.upsertStreamConfig(payload);
        showSuccess('Stream added successfully');
      }

      setShowStreamModal(false);
      setEditingStream(null);
      setStreamFormData({ name: '', active: true });
      await loadConfigs();
      refreshBus.emit('streams');
    } catch (error) {
      console.error('Error saving stream:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });

      if (error.message && error.message.includes('already exists')) {
        showError('Stream name already exists');
      } else if (error.message && error.message.includes('Unauthorized')) {
        showError('Session expired. Please log in again.');
      } else {
        showError(error.message || 'Failed to save stream. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };



  const handleDeleteStream = async (id) => {
    if (!window.confirm('Are you sure you want to delete this stream?')) return;
    try {
      await configAPI.deleteStreamConfig(id);
      setStreamConfigs(prev => prev.filter(s => s.id !== id));
      showSuccess('Stream deleted');
      refreshBus.emit('streams');
    } catch (error) {
      showError(error.message || 'Failed to delete stream');
    }
  };



  const openStreamModal = (stream = null) => {
    if (stream) {
      setEditingStream(stream);
      setStreamFormData({ name: stream.name, active: stream.active !== false });
    } else {
      setEditingStream(null);
      setStreamFormData({ name: '', active: true });
    }
    setShowStreamModal(true);
  };

  const openClassModal = (classItem = null) => {
    if (classItem) {
      setEditingClass(classItem);
      setClassFormData({
        name: classItem.name || '',
        grade: classItem.grade || '',
        stream: classItem.stream || '',
        teacherId: classItem.teacherId || '',
        capacity: classItem.capacity != null ? String(classItem.capacity) : '40',
        room: classItem.room || '',
        academicYear: classItem.academicYear || new Date().getFullYear(),
        term: classItem.term || 'TERM_1',
        active: classItem.active !== undefined ? classItem.active : true
      });
    } else {
      setEditingClass(null);
      setClassFormData({
        name: '',
        grade: '',
        stream: '',
        teacherId: '',
        capacity: '40',
        room: '',
        academicYear: new Date().getFullYear(),
        term: 'TERM_1',
        active: true
      });
    }
    setShowClassModal(true);
    // Reset check state
    setTeacherConflictWarning(null);
  };

  const [teacherConflictWarning, setTeacherConflictWarning] = useState(null);

  // Check for teacher conflicts when teacher is selected in Class Modal
  const checkTeacherConflict = async (teacherId) => {
    setTeacherConflictWarning(null);
    if (!teacherId) return;

    try {
      const response = await api.classes.getTeacherWorkload(teacherId, {
        academicYear: classFormData.academicYear,
        term: classFormData.term
      });

      if (response.success && response.data?.classes?.length > 0) {
        const otherClasses = response.data.classes.filter(c => c.id !== editingClass?.id);
        if (otherClasses.length > 0) {
          const classNames = otherClasses.map(c => c.name).join(', ');
          setTeacherConflictWarning(
            `${teachers.find(t => t.id === teacherId)?.firstName} is already assigned to ${otherClasses.length} other class(es): ${classNames}.`
          );
        }
      }
    } catch (err) {
      console.error("Failed to check teacher workload", err);
    }
  };

  const handleSaveClass = async () => {
    if (!classFormData.name || !classFormData.grade) {
      showError('Class name and grade are required');
      return;
    }

    const capacityValue = classFormData.capacity === '' ? 40 : Number(classFormData.capacity);
    if (!Number.isFinite(capacityValue) || capacityValue <= 0) {
      showError('Capacity must be a positive number');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...classFormData,
        capacity: Math.trunc(capacityValue)
      };

      if (editingClass) {
        await configAPI.upsertClass({ ...payload, id: editingClass.id });
        notifySuccess('✏️ Class updated successfully');
      } else {
        await configAPI.upsertClass(payload);
        notifySuccess('✨ Class created successfully');
      }

      setShowClassModal(false);
      setEditingClass(null);
      setClassFormData({ name: '', grade: '', stream: '', teacherId: '', capacity: '40', room: '', academicYear: new Date().getFullYear(), term: 'TERM_1', active: true });
      await loadConfigs();
      refreshBus.emit('classes');
    } catch (error) {
      console.error('Error saving class:', error);
      // Show the actual error message from the server if available
      showError(error.message || 'Failed to save class. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClass = async (id) => {
    if (!window.confirm('Are you sure you want to delete this class?')) return;
    try {
      await configAPI.deleteClass(id);
      setClassConfigs(prev => prev.filter(c => c.id !== id));
      notifySuccess('🗑️ Class deleted successfully');
      refreshBus.emit('classes');
    } catch (error) {
      showError(error.message || 'Failed to delete class');
    }
  };

  const handleAddEdit = async () => {
    if (!formData.name || !formData.shortName) {
      showError('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      if (editingArea) {
        await configAPI.updateLearningArea(editingArea.id, formData);
        notifySuccess('✏️ Learning area updated successfully');
      } else {
        await configAPI.createLearningArea({
          ...formData
        });
        notifySuccess('✨ Learning area created successfully');
      }

      setShowAddModal(false);
      setEditingArea(null);
      setFormData({ name: '', shortName: '', gradeLevel: dynamicGrades.length > 0 ? dynamicGrades[0] : 'GRADE_1', color: '#3b82f6', icon: '📚', description: '' });
      await loadLearningAreas();
      refreshBus.emit('learning-areas');
    } catch (error) {
      console.error('Error saving learning area:', error);
      showError(error.message || 'Failed to save learning area');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteArea = async (area) => {
    if (!window.confirm(`Are you sure you want to delete "${area.name}"? This action cannot be undone.`)) return;

    try {
      await configAPI.deleteLearningArea(area.id);
      setLearningAreas(prev => prev.filter(a => a.id !== area.id));
      setSelectedLearningAreas(prev => prev.filter(id => id !== area.id));
      notifySuccess('🗑️ Learning area deleted');
    } catch (error) {
      console.error('Error deleting learning area:', error);
      showError('Failed to delete learning area');
    }
  };

  const handleBulkDeleteLearningAreas = async () => {
    const currentIds = new Set((learningAreas || []).map((area) => area.id));
    const selectedIds = selectedLearningAreas.filter((id) => currentIds.has(id));
    if (selectedIds.length === 0) {
      setSelectedLearningAreas([]);
      return;
    }

    const selectedCount = selectedIds.length;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedCount} learning area(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingLearningAreas(true);

      const deleteResults = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            await configAPI.deleteLearningArea(id);
            return { id, deleted: true, alreadyMissing: false };
          } catch (error) {
            const message = (error?.message || '').toLowerCase();
            const isAlreadyMissing = message.includes('not found') || message.includes('404');

            if (isAlreadyMissing) {
              return { id, deleted: true, alreadyMissing: true };
            }

            return { id, deleted: false, alreadyMissing: false };
          }
        })
      );

      const deletedCount = deleteResults.filter(r => r.deleted).length;
      const failedCount = deleteResults.filter(r => !r.deleted).length;
      const alreadyMissingCount = deleteResults.filter(r => r.alreadyMissing).length;

      if (deletedCount > 0) {
        setLearningAreas(prev => prev.filter(a => !selectedIds.includes(a.id)));
      }

      setSelectedLearningAreas([]);

      if (failedCount === 0) {
        if (alreadyMissingCount > 0) {
          notifySuccess(`🗑️ Cleared ${deletedCount} learning area(s) (${alreadyMissingCount} were already removed)`);
        } else {
          notifySuccess(`🗑️ Deleted ${deletedCount} learning area(s)`);
        }
      } else {
        showError(`Deleted ${deletedCount}, but ${failedCount} failed. Please retry.`);
      }

      await loadLearningAreas();
    } catch (error) {
      console.error('Error bulk deleting learning areas:', error);
      showError('Failed to bulk delete learning areas');
    } finally {
      setDeletingLearningAreas(false);
    }
  };

  const handleOpenModal = (area = null) => {
    if (area) {
      setEditingArea(area);
      setFormData({
        name: area.name || '',
        shortName: area.shortName || '',
        gradeLevel: area.gradeLevel || (dynamicGrades.length > 0 ? dynamicGrades[0] : 'GRADE_1'),
        color: area.color || '#3b82f6',
        icon: area.icon || '📚',
        description: area.description || ''
      });
    } else {
      setEditingArea(null);
      setFormData({
        name: '',
        shortName: '',
        gradeLevel: dynamicGrades.length > 0 ? dynamicGrades[0] : 'GRADE_1',
        color: '#3b82f6',
        icon: '📚',
        description: ''
      });
    }
    setShowAddModal(true);
  };

  const ACADEMIC_TABS = [
    { id: 'terms',                label: 'Academic Year & Terms', icon: <Calendar size={13} /> },
    { id: 'learning-areas',       label: 'Learning Areas',         icon: <BookOpen size={13} /> },
    { id: 'classes',              label: 'Classes',                icon: <Users size={13} /> },
    { id: 'allocation',           label: 'Subject Allocation',     icon: <UserPlus size={13} /> },
    { id: 'streams',              label: 'Streams',                icon: <Users size={13} /> },
    { id: 'performance-levels',   label: 'Performance Levels',     icon: <Gauge size={13} /> },
    { id: 'admissions-numbering', label: 'Admissions Numbering',   icon: <Hash size={13} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <ModuleTabNav
        sectionLabel="ACADEMICS"
        tabs={ACADEMIC_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      {activeTab === 'terms' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Academic Year</h3>
              <div className="max-w-md">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {academicYearConfig.getAcademicYearOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Term Configuration</h3>
              {loading ? <p>Loading settings...</p> : (
                <div className="space-y-6">
                  {['TERM_1', 'TERM_2', 'TERM_3'].map((termName, index) => {
                    const draft = getTermDraft(termName);
                    const effectiveActiveTerm = getEffectiveActiveTerm();
                    const isSelectedActive = effectiveActiveTerm === termName;
                    const draftKey = `${selectedYear}-${termName}`;
                    const isDirty = !!termDrafts[draftKey];
                    const fw = Number(draft.formativeWeight ?? 30);
                    const sw = Number(draft.summativeWeight ?? 70);
                    const weightSum = fw + sw;
                    const weightError = Math.abs(weightSum - 100) > 0.01;

                    return (
                      <div key={termName} className={`border rounded-lg p-4 ${isSelectedActive ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-gray-800">Term {index + 1}</h4>
                            {isDirty && (
                              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Unsaved changes</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelectedActive}
                                disabled={submitting}
                                onChange={() => handleSelectActiveTerm(termName)}
                                className="w-4 h-4 text-blue-600 disabled:opacity-50"
                              />
                              <span className="text-sm font-medium">Active Term</span>
                            </label>
                            <button
                              onClick={() => handleSaveTerm(termName)}
                              disabled={submitting || (!isDirty)}
                              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                                isDirty && !submitting
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <Save size={14} />
                              {submitting ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                            <input
                              type="date"
                              value={toInputDate(draft.startDate)}
                              disabled={submitting}
                              onChange={(e) => updateTermDraft(termName, { startDate: e.target.value })}
                              className="w-full px-3 py-2 border rounded text-sm disabled:bg-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                            <input
                              type="date"
                              value={toInputDate(draft.endDate)}
                              disabled={submitting}
                              onChange={(e) => updateTermDraft(termName, { endDate: e.target.value })}
                              className="w-full px-3 py-2 border rounded text-sm disabled:bg-gray-100"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-white p-3 rounded border border-gray-100">
                          <div>
                            <label className="block text-xs font-medium text-blue-700 mb-1">Formative Weight (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={fw}
                              disabled={submitting}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateTermDraft(termName, { formativeWeight: val, summativeWeight: 100 - val });
                              }}
                              className="w-full px-3 py-2 border border-blue-100 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Weight for continuous assessments</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-indigo-700 mb-1">Summative Weight (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={sw}
                              disabled={submitting}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateTermDraft(termName, { summativeWeight: val, formativeWeight: 100 - val });
                              }}
                              className="w-full px-3 py-2 border border-indigo-100 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Weight for end of term exams</p>
                          </div>
                          {weightError && (
                            <div className="col-span-2 text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded px-3 py-2">
                              ⚠️ Weights must sum to 100%. Current total: {weightSum}%
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Learning Areas Tab */}
      {activeTab === 'learning-areas' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium">Manage Learning Areas & Strands</h3>
              <p className="text-sm text-gray-600 mt-1">Organized by grade level with curriculum strands</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSeedLearningAreas}
                disabled={seedingLearningAreas || deletingLearningAreas}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-semibold ${seedingLearningAreas
                  ? 'bg-gray-400 text-white cursor-not-allowed opacity-75'
                  : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                title="Seed default learning areas for all grades"
              >
                {seedingLearningAreas ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>Seeding...</span>
                  </>
                ) : (
                  <>
                    <span>🌱</span>
                    <span>Seed Areas</span>
                  </>
                )}
              </button>

              {selectedLearningAreas.length > 0 && (
                <button
                  onClick={handleBulkDeleteLearningAreas}
                  disabled={deletingLearningAreas || seedingLearningAreas}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-semibold ${deletingLearningAreas
                    ? 'bg-gray-400 text-white cursor-not-allowed opacity-75'
                    : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  title="Delete selected learning areas"
                >
                  {deletingLearningAreas ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Delete ({selectedLearningAreas.length})</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => handleOpenModal()}
                disabled={deletingLearningAreas}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <Plus size={18} />
                Add Learning Area
              </button>
            </div>
          </div>

          {learningAreas.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600">No learning areas added yet</p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Add Your First Learning Area
              </button>
            </div>
          ) : (
            <HierarchicalLearningAreas
              learningAreas={learningAreas}
              gradeStructure={gradeStructure}
              onEdit={(area) => handleOpenModal(area)}
              onDelete={handleDeleteArea}
              selectedAreas={selectedLearningAreas}
              onSelectionChange={setSelectedLearningAreas}
              onAddStrand={(area, strand) => {
                // Placeholder for future strand assessment creation
                console.log(`Add strand assessment for ${area.name} - ${strand}`);
              }}
            />
          )}
        </div>
      )}

      {/* Subject Allocation Tab */}
      {activeTab === 'allocation' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <SubjectAllocationPage />
        </div>
      )}


      {/* Classes Tab */}
      {activeTab === 'classes' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium">Manage Classes</h3>
            <div className="flex gap-2">
              <button
                onClick={handleSeedClasses}
                disabled={seedingClasses}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                title="Seed default classes for all grades"
              >
                {seedingClasses ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    <span>Seeding...</span>
                  </>
                ) : (
                  <>
                    <span>🌱</span>
                    <span>Seed Classes</span>
                  </>
                )}
              </button>
              <button
                onClick={() => openClassModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <Plus size={18} />
                Add Class
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-4 font-semibold text-gray-600">Class Name</th>
                  <th className="p-4 font-semibold text-gray-600">Grade</th>
                  <th className="p-4 font-semibold text-gray-600">Stream</th>
                  <th className="p-4 font-semibold text-gray-600">Teacher</th>
                  <th className="p-4 font-semibold text-gray-600">Enrolled</th>
                  <th className="p-4 font-semibold text-gray-600">Status</th>
                  <th className="p-4 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classConfigs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500">No classes defined.</td>
                  </tr>
                ) : (
                  classConfigs.map(classItem => {
                    const teacher = teachers.find(t => t.id === classItem.teacherId);
                    const enrolled = classItem._count?.enrollments || 0;
                    const capacity = Number(classItem.capacity) || 0;
                    const pct = capacity > 0 ? Math.min(Math.round((enrolled / capacity) * 100), 100) : 0;
                    const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500';
                    return (
                      <tr key={classItem.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium">{classItem.name}</td>
                        <td className="p-4">{classItem.grade}</td>
                        <td className="p-4">{classItem.stream || '-'}</td>
                        <td className="p-4 text-sm">{teacher ? `${teacher.firstName} ${teacher.lastName}` : '-'}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800 w-14 shrink-0">{enrolled}/{capacity || '-'}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden min-w-[60px]">
                              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${classItem.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {classItem.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button onClick={() => openClassModal(classItem)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                            <button onClick={() => handleDeleteClass(classItem.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Streams Tab */}
      {activeTab === 'streams' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium">Manage Streams</h3>
            </div>
            <div className="flex gap-2">
              {/* Hiding seeding buttons for now
               <button
                onClick={handleSeedStreams}
                disabled={seedingStreams}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                title="Seed default streams (A, B, C, D)"
              >
                {seedingStreams ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    <span>Seeding...</span>
                  </>
                ) : (
                  <>
                    <span>🌱</span>
                    <span>Seed Streams</span>
                  </>
                )}
              </button>
              */}
              <button
                onClick={() => openStreamModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <Plus size={18} />
                Add Stream
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-4 font-semibold text-gray-600">Stream Name</th>
                  <th className="p-4 font-semibold text-gray-600">Status</th>
                  <th className="p-4 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {streamConfigs.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-gray-500">No streams defined.</td>
                  </tr>
                ) : (
                  streamConfigs.map(stream => (
                    <tr key={stream.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium">{stream.name}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${stream.active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {stream.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button onClick={() => openStreamModal(stream)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                          <button onClick={() => handleDeleteStream(stream.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance Levels Tab */}
      {activeTab === 'performance-levels' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <PerformanceLevelManager />
        </div>
      )}

      {activeTab === 'admissions-numbering' && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium">Admissions Numbering Controls</h3>
              <p className="text-sm text-gray-600 mt-1">Configure how admission numbers are generated for new learners.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Current Year: <span className="font-semibold">{selectedYear}</span></p>
              <p className="text-xs text-gray-500">Current Sequence: <span className="font-semibold">{admissionSequenceValue}</span></p>
              <p className="text-xs text-gray-500">Next Preview: <span className="font-semibold">{admissionPreview || '—'}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mode</label>
              <select
                value={admissionSettings.mode}
                onChange={(e) => setAdmissionSettings((p) => ({ ...p, mode: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="AUTO">Auto-generate</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Format Type</label>
              <select
                value={admissionSettings.formatType}
                onChange={(e) => setAdmissionSettings((p) => ({ ...p, formatType: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="NUMERIC">Numeric only</option>
                <option value="ALPHANUMERIC">Alphanumeric pattern</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Pattern</label>
              <input
                type="text"
                value={admissionSettings.pattern}
                onChange={(e) => setAdmissionSettings((p) => ({ ...p, pattern: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="ADM-{YEAR}-{SEQ}"
              />
              <p className="text-xs text-gray-500 mt-1">Use placeholders like <span className="font-mono">{'{YEAR}'}</span>, <span className="font-mono">{'{SEQ}'}</span>, <span className="font-mono">{'{BRANCH}'}</span>.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Sequence Width</label>
              <select
                value={admissionSettings.sequenceWidth}
                onChange={(e) => setAdmissionSettings((p) => ({ ...p, sequenceWidth: Number(e.target.value) }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value={3}>3 digits</option>
                <option value={4}>4 digits</option>
                <option value={5}>5 digits</option>
                <option value={6}>6 digits</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Starting Number</label>
              <input
                type="number"
                min="1"
                value={admissionSettings.startingNumber}
                onChange={(e) => setAdmissionSettings((p) => ({ ...p, startingNumber: Number(e.target.value || 1) }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Reset Rule</label>
              <select
                value={admissionSettings.resetRule}
                onChange={(e) => setAdmissionSettings((p) => ({ ...p, resetRule: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="NEVER">Never reset</option>
                <option value="YEARLY">Reset every academic year</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={admissionSettings.lockAfterFirstAdmission}
              onChange={(e) => setAdmissionSettings((p) => ({ ...p, lockAfterFirstAdmission: e.target.checked }))}
              className="w-4 h-4"
            />
            Prevent edits after first admission
          </label>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-xs">
            These controls are saved to school settings and enforced for new auto-generated admission numbers.
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleSaveAdmissionControls}
              disabled={admissionBusy}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              <Save size={16} />
              {admissionBusy ? 'Saving...' : 'Save Controls'}
            </button>
            <button
              onClick={handleResetAdmissionSequence}
              disabled={admissionBusy}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              Reset Current Year Sequence
            </button>
          </div>
        </div>
      )}

      {/* Stream Modal */}
      {showStreamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-blue-600 px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-medium text-white">
                {editingStream ? 'Edit Stream' : 'Add Stream'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Stream Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={streamFormData.name}
                  onChange={(e) => setStreamFormData({ ...streamFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., North, Blue, A"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={streamFormData.active}
                  onChange={(e) => setStreamFormData({ ...streamFormData, active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="text-sm font-medium text-gray-700">Active Stream</label>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex items-center justify-end gap-3 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowStreamModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStream}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    <span>{editingStream ? 'Updating...' : 'Adding...'}</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>{editingStream ? 'Update' : 'Add'} Stream</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-600 px-6 py-4 rounded-t-2xl sticky top-0">
              <h3 className="text-xl font-medium text-white">
                {editingClass ? 'Edit Class' : 'Add Class'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Class Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={classFormData.name}
                    onChange={(e) => setClassFormData({ ...classFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Grade 1 East"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Grade <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={classFormData.grade}
                    onChange={(e) => setClassFormData({ ...classFormData, grade: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Grade</option>
                    {gradeStructure.map(g => (
                      <option key={g.code} value={g.code}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Stream (Optional)
                  </label>
                  <select
                    value={classFormData.stream}
                    onChange={(e) => setClassFormData({ ...classFormData, stream: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Stream</option>
                    {streamConfigs.map(stream => (
                      <option key={stream.id} value={stream.name}>
                        {stream.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Class Teacher (Optional)
                  </label>
                  <select
                    value={classFormData.teacherId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setClassFormData({ ...classFormData, teacherId: newId });
                      checkTeacherConflict(newId);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Teacher Assigned</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.firstName} {teacher.lastName}
                      </option>
                    ))}
                  </select>
                  {teacherConflictWarning && (
                    <div className="mt-2 p-2 bg-amber-50 text-amber-800 rounded text-xs border border-amber-200 flex items-start gap-1">
                      <span>⚠️</span>
                      <span>{teacherConflictWarning}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={classFormData.capacity}
                    onChange={(e) => setClassFormData({ ...classFormData, capacity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    step="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Room (Optional)
                  </label>
                  <input
                    type="text"
                    value={classFormData.room}
                    onChange={(e) => setClassFormData({ ...classFormData, room: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Room 101"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Academic Year
                  </label>
                  <input
                    type="number"
                    value={classFormData.academicYear}
                    onChange={(e) => setClassFormData({ ...classFormData, academicYear: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Term
                  </label>
                  <select
                    value={classFormData.term}
                    onChange={(e) => setClassFormData({ ...classFormData, term: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TERM_1">Term 1</option>
                    <option value="TERM_2">Term 2</option>
                    <option value="TERM_3">Term 3</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={classFormData.active}
                  onChange={(e) => setClassFormData({ ...classFormData, active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="text-sm font-medium text-gray-700">Active Class</label>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex items-center justify-end gap-3 bg-gray-50 rounded-b-2xl sticky bottom-0">
              <button
                onClick={() => setShowClassModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClass}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    <span>{editingClass ? 'Updating...' : 'Creating...'}</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>{editingClass ? 'Update' : 'Create'} Class</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div >
      )}

      {/* Manual Creation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="text-xl font-medium text-gray-800">
                {editingArea ? 'Edit Learning Area' : 'New Learning Area'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingArea(null);
                  setFormData({ name: '', shortName: '', gradeLevel: dynamicGrades.length > 0 ? dynamicGrades[0] : 'GRADE_1', color: '#3b82f6', icon: '📚', description: '' });
                }}
                className="p-2 hover:bg-gray-200 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleAddEdit(); }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Learning Area Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    placeholder="e.g. Mathematics Activities"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Name</label>
                  <input
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    placeholder="e.g. MATH"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                  <select
                    value={formData.gradeLevel}
                    onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  >
                    {dynamicGrades.map((grade) => (
                      <option key={grade} value={grade}>{grade.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Icon</label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  >
                    <option value="📘">📘 Book</option>
                    <option value="🧮">🧮 Abacus</option>
                    <option value="🔬">🔬 Science</option>
                    <option value="🎨">🎨 Art</option>
                    <option value="🏃">🏃 Sports</option>
                    <option value="🌍">🌍 Social</option>
                    <option value="🧸">🧸 Play</option>
                    <option value="🎼">🎼 Music</option>
                    <option value="🕌">🕌 Religion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Theme Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full h-10 p-1 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  placeholder="Describe focus areas..."
                  rows={3}
                />
              </div>

              {/* Preview */}
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 text-center">Preview</p>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                    style={{ backgroundColor: `${formData.color}20`, color: formData.color }}
                  >
                    {formData.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 leading-tight">{formData.name || 'Subject Name'}</h4>
                    <p className="text-xs text-gray-500 font-medium">
                      <span className="text-blue-600">{formData.shortName || 'CODE'}</span> • {formData.gradeLevel?.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingArea(null);
                    setFormData({ name: '', shortName: '', gradeLevel: dynamicGrades.length > 0 ? dynamicGrades[0] : 'GRADE_1', color: '#3b82f6', icon: '📚', description: '' });
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader size={18} className="animate-spin" />
                      <span>{editingArea ? 'Updating...' : 'Creating...'}</span>
                    </div>
                  ) : (
                    <span>{editingArea ? 'Update Area' : 'Create Area'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notifications */}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={hideNotification}
      />
    </div>
  );
};

export default AcademicSettings;
