import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, RefreshCw, RotateCcw } from 'lucide-react';
import api from '../../../services/api';
import { usePermissions } from '../../../hooks/usePermissions';

const money = (amount) => `KES ${Number(amount || 0).toLocaleString()}`;
const title = (record) => [record?.invoice?.learner?.firstName, record?.invoice?.learner?.lastName].filter(Boolean).join(' ') || 'Learner';

export default function FeeRefundsPage() {
  const { can } = usePermissions();
  const canApprove = can('APPROVE_REFUND');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await api.finance.listRefunds({ status }); setItems(result.data || []); setNotice(null); }
    catch (e) { setNotice({ type: 'error', text: e.message || 'Could not load refund requests. Try again.' }); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const decide = async (item, action) => {
    let reason = '';
    if (action === 'reject') { reason = window.prompt('Add a short reason for declining this refund:') || ''; if (!reason.trim()) return; }
    if (action === 'approve' && !window.confirm(`Approve a refund of ${money(item.amount)} for ${title(item)}?`)) return;
    setBusy(item.id); setNotice(null);
    try {
      if (action === 'approve') await api.finance.approveRefund(item.id);
      else await api.finance.rejectRefund(item.id, reason.trim());
      setNotice({ type: 'success', text: action === 'approve' ? 'Refund approved. Check its status for payout progress.' : 'Refund request declined and the reason was recorded.' });
      await load();
    } catch (e) { setNotice({ type: 'error', text: e.message || 'We could not update this request. Try again.' }); }
    finally { setBusy(''); }
  };

  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Refund requests</h1><p className="mt-1 text-sm text-slate-600">Review the payment, reason and learner before approving or declining.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"><RefreshCw size={16} /> Refresh</button></header>
    {notice && <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.text}</p>}
    <div className="flex gap-2 border-b border-slate-200">{['PENDING', 'APPROVED', 'MANUAL', 'DISBURSED', 'REJECTED', 'FAILED'].map((value) => <button key={value} onClick={() => setStatus(value)} className={`border-b-2 px-3 py-2 text-sm font-semibold ${status === value ? 'border-blue-800 text-blue-900' : 'border-transparent text-slate-600'}`}>{value.replace('_', ' ')}</button>)}</div>
    {loading ? <p className="py-10 text-center text-sm text-slate-600">Loading refund requests…</p> : items.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center"><RotateCcw className="mx-auto text-slate-400" /><h2 className="mt-3 font-semibold text-slate-900">No {status.toLowerCase()} refund requests</h2><p className="mt-1 text-sm text-slate-600">New requests will appear here when submitted.</p></div> : <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{items.map((item) => <article key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{title(item)}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.status}</span></div><p className="mt-1 text-sm text-slate-700">{money(item.amount)} · {item.payment?.paymentMethod || 'Payment'} · Receipt {item.payment?.receiptNumber || '—'}</p><p className="mt-1 text-sm text-slate-600">{item.reason}</p><p className="mt-1 text-xs text-slate-500">Invoice {item.invoice?.invoiceNumber || '—'} · Requested {new Date(item.submittedAt || item.createdAt).toLocaleDateString()}</p>{item.b2cFailureReason && <p className="mt-1 text-xs text-amber-800">{item.b2cFailureReason}</p>}</div>{canApprove && item.status === 'PENDING' && <div className="flex shrink-0 gap-2"><button disabled={busy === item.id} onClick={() => decide(item, 'reject')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"><X size={16} /> Decline</button><button disabled={busy === item.id} onClick={() => decide(item, 'approve')} className="inline-flex items-center gap-1 rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} /> Approve</button></div>}</article>)}</div>}
  </main>;
}
