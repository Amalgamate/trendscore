/**
 * ResourceUploadModal
 * Modal dialog for uploading revision library resources.
 * Submits as multipart FormData to POST /api/lms/resources via lmsAPI.createResource().
 *
 * Props:
 *   isOpen    {boolean}  — whether the modal is visible
 *   onClose   {function} — called when the modal should close
 *   onSuccess {function} — called after a successful upload (before close)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { lmsAPI, configAPI } from '../../../../../services/api';
import { useNotifications } from '../../../hooks/useNotifications';
import { cn } from '../../../../../utils/cn';

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOURCE_TYPES = [
  'NOTES',
  'PAST_PAPER',
  'SCHEME',
  'WORKSHEET',
  'PROJECT',
  'EXPERIMENT',
  'CBC_ACTIVITY',
  'HOLIDAY_PACKAGE',
  'VIDEO',
  'OTHER',
];

const DIFFICULTY_LEVELS = ['EASY', 'MEDIUM', 'HARD'];

const TERMS = [1, 2, 3];

const DEFAULT_FORM = {
  title: '',
  description: '',
  learningAreaId: '',
  classId: '',
  resourceType: '',
  topic: '',
  term: '',
  year: '',
  difficulty: '',
  language: 'English',
  tags: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a resource type enum value to a readable label.
 * e.g. "PAST_PAPER" → "Past Paper"
 */
function formatLabel(value) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

// ─── ResourceUploadModal ──────────────────────────────────────────────────────

