import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { pathwayPlannerAPI } from '../../../services/api';

const DEFAULT_OPTIONS = {
  interestAreas: ['Technology', 'Science', 'People & community', 'Business', 'Arts & design', 'Sports & wellbeing', 'Nature & environment', 'Media & communication'],
  strengthAreas: ['Problem solving', 'Creativity', 'Leadership', 'Communication', 'Teamwork', 'Organisation', 'Practical making', 'Research'],
  preferredActivities: ['Building or experimenting', 'Reading and writing', 'Helping people', 'Creating or performing', 'Playing sport', 'Working with numbers', 'Leading a team', 'Using technology'],
  learningPreference: ['Learning by doing', 'Visual examples', 'Discussion and teamwork', 'Independent reading', 'Practice and repetition'],
};

const EMPTY = {
  interestAreas: [], strengthAreas: [], preferredActivities: [], aspirations: '', learningPreference: '',
  confidenceAreas: { problemSolving: 3, creativity: 3, leadership: 3, communication: 3 },
};

const LABELS = {
  problemSolving: 'Problem solving', creativity: 'Creativity', leadership: 'Leadership', communication: 'Communication',
};

function ChoiceSet({ label, hint, options, value, onChange }) {
  const toggle = (item) => onChange(value.includes(item) ? value.filter((entry) => entry !== item) : [...value, item]);
  return <div>
    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{label}</p>
    {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((item) => <button key={item} type="button" onClick={() => toggle(item)} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${value.includes(item) ? 'border-violet-300 bg-violet-100 text-violet-800' : 'border-gray-200 bg-white text-gray-600 hover:border-violet-200'}`}>{item}</button>)}
    </div>
  </div>;
}

export default function DiscoverMePanel({ learnerId, compact = false }) {
  const [profile, setProfile] = useState(EMPTY);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const complete = useMemo(() => profile.interestAreas.length > 0 && profile.strengthAreas.length > 0 && !!profile.learningPreference, [profile]);

  useEffect(() => {
    if (!learnerId) return;
    let cancelled = false;
    pathwayPlannerAPI.getPathwayProfile(learnerId).then((response) => {
      if (cancelled) return;
      setOptions({ ...DEFAULT_OPTIONS, ...(response?.meta || {}) });
      const data = response?.data;
      if (data) setProfile({ ...EMPTY, ...data, confidenceAreas: { ...EMPTY.confidenceAreas, ...(data.confidenceAreas || {}) } });
    }).catch((err) => !cancelled && setError(err?.message || 'Could not load your reflection profile.')).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [learnerId]);

  const update = (key, value) => { setSaved(false); setProfile((current) => ({ ...current, [key]: value })); };
  const save = async () => {
    setSaving(true); setError('');
    try { const response = await pathwayPlannerAPI.savePathwayProfile(learnerId, profile); setProfile({ ...EMPTY, ...(response?.data || profile), confidenceAreas: { ...EMPTY.confidenceAreas, ...(response?.data?.confidenceAreas || profile.confidenceAreas) } }); setSaved(true); }
    catch (err) { setError(err?.message || 'Could not save your reflection.'); }
    finally { setSaving(false); }
  };

  if (loading) return <section className="rounded-2xl border border-violet-200 bg-white p-4"><Loader2 className="mx-auto animate-spin text-violet-600" size={18} /></section>;

  return <section className="space-y-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-700"><Sparkles size={12} /> Discover Me</p><h2 className="mt-1 text-sm font-black text-gray-900">Tell us what matters to you</h2><p className="mt-1 text-[11px] leading-relaxed text-gray-600">Your voice adds context to your plan. It does not replace your academic evidence or make a decision for you.</p></div>
      {complete && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700"><CheckCircle2 size={11} /> Ready</span>}
    </div>
    {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">{error}</p>}
    <ChoiceSet label="What interests you?" hint="Choose anything that you would like to explore." options={options.interestAreas} value={profile.interestAreas} onChange={(value) => update('interestAreas', value)} />
    {!compact && <><ChoiceSet label="Where do you feel strong?" options={options.strengthAreas} value={profile.strengthAreas} onChange={(value) => update('strengthAreas', value)} /><ChoiceSet label="What do you enjoy doing?" options={options.preferredActivities} value={profile.preferredActivities} onChange={(value) => update('preferredActivities', value)} /></>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-black uppercase tracking-wider text-gray-500">How do you learn best?<select value={profile.learningPreference} onChange={(event) => update('learningPreference', event.target.value)} className="mt-1.5 block w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-medium normal-case tracking-normal text-gray-700"><option value="">Choose one</option>{options.learningPreference.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-wider text-gray-500">A future you would like<textarea value={profile.aspirations} onChange={(event) => update('aspirations', event.target.value)} rows={2} maxLength={600} placeholder="For example: I want to solve problems that help people." className="mt-1.5 block w-full rounded-lg border border-gray-200 p-2 text-xs font-medium normal-case tracking-normal text-gray-700" /></label></div>
    {!compact && <div><p className="text-[10px] font-black uppercase tracking-wider text-gray-500">How confident do you feel today?</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(LABELS).map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-lg border border-gray-200 px-2.5 py-2 text-[11px] font-semibold text-gray-700">{label}<select value={profile.confidenceAreas[key]} onChange={(event) => update('confidenceAreas', { ...profile.confidenceAreas, [key]: Number(event.target.value) })} className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px]"><option value={1}>Starting</option><option value={2}>Growing</option><option value={3}>Okay</option><option value={4}>Confident</option><option value={5}>Very confident</option></select></label>)}</div></div>}
    <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3"><p className="text-[10px] text-gray-500">You can change this as you learn more about yourself.</p><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-black text-white hover:bg-violet-700 disabled:opacity-60">{saving ? <Loader2 size={11} className="animate-spin" /> : saved ? <CheckCircle2 size={11} /> : null}{saving ? 'Saving…' : saved ? 'Saved' : 'Save reflection'}</button></div>
  </section>;
}
