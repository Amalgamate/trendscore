import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { pathwayPlannerAPI } from '../../../services/api';

const EMPTY = { budgetBand: '', boardingPreference: 'EITHER', preferredCounties: [], faithPreference: '', notes: '', boardingRequired: false, countyRequired: false, requiredSupport: [] };

export default function FamilySchoolPreferences({ learnerId, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await pathwayPlannerAPI.getFamilyPreferences(learnerId); setForm({ ...EMPTY, ...(response?.data || {}) }); }
    catch (err) { setError(err?.message || 'Preferences are unavailable'); }
    finally { setLoading(false); }
  }, [learnerId]);
  useEffect(() => { load(); }, [load]);
  const set = (key, value) => { setSaved(false); setForm((current) => ({ ...current, [key]: value })); };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await pathwayPlannerAPI.saveFamilyPreferences(learnerId, form); setSaved(true); onSaved?.(); }
    catch (err) { setError(err?.message || 'Could not save preferences'); }
    finally { setSaving(false); }
  };
  if (loading) return <div className="flex justify-center rounded-xl border border-gray-200 bg-white p-5"><Loader2 size={16} className="animate-spin text-indigo-500" /></div>;
  return <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
    <div><p className="flex items-center gap-2 text-sm font-black text-gray-900"><SlidersHorizontal size={15} className="text-indigo-600" /> Family school preferences</p><p className="text-[10px] text-gray-500">Required choices exclude incompatible schools. Preferred choices influence fit scores.</p></div>
    {error && <p className="rounded-lg bg-rose-50 p-2 text-[10px] text-rose-700">{error}</p>}
    <div className="grid gap-2 sm:grid-cols-2"><label className="text-[10px] font-bold text-gray-600">Budget band<select value={form.budgetBand || ''} onChange={(e) => set('budgetBand', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-xs"><option value="">Not specified</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label><label className="text-[10px] font-bold text-gray-600">Accommodation<select value={form.boardingPreference || 'EITHER'} onChange={(e) => set('boardingPreference', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-xs"><option>EITHER</option><option>DAY</option><option>BOARDING</option></select></label></div>
    <label className="block text-[10px] font-bold text-gray-600">Preferred counties<input value={(form.preferredCounties || []).join(', ')} onChange={(e) => set('preferredCounties', e.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="Nairobi, Kiambu, Nakuru" className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-xs" /></label>
    <div className="grid gap-2 sm:grid-cols-2"><label className="block text-[10px] font-bold text-gray-600">Faith preference<input value={form.faithPreference || ''} onChange={(e) => set('faithPreference', e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-xs" /></label><label className="block text-[10px] font-bold text-gray-600">Required support<input value={(form.requiredSupport || []).join(', ')} onChange={(e) => set('requiredSupport', e.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="Mobility, visual support" className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-xs" /></label></div>
    <div className="flex flex-wrap gap-4"><label className="flex items-center gap-2 text-[10px] font-bold text-gray-600"><input type="checkbox" checked={!!form.boardingRequired} onChange={(e) => set('boardingRequired', e.target.checked)} /> Accommodation is non-negotiable</label><label className="flex items-center gap-2 text-[10px] font-bold text-gray-600"><input type="checkbox" checked={!!form.countyRequired} onChange={(e) => set('countyRequired', e.target.checked)} /> Counties are non-negotiable</label></div>
    <label className="block text-[10px] font-bold text-gray-600">Family notes<textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-xs" /></label>
    <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-[10px] font-black text-white disabled:opacity-60">{saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12} /> : <Save size={12} />}{saving ? 'Saving…' : saved ? 'Preferences saved' : 'Save family preferences'}</button>
  </form>;
}
