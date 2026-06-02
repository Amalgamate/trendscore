import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileText,
  Landmark,
  LineChart,
  PiggyBank,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import api from '../../../../services/api';

const KES = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

const compactKes = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000) return `KES ${(amount / 1_000).toFixed(0)}K`;
  return KES.format(amount).replace('Ksh', 'KES');
};

const numberFormat = new Intl.NumberFormat('en-KE');

const feeColors = ['#5b21ff', '#10b981', '#f59e0b', '#cbd5e1', '#0ea5e9'];

const comparisonLabel = (comparison, suffix = '%') => {
  if (!comparison || comparison.value === null) return 'No previous term data';
  const sign = comparison.value > 0 ? '+' : '';
  return `${sign}${comparison.value}${suffix} vs previous term`;
};

const timeAgo = (dateValue) => {
  const then = new Date(dateValue).getTime();
  if (!then) return '';
  const minutes = Math.max(1, Math.floor((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const EmptyState = ({ title, description }) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
      <BarChart3 size={18} className="text-slate-400" />
    </div>
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 max-w-xs text-xs font-normal text-slate-500">{description}</p>
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-5 p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="h-10 w-80 animate-pulse rounded-lg bg-slate-100" />
    </div>
    <div className="grid grid-cols-5 gap-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-36 animate-pulse rounded-lg border border-slate-100 bg-white" />
      ))}
    </div>
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-6 h-80 animate-pulse rounded-lg border border-slate-100 bg-white" />
      <div className="col-span-3 h-80 animate-pulse rounded-lg border border-slate-100 bg-white" />
      <div className="col-span-3 h-80 animate-pulse rounded-lg border border-slate-100 bg-white" />
    </div>
  </div>
);

