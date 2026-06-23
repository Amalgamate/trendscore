/**
 * Uniform Allocation Page
 * Select which uniform items to issue per student, with a clear issued-items view in the table.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Shirt,
  X, Save, Download, Loader2, AlertCircle, CheckCircle2, Eye,
} from 'lucide-react';
import { learnerAPI } from '../../../services/api';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { useAuth } from '../../../hooks/useAuth';
import { getSelectedInstitutionType } from '../../../services/schoolContext';

// ─── Catalogue of uniform items ──────────────────────────────────────────────
const UNIFORM_ITEMS = [
  { key: 'shirt',     label: 'Shirt / Blouse',    icon: '👔' },
  { key: 'trouser',   label: 'Trouser / Skirt',   icon: '👖' },
  { key: 'sweater',   label: 'Sweater / Pullover', icon: '🧥' },
  { key: 'tie',       label: 'Tie',               icon: '🎀' },
  { key: 'socks',     label: 'Socks (pairs)',      icon: '🧦' },
  { key: 'pe_kit',    label: 'PE Kit',             icon: '🏃' },
  { key: 'tracksuit', label: 'Track Suit',         icon: '🩱' },
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '26', '28', '30', '32', '34', '36', '38', '40'];

// Default blank form state — one entry per item key
const blankForm = () =>
  Object.fromEntries(
    UNIFORM_ITEMS.map(i => [i.key, { selected: false, size: '', qty: 1 }])
  );

// ─── Issued-items detail panel (read-only view in a tooltip-style popover) ───
const IssuedItemsPopover = ({ alloc, onClose }) => {
  const issued = UNIFORM_ITEMS.filter(i => alloc[i.key]?.selected);
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-base">Issued Items</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {issued.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm font-medium">
            No items have been issued yet.
          </div>
        ) : (
          <div className="px-5 py-4 space-y-2">
            {issued.map(item => {
              const d = alloc[item.key];
              return (
                <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                    {d.size && (
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                        Size {d.size}
                      </span>
                    )}
                    <span className="bg-brand-teal/10 text-brand-teal px-2 py-0.5 rounded font-medium">
                      Qty {d.qty || 1}
                    </span>
                  </div>
                </div>
              );
            })}
            {alloc.issueDate && (
              <p className="text-xs text-gray-400 pt-2">
                Issued on: <span className="font-semibold">{alloc.issueDate}</span>
              </p>
            )}
            {alloc.notes && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-1">
                {alloc.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Allocation modal ─────────────────────────────────────────────────────────
const AllocationModal = ({ learner, onClose, onSave }) => {
  const [form, setForm] = useState({
    ...blankForm(),
    notes: '',
    issueDate: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  // Pre-fill from existing allocation
  useEffect(() => {
    if (learner.uniformAllocation) {
      setForm(prev => ({ ...prev, ...learner.uniformAllocation }));
    }
  }, [learner]);

  const toggleItem = (key) =>
    setForm(prev => ({
      ...prev,
      [key]: { ...prev[key], selected: !prev[key].selected },
    }));

  const setField = (key, field, value) =>
    setForm(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));

  const handleSelectAll = () => {
    const allSelected = UNIFORM_ITEMS.every(i => form[i.key]?.selected);
    setForm(prev => ({
      ...prev,
      ...Object.fromEntries(
        UNIFORM_ITEMS.map(i => [i.key, { ...prev[i.key], selected: !allSelected }])
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(learner.id, form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = UNIFORM_ITEMS.filter(i => form[i.key]?.selected).length;
  const allSelected   = selectedCount === UNIFORM_ITEMS.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-brand-purple/10 px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Uniform Allocation</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {learner.firstName} {learner.lastName}
              &nbsp;&bull;&nbsp;{learner.admNo || learner.admissionNumber}
              &nbsp;&bull;&nbsp;{learner.grade?.replace('_', ' ')} {learner.stream}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Sub-header: date + select-all + counter */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-4 shrink-0 border-b border-gray-100">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Issue Date</label>
            <input
              type="date"
              value={form.issueDate}
              onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal focus:border-transparent"
            />
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Select / deselect all */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded text-brand-teal border-gray-300 focus:ring-brand-teal"
              />
              <span className="text-xs font-medium text-gray-600">Select All</span>
            </label>

            <div className="text-right">
              <p className="text-[10px] font-medium text-gray-400 uppercase">Selected</p>
              <p className="text-xl font-semibold text-brand-teal leading-none">
                {selectedCount}
                <span className="text-sm font-medium text-gray-400 ml-1">/ {UNIFORM_ITEMS.length}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Item list */}
        <div className="overflow-y-auto px-6 py-4 space-y-2 flex-1">
          {UNIFORM_ITEMS.map(item => {
            const data = form[item.key] || { selected: false, size: '', qty: 1 };
            return (
              <label
                key={item.key}
                className={`flex items-center gap-4 rounded-xl border p-4 cursor-pointer transition-all ${
                  data.selected
                    ? 'border-brand-teal/40 bg-brand-teal/5 shadow-sm'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={!!data.selected}
                  onChange={() => toggleItem(item.key)}
                  className="w-5 h-5 rounded text-brand-teal border-gray-300 focus:ring-brand-teal shrink-0"
                />

                {/* Icon + label */}
                <span className="text-2xl shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${data.selected ? 'text-brand-teal' : 'text-gray-700'}`}>
                    {item.label}
                  </p>
                  {!data.selected && (
                    <p className="text-xs text-gray-400">Tick to include in this issuance</p>
                  )}
                </div>

                {/* Size + Qty — only visible when selected */}
                {data.selected && (
                  <div
                    className="flex items-center gap-3 shrink-0"
                    onClick={e => e.preventDefault()} // prevent label re-toggle when clicking inputs
                  >
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Size</p>
                      <select
                        value={data.size}
                        onChange={e => setField(item.key, 'size', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-teal"
                      >
                        <option value="">—</option>
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Qty</p>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={data.qty}
                        onChange={e => setField(item.key, 'qty', parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-brand-teal"
                      />
                    </div>
                  </div>
                )}
              </label>
            );
          })}

          {/* Notes */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2 bg-brand-teal text-white text-sm font-medium rounded-lg hover:bg-brand-teal/90 disabled:opacity-40 transition shadow-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Allocation
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const UniformAllocationPage = () => {
  const { grades } = useSchoolData();
  const { user } = useAuth();
  const selectedInstitutionType = String(getSelectedInstitutionType() || user?.institutionType || '').toUpperCase();
  const isSecondaryPortal = selectedInstitutionType === 'SECONDARY' || selectedInstitutionType === 'HIGH_SCHOOL';
  const isSecondaryGrade = (gradeValue) => {
    const g = String(gradeValue || '').trim().toUpperCase().replace(/\s+/g, '_');
    return g.startsWith('FORM') || ['GRADE_10', 'GRADE_11', 'GRADE_12', 'GRADE10', 'GRADE11', 'GRADE12'].includes(g);
  };

  const [learners, setLearners]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [searchTerm, setSearchTerm]   = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all | issued | partial | none
  const [pagination, setPagination]   = useState({ page: 1, pages: 1, total: 0, limit: 30 });
  const [editTarget, setEditTarget]   = useState(null);   // learner being allocated
  const [viewTarget, setViewTarget]   = useState(null);   // learner whose items we're viewing
  const [toast, setToast]             = useState(null);

  // Allocations persisted in localStorage keyed by learner id
  const [allocations, setAllocations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('trendscore_uniform_allocations') || '{}'); }
    catch { return {}; }
  });

  const persistAllocations = (updated) => {
    setAllocations(updated);
    try { localStorage.setItem('trendscore_uniform_allocations', JSON.stringify(updated)); } catch {}
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Count how many items are selected/issued for a given learner
  const issuedCount = (learnerId) => {
    const alloc = allocations[learnerId];
    if (!alloc) return 0;
    return UNIFORM_ITEMS.filter(i => alloc[i.key]?.selected).length;
  };

  const statusLabel = (count) => {
    if (count === 0)                      return 'NONE';
    if (count === UNIFORM_ITEMS.length)   return 'COMPLETE';
    return 'PARTIAL';
  };

  const fetchLearners = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const resp = await learnerAPI.getAll({
        page:   params.page   ?? pagination.page,
        limit:  30,
        search: params.search ?? searchTerm,
        status: 'ACTIVE',
        ...(params.grade !== undefined
          ? (params.grade !== 'all' ? { grade: params.grade } : {})
          : (filterGrade !== 'all' ? { grade: filterGrade } : {})),
      });
      if (resp?.success) {
        const rows = Array.isArray(resp.data) ? resp.data : [];
        setLearners(rows.filter((learner) => {
          const learnerIsSecondary = isSecondaryGrade(learner?.grade);
          return isSecondaryPortal ? learnerIsSecondary : !learnerIsSecondary;
        }));
        if (resp.pagination) setPagination(resp.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch learners:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterGrade, pagination.page, isSecondaryPortal]);

  // Debounced search / filter
  useEffect(() => {
    const t = setTimeout(() => fetchLearners({ page: 1 }), 400);
    return () => clearTimeout(t);
  }, [searchTerm, filterGrade]);

  useEffect(() => { fetchLearners(); }, []);

  const handleSaveAllocation = async (learnerId, formData) => {
    const updated = { ...allocations, [learnerId]: formData };
    persistAllocations(updated);
    showToast('Uniform allocation saved');
  };

  const handleExportCSV = () => {
    const rows = [
      ['Admission No', 'Name', 'Grade', 'Stream', ...UNIFORM_ITEMS.map(i => i.label), 'Issue Date', 'Notes'],
    ];
    learners.forEach(l => {
      const alloc = allocations[l.id] || {};
      rows.push([
        l.admNo || l.admissionNumber,
        `${l.firstName} ${l.lastName}`,
        l.grade,
        l.stream || '',
        ...UNIFORM_ITEMS.map(i =>
          alloc[i.key]?.selected
            ? `${alloc[i.key]?.qty || 1} x ${alloc[i.key]?.size || '?'}`
            : '—'
        ),
        alloc.issueDate || '—',
        alloc.notes    || '',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'uniform_allocations.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Client-side status filter applied after fetch
  const displayLearners = filterStatus === 'all'
    ? learners
    : learners.filter(l => {
        const count  = issuedCount(l.id);
        const status = statusLabel(count);
        if (filterStatus === 'issued')  return status === 'COMPLETE';
        if (filterStatus === 'partial') return status === 'PARTIAL';
        if (filterStatus === 'none')    return status === 'NONE';
        return true;
      });

  const totalAllocated = Object.keys(allocations).filter(
    id => UNIFORM_ITEMS.some(i => allocations[id]?.[i.key]?.selected)
  ).length;

  const STATUS_CHIP = {
    COMPLETE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PARTIAL:  'bg-amber-100  text-amber-800  border-amber-200',
    NONE:     'bg-gray-100   text-gray-500   border-gray-200',
  };
  const STATUS_TEXT = {
    COMPLETE: '✓ Complete',
    PARTIAL:  '⏳ Partial',
    NONE:     '— Not Issued',
  };

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar-card">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by name or admission number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              />
            </div>

            <select
              value={filterGrade}
              onChange={e => { setFilterGrade(e.target.value); fetchLearners({ page: 1, grade: e.target.value }); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-purple"
            >
              <option value="all">All Grades</option>
              {grades.map(g => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-purple"
            >
              <option value="all">All Statuses</option>
              <option value="issued">Complete</option>
              <option value="partial">Partial</option>
              <option value="none">Not Issued</option>
            </select>

            {(searchTerm || filterGrade !== 'all' || filterStatus !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setFilterGrade('all'); setFilterStatus('all'); }}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>

          {/* Stats + export */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right border-r pr-4 border-gray-200">
              <p className="text-[10px] font-medium text-gray-400 uppercase">Total</p>
              <p className="text-xl font-semibold text-gray-800">{pagination.total}</p>
            </div>
            <div className="hidden md:block text-right border-r pr-4 border-gray-200">
              <p className="text-[10px] font-medium text-gray-400 uppercase">Allocated</p>
              <p className="text-xl font-semibold text-brand-teal">{totalAllocated}</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold transition"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
        {loading && displayLearners.length === 0 ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 size={32} className="animate-spin text-brand-teal" />
          </div>
        ) : displayLearners.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Shirt size={40} className="mb-2 opacity-30" />
            <p className="font-semibold">No students match your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[color:var(--table-border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Items Issued</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayLearners.map(learner => {
                    const count  = issuedCount(learner.id);
                    const alloc  = allocations[learner.id];
                    const status = statusLabel(count);

                    // Build a compact list of issued item labels for the row
                    const issuedItems = alloc
                      ? UNIFORM_ITEMS.filter(i => alloc[i.key]?.selected)
                      : [];

                    return (
                      <tr key={learner.id} className="hover:bg-gray-50 transition">

                        {/* Student */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {learner.avatar && (learner.avatar.startsWith('http') || learner.avatar.startsWith('/') || learner.avatar.startsWith('data:image')) ? (
                              <img src={learner.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple flex justify-center items-center font-medium text-xs border border-brand-purple/20 flex-shrink-0">
                                {`${learner.firstName?.charAt(0) || ''}${learner.lastName?.charAt(0) || ''}`}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-900">
                                {learner.firstName} {learner.lastName}
                              </p>
                              <p className="text-xs text-gray-400">{learner.admNo || learner.admissionNumber}</p>
                            </div>
                          </div>
                        </td>

                        {/* Grade */}
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {learner.grade?.replace('_', ' ')} {learner.stream}
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CHIP[status]}`}>
                            {STATUS_TEXT[status]}
                          </span>
                        </td>

                        {/* Issued items — compact chips */}
                        <td className="px-4 py-3">
                          {issuedItems.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {issuedItems.map(item => (
                                <span
                                  key={item.key}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-teal/10 text-brand-teal text-[11px] font-medium rounded-full"
                                  title={`${item.label} — Size ${alloc[item.key]?.size || '?'}, Qty ${alloc[item.key]?.qty || 1}`}
                                >
                                  <span>{item.icon}</span>
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Issue date */}
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {alloc?.issueDate || '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View details — only shown if something has been issued */}
                            {issuedItems.length > 0 && (
                              <button
                                onClick={() => setViewTarget({ learner, alloc })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                                title="View issued items"
                              >
                                <Eye size={13} /> View
                              </button>
                            )}
                            <button
                              onClick={() => setEditTarget({ ...learner, uniformAllocation: alloc })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-brand-teal rounded-lg hover:bg-brand-teal/90 transition shadow-sm"
                            >
                              <Shirt size={13} />
                              {count > 0 ? 'Update' : 'Allocate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchLearners({ page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-brand-purple disabled:opacity-40 hover:bg-gray-100 transition"
                  >
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <span className="flex items-center px-3 text-sm text-gray-600 font-medium">
                    {pagination.page} / {pagination.pages}
                  </span>
                  <button
                    onClick={() => fetchLearners({ page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.pages}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-brand-purple disabled:opacity-40 hover:bg-gray-100 transition"
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Allocation modal */}
      {editTarget && (
        <AllocationModal
          learner={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSaveAllocation}
        />
      )}

      {/* View-issued popover */}
      {viewTarget && (
        <IssuedItemsPopover
          alloc={viewTarget.alloc}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  );
};

export default UniformAllocationPage;
