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
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { id: 'workflows', label: 'Workflows', icon: GitBranch,        adminOnly: true  },
  { id: 'history',   label: 'History',   icon: History,          adminOnly: false },
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
    <div className="space-y-5 p-4 md:p-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Approvals</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage approval requests, workflows, and history.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 -mb-2">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'border-[#002C60] text-[#002C60]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-2">
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
