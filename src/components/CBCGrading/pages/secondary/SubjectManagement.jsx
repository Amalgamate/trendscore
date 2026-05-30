import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Filter, Plus, RefreshCw, Save, X } from 'lucide-react';
import { configAPI } from '../../../../services/api/config.api';

const gradeLabel = (g) => {
  const s = String(g || '');
  if (s.startsWith('GRADE_')) return `Grade ${s.replace('GRADE_', '')}`;
  if (s.startsWith('GRADE')) return `Grade ${s.replace('GRADE', '')}`;
  return s.replaceAll('_', ' ');
};

const SECONDARY_GRADES = new Set(['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3']);
const isSecondaryGrade = (g) => SECONDARY_GRADES.has(String(g || '').toUpperCase());

const GRADE_OPTIONS = [
  { value: 'GRADE10', label: 'Grade 10' },
  { value: 'GRADE11', label: 'Grade 11' },
  { value: 'GRADE12', label: 'Grade 12' },
];

const PATHWAY_OPTIONS = [
  { value: '', label: 'No pathway / Core' },
  { value: 'CORE', label: 'Core' },
  { value: 'STEM', label: 'STEM' },
  { value: 'SOCIAL_SCIENCES', label: 'Social Sciences' },
  { value: 'ARTS_SPORTS', label: 'Arts & Sports Science' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'No category' },
  { value: 'CORE', label: 'Core' },
  { value: 'PURE_SCIENCES', label: 'Pure Sciences' },
  { value: 'APPLIED_SCIENCES', label: 'Applied Sciences' },
  { value: 'TECH_ENGINEERING', label: 'Technical & Engineering' },
  { value: 'CTS', label: 'Career & Technology Studies' },
  { value: 'HUMANITIES', label: 'Humanities' },
  { value: 'LANGUAGES', label: 'Languages' },
  { value: 'ARTS', label: 'Arts' },
  { value: 'PERFORMING', label: 'Performing Arts' },
  { value: 'SPORTS_SCIENCE', label: 'Sports Science' },
  { value: 'SPORTS_OPTIONS', label: 'Sports Options' },
];

const emptyForm = {
  name: '',
  shortName: '',
  gradeLevel: 'GRADE10',
  pathway: '',
  category: '',
  isCore: false,
  description: '',
};

