import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Bus,
  Calendar,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Edit3,
  Eye,
  GraduationCap,
  Infinity,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  Trash2,
  XCircle,
} from 'lucide-react';
import api from '../../../../services/api';

// ─── Scholarship options ──────────────────────────────────────────────────────

const SCHOLARSHIP_OPTIONS = [
  {
    value: 'NONE',
    label: 'No scholarship',
    sublabel: 'Configure per-item amounts manually',
    activeClasses: 'border-slate-700 bg-slate-700 text-white',
    idleClasses: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400',
    icon: Sliders,
  },
  {
    value: 'FULL',
    label: 'Full scholarship',
    sublabel: 'Student pays nothing — all fees waived',
    activeClasses: 'border-red-600 bg-red-600 text-white',
    idleClasses: 'border-slate-200 bg-white text-slate-600 hover:border-red-300',
    icon: Award,
  },
  {
    value: 'HALF',
    label: 'Half scholarship',
    sublabel: '50% discount on every fee item',
    activeClasses: 'border-violet-600 bg-violet-600 text-white',
    idleClasses: 'border-slate-200 bg-white text-slate-600 hover:border-violet-300',
    icon: GraduationCap,
  },
  {
    value: 'PARTIAL_AMOUNT',
    label: 'Partial scholarship',
    sublabel: 'Student pays a specific fixed amount',
    activeClasses: 'border-amber-500 bg-amber-500 text-white',
    idleClasses: 'border-slate-200 bg-white text-slate-600 hover:border-amber-300',
    icon: Pencil,
  },
];

// ─── Duration presets ─────────────────────────────────────────────────────────

const DURATION_PRESETS = [
  {
    value: 'TERM',
    label: 'This term only',
    sublabel: 'Expires after the selected term',
    icon: Calendar,
    resolve: ({ startTerm, startAcademicYear }) => ({
      endTerm: startTerm,
      endAcademicYear: Number(startAcademicYear),
    }),
  },
  {
    value: 'YEAR',
    label: 'This academic year',
    sublabel: 'Covers all three terms of the year',
    icon: RotateCcw,
    resolve: ({ startAcademicYear }) => ({
      endTerm: 'TERM_3',
      endAcademicYear: Number(startAcademicYear),
    }),
  },
  {
    value: 'ONGOING',
    label: 'Ongoing',
    sublabel: 'No end date — applies until revoked',
    icon: Infinity,
    resolve: () => ({ endTerm: null, endAcademicYear: null }),
  },
  {
    value: 'CUSTOM',
    label: 'Custom range',
    sublabel: 'Set a specific end term and year',
    icon: ChevronDown,
    resolve: ({ customEndTerm, customEndAcademicYear }) => ({
      endTerm: customEndTerm || null,
      endAcademicYear: customEndTerm ? Number(customEndAcademicYear) : null,
    }),
  },
];

// ─── Other constants ──────────────────────────────────────────────────────────

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

const TERMS = ['TERM_1', 'TERM_2', 'TERM_3'];

const GROUP_META = {
  'Core fee':          { tone: 'blue',    icon: BookOpen },
  'Other fee items':   { tone: 'emerald', icon: ClipboardList },
  'One-time fees':     { tone: 'violet',  icon: Plus },
  'Optional services': { tone: 'amber',   icon: Bus },
};

const TONE_CLASSES = {
  blue:    { shell: 'border-blue-100 bg-blue-50/50',       icon: 'bg-blue-100 text-blue-700',       label: 'text-blue-700' },
  emerald: { shell: 'border-emerald-100 bg-emerald-50/50', icon: 'bg-emerald-100 text-emerald-700', label: 'text-emerald-700' },
  violet:  { shell: 'border-violet-100 bg-violet-50/50',   icon: 'bg-violet-100 text-violet-700',   label: 'text-violet-700' },
  amber:   { shell: 'border-amber-100 bg-amber-50/50',     icon: 'bg-amber-100 text-amber-700',     label: 'text-amber-700' },
};

