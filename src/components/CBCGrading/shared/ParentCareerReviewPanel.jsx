import React, { useCallback, useEffect, useState } from 'react';
import { HeartHandshake, Loader2, MessageCircle } from 'lucide-react';
import { careerAPI } from '../../../services/api';

const OPTIONS = [
  { value: 'PARENT_SUPPORTS', label: 'I support this', style: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { value: 'PARENT_UNCERTAIN', label: 'I need more information', style: 'bg-amber-50 border-amber-200 text-amber-700' },
  { value: 'UNDER_DISCUSSION', label: 'Let us discuss', style: 'bg-blue-50 border-blue-200 text-blue-700' },
];

export default function ParentCareerReviewPanel({ learnerId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await careerAPI.getSavedCareers(learnerId); setItems(response?.data || []); }
    catch (err) { setError(err?.message || 'Saved careers are unavailable'); }
    finally { setLoading(false); }
  }, [learnerId]);
  useEffect(() => { load(); }, [load]);

  const review = async (careerId, supportStatus) => {
    setSavingId(careerId); setError('');
    try {
      const response = await careerAPI.updateSave(learnerId, careerId, { supportStatus });
      setItems((current) => current.map((item) => item.careerId === careerId ? { ...item, ...(response?.data || {}), supportStatus } : item));
    } catch (err) { setError(err?.message || 'Could not save your review'); }
    finally { setSavingId(null); }
  };

  if (loading) return <div className="flex justify-center rounded-xl border border-gray-200 bg-white p-4"><Loader2 size={16} className="animate-spin text-indigo-500" /></div>;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-black text-gray-900"><HeartHandshake size={16} className="text-indigo-600" /> Career review</p>
      <p className="mt-0.5 text-[10px] text-gray-500">Share your support or uncertainty. This guides discussion and does not override the learner’s choice.</p>
      {error && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-[10px] text-rose-700">{error}</p>}
      {items.length === 0 ? <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-4 text-center"><MessageCircle size={18} className="mx-auto text-gray-300" /><p className="mt-1 text-[11px] text-gray-500">No saved careers to review yet.</p></div> : (
        <div className="mt-3 space-y-2">{items.map((item) => <div key={item.careerId} className="rounded-xl border border-gray-100 bg-gray-50 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-gray-900">{item.career?.title}</p><p className="text-[10px] text-gray-500">{item.career?.family?.name || item.career?.recommendedPathway?.replaceAll('_', ' ') || 'Career option'}</p></div>{savingId === item.careerId && <Loader2 size={12} className="animate-spin text-indigo-500" />}</div><div className="mt-2 flex flex-wrap gap-1.5">{OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => review(item.careerId, option.value)} disabled={savingId === item.careerId} className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${item.supportStatus === option.value ? option.style : 'border-gray-200 bg-white text-gray-500'}`}>{option.label}</button>)}</div></div>)}</div>
      )}
    </section>
  );
}
