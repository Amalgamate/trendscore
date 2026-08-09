import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  Cpu,
  Edit2,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { biometricAPI } from '../../../../services/api/biometric.api';

const EMPTY_FORM = {
  deviceId: '',
  name: '',
  type: 'TERMINAL',
  location: '',
  ipAddress: '',
  serialNumber: '',
  firmwareVersion: '',
  syncMode: 'PUSH',
};

const DeviceList = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [oneTimeToken, setOneTimeToken] = useState(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError('');
      setDevices(await biometricAPI.getDevices());
    } catch (err) {
      setError(err.message || 'Unable to load biometric terminals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) =>
      [device.name, device.deviceId, device.location, device.serialNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [devices, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (device) => {
    setEditingId(device.id);
    setForm({
      deviceId: device.deviceId,
      name: device.name || '',
      type: device.type || 'TERMINAL',
      location: device.location || '',
      ipAddress: device.ipAddress || '',
      serialNumber: device.serialNumber || '',
      firmwareVersion: device.firmwareVersion || '',
      syncMode: device.syncMode || 'PUSH',
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      if (editingId) {
        await biometricAPI.updateDevice(editingId, form);
      } else {
        const created = await biometricAPI.registerDevice(form);
        if (created?.deviceToken) {
          setOneTimeToken({ deviceId: created.deviceId, token: created.deviceToken });
        }
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await fetchDevices();
    } catch (err) {
      setError(err.message || 'Unable to save terminal configuration.');
    } finally {
      setSaving(false);
    }
  };

  const rotateToken = async (device) => {
    if (!window.confirm(`Rotate the token for ${device.name}? The existing token will stop working immediately.`)) return;
    try {
      const result = await biometricAPI.rotateDeviceToken(device.id);
      setOneTimeToken({ deviceId: result.deviceId, token: result.deviceToken });
      await fetchDevices();
    } catch (err) {
      setError(err.message || 'Token rotation failed.');
    }
  };

  const testConnection = async (device) => {
    try {
      const result = await biometricAPI.testDeviceConnection(device.id);
      setDevices((current) => current.map((item) => item.id === device.id ? result.device : item));
    } catch (err) {
      setError(err.message || 'Connection test failed.');
    }
  };

  const decommission = async (device) => {
    if (!window.confirm(`Decommission ${device.name}? Its token will be revoked, but audit logs will be retained.`)) return;
    try {
      await biometricAPI.decommissionDevice(device.id);
      await fetchDevices();
    } catch (err) {
      setError(err.message || 'Unable to decommission terminal.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search terminal name, hardware ID or serial number"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <button onClick={openCreate} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-indigo-600/20">
          <Plus size={16} /> Register terminal
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-xl shadow-indigo-500/5">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">{editingId ? 'Edit terminal' : 'Register a biometric terminal'}</h3>
              <p className="mt-1 text-xs text-slate-500">Hardware identity and connection details are stored for this school only.</p>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Hardware device ID" required value={form.deviceId} disabled={Boolean(editingId)} onChange={(value) => setForm({ ...form, deviceId: value })} placeholder="e.g. ZK-MAIN-001" />
            <Field label="Terminal name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Main Gate" />
            <Field label="Physical location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} placeholder="Front entrance" />
            <SelectField label="Terminal type" value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={['TERMINAL', 'FINGERPRINT', 'FACE', 'CARD']} />
            <SelectField label="Synchronization mode" value={form.syncMode} onChange={(value) => setForm({ ...form, syncMode: value })} options={['PUSH', 'PULL', 'BOTH']} />
            <Field label="IP address / hostname" value={form.ipAddress} onChange={(value) => setForm({ ...form, ipAddress: value })} placeholder="Required for PULL mode" />
            <Field label="Serial number" value={form.serialNumber} onChange={(value) => setForm({ ...form, serialNumber: value })} placeholder="Manufacturer serial" />
            <Field label="Firmware version" value={form.firmwareVersion} onChange={(value) => setForm({ ...form, firmwareVersion: value })} placeholder="e.g. 8.1.2" />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-5 py-3 text-xs font-semibold text-slate-600">Cancel</button>
            <button disabled={saving} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold text-white disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}{editingId ? 'Save changes' : 'Register terminal'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center rounded-3xl border border-slate-200 bg-white"><Loader2 className="animate-spin text-indigo-600" /></div>
      ) : filteredDevices.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
          <Cpu size={42} className="mb-4 text-slate-200" />
          <h3 className="font-semibold text-slate-700">No biometric terminals registered</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-400">Register the school’s first terminal, copy its one-time token, then follow Setup & API to send a test scan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredDevices.map((device) => {
            const online = device.status === 'ONLINE';
            const verified = device.installationStatus === 'VERIFIED';
            return (
              <article key={device.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-2xl p-3 ${online ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {online ? <Wifi size={24} /> : <WifiOff size={24} />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{device.name}</h3>
                      <p className="mt-1 font-mono text-xs text-slate-500">{device.deviceId}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {device.installationStatus}
                  </span>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 text-xs">
                  <Detail label="Location" value={device.location || 'Not set'} />
                  <Detail label="Mode" value={device.syncMode} />
                  <Detail label="Type" value={device.type} />
                  <Detail label="Last authenticated" value={device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'} />
                </dl>

                {device.lastConnectionTestMessage && (
                  <div className={`mt-5 rounded-2xl px-4 py-3 text-xs ${device.lastConnectionTestStatus === 'CONNECTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {device.lastConnectionTestMessage}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                  <ActionButton icon={Edit2} label="Edit" onClick={() => openEdit(device)} />
                  {device.status !== 'DISABLED' && (
                    <>
                      <ActionButton icon={RefreshCw} label="Test" onClick={() => testConnection(device)} />
                      <ActionButton icon={KeyRound} label="Rotate token" onClick={() => rotateToken(device)} />
                      <ActionButton icon={Trash2} label="Decommission" danger onClick={() => decommission(device)} />
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {oneTimeToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white p-7 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><ShieldCheck size={26} /></div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Copy the device token now</h3>
                <p className="mt-1 text-sm text-slate-500">This token is shown once. TrendScore stores only its cryptographic digest.</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Device ID</p>
              <p className="mt-1 font-mono text-sm">{oneTimeToken.deviceId}</p>
              <p className="mt-5 text-[10px] uppercase tracking-widest text-slate-400">Device token</p>
              <code className="mt-2 block break-all text-sm text-emerald-300">{oneTimeToken.token}</code>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => navigator.clipboard.writeText(oneTimeToken.token)} className="flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-xs font-semibold text-slate-700"><Clipboard size={15} /> Copy token</button>
              <button onClick={() => setOneTimeToken(null)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold text-white"><CheckCircle2 size={15} /> I saved it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder, required = false, disabled = false }) => (
  <label className="space-y-2 text-xs font-medium text-slate-600">
    <span>{label}</span>
    <input required={required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-60" />
  </label>
);

const SelectField = ({ label, value, onChange, options }) => (
  <label className="space-y-2 text-xs font-medium text-slate-600">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  </label>
);

const Detail = ({ label, value }) => <div><dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 font-medium text-slate-700">{value}</dd></div>;

const ActionButton = ({ icon: Icon, label, onClick, danger = false }) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold ${danger ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}>
    <Icon size={13} /> {label}
  </button>
);

export default DeviceList;
