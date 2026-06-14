import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bus,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Edit3,
  Eye,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import api from '../../../../services/api';

const COMMON_ITEMS = [
  { code: 'TUITION', name: 'Tuition / Initial amount', required: true },
  { code: 'ADMISSION', name: 'Admission fee' },
  { code: 'TRANSPORT', name: 'Transport' },
  { code: 'UNIFORM', name: 'Uniforms' },
  { code: 'BOOKS', name: 'Books / learning materials' },
  { code: 'MEALS', name: 'Meals' },
  { code: 'EXAM', name: 'Exam fee' },
  { code: 'ACTIVITY', name: 'Activity fee' },
];

const GROUP_META = {
  'Core fee': { tone: 'blue', icon: BookOpen },
  'Other fee items': { tone: 'emerald', icon: ClipboardList },
  'One-time fees': { tone: 'violet', icon: Plus },
  'Optional services': { tone: 'amber', icon: Bus },
};

const TONE_CLASSES = {
  blue: {
    shell: 'border-blue-100 bg-blue-50/50',
    icon: 'bg-blue-100 text-blue-700',
    label: 'text-blue-700',
  },
  emerald: {
    shell: 'border-emerald-100 bg-emerald-50/50',
    icon: 'bg-emerald-100 text-emerald-700',
    label: 'text-emerald-700',
  },
  violet: {
    shell: 'border-violet-100 bg-violet-50/50',
    icon: 'bg-violet-100 text-violet-700',
    label: 'text-violet-700',
  },
  amber: {
    shell: 'border-amber-100 bg-amber-50/50',
    icon: 'bg-amber-100 text-amber-700',
    label: 'text-amber-700',
  },
};

const emptyForm = (learnerId) => ({
  learnerId,
  name: 'Student fee setup',
  status: 'PENDING_APPROVAL',
  startTerm: 'TERM_1',
  startAcademicYear: new Date().getFullYear(),
  endTerm: null,
  endAcademicYear: null,
  fullExemption: false,
  sponsorName: '',
  sponsorReference: '',
  reason: '',
  notes: '',
  adjustments: [],
});

const formatMoney = (value) => `KES ${Number(value || 0).toLocaleString()}`;
const itemCode = (item) => String(item.code || item.feeType?.code || item.feeTypeId || '').toUpperCase();
const itemKey = (item) => item.feeTypeId || item.code;

const inferBucket = (item) => {
  const code = itemCode(item);
  const label = `${item.name || ''} ${item.feeType?.name || ''}`.toLowerCase();
  if (code === 'TUITION' || label.includes('tuition') || label.includes('term fee')) return 'Core fee';
  if (code === 'ADMISSION' || label.includes('admission')) return 'One-time fees';
  if (['TRANSPORT', 'UNIFORM', 'BOOKS', 'MEALS'].includes(code)) return 'Optional services';
  return 'Other fee items';
};

