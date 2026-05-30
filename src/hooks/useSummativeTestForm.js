import { useState, useEffect, useCallback } from 'react';
import { assessmentAPI, gradingAPI, configAPI, classAPI, seniorPathwayAPI } from '../services/api';
import { getLearningAreasByGrade } from '../constants/learningAreas';
import { useSchoolData } from '../contexts/SchoolDataContext';
import { normalizeTestType } from '../components/CBCGrading/utils/testType';

const TEST_TYPES = [
  { value: 'OPENER', label: 'Opener' },
  { value: 'MID_TERM', label: 'Midterm' },
  { value: 'END_TERM', label: 'End Term' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'CAT', label: 'CAT' },
  { value: 'MOCK', label: 'Mock Exam' },
  { value: 'RANDOM', label: 'Random' }
];

const DEFAULT_FORM_DATA = {
  title: '',
  type: '',
  grade: '',
  term: 'TERM_1',
  learningArea: '',
  academicYear: new Date().getFullYear(),
  scaleId: '',
  testDate: new Date().toISOString().split('T')[0],
  totalMarks: 100,
  passMarks: 50,
  duration: 60,
  description: '',
  instructions: '',
  curriculum: 'CBC_AND_EXAM',
  weight: 1.0,
  status: 'PUBLISHED'
};

const SENIOR_SECONDARY_GRADES = new Set(['GRADE_10', 'GRADE_11', 'GRADE_12']);

