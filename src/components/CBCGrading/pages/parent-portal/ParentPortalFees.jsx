/**
 * ParentPortalFees — Family Fees Management
 *
 * Parents choose a learner and an issued invoice before starting an invoice-bound
 * M-Pesa payment. Advance payments require a separate credit ledger workflow.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Receipt, ChevronDown, ChevronRight,
  Users, Wallet,
} from 'lucide-react';
import { dashboardAPI, feeAPI } from '../../../../services/api';
import { financeAPI } from '../../../../services/api/finance.api';
import { Skeleton } from '../../../ui';
import MpesaPaymentModal from '../../shared/MpesaPaymentModal';

const fmt    = (n) => Number(n || 0).toLocaleString();

function ParentPaymentHistory({ children, initialChildId, refreshKey = 0 }) {
  const [childId, setChildId] = useState(initialChildId || '');
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePayment, setActivePayment] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (selectedId) => {
    if (!selectedId) return;
    setLoading(true); setError('');
    try {
      const [invoiceResult, refundResult] = await Promise.all([
        feeAPI.getLearnerInvoices(selectedId),
        financeAPI.listRefunds({ limit: 100 }),
      ]);
      const invoices = invoiceResult?.data ?? invoiceResult ?? [];
      const refundRows = refundResult?.data ?? [];
      setRefunds(Array.isArray(refundRows) ? refundRows : []);
      setPayments((Array.isArray(invoices) ? invoices : []).flatMap((invoice) =>
        (invoice.payments || []).map((payment) => ({ ...payment, invoiceNumber: invoice.invoiceNumber, term: invoice.term, academicYear: invoice.academicYear }))
      ).sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)));
    } catch (e) { setError(e?.message || 'Could not load payment history. Please try again.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (initialChildId && !childId) setChildId(initialChildId);
  }, [initialChildId, childId]);

  useEffect(() => {
    if (childId) load(childId);
  }, [childId, refreshKey, load]);

  const submit = async (event) => {
    event.preventDefault();
    if (!activePayment || reason.trim().length < 5) { setError('Please explain the reason in at least 5 characters.'); return; }
    setSubmitting(true); setError(''); setNotice('');
    try {
      await financeAPI.submitRefund({ paymentId: activePayment.id, reason: reason.trim() });
      setNotice('Your refund request was sent to the school for review. You can follow its status here.');
      setActivePayment(null); setReason('');
      await load(childId);
    } catch (e) { setError(e?.message || 'We could not send your request. Please try again.'); }
    finally { setSubmitting(false); }
  };

  if (!children.length) return null;
  const refundByPayment = new Map(refunds.map((refund) => [refund.paymentId, refund]));
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 text-blue-800"><Receipt size={19} /></span>
      <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-slate-950">Payment history</h2><p className="text-xs text-slate-600">Review a payment or ask the school to review a refund.</p></div>
      <label className="relative"><span className="sr-only">Choose a child</span><select value={childId} onChange={(e) => { setChildId(e.target.value); setActivePayment(null); load(e.target.value); }} className="max-w-40 appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-slate-800"><option value="">Choose child</option>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" /></label>
    </div>
    {notice && <p role="status" className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</p>}
    {!childId ? <p className="px-4 py-5 text-sm text-slate-600">Choose a child to see completed payments.</p> : loading ? <p className="px-4 py-5 text-sm text-slate-600">Loading payments…</p> : payments.length ? <div className="divide-y divide-slate-200">{payments.map((payment) => {
      const refund = refundByPayment.get(payment.id);
      const canRequest = !refund && !payment.archived;
      return <div key={payment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-950">{payment.invoiceNumber || 'Fee payment'} · KES {fmt(payment.amount)}</p><p className="text-xs text-slate-600">{payment.paymentMethod} · {payment.receiptNumber || payment.referenceNumber || 'No receipt reference'} · {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : ''}</p></div>
        {refund ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Refund {String(refund.status).toLowerCase()}</span> : canRequest ? <button type="button" onClick={() => { setActivePayment(payment); setReason(''); setError(''); }} className="rounded-lg border border-blue-700 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50">Request review</button> : <span className="text-xs text-slate-500">Reversed</span>}
      </div>;
    })}</div> : <p className="px-4 py-5 text-sm text-slate-600">No payments recorded for this child yet.</p>}
    {activePayment && <form onSubmit={submit} className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">
      <div><h3 className="text-sm font-bold text-slate-950">Ask the school to review this payment</h3><p className="mt-1 text-xs text-slate-600">Payment KES {fmt(activePayment.amount)} · {activePayment.receiptNumber || activePayment.referenceNumber || 'No reference'}. The school will review it before any refund is processed.</p></div>
      <label className="block text-xs font-semibold text-slate-800">Reason<textarea required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" placeholder="Tell us what needs to be reviewed" /></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setActivePayment(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700">Cancel</button><button disabled={submitting} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Sending…' : 'Send request'}</button></div>
    </form>}
  </section>;
}

// ─── Family Fee Overview ──────────────────────────────────────────────────────

function FamilyFeeHeader({ children, loading }) {
  const totalBalance = children.reduce((s, c) => s + Number(c.feeBalance || 0), 0);
  const allCleared   = totalBalance === 0 && children.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${allCleared ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-800'}`}>
          {allCleared ? <CheckCircle2 size={21} /> : <Wallet size={21} />}
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Family fees · {children.length} linked child{children.length === 1 ? '' : 'ren'}</p>
          {loading ? <Skeleton className="mt-1 h-7 w-32" /> : <p className="text-xl font-extrabold text-slate-950">KES {fmt(totalBalance)} <span className="text-xs font-medium text-slate-500">outstanding</span></p>}
        </div>
      </div>
      <p className="text-xs text-slate-600">{allCleared ? 'All current invoices are cleared.' : 'Choose a child and invoice below to pay securely.'}</p>
    </div>
  );
}

function ChildInvoiceList({ child, invoices, loading, error, onPay, onRetry }) {
  if (!child) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-900">{child.name?.trim()?.[0] || '?'}</span>
        <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold text-slate-950">{child.name}</h2><p className="text-xs text-slate-600">{child.grade || 'Learner'} · issued fee invoices</p></div>
        <span className="text-sm font-bold text-slate-900">KES {fmt(child.feeBalance)}</span>
      </div>
      {loading ? <div className="px-4 py-5 text-sm text-slate-600">Loading invoices…</div> : error ? <div className="flex items-center justify-between gap-3 px-4 py-5"><p className="text-sm text-rose-800">{error}</p><button type="button" onClick={onRetry} className="shrink-0 text-xs font-bold text-blue-800 underline">Try again</button></div> : invoices.length ? (
        <div className="divide-y divide-slate-100">
          {invoices.map((invoice) => {
            const balance = Math.max(0, Number(invoice.balance ?? invoice.outstanding ?? 0));
            const termLabel = [invoice.term, invoice.academicYear].filter(Boolean).join(' · ') || 'School fees';
            return <div key={invoice.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{invoice.invoiceNumber || 'Fee invoice'} <span className="font-normal text-slate-600">· {termLabel}</span></p><p className="text-xs text-slate-600">Total KES {fmt(invoice.totalAmount)} · Paid KES {fmt(invoice.paidAmount)} · Balance <strong className="text-slate-900">KES {fmt(balance)}</strong></p>{invoice.dueDate && <p className="mt-0.5 text-[11px] text-slate-500">Due {new Date(invoice.dueDate).toLocaleDateString()}</p>}</div>
              {balance > 0 ? <button type="button" onClick={() => onPay(invoice)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#173FBF] px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"><Wallet size={16} /> Pay invoice</button> : <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Paid</span>}
            </div>;
          })}
        </div>
      ) : <div className="space-y-1 px-4 py-5"><p className="text-sm font-semibold text-slate-900">No fee invoice has been issued for this child yet.</p><p className="text-xs leading-5 text-slate-600">To pay toward a future term before an invoice exists, the school needs to support advance fee credits. This payment page currently accepts invoice-linked payments only. Contact the school office for an advance payment.</p></div>}
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ParentPortalFees = ({ user, onNavigate }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // M-Pesa payment modal state
  const [payingInvoice, setPayingInvoice]         = useState(null);
  const [showPaymentModal, setShowPaymentModal]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setChildren(res.data?.children || []);
      else setError(res?.message || 'Failed to load fee data');
    } catch (e) { setError(e?.message || 'Failed to load fee data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalBalance = children.reduce((s, c) => s + Number(c.feeBalance || 0), 0);
  const selectedChild = children.find((child) => String(child.id) === String(selectedChildId)) || null;

  const loadInvoices = useCallback(async (childId) => {
    if (!childId) { setInvoices([]); setInvoicesError(''); return; }
    setInvoicesLoading(true);
    setError(null);
    setInvoicesError('');
    try {
      const result = await feeAPI.getLearnerInvoices(childId);
      const rows = result?.data?.invoices ?? result?.data ?? result?.invoices ?? result ?? [];
      setInvoices(Array.isArray(rows) ? rows.filter((invoice) => !invoice.archived && invoice.status !== 'CANCELLED') : []);
    } catch (e) {
      setInvoices([]);
      setInvoicesError(e?.message || 'Could not load this child’s invoices.');
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  const chooseChild = (childId) => {
    setSelectedChildId(childId);
    setHistoryOpen(false);
    loadInvoices(childId);
  };

  const startPayment = (invoice) => {
    const balance = Math.max(0, Number(invoice?.balance ?? invoice?.outstanding ?? 0));
    if (!invoice?.id || balance <= 0) {
      setError('This invoice has no amount due. Refresh the invoice list and try again.');
      return;
    }
    setError(null);
    setPayingInvoice({
      id: invoice.id,
      balance,
      learnerId: selectedChild?.id,
      learnerName: selectedChild?.name,
      invoiceNumber: invoice.invoiceNumber,
      term: invoice.term,
      academicYear: invoice.academicYear,
    });
    setShowPaymentModal(true);
  };

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-20">
      <div className="pt-1 space-y-3">
        {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5"><p className="text-sm text-rose-800">{error}</p><button type="button" onClick={() => selectedChildId ? loadInvoices(selectedChildId) : load()} className="shrink-0 text-xs font-bold text-rose-900 underline">Retry</button></div>}

        <FamilyFeeHeader children={children} loading={loading} />

        {!loading && children.length > 0 && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-bold text-slate-950">Choose a child to pay</h2><p className="mt-0.5 text-xs text-slate-600">Payments are matched to the invoice you select.</p></div>
          <div className="divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:divide-y-0">
            {children.map((child, index) => {
              const selected = String(selectedChildId) === String(child.id);
              const balance = Number(child.feeBalance || 0);
              return <button key={child.id} type="button" onClick={() => chooseChild(child.id)} className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:border-b sm:border-slate-100 ${index % 2 === 0 ? 'sm:border-r' : ''} ${selected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : 'hover:bg-slate-50'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-white text-sm font-bold shadow-sm ${selected ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-900'}`}>{child.name?.trim()?.[0] || '?'}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-950">{child.name}</span><span className="block text-xs text-slate-600">{child.grade || 'Learner'}</span></span>
                <span className="shrink-0 text-right"><span className={`block text-sm font-bold ${balance > 0 ? 'text-slate-950' : 'text-emerald-800'}`}>{balance > 0 ? `KES ${fmt(balance)}` : 'Cleared'}</span><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800">{selected ? 'Selected' : 'View invoices'} <ChevronRight size={14} /></span></span>
              </button>;
            })}
          </div>
        </section>}

        {!loading && selectedChild && <ChildInvoiceList child={selectedChild} invoices={invoices} loading={invoicesLoading} error={invoicesError} onRetry={() => loadInvoices(selectedChild.id)} onPay={startPayment} />}

        {!loading && children.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5"><p className="text-xs text-sky-950"><strong>Paying ahead for next term?</strong> Online advance payments need a learner credit record and are not enabled yet. Current checkout accepts issued invoices only.</p><button type="button" onClick={() => onNavigate?.('parent-portal-messages')} className="shrink-0 text-xs font-bold text-blue-800 underline">Message the school</button></div>}

        {!loading && children.length > 0 && totalBalance === 0 && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-700" /><div><p className="text-sm font-bold text-emerald-900">Current fees are cleared</p><p className="mt-0.5 text-xs text-emerald-800">When a new term invoice is issued, it will appear under the child above.</p></div></div>}

        {!loading && children.length > 0 && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button type="button" onClick={() => setHistoryOpen((open) => !open)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"><span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700"><Receipt size={18} /></span><span className="flex-1"><span className="block text-sm font-bold text-slate-950">Payment history</span><span className="block text-xs text-slate-600">Receipts and payment review requests</span></span><ChevronDown size={17} className={`text-slate-600 transition-transform ${historyOpen ? 'rotate-180' : ''}`} /></button>
          {historyOpen && <ParentPaymentHistory key={`${selectedChildId || 'none'}-${historyRefreshKey}`} children={children} initialChildId={selectedChildId} refreshKey={historyRefreshKey} />}
        </section>}

        {!loading && !error && children.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No children linked to your account</p>
          </div>
        )}
      </div>

      <MpesaPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        invoice={payingInvoice}
        parentPhone={user?.phone || user?.phoneNumber}
        onPaymentSuccess={() => {
          setShowPaymentModal(false);
          setPayingInvoice(null);
          load();
          if (selectedChildId) loadInvoices(selectedChildId);
          setHistoryRefreshKey((key) => key + 1);
        }}
      />
    </div>
  );
};

export default ParentPortalFees;
