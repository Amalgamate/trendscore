import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Save, Search, Loader, ArrowLeft, Printer, UploadCloud, Database, ChevronRight,
  FileSpreadsheet, Download, PlayCircle, Sparkles, Loader2, CheckCircle2, ChevronDown
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import VirtualizedTable from '../shared/VirtualizedTable';
import { assessmentAPI, gradingAPI, classAPI, configAPI, learnerAPI, aiAPI } from '../../../services/api';
import { cacheDel } from '../../../services/api/core';
import { useNotifications } from '../hooks/useNotifications';
import EmptyState from '../shared/EmptyState';
import { useAuth } from '../../../hooks/useAuth';
import { generatePDFWithLetterhead } from '../../../utils/simplePdfGenerator';
import BulkMarkImportModal from '../shared/BulkMarkImportModal';
import PDFPreviewModal from '../shared/PDFPreviewModal';
import { getGradeColor } from '../../../utils/grading/colors';
import { useAssessmentSetup } from '../hooks/useAssessmentSetup';
import { useLearningAreas } from '../hooks/useLearningAreas';
import { useTeacherWorkload } from '../hooks/useTeacherWorkload';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { getLearningAreasByGrade } from '../../../constants/learningAreas';
import { getAcademicYearOptions, getCurrentAcademicYear } from '../utils/academicYear';
import { CANONICAL_TEST_TYPE_OPTIONS, normalizeTestType, resolveTestType, formatTestTypeLabel } from '../utils/testType';

