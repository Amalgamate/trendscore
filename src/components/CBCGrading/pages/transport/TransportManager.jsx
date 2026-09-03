import React, { useState, useEffect, useCallback } from 'react';
import {
    Bus, MapPin, Users, Plus, Trash2, UserPlus,
    Loader2, Pencil, X, AlertTriangle, CreditCard,
    Phone, Search, RefreshCw
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import SmartLearnerSearch from '../../shared/SmartLearnerSearch';
import usePageNavigation from '../../../../hooks/usePageNavigation';

// ─── small helpers ────────────────────────────────────────────────────────────

const EMPTY_VEHICLE = { registrationNumber: '', capacity: '', driverName: '', driverPhone: '' };
const EMPTY_ROUTE   = { name: '', description: '', amount: '', vehicleId: '' };

const fmt = (n) => `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

function CapacityBadge({ assigned, capacity }) {
    if (!capacity) return null;
    const pct  = Math.round((assigned / capacity) * 100);
    const full  = assigned >= capacity;
    const warn  = pct >= 80;
    const color = full ? 'bg-red-100 text-red-700' : warn ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
    return (
        <span className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
            {assigned}/{capacity}
        </span>
    );
}

function Modal({ title, onClose, children, wide = false }) {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} my-8 overflow-hidden`}>
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-lg font-semibold text-gray-900 tracking-tight">{title}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}

function FormField({ label, required, hint, children }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                {label} {required && <span className="text-red-500 normal-case">*</span>}
            </label>
            {children}
            {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
        </div>
    );
}

const inputCls = 'w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition';
const inputErrCls = 'w-full border border-red-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition bg-red-50';

// ─── vehicle form ─────────────────────────────────────────────────────────────

function VehicleForm({ data, onChange, errors = {} }) {
    return (
        <div className="space-y-4">
            <FormField label="Registration Number" required>
                <input className={errors.registrationNumber ? inputErrCls : inputCls}
                    value={data.registrationNumber}
                    onChange={e => onChange({ ...data, registrationNumber: e.target.value })}
                    placeholder="e.g. KAB 123C" />
                {errors.registrationNumber && <p className="text-xs text-red-500 font-medium mt-1">{errors.registrationNumber}</p>}
            </FormField>
            <FormField label="Capacity (seats)" required>
                <input className={errors.capacity ? inputErrCls : inputCls}
                    type="number" min="1" value={data.capacity}
                    onChange={e => onChange({ ...data, capacity: e.target.value })} />
                {errors.capacity && <p className="text-xs text-red-500 font-medium mt-1">{errors.capacity}</p>}
            </FormField>
            <FormField label="Driver Name" required>
                <input className={errors.driverName ? inputErrCls : inputCls}
                    value={data.driverName}
                    onChange={e => onChange({ ...data, driverName: e.target.value })}
                    placeholder="Full name of assigned driver" />
                {errors.driverName && <p className="text-xs text-red-500 font-medium mt-1">{errors.driverName}</p>}
            </FormField>
            <FormField label="Driver Phone" required hint="Required — used for parent communications and emergency contact.">
                <input className={errors.driverPhone ? inputErrCls : inputCls}
                    value={data.driverPhone}
                    onChange={e => onChange({ ...data, driverPhone: e.target.value })}
                    placeholder="e.g. 0712 345 678" />
                {errors.driverPhone && <p className="text-xs text-red-500 font-medium mt-1">{errors.driverPhone}</p>}
            </FormField>
        </div>
    );
}

// ─── route form ───────────────────────────────────────────────────────────────

