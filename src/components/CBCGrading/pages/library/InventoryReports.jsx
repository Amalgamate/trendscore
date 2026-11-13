/**
 * InventoryReports.jsx — Library Phase 4 Frontend
 *
 * Dashboard + tabbed report views:
 *   - KPI stat cards (total books, active loans, overdue, members)
 *   - Popular Books report
 *   - Overdue Loans report
 *   - Loan/Fine totals summary
 *
 * API: libraryAPI (book.api.js)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Users, Clock, DollarSign, TrendingUp, RefreshCw,
  Loader2, AlertTriangle, BarChart2, List, Award,
} from 'lucide-react';
import { libraryAPI } from '../../../../services/api/book.api';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color = 'violet' }) => {
  const colors = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    sky:    'bg-sky-50 text-sky-600 border-sky-100',
    amber:  'bg-amber-50 text-amber-600 border-amber-100',
    emerald:'bg-emerald-50 text-emerald-600 border-emerald-100',
    red:    'bg-red-50 text-red-600 border-red-100',
  };
  const text = {
    violet: 'text-violet-700',
    sky:    'text-sky-700',
    amber:  'text-amber-700',
    emerald:'text-emerald-700',
    red:    'text-red-700',
  };
  return (
    <div className={`bg-white rounded-2xl border ${colors[color].split(' ').at(-1)} p-5 flex items-center gap-4 shadow-sm`}>
      <div className={`w-12 h-12 rounded-xl ${colors[color].split(' ').slice(0, 2).join(' ')} flex items-center justify-center shrink-0`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-medium mt-0.5 ${text[color]}`}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

// ─── Popular Books Tab ────────────────────────────────────────────────────────
const PopularBooksTab = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    libraryAPI.getPopularBooks(20)
      .then(res => setBooks(res?.data || res || []))
      .catch(() => toast.error('Failed to load popular books'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-500" /></div>;
  if (!books.length) return (
    <div className="text-center py-20 text-slate-400">
      <Award size={40} className="mx-auto mb-3 text-slate-200" />
      <p className="font-medium">No data yet</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">#</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Title</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Author</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Category</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Total Loans</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {books.map((b, i) => (
            <tr key={b.id || i} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-4 py-3 text-slate-400 font-medium text-sm w-10">{i + 1}</td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{b.title}</p>
              </td>
              <td className="px-4 py-3 text-slate-500 text-sm hidden md:table-cell">{b.author || '—'}</td>
              <td className="px-4 py-3 hidden md:table-cell">
                {b.category && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-violet-50 text-violet-600 font-medium">
                    {b.category}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-medium text-violet-700">{b.totalLoans ?? b._count?.loans ?? '—'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Overdue Loans Tab ────────────────────────────────────────────────────────
const OverdueLoansTab = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    libraryAPI.getOverdueLoans()
      .then(res => setLoans(res?.data || res || []))
      .catch(() => toast.error('Failed to load overdue loans'))
      .finally(() => setLoading(false));
  }, []);

  const daysOverdue = (dueDate) => {
    const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-500" /></div>;
  if (!loans.length) return (
    <div className="text-center py-20 text-slate-400">
      <Clock size={40} className="mx-auto mb-3 text-slate-200" />
      <p className="font-medium text-emerald-600">No overdue loans! 🎉</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Book / Copy</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Member</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Due Date</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Days Overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {loans.map(loan => (
            <tr key={loan.id} className="hover:bg-red-50/30 transition-colors">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{loan.book?.title || loan.copy?.book?.title || '—'}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{loan.copy?.copyNumber}</p>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <p className="text-slate-700">{loan.member?.name || loan.user?.name || loan.memberId || '—'}</p>
                <p className="text-xs text-slate-400">{loan.member?.role || ''}</p>
              </td>
              <td className="px-4 py-3 text-red-500 font-semibold">{fmt(loan.dueDate)}</td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                  {daysOverdue(loan.dueDate)}d
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Summary Tab ──────────────────────────────────────────────────────────────
const SummaryTab = ({ stats }) => {
  if (!stats) return (
    <div className="text-center py-20 text-slate-400">
      <BarChart2 size={40} className="mx-auto mb-3 text-slate-200" />
      <p className="font-medium">No summary data available</p>
    </div>
  );

  const rows = [
    { label: 'Total Books in Catalog', value: stats.books?.total ?? '—' },
    { label: 'Available Books', value: stats.books?.available ?? '—' },
    { label: 'Out-of-stock Books', value: stats.books?.outOfStock ?? '—' },
    { label: 'Limited Books', value: stats.books?.limited ?? '—' },
    { label: 'Total Physical Copies', value: stats.books?.totalCopies ?? '—' },
    { label: 'Available Copies', value: stats.books?.availableCopies ?? '—' },
    { label: 'Active Loans', value: stats.loans?.active ?? '—' },
    { label: 'Overdue Loans', value: stats.loans?.overdue ?? '—' },
    { label: 'Loans Issued Today', value: stats.loans?.issuedToday ?? '—' },
    { label: 'Loans Returned Today', value: stats.loans?.returnedToday ?? '—' },
    { label: 'Total Members', value: stats.members?.total ?? '—' },
    { label: 'Active Members', value: stats.members?.active ?? '—' },
    { label: 'Suspended Members', value: stats.members?.suspended ?? '—' },
    { label: 'Expired Members', value: stats.members?.expired ?? '—' },
    { label: 'Unpaid Fines', value: stats.fines?.totalUnpaidCount ?? '—' },
    { label: 'Unpaid Fines Amount', value: stats.fines?.totalUnpaidAmount != null ? KES(stats.fines.totalUnpaidAmount) : '—' },
    { label: 'Fines Collected This Month', value: stats.fines?.totalPaidThisMonth != null ? KES(stats.fines.totalPaidThisMonth) : '—' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-50">
          {rows.map(row => (
            <tr key={row.label} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-5 py-3.5 text-slate-600">{row.label}</td>
              <td className="px-5 py-3.5 text-right font-medium text-slate-900">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const reportConfig = {
  inventory: {
    title: 'Inventory Report',
    columns: [
      ['title', 'Book'], ['author', 'Author'], ['category', 'Category'], ['status', 'Status'],
      ['totalCopies', 'Copies'], ['availableCopies', 'Available'], ['borrowedCopies', 'Borrowed'],
      ['damagedCopies', 'Damaged'], ['lostCopies', 'Lost'], ['allTimeLoanCount', 'All-time loans'],
    ],
  },
  categories: {
    title: 'Category Report',
    columns: [
      ['category', 'Category'], ['totalBooks', 'Books'], ['totalCopies', 'Copies'],
      ['availableCopies', 'Available'], ['activeLoans', 'Active loans'],
      ['allTimeLoanCount', 'All-time loans'], ['unpaidFinesTotal', 'Unpaid fines', KES],
    ],
  },
  copyAudit: {
    title: 'Copy Condition Audit',
    columns: [['condition', 'Condition'], ['location', 'Location'], ['count', 'Copies']],
  },
  circulation: {
    title: 'Daily Circulation',
    columns: [
      ['date', 'Date'], ['newLoans', 'New loans'], ['returns', 'Returns'],
      ['renewals', 'Renewals'], ['overdueMarked', 'Overdue marked'],
    ],
  },
  members: {
    title: 'Member Activity',
    columns: [
      ['memberNumber', 'Member #'], ['fullName', 'Member'], ['memberType', 'Type'], ['status', 'Status'],
      ['activeLoans', 'Active loans'], ['overdueLoans', 'Overdue loans'],
      ['totalLoansAllTime', 'All-time loans'], ['unpaidFines', 'Unpaid fines', KES],
    ],
  },
  fines: {
    title: 'Overdue Fines',
    columns: [
      ['memberNumber', 'Member #'], ['memberName', 'Member'], ['bookTitle', 'Book'],
      ['dueDate', 'Due date', fmt], ['daysOverdue', 'Days overdue'],
      ['fineAmount', 'Amount', KES], ['agingBucket', 'Age'],
    ],
  },
};

const ReportTable = ({ report, rows, total, loading, error }) => {
  if (loading) return <div role="status" className="py-16 text-center text-slate-500">Loading {report.title.toLowerCase()}…</div>;
  if (error) return <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}</div>;
  if (!rows.length) return <div className="py-16 text-center text-slate-400">No {report.title.toLowerCase()} data available</div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
      <>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60">
            <tr>{report.columns.map(([, label]) => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, index) => (
              <tr key={row.id || row.memberId || row.fineId || row.date || `${row.category || row.condition}-${row.location || index}`} className="hover:bg-slate-50/50">
                {report.columns.map(([key, , format]) => {
                  const value = row[key];
                  return <td key={key} className="whitespace-nowrap px-4 py-3 text-slate-700">{value == null || value === '' ? '—' : format ? format(value) : value}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {total != null && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{report.title === 'Member Activity' ? `Showing ${rows.length} of ${total} members` : `${total} records`}</p>}
      </>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const InventoryReports = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('summary');
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportData, setReportData] = useState({});
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [memberPage, setMemberPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await libraryAPI.getDashboardSummary();
      const summary = res?.data || res || {};
      setStats({
        ...summary,
        totalBooks: summary.books?.total,
        totalCopies: summary.books?.totalCopies,
        availableCopies: summary.books?.availableCopies,
        activeLoans: summary.loans?.active,
        overdueLoans: summary.loans?.overdue,
        totalMembers: summary.members?.total,
        activeMembers: summary.members?.active,
        totalFinesCollected: summary.fines?.totalPaidThisMonth,
        pendingFines: summary.fines?.totalUnpaidAmount,
      });
    } catch {
      setStats(null);
      toast.error('Failed to load library dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    if (!reportConfig[tab]) return;

    let active = true;
    const requests = {
      inventory: () => libraryAPI.getInventoryReport(),
      categories: () => libraryAPI.getCategoryReport(),
      copyAudit: () => libraryAPI.getCopyAuditReport(),
      circulation: () => libraryAPI.getCirculationReport(),
      members: () => libraryAPI.getMemberActivityReport({ page: memberPage, limit: 50 }),
      fines: () => libraryAPI.getOverdueFinesReport(),
    };

    setReportLoading(true);
    setReportError('');
    requests[tab]()
      .then((res) => {
        if (!active) return;
        const rows = res?.data ?? res ?? [];
        setReportData((current) => ({
          ...current,
          [tab]: {
            rows: Array.isArray(rows) ? rows : [],
            total: res?.total ?? res?.totalBooks ?? res?.totalCount ?? (Array.isArray(rows) ? rows.length : 0),
          },
        }));
      })
      .catch((err) => {
        if (!active) return;
        setReportError(err?.message || `Failed to load ${reportConfig[tab].title.toLowerCase()}`);
      })
      .finally(() => { if (active) setReportLoading(false); });

    return () => { active = false; };
  }, [tab, refreshKey, memberPage]);

  const tabs = [
    { id: 'summary',  label: 'Summary',       icon: List },
    { id: 'inventory', label: 'Inventory', icon: BookOpen },
    { id: 'categories', label: 'Categories', icon: List },
    { id: 'copyAudit', label: 'Copy audit', icon: AlertTriangle },
    { id: 'circulation', label: 'Circulation', icon: TrendingUp },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'fines', label: 'Overdue fines', icon: DollarSign },
    { id: 'popular',  label: 'Popular Books',  icon: Award },
    { id: 'overdue',  label: 'Overdue Loans',  icon: AlertTriangle },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-slate-900">Inventory Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Library analytics and resource overview</p>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 h-24 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={BookOpen}   label="Total Books"    value={stats?.totalBooks}    sub={`${stats?.totalCopies ?? 0} copies total`} color="violet" />
          <StatCard icon={TrendingUp} label="Active Loans"   value={stats?.activeLoans}   sub="Currently borrowed" color="sky" />
          <StatCard icon={Clock}      label="Overdue Loans"  value={stats?.overdueLoans}  sub="Need follow-up" color="red" />
          <StatCard icon={Users}      label="Members"        value={stats?.totalMembers}  sub={`${stats?.activeMembers ?? 0} active`} color="emerald" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px
                ${tab === t.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {tab === 'summary'  && <SummaryTab stats={stats} />}
        {reportConfig[tab] && (
          <ReportTable
            report={reportConfig[tab]}
            rows={reportData[tab]?.rows || []}
            total={reportData[tab]?.total}
            loading={reportLoading}
            error={reportError}
          />
        )}
        {tab === 'members' && reportData.members && !reportLoading && !reportError && (
          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={() => setMemberPage((page) => page - 1)} disabled={memberPage <= 1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 disabled:opacity-50">
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {memberPage}</span>
            <button type="button" onClick={() => setMemberPage((page) => page + 1)}
              disabled={memberPage * 50 >= reportData.members.total}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 disabled:opacity-50">
              Next
            </button>
          </div>
        )}
        {tab === 'popular'  && <PopularBooksTab />}
        {tab === 'overdue'  && <OverdueLoansTab />}
      </div>
    </div>
  );
};

export default InventoryReports;
