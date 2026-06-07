import React, { useMemo } from 'react';
import SimpleTablePage, {
  groupLearners,
  uniqueCount,
} from './SimpleTablePage';
import { average, formatScore } from './useAcademicAnalytics';

const columns = [
  { key: 'grade', label: 'Grade' },
  { key: 'learners', label: 'Learners' },
  { key: 'streams', label: 'Streams' },
  { key: 'mean', label: 'Mean' },
  { key: 'records', label: 'Records' },
  { key: 'status', label: 'Status' },
];

const GrowthTrends = ({ analytics }) => {
  const rows = useMemo(() => (
    groupLearners(analytics?.learners || [], (learner) => learner.grade).map((group) => {
      const records = (analytics?.results || []).filter((result) => result.grade === group.label && Number.isFinite(result.percentage));
      const mean = average(records.map((result) => result.percentage));
      return {
        grade: group.label,
        learners: group.count,
        streams: uniqueCount(group.records.map((learner) => learner.className)),
        mean: formatScore(mean),
        records: records.length,
        status: records.length ? 'Current filter mean' : 'No result records',
      };
    })
  ), [analytics]);

  return (
    <SimpleTablePage
      columns={columns}
      rows={rows}
      emptyMessage="No learner records available for growth trends."
    />
  );
};

export default GrowthTrends;
