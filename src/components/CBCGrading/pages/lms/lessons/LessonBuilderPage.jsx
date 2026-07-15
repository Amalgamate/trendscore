/**
 * LessonBuilderPage — Teacher Lesson Builder
 * 
 * Form-based lesson metadata editor with integrated block editor below.
 * Auto-saves metadata on blur; blocks auto-save every 30 seconds.
 * Publish button transitions lesson from DRAFT to PUBLISHED.
 * 
 * Requirements: 6.1, 6.4, 6.5
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save,
  Send,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { configAPI } from '../../../../../services/api/config.api';
import { Skeleton } from '../../../../ui';
import LessonBlockEditor from './LessonBlockEditor';
import LessonAssignmentsSection from './LessonAssignmentsSection';

// ─── Lesson Metadata Form ──────────────────────────────────────────────────

function LessonMetadataForm({ lesson, onUpdate, onSave, loading, error }) {
  const [form, setForm] = useState(lesson || {});
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState({ classes: [], learningAreas: [], terms: [], streams: [] });
  const [optionsError, setOptionsError] = useState('');

  useEffect(() => {
    setForm(lesson || {});
  }, [lesson?.id]);

  useEffect(() => {
    let active = true;
    const unwrap = (response) => response?.data || response || [];

    Promise.all([
      configAPI.getClasses(),
      configAPI.getLearningAreas(),
      configAPI.getTermConfigs(),
      configAPI.getStreamConfigs?.() || Promise.resolve([]),
    ])
      .then(([classes, learningAreas, terms, streams]) => {
        if (!active) return;
        const termOptions = unwrap(terms);
        setOptions({
          classes: unwrap(classes),
          learningAreas: unwrap(learningAreas),
          terms: termOptions,
          streams: unwrap(streams),
        });
        if (!lesson) {
          const activeTerm = termOptions.find((term) => term.isActive);
          if (activeTerm) setForm((current) => ({ ...current, termId: current.termId || activeTerm.id }));
        }
      })
      .catch(() => {
        if (active) setOptionsError('Could not load classes, subjects, and terms. Please refresh and try again.');
      });

    return () => { active = false; };
  }, [lesson?.id]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlurSave = async (field, value) => {
    // Auto-save on blur
    if (lesson && lesson.id && lesson.status === 'DRAFT') {
      setSaving(true);
      try {
        await lmsAPI.updateLesson?.(lesson.id, { [field]: value });
        onUpdate?.({ ...form, [field]: value });
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCreateLesson = async () => {
    if (!form.title?.trim() || !form.classId || !form.learningAreaId || !form.termId) {
      alert('Please enter a title and select a class, subject, and term');
      return;
    }

    setSaving(true);
    try {
      const estimatedMins = form.estimatedMins === '' || form.estimatedMins === undefined
        ? undefined
        : Number(form.estimatedMins);
      const res = await lmsAPI.createLesson?.({
        ...form,
        estimatedMins: Number.isInteger(estimatedMins) && estimatedMins >= 0 ? estimatedMins : undefined,
      });
      if (res?.success) {
        onUpdate?.(res.data);
        onSave?.(res.data);
      }
    } catch (err) {
      console.error('Create lesson failed:', err);
      alert(err?.message || 'Failed to create lesson');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}
      {optionsError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600" />
          <p className="text-sm text-rose-700">{optionsError}</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-900 mb-1">
          Lesson Title *
        </label>
        <input
          type="text"
          value={form.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          onBlur={(e) => handleBlurSave('title', e.target.value)}
          placeholder="e.g., Photosynthesis: Energy from Light"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7900]"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-900 mb-1">
          Description
        </label>
        <textarea
          value={form.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          onBlur={(e) => handleBlurSave('description', e.target.value)}
          placeholder="Brief overview of lesson content"
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7900]"
        />
      </div>

      {/* Class & Subject */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Class *
          </label>
          <select
            value={form.classId || ''}
            onChange={(e) => handleChange('classId', e.target.value)}
            onBlur={(e) => handleBlurSave('classId', e.target.value)}
            disabled={Boolean(lesson)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-600"
          >
            <option value="">Select class</option>
            {options.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Subject *
          </label>
          <select
            value={form.learningAreaId || ''}
            onChange={(e) => handleChange('learningAreaId', e.target.value)}
            onBlur={(e) => handleBlurSave('learningAreaId', e.target.value)}
            disabled={Boolean(lesson)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-600"
          >
            <option value="">Select subject</option>
            {options.learningAreas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">Term *</label>
          <select
            value={form.termId || ''}
            onChange={(e) => handleChange('termId', e.target.value)}
            onBlur={(e) => handleBlurSave('termId', e.target.value)}
            disabled={Boolean(lesson)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-600"
          >
            <option value="">Select term</option>
            {options.terms.map((item) => <option key={item.id} value={item.id}>{item.term ? `Term ${item.term} — ${item.academicYear}` : item.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">Stream (optional)</label>
          <select
            value={form.streamId || ''}
            onChange={(e) => handleChange('streamId', e.target.value)}
            onBlur={(e) => handleBlurSave('streamId', e.target.value)}
            disabled={Boolean(lesson)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-600"
          >
            <option value="">All streams</option>
            {options.streams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>

      {/* Estimated Minutes */}
      <div>
        <label className="block text-sm font-medium text-slate-900 mb-1">
          Estimated Time (minutes)
        </label>
        <input
          type="number"
          value={form.estimatedMins || ''}
          onChange={(e) => handleChange('estimatedMins', parseInt(e.target.value))}
          onBlur={(e) => handleBlurSave('estimatedMins', parseInt(e.target.value))}
          placeholder="45"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7900]"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-2 pt-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.allowComments || false}
            onChange={(e) => {
              handleChange('allowComments', e.target.checked);
              handleBlurSave('allowComments', e.target.checked);
            }}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Allow student comments</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.allowQuestions || false}
            onChange={(e) => {
              handleChange('allowQuestions', e.target.checked);
              handleBlurSave('allowQuestions', e.target.checked);
            }}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Allow student questions</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.allowDownload || false}
            onChange={(e) => {
              handleChange('allowDownload', e.target.checked);
              handleBlurSave('allowDownload', e.target.checked);
            }}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Allow downloads</span>
        </label>
      </div>

      {!lesson && (
        <button
          onClick={handleCreateLesson}
          disabled={saving}
          className="w-full mt-4 px-4 py-2 bg-[#ff7900] text-white rounded-lg hover:bg-[#ff7900]/90 transition disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save size={16} />
              Create Lesson
            </>
          )}
        </button>
      )}

      {saving && lesson && (
        <div className="text-xs text-amber-600 flex items-center gap-1">
          <RefreshCw size={12} className="animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function LessonBuilderPage({ lessonId: propLessonId, pageParams, onNavigate }) {
  const lessonId = propLessonId || pageParams?.lessonId;

  // State
  const [lesson, setLesson] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(!!lessonId);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  // Load lesson + blocks if editing
  useEffect(() => {
    if (!lessonId) return;

    const load = async () => {
      try {
        setLoading(true);
        const res = await lmsAPI.getLessonWithBlocks?.(lessonId);
        if (res?.success) {
          setLesson(res.data);
          setBlocks(res.data.blocks || []);
        }
      } catch (err) {
        setError('Failed to load lesson');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [lessonId]);

  const handleMetadataUpdate = (updated) => {
    setLesson(updated);
  };

  const handleBlocksUpdate = (updated) => {
    setBlocks(updated);
  };

  const handlePublish = async () => {
    if (!lesson || lesson.status !== 'DRAFT') {
      alert('Lesson must be in DRAFT status to publish');
      return;
    }

    if (!lesson.dueDate) {
      alert('Please set a due date before publishing');
      return;
    }

    if (blocks.length === 0) {
      alert('Add at least one block before publishing');
      return;
    }

    setPublishing(true);
    try {
      await lmsAPI.publishLesson?.(lesson.id);
      setLesson((prev) => ({ ...prev, status: 'PUBLISHED', publishedAt: new Date() }));
      alert('Lesson published! Students will receive notifications.');
    } catch (err) {
      alert('Failed to publish lesson');
    } finally {
      setPublishing(false);
    }
  };

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('learning-lessons');
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition flex-shrink-0"
            aria-label="Back to Lessons"
            title="Back to Lessons"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">
            {lesson ? `Edit: ${lesson.title}` : 'Create Lesson'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {lesson && lesson.status === 'DRAFT' && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 font-medium text-sm flex items-center gap-2"
            >
              <Send size={16} />
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Metadata Form (1/4 width) */}
        <div className="col-span-1 bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-4">Lesson Details</h3>
          <LessonMetadataForm
            lesson={lesson}
            onUpdate={handleMetadataUpdate}
            onSave={(newLesson) => {
              setLesson(newLesson);
              // Lesson created, blocks editor will now show
            }}
            loading={loading}
            error={error}
          />
        </div>

        {/* Block Editor (3/4 width) */}
        <div className="col-span-2 space-y-4">
          <LessonAssignmentsSection
            lesson={lesson}
            blocks={blocks}
            onBlocksUpdate={handleBlocksUpdate}
            onNavigate={onNavigate}
          />

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-4">Lesson Content</h3>
          {lesson ? (
            <LessonBlockEditor
              lessonId={lesson.id}
              blocks={blocks}
              onBlocksUpdate={handleBlocksUpdate}
            />
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">
              Create a lesson first by filling in the details on the left
            </p>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
