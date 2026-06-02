import React from 'react';

interface WidgetProps {
  user?: any;
  config?: any;
  onNavigate?: (path: string) => void;
}

export const TeacherMetricsWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>TeacherMetrics Widget (To be implemented)</p>
  </div>
);

export const ClockInStatusWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>ClockInStatus Widget (To be implemented)</p>
  </div>
);

export const InstructionalPrioritiesWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>InstructionalPriorities Widget (To be implemented)</p>
  </div>
);

export const ImmediateScheduleWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>ImmediateSchedule Widget (To be implemented)</p>
  </div>
);

export const WeeklyTimetableWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>WeeklyTimetable Widget (To be implemented)</p>
  </div>
);

export const ProficiencyMetricsWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>ProficiencyMetrics Widget (To be implemented)</p>
  </div>
);

export const LearningOutcomesWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>LearningOutcomes Widget (To be implemented)</p>
  </div>
);
