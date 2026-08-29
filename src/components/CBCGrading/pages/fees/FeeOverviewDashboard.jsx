/**
 * FeeOverviewDashboard
 * A rich analytics dashboard for the Fee Overview tab.
 * Displays: collection progress donut, weekly trend chart, attention alerts,
 * top insights.
 */

import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingDown, AlertCircle, Clock,
  Users, ChevronRight, RefreshCw, Trophy, Award, Frown,
  Calendar, MessageSquare,
  CheckCircle, ArrowRight, Target, Zap, Star
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const fmtK = (n) => {
  n = Number(n || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('en-KE');
};

/* ─── Donut chart tooltip ────────────────────────────────────────────── */
const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-100 shadow-md rounded-lg px-3 py-2 z-50">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{name}</p>
      <p className="text-sm font-black text-gray-900">KES {Number(value).toLocaleString('en-KE')}</p>
    </div>
  );
};

/* ─── Donut chart (Recharts) ─────────────────────────────── */
function DonutChart({ collected, outstanding, waived, total }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const data = [
    { name: 'Collected',           value: collected,   color: '#22C55E' },
    { name: 'Outstanding',         value: outstanding, color: '#F59E0B' },
    { name: 'Waived / Discounted', value: waived,      color: '#3B82F6' },
  ].filter(d => d.value > 0);

  const fmtK = (n) => {
    n = Number(n || 0);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return n.toLocaleString('en-KE');
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={76}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
            onMouseEnter={(_, idx) => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, idx) => (
              <Cell
                key={entry.name}
                fill={entry.color}
                opacity={activeIndex === null || activeIndex === idx ? 1 : 0.6}
              />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-base font-black text-gray-900 leading-none">
          KES {fmtK(total)}
        </span>
        <span className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
          Total Expected
        </span>
      </div>
    </div>
  );
}

/* ─── Payment by Grade widget ────────────────────────────────────────────── */
function PaymentByGrade({ invoices, onSendReminders, reminderLoading }) {
  const [selectedCategory, setSelectedCategory] = useState('outstanding');

  const categoryOptions = [
    { value: 'outstanding', label: 'All Balances' },
    { value: 'unpaid', label: 'Not Paid Anything' },
    { value: 'partial', label: 'Partial Payments' },
  ];

  const selectedLabel = categoryOptions.find(option => option.value === selectedCategory)?.label || 'All Balances';

  const { gradeRows, totals, invoiceIds } = useMemo(() => {
    const map = {};
    const ids = [];
    const summary = { students: 0, balance: 0 };

    (invoices || []).forEach(inv => {
      const billed  = Number(inv.totalAmount || 0);
      const paidAmt = inv.payments?.length
        ? inv.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
        : Number(inv.paidAmount || 0);
      const balance = Math.max(0, Number(inv.balance ?? (billed - paidAmt)));
      if (balance <= 0) return;

      const category =
        paidAmt <= 0 ? 'unpaid' :
        balance > 0 ? 'partial' :
        'paid';

      if (selectedCategory !== 'outstanding' && category !== selectedCategory) return;

      const g = inv?.learner?.grade || 'Unknown';
      if (!map[g]) map[g] = { students: 0, balance: 0 };
      map[g].students++;
      map[g].balance += balance;
      summary.students++;
      summary.balance += balance;
      if (inv.id) ids.push(inv.id);
    });

    const rows = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([grade, counts]) => ({
        grade,
        ...counts,
      }));

    return { gradeRows: rows, totals: summary, invoiceIds: ids };
  }, [invoices, selectedCategory]);

  const handleSendReminderClick = () => {
    if (!invoiceIds.length || !onSendReminders) return;
    onSendReminders(invoiceIds, 'SMS', selectedLabel);
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-44"
        >
          {categoryOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSendReminderClick}
          disabled={!invoiceIds.length || reminderLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <MessageSquare size={14} />
          {reminderLoading ? 'Sending...' : 'Send Reminder'}
        </button>
      </div>

      <div className="rounded-xl bg-amber-50 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{selectedLabel}</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="text-lg font-black text-gray-900">{fmt(totals.balance)}</p>
          <p className="text-xs font-semibold text-gray-600">{totals.students} students</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100 text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Grade</th>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Students</th>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {gradeRows.length > 0 ? gradeRows.map(row => (
              <tr key={row.grade} className="hover:bg-gray-50/70">
                <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-gray-900">{row.grade}</td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-700">{row.students}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-amber-700">{fmt(row.balance)}</td>
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-6 text-center text-xs font-medium text-gray-400" colSpan={3}>
                  No balances found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



/* ─── Attention alert item ─────────────────────────────────────────────── */
function AlertItem({ icon: Icon, iconBg, text, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-0 hover:bg-red-50/40 transition-colors rounded-lg group text-left"
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 leading-snug">{text}</p>
        {sub && <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{sub}</p>}
      </div>
      <ChevronRight size={14} className="text-gray-400 group-hover:text-red-500 transition-colors shrink-0" />
    </button>
  );
}

/* ─── Top insight card ─────────────────────────────────────────────────── */
function InsightCard({ icon: Icon, iconBg, label, value, sub, valueColor = 'text-gray-900' }) {
  return (
    <div className="flex-1 min-w-[140px] bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={14} className="text-white" />
        </div>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold leading-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function CollapsibleSection({ title, description, summary, tone = 'gray', children }) {
  const [isOpen, setIsOpen] = useState(false);
  const tones = {
    gray: 'border-gray-100 text-gray-700 bg-gray-50',
    green: 'border-emerald-100 text-emerald-700 bg-emerald-50',
    amber: 'border-amber-100 text-amber-700 bg-amber-50',
    red: 'border-red-100 text-red-700 bg-red-50',
    blue: 'border-blue-100 text-blue-700 bg-blue-50',
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 sm:px-5"
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600">{title}</p>
          {description && <p className="mt-0.5 text-[11px] font-medium text-gray-400">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {summary && (
            <span className={`hidden rounded-full border px-2 py-1 text-[10px] font-bold sm:inline-flex ${tones[tone] || tones.gray}`}>
              {summary}
            </span>
          )}
          <ChevronRight
            size={16}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 p-4 sm:p-5">
          {children}
        </div>
      )}
    </section>
  );
}

/* ─── Main component ───────────────────────────────────────────────────── */
export default function FeeOverviewDashboard({
  stats,
  invoices,           // currentCycleStatsInvoices
  statsLoading,
  termFilter,
  onNavigateToInvoices,
  onStatusFilter,
  lastUpdated,
  onRefresh,
  onSendReminders,
  reminderLoading = false,
}) {
  /* ── Derived analytics ── */
  const analytics = useMemo(() => {
    if (!invoices?.length) return null;
    const src = invoices;

    // Grade breakdown
    const gradeMap = {};
    src.forEach(inv => {
      const g = inv?.learner?.grade || 'Unknown';
      if (!gradeMap[g]) gradeMap[g] = { grade: g, count: 0, collected: 0, billed: 0 };
      gradeMap[g].count++;
      gradeMap[g].billed += Number(inv.totalAmount || 0);
      // sum payments
      if (inv.payments?.length) {
        gradeMap[g].collected += inv.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      } else {
        gradeMap[g].collected += Number(inv.paidAmount || 0);
      }
    });
    const grades = Object.values(gradeMap).map(g => ({
      ...g,
      rate: g.billed > 0 ? Math.round((g.collected / g.billed) * 100) : 0
    }));

    const bestGrade = [...grades].sort((a, b) => b.rate - a.rate)[0];
    const worstGrade = [...grades].sort((a, b) => a.rate - b.rate)[0];

    // Largest outstanding student
    const studentsWithBalance = src
      .map(inv => {
        const balance = Number(inv.balance || 0) || Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0));
        return { name: inv?.learner?.name || 'Unknown', grade: inv?.learner?.grade || '', balance };
      })
      .filter(s => s.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const largestOutstanding = studentsWithBalance[0];

    // Students with no payment at all
    const nothingPaid = src.filter(i => Number(i.paidAmount || 0) === 0);

    // Overdue 30+ days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const overdue30 = src.filter(i => {
      const due = i.dueDate ? new Date(i.dueDate) : null;
      return due && due < thirtyDaysAgo && Number(i.balance || 0) > 0;
    });

    // Promises / pledges
    const withPledges = src.filter(i => (i.pledges || []).some(p => p.status === 'PENDING' || p.status === 'DUE'));
    const pledgeAmount = withPledges.reduce((s, i) =>
      s + (i.pledges || []).filter(p => p.status === 'PENDING' || p.status === 'DUE').reduce((ss, p) => ss + Number(p.pledgedAmount || 0), 0), 0);

    // Expected this week (from pledges due soon)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueSoonPledges = src.reduce((s, i) => {
      return s + (i.pledges || []).filter(p => {
        const d = p.pledgeDate ? new Date(p.pledgeDate) : null;
        const isActive = p.status === 'PENDING' || p.status === 'DUE';
        return isActive && d && d <= nextWeek;
      }).reduce((ss, p) => ss + Number(p.pledgedAmount || 0), 0);
    }, 0);

    // Parents needing SMS reminders (outstanding, no recent payment in 14 days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const needReminders = src.filter(i => {
      const lastPay = i.payments?.reduce((latest, p) => {
        const d = new Date(p.paymentDate || p.createdAt || p.paidAt || 0);
        return d > latest ? d : latest;
      }, new Date(0));
      const hasBalance = Number(i.balance || 0) > 0 || Number(i.totalAmount || 0) > Number(i.paidAmount || 0);
      return hasBalance && (!lastPay || lastPay < twoWeeksAgo);
    });

    return {
      bestGrade,
      worstGrade,
      largestOutstanding,
      nothingPaid,
      overdue30,
      withPledges,
      pledgeAmount,
      dueSoonPledges,
      needReminders,
    };
  }, [invoices]);

  if (statsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-56" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-36" />
          ))}
        </div>
      </div>
    );
  }

  /* ── Totals for donut ── */
  const collected = stats?.actualCollectedRaw || 0;
  const outstanding = Math.max(0, (stats?.totalBilledRaw || 0) - collected - (stats?.waivedTotalRaw || 0));
  const waived = stats?.waivedTotalRaw || 0;
  const total = collected + outstanding + waived || 1;

  const termLabel = termFilter === 'all' ? 'This Term' : termFilter.replace('_', ' ');
  const now = lastUpdated ? new Date(lastUpdated) : new Date();
  const timeStr = now.toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-3">
      <CollapsibleSection
        title="Collection Summary"
        description="Expected, collected, outstanding and waived amounts."
        summary={`${termLabel} • ${fmt(collected)} collected`}
        tone="green"
      >
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <DonutChart collected={collected} outstanding={outstanding} waived={waived} total={total} />
          <div className="w-full min-w-0 flex-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
                  Collected
                </p>
                <p className="mt-1 text-sm font-black text-gray-900">{fmt(collected)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                  Outstanding
                </p>
                <p className="mt-1 text-sm font-black text-gray-900">{fmt(outstanding)}</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                  Waived / Discounted
                </p>
                <p className="mt-1 text-sm font-black text-gray-900">{fmt(waived)}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-[11px] font-medium text-gray-500">
                Total Expected: <span className="font-semibold text-gray-750">{fmt(total)}</span>
              </p>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Balances & Reminders"
        description="Filter unpaid and partial balances, then send payment reminders."
        summary={`${fmt(outstanding)} balance`}
        tone="amber"
      >
        <PaymentByGrade
          invoices={invoices}
          onSendReminders={onSendReminders}
          reminderLoading={reminderLoading}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Follow-up Actions"
        description="Accounts that need fee collection attention."
        summary={`${(analytics?.nothingPaid?.length || 0) + (analytics?.overdue30?.length || 0)} flagged`}
        tone="red"
      >
        <div className="divide-y divide-gray-50">
          {analytics?.nothingPaid?.length > 0 && (
            <AlertItem
              icon={Users}
              iconBg="bg-red-500"
              text={`${analytics.nothingPaid.length} students have not paid anything`}
              sub={`Total balance: ${fmt(analytics.nothingPaid.reduce((s, i) => s + Number(i.totalAmount || 0), 0))}`}
              onClick={() => onStatusFilter?.('pending')}
            />
          )}
          {analytics?.overdue30?.length > 0 && (
            <AlertItem
              icon={Clock}
              iconBg="bg-orange-500"
              text={`${fmt(analytics.overdue30.reduce((s, i) => s + Number(i.balance || 0), 0))} overdue by 30+ days`}
              sub={`From ${analytics.overdue30.length} students`}
              onClick={() => onNavigateToInvoices?.()}
            />
          )}
          {analytics?.bestGrade && analytics?.worstGrade && analytics.bestGrade.grade !== analytics.worstGrade.grade && (
            <AlertItem
              icon={TrendingDown}
              iconBg="bg-amber-500"
              text={`${analytics.worstGrade.grade} collection rate only ${analytics.worstGrade.rate}%`}
              sub="Below school average"
              onClick={() => onNavigateToInvoices?.()}
            />
          )}
          {analytics?.withPledges?.length > 0 && (
            <AlertItem
              icon={Calendar}
              iconBg="bg-blue-500"
              text={`${analytics.withPledges.length} fee promises due this week`}
              sub={`Total amount: ${fmt(analytics.dueSoonPledges)}`}
              onClick={() => onNavigateToInvoices?.()}
            />
          )}
          {analytics?.needReminders?.length > 0 && (
            <AlertItem
              icon={MessageSquare}
              iconBg="bg-violet-500"
              text={`${analytics.needReminders.length} parents need reminders`}
              sub="SMS not sent"
              onClick={() => onNavigateToInvoices?.()}
            />
          )}
          {!analytics?.nothingPaid?.length && !analytics?.overdue30?.length && (
            <div className="py-6 text-center">
              <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
              <p className="text-xs font-medium text-gray-500">All clear! No urgent actions.</p>
            </div>
          )}
        </div>
        <button
          onClick={() => onNavigateToInvoices?.()}
          className="mt-3 flex w-full items-center justify-center gap-1 text-center text-xs font-semibold text-red-600 transition-colors hover:text-red-700"
        >
          View All Alerts <ChevronRight size={12} />
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        title="Performance Insights"
        description="Collection trends and high-priority fee signals."
        summary={analytics?.bestGrade ? `${analytics.bestGrade.grade} leading` : 'No insights'}
        tone="blue"
      >
        <div className="flex flex-wrap gap-3">
          {analytics?.bestGrade && (
            <InsightCard
              icon={Trophy}
              iconBg="bg-emerald-500"
              label="Best Collecting Class"
              value={analytics.bestGrade.grade}
              sub={`${analytics.bestGrade.rate}% Collection Rate`}
              valueColor="text-emerald-600"
            />
          )}
          {analytics?.worstGrade && analytics.worstGrade.grade !== analytics?.bestGrade?.grade && (
            <InsightCard
              icon={Frown}
              iconBg="bg-red-500"
              label="Lowest Collecting Class"
              value={analytics.worstGrade.grade}
              sub={`${analytics.worstGrade.rate}% Collection Rate`}
              valueColor="text-red-600"
            />
          )}
          {analytics?.largestOutstanding && (
            <InsightCard
              icon={AlertCircle}
              iconBg="bg-amber-500"
              label="Largest Outstanding"
              value={fmt(analytics.largestOutstanding.balance)}
              sub={`${analytics.largestOutstanding.name} (${analytics.largestOutstanding.grade})`}
              valueColor="text-amber-600"
            />
          )}
          <InsightCard
            icon={Target}
            iconBg="bg-blue-500"
            label="Expected This Week"
            value={fmt(analytics?.dueSoonPledges || 0)}
            sub="From promises & history"
            valueColor="text-blue-600"
          />
        </div>
      </CollapsibleSection>

      {/* ── Footer bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
        <span className="flex items-center gap-1">
          <CheckCircle size={12} className="text-gray-300" />
          All amounts are in Kenyan Shillings (KES)
        </span>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 hover:text-gray-600 transition-colors"
        >
          Last updated: {timeStr} <RefreshCw size={11} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
}

/* ─── Legend row helper ────────────────────────────────────────────────── */
function LegendRow({ color, label, value, pct }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
      <span className="text-xs text-gray-600 flex-1">{label}</span>
      <span className="text-xs font-semibold text-gray-800">{value}</span>
      <span className="text-[10px] text-gray-400 w-8 text-right">({pct}%)</span>
    </div>
  );
}

/* ─── Named section exports for horizontal nav routing ─────────────────── */

/**
 * Shared hook for the analytics derived from invoices.
 * Re-used by every standalone section component.
 */
function useFeeAnalytics(invoices) {
  return useMemo(() => {
    if (!invoices?.length) return null;
    const src = invoices;
    const gradeMap = {};
    src.forEach(inv => {
      const g = inv?.learner?.grade || 'Unknown';
      if (!gradeMap[g]) gradeMap[g] = { grade: g, count: 0, collected: 0, billed: 0 };
      gradeMap[g].count++;
      gradeMap[g].billed += Number(inv.totalAmount || 0);
      if (inv.payments?.length) {
        gradeMap[g].collected += inv.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      } else {
        gradeMap[g].collected += Number(inv.paidAmount || 0);
      }
    });
    const grades = Object.values(gradeMap).map(g => ({
      ...g,
      rate: g.billed > 0 ? Math.round((g.collected / g.billed) * 100) : 0,
    }));
    const bestGrade = [...grades].sort((a, b) => b.rate - a.rate)[0];
    const worstGrade = [...grades].sort((a, b) => a.rate - b.rate)[0];
    const studentsWithBalance = src
      .map(inv => {
        const balance = Number(inv.balance || 0) || Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0));
        return { name: inv?.learner?.name || 'Unknown', grade: inv?.learner?.grade || '', balance };
      })
      .filter(s => s.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    const largestOutstanding = studentsWithBalance[0];
    const nothingPaid = src.filter(i => Number(i.paidAmount || 0) === 0);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const overdue30 = src.filter(i => {
      const due = i.dueDate ? new Date(i.dueDate) : null;
      return due && due < thirtyDaysAgo && Number(i.balance || 0) > 0;
    });
    const withPledges = src.filter(i => (i.pledges || []).some(p => p.status === 'PENDING' || p.status === 'DUE'));
    const pledgeAmount = withPledges.reduce((s, i) =>
      s + (i.pledges || []).filter(p => p.status === 'PENDING' || p.status === 'DUE').reduce((ss, p) => ss + Number(p.pledgedAmount || 0), 0), 0);
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
    const dueSoonPledges = src.reduce((s, i) =>
      s + (i.pledges || []).filter(p => {
        const d = p.pledgeDate ? new Date(p.pledgeDate) : null;
        return (p.status === 'PENDING' || p.status === 'DUE') && d && d <= nextWeek;
      }).reduce((ss, p) => ss + Number(p.pledgedAmount || 0), 0), 0);
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const needReminders = src.filter(i => {
      const lastPay = i.payments?.reduce((latest, p) => {
        const d = new Date(p.paymentDate || p.createdAt || p.paidAt || 0);
        return d > latest ? d : latest;
      }, new Date(0));
      const hasBalance = Number(i.balance || 0) > 0 || Number(i.totalAmount || 0) > Number(i.paidAmount || 0);
      return hasBalance && (!lastPay || lastPay < twoWeeksAgo);
    });
    return { bestGrade, worstGrade, largestOutstanding, nothingPaid, overdue30, withPledges, pledgeAmount, dueSoonPledges, needReminders };
  }, [invoices]);
}

