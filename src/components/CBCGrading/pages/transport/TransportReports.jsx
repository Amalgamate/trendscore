import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    BarChart2, Bus, Users, TrendingUp,
    Download, RefreshCw, ChevronDown, ChevronUp,
    MapPin, Search, X
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { KpiCard } from '../../../../design-system/components';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt  = (n) => Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtK = (n) => `KES ${fmt(n)}`;

function pct(val, max) {
    if (!max || max === 0) return 0;
    return Math.min(100, Math.round((val / max) * 100));
}

function FillBar({ value, max }) {
    const p     = pct(value, max);
    const full  = p >= 100;
    const warn  = p >= 80;
    const color = full ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-500';
    return (
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${p}%` }} />
        </div>
    );
}

function StatCard({ label, value, sub, color = 'blue', icon: Icon }) {
    const tones = { blue: 'sky', green: 'emerald', red: 'rose', amber: 'amber', purple: 'violet' };
    return <KpiCard label={label} value={value} subvalue={sub} icon={<Icon size={20} />} tone={tones[color] || 'sky'} orbPosition="bottom-right" />;
}

function SectionHeader({ icon: Icon, title, children }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <Icon size={18} className="text-blue-500" />
                <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            </div>
            {children}
        </div>
    );
}

// ─── print roster ─────────────────────────────────────────────────────────────

function printRoster(ref) {
    const content = ref.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Transport Roster</title>
        <style>
            body{font-family:Arial,sans-serif;font-size:11px;margin:1cm}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}
            th{background:#f3f4f6;font-weight:bold;font-size:9px;text-transform:uppercase}
            h1{font-size:16px;margin-bottom:2px}
            .meta{color:#666;font-size:10px;margin-bottom:10px}
            tfoot td{background:#f9fafb;font-weight:bold}
            @media print{@page{margin:.8cm}}
        </style></head><body>
        <h1>Transport Student Roster</h1>
        <p class="meta">Generated: ${new Date().toLocaleString()}</p>
        ${content}
        </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
}

// ─── main component ───────────────────────────────────────────────────────────

const TransportReports = () => {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [rosterQ, setRosterQ] = useState('');
    const [sortBy, setSortBy]   = useState('grade');
    const [sortDir, setSortDir] = useState('asc');
    const { showError }         = useNotifications();
    const rosterRef             = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.transport.getReports();
            if (res.success) setData(res.data);
            else showError('Failed to load transport reports');
        } catch {
            showError('Failed to load transport reports');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── roster filtering + sorting ─────────────────────────────────────────
    const roster   = data?.roster ?? [];
    const q        = rosterQ.toLowerCase();
    const filtered = roster.filter(r =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.admissionNumber.toLowerCase().includes(q) ||
        r.routeName.toLowerCase().includes(q) ||
        (r.grade || '').toLowerCase().includes(q)
    );

    const toggleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    const sorted = [...filtered].sort((a, b) => {
        const v = sortBy === 'name'  ? a.name.localeCompare(b.name)
                : sortBy === 'route' ? a.routeName.localeCompare(b.routeName)
                : a.grade.localeCompare(b.grade) || a.name.localeCompare(b.name);
        return sortDir === 'asc' ? v : -v;
    });

    // ── loading skeleton ───────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-6 md:p-8">
                <div className="flex items-center gap-3 mb-8">
                    <BarChart2 size={26} className="text-blue-500 animate-pulse" />
                    <h1 className="text-2xl font-semibold text-gray-900">Transport Reports</h1>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
                <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            </div>
        );
    }

    if (!data) return null;

    const { fleetSummary: fs, billingTotals: bt, routeUtilisation, gradeDistribution } = data;
    const maxGrade = Math.max(...(gradeDistribution ?? []).map(g => g.count), 1);

    // ── render ─────────────────────────────────────────────────────────────
    return (
        <div className="max-w-7xl mx-auto p-6 md:p-8 font-sans space-y-8">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 flex items-center gap-3 tracking-tight">
                        <BarChart2 className="text-blue-500" size={28} />
                        Transport Reports
                    </h1>
                    <p className="text-gray-400 text-sm mt-0.5 font-medium">
                        Fleet utilisation, route capacity and billing overview
                    </p>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                    <RefreshCw size={15} />
                    Refresh
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Bus}        label="Fleet Vehicles"     value={fs.totalVehicles}    sub={`${fs.totalCapacity} total seats`}                                                   color="blue"   />
                <StatCard icon={MapPin}     label="Active Routes"      value={fs.totalRoutes}      sub={fs.overCapacity > 0 ? `${fs.overCapacity} at capacity` : 'All within capacity'}      color={fs.overCapacity > 0 ? 'red' : 'green'} />
                <StatCard icon={Users}      label="Transport Students"  value={fs.totalStudents}    sub={`${fs.totalAssigned} total assignments`}                                              color="purple" />
                <StatCard icon={TrendingUp} label="Collection Rate"    value={`${bt.collectionRate}%`} sub={`KES ${fmt(bt.totalCollected)} of ${fmt(bt.totalBilled)}`}                   color={bt.collectionRate >= 80 ? 'green' : 'amber'} />
            </div>

            {/* Billing summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <SectionHeader icon={TrendingUp} title="Transport Billing Summary" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    {[
                        { label: 'Total Billed',      value: bt.totalBilled,       color: 'text-gray-900'    },
                        { label: 'Total Collected',   value: bt.totalCollected,    color: 'text-emerald-600' },
                        { label: 'Total Outstanding', value: bt.totalOutstanding,  color: 'text-red-600'     },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="px-8 py-6 text-center">
                            <p className={`text-3xl font-semibold ${color}`}>{fmtK(value)}</p>
                            <p className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-widest">{label}</p>
                        </div>
                    ))}
                </div>
                <div className="px-6 pb-5">
                    <div className="flex justify-between text-xs text-gray-500 font-medium mb-1.5">
                        <span>Collection Progress</span>
                        <span>{bt.collectionRate}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-3 rounded-full transition-all ${bt.collectionRate >= 80 ? 'bg-emerald-500' : bt.collectionRate >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                            style={{ width: `${Math.max(bt.collectionRate, 0)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Route utilisation */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <SectionHeader icon={MapPin} title="Route Utilisation" />
                </div>
                {routeUtilisation.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <MapPin size={40} className="mx-auto mb-3 text-gray-200" />
                        <p className="font-medium">No routes configured yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-[10px] uppercase font-semibold tracking-widest text-gray-400 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3">Route</th>
                                    <th className="px-6 py-3">Vehicle / Driver</th>
                                    <th className="px-6 py-3">Occupancy</th>
                                    <th className="px-6 py-3 text-right">Fee / Term</th>
                                    <th className="px-6 py-3 text-right">Billed</th>
                                    <th className="px-6 py-3 text-right">Collected</th>
                                    <th className="px-6 py-3 text-right">Outstanding</th>
                                    <th className="px-6 py-3 text-center">Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {routeUtilisation.map(r => {
                                    const full = r.isFull;
                                    const warn = r.fillPct !== null && r.fillPct >= 80;
                                    return (
                                        <tr key={r.id} className="hover:bg-gray-50/50 transition text-sm">
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-gray-900">{r.name}</p>
                                                {r.description && (
                                                    <p className="text-[11px] text-gray-400 truncate max-w-[180px]">{r.description}</p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {r.vehicle ? (
                                                    <div>
                                                        <p className="font-medium text-gray-700 text-xs">{r.vehicle.registrationNumber}</p>
                                                        <p className="text-[11px] text-gray-400">{r.vehicle.driverName}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-amber-500 font-semibold border border-amber-200 px-2 py-0.5 rounded">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 min-w-[140px]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-semibold ${full ? 'text-red-600' : warn ? 'text-amber-600' : 'text-gray-700'}`}>
                                                        {r.assigned}{r.capacity ? `/${r.capacity}` : ' students'}
                                                    </span>
                                                    {r.fillPct !== null && (
                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${full ? 'bg-red-100 text-red-700' : warn ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {r.fillPct}%
                                                        </span>
                                                    )}
                                                </div>
                                                {r.capacity && <FillBar value={r.assigned} max={r.capacity} />}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-700 text-xs">{fmtK(r.feePerTerm)}</td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-700 text-xs">{fmtK(r.billing.billed)}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-emerald-600 text-xs">{fmtK(r.billing.collected)}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-red-500 text-xs">{fmtK(r.billing.outstanding)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.billing.collectionRate >= 80 ? 'bg-emerald-100 text-emerald-700' : r.billing.collectionRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                    {r.billing.collectionRate}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Grade distribution */}
            {gradeDistribution?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <SectionHeader icon={Users} title="Students by Grade" />
                    <div className="space-y-3">
                        {gradeDistribution.map(({ grade, count }) => (
                            <div key={grade} className="flex items-center gap-4">
                                <p className="text-xs font-semibold text-gray-500 w-24 flex-shrink-0 uppercase tracking-wide">
                                    {grade.replace(/_/g, ' ')}
                                </p>
                                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                                    <div
                                        className="h-5 bg-blue-500 rounded-full flex items-center justify-end pr-2 transition-all"
                                        style={{ width: `${pct(count, maxGrade)}%`, minWidth: '2.5rem' }}
                                    >
                                        <span className="text-[10px] font-semibold text-white">{count}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Student roster */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <SectionHeader icon={Users} title={`Student Roster (${sorted.length})`}>
                        <button
                            onClick={() => printRoster(rosterRef)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                        >
                            <Download size={13} />
                            Print / Export
                        </button>
                    </SectionHeader>

                    <div className="flex items-center gap-3 mt-3">
                        {/* Search */}
                        <div className="relative flex-1 max-w-xs">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={rosterQ}
                                onChange={e => setRosterQ(e.target.value)}
                                placeholder="Search name, adm. no., grade, route…"
                                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                            />
                            {rosterQ && (
                                <button onClick={() => setRosterQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-1">
                            {[['grade', 'Grade'], ['name', 'Name'], ['route', 'Route']].map(([col, label]) => (
                                <button
                                    key={col}
                                    onClick={() => toggleSort(col)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 transition ${sortBy === col ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {label}
                                    {sortBy === col && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Printable area */}
                <div ref={rosterRef} className="overflow-x-auto">
                    {sorted.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Users size={40} className="mx-auto mb-3 text-gray-200" />
                            <p className="font-medium">{rosterQ ? 'No students match your search' : 'No transport students assigned yet'}</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-gray-50 text-[10px] uppercase font-semibold tracking-widest text-gray-400 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3">#</th>
                                    <th className="px-5 py-3">Student</th>
                                    <th className="px-5 py-3">Grade / Stream</th>
                                    <th className="px-5 py-3">Route</th>
                                    <th className="px-5 py-3">Driver / Vehicle</th>
                                    <th className="px-5 py-3">Pickup Point</th>
                                    <th className="px-5 py-3 text-right">Fee / Term</th>
                                    <th className="px-5 py-3">Contact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sorted.map((s, i) => (
                                    <tr key={s.learnerId} className="hover:bg-blue-50/10 transition">
                                        <td className="px-5 py-3 text-gray-400 font-medium text-xs">{i + 1}</td>
                                        <td className="px-5 py-3">
                                            <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                                            <p className="text-[11px] text-gray-400">{s.admissionNumber}</p>
                                        </td>
                                        <td className="px-5 py-3 text-xs font-medium text-gray-700">
                                            {(s.grade || '').replace(/_/g, ' ')} {s.stream || ''}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
                                                {s.routeName}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            {s.driverName ? (
                                                <div>
                                                    <p className="text-xs font-medium text-gray-700">{s.driverName}</p>
                                                    {s.vehicle && <p className="text-[11px] text-gray-400">{s.vehicle}</p>}
                                                </div>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-600">
                                            {s.pickupPoint || <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-5 py-3 text-right font-semibold text-emerald-600 text-xs">
                                            {fmtK(s.feePerTerm)}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-600">
                                            {s.phone || <span className="text-gray-300">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                                <tr>
                                    <td colSpan={6} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                                        Total ({sorted.length} students)
                                    </td>
                                    <td className="px-5 py-3 text-right font-semibold text-emerald-700 text-sm">
                                        {fmtK(sorted.reduce((s, r) => s + (r.feePerTerm || 0), 0))}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransportReports;
