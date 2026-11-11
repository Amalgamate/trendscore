import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, User, Receipt, Loader } from 'lucide-react';
import api from '../../../services/api';
import usePageNavigation from '../../../hooks/usePageNavigation';

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;

export default function CashierPaymentPage() {
  const navigateTo = usePageNavigation();
  const [query, setQuery] = useState('');
  const [learners, setLearners] = useState([]);
  const [selected, setSelected] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) { setLearners([]); setError(''); return undefined; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const result = await api.fees.searchCashierLearners(query.trim());
        if (!cancelled) setLearners(result.data || []);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not find learners. Try again.');
      } finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const chooseLearner = async (learner) => {
    setSelected(learner); setInvoices([]); setError(''); setLoading(true);
    try {
      const result = await api.fees.getCashierLearnerInvoices(learner.id);
      setInvoices((result.data || []).filter((invoice) => !invoice.archived && ['PENDING', 'PARTIAL'].includes(invoice.status)));
    } catch (e) { setError(e.message || 'Could not load fee invoices.'); }
    finally { setLoading(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:px-6">
    <button onClick={() => navigateTo('dashboard')} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-800"><ArrowLeft size={17} /> Back</button>
    <header><h1 className="text-2xl font-bold text-slate-950">Take a fee payment</h1><p className="mt-1 text-sm text-slate-600">Find a learner, choose an open invoice, then record the payment.</p></header>
    <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-100">
      <Search size={19} className="text-slate-500" /><input value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); setInvoices([]); }} placeholder="Search by learner name or admission number" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{loading && <Loader size={18} className="animate-spin text-blue-700" />}
    </label>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
    {!selected && query.trim().length >= 2 && !loading && <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {learners.length ? learners.map((learner) => <button key={learner.id} onClick={() => chooseLearner(learner)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-50">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-900"><User size={19} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{[learner.firstName, learner.middleName, learner.lastName].filter(Boolean).join(' ')}</span><span className="text-xs text-slate-600">{learner.admissionNumber} · {learner.grade}{learner.stream ? ` ${learner.stream}` : ''}</span></span><span className="text-sm font-semibold text-blue-800">Choose</span>
      </button>) : <p className="px-4 py-6 text-center text-sm text-slate-600">No learners match that search.</p>}
    </div>}
    {selected && <section className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><div><p className="text-sm font-bold text-slate-950">{[selected.firstName, selected.middleName, selected.lastName].filter(Boolean).join(' ')}</p><p className="text-xs text-slate-600">{selected.admissionNumber} · {selected.grade}{selected.stream ? ` ${selected.stream}` : ''}</p></div><button className="text-sm font-semibold text-blue-800" onClick={() => { setSelected(null); setInvoices([]); }}>Change</button></div>
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Receipt size={17} /> Open invoices</h2>
      {loading ? <p className="text-sm text-slate-600">Loading invoices…</p> : invoices.length ? <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{invoices.map((invoice) => <div key={invoice.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{invoice.invoiceNumber} · {invoice.term} {invoice.academicYear}</p><p className="text-xs text-slate-600">Balance: {money(invoice.balance)}</p></div><button onClick={() => navigateTo('fees-record-payment', { invoice, returnPage: 'fees-cashier' })} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900">Take payment</button></div>)}</div> : <p className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">No open invoices for this learner.</p>}
    </section>}
  </div>;
}
