import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpenCheck, Building2, CalendarClock, CheckCircle2, Clock3, Loader2, Play, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import TimetableDraftEditor from './TimetableDraftEditor';

const fieldClass = 'w-full h-11 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400';
const labelClass = 'block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5';
const currentYear = new Date().getFullYear();
const schoolDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const buildPeriods = (startTime, duration, count) => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const firstMinute = (startHour * 60) + startMinute;
  return Array.from({ length: count }, (_, index) => {
    const start = firstMinute + (index * duration);
    const end = start + duration;
    const format = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    return { name: `Period ${index + 1}`, sequence: index + 1, startTime: format(start), endTime: format(end), type: 'LESSON', instructional: true };
  });
};

const Metric = ({ icon: Icon, label, value, tone }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}><Icon size={19} /></div>
    <div><p className="text-xl font-semibold text-gray-900 leading-none">{value}</p><p className="text-xs text-gray-500 mt-1">{label}</p></div>
  </div>
);

const TimetableEngineSetup = ({ open, onClose, teachers = [], learningAreas = [], canEdit = false }) => {
  const { showSuccess, showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [data, setData] = useState({ bellSchedules: [], rooms: [], allocations: [], availability: [], plans: [] });
  const [section, setSection] = useState('overview');
  const [bell, setBell] = useState({ name: 'Standard', startTime: '08:00', duration: 40, count: 9, isDefault: true });
  const [room, setRoom] = useState({ name: '', code: '', type: 'CLASSROOM', capacity: 40 });
  const [allocation, setAllocation] = useState({ academicYear: currentYear, grade: 'GRADE_7', learningAreaId: '', targetWeeklyPeriods: 5 });
  const [availability, setAvailability] = useState({ teacherId: '', day: 'Monday', startTime: '08:00', endTime: '16:00', available: false, reason: '' });
  const [plan, setPlan] = useState({ name: `Main Timetable ${currentYear}`, academicYear: currentYear, term: 'TERM_1', bellScheduleId: '' });
  const [generation, setGeneration] = useState(null);
  const [generatingVersion, setGeneratingVersion] = useState('');
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.timetable.getFoundation();
      const next = response.data || response;
      setData(next);
      if (!plan.bellScheduleId && next.bellSchedules?.[0]?.id) setPlan(current => ({ ...current, bellScheduleId: next.bellSchedules[0].id }));
    } catch (error) {
      showError(error.message || 'Failed to load timetable engine setup');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const roomTypes = ['CLASSROOM', 'SCIENCE_LAB', 'ICT_LAB', 'LIBRARY', 'MUSIC_ROOM', 'ART_ROOM', 'WORKSHOP', 'AGRICULTURE_FIELD', 'SWIMMING_POOL', 'MULTIPURPOSE_HALL', 'SPORTS_GROUND', 'OTHER'];
  const tabs = useMemo(() => [
    ['overview', 'Overview'], ['bells', 'Bell schedules'], ['rooms', 'Rooms'], ['allocations', 'Allocations'], ['availability', 'Availability'], ['plans', 'Plans']
  ], []);

  const submit = async (key, action, reset) => {
    setSaving(key);
    try { await action(); showSuccess('Timetable configuration saved'); await load(); reset?.(); }
    catch (error) { showError(error.message || 'Failed to save timetable configuration'); }
    finally { setSaving(''); }
  };

  const generatePlan = async (versionId) => {
    setGeneratingVersion(versionId);
    setGeneration(null);
    try {
      const response = await api.timetable.generate(versionId, { maxDailyLessons: 9 });
      const result = response.data || response;
      setGeneration(result);
      if (result.stats?.hardConflicts) showError(`Generated with ${result.stats.hardConflicts} hard conflict(s)`);
      else showSuccess(`Generated ${result.stats?.generatedEntries || 0} lesson periods`);
    } catch (error) {
      showError(error.message || 'Automatic timetable generation failed');
    } finally { setGeneratingVersion(''); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-sm flex justify-end" role="dialog" aria-modal="true" aria-label="Timetable engine setup">
      <div className="w-full max-w-5xl h-full bg-[#f6f8fc] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="px-5 sm:px-7 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Kenya CBE Timetabling Engine</p><h2 className="text-xl font-semibold text-gray-900">Timetable foundation</h2></div>
          <button onClick={onClose} className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900"><X size={19} /></button>
        </div>

        <div className="px-5 sm:px-7 bg-white border-b border-gray-200 overflow-x-auto flex gap-1">
          {tabs.map(([id, label]) => <button key={id} onClick={() => setSection(id)} className={`px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap ${section === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}>{label}</button>)}
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div> : (
            <>
              {section === 'overview' && <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <Metric icon={Clock3} label="Bell schedules" value={data.bellSchedules.length} tone="bg-indigo-50 text-indigo-600" />
                  <Metric icon={Building2} label="Managed rooms" value={data.rooms.length} tone="bg-amber-50 text-amber-600" />
                  <Metric icon={BookOpenCheck} label="Allocations" value={data.allocations.length} tone="bg-emerald-50 text-emerald-600" />
                  <Metric icon={Users} label="Availability rules" value={data.availability.length} tone="bg-cyan-50 text-cyan-600" />
                  <Metric icon={CalendarClock} label="Timetable plans" value={data.plans.length} tone="bg-rose-50 text-rose-600" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex gap-3"><ShieldCheck className="text-emerald-600 shrink-0" /><div><h3 className="font-semibold text-gray-900">Compatibility mode is active</h3><p className="text-sm text-gray-500 mt-1">Draft plans use normalized, versioned entries. Publishing projects the approved version into the existing class schedule so teacher, student and dashboard views continue to work.</p></div></div>
                </div>
              </div>}

              {section === 'bells' && <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); submit('bell', () => api.timetable.createBellSchedule({ name: bell.name, isDefault: bell.isDefault, periods: { create: buildPeriods(bell.startTime, Number(bell.duration), Number(bell.count)) } })); }}>
                  <h3 className="font-semibold text-gray-900">Create bell schedule</h3>
                  <div><label className={labelClass}>Schedule name</label><input className={fieldClass} value={bell.name} onChange={e => setBell({ ...bell, name: e.target.value })} required /></div>
                  <div className="grid grid-cols-3 gap-3"><div><label className={labelClass}>Starts</label><input type="time" className={fieldClass} value={bell.startTime} onChange={e => setBell({ ...bell, startTime: e.target.value })} /></div><div><label className={labelClass}>Minutes</label><input type="number" min="20" className={fieldClass} value={bell.duration} onChange={e => setBell({ ...bell, duration: e.target.value })} /></div><div><label className={labelClass}>Periods</label><input type="number" min="1" max="20" className={fieldClass} value={bell.count} onChange={e => setBell({ ...bell, count: e.target.value })} /></div></div>
                  <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={bell.isDefault} onChange={e => setBell({ ...bell, isDefault: e.target.checked })} /> Make default</label>
                  <button disabled={!canEdit || saving === 'bell'} className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{saving === 'bell' ? 'Saving…' : 'Create schedule'}</button>
                </form>
                <div className="space-y-3">{data.bellSchedules.map(item => <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4"><div className="flex justify-between"><div><h4 className="font-semibold text-gray-900">{item.name}</h4><p className="text-xs text-gray-500">{item.periods.length} periods</p></div>{item.isDefault && <span className="text-[10px] uppercase font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2 py-1 h-fit">Default</span>}</div><div className="mt-3 flex flex-wrap gap-2">{item.periods.map(period => <span key={period.id} className="text-[10px] bg-gray-50 border border-gray-200 rounded-md px-2 py-1">{period.name} · {period.startTime}-{period.endTime}</span>)}</div></div>)}</div>
              </div>}

              {section === 'rooms' && <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); submit('room', () => api.timetable.createRoom({ ...room, capacity: Number(room.capacity) }), () => setRoom({ name: '', code: '', type: 'CLASSROOM', capacity: 40 })); }}>
                  <h3 className="font-semibold text-gray-900">Register room or facility</h3>
                  <div><label className={labelClass}>Name</label><input className={fieldClass} value={room.name} onChange={e => setRoom({ ...room, name: e.target.value })} required /></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Code</label><input className={fieldClass} value={room.code} onChange={e => setRoom({ ...room, code: e.target.value })} /></div><div><label className={labelClass}>Capacity</label><input type="number" min="1" className={fieldClass} value={room.capacity} onChange={e => setRoom({ ...room, capacity: e.target.value })} /></div></div>
                  <div><label className={labelClass}>Room type</label><select className={fieldClass} value={room.type} onChange={e => setRoom({ ...room, type: e.target.value })}>{roomTypes.map(type => <option key={type}>{type}</option>)}</select></div>
                  <button disabled={!canEdit || saving === 'room'} className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">Add room</button>
                </form>
                <div className="grid sm:grid-cols-2 gap-3 content-start">{data.rooms.map(item => <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4"><h4 className="font-semibold text-gray-900">{item.name}</h4><p className="text-xs text-gray-500 mt-1">{item.type.replaceAll('_', ' ')} · Capacity {item.capacity || '—'}</p></div>)}</div>
              </div>}

              {section === 'allocations' && <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); submit('allocation', () => api.timetable.saveAllocation({ ...allocation, academicYear: Number(allocation.academicYear), targetWeeklyPeriods: Number(allocation.targetWeeklyPeriods) })); }}>
                  <h3 className="font-semibold text-gray-900">Weekly instructional allocation</h3>
                  <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Year</label><input type="number" className={fieldClass} value={allocation.academicYear} onChange={e => setAllocation({ ...allocation, academicYear: e.target.value })} /></div><div><label className={labelClass}>Grade</label><input className={fieldClass} value={allocation.grade} onChange={e => setAllocation({ ...allocation, grade: e.target.value })} /></div></div>
                  <div><label className={labelClass}>Learning area</label><select required className={fieldClass} value={allocation.learningAreaId} onChange={e => setAllocation({ ...allocation, learningAreaId: e.target.value })}><option value="">Select learning area</option>{learningAreas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div>
                  <div><label className={labelClass}>Target periods per week</label><input type="number" min="1" className={fieldClass} value={allocation.targetWeeklyPeriods} onChange={e => setAllocation({ ...allocation, targetWeeklyPeriods: e.target.value })} /></div>
                  <button disabled={!canEdit || saving === 'allocation'} className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">Save allocation</button>
                </form>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden h-fit"><div className="grid grid-cols-[1fr_1.5fr_90px] px-4 py-2 bg-gray-50 text-[10px] font-semibold uppercase text-gray-500"><span>Grade</span><span>Learning area</span><span>Periods</span></div>{data.allocations.map(item => <div key={item.id} className="grid grid-cols-[1fr_1.5fr_90px] px-4 py-3 border-t border-gray-100 text-sm"><span>{item.grade}</span><span>{item.learningArea.name}</span><strong>{item.targetWeeklyPeriods}</strong></div>)}</div>
              </div>}

              {section === 'availability' && <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); submit('availability', () => api.timetable.saveTeacherAvailability(availability)); }}>
                  <h3 className="font-semibold text-gray-900">Teacher availability rule</h3>
                  <div><label className={labelClass}>Teacher</label><select required className={fieldClass} value={availability.teacherId} onChange={e => setAvailability({ ...availability, teacherId: e.target.value })}><option value="">Select teacher</option>{teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}</select></div>
                  <div><label className={labelClass}>Day</label><select className={fieldClass} value={availability.day} onChange={e => setAvailability({ ...availability, day: e.target.value })}>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => <option key={day}>{day}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>From</label><input type="time" className={fieldClass} value={availability.startTime} onChange={e => setAvailability({ ...availability, startTime: e.target.value })} /></div><div><label className={labelClass}>To</label><input type="time" className={fieldClass} value={availability.endTime} onChange={e => setAvailability({ ...availability, endTime: e.target.value })} /></div></div>
                  <div><label className={labelClass}>Reason</label><input className={fieldClass} value={availability.reason} onChange={e => setAvailability({ ...availability, reason: e.target.value })} placeholder="e.g. Part-time teacher" /></div>
                  <button disabled={!canEdit || saving === 'availability'} className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">Save rule</button>
                </form>
                <div className="space-y-3">{data.availability.map(item => <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between gap-3"><div><h4 className="font-semibold text-gray-900">{item.teacher.firstName} {item.teacher.lastName}</h4><p className="text-xs text-gray-500">{item.day} · {item.startTime}-{item.endTime}</p></div><span className={`text-[10px] uppercase font-semibold rounded-full px-2 py-1 h-fit ${item.available ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{item.available ? 'Available' : 'Unavailable'}</span></div>)}</div>
              </div>}

              {section === 'plans' && (editing ? <TimetableDraftEditor plan={editing.plan} version={editing.version} bellSchedule={data.bellSchedules.find(item => item.id === editing.plan.bellScheduleId)} canEdit={canEdit && ['DRAFT', 'GENERATED', 'DEPARTMENT_REVIEW', 'DEPUTY_REVIEW', 'PRINCIPAL_REVIEW', 'APPROVED'].includes(editing.version.status)} onChanged={load} onBack={() => setEditing(null)} /> : <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); submit('plan', () => api.timetable.createPlan({ ...plan, academicYear: Number(plan.academicYear) })); }}>
                  <h3 className="font-semibold text-gray-900">Create versioned timetable plan</h3>
                  <div><label className={labelClass}>Plan name</label><input className={fieldClass} value={plan.name} onChange={e => setPlan({ ...plan, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Year</label><input type="number" className={fieldClass} value={plan.academicYear} onChange={e => setPlan({ ...plan, academicYear: e.target.value })} /></div><div><label className={labelClass}>Term</label><select className={fieldClass} value={plan.term} onChange={e => setPlan({ ...plan, term: e.target.value })}><option value="TERM_1">Term 1</option><option value="TERM_2">Term 2</option><option value="TERM_3">Term 3</option></select></div></div>
                  <div><label className={labelClass}>Bell schedule</label><select required className={fieldClass} value={plan.bellScheduleId} onChange={e => setPlan({ ...plan, bellScheduleId: e.target.value })}><option value="">Select schedule</option>{data.bellSchedules.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                  <button disabled={!canEdit || saving === 'plan'} className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">Create draft plan</button>
                </form>
                <div className="space-y-3">
                  {generation && <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><h4 className="font-semibold text-gray-900">Generation result</h4><p className="text-xs text-gray-500 mt-1">The draft was replaced while locked lessons were preserved.</p></div>
                      {generation.stats?.hardConflicts ? <AlertTriangle className="text-rose-500" /> : <CheckCircle2 className="text-emerald-500" />}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[['Lessons', generation.stats?.generatedEntries], ['Classes', generation.stats?.classes], ['Unresolved', generation.stats?.unresolvedAllocations], ['Conflicts', generation.stats?.hardConflicts]].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 px-3 py-2"><p className="text-lg font-semibold text-gray-900">{value || 0}</p><p className="text-[10px] uppercase font-semibold text-gray-500">{label}</p></div>)}
                    </div>
                    {!!generation.unresolved?.length && <div className="max-h-48 overflow-y-auto space-y-2">{generation.unresolved.map(item => <div key={`${item.classId}-${item.learningAreaId}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">{item.className} · {item.learningAreaName}</p><p className="text-[11px] text-amber-700 mt-1">Scheduled {item.scheduledPeriods} of {item.requiredPeriods}. {item.reason}</p></div>)}</div>}
                    {!!generation.entries?.length && <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <div className="grid grid-cols-5 min-w-[760px] bg-gray-50">{schoolDays.map(day => <div key={day} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-r border-gray-200 last:border-r-0">{day}</div>)}</div>
                      <div className="grid grid-cols-5 min-w-[760px] items-start">{schoolDays.map(day => <div key={day} className="p-2 border-r border-gray-200 last:border-r-0 space-y-2 min-h-28">{generation.entries.filter(entry => entry.day === day).map(entry => <div key={entry.id} className="rounded-md border border-indigo-100 bg-indigo-50 p-2"><p className="text-[11px] font-semibold text-indigo-950 truncate">{entry.learningArea?.shortName || entry.learningArea?.name}</p><p className="text-[10px] text-indigo-700 truncate">{entry.class?.name} · {entry.startTime}</p><p className="text-[10px] text-gray-500 truncate">{entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : 'Teacher unassigned'}</p></div>)}</div>)}</div>
                    </div>}
                  </div>}
                  {data.plans.map(item => {
                    const version = item.versions?.[0];
                    const editable = version && ['DRAFT', 'DEPARTMENT_REVIEW', 'DEPUTY_REVIEW', 'PRINCIPAL_REVIEW', 'APPROVED'].includes(version.status);
                    return <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex justify-between gap-3"><div><h4 className="font-semibold text-gray-900">{item.name}</h4><p className="text-xs text-gray-500">{item.term.replace('_', ' ')} · {item.academicYear} · {item.bellSchedule.name}</p></div><span className="text-[10px] uppercase font-semibold bg-gray-100 rounded-full px-2 py-1 h-fit">{version?.status || item.status}</span></div>
                      {version && <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3"><p className="text-[11px] text-gray-500">Version {version.version}</p><div className="flex gap-2"><button type="button" onClick={() => setEditing({ plan: item, version })} className="h-9 px-3 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold">Edit grid</button><button type="button" disabled={!canEdit || !editable || generatingVersion === version.id} onClick={() => generatePlan(version.id)} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-40">{generatingVersion === version.id ? <><RefreshCw size={14} className="animate-spin" /> Generating…</> : <><Play size={14} /> Generate timetable</>}</button></div></div>}
                    </div>;
                  })}
                </div>
              </div>)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimetableEngineSetup;
