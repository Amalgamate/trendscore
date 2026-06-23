import React from 'react';
import ExecutiveOwnerDashboard from '../ExecutiveOwnerDashboard';

const OwnerMobileDashboard = ({ user, onNavigate, brandingSettings }) => (
  <ExecutiveOwnerDashboard
    user={user}
    onNavigate={onNavigate}
    brandingSettings={brandingSettings}
    mode="mobile"
  />
);

export default OwnerMobileDashboard;
