import React from 'react';
import { ArrowLeft, Check, AlertCircle, Loader } from 'lucide-react';
import { useSummativeTestForm } from '../../hooks/useSummativeTestForm';
import { useAuth } from '../../hooks/useAuth';
import { useInstitutionLabels } from '../../hooks/useInstitutionLabels';
import { cn } from '../../utils/cn';

const SummativeTestFormMobile = ({ onBack, onSuccess, initialTestType = null, initialData = null }) => {
  const { user } = useAuth();
  const labels = useInstitutionLabels();
  const {
    formData,
    scales,
    grades,
    terms,
    errors,
    saveStatus,
    saving,
    loadingScales,
    loadingGrades,
    testTypes,
    availableLearningAreas,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    getSelectedScale
  } = useSummativeTestForm({ initialTestType, initialData });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const createdTest = await originalHandleSubmit(e);
      if (createdTest && onSuccess) {
        onSuccess(createdTest);
      }
    } catch (error) {
      // Error already handled in hook
    }
  };

  const inputClass = (error) => cn(
    "w-full px-4 py-3 bg-white border rounded-xl text-base transition-all duration-200 outline-none",
    "focus:ring-2 focus:ring-[var(--brand-purple)]/20 focus:border-[var(--brand-purple)] shadow-sm",
    error ? "border-rose-500 bg-rose-50/10 text-rose-600" : "border-gray-200 text-gray-900 group-hover:border-gray-300"
  );

  const labelClass = "block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 ml-1";

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-[100] w-screen h-screen font-sans">
      {/* Header - Premium Minimal */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 flex-shrink-0">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2.5 hover:bg-gray-100 rounded-2xl transition-all active:scale-90"
                type="button"
                aria-label="Go back"
              >
                <ArrowLeft size={22} className="text-gray-900" />
              </button>
            )}
            <div>
               <h1 className="text-xl font-semibold text-gray-900 tracking-tight leading-none">Create Test</h1>
               <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">Academic Assessment</p>
            </div>
          </div>
          {saveStatus === 'success' && (
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center animate-in zoom-in duration-300">
              <Check size={18} strokeWidth={3} />
            </div>
          )}
        </div>
      </div>

      {/* Form - Main Content (Scrollable) */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pt-6 pb-32">
        <div className="px-5 space-y-6">
          {/* Status Messages */}
          {saveStatus === 'error' && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-rose-900 uppercase tracking-tight">Access Denied / Save Failed</p>
                  <p className="text-xs text-rose-700 font-medium">{errors.submit || 'Please verify the missing fields below'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Test Name */}
          <div className="group">
            <label className={labelClass}>
              Test Title<span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={inputClass(errors.title)}
              placeholder="e.g., Mathematics CAT 1"
            />
            {errors.title && (
              <p className="text-rose-600 text-[10px] font-medium mt-1.5 ml-1 uppercase tracking-wider">{errors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Type */}
            <div>
              <label className={labelClass}>
                Assessment Type<span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className={inputClass(errors.type)}
              >
                <option value="">Select Category</option>
                {testTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {errors.type && (
                <p className="text-rose-600 text-[10px] font-medium mt-1.5 ml-1 uppercase tracking-wider">{errors.type}</p>
              )}
            </div>

            {/* Grade */}
            <div>
              <label className={labelClass}>
                {labels.grade}<span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.grade}
                onChange={(e) => handleInputChange('grade', e.target.value)}
                className={inputClass(errors.grade)}
                disabled={loadingGrades}
              >
                {loadingGrades ? (
                  <option value="">Loading {labels.grades.toLowerCase()}...</option>
                ) : grades.length === 0 ? (
                  <option value="">No {labels.grades.toLowerCase()} available</option>
                ) : (
                  <>
                    <option value="">Select {labels.grade}</option>
                    {grades.map(grade => (
                      <option key={grade} value={grade}>
                        {grade.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {errors.grade && (
                <p className="text-rose-600 text-[10px] font-medium mt-1.5 ml-1 uppercase tracking-wider">{errors.grade}</p>
              )}
            </div>
          </div>

          {/* Learning Area */}
          <div>
            <label className={labelClass}>
              {labels.subject}<span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.learningArea}
              onChange={(e) => handleInputChange('learningArea', e.target.value)}
              className={inputClass(errors.learningArea)}
              disabled={!formData.grade}
            >
              <option value="">{formData.grade ? `Select ${labels.subject}` : `Select ${labels.grade} first`}</option>
              {formData.grade && availableLearningAreas.map(area => (
                <option key={area.id || area.name} value={area.name}>{area.name}</option>
              ))}
            </select>
            {errors.learningArea && (
              <p className="text-rose-600 text-[10px] font-medium mt-1.5 ml-1 uppercase tracking-wider">{errors.learningArea}</p>
            )}
          </div>

          {/* Academic Term */}
          <div>
            <label className={labelClass}>
              {labels.term}<span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.term}
              onChange={(e) => handleInputChange('term', e.target.value)}
              className={inputClass(errors.term)}
              disabled={loadingGrades}
            >
              <option value="">Select Active {labels.term}</option>
              {terms.map(term => (
                <option key={term.value} value={term.value}>{term.label}</option>
              ))}
            </select>
            {errors.term && (
              <p className="text-rose-600 text-[10px] font-medium mt-1.5 ml-1 uppercase tracking-wider">{errors.term}</p>
            )}
          </div>

          {/* Scale */}
          <div>
            <label className={labelClass}>Performance Standard</label>
            <select
              value={formData.scaleId}
              onChange={(e) => handleInputChange('scaleId', e.target.value)}
              className={inputClass()}
              disabled={loadingScales}
            >
              {loadingScales ? (
                <option value="">Loading criteria...</option>
              ) : scales.length === 0 ? (
                <option value="">No standards available</option>
              ) : (
                <>
                  <option value="">Select Grading Standard</option>
                  {scales
                    .filter(s => {
                      if (s.type !== 'SUMMATIVE') return false;
                      if (!formData.grade) return true;
                      return s.grade === formData.grade ||
                        (s.name && s.name.toUpperCase().includes(formData.grade.toUpperCase().replace(/_/g, ' ')));
                    })
                    .map(scale => (
                      <option key={scale.id} value={scale.id}>{scale.name}</option>
                    ))}
                </>
              )}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Instructions / Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={cn(inputClass(), "min-h-[120px] pt-4 resize-none")}
              placeholder="Additional assessment details or teacher notes..."
            />
          </div>
        </div>
      </form>

      {/* Footer - Premium Action Dock */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex gap-4 z-50">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Discard draft and exit?')) {
              if (onBack) onBack();
            }
          }}
          className="flex-1 px-4 py-4 border border-gray-100 bg-gray-50 text-gray-600 font-medium rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest"
          disabled={saving}
        >
          Discard
        </button>
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={saving}
          className={cn(
            "flex-[2] px-4 py-4 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] shadow-xl",
            saving ? "bg-gray-400" : "bg-[var(--brand-purple)] hover:brightness-110 active:scale-95 shadow-purple-100"
          )}
        >
          {saving ? (
            <>
              <Loader size={18} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : saveStatus === 'success' ? (
            <>
              <Check size={18} strokeWidth={3} />
              <span>Confirmed</span>
            </>
          ) : (
            'Finalize Test'
          )}
        </button>
      </div>
    </div>
  );
};

export default SummativeTestFormMobile;
