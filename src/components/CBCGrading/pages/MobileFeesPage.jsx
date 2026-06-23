/**
 * MobileFeesPage — Mobile-first fees hub for teachers, admins, and accountants.
 *
 * Flow:
 *   Screen 1: Fees Dashboard  → stats + search + learner list
 *   Screen 2: Learner Fee Detail → invoices, balance, record payment CTA
 *
 * Uses feeAPI and learnerAPI — no new endpoints needed.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Wallet,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Users,
  Plus,
  CreditCard,
  FileText,
} from 'lucide-react';
import { feeAPI } from '../../../services/api/fee.api';
import { learnerAPI } from '../../../services/api/learner.api';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../utils/cn';
import LoadingSpinner from '../shared/LoadingSpinner';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const fmtK = (n) => {
  n = Number(n || 0);
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${Math.round(n / 1_000)}K`;
  return `KES ${n.toLocaleString('en-KE')}`;
};

const getStatusColor = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'PAID': return 'text-emerald-600 bg-emerald-50';
    case 'PARTIAL': return 'text-amber-600 bg-amber-50';
    case 'OVERDUE': return 'text-red-600 bg-red-50';
    case 'PENDING': return 'text-blue-600 bg-blue-50';
    case 'CANCELLED': return 'text-gray-400 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

const SCREEN = { DASHBOARD: 'DASHBOARD', LEARNER: 'LEARNER' };

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className={cn('rounded-2xl p-4 flex flex-col gap-1', tone)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
        <Icon size={16} className="opacity-50" />
      </div>
      <div className="text-2xl font-black leading-none">{value}</div>
      {sub && <div className="text-[11px] font-medium opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function LearnerFeeRow({ learner, invoice, onSelect }) {
  const balance = Number(invoice?.balance ?? invoice?.outstanding ?? 0);
  const status = invoice?.status || (balance <= 0 ? 'PAID' : 'PENDING');
  const initials = `${learner.firstName?.[0] || ''}${learner.lastName?.[0] || ''}`.toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(learner, invoice)}
      className="w-full flex items-center gap-3 py-3 px-4 bg-white rounded-2xl border border-gray-100 active:scale-[0.98] transition-transform text-left"
    >
      <div className="w-10 h-10 rounded-full bg-[var(--brand-purple)]/10 flex items-center justify-center text-[var(--brand-purple)] text-sm font-bold shrink-0">
        {learner.photoUrl ? (
          <img src={learner.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
        ) : initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {learner.firstName} {learner.lastName}
        </p>
        <p className="text-xs text-gray-400">{learner.admissionNumber} · {String(learner.grade || '').replace(/_/g, ' ')}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-bold', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
          {balance > 0 ? `-${fmtK(balance)}` : 'Paid'}
        </p>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', getStatusColor(status))}>
          {status}
        </span>
      </div>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </button>
  );
}

function InvoiceCard({ invoice }) {
  const balance = Number(invoice?.balance ?? invoice?.outstanding ?? 0);
  const paid = Number(invoice?.amountPaid ?? invoice?.paid ?? 0);
  const total = Number(invoice?.totalAmount ?? invoice?.amount ?? 0);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">
            {String(invoice?.term || '').replace('_', ' ')} {invoice?.academicYear}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{invoice?.invoiceNumber || invoice?.id?.slice(0, 8)}</p>
        </div>
        <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', getStatusColor(invoice?.status))}>
          {invoice?.status || 'PENDING'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] font-semibold text-gray-400 mb-1.5">
          <span>Paid: {fmt(paid)}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400')}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between text-xs font-medium text-gray-500">
        <span>Total: <span className="font-bold text-gray-800">{fmt(total)}</span></span>
        <span className={cn('font-bold', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
          {balance > 0 ? `Owes ${fmt(balance)}` : 'Cleared ✓'}
        </span>
      </div>
    </div>
  );
}

// ─── Screen 2: Learner Fee Detail ─────────────────────────────────────────────
function LearnerFeeDetail({ learner, onBack, onRecordPayment, onNavigate }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await feeAPI.getLearnerInvoices(learner.id);
        const data = res?.data ?? res ?? [];
        if (!cancelled) setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load invoices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [learner.id]);

  const totalBalance = useMemo(
    () => invoices.reduce((sum, inv) => sum + Number(inv?.balance ?? inv?.outstanding ?? 0), 0),
    [invoices]
  );
  const totalPaid = useMemo(
    () => invoices.reduce((sum, inv) => sum + Number(inv?.amountPaid ?? inv?.paid ?? 0), 0),
    [invoices]
  );

  const initials = `${learner.firstName?.[0] || ''}${learner.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="flex flex-col min-h-0 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{learner.firstName} {learner.lastName}</p>
            <p className="text-xs text-gray-400">{learner.admissionNumber} · {String(learner.grade || '').replace(/_/g, ' ')}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[var(--brand-purple)]/10 flex items-center justify-center text-[var(--brand-purple)] text-sm font-bold">
            {learner.photoUrl ? (
              <img src={learner.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : initials}
          </div>
        </div>
      </div>

      {/* Balance summary */}
      <div className="px-4 py-4 bg-gradient-to-br from-[var(--brand-purple)] to-[var(--brand-purple)]/80 mx-4 mt-4 rounded-2xl text-white">
        <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Total Outstanding</p>
        <p className="text-3xl font-black">{totalBalance > 0 ? fmt(totalBalance) : 'Fully Paid'}</p>
        <p className="text-xs opacity-60 mt-1">Total paid: {fmt(totalPaid)}</p>
      </div>

      {/* Content */}
      <div className="px-4 pt-5 space-y-3 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
              <FileText size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No invoices found</p>
            <p className="text-xs text-gray-400 mt-1">Invoices will appear once generated</p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <InvoiceCard key={invoice.id || invoice._id} invoice={invoice} />
          ))
        )}
      </div>

      {/* Action bar */}
      {totalBalance > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-white/90 backdrop-blur-xl border-t border-gray-100">
          <button
            type="button"
            onClick={() => onRecordPayment(learner, invoices[0])}
            className="w-full h-14 bg-[var(--brand-purple)] text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform shadow-lg shadow-[var(--brand-purple)]/20"
          >
            <CreditCard size={20} />
            Record Payment
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main: MobileFeesPage ──────────────────────────────────────────────────────
const MobileFeesPage = ({ onNavigate }) => {
  const { user } = useAuth();
    const [screen, setScreen] = useState(SCREEN.DASHBOARD);
  const [activeLearner, setActiveLearner] = useState(null);
  const [activeInvoice, setActiveInvoice] = useState(null);

  // Dashboard state
  const [stats, setStats] = useState(null);
  const [learners, setLearners] = useState([]);
  const [invoiceMap, setInvoiceMap] = useState({}); // learnerId → latest invoice
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all | outstanding | paid

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const [statsRes, invoiceRes, learnersRes] = await Promise.all([
        feeAPI.getPaymentStats().catch(() => null),
        feeAPI.getAllInvoices({ limit: 200 }).catch(() => null),
        learnerAPI.getAll({ limit: 300 }).catch(() => null),
      ]);

      // Stats
      const statsData = statsRes?.data ?? statsRes ?? {};
      setStats(statsData);

      // Build learner map
      const allLearners = learnersRes?.data ?? learnersRes ?? [];
      setLearners(Array.isArray(allLearners) ? allLearners : []);

      // Build learnerId → latest invoice map
      const allInvoices = invoiceRes?.data ?? invoiceRes ?? [];
      const arr = Array.isArray(allInvoices) ? allInvoices : [];
      const map = {};
      arr.forEach((inv) => {
        const lid = inv?.learnerId || inv?.learner?.id;
        if (!lid) return;
        const existing = map[lid];
        // Keep the most recent (highest academicYear + term rank)
        if (!existing || compareInvoiceCycle(inv, existing) > 0) {
          map[lid] = inv;
        }
      });
      setInvoiceMap(map);
    } catch (err) {
      setError(err?.message || 'Failed to load fee data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLearners = useMemo(() => {
    let list = learners;

    // Filter by balance
    if (filter === 'outstanding') {
      list = list.filter((l) => Number(invoiceMap[l.id]?.balance ?? invoiceMap[l.id]?.outstanding ?? 0) > 0);
    } else if (filter === 'paid') {
      list = list.filter((l) => {
        const inv = invoiceMap[l.id];
        if (!inv) return false;
        return Number(inv?.balance ?? inv?.outstanding ?? 0) <= 0;
      });
    }

    // Search
    if (searchTerm.trim().length >= 1) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (l) =>
          `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
          String(l.admissionNumber || '').toLowerCase().includes(q) ||
          String(l.grade || '').toLowerCase().includes(q)
      );
    }

    return list.slice(0, 50); // limit for performance
  }, [learners, invoiceMap, filter, searchTerm]);

  const summaryStats = useMemo(() => {
    // Server shape: { totalCollected, totalOutstanding, collectionRate, pendingInvoices, partialInvoices }
    const collected = Number(stats?.totalCollected ?? 0);
    const outstanding = Number(stats?.totalOutstanding ?? 0);
    const rate = Number(stats?.collectionRate ?? 0);
    const learnersWithBalance = Number(stats?.pendingInvoices ?? 0) + Number(stats?.partialInvoices ?? 0);
    return { collected, outstanding, rate, learnersWithBalance };
  }, [stats]);

  const handleSelectLearner = (learner, invoice) => {
    setActiveLearner(learner);
    setActiveInvoice(invoice);
    setScreen(SCREEN.LEARNER);
  };

  const handleRecordPayment = (learner, invoice) => {
    // Navigate to the full record payment page, passing learner context
    onNavigate?.('fees-record-payment', { invoice, learnerId: learner?.id });
  };

  // ── Screen 2: Learner Detail ───────────────────────────────────────────
  if (screen === SCREEN.LEARNER && activeLearner) {
    return (
      <LearnerFeeDetail
        learner={activeLearner}
        onBack={() => setScreen(SCREEN.DASHBOARD)}
        onRecordPayment={handleRecordPayment}
        onNavigate={onNavigate}
      />
    );
  }

  // ── Screen 1: Dashboard ────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-0 pb-24">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Finance</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Fee Collection</h1>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={18} className={cn('text-gray-500', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 bg-red-50 border border-red-100 rounded-2xl p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs font-medium text-red-700 flex-1">{error}</p>
          <button onClick={() => loadData()} className="text-xs font-bold text-red-600 underline">Retry</button>
        </div>
      )}

      {/* Stats cards */}
      {loading ? (
        <div className="px-4 grid grid-cols-2 gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3 mb-4">
          <StatCard
            icon={TrendingUp}
            label="Collected"
            value={fmtK(summaryStats.collected)}
            sub={`${summaryStats.rate}% collection rate`}
            tone="bg-emerald-50 text-emerald-800"
          />
          <StatCard
            icon={Clock}
            label="Outstanding"
            value={fmtK(summaryStats.outstanding)}
            sub={`${summaryStats.learnersWithBalance} learners`}
            tone="bg-red-50 text-red-800"
          />
          <StatCard
            icon={Users}
            label="Total Learners"
            value={learners.length}
            sub="Active enrollment"
            tone="bg-blue-50 text-blue-800"
          />
          <StatCard
            icon={Wallet}
            label="With Balance"
            value={summaryStats.learnersWithBalance}
            sub="Need attention"
            tone="bg-amber-50 text-amber-800"
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="px-4 flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => onNavigate?.('fees-record-payment')}
          className="flex-1 h-11 bg-[var(--brand-purple)] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
        >
          <Plus size={16} />
          Record Payment
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('fees-invoices')}
          className="flex-1 h-11 border border-gray-200 bg-white text-gray-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
        >
          <FileText size={16} />
          All Invoices
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('fees-reports')}
          className="flex-1 h-11 border border-gray-200 bg-white text-gray-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
        >
          <CheckCircle size={16} />
          Reports
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search learner by name or admission no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-9 pr-9 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[var(--brand-purple)]/40 focus:bg-white transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 flex gap-2 mb-4">
        {['all', 'outstanding', 'paid'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize',
              filter === f
                ? 'bg-[var(--brand-purple)] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f === 'all' ? 'All Learners' : f}
          </button>
        ))}
      </div>

      {/* Learner fee list */}
      {loading ? (
        <div className="px-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredLearners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
            <Users size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">
            {searchTerm ? 'No learners match your search' : 'No learners found'}
          </p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-xs text-[var(--brand-purple)] font-bold mt-2">
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 space-y-2">
          <p className="text-xs text-gray-400 font-medium mb-1">
            {filteredLearners.length} learner{filteredLearners.length !== 1 ? 's' : ''}
            {filter === 'outstanding' ? ' with outstanding balance' : filter === 'paid' ? ' fully paid' : ''}
          </p>
          {filteredLearners.map((learner) => (
            <LearnerFeeRow
              key={learner.id}
              learner={learner}
              invoice={invoiceMap[learner.id] || null}
              onSelect={handleSelectLearner}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Invoice cycle comparison helper ──────────────────────────────────────────
function compareInvoiceCycle(a, b) {
  const termRank = { TERM_1: 1, TERM_2: 2, TERM_3: 3 };
  const ay = Number(a?.academicYear || 0) * 10 + (termRank[a?.term] || 0);
  const by = Number(b?.academicYear || 0) * 10 + (termRank[b?.term] || 0);
  return ay - by;
}

export default MobileFeesPage;