function RouteForm({ data, onChange, vehicles, errors = {} }) {
    return (
        <div className="space-y-4">
            <FormField label="Route Name" required>
                <input className={errors.name ? inputErrCls : inputCls}
                    value={data.name}
                    onChange={e => onChange({ ...data, name: e.target.value })}
                    placeholder="e.g. Westlands – Kileleshwa" />
                {errors.name && <p className="text-xs text-red-500 font-medium mt-1">{errors.name}</p>}
            </FormField>
            <FormField label="Transport Fee per Term (KES)" required hint="This amount is automatically added to every student's invoice when assigned to this route.">
                <input className={errors.amount ? inputErrCls : inputCls}
                    type="number" step="0.01" min="0" value={data.amount}
                    onChange={e => onChange({ ...data, amount: e.target.value })} />
                {errors.amount && <p className="text-xs text-red-500 font-medium mt-1">{errors.amount}</p>}
            </FormField>
            <FormField label="Assigned Vehicle" hint={vehicles.length === 0 ? 'No vehicles configured yet — add a vehicle first to assign capacity.' : undefined}>
                {vehicles.length === 0 ? (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        No vehicles have been registered yet. Add a vehicle from the Fleet Vehicles tab, then come back to assign it to this route.
                    </div>
                ) : (
                    <select className={inputCls} value={data.vehicleId}
                        onChange={e => onChange({ ...data, vehicleId: e.target.value })}>
                        <option value="">— No vehicle assigned —</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                                {v.registrationNumber} · {v.driverName} ({v.capacity} seats)
                            </option>
                        ))}
                    </select>
                )}
            </FormField>
            <FormField label="Stops / Description">
                <textarea className={inputCls} rows={3} value={data.description}
                    onChange={e => onChange({ ...data, description: e.target.value })}
                    placeholder="List major pick-up stops, e.g. Westlands roundabout → Sarit Centre → Kileleshwa…" />
            </FormField>
        </div>
    );
}

// ─── summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ summary }) {
    if (!summary) return null;
    const COLORS = ['#1d4ed8', '#b45309', '#065f46', '#7c3aed']; // Blue, Amber, Green, Violet
    const cards = [
        { label: 'Vehicles',           value: summary.vehicleCount, icon: Bus },
        { label: 'Routes',             value: summary.routeCount, icon: MapPin },
        { label: 'Assignments',        value: summary.assignmentCount, icon: UserPlus },
        { label: 'Transport Students', value: summary.transportStudentCount, icon: Users },
    ];
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {cards.map((c, idx) => {
                const Icon = c.icon;
                const bgColor = COLORS[idx % COLORS.length];
                return (
                    <div key={c.label} className="relative overflow-hidden p-5 text-white select-none" style={{ backgroundColor: bgColor }}>
                        <div className="pointer-events-none absolute -bottom-4 -right-4 text-white/10">
                            <Icon size={90} strokeWidth={1} />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70 mb-3">{c.label}</p>
                        <div className="flex items-end justify-between gap-2">
                            <p className="text-4xl font-black tracking-tight leading-none text-white">{c.value ?? '—'}</p>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-white/20 border border-white/30 self-start">
                                <Icon size={18} strokeWidth={2.2} className="text-white/90" />
                            </span>
                        </div>
                    </div>
                );
            })}
            {summary.overCapacityRoutes?.length > 0 && (
                <div className="col-span-2 md:col-span-4 flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 font-medium">
                    <AlertTriangle size={16} />
                    Over-capacity: {summary.overCapacityRoutes.map(r => `${r.name} (${r.assigned}/${r.capacity})`).join(', ')}
                </div>
            )}
        </div>
    );
}

// ─── empty-state helpers ──────────────────────────────────────────────────────

function EmptyVehicles({ onAdd }) {
    return (
        <tr>
            <td colSpan={5} className="p-0">
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                        <Bus size={32} className="text-blue-400" />
                    </div>
                    <div>
                        <p className="text-base font-semibold text-gray-700">No vehicles registered yet</p>
                        <p className="text-sm text-gray-400 mt-1 max-w-sm">
                            Add your school buses here first. Each vehicle needs a registration number,
                            driver name, driver phone number, and seating capacity before it can be
                            assigned to a route.
                        </p>
                    </div>
                    <button onClick={onAdd}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">
                        <Plus size={16} /> Add First Vehicle
                    </button>
                </div>
            </td>
        </tr>
    );
}

