/**
 * Role-Specific Dashboard Component
 * Renders different dashboard views based on user role
 */

import React from 'react';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useAuth } from '../../../../hooks/useAuth';
import { getSelectedInstitutionType } from '../../../../services/schoolContext';
import AdminDashboard from './AdminDashboard';
import DeputyHeadDashboard from './DeputyHeadDashboard';
import SuperAdminDashboard from './SuperAdminDashboard';
import TeacherDashboard from './TeacherDashboard';
import ParentDashboard from './ParentDashboard';
import AccountantDashboard from './AccountantDashboard';
import ReceptionistDashboard from './ReceptionistDashboard';
import RoleLandingDashboard, { OPERATIONAL_STAFF_ROLES } from './RoleLandingDashboard';
import MobileDashboard from '../../dashboard/MobileDashboard';
import StudentDashboard from '../student/StudentDashboard';
import ComingSoon from '../../shared/ComingSoon';
import useMediaQuery from '../../hooks/useMediaQuery';
import { MOBILE_MEDIA_QUERY } from '../../../../constants/breakpoints';

const RoleDashboardBody = ({ learners, pagination, teachers, user, onNavigate, brandingSettings, currentPage = 'dashboard' }) => {
  const { role } = usePermissions();
  const { institutionType } = useAuth();
  const selectedInstitutionType = String(getSelectedInstitutionType() || '').toUpperCase();
  const resolvedInstitutionType = selectedInstitutionType || String(institutionType || '').toUpperCase();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  // Tertiary: whole module is Coming Soon
  if (resolvedInstitutionType === 'TERTIARY') {
    return (
      <ComingSoon
        badge="Tertiary"
        title="Tertiary portal"
        description="The tertiary institution module is currently under development and will be available in a future release."
      />
    );
  }

  // Secondary institution
  if (resolvedInstitutionType === 'SECONDARY') {
    if (isMobile) {
      return <MobileDashboard user={{ ...(user || {}), role }} onNavigate={onNavigate} currentPath={currentPage} brandingSettings={brandingSettings} />;
    }
    switch (role) {
      case 'OWNER':
      case 'ADMIN':
        return <AdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} brandingSettings={brandingSettings} />;
      case 'SUPER_ADMIN':
        return <SuperAdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
      case 'HEAD_TEACHER':
        return <RoleLandingDashboard user={user} role={role} onNavigate={onNavigate} />;
      case 'DEPUTY_HEAD_TEACHER':
        return <DeputyHeadDashboard learners={learners} teachers={teachers} user={user} onNavigate={onNavigate} />;
      case 'RECEPTIONIST':
        return <ReceptionistDashboard user={user} onNavigate={onNavigate} />;
      case 'HEAD_OF_CURRICULUM':
        return <RoleLandingDashboard user={user} role={role} onNavigate={onNavigate} />;
      case 'TEACHER':
        return <TeacherDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
      case 'PARENT':
        return <ParentDashboard user={user} onNavigate={onNavigate} brandingSettings={brandingSettings} />;
      case 'STUDENT':
        return <StudentDashboard user={user} onNavigate={onNavigate} />;
      case 'ACCOUNTANT':
        return <AccountantDashboard learners={learners} pagination={pagination} user={user} onNavigate={onNavigate} />;
      default:
        if (OPERATIONAL_STAFF_ROLES.includes(role)) return <RoleLandingDashboard user={user} role={role} onNavigate={onNavigate} />;
        return <ComingSoon badge="Workspace" title="Role workspace" description="A dashboard is not configured for this account role." />;
    }
  }

  // Primary CBC — mobile shell or role-based dashboard
  if (isMobile) {
    return <MobileDashboard user={{ ...(user || {}), role }} onNavigate={onNavigate} currentPath={currentPage} brandingSettings={brandingSettings} />;
  }

  // Primary CBC desktop — role-based dashboard
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return <AdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} brandingSettings={brandingSettings} />;
    case 'SUPER_ADMIN':
      return <SuperAdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
    case 'HEAD_TEACHER':
      return <RoleLandingDashboard user={user} role={role} onNavigate={onNavigate} />;
    case 'DEPUTY_HEAD_TEACHER':
      return <DeputyHeadDashboard learners={learners} teachers={teachers} user={user} onNavigate={onNavigate} />;
    case 'RECEPTIONIST':
      return <ReceptionistDashboard user={user} onNavigate={onNavigate} />;
    case 'HEAD_OF_CURRICULUM':
      return <RoleLandingDashboard user={user} role={role} onNavigate={onNavigate} />;
    case 'TEACHER':
      return <TeacherDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
    case 'PARENT':
      return <ParentDashboard user={user} onNavigate={onNavigate} brandingSettings={brandingSettings} />;
    case 'STUDENT':
      return <StudentDashboard user={user} onNavigate={onNavigate} />;
    case 'ACCOUNTANT':
      return <AccountantDashboard learners={learners} pagination={pagination} user={user} onNavigate={onNavigate} />;
    default:
      if (OPERATIONAL_STAFF_ROLES.includes(role)) return <RoleLandingDashboard user={user} role={role} onNavigate={onNavigate} />;
      return <ComingSoon badge="Workspace" title="Role workspace" description="A dashboard is not configured for this account role." />;
  }
};

/** Single mount point for role and institution specific dashboards. */
const RoleDashboard = (props) => {
  return <RoleDashboardBody {...props} />;
};

export default RoleDashboard;
