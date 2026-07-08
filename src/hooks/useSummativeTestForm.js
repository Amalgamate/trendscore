import { useState, useEffect, useCallback, useMemo } from 'react';
import { assessmentAPI, gradingAPI, configAPI, seniorPathwayAPI } from '../services/api';
import { getLearningAreasByGrade } from '../constants/learningAreas';
import { useSchoolData } from '../contexts/SchoolDataContext';
import { CANONICAL_TEST_TYPE_OPTIONS, normalizeTestType } from '../components/CBCGrading/utils/testType';

/** Returns the persisted institutionType without triggering a re-render cycle */
const getStoredInstitutionType = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.institutionType || 'PRIMARY_CBC';
  } catch {
    return 'PRIMARY_CBC';
  }
};

const TEST_TYPES = CANONICAL_TEST_TYPE_OPTIONS;

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

const toDateInputValue = (value) => {
  if (!value) return new Date().toISOString().split('T')[0];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];
};

const buildInitialFormData = (initialData, initialTestType) => ({
  ...DEFAULT_FORM_DATA,
  ...initialData,
  type: normalizeTestType(initialData?.testType || initialData?.type || initialTestType) || DEFAULT_FORM_DATA.type,
  learningArea: initialData?.learningArea || '',
  testDate: toDateInputValue(initialData?.testDate || initialData?.date),
  totalMarks: initialData?.totalMarks ?? DEFAULT_FORM_DATA.totalMarks,
  passMarks: initialData?.passMarks ?? DEFAULT_FORM_DATA.passMarks,
  duration: initialData?.duration ?? DEFAULT_FORM_DATA.duration,
  weight: initialData?.weight ?? DEFAULT_FORM_DATA.weight,
});

export const useSummativeTestForm = ({ initialTestType = null, initialData = null } = {}) => {
  const { grades, classes, loading: schoolDataLoading } = useSchoolData();
  const isEditMode = Boolean(initialData?.id);
  const [fallbackGrades, setFallbackGrades] = useState([]);
  const [scales, setScales] = useState([]);
  const [terms, setTerms] = useState([]);
  const [allLearningAreas, setAllLearningAreas] = useState([]);
  const [schoolOfferings, setSchoolOfferings] = useState([]);
  const [availableLearningAreas, setAvailableLearningAreas] = useState([]);
  const [loadingScales, setLoadingScales] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(() => buildInitialFormData(initialData, initialTestType));
  const [errors, setErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const initialDataKey = useMemo(
    () => `${initialData?.id || 'new'}:${initialData?.title || ''}:${initialData?.grade || ''}:${initialData?.term || ''}:${initialData?.learningArea || ''}:${initialTestType || ''}`,
    [initialData, initialTestType]
  );

  useEffect(() => {
    setFormData(buildInitialFormData(initialData, initialTestType));
    setErrors({});
    setSaveStatus('');
  }, [initialDataKey, initialData, initialTestType]);

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
    // Senior pathways offerings are only available for SECONDARY institutions.
    // Calling this endpoint for PRIMARY_CBC results in a 403 INSTITUTION_FORBIDDEN.
    if (getStoredInstitutionType() !== 'SECONDARY') {
      setSchoolOfferings([]);
      return;
    }
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

        const officialFallbackRows = isSeniorGrade
          ? []
          : getLearningAreasByGrade(formData.grade).map(name => ({ id: name, name, gradeLevel: formData.grade }));
        const rowsWithFallbacks = [...filteredRows, ...officialFallbackRows];

        // Deduplicate by name (keep first occurrence)
        const seen = new Set();
        const dedupe = rowsWithFallbacks.filter((a) => {
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

  }, [formData.grade, allLearningAreas, schoolOfferings]);



  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      if (field === 'grade') {
        next.learningArea = '';
        next.scaleId = '';
      }

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

    if (!window.confirm(`Are you sure you want to ${isEditMode ? 'update' : 'create'} this test?`)) {
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
        title: formData.title,
        name: formData.title,
        type: formData.type,
        testType: formData.type,
        grade: formData.grade,
        term: formData.term,
        learningArea: formData.learningArea,
        academicYear: formData.academicYear,
        testDate: formData.testDate,
        totalMarks: parseInt(formData.totalMarks),
        passMarks: parseInt(formData.passMarks),
        duration: parseInt(formData.duration) || null,
        description: formData.description,
        instructions: formData.instructions,
        curriculum: formData.curriculum,
        weight: Number(formData.weight) || 1.0,
        createdBy: userId,
        published: true,
        active: true,
        status: 'PUBLISHED'
      };

      if (selectedScale?.id) {
        testData.scaleId = selectedScale.id;
      }

      if (selectedScale?.name) {
        testData.scaleName = selectedScale.name;
      }

      console.log('📤 Submitting test:', testData);
      console.log('📊 Selected scale:', selectedScale);

      const response = isEditMode
        ? await assessmentAPI.updateTest(initialData.id, { ...testData })
        : await assessmentAPI.createTest({ ...testData });
      const createdTest = response?.data || response;

      console.log(`✅ Test ${isEditMode ? 'updated' : 'created'} successfully:`, createdTest);
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
    setFormData(buildInitialFormData(initialData, initialTestType));
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
