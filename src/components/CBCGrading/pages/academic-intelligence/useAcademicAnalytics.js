import { useEffect, useMemo, useState } from 'react';
import api from '../../../../services/api';
import { getCurrentAcademicYear, getCurrentTerm } from '../../utils/academicYear';
import {
  filterLearnersByAcademicFilters,
  getLearnerClass,
  getLearnerGrade,
  getLearnerName,
  normalizeGender,
} from './SimpleTablePage';

export const SUBJECT_CATEGORIES = [
  { key: 'overall', label: 'Overall', matcher: () => true },
  { key: 'stem', label: 'STEM', matcher: (subject) => /math|science|technology|technical|agriculture|environment|integrated/i.test(subject) },
  { key: 'artsSports', label: 'Arts & Sports', matcher: (subject) => /creative|arts|sport|physical|music|movement|craft/i.test(subject) },
  { key: 'socialSciences', label: 'Social Sciences', matcher: (subject) => /social|religious|history|geography|language|english|kiswahili|indigenous|ppi|cre|ire/i.test(subject) },
];

const normalizeText = (value) => String(value || '').trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');

export const normalizeTermForApi = (value) => {
  const normalized = String(value || getCurrentTerm()).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'TERM1') return 'TERM_1';
  if (normalized === 'TERM2') return 'TERM_2';
  if (normalized === 'TERM3') return 'TERM_3';
  return normalized || getCurrentTerm();
};

export const normalizeTestTypeForApi = (value) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!normalized || normalized === 'ALL') return '';
  if (normalized === 'MIDTERM') return 'MID_TERM';
  if (normalized === 'END_OF_TERM') return 'END_TERM';
  return normalized;
};

export const normalizeGradeForApi = (grade) => {
  const value = normalizeText(grade);
  if (!value) return '';
  const upper = value.toUpperCase().replace(/[\s-]+/g, '_');
  if (upper.includes('PLAYGROUP')) return 'PLAYGROUP';
  if (upper === 'PP_1') return 'PP1';
  if (upper === 'PP_2') return 'PP2';
  if (/^GRADE_\d+$/.test(upper)) return upper;
  const match = upper.match(/\d+/);
  return match ? `GRADE_${match[0]}` : upper;
};

export const formatScore = (score) => (Number.isFinite(score) ? `${Math.round(score)}%` : '-');

export const getScoreTone = (score) => {
  if (!Number.isFinite(score)) return 'text-slate-500';
  if (score >= 70) return 'bg-emerald-50 text-emerald-700';
  if (score >= 60) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
};

export const average = (values) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

export const getSubjectCategory = (subject) => (
  SUBJECT_CATEGORIES.find((category) => category.key !== 'overall' && category.matcher(subject))?.key || 'uncategorized'
);

const toArray = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

const getRowLearnerId = (row) => row?.learnerId || row?.learner?.id || row?.learner?.learnerId || '';

const getRowSubject = (row) => (
  row?.learningArea
  || row?.area
  || row?.subject
  || row?.test?.learningAreaRef?.name
  || row?.test?.learningArea
  || row?.test?.subject
  || ''
);

const getRowTotal = (row) => Number(row?.totalMarks ?? row?.maxMarks ?? row?.maxScore ?? row?.test?.totalMarks);

const getRowMarks = (row) => Number(row?.score ?? row?.marksObtained ?? row?.marksAwarded ?? row?.totalScore);

const getRowPercentage = (row) => {
  const direct = Number(row?.percentage);
  if (Number.isFinite(direct)) return direct;
  const marks = getRowMarks(row);
  const total = getRowTotal(row);
  if (Number.isFinite(marks) && Number.isFinite(total) && total > 0) return (marks / total) * 100;
  if (Number.isFinite(marks) && marks <= 100) return marks;
  return null;
};

const makeLearnerRecord = (learner) => ({
  id: learner?.id,
  name: getLearnerName(learner),
  admissionNumber: learner?.admissionNumber || learner?.admissionNo || learner?.admNo || learner?.studentNumber || '-',
  grade: getLearnerGrade(learner),
  apiGrade: normalizeGradeForApi(getLearnerGrade(learner)),
  className: getLearnerClass(learner),
  gender: normalizeGender(learner?.gender),
  raw: learner,
});

