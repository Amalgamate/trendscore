import React from 'react';
import { WidgetProps } from './_widgets';

// Placeholder - TODO: Extract MetricBanner widget from AdminDashboard.jsx
const MetricBannerWidget: React.FC<WidgetProps> = ({ user, config, onNavigate }) => {
  return (
    <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: 0, border: '1px solid #e2e8f0' }}>
      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>MetricBanner Widget (To be implemented)</p>
    </div>
  );
};

export default MetricBannerWidget;