const SCHOLARSHIP_BADGE = {
  NONE:           { label: 'Standard',           classes: 'bg-slate-100 text-slate-600' },
  FULL:           { label: 'Full Scholarship',    classes: 'bg-red-100 text-red-700' },
  HALF:           { label: 'Half Scholarship',    classes: 'bg-violet-100 text-violet-700' },
  PARTIAL_AMOUNT: { label: 'Partial Scholarship', classes: 'bg-amber-100 text-amber-700' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyForm = (learnerId) => ({
  learnerId,
  name: 'Student fee setup',
  status: 'PENDING_APPROVAL',
  startTerm: 'TERM_1',
  startAcademicYear: new Date().getFullYear(),
  // Duration preset — drives endTerm / endAcademicYear on save
  duration: 'ONGOING',
  customEndTerm: 'TERM_3',
  customEndAcademicYear: new Date().getFullYear(),
  endTerm: null,
  endAcademicYear: null,
  scholarshipType: 'NONE',
  scholarshipAmount: '',
  fullExemption: false,
  sponsorName: '',
  sponsorReference: '',
  reason: '',
  notes: '',
  adjustments: [],
});

/** Reverse-engineer the duration preset from an existing config's end dates */
const inferDuration = (cfg) => {
  if (!cfg.endTerm) return 'ONGOING';
  if (
    cfg.endTerm === cfg.startTerm &&
    Number(cfg.endAcademicYear) === Number(cfg.startAcademicYear)
  ) return 'TERM';
  if (
    cfg.endTerm === 'TERM_3' &&
    Number(cfg.endAcademicYear) === Number(cfg.startAcademicYear)
  ) return 'YEAR';
  return 'CUSTOM';
};

const formatMoney = (v) => `KES ${Number(v || 0).toLocaleString()}`;
const itemCode   = (item) => String(item.code || item.feeType?.code || item.feeTypeId || '').toUpperCase();
const itemKey    = (item) => item.feeTypeId || item.code;
const termLabel  = (t) => t?.replace('_', ' ') ?? '';

const inferBucket = (item) => {
  const code  = itemCode(item);
  const label = `${item.name || ''} ${item.feeType?.name || ''}`.toLowerCase();
  if (code === 'TUITION' || label.includes('tuition') || label.includes('term fee')) return 'Core fee';
  if (code === 'ADMISSION' || label.includes('admission')) return 'One-time fees';
  if (['TRANSPORT', 'UNIFORM', 'BOOKS', 'MEALS'].includes(code)) return 'Optional services';
  return 'Other fee items';
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LearnerFeeConfigurator({ learner, user, onChanged }) {
  const [configurations, setConfigurations] = useState([]);
  const [structures,     setStructures]     = useState([]);
  const [form,           setForm]           = useState(() => emptyForm(learner.id));
  const [editingId,      setEditingId]      = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [preview,        setPreview]        = useState(null);
  const [openGroup,      setOpenGroup]      = useState(null);

  const canApprove = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const canEdit    = ['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const scholarshipLock = form.scholarshipType === 'FULL' || form.scholarshipType === 'HALF';

  // ── Seed form with the active term from the server ────────────────────────
  // This runs once on mount so the configurator defaults to the school's current
  // active term (e.g. TERM_3 2026) instead of always showing TERM_1.
  useEffect(() => {
    api.config.getActiveTermConfig()
      .then((resp) => {
        const payload = resp?.data ?? resp ?? null;
        if (payload?.term && payload?.academicYear) {
          setForm((prev) => ({
            ...prev,
            startTerm:         payload.term,
            startAcademicYear: Number(payload.academicYear),
            // Keep custom end year in sync with start year for YEAR preset
            customEndAcademicYear: Number(payload.academicYear),
          }));
        }
      })
      .catch(() => {/* leave defaults */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resolved end dates from the duration preset ───────────────────────────
  const resolvedEnd = useMemo(() => {
    const preset = DURATION_PRESETS.find((p) => p.value === form.duration) || DURATION_PRESETS[2];
    return preset.resolve({
      startTerm:             form.startTerm,
      startAcademicYear:     form.startAcademicYear,
      customEndTerm:         form.customEndTerm,
      customEndAcademicYear: form.customEndAcademicYear,
    });
  }, [form.duration, form.startTerm, form.startAcademicYear, form.customEndTerm, form.customEndAcademicYear]);

  // ── Fee structure matching ────────────────────────────────────────────────
  const matchingStructure = useMemo(() =>
    structures.find((s) =>
      String(s.grade) === String(learner.grade) &&
      s.term === form.startTerm &&
      Number(s.academicYear) === Number(form.startAcademicYear)
    ),
  [form.startAcademicYear, form.startTerm, learner.grade, structures]);

  const feeRows = useMemo(() => {
    const rows = [];
    const seen = new Set();
    (matchingStructure?.feeItems || []).forEach((item) => {
      const code = itemCode(item);
      seen.add(code);
      rows.push({
        id: item.id, feeTypeId: item.feeTypeId, code,
        name: item.feeType?.name || item.name || 'Fee item',
        standardAmount: Number(item.amount || 0),
        source: 'structure', required: code === 'TUITION',
      });
    });
    COMMON_ITEMS.forEach((item) => {
      if (seen.has(item.code)) return;
      rows.push({ ...item, id: item.code, feeTypeId: item.code, standardAmount: 0, source: 'custom' });
    });
    return rows;
  }, [matchingStructure]);

  const groupedRows = useMemo(() =>
    feeRows.reduce((groups, row) => {
      const bucket = inferBucket(row);
      groups[bucket] = groups[bucket] || [];
      groups[bucket].push(row);
      return groups;
    }, {}),
  [feeRows]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [cfgRes, strRes] = await Promise.all([
      api.fees.getLearnerFeeConfigurations(learner.id),
      api.fees.getAllFeeStructures({ academicYear: form.startAcademicYear }),
    ]);
    setConfigurations(cfgRes.data || []);
    setStructures(strRes.data || []);
  }, [form.startAcademicYear, learner.id]);

  useEffect(() => { load().catch(console.error); }, [load]);

  // ── Adjustments ───────────────────────────────────────────────────────────
  const adjustmentFor = (row) => {
    const key = itemKey(row);
    return (
      form.adjustments.find((a) => a.feeTypeId === key || a.code === row.code) || {
        feeTypeId: key, code: row.code, name: row.name,
        included: row.required || row.standardAmount > 0,
        mode: 'CUSTOM_AMOUNT', value: row.standardAmount || '', standardAmount: row.standardAmount || 0,
      }
    );
  };

  const updateAdjustment = (row, patch) => {
    const current = adjustmentFor(row);
    const key = itemKey(row);
    setForm((prev) => ({
      ...prev,
      adjustments: [
        ...prev.adjustments.filter((a) => a.feeTypeId !== key && a.code !== row.code),
        { ...current, feeTypeId: key, code: row.code, name: row.name,
          standardAmount: row.standardAmount || 0, mode: 'CUSTOM_AMOUNT', ...patch },
      ],
    }));
  };

  const buildAdjustments = () =>
    feeRows
      .map((row) => {
        const adj = adjustmentFor(row);
        return {
          ...adj, feeTypeId: itemKey(row), code: row.code, name: row.name, source: row.source,
          included: row.required ? true : !!adj.included,
          mode: adj.included === false ? 'EXCLUDE' : 'CUSTOM_AMOUNT',
          value: Number(adj.value || 0),
          standardAmount: Number(row.standardAmount || adj.standardAmount || 0),
        };
      })
      .filter((a) => a.included || a.value > 0 || a.source === 'structure');

  // ── Scholarship type ──────────────────────────────────────────────────────
  const setScholarshipType = (type) => {
    setForm((prev) => ({
      ...prev,
      scholarshipType: type,
      fullExemption: type === 'FULL',
      scholarshipAmount: type === 'PARTIAL_AMOUNT' ? (prev.scholarshipAmount || '') : '',
    }));
    setPreview(null);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        startAcademicYear: Number(form.startAcademicYear),
        endTerm:          resolvedEnd.endTerm,
        endAcademicYear:  resolvedEnd.endAcademicYear,
        fullExemption:    form.scholarshipType === 'FULL',
        scholarshipAmount:
          form.scholarshipType === 'PARTIAL_AMOUNT' ? Number(form.scholarshipAmount || 0) : null,
        adjustments: buildAdjustments(),
      };
      if (editingId) await api.fees.updateLearnerFeeConfiguration(editingId, payload);
      else           await api.fees.createLearnerFeeConfiguration(payload);
      resetForm();
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    // Preserve the current startTerm/startAcademicYear so after saving the
    // form stays on the active term rather than snapping back to TERM_1.
    const activeTerm         = form.startTerm;
    const activeAcademicYear = form.startAcademicYear;
    setForm({
      ...emptyForm(learner.id),
      startTerm:             activeTerm,
      startAcademicYear:     activeAcademicYear,
      customEndAcademicYear: activeAcademicYear,
    });
    setEditingId(null);
    setPreview(null);
  };

  // ── Edit / approve / revoke / delete ─────────────────────────────────────
  const edit = (cfg) => {
    setEditingId(cfg.id);
    const duration = inferDuration(cfg);
    setForm({
      ...emptyForm(learner.id),
      ...cfg,
      duration,
      customEndTerm:         cfg.endTerm         || 'TERM_3',
      customEndAcademicYear: cfg.endAcademicYear || new Date().getFullYear(),
      scholarshipType:  cfg.scholarshipType  || 'NONE',
      scholarshipAmount: cfg.scholarshipAmount != null ? cfg.scholarshipAmount : '',
      sponsorName:       cfg.sponsorName      || '',
      sponsorReference:  cfg.sponsorReference || '',
      reason:  cfg.reason || '',
      notes:   cfg.notes  || '',
      adjustments: Array.isArray(cfg.adjustments) ? cfg.adjustments : [],
    });
    setPreview(null);
  };

  const approve = async (id) => {
    await api.fees.approveLearnerFeeConfiguration(id);
    await load();
    onChanged?.();
  };

  const revoke = async (id, name) => {
    const ok = window.confirm(
      `Revoke the scholarship "${name}"?\n\nThis will cancel the fee configuration. Unpaid invoices will NOT be automatically revised — use "Revise Invoice" on the Fee Statement if needed.`
    );
    if (!ok) return;
    await api.fees.revokeLearnerFeeConfiguration(id);
    await load();
    onChanged?.();
  };

  const destroy = async (id, name) => {
    const ok = window.confirm(`Delete the pending configuration "${name}"?\nThis cannot be undone.`);
    if (!ok) return;
    try {
      await api.fees.deleteLearnerFeeConfiguration(id);
      await load();
      onChanged?.();
    } catch (err) {
      alert(err?.message || 'Could not delete this configuration.');
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const runPreview = async () => {
    if (!matchingStructure) return;
    const resp = await api.fees.previewLearnerFeeConfiguration({
      learnerId:      learner.id,
      feeStructureId: matchingStructure.id,
      term:           form.startTerm,
      academicYear:   Number(form.startAcademicYear),
      configuration: {
        ...form,
        fullExemption:    form.scholarshipType === 'FULL',
        scholarshipAmount:
          form.scholarshipType === 'PARTIAL_AMOUNT' ? Number(form.scholarshipAmount || 0) : null,
        adjustments: buildAdjustments(),
      },
    });
    setPreview(resp.data);
  };

  // ── Summary totals ────────────────────────────────────────────────────────
  const selectedItems = buildAdjustments().filter((a) => a.included);
  const selectedTotal = selectedItems.reduce((s, a) => s + Number(a.value || 0), 0);
  const summaryTotals = selectedItems.reduce((totals, a) => {
    const bucket = inferBucket(a);
    totals[bucket] = (totals[bucket] || 0) + Number(a.value || 0);
    return totals;
  }, {});

  const updateMainTotal = (nextTotal) => {
    const target  = Math.max(0, Number(nextTotal) || 0);
    const coreRow = feeRows.find((r) => r.required || r.code === 'TUITION') || feeRows[0];
    if (!coreRow) return;
    const otherTotal = feeRows
      .filter((r) => itemKey(r) !== itemKey(coreRow))
      .reduce((s, r) => s + (adjustmentFor(r).included ? Number(adjustmentFor(r).value || 0) : 0), 0);
    updateAdjustment(coreRow, { included: true, value: Math.max(0, target - otherTotal) });
  };

  const partialAmountValid =
    form.scholarshipType !== 'PARTIAL_AMOUNT' || Number(form.scholarshipAmount) > 0;
  const canSave = !saving && !!matchingStructure && canEdit && partialAmountValid;
  const badge   = SCHOLARSHIP_BADGE[form.scholarshipType] || SCHOLARSHIP_BADGE.NONE;

  // ── Duration description for history cards ────────────────────────────────
  const durationText = (cfg) => {
    const start = `${termLabel(cfg.startTerm)} ${cfg.startAcademicYear}`;
    if (!cfg.endTerm) return `From ${start} · Ongoing`;
    if (
      cfg.endTerm === cfg.startTerm &&
      Number(cfg.endAcademicYear) === Number(cfg.startAcademicYear)
    ) return `${start} only`;
    return `${start} → ${termLabel(cfg.endTerm)} ${cfg.endAcademicYear}`;
  };

  // ── Resolved period label for the sidebar hint ────────────────────────────
  const resolvedLabel = (() => {
    if (form.duration === 'TERM')
      return `Applies to ${termLabel(form.startTerm)} ${form.startAcademicYear} only`;
    if (form.duration === 'YEAR')
      return `Covers TERM 1–3 of ${form.startAcademicYear}`;
    if (form.duration === 'ONGOING')
      return `From ${termLabel(form.startTerm)}, ${form.startAcademicYear} — no expiry`;
    return `${termLabel(form.startTerm)} ${form.startAcademicYear} → ${termLabel(form.customEndTerm)} ${form.customEndAcademicYear}`;
  })();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section className="mx-auto max-w-6xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">

        {/* ── Left panel ───────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CreditCard size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-950">Student Fee Setup</h3>
              <p className="text-xs text-slate-500">Configure scholarship type, duration, and fee amounts.</p>
            </div>
          </div>

          {canEdit && (
            <div className="space-y-5 p-4">

              {/* ── 1. Scholarship type ───────────────────────────────────── */}
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Scholarship / discount type
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SCHOLARSHIP_OPTIONS.map((opt) => {
                    const Icon   = opt.icon;
                    const active = form.scholarshipType === opt.value;
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setScholarshipType(opt.value)}
                        className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all ${active ? opt.activeClasses : opt.idleClasses}`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-white/20' : 'bg-slate-100'}`}>
                          <Icon size={14} className={active ? 'text-white' : 'text-slate-500'} />
                        </span>
                        <span className={`text-xs font-black leading-tight ${active ? 'text-white' : 'text-slate-800'}`}>{opt.label}</span>
                        <span className={`text-[10px] leading-tight ${active ? 'text-white/75' : 'text-slate-400'}`}>{opt.sublabel}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Partial amount input */}
                {form.scholarshipType === 'PARTIAL_AMOUNT' && (
                  <div className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase text-amber-700">
                        Amount student must pay (KES)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-amber-700">KES</span>
                        <input type="number" min="0" step="1" placeholder="e.g. 5000"
                          value={form.scholarshipAmount}
                          onChange={(e) => setForm((p) => ({ ...p, scholarshipAmount: e.target.value }))}
                          className="h-10 flex-1 rounded-lg border border-amber-300 bg-white px-3 text-right text-lg font-black text-amber-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-300"
                        />
                      </div>
                      {Number(form.scholarshipAmount) > 0
                        ? <p className="mt-1 text-[10px] text-amber-600">Student billed exactly {formatMoney(form.scholarshipAmount)} — remainder discounted.</p>
                        : <p className="mt-1 text-[10px] text-red-500">Enter the amount the student must pay to continue.</p>
                      }
                    </label>
                  </div>
                )}

                {/* Info banners */}
                {form.scholarshipType === 'FULL' && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                    <Award size={14} className="shrink-0 text-red-600" />
                    <p className="text-xs font-semibold text-red-700">
                      Full scholarship — this student will not be billed anything. Invoice total = KES 0.
                    </p>
                  </div>
                )}
                {form.scholarshipType === 'HALF' && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
                    <GraduationCap size={14} className="shrink-0 text-violet-600" />
                    <p className="text-xs font-semibold text-violet-700">
                      Half scholarship — every fee item will be halved (50% discount applied automatically).
                    </p>
                  </div>
                )}
              </div>

              {/* ── 2. Duration ───────────────────────────────────────────── */}
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Scholarship duration
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DURATION_PRESETS.map((preset) => {
                    const Icon   = preset.icon;
                    const active = form.duration === preset.value;
                    return (
                      <button key={preset.value} type="button"
                        onClick={() => setForm((p) => ({ ...p, duration: preset.value }))}
                        className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all ${
                          active
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                        }`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-white/20' : 'bg-slate-100'}`}>
                          <Icon size={14} className={active ? 'text-white' : 'text-slate-500'} />
                        </span>
                        <span className={`text-xs font-black leading-tight ${active ? 'text-white' : 'text-slate-800'}`}>{preset.label}</span>
                        <span className={`text-[10px] leading-tight ${active ? 'text-white/75' : 'text-slate-400'}`}>{preset.sublabel}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom range selects */}
                {form.duration === 'CUSTOM' && (
                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase text-indigo-700">End term</span>
                      <select value={form.customEndTerm}
                        onChange={(e) => setForm((p) => ({ ...p, customEndTerm: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-indigo-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400">
                        {TERMS.map((t) => <option key={t} value={t}>{termLabel(t)}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase text-indigo-700">End year</span>
                      <input type="number" min="2020" max="2040"
                        value={form.customEndAcademicYear}
                        onChange={(e) => setForm((p) => ({ ...p, customEndAcademicYear: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-indigo-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400"
                      />
                    </label>
                  </div>
                )}

                {/* Resolved period preview */}
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5">
                  <Calendar size={12} className="shrink-0 text-indigo-400" />
                  <span className="text-[11px] font-semibold text-slate-500">{resolvedLabel}</span>
                </div>
              </div>

              {/* ── 3. Reason / Notes ─────────────────────────────────────── */}
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Reason / category">
                  <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="e.g. Scholarship, Staff, Sibling discount" />
                </Field>
                <Field label="Internal notes">
                  <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Add notes for this fee setup" />
                </Field>
              </div>

              {/* ── 4. Fee items accordion ────────────────────────────────── */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-950">Fee Items</h4>
                    <p className="text-xs text-slate-500">
                      {scholarshipLock
                        ? 'Individual amounts are managed by the scholarship — no manual entry needed.'
                        : 'Configure all applicable fee items for this student.'}
                    </p>
                  </div>
                  {!scholarshipLock && (
                    <p className="text-xs font-semibold text-slate-400">Open one group at a time</p>
                  )}
                </div>

                {matchingStructure ? (
                  <div className={`space-y-2 ${scholarshipLock ? 'pointer-events-none opacity-40 grayscale select-none' : ''}`}>
                    {Object.entries(groupedRows).map(([group, rows]) => {
                      const groupOpen  = openGroup === group;
                      const groupTotal = rows.reduce((s, row) => {
                        const adj = adjustmentFor(row);
                        return s + (adj.included ? Number(adj.value || 0) : 0);
                      }, 0);
                      const meta      = GROUP_META[group] || GROUP_META['Other fee items'];
                      const tone      = TONE_CLASSES[meta.tone];
                      const GroupIcon = meta.icon;
                      return (
                        <div key={group} className={`overflow-hidden rounded-xl border ${tone.shell}`}>
                          <button type="button"
                            onClick={() => !scholarshipLock && setOpenGroup(groupOpen ? null : group)}
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
                          {groupOpen && !scholarshipLock && (
                            <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-white/80 bg-white">
                              {rows.map((row) => {
                                const adj     = adjustmentFor(row);
                                const checked = row.required || !!adj.included;
                                return (
                                  <div key={row.id} className="grid items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 md:grid-cols-[minmax(220px,1fr)_100px_160px_110px]">
                                    <label className="flex min-w-0 items-center gap-3">
                                      <input type="checkbox" checked={checked} disabled={row.required}
                                        onChange={(e) => updateAdjustment(row, { included: e.target.checked })} />
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
                                      <input className="h-8 w-full rounded-md border border-slate-200 px-2 text-right text-sm font-black text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                                        type="number" min="0" disabled={!checked}
                                        value={adj.value ?? ''}
                                        onChange={(e) => updateAdjustment(row, { value: e.target.value, included: true })} />
                                    </div>
                                    <div className="text-right text-xs font-black text-slate-600">
                                      {checked ? formatMoney(adj.value || 0) : 'Off'}
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
                    No fee structure exists for {learner.grade}, {termLabel(form.startTerm)} {form.startAcademicYear}.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ────────────────────────────────────────────────── */}
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
                  <span className={`text-xs font-black ${scholarshipLock ? 'text-slate-300' : 'text-slate-950'}`}>
                    {scholarshipLock ? '—' : formatMoney(summaryTotals[group] || 0)}
                  </span>
                </div>
              ))}
              <div className="border-t border-dashed border-slate-200 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase text-indigo-700">Discounts / Adjustments</span>
                  <span className="text-xs font-black text-indigo-700">
                    {preview ? formatMoney(preview.adjustmentAmount) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Editable total (NONE / PARTIAL_AMOUNT modes) */}
            {!scholarshipLock && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-700">Editable total</p>
                    <input className="mt-1 w-full bg-transparent text-2xl font-black text-emerald-700 outline-none"
                      type="number" min="0" value={selectedTotal}
                      onChange={(e) => updateMainTotal(e.target.value)} />
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Pencil size={16} />
                  </span>
                </div>
              </div>
            )}

            {form.scholarshipType === 'FULL' && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                <Award size={24} className="mx-auto text-red-500" />
                <p className="mt-1 text-xl font-black text-red-600">KES 0</p>
                <p className="text-[10px] font-semibold text-red-400">Full scholarship — no balance due</p>
              </div>
            )}
            {form.scholarshipType === 'HALF' && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-center">
                <GraduationCap size={24} className="mx-auto text-violet-500" />
                <p className="mt-1 text-sm font-black text-violet-700">50% of grade fee</p>
                <p className="text-[10px] font-semibold text-violet-400">Exact amount calculated at invoice time</p>
              </div>
            )}

            {/* Duration hint */}
            <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2">
              <Calendar size={12} className="shrink-0 text-indigo-500" />
              <span className="text-[11px] font-semibold text-indigo-700">{resolvedLabel}</span>
            </div>

            {/* Status grid */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total items</p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {scholarshipLock ? '—' : selectedItems.length}
                </p>
                <p className="text-[10px] text-slate-500">Active items</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                <ShieldCheck size={22} className="mx-auto mt-2 text-emerald-600" />
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${badge.classes}`}>
                  {badge.label}
                </span>
              </div>
            </div>

            <button disabled={!matchingStructure} onClick={runPreview}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 px-3 py-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">
              <Eye size={14} /> Preview Statement
            </button>
            <button disabled={!canSave} onClick={save}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving…' : 'Save Fee Setup'}
            </button>
            {editingId && (
              <button onClick={resetForm}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                Cancel editing
              </button>
            )}
          </div>

          {/* Preview breakdown */}
          {preview && (
            <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-sm">
              <p className="mb-3 text-xs font-black uppercase text-slate-400">Preview</p>
              <div className="space-y-2 text-sm">
                <SummaryLine label="Grade fee (gross)"         value={formatMoney(preview.grossAmount)} />
                <SummaryLine label="Scholarship / adjustments" value={`– ${formatMoney(preview.adjustmentAmount)}`} />
                <SummaryLine label="Student pays"              value={formatMoney(preview.studentAmount)} />
                <SummaryLine label="Invoice total"             value={formatMoney(preview.totalAmount)} strong />
              </div>
              {preview.calculationSnapshot?.scholarshipType &&
               preview.calculationSnapshot.scholarshipType !== 'NONE' && (
                <p className="mt-3 rounded-lg bg-white/10 px-2 py-1.5 text-[10px] font-semibold text-slate-300">
                  Applied: {preview.calculationSnapshot.scholarshipType.replace('_', ' ')} scholarship
                </p>
              )}
            </div>
          )}

          {/* ── Saved configurations list ──────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {configurations.length === 0 && (
              <p className="px-1 py-2 text-sm text-slate-500">No individual fee setups recorded.</p>
            )}
            <div className="space-y-2">
              {configurations.map((cfg) => {
                const cfgBadge    = SCHOLARSHIP_BADGE[cfg.scholarshipType || 'NONE'] || SCHOLARSHIP_BADGE.NONE;
                const isDeletable = ['DRAFT', 'PENDING_APPROVAL'].includes(cfg.status);
                const isRevokable = cfg.status === 'APPROVED';
                return (
                  <div key={cfg.id} className={`rounded-xl border p-3 ${
                    cfg.status === 'APPROVED'  ? 'border-emerald-200 bg-emerald-50/30'
                    : cfg.status === 'REVOKED' ? 'border-slate-200 bg-slate-50/50 opacity-60'
                    : 'border-amber-200 bg-amber-50/30'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-black text-slate-900">{cfg.name}</p>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${cfgBadge.classes}`}>
                            {cfgBadge.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">{durationText(cfg)}</p>
                        {cfg.scholarshipType === 'PARTIAL_AMOUNT' && cfg.scholarshipAmount != null && (
                          <p className="text-[11px] font-semibold text-amber-600">
                            Pays {formatMoney(cfg.scholarshipAmount)}
                          </p>
                        )}
                        {cfg.reason && (
                          <p className="mt-0.5 truncate text-[10px] italic text-slate-400">{cfg.reason}</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${
                        cfg.status === 'APPROVED'  ? 'bg-emerald-100 text-emerald-700'
                        : cfg.status === 'REVOKED' ? 'bg-slate-100 text-slate-500'
                        : 'bg-amber-100 text-amber-700'
                      }`}>
                        {cfg.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-1">
                      {cfg.status !== 'REVOKED' && canEdit && (
                        <button title="Edit" onClick={() => edit(cfg)}
                          className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50">
                          <Edit3 size={14} />
                        </button>
                      )}
                      {!['APPROVED', 'REVOKED'].includes(cfg.status) && canApprove && (
                        <button title="Approve" onClick={() => approve(cfg.id)}
                          className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50">
                          <ShieldCheck size={15} />
                        </button>
                      )}
                      {isRevokable && canApprove && (
                        <button title="Revoke scholarship" onClick={() => revoke(cfg.id, cfg.name)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-black text-orange-600 hover:bg-orange-50">
                          <XCircle size={13} /> Revoke
                        </button>
                      )}
                      {isDeletable && canEdit && (
                        <button title="Delete this pending request" onClick={() => destroy(cfg.id, cfg.name)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-black text-red-600 hover:bg-red-50">
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                      {cfg.status === 'APPROVED' && <CheckCircle size={15} className="text-emerald-600" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
