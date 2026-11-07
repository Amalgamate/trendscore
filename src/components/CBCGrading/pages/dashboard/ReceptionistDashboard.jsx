import React, { useMemo } from 'react';
import { CircleDollarSign, Mail, Megaphone, Search, Users } from 'lucide-react';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../../utils/appAccess';
import RoleActionWorkspace from './RoleActionWorkspace';

const ACTIONS = [
  { page: 'learners-list', permission: 'VIEW_ALL_LEARNERS', label: 'Find a learner', detail: 'Search learner records when families visit or call.', icon: Search, color: 'bg-blue-600' },
  { page: 'fees-record-payment', permission: 'RECORD_PAYMENT', label: 'Record a fee payment', detail: 'Enter a payment and open the receipt flow.', icon: CircleDollarSign, color: 'bg-emerald-600' },
  { page: 'comm-messages', permission: 'VIEW_INBOX', label: 'Open the school inbox', detail: 'Read and respond to school conversations.', icon: Mail, color: 'bg-violet-600' },
  { page: 'comm-notices', permission: 'SEND_SCHOOL_NOTICES', label: 'Send a school notice', detail: 'Share an approved update with the school community.', icon: Megaphone, color: 'bg-orange-600' },
];

export default function ReceptionistDashboard({ user, onNavigate }) {
  const { can } = usePermissions();
  const { activeSlugs } = useModuleAccess();
  const accessUser = useMemo(() => ({ ...(user || {}), enabledApps: activeSlugs }), [activeSlugs, user]);
  const actions = ACTIONS.filter((action) => can(action.permission) && hasPageAccess(accessUser, action.page));

  return <RoleActionWorkspace title="Front Office" user={user} onNavigate={onNavigate} icon={Users} prompt="How can you help today?" actions={actions} />;
}
