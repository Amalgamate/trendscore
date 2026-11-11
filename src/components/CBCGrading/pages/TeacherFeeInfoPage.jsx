import React, { useEffect, useState } from 'react';
import { Wallet, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import api from '../../../services/api';

const money = (amount) => `KES ${Number(amount || 0).toLocaleString()}`;

export default function TeacherFeeInfoPage() {
  const [learners, setLearners] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const result = await api.fees.getAssignedLearnerFeeSummaries(); setLearners(result.data || []); }
    catch (e) { setError(e.message || 'Could not load fee summaries. Try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = async (learner) => {
    if (selectedId === learner.id) { setSelectedId(''); setInvoices([]); return; }
    setSelectedId(learner.id); setDetailLoading(true); setError('');
    try { const result = await api.fees.getLearnerInvoices(learner.id); setInvoices(result.data || []); }
    catch (e) { setError(e.message || 'Could not load this learner’s fee items.'); }
    finally { setDetailLoading(false); }
  };
  return <main className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
    <header className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Learner fee information</h1><p className="mt-1 text-sm text-slate-600">Read-only balances for learners in your assigned classes.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"><RefreshCw size={16} /> Refresh</button></header>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
    {loading ? <p className="py-10 text-center text-sm text-slate-600">Loading your assigned learners…</p> : learners.length ? <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{learners.map((learner) => <section key={learner.id}>
      <button onClick={() => toggle(learner)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"><span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-800"><Wallet size={19} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-950">{learner.firstName} {learner.lastName}</span><span className="text-xs text-slate-600">{learner.admissionNumber} · {learner.grade}{learner.stream ? ` ${learner.stream}` : ''}</span></span><span className="mr-2 text-right"><span className="block text-sm font-bold text-slate-900">{money(learner.balance)}</span><span className="text-xs text-slate-600">{learner.openInvoiceCount} open invoices</span></span>{selectedId === learner.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
      {selectedId === learner.id && <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">{detailLoading ? <p className="text-sm text-slate-600">Loading fee items…</p> : invoices.length ? <div className="space-y-2">{invoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"><div><p className="text-sm font-semibold text-slate-900">{invoice.term} {invoice.academicYear}</p><p className="text-xs text-slate-600">{invoice.status}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-900">{money(invoice.balance)}</p><p className="text-xs text-slate-600">of {money(invoice.totalAmount)}</p></div></div>)}</div> : <p className="text-sm text-slate-600">No fee invoices recorded.</p>}</div>}
    </section>)}</div> : <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No learners are currently assigned to your classes.</p>}
  </main>;
}
