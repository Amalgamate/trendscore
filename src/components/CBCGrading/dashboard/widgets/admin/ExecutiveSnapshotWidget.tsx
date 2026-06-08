import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, DollarSign, CreditCard } from 'lucide-react';
import { dashboardAPI } from '../../../../../services/api';
import { DashboardSummaryCard } from '../../../pages/dashboard/DashboardSummary';

/**
 * Executive Snapshot — 4 flat-color stat cards.
 *
 * Each card uses the chips[] prop to show a two-item breakdown row at the bottom:
 *   Students  →  Males / Females
 *   Staff     →  Active / On Leave
 *   Fees      →  Collected / Outstanding
 *   Expenses  →  This Month / This Term
 */
const ExecutiveSnapshotWidget = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await dashboardAPI.getAdminMetrics('term');
        if (res?.success) setMetrics(res.data);
      } catch (e) {
        console.error('[ExecutiveSnapshotWidget]', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const s = metrics?.stats ?? {};
  const fin = metrics?.financials ?? {};

  const fmt = (v: number) => {
    if (!v) return 'KES 0';
    if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}k`;
    return `KES ${v.toLocaleString()}`;
  };

  const collectionRate = s.feeCollected && s.feePending
    ? Math.round((s.feeCollected / (s.feeCollected + s.feePending)) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">

      {/* ── Card 1: Students ── */}
      <DashboardSummaryCard
        label="Total Students"
        value={(s.totalStudents ?? 0).toLocaleString()}
        subvalue={`${s.activeStudents ?? 0} active`}
        trend={s.studentTrend?.startsWith('+') ? 'up' : 'down'}
        trendValue={s.studentTrend}
        chips={[
          { value: s.males   ?? 0, label: 'Male',   dot: '#38bdf8' },
          { value: s.females ?? 0, label: 'Female',  dot: '#f9a8d4' },
        ]}
        icon={<Users />}
        tone="navy"
      />

      {/* ── Card 2: Staff ── */}
      <DashboardSummaryCard
        label="Teaching Staff"
        value={(s.totalTeachers ?? 0).toLocaleString()}
        subvalue={`${s.activeTeachers ?? s.totalTeachers ?? 0} active`}
        chips={[
          { value: s.activeTeachers ?? 0,  label: 'Present',  dot: '#86efac' },
          { value: s.staffOnLeave   ?? 0,  label: 'On Leave', dot: '#fde047' },
        ]}
        icon={<GraduationCap />}
        tone="teal"
      />

      {/* ── Card 3: Fee Collection ── */}
      <DashboardSummaryCard
        label="Fee Collection"
        value={`${collectionRate}%`}
        subvalue={collectionRate >= 75 ? '↑ On target' : '↓ Below target'}
        chips={[
          { value: fmt(s.feeCollected ?? 0), label: 'Collected',   dot: '#86efac' },
          { value: fmt(s.feePending   ?? 0), label: 'Outstanding', dot: '#fca5a5' },
        ]}
        icon={<DollarSign />}
        tone="red"
      />

      {/* ── Card 4: Expenses ── */}
      <DashboardSummaryCard
        label="School Expenses"
        value={fmt(fin.totalExpenses ?? 0)}
        subvalue="This term"
        chips={[
          { value: fmt(fin.expensesSummary?.today     ?? 0), label: 'Today',      dot: '#c4b5fd' },
          { value: fmt(fin.expensesSummary?.thisMonth ?? 0), label: 'This Month', dot: '#67e8f9' },
        ]}
        icon={<CreditCard />}
        tone="green"
      />

    </div>
  );
};

export default ExecutiveSnapshotWidget;
