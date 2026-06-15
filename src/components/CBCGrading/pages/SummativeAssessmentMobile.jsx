import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Home,
  Loader,
  MoreHorizontal,
  Save,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { assessmentAPI, learnerAPI } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { useInstitutionLabels } from '../../../hooks/useInstitutionLabels';
import { useNotifications } from '../hooks/useNotifications';
import { useTeacherWorkload } from '../hooks/useTeacherWorkload';
import EmptyState from '../shared/EmptyState';
import { cn } from '../../../utils/cn';
import { getCurrentTerm } from '../utils/academicYear';
import { normalizeTestType } from '../utils/testType';

const TEST_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'OPENER', label: 'Opener' },
  { value: 'CAT', label: 'CAT' },
  { value: 'MID_TERM', label: 'Mid Term' },
  { value: 'END_TERM', label: 'End Term' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'MOCK', label: 'Mock' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'OTHER', label: 'Other' },
];

const TERM_LABELS = {
  TERM_1: 'Term 1',
  TERM_2: 'Term 2',
  TERM_3: 'Term 3',
};

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

const getTestArea = (test) => {
  if (test?.learningArea) return test.learningArea;
  const match = String(test?.title || '').match(/\((.*?)\)$/);
  return match ? match[1].trim() : 'Assessment';
};

const formatGradeDisplay = (grade) => {
  const g = toCanonicalGrade(grade);
  if (g.startsWith('GRADE_')) return `Grade ${g.replace('GRADE_', '')}`;
  if (g.startsWith('GRADE')) return `Grade ${g.replace('GRADE', '')}`;
  return String(g || 'Class').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatTerm = (term) => TERM_LABELS[term] || String(term || '').replace(/_/g, ' ') || 'Current Term';

const formatDate = (value) => {
  if (!value) return 'Not updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not updated';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const percentage = (entered, total) => (total > 0 ? Math.round((entered / total) * 100) : 0);

const getResultLearnerId = (result) => result?.learnerId || result?.learner?.id;
const hasMark = (value) => value !== null && value !== undefined && value !== '';
const resultHasMark = (result) => hasMark(result?.marksObtained) || hasMark(result?.assessmentStatusCode);

const statusFor = (entered, total, test) => {
  const publishedStatus = String(test?.resultStatus || test?.resultsStatus || '').toUpperCase();
  if (publishedStatus === 'PUBLISHED') return 'Published';
  if (entered <= 0) return 'Not Started';
  if (entered >= total && total > 0) return 'Complete';
  return 'In Progress';
};

const statusClass = (status) => {
  switch (status) {
    case 'Published':
      return 'bg-brand-purple/10 text-brand-purple border-brand-purple/20';
    case 'Complete':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'In Progress':
      return 'bg-amber-50 text-amber-700 border-amber-100';
    default:
      return 'bg-slate-50 text-slate-500 border-slate-100';
  }
};

const MobileAssessmentBottomNav = ({ active = 'assessments', onNavigate }) => {
  const items = [
    { id: 'dashboard', label: 'Dashboard', path: 'dashboard', icon: Home },
    { id: 'learners', label: 'Learners', path: 'learners-list', icon: Users },
    { id: 'assessments', label: 'Assessments', path: 'assess-mobile-dashboard', icon: ClipboardList },
    { id: 'reports', label: 'Reports', path: 'assess-summary-report', icon: BarChart3 },
    { id: 'more', label: 'More', path: 'settings', icon: MoreHorizontal },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[80] border-t border-slate-200 bg-white/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.path)}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-bold transition',
                isActive ? 'bg-brand-purple/10 text-brand-purple' : 'text-slate-500 active:bg-slate-50'
              )}
            >
              <Icon size={20} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const ProgressBar = ({ value }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div className="h-full rounded-full bg-brand-teal transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

const MetricPill = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-50 px-3 py-2">
    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
    <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
  </div>
);