const SECONDARY_GRADES = ['GRADE10', 'GRADE11', 'GRADE12'];
const JUNIOR_GRADE_ORDER = ['PLAYGROUP', 'PP1', 'PP2', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9'];

const normalizeGradeCode = (grade) => String(grade || '').trim().replace(/\s+/g, '_').toUpperCase();
const toCanonicalGrade = (grade) => {
  const g = normalizeGradeCode(grade);
  if (g === 'FORM_1' || g === 'GRADE_10') return 'GRADE10';
  if (g === 'FORM_2' || g === 'GRADE_11') return 'GRADE11';
  if (g === 'FORM_3' || g === 'GRADE_12') return 'GRADE12';
  return g;
};
const isSecondaryGrade = (grade) => /^GRADE(10|11|12)$/.test(toCanonicalGrade(grade));
const isJuniorGrade = (grade) => {
  const g = toCanonicalGrade(grade);
  return g === 'PLAYGROUP' || g === 'PP1' || g === 'PP2' || /^GRADE_[1-9]$/.test(g);
};
const formatGradeLabel = (grade) => {
  const g = toCanonicalGrade(grade);
  if (isSecondaryGrade(g)) return `Grade ${g.replace('GRADE', '')}`;
  if (g.startsWith('GRADE_')) return `Grade ${g.replace('GRADE_', '')}`;
  if (g === 'PLAYGROUP') return 'Playgroup';
  return g.replace(/_/g, ' ');
};
const matchesAcademicYear = (testYear, selectedYear) => {
  if (!selectedYear) return true;
  return String(testYear || '').trim() === String(selectedYear).trim();
};
const ASSESSMENT_TEST_TYPE_OPTIONS = [
  ...CANONICAL_TEST_TYPE_OPTIONS,
  { value: 'ASSESSMENT', label: 'Assessment' },
];

// ─── Custom Test Picker ────────────────────────────────────────────────────────
// Replaces the native <select> so we can render a green tick next to tests that
// already have saved results. Keeps identical height/style to the other selects.
const TestPicker = ({ tests, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = tests.find(t => String(t.id) === String(value));
  const hasResults = (t) => (t._count?.results ?? 0) > 0;
  const getDisplayTitle = (t) => {
    const rawTitle = String(t?.title || t?.name || '').trim();
    const resolvedType = String(formatTestTypeLabel(resolveTestType(t)) || '').toUpperCase();
    if (!rawTitle) return '';
    if (!resolvedType || resolvedType === 'OTHER') return rawTitle;
    return rawTitle.replace(/\bOTHER\b/gi, resolvedType);
  };
  const getTypeAndTime = (t) => {
    const typeLabel = String(formatTestTypeLabel(resolveTestType(t)) || 'Assessment').toUpperCase();
    const dt = t?.testDate || t?.updatedAt || t?.createdAt;
    const stamp = dt ? new Date(dt).toLocaleDateString('en-GB') : null;
    return stamp ? `${typeLabel} • ${stamp}` : typeLabel;
  };

  if (disabled) {
    return (
      <div className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 text-slate-400 flex items-center flex-1 min-w-[120px] cursor-not-allowed select-none">
        <span className="flex-1 truncate">{tests.length === 0 ? 'No tests' : 'Test'}</span>
        <ChevronDown size={12} className="ml-1 text-slate-300 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-[120px]">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`h-9 w-full px-2.5 py-1.5 border rounded text-xs bg-white text-slate-900 flex items-center gap-1 cursor-pointer hover:border-slate-400 transition-colors text-left
          ${open ? 'border-brand-purple ring-1 ring-brand-purple' : 'border-slate-300'}`}
      >
        {/* Green tick if selected test has results */}
        {selected && hasResults(selected) && (
          <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
        )}
        <span className="flex-1 truncate text-slate-900">
          {selected ? `${getDisplayTitle(selected)} - ${getTypeAndTime(selected)}` : 'Test'}
        </span>
        <ChevronDown size={12} className={`ml-1 flex-shrink-0 transition-transform text-slate-400 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[260px] bg-white border border-slate-200 rounded shadow-lg overflow-hidden">
          {/* Empty placeholder row */}
          <div
            onClick={() => { onChange(''); setOpen(false); }}
            className={`px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 text-slate-400 ${value === '' ? 'bg-slate-50' : ''}`}
          >
            — Select a test —
          </div>

          {tests.map(t => {
            const done = hasResults(t);
            const isSelected = String(t.id) === String(value);
            return (
              <div
                key={t.id}
                onClick={() => { onChange(t.id); setOpen(false); }}
                className={`px-3 py-2 text-xs cursor-pointer flex items-center gap-2 transition-colors
                  ${isSelected
                    ? 'bg-brand-teal/10 text-brand-teal font-semibold'
                    : 'hover:bg-slate-50 text-slate-800'
                  }`}
              >
                {/* Green tick badge for tests with saved results */}
                {done ? (
                  <CheckCircle2
                    size={14}
                    className={`flex-shrink-0 ${isSelected ? 'text-green-500' : 'text-green-500'}`}
                  />
                ) : (
                  <span className="w-[14px] flex-shrink-0" />
                )}
                <div className="leading-snug min-w-0">
                  <div className="truncate">{getDisplayTitle(t)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">{getTypeAndTime(t)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SummativeAssessment = ({ learners, initialTestId, defaultTestType = null, brandingSettings }) => {
  const { showSuccess, showError } = useNotifications();

  // Use centralized hooks for assessment state management
  const setup = useAssessmentSetup({
    defaultTerm: localStorage.getItem('cbc_summative_appliedTerm') || 'TERM_1',
    defaultGrade: localStorage.getItem('cbc_summative_appliedGrade') || '',
    defaultStream: localStorage.getItem('cbc_summative_appliedStream') || '',
    defaultAcademicYear: parseInt(localStorage.getItem('cbc_summative_appliedYear')) || getCurrentAcademicYear()
  });
  const learningAreasMgr = useLearningAreas(setup.selectedGrade);
  const teacherWorkload = useTeacherWorkload();
  const normalizedDefaultTestType = useMemo(
    () => normalizeTestType(defaultTestType),
    [defaultTestType]
  );

  // View State
  const [step, setStep] = useState(() => {
    if (initialTestId) return 2;
    const saved = localStorage.getItem('cbc_summative_step');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [loading, setLoading] = useState(true);

  // --- FIX: Dedicated saving state so the page doesn't freeze during save ---
  const [isSaving, setIsSaving] = useState(false);
  // Track whether the last backend save succeeded (for the indicator dot)
  const [lastBackendSave, setLastBackendSave] = useState(null);
  // Ref to track current auto-save promise so we don't double-fire
  const autoSaveTimerRef = useRef(null);
  const autoSaveInProgressRef = useRef(false);

  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data State
  const [tests, setTests] = useState([]);
  const [selectedLearningArea, setSelectedLearningArea] = useState(() => localStorage.getItem('cbc_summative_appliedLearningArea') || '');
  const [selectedTestId, setSelectedTestId] = useState(() => initialTestId || localStorage.getItem('cbc_summative_appliedTestId') || '');
  const [selectedTestType, setSelectedTestType] = useState(() => normalizedDefaultTestType || localStorage.getItem('cbc_summative_appliedTestType') || '');
  const [marks, setMarks] = useState({});
  const [gradingScale, setGradingScale] = useState(null);
  const [isDraft, setIsDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const { grades: availableGrades } = useSchoolData();
  const [fallbackGrades, setFallbackGrades] = useState([]);
  const [selectedGradeAreas, setSelectedGradeAreas] = useState([]);
  const [stagedGradeAreas, setStagedGradeAreas] = useState([]);
  const [availableTerms, setAvailableTerms] = useState([]);
  const [availableStreams, setAvailableStreams] = useState([]);

  // Staged Filter State - Only apply when green button clicked
  const [stagedGrade, setStagedGrade] = useState(() => localStorage.getItem('cbc_summative_stagedGrade') || '');
  const [stagedStream, setStagedStream] = useState(() => localStorage.getItem('cbc_summative_stagedStream') || '');
  const [stagedTerm, setStagedTerm] = useState(() => localStorage.getItem('cbc_summative_stagedTerm') || '');
  const [stagedAcademicYear, setStagedAcademicYear] = useState(() => parseInt(localStorage.getItem('cbc_summative_stagedYear')) || getCurrentAcademicYear());
  const [stagedTestType, setStagedTestType] = useState(() => normalizedDefaultTestType || localStorage.getItem('cbc_summative_stagedTestType') || '');
  const [stagedLearningArea, setStagedLearningArea] = useState(() => localStorage.getItem('cbc_summative_stagedLearningArea') || '');
  const [stagedTestId, setStagedTestId] = useState(() => initialTestId || localStorage.getItem('cbc_summative_stagedTestId') || '');

  const resetStagedLearningAreaAndTest = useCallback(() => {
    setStagedLearningArea('');
    setStagedTestId('');
  }, []);

  useEffect(() => {
    if (!normalizedDefaultTestType) return;
    setSelectedTestType(normalizedDefaultTestType);
    setStagedTestType(normalizedDefaultTestType);
    resetStagedLearningAreaAndTest();
  }, [normalizedDefaultTestType, resetStagedLearningAreaAndTest]);

  // Persist staged filters and step
  useEffect(() => {
    localStorage.setItem('cbc_summative_stagedGrade', stagedGrade);
    localStorage.setItem('cbc_summative_stagedStream', stagedStream);
    localStorage.setItem('cbc_summative_stagedTerm', stagedTerm);
    localStorage.setItem('cbc_summative_stagedYear', stagedAcademicYear);
    localStorage.setItem('cbc_summative_stagedTestType', stagedTestType);
    localStorage.setItem('cbc_summative_stagedLearningArea', stagedLearningArea);
    localStorage.setItem('cbc_summative_stagedTestId', stagedTestId);
    if (!initialTestId) {
      localStorage.setItem('cbc_summative_step', step);
    }
  }, [stagedGrade, stagedStream, stagedTerm, stagedAcademicYear, stagedTestType, stagedLearningArea, stagedTestId, step, initialTestId]);

  // Handler to apply filters when green button clicked
  const applyFilters = useCallback(() => {
    setup.updateGrade(stagedGrade);
    setup.updateStream(stagedStream);
    setup.updateTerm(stagedTerm);
    setup.updateAcademicYear(stagedAcademicYear);
    setSelectedTestType(stagedTestType);
    setSelectedLearningArea(stagedLearningArea);
    setSelectedTestId(stagedTestId);

    // Keep ref in sync so the learner-fetch effect reads the correct stream
    // value even if the hook state hasn't flushed yet.
    appliedStreamRef.current = stagedStream;

    // Persist applied filters
    localStorage.setItem('cbc_summative_appliedGrade', stagedGrade);
    localStorage.setItem('cbc_summative_appliedStream', stagedStream);
    localStorage.setItem('cbc_summative_appliedTerm', stagedTerm);
    localStorage.setItem('cbc_summative_appliedYear', stagedAcademicYear);
    localStorage.setItem('cbc_summative_appliedTestType', stagedTestType);
    localStorage.setItem('cbc_summative_appliedLearningArea', stagedLearningArea);
    localStorage.setItem('cbc_summative_appliedTestId', stagedTestId);

    // Clear marks when filters applied
    if (stagedTestId !== selectedTestId) {
      setMarks({});
    }
  }, [stagedGrade, stagedStream, stagedTerm, stagedAcademicYear, stagedTestType, stagedLearningArea, stagedTestId, selectedTestId, setup]);

  const [generatingAI, setGeneratingAI] = useState({});

  const handleGenerateAIComment = async (learnerId) => {
    try {
      setGeneratingAI(prev => ({ ...prev, [learnerId]: true }));
      const response = await aiAPI.generateFeedback(learnerId, setup.selectedTerm, setup.selectedAcademicYear);

      if (response.success && response.data) {
        setMarks(prev => ({
          ...prev,
          [learnerId]: {
            ...(prev[learnerId] || { mark: '' }),
            comment: response.data
          }
        }));
        toast.success('AI comment generated successfully!');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to generate AI comment');
    } finally {
      setGeneratingAI(prev => ({ ...prev, [learnerId]: false }));
    }
  };

  // User Context removed schoolId for single-tenant mode
  const { user } = useAuth();
  const isSecondaryPortal = String(user?.institutionType || '').toUpperCase() === 'SECONDARY';
  const schoolId = null;

  // Load Tests
  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all tests for this school context
      const response = await assessmentAPI.getTests({});
      let testsData = [];
      if (response && response.data && Array.isArray(response.data)) {
        testsData = response.data;
      } else if (Array.isArray(response)) {
        testsData = response;
      }

      // Only show published, active tests (backend enforces this too)
      let activeTests = testsData.filter(t =>
        (t.status || '').toUpperCase() === 'PUBLISHED' && t.active !== false
      );
      // Defensive portal scoping: never show JS grades inside Senior portal.
      activeTests = activeTests.filter((t) => {
        const g = toCanonicalGrade(t?.grade);
        return isSecondaryPortal ? isSecondaryGrade(g) : isJuniorGrade(g);
      });

      setTests(activeTests);
    } catch (error) {
      console.error('Error loading tests:', error);
      toast.error('Failed to load tests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  useEffect(() => {
    const loadFallbackGrades = async () => {
      try {
        const resp = await configAPI.getGrades();
        const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        setFallbackGrades(rows.map(toCanonicalGrade));
      } catch {
        setFallbackGrades([]);
      }
    };
    loadFallbackGrades();
  }, []);

  useEffect(() => {
    const loadAreasForSelectedGrade = async () => {
      if (!setup.selectedGrade) {
        setSelectedGradeAreas([]);
        return;
      }
      try {
        const resp = await configAPI.getLearningAreas({ gradeLevel: toCanonicalGrade(setup.selectedGrade) });
        const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        const names = rows.map((r) => String(r?.name || '').trim()).filter(Boolean);
        setSelectedGradeAreas([...new Set(names)]);
      } catch {
        setSelectedGradeAreas([]);
      }
    };
    loadAreasForSelectedGrade();
  }, [setup.selectedGrade]);

  useEffect(() => {
    const loadAreasForStagedGrade = async () => {
      if (!stagedGrade) {
        setStagedGradeAreas([]);
        return;
      }
      try {
        const resp = await configAPI.getLearningAreas({ gradeLevel: toCanonicalGrade(stagedGrade) });
        const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        const names = rows.map((r) => String(r?.name || '').trim()).filter(Boolean);
        setStagedGradeAreas([...new Set(names)]);
      } catch {
        setStagedGradeAreas([]);
      }
    };
    loadAreasForStagedGrade();
  }, [stagedGrade]);


  // Ref that always holds the most recently *applied* stream value so the
  // learner-fetch effect can read it synchronously without depending on the
  // setup hook state which may lag one render behind applyFilters().
  const appliedStreamRef = useRef(localStorage.getItem('cbc_summative_appliedStream') || '');
  const initialTestAppliedRef = useRef(false);

  // Load Terms, and Streams for selectors
  const loadOptions = useCallback(async () => {
    try {
      setAvailableTerms(['TERM_1', 'TERM_2', 'TERM_3']);

      // Force-bust the long-lived stream cache so we never show stale/empty
      // options if the cache was previously primed with bad data.
      cacheDel('config:streams');

      const streamsResp = await configAPI.getStreamConfigs();
      const streamsArr = Array.isArray(streamsResp?.data)
        ? streamsResp.data
        : Array.isArray(streamsResp)
          ? streamsResp
          : [];
      const streamNames = streamsArr
        .filter(s => s.active !== false)
        .map(s => s.name)
        .filter(Boolean);
      setAvailableStreams(streamNames);
    } catch (error) {
      console.error('Error loading selector options:', error);
      setAvailableTerms(['TERM_1', 'TERM_2', 'TERM_3']);
      setAvailableStreams([]);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Alert teacher if they have no assignments
  useEffect(() => {
    if (!teacherWorkload.loading && teacherWorkload.isTeacher && !teacherWorkload.hasAnyAssignments) {
      toast.error('You are not currently assigned to any classes or subjects. Please consult with the Head Teacher.');
    }
  }, [teacherWorkload.loading, teacherWorkload.isTeacher, teacherWorkload.hasAnyAssignments]);

  // Derived Data
  const selectedTest = useMemo(() =>
    tests.find(t => String(t.id) === String(selectedTestId)),
    [selectedTestId, tests]
  );

  const filteredTestsBySelection = useMemo(() =>
    tests.filter(t => {
      if (setup.selectedGrade) {
        // Handle variations like GRADE_1 vs Grade 1 or GRADE 1
        const normalizedGrade = toCanonicalGrade(setup.selectedGrade);
        const testGrade = toCanonicalGrade(t.grade || '');
        if (testGrade !== normalizedGrade) return false;
      }
      if (setup.selectedTerm) {
        const normalizedTerm = setup.selectedTerm.toUpperCase().trim();
        const testTerm = (t.term || '').toUpperCase().trim();
        if (testTerm !== normalizedTerm) return false;
      }
      if (!matchesAcademicYear(t.academicYear, setup.academicYear)) return false;
      if (selectedTestType) {
        const testType = resolveTestType(t);
        if (testType !== selectedTestType) return false;
      }
      return true;
    }),
    [tests, setup.selectedGrade, setup.selectedTerm, setup.academicYear, selectedTestType]
  );

  // Staged filtered tests - for dropdown options while editing
  const stagedFilteredTestsBySelection = useMemo(() =>
    tests.filter(t => {
      if (stagedGrade) {
        const normalizedGrade = toCanonicalGrade(stagedGrade);
        const testGrade = toCanonicalGrade(t.grade || '');
        if (testGrade !== normalizedGrade) return false;
      }
      if (stagedTerm) {
        const normalizedTerm = stagedTerm.toUpperCase().trim();
        const testTerm = (t.term || '').toUpperCase().trim();
        if (testTerm !== normalizedTerm) return false;
      }
      if (!matchesAcademicYear(t.academicYear, stagedAcademicYear)) return false;
      if (stagedTestType) {
        const testType = resolveTestType(t);
        if (testType !== stagedTestType) return false;
      }
      return true;
    }),
    [tests, stagedGrade, stagedTerm, stagedAcademicYear, stagedTestType]
  );

  const availableLearningAreas = useMemo(() => {
    // Collect all learning areas from the filtered tests
    const areas = new Set();
    filteredTestsBySelection.forEach(t => {
      if (t.learningArea) areas.add(t.learningArea);
    });

    // Unified source: merge persisted tests + grade hook + backend grade areas
    (learningAreasMgr.flatLearningAreas || []).forEach((area) => areas.add(area));
    (selectedGradeAreas || []).forEach((area) => areas.add(area));

    return Array.from(areas).sort();
  }, [filteredTestsBySelection, learningAreasMgr.flatLearningAreas, selectedGradeAreas]);

  // Staged available learning areas - for dropdown options while editing
  const stagedAvailableLearningAreas = useMemo(() => {
    const areas = new Set();
    stagedFilteredTestsBySelection.forEach(t => {
      if (t.learningArea) areas.add(t.learningArea);
    });

    // Use grade-driven canonical learning areas (constant map + backend), even before "Load" is clicked
    const stagedOfficialAreas = stagedGrade ? getLearningAreasByGrade(stagedGrade) : [];
    stagedOfficialAreas.forEach((area) => areas.add(area));
    (stagedGradeAreas || []).forEach((area) => areas.add(area));

    return Array.from(areas).sort();
  }, [stagedFilteredTestsBySelection, stagedGrade, stagedGradeAreas]);

  const filteredLearningAreasByWorkload = useMemo(() => {
    const areas = availableLearningAreas;
    if (!teacherWorkload.isTeacher || !setup.selectedGrade) return areas;

    const assignedSubjects = teacherWorkload.getAssignedSubjectsForGrade(setup.selectedGrade);
    if (!assignedSubjects) return areas;

    const normalize = (val) => String(val || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '').trim();

    return areas.filter(area =>
      assignedSubjects.some(as => normalize(as) === normalize(area))
    );
  }, [availableLearningAreas, teacherWorkload.isTeacher, setup.selectedGrade, teacherWorkload]);

  // Staged filtered learning areas - for dropdown options while editing
  const stagedFilteredLearningAreasByWorkload = useMemo(() => {
    const areas = stagedAvailableLearningAreas;
    if (!teacherWorkload.isTeacher || !stagedGrade) return areas;

    const assignedSubjects = teacherWorkload.getAssignedSubjectsForGrade(stagedGrade);
    if (!assignedSubjects) return areas;

    const normalize = (val) => String(val || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '').trim();

    return areas.filter(area =>
      assignedSubjects.some(as => normalize(as) === normalize(area))
    );
  }, [stagedAvailableLearningAreas, teacherWorkload.isTeacher, stagedGrade, teacherWorkload]);

  const finalTests = useMemo(() => {
    if (!selectedLearningArea) return [];

    const normalize = (val) => String(val || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '').trim();
    const normalizedSelected = normalize(selectedLearningArea);

    return filteredTestsBySelection.filter(t => {
      const testArea = normalize(t.learningArea);
      return testArea === normalizedSelected;
    });
  }, [filteredTestsBySelection, selectedLearningArea]);

  // Staged final tests - for dropdown options while editing
  const stagedFinalTests = useMemo(() => {
    if (!stagedLearningArea) return [];

    const normalize = (val) => String(val || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '').trim();
    const normalizedSelected = normalize(stagedLearningArea);

    return stagedFilteredTestsBySelection.filter(t => {
      const testArea = normalize(t.learningArea);
      return testArea === normalizedSelected;
    });
  }, [stagedFilteredTestsBySelection, stagedLearningArea]);

  const loadDisabledReason = useMemo(() => {
    if (!stagedGrade) return 'Select grade first';
    if (availableStreams.length > 0 && !stagedStream) return 'Select stream first';
    if (!stagedTerm) return 'Select term first';
    if (!stagedAcademicYear) return 'Select academic year first';
    if (!stagedTestType) return 'Select exam type first';
    if (!stagedLearningArea) return 'Select learning area first';
    if (!stagedTestId) return 'Select test first';
    return '';
  }, [availableStreams.length, stagedAcademicYear, stagedGrade, stagedLearningArea, stagedStream, stagedTerm, stagedTestId, stagedTestType]);

  const canLoadAssessment = !loadDisabledReason;

  const filteredGrades = useMemo(() => {
    const gradesFromTests = [...new Set(
      tests
        .map((test) => String(test?.grade || '').trim())
        .filter(Boolean)
        .map((grade) => grade.replace(/\s+/g, '_').toUpperCase())
    )];

    let mergedGrades = [...new Set(
      [...(availableGrades || []), ...(fallbackGrades || []), ...gradesFromTests]
        .map(toCanonicalGrade)
    )];
    mergedGrades = mergedGrades.filter((g) => (isSecondaryPortal ? isSecondaryGrade(g) : isJuniorGrade(g)));

    let grades = !teacherWorkload.isTeacher
      ? mergedGrades
      : mergedGrades.filter(g => teacherWorkload.assignedGrades.map(toCanonicalGrade).includes(g));

    // Sort by portal-specific grade order
    return grades.sort((a, b) => {
      if (isSecondaryPortal) return SECONDARY_GRADES.indexOf(a) - SECONDARY_GRADES.indexOf(b);
      return JUNIOR_GRADE_ORDER.indexOf(a) - JUNIOR_GRADE_ORDER.indexOf(b);
    });
  }, [availableGrades, fallbackGrades, tests, teacherWorkload.isTeacher, teacherWorkload.assignedGrades, isSecondaryPortal]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.hash = '#/app#assessment';
  }, []);

  useEffect(() => {
    if (stagedGrade && !filteredGrades.includes(toCanonicalGrade(stagedGrade))) {
      setStagedGrade('');
      resetStagedLearningAreaAndTest();
    }
  }, [stagedGrade, filteredGrades, resetStagedLearningAreaAndTest]);


  // Effects for Auto-selection & Prefill
  // 1. Auto-prefill Grade and Stream for teachers
  useEffect(() => {
    if (teacherWorkload.isTeacher && !teacherWorkload.loading && step === 1) {
      if (!setup.selectedGrade && teacherWorkload.primaryGrade) {
        setup.setSelectedGrade(teacherWorkload.primaryGrade);
      }
      if (!setup.selectedStream && teacherWorkload.primaryStream) {
        setup.setSelectedStream(teacherWorkload.primaryStream);
      }

      if (!stagedGrade && teacherWorkload.primaryGrade) {
        setStagedGrade(teacherWorkload.primaryGrade);
      }
      if (!stagedStream && teacherWorkload.primaryStream) {
        setStagedStream(teacherWorkload.primaryStream);
      }
      if (!stagedTerm) {
        setStagedTerm('TERM_1');
      }
    }
  }, [
    teacherWorkload.isTeacher,
    teacherWorkload.loading,
    teacherWorkload.primaryGrade,
    teacherWorkload.primaryStream,
    setup,
    step,
    stagedGrade,
    stagedStream,
    stagedTerm,
  ]);

  // 2. Auto-select Learning Area if only one is available
  useEffect(() => {
    if (teacherWorkload.isTeacher && filteredLearningAreasByWorkload.length === 1 && !selectedLearningArea && step === 1) {
      setSelectedLearningArea(filteredLearningAreasByWorkload[0]);
    }
  }, [teacherWorkload.isTeacher, filteredLearningAreasByWorkload, selectedLearningArea, step]);

  // 3. Auto-select Test if only one is available
  useEffect(() => {
    if (teacherWorkload.isTeacher && finalTests.length === 1 && !selectedTestId && step === 1) {
      setSelectedTestId(finalTests[0].id);
    }
  }, [teacherWorkload.isTeacher, finalTests, selectedTestId, step]);

  // Fetch Learners state (declared early to be used in assessmentProgress)
  const [fetchedLearners, setFetchedLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(false);

  // Calculate Assessment Progress
  const assessmentProgress = useMemo(() => {
    const totalLearners = fetchedLearners.length;
    const assessedCount = Object.keys(marks).filter(learnerId => {
      const mark = marks[learnerId]?.mark;
      return mark !== null && mark !== undefined && mark !== '';
    }).length;

    const percentage = totalLearners > 0 ? Math.round((assessedCount / totalLearners) * 100) : 0;
    const isComplete = assessedCount === totalLearners && totalLearners > 0;

    return { assessed: assessedCount, total: totalLearners, percentage, isComplete };
  }, [marks, fetchedLearners]);

  // Calculate Statistics for PDF
  const statistics = useMemo(() => {
    const validMarks = Object.values(marks).map(m => m?.mark).filter(m => m !== null && m !== undefined && m !== '');
    const numericMarks = validMarks.map(m => parseFloat(m));

    if (numericMarks.length === 0) {
      return { sum: 0, average: 0, count: 0, min: 0, max: 0, gradeDistribution: {} };
    }

    const sum = numericMarks.reduce((acc, val) => acc + val, 0);
    const average = sum / numericMarks.length;
    const min = Math.min(...numericMarks);
    const max = Math.max(...numericMarks);

    // Calculate grade distribution if grading scale exists
    const gradeDistribution = {};
    if (gradingScale && gradingScale.ranges && selectedTest?.totalMarks) {
      numericMarks.forEach(mark => {
        const percentage = (mark / selectedTest.totalMarks) * 100;
        const range = gradingScale.ranges.find(r =>
          percentage >= r.minPercentage && percentage <= r.maxPercentage
        );
        if (range) {
          const label = range.label || range.grade || 'Unknown';
          gradeDistribution[label] = (gradeDistribution[label] || 0) + 1;
        }
      });
    }

    return { sum, average: average.toFixed(2), count: numericMarks.length, min, max, gradeDistribution };
  }, [marks, gradingScale, selectedTest]);

  // Chunk learners into pages of 15 for PDF
  const learnersForPDF = useMemo(() => {
    return fetchedLearners.sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [fetchedLearners]);

  const chunkedLearners = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < learnersForPDF.length; i += 15) {
      chunks.push(learnersForPDF.slice(i, i + 15));
    }
    return chunks;
  }, [learnersForPDF]);

  // Load Grading Scale and Existing Results
  useEffect(() => {
    const loadTestDetails = async () => {
      if (!selectedTestId) {
        setGradingScale(null);
        setMarks({});
        return;
      }
      try {
        // 1. Fetch Grading Scale using selectedTest (resolved from state)
        const test = tests.find(t => String(t.id) === String(selectedTestId));
        if (test) {
          const systems = await gradingAPI.getSystems();
          let scale = null;

          if (test.scaleId) {
            scale = systems.find(s => String(s.id) === String(test.scaleId));
          }

          if (!scale) {
            const normalizedGrade = String(test.grade || '').replace(/\s+/g, '_').toUpperCase();
            const normalizedArea = String(test.learningArea || '').toUpperCase().trim();

            // Prioritize by Institution Type first
            const secondaryScales = systems.filter(s => s.type === 'SECONDARY');
            const primaryScales = systems.filter(s => s.type === 'PRIMARY' || !s.type);

            const searchPool = isSecondaryPortal ? [...secondaryScales, ...primaryScales] : [...primaryScales, ...secondaryScales];

            scale = searchPool.find(s => {
              const systemName = String(s.name).toUpperCase();
              
              // If we're in secondary portal, favor the hybrid/hierarchical scale
              if (isSecondaryPortal && systemName.includes('SENIOR')) return true;

              const hasGrade = systemName.includes(normalizedGrade);
              if (!hasGrade) return false;

              if (systemName.includes(normalizedArea)) return true;
              return false;
            });

            // Final fallback to any secondary scale if in secondary portal
            if (!scale && isSecondaryPortal) {
              scale = secondaryScales.find(s => s.isDefault) || secondaryScales[0];
            }
          }

          if (scale && scale.ranges) {
            scale.ranges.sort((a, b) => b.minPercentage - a.minPercentage);
            setGradingScale(scale);
          } else {
            setGradingScale(null);
          }
        }

        // 2. Fetch Existing Marks from backend first, then fall back to draft
        const draftKey = `draft-marks-${selectedTestId}`;
        const draftMetaKey = `draft-marks-meta-${selectedTestId}`;
        const savedDraft = localStorage.getItem(draftKey);
        let draftMeta = null;
        try {
          draftMeta = JSON.parse(localStorage.getItem(draftMetaKey) || 'null');
        } catch {
          draftMeta = null;
        }

        // Always try to load from backend first
        const resultsResponse = await assessmentAPI.getTestResults(selectedTestId);
        const results = resultsResponse.data || resultsResponse || [];

        if (results.length > 0) {
          // Backend has data — use backend marks as the source of truth.
          const existingMarks = {};
          results.forEach(r => {
            if (r.learnerId) {
              existingMarks[r.learnerId] = {
                mark: r.marksObtained,
                comment: r.teacherComment || ''
              };
            }
          });

          const backendUpdatedAtMs = results.reduce((maxTs, r) => {
            const ts = Date.parse(r?.updatedAt || r?.createdAt || 0);
            return Number.isFinite(ts) ? Math.max(maxTs, ts) : maxTs;
          }, 0);
          setMarks(existingMarks);
          setIsDraft(false);
          setLastSaved(new Date());
          setLastBackendSave(backendUpdatedAtMs ? new Date(backendUpdatedAtMs) : new Date());
        } else if (savedDraft) {
          // No backend data yet — restore local draft
          const parsedDraft = JSON.parse(savedDraft);
          setMarks(parsedDraft);
          setIsDraft(true);
          setLastSaved(new Date());
          toast('Draft marks restored — remember to save!', { icon: '📋' });
        } else {
          setMarks({});
          setIsDraft(false);
          setLastSaved(null);
          setLastBackendSave(null);
        }

      } catch (error) {
        console.error('Error loading test details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTestDetails();
  }, [selectedTestId, tests, schoolId]);

  useEffect(() => {
    if (!initialTestId || loading || initialTestAppliedRef.current) return;

    const test = tests.find((item) => String(item.id) === String(initialTestId));
    if (!test) return;

    const grade = toCanonicalGrade(test.grade || '');
    const term = test.term || '';
    const year = test.academicYear || getCurrentAcademicYear();
    const testType = resolveTestType(test);
    const learningArea = test.learningArea || '';

    setup.updateGrade(grade);
    setup.updateTerm(term);
    setup.updateAcademicYear(year);
    setSelectedTestType(testType);
    setSelectedLearningArea(learningArea);
    setSelectedTestId(test.id);
    setStagedGrade(grade);
    setStagedTerm(term);
    setStagedAcademicYear(year);
    setStagedTestType(testType);
    setStagedLearningArea(learningArea);
    setStagedTestId(test.id);
    setStep(2);
    initialTestAppliedRef.current = true;
  }, [
    initialTestId,
    loading,
    tests,
    setup.updateAcademicYear,
    setup.updateGrade,
    setup.updateTerm,
  ]);

  // Clear stale selected test IDs from localStorage/context if they no longer exist
  useEffect(() => {
    if (!selectedTestId || loading) return;

    const exists = tests.some((test) => String(test.id) === String(selectedTestId));
    if (!exists) {
      setSelectedTestId('');
      setStagedTestId('');
      setMarks({});
      localStorage.removeItem('cbc_summative_appliedTestId');
      localStorage.removeItem('cbc_summative_stagedTestId');
    }
  }, [selectedTestId, tests]);

  // ============================================================
  // AUTO-SAVE: debounce → localStorage + backend (twice per session)
  // ============================================================
  useEffect(() => {
    if (!selectedTestId) return;

    const draftKey = `draft-marks-${selectedTestId}`;
    const draftMetaKey = `draft-marks-meta-${selectedTestId}`;

    // Clear any pending timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      if (Object.keys(marks).length === 0) return;
      if (autoSaveInProgressRef.current) return;

      // 1. Always save to localStorage immediately
      localStorage.setItem(draftKey, JSON.stringify(marks));
      localStorage.setItem(draftMetaKey, JSON.stringify({ savedAt: new Date().toISOString() }));
      setIsDraft(true);
      setLastSaved(new Date());

      // 2. Persist to backend on every autosave cycle (no hard cap)
      autoSaveInProgressRef.current = true;
      try {
        const resultsToSave = Object.entries(marks)
          .filter(([, markData]) => {
            const m = markData?.mark;
            return m !== null && m !== undefined && m !== '';
          })
          .map(([learnerId, markData]) => ({
            learnerId,
            marksObtained: markData.mark,
            remarks: '-',
            teacherComment: markData.comment || ''
          }));

        if (resultsToSave.length > 0) {
          await assessmentAPI.recordBulkResults({
            testId: selectedTestId,
            results: resultsToSave
          });
          setLastBackendSave(new Date());
          setIsDraft(false);
          // Keep draft cache for conflict recovery instead of deleting it silently.

          // Mark this test as having results in the tests list (so tick appears immediately)
          setTests(prev => prev.map(t =>
            String(t.id) === String(selectedTestId)
              ? { ...t, _count: { ...t._count, results: Math.max((t._count?.results || 0), resultsToSave.length) } }
              : t
          ));

          // Subtle silent toast on auto-save to backend
          toast.success('Auto-saved', {
            duration: 2000,
            style: { fontSize: '12px', padding: '8px 12px' },
            icon: '🔄'
          });
        }
      } catch (err) {
        console.warn('[AutoSave] Backend auto-save failed, draft kept in localStorage:', err.message);
      } finally {
        autoSaveInProgressRef.current = false;
      }
    }, 3000); // 3-second debounce

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [marks, selectedTestId]);


  // Fetch Learners when test is selected
  useEffect(() => {
    if (!selectedTestId) return;

    // Look up the test directly from the tests array — selectedTest (useMemo) may
    // not yet reflect the updated selectedTestId on the same render cycle.
    const resolvedTest = tests.find(t => String(t.id) === String(selectedTestId));
    if (!resolvedTest) return;

    const fetchLearners = async () => {
      setLoadingLearners(true);
      try {
        const params = {
          grade: resolvedTest.grade,
          status: 'ACTIVE',
          limit: 1000,
        };

        // Use the ref instead of setup.selectedStream — the hook state may
        // still hold the previous value on the same render cycle that
        // applyFilters() was called.
        const streamToApply = appliedStreamRef.current || setup.selectedStream;
        if (streamToApply) {
          params.stream = streamToApply;
        }

        const response = await learnerAPI.getAll(params);
        const learnersData = response.data || response || [];
        setFetchedLearners(Array.isArray(learnersData) ? learnersData : []);
      } catch (error) {
        console.error('Error fetching learners:', error);
        toast.error('Failed to load learners');
        setFetchedLearners([]);
      } finally {
        setLoadingLearners(false);
      }
    };

    fetchLearners();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestId, tests, setup.selectedStream])

  const filteredLearners = useMemo(() => {
    let result = fetchedLearners;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l =>
        (l.firstName + ' ' + l.lastName).toLowerCase().includes(query) ||
        (l.admissionNumber || '').toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [fetchedLearners, searchQuery]);

  // Helpers
  const handleMarkChange = (learnerId, value) => {
    const numValue = parseFloat(value);
    if (value === '') {
      setMarks(prev => ({
        ...prev,
        [learnerId]: {
          ...(prev[learnerId] || {}),
          mark: ''
        }
      }));
      return;
    }

    if (!isNaN(numValue)) {
      setMarks(prev => ({
        ...prev,
        [learnerId]: {
          ...(prev[learnerId] || {}),
          mark: Math.min(Math.max(0, numValue), selectedTest?.totalMarks || 100)
        }
      }));
    }
  };

  const handleCommentChange = (learnerId, value) => {
    setMarks(prev => ({
      ...prev,
      [learnerId]: {
        ...(prev[learnerId] || { mark: '' }),
        comment: value
      }
    }));
  };

  const getDescriptionForGrade = (mark, total, learnerName) => {
    if (!total || mark === undefined || mark === null || mark === '') return 'Not assessed';

    const percentage = (mark / total) * 100;

    if (gradingScale && gradingScale.ranges) {
      const range = gradingScale.ranges.find(r =>
        percentage >= r.minPercentage && percentage <= r.maxPercentage
      );
      if (range) {
        let label = range.label;
        let band = range.parentBand || '';
        
        // Format: "Exceeding Expectations (EE1)"
        const fullLabel = band ? `${band} (${label})` : label;

        if (range.description) {
          return range.description.replace(/\{\{learner\}\}/g, learnerName || 'Learner');
        }
        return fullLabel;
      }
      return 'Not assessed';
    }

    return 'Not assessed';
  };



  const handlePrintReport = async (onProgress) => {
    try {
      setGeneratingPDF(true);

      if (onProgress) onProgress('Preparing report...', 10);

      await new Promise(resolve => setTimeout(resolve, 500));

      if (onProgress) onProgress('Processing content...', 20);

      const schoolInfo = {
        schoolName: user?.school?.name || brandingSettings?.schoolName || 'School Name',
        address: user?.school?.address || brandingSettings?.address || 'School Address',
        phone: user?.school?.phone || brandingSettings?.phone || 'Phone Number',
        email: user?.school?.email || brandingSettings?.email || 'email@school.com',
        website: user?.school?.website || brandingSettings?.website || 'www.school.com',
        logoUrl: brandingSettings?.logoUrl || user?.school?.logo || '/branding/logo.png',
        brandColor: brandingSettings?.brandColor || '#1e3a8a',
        skipLetterhead: true
      };

      const testName = (selectedTest?.title || selectedTest?.name || 'test').replace(/\s+/g, '_');
      const grade = selectedTest?.grade?.replace('_', '') || 'Grade';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${grade}_${testName}_Results_${timestamp}.pdf`;

      const result = await generatePDFWithLetterhead(
        'assessment-report-content',
        filename,
        schoolInfo,
        {
          orientation: 'landscape',
          scale: 2,
          multiPage: true,
          onProgress: (message, progress) => {
            if (onProgress) {
              onProgress(message, progress);
            }
          }
        }
      );

      if (result.success) {
        if (onProgress) onProgress('Complete!', 100);
        toast.success('✅ PDF report downloaded successfully!');
      } else {
        toast.error(`Failed to generate PDF: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('Print report error:', error);
      toast.error('Failed to generate PDF report');
      throw error;
    } finally {
      setGeneratingPDF(false);
      setLoading(false);
    }
  };

  const handleExport = async (type = 'xlsx') => {
    if (filteredLearners.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = filteredLearners.map(l => ({
      'Admission Number': l.admissionNumber,
      'Student Name': `${l.firstName} ${l.lastName}`,
      'Mark': marks[l.id]?.mark || '',
      'Teacher Comment': marks[l.id]?.comment || ''
    }));

    const headers = Object.keys(exportData[0] || {});
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Marks');
    worksheet.columns = headers.map(header => ({ header, key: header, width: 20 }));
    exportData.forEach(row => worksheet.addRow(row));

    const fileName = `${(selectedTest?.title || 'Marks').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}`;

    if (type === 'xlsx') {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      const escapeCsvValue = (value) => {
        if (value == null) return '';
        const stringValue = String(value).replace(/"/g, '""');
        return /[",\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
      };

      const csvRows = [headers.join(',')].concat(
        exportData.map(row => headers.map(header => escapeCsvValue(row[header])).join(','))
      );
      const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    toast.success(`Successfully exported to ${type.toUpperCase()}`);
  };

  // ============================================================
  // MANUAL SAVE — with dedicated isSaving state + toast feedback
  // ============================================================
  const handleSave = async (marksToSaveOverride = null) => {
    const currentMarksToSave = marksToSaveOverride || marks;

    if (Object.keys(currentMarksToSave).length === 0) {
      toast.error('No marks entered to save');
      return;
    }

    // Use isSaving (not loading) so the page stays interactive
    setIsSaving(true);

    // Show a loading toast while the save is in progress
    const saveToastId = toast.loading('Saving marks…');

    try {
      // Check for existing results before saving
      const existingResultsResponse = await assessmentAPI.getTestResults(selectedTestId);
      const existingResults = existingResultsResponse.data || existingResultsResponse || [];

      if (existingResults.length > 0) {
        toast('Existing results detected. Saving will overwrite them.', { icon: 'ℹ️' });
      }

      // Prepare bulk payload — skip learners with no mark entered
      const resultsToSave = Object.entries(currentMarksToSave)
        .filter(([, markData]) => {
          const m = markData?.mark;
          return m !== null && m !== undefined && m !== '';
        })
        .map(([learnerId, markData]) => {
          const mark = markData.mark;
          const existingResult = existingResults.find(r => r.learnerId === learnerId);
          let remarks = existingResult?.remarks || '-';
          let teacherComment = markData.comment || existingResult?.teacherComment || '';

          if (selectedTest?.totalMarks && mark !== null && mark !== undefined && mark !== '') {
            const percentage = (mark / selectedTest.totalMarks) * 100;
            if (gradingScale && gradingScale.ranges) {
              const range = gradingScale.ranges.find(r => percentage >= r.minPercentage && percentage <= r.maxPercentage);
              remarks = range ? range.label : remarks;
            }
          }

          return {
            learnerId,
            marksObtained: mark,
            remarks,
            teacherComment
          };
        });

      if (resultsToSave.length === 0) {
        toast.dismiss(saveToastId);
        toast.error('No marks to save — enter at least one score first.');
        return;
      }

      // Send bulk request
      await assessmentAPI.recordBulkResults({
        testId: selectedTestId,
        results: resultsToSave
      });

      // After successful save, refresh marks from backend
      const updatedResultsResponse = await assessmentAPI.getTestResults(selectedTestId);
      const updatedResults = updatedResultsResponse.data || updatedResultsResponse || [];
      const updatedMarks = {};
      updatedResults.forEach(r => {
        if (r.learnerId) {
          updatedMarks[r.learnerId] = {
            mark: r.marksObtained,
            comment: r.teacherComment || ''
          };
        }
      });
      setMarks(updatedMarks);

      // Clear local draft + metadata — backend is now authoritative
      localStorage.removeItem(`draft-marks-${selectedTestId}`);
      localStorage.removeItem(`draft-marks-meta-${selectedTestId}`);
      setIsDraft(false);
      const now = new Date();
      setLastSaved(now);
      setLastBackendSave(now);

      // ── Update the test's _count.results so the green tick appears immediately ──
      setTests(prev => prev.map(t =>
        String(t.id) === String(selectedTestId)
          ? { ...t, _count: { ...t._count, results: updatedResults.length || resultsToSave.length } }
          : t
      ));

      // Dismiss loading toast and show success
      toast.dismiss(saveToastId);
      toast.success(`✅ Saved marks for ${resultsToSave.length} learner${resultsToSave.length !== 1 ? 's' : ''}!`, {
        duration: 4000,
      });

    } catch (error) {
      console.error('Save error:', error);
      toast.dismiss(saveToastId);
      toast.error(`Failed to save marks: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Render Main Page with persistent filter bar
  return (
    <div className="min-h-screen bg-slate-50/30">
      {/* react-hot-toast container — renders toasts for this component */}
      <Toaster
        position="top-right"
        toastOptions={{
          success: {
            style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
            iconTheme: { primary: '#16a34a', secondary: '#fff' },
          },
          error: {
            style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
            iconTheme: { primary: '#dc2626', secondary: '#fff' },
          },
          loading: {
            style: { background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0' },
          },
        }}
      />

      {/* Combined Sticky Header + Filter Bar - Unified Component */}
      <div className="sticky top-0 z-40 bg-white shadow-sm">
        {/* Assessment Header - Renders above filter when test selected */}
        {selectedTestId && (
          <div className="border-b border-gray-100 px-6 py-4 flex gap-4">
            <div className="flex-1">
              {/* Top Row: Context & Helper */}
              <div className="flex items-center justify-between mb-2 h-5">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span>Assessment</span>
                  <ChevronRight size={10} className="text-gray-300" />
                  <span className="capitalize">{setup.selectedGrade?.replace(/_/g, ' ').toLowerCase()}</span>
                  <ChevronRight size={10} className="text-gray-300" />
                  <span className="capitalize">{setup.selectedTerm?.replace(/_/g, ' ').toLowerCase()}</span>
                </div>
              </div>

              {/* Bottom Row: Title & Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Green tick in the header title when test has saved results */}
                  {selectedTest && (selectedTest._count?.results ?? 0) > 0 && (
                    <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" title="Assessment has saved results" />
                  )}
                  <h2 className="text-lg font-medium text-gray-800 leading-none">
                    {selectedTest?.title || selectedTest?.name}
                  </h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-wide border ${assessmentProgress.percentage === 100
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                    {assessmentProgress.percentage}% Complete
                  </span>

                  {selectedTest?.weight !== undefined && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium tracking-wide border bg-amber-50 text-amber-700 border-amber-200">
                      Weight: {selectedTest.weight}
                    </span>
                  )}

                  {/* Save indicator: shows backend save time or draft status */}
                  {lastBackendSave && !isDraft && (
                    <span className="text-[10px] text-gray-400 font-medium italic flex items-center gap-1.5 ml-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      Saved at {lastBackendSave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {isDraft && lastSaved && (
                    <span className="text-[10px] text-amber-500 font-medium italic flex items-center gap-1.5 ml-1">
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></div>
                      Draft — auto-saving…
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center">
                  <button
                    onClick={() => setShowPDFPreview(true)}
                    disabled={generatingPDF || filteredLearners.length === 0}
                    className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preview
                  </button>

                  <div className="h-3 w-px bg-gray-200 mx-3" />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport('xlsx')}
                      disabled={filteredLearners.length === 0}
                      className="flex items-center gap-1.5 text-sm font-medium text-brand-purple hover:text-brand-purple/80 transition-colors disabled:opacity-50"
                      title="Export to Excel"
                    >
                      <FileSpreadsheet size={16} />
                      Excel
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={filteredLearners.length === 0}
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
                      title="Export to CSV"
                    >
                      <Download size={16} />
                      CSV
                    </button>
                  </div>

                  <div className="h-3 w-px bg-gray-200 mx-3" />

                  <button
                    onClick={() => setShowBulkImportModal(true)}
                    disabled={!selectedTestId || loading || loadingLearners}
                    className="flex items-center gap-1.5 text-sm font-medium text-brand-teal hover:text-brand-teal/80 transition-colors disabled:opacity-50"
                  >
                    <UploadCloud size={16} />
                    Import
                  </button>

                  <div className="h-3 w-px bg-gray-200 mx-3" />

                  {/* MANUAL SAVE BUTTON — uses isSaving, not loading */}
                  <button
                    onClick={() => handleSave()}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 text-sm font-medium text-[#0D9488] hover:text-[#0f766e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar - Always visible below header */}
        <div className="border-t border-slate-200 px-6 py-3.5">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={handleBack}
              className="h-9 px-3 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 flex-shrink-0"
              title="Go back"
            >
              <ArrowLeft size={14} />
              Back
            </button>

            {/* Grade - Compact Input */}
            <select
              value={stagedGrade}
              onChange={(e) => {
                setStagedGrade(e.target.value);
                resetStagedLearningAreaAndTest();
              }}
              className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors w-28"
              title="Select Grade"
            >
              <option value="">— Grade —</option>
              {filteredGrades.map(g => (
                <option key={g} value={g}>
                  {formatGradeLabel(g)}
                </option>
              ))}
            </select>

            {/* Stream - Compact */}
            <select
              value={stagedStream}
              onChange={(e) => setStagedStream(e.target.value)}
              disabled={!stagedGrade || availableStreams.length === 0}
              className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 w-24"
              title="Select Stream"
            >
              <option value="">{availableStreams.length === 0 ? 'No Streams' : '— Stream —'}</option>
              {availableStreams.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Academic Term */}
            <select
              value={stagedTerm}
              onChange={(e) => {
                setStagedTerm(e.target.value);
                resetStagedLearningAreaAndTest();
              }}
              className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors w-24"
              title="Select Term"
            >
              <option value="">— Term —</option>
              {availableTerms.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>

            {/* Academic Year */}
            <select
              value={stagedAcademicYear}
              onChange={(e) => {
                setStagedAcademicYear(e.target.value ? parseInt(e.target.value, 10) : '');
                resetStagedLearningAreaAndTest();
              }}
              className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors w-24"
              title="Select Academic Year"
            >
              <option value="">— Year —</option>
              {getAcademicYearOptions().map(y => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>

            {/* Exam Type */}
            <select
              value={stagedTestType}
              onChange={(e) => {
                setStagedTestType(e.target.value);
                resetStagedLearningAreaAndTest();
              }}
              disabled={!stagedGrade || !stagedTerm || !stagedAcademicYear}
              className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 w-36"
              title="Select Exam Type"
            >
              <option value="">— Exam Type —</option>
              {ASSESSMENT_TEST_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Learning Area */}
            <select
              value={stagedLearningArea}
              onChange={(e) => {
                setStagedLearningArea(e.target.value);
                setStagedTestId('');
              }}
              disabled={!stagedGrade || !stagedTerm || !stagedAcademicYear || !stagedTestType || stagedAvailableLearningAreas.length === 0}
              className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 flex-1 min-w-[140px]"
              title="Select Learning Area"
            >
              <option value="">
                {!stagedGrade ? '← Select Grade first' : !stagedTerm ? '← Select Term first' : !stagedAcademicYear ? '← Select Year first' : !stagedTestType ? '← Select Exam Type first' : '— Subject / Area —'}
              </option>
              {stagedFilteredLearningAreasByWorkload.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200 flex-shrink-0" />

            {/* ── Test Picker ── */}
            <TestPicker
              tests={stagedFinalTests}
              value={stagedTestId}
              onChange={(id) => setStagedTestId(id)}
              disabled={!stagedLearningArea || stagedFinalTests.length === 0}
            />

            {/* No tests hint */}
            {stagedGrade && stagedTerm && stagedAcademicYear && stagedLearningArea && stagedFinalTests.length === 0 && (
              <span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded px-2 py-1 whitespace-nowrap">
                No tests found for selection
              </span>
            )}

            {/* Apply Filters Button - Green button clicked to apply filters */}
            <button
              onClick={applyFilters}
              disabled={!canLoadAssessment}
              className="h-9 px-3 rounded bg-brand-teal hover:bg-brand-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
              title={canLoadAssessment ? 'Click to load assessment' : loadDisabledReason}
            >
              <PlayCircle size={16} className="text-white" />
              <span className="text-xs font-medium text-white">Load</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedTestId && (
        <div className="px-6 py-12">
          <EmptyState
            icon={Database}
            title="No Assessment Selected"
            message="Select a grade, term, learning area, and test to begin recording assessments. The results table will appear below the filters as soon as you make a selection."
            actionText="Go to Test Management"
            onAction={() => window.location.hash = '#/assess-summative-tests'}
          />
        </div>
      )}

      {/* Assessment Table - Renders below filter bar when test selected */}
      {selectedTestId && (
        <div className="p-6">
          {/* PDF Export Content Wrapper */}
          <div id="assessment-report-content" className="bg-white">

            {/* STUDENT RESULTS TABLES (Chunked for pagination) */}
            {chunkedLearners.map((chunk, pageIndex) => (
              <div
                key={pageIndex}
                className="px-5 print-only flex flex-col"
                style={{
                  pageBreakBefore: pageIndex === 0 ? 'avoid' : 'always',
                  pageBreakAfter: pageIndex === chunkedLearners.length - 1 ? 'auto' : 'always',
                  pageBreakInside: 'avoid',
                  minHeight: '100vh',
                  paddingTop: pageIndex === 0 ? '20px' : '95px',
                  paddingBottom: '113px',
                  paddingLeft: '20px',
                  paddingRight: '20px',
                  marginLeft: '0',
                  marginRight: '0'
                }}
              >
                {/* Letterhead / Page Header - Logo Left, Text Right - First Page Only */}
                {pageIndex === 0 && (
                  <div style={{
                    paddingBottom: '1rem',
                    borderBottom: '3px solid #1e3a8a',
                    marginBottom: '1.5rem',
                    pageBreakInside: 'avoid'
                  }}>
                    <div className="flex items-center justify-between gap-8">
                      {/* Logo Column - Left */}
                      <div className="flex-shrink-0 pr-6">
                        <img
                          src={brandingSettings?.logoUrl || user?.school?.logo || '/branding/logo.png'}
                          alt="School Logo"
                          className="h-24 w-24 object-contain"
                          onError={(e) => { e.target.src = '/branding/logo.png'; }}
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(30, 58, 138, 0.1))' }}
                        />
                      </div>

                      {/* Text Content Column - Right, Right-Aligned */}
                      <div className="flex-1 text-right">
                        <h1 className="text-2xl font-medium text-[#1e3a8a] uppercase tracking-wider leading-tight">
                          {user?.school?.name || user?.schoolName || 'SCHOOL NAME'}
                        </h1>
                        <h2 className="text-base font-medium text-gray-800 leading-tight mt-1">
                          Summative Assessment Results
                        </h2>
                        <p className="text-sm text-gray-700 font-semibold leading-tight mt-0.5">
                          {selectedTest?.learningArea} | {selectedTest?.grade?.replace('_', ' ')} | {setup.selectedStream || 'All Streams'}
                        </p>
                        <p className="text-sm text-gray-600 leading-tight mt-0.5">
                          {selectedTest?.term?.replace('_', ' ')} {selectedTest?.academicYear || new Date().getFullYear()} | Total Marks: {selectedTest?.totalMarks} | Weight: {selectedTest?.weight || '1.0'} | Test Date: {selectedTest?.testDate ? new Date(selectedTest.testDate).toLocaleDateString('en-GB') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table Container with safe padding */}
                <div className="flex-1 overflow-hidden" style={{
                  pageBreakInside: 'avoid',
                  paddingLeft: '0',
                  paddingRight: '0',
                  marginBottom: '50px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <table className="w-full text-left border-collapse border border-gray-300 table--header-invert" style={{ pageBreakInside: 'avoid' }}>
                    <thead className="bg-[#1e3a8a] text-white" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
                      <tr style={{ pageBreakInside: 'avoid' }}>
                        <th className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wide text-center w-10 border-r border-blue-700">No</th>
                        <th className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wide text-center w-20 border-r border-blue-700">Adm No</th>
                        <th className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wide border-r border-blue-700">Student Name</th>
                        <th className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wide text-center w-20 border-r border-blue-700">Score</th>
                        <th className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wide w-72">Competence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {chunk.map((learner, index) => {
                        const globalIndex = pageIndex * 10 + index;
                        const score = marks[learner.id];

                        return (
                          <tr key={learner.id} className={`${index % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}`} style={{ pageBreakInside: 'avoid' }}>
                            <td className="px-2 py-1.5 text-xs text-center font-semibold text-gray-700 border-r border-gray-200">{globalIndex + 1}</td>
                            <td className="px-2 py-1.5 text-xs text-center font-semibold text-gray-900 border-r border-gray-200">{learner.admissionNumber}</td>
                            <td className="px-2 py-1.5 text-xs font-medium text-[#1e293b] border-r border-gray-200">
                              {learner.firstName?.toUpperCase()} {learner.lastName?.toUpperCase()}
                            </td>
                            <td className="px-2 py-1.5 text-center border-r border-gray-200">
                              <span className="inline-block font-medium text-sm text-gray-900">
                                {score?.mark ?? '-'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-[10px] text-[#475569] italic leading-snug">
                              {getDescriptionForGrade(marks[learner.id]?.mark, selectedTest?.totalMarks, learner.firstName)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Summary row on LAST page only */}
                    {pageIndex === chunkedLearners.length - 1 && (
                      <tfoot className="bg-gray-100 border-t-2 border-gray-400">
                        <tr>
                          <td colSpan="3" className="px-2 py-2 text-xs font-medium text-gray-800 text-right">
                            Summary:
                          </td>
                          <td className="px-2 py-2 text-center border-r border-gray-300">
                            <div className="text-[10px] font-medium text-gray-900">
                              Avg: {statistics.average}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-[10px] text-gray-700">
                            Total: <span className="font-medium">{statistics.count}</span> |
                            Sum: <span className="font-medium">{statistics.sum.toFixed(2)}</span> |
                            Range: <span className="font-medium">{statistics.min}-{statistics.max}</span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Page number */}
                <div className="text-right text-xs text-gray-500 mt-auto pt-4" style={{
                  marginTop: 'auto',
                  paddingTop: '1rem',
                  pageBreakInside: 'avoid'
                }}>
                  Page {pageIndex + 2} of {chunkedLearners.length + 1}
                </div>
              </div>
            ))}
          </div>

          {/* INTERACTIVE TABLE FOR SCREEN (with search) - NOT printed */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 no-print">
            <div className="p-4 border-b border-gray-200 flex justify-start">
              <div className="relative w-96">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or adm no..."
                  className="w-full pl-12 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <VirtualizedTable
                tableClassName="table--header-invert"
                data={filteredLearners}
                rowHeight={40}
                visibleHeight={500}
                emptyComponent={
                  <div className="px-6 py-12 text-center text-gray-500 text-sm">
                    No learners found for this grade/stream.
                  </div>
                }
                header={
                  <tr className="bg-brand-purple text-white">
                    <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-center w-10 border-r border-brand-purple/20">No</th>
                    <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-center w-32 border-r border-brand-purple/20">Adm No</th>
                    <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wide border-r border-brand-purple/20 w-1/3">Student Name</th>
                    <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-center w-20 border-r border-brand-purple/20">Score</th>
                    <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wide">Competence</th>
                  </tr>
                }
                renderRow={(learner, index) => {
                  const score = marks[learner.id];
                  return (
                    <tr key={learner.id} className={`${index % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'} hover:bg-[#f1f5f9] transition`}>
                      <td className="px-3 py-1.5 text-xs text-center font-semibold text-gray-700 border-r border-gray-200">{index + 1}</td>
                      <td className="px-3 py-1.5 text-xs text-center font-semibold text-gray-900 border-r border-gray-200">{learner.admissionNumber}</td>
                      <td className="px-3 py-1.5 text-xs font-medium text-[#1e293b] border-r border-gray-200">
                        {learner.firstName?.toUpperCase()} {learner.lastName?.toUpperCase()}
                      </td>
                      <td className="px-3 py-1.5 text-center border-r border-gray-200">
                        <input
                          type="number"
                          min="0"
                          max={selectedTest?.totalMarks}
                          value={marks[learner.id]?.mark ?? ''}
                          onChange={(e) => handleMarkChange(learner.id, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 bg-white rounded focus:ring-2 focus:ring-brand-purple outline-none transition text-center font-semibold text-xs"
                          placeholder="-"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-[10px] text-[#475569] italic leading-snug">
                        {getDescriptionForGrade(marks[learner.id]?.mark, selectedTest?.totalMarks, learner.firstName)}
                      </td>
                    </tr>
                  );
                }}
              />
            </div>
          </div>

          {/* Bulk Mark Import Modal */}
          <BulkMarkImportModal
            show={showBulkImportModal}
            onClose={() => setShowBulkImportModal(false)}
            onImport={(importedMarks) => {
              // Wrap simple values into the expected object structure
              const formattedMarks = {};
              Object.entries(importedMarks).forEach(([id, val]) => {
                formattedMarks[id] = { mark: val, comment: '' };
              });
              setMarks(prevMarks => ({ ...prevMarks, ...formattedMarks }));
              handleSave(formattedMarks);
              setShowBulkImportModal(false);
            }}
            learners={fetchedLearners}
            totalMarks={selectedTest?.totalMarks}
          />

          {/* PDF Preview Modal */}
          <PDFPreviewModal
            show={showPDFPreview}
            onClose={() => setShowPDFPreview(false)}
            onGenerate={handlePrintReport}
            contentElementId="assessment-report-content"
            title={`${selectedTest?.learningArea || 'Assessment'} Results - ${selectedTest?.grade?.replace('_', ' ') || ''}`}
          />
        </div>
      )}
    </div>
  );
};

// ============================================
// ENHANCED PIE CHART COMPONENT WITH LABELS
// ============================================
const PieChartWithLabels = ({ data }) => {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  let currentAngle = -90; // Start from top

  return (
    <g>
      {Object.entries(data).map(([grade, count]) => {
        const percentage = (count / total) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;

        const startX = 100 + 85 * Math.cos((startAngle * Math.PI) / 180);
        const startY = 100 + 85 * Math.sin((startAngle * Math.PI) / 180);
        const endX = 100 + 85 * Math.cos((endAngle * Math.PI) / 180);
        const endY = 100 + 85 * Math.sin((endAngle * Math.PI) / 180);

        const largeArcFlag = angle > 180 ? 1 : 0;

        const pathData = [
          `M 100 100`,
          `L ${startX} ${startY}`,
          `A 85 85 0 ${largeArcFlag} 1 ${endX} ${endY}`,
          `Z`
        ].join(' ');

        const middleAngle = (startAngle + endAngle) / 2;
        const labelRadius = 60;
        const labelX = 100 + labelRadius * Math.cos((middleAngle * Math.PI) / 180);
        const labelY = 100 + labelRadius * Math.sin((middleAngle * Math.PI) / 180);

        currentAngle = endAngle;

        return (
          <g key={grade}>
            <path
              d={pathData}
              fill={getGradeColor(grade)}
              stroke="#ffffff"
              strokeWidth="2.5"
              opacity="0.95"
            />
            {percentage >= 5 && (
              <>
                <circle cx={labelX} cy={labelY} r="12" fill="white" opacity="0.9" />
                <text
                  x={labelX} y={labelY + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="9" fontWeight="bold" fill={getGradeColor(grade)}
                >
                  {percentage.toFixed(0)}%
                </text>
              </>
            )}
          </g>
        );
      })}

      <circle
        cx="100" cy="100" r="32"
        fill="white" stroke="#cbd5e1" strokeWidth="3"
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
      />
      <text x="100" y="95" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1e293b">{total}</text>
      <text x="100" y="108" textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="600">Students</text>
    </g>
  );
};

export default SummativeAssessment;