function EmptyRoutes({ onAdd, hasVehicles }) {
    return (
        <tr>
            <td colSpan={5} className="p-0">
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                        <MapPin size={32} className="text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-base font-semibold text-gray-700">No bus routes configured yet</p>
                        <p className="text-sm text-gray-400 mt-1 max-w-sm">
                            {hasVehicles
                                ? 'Create a route for each bus path. Set the route name, pickup stops, and the transport fee per term. Students admitted as transport students will automatically be charged when assigned to a route.'
                                : 'You need at least one vehicle before creating routes. Go to Fleet Vehicles and register your buses first.'}
                        </p>
                    </div>
                    {hasVehicles ? (
                        <button onClick={onAdd}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20">
                            <Plus size={16} /> Create First Route
                        </button>
                    ) : (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium max-w-sm">
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                            Register a vehicle first — routes must be linked to a vehicle to enforce capacity limits.
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ─── transport students inline panel ─────────────────────────────────────────

function TransportStudentsPanel({ navigateTo }) {
    const [roster, setRoster]       = useState([]);
    const [loading, setLoading]     = useState(true);
    const [query, setQuery]         = useState('');
    const { showError }             = useNotifications();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.transport.getReports();
            if (res?.success) setRoster(res.data?.roster || []);
        } catch {
            showError('Failed to load transport students');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = roster.filter(s => {
        if (!query) return true;
        const q = query.toLowerCase();
        return s.name?.toLowerCase().includes(q)
            || s.admissionNumber?.toLowerCase().includes(q)
            || s.routeName?.toLowerCase().includes(q);
    });

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center py-20">
                <div className="flex items-center gap-3 text-gray-400 text-sm font-medium">
                    <Loader2 size={20} className="animate-spin" /> Loading transport students…
                </div>
            </div>
        );
    }

    if (roster.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                        <Users size={32} className="text-blue-400" />
                    </div>
                    <div>
                        <p className="text-base font-semibold text-gray-700">No transport students yet</p>
                        <p className="text-sm text-gray-400 mt-1 max-w-sm">
                            Students show here once they are admitted with the "Transport Student" flag enabled,
                            or when you assign an existing student to a route from the Bus Routes &amp; Roster tab.
                            Their transport fee is applied automatically.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* toolbar */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="Search by name, admission no or route…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                    {query && (
                        <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={13} />
                        </button>
                    )}
                </div>
                <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-gray-500 border border-gray-200 rounded-xl text-xs font-medium hover:bg-gray-50 transition">
                    <RefreshCw size={13} /> Refresh
                </button>
                <button onClick={() => navigateTo('transport-students')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">
                    <CreditCard size={13} /> Fee Tracker
                </button>
            </div>

            {/* table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-semibold tracking-widest text-gray-400">
                        <tr>
                            <th className="p-4">Student</th>
                            <th className="p-4">Grade</th>
                            <th className="p-4">Route</th>
                            <th className="p-4">Vehicle / Driver</th>
                            <th className="p-4 text-right">Fee / Term</th>
                            <th className="p-4">Contact</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filtered.map((s, i) => (
                            <tr key={s.learnerId || i} className="hover:bg-blue-50/10 transition">
                                <td className="p-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-semibold text-xs flex-shrink-0">
                                            {s.name?.split(' ').map(w => w[0]).slice(0, 2).join('')}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                                            <p className="text-[11px] text-gray-400 font-medium">{s.admissionNumber}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-xs font-medium text-gray-600">
                                    {s.grade?.replace(/_/g, ' ')} {s.stream || ''}
                                </td>
                                <td className="p-4">
                                    {s.routeName
                                        ? <span className="text-xs font-semibold text-indigo-600">{s.routeName}</span>
                                        : <span className="text-[10px] font-semibold text-amber-600 border border-amber-200 px-2 py-0.5 rounded-lg">No route assigned</span>
                                    }
                                    {s.pickupPoint && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">📍 {s.pickupPoint}</p>
                                    )}
                                </td>
                                <td className="p-4">
                                    {s.vehicle ? (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-700">{s.vehicle}</p>
                                            <p className="text-[11px] text-gray-400">{s.driverName || '—'}</p>
                                            {s.driverPhone && (
                                                <a href={`tel:${s.driverPhone}`} className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                                                    <Phone size={9} /> {s.driverPhone}
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-amber-500 font-semibold border border-amber-200 px-2 py-0.5 rounded-lg">No vehicle</span>
                                    )}
                                </td>
                                <td className="p-4 text-right font-semibold text-emerald-600 text-sm">
                                    {s.feePerTerm > 0 ? fmt(s.feePerTerm) : <span className="text-gray-300 font-normal text-xs">Not set</span>}
                                </td>
                                <td className="p-4">
                                    {s.phone ? (
                                        <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-xs text-blue-500 hover:underline font-medium">
                                            <Phone size={11} /> {s.phone}
                                        </a>
                                    ) : (
                                        <span className="text-[10px] text-gray-300 italic">No contact</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-gray-400 text-sm italic">
                                    No students match "{query}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {filtered.length > 0 && (
                        <tfoot className="border-t-2 border-gray-100 bg-gray-50">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                                    {filtered.length} student{filtered.length !== 1 ? 's' : ''}
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-600">
                                    {fmt(filtered.reduce((s, r) => s + (r.feePerTerm || 0), 0))} / term
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}

// ─── vehicle form validation ──────────────────────────────────────────────────

function validateVehicle(data) {
    const errors = {};
    if (!data.registrationNumber?.trim()) errors.registrationNumber = 'Registration number is required';
    if (!data.capacity || isNaN(Number(data.capacity)) || Number(data.capacity) < 1) errors.capacity = 'Enter a valid seat count';
    if (!data.driverName?.trim()) errors.driverName = 'Driver name is required';
    if (!data.driverPhone?.trim()) errors.driverPhone = 'Driver phone number is required — parents and emergency contacts depend on this';
    return errors;
}

function validateRoute(data) {
    const errors = {};
    if (!data.name?.trim()) errors.name = 'Route name is required';
    if (data.amount === '' || isNaN(Number(data.amount)) || Number(data.amount) < 0) errors.amount = 'Enter a valid fee amount (0 if free)';
    return errors;
}

// ─── main component ───────────────────────────────────────────────────────────

const TransportManager = () => {
    const [activeTab, setActiveTab]     = useState('vehicles');
    const navigateTo = usePageNavigation();
    const [vehicles, setVehicles]       = useState([]);
    const [routes, setRoutes]           = useState([]);
    const [summary, setSummary]         = useState(null);
    const [loading, setLoading]         = useState(false);
    const { showSuccess, showError }    = useNotifications();

    // Add / Edit vehicle
    const [vehicleModal, setVehicleModal]   = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [vehicleForm, setVehicleForm]     = useState(EMPTY_VEHICLE);
    const [vehicleErrors, setVehicleErrors] = useState({});
    const [savingVehicle, setSavingVehicle] = useState(false);

    // Add / Edit route
    const [routeModal, setRouteModal]     = useState(false);
    const [editingRoute, setEditingRoute] = useState(null);
    const [routeForm, setRouteForm]       = useState(EMPTY_ROUTE);
    const [routeErrors, setRouteErrors]   = useState({});
    const [savingRoute, setSavingRoute]   = useState(false);

    // Passenger management
    const [passengerModal, setPassengerModal] = useState(false);
    const [selectedRoute, setSelectedRoute]   = useState(null);
    const [passengers, setPassengers]         = useState([]);
    const [allLearners, setAllLearners]       = useState([]);
    const [newPassengerId, setNewPassengerId] = useState('');
    const [addingPassenger, setAddingPassenger] = useState(false);
    const [loadingPassengers, setLoadingPassengers] = useState(false);

    // ── data fetching ─────────────────────────────────────────────────────────

    const fetchSummary = useCallback(async () => {
        try {
            const res = await api.transport.getSummary();
            if (res.success) setSummary(res.data);
        } catch { /* non-fatal */ }
    }, []);

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.transport.getVehicles();
            if (res.success) setVehicles(res.data);
        } catch { showError('Failed to load vehicles'); }
        finally { setLoading(false); }
    }, []);

    const fetchRoutes = useCallback(async () => {
        setLoading(true);
        try {
            const [rRes, vRes] = await Promise.all([
                api.transport.getRoutes(),
                api.transport.getVehicles()
            ]);
            if (rRes.success) setRoutes(rRes.data);
            if (vRes.success) setVehicles(vRes.data);
        } catch { showError('Failed to load routes'); }
        finally { setLoading(false); }
    }, []);

    const fetchAllLearners = useCallback(async () => {
        if (allLearners.length > 0) return;
        try {
            const res = await api.learners.getAll({ limit: 1000 });
            setAllLearners(res.data || []);
        } catch (err) {
            showError('Failed to load learner list for assignment');
        }
    }, [allLearners.length]);

    useEffect(() => {
        fetchSummary();
        if (activeTab === 'vehicles') fetchVehicles();
        else if (activeTab === 'routes') fetchRoutes();
    }, [activeTab]);

    // ── vehicle CRUD ──────────────────────────────────────────────────────────

    const openAddVehicle = () => {
        setEditingVehicle(null);
        setVehicleForm(EMPTY_VEHICLE);
        setVehicleErrors({});
        setVehicleModal(true);
    };

    const openEditVehicle = (v) => {
        setEditingVehicle(v);
        setVehicleForm({
            registrationNumber: v.registrationNumber,
            capacity:           String(v.capacity),
            driverName:         v.driverName,
            driverPhone:        v.driverPhone || ''
        });
        setVehicleErrors({});
        setVehicleModal(true);
    };

    const saveVehicle = async (e) => {
        e.preventDefault();
        const errs = validateVehicle(vehicleForm);
        if (Object.keys(errs).length > 0) { setVehicleErrors(errs); return; }
        setSavingVehicle(true);
        try {
            if (editingVehicle) {
                const res = await api.transport.updateVehicle(editingVehicle.id, vehicleForm);
                if (res.success) { showSuccess('Vehicle updated'); fetchVehicles(); fetchSummary(); }
            } else {
                const res = await api.transport.createVehicle(vehicleForm);
                if (res.success) { showSuccess('Vehicle added'); fetchVehicles(); fetchSummary(); }
            }
            setVehicleModal(false);
        } catch (err) {
            showError(err?.message || 'Failed to save vehicle');
        } finally { setSavingVehicle(false); }
    };

    const deleteVehicle = async (id) => {
        if (!window.confirm('Archive this vehicle?')) return;
        try {
            await api.transport.deleteVehicle(id);
            showSuccess('Vehicle archived');
            fetchVehicles();
            fetchSummary();
        } catch { showError('Failed to archive vehicle'); }
    };

    // ── route CRUD ────────────────────────────────────────────────────────────

    const openAddRoute = () => {
        setEditingRoute(null);
        setRouteForm(EMPTY_ROUTE);
        setRouteErrors({});
        setRouteModal(true);
    };

    const openEditRoute = (r) => {
        setEditingRoute(r);
        setRouteForm({
            name:        r.name,
            description: r.description || '',
            amount:      String(r.amount),
            vehicleId:   r.vehicleId || ''
        });
        setRouteErrors({});
        setRouteModal(true);
    };

    const saveRoute = async (e) => {
        e.preventDefault();
        const errs = validateRoute(routeForm);
        if (Object.keys(errs).length > 0) { setRouteErrors(errs); return; }
        setSavingRoute(true);
        try {
            if (editingRoute) {
                const res = await api.transport.updateRoute(editingRoute.id, routeForm);
                if (res.success) { showSuccess('Route updated'); fetchRoutes(); fetchSummary(); }
            } else {
                const res = await api.transport.createRoute(routeForm);
                if (res.success) { showSuccess('Route created'); fetchRoutes(); fetchSummary(); }
            }
            setRouteModal(false);
        } catch (err) {
            showError(err?.message || 'Failed to save route');
        } finally { setSavingRoute(false); }
    };

    const deleteRoute = async (id) => {
        if (!window.confirm('Archive this route?')) return;
        try {
            await api.transport.deleteRoute(id);
            showSuccess('Route archived');
            fetchRoutes();
            fetchSummary();
        } catch { showError('Failed to archive route'); }
    };

    // ── passenger management ──────────────────────────────────────────────────

    const openPassengerModal = async (route) => {
        setSelectedRoute(route);
        setPassengerModal(true);
        setNewPassengerId('');
        setLoadingPassengers(true);
        fetchAllLearners();
        try {
            const res = await api.transport.getAssignments(route.id);
            if (res.success) setPassengers(res.data);
        } catch { showError('Failed to load passengers'); }
        finally { setLoadingPassengers(false); }
    };

    const refreshPassengers = async () => {
        if (!selectedRoute) return;
        try {
            const res = await api.transport.getAssignments(selectedRoute.id);
            if (res.success) setPassengers(res.data);
        } catch { /* non-fatal */ }
    };

    const addPassenger = async () => {
        if (!newPassengerId) return;
        setAddingPassenger(true);
        try {
            const res = await api.transport.createAssignment({
                routeId:      selectedRoute.id,
                passengerId:  newPassengerId,
                passengerType: 'LEARNER'
            });
            if (res.success) {
                showSuccess('Student assigned to route — transport fee will be applied to their invoice');
                setNewPassengerId('');
                await refreshPassengers();
                fetchRoutes();
                fetchSummary();
            }
        } catch (err) {
            showError(err?.message || 'Failed to assign student');
        } finally { setAddingPassenger(false); }
    };

    const removePassenger = async (assignmentId) => {
        if (!window.confirm('Remove student from this route? Their transport flag will be cleared if this is their only route.')) return;
        try {
            await api.transport.deleteAssignment(assignmentId);
            showSuccess('Student removed from route');
            await refreshPassengers();
            fetchRoutes();
            fetchSummary();
        } catch { showError('Failed to remove student'); }
    };

    // ── tab capacity info ─────────────────────────────────────────────────────

    const getRouteCapacityInfo = (route) => {
        const vehicle   = vehicles.find(v => v.id === route.vehicleId);
        const assigned  = route._count?.assignments ?? 0;
        const capacity  = vehicle?.capacity ?? null;
        const isFull    = capacity !== null && assigned >= capacity;
        return { assigned, capacity, isFull };
    };

    // ── render ────────────────────────────────────────────────────────────────

    return (
        <div className="max-w-7xl mx-auto p-6 md:p-8 font-sans">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 flex items-center gap-3 tracking-tight">
                        <Bus className="text-blue-600" size={30} />
                        Transport Manager
                    </h1>
                    <p className="text-gray-500 mt-0.5 text-sm font-medium">
                        Manage fleet vehicles, bus routes & roster, and transport students.
                    </p>
                </div>
                {activeTab === 'vehicles' && (
                    <button onClick={openAddVehicle}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 active:scale-95 text-sm">
                        <Plus size={18} /> Add Vehicle
                    </button>
                )}
                {activeTab === 'routes' && (
                    <button onClick={openAddRoute}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 active:scale-95 text-sm">
                        <Plus size={18} /> Add Route
                    </button>
                )}
            </div>

            {/* Summary bar */}
            <SummaryBar summary={summary} />

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 mb-5">
                {[
                    ['vehicles', 'Fleet Vehicles'],
                    ['routes',   'Bus Routes & Roster'],
                    ['students', 'Transport Students'],
                ].map(([id, label]) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        className={`pb-3 px-4 font-medium text-sm transition-all ${activeTab === id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                        {label}
                        {id === 'students' && summary?.transportStudentCount > 0 && (
                            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                                {summary.transportStudentCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Transport Students — inline list */}
            {activeTab === 'students' && (
                <TransportStudentsPanel navigateTo={navigateTo} />
            )}

            {/* Table — vehicles / routes */}
            {activeTab !== 'students' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[360px]">
                    {loading ? (
                        <div className="p-12 text-center text-gray-400 font-medium flex items-center justify-center gap-2">
                            <Loader2 size={18} className="animate-spin" /> Loading…
                        </div>
                    ) : activeTab === 'vehicles' ? (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-semibold tracking-widest text-gray-400">
                                <tr>
                                    <th className="p-4">Registration</th>
                                    <th className="p-4">Driver</th>
                                    <th className="p-4">Capacity</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {vehicles.length === 0
                                    ? <EmptyVehicles onAdd={openAddVehicle} />
                                    : vehicles.map(v => (
                                        <tr key={v.id} className="hover:bg-blue-50/10 transition group">
                                            <td className="p-4 border-none">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                        <Bus size={16} />
                                                    </div>
                                                    <span className="font-semibold tracking-tight text-gray-900">{v.registrationNumber}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 border-none">
                                                <p className="font-medium text-gray-800 text-sm">{v.driverName}</p>
                                                {v.driverPhone ? (
                                                    <a href={`tel:${v.driverPhone}`} className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                                                        <Phone size={10} /> {v.driverPhone}
                                                    </a>
                                                ) : (
                                                    <span className="text-[10px] text-amber-500 font-semibold border border-amber-200 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                                        No phone — update required
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-gray-600 font-medium border-none text-sm">{v.capacity} seats</td>
                                            <td className="p-4 border-none">
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-lg uppercase">
                                                    {v.status || 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right border-none">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEditVehicle(v)}
                                                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Edit">
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button onClick={() => deleteVehicle(v.id)}
                                                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition" title="Archive">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-semibold tracking-widest text-gray-400">
                                <tr>
                                    <th className="p-4">Route</th>
                                    <th className="p-4">Fee / Term</th>
                                    <th className="p-4">Vehicle</th>
                                    <th className="p-4">Passengers</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {routes.length === 0
                                    ? <EmptyRoutes onAdd={openAddRoute} hasVehicles={vehicles.length > 0} />
                                    : routes.map(r => {
                                        const { assigned, capacity, isFull } = getRouteCapacityInfo(r);
                                        return (
                                            <tr key={r.id} className="hover:bg-indigo-50/10 transition group">
                                                <td className="p-4 border-none">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                            <MapPin size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold tracking-tight text-gray-900 text-sm">{r.name}</p>
                                                            {r.description && <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{r.description}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-semibold text-emerald-600 border-none text-sm">
                                                    {parseFloat(r.amount) > 0 ? `KES ${parseFloat(r.amount).toLocaleString()}` : <span className="text-amber-500 text-xs">Fee not set</span>}
                                                </td>
                                                <td className="p-4 border-none">
                                                    {r.vehicle ? (
                                                        <div>
                                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-semibold rounded-lg">
                                                                {r.vehicle.registrationNumber}
                                                            </span>
                                                            {r.vehicle.driverPhone && (
                                                                <p className="text-[10px] text-gray-400 mt-0.5">{r.vehicle.driverName}</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold border border-amber-200 px-2 py-0.5 rounded-lg w-fit">
                                                            <AlertTriangle size={10} /> No vehicle
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 border-none">
                                                    <button
                                                        onClick={() => openPassengerModal(r)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all
                                                            ${isFull
                                                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                                                    >
                                                        <Users size={13} />
                                                        {assigned} student{assigned !== 1 ? 's' : ''}
                                                        <CapacityBadge assigned={assigned} capacity={capacity} />
                                                    </button>
                                                </td>
                                                <td className="p-4 text-right border-none">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEditRoute(r)}
                                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Edit">
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button onClick={() => deleteRoute(r.id)}
                                                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition" title="Archive">
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                }
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Vehicle modal ──────────────────────────────────────────────── */}
            {vehicleModal && (
                <Modal title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => setVehicleModal(false)}>
                    <form onSubmit={saveVehicle} className="space-y-4">
                        <VehicleForm data={vehicleForm} onChange={v => { setVehicleForm(v); setVehicleErrors({}); }} errors={vehicleErrors} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setVehicleModal(false)}
                                className="px-4 py-2 text-gray-500 hover:bg-gray-100 font-medium rounded-xl text-sm transition">
                                Cancel
                            </button>
                            <button type="submit" disabled={savingVehicle}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-600/20 transition active:scale-95 disabled:opacity-60 flex items-center gap-2">
                                {savingVehicle && <Loader2 size={14} className="animate-spin" />}
                                {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── Route modal ────────────────────────────────────────────────── */}
            {routeModal && (
                <Modal title={editingRoute ? 'Edit Route' : 'Add Route'} onClose={() => setRouteModal(false)}>
                    <form onSubmit={saveRoute} className="space-y-4">
                        <RouteForm data={routeForm} onChange={r => { setRouteForm(r); setRouteErrors({}); }} vehicles={vehicles} errors={routeErrors} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setRouteModal(false)}
                                className="px-4 py-2 text-gray-500 hover:bg-gray-100 font-medium rounded-xl text-sm transition">
                                Cancel
                            </button>
                            <button type="submit" disabled={savingRoute}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-600/20 transition active:scale-95 disabled:opacity-60 flex items-center gap-2">
                                {savingRoute && <Loader2 size={14} className="animate-spin" />}
                                {editingRoute ? 'Save Changes' : 'Create Route'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── Passenger modal ────────────────────────────────────────────── */}
            {passengerModal && selectedRoute && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Modal header */}
                        <div className="p-5 border-b border-gray-100 bg-blue-600 text-white flex justify-between items-center flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl"><Users size={20} /></div>
                                <div>
                                    <h2 className="text-lg font-semibold tracking-tight">{selectedRoute.name}</h2>
                                    <p className="text-blue-100 text-xs font-medium">
                                        {passengers.length} student{passengers.length !== 1 ? 's' : ''} assigned
                                        {selectedRoute.vehicle && (
                                            <> · {selectedRoute.vehicle.capacity} seat capacity</>
                                        )}
                                        {selectedRoute.vehicle?.driverName && (
                                            <> · Driver: {selectedRoute.vehicle.driverName}</>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setPassengerModal(false)}
                                className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">

                            {/* Add student section */}
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Assign Student to this Route</p>
                                <p className="text-xs text-gray-400 mb-3">
                                    The transport fee ({parseFloat(selectedRoute.amount) > 0 ? `KES ${parseFloat(selectedRoute.amount).toLocaleString()}` : 'not configured'}) will be applied to their invoice immediately.
                                </p>
                                <div className="flex items-end gap-3">
                                    <div className="flex-1">
                                        <SmartLearnerSearch
                                            learners={allLearners}
                                            selectedLearnerId={newPassengerId}
                                            onSelect={id => setNewPassengerId(id)}
                                            placeholder="Search by name or admission number…"
                                        />
                                    </div>
                                    <button
                                        disabled={!newPassengerId || addingPassenger}
                                        onClick={addPassenger}
                                        className="h-[42px] px-5 bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50 shadow-md shadow-blue-600/10 active:scale-95 text-sm flex-shrink-0"
                                    >
                                        {addingPassenger
                                            ? <Loader2 className="animate-spin" size={16} />
                                            : <UserPlus size={16} />}
                                        Assign
                                    </button>
                                </div>
                            </div>

                            {/* Passenger list */}
                            <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                                    Assigned Students ({passengers.length})
                                </p>

                                {loadingPassengers ? (
                                    <div className="py-10 text-center text-gray-400 font-medium animate-pulse">Loading…</div>
                                ) : passengers.length > 0 ? (
                                    <div className="grid gap-2">
                                        {passengers.map(a => (
                                            <div key={a.id}
                                                className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-200 transition group shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-semibold text-gray-400 text-xs uppercase flex-shrink-0">
                                                        {a.passenger?.firstName?.[0]}{a.passenger?.lastName?.[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 text-sm tracking-tight">
                                                            {a.passenger?.firstName} {a.passenger?.lastName}
                                                        </p>
                                                        <p className="text-[11px] text-gray-400 font-medium">
                                                            {a.passenger?.admissionNumber} · {a.passenger?.grade?.replace(/_/g, ' ')} {a.passenger?.stream}
                                                            {a.pickupPoint && <> · 📍 {a.pickupPoint}</>}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button onClick={() => removePassenger(a.id)}
                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                                                    title="Remove from route">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-10 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-100">
                                        <Users size={32} className="mx-auto text-gray-300 mb-2" />
                                        <p className="text-gray-500 font-semibold text-sm">No students on this route yet</p>
                                        <p className="text-gray-400 text-xs mt-1">Use the search above to find and assign students. Their transport fee will be charged automatically.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
                            <button
                                onClick={() => { setPassengerModal(false); navigateTo('transport-students'); }}
                                className="flex items-center gap-1.5 px-4 py-2 text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-xl font-medium text-sm transition"
                            >
                                <CreditCard size={14} /> View Fee Balances
                            </button>
                            <button onClick={() => setPassengerModal(false)}
                                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-medium text-sm transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransportManager;
