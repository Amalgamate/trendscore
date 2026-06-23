import React from 'react';
import { Save, AlertCircle, Loader } from 'lucide-react';
import { DatePicker } from '../../components/ui/date-picker';
import { useCoreCompetencies } from '../../hooks/useCoreCompetencies';

const CoreCompetenciesFormDesktop = ({ onBack, onSuccess }) => {
  const {
    formData,
    errors,
    saveStatus,
    loading,
    ratingScale,
    grades,
    terms,
    academicYears,
    handleInputChange,
    handleCompetencyChange,
    competencyFields,
    handleSubmit: originalHandleSubmit
  } = useCoreCompetencies();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await originalHandleSubmit(e);
      if (result && onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Back
            </button>
          )}
          <h1 className="text-3xl font-medium text-gray-900">Core Competencies Assessment</h1>
          {saveStatus === 'success' && (
            <div className="text-green-600 text-sm font-medium">✓ Saved</div>
          )}
        </div>
        <p className="text-gray-600">Assess student competencies across six core areas</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Error Alert */}
        {saveStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Error Saving Assessment</p>
                <p className="text-sm text-red-700 mt-1">{errors.submit || 'Please check all required fields'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Student Information - 2 columns */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h2>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Learner ID<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.learnerId}
                onChange={(e) => handleInputChange('learnerId', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition ${errors.learnerId ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                placeholder="Learner ID"
              />
              {errors.learnerId && (
                <p className="text-red-600 text-xs mt-1">{errors.learnerId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Learner Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.learnerName}
                onChange={(e) => handleInputChange('learnerName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition ${errors.learnerName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                placeholder="Full name"
              />
              {errors.learnerName && (
                <p className="text-red-600 text-xs mt-1">{errors.learnerName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assessment Date
              </label>
              <DatePicker
                value={formData.assessmentDate}
                onChange={(val) => handleInputChange('assessmentDate', val)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade<span className="text-red-500">*</span>
              </label>
              <select
                value={formData.grade}
                onChange={(e) => handleInputChange('grade', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition ${errors.grade ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
              >
                <option value="">Select Grade</option>
                {grades.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {errors.grade && (
                <p className="text-red-600 text-xs mt-1">{errors.grade}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Term<span className="text-red-500">*</span>
              </label>
              <select
                value={formData.term}
                onChange={(e) => handleInputChange('term', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition ${errors.term ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
              >
                <option value="">Select Term</option>
                {terms.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {errors.term && (
                <p className="text-red-600 text-xs mt-1">{errors.term}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Year<span className="text-red-500">*</span>
              </label>
              <select
                value={formData.academicYear}
                onChange={(e) => handleInputChange('academicYear', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition ${errors.academicYear ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
              >
                <option value="">Select Year</option>
                {academicYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {errors.academicYear && (
                <p className="text-red-600 text-xs mt-1">{errors.academicYear}</p>
              )}
            </div>
          </div>
        </div>

        {/* Competencies - Table View */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Core Competencies</h2>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Competency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Evidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Comment</th>
                </tr>
              </thead>
              <tbody>
                {competencyFields.map((field, idx) => (
                  <tr key={field.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{field.label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={formData[field.key]}
                        onChange={(e) => handleCompetencyChange(field.key, e.target.value)}
                        className={`px-2 py-1 border rounded text-xs focus:ring-2 focus:ring-teal-500 transition ${errors[field.key] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                      >
                        <option value="">Select</option>
                        {ratingScale.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      {errors[field.key] && (
                        <p className="text-red-600 text-xs mt-1">{errors[field.key]}</p>
                      )}
                    </td>
                    <td className="px-4 py-3" colSpan={2}>
                      <textarea
                        value={formData[field.commentKey]}
                        onChange={(e) => handleCompetencyChange(field.commentKey, e.target.value)}
                        className={`w-full px-2 py-1 border rounded text-xs h-20 resize-none focus:ring-2 focus:ring-teal-500 transition ${errors[field.commentKey] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                        placeholder="Evidence and observations..."
                      />
                      {errors[field.commentKey] && (
                        <p className="text-red-600 text-xs mt-1">{errors[field.commentKey]}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overall Assessment */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Assessment</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overall Comment<span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.overallComment}
                onChange={(e) => handleInputChange('overallComment', e.target.value)}
                placeholder="Provide overall assessment summary..."
                className={`w-full px-3 py-2 border rounded-lg text-sm resize-none h-32 focus:ring-2 focus:ring-teal-500 transition ${errors.overallComment ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
              />
              {errors.overallComment && (
                <p className="text-red-600 text-xs mt-1">{errors.overallComment}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Steps
              </label>
              <textarea
                value={formData.nextSteps}
                onChange={(e) => handleInputChange('nextSteps', e.target.value)}
                placeholder="Recommendations for next term..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-32 focus:ring-2 focus:ring-teal-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 rounded-lg p-6 flex gap-4 justify-end">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition disabled:text-gray-400"
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || saveStatus === 'saving'}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition disabled:bg-gray-400 flex items-center gap-2"
          >
            {loading || saveStatus === 'saving' ? (
              <>
                <Loader size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Assessment
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CoreCompetenciesFormDesktop;
