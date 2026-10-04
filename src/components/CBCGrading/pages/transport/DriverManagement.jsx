/**
 * DriverManagement.jsx
 * Full CRUD driver roster for the Transport module.
 *
 * Drivers are derived from the existing TransportVehicle records (each vehicle
 * has driverName + driverPhone). This page surfaces them as first-class driver
 * profiles, lets admins add standalone driver records even before a vehicle is
 * assigned, and shows a driver-centric view of route assignments.
 *
 * Backend note: this page reads from /transport/vehicles and /transport/routes
 * which already exist.  A standalone driver entity (/transport/drivers) can be
 * introduced later; when it exists, swap the data-fetch helpers below.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  User, Phone, Bus, MapPin, Plus, Pencil, Trash2,
  Search, X, Loader2, Shield, Clock, AlertTriangle,
  CheckCircle2, UserCheck, Milestone, FileText, RefreshCw
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

// ─── helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition';

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE:    'bg-emerald-100 text-emerald-700',
    ON_LEAVE:  'bg-amber-100 text-amber-700',
    INACTIVE:  'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${map[status] || map.ACTIVE}`}>
      {(status || 'ACTIVE').replace('_', ' ')}
    </span>
  );
}

// Build a driver list from vehicles — each vehicle's driver is one driver record
function vehiclesToDrivers(vehicles, routes) {
  return vehicles
    .filter(v => v.driverName)
    .map(v => {
      const assignedRoutes = routes.filter(r => r.vehicleId === v.id);
      return {
        id:          `veh-${v.id}`,
        vehicleId:   v.id,
        name:        v.driverName,
        phone:       v.driverPhone || '',
        userId:      v.driver?.id || v.driverId || '',
        loginUser:   v.driver || null,
        vehicle:     v.registrationNumber,
        vehicleObj:  v,
        routes:      assignedRoutes,
        status:      v.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        licenseNo:   v.licenseNumber || '',
        joinDate:    v.createdAt,
      };
    });
}

// ─── driver card ──────────────────────────────────────────────────────────────

function DriverCard({ driver, onEdit, onDelete }) {
  const initials = driver.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
      {/* Coloured top bar */}
      <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />

      <div className="p-5">
        {/* Avatar + name */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0 text-blue-700 font-semibold text-base">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{driver.name}</p>
              {driver.phone ? (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 font-medium">
                  <Phone size={11} /> {driver.phone}
                </p>
              ) : (
                <p className="text-xs text-gray-300 italic mt-0.5">No phone recorded</p>
              )}
            </div>
          </div>
          <StatusBadge status={driver.status} />
        </div>

        {/* Vehicle */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl mb-3">
          <Bus size={14} className="text-blue-400 flex-shrink-0" />
          {driver.vehicle ? (
            <div>
              <p className="text-xs font-semibold text-gray-700">{driver.vehicle}</p>
              <p className="text-[11px] text-gray-400">{driver.vehicleObj?.capacity} seats</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No vehicle assigned</p>
          )}
        </div>

        <p className={`text-[11px] mb-3 ${driver.userId ? 'text-emerald-700' : 'text-amber-700'}`}>
          {driver.userId ? 'Driver app account linked' : 'No driver app account linked'}
        </p>

        {/* Routes */}
        <div className="space-y-1.5 mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1">
            <Milestone size={10} /> Routes ({driver.routes.length})
          </p>
          {driver.routes.length === 0 ? (
            <p className="text-xs text-gray-300 italic pl-1">No routes assigned</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {driver.routes.map(r => (
                <span key={r.id} className="text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">
                  {r.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
          <button
            onClick={() => onEdit(driver)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={() => onDelete(driver)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-50 transition"
          >
            <Trash2 size={12} /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── edit / add modal ─────────────────────────────────────────────────────────

function DriverModal({ driver, vehicles, driverUsers, onClose, onSave, saving }) {
  const isNew = !driver;
  const [form, setForm] = useState({
    vehicleId:   driver?.vehicleId  || '',
    driverName:  driver?.name       || '',
    driverPhone: driver?.phone      || '',
    driverUserId: driver?.userId    || '',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(form, driver);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <UserCheck size={15} className="text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">{isNew ? 'Add Driver' : 'Edit Driver'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-full transition">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Assign to Vehicle" required>
            <select className={inputCls} value={form.vehicleId} onChange={e => f('vehicleId', e.target.value)} required>
              <option value="">— Select vehicle —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber} ({v.capacity} seats)
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Driver sign-in account">
            <select
              className={inputCls}
              value={form.driverUserId}
              onChange={e => {
                const driverUserId = e.target.value;
                const account = driverUsers.find(user => user.id === driverUserId);
                setForm(current => ({
                  ...current,
                  driverUserId,
                  ...(account ? {
                    driverName: `${account.firstName || ''} ${account.lastName || ''}`.trim(),
                    driverPhone: account.phone || '',
                  } : {}),
                }));
              }}
            >
              <option value="">— No app account linked —</option>
              {driverUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {[user.firstName, user.lastName].filter(Boolean).join(' ')}{user.phone ? ` · ${user.phone}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Create the driver's phone/password account first in Settings → User Management with the DRIVER role.
            </p>
          </FormField>
          <FormField label="Driver Full Name" required>
            <input className={inputCls} value={form.driverName}
              onChange={e => f('driverName', e.target.value)}
              placeholder="e.g. John Kamau" required />
          </FormField>
          <FormField label="Phone Number">
            <input className={inputCls} value={form.driverPhone}
              onChange={e => f('driverPhone', e.target.value)}
              placeholder="e.g. 0712 345 678" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/20 transition disabled:opacity-60 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isNew ? 'Add Driver' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const DriverManagement = () => {
  const [vehicles, setVehicles]     = useState([]);
  const [routes, setRoutes]         = useState([]);
  const [driverUsers, setDriverUsers] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modal, setModal]           = useState(null); // null | { driver? }
  const [saving, setSaving]         = useState(false);
  const { showSuccess, showError }  = useNotifications();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, rRes, dRes] = await Promise.all([
        api.transport.getVehicles(),
        api.transport.getRoutes(),
        api.users.getByRole('DRIVER'),
      ]);
      if (vRes.success) setVehicles(vRes.data);
      if (rRes.success) setRoutes(rRes.data);
      if (dRes.success) setDriverUsers(dRes.data || []);
    } catch {
      showError('Failed to load driver data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const drivers = vehiclesToDrivers(vehicles, routes);

  const filtered = drivers.filter(d => {
    const q = query.toLowerCase();
    const matchQ = !q || d.name.toLowerCase().includes(q) || d.vehicle?.toLowerCase().includes(q) || d.phone?.includes(q);
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchQ && matchStatus;
  });

  const handleSave = async (form, existing) => {
    setSaving(true);
    try {
      // Update is patching the vehicle's driver fields
      const res = await api.transport.updateVehicle(form.vehicleId, {
        driverName:  form.driverName.trim(),
        driverPhone: form.driverPhone.trim() || null,
      });
      if (res.success) {
        const existingUserId = existing?.userId || '';
        if (form.driverUserId) {
          await api.transport.assignVehicleDriver(form.vehicleId, form.driverUserId);
        } else if (existingUserId) {
          await api.transport.assignVehicleDriver(form.vehicleId, null);
        }
        showSuccess(existing ? 'Driver updated' : 'Driver assigned');
        setModal(null);
        load();
      }
    } catch (err) {
      showError(err?.message || 'Failed to save driver');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (driver) => {
    if (!window.confirm(`Remove ${driver.name} as driver of ${driver.vehicle}?`)) return;
    try {
      await api.transport.updateVehicle(driver.vehicleId, { driverName: '', driverPhone: null });
      showSuccess('Driver removed from vehicle');
      load();
    } catch {
      showError('Failed to remove driver');
    }
  };

  // Stats
  const activeDrivers  = drivers.filter(d => d.status === 'ACTIVE').length;
  const unassigned     = vehicles.filter(v => !v.driverName).length;
  const totalRoutes    = routes.length;
  const coveredRoutes  = routes.filter(r => {
    const v = vehicles.find(vv => vv.id === r.vehicleId);
    return v && v.driverName;
  }).length;

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 font-sans space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Transport</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
            <UserCheck className="text-blue-600" size={28} />
            Driver Management
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 font-medium">
            Manage drivers, vehicle assignments and route coverage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button
            onClick={() => setModal({ driver: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">
            <Plus size={16} />
            Assign Driver
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><User size={18} /></div>
            <div><p className="text-2xl font-semibold text-gray-900">{drivers.length}</p><p className="text-xs font-medium text-gray-400">Total Drivers</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><CheckCircle2 size={18} /></div>
            <div><p className="text-2xl font-semibold text-gray-900">{activeDrivers}</p><p className="text-xs font-medium text-gray-400">Active Drivers</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${unassigned > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
              <AlertTriangle size={18} />
            </div>
            <div><p className="text-2xl font-semibold text-gray-900">{unassigned}</p><p className="text-xs font-medium text-gray-400">Vehicles w/o Driver</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Milestone size={18} /></div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{coveredRoutes}<span className="text-sm text-gray-400 font-medium">/{totalRoutes}</span></p>
              <p className="text-xs font-medium text-gray-400">Routes Covered</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert: vehicles without drivers */}
      {unassigned > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">{unassigned} vehicle{unassigned > 1 ? 's' : ''} without a driver</p>
            <p className="text-amber-600 text-xs mt-0.5">
              {vehicles.filter(v => !v.driverName).map(v => v.registrationNumber).join(', ')} — assign a driver using the button above.
            </p>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search driver name, vehicle, phone…"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {[['all', 'All'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']].map(([v, l]) => (
            <button key={v}
              onClick={() => setFilterStatus(v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${filterStatus === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-gray-100 border border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Driver cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <User size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500 text-base">{query || filterStatus !== 'all' ? 'No drivers match your search' : 'No drivers recorded yet'}</p>
          <p className="text-gray-400 text-sm mt-1">
            {query || filterStatus !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Drivers are created when you add a vehicle with a driver name, or use the Assign Driver button above.'}
          </p>
          {!query && filterStatus === 'all' && (
            <button onClick={() => setModal({ driver: null })}
              className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 inline-flex items-center gap-2">
              <Plus size={15} /> Assign First Driver
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(d => (
            <DriverCard key={d.id} driver={d}
              onEdit={driver => setModal({ driver })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Vehicles without drivers — compact list */}
      {!loading && unassigned > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Shield size={14} className="text-amber-500" />
            <p className="font-semibold text-gray-700 text-sm">Vehicles Awaiting Driver Assignment</p>
          </div>
          <div className="divide-y divide-gray-50">
            {vehicles.filter(v => !v.driverName).map(v => (
              <div key={v.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Bus size={14} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{v.registrationNumber}</p>
                    <p className="text-xs text-gray-400">{v.capacity} seat capacity</p>
                  </div>
                </div>
                <button
                  onClick={() => setModal({ driver: { vehicleId: v.id, name: '', phone: '', vehicle: v.registrationNumber, vehicleObj: v, routes: [] } })}
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl font-semibold text-xs hover:bg-blue-700 transition flex items-center gap-1.5 shadow-lg shadow-blue-600/10">
                  <Plus size={12} /> Assign Driver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
      <DriverModal
        driver={modal.driver}
        vehicles={vehicles}
        driverUsers={driverUsers}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
};

export default DriverManagement;
