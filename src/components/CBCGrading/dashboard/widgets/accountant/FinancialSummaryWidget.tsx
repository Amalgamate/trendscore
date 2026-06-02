import React from 'react';

interface WidgetProps { user?: any; config?: any; onNavigate?: (path: string) => void; }

const FinancialSummaryWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>FinancialSummary Widget (To be implemented)</p>
  </div>
);

export default FinancialSummaryWidget;
