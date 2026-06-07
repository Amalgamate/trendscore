import React from 'react';
import SimpleTablePage from './SimpleTablePage';

const columns = [
  { key: 'competency', label: 'Competency' },
  { key: 'records', label: 'Records' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
];

const rows = [
  { competency: 'Communication and collaboration', records: 0, source: 'CBC holistic assessments', status: 'Awaiting records' },
  { competency: 'Critical thinking and problem solving', records: 0, source: 'CBC holistic assessments', status: 'Awaiting records' },
  { competency: 'Imagination and creativity', records: 0, source: 'CBC holistic assessments', status: 'Awaiting records' },
  { competency: 'Citizenship', records: 0, source: 'CBC holistic assessments', status: 'Awaiting records' },
  { competency: 'Learning to learn', records: 0, source: 'CBC holistic assessments', status: 'Awaiting records' },
  { competency: 'Self-efficacy', records: 0, source: 'CBC holistic assessments', status: 'Awaiting records' },
  { competency: 'Digital literacy', records: 0, source: 'CBC holistic assessments', status: 'Awaiting records' },
];

const CompetencyAnalysis = () => (
  <SimpleTablePage columns={columns} rows={rows} />
);

export default CompetencyAnalysis;
