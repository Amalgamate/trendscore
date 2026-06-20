/**
 * FeeOverviewDashboard
 * A rich analytics dashboard for the Fee Overview tab.
 * Displays: collection progress donut, weekly trend chart, attention alerts,
 * payment channel breakdown, and top insights.
 */

import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingDown, AlertTriangle, AlertCircle, Clock,
  Users, ChevronRight, RefreshCw, Trophy, Award, Frown,
  Calendar, MessageSquare, Smartphone, Banknote, Building2,
  CreditCard, CheckCircle, ArrowRight, Target, Zap, Star
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
function PaymentByGrade({ invoices }) {
  const gradeRows = useMemo(() => {
    const map = {};
    (invoices || []).forEach(inv => {
      const g = inv?.learner?.grade || 'Unknown';
      if (!map[g]) map[g] = { paid: 0, partial: 0, unpaid: 0, total: 0 };
      const billed  = Number(inv.totalAmount || 0);
      const paidAmt = inv.payments?.length
        ? inv.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
        : Number(inv.paidAmount || 0);
      const balance = Math.max(0, billed - paidAmt);
      map[g].total++;
      if (paidAmt <= 0)      map[g].unpaid++;
      else if (balance <= 0) map[g].paid++;
      else                   map[g].partial++;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([grade, counts]) => ({
        grade,
        ...counts,
        paidRate: counts.total > 0 ? Math.round((counts.paid / counts.total) * 100) : 0,
      }));
  }, [invoices]);

  const totals = gradeRows.reduce(
    (acc, row) => ({
      paid: acc.paid + row.paid,
      partial: acc.partial + row.partial,
      unpaid: acc.unpaid + row.unpaid,
      total: acc.total + row.total,
    }),
    { paid: 0, partial: 0, unpaid: 0, total: 0 }
  );

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-600">
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{totals.paid} paid</span>
        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{totals.partial} partial</span>
        <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">{totals.unpaid} unpaid</span>
        <span className="ml-auto text-gray-400">{totals.total} students</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100 text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Grade</th>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Paid</th>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">Partial</th>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-600">Unpaid</th>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {gradeRows.length > 0 ? gradeRows.map(row => (
              <tr key={row.grade} className="hover:bg-gray-50/70">
                <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-gray-900">{row.grade}</td>
                <td className="px-3 py-2 text-xs font-semibold text-emerald-700">{row.paid}</td>
                <td className="px-3 py-2 text-xs font-semibold text-amber-700">{row.partial}</td>
                <td className="px-3 py-2 text-xs font-semibold text-red-700">{row.unpaid}</td>
                <td className="min-w-[110px] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${row.paidRate}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-[11px] font-bold text-gray-700">{row.paidRate}%</span>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-6 text-center text-xs font-medium text-gray-400" colSpan={5}>
                  No grade payment data available.
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

/* ─── Payment channel bar ─────────────────────────────────────────────── */
function ChannelBar({ label, pct, color, icon: Icon }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        <Icon size={12} className="text-gray-400" />
        <span className="text-xs text-gray-600 font-medium">{label}</span>
      </div>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{Math.round(pct)}%</span>
    </div>
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

    // Payment channel totals (raw)
    let mpesaRaw = 0, cashRaw = 0, bankRaw = 0, chequeRaw = 0;
    src.forEach(inv => {
      if (inv.payments?.length) {
        inv.payments.forEach(p => {
          const amt = Number(p.amount || 0);
          const m = String(p.paymentMethod || '').toUpperCase();
          if (m === 'MPESA') mpesaRaw += amt;
          else if (m === 'CASH') cashRaw += amt;
          else if (m === 'BANK_TRANSFER') bankRaw += amt;
          else if (m === 'CHEQUE') chequeRaw += amt;
        });
      } else {
        const amt = Number(inv.paidAmount || 0);
        const m = String(inv.paymentMethod || '').toUpperCase();
        if (m === 'MPESA') mpesaRaw += amt;
        else if (m === 'CASH') cashRaw += amt;
        else if (m === 'BANK_TRANSFER') bankRaw += amt;
        else if (m === 'CHEQUE') chequeRaw += amt;
        else mpesaRaw += amt; // default
      }
    });
    const channelTotal = mpesaRaw + cashRaw + bankRaw + chequeRaw || 1;

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
      channels: {
        mpesa: { raw: mpesaRaw, pct: (mpesaRaw / channelTotal) * 100 },
        cash: { raw: cashRaw, pct: (cashRaw / channelTotal) * 100 },
        bank: { raw: bankRaw, pct: (bankRaw / channelTotal) * 100 },
        cheque: { raw: chequeRaw, pct: (chequeRaw / channelTotal) * 100 },
      },
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
    <div className="space-y-4">

      {/* ── ROW 1: Donut | Trend | Alerts ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Collection Progress donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Collection Progress</h3>
            <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{termLabel}</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <DonutChart collected={collected} outstanding={outstanding} waived={waived} total={total} />
            <div className="flex-1 min-w-0 w-full">
              <div className="space-y-2.5">
                {/* Collected */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shrink-0" />
                    <span>Collected</span>
                  </div>
                  <div className="text-xs font-bold text-gray-900" style={{ paddingLeft: '18px' }}>
                    {fmt(collected)}
                  </div>
                </div>

                {/* Outstanding */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                    <span>Outstanding</span>
                  </div>
                  <div className="text-xs font-bold text-gray-900" style={{ paddingLeft: '18px' }}>
                    {fmt(outstanding)}
                  </div>
                </div>

                {/* Waived / Discounted */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] shrink-0" />
                    <span>Waived / Discounted</span>
                  </div>
                  <div className="text-xs font-bold text-gray-900" style={{ paddingLeft: '18px' }}>
                    {fmt(waived)}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 mt-3">
                <p className="text-[11px] text-gray-500 font-medium">Total Expected: <span className="font-semibold text-gray-750">{fmt(total)}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment by Grade */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Payment by Grade</h3>
            <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
              {termLabel}
            </span>
          </div>
          <PaymentByGrade invoices={invoices} />
        </div>

        {/* Attention Required alerts */}
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-red-500" /> Attention Required
            </h3>
          </div>
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
                <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-medium">All clear! No urgent actions.</p>
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigateToInvoices?.()}
            className="mt-3 w-full text-center text-xs font-semibold text-red-600 hover:text-red-700 flex items-center justify-center gap-1 transition-colors"
          >
            View All Alerts <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* ── ROW 2: Payment Channels | Top Insights ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Payment channels */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Payment Channels</h3>
          <div className="space-y-3">
            <ChannelBar label="M-Pesa" pct={analytics?.channels.mpesa.pct || 0} color="linear-gradient(to right,#16a34a,#4ade80)" icon={Smartphone} />
            <ChannelBar label="Cash" pct={analytics?.channels.cash.pct || 0} color="linear-gradient(to right,#2563eb,#60a5fa)" icon={Banknote} />
            <ChannelBar label="Bank Transfer" pct={analytics?.channels.bank.pct || 0} color="linear-gradient(to right,#7c3aed,#a78bfa)" icon={Building2} />
            <ChannelBar label="Cheque" pct={analytics?.channels.cheque.pct || 0} color="linear-gradient(to right,#0891b2,#67e8f9)" icon={CreditCard} />
          </div>
          <p className="text-[10px] text-gray-400 mt-4">Based on collections {termLabel.toLowerCase()}</p>
        </div>

        {/* Top insights */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Top Insights</h3>
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
        </div>
      </div>

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
