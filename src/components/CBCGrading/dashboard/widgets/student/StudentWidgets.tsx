import React from 'react';

interface WidgetProps { user?: any; config?: any; onNavigate?: (path: string) => void; }

const StudentStatsWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: 0, border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>StudentStats Widget</p>
  </div>
);

const MyCoursesWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: 0, border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>MyCourses Widget</p>
  </div>
);

const DueSoonWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: 0, border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>DueSoon Widget</p>
  </div>
);

export { StudentStatsWidget, MyCoursesWidget, DueSoonWidget };
