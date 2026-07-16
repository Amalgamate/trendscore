import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Heart, Save, Edit3, ArrowRight, Sparkles, ChevronLeft, Target, ShieldCheck, CheckCircle, Flame, Star, StarHalf, Loader2 } from 'lucide-react';
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

const ValuesAssessment = ({ learners }) => {
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
    love: 'ME1',
    responsibility: 'ME1',
    respect: 'ME1',
    unity: 'ME1',
    peace: 'ME1',
    patriotism: 'ME1',
    integrity: 'ME1'
  });

  const [viewMode, setViewMode] = useState('setup'); // 'setup' | 'assess'
  const [saving, setSaving] = useState(false);

  const valueDefinitions = {
    love: { name: 'Love', label: 'Care & Kindness', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50' },
    responsibility: { name: 'Responsibility', label: 'Duty & Reliability', icon: Target, color: 'text-amber-500', bg: 'bg-amber-50' },
    respect: { name: 'Respect', label: 'Dignity & Honor', icon: Star, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    unity: { name: 'Unity', label: 'Harmony & Team', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
    peace: { name: 'Peace', label: 'Resolving Conflict', icon: ShieldCheck, color: 'text-sky-500', bg: 'bg-sky-50' },
    patriotism: { name: 'Patriotism', label: 'Loyalty & Love', icon: StarHalf, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    integrity: { name: 'Integrity', label: 'Honesty & Ethics', icon: CheckCircle, color: 'text-slate-600', bg: 'bg-slate-50' }
  };

  const loadExistingValues = useCallback(async () => {
    if (!selection.selectedLearnerId || !setup.selectedTerm) return;
    try {
      const response = await api.cbc.getValues(selection.selectedLearnerId, {
        term: setup.selectedTerm,
        academicYear: setup.academicYear
      });
      if (response.success && response.data) {
        ratings.setRatings({
          love: response.data.love || 'ME1',
          responsibility: response.data.responsibility || 'ME1',
          respect: response.data.respect || 'ME1',
          unity: response.data.unity || 'ME1',
          peace: response.data.peace || 'ME1',
          patriotism: response.data.patriotism || 'ME1',
          integrity: response.data.integrity || 'ME1'
        });
        if (response.data.comment) ratings.setComment('general', response.data.comment);
      }
    } catch (e) {}
  }, [selection.selectedLearnerId, setup.selectedTerm, setup.academicYear, ratings]);

  useEffect(() => {
    if (viewMode === 'assess') loadExistingValues();
  }, [viewMode, loadExistingValues]);

  const handleSave = async () => {
    if (!selection.selectedLearnerId) { showError('Select learner'); return; }
    setSaving(true);
    try {
      const response = await api.cbc.saveValues({
        learnerId: selection.selectedLearnerId,
        term: setup.selectedTerm,
        academicYear: setup.academicYear,
        ...ratings.ratings,
        comment: ratings.comments.general || ''
      });
      if (response.success) showSuccess('Values saved!');
      else throw new Error(response.message);
    } catch (e) { showError(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="pb-24 font-sans">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8 px-5 pt-4">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
              <Heart size={22} fill="currentColor" />
           </div>
           <div>
              <h2 className="text-xl font-semibold text-gray-900 tracking-tight leading-none">Global Values</h2>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">Character Building</p>
           </div>
        </div>
        {viewMode !== 'setup' && (
           <button
             onClick={handleSave}
             disabled={saving}
             className="w-11 h-11 flex items-center justify-center bg-[var(--brand-teal)] text-white rounded-2xl shadow-lg shadow-teal-50 active:scale-90 transition-all disabled:opacity-30"
           >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
           </button>
        )}
      </div>

      {viewMode === 'setup' && (
        <div className="px-5 space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-transparent shadow-xl shadow-rose-50 p-6 space-y-6">
            <div className="space-y-1">
               <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-widest">Entry Scope</span>
               <h3 className="text-lg font-semibold text-gray-900">Learner Context</h3>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">{labels.learners}</label>
                  <SmartLearnerSearch
                    learners={selection.filteredLearners}
                    selectedLearnerId={selection.selectedLearnerId}
                    onSelect={selection.selectLearner}
                    placeholder={`Search ${labels.learners}...`}
                    className="w-full h-14 pl-4 bg-gray-50 border-none rounded-2xl text-xs font-medium outline-none ring-offset-0 focus:ring-2 focus:ring-rose-100"
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">{labels.term}</label>
                    <select
                      value={setup.selectedTerm}
                      onChange={(e) => setup.updateTerm(e.target.value)}
                      className="w-full h-14 px-4 bg-gray-50 border-none rounded-2xl text-xs font-medium focus:ring-2 focus:ring-rose-500/20"
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
                      className="w-full h-14 px-4 bg-gray-50 border-none rounded-2xl text-xs font-medium"
                    />
                  </div>
               </div>
            </div>
          </div>

          <button
            onClick={() => setViewMode('assess')}
            disabled={!selection.selectedLearnerId}
            className="w-full h-16 bg-rose-500 text-white rounded-[2rem] flex items-center justify-center gap-3 shadow-xl shadow-rose-100 active:scale-95 transition-all outline-none disabled:opacity-30"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] ml-2">Character Audit</span>
            <ArrowRight size={20} strokeWidth={3} />
          </button>
        </div>
      )}

      {viewMode === 'assess' && selection.selectedLearner && (
        <div className="px-5 space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white border-b border-gray-100 py-4 -mx-1 flex items-center justify-between sticky top-0 z-10 transition-all">
             <button onClick={() => setViewMode('setup')} className="p-3 border border-gray-100 rounded-2xl active:scale-90 transition-all">
                <ChevronLeft size={20} className="text-gray-900" />
             </button>
             <div className="text-center flex-1">
                <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-1">Character Record</h4>
                <p className="text-xs font-semibold text-gray-900 truncate px-4">{selection.selectedLearner.firstName} {selection.selectedLearner.lastName}</p>
             </div>
             <div className="w-10" />
          </div>

          <div className="space-y-6">
            {Object.entries(valueDefinitions).map(([key, def]) => {
               const Icon = def.icon;
               return (
                  <div key={key} className="bg-white rounded-[2.5rem] border border-gray-50 p-6 shadow-sm space-y-5">
                     <div className="flex items-center gap-4">
                        <div className={cn("w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-inner", def.bg, def.color)}>
                           <Icon size={24} />
                        </div>
                        <div>
                           <h5 className="text-sm font-semibold text-gray-900">{def.name}</h5>
                           <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tight">{def.label}</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-2">
                        {CBC_RATINGS.map(r => (
                           <button
                             key={r.value}
                             onClick={() => ratings.setRating(key, r.value)}
                             className={cn(
                                "py-4 px-2 rounded-2xl text-[10px] font-semibold uppercase transition-all tracking-tighter border-2",
                                ratings.ratings[key] === r.value 
                                   ? "bg-teal-600 border-transparent text-white shadow-lg shadow-teal-50 scale-[1.02]" 
                                   : "bg-white border-gray-50 text-gray-400 hover:border-teal-100"
                             )}
                           >
                              {r.label}
                           </button>
                        ))}
                     </div>
                  </div>
               );
            })}

            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-6 space-y-4">
               <div className="flex items-center gap-2 ml-2">
                  <Edit3 size={14} className="text-gray-400" />
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Growth Observations</span>
               </div>
               <textarea
                  value={ratings.comments.general || ''}
                  onChange={(e) => ratings.setComment('general', e.target.value)}
                  className="w-full h-32 p-5 bg-gray-50 border-none rounded-[1.5rem] text-xs font-medium outline-none placeholder:text-gray-300 resize-none focus:ring-2 focus:ring-rose-100"
                  placeholder="Summarize character development..."
               />
               <div className="flex justify-center p-2">
                  <Sparkles size={20} className="text-rose-100" />
               </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-6 bg-teal-600 text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-[2rem] shadow-xl shadow-teal-50 active:scale-95 transition-all mb-10"
          >
             Finalize Character Record
          </button>
        </div>
      )}
    </div>
  );
};

export default ValuesAssessment;