export default function ResourceUploadModal({ isOpen, onClose, onSuccess }) {
  const { showSuccess, showError } = useNotifications();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Config data ─────────────────────────────────────────────────────────
  const [learningAreas, setLearningAreas] = useState([]);
  const [classes, setClasses] = useState([]);
  const [configLoading, setConfigLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchConfig = async () => {
      setConfigLoading(true);
      try {
        const [areasRes, classesRes] = await Promise.all([
          configAPI.getLearningAreas(),
          configAPI.getClasses(),
        ]);
        setLearningAreas(areasRes?.data || areasRes || []);
        setClasses(classesRes?.data || classesRes || []);
      } catch (err) {
        console.error('Failed to load config data:', err);
        showError('Failed to load form options. Please refresh.');
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen, showError]);

  // ─── Reset when closed ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setFormData(DEFAULT_FORM);
      setSelectedFile(null);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // ─── Escape key to close ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isSubmitting, onClose]);

  // ─── Field handlers ──────────────────────────────────────────────────────
  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  }, []);

  // ─── File selection ──────────────────────────────────────────────────────
  const handleFileSelected = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setErrors((prev) => ({ ...prev, file: null }));
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleDropZoneClick = () => {
    if (!isSubmitting) fileInputRef.current?.click();
  };

  // ─── Drag & drop ─────────────────────────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    // Only trigger if leaving the drop zone entirely
    if (!dropZoneRef.current?.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  // ─── Validation ──────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.learningAreaId) newErrors.learningAreaId = 'Learning area is required';
    if (!formData.resourceType) newErrors.resourceType = 'Resource type is required';
    if (!selectedFile) newErrors.file = 'Please select a file to upload';

    if (formData.year) {
      const yr = Number(formData.year);
      if (!Number.isInteger(yr) || yr < 2000 || yr > new Date().getFullYear() + 1) {
        newErrors.year = 'Enter a valid year (2000 – present)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();

      // Required fields
      payload.append('title', formData.title.trim());
      payload.append('learningAreaId', formData.learningAreaId);
      payload.append('resourceType', formData.resourceType);

      // Optional fields — only append when non-empty
      if (formData.description.trim()) payload.append('description', formData.description.trim());
      if (formData.classId) payload.append('classId', formData.classId);
      if (formData.topic.trim()) payload.append('topic', formData.topic.trim());
      if (formData.term) payload.append('term', String(formData.term));
      if (formData.year) payload.append('year', String(formData.year));
      if (formData.difficulty) payload.append('difficulty', formData.difficulty);
      if (formData.language.trim()) payload.append('language', formData.language.trim());
      if (formData.tags.trim()) {
        // Normalise comma-separated tags
        const normalised = formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .join(',');
        payload.append('tags', normalised);
      }

      // File
      payload.append('file', selectedFile);

      await lmsAPI.createResource(payload);

      showSuccess('Resource uploaded successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to upload resource:', err);
      showError(err?.response?.data?.message || err?.message || 'Upload failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Guard ───────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rum-title"
    >
      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2
            id="rum-title"
            className="text-lg font-bold text-gray-950 dark:text-white"
          >
            Upload Resource
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-5"
        >
          {configLoading && (
            <div className="flex items-center justify-center py-6 text-gray-400">
              <Loader2 className="animate-spin mr-2" size={18} />
              <span className="text-sm">Loading options…</span>
            </div>
          )}

          {/* Title */}
          <Field label="Title" required error={errors.title}>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g., Form 3 Chemistry Notes – Acid & Bases"
              disabled={isSubmitting}
              className={inputCls(errors.title)}
            />
          </Field>

          {/* Description */}
          <Field label="Description" error={errors.description}>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of the resource…"
              disabled={isSubmitting}
              className={cn(inputCls(), 'resize-y')}
            />
          </Field>

          {/* Learning Area & Class — two columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Learning Area" required error={errors.learningAreaId}>
              <select
                value={formData.learningAreaId}
                onChange={(e) => handleChange('learningAreaId', e.target.value)}
                disabled={isSubmitting || configLoading}
                className={selectCls(errors.learningAreaId)}
              >
                <option value="">Select subject</option>
                {learningAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Class (Optional)" error={errors.classId}>
              <select
                value={formData.classId}
                onChange={(e) => handleChange('classId', e.target.value)}
                disabled={isSubmitting || configLoading}
                className={selectCls()}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Resource Type */}
          <Field label="Resource Type" required error={errors.resourceType}>
            <select
              value={formData.resourceType}
              onChange={(e) => handleChange('resourceType', e.target.value)}
              disabled={isSubmitting}
              className={selectCls(errors.resourceType)}
            >
              <option value="">Select type</option>
              {RESOURCE_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {formatLabel(rt)}
                </option>
              ))}
            </select>
          </Field>

          {/* Topic */}
          <Field label="Topic (Optional)" error={errors.topic}>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => handleChange('topic', e.target.value)}
              placeholder="e.g., Photosynthesis"
              disabled={isSubmitting}
              className={inputCls()}
            />
          </Field>

          {/* Term / Year / Difficulty — three columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Term (Optional)" error={errors.term}>
              <select
                value={formData.term}
                onChange={(e) => handleChange('term', e.target.value)}
                disabled={isSubmitting}
                className={selectCls()}
              >
                <option value="">Any term</option>
                {TERMS.map((t) => (
                  <option key={t} value={t}>
                    Term {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Year (Optional)" error={errors.year}>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => handleChange('year', e.target.value)}
                placeholder={String(new Date().getFullYear())}
                min={2000}
                max={new Date().getFullYear() + 1}
                disabled={isSubmitting}
                className={inputCls(errors.year)}
              />
            </Field>

            <Field label="Difficulty (Optional)" error={errors.difficulty}>
              <select
                value={formData.difficulty}
                onChange={(e) => handleChange('difficulty', e.target.value)}
                disabled={isSubmitting}
                className={selectCls()}
              >
                <option value="">Any level</option>
                {DIFFICULTY_LEVELS.map((d) => (
                  <option key={d} value={d}>
                    {formatLabel(d)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Language */}
          <Field label="Language (Optional)" error={errors.language}>
            <input
              type="text"
              value={formData.language}
              onChange={(e) => handleChange('language', e.target.value)}
              placeholder="English"
              disabled={isSubmitting}
              className={inputCls()}
            />
          </Field>

          {/* Tags */}
          <Field label="Tags (Optional)" error={errors.tags}>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder="comma-separated, e.g. exam, revision, 2023"
              disabled={isSubmitting}
              className={inputCls()}
            />
            <p className="text-xs text-gray-400 mt-1">Separate multiple tags with commas</p>
          </Field>

          {/* File Upload Zone */}
          <div>
            <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-2">
              File <span className="text-red-500">*</span>
            </label>

            {selectedFile ? (
              /* Selected file preview */
              <div className="flex items-center justify-between p-4 rounded-xl border border-brand-purple/40 bg-brand-purple/5 dark:bg-brand-purple/10">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 size={20} className="text-brand-purple flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-950 dark:text-white truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!isSubmitting && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="ml-4 flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    aria-label="Remove file"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ) : (
              /* Drop zone */
              <div
                ref={dropZoneRef}
                role="button"
                tabIndex={isSubmitting ? -1 : 0}
                aria-label="File upload zone — click or drag a file here"
                onClick={handleDropZoneClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleDropZoneClick();
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer outline-none',
                  'focus-visible:ring-2 focus-visible:ring-brand-purple/50',
                  isDragging
                    ? 'border-brand-purple bg-brand-purple/5 dark:bg-brand-purple/10'
                    : errors.file
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-brand-purple/50 hover:bg-brand-purple/5',
                  isSubmitting && 'pointer-events-none opacity-50',
                )}
              >
                {isDragging ? (
                  <>
                    <Upload className="mx-auto text-brand-purple mb-3" size={28} />
                    <p className="text-sm font-semibold text-brand-purple">Drop it here!</p>
                  </>
                ) : (
                  <>
                    <FileText className="mx-auto text-gray-400 mb-3" size={28} />
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Drop a file here or{' '}
                      <span className="text-brand-purple">browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Any file type accepted</p>
                  </>
                )}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInputChange}
              disabled={isSubmitting}
              aria-hidden="true"
              tabIndex={-1}
            />

            {errors.file && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.file}
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={isSubmitting || configLoading}
            className={cn(
              'flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors',
              'bg-brand-purple hover:bg-brand-purple/90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload Resource
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small helper sub-components ─────────────────────────────────────────────

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-950 dark:text-white mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError) {
  return cn(
    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors',
    'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    hasError
      ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
      : 'border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white',
  );
}

function selectCls(hasError) {
  return cn(
    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors',
    'focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    hasError
      ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
      : 'border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white',
  );
}
