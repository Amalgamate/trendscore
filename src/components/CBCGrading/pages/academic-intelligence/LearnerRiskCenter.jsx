import React, { useMemo } from 'react';
import SimpleTablePage from './SimpleTablePage';
import { average, formatScore } from './useAcademicAnalytics';

const columns = [
  { key: 'learner', label: 'Learner' },
  { key: 'admission', label: 'Admission no.' },
  { key: 'grade', label: 'Grade' },
  { key: 'stream', label: 'Stream' },
  { key: 'mean', label: 'Mean' },
  { key: 'records', label: 'Records' },
  { key: 'risk', label: 'Risk status' },
];

const getRiskStatus = (mean, records) => {
  if (!records) return 'No result records';
  if (mean < 40) return 'High risk';
  if (mean < 55) return 'Watch list';
  return 'On track';
};

const LearnerRiskCenter = ({ analytics }) => {
  const rows = useMemo(() => (
    (analytics?.learners || []).map((learner) => {
      const records = (analytics?.results || []).filter((result) => result.learnerId === learner.id && Number.isFinite(result.percentage));
      const mean = average(records.map((result) => result.percentage));
      return {
        learner: learner.name,
        admission: learner.admissionNumber || learner.id || '-',
        grade: learner.grade,
        stream: learner.className,
        mean: formatScore(mean),
        records: records.length,
        risk: getRiskStatus(mean, records.length),
      };
    }).sort((a, b) => {
      const priority = { 'High risk': 0, 'Watch list': 1, 'No result records': 2, 'On track': 3 };
      return (priority[a.risk] ?? 9) - (priority[b.risk] ?? 9);
    }).slice(0, 100)
  ), [analytics]);

  return (
    <SimpleTablePage
      columns={columns}
      rows={rows}
      emptyMessage="No learners available for risk review."
    />
  );
};

export default LearnerRiskCenter;
