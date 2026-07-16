import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, BookOpen, Edit3, ArrowRight, Sparkles, ChevronLeft, BarChart2, Star, Target, CheckCircle, Check, Users, Loader2, ShieldCheck, Laptop, Zap } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';
import SmartLearnerSearch from '../shared/SmartLearnerSearch';
import { CBC_RATINGS } from '../../../constants/ratings';
import { useAssessmentSetup } from '../hooks/useAssessmentSetup';
import { useLearnerSelection } from '../hooks/useLearnerSelection';
import { useRatings } from '../hooks/useRatings';
import { useTeacherWorkload } from '../hooks/useTeacherWorkload';
import { useInstitutionLabels } from '../../../hooks/useInstitutionLabels';
import { cn } from '../../../utils/cn';

const CoreCompetenciesAssessment = ({ learners }) => {
  const { showSuccess, showError } = useNotifications();
  const labels = useInstitutionLabels();
  const setup = useAssessmentSetup({ defaultTerm: 'TERM_1' });
  const teacherWorkload = useTeacherWorkload();

  const filteredLearnersByRole = useMemo(() => {
    if (!teacherWorkload.isTeacher) return learners || [];
    return (learners || []).filter(l => teacherWorkload.assignedGrades.includes(l.grade));
  }, [learners, teacherWorkload.isTeacher, teacherWorkload.assignedGrades]);

  const selection = useLearnerSelection(filteredLearnersByRole, { status: ['ACTIVE', 'Active'] });
  const ratings = useRatings({
    communication: 'ME1',
    criticalThinking: 'ME1',
    creativity: 'ME1',
    collaboration: 'ME1',
    citizenship: 'ME1',
    learningToLearn: 'ME1',
    digitalLiteracy: 'ME1',
    selfEfficacy: 'ME1'
  });

  const [viewMode, setViewMode] = useState('setup'); // 'setup' | 'assess'
  const [saving, setSaving] = useState(false);

  const competencyDefinitions = {
    communication: { name: 'Communication', label: 'Comm & Collaboration', icon: BarChart2, color: 'text-blue-500', bg: 'bg-blue-50' },
    criticalThinking: { name: 'Critical Thinking', label: 'Logic & Problem Solving', icon: Target, color: 'text-purple-500', bg: 'bg-purple-50' },
    creativity: { name: 'Creativity', label: 'Innovation & Art', icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-50' },
    collaboration: { name: 'Collaboration', label: 'Teamwork & Respect', icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    citizenship: { name: 'Citizenship', label: 'Social & Ethics', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    learningToLearn: { name: 'Learning to Learn', label: 'Self & Research', icon: BookOpen, color: 'text-rose-500', bg: 'bg-rose-50' },
    digitalLiteracy: { name: 'Digital Literacy', label: 'Tech & Digital Tools', icon: Laptop, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    selfEfficacy: { name: 'Self-Efficacy', label: 'Confidence & Resilience', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50' }
  };

  const loadExistingCompetencies = useCallback(async () => {
    if (!selection.selectedLearnerId || !setup.selectedTerm) return;
    try {
      const response = await api.cbc.getCompetencies(selection.selectedLearnerId, {
        term: setup.selectedTerm,
        academicYear: setup.academicYear
      });
      if (response.success && response.data) {
        ratings.setRatings({
          communication: response.data.communication || 'ME1',
          criticalThinking: response.data.criticalThinking || 'ME1',
          creativity: response.data.creativity || 'ME1',
          collaboration: response.data.collaboration || 'ME1',
          citizenship: response.data.citizenship || 'ME1',
          learningToLearn: response.data.learningToLearn || 'ME1',
          digitalLiteracy: response.data.digitalLiteracy || 'ME1',
          selfEfficacy: response.data.selfEfficacy || 'ME1'
        });
        Object.keys(competencyDefinitions).forEach(key => {
           if (response.data[`${key}Comment`]) ratings.setComment(key, response.data[`${key}Comment`]);
        });
      }
    } catch (e) {}
  }, [selection.selectedLearnerId, setup.selectedTerm, setup.academicYear, ratings]);

  useEffect(() => {
    if (viewMode === 'assess') loadExistingCompetencies();
  }, [viewMode, loadExistingCompetencies]);

  useEffect(() => {
    if (teacherWorkload.isTeacher && !teacherWorkload.loading && viewMode === 'setup') {
      if (!setup.selectedGrade && teacherWorkload.primaryGrade) setup.setSelectedGrade(teacherWorkload.primaryGrade);
      if (!setup.selectedStream && teacherWorkload.primaryStream) setup.setSelectedStream(teacherWorkload.primaryStream);
    }
  }, [teacherWorkload.isTeacher, teacherWorkload.loading, teacherWorkload.primaryGrade, teacherWorkload.primaryStream, setup, viewMode]);

  const handleSave = async () => {
    if (!selection.selectedLearnerId) { showError('Select learner'); return; }
    setSaving(true);
    try {
      const response = await api.cbc.saveCompetencies({
        learnerId: selection.selectedLearnerId,
        term: setup.selectedTerm,
        academicYear: setup.academicYear,
        ...ratings.ratings,
        communicationComment: ratings.comments.communication || '',
        criticalThinkingComment: ratings.comments.criticalThinking || '',
        creativityComment: ratings.comments.creativity || '',
        collaborationComment: ratings.comments.collaboration || '',
        citizenshipComment: ratings.comments.citizenship || '',
        learningToLearnComment: ratings.comments.learningToLearn || '',
        digitalLiteracyComment: ratings.comments.digitalLiteracy || '',
        selfEfficacyComment: ratings.comments.selfEfficacy || ''
      });
      if (response.success) showSuccess('Record saved!');
      else throw new Error(response.message);
    } catch (e) { showError(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="pb-24 font-sans">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 px-4 pt-4 sm:px-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Star size={22} fill="currentColor" />
           </div>
           <div>
              <h2 className="text-xl font-semibold text-gray-900 tracking-tight leading-none">Core Competencies</h2>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">Holistic Records</p>
           </div>
        </div>
        {viewMode !== 'setup' && (
           <button
             onClick={handleSave}
             disabled={saving}
             className="w-11 h-11 flex items-center justify-center bg-[var(--brand-purple)] text-white rounded-2xl shadow-lg shadow-purple-50 active:scale-90 transition-all disabled:opacity-30"
           >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
           </button>
        )}
      </div>

      {viewMode === 'setup' && (
        <div className="px-4 sm:px-6 space-y-4 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="space-y-1">
               <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">Stage 01</span>
               <h3 className="text-lg font-semibold text-gray-900">Define Scope</h3>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">{labels.learners}</label>
                  <SmartLearnerSearch
                    learners={selection.filteredLearners}
                    selectedLearnerId={selection.selectedLearnerId}
                    onSelect={selection.selectLearner}
                    placeholder={`Find ${labels.learners}...`}
                    compact
                    inputClassName="h-12 bg-gray-50"
                  />
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">{labels.term}</label>
                    <select
                      value={setup.selectedTerm}
                      onChange={(e) => setup.updateTerm(e.target.value)}
                      className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {setup.terms.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Year</label>
                    <input
                      type="number"
                      value={setup.academicYear}
                      onChange={(e) => setup.updateAcademicYear(parseInt(e.target.value))}
                      className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium"
                    />
                  </div>
               </div>
            </div>
          </div>

          <button
            onClick={() => setViewMode('assess')}
            disabled={!selection.selectedLearnerId}
            className="w-full sm:w-auto sm:min-w-56 h-12 sm:ml-auto bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all outline-none disabled:opacity-30"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] ml-2">Begin Grading</span>
            <ArrowRight size={20} strokeWidth={3} />
          </button>
        </div>
      )}

      {viewMode === 'assess' && selection.selectedLearner && (
        <div className="px-4 sm:px-6 space-y-4 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between sticky top-3 z-10 shadow-sm transition-all">
             <button onClick={() => setViewMode('setup')} className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg active:scale-90 transition-all">
                <ChevronLeft size={20} className="text-gray-900" />
             </button>
             <div className="text-center flex-1">
                <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-1">{labels.term} {setup.selectedTerm.split('_')[1]}</h4>
                <p className="text-xs font-semibold text-gray-900 truncate px-4">{selection.selectedLearner.firstName} {selection.selectedLearner.lastName}</p>
             </div>
             <div className="w-10" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Object.entries(competencyDefinitions).map(([key, def]) => {
               const Icon = def.icon;
               return (
                  <div key={key} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
                     <div className="flex items-center gap-4">
                        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", def.bg, def.color)}>
                           <Icon size={22} />
                        </div>
                        <div>
                           <h5 className="text-sm font-semibold text-gray-900">{def.name}</h5>
                           <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tight">{def.label}</p>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                           {CBC_RATINGS.map(r => (
                              <button
                                key={r.value}
                                onClick={() => ratings.setRating(key, r.value)}
                                className={cn(
                                   "min-h-10 px-2 rounded-lg text-[10px] font-semibold uppercase transition-all tracking-tighter border",
                                   ratings.ratings[key] === r.value 
                                      ? "bg-indigo-600 border-transparent text-white shadow-lg shadow-indigo-100 scale-[1.02]" 
                                      : "bg-white border-gray-50 text-gray-400 hover:border-indigo-100"
                                )}
                              >
                                 {r.label}
                              </button>
                           ))}
                        </div>

                        <div className="relative">
                           <textarea
                              value={ratings.comments[key] || ''}
                              onChange={(e) => ratings.setComment(key, e.target.value)}
                              className="w-full h-20 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none placeholder:text-gray-300 resize-none focus:ring-2 focus:ring-indigo-100"
                              placeholder="Describe demonstrated abilities..."
                           />
                           <Sparkles size={14} className="absolute bottom-4 right-4 text-gray-200" />
                        </div>
                     </div>
                  </div>
               );
            })}
          </div>

          <div className="bg-white rounded-2xl p-6 text-center space-y-5 shadow-sm border border-gray-200 mb-10">
             <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-500">
                <CheckCircle size={32} strokeWidth={1.5} />
             </div>
             <div className="space-y-1">
                <h4 className="text-lg font-semibold text-gray-900">Entries Complete?</h4>
                <p className="text-xs text-gray-400 font-medium leading-relaxed px-6">Review your ratings and comments above before finalizing this session.</p>
             </div>
             <button
               onClick={handleSave}
               disabled={saving}
               className="w-full sm:w-auto sm:min-w-56 h-12 bg-indigo-600 text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-xl shadow-sm active:scale-95 transition-all"
             >
                Save Final Record
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoreCompetenciesAssessment;
