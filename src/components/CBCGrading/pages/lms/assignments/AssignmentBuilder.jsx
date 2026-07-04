/**
 * Assignment Builder
 * Form for creating/editing assignments with rich fields, rubric builder, and file attachments
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save,
  Send,
  X,
  Upload,
  Trash2,
  Plus,
  Loader2,
  Calendar,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useNotifications } from '../../../hooks/useNotifications';
import { useNavigate, useParams } from 'react-router-dom';
import { lmsAPI, configAPI } from '../../../../../services/api';
import { cn } from '../../../../../utils/cn';

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSIGNMENT_CATEGORIES = [
  'HOMEWORK',
  'PROJECT',
  'REVISION',
  'HOLIDAY_WORK',
  'RESEARCH',
  'READING',
  'PRACTICAL',
  'GROUP_WORK',
];

const DEFAULT_FORM_DATA = {
  title: '',
  instructions: '',
  category: 'HOMEWORK',
  classId: '',
  streamId: '',
  learningAreaId: '',
  termId: '',
  dueDate: '',
  dueTime: '23:59',
  estimatedMins: '',
  totalMarks: '',
  passMark: '',
  allowLateSubmit: true,
  allowResubmit: false,
  maxFileSize: 25,
  rubric: [],
};

// ─── AssignmentBuilder Component ─────────────────────────────────────────────

export default function AssignmentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [learningAreas, setLearningAreas] = useState([]);
  const [terms, setTerms] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // ─── Fetch Dropdown Data ────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [classesRes, streamsRes, areasRes, termsRes] = await Promise.all([
          configAPI.getClasses(),
          configAPI.getStreamConfigs(),
          configAPI.getLearningAreas(),
          configAPI.getTermConfigs(),
        ]);

        setClasses(classesRes?.data || classesRes || []);
        setStreams(streamsRes?.data || streamsRes || []);
        setLearningAreas(areasRes?.data || areasRes || []);
        setTerms(termsRes?.data || termsRes || []);

        // Set default term to active if available
        const activeT = (termsRes?.data || termsRes || []).find((t) => t.isActive);
        if (activeT && !id) {
          setFormData((prev) => ({ ...prev, termId: activeT.id }));
        }
      } catch (error) {
        console.error('Failed to fetch dropdown data:', error);
        showError('Failed to load form data. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, showError]);

  // ─── Load Assignment for Edit ───────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;

    const fetchAssignment = async () => {
      try {
        const response = await lmsAPI.getAssignment(id);
        const assignment = response?.data || response;

        if (assignment) {
          setFormData({
            title: assignment.title || '',
            instructions: assignment.instructions || '',
            category: assignment.category || 'HOMEWORK',
            classId: assignment.classId || '',
            streamId: assignment.streamId || '',
            learningAreaId: assignment.learningAreaId || '',
            termId: assignment.termId || '',
            dueDate: assignment.dueDate ? assignment.dueDate.split('T')[0] : '',
            dueTime: assignment.dueDate
              ? new Date(assignment.dueDate).toTimeString().slice(0, 5)
              : '23:59',
            estimatedMins: assignment.estimatedMins || '',
            totalMarks: assignment.totalMarks || '',
            passMark: assignment.passMark || '',
            allowLateSubmit: assignment.allowLateSubmit !== false,
            allowResubmit: assignment.allowResubmit || false,
            maxFileSize: assignment.maxFileSize || 25,
            rubric: assignment.rubric || [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch assignment:', error);
        showError('Failed to load assignment. Please try again.');
      }
    };

    fetchAssignment();
  }, [id, showError]);

  // ─── Form Handlers ──────────────────────────────────────────────────────────

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Rubric Builder ─────────────────────────────────────────────────────────

  const addRubricRow = () => {
    setFormData((prev) => ({
      ...prev,
      rubric: [...prev.rubric, { criterion: '', marks: '' }],
    }));
  };

  const updateRubricRow = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.rubric];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, rubric: updated };
    });
  };

  const removeRubricRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      rubric: prev.rubric.filter((_, i) => i !== index),
    }));
  };

  // ─── Validation ─────────────────────────────────────────────────────────────

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.classId) newErrors.classId = 'Class is required';
    if (!formData.learningAreaId) newErrors.learningAreaId = 'Learning area is required';
    if (!formData.termId) newErrors.termId = 'Term is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Save Handlers ──────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!validateForm()) {
      showError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const payload = { ...formData, status: 'DRAFT' };

      if (id) {
        await lmsAPI.updateAssignment(id, payload);
        showSuccess('Assignment draft updated successfully');
      } else {
        await lmsAPI.createAssignment(payload);
        showSuccess('Assignment draft saved successfully');
      }

      navigate('/app/learning/assignments');
    } catch (error) {
      console.error('Failed to save draft:', error);
      showError(error?.response?.data?.message || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForm()) {
      showError('Please fill in all required fields');
      return;
    }

    if (!formData.dueDate) {
      showError('Due date is required to publish');
      return;
    }

    setIsSaving(true);
    try {
      let assignmentId = id;

      // Create or update first
      const payload = { ...formData };
      if (id) {
        await lmsAPI.updateAssignment(id, payload);
      } else {
        const response = await lmsAPI.createAssignment(payload);
        assignmentId = response?.data?.id || response?.id;
      }

      // Then publish
      await lmsAPI.publishAssignment(assignmentId);
      showSuccess('Assignment published successfully');
      navigate('/app/learning/assignments');
    } catch (error) {
      console.error('Failed to publish:', error);
      showError(error?.response?.data?.message || 'Failed to publish assignment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/app/learning/assignments');
  };

  // ─── Render Loading State ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-brand-purple" size={32} />
      </div>
    );
  }

  // ─── Render Form ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-950 dark:text-white">
            {id ? 'Edit Assignment' : 'Create Assignment'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {id ? 'Update assignment details' : 'Build a rich assignment with instructions, rubric, and files'}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Science Project on Photosynthesis"
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors',
                  'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
                  errors.title
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white',
                )}
              />
              {errors.title && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.title}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white"
              >
                {ASSIGNMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Class & Stream - Two Column Grid on Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  Class <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.classId}
                  onChange={(e) => handleChange('classId', e.target.value)}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none',
                    'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
                    errors.classId
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white',
                  )}
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                {errors.classId && (
                  <p className="text-xs text-red-500 mt-1">{errors.classId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  Stream (Optional)
                </label>
                <select
                  value={formData.streamId}
                  onChange={(e) => handleChange('streamId', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white"
                >
                  <option value="">All Streams</option>
                  {streams.map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {stream.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Learning Area & Term - Two Column Grid on Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  Learning Area / Subject <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.learningAreaId}
                  onChange={(e) => handleChange('learningAreaId', e.target.value)}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none',
                    'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
                    errors.learningAreaId
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white',
                  )}
                >
                  <option value="">Select Subject</option>
                  {learningAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                {errors.learningAreaId && (
                  <p className="text-xs text-red-500 mt-1">{errors.learningAreaId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  Term <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.termId}
                  onChange={(e) => handleChange('termId', e.target.value)}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none',
                    'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
                    errors.termId
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white',
                  )}
                >
                  <option value="">Select Term</option>
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.term ? `Term ${term.term} — ${term.academicYear}` : term.name}
                    </option>
                  ))}
                </select>
                {errors.termId && (
                  <p className="text-xs text-red-500 mt-1">{errors.termId}</p>
                )}
              </div>
            </div>

            {/* Due Date & Due Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  <Calendar size={14} className="inline mr-1.5 text-brand-purple" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  <Clock size={14} className="inline mr-1.5 text-brand-purple" />
                  Due Time
                </label>
                <input
                  type="time"
                  value={formData.dueTime}
                  onChange={(e) => handleChange('dueTime', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white"
                />
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                Instructions (Optional)
              </label>
              <textarea
                rows={5}
                value={formData.instructions}
                onChange={(e) => handleChange('instructions', e.target.value)}
                placeholder="Detailed assignment instructions for students..."
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white resize-y"
              />
            </div>

            {/* Estimated Minutes & Max File Size */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.estimatedMins}
                  onChange={(e) => handleChange('estimatedMins', e.target.value)}
                  placeholder="30"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  Total Marks
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.totalMarks}
                  onChange={(e) => handleChange('totalMarks', e.target.value)}
                  placeholder="100"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                  Pass Mark
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.passMark}
                  onChange={(e) => handleChange('passMark', e.target.value)}
                  placeholder="50"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white"
                />
              </div>
            </div>

            {/* Toggles - Two Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 cursor-pointer hover:border-brand-purple/30 transition-colors">
                <span className="text-sm font-semibold text-gray-950 dark:text-white">
                  Allow Late Submission
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.allowLateSubmit}
                  onClick={() => handleChange('allowLateSubmit', !formData.allowLateSubmit)}
                  className={cn(
                    'relative h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors',
                    formData.allowLateSubmit
                      ? 'border-brand-purple bg-brand-purple'
                      : 'border-gray-300 bg-gray-100',
                  )}
                >
                  <span
                    className={cn(
                      'block h-4 w-4 rounded-full bg-white shadow transition-transform',
                      formData.allowLateSubmit ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 cursor-pointer hover:border-brand-purple/30 transition-colors">
                <span className="text-sm font-semibold text-gray-950 dark:text-white">
                  Allow Resubmission
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.allowResubmit}
                  onClick={() => handleChange('allowResubmit', !formData.allowResubmit)}
                  className={cn(
                    'relative h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors',
                    formData.allowResubmit
                      ? 'border-brand-purple bg-brand-purple'
                      : 'border-gray-300 bg-gray-100',
                  )}
                >
                  <span
                    className={cn(
                      'block h-4 w-4 rounded-full bg-white shadow transition-transform',
                      formData.allowResubmit ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
                Max File Size (MB)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.maxFileSize}
                onChange={(e) => handleChange('maxFileSize', e.target.value)}
                className="w-full md:w-48 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 dark:text-white"
              />
            </div>

            {/* Rubric Builder */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-950 dark:text-white">
                  Rubric (Optional)
                </h3>
                <button
                  type="button"
                  onClick={addRubricRow}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-brand-purple border border-brand-purple rounded-lg hover:bg-brand-purple hover:text-white transition-colors"
                >
                  <Plus size={14} />
                  Add Criterion
                </button>
              </div>

              {formData.rubric.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  No rubric criteria added yet. Click "Add Criterion" to start building.
                </p>
              ) : (
                <div className="space-y-3">
                  {formData.rubric.map((row, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          value={row.criterion}
                          onChange={(e) => updateRubricRow(index, 'criterion', e.target.value)}
                          placeholder="Criterion name (e.g., Clarity of explanation)"
                          className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/20 dark:text-white"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="0"
                          value={row.marks}
                          onChange={(e) => updateRubricRow(index, 'marks', e.target.value)}
                          placeholder="Marks"
                          className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/20 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRubricRow(index)}
                        className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        aria-label="Remove criterion"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* File Attachments */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-bold text-gray-950 dark:text-white mb-4">
                File Attachments (Optional)
              </h3>

              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700',
                  'hover:border-brand-purple/50 hover:bg-brand-purple/5',
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files);
                  setAttachedFiles((prev) => [...prev, ...files]);
                }}
              >
                <Upload className="mx-auto text-gray-400 mb-3" size={28} />
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Drop files here or <span className="text-brand-purple">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Max {formData.maxFileSize}MB per file · Up to 10 files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {attachedFiles.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {attachedFiles.map((file, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 h-9 w-9 rounded-md bg-brand-purple/10 flex items-center justify-center text-brand-purple text-xs font-bold uppercase">
                          {file.name.split('.').pop()?.slice(0, 4)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        aria-label="Remove file"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-brand-purple border border-brand-purple rounded-lg hover:bg-brand-purple hover:text-white transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save as Draft
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePublish}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-purple rounded-lg hover:bg-brand-purple/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Publish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