export const useSummativeTestForm = ({ initialTestType = null } = {}) => {
  const { grades, classes, loading: schoolDataLoading } = useSchoolData();
  const [fallbackGrades, setFallbackGrades] = useState([]);
  const [scales, setScales] = useState([]);
  const [terms, setTerms] = useState([]);
  const [allLearningAreas, setAllLearningAreas] = useState([]);
  const [schoolOfferings, setSchoolOfferings] = useState([]);
  const [availableLearningAreas, setAvailableLearningAreas] = useState([]);
  const [loadingScales, setLoadingScales] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(() => ({
    ...DEFAULT_FORM_DATA,
    type: normalizeTestType(initialTestType) || DEFAULT_FORM_DATA.type
  }));
  const [errors, setErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState('');

  // Effect to set terms from classes
  useEffect(() => {
    if (!schoolDataLoading && classes?.length > 0) {
      const uniqueTerms = [...new Set(classes.map(c => c.term || 'TERM_1'))].filter(Boolean);
      if (uniqueTerms.length > 0) {
        setTerms(uniqueTerms.map(term => ({
          value: term,
          label: term.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        })));
      } else {
        setTerms([
          { value: 'TERM_1', label: 'Term 1' },
          { value: 'TERM_2', label: 'Term 2' },
          { value: 'TERM_3', label: 'Term 3' }
        ]);
      }
    } else if (!schoolDataLoading) {
      setTerms([
        { value: 'TERM_1', label: 'Term 1' },
        { value: 'TERM_2', label: 'Term 2' },
        { value: 'TERM_3', label: 'Term 3' }
      ]);
    }
  }, [classes, schoolDataLoading]);

  const loadLearningAreas = useCallback(async () => {
    try {
      const response = await configAPI.getLearningAreas();
      const areasData = response?.data || response;
      setAllLearningAreas(Array.isArray(areasData) ? areasData : []);
    } catch (error) {
      console.error('❌ Error loading learning areas:', error);
      setAllLearningAreas([]);
    }
  }, []);

  const loadScales = useCallback(async () => {
    setLoadingScales(true);
    try {
      const response = await gradingAPI.getSystems();
      const systemsData = response?.data || response;
      setScales(Array.isArray(systemsData) ? systemsData : []);
    } catch (error) {
      console.error('❌ Error loading scales:', error);
      setScales([]);
    } finally {
      setLoadingScales(false);
    }
  }, []);

  const loadSchoolOfferings = useCallback(async () => {
    try {
      const response = await seniorPathwayAPI.getSchoolOfferings();
      const offeringsData = response?.data || response;
      setSchoolOfferings(Array.isArray(offeringsData) ? offeringsData : []);
    } catch {
      setSchoolOfferings([]);
    }
  }, []);

  useEffect(() => {
    loadScales();
    loadLearningAreas();
    loadSchoolOfferings();
  }, [loadScales, loadLearningAreas, loadSchoolOfferings]);

  useEffect(() => {
    const loadFallbackGrades = async () => {
      try {
        const resp = await configAPI.getGrades();
        const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        setFallbackGrades(rows);
      } catch {
        setFallbackGrades([]);
      }
    };
    loadFallbackGrades();
  }, []);

  // Update available learning areas when grade changes
  useEffect(() => {
    if (!formData.grade) {
      setAvailableLearningAreas([]);
      return;
    }

    const loadGradeAreas = async () => {
      try {
        const resp = await configAPI.getLearningAreas({ gradeLevel: formData.grade });
        const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        const isSeniorGrade = SENIOR_SECONDARY_GRADES.has(formData.grade);
        const configuredOfferings = isSeniorGrade
          ? schoolOfferings
              .map((offering) => offering?.officialLearningArea)
              .filter(Boolean)
          : [];

        const filteredRows = isSeniorGrade
          ? (
              configuredOfferings.length > 0
                ? configuredOfferings.map((subject) => {
                    const match = rows.find((row) =>
                      String(row?.name || '').trim().toLowerCase() === String(subject?.officialName || '').trim().toLowerCase() ||
                      String(row?.shortName || '').trim().toLowerCase() === String(subject?.officialCode || '').trim().toLowerCase()
                    );
                    return match || {
                      id: subject.id,
                      name: subject.officialName,
                      shortName: subject.officialCode,
                      gradeLevel: formData.grade,
                      isCore: subject.subjectType === 'EXAMINABLE_CORE',
                      pathway: subject.pathway?.code || null,
                      category: subject.track?.code || null,
                    };
                  })
                : rows.filter((row) => row?.isCore || row?.pathway)
            )
          : rows;

        // Deduplicate by name (keep first occurrence)
        const seen = new Set();
        const dedupe = filteredRows.filter((a) => {
          const n = String(a?.name || '');
          if (!n || seen.has(n)) return false;
          seen.add(n);
          return true;
        });
        if (dedupe.length > 0) {
          setAvailableLearningAreas(dedupe);
          return;
        }
      } catch {
        // fall through to local fallback
      }

      // Final fallback for resilience only
      const officialAreas = getLearningAreasByGrade(formData.grade);
      setAvailableLearningAreas(officialAreas.map(name => ({ id: name, name })));
    };
    loadGradeAreas();

    // Reset learning area and scale when grade changes
    setFormData(prev => ({ ...prev, learningArea: '', scaleId: '' }));
  }, [formData.grade, allLearningAreas, schoolOfferings]);



  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      // When learning area changes, auto-match the corresponding scale
      if (field === 'learningArea' && value && next.grade) {
        const match = scales.find(s =>
          s.type === 'SUMMATIVE' &&
          (s.grade === next.grade || (s.name && s.name.toUpperCase().includes(next.grade.toUpperCase().replace(/_/g, ' ')))) &&
          s.name && s.name.toLowerCase().includes(value.toLowerCase())
        );
        next.scaleId = match ? match.id : '';
      }

      return next;
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Test name is required';
    }
    if (!formData.type) {
      newErrors.type = 'Test type is required';
    }
    if (!formData.grade) {
      newErrors.grade = 'Grade is required';
    }
    if (!formData.term) {
      newErrors.term = 'Academic term is required';
    }
    if (!formData.learningArea) {
      newErrors.learningArea = 'Learning Area is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getSelectedScale = () => {
    if (!formData.scaleId) return null;
    return scales.find(s => s.id === formData.scaleId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setSaveStatus('error');
      return;
    }

    if (!window.confirm(`Are you sure you want to ${formData.title ? 'update' : 'create'} this test?`)) {
      return;
    }

    setSaving(true);
    setSaveStatus('');

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const selectedScale = getSelectedScale();

      const testData = {
        ...formData,
        testType: formData.type,
        totalMarks: parseInt(formData.totalMarks),
        passMarks: parseInt(formData.passMarks),
        duration: parseInt(formData.duration) || null,
        createdBy: userId,
        published: true,
        active: true,
        status: 'PUBLISHED',
        scaleId: selectedScale?.id || null,
        scaleName: selectedScale?.name || null
      };

      console.log('📤 Submitting test:', testData);
      console.log('📊 Selected scale:', selectedScale);

      const response = await assessmentAPI.createTest({ ...testData });
      const createdTest = response?.data || response;

      console.log('✅ Test created successfully:', createdTest);
      setSaveStatus('success');

      return createdTest;
    } catch (error) {
      console.error('❌ Error saving test:', error);
      setSaveStatus('error');
      setErrors(prev => ({
        ...prev,
        submit: error.response?.data?.error || error.message || 'Failed to save test'
      }));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      type: normalizeTestType(initialTestType) || DEFAULT_FORM_DATA.type
    });
    setErrors({});
  };

  return {
    // State
    formData,
    setFormData,
    scales,
    grades: (grades && grades.length > 0) ? grades : fallbackGrades,
    terms,
    errors,
    saveStatus,
    loading: loadingScales || schoolDataLoading,
    loadingScales,
    loadingGrades: schoolDataLoading,
    saving,
    availableLearningAreas,
    testTypes: TEST_TYPES,

    // Methods
    handleInputChange,
    handleSubmit,
    validateForm,
    resetForm,
    getSelectedScale
  };
};
