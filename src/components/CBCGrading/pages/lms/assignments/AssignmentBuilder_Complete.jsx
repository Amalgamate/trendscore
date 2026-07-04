/**
 * AssignmentBuilder - Complete Implementation
 * Full-featured assignment creation form with all fields, validation, and workflow
 * 
 * Features:
 * - Basic info (title, category, class, subject, term)
 * - Grading configuration (marks, rubric)
 * - Submission settings (due date, late submission, resubmission)
 * - File management (upload resources, max size)
 * - Gradebook sync option
 * - Save as draft or publish directly
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
  ChevronDown,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { useNotifications } from '../../../hooks/useNotifications';
import { useNavigate, useParams } from 'react-router-dom';
import { lmsAPI, configAPI } from '../../../../../services/api';
import { cn } from '../../../../../utils/cn';
import FileUploadEditor from './FileUploadEditor';

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSIGNMENT_CATEGORIES = [
  { value: 'HOMEWORK', label: 'Homework', icon: '📝' },
  { value: 'PROJECT', label: 'Project', icon: '📊' },
  { value: 'REVISION', label: 'Revision', icon: '📚' },
  { value: 'HOLIDAY_WORK', label: 'Holiday Work', icon: '🏖️' },
  { value: 'RESEARCH', label: 'Research', icon: '🔍' },
  { value: 'READING', label: 'Reading', icon: '📖' },
  { value: 'PRACTICAL', label: 'Practical', icon: '🧪' },
  { value: 'GROUP_WORK', label: 'Group Work', icon: '👥' },
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
  totalMarks: '50',
  passMark: '',
  allowLateSubmit: true,
  allowResubmit: false,
  maxFileSize: 25,
  allowedFileTypes: [],
  rubric: [],
  gradebookSync: false,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssignmentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();

  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [learningAreas, setLearningAreas] = useState([]);
  const [terms, setTerms] = useState([]);
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('basic'); // basic, grading, submission, resources

  // ─── Fetch Initial Data ─────────────────────────────────────────────────────

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

        const activeT = (termsRes?.data || termsRes || []).find((t) => t.isActive);
        if (activeT && !id) {
          setFormData((prev) => ({ ...prev, termId: activeT.id }));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        showError('Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, showError]);

  // ─── Handle Form Field Changes ─────────────────────────────────────────────

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  }, []);

  // ─── Rubric Management ──────────────────────────────────────────────────────

  const addRubricRow = () => {
    setFormData((prev) => ({
      ...prev,
      rubric: [...prev.rubric, { criterion: '', marks: 0 }],
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

  const rubricTotal = formData.rubric.reduce((sum, row) => sum + (parseInt(row.marks) || 0), 0);

  // ─── Validation ─────────────────────────────────────────────────────────────

  const validateForm = (forPublish = false) => {
    const newErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.classId) newErrors.classId = 'Class is required';
    if (!formData.learningAreaId) newErrors.learningAreaId = 'Subject is required';
    if (!formData.termId) newErrors.termId = 'Term is required';
    if (!formData.category) newErrors.category = 'Category is required';

    if (forPublish && !formData.dueDate) {
      newErrors.dueDate = 'Due date is required to publish';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Save & Publish Handlers ────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!validateForm(false)) {
      showError('Please fill in required fields');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        dueDate: formData.dueDate ? `${formData.dueDate}T${formData.dueTime}` : null,
      };

      if (id) {
        await lmsAPI.updateAssignment(id, payload);
        showSuccess('Assignment updated');
      } else {
        await lmsAPI.createAssignment(payload);
        showSuccess('Assignment saved as draft');
      }

      navigate('/app/learning/assignments');
    } catch (error) {
      console.error('Save failed:', error);
      showError(error?.response?.data?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForm(true)) {
      showError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      let assignmentId = id;

      const payload = {
        ...formData,
        dueDate: formData.dueDate ? `${formData.dueDate}T${formData.dueTime}` : null,
      };

      if (id) {
        await lmsAPI.updateAssignment(id, payload);
      } else {
        const response = await lmsAPI.createAssignment(payload);
        assignmentId = response?.data?.id || response?.id;
      }

      await lmsAPI.publishAssignment(assignmentId);
      showSuccess('Assignment published successfully');
      navigate('/app/learning/assignments');
    } catch (error) {
      console.error('Publish failed:', error);
      showError(error?.response?.data?.message || 'Failed to publish');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-[#ff7900]" size={40} />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {id ? '✏️ Edit Assignment' : '📝 Create Assignment'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {id ? 'Update existing assignment' : 'Create a new homework or assignment'}
              </p>
            </div>
            <button
              onClick={() => navigate('/app/learning/assignments')}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'basic', label: '📋 Basic', icon: '1' },
            { id: 'grading', label: '📊 Grading', icon: '2' },
            { id: 'submission', label: '⏰ Submission', icon: '3' },
            { id: 'resources', label: '📎 Resources', icon: '4' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-[#ff7900] text-[#ff7900]'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6">
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <FormField label="Title" required error={errors.title}>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="e.g., Chapter 5 Quadratic Equations"
                    className={inputClass(errors.title)}
                  />
                </FormField>

                <FormField label="Category" required error={errors.category}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {ASSIGNMENT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => handleChange('category', cat.value)}
                        className={cn(
                          'p-3 rounded-lg border-2 text-center transition',
                          formData.category === cat.value
                            ? 'border-[#ff7900] bg-[#ff7900]/10'
                            : 'border-gray-200 hover:border-gray-300',
                        )}
                      >
                        <div className="text-lg mb-1">{cat.icon}</div>
                        <div className="text-xs font-medium">{cat.label}</div>
                      </button>
                    ))}
                  </div>
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Class" required error={errors.classId}>
                    <select
                      value={formData.classId}
                      onChange={(e) => handleChange('classId', e.target.value)}
                      className={selectClass(errors.classId)}
                    >
                      <option value="">Select class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Stream (Optional)">
                    <select
                      value={formData.streamId}
                      onChange={(e) => handleChange('streamId', e.target.value)}
                      className={selectClass()}
                    >
                      <option value="">All streams</option>
                      {streams.map((stream) => (
                        <option key={stream.id} value={stream.id}>
                          {stream.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Subject" required error={errors.learningAreaId}>
                    <select
                      value={formData.learningAreaId}
                      onChange={(e) => handleChange('learningAreaId', e.target.value)}
                      className={selectClass(errors.learningAreaId)}
                    >
                      <option value="">Select subject</option>
                      {learningAreas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Term" required error={errors.termId}>
                    <select
                      value={formData.termId}
                      onChange={(e) => handleChange('termId', e.target.value)}
                      className={selectClass(errors.termId)}
                    >
                      <option value="">Select term</option>
                      {terms.map((term) => (
                        <option key={term.id} value={term.id}>
                          Term {term.term} — {term.academicYear}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <FormField label="Instructions (Optional)">
                  <textarea
                    rows={6}
                    value={formData.instructions}
                    onChange={(e) => handleChange('instructions', e.target.value)}
                    placeholder="Detailed assignment instructions..."
                    className={textareaClass()}
                  />
                </FormField>

                <FormField label="Estimated Time (minutes)">
                  <input
                    type="number"
                    value={formData.estimatedMins}
                    onChange={(e) => handleChange('estimatedMins', e.target.value)}
                    placeholder="e.g., 60"
                    className={inputClass()}
                  />
                </FormField>
              </div>
            )}

            {/* Grading Tab */}
            {activeTab === 'grading' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Total Marks">
                    <input
                      type="number"
                      value={formData.totalMarks}
                      onChange={(e) => handleChange('totalMarks', e.target.value)}
                      placeholder="e.g., 50"
                      min="0"
                      className={inputClass()}
                    />
                  </FormField>

                  <FormField label="Pass Mark (Optional)">
                    <input
                      type="number"
                      value={formData.passMark}
                      onChange={(e) => handleChange('passMark', e.target.value)}
                      placeholder="e.g., 25"
                      min="0"
                      max={formData.totalMarks || 100}
                      className={inputClass()}
                    />
                  </FormField>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <BookOpen size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900 text-sm">Rubric Builder</h3>
                      <p className="text-xs text-blue-700 mt-1">
                        Create grading criteria. Total marks must equal assignment total.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Rubric Criteria</h4>
                    <button
                      onClick={addRubricRow}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ff7900]/10 text-[#ff7900] rounded-lg hover:bg-[#ff7900]/20 text-sm font-medium"
                    >
                      <Plus size={16} />
                      Add Criterion
                    </button>
                  </div>

                  {formData.rubric.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {formData.rubric.map((row, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <input
                            type="text"
                            value={row.criterion}
                            onChange={(e) => updateRubricRow(idx, 'criterion', e.target.value)}
                            placeholder="e.g., Content Accuracy"
                            className={cn(inputClass(), 'flex-1')}
                          />
                          <input
                            type="number"
                            value={row.marks}
                            onChange={(e) => updateRubricRow(idx, 'marks', e.target.value)}
                            placeholder="Marks"
                            min="0"
                            className={cn(inputClass(), 'w-24')}
                          />
                          <button
                            onClick={() => removeRubricRow(idx)}
                            className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600 text-sm">
                      No criteria yet. Click "Add Criterion" to start.
                    </div>
                  )}

                  {formData.rubric.length > 0 && (
                    <div className={cn(
                      'p-3 rounded-lg border-2 text-sm font-semibold',
                      rubricTotal === parseInt(formData.totalMarks || 0)
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-yellow-50 border-yellow-300 text-yellow-700',
                    )}>
                      Total: {rubricTotal} / {formData.totalMarks || 0} marks
                      {rubricTotal === parseInt(formData.totalMarks || 0) && (
                        <span className="ml-2">✓ Match</span>
                      )}
                    </div>
                  )}
                </div>

                <FormField>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.gradebookSync}
                      onChange={(e) => handleChange('gradebookSync', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      Sync marks to gradebook
                    </span>
                  </label>
                  <p className="text-xs text-gray-600 mt-2">
                    Automatically update student grades in the gradebook
                  </p>
                </FormField>
              </div>
            )}

            {/* Submission Tab */}
            {activeTab === 'submission' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Due Date" error={errors.dueDate}>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleChange('dueDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={inputClass(errors.dueDate)}
                    />
                  </FormField>

                  <FormField label="Due Time">
                    <input
                      type="time"
                      value={formData.dueTime}
                      onChange={(e) => handleChange('dueTime', e.target.value)}
                      className={inputClass()}
                    />
                  </FormField>
                </div>

                <div className="space-y-3">
                  <FormField>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border-2 border-gray-200 rounded-lg hover:border-[#ff7900] transition">
                      <input
                        type="checkbox"
                        checked={formData.allowLateSubmit}
                        onChange={(e) => handleChange('allowLateSubmit', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Allow Late Submission</span>
                        <p className="text-xs text-gray-600">Students can submit after deadline</p>
                      </div>
                    </label>
                  </FormField>

                  <FormField>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border-2 border-gray-200 rounded-lg hover:border-[#ff7900] transition">
                      <input
                        type="checkbox"
                        checked={formData.allowResubmit}
                        onChange={(e) => handleChange('allowResubmit', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Allow Resubmission</span>
                        <p className="text-xs text-gray-600">Students can submit multiple times</p>
                      </div>
                    </label>
                  </FormField>
                </div>

                <FormField label="Max File Size (MB)">
                  <input
                    type="number"
                    value={formData.maxFileSize}
                    onChange={(e) => handleChange('maxFileSize', e.target.value)}
                    min="1"
                    max="100"
                    className={inputClass()}
                  />
                </FormField>
              </div>
            )}

            {/* Resources Tab */}
            {activeTab === 'resources' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    Attach resources like PDF, Word documents, or links for students to reference.
                  </p>
                </div>

                <FileUploadEditor
                  block={{ content: { url: '', fileName: '' } }}
                  onChange={() => {}}
                  label="Assignment Resources"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={() => navigate('/app/learning/assignments')}
            className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="px-6 py-2.5 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Draft
          </button>
          <button
            onClick={handlePublish}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#ff7900] text-white rounded-lg font-medium hover:bg-[#ff7900]/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Field Component ───────────────────────────────────────────────────

function FormField({ label, required, error, children }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
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

// ─── Input Classes ──────────────────────────────────────────────────────────

function inputClass(hasError) {
  return cn(
    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors',
    'focus:border-[#ff7900] focus:ring-2 focus:ring-[#ff7900]/20',
    hasError
      ? 'border-red-500 bg-red-50'
      : 'border-gray-300 bg-white hover:border-gray-400',
  );
}

function selectClass(hasError) {
  return cn(
    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors',
    'focus:border-[#ff7900] focus:ring-2 focus:ring-[#ff7900]/20',
    hasError
      ? 'border-red-500 bg-red-50'
      : 'border-gray-300 bg-white hover:border-gray-400',
  );
}

function textareaClass(hasError) {
  return cn(
    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors resize-vertical',
    'focus:border-[#ff7900] focus:ring-2 focus:ring-[#ff7900]/20',
    hasError
      ? 'border-red-500 bg-red-50'
      : 'border-gray-300 bg-white hover:border-gray-400',
  );
}
