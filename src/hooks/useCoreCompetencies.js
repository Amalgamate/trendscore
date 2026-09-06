import { useState, useCallback } from 'react';
import { cbcAPI } from '../services/api';
import { useSchoolData } from '../contexts/SchoolDataContext';

export const useCoreCompetencies = (initialData = null) => {
  const [formData, setFormData] = useState({
    learnerId: initialData?.learnerId || '',
    learnerName: initialData?.learnerName || '',
    grade: initialData?.grade || '',
    term: initialData?.term || '',
    academicYear: initialData?.academicYear || new Date().getFullYear(),
    assessmentDate: initialData?.assessmentDate || new Date().toISOString().split('T')[0],
    // CBC API fields (map to backend schema)
    communication: initialData?.communication || '',
    communicationComment: initialData?.communicationComment || '',
    criticalThinking: initialData?.criticalThinking || '',
    criticalThinkingComment: initialData?.criticalThinkingComment || '',
    creativity: initialData?.creativity || '',
    creativityComment: initialData?.creativityComment || '',
    collaboration: initialData?.collaboration || '',
    collaborationComment: initialData?.collaborationComment || '',
    citizenship: initialData?.citizenship || '',
    citizenshipComment: initialData?.citizenshipComment || '',
    learningToLearn: initialData?.learningToLearn || '',
    learningToLearnComment: initialData?.learningToLearnComment || '',
  });

  const [errors, setErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');
  const [loading, setLoading] = useState(false);

  // Detailed rubric ratings used by the CBC backend
  const ratingScale = [
    { value: 'EE1', label: 'Exceeds Expectations (High)', color: 'bg-green-100 border-green-300' },
    { value: 'EE2', label: 'Exceeds Expectations', color: 'bg-green-50 border-green-200' },
    { value: 'ME1', label: 'Meets Expectations (High)', color: 'bg-blue-100 border-blue-300' },
    { value: 'ME2', label: 'Meets Expectations', color: 'bg-blue-50 border-blue-200' },
    { value: 'AE1', label: 'Approaching Expectations (High)', color: 'bg-yellow-100 border-yellow-300' },
    { value: 'AE2', label: 'Approaching Expectations', color: 'bg-yellow-50 border-yellow-200' },
    { value: 'BE1', label: 'Below Expectations (High)', color: 'bg-red-100 border-red-300' },
    { value: 'BE2', label: 'Below Expectations', color: 'bg-red-50 border-red-200' },
  ];

  // Compact display labels for UI
  const simpleRatings = [
    { value: 'EE1', label: 'EE1' },
    { value: 'EE2', label: 'EE2' },
    { value: 'ME1', label: 'ME1' },
    { value: 'ME2', label: 'ME2' },
    { value: 'AE1', label: 'AE1' },
    { value: 'AE2', label: 'AE2' },
    { value: 'BE1', label: 'BE1' },
    { value: 'BE2', label: 'BE2' },
  ];

  const competencyFields = [
    { key: 'communication', label: 'Communication and Collaboration', commentKey: 'communicationComment' },
    { key: 'criticalThinking', label: 'Critical Thinking and Problem Solving', commentKey: 'criticalThinkingComment' },
    { key: 'creativity', label: 'Creativity and Imagination', commentKey: 'creativityComment' },
    { key: 'collaboration', label: 'Collaboration', commentKey: 'collaborationComment' },
    { key: 'citizenship', label: 'Citizenship', commentKey: 'citizenshipComment' },
    { key: 'learningToLearn', label: 'Learning to Learn', commentKey: 'learningToLearnComment' },
  ];

  const { grades, academicYears } = useSchoolData();
  const terms = [
    { value: 'TERM_1', label: 'Term 1' },
    { value: 'TERM_2', label: 'Term 2' },
    { value: 'TERM_3', label: 'Term 3' },
  ];

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
    }
  }, [errors]);

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.learnerId?.trim()) newErrors.learnerId = 'Learner ID is required';
    if (!formData.term) newErrors.term = 'Term is required';
    if (!formData.academicYear) newErrors.academicYear = 'Academic year is required';

    for (const comp of competencyFields) {
      if (!formData[comp.key]) {
        newErrors[comp.key] = `${comp.label} rating is required`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({
      learnerId: '',
      learnerName: '',
      grade: '',
      term: '',
      academicYear: new Date().getFullYear(),
      assessmentDate: new Date().toISOString().split('T')[0],
      communication: '', communicationComment: '',
      criticalThinking: '', criticalThinkingComment: '',
      creativity: '', creativityComment: '',
      collaboration: '', collaborationComment: '',
      citizenship: '', citizenshipComment: '',
      learningToLearn: '', learningToLearnComment: '',
    });
    setErrors({});
    setSaveStatus('idle');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (!validateForm()) {
      setSaveStatus('error');
      return null;
    }

    setSaveStatus('saving');
    setLoading(true);

    try {
      const payload = {
        learnerId: formData.learnerId,
        term: formData.term,
        academicYear: parseInt(formData.academicYear),
        communication: formData.communication,
        communicationComment: formData.communicationComment || undefined,
        criticalThinking: formData.criticalThinking,
        criticalThinkingComment: formData.criticalThinkingComment || undefined,
        creativity: formData.creativity,
        creativityComment: formData.creativityComment || undefined,
        collaboration: formData.collaboration,
        collaborationComment: formData.collaborationComment || undefined,
        citizenship: formData.citizenship,
        citizenshipComment: formData.citizenshipComment || undefined,
        learningToLearn: formData.learningToLearn,
        learningToLearnComment: formData.learningToLearnComment || undefined,
      };

      const response = await cbcAPI.saveCompetencies(payload);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return response?.data || response;
    } catch (error) {
      console.error('Save competencies error:', error);
      setErrors({ submit: error.message || 'Failed to save competencies' });
      setSaveStatus('error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm]);

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    saveStatus,
    setSaveStatus,
    loading,
    ratingScale,
    simpleRatings,
    competencyFields,
    grades,
    terms,
    academicYears,
    handleInputChange,
    handleCompetencyChange: handleInputChange, // Aliasing for convenience in loops
    validateForm,
    handleSubmit,
    resetForm,
  };
};
