import React from 'react';
import ExecutiveOwnerDashboard from '../../dashboard/ExecutiveOwnerDashboard';

const AdminDashboard = ({ user, onNavigate, brandingSettings }) => (
  <ExecutiveOwnerDashboard
    user={user}
    onNavigate={onNavigate}
    brandingSettings={brandingSettings}
    mode="desktop"
  />
);

export default AdminDashboard;
