/**
 * Mobile Dashboard Router
 * Routes to role-specific mobile dashboards
 * Uses widget framework and role-aware navigation
 */

import React, { Suspense } from 'react';
import OwnerMobileDashboard from './mobile/OwnerMobileDashboard';
import AccountantMobileDashboard from './mobile/AccountantMobileDashboard';
import TeacherMobileDashboard from './mobile/TeacherMobileDashboard';
import ParentMobileDashboard from './mobile/ParentMobileDashboard';
import StudentMobileDashboard from './mobile/StudentMobileDashboard';

/**
 * Loading fallback for lazy-loaded dashboards
 */
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-[var(--app-page-bg)]">
    <div className="text-center">
      <div className="w-10 h-10 bg-brand-purple rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  </div>
);

/**
 * Main Mobile Dashboard Router
 * Routes to correct mobile dashboard based on user role
 * @param {Object} props - Component props
 * @param {Object} props.user - User object with id, role, name
 * @param {Function} props.onNavigate - Navigation callback
 * @param {string} props.currentPath - Current page path
 * @param {Object} props.brandingSettings - Branding settings including logoUrl
 */
const MobileDashboard = ({ 
  user, 
  onNavigate, 
  currentPath = 'dashboard',
  brandingSettings
}) => {
  const role = user?.role;

  // Render appropriate dashboard based on role
  const renderDashboard = () => {
    switch (role) {
      case 'OWNER':
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return (
          <OwnerMobileDashboard 
            user={user} 
            onNavigate={onNavigate} 
            currentPath={currentPath}
            brandingSettings={brandingSettings}
          />
        );

      case 'ACCOUNTANT':
        return (
          <AccountantMobileDashboard 
            user={user} 
            onNavigate={onNavigate} 
            currentPath={currentPath}
            brandingSettings={brandingSettings}
          />
        );

      case 'TEACHER':
      case 'HEAD_TEACHER':
        return (
          <TeacherMobileDashboard 
            user={user} 
            onNavigate={onNavigate} 
            currentPath={currentPath}
            brandingSettings={brandingSettings}
          />
        );

      case 'PARENT':
        return (
          <ParentMobileDashboard 
            user={user} 
            onNavigate={onNavigate} 
            currentPath={currentPath}
            brandingSettings={brandingSettings}
          />
        );

      case 'STUDENT':
        return (
          <StudentMobileDashboard 
            user={user} 
            onNavigate={onNavigate} 
            currentPath={currentPath}
            brandingSettings={brandingSettings}
          />
        );

      default:
        // Fallback to Owner dashboard for unknown roles
        return (
          <OwnerMobileDashboard 
            user={user} 
            onNavigate={onNavigate} 
            currentPath={currentPath}
            brandingSettings={brandingSettings}
          />
        );
    }
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      {renderDashboard()}
    </Suspense>
  );
};

export default MobileDashboard;
