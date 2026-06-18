/**
 * Accountant Dashboard
 * Compact finance workspace for accounting oversight.
 */

import React, { useEffect, useRef, useState } from 'react';
import { accountingAPI, dashboardAPI } from '../../../../services/api';
import { useAuth } from '../../../../hooks/useAuth';
import { AppCard } from '@/design-system/components';
import { TOKENS } from '@/design-system/tokens';
import DashboardSummary from './DashboardSummary';
import { DashboardSection, DashboardSectionControls, useDashboardSections } from './DashboardSections';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  CreditCard,
  Landmark,
  LogOut,
  PieChart,
  Receipt,
  RefreshCw,
  TrendingUp
} from 'lucide-react';

/* ─── Mini app-bar (replaces suppressed global Header for ACCOUNTANT) ─── */
const FinanceMiniBar = ({ user, brandingSettings, onNavigate }) => {
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const initials = (() => {
    const name = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.email || 'A';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('');
  })();

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.email || 'Accountant';

  const schoolName =
    brandingSettings?.schoolName ||
    brandingSettings?.name ||
    'TreadSCORE';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-2.5">
      {/* Left — school name */}
      <button
        type="button"
        onClick={() => onNavigate && onNavigate('dashboard')}
        className="flex min-w-0 items-center gap-2.5 text-left"
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-extrabold tracking-tight text-slate-700">
          {schoolName.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden truncate text-sm font-bold text-slate-600 sm:block">
          {schoolName}
        </span>
      </button>

      {/* Right — user menu */}
      <div ref={menuRef} className="relative flex-shrink-0">
        <button
          type="button"
          id="finance-user-menu-btn"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(prev => !prev)}
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition hover:bg-slate-100"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#080083]/10 text-xs font-extrabold text-[#080083]">
            {initials}
          </span>
          <span className="hidden text-sm font-semibold text-slate-700 sm:block">
            {displayName}
          </span>
          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-extrabold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              id="finance-logout-btn"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const formatKes = (amount = 0) => {
  const value = Number(amount || 0);
  if (Math.abs(value) >= 1000000) return `KES ${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (Math.abs(value) >= 1000) return `KES ${Math.round(value / 1000)}k`;
  return `KES ${Math.round(value).toLocaleString()}`;
};

// StatTile and Panel replaced by design-system KpiCard and AppCard

const AccountantDashboard = ({ user, onNavigate, brandingSettings }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);

  const userId = user?.id || user?.userId;
  const sectionControls = useDashboardSections('accountant', [
    { id: 'executive-summary', label: 'Executive Summary', description: 'Expected, collected, rate, overdue' },
    { id: 'collection-analytics', label: 'Collection Analytics', description: 'Trend chart and collection rate' },
    { id: 'bank-transactions', label: 'Bank & Transactions', description: 'Balances and recent entries' },
    { id: 'finance-shortcuts', label: 'Finance Shortcuts', description: 'Common finance actions' },
  ]);

  const loadMetrics = async (filter = 'term') => {
    try {
      setRefreshing(true);
      setApiError(null);
      const [accountingResponse, adminResponse] = await Promise.all([
        accountingAPI.getDashboardStats(),
        dashboardAPI.getAdminMetrics(filter),
      ]);
      if (accountingResponse.success) {
        setMetrics({
          accounting: accountingResponse.data || {},
          admin: adminResponse.success ? (adminResponse.data || {}) : {},
        });
      } else {
        setApiError(accountingResponse.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Failed to load dashboard metrics:', error);
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics('term');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const adminMetrics = metrics?.admin || {};
  const accountingMetrics = metrics?.accounting || {};
  const expectedFromStreams = (adminMetrics?.financials?.streamBreakdown || [])
    .reduce((sum, stream) => sum + Number(stream.target || 0), 0);
  const totalCollected = Number(adminMetrics?.stats?.feeCollected ?? accountingMetrics.feesCollected ?? 0);
  const outstanding = Number(adminMetrics?.stats?.feePending ?? accountingMetrics.accountsReceivable ?? 0);
  const totalExpected = expectedFromStreams || totalCollected + outstanding;

  const stats = {
    totalExpected,
    totalCollected,
    outstanding,
    overdue: Number(accountingMetrics.overdueBalance || 0),
    collectionRate: totalExpected > 0
      ? Math.round((totalCollected / totalExpected) * 100)
      : 0,
    bankBalance: Number(accountingMetrics.cashOnHand ?? accountingMetrics.cashActual ?? 0),
    pendingReconciliation: Number(accountingMetrics.pendingReconciliation || 0),
  };

  const forecastData = (adminMetrics?.financials?.trendData || []).map((item) => ({
    period: item.month,
    revenue: Number(item.revenue || 0),
  }));

  const recentTransactions = (accountingMetrics.recentEntries || []).map((entry) => ({
    id: entry.id,
    type: entry.type,
    title: entry.description,
    reference: entry.status || 'Posted',
    amount: Number(entry.amount || 0),
    createdAt: new Date(entry.date),
    icon: entry.type === 'EXPENSE' ? ArrowUpCircle : ArrowDownCircle,
  }));

  const bankAccounts = accountingMetrics.bankAccounts || [];
  const ledgerBalances = bankAccounts.length > 0
    ? bankAccounts
    : [
        { id: 'cash', name: 'Cash on Hand', description: 'Cash and bank ledger balance', balance: accountingMetrics.cashOnHand || 0 },
        { id: 'receivable', name: 'Accounts Receivable', description: 'Outstanding receivables', balance: accountingMetrics.accountsReceivable || 0 },
        { id: 'payable', name: 'Accounts Payable', description: 'Outstanding payables', balance: accountingMetrics.accountsPayable || 0 },
      ];

  const timeAgo = (date) => {
    if (!date) return '';
    const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (apiError && !metrics) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-lg border border-rose-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto text-rose-600" size={42} />
          <h1 className="mt-4 text-lg font-extrabold text-slate-950">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{apiError}</p>
          <button
            type="button"
            onClick={() => loadMetrics('term')}
            className="mt-5 rounded-md bg-[#080083] px-4 py-2 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (refreshing && !metrics) {
    return (
      <div className="space-y-4 bg-slate-50 p-5">
        <div className="h-36 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => <div key={idx} className="h-28 animate-pulse rounded-lg bg-slate-200" />)}
        </div>
      </div>
    );
  }

  const rate = Math.max(0, Math.min(100, stats.collectionRate));

  return (
    <div className="min-h-full bg-white">
      {/* Mini app-bar — replaces the suppressed global Header for ACCOUNTANT role */}
      <FinanceMiniBar user={user} brandingSettings={brandingSettings} onNavigate={onNavigate} />
      <div className="p-4 md:p-5">
      <div className="mx-auto max-w-[1500px] space-y-4">
        {refreshing && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">Syncing finance data...</p>
          </div>
        )}

        <DashboardSection id="executive-summary" controls={sectionControls}>
        <DashboardSummary
          title="Executive Summary"
          description="The finance position that needs attention first."
          items={[
            {
              label: 'Total Expected',
              value: formatKes(stats.totalExpected),
              subvalue: 'This term',
              icon: <Receipt size={26} />,
              tone: 'indigo',
              onClick: () => onNavigate('fees-structure'),
            },
            {
              label: 'Collected',
              value: formatKes(stats.totalCollected),
              subvalue: 'Payments received',
              icon: <CreditCard size={26} />,
              tone: 'emerald',
              onClick: () => onNavigate('fees-collection'),
            },
            {
              label: 'Collection Rate',
              value: `${rate}%`,
              subvalue: rate >= 80 ? 'On track' : 'Below target',
              icon: <TrendingUp size={26} />,
              tone: rate >= 80 ? 'teal' : 'amber',
              onClick: () => onNavigate('fees-collection'),
            },
            {
              label: 'Overdue',
              value: formatKes(stats.overdue),
              subvalue: 'Past due invoices',
              icon: <AlertTriangle size={26} />,
              tone: 'orange',
              onClick: () => onNavigate('fees-collection'),
            },
          ]}
        />
        </DashboardSection>

        <DashboardSection id="collection-analytics" controls={sectionControls}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppCard
            title="Collection Trend"
            subtitle="Monthly collection from posted fee payments"
            headerAction={
              <button
                type="button"
                onClick={() => loadMetrics('term')}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            }
          >
            <div className="h-[260px] min-w-0">
              {forecastData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip formatter={(value) => formatKes(value)} />
                    <Bar dataKey="revenue" fill={TOKENS.colors.brand.primary} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-200 text-center text-sm font-semibold text-slate-500">
                  No collection trend data yet.
                </div>
              )}
            </div>
          </AppCard>

          <AppCard title="Collection Rate" subtitle="Expected income collected">
            <div className="flex items-center justify-center">
              <div className="relative h-44 w-44">
                <svg className="-rotate-90" width="176" height="176" viewBox="0 0 176 176">
                  <circle cx="88" cy="88" r="72" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                  <circle
                    cx="88"
                    cy="88"
                    r="72"
                    fill="none"
                    stroke={TOKENS.colors.brand.primary}
                    strokeWidth="14"
                    strokeDasharray={`${(rate / 100) * 2 * Math.PI * 72} ${2 * Math.PI * 72}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold" style={{ color: TOKENS.colors.brand.primary }}>{rate}%</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Collected</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bank Balance</p>
                <p className="mt-1 truncate text-sm font-extrabold text-slate-950">{formatKes(stats.bankBalance)}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending Recon</p>
                <p className="mt-1 truncate text-sm font-extrabold text-slate-950">{formatKes(stats.pendingReconciliation)}</p>
              </div>
            </div>
          </AppCard>
        </div>
        </DashboardSection>

        <DashboardSection id="bank-transactions" controls={sectionControls}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AppCard title={bankAccounts.length > 0 ? 'Bank Accounts' : 'Ledger Balances'} subtitle="Live accounting balances">
            <div className="space-y-3">
              {ledgerBalances.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onNavigate('accounting-reconciliation')}
                  className="flex w-full min-w-0 items-center justify-between gap-4 rounded-md border border-slate-100 p-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-blue-50" style={{ color: TOKENS.colors.brand.primary }}>
                      <Landmark size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-950">{account.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {account.description || [account.bankName, account.accountNumber].filter(Boolean).join(' - ') || account.statementStatus}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-extrabold text-slate-950">{formatKes(account.balance)}</p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {account.lastReconciled ? new Date(account.lastReconciled).toLocaleDateString() : 'No statement'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </AppCard>

          <AppCard title="Recent Transactions" subtitle="Latest financial activities">
            <div className="space-y-2">
              {recentTransactions.length > 0 ? recentTransactions.map((transaction) => {
                const isInflow = transaction.type !== 'EXPENSE';
                const Icon = transaction.icon;
                return (
                  <div key={transaction.id} className="flex min-w-0 items-center gap-3 rounded-md p-3 transition hover:bg-slate-50">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${isInflow ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-slate-950">{transaction.title}</p>
                      <p className="truncate text-xs text-slate-500">{transaction.reference}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-extrabold ${isInflow ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {isInflow ? '+' : '-'}{formatKes(transaction.amount)}
                      </p>
                      <p className="text-[11px] text-slate-400">{timeAgo(transaction.createdAt)}</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm font-semibold text-slate-500">
                  No posted accounting entries yet.
                </div>
              )}
            </div>
          </AppCard>
        </div>
        </DashboardSection>

        <DashboardSection id="finance-shortcuts" controls={sectionControls}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <button type="button" onClick={() => onNavigate('fees-collection')} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50">
            <BarChart3 size={20} style={{ color: TOKENS.colors.brand.primary }} />
            <span className="text-sm font-extrabold text-slate-950">Open Fee Collection</span>
          </button>
          <button type="button" onClick={() => onNavigate('accounting-expenses')} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50">
            <PieChart size={20} style={{ color: TOKENS.colors.brand.primary }} />
            <span className="text-sm font-extrabold text-slate-950">Review Expenses</span>
          </button>
          <button type="button" onClick={() => onNavigate('accounting-reports')} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50">
            <TrendingUp size={20} style={{ color: TOKENS.colors.brand.primary }} />
            <span className="text-sm font-extrabold text-slate-950">Financial Reports</span>
          </button>
        </div>
        </DashboardSection>

        <DashboardSectionControls {...sectionControls} />
      </div>
      </div>
    </div>
  );
};

export default AccountantDashboard;
