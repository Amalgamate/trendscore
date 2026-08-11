import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Send,
  User,
  XCircle,
} from 'lucide-react';
import api from '../../../../services/api';
import usePageNavigation from '../../../../hooks/usePageNavigation';
import { useNotifications } from '../../hooks/useNotifications';
import Toast from '../../shared/Toast';
import { KpiCard } from '../../../../design-system/components';

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  DUE: 'bg-orange-50 text-orange-700 border-orange-200',
  FULFILLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  BROKEN: 'bg-rose-50 text-rose-700 border-rose-200',
};

const FILTERS = [
  { id: 'active', label: 'Active', status: 'ACTIVE', window: 'all' },
  { id: 'today', label: 'Due Today', status: 'ACTIVE', window: 'today' },
  { id: 'week', label: 'This Week', status: 'ACTIVE', window: 'this_week' },
  { id: 'overdue', label: 'Overdue', status: 'ACTIVE', window: 'overdue' },
  { id: 'upcoming', label: 'Upcoming', status: 'PENDING', window: 'upcoming' },
  { id: 'broken', label: 'Broken', status: 'BROKEN', window: 'all' },
  { id: 'fulfilled', label: 'Fulfilled', status: 'FULFILLED', window: 'all' },
  { id: 'all', label: 'All', status: 'ALL', window: 'all' },
];

const fmtMoney = (value) => `KES ${Number(value || 0).toLocaleString('en-KE')}`;
const fmtDate = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();

