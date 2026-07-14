/**
 * ApprovalsPage
 * Main entry point for the Approval & Notification Engine UI.
 *
 * Tabs:
 *   Dashboard  — always visible (KPI cards + filterable list)
 *   Workflows  — visible only to ADMIN / SUPER_ADMIN
 *   History    — always visible
 *
 * If the Zustand pageParams contain a `requestId`, the detail view is shown
 * instead of the tab pane, consistent with how other pages pass params via
 * usePageNavigation / useUIStore.
 *
 * Validates: R6.1, R9.1, R10.5, R11.7
 */

import React, { useState } from 'react';
import { LayoutDashboard, GitBranch, History } from 'lucide-react';
import { useAuth }    from '../../../../hooks/useAuth';
import { useUIStore } from '../../../../store/useUIStore';
import ModuleTabNav from '../../shared/ModuleTabNav';
import { ApprovalDashboard }      from './ApprovalDashboard';
import { ApprovalRequestDetail }  from './ApprovalRequestDetail';

// WorkflowsManager and ApprovalHistoryPage are created in tasks 12 and 13.
// Stub files exist so these imports always resolve; when the real components
// land they replace the stubs automatically.
import { WorkflowsManager }    from './WorkflowsManager';
import { ApprovalHistoryPage } from './ApprovalHistoryPage';

// ── Role helpers ──────────────────────────────────────────────────────────────

function getRoles(user) {
  if (!user) return [];
  // Support both `role` (single string) and `roles` (array) shapes
  if (Array.isArray(user.roles) && user.roles.length) return user.roles;
  if (user.role) return [user.role];
  return [];
}

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

// ── Tab definitions ───────────────────────────────────────────────────────────

const ALL_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={13} />, adminOnly: false },
  { id: 'workflows', label: 'Workflows', icon: <GitBranch size={13} />,        adminOnly: true  },
  { id: 'history',   label: 'History',   icon: <History size={13} />,          adminOnly: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ApprovalsPage() {
  const { user }        = useAuth();
  const pageParams      = useUIStore((s) => s.pageParams);
  const setCurrentPage  = useUIStore((s) => s.setCurrentPage);

  const currentUserRoles = getRoles(user);
  const currentUserId    = user?.id ?? '';
  const isAdmin          = currentUserRoles.some((r) => ADMIN_ROLES.includes(r));

  // If the store carries a requestId, show the detail view directly
  const requestId = pageParams?.requestId ?? null;

  const [activeTab, setActiveTab] = useState('dashboard');

  // ── Tab list — filter out admin-only tabs for non-admins ──────────────────
  const visibleTabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);

  // ── Handle "back" from detail view ────────────────────────────────────────
  const handleBack = () => {
    // Clear requestId from pageParams by re-navigating to the same page
    setCurrentPage('settings-approvals', {});
  };

  // ── Handle "view detail" from dashboard cards ─────────────────────────────
  const handleViewDetail = (id) => {
    setCurrentPage('settings-approvals', { requestId: id });
  };

  // ── Detail view ───────────────────────────────────────────────────────────
  if (requestId) {
    return (
      <div className="space-y-5 p-4 md:p-6">
        <ApprovalRequestDetail
          requestId={requestId}
          onBack={handleBack}
          currentUserId={currentUserId}
          currentUserRoles={currentUserRoles}
        />
      </div>
    );
  }

  // ── Tab view ──────────────────────────────────────────────────────────────
  return (
    <div>
      <ModuleTabNav
        sectionLabel="APPROVALS"
        variant="dropdown"
        tabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab content */}
      <div className="p-4 md:p-6">
        {activeTab === 'dashboard' && (
          <ApprovalDashboard
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
            onViewDetail={handleViewDetail}
          />
        )}

        {activeTab === 'workflows' && isAdmin && (
          <WorkflowsManager
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
          />
        )}

        {activeTab === 'history' && (
          <ApprovalHistoryPage
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
          />
        )}
      </div>
    </div>
  );
}

export default ApprovalsPage;
