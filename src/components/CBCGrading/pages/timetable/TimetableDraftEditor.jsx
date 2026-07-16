import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Download, FileSpreadsheet, GitBranch, Loader2, Lock, Redo2, RefreshCw, Send, Undo2, Unlock } from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TimetableDraftEditor = ({ plan, version, bellSchedule, onBack, onChanged, canEdit = false }) => {
  const { showError, showSuccess } = useNotifications();
  const [entries, setEntries] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [analytics, setAnalytics] = useState({ teachers: [], classes: [], rooms: [] });
  const [action, setAction] = useState('');

  const periods = useMemo(() => (bellSchedule?.periods || []).filter(item => item.active && item.instructional).sort((a, b) => a.sequence - b.sequence), [bellSchedule]);
  const conflictedIds = useMemo(() => new Set(conflicts.flatMap(item => item.entryIds)), [conflicts]);

  const load = async () => {
    setLoading(true);
    try {
      const [entryResponse, conflictResponse, analyticsResponse] = await Promise.all([api.timetable.getEntries(version.id), api.timetable.getConflicts(version.id), api.timetable.getAnalytics(version.id)]);
      setEntries(entryResponse.data || entryResponse || []);
      setConflicts(conflictResponse.data || conflictResponse || []);
      setAnalytics(analyticsResponse.data || analyticsResponse || { teachers: [], classes: [], rooms: [] });
    } catch (error) { showError(error.message || 'Failed to open timetable draft'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [version.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshConflicts = async () => {
    const response = await api.timetable.getConflicts(version.id);
    setConflicts(response.data || response || []);
  };

  const applyChange = async (entryId, changes, record = true) => {
    const current = entries.find(item => item.id === entryId);
    if (!current) return;
    const previous = Object.fromEntries(Object.keys(changes).map(key => [key, current[key]]));
    setSavingId(entryId);
    setEntries(items => items.map(item => item.id === entryId ? { ...item, ...changes } : item));
    try {
      const response = await api.timetable.updateEntry(version.id, entryId, changes);
      const updated = response.data || response;
      setEntries(items => items.map(item => item.id === entryId ? updated : item));
      if (record) { setHistory(items => [...items.slice(-49), { entryId, before: previous, after: changes }]); setFuture([]); }
      await refreshConflicts();
    } catch (error) {
      setEntries(items => items.map(item => item.id === entryId ? current : item));
      showError(error.message || 'Could not update lesson');
      throw error;
    } finally { setSavingId(''); }
  };

  const move = async (event, day, period) => {
    event.preventDefault();
    const entryId = event.dataTransfer.getData('text/timetable-entry');
    const entry = entries.find(item => item.id === entryId);
    if (!canEdit || !entry || entry.locked) return;
    if (entries.some(item => item.id !== entryId && item.classId === entry.classId && item.day === day && item.startTime === period.startTime)) {
      showError('That class already has a lesson in this period.');
      return;
    }
    await applyChange(entryId, { day, bellPeriodId: period.id, startTime: period.startTime, endTime: period.endTime });
  };

  const undo = async () => {
    const action = history.at(-1);
    if (!action) return;
    try { await applyChange(action.entryId, action.before, false); setHistory(items => items.slice(0, -1)); setFuture(items => [...items, action]); }
    catch { /* API rollback already restored the UI. */ }
  };

  const redo = async () => {
    const action = future.at(-1);
    if (!action) return;
    try { await applyChange(action.entryId, action.after, false); setFuture(items => items.slice(0, -1)); setHistory(items => [...items, action]); }
    catch { /* API rollback already restored the UI. */ }
  };

  const nextStatus = { DRAFT: 'DEPARTMENT_REVIEW', GENERATED: 'DEPARTMENT_REVIEW', DEPARTMENT_REVIEW: 'DEPUTY_REVIEW', DEPUTY_REVIEW: 'PRINCIPAL_REVIEW', PRINCIPAL_REVIEW: 'APPROVED' }[version.status];
  const advance = async () => { if (!nextStatus) return; setAction('review'); try { await api.timetable.transition(version.id, nextStatus); showSuccess(`Moved to ${nextStatus.replaceAll('_', ' ').toLowerCase()}`); await onChanged?.(); onBack(); } catch (error) { showError(error.message || 'Review transition failed'); } finally { setAction(''); } };
  const clone = async () => { setAction('clone'); try { await api.timetable.cloneVersion(version.id); showSuccess('A new editable version was created'); await onChanged?.(); onBack(); } catch (error) { showError(error.message || 'Could not restore this version'); } finally { setAction(''); } };
  const exportExcel = async () => { const ExcelJS = (await import('exceljs')).default; const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Master Timetable'); sheet.columns = [{ header: 'Day', key: 'day', width: 12 }, { header: 'Start', key: 'startTime', width: 10 }, { header: 'End', key: 'endTime', width: 10 }, { header: 'Class', key: 'className', width: 22 }, { header: 'Learning Area', key: 'area', width: 24 }, { header: 'Teacher', key: 'teacher', width: 24 }, { header: 'Room', key: 'room', width: 18 }]; entries.forEach(entry => sheet.addRow({ ...entry, className: entry.class?.name, area: entry.learningArea?.name, teacher: entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : '', room: entry.room?.name || '' })); sheet.getRow(1).font = { bold: true }; const buffer = await workbook.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buffer])); const link = document.createElement('a'); link.href = url; link.download = `${plan.name.replace(/[^a-z0-9]+/gi, '_')}_v${version.version}.xlsx`; link.click(); URL.revokeObjectURL(url); };
  const exportPdf = async () => { const { default: jsPDF } = await import('jspdf'); const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); doc.setFontSize(16); doc.text(plan.name, 12, 14); doc.setFontSize(8); let y = 22; entries.forEach((entry, index) => { if (y > 195) { doc.addPage(); y = 14; } doc.text(`${entry.day}  ${entry.startTime}-${entry.endTime}  ${entry.class?.name || ''}  ${entry.learningArea?.name || ''}  ${entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : 'Unassigned'}  ${entry.room?.name || ''}`, 12, y); y += 5; if (index === entries.length - 1) doc.save(`${plan.name.replace(/[^a-z0-9]+/gi, '_')}_v${version.version}.pdf`); }); if (!entries.length) doc.save(`${plan.name}_v${version.version}.pdf`); };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return <div className="space-y-4">
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><button onClick={onBack} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center"><ArrowLeft size={16} /></button><div><h3 className="font-semibold text-gray-900">{plan.name}</h3><p className="text-xs text-gray-500">Version {version.version} · Drag unlocked lessons to another period</p></div></div>
      <div className="flex items-center gap-2">
        {!!conflicts.length && <span className="h-9 px-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-2"><AlertTriangle size={14} /> {conflicts.length} conflicts</span>}
        <button disabled={!history.length || Boolean(savingId)} onClick={undo} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30" title="Undo"><Undo2 size={16} /></button>
        <button disabled={!future.length || Boolean(savingId)} onClick={redo} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30" title="Redo"><Redo2 size={16} /></button>
        <button onClick={load} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center" title="Refresh"><RefreshCw size={16} /></button>
        <button onClick={exportExcel} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center" title="Export Excel"><FileSpreadsheet size={16} /></button>
        <button onClick={exportPdf} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center" title="Export PDF"><Download size={16} /></button>
        <button disabled={Boolean(action)} onClick={clone} className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold flex items-center gap-2"><GitBranch size={14} /> New version</button>
        {nextStatus && canEdit && <button disabled={Boolean(action) || conflicts.some(item => item.severity === 'ERROR')} onClick={advance} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-40"><Send size={14} /> Submit review</button>}
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Teachers', analytics.teachers.length], ['Classes covered', analytics.classes.length], ['Rooms used', analytics.rooms.length], ['Lesson periods', entries.length]].map(([label, value]) => <div key={label} className="bg-white border border-gray-200 rounded-xl p-3"><p className="text-xl font-semibold text-gray-900">{value}</p><p className="text-[10px] uppercase font-semibold text-gray-500">{label}</p></div>)}</div>
    {!!analytics.teachers.length && <div className="bg-white border border-gray-200 rounded-xl p-4"><h4 className="text-sm font-semibold text-gray-900 mb-3">Teacher workload</h4><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{analytics.teachers.sort((a, b) => b.periods - a.periods).map(item => <div key={item.id} className="rounded-lg bg-gray-50 p-3 flex justify-between"><div><p className="text-xs font-semibold text-gray-800">{item.name}</p><p className="text-[10px] text-gray-500">{item.days} teaching days</p></div><span className={`text-xs font-bold ${item.periods > 30 ? 'text-rose-600' : item.periods > 24 ? 'text-amber-600' : 'text-emerald-600'}`}>{item.periods}</span></div>)}</div></div>}

    <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
      <div className="grid min-w-[980px]" style={{ gridTemplateColumns: '120px repeat(5, minmax(170px, 1fr))' }}>
        <div className="sticky left-0 z-20 bg-slate-50 p-3 border-b border-r border-gray-200 text-[10px] font-semibold uppercase text-gray-500">Time</div>
        {days.map(day => <div key={day} className="sticky top-0 z-10 bg-slate-50 p-3 border-b border-r border-gray-200 text-xs font-semibold text-gray-700">{day}</div>)}
        {periods.flatMap(period => [
          <div key={`${period.id}-time`} className="sticky left-0 z-10 bg-white p-3 border-b border-r border-gray-200"><p className="text-xs font-semibold text-gray-800">{period.name}</p><p className="text-[10px] text-gray-500">{period.startTime}-{period.endTime}</p></div>,
          ...days.map(day => <div key={`${period.id}-${day}`} onDragOver={event => event.preventDefault()} onDrop={event => move(event, day, period)} className="min-h-24 p-2 border-b border-r border-gray-200 bg-gray-50/30 hover:bg-indigo-50/50 space-y-1.5">
            {entries.filter(entry => entry.day === day && entry.startTime === period.startTime).map(entry => <div key={entry.id} draggable={canEdit && !entry.locked} onDragStart={event => event.dataTransfer.setData('text/timetable-entry', entry.id)} className={`rounded-lg border p-2 shadow-sm ${entry.locked || !canEdit ? 'cursor-default bg-gray-100 border-gray-200' : 'cursor-grab bg-white border-indigo-100'} ${conflictedIds.has(entry.id) ? 'ring-2 ring-rose-300' : ''}`}>
              <div className="flex justify-between gap-2"><p className="text-[11px] font-semibold text-gray-900 truncate">{entry.learningArea?.shortName || entry.learningArea?.name}</p>{canEdit && <button disabled={savingId === entry.id} onClick={() => applyChange(entry.id, { locked: !entry.locked }).then(() => showSuccess(entry.locked ? 'Lesson unlocked' : 'Lesson locked'))} className="text-gray-400 hover:text-indigo-600">{entry.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>}</div>
              <p className="text-[10px] text-indigo-700 truncate">{entry.class?.name}</p><p className="text-[10px] text-gray-500 truncate">{entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : 'Teacher unassigned'}</p>
            </div>)}
          </div>)
        ])}
      </div>
    </div>
  </div>;
};

export default TimetableDraftEditor;
