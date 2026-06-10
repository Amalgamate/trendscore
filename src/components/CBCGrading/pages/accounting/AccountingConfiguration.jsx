/**
 * AccountingConfiguration.jsx
 *
 * Configuration hub for the Accounting module.
 *
 * Tabs:
 *   1. Accounts   — Create / manage accounts (feeds ChartOfAccounts)
 *   2. Categories — Expense categories used in ExpenseManager
 *   3. Expense Types — Sub-classifications under categories
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Tag, Layers, Plus, Pencil, Trash2,
  Loader2, ChevronRight, X, Save, RefreshCw, Settings2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { accountingAPI } from '../../../../services/api/accounting.api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'ASSET',     label: 'Asset',     color: 'bg-blue-100 text-blue-700'   },
  { value: 'LIABILITY', label: 'Liability', color: 'bg-red-100 text-red-700'     },
  { value: 'EQUITY',    label: 'Equity',    color: 'bg-purple-100 text-purple-700' },
  { value: 'INCOME',    label: 'Income',    color: 'bg-green-100 text-green-700'  },
  { value: 'EXPENSE',   label: 'Expense',   color: 'bg-orange-100 text-orange-700'},
];

const TYPE_COLOR = Object.fromEntries(ACCOUNT_TYPES.map(t => [t.value, t.color]));

// Default expense categories — users can add / remove their own
const DEFAULT_CATEGORIES = [
  'Operating', 'Salaries', 'Utilities', 'Rent', 'Supplies',
  'Maintenance', 'Transport', 'Marketing', 'Miscellaneous',
];

// ─── Shared empty-state component ─────────────────────────────────────────────

const EmptyRow = ({ colSpan, message }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-gray-400 italic">
      {message}
    </td>
  </tr>
);

// ─── TAB 1 — Accounts ─────────────────────────────────────────────────────────

const AccountsTab = () => {
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null); // null = create mode

  const blankForm = { code: '', name: '', type: 'EXPENSE', parentId: '' };
  const [form, setForm] = useState(blankForm);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await accountingAPI.getAccounts(false);
      if (res.success) setAccounts(res.data ?? []);
    } catch {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(blankForm); setShowModal(true); };
  const openEdit   = (acc) => {
    setEditing(acc);
    setForm({ code: acc.code ?? '', name: acc.name, type: acc.type, parentId: acc.parentId ?? '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(blankForm); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Account name is required'); return; }
    if (!form.code.trim()) { toast.error('Account code is required'); return; }
    try {
      setSaving(true);
      const payload = {
        code:     form.code.trim(),
        name:     form.name.trim(),
        type:     form.type,
        parentId: form.parentId || null,
      };
      // The API currently only exposes createAccount; edit support can be added
      // when the backend endpoint is available.
      const res = await accountingAPI.createAccount(payload);
      if (res.success) {
        toast.success(`Account "${form.name}" created`);
        closeModal();
        load();
      } else {
        toast.error(res.message || 'Failed to save account');
      }
    } catch (err) {
      toast.error(err?.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  };

  // Parent account options (can only parent to a different type's root, or same type)
  const parentOptions = accounts.filter(a => !editing || a.id !== editing.id);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Define the accounts that appear in your Chart of Accounts. Set the code,
          name, type and optional parent to build your account hierarchy.
        </p>
        <Button onClick={openCreate} size="sm" className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add Account
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Parent</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <EmptyRow colSpan={5} message="No accounts yet. Click 'Add Account' to create your first one." />
            ) : (
              accounts.map(acc => {
                const parent = accounts.find(a => a.id === acc.parentId);
                return (
                  <tr key={acc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-700">{acc.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{acc.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[acc.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {acc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {parent ? `${parent.code} – ${parent.name}` : <span className="italic text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(acc)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Account' : 'New Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="acc-code">Account Code *</Label>
                <Input
                  id="acc-code"
                  placeholder="e.g. 5100"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-type">Type *</Label>
                <select
                  id="acc-type"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {ACCOUNT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-name">Account Name *</Label>
              <Input
                id="acc-name"
                placeholder="e.g. Office Supplies Expense"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-parent">Parent Account <span className="text-gray-400 font-normal">(optional)</span></Label>
              <select
                id="acc-parent"
                value={form.parentId}
                onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">— No parent (root account) —</option>
                {parentOptions.map(a => (
                  <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {editing ? 'Save Changes' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── TAB 2 — Expense Categories ───────────────────────────────────────────────

const CategoriesTab = () => {
  // Categories are stored in localStorage so they persist without a dedicated
  // backend endpoint. When the backend exposes /accounting/categories this
  // can be swapped to an API call.
  const STORAGE_KEY = 'trendscore_expense_categories';

  const loadStored = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return DEFAULT_CATEGORIES;
  };

  const [categories, setCategories] = useState(loadStored);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null); // index of item being edited
  const [formValue, setFormValue]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // index

  const persist = (updated) => {
    setCategories(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const openCreate = () => { setEditing(null); setFormValue(''); setShowModal(true); };
  const openEdit   = (idx) => { setEditing(idx); setFormValue(categories[idx]); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setFormValue(''); };

  const handleSave = (e) => {
    e.preventDefault();
    const val = formValue.trim();
    if (!val) { toast.error('Category name cannot be empty'); return; }
    if (editing === null) {
      if (categories.includes(val)) { toast.error('Category already exists'); return; }
      persist([...categories, val]);
      toast.success(`Category "${val}" added`);
    } else {
      const updated = categories.map((c, i) => i === editing ? val : c);
      persist(updated);
      toast.success('Category updated');
    }
    closeModal();
  };

  const handleDelete = (idx) => {
    const updated = categories.filter((_, i) => i !== idx);
    persist(updated);
    setConfirmDelete(null);
    toast.success('Category removed');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Expense categories are used when recording expenses in the Expense Manager.
          These are stored locally and shared across all users on this browser.
        </p>
        <Button onClick={openCreate} size="sm" className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Category Name</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <EmptyRow colSpan={3} message="No categories yet." />
            ) : (
              categories.map((cat, idx) => (
                <tr key={cat} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-orange-400" />
                      {cat}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(idx)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(idx)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing !== null ? 'Rename Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Category Name *</Label>
              <Input
                id="cat-name"
                placeholder="e.g. Utilities"
                value={formValue}
                onChange={e => setFormValue(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-1" />
                {editing !== null ? 'Save' : 'Add Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={confirmDelete !== null} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Category</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Remove <strong>"{categories[confirmDelete]}"</strong>? Existing expenses that
            use this category will keep their value but the category won't appear in
            the dropdown for new expenses.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(confirmDelete)}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── TAB 3 — Expense Types ────────────────────────────────────────────────────

const ExpenseTypesTab = () => {
  const STORAGE_KEY_CATS  = 'trendscore_expense_categories';
  const STORAGE_KEY_TYPES = 'trendscore_expense_types';

  const loadCategories = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_CATS)) ?? DEFAULT_CATEGORIES; }
    catch { return DEFAULT_CATEGORIES; }
  };

  const loadTypes = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_TYPES)) ?? []; }
    catch { return []; }
  };

  const [categories] = useState(loadCategories);
  const [types, setTypes]         = useState(loadTypes);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const blankForm = { name: '', category: categories[0] ?? '', description: '' };
  const [form, setForm] = useState(blankForm);

  const persist = (updated) => {
    setTypes(updated);
    localStorage.setItem(STORAGE_KEY_TYPES, JSON.stringify(updated));
  };

  const openCreate = () => { setEditing(null); setForm(blankForm); setShowModal(true); };
  const openEdit   = (item) => {
    setEditing(item.id);
    setForm({ name: item.name, category: item.category, description: item.description ?? '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(blankForm); };

  const handleSave = (e) => {
    e.preventDefault();
    const val = form.name.trim();
    if (!val) { toast.error('Type name is required'); return; }
    if (!form.category) { toast.error('Please select a category'); return; }

    if (editing === null) {
      const isDup = types.some(t => t.name.toLowerCase() === val.toLowerCase() && t.category === form.category);
      if (isDup) { toast.error('This type already exists under that category'); return; }
      const newItem = { id: Date.now().toString(), name: val, category: form.category, description: form.description.trim() };
      persist([...types, newItem]);
      toast.success(`Type "${val}" added`);
    } else {
      persist(types.map(t => t.id === editing ? { ...t, name: val, category: form.category, description: form.description.trim() } : t));
      toast.success('Expense type updated');
    }
    closeModal();
  };

  const handleDelete = (id) => {
    persist(types.filter(t => t.id !== id));
    setConfirmDelete(null);
    toast.success('Expense type removed');
  };

  // Group types by category for display
  const grouped = categories.reduce((acc, cat) => {
    const catTypes = types.filter(t => t.category === cat);
    if (catTypes.length) acc[cat] = catTypes;
    return acc;
  }, {});
  const uncategorised = types.filter(t => !categories.includes(t.category));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Expense types are sub-classifications within a category — e.g. "Electricity"
          under "Utilities". They give you finer granularity in financial reports.
        </p>
        <Button onClick={openCreate} size="sm" className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add Type
        </Button>
      </div>

      {types.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400 italic">
          No expense types yet. Click "Add Type" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center gap-2 border-b border-gray-200">
                <Layers className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat}</span>
                <span className="ml-auto text-xs text-gray-400">{items.length} type{items.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800 w-1/3">{item.name}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{item.description || <span className="italic text-gray-300">No description</span>}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setConfirmDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {uncategorised.length > 0 && (
            <div className="rounded-xl border border-amber-200 overflow-hidden">
              <div className="bg-amber-50 px-4 py-2 flex items-center gap-2 border-b border-amber-200">
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Uncategorised</span>
              </div>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {uncategorised.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800 w-1/3">{item.name}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{item.description || <span className="italic text-gray-300">No description</span>}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setConfirmDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Expense Type' : 'New Expense Type'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="etype-cat">Category *</Label>
              <select
                id="etype-cat"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">— Select category —</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etype-name">Type Name *</Label>
              <Input
                id="etype-name"
                placeholder="e.g. Electricity"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etype-desc">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                id="etype-desc"
                placeholder="Brief description…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-1" />
                {editing ? 'Save Changes' : 'Add Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Expense Type</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Remove this expense type? Existing expense records that reference it
            will not be affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(confirmDelete)}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'accounts',      label: 'Accounts',      icon: PieChart,  Component: AccountsTab      },
  { id: 'categories',    label: 'Categories',    icon: Tag,       Component: CategoriesTab    },
  { id: 'expense-types', label: 'Expense Types', icon: Layers,    Component: ExpenseTypesTab  },
];

const AccountingConfiguration = () => {
  const [activeTab, setActiveTab] = useState('accounts');
  const ActiveComponent = TABS.find(t => t.id === activeTab)?.Component ?? AccountsTab;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-purple-50">
            <Settings2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Accounting Configuration</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage accounts, expense categories and expense types for your accounting module.
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default AccountingConfiguration;
