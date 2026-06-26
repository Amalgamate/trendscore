import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { configAPI } from '../../../services/api';
import { CANONICAL_TEST_TYPE_OPTIONS, normalizeTestType } from '../utils/testType';

const toCanonicalGrade = (grade) => {
  const raw = String(grade || '').trim().toUpperCase();
  if (!raw) return '';
  const compact = raw.replace(/\s+/g, '_');
  const match = compact.match(/^GRADE_?(\d+)$/);
  if (match) return `GRADE_${match[1]}`;
  return compact;
};

const normalizeLearningAreaKey = (value) =>
  String(value || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '').trim();

const uniqueSortedNames = (items = []) => [
  ...new Map(
    items
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => [normalizeLearningAreaKey(item), item])
  ).values()
].sort((a, b) => a.localeCompare(b));

const CreateTestPage = ({ onSave, onCancel, initialData, availableGrades }) => {
  const [formData, setFormData] = useState({
    title: '',
    testType: 'MONTHLY',
    month: new Date().toLocaleString('default', { month: 'long' }),
    grade: '',
    term: 'Term 1',
    subject: '',
    performanceScale: 'Default (auto per grade)',
    year: new Date().getFullYear().toString(),
    date: new Date().toISOString().split('T')[0],
    duration: 60,
    totalMarks: 100,
    passMarks: 40,
    instructions: '',
    weight: 1.0,
    ...initialData
  });
  const [gradeLearningAreas, setGradeLearningAreas] = useState([]);
  const [loadingLearningAreas, setLoadingLearningAreas] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadGradeLearningAreas = async () => {
      if (!formData.grade) {
        setGradeLearningAreas([]);
        return;
      }
      setLoadingLearningAreas(true);
      try {
        const resp = await configAPI.getLearningAreas({ gradeLevel: toCanonicalGrade(formData.grade) });
        const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        const names = uniqueSortedNames(rows.map((row) => row?.name));
        if (!cancelled) setGradeLearningAreas(names);
      } catch (error) {
        console.error('Failed to load grade learning areas:', error);
        if (!cancelled) setGradeLearningAreas([]);
      } finally {
        if (!cancelled) setLoadingLearningAreas(false);
      }
    };
    loadGradeLearningAreas();
    return () => { cancelled = true; };
  }, [formData.grade]);

  useEffect(() => {
    if (!formData.subject) return;
    const selectedKey = normalizeLearningAreaKey(formData.subject);
    const canonicalSubject = gradeLearningAreas.find((area) => normalizeLearningAreaKey(area) === selectedKey);
    if (!canonicalSubject) {
      setFormData(prev => ({ ...prev, subject: '' }));
      return;
    }
    if (canonicalSubject !== formData.subject) {
      setFormData(prev => ({ ...prev, subject: canonicalSubject }));
    }
  }, [formData.subject, gradeLearningAreas]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('=== SUBMITTING TEST FORM ===');
    console.log('Form Data:', formData);

    // Validation
    if (!formData.title || !formData.grade || !formData.performanceScale || !formData.subject) {
      console.log('Validation failed:');
      console.log('- Title:', formData.title);
      console.log('- Grade:', formData.grade);
      console.log('- Subject:', formData.subject);
      console.log('- Scale:', formData.performanceScale);
      alert('Please fill in all required fields (Test Name, Grade, Subject, Performance Level Scale)');
      return;
    }

    console.log('Validation passed, calling onSave...');

    try {
      await onSave({
        ...formData,
        testType: normalizeTestType(formData.testType) || 'ASSESSMENT',
      });
      console.log('✅ Save successful!');
    } catch (error) {
      console.error('❌ Save failed:', error);
      alert('Failed to save test: ' + error.message);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-medium text-gray-800 uppercase tracking-wide">
            {initialData && initialData.id ? 'Edit Test Configuration' : 'Create New Test'}
          </h1>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600">Test Details</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* Test Name */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Test Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g. Mathematics Opener"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all placeholder-gray-400"
                required
              />
            </div>

            {/* Grid Layout for other fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Type */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Test Type
                </label>
                <div className="relative">
                  <select
                    value={formData.testType}
                    onChange={(e) => handleChange('testType', e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    {CANONICAL_TEST_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* Month (Conditional) */}
              {normalizeTestType(formData.testType) === 'MONTHLY' && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Month
                  </label>
                  <div className="relative">
                    <select
                      value={formData.month}
                      onChange={(e) => {
                        const newMonth = e.target.value;
                        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                        const monthIndex = months.indexOf(newMonth);

                        setFormData(prev => {
                          const updates = { month: newMonth };
                          if (monthIndex >= 0) {
                            const year = parseInt(prev.year) || new Date().getFullYear();
                            const monthStr = (monthIndex + 1).toString().padStart(2, '0');
                            updates.date = `${year}-${monthStr}-01`;
                          }
                          return { ...prev, ...updates };
                        });
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Grade */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade Level
                </label>
                <div className="relative">
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value, subject: '' }))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select Grade</option>
                    {availableGrades.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* Academic Term */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Term
                </label>
                <div className="relative">
                  <select
                    value={formData.term}
                    onChange={(e) => handleChange('term', e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* Total Marks */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Marks<span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.totalMarks}
                  onChange={(e) => handleChange('totalMarks', e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>

              {/* Pass Marks */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pass Marks
                </label>
                <input
                  type="number"
                  value={formData.passMarks}
                  onChange={(e) => handleChange('passMarks', e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Assessment Weight */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assessment Weight (Multiplier)<span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                  required
                />
                <p className="text-[10px] text-gray-400">Default is 1.0. Use decimals (e.g., 0.5) to reduce contribution.</p>
              </div>
            </div>

            {/* Subject / Learning Area */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Learning Area (Subject)<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.subject}
                  onChange={(e) => handleChange('subject', e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  required
                  disabled={!formData.grade || loadingLearningAreas}
                >
                  <option value="">
                    {!formData.grade
                      ? 'Select Grade first'
                      : loadingLearningAreas
                        ? 'Loading learning areas...'
                        : gradeLearningAreas.length
                          ? 'Select Learning Area'
                          : 'No learning areas configured for this grade'}
                  </option>
                  {gradeLearningAreas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Performance Level Scale - Full Width */}
            <div className="space-y-1 pt-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Performance Level Scale
              </label>
              <div className="relative">
                <select
                  value={formData.performanceScale}
                  onChange={(e) => handleChange('performanceScale', e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  required
                  disabled
                >
                  <option value="Default (auto per grade)">Default (auto per grade)</option>
                </select>
                <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#1a237e] text-white font-semibold rounded-lg hover:bg-[#151b60] transition-colors shadow-sm flex items-center gap-2 text-sm"
              >
                <Save size={16} />
                Save Configuration
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTestPage;
