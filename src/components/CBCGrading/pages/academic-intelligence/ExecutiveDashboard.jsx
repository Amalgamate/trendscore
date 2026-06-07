import React, { useMemo } from 'react';
import SimpleTablePage, {
  getLearnerGrade,
  getLearnerStream,
  filterLearnersByAcademicFilters,
  groupLearners,
  normalizeGender,
  uniqueCount,
} from './SimpleTablePage';
import { formatScore } from './useAcademicAnalytics';

const columns = [
  { key: 'area', label: 'Area' },
  { key: 'records', label: 'Records' },
  { key: 'details', label: 'Details' },
  { key: 'status', label: 'Status' },
];

const ExecutiveDashboard = ({ learners = [], academicFilters = {}, analytics }) => {
  const rows = useMemo(() => {
    const learnerList = analytics?.learners?.length
      ? analytics.learners.map((learner) => learner.raw || learner)
      : filterLearnersByAcademicFilters(learners, academicFilters);
    const boys = learnerList.filter((learner) => normalizeGender(learner.gender) === 'Boys').length;
    const girls = learnerList.filter((learner) => normalizeGender(learner.gender) === 'Girls').length;
    const gradeRows = groupLearners(learnerList, getLearnerGrade);
    const largestGrade = gradeRows.slice().sort((a, b) => b.count - a.count)[0];
    const summary = analytics?.summary || {};

    return [
      {
        area: 'Learners',
        records: learnerList.length,
        details: `${uniqueCount(learnerList.map(getLearnerGrade))} grades, ${uniqueCount(learnerList.map(getLearnerStream))} streams`,
        status: learnerList.length ? 'Available' : 'No learner records',
      },
      {
        area: 'Gender records',
        records: boys + girls,
        details: `${boys} boys, ${girls} girls`,
        status: boys + girls ? 'Available' : 'Not captured',
      },
      {
        area: 'Grade coverage',
        records: gradeRows.length,
        details: largestGrade ? `${largestGrade.label} has the most learners (${largestGrade.count})` : 'No grades found',
        status: gradeRows.length ? 'Available' : 'No grade records',
      },
      {
        area: 'Assessment performance',
        records: summary.scoredRecords || 0,
        details: summary.scoredRecords ? `${formatScore(summary.mean)} mean across ${summary.subjectCount} subjects` : 'No scored results for selected filters',
        status: analytics?.loading ? 'Loading' : summary.scoredRecords ? 'Available' : 'No results',
      },
    ];
  }, [academicFilters, analytics, learners]);

  return <SimpleTablePage columns={columns} rows={rows} />;
};

export default ExecutiveDashboard;
