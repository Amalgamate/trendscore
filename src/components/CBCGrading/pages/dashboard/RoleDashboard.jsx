/**
 * Role-Specific Dashboard Component
 * Renders different dashboard views based on user role
 */

import React from 'react';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useAuth } from '../../../../hooks/useAuth';
import { getSelectedInstitutionType } from '../../../../services/schoolContext';
import AdminDashboard from './AdminDashboard';
import SecondaryAdminDashboard from './SecondaryAdminDashboard';
import HeadTeacherDashboard from './HeadTeacherDashboard';
import CurriculumHeadDashboard from './CurriculumHeadDashboard';
import SuperAdminDashboard from './SuperAdminDashboard';
import TeacherDashboard from './TeacherDashboard';
import ParentDashboard from './ParentDashboard';
import AccountantDashboard from './AccountantDashboard';
import ReceptionistDashboard from './ReceptionistDashboard';
import MobileDashboard from '../../dashboard/MobileDashboard';
import StudentDashboard from '../student/StudentDashboard';
import ComingSoon from '../../shared/ComingSoon';
import useMediaQuery from '../../hooks/useMediaQuery';
import { MOBILE_MEDIA_QUERY } from '../../../../constants/breakpoints';

const RoleDashboard = ({ learners, pagination, teachers, user, onNavigate, brandingSettings }) => {
  const { role } = usePermissions();
  const { institutionType } = useAuth();
  const selectedInstitutionType = String(getSelectedInstitutionType() || '').toUpperCase();
  const resolvedInstitutionType = selectedInstitutionType || String(institutionType || '').toUpperCase();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

  // Tertiary: whole module is Coming Soon — must check before mobile branch
  // so mobile tertiary users also see ComingSoon instead of MobileDashboard.
  if (resolvedInstitutionType === 'TERTIARY') {
    return (
      <ComingSoon
        badge="Tertiary"
        title="Tertiary portal"
        description="The tertiary institution module is currently under development and will be available in a future release."
      />
    );
  }

  // Secondary: full dashboard matching the junior layout but with senior colour palette.
  // Also checked before the mobile branch so mobile secondary users get MobileDashboard.
  if (resolvedInstitutionType === 'SECONDARY') {
    if (isMobile) {
      return <MobileDashboard user={user} onNavigate={onNavigate} brandingSettings={brandingSettings} />;
    }
    // All admin-level roles get the rich secondary dashboard.
    // Non-admin roles fall through to their own dashboards below (same as primary).
    switch (role) {
      case 'OWNER':
      case 'ADMIN':
        return <AdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
      case 'SUPER_ADMIN':
        return <SuperAdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
      case 'HEAD_TEACHER':
        return <HeadTeacherDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
      case 'HEAD_OF_CURRICULUM':
        return <CurriculumHeadDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
      case 'TEACHER':
        return <TeacherDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
      case 'PARENT':
        return <ParentDashboard user={user} onNavigate={onNavigate} />;
      case 'STUDENT':
        return <StudentDashboard user={user} onNavigate={onNavigate} />;
      case 'ACCOUNTANT':
        return <AccountantDashboard learners={learners} pagination={pagination} user={user} onNavigate={onNavigate} />;
      case 'RECEPTIONIST':
        return <ReceptionistDashboard learners={learners} pagination={pagination} user={user} onNavigate={onNavigate} />;
      default:
        return <SecondaryAdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
    }
  }

  // Primary CBC — mobile shell or role-based dashboard
  if (isMobile) {
    return <MobileDashboard user={user} onNavigate={onNavigate} brandingSettings={brandingSettings} />;
  }

  // Render dashboard based on user role
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return <AdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
    case 'SUPER_ADMIN':
      return <SuperAdminDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;

    case 'HEAD_TEACHER':
      return <HeadTeacherDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;
    case 'HEAD_OF_CURRICULUM':
      return <CurriculumHeadDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;

    case 'TEACHER':
      return <TeacherDashboard learners={learners} pagination={pagination} teachers={teachers} user={user} onNavigate={onNavigate} />;

    case 'PARENT':
      return <ParentDashboard user={user} onNavigate={onNavigate} />;

    case 'STUDENT':
      return <StudentDashboard user={user} onNavigate={onNavigate} />;

    case 'ACCOUNTANT':
      return <AccountantDashboard learners={learners} pagination={pagination} user={user} onNavigate={onNavigate} />;

    case 'RECEPTIONIST':
      return <ReceptionistDashboard learners={learners} pagination={pagination} user={user} onNavigate={onNavigate} />;

    default:
      return (
        <div className="text-center py-12">
          <p className="text-gray-600">Invalid user role</p>
        </div>
      );
  }
};

export default RoleDashboard;
