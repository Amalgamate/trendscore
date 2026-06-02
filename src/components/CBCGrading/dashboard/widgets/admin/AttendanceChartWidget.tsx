import React from 'react';
import { WidgetProps } from './_widgets';

const AttendanceChartWidget: React.FC<WidgetProps> = ({ user, config, onNavigate }) => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>AttendanceChart Widget (To be implemented)</p>
  </div>
);
export default AttendanceChartWidget;