/** Collection Summary section */
export function FeeCollectionSummaryPage({ stats, invoices, statsLoading, termFilter, onRefresh, lastUpdated }) {
  if (statsLoading) return <div className="rounded-2xl bg-gray-100 animate-pulse h-56" />;
  const collected = stats?.actualCollectedRaw || 0;
  const outstanding = Math.max(0, (stats?.totalBilledRaw || 0) - collected - (stats?.waivedTotalRaw || 0));
  const waived = stats?.waivedTotalRaw || 0;
  const total = collected + outstanding + waived || 1;
  const termLabel = termFilter === 'all' ? 'This Term' : termFilter?.replace('_', ' ');
  const now = lastUpdated ? new Date(lastUpdated) : new Date();
  const timeStr = now.toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Collection Summary</h2>
          <p className="text-xs text-gray-400 mt-0.5">Expected, collected, outstanding and waived amounts.</p>
        </div>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw size={11} /> Last updated: {timeStr}
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-4">{termLabel} · {fmt(collected)} collected</p>
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <DonutChart collected={collected} outstanding={outstanding} waived={waived} total={total} />
          <div className="w-full min-w-0 flex-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />Collected</p>
                <p className="mt-1 text-sm font-black text-gray-900">{fmt(collected)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-700"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />Outstanding</p>
                <p className="mt-1 text-sm font-black text-gray-900">{fmt(outstanding)}</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-blue-700"><span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />Waived / Discounted</p>
                <p className="mt-1 text-sm font-black text-gray-900">{fmt(waived)}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-[11px] font-medium text-gray-500">Total Expected: <span className="font-semibold text-gray-700">{fmt(total)}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Balances & Reminders section */
export function FeeBalancesPage({ invoices, stats, statsLoading, onSendReminders, reminderLoading }) {
  if (statsLoading) return <div className="rounded-2xl bg-gray-100 animate-pulse h-56" />;
  const outstanding = Math.max(0, (stats?.totalBilledRaw || 0) - (stats?.actualCollectedRaw || 0) - (stats?.waivedTotalRaw || 0));
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Balances &amp; Reminders</h2>
        <p className="text-xs text-gray-400 mt-0.5">Filter unpaid and partial balances, then send payment reminders.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-4">{fmt(outstanding)} balance</p>
        <PaymentByGrade invoices={invoices} onSendReminders={onSendReminders} reminderLoading={reminderLoading} />
      </div>
    </div>
  );
}

/** Follow-up Actions section */
export function FeeFollowupPage({ invoices, statsLoading, onNavigateToInvoices, onStatusFilter }) {
  const analytics = useFeeAnalytics(invoices);
  if (statsLoading) return <div className="rounded-2xl bg-gray-100 animate-pulse h-56" />;
  const flagCount = (analytics?.nothingPaid?.length || 0) + (analytics?.overdue30?.length || 0);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Follow-up Actions</h2>
        <p className="text-xs text-gray-400 mt-0.5">Accounts that need fee collection attention.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-4">{flagCount} flagged</p>
        <div className="divide-y divide-gray-50">
          {analytics?.nothingPaid?.length > 0 && <AlertItem icon={Users} iconBg="bg-red-500" text={`${analytics.nothingPaid.length} students have not paid anything`} sub={`Total balance: ${fmt(analytics.nothingPaid.reduce((s, i) => s + Number(i.totalAmount || 0), 0))}`} onClick={() => onStatusFilter?.('pending')} />}
          {analytics?.overdue30?.length > 0 && <AlertItem icon={Clock} iconBg="bg-orange-500" text={`${fmt(analytics.overdue30.reduce((s, i) => s + Number(i.balance || 0), 0))} overdue by 30+ days`} sub={`From ${analytics.overdue30.length} students`} onClick={() => onNavigateToInvoices?.()} />}
          {analytics?.bestGrade && analytics?.worstGrade && analytics.bestGrade.grade !== analytics.worstGrade.grade && <AlertItem icon={TrendingDown} iconBg="bg-amber-500" text={`${analytics.worstGrade.grade} collection rate only ${analytics.worstGrade.rate}%`} sub="Below school average" onClick={() => onNavigateToInvoices?.()} />}
          {analytics?.withPledges?.length > 0 && <AlertItem icon={Calendar} iconBg="bg-blue-500" text={`${analytics.withPledges.length} fee promises due this week`} sub={`Total amount: ${fmt(analytics.dueSoonPledges)}`} onClick={() => onNavigateToInvoices?.()} />}
          {analytics?.needReminders?.length > 0 && <AlertItem icon={MessageSquare} iconBg="bg-violet-500" text={`${analytics.needReminders.length} parents need reminders`} sub="SMS not sent" onClick={() => onNavigateToInvoices?.()} />}
          {!analytics?.nothingPaid?.length && !analytics?.overdue30?.length && (
            <div className="py-6 text-center"><CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" /><p className="text-xs font-medium text-gray-500">All clear! No urgent actions.</p></div>
          )}
        </div>
        <button onClick={() => onNavigateToInvoices?.()} className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors">
          View All Alerts <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

/** Performance Insights section */
export function FeeInsightsPage({ invoices, stats, statsLoading }) {
  const analytics = useFeeAnalytics(invoices);
  if (statsLoading) return <div className="rounded-2xl bg-gray-100 animate-pulse h-56" />;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Performance Insights</h2>
        <p className="text-xs text-gray-400 mt-0.5">Collection trends and high-priority fee signals.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-4">{analytics?.bestGrade ? `${analytics.bestGrade.grade} leading` : 'No insights yet'}</p>
        <div className="flex flex-wrap gap-3">
          {analytics?.bestGrade && <InsightCard icon={Trophy} iconBg="bg-emerald-500" label="Best Collecting Class" value={analytics.bestGrade.grade} sub={`${analytics.bestGrade.rate}% Collection Rate`} valueColor="text-emerald-600" />}
          {analytics?.worstGrade && analytics.worstGrade.grade !== analytics?.bestGrade?.grade && <InsightCard icon={Frown} iconBg="bg-red-500" label="Lowest Collecting Class" value={analytics.worstGrade.grade} sub={`${analytics.worstGrade.rate}% Collection Rate`} valueColor="text-red-600" />}
          {analytics?.largestOutstanding && <InsightCard icon={AlertCircle} iconBg="bg-amber-500" label="Largest Outstanding" value={fmt(analytics.largestOutstanding.balance)} sub={`${analytics.largestOutstanding.name} (${analytics.largestOutstanding.grade})`} valueColor="text-amber-600" />}
          <InsightCard icon={Target} iconBg="bg-blue-500" label="Expected This Week" value={fmt(analytics?.dueSoonPledges || 0)} sub="From promises & history" valueColor="text-blue-600" />
          {stats && (
            <InsightCard icon={Zap} iconBg="bg-violet-500" label="Collection Efficiency" value={stats.collectionEfficiency || '0%'} sub="Net of waivers" valueColor="text-violet-600" />
          )}
        </div>
      </div>
    </div>
  );
}
