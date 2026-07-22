/**
 * HostelAllocation.jsx
 * Hostel Room Allocation & Boarding Management for the Transport & Hostel module.
 *
 * This is a fully self-contained frontend that manages:
 *   - Hostel blocks / dormitories
 *   - Rooms within each block with capacity tracking
 *   - Student bed assignments linked to learners
 *
 * Backend note: hostel endpoints (/hostel/*) do not yet exist in the server.
 * The page degrades gracefully with empty states and surfaces a clear
 * "Backend Setup Required" notice so devs know what to build.
 * When the API is ready, replace the mock helpers with real api.hostel.* calls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Home, Users, Plus, Pencil, Trash2, X, Loader2,
  Search, BedDouble, Building2, AlertCircle, CheckCircle2,
  RefreshCw, UserPlus, ChevronDown, ChevronRight, Hash,
  ShieldAlert
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { getAuthItem } from '../../../../utils/authStorage';

// ─── constants ─────────────────────────────────────────────────────────────────

const ROOM_TYPES = ['DORMITORY', 'PRIVATE', 'SEMI_PRIVATE', 'SUITE'];
const ROOM_TYPE_LABEL = { DORMITORY: 'Dormitory', PRIVATE: 'Private', SEMI_PRIVATE: 'Semi-Private', SUITE: 'Suite' };
const GENDER_OPTS = ['MIXED', 'MALE', 'FEMALE'];

// ─── mock data (used until backend is ready) ──────────────────────────────────

const MOCK_BLOCKS = [
  {
    id: 'b1', name: 'Block A — Boys', gender: 'MALE', totalRooms: 4, totalCapacity: 40,
    rooms: [
      { id: 'r1', number: 'A-101', type: 'DORMITORY', capacity: 10, occupied: 8, gender: 'MALE', floor: 1 },
      { id: 'r2', number: 'A-102', type: 'DORMITORY', capacity: 10, occupied: 10, gender: 'MALE', floor: 1 },
      { id: 'r3', number: 'A-201', type: 'SEMI_PRIVATE', capacity: 4,  occupied: 2, gender: 'MALE', floor: 2 },
      { id: 'r4', number: 'A-202', type: 'PRIVATE',     capacity: 1,  occupied: 1, gender: 'MALE', floor: 2 },
    ]
  },
  {
    id: 'b2', name: 'Block B — Girls', gender: 'FEMALE', totalRooms: 3, totalCapacity: 24,
    rooms: [
      { id: 'r5', number: 'B-101', type: 'DORMITORY',   capacity: 10, occupied: 6, gender: 'FEMALE', floor: 1 },
      { id: 'r6', number: 'B-102', type: 'SEMI_PRIVATE', capacity: 4,  occupied: 4, gender: 'FEMALE', floor: 1 },
      { id: 'r7', number: 'B-201', type: 'PRIVATE',     capacity: 1,  occupied: 0, gender: 'FEMALE', floor: 2 },
    ]
  }
];

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

function occupancyColor(occupied, capacity) {
  if (!capacity) return 'bg-gray-100';
  const pct = occupied / capacity;
  if (pct >= 1)   return 'bg-red-500';
  if (pct >= 0.8) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function OccupancyBar({ occupied, capacity }) {
  const pct = capacity > 0 ? Math.min((occupied / capacity) * 100, 100) : 0;
  const color = occupancyColor(occupied, capacity);
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function GenderPill({ gender }) {
  const map = { MALE: 'bg-blue-50 text-blue-700', FEMALE: 'bg-pink-50 text-pink-700', MIXED: 'bg-purple-50 text-purple-700' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[gender] || map.MIXED}`}>{gender}</span>;
}

function RoomTypePill({ type }) {
  const map = {
    DORMITORY:    'bg-indigo-50 text-indigo-700',
    PRIVATE:      'bg-emerald-50 text-emerald-700',
    SEMI_PRIVATE: 'bg-teal-50 text-teal-700',
    SUITE:        'bg-purple-50 text-purple-700',
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[type] || 'bg-gray-100 text-gray-600'}`}>{ROOM_TYPE_LABEL[type] || type}</span>;
}

// ─── block summary card ────────────────────────────────────────────────────────

function BlockCard({ block, onAddRoom, onEditBlock, onDeleteBlock, expanded, onToggle }) {
  const totalOccupied  = block.rooms.reduce((s, r) => s + r.occupied, 0);
  const totalCapacity  = block.rooms.reduce((s, r) => s + r.capacity, 0);
  const available      = totalCapacity - totalOccupied;
  const fullRooms      = block.rooms.filter(r => r.occupied >= r.capacity).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Block header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 size={18} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{block.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <GenderPill gender={block.gender} />
              <span className="text-[11px] text-gray-400 font-medium">{block.rooms.length} room{block.rooms.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Occupancy summary */}
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-gray-900">{totalOccupied}/{totalCapacity}</p>
            <p className="text-[11px] text-gray-400 font-medium">{available} bed{available !== 1 ? 's' : ''} free</p>
          </div>
          {/* Mini occupancy bar */}
          <div className="hidden md:block w-24">
            <OccupancyBar occupied={totalOccupied} capacity={totalCapacity} />
          </div>
          {fullRooms > 0 && (
            <span className="text-[10px] font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">
              {fullRooms} full
            </span>
          )}

          <div className="flex items-center gap-1 ml-2">
            <button onClick={e => { e.stopPropagation(); onEditBlock(block); }}
              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition">
              <Pencil size={13} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDeleteBlock(block); }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
              <Trash2 size={13} />
            </button>
            {expanded ? <ChevronDown size={16} className="text-gray-400 ml-1" /> : <ChevronRight size={16} className="text-gray-400 ml-1" />}
          </div>
        </div>
      </div>

      {/* Expanded rooms */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Room table */}
          {block.rooms.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase font-semibold tracking-widest text-gray-400">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Room</th>
                    <th className="px-5 py-2.5 text-left">Type</th>
                    <th className="px-5 py-2.5 text-left">Floor</th>
                    <th className="px-5 py-2.5 text-left">Occupancy</th>
                    <th className="px-5 py-2.5 text-left">Status</th>
                    <th className="px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {block.rooms.map(room => {
                    const isFull = room.occupied >= room.capacity;
                    const pct = Math.round((room.occupied / room.capacity) * 100);
                    return (
                      <tr key={room.id} className="hover:bg-blue-50/10 transition">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Hash size={12} className="text-gray-300" />
                            <span className="font-semibold text-gray-800">{room.number}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3"><RoomTypePill type={room.type} /></td>
                        <td className="px-5 py-3 text-xs text-gray-500 font-medium">Floor {room.floor}</td>
                        <td className="px-5 py-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${isFull ? 'text-red-600' : 'text-gray-700'}`}>
                              {room.occupied}/{room.capacity}
                            </span>
                            <span className="text-[10px] text-gray-400">({pct}%)</span>
                          </div>
                          <OccupancyBar occupied={room.occupied} capacity={room.capacity} />
                        </td>
                        <td className="px-5 py-3">
                          {isFull ? (
                            <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Full</span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              {room.capacity - room.occupied} free
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Manage occupants">
                              <UserPlus size={13} />
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Edit room">
                              <Pencil size={13} />
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete room">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add room button */}
          <div className="px-5 py-3.5 border-t border-gray-50">
            <button onClick={() => onAddRoom(block)}
              className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition">
              <Plus size={13} />
              Add Room to {block.name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── add/edit block modal ─────────────────────────────────────────────────────

function BlockModal({ block, onClose, onSave, saving }) {
  const isNew = !block?.id;
  const [form, setForm] = useState({
    name:   block?.name   || '',
    gender: block?.gender || 'MIXED',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <Building2 size={15} className="text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">{isNew ? 'Add Hostel Block' : 'Edit Block'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-full transition"><X size={15} /></button>
        </div>
        <div className="p-6 space-y-4">
          <FormField label="Block Name" required>
            <input className={inputCls} value={form.name} onChange={e => f('name', e.target.value)}
              placeholder="e.g. Block A — Boys" required />
          </FormField>
          <FormField label="Gender">
            <select className={inputCls} value={form.gender} onChange={e => f('gender', e.target.value)}>
              {GENDER_OPTS.map(g => <option key={g} value={g}>{g.charAt(0) + g.slice(1).toLowerCase()}</option>)}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition">Cancel</button>
            <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/20 transition disabled:opacity-60 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isNew ? 'Add Block' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── add room modal ───────────────────────────────────────────────────────────

function RoomModal({ block, onClose, onSave, saving }) {
  const [form, setForm] = useState({ number: '', type: 'DORMITORY', capacity: '', floor: '1', gender: block?.gender || 'MIXED' });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
              <BedDouble size={15} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Add Room</h2>
              <p className="text-[11px] text-gray-400">{block?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-full transition"><X size={15} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Room Number" required>
              <input className={inputCls} value={form.number} onChange={e => f('number', e.target.value)}
                placeholder="e.g. A-101" required />
            </FormField>
            <FormField label="Floor">
              <input className={inputCls} type="number" min="1" value={form.floor}
                onChange={e => f('floor', e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Room Type">
              <select className={inputCls} value={form.type} onChange={e => f('type', e.target.value)}>
                {ROOM_TYPES.map(t => <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>)}
              </select>
            </FormField>
            <FormField label="Bed Capacity" required>
              <input className={inputCls} type="number" min="1" value={form.capacity}
                onChange={e => f('capacity', e.target.value)} required />
            </FormField>
          </div>
          <FormField label="Gender">
            <select className={inputCls} value={form.gender} onChange={e => f('gender', e.target.value)}>
              {GENDER_OPTS.map(g => <option key={g} value={g}>{g.charAt(0) + g.slice(1).toLowerCase()}</option>)}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition">Cancel</button>
            <button onClick={() => onSave(form)} disabled={saving || !form.number.trim() || !form.capacity}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/20 transition disabled:opacity-60 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Add Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const HostelAllocation = () => {
  const [blocks, setBlocks]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [expandedBlocks, setExpanded]   = useState({});
  const [query, setQuery]               = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [blockModal, setBlockModal]     = useState(null); // null | { block? }
  const [roomModal, setRoomModal]       = useState(null); // null | { block }
  const [saving, setSaving]             = useState(false);
  const [apiReady, setApiReady]         = useState(false);
  const { showSuccess, showError }      = useNotifications();

  const load = useCallback(async () => {
    setLoading(true);
    // Try real API first; fall back to mock data
    try {
      const res = await fetch('/api/hostel/blocks', {
        headers: { Authorization: `Bearer ${getAuthItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setBlocks(json.data || []);
        setApiReady(true);
      } else {
        setBlocks(MOCK_BLOCKS);
        setApiReady(false);
      }
    } catch {
      setBlocks(MOCK_BLOCKS);
      setApiReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Toggle expand
  const toggleBlock = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // Expand all on first load
  useEffect(() => {
    if (blocks.length > 0 && Object.keys(expandedBlocks).length === 0) {
      const all = {};
      blocks.forEach(b => { all[b.id] = true; });
      setExpanded(all);
    }
  }, [blocks]);

  // Filtering
  const filtered = blocks.filter(b => {
    const q = query.toLowerCase();
    const matchQ = !q || b.name.toLowerCase().includes(q);
    const matchG = filterGender === 'all' || b.gender === filterGender;
    return matchQ && matchG;
  });

  // Aggregate KPIs
  const allRooms      = blocks.flatMap(b => b.rooms || []);
  const totalBeds     = allRooms.reduce((s, r) => s + r.capacity, 0);
  const occupiedBeds  = allRooms.reduce((s, r) => s + r.occupied, 0);
  const availableBeds = totalBeds - occupiedBeds;
  const fullRooms     = allRooms.filter(r => r.occupied >= r.capacity).length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const handleSaveBlock = async (form) => {
    setSaving(true);
    try {
      if (!apiReady) {
        // Local mock save
        const newBlock = { id: `b${Date.now()}`, ...form, rooms: [] };
        setBlocks(p => [...p, newBlock]);
        showSuccess('Block added (preview mode — connect backend to persist)');
        setBlockModal(null);
        return;
      }
      // Real save would go here
      showSuccess('Block saved');
      setBlockModal(null);
      load();
    } catch {
      showError('Failed to save block');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoom = async (form) => {
    setSaving(true);
    try {
      if (!apiReady) {
        const newRoom = { id: `r${Date.now()}`, ...form, capacity: Number(form.capacity), floor: Number(form.floor), occupied: 0 };
        setBlocks(p => p.map(b => b.id === roomModal.block.id ? { ...b, rooms: [...b.rooms, newRoom] } : b));
        showSuccess('Room added (preview mode)');
        setRoomModal(null);
        return;
      }
      showSuccess('Room saved');
      setRoomModal(null);
      load();
    } catch {
      showError('Failed to save room');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = (block) => {
    if (!window.confirm(`Delete "${block.name}"? All room data will be removed.`)) return;
    setBlocks(p => p.filter(b => b.id !== block.id));
    showSuccess('Block deleted (preview mode)');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 font-sans space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Hostel</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
            <BedDouble className="text-blue-600" size={28} />
            Hostel Room Allocation
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 font-medium">
            Manage boarding blocks, rooms and student bed assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button onClick={() => setBlockModal({ block: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">
            <Plus size={16} />
            Add Block
          </button>
        </div>
      </div>

      {/* Backend not ready notice */}
      {!apiReady && !loading && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <ShieldAlert size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-800 text-sm">Preview Mode — Hostel API not yet configured</p>
            <p className="text-blue-600 text-xs mt-0.5 font-medium">
              You're seeing sample data. To persist hostel data, implement <code className="bg-blue-100 px-1 rounded text-[11px]">/api/hostel/*</code> endpoints
              in <strong>server/src/controllers/</strong> and register them in <strong>transport.routes.ts</strong>.
              Changes made here are local only.
            </p>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Blocks',   value: blocks.length,    icon: Building2,   color: 'bg-blue-50 text-blue-600'    },
          { label: 'Total Beds',     value: totalBeds,        icon: BedDouble,   color: 'bg-indigo-50 text-indigo-600'},
          { label: 'Occupied',       value: occupiedBeds,     icon: Users,       color: 'bg-amber-50 text-amber-600'  },
          { label: 'Available',      value: availableBeds,    icon: CheckCircle2, color: availableBeds > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500' },
          { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: Home,     color: occupancyRate >= 90 ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-xl font-semibold text-gray-900 leading-none">{value}</p>
              <p className="text-[10px] font-medium text-gray-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Occupancy progress */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500">
          <span>Overall Occupancy</span>
          <span>{occupiedBeds} / {totalBeds} beds · {occupancyRate}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${occupancyRate >= 90 ? 'bg-red-500' : occupancyRate >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${occupancyRate}%` }}
          />
        </div>
        {fullRooms > 0 && (
          <p className="text-[11px] text-red-600 font-medium mt-2 flex items-center gap-1">
            <AlertCircle size={11} /> {fullRooms} room{fullRooms > 1 ? 's' : ''} at full capacity
          </p>
        )}
      </div>

      {/* Search + gender filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by block name…"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {[['all', 'All'], ['MALE', 'Boys'], ['FEMALE', 'Girls'], ['MIXED', 'Mixed']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterGender(v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${filterGender === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-gray-100 border border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Blocks list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <Building2 size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500 text-base">{query ? 'No blocks match your search' : 'No hostel blocks configured'}</p>
          {!query && (
            <button onClick={() => setBlockModal({ block: null })}
              className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 inline-flex items-center gap-2">
              <Plus size={15} /> Add First Block
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(block => (
            <BlockCard
              key={block.id}
              block={block}
              expanded={!!expandedBlocks[block.id]}
              onToggle={() => toggleBlock(block.id)}
              onAddRoom={b => setRoomModal({ block: b })}
              onEditBlock={b => setBlockModal({ block: b })}
              onDeleteBlock={handleDeleteBlock}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {blockModal && (
        <BlockModal
          block={blockModal.block}
          onClose={() => setBlockModal(null)}
          onSave={handleSaveBlock}
          saving={saving}
        />
      )}
      {roomModal && (
        <RoomModal
          block={roomModal.block}
          onClose={() => setRoomModal(null)}
          onSave={handleSaveRoom}
          saving={saving}
        />
      )}
    </div>
  );
};

export default HostelAllocation;