const daysUntil = (dateValue) => {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

const timelineLabel = (pledge) => {
  const days = daysUntil(pledge.pledgeDate);
  if (days === null) return 'No pledge date';
  if (pledge.status === 'FULFILLED') return 'Fulfilled';
  if (pledge.status === 'CANCELLED') return 'Cancelled';
  if (pledge.status === 'BROKEN') return 'Broken promise';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
};

const contactName = (learner) => {
  const parentName = fullName(learner?.parent);
  return learner?.guardianName || parentName || 'Parent/Guardian';
};

const contactPhone = (learner) => learner?.guardianPhone || learner?.parent?.phone || '-';

function StatCard({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const colors = { slate: 'indigo', amber: 'amber', orange: 'amber', rose: 'rose', emerald: 'emerald' };
  return <KpiCard label={label} value={value} subvalue={sub} icon={<Icon size={19} />} tone={colors[tone] || 'indigo'} orbPosition={tone === 'emerald' ? 'bottom-left' : 'top-right'} />;
}

const FeePledgesPage = () => {
  const navigateTo = usePageNavigation();
  const { showSuccess, showError, showInfo, showToast, toastMessage, toastType, hideNotification } = useNotifications();
  const [pledges, setPledges] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeFilter, setActiveFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [runningReminders, setRunningReminders] = useState(false);

  const selectedFilter = FILTERS.find((filter) => filter.id === activeFilter) || FILTERS[0];

  const loadPledges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.fees.listPledges({
        status: selectedFilter.status,
        window: selectedFilter.window,
        search,
        limit: 500,
      });
      setPledges(res.data?.pledges || []);
      setSummary(res.data?.summary || null);
    } catch (error) {
      showError(error.message || 'Failed to load pledges');
    } finally {
      setLoading(false);
    }
  }, [search, selectedFilter.status, selectedFilter.window, showError]);

  useEffect(() => {
    const timer = setTimeout(loadPledges, 250);
    return () => clearTimeout(timer);
  }, [loadPledges]);

  const automationRows = useMemo(() => {
    const dueToday = pledges.filter((pledge) => ['PENDING', 'DUE'].includes(pledge.status) && daysUntil(pledge.pledgeDate) === 0);
    const overdue = pledges.filter((pledge) => ['PENDING', 'DUE'].includes(pledge.status) && daysUntil(pledge.pledgeDate) < 0);
    const nextWeek = pledges.filter((pledge) => {
      const days = daysUntil(pledge.pledgeDate);
      return ['PENDING', 'DUE'].includes(pledge.status) && days >= 0 && days <= 7;
    });
    return [
      { label: 'Today reminder batch', value: `${dueToday.length} pledge${dueToday.length === 1 ? '' : 's'}`, hint: 'Cron marks due pledges and sends parent reminders once per day.' },
      { label: 'Escalation queue', value: `${overdue.length} overdue`, hint: 'Pledges older than 3 days become broken if the invoice is still unpaid.' },
      { label: 'This week follow-up', value: fmtMoney(nextWeek.reduce((sum, pledge) => sum + Number(pledge.pledgedAmount || 0), 0)), hint: 'Expected cash from promises due in the next 7 days.' },
    ];
  }, [pledges]);

  const handleFulfil = async (pledge) => {
    setProcessingId(pledge.id);
    try {
      await api.fees.fulfilPledge(pledge.id);
      showSuccess('Pledge marked as fulfilled');
      loadPledges();
    } catch (error) {
      showError(error.message || 'Failed to fulfil pledge');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (pledge) => {
    const reason = window.prompt('Reason for cancelling this pledge');
    if (reason === null) return;
    setProcessingId(pledge.id);
    try {
      await api.fees.cancelPledge(pledge.id, { reason });
      showInfo('Pledge cancelled');
      loadPledges();
    } catch (error) {
      showError(error.message || 'Failed to cancel pledge');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    try {
      await api.fees.runPledgeReminders();
      showSuccess('Pledge reminder automation completed');
      loadPledges();
    } catch (error) {
      showError(error.message || 'Failed to run pledge reminders');
    } finally {
      setRunningReminders(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
            <Bookmark size={13} />
            Pledge Management
          </div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Payment Promise Control Center</h2>
          <p className="text-sm text-slate-500">Track every parent promise, expected cash this week, and reminder automation status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadPledges}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleRunReminders}
            disabled={runningReminders}
            className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {runningReminders ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Run Due Reminders
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Bookmark} label="Active Pledges" value={summary?.active || 0} sub={fmtMoney(summary?.activeAmount)} tone="amber" />
        <StatCard icon={CalendarDays} label="Due This Week" value={summary?.thisWeek || 0} sub={fmtMoney(summary?.thisWeekAmount)} tone="orange" />
        <StatCard icon={AlertTriangle} label="Overdue Follow-ups" value={summary?.overdue || 0} sub={fmtMoney(summary?.overdueAmount)} tone="rose" />
        <StatCard icon={BellRing} label="Already Reminded" value={summary?.reminded || 0} sub="With reminder history" tone="emerald" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search learner, ADM, phone, invoice..."
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeFilter === filter.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Student', 'Pledge', 'Due Date', 'Contact', 'Reminder', 'Invoice', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td colSpan={7} className="px-4 py-4"><div className="h-4 w-2/3 rounded bg-slate-100" /></td>
                    </tr>
                  ))
                ) : pledges.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <Bookmark size={42} className="mx-auto text-slate-200" />
                      <p className="mt-3 text-sm font-semibold text-slate-700">No pledges match this view</p>
                      <p className="text-xs text-slate-400">Try another filter or search term.</p>
                    </td>
                  </tr>
                ) : pledges.map((pledge) => {
                  const learner = pledge.invoice?.learner;
                  const active = ['PENDING', 'DUE'].includes(pledge.status);
                  return (
                    <tr key={pledge.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-orange-700">
                            {learner?.firstName?.[0]}{learner?.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{fullName(learner)}</p>
                            <p className="text-xs text-slate-500">{learner?.admissionNumber} · {learner?.grade}{learner?.stream ? ` ${learner.stream}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-950">{fmtMoney(pledge.pledgedAmount)}</p>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[pledge.status] || STATUS_STYLES.PENDING}`}>
                          {pledge.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{fmtDate(pledge.pledgeDate)}</p>
                        <p className={`text-xs ${daysUntil(pledge.pledgeDate) < 0 && active ? 'text-rose-600' : 'text-slate-500'}`}>{timelineLabel(pledge)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{contactName(learner)}</p>
                            <p className="text-xs text-slate-500">{contactPhone(learner)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{pledge.reminderCount || 0} sent</p>
                        <p className="text-xs text-slate-500">{pledge.reminderSentAt ? fmtDate(pledge.reminderSentAt) : 'No reminder yet'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => navigateTo('fees-invoice-detail', { invoice: pledge.invoice })}
                          className="text-left"
                        >
                          <p className="text-sm font-semibold text-blue-700 hover:underline">{pledge.invoice?.invoiceNumber}</p>
                          <p className="text-xs text-slate-500">Balance {fmtMoney(pledge.invoice?.balance)}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigateTo('fees-invoice-detail', { invoice: pledge.invoice })}
                            className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-white hover:text-blue-700"
                            title="View invoice"
                          >
                            <FileText size={15} />
                          </button>
                          {active && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleFulfil(pledge)}
                                disabled={processingId === pledge.id}
                                className="rounded-md border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                title="Mark fulfilled"
                              >
                                {processingId === pledge.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(pledge)}
                                disabled={processingId === pledge.id}
                                className="rounded-md border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                title="Cancel pledge"
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <BellRing size={17} className="text-orange-600" />
              <h3 className="text-sm font-semibold text-slate-950">Reminder Automation</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              The server checks pledges daily, sends reminders for promises due today or overdue, marks paid invoices as fulfilled, and escalates unpaid promises older than 3 days to broken.
            </p>
            <div className="mt-4 space-y-3">
              {automationRows.map((row) => (
                <div key={row.label} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                    <Clock3 size={14} className="text-slate-400" />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{row.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{row.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h3 className="text-sm font-semibold text-orange-900">Suggested Operating Rhythm</h3>
            <div className="mt-3 space-y-3 text-xs leading-5 text-orange-900">
              <p><strong>Morning:</strong> run due reminders if the cron worker was offline.</p>
              <p><strong>Midday:</strong> call parents in the overdue queue and update broken promises.</p>
              <p><strong>Friday:</strong> review this week expected cash against actual payments.</p>
            </div>
          </div>
        </aside>
      </div>

      <Toast show={showToast} message={toastMessage} type={toastType} onClose={hideNotification} />
    </div>
  );
};

export default FeePledgesPage;
