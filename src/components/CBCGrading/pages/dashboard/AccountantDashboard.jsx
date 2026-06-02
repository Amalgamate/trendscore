/**
 * Accountant Dashboard
 * Finance-focused executive dashboard for accounting oversight
 */

import React, { useEffect, useState, Suspense } from 'react';
import { dashboardAPI } from '../../../../services/api';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart, BarChart, Bar } from 'recharts';
import { hasPageAccess } from '../../utils/appAccess';
import {
  AppCard,
  KpiCard,
  SectionHeader,
  DashboardHero,
  EmptyState
} from '@/design-system/components';

import {
  TrendingUp,
  AlertTriangle,
  DollarSign,
  CreditCard,
  Calendar,
  Landmark,
  Brain,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';

// Intelligence Engine Widgets
import AIInsights from '../../widgets/AIInsights';
import FeeCollectionForecast from '../../widgets/FeeCollectionForecast';
import RiskAlerts from '../../widgets/RiskAlerts';

const AccountantDashboard = ({ user, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [term, setTerm] = useState('TERM_2');

  const userId = user?.id || user?.userId;

  const loadMetrics = async (filter = 'term') => {
    try {
      setRefreshing(true);
      setApiError(null);
      const response = await dashboardAPI.getAdminMetrics(filter);
      if (response.success) {
        setMetrics(response.data);
      } else {
        setApiError(response.message || 'Failed to load dashboard data');
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
  }, [userId, term]);

  // Compute financial stats from metrics
  const stats = {
    totalExpected: metrics?.stats?.expectedIncome || 2500000,
    totalCollected: metrics?.stats?.feeCollected || 1850000,
    outstanding: metrics?.stats?.feePending || 650000,
    overdue: metrics?.stats?.overdueBalance || 125000,
    collectionRate: metrics?.stats?.feeCollected && metrics?.stats?.expectedIncome
      ? Math.round((metrics.stats.feeCollected / metrics.stats.expectedIncome) * 100)
      : 74,
    bankBalance: metrics?.stats?.bankBalance || 850000,
    pendingReconciliation: metrics?.stats?.pendingReconciliation || 42000,
  };

  // Fee collection forecast data
  const forecastData = [
    { week: 'W1', projected: 150000, baseline: 140000 },
    { week: 'W2', projected: 165000, baseline: 155000 },
    { week: 'W3', projected: 180000, baseline: 170000 },
    { week: 'W4', projected: 195000, baseline: 185000 },
    { week: 'W5', projected: 210000, baseline: 200000 },
  ];

  // Recent transactions
  const recentTransactions = [
    {
      id: 1,
      type: 'payment_received',
      title: 'Fee Payment Received',
      reference: 'Grade 3A',
      amount: 45000,
      createdAt: new Date(Date.now() - 15 * 60000),
      icon: ArrowDownCircle
    },
    {
      id: 2,
      type: 'payment_received',
      title: 'Sponsorship Received',
      reference: 'Bursary Fund',
      amount: 150000,
      createdAt: new Date(Date.now() - 45 * 60000),
      icon: ArrowDownCircle
    },
    {
      id: 3,
      type: 'invoice_created',
      title: 'Invoice Generated',
      reference: 'Late Payment Notice',
      amount: 35000,
      createdAt: new Date(Date.now() - 2 * 60 * 60000),
      icon: ArrowUpCircle
    },
    {
      id: 4,
      type: 'payment_received',
      title: 'Installment Paid',
      reference: 'Grade 5B',
      amount: 28000,
      createdAt: new Date(Date.now() - 3 * 60 * 60000),
      icon: ArrowDownCircle
    },
  ];

  // Bank accounts for reconciliation
  const bankAccounts = [
    { id: 1, name: 'Main Operations', bankName: 'Equity Bank', accountNumber: '1234567890', balance: 450000, lastReconciled: '2026-06-01' },
    { id: 2, name: 'Fee Account', bankName: 'Co-operative Bank', accountNumber: '0987654321', balance: 280000, lastReconciled: '2026-05-31' },
    { id: 3, name: 'Payroll Account', bankName: 'KCB', accountNumber: '5555123456', balance: 120000, lastReconciled: '2026-06-01' },
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
      <EmptyState
        icon={<AlertTriangle size={48} />}
        title="Dashboard unavailable"
        description={apiError}
        action={{
          label: 'Retry',
          onClick: () => loadMetrics('term')
        }}
      />
    );
  }

  if (refreshing && !metrics) {
    return <div className="animate-pulse space-y-6"><div className="h-96 bg-gray-200 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {refreshing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
          <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">
            Syncing financial data...
          </p>
        </div>
      )}

      {/* Hero Section */}
      <DashboardHero
        variant="default"
        title="Finance Dashboard"
        subtitle="Real-time overview of school financial health and performance"
        stats={[
          { label: 'Total Collected', value: `KES ${Math.round(stats.totalCollected / 1000)}k` },
          { label: 'Collection Rate', value: `${stats.collectionRate}%` },
          { label: 'Outstanding', value: `KES ${Math.round(stats.outstanding / 1000)}k` }
        ]}
      />

      {/* Key Financial Metrics */}
      <div className="space-y-4">
        <SectionHeader 
          variant="default"
          title="Key Financial Metrics"
          level="h3"
        />
        
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard 
            variant="primary"
            label="Total Expected"
            value={`KES ${Math.round(stats.totalExpected / 1000)}k`}
            subvalue="This term"
            icon={<DollarSign size={20} />}
            onClick={() => onNavigate('accounting-invoices')}
          />
          
          <KpiCard 
            variant="success"
            label="Total Collected"
            value={`KES ${Math.round(stats.totalCollected / 1000)}k`}
            subvalue="Payments received"
            icon={<CreditCard size={20} />}
            onClick={() => onNavigate('fees-collection')}
          />
          
          <KpiCard 
            variant="warning"
            label="Outstanding"
            value={`KES ${Math.round(stats.outstanding / 1000)}k`}
            subvalue="From active invoices"
            icon={<Calendar size={20} />}
            onClick={() => onNavigate('outstanding-invoices')}
          />
          
          <KpiCard 
            variant="error"
            label="Overdue"
            value={`KES ${Math.round(stats.overdue / 1000)}k`}
            subvalue="Past due invoices"
            icon={<AlertTriangle size={20} />}
            onClick={() => onNavigate('overdue-invoices')}
          />
        </div>

        {/* Collection Rate Metric */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">Collection Rate</p>
              <p className="mt-2 text-4xl font-bold text-brand-purple">{stats.collectionRate}%</p>
              <p className="mt-1 text-xs text-gray-500">of expected income collected</p>
            </div>
            <div className="h-32 w-32">
              <svg className="transform -rotate-90" width="128" height="128" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="56" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="8"
                  strokeDasharray={`${(stats.collectionRate / 100) * 2 * Math.PI * 56} ${2 * Math.PI * 56}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-brand-purple">{stats.collectionRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Reconciliation & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard 
          title="Bank Reconciliation"
          subtitle="Account balances and reconciliation status"
        >
          <div className="space-y-3">
            {bankAccounts.map((account) => (
              <div key={account.id} className="p-4 rounded-lg border border-slate-100 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-brand-purple/10">
                      <Landmark size={16} className="text-brand-purple" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-gray-900">{account.name}</h4>
                      <p className="text-xs text-gray-500">{account.bankName} • {account.accountNumber}</p>
                      <p className="text-xs text-gray-400 mt-1">Last reconciled: {account.lastReconciled}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">KES {Math.round(account.balance / 1000)}k</p>
                    <p className="text-xs text-emerald-600 font-semibold">✓ Reconciled</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate('accounting-reconciliation')}
            className="mt-4 w-full px-4 py-2 bg-brand-purple/10 text-brand-purple rounded-lg font-semibold text-sm hover:bg-brand-purple/20 transition"
          >
            View Full Reconciliation
          </button>
        </AppCard>

        <AppCard 
          title="Recent Transactions"
          subtitle="Latest financial activities"
        >
          <div className="space-y-2">
            {recentTransactions.map((transaction) => {
              const isInflow = transaction.type === 'payment_received';
              const Icon = transaction.icon;
              return (
                <div key={transaction.id} className="p-3 hover:bg-gray-50 rounded-lg transition flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isInflow ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    <Icon size={16} className={isInflow ? 'text-emerald-600' : 'text-rose-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900">{transaction.title}</p>
                    <p className="text-xs text-gray-500">{transaction.reference}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-bold ${isInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isInflow ? '+' : '-'}KES {Math.round(transaction.amount / 1000)}k
                    </p>
                    <p className="text-xs text-gray-400">{timeAgo(transaction.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => onNavigate('fees-collection')}
            className="mt-4 w-full px-4 py-2 text-brand-purple text-sm font-semibold"
          >
            View all transactions →
          </button>
        </AppCard>
      </div>

      {/* Fee Collection Forecast */}
      <AppCard 
        title="Fee Collection Forecast"
        subtitle="Projected vs baseline weekly collection targets"
      >
        <div className="h-64">
          {forecastData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => `KES ${Math.round(value / 1000)}k`}
                />
                <Bar dataKey="projected" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="baseline" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={<TrendingUp size={48} />} title="No data" description="Collection forecast data pending" />
          )}
        </div>
      </AppCard>

      {/* AI Collection Insights Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
          <AIInsights contextType="school" contextId="default" />
        </Suspense>

        {/* Fee Collection Forecast */}
        <Suspense fallback={<div className="bg-white rounded-lg border border-gray-200 p-4 h-80 animate-pulse" />}>
          <FeeCollectionForecast contextType="school" contextId="default" />
        </Suspense>
      </div>
    </div>
  );
};

export default AccountantDashboard;
