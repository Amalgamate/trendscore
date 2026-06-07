import React, { useState } from 'react';
import AdminOverviewTabs from './AdminOverviewTabs';

/**
 * Dashboard Page Layout
 * Wraps dashboard pages to include the persistent tab navigation
 */
const DashboardPageLayout = ({
  activeTab,
  children,
  onNavigate,
  stats,
  metrics,
  formatKesAmount,
  formatPercent,
  sectionControls,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState(activeTab || 'general');
  const activeTabValue = activeTab || internalActiveTab;

  const handleTabChange = (tabId) => {
    setInternalActiveTab(tabId);
    // Navigate to the tab's path if it has one
    const tabPaths = {
      general: 'dashboard',
      financials: 'finance-dashboard',
      academic: 'academic-intelligence',
      operations: 'attendance-reports',
      calendar: 'planner-calendar',
      insights: 'academic-ai-insights',
      hr: 'hr-dashboard',
      inventory: 'inventory-items',
    };
    if (onNavigate && tabPaths[tabId]) {
      onNavigate(tabPaths[tabId]);
    }
  };

  return (
    <div>
      <AdminOverviewTabs
        activeTab={activeTabValue}
        onTabChange={handleTabChange}
        onNavigate={onNavigate}
        stats={stats}
        metrics={metrics}
        formatKesAmount={formatKesAmount}
        formatPercent={formatPercent}
        sectionControls={sectionControls}
      />
      <div>
        {children}
      </div>
    </div>
  );
};

export default DashboardPageLayout;
