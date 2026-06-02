import React from 'react';

interface WidgetProps { user?: any; config?: any; onNavigate?: (path: string) => void; }

const InstructionalPrioritiesWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>InstructionalPriorities Widget</p>
  </div>
);

const ImmediateScheduleWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>ImmediateSchedule Widget</p>
  </div>
);

const WeeklyTimetableWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>WeeklyTimetable Widget</p>
  </div>
);

const ProficiencyMetricsWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>ProficiencyMetrics Widget</p>
  </div>
);

const LearningOutcomesWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>LearningOutcomes Widget</p>
  </div>
);

export { InstructionalPrioritiesWidget, ImmediateScheduleWidget, WeeklyTimetableWidget, ProficiencyMetricsWidget, LearningOutcomesWidget };
