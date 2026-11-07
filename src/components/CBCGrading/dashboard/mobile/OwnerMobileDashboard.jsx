import React from 'react';
import ExecutiveOwnerDashboard from '../ExecutiveOwnerDashboard';
import SchoolAdminDashboard from '../../pages/dashboard/SchoolAdminDashboard';

const OwnerMobileDashboard = ({ user, onNavigate, brandingSettings }) => {
  const role = String(user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'OWNER') {
    return <SchoolAdminDashboard user={user} onNavigate={onNavigate} />;
  }

  return <ExecutiveOwnerDashboard user={user} onNavigate={onNavigate} brandingSettings={brandingSettings} mode="mobile" />;
};

export default OwnerMobileDashboard;