const normalizeResultRow = (row, learnerMap) => {
  const learnerId = getRowLearnerId(row);
  const learner = learnerMap.get(learnerId) || makeLearnerRecord(row?.learner || {});
  const subject = getRowSubject(row);
  const percentage = getRowPercentage(row);
  const marks = getRowMarks(row);
  const totalMarks = getRowTotal(row);

  return {
    id: row?.id || `${learnerId}-${row?.testId || row?.test?.id || subject}`,
    learnerId,
    learnerName: learner.name || getLearnerName(row?.learner),
    admissionNumber: learner.admissionNumber,
    grade: learner.grade || row?.learner?.grade || row?.test?.grade || '-',
    apiGrade: learner.apiGrade || normalizeGradeForApi(row?.learner?.grade || row?.test?.grade),
    className: learner.className || row?.learner?.stream || '-',
    gender: learner.gender || normalizeGender(row?.learner?.gender),
    subject,
    subjectKey: normalizeKey(subject),
    category: getSubjectCategory(subject),
    marks: Number.isFinite(marks) ? marks : null,
    totalMarks: Number.isFinite(totalMarks) ? totalMarks : null,
    percentage: Number.isFinite(percentage) ? percentage : null,
    testId: row?.testId || row?.test?.id || '',
    testTitle: row?.test?.title || row?.testTitle || '',
    testType: row?.test?.testType || row?.testType || '',
    term: row?.test?.term || row?.term || '',
    academicYear: row?.test?.academicYear || row?.academicYear || '',
    raw: row,
  };
};

export const summarizeResults = (results) => {
  const valid = results.filter((result) => Number.isFinite(result.percentage));
  return {
    records: results.length,
    scoredRecords: valid.length,
    mean: average(valid.map((result) => result.percentage)),
    learnerCount: new Set(results.map((result) => result.learnerId).filter(Boolean)).size,
    subjectCount: new Set(results.map((result) => result.subjectKey).filter(Boolean)).size,
  };
};

export const useAcademicAnalytics = ({ learners = [], filters = {} }) => {
  const [state, setState] = useState({ loading: false, error: '', results: [] });

  const learnerRecords = useMemo(() => (
    (Array.isArray(learners) ? learners : []).map(makeLearnerRecord).filter((learner) => learner.id)
  ), [learners]);

  const filteredLearners = useMemo(() => (
    filterLearnersByAcademicFilters(learners, filters).map(makeLearnerRecord).filter((learner) => learner.id)
  ), [learners, filters]);

  const query = useMemo(() => {
    const selectedYear = Number(filters.year || getCurrentAcademicYear());
    const selectedTerm = normalizeTermForApi(filters.term || getCurrentTerm());
    const selectedTestType = normalizeTestTypeForApi(filters.testType || filters.examType);
    const grades = [...new Set(filteredLearners.map((learner) => learner.apiGrade).filter(Boolean))];
    const selectedClass = filters.classScope && filters.classScope !== 'all'
      ? filteredLearners[0]?.className
      : '';

    return {
      academicYear: selectedYear,
      term: selectedTerm,
      testType: selectedTestType,
      grades,
      stream: selectedClass || '',
    };
  }, [filteredLearners, filters]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!query.grades.length || !query.academicYear || !query.term) {
        setState({ loading: false, error: '', results: [] });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: '' }));
      const learnerMap = new Map(learnerRecords.map((learner) => [learner.id, learner]));

      try {
        const responses = await Promise.all(query.grades.map((grade) => api.assessments.getBulkResults({
          grade,
          academicYear: query.academicYear,
          term: query.term,
          ...(query.stream ? { stream: query.stream } : {}),
          ...(query.testType ? { testType: query.testType } : {}),
        }).catch((error) => ({ __error: error, grade }))));

        const errors = responses.filter((response) => response?.__error);
        const rows = responses.flatMap((response) => (response?.__error ? [] : toArray(response)));
        const normalized = rows
          .map((row) => normalizeResultRow(row, learnerMap))
          .filter((result) => result.learnerId && learnerMap.has(result.learnerId));

        if (!cancelled) {
          setState({
            loading: false,
            error: errors.length ? `Some grades could not load (${errors.map((error) => error.grade).join(', ')}).` : '',
            results: normalized,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error?.message || 'Failed to load academic analytics.',
            results: [],
          });
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [learnerRecords, query]);

  const summary = useMemo(() => summarizeResults(state.results), [state.results]);

  return {
    ...state,
    learners: filteredLearners,
    query,
    summary,
  };
};
