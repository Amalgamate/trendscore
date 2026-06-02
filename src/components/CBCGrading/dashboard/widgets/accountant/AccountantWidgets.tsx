import React from 'react';

interface WidgetProps { user?: any; config?: any; onNavigate?: (path: string) => void; }

const PaymentStatusWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>PaymentStatus Widget</p>
  </div>
);

const InvoiceListWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>InvoiceList Widget</p>
  </div>
);

const LedgerSummaryWidget: React.FC<WidgetProps> = () => (
  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>LedgerSummary Widget</p>
  </div>
);

export { PaymentStatusWidget, InvoiceListWidget, LedgerSummaryWidget };
