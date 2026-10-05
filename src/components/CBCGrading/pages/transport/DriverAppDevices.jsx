/**
 * DriverAppDevices.jsx
 * Office-facing approval queue for the universal driver app.
 *
 * WHY THIS PAGE EXISTS
 * Every school is its own stack with its own database, so the one universal
 * driver APK is told which school to talk to by entering a short CODE. That code
 * is short and guessable — so on its own it would let anyone who typed the right
 * letters sign in and see a real school's routes, vehicle and learner list.
 *
 * A phone therefore has to be approved here before it may sign in. Until then
 * /api/auth/login refuses it with 403 DEVICE_NOT_APPROVED and the app shows
 * "Waiting for your school to approve this phone."
 *
 * Backend: GET /api/driver-devices, POST /api/driver-devices/:id/approve|revoke
 *           (requirePermission MANAGE_TRANSPORT_TRIPS)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, ShieldCheck, XCircle, Loader2, RefreshCw, Clock, CheckCircle2, Ban, Trash2 } from 'lucide-react';
import { transportAPI } from '../../../../services/api/transport.api';

const unwrap = (r) => r?.data?.data || r?.data || null;

const STATUS_STYLE = {
  PENDING:  { chip: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Pending',  Icon: Clock },
  APPROVED: { chip: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Approved', Icon: CheckCircle2 },
  REVOKED:  { chip: 'bg-slate-200 text-slate-700 border-slate-300', label: 'Revoked',  Icon: Ban },
};

const fmt = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleString(); } catch { return String(v); }
};

export default function DriverAppDevices() {
  const [devices, setDevices] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await transportAPI.listDriverDevices(filter || undefined);
      setDevices(unwrap(res) || []);
      setSelectedIds([]);
    } catch (e) {
      setError(e?.message || 'Could not load driver devices.');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (device, action) => {
    setBusyId(device.id);
    setError('');
    try {
      if (action === 'approve') await transportAPI.approveDriverDevice(device.id);
      else await transportAPI.revokeDriverDevice(device.id);
      await load();
    } catch (e) {
      setError(e?.message || `Could not ${action} that device.`);
    } finally {
      setBusyId(null);
    }
  };

  const pending = devices.filter((d) => d.status === 'PENDING').length;
  const revokedDevices = devices.filter((d) => d.status === 'REVOKED');
  const selectedRevokedIds = selectedIds.filter((id) => revokedDevices.some((d) => d.id === id));

  const toggleSelected = (id) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const toggleAllRevoked = () => {
    const allSelected = revokedDevices.length > 0 && revokedDevices.every((d) => selectedIds.includes(d.id));
    setSelectedIds(allSelected ? [] : revokedDevices.map((d) => d.id));
  };

  const deleteDevices = async (ids) => {
    if (!ids.length) return;
    const message = ids.length === 1
      ? 'Permanently delete this revoked phone from the school device list?'
      : `Permanently delete these ${ids.length} revoked phones from the school device list?`;
    if (!window.confirm(message)) return;

    setDeleting(true);
    setError('');
    try {
      if (ids.length === 1) await transportAPI.deleteRevokedDriverDevice(ids[0]);
      else await transportAPI.deleteRevokedDriverDevices(ids);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e?.message || 'Could not delete the revoked device records.');
    } finally {
      setDeleting(false);
    }
  };

return (
    <div className="p-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Smartphone size={20} /> Driver App Devices
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Phones that asked to drive for this school using the driver app. A driver signs
            in with a school <strong>code</strong>, so a code alone is not enough — approve
            the phone here before it can sign in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <span className="px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              {pending} awaiting approval
            </span>
          )}
          <button
            onClick={load}
            className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {['', 'PENDING', 'APPROVED', 'REVOKED'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`h-8 px-3 text-xs font-medium border ${
              filter === s
                ? 'border-brand-purple bg-brand-purple text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {s === '' ? 'All' : STATUS_STYLE[s].label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && revokedDevices.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-white px-3 py-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={revokedDevices.every((d) => selectedRevokedIds.includes(d.id))}
              onChange={toggleAllRevoked}
              disabled={deleting}
              aria-label="Select all revoked phones"
            />
            Select revoked phones ({revokedDevices.length})
          </label>
          <button
            type="button"
            onClick={() => deleteDevices(selectedRevokedIds)}
            disabled={!selectedRevokedIds.length || deleting}
            className="inline-flex h-9 items-center gap-1.5 border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete selected{selectedRevokedIds.length ? ` (${selectedRevokedIds.length})` : ''}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600 py-6">
          <Loader2 size={16} className="animate-spin" /> Loading devices…
        </div>
      ) : devices.length === 0 ? (
        <div className="border border-slate-200 bg-white px-4 py-8 text-center">
          <Smartphone size={28} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">No driver phones yet</p>
          <p className="mt-1 text-xs text-slate-500">
            When a driver opens the app and enters your school code, the phone appears here
            as Pending.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {devices.map((d) => {
            const st = STATUS_STYLE[d.status] || STATUS_STYLE.PENDING;
            const Icon = st.Icon;
            const busy = busyId === d.id;
            return (
              <li key={d.id} className="border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {d.status === 'REVOKED' && (
                        <input
                          type="checkbox"
                          checked={selectedRevokedIds.includes(d.id)}
                          onChange={() => toggleSelected(d.id)}
                          disabled={deleting}
                          aria-label={`Select ${d.label || 'revoked phone'}`}
                        />
                      )}
                      <Smartphone size={15} className="text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-900 truncate">
                        {d.label || 'Unnamed phone'}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase border ${st.chip} inline-flex items-center gap-1`}>
                        <Icon size={10} /> {st.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 font-mono truncate">{d.deviceId}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Requested {fmt(d.requestedAt)}
                      {d.approvedAt ? ` · Approved ${fmt(d.approvedAt)}` : ''}
                      {d.lastSeenAt ? ` · Last seen ${fmt(d.lastSeenAt)}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {d.status !== 'APPROVED' && (
                      <button
                        onClick={() => act(d, 'approve')}
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1.5 border border-emerald-600 bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        Approve
                      </button>
                    )}
                    {d.status !== 'REVOKED' && (
                      <button
                        onClick={() => act(d, 'revoke')}
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1.5 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <XCircle size={14} /> Revoke
                      </button>
                    )}
                    {d.status === 'REVOKED' && (
                      <button
                        onClick={() => deleteDevices([d.id])}
                        disabled={deleting}
                        className="inline-flex h-9 items-center gap-1.5 border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
