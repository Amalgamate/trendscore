/**
 * BoardingManager
 * Boarding school operations hub — dorms, roll call, exeat, dining, prep.
 * Page key: 'boarding-dashboard'
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Home, Users, CalendarCheck, ArrowRightFromLine,
  Plus, CheckCircle2, Loader2,
  RefreshCw, X
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

// ── Helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition';
const selectCls = inputCls;

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-full transition">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────────
const SummaryCard = ({ label, value, icon: Icon, color = 'blue' }) => {
  const clr = { blue: 'text-blue-600 bg-blue-50', indigo: 'text-indigo-600 bg-indigo-50', amber: 'text-amber-600 bg-amber-50', emerald: 'text-emerald-600 bg-emerald-50' }[color];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${clr} flex-shrink-0`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const BoardingManager = () => {
  const [activeTab, setActiveTab]       = useState('dorms');
  const [dashboard, setDashboard]       = useState(null);
  const [dorms, setDorms]               = useState([]);
  const [exeats, setExeats]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const { showSuccess, showError } = useNotifications();

  // Modals
  const [dormModal, setDormModal]       = useState(false);
  const [exeatModal, setExeatModal]     = useState(false);
  const [rollCallModal, setRollCallModal] = useState(false);
  const [dormForm, setDormForm]         = useState({ name: '', gender: 'BOYS', capacity: '' });
  const [exeatForm, setExeatForm]       = useState({ learnerId: '', exeatType: 'WEEKEND', departureDate: '', returnDate: '', reason: '', parentPhone: '' });
  const [rollCallForm, setRollCallForm] = useState({ dormitoryId: '', session: 'MORNING', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving]             = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, dormRes, exeatRes] = await Promise.all([
        api.boarding.getDashboard().catch(() => null),
        api.boarding.getDormitories().catch(() => null),
        api.boarding.getExeats({ status: 'APPROVED,PENDING' }).catch(() => null),
      ]);
      if (dash?.success)    setDashboard(dash.data);
      if (dormRes?.success) setDorms(dormRes.data ?? []);
      if (exeatRes?.success) setExeats(exeatRes.data ?? []);
    } catch { showError('Failed to load boarding data'); }
    finally { setLoading(false); }
  }, [showError]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Create dormitory ─────────────────────────────────────────────────────
  const saveDorm = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.boarding.createDormitory({ ...dormForm, capacity: parseInt(dormForm.capacity) || 0 });
      if (res?.success) {
        showSuccess('Dormitory created');
        setDormModal(false);
        setDormForm({ name: '', gender: 'BOYS', capacity: '' });
        fetchAll();
      }
    } catch (err) { showError(err?.message || 'Failed to create dormitory'); }
    finally { setSaving(false); }
  };

  // ── Request exeat ────────────────────────────────────────────────────────
  const saveExeat = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.boarding.requestExeat(exeatForm);
      if (res?.success) {
        showSuccess('Exeat request submitted');
        setExeatModal(false);
        setExeatForm({ learnerId: '', exeatType: 'WEEKEND', departureDate: '', returnDate: '', reason: '', parentPhone: '' });
        fetchAll();
      }
    } catch (err) { showError(err?.message || 'Failed to submit exeat'); }
    finally { setSaving(false); }
  };

  // ── Start roll call ──────────────────────────────────────────────────────
  const startRollCall = async (e) => {
    e.preventDefault();
    if (!rollCallForm.dormitoryId) { showError('Select a dormitory'); return; }
    setSaving(true);
    try {
      const res = await api.boarding.startRollCall(rollCallForm);
      if (res?.success) {
        showSuccess('Roll call started');
        setRollCallModal(false);
      }
    } catch (err) { showError(err?.message || 'Failed to start roll call'); }
    finally { setSaving(false); }
  };

  // ── Approve / deny exeat ─────────────────────────────────────────────────
  const handleExeatDecision = async (exeatId, approved) => {
    try {
      const res = await api.boarding.approveExeat(exeatId, { approved });
      if (res?.success) {
        showSuccess(`Exeat ${approved ? 'approved' : 'denied'}`);
        fetchAll();
      }
    } catch (err) { showError(err?.message || 'Failed'); }
  };

  const TABS = [
    ['dorms',    'Dormitories'],
    ['exeat',    `Exeat (${exeats.length})`],
    ['rollcall', 'Roll Call'],
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3 tracking-tight">
            <Home className="text-indigo-600" size={28} />
            Boarding
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Dormitories, roll call, exeat and dining management.</p>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard icon={Home}           label="Dormitories"       value={dashboard?.totalDorms}            color="indigo" />
        <SummaryCard icon={Users}          label="Boarders"          value={dashboard?.totalBoarders}         color="blue" />
        <SummaryCard icon={ArrowRightFromLine} label="Pending Exeats" value={dashboard?.pendingExeats}        color="amber" />
        <SummaryCard icon={CheckCircle2}   label="On Exeat Now"      value={dashboard?.currentlyOnExeat}      color="emerald" />
      </div>

      {/* Tabs + actions */}
      <div className="flex items-center justify-between border-b border-gray-200 mb-5">
        <div className="flex gap-1">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === id ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pb-2">
          {activeTab === 'dorms' && (
            <button onClick={() => setDormModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20">
              <Plus size={14} /> Add Dormitory
            </button>
          )}
          {activeTab === 'exeat' && (
            <button onClick={() => setExeatModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20">
              <Plus size={14} /> Request Exeat
            </button>
          )}
          {activeTab === 'rollcall' && (
            <button onClick={() => setRollCallModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20">
              <Plus size={14} /> Start Roll Call
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      )}

      {/* Dorms tab */}
      {!loading && activeTab === 'dorms' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dorms.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl border border-gray-100 p-16 text-center">
              <Home size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No dormitories yet. Add one to get started.</p>
            </div>
          )}
          {dorms.map(d => (
            <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-400">{d.gender} · {d.block ?? 'No block'}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${d.gender === 'BOYS' ? 'bg-blue-100 text-blue-700' : d.gender === 'GIRLS' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'}`}>
                  {d.gender}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 mt-3">
                <span>{d._count?.beds ?? 0} beds</span>
                <span>{d._count?.assignments ?? 0} occupied</span>
                <span>Capacity: {d.capacity}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exeat tab */}
      {!loading && activeTab === 'exeat' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {exeats.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <ArrowRightFromLine size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No exeat requests</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-400 border-b">
                <tr>
                  <th className="p-4">Learner</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Departure</th>
                  <th className="p-4">Return</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {exeats.map(ex => (
                  <tr key={ex.id} className="hover:bg-gray-50/50">
                    <td className="p-4 text-sm font-medium text-gray-900">{ex.learnerId}</td>
                    <td className="p-4 text-xs text-gray-500">{ex.exeatType}</td>
                    <td className="p-4 text-xs text-gray-500">{ex.departureDate?.slice(0,10)}</td>
                    <td className="p-4 text-xs text-gray-500">{ex.returnDate?.slice(0,10)}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        ex.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        ex.status === 'PENDING'  ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{ex.status}</span>
                    </td>
                    <td className="p-4 text-right">
                      {ex.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleExeatDecision(ex.id, true)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition">
                            Approve
                          </button>
                          <button onClick={() => handleExeatDecision(ex.id, false)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition">
                            Deny
                          </button>
                        </div>
                      )}
                      {ex.status === 'APPROVED' && !ex.departedAt && (
                        <button onClick={() => api.boarding.recordDeparture(ex.id).then(fetchAll)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition">
                          Record Departure
                        </button>
                      )}
                      {ex.departedAt && !ex.returnedAt && (
                        <button onClick={() => api.boarding.recordReturn(ex.id).then(fetchAll)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition">
                          Record Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Roll call tab */}
      {!loading && activeTab === 'rollcall' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 shadow-sm">
          <CalendarCheck size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Click "Start Roll Call" to begin a morning or night roll call for a dormitory.</p>
          <p className="text-xs mt-1">After starting, mark each learner as Present, Absent, Excused, or On Exeat.</p>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

      {dormModal && (
        <Modal title="Add Dormitory" onClose={() => setDormModal(false)}>
          <form onSubmit={saveDorm} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Name</label>
              <input className={inputCls} value={dormForm.name} required
                onChange={e => setDormForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Block A" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Gender</label>
              <select className={selectCls} value={dormForm.gender}
                onChange={e => setDormForm(p => ({ ...p, gender: e.target.value }))}>
                <option value="BOYS">Boys</option>
                <option value="GIRLS">Girls</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Capacity</label>
              <input className={inputCls} type="number" min="0" value={dormForm.capacity}
                onChange={e => setDormForm(p => ({ ...p, capacity: e.target.value }))} placeholder="60" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDormModal(false)}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/20 transition disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Create Dormitory
              </button>
            </div>
          </form>
        </Modal>
      )}

      {exeatModal && (
        <Modal title="Request Exeat" onClose={() => setExeatModal(false)}>
          <form onSubmit={saveExeat} className="space-y-3">
            {[
              { label: 'Learner ID', key: 'learnerId', type: 'text', placeholder: 'Learner UUID or Admission No.' },
              { label: 'Departure Date', key: 'departureDate', type: 'date' },
              { label: 'Return Date', key: 'returnDate', type: 'date' },
              { label: 'Parent Phone', key: 'parentPhone', type: 'text', placeholder: '+254...' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{f.label}</label>
                <input className={inputCls} type={f.type} placeholder={f.placeholder} required={f.key !== 'parentPhone'}
                  value={exeatForm[f.key]} onChange={e => setExeatForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Type</label>
              <select className={selectCls} value={exeatForm.exeatType}
                onChange={e => setExeatForm(p => ({ ...p, exeatType: e.target.value }))}>
                {['WEEKEND', 'MEDICAL', 'FAMILY', 'OTHER'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Reason</label>
              <textarea className={inputCls} rows={2} required value={exeatForm.reason}
                onChange={e => setExeatForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setExeatModal(false)}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/20 disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Submit Request
              </button>
            </div>
          </form>
        </Modal>
      )}

      {rollCallModal && (
        <Modal title="Start Roll Call" onClose={() => setRollCallModal(false)}>
          <form onSubmit={startRollCall} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Dormitory</label>
              <select className={selectCls} required value={rollCallForm.dormitoryId}
                onChange={e => setRollCallForm(p => ({ ...p, dormitoryId: e.target.value }))}>
                <option value="">— Select —</option>
                {dorms.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Session</label>
              <select className={selectCls} value={rollCallForm.session}
                onChange={e => setRollCallForm(p => ({ ...p, session: e.target.value }))}>
                <option value="MORNING">Morning</option>
                <option value="NIGHT">Night</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Date</label>
              <input className={inputCls} type="date" value={rollCallForm.date}
                onChange={e => setRollCallForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setRollCallModal(false)}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/20 disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Start Roll Call
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default BoardingManager;