const FinanceKpiCard = ({ title, value, context, comparison, icon: Icon, tone = 'purple', isRate = false }) => {
  const toneMap = {
    purple: 'bg-violet-600 text-white',
    green: 'bg-emerald-600 text-white',
    orange: 'bg-orange-500 text-white',
    red: 'bg-rose-600 text-white',
    navy: 'bg-indigo-700 text-white',
  };
  const isPositive = comparison?.direction !== 'down';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">{isRate ? `${Number(value || 0).toFixed(1)}%` : compactKes(value)}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{context}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneMap[tone]}`}>
          <Icon size={21} />
        </div>
      </div>
      <p className={`mt-5 text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
        {comparisonLabel(comparison, isRate ? ' pp' : '%')}
      </p>
    </div>
  );
};

const Card = ({ title, action, children, className = '' }) => (
  <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${className}`}>
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-base font-extrabold text-slate-950">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const CollectionTrendChart = ({ data }) => {
  if (!data?.some((item) => item.expected || item.collected)) {
    return <EmptyState title="No collection trend yet" description="Invoices and confirmed payments will appear here by week once recorded." />;
  }
  return (
    <div className="h-[300px]">
      <div className="mb-3 flex items-center gap-5 text-xs font-semibold text-slate-600">
        <span className="flex items-center gap-2"><span className="h-0.5 w-6 bg-violet-600" /> Collected</span>
        <span className="flex items-center gap-2"><span className="h-0.5 w-6 border-t border-dashed border-slate-500" /> Expected</span>
      </div>
      <ResponsiveContainer width="100%" height="92%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="collectedFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#5b21ff" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#5b21ff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => `${Math.round(value / 1000000)}M`} tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => compactKes(value)} />
          <Area type="monotone" dataKey="expected" stroke="#94a3b8" strokeDasharray="5 5" fill="transparent" strokeWidth={2} />
          <Area type="monotone" dataKey="collected" stroke="#5b21ff" fill="url(#collectedFill)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const FeeBreakdownChart = ({ data, total }) => {
  if (!data?.length) {
    return <EmptyState title="No fee mix available" description="The breakdown will populate after payments are allocated to fee structures." />;
  }
  return (
    <div className="grid grid-cols-[170px_1fr] items-center gap-4">
      <div className="relative h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={58} outerRadius={92} paddingAngle={1} dataKey="value">
              {data.map((entry, index) => <Cell key={entry.name} fill={feeColors[index % feeColors.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => compactKes(value)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-extrabold text-slate-950">{compactKes(total)}</p>
          <p className="text-xs font-medium text-slate-500">Collected</p>
        </div>
      </div>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={item.name} className="grid grid-cols-[1fr_46px_74px] items-center gap-3 text-xs">
            <span className="flex items-center gap-2 font-bold text-slate-700">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: feeColors[index % feeColors.length] }} />
              {item.name}
            </span>
            <span className="text-right font-semibold text-slate-500">{Number(item.percentage || 0).toFixed(1)}%</span>
            <span className="text-right font-bold text-slate-800">{compactKes(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TopOutstandingClassesCard = ({ data, onNavigate }) => {
  if (!data?.length) {
    return <EmptyState title="No outstanding classes" description="Classes with unpaid balances will be ranked here." />;
  }
  const max = Math.max(...data.map((item) => item.outstanding), 1);
  return (
    <div>
      <div className="grid grid-cols-[1fr_130px_70px] border-b border-slate-200 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
        <span>Class</span><span>Outstanding</span><span className="text-right">Students</span>
      </div>
      <div className="divide-y divide-slate-100">
        {data.map((row) => (
          <div key={row.className} className="grid grid-cols-[1fr_130px_70px] items-center py-3 text-xs">
            <span className="font-bold text-slate-800">{row.className}</span>
            <span>
              <span className="font-extrabold text-slate-950">{compactKes(row.outstanding)}</span>
              <span className="mt-1 block h-1 rounded-full bg-slate-200">
                <span className="block h-1 rounded-full bg-rose-500" style={{ width: `${Math.max(8, (row.outstanding / max) * 100)}%` }} />
              </span>
            </span>
            <span className="text-right font-bold text-slate-800">{row.students}</span>
          </div>
        ))}
      </div>
      <button onClick={() => onNavigate?.('fees-reports')} className="mt-3 text-xs font-extrabold text-violet-700">
        View all outstanding classes
      </button>
    </div>
  );
};

const AgingAnalysisCard = ({ data }) => {
  if (!data?.some((item) => item.amount > 0)) {
    return <EmptyState title="No unpaid aging exposure" description="Outstanding balances will be grouped by invoice due date age." />;
  }
  const colors = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#b91c1c'];
  return (
    <div>
      <div className="grid grid-cols-5 gap-4">
        {data.map((item, index) => (
          <div key={item.key} className="border-r border-slate-200 last:border-r-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: colors[index] }}>{item.label}</p>
            <p className="mt-4 text-base font-extrabold text-slate-950">{compactKes(item.amount)}</p>
            <p className="mt-3 text-xs font-bold text-slate-500">{Number(item.percentage || 0).toFixed(1)}%</p>
          </div>
        ))}
      </div>
      <div className="mt-12 flex h-4 overflow-hidden rounded-sm">
        {data.map((item, index) => (
          <span key={item.key} style={{ width: `${Math.max(item.percentage, item.amount > 0 ? 2 : 0)}%`, backgroundColor: colors[index] }} />
        ))}
      </div>
    </div>
  );
};

const RecentTransactionsCard = ({ data, onNavigate }) => {
  const iconForType = (type) => {
    if (type === 'payment_received') return { icon: ArrowDownCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', amount: 'text-emerald-700' };
    if (type === 'invoice_created') return { icon: ArrowUpCircle, color: 'text-rose-600', bg: 'bg-rose-50', amount: 'text-rose-700' };
    return { icon: ShieldAlert, color: 'text-orange-600', bg: 'bg-orange-50', amount: 'text-orange-700' };
  };
  if (!data?.length) {
    return <EmptyState title="No recent finance activity" description="Payments, invoices, waivers, refunds, and deposits will appear here." />;
  }
  return (
    <div>
      <div className="-mt-9 mb-2 flex justify-end">
        <button onClick={() => onNavigate?.('fees-collection')} className="text-xs font-extrabold text-violet-700">View All</button>
      </div>
      <div className="divide-y divide-slate-100">
        {data.map((item) => {
          const meta = iconForType(item.type);
          const Icon = meta.icon;
          return (
            <div key={item.id} className="grid grid-cols-[34px_1fr_auto] items-center gap-3 py-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${meta.bg} ${meta.color}`}>
                <Icon size={17} />
              </span>
              <span>
                <span className="block text-xs font-extrabold text-slate-900">{item.title}</span>
                <span className="block text-xs font-semibold text-slate-500">{item.reference}{item.className ? ` - ${item.className}` : ''}</span>
              </span>
              <span className="text-right">
                <span className={`block text-xs font-extrabold ${meta.amount}`}>{compactKes(item.amount)}</span>
                <span className="block text-[11px] font-semibold text-slate-400">{timeAgo(item.createdAt)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BankAccountSummaryCard = ({ data, onNavigate }) => {
  const accounts = data?.length ? data : [];
  const total = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  if (!accounts.length) {
    return <EmptyState title="No bank accounts configured" description="Cash and bank accounts from the chart of accounts will show here after setup." />;
  }
  return (
    <div>
      <div className="-mt-9 mb-3 flex justify-end">
        <button onClick={() => onNavigate?.('accounting-reconciliation')} className="text-xs font-extrabold text-violet-700">View Reconciliation</button>
      </div>
      <div className="rounded-lg border border-slate-200">
        {accounts.slice(0, 3).map((account, index) => (
          <div key={account.id} className="grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-slate-100 p-4 last:border-b-0">
            <span className={`flex h-8 w-8 items-center justify-center rounded-md ${index === 0 ? 'bg-violet-50 text-violet-700' : index === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
              <Landmark size={17} />
            </span>
            <span>
              <span className="block text-xs font-extrabold text-slate-900">{account.name}</span>
              <span className="block text-[11px] font-semibold text-slate-500">{account.bankName} - {account.accountNumber}</span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-extrabold text-slate-950">{compactKes(account.balance)}</span>
              <span className="block text-[11px] font-semibold text-slate-500">Available Balance</span>
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between p-4 text-sm font-extrabold text-violet-700">
          <span>Total Balance</span>
          <span>{compactKes(total)}</span>
        </div>
      </div>
    </div>
  );
};

const AccountantDashboard = ({ user, onNavigate }) => {
  const [term, setTerm] = useState('TERM_2');
  const [academicYear] = useState(2026);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.finance.getDashboardSummary({ term, academicYear });
      setSummary(response?.data || null);
    } catch (err) {
      setError(err?.message || 'Unable to load finance dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, academicYear]);

  const cards = useMemo(() => ([
    { title: 'Total Expected', value: summary?.expectedIncome, context: 'This Term', comparison: summary?.kpiComparison?.expectedIncome, icon: CircleDollarSign, tone: 'purple' },
    { title: 'Total Collected', value: summary?.totalCollected, context: 'This Term', comparison: summary?.kpiComparison?.totalCollected, icon: Receipt, tone: 'green' },
    { title: 'Outstanding Balance', value: summary?.outstandingBalance, context: 'From active invoices', comparison: summary?.kpiComparison?.outstandingBalance, icon: Wallet, tone: 'orange' },
    { title: 'Overdue Balance', value: summary?.overdueBalance, context: 'Past due invoices', comparison: summary?.kpiComparison?.overdueBalance, icon: ShieldAlert, tone: 'red' },
    { title: 'Collection Rate', value: summary?.collectionRate, context: 'This Term', comparison: summary?.kpiComparison?.collectionRate, icon: LineChart, tone: 'navy', isRate: true },
  ]), [summary]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto text-rose-600" size={34} />
          <h1 className="mt-4 text-lg font-extrabold text-slate-950">Finance dashboard failed to load</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">{error}</p>
          <button onClick={loadSummary} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-extrabold text-white">
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="finance-dashboard-scope min-h-full bg-[#f8fafc]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-7 py-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Finance Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-slate-600">Real-time overview of school financial health and performance</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="inline-flex h-11 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Junior School <ChevronDown size={15} />
          </button>
          <select
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-900"
          >
            <option value="TERM_1">Term 1, {academicYear}</option>
            <option value="TERM_2">Term 2, {academicYear}</option>
            <option value="TERM_3">Term 3, {academicYear}</option>
          </select>
          <button className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-900">
            <Bell size={19} />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white">5</span>
          </button>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase text-slate-950">{user?.name || 'Queen Lions'}</p>
            <p className="text-[11px] font-bold text-slate-500">Accountant</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-700 text-xs font-extrabold text-white">QL</div>
        </div>
      </header>

      <main className="space-y-5 p-7">
        <div className="grid grid-cols-5 gap-5">
          {cards.map((card) => <FinanceKpiCard key={card.title} {...card} />)}
        </div>

        <div className="grid grid-cols-12 gap-5">
          <Card
            title="Collection Trend"
            className="col-span-6"
            action={<button className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700">This Term <ChevronDown size={13} /></button>}
          >
            <CollectionTrendChart data={summary?.collectionTrend} />
          </Card>
          <Card title="Fee Collection Breakdown" className="col-span-3">
            <FeeBreakdownChart data={summary?.feeBreakdown} total={summary?.totalCollected} />
          </Card>
          <Card title="Top Outstanding Classes" className="col-span-3">
            <TopOutstandingClassesCard data={summary?.topOutstandingClasses} onNavigate={onNavigate} />
          </Card>
        </div>

        <div className="grid grid-cols-12 gap-5">
          <Card title={<span>Aging Analysis <span className="font-semibold text-slate-500">(Outstanding Balance)</span></span>} className="col-span-5">
            <AgingAnalysisCard data={summary?.agingAnalysis} />
          </Card>
          <Card title="Recent Transactions" className="col-span-4">
            <RecentTransactionsCard data={summary?.recentTransactions} onNavigate={onNavigate} />
          </Card>
          <Card title="Bank Account Summary" className="col-span-3">
            <BankAccountSummaryCard data={summary?.bankAccounts} onNavigate={onNavigate} />
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AccountantDashboard;
