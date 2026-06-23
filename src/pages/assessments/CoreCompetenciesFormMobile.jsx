import React, { useState } from 'react';
import { ArrowLeft, Check, AlertCircle, Loader, ChevronUp, ChevronDown } from 'lucide-react';
import { DatePicker } from '../../components/ui/date-picker';
import { useCoreCompetencies } from '../../hooks/useCoreCompetencies';
import { useInstitutionLabels } from '../../hooks/useInstitutionLabels';
import { cn } from '../../utils/cn';

const CoreCompetenciesFormMobile = ({ onBack, onSuccess }) => {
  const labels = useInstitutionLabels();
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

  const [expandedCompetency, setExpandedCompetency] = useState(null);

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

  const toggleCompetency = (id) => {
    setExpandedCompetency(expandedCompetency === id ? null : id);
  };

  const inputClass = (error) => cn(
    "w-full px-4 py-3 bg-white border rounded-xl text-base transition-all duration-200 outline-none",
    "focus:ring-2 focus:ring-[var(--brand-purple)]/20 focus:border-[var(--brand-purple)] shadow-sm",
    error ? "border-rose-500 bg-rose-50/10 text-rose-600" : "border-gray-200 text-gray-900"
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
               <h1 className="text-xl font-semibold text-gray-900 tracking-tight leading-none">Values & Skills</h1>
               <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">Core Competencies</p>
            </div>
          </div>
          {saveStatus === 'success' && (
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center animate-in zoom-in duration-300">
              <Check size={18} strokeWidth={3} />
            </div>
          )}
        </div>
      </div>

      {/* Main Form - Scrollable */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pt-6 pb-32">
        <div className="px-5 space-y-8">
          {/* Error Alert */}
          {saveStatus === 'error' && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-rose-900 uppercase tracking-tight">Save Failed</p>
                  <p className="text-xs text-rose-700 font-medium">{errors.submit || 'Please check all required fields'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Student Info Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
               <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">{labels.student} Info</h2>
               <div className="h-[1px] flex-1 bg-gray-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className={labelClass}>UID/Admission<span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={formData.learnerId}
                  onChange={(e) => handleInputChange('learnerId', e.target.value)}
                  className={inputClass(errors.learnerId)}
                  placeholder="ID Number"
                />
              </div>
              <div>
                <label className={labelClass}>{labels.grade}<span className="text-rose-500">*</span></label>
                <select
                  value={formData.grade}
                  onChange={(e) => handleInputChange('grade', e.target.value)}
                  className={inputClass(errors.grade)}
                >
                  <option value="">Select</option>
                  {grades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>{labels.student} Name<span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={formData.learnerName}
                onChange={(e) => handleInputChange('learnerName', e.target.value)}
                className={inputClass(errors.learnerName)}
                placeholder="Full official name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className={labelClass}>{labels.term}<span className="text-rose-500">*</span></label>
                <select
                  value={formData.term}
                  onChange={(e) => handleInputChange('term', e.target.value)}
                  className={inputClass(errors.term)}
                >
                  <option value="">Select</option>
                  {terms.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Year<span className="text-rose-500">*</span></label>
                <select
                  value={formData.academicYear}
                  onChange={(e) => handleInputChange('academicYear', e.target.value)}
                  className={inputClass(errors.academicYear)}
                >
                  <option value="">Select</option>
                  {academicYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Assessment Date</label>
              <DatePicker
                value={formData.assessmentDate}
                onChange={(val) => handleInputChange('assessmentDate', val)}
                className="w-full"
              />
            </div>
          </div>

          {/* Competencies Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
               <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">Core {labels.subjects}</h2>
               <div className="h-[1px] flex-1 bg-gray-100" />
            </div>

            {competencyFields.map((field) => (
              <div key={field.key} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleCompetency(field.key)}
                  className="w-full px-5 py-5 flex items-start justify-between hover:bg-gray-50 transition-all active:scale-[0.98] text-left"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[var(--brand-purple)] transition-colors">{field.label}</h3>

                    {formData[field.key] && (
                      <div className="mt-2.5">
                        <span className={cn(
                          "text-[10px] font-semibold px-3 py-1 rounded-full inline-block uppercase tracking-wider",
                          formData[field.key].startsWith('EE') ? 'bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-100 border border-emerald-100' :
                          formData[field.key].startsWith('ME') ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100 border border-blue-100' :
                          formData[field.key].startsWith('AE') ? 'bg-amber-50 text-amber-600 shadow-sm shadow-amber-100 border border-amber-100' :
                          'bg-rose-50 text-rose-600 shadow-sm shadow-rose-100 border border-rose-100'
                        )}>
                          {ratingScale.find(r => r.value === formData[field.key])?.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 ml-3 mt-1 text-gray-300">
                    {expandedCompetency === field.key ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                </button>

                {expandedCompetency === field.key && (
                  <div className="px-5 pb-6 space-y-6 bg-gray-50/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                      <label className={labelClass}>Select Rating<span className="text-rose-500">*</span></label>
                      <div className="grid grid-cols-2 gap-3">
                        {ratingScale.map(rating => (
                          <button
                            key={rating.value}
                            type="button"
                            onClick={() => handleCompetencyChange(field.key, rating.value)}
                            className={cn(
                              "p-3.5 rounded-2xl text-center border-2 transition-all active:scale-95",
                              formData[field.key] === rating.value
                                ? "bg-white border-[var(--brand-purple)] shadow-xl shadow-purple-100 ring-4 ring-purple-50"
                                : "bg-white border-transparent hover:border-gray-100 shadow-sm"
                            )}
                          >
                            <div className={cn(
                                "text-sm font-semibold mb-0.5",
                                formData[field.key] === rating.value ? "text-[var(--brand-purple)]" : "text-gray-900"
                            )}>{rating.value}</div>
                            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">{rating.label.split(' ')[0]}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Observation Evidence<span className="text-rose-500">*</span></label>
                      <textarea
                        value={formData[field.commentKey]}
                        onChange={(e) => handleCompetencyChange(field.commentKey, e.target.value)}
                        placeholder="Detail specific behaviours observed..."
                        className={cn(inputClass(errors[field.commentKey]), "min-h-[100px] pt-4 resize-none")}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Overall Comments */}
          <div className="space-y-6 mb-12">
             <div className="flex items-center gap-4 mb-2">
               <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">Overall Performance</h2>
               <div className="h-[1px] flex-1 bg-gray-100" />
            </div>

            <div>
              <label className={labelClass}>Teacher Assessment Summary<span className="text-rose-500">*</span></label>
              <textarea
                value={formData.overallComment}
                onChange={(e) => handleInputChange('overallComment', e.target.value)}
                placeholder="Final summary of pupil performance..."
                className={cn(inputClass(errors.overallComment), "min-h-[120px] pt-4 resize-none")}
              />
            </div>

            <div>
              <label className={labelClass}>Recommendation <span className="text-gray-400 font-normal opacity-60">(Optional)</span></label>
              <textarea
                value={formData.nextSteps}
                onChange={(e) => handleInputChange('nextSteps', e.target.value)}
                placeholder="Suggested areas for home-support or next term..."
                className={cn(inputClass(), "min-h-[100px] pt-4 resize-none")}
              />
            </div>
          </div>
        </div>
      </form>

      {/* Footer - Premium Action Dock */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex gap-4 z-50">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-4 py-4 border border-gray-100 bg-gray-50 text-gray-600 font-medium rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || saveStatus === 'saving'}
          className={cn(
            "flex-[2] px-4 py-4 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] shadow-xl",
            loading || saveStatus === 'saving' ? "bg-gray-400" : "bg-[var(--brand-teal)] hover:brightness-110 active:scale-95 shadow-teal-100"
          )}
        >
          {loading || saveStatus === 'saving' ? (
            <>
              <Loader size={18} className="animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            'Commit Record'
          )}
        </button>
      </div>
    </div>
  );
};

export default CoreCompetenciesFormMobile;
