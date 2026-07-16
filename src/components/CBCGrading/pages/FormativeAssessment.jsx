import React, { useState } from 'react';
import { CheckCircle, Check, Send, Save, ArrowRight, Edit3, FileText, Users, BarChart2, Sparkles, Loader2, Target, ChevronLeft } from 'lucide-react';
import RatingSelector from '../shared/RatingSelector';
import { useNotifications } from '../hooks/useNotifications';
import api, { aiAPI } from '../../../services/api';
import SmartLearnerSearch from '../shared/SmartLearnerSearch';
import { useAssessmentSetup } from '../hooks/useAssessmentSetup';
import { useLearnerSelection } from '../hooks/useLearnerSelection';
import { useLearningAreas } from '../hooks/useLearningAreas';
import { useTeacherWorkload } from '../hooks/useTeacherWorkload';
import { useInstitutionLabels } from '../../../hooks/useInstitutionLabels';
import { cn } from '../../../utils/cn';

const FormativeAssessment = ({ learners }) => {
  const { showSuccess, showError } = useNotifications();
  const labels = useInstitutionLabels();

  const setup = useAssessmentSetup({ defaultTerm: 'TERM_1' });
  const selection = useLearnerSelection(learners || [], { status: ['ACTIVE', 'Active'] });
  const learningAreas = useLearningAreas(setup.selectedGrade);
  const teacherWorkload = useTeacherWorkload();

  const [viewMode, setViewMode] = useState('setup'); // 'setup' | 'assess' | 'review'
  const [selectedArea, setSelectedArea] = useState('Mathematics');
  const [strand, setStrand] = useState('Numbers');
  const [subStrand, setSubStrand] = useState('Addition and Subtraction');

  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [assessmentType, setAssessmentType] = useState('QUIZ');
  const [assessmentWeight, setAssessmentWeight] = useState(1.0);
  const [maxScore, setMaxScore] = useState(null);

  const [assessments, setAssessments] = useState({});
  const [savedAssessments, setSavedAssessments] = useState({});
  const [saving, setSaving] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState({});
  const [generatingAI, setGeneratingAI] = useState({});

  const grades = setup.grades || [];
  const setSelectedGrade = setup.updateGrade;
  const selectedGrade = setup.selectedGrade;
  const setSelectedTerm = setup.updateTerm;
  const selectedTerm = setup.selectedTerm;
  const terms = setup.terms;
  const academicYear = setup.academicYear;
  const searchLearnerId = selection.selectedLearnerId;
  const setSearchLearnerId = selection.selectLearner;

  const filteredGrades = React.useMemo(() => {
    if (!teacherWorkload.isTeacher) return grades;
    return grades.filter(g => teacherWorkload.assignedGrades.includes(g.value));
  }, [grades, teacherWorkload.isTeacher, teacherWorkload.assignedGrades]);

  const filteredLearningAreasByWorkload = React.useMemo(() => {
    const areas = learningAreas.flatLearningAreas;
    if (!teacherWorkload.isTeacher || !selectedGrade) return areas;

    const assignedSubjects = teacherWorkload.getAssignedSubjectsForGrade(selectedGrade);
    if (!assignedSubjects) return areas;

    const normalize = (val) => String(val || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '').trim();

    return areas.filter(area =>
      assignedSubjects.some(as => normalize(as) === normalize(area))
    );
  }, [learningAreas.flatLearningAreas, teacherWorkload.isTeacher, selectedGrade, teacherWorkload]);

  React.useEffect(() => {
    if (selectedGrade && filteredLearningAreasByWorkload.length > 0) {
      const isValid = filteredLearningAreasByWorkload.includes(selectedArea);
      if (!isValid) {
        setSelectedArea('');
        learningAreas.setSelectedLearningArea('');
      }
    } else if (!selectedGrade) {
      setSelectedArea('');
      learningAreas.setSelectedLearningArea('');
    }
  }, [selectedGrade, filteredLearningAreasByWorkload]);

  React.useEffect(() => {
    if (viewMode === 'assess' && selectedGrade && selectedTerm && selectedArea && strand) {
      const fetchData = async () => {
        try {
          const response = await api.assessments.getFormativeAssessments({
            grade: selectedGrade,
            term: selectedTerm,
            academicYear: academicYear,
            learningArea: selectedArea,
            strand: strand
          });

          if (response.success && Array.isArray(response.data)) {
            const loadedAssessments = {};
            const loadedSaved = {};

            response.data.forEach(item => {
              if (item.learnerId) {
                loadedAssessments[item.learnerId] = {
                  detailedRating: item.detailedRating,
                  points: item.points,
                  percentage: item.percentage,
                  strengths: item.strengths,
                  areasImprovement: item.areasImprovement,
                  recommendations: item.remarks
                };
                loadedSaved[item.learnerId] = {
                  id: item.id,
                  learnerId: item.learnerId,
                  status: item.status || 'DRAFT'
                };
              }
            });

            setAssessments(prev => ({ ...prev, ...loadedAssessments }));
            setSavedAssessments(prev => ({ ...prev, ...loadedSaved }));
          }
        } catch (err) { }
      };
      fetchData();
    }
  }, [viewMode, selectedGrade, selectedTerm, selectedArea, strand, academicYear]);

  const classLearners = learners?.filter(l =>
    l.grade === selectedGrade && (l.status === 'ACTIVE' || l.status === 'Active')
  ) || [];

  const filteredLearners = classLearners.filter(l => {
    if (!searchLearnerId) return true;
    return l.id === searchLearnerId;
  });

  const goToNextStep = () => {
    if (viewMode === 'setup') {
      if (!assessmentTitle) { showError('Please enter an Assessment Title'); return; }
      if (!strand) { showError(`Please enter a Strand to continue`); return; }
    }
    if (viewMode === 'setup') setViewMode('assess');
    else if (viewMode === 'assess') setViewMode('review');
    window.scrollTo(0, 0);
  };

  const goToPrevStep = () => {
    if (viewMode === 'assess') setViewMode('setup');
    else if (viewMode === 'review') setViewMode('assess');
    window.scrollTo(0, 0);
  };

  const handleLearnerSelect = (id) => selection.selectLearner(id);

  const handleRatingChange = (learnerId, code, points, percentage) => {
    setAssessments(prev => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        detailedRating: code,
        points,
        percentage: Math.round(percentage),
        strengths: prev[learnerId]?.strengths || '',
        areasImprovement: prev[learnerId]?.areasImprovement || '',
        recommendations: prev[learnerId]?.recommendations || ''
      }
    }));
  };

  const handleFeedbackChange = (learnerId, field, value) => {
    setAssessments(prev => ({
      ...prev,
      [learnerId]: { ...prev[learnerId], [field]: value }
    }));
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const resultsToSave = Object.entries(assessments)
        .filter(([, assessment]) => assessment.detailedRating)
        .map(([learnerId, assessment]) => ({
          learnerId,
          detailedRating: assessment.detailedRating,
          percentage: assessment.percentage,
          points: assessment.points,
          strengths: assessment.strengths,
          areasImprovement: assessment.areasImprovement,
          recommendations: assessment.recommendations
        }));

      if (resultsToSave.length === 0) {
        showError('Select scores before saving');
        return;
      }

      const response = await api.assessments.recordFormativeBulk({
        results: resultsToSave,
        term: selectedTerm,
        academicYear,
        learningArea: selectedArea,
        strand,
        subStrand,
        title: assessmentTitle,
        type: assessmentType,
        weight: assessmentWeight,
        maxScore
      });

      if (response.success) {
        showSuccess('Saved successfully!');
        const newSaved = {};
        (response.saved || []).forEach(item => newSaved[item.learnerId] = { id: item.id, learnerId: item.learnerId, status: item.status || 'DRAFT' });
        setSavedAssessments(prev => ({ ...prev, ...newSaved }));
      } else {
        showError(response.message || 'Failed to save');
      }
    } catch (error) {
      showError('Internal Server Error');
    } finally {
      setSaving(false);
    }
  };

  const handleSendWhatsApp = async (learnerId) => {
    try {
      setSendingWhatsApp(prev => ({ ...prev, [learnerId]: true }));
      const response = await api.notifications.sendAssessmentNotification({
        learnerId,
        assessmentType: 'Formative',
        subject: selectedArea,
        grade: selectedGrade,
        term: selectedTerm
      });
      if (response.success) showSuccess('WhatsApp message sent!');
      else showError('Failed to send notification');
    } catch (error) {
      showError('Notification Service Error');
    } finally {
      setSendingWhatsApp(prev => ({ ...prev, [learnerId]: false }));
    }
  };

  const handleGenerateAIFeedback = async (learnerId) => {
    try {
      setGeneratingAI(prev => ({ ...prev, [learnerId]: true }));
      const response = await aiAPI.generateFeedback(learnerId, selectedTerm, academicYear);
      if (response.success && response.data) {
        setAssessments(prev => ({
          ...prev,
          [learnerId]: { ...prev[learnerId], recommendations: response.data }
        }));
        showSuccess('AI feedback generated!');
      }
    } catch (error) {
      showError('AI Service currently unavailable');
    } finally {
      setGeneratingAI(prev => ({ ...prev, [learnerId]: false }));
    }
  };

  const stats = {
    total: classLearners.length,
    assessed: Object.keys(assessments).filter(id => assessments[id]?.detailedRating).length,
    saved: Object.keys(savedAssessments).filter(id => savedAssessments[id]).length,
  };

  return (
    <div className="pb-24 font-sans">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 px-4 pt-4 sm:px-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[var(--brand-purple)]">
              <Sparkles size={22} />
           </div>
           <div>
              <h2 className="text-xl font-semibold text-gray-900 tracking-tight leading-none">Formative</h2>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">Continuous Assessment</p>
           </div>
        </div>
        <div className="flex items-center gap-1">
           {[1,2,3].map(s => (
              <div key={s} className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                (viewMode === 'setup' && s === 1) || (viewMode === 'assess' && s === 2) || (viewMode === 'review' && s === 3)
                   ? "w-8 bg-[var(--brand-purple)]" 
                   : "w-2 bg-gray-100"
              )} />
           ))}
        </div>
      </div>

      {/* ── STEP 1: SETUP ── */}
      {viewMode === 'setup' && (
        <div className="px-4 sm:px-6 space-y-4 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="space-y-1">
               <span className="text-[10px] font-semibold text-[var(--brand-teal)] uppercase tracking-widest">Stage 01</span>
               <h3 className="text-lg font-semibold text-gray-900">Configure Context</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">{labels.grade}</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-100 outline-none"
                >
                  {filteredGrades.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">{labels.term}</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-100 outline-none"
                >
                  {terms.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">{labels.subject}</label>
              <select
                value={selectedArea}
                onChange={(e) => { setSelectedArea(e.target.value); learningAreas.selectLearningArea(e.target.value); }}
                className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-100 outline-none"
              >
                <option value="">Select Area</option>
                {filteredLearningAreasByWorkload.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Test Title</label>
               <input
                 type="text"
                 value={assessmentTitle}
                 onChange={(e) => setAssessmentTitle(e.target.value)}
                 className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-100 outline-none"
                 placeholder="e.g. Oral Addition Test"
               />
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Topic / Strand</label>
               <input
                 type="text"
                 value={strand}
                 onChange={(e) => setStrand(e.target.value)}
                 className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-100 outline-none"
                 placeholder="e.g. Basic Operations"
               />
            </div>
          </div>

          <button
            onClick={goToNextStep}
            className="w-full sm:w-auto sm:min-w-56 h-12 sm:ml-auto bg-[var(--brand-purple)] text-white rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all outline-none"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] ml-2">Begin Entry</span>
            <ArrowRight size={20} strokeWidth={3} />
          </button>
        </div>
      )}

      {/* ── STEP 2: ASSESS ── */}
      {viewMode === 'assess' && (
        <div className="space-y-4 px-4 sm:px-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between sticky top-3 z-10 shadow-sm">
             <button onClick={goToPrevStep} className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg active:scale-90 transition-all">
                <ChevronLeft size={20} className="text-gray-900" />
             </button>
             <div className="text-center flex-1">
                <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{selectedGrade} • {selectedArea}</h4>
                <p className="text-xs font-semibold text-gray-900 truncate px-4">{strand}</p>
             </div>
             <button onClick={handleSaveAll} disabled={saving} className="w-10 h-10 flex items-center justify-center bg-[var(--brand-teal)] text-white rounded-lg shadow-sm active:scale-90 transition-all disabled:opacity-30">
                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
             </button>
          </div>

          <div className="space-y-4">
             <div className="bg-white border border-gray-200 rounded-xl p-4">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Filter {labels.learners}</label>
                <SmartLearnerSearch
                  learners={classLearners}
                  selectedLearnerId={searchLearnerId}
                  onSelect={handleLearnerSelect}
                  placeholder={`Search ${labels.learners}...`}
                  compact
                  inputClassName="h-12 bg-gray-50"
                />
             </div>

             <div className="space-y-4">
                {filteredLearners.map(learner => {
                   const assessment = assessments[learner.id];
                   const isSaved = savedAssessments[learner.id];
                   return (
                      <div key={learner.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center text-xs font-semibold text-gray-600">
                                  {learner.firstName[0]}{learner.lastName[0]}
                               </div>
                               <div>
                                  <h5 className="text-sm font-semibold text-gray-900">{learner.firstName} {learner.lastName}</h5>
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-tighter">ADM: {learner.admissionNumber}</p>
                               </div>
                            </div>
                            {isSaved && <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center"><Check size={18} strokeWidth={4} /></div>}
                         </div>

                         <div>
                            <RatingSelector
                               value={assessment?.detailedRating || ''}
                               onChange={(code, points, percentage) => handleRatingChange(learner.id, code, points, percentage)}
                               showDescription={false}
                            />
                         </div>

                         {assessment?.enhanced && (
                            <div className="space-y-4 pt-4 border-t border-gray-50 animate-in fade-in zoom-in-95">
                               <div className="relative">
                                  <span className="absolute -top-2 left-4 px-2 bg-white text-[8px] font-semibold text-gray-300 uppercase tracking-widest">Observations</span>
                                  <textarea
                                     value={assessment.strengths || ''}
                                     onChange={(e) => handleFeedbackChange(learner.id, 'strengths', e.target.value)}
                                     className="w-full p-4 bg-gray-50 rounded-2xl border-none text-[11px] font-medium outline-none focus:ring-1 focus:ring-purple-100"
                                     placeholder="Strong areas..."
                                  />
                               </div>
                            </div>
                         )}

                         <div className="flex gap-2">
                             <button 
                                onClick={() => setAssessments(prev => ({...prev, [learner.id]: {...prev[learner.id], enhanced: !prev[learner.id]?.enhanced}}))}
                                className="flex-1 h-10 bg-purple-50 text-[var(--brand-purple)] text-[10px] font-semibold uppercase tracking-widest rounded-lg active:scale-95 transition-all"
                             >
                                {assessment?.enhanced ? 'Hide Details' : 'Add Remarks'}
                             </button>
                             {isSaved && (
                                <button
                                  onClick={() => handleSendWhatsApp(learner.id)}
                                  disabled={sendingWhatsApp[learner.id]}
                                  className="w-11 h-10 flex items-center justify-center bg-emerald-50 text-emerald-500 rounded-lg active:scale-90 transition-all"
                                >
                                   {sendingWhatsApp[learner.id] ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                             )}
                         </div>
                      </div>
                   );
                })}
             </div>
          </div>

          <button
            onClick={goToNextStep}
            className="w-full sm:w-auto sm:min-w-56 h-12 sm:ml-auto bg-[var(--brand-purple)] text-white rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Summary Board</span>
            <BarChart2 size={20} strokeWidth={3} />
          </button>
        </div>
      )}

      {/* ── STEP 3: REVIEW ── */}
      {viewMode === 'review' && (
        <div className="px-4 sm:px-6 space-y-4 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4">
           <div className="flex items-center gap-3 bg-white p-3 sticky top-3 z-10 border border-gray-200 rounded-xl shadow-sm">
             <button onClick={goToPrevStep} className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg active:scale-90 transition-all">
                <ChevronLeft size={20} className="text-gray-900" />
             </button>
             <h3 className="text-lg font-semibold text-gray-900">Final Summary</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
             <div className="bg-purple-50 p-4 rounded-xl text-center border border-purple-100">
                <p className="text-[8px] font-semibold text-purple-400 uppercase tracking-widest mb-1">Total</p>
                <p className="text-xl font-semibold text-[var(--brand-purple)]">{stats.total}</p>
             </div>
             <div className="bg-indigo-50 p-4 rounded-xl text-center border border-indigo-100">
                <p className="text-[8px] font-semibold text-indigo-400 uppercase tracking-widest mb-1">Entry</p>
                <p className="text-xl font-semibold text-indigo-600">{stats.assessed}</p>
             </div>
             <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100">
                <p className="text-[8px] font-semibold text-emerald-400 uppercase tracking-widest mb-1">Saved</p>
                <p className="text-xl font-semibold text-[var(--brand-teal)]">{stats.saved}</p>
             </div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center space-y-5 shadow-sm border border-gray-200">
             <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto text-[var(--brand-purple)]">
                <CheckCircle size={32} strokeWidth={1.5} />
             </div>
             <div className="space-y-2">
                <h4 className="text-xl font-semibold text-gray-900">Session Complete?</h4>
                <p className="text-xs text-gray-400 font-medium leading-relaxed px-6">Review the summary above. If all {labels.learners} are marked, you can safely return to the dashboard.</p>
             </div>
             <button
               onClick={() => window.history.back()}
               className="w-full sm:w-auto sm:min-w-56 h-12 bg-[var(--brand-purple)] text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-xl shadow-sm active:scale-95 transition-all"
             >
                Exit Session
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormativeAssessment;