const Pill = ({ children, className = '' }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${className}`}>
    {children}
  </span>
);

const SubjectManagement = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [gradeLevel, setGradeLevel] = useState('');
  const [pathway, setPathway] = useState('');
  const [category, setCategory] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...(gradeLevel ? { gradeLevel } : {}),
        ...(pathway ? { pathway } : {}),
        ...(category ? { category } : {}),
      };
      const resp = await configAPI.getLearningAreas(params);
      const data = resp?.data || resp || [];
      const filtered = (Array.isArray(data) ? data : []).filter((r) => isSecondaryGrade(r?.gradeLevel));
      setRows(filtered);
    } catch (e) {
      setError(e?.message || 'Failed to load learning areas');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeLevel, pathway, category]);

  const filters = useMemo(() => {
    const grades = Array.from(new Set(rows.map((r) => r.gradeLevel).filter(Boolean))).sort();
    const pathways = Array.from(new Set(rows.map((r) => r.pathway).filter(Boolean))).sort();
    const categories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort();
    return { grades, pathways, categories };
  }, [rows]);

  const shown = useMemo(() => {
    return rows
      .slice()
      .sort((a, b) => {
        const ag = String(a.gradeLevel || '');
        const bg = String(b.gradeLevel || '');
        if (ag !== bg) return ag.localeCompare(bg);
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
  }, [rows]);

  const seedLearningAreas = async () => {
    setSeeding(true);
    setError(null);
    try {
      await configAPI.seedLearningAreas();
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to seed learning areas');
    } finally {
      setSeeding(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      shortName: row.shortName || '',
      gradeLevel: row.gradeLevel || 'GRADE10',
      pathway: row.pathway || '',
      category: row.category || '',
      isCore: Boolean(row.isCore),
      description: row.description || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveSubject = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Subject name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        shortName: form.shortName.trim() || form.name.trim().slice(0, 5).toUpperCase(),
        pathway: form.pathway,
        category: form.category,
        isCore: Boolean(form.isCore || form.pathway === 'CORE'),
        icon: '🎓',
        color: '#6366f1',
      };
      if (editingId) await configAPI.updateLearningArea(editingId, payload);
      else await configAPI.createLearningArea(payload);
      closeForm();
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Subject Catalog</h1>
            <Pill className="bg-indigo-50 text-indigo-800 border-indigo-200">Secondary</Pill>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-600">
            Manage Senior School subjects used in tests and pathway setup.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold uppercase tracking-widest shadow hover:bg-indigo-700"
          >
            <Plus size={16} />
            Add Subject
          </button>
          <button
            type="button"
            onClick={seedLearningAreas}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-semibold uppercase tracking-widest hover:bg-indigo-100 disabled:opacity-60"
          >
            <Filter size={16} />
            {seeding ? 'Seeding…' : 'Seed Learning Areas'}
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {formOpen && (
        <form onSubmit={saveSubject} className="rounded-2xl border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                {editingId ? 'Edit Subject' : 'Add Subject'}
              </div>
              <div className="text-lg font-semibold text-gray-900">Senior School subject details</div>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <X size={16} />
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-600">
              Subject Name
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Computer Studies"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-600">
              Short Name
              <input
                value={form.shortName}
                onChange={(event) => setForm((prev) => ({ ...prev, shortName: event.target.value }))}
                placeholder="e.g. COMP"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-600">
              Grade
              <select
                value={form.gradeLevel}
                onChange={(event) => setForm((prev) => ({ ...prev, gradeLevel: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-600">
              Pathway
              <select
                value={form.pathway}
                onChange={(event) => setForm((prev) => ({ ...prev, pathway: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
              >
                {PATHWAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-600">
              Category
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800 mt-6">
              <input
                type="checkbox"
                checked={form.isCore}
                onChange={(event) => setForm((prev) => ({ ...prev, isCore: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Core subject
            </label>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-600">
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save Subject'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
          <Filter size={16} />
          Filters
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            Grade
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
            >
              <option value="">All</option>
              {filters.grades.map((g) => (
                <option key={g} value={g}>{gradeLabel(g)}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            Pathway
            <select
              value={pathway}
              onChange={(e) => setPathway(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
            >
              <option value="">All</option>
              {filters.pathways.map((p) => (
                <option key={p} value={p}>{String(p).replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
            >
              <option value="">All</option>
              {filters.categories.map((c) => (
                <option key={c} value={c}>{String(c).replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm font-medium text-gray-600">Loading…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">{error}</div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b text-xs font-semibold uppercase tracking-widest text-gray-500">
            {shown.length} learning areas
          </div>
          <div className="divide-y">
            {shown.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{r.name}</div>
                  <div className="mt-1 text-xs font-medium text-gray-600">
                    {gradeLabel(r.gradeLevel)}
                    {r.shortName ? ` • ${r.shortName}` : ''}
                    {r.isCore ? ' • Core' : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {r.pathway && (
                    <Pill className="bg-indigo-50 text-indigo-800 border-indigo-200">
                      {String(r.pathway).replaceAll('_', ' ')}
                    </Pill>
                  )}
                  {r.category && (
                    <Pill className="bg-slate-50 text-slate-700 border-slate-200">
                      {String(r.category).replaceAll('_', ' ')}
                    </Pill>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-700 hover:bg-gray-50"
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                </div>
              </div>
            ))}
            {shown.length === 0 && (
              <div className="px-4 py-10 text-center text-sm font-medium text-gray-600">
                No learning areas match these filters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectManagement;