const SummativeClassCard = ({ item, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="w-full rounded-[1.75rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition active:scale-[0.99]"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-lg font-black text-slate-950">{item.name}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {item.learnerCount} learners · {item.subjectCount} subjects
        </p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple">
        <ChevronRight size={22} />
      </div>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-2">
      <MetricPill label="Completion" value={`${item.completion}%`} />
      <MetricPill label="Missing" value={item.missingCount} />
    </div>
    <div className="mt-4">
      <ProgressBar value={item.completion} />
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
        Last updated {formatDate(item.lastUpdated)}
      </p>
    </div>
  </button>
);

const SummativeSubjectCard = ({ item, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="w-full rounded-[1.5rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition active:scale-[0.99]"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-base font-black text-slate-950">{item.subjectName}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {item.enteredCount}/{item.totalLearners} learners entered
        </p>
      </div>
      <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black', statusClass(item.status))}>
        {item.status}
      </span>
    </div>
    <div className="mt-4 flex items-center gap-3">
      <ProgressBar value={item.completion} />
      <span className="w-10 text-right text-sm font-black text-slate-900">{item.completion}%</span>
    </div>
  </button>
);

const LearnerMarkCard = ({ learner, mark, totalMarks, onChange, saved }) => {
  const learnerId = learner.id || learner._id;
  const numericMark = Number(mark);
  const markIsValid = hasMark(mark) && Number.isFinite(numericMark);
  const markTooHigh = markIsValid && Number.isFinite(Number(totalMarks)) && Number(totalMarks) > 0 && numericMark > Number(totalMarks);
  const preview = markIsValid && !markTooHigh && totalMarks
    ? `${Math.round((numericMark / Number(totalMarks)) * 100)}%`
    : null;

  return (
    <article
      className={cn(
        'rounded-[1.5rem] border bg-white p-4 shadow-sm',
        !hasMark(mark) ? 'border-amber-100' : markTooHigh ? 'border-red-200 bg-red-50/40' : saved ? 'border-emerald-100 bg-emerald-50/30' : 'border-brand-purple/20'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-950">
            {learner.firstName} {learner.lastName || ''}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
            {learner.admissionNumber || 'No admission number'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">Preview</p>
          <p className={cn('mt-1 text-sm font-black', preview ? 'text-brand-purple' : 'text-slate-300')}>
            {preview || 'Missing'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max={totalMarks || undefined}
          value={mark ?? ''}
          onChange={(event) => onChange(learnerId, event.target.value)}
          placeholder="Mark"
          className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 text-center text-xl font-black text-slate-950 outline-none transition focus:border-brand-purple focus:bg-white"
        />
        <div className="flex h-14 min-w-[64px] items-center justify-center rounded-2xl bg-slate-50 px-3 text-sm font-black text-slate-500">
          / {totalMarks || 100}
        </div>
      </div>

      {markTooHigh && (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-red-600">
          <AlertCircle size={14} /> Mark exceeds total marks.
        </p>
      )}
      {!hasMark(mark) && (
        <p className="mt-3 text-xs font-bold text-amber-600">Missing mark</p>
      )}
    </article>
  );
};

const SummativeAssessmentMobile = ({
  initialTestId,
  defaultTestType = null,
  onBack,
  onNavigate,
}) => {
  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();
  const labels = useInstitutionLabels();
  const teacherWorkload = useTeacherWorkload();
  const {
    loading: teacherWorkloadLoading,
    isTeacher,
    hasAnyAssignments,
    isAssignedToGrade,
    getAssignedSubjectsForGrade,
  } = teacherWorkload;

  const isSecondaryPortal = String(user?.institutionType || '').toUpperCase() === 'SECONDARY';
  const defaultType = normalizeTestType(defaultTestType);

  const [screen, setScreen] = useState(initialTestId ? 'marks' : 'dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tests, setTests] = useState([]);
  const [resultsByTest, setResultsByTest] = useState({});
  const [learnersByGrade, setLearnersByGrade] = useState({});
  const [selectedTerm, setSelectedTerm] = useState(getCurrentTerm());
  const [selectedType, setSelectedType] = useState(defaultType || 'all');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTestId, setSelectedTestId] = useState(initialTestId || '');
  const [marks, setMarks] = useState({});
  const [savedMarks, setSavedMarks] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [markFilter, setMarkFilter] = useState('all');
  const [reviewed, setReviewed] = useState(false);

  const selectedTest = useMemo(
    () => tests.find((test) => String(test.id) === String(selectedTestId)) || null,
    [tests, selectedTestId]
  );

  const canSeeTest = useCallback((test) => {
    const grade = toCanonicalGrade(test?.grade);
    if (isSecondaryPortal ? !isSecondaryGrade(grade) : !isJuniorGrade(grade)) return false;

    if (isTeacher) {
      if (!isAssignedToGrade(test?.grade)) return false;
      const assignedSubjects = getAssignedSubjectsForGrade(test?.grade);
      if (Array.isArray(assignedSubjects) && assignedSubjects.length > 0) {
        return assignedSubjects.some((subject) =>
          String(subject).trim().toLowerCase() === String(getTestArea(test)).trim().toLowerCase()
        );
      }
      if (Array.isArray(assignedSubjects) && assignedSubjects.length === 0) return false;
    }

    return true;
  }, [getAssignedSubjectsForGrade, isAssignedToGrade, isSecondaryPortal, isTeacher]);

  const fetchResultsForTests = useCallback(async (testList) => {
    const pairs = await Promise.all(
      testList.map(async (test) => {
        try {
          const response = await assessmentAPI.getTestResults(test.id);
          const rows = response?.data || response || [];
          return [test.id, Array.isArray(rows) ? rows : []];
        } catch (error) {
          console.warn('Failed to load results for test', test.id, error);
          return [test.id, []];
        }
      })
    );
    return Object.fromEntries(pairs);
  }, []);

  const fetchLearnersForGrades = useCallback(async (grades) => {
    const pairs = await Promise.all(
      grades.map(async (grade) => {
        try {
          const response = await learnerAPI.getAll({ grade, status: 'ACTIVE', limit: 1000 });
          const rows = response?.data || response || [];
          return [toCanonicalGrade(grade), Array.isArray(rows) ? rows : []];
        } catch (error) {
          console.warn('Failed to load learners for grade', grade, error);
          return [toCanonicalGrade(grade), []];
        }
      })
    );
    return Object.fromEntries(pairs);
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await assessmentAPI.getTests({});
      const testRows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
      const activeTests = testRows
        .filter((test) => {
          const status = String(test.status || '').toUpperCase();
          return status === 'PUBLISHED' || test.published === true;
        })
        .filter(canSeeTest);

      setTests(activeTests);

      const grades = [...new Set(activeTests.map((test) => test.grade).filter(Boolean))];
      const [resultMap, learnerMap] = await Promise.all([
        fetchResultsForTests(activeTests),
        fetchLearnersForGrades(grades),
      ]);
      setResultsByTest(resultMap);
      setLearnersByGrade(learnerMap);

      if (initialTestId) {
        const directTest = activeTests.find((test) => String(test.id) === String(initialTestId));
        if (directTest) {
          const gradeKey = toCanonicalGrade(directTest.grade);
          setSelectedClass({ grade: directTest.grade, gradeKey, name: formatGradeDisplay(directTest.grade) });
          setSelectedSubject({ subjectName: getTestArea(directTest), test: directTest });
          setSelectedTestId(directTest.id);
          setSelectedTerm(directTest.term || getCurrentTerm());
          setSelectedType(normalizeTestType(directTest.testType) || defaultType || 'all');
          setScreen('marks');
        }
      }
    } catch (error) {
      console.error('Error loading mobile assessment data:', error);
      showError('Failed to load assessment data');
    } finally {
      setLoading(false);
    }
  }, [canSeeTest, defaultType, fetchLearnersForGrades, fetchResultsForTests, initialTestId, showError]);

  useEffect(() => {
    if (teacherWorkloadLoading) return;
    refreshData();
  }, [refreshData, teacherWorkloadLoading]);

  const availableTerms = useMemo(() => {
    const terms = [...new Set(tests.map((test) => test.term).filter(Boolean))].sort();
    return terms.length ? terms : ['TERM_1', 'TERM_2', 'TERM_3'];
  }, [tests]);

  const visibleTests = useMemo(() => tests.filter((test) => {
    if (selectedTerm && test.term !== selectedTerm) return false;
    if (selectedType !== 'all' && normalizeTestType(test.testType) !== selectedType) return false;
    return true;
  }), [tests, selectedTerm, selectedType]);

  const classCards = useMemo(() => {
    const groups = new Map();

    visibleTests.forEach((test) => {
      const gradeKey = toCanonicalGrade(test.grade);
      if (!groups.has(gradeKey)) {
        const classLearners = learnersByGrade[gradeKey] || [];
        groups.set(gradeKey, {
          grade: test.grade,
          gradeKey,
          name: formatGradeDisplay(test.grade),
          learnerCount: classLearners.length,
          subjectNames: new Set(),
          tests: [],
          enteredCount: 0,
          expectedCount: 0,
          missingCount: 0,
          lastUpdated: null,
        });
      }

      const group = groups.get(gradeKey);
      const classLearners = learnersByGrade[gradeKey] || [];
      const rows = resultsByTest[test.id] || [];
      const entered = rows.filter(resultHasMark).length;
      const expected = classLearners.length;
      const lastUpdated = rows
        .map((row) => row.updatedAt || row.createdAt)
        .filter(Boolean)
        .sort()
        .pop() || test.updatedAt || test.createdAt;

      group.subjectNames.add(getTestArea(test));
      group.tests.push(test);
      group.enteredCount += entered;
      group.expectedCount += expected;
      group.missingCount += Math.max(0, expected - entered);
      if (!group.lastUpdated || (lastUpdated && new Date(lastUpdated) > new Date(group.lastUpdated))) {
        group.lastUpdated = lastUpdated;
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        subjectCount: group.subjectNames.size,
        completion: percentage(group.enteredCount, group.expectedCount),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [learnersByGrade, resultsByTest, visibleTests]);

  const subjectCards = useMemo(() => {
    if (!selectedClass) return [];
    const classLearners = learnersByGrade[selectedClass.gradeKey] || [];
    const groups = new Map();

    visibleTests
      .filter((test) => toCanonicalGrade(test.grade) === selectedClass.gradeKey)
      .forEach((test) => {
        const subjectName = getTestArea(test);
        const key = subjectName.toLowerCase();
        const rows = resultsByTest[test.id] || [];
        const entered = rows.filter(resultHasMark).length;
        const total = classLearners.length;
        const existing = groups.get(key);
        const current = {
          subjectName,
          test,
          enteredCount: entered,
          totalLearners: total,
          completion: percentage(entered, total),
          status: statusFor(entered, total, test),
        };

        if (!existing || current.completion > existing.completion) {
          groups.set(key, current);
        }
      });

    return Array.from(groups.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [learnersByGrade, resultsByTest, selectedClass, visibleTests]);

  const selectedLearners = useMemo(() => {
    if (!selectedClass) return [];
    return learnersByGrade[selectedClass.gradeKey] || [];
  }, [learnersByGrade, selectedClass]);

  const loadSelectedTestMarks = useCallback(() => {
    if (!selectedTest) return;
    const rows = resultsByTest[selectedTest.id] || [];
    const nextMarks = {};
    const nextSaved = new Set();
    rows.forEach((result) => {
      const learnerId = getResultLearnerId(result);
      if (!learnerId) return;
      nextMarks[learnerId] = result.assessmentStatusCode ? '' : result.marksObtained;
      if (resultHasMark(result)) nextSaved.add(learnerId);
    });
    setMarks(nextMarks);
    setSavedMarks(nextSaved);
    setReviewed(false);
  }, [resultsByTest, selectedTest]);

  useEffect(() => {
    loadSelectedTestMarks();
  }, [loadSelectedTestMarks]);

  const markStats = useMemo(() => {
    const total = selectedLearners.length;
    const entered = selectedLearners.filter((learner) => hasMark(marks[learner.id || learner._id])).length;
    const numericMarks = selectedLearners
      .map((learner) => Number(marks[learner.id || learner._id]))
      .filter((mark) => Number.isFinite(mark));
    const average = numericMarks.length
      ? numericMarks.reduce((sum, mark) => sum + mark, 0) / numericMarks.length
      : 0;
    const missingLearners = selectedLearners.filter((learner) => !hasMark(marks[learner.id || learner._id]));

    return {
      total,
      entered,
      missing: Math.max(0, total - entered),
      average,
      completion: percentage(entered, total),
      missingLearners,
    };
  }, [marks, selectedLearners]);

  const filteredLearners = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return selectedLearners.filter((learner) => {
      const learnerId = learner.id || learner._id;
      const entered = hasMark(marks[learnerId]);
      if (markFilter === 'missing' && entered) return false;
      if (markFilter === 'entered' && !entered) return false;
      if (!query) return true;
      return (
        `${learner.firstName || ''} ${learner.lastName || ''}`.toLowerCase().includes(query) ||
        String(learner.admissionNumber || '').toLowerCase().includes(query)
      );
    });
  }, [markFilter, marks, searchQuery, selectedLearners]);

  const handleOpenClass = (classItem) => {
    setSelectedClass(classItem);
    setSelectedSubject(null);
    setSelectedTestId('');
    setScreen('subjects');
  };

  const handleOpenSubject = (subjectItem) => {
    setSelectedSubject(subjectItem);
    setSelectedTestId(subjectItem.test.id);
    setSearchQuery('');
    setMarkFilter('all');
    setScreen('marks');
  };

  const handleMarkChange = (learnerId, value) => {
    setMarks((current) => ({ ...current, [learnerId]: value }));
    setSavedMarks((current) => {
      const next = new Set(current);
      next.delete(learnerId);
      return next;
    });
    setReviewed(false);
  };

  const saveMarks = async ({ final = false } = {}) => {
    if (!selectedTest) return false;
    if (final && markStats.missing > 0) {
      showError('Cannot publish while required marks are missing');
      return false;
    }

    const maxMarks = Number(selectedTest.totalMarks || 100);
    const invalid = Object.entries(marks).find(([, value]) => {
      if (!hasMark(value)) return false;
      const numeric = Number(value);
      return !Number.isFinite(numeric) || numeric < 0 || (maxMarks > 0 && numeric > maxMarks);
    });

    if (invalid) {
      showError('Fix invalid marks before saving');
      return false;
    }

    const resultsToSave = Object.entries(marks)
      .filter(([, value]) => hasMark(value))
      .map(([learnerId, value]) => ({
        learnerId,
        marksObtained: Number(value),
      }));

    if (resultsToSave.length === 0) {
      showError('No marks entered to save');
      return false;
    }

    setSaving(true);
    try {
      await assessmentAPI.recordBulkResults({
        testId: selectedTest.id,
        results: resultsToSave,
      });

      const updatedResponse = await assessmentAPI.getTestResults(selectedTest.id);
      const updatedRows = updatedResponse?.data || updatedResponse || [];
      setResultsByTest((current) => ({
        ...current,
        [selectedTest.id]: Array.isArray(updatedRows) ? updatedRows : [],
      }));
      setSavedMarks(new Set(resultsToSave.map((row) => row.learnerId)));
      showSuccess(final ? 'Marks published for reports' : 'Draft marks saved');
      return true;
    } catch (error) {
      showError(`Failed to save marks: ${error.message || 'Please try again.'}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (screen === 'review') {
      setScreen('marks');
      return;
    }
    if (screen === 'marks') {
      setScreen('subjects');
      return;
    }
    if (screen === 'subjects') {
      setScreen('dashboard');
      return;
    }
    if (onBack) onBack();
    else onNavigate?.('assess-mobile-dashboard');
  };

  if (loading || teacherWorkloadLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-purple/20 border-t-brand-purple" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading assessment workspace</p>
        </div>
      </div>
    );
  }

  if (isTeacher && !hasAnyAssignments) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 px-5 py-8">
        <EmptyState
          title="No assessment assignments"
          description="Your account is not assigned to any classes or subjects for mark entry."
          icon={BookOpen}
        />
        <MobileAssessmentBottomNav active="assessments" onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 font-sans text-slate-950">
      <header className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-900 active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-purple">Summative Assessment</p>
            <h1 className="truncate text-xl font-black leading-tight">
              {screen === 'dashboard' && 'Assessment Dashboard'}
              {screen === 'subjects' && selectedClass?.name}
              {screen === 'marks' && selectedSubject?.subjectName}
              {screen === 'review' && 'Review & Publish'}
            </h1>
            <p className="truncate text-xs font-bold text-slate-500">
              {formatTerm(selectedTerm)} · {selectedType === 'all' ? 'All assessment types' : selectedType.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </header>

      {screen === 'dashboard' && (
        <main className="flex-1 overflow-y-auto px-5 py-5 pb-28">
          <section className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Active {labels.term}</span>
                <select
                  value={selectedTerm}
                  onChange={(event) => setSelectedTerm(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-black outline-none focus:border-brand-purple"
                >
                  {availableTerms.map((term) => (
                    <option key={term} value={term}>{formatTerm(term)}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Assessment Type</span>
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm font-black outline-none focus:border-brand-purple"
                >
                  {TEST_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="mt-5 space-y-3">
            {classCards.length === 0 ? (
              <EmptyState
                title="No classes found"
                description="No published tests match this term, assessment type, or your assignment permissions."
                icon={ClipboardList}
              />
            ) : (
              classCards.map((item) => (
                <SummativeClassCard key={item.gradeKey} item={item} onOpen={() => handleOpenClass(item)} />
              ))
            )}
          </section>
        </main>
      )}

      {screen === 'subjects' && (
        <main className="flex-1 overflow-y-auto px-5 py-5 pb-28">
          <section className="mb-4 rounded-[1.5rem] bg-brand-purple p-5 text-white shadow-lg shadow-brand-purple/10">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Class Workspace</p>
            <h2 className="mt-1 text-2xl font-black">{selectedClass?.name}</h2>
            <p className="mt-2 text-sm font-bold text-white/80">{formatTerm(selectedTerm)} · {selectedType === 'all' ? 'All types' : selectedType.replace(/_/g, ' ')}</p>
          </section>

          <div className="space-y-3">
            {subjectCards.length === 0 ? (
              <EmptyState
                title="No subjects found"
                description="No subjects are available for this class and filter selection."
                icon={BookOpen}
              />
            ) : (
              subjectCards.map((item) => (
                <SummativeSubjectCard key={`${selectedClass?.gradeKey}-${item.subjectName}`} item={item} onOpen={() => handleOpenSubject(item)} />
              ))
            )}
          </div>
        </main>
      )}

      {screen === 'marks' && selectedTest && (
        <main className="flex-1 overflow-y-auto px-5 py-5 pb-44">
          <section className="mb-4 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Mark Entry</p>
                <p className="mt-1 text-sm font-black text-slate-950">{selectedTest.title}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-brand-purple">{markStats.completion}%</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Complete</p>
              </div>
            </div>
            <div className="mt-4"><ProgressBar value={markStats.completion} /></div>
          </section>

          <section className="sticky top-0 z-10 mb-4 space-y-3 rounded-[1.5rem] border border-slate-100 bg-white/95 p-3 shadow-sm backdrop-blur">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search learner or admission number"
                className="h-12 w-full rounded-2xl bg-slate-50 pl-11 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-purple/20"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-1">
              {[
                ['all', 'All'],
                ['missing', 'Missing'],
                ['entered', 'Entered'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMarkFilter(value)}
                  className={cn(
                    'h-10 rounded-xl text-xs font-black transition',
                    markFilter === value ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-500'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            {filteredLearners.length === 0 ? (
              <EmptyState
                title="No learners match"
                description="Try a different search or mark filter."
                icon={Users}
              />
            ) : (
              filteredLearners.map((learner) => {
                const learnerId = learner.id || learner._id;
                return (
                  <LearnerMarkCard
                    key={learnerId}
                    learner={learner}
                    mark={marks[learnerId]}
                    totalMarks={selectedTest.totalMarks || 100}
                    saved={savedMarks.has(learnerId)}
                    onChange={handleMarkChange}
                  />
                );
              })
            )}
          </section>

          <div className="fixed bottom-16 left-0 right-0 z-[70] border-t border-slate-100 bg-white/95 p-4 pb-5 backdrop-blur-xl">
            <div className="mx-auto flex max-w-md gap-3">
              <button
                type="button"
                onClick={() => saveMarks({ final: false })}
                disabled={saving}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-teal text-sm font-black text-white shadow-lg shadow-brand-teal/20 disabled:opacity-60"
              >
                {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setScreen('review')}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-purple text-sm font-black text-white shadow-lg shadow-brand-purple/20"
              >
                Review
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </main>
      )}

      {screen === 'review' && selectedTest && (
        <main className="flex-1 overflow-y-auto px-5 py-5 pb-32">
          <section className="grid grid-cols-2 gap-3">
            <MetricPill label="Total Learners" value={markStats.total} />
            <MetricPill label="Entered Marks" value={markStats.entered} />
            <MetricPill label="Missing Marks" value={markStats.missing} />
            <MetricPill label="Class Average" value={`${markStats.average.toFixed(1)}/${selectedTest.totalMarks || 100}`} />
          </section>

          <section className="mt-5 rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Readiness</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{markStats.completion}% complete</h2>
              </div>
              {markStats.missing === 0 ? (
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Check size={22} />
                </span>
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <AlertCircle size={22} />
                </span>
              )}
            </div>
            <div className="mt-4"><ProgressBar value={markStats.completion} /></div>
          </section>

          <section className="mt-5 rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">Missing Learners</h3>
            {markStats.missingLearners.length === 0 ? (
              <p className="mt-3 text-sm font-bold text-emerald-600">No missing marks. This assessment is ready.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {markStats.missingLearners.map((learner) => (
                  <div key={learner.id || learner._id} className="rounded-2xl bg-amber-50 px-4 py-3">
                    <p className="text-sm font-black text-slate-950">{learner.firstName} {learner.lastName || ''}</p>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-amber-700">{learner.admissionNumber || 'No admission number'}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => saveMarks({ final: false })}
              disabled={saving}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand-teal text-sm font-black text-white disabled:opacity-60"
            >
              {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => {
                setReviewed(true);
                showSuccess('Assessment reviewed');
              }}
              className={cn(
                'flex h-14 items-center justify-center gap-2 rounded-2xl text-sm font-black',
                reviewed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-900 text-white'
              )}
            >
              <Check size={18} />
              {reviewed ? 'Reviewed' : 'Review'}
            </button>
            <button
              type="button"
              onClick={() => saveMarks({ final: true })}
              disabled={saving || markStats.missing > 0}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand-purple text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Send size={18} />
              Publish
            </button>
            {markStats.missing > 0 && (
              <p className="text-center text-xs font-bold text-amber-700">
                Publishing is blocked until all required marks are entered.
              </p>
            )}
          </section>
        </main>
      )}

      <MobileAssessmentBottomNav active="assessments" onNavigate={onNavigate} />
    </div>
  );
};

export default SummativeAssessmentMobile;
