import React from 'react';
import SimpleTablePage from './SimpleTablePage';

const columns = [
  { key: 'item', label: 'Item' },
  { key: 'state', label: 'State' },
  { key: 'requirement', label: 'Requirement' },
  { key: 'status', label: 'Status' },
];

const rows = [
  { item: 'AI status', state: 'Disabled', requirement: 'Verified academic records', status: 'Not active' },
  { item: 'Generated insights', state: '0', requirement: 'Assessment results', status: 'No output' },
  { item: 'Staff review', state: 'Required', requirement: 'Human approval before use', status: 'Required' },
  { item: 'Source citations', state: 'Required', requirement: 'Every insight must cite its record source', status: 'Required' },
  { item: 'Synthetic marks or ranks', state: 'Blocked', requirement: 'Use real records only', status: 'Blocked' },
];

const AIInsights = () => (
  <SimpleTablePage columns={columns} rows={rows} />
);

export default AIInsights;
