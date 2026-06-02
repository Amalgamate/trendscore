import React from 'react';

interface WidgetProps { user?: any; config?: any; onNavigate?: (path: string) => void; }

const SchoolPerformanceWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>SchoolPerformance Widget</p>
  </div>
);

const ClassPerformanceWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>ClassPerformance Widget</p>
  </div>
);

const TeacherPerformanceWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>TeacherPerformance Widget</p>
  </div>
);

const CurriculumTrackerWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>CurriculumTracker Widget</p>
  </div>
);

export { SchoolPerformanceWidget, ClassPerformanceWidget, TeacherPerformanceWidget, CurriculumTrackerWidget };