export default function LearnerFeeConfigurator({ learner, user, onChanged }) {
  const [configurations, setConfigurations] = useState([]);
  const [structures, setStructures] = useState([]);
  const [form, setForm] = useState(() => emptyForm(learner.id));
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  const canApprove = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const canEdit = ['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const matchingStructure = useMemo(() => structures.find((structure) =>
    String(structure.grade) === String(learner.grade)
    && structure.term === form.startTerm
    && Number(structure.academicYear) === Number(form.startAcademicYear)
  ), [form.startAcademicYear, form.startTerm, learner.grade, structures]);

  const feeRows = useMemo(() => {
    const rows = [];
    const seen = new Set();
    (matchingStructure?.feeItems || []).forEach((item) => {
      const code = itemCode(item);
      seen.add(code);
      rows.push({
        id: item.id,
        feeTypeId: item.feeTypeId,
        code,
        name: item.feeType?.name || item.name || 'Fee item',
        standardAmount: Number(item.amount || 0),
        source: 'structure',
        required: code === 'TUITION',
      });
    });
    COMMON_ITEMS.forEach((item) => {
      if (seen.has(item.code)) return;
      rows.push({
        ...item,
        id: item.code,
        feeTypeId: item.code,
        standardAmount: 0,
        source: 'custom',
      });
    });
    return rows;
  }, [matchingStructure]);

  const groupedRows = useMemo(() => feeRows.reduce((groups, row) => {
    const bucket = inferBucket(row);
    groups[bucket] = groups[bucket] || [];
    groups[bucket].push(row);
    return groups;
  }, {}), [feeRows]);

  const load = useCallback(async () => {
    const [configResponse, structureResponse] = await Promise.all([
      api.fees.getLearnerFeeConfigurations(learner.id),
      api.fees.getAllFeeStructures({ academicYear: form.startAcademicYear }),
    ]);
    setConfigurations(configResponse.data || []);
    setStructures(structureResponse.data || []);
  }, [form.startAcademicYear, learner.id]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const adjustmentFor = (row) => {
    const key = itemKey(row);
    return form.adjustments.find((item) => item.feeTypeId === key || item.code === row.code) || {
      feeTypeId: key,
      code: row.code,
      name: row.name,
      included: row.required || row.standardAmount > 0,
      mode: 'CUSTOM_AMOUNT',
      value: row.standardAmount || '',
      standardAmount: row.standardAmount || 0,
    };
  };

  const updateAdjustment = (row, patch) => {
    const current = adjustmentFor(row);
    const key = itemKey(row);
    setForm((previous) => ({
      ...previous,
      adjustments: [
        ...previous.adjustments.filter((item) => item.feeTypeId !== key && item.code !== row.code),
        {
          ...current,
          feeTypeId: key,
          code: row.code,
          name: row.name,
          standardAmount: row.standardAmount || 0,
          mode: 'CUSTOM_AMOUNT',
          ...patch,
        },
      ],
    }));
  };

  const buildAdjustments = () => feeRows
    .map((row) => {
      const adjustment = adjustmentFor(row);
      return {
        ...adjustment,
        feeTypeId: itemKey(row),
        code: row.code,
        name: row.name,
        source: row.source,
        included: row.required ? true : !!adjustment.included,
        mode: adjustment.included === false ? 'EXCLUDE' : 'CUSTOM_AMOUNT',
        value: Number(adjustment.value || 0),
        standardAmount: Number(row.standardAmount || adjustment.standardAmount || 0),
      };
    })
    .filter((item) => item.included || item.value > 0 || item.source === 'structure');

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        endTerm: form.endTerm || null,
        endAcademicYear: form.endTerm ? Number(form.endAcademicYear || form.startAcademicYear) : null,
        startAcademicYear: Number(form.startAcademicYear),
        adjustments: buildAdjustments(),
      };
      if (editingId) await api.fees.updateLearnerFeeConfiguration(editingId, payload);
      else await api.fees.createLearnerFeeConfiguration(payload);
      setForm(emptyForm(learner.id));
      setEditingId(null);
      setPreview(null);
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const edit = (configuration) => {
    setEditingId(configuration.id);
    setForm({
      ...emptyForm(learner.id),
      ...configuration,
      sponsorName: configuration.sponsorName || '',
      sponsorReference: configuration.sponsorReference || '',
      reason: configuration.reason || '',
      notes: configuration.notes || '',
      adjustments: Array.isArray(configuration.adjustments) ? configuration.adjustments : [],
    });
  };

  const approve = async (id) => {
    await api.fees.approveLearnerFeeConfiguration(id);
    await load();
    onChanged?.();
  };

  const revoke = async (id) => {
    await api.fees.revokeLearnerFeeConfiguration(id);
    await load();
    onChanged?.();
  };

  const runPreview = async () => {
    if (!matchingStructure) return;
    const response = await api.fees.previewLearnerFeeConfiguration({
      learnerId: learner.id,
      feeStructureId: matchingStructure.id,
      term: form.startTerm,
      academicYear: Number(form.startAcademicYear),
      configuration: { ...form, adjustments: buildAdjustments() },
    });
    setPreview(response.data);
  };

  const selectedItems = buildAdjustments().filter((item) => item.included);
  const selectedTotal = selectedItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const summaryTotals = selectedItems.reduce((totals, item) => {
    const bucket = inferBucket(item);
    totals[bucket] = (totals[bucket] || 0) + Number(item.value || 0);
    return totals;
  }, {});

  const updateMainTotal = (nextTotal) => {
    const targetTotal = Math.max(0, Number(nextTotal) || 0);
    const coreRow = feeRows.find((row) => row.required || row.code === 'TUITION') || feeRows[0];
    if (!coreRow) return;
    const otherTotal = feeRows
      .filter((row) => itemKey(row) !== itemKey(coreRow))
      .reduce((sum, row) => {
        const adjustment = adjustmentFor(row);
        return sum + (adjustment.included ? Number(adjustment.value || 0) : 0);
      }, 0);
    updateAdjustment(coreRow, {
      included: true,
      value: Math.max(0, targetTotal - otherTotal),
    });
  };

  return (
    <section className="mx-auto max-w-6xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CreditCard size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-950">Student Fee Setup</h3>
              <p className="text-xs text-slate-500">Current term and year are applied automatically.</p>
            </div>
          </div>

          {canEdit && (
            <div className="space-y-4 p-4">
              <div className="grid gap-2 md:grid-cols-[240px_1fr_1fr]">
                <Field label="Fee mode">
                  <div className="grid h-10 grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, fullExemption: false })}
                      className={`rounded-md text-xs font-black ${!form.fullExemption ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                    >
                      Partial
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, fullExemption: true })}
                      className={`rounded-md text-xs font-black ${form.fullExemption ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500'}`}
                    >
                      Full
                    </button>
                  </div>
                </Field>
                <Field label="Reason / category">
                  <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.reason}
                    onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="e.g. Scholarship, Staff, Sibling discount" />
                </Field>
                <Field label="Internal notes">
                  <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add notes for this fee setup" />
                </Field>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-950">Fee Items</h4>
                    <p className="text-xs text-slate-500">Configure all applicable fee items for this student.</p>
                  </div>
                  <p className="text-xs font-semibold text-slate-400">Open one group at a time</p>
                </div>

                {matchingStructure ? (
                  <div className="space-y-2">
                    {Object.entries(groupedRows).map(([group, rows]) => {
                      const groupOpen = openGroup === group;
                      const groupTotal = rows.reduce((sum, row) => {
                        const adjustment = adjustmentFor(row);
                        return sum + (adjustment.included ? Number(adjustment.value || 0) : 0);
                      }, 0);
                      const meta = GROUP_META[group] || GROUP_META['Other fee items'];
                      const tone = TONE_CLASSES[meta.tone];
                      const GroupIcon = meta.icon;
                      return (
                        <div key={group} className={`overflow-hidden rounded-xl border ${tone.shell}`}>
                          <button type="button" onClick={() => setOpenGroup(groupOpen ? null : group)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left">
                            <span className={`flex items-center gap-2 text-xs font-black uppercase ${tone.label}`}>
                              <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${tone.icon}`}>
                                <GroupIcon size={14} />
                              </span>
                              {group}
                            </span>
                            <span className="flex items-center gap-3 text-xs font-black text-slate-900">
                              {formatMoney(groupTotal)}
                              <ChevronDown size={15} className={`transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
                            </span>
                          </button>
                          {groupOpen && (
                            <div className={`mx-3 mb-3 overflow-hidden rounded-xl border border-white/80 bg-white ${form.fullExemption ? 'opacity-55 grayscale' : ''}`}>
                              {rows.map((row) => {
                                const adjustment = adjustmentFor(row);
                                const checked = row.required || !!adjustment.included;
                                return (
                                  <div key={row.id} className="grid items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 md:grid-cols-[minmax(220px,1fr)_100px_160px_110px]">
                                    <label className="flex min-w-0 items-center gap-3">
                                      <input type="checkbox" checked={checked} disabled={row.required || form.fullExemption}
                                        onChange={(event) => updateAdjustment(row, { included: event.target.checked })} />
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-black text-slate-800">{row.name}</span>
                                        <span className="mt-1 inline-flex rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                          {row.required ? 'Mandatory' : row.source === 'structure' ? 'Structured' : 'Optional'}
                                        </span>
                                      </span>
                                    </label>
                                    <span className="text-xs font-black text-slate-400">{row.code}</span>
                                    <div>
                                      <label className="mb-1 block text-[9px] font-bold uppercase text-slate-400">Amount (KES)</label>
                                      <input className="h-8 w-full rounded-md border border-slate-200 px-2 text-right text-sm font-black text-slate-900 disabled:bg-slate-100 disabled:text-slate-400" type="number" min="0"
                                        disabled={form.fullExemption || !checked}
                                        value={adjustment.value ?? ''}
                                        onChange={(event) => updateAdjustment(row, { value: event.target.value, included: true })} />
                                    </div>
                                    <div className="text-right text-xs font-black text-slate-600">
                                      {checked ? formatMoney(adjustment.value || 0) : 'Off'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    No fee structure exists for {learner.grade}, {form.startTerm.replace('_', ' ')} {form.startAcademicYear}.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CreditCard size={17} />
              </div>
              <h4 className="text-sm font-black uppercase text-slate-700">Fee Summary</h4>
            </div>

            <div className="space-y-3 text-sm">
              {['Core fee', 'Other fee items', 'One-time fees', 'Optional services'].map((group) => (
                <div key={group} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500">{group}</span>
                  <span className="text-xs font-black text-slate-950">{formatMoney(summaryTotals[group] || 0)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-slate-200 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase text-indigo-700">Discounts / Adjustments</span>
                  <span className="text-xs font-black text-indigo-700">{preview ? formatMoney(preview.adjustmentAmount) : 'KES 0'}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-emerald-700">Editable total</p>
                  <input className="mt-1 w-full bg-transparent text-2xl font-black text-emerald-700 outline-none" type="number" min="0"
                    disabled={form.fullExemption}
                    value={selectedTotal}
                    onChange={(event) => updateMainTotal(event.target.value)} />
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Pencil size={16} />
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-indigo-50 px-3 py-3 text-xs font-semibold text-indigo-700">
              This total will be applied from {form.startTerm.replace('_', ' ')}, {form.startAcademicYear} onward.
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total items</p>
                <p className="mt-1 text-xl font-black text-slate-950">{selectedItems.length}</p>
                <p className="text-[10px] text-slate-500">Active items</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                <ShieldCheck size={22} className="mx-auto mt-2 text-emerald-600" />
                <p className="mt-1 text-[10px] font-semibold text-slate-500">{form.fullExemption ? 'Full exempt' : 'Partial'}</p>
              </div>
            </div>

            <button disabled={!matchingStructure} onClick={runPreview}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 px-3 py-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">
              <Eye size={14} /> Preview Statement
            </button>
            <button disabled={saving || !matchingStructure || !canEdit} onClick={save}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : editingId ? 'Save Fee Setup' : 'Save Fee Setup'}
            </button>
          </div>

          {preview && (
            <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-sm">
              <p className="mb-3 text-xs font-black uppercase text-slate-400">Preview</p>
              <div className="space-y-2 text-sm">
                <SummaryLine label="Base" value={formatMoney(preview.grossAmount)} />
                <SummaryLine label="Adjustments" value={formatMoney(preview.adjustmentAmount)} />
                <SummaryLine label="Student" value={formatMoney(preview.studentAmount)} />
                <SummaryLine label="Invoice due" value={formatMoney(preview.totalAmount)} strong />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {configurations.length === 0 && <p className="px-1 py-2 text-sm text-slate-500">No individual fee setups recorded.</p>}
            <div className="space-y-2">
              {configurations.map((configuration) => (
                <div key={configuration.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{configuration.name}</p>
                      <p className="text-[11px] text-slate-500">
                        From {configuration.startTerm.replace('_', ' ')} {configuration.startAcademicYear}
                        {configuration.endTerm ? ` through ${configuration.endTerm.replace('_', ' ')} ${configuration.endAcademicYear}` : ' until amended'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black ${configuration.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : configuration.status === 'REVOKED' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                      {configuration.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    {configuration.status !== 'REVOKED' && canEdit && (
                      <button title="Edit" onClick={() => edit(configuration)} className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"><Edit3 size={14} /></button>
                    )}
                    {!['APPROVED', 'REVOKED'].includes(configuration.status) && canApprove && (
                      <button title="Approve" onClick={() => approve(configuration.id)} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><ShieldCheck size={15} /></button>
                    )}
                    {configuration.status === 'APPROVED' && canApprove && (
                      <button title="Revoke" onClick={() => revoke(configuration.id)} className="rounded p-1.5 text-red-600 hover:bg-red-50"><XCircle size={15} /></button>
                    )}
                    {configuration.status === 'APPROVED' && <CheckCircle size={15} className="text-emerald-600" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <label className="block rounded-xl border border-slate-200 bg-white p-2">
      <span className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
        {Icon && <Icon size={13} className="text-indigo-500" />}
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryLine({ label, value, strong }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'border-t border-white/10 pt-2 font-black' : ''}`}>
      <span className="text-slate-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}
