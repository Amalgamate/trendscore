import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Filter, Edit2, Download, Mail, Phone,
    Shield, Banknote, ArrowLeft, Plus, Trash2,
    CheckCircle2, AlertCircle, X, ChevronDown,
    Building2, CreditCard, User, FileText, Layers,
    DollarSign
} from 'lucide-react';
import { hrAPI } from '../../../../services/api';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = n => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 });

const ALLOWANCE_TYPES = ['HOUSE', 'TRAVEL', 'MEDICAL', 'COMMUTER', 'OTHER'];
const DEDUCTION_TYPES = ['LOAN', 'SACCO', 'ADVANCE', 'UNIFORM', 'OTHER'];

const validatePhone = (phone) => {
    if (!phone) return true; // optional
    const p = String(phone).trim().replace(/\s/g, '');
    return /^(\+?254|0)[17]\d{8}$/.test(p);
};

const StatusBadge = ({ status }) => {
    const colors = { ACTIVE:'bg-green-100 text-green-700', INACTIVE:'bg-gray-100 text-gray-600', SUSPENDED:'bg-red-100 text-red-700' };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase ${colors[status]||'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
};

// ─── HR Profile Editor ────────────────────────────────────────────────────────
const HRProfileEditor = ({ staff, onCancel, onSaved }) => {
    const [form, setForm] = useState({
        staffId: staff.staffId || '',
        kraPin: staff.kraPin || '',
        nssfNumber: staff.nssfNumber || '',
        shifNumber: staff.shifNumber || '',
        nhifNumber: staff.nhifNumber || '',
        bankName: staff.bankName || '',
        bankAccountName: staff.bankAccountName || '',
        bankAccountNumber: staff.bankAccountNumber || '',
        basicSalary: staff.basicSalary ? String(staff.basicSalary) : '',
        employmentType: staff.employmentType || 'PERMANENT',
        housingLevyExempt: staff.housingLevyExempt || false,
        phone: staff.phone || '',
        joinedAt: staff.joinedAt ? new Date(staff.joinedAt).toISOString().split('T')[0] : '',
    });
    const [allowances, setAllowances] = useState(staff.staffAllowances || []);
    const [deductions, setDeductions] = useState(staff.staffDeductions || []);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('statutory');
    const [errors, setErrors] = useState({});
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const set = (key, val) => {
        setForm(f => ({ ...f, [key]: val }));
        setErrors(e => ({ ...e, [key]: undefined }));
    };

    const validate = () => {
        const errs = {};
        if (form.phone && !validatePhone(form.phone)) {
            errs.phone = 'Invalid Kenyan phone number (e.g. 0712345678)';
        }
        if (form.basicSalary && isNaN(Number(form.basicSalary))) {
            errs.basicSalary = 'Must be a number';
        }
        return errs;
    };

    const handleSave = async () => {
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        try {
            setSaving(true);
            await hrAPI.updateStaffHR(staff.id, {
                ...form,
                basicSalary: form.basicSalary ? Number(form.basicSalary) : undefined,
            });
            showToast('HR details saved');
            setTimeout(onSaved, 800);
        } catch (e) {
            showToast('Save failed: ' + e.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Allowance helpers ──────────────────────────────────────────────────────
    const addAllowance = () => setAllowances(a => [...a, { _new: true, type:'HOUSE', label:'House Allowance', amount:0, isActive:true }]);
    const removeAllowance = async (idx, item) => {
        if (!item._new && item.id) {
            try { await hrAPI.deleteAllowance(staff.id, item.id); } catch {}
        }
        setAllowances(a => a.filter((_, i) => i !== idx));
    };
    const saveAllowance = async (idx, item) => {
        try {
            const res = await hrAPI.upsertAllowance(staff.id, item);
            setAllowances(a => a.map((x, i) => i === idx ? { ...res.data, _saved: true } : x));
            showToast('Allowance saved');
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
    };
    const updateAllowance = (idx, key, val) =>
        setAllowances(a => a.map((x, i) => i === idx ? { ...x, [key]: val, _dirty: true } : x));

    // ── Deduction helpers ──────────────────────────────────────────────────────
    const addDeduction = () => setDeductions(d => [...d, { _new: true, type:'LOAN', label:'', amount:0, isRecurring:true, totalMonths:0, isActive:true }]);
    const removeDeduction = async (idx, item) => {
        if (!item._new && item.id) {
            try { await hrAPI.deleteDeduction(staff.id, item.id); } catch {}
        }
        setDeductions(d => d.filter((_, i) => i !== idx));
    };
    const saveDeduction = async (idx, item) => {
        try {
            const res = await hrAPI.upsertDeduction(staff.id, item);
            setDeductions(d => d.map((x, i) => i === idx ? { ...res.data, _saved: true } : x));
            showToast('Deduction saved');
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
    };
    const updateDeduction = (idx, key, val) =>
        setDeductions(d => d.map((x, i) => i === idx ? { ...x, [key]: val, _dirty: true } : x));

    const tabs = [
        { id: 'statutory', label: 'Statutory & Bank', icon: FileText },
        { id: 'salary',    label: 'Salary Setup',     icon: DollarSign  },
        { id: 'allowances', label: 'Allowances',      icon: Layers },
        { id: 'deductions', label: 'Deductions',      icon: CreditCard },
    ];

    const inputClass = (field) =>
        `w-full px-3 py-2 bg-gray-50 border rounded-xl text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-brand-teal/30 ${
            errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-brand-teal'
        }`;

    const LabeledInput = ({ label, field, type='text', placeholder='', hint, children }) => (
        <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
            {children || (
                <input type={type} value={form[field]} onChange={e => set(field, e.target.value)}
                    placeholder={placeholder} className={inputClass(field)}/>
            )}
            {hint && !errors[field] && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
            {errors[field] && <p className="text-xs text-red-500 mt-1">{errors[field]}</p>}
        </div>
    );

    return (
        <div className="animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                    <ArrowLeft size={20}/>
                </button>
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-brand-purple/10 text-brand-purple flex items-center justify-center font-medium text-sm">
                        {staff.firstName[0]}{staff.lastName[0]}
                    </div>
                    <div>
                        <h1 className="text-xl font-medium text-gray-900">{staff.firstName} {staff.lastName}</h1>
                        <p className="text-xs text-gray-500">{(staff.role||'').replace(/_/g,' ')} · {staff.staffId}</p>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="px-5 py-2.5 bg-brand-teal text-white rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-brand-teal/90 transition-all disabled:opacity-60 shadow-lg shadow-teal-100">
                    {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"/> : <CheckCircle2 size={16}/>}
                    Save Changes
                </button>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium animate-in slide-in-from-top duration-300
                    ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {toast.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}
                    {toast.msg}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-xs transition-all ${
                            activeTab === id ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Icon size={14}/> <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                {/* ── Statutory & Bank ── */}
                {activeTab === 'statutory' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> Statutory Numbers</p>
                                <LabeledInput label="Employee Number (Staff ID)" field="staffId" placeholder="e.g. STF-0001" hint="Unique institutional reference"/>
                                <LabeledInput label="KRA PIN" field="kraPin" placeholder="A123456789Z"/>
                                <LabeledInput label="NSSF Number" field="nssfNumber" placeholder="NSSF-XXXXXX"/>
                                <LabeledInput label="SHIF / NHIF Number" field="shifNumber" placeholder="SHIF-XXXXXX"/>
                                <LabeledInput label="Phone Number" field="phone" type="tel" placeholder="0712345678"
                                    hint="Kenyan format: 07XX or 01XX (10 digits)"/>
                            </div>
                            <div className="space-y-4">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest flex items-center gap-2"><Building2 size={12}/> Banking Details</p>
                                <LabeledInput label="Bank Name" field="bankName" placeholder="e.g. Equity Bank"/>
                                <LabeledInput label="Account Name" field="bankAccountName" placeholder="Full name on account"/>
                                <LabeledInput label="Account Number" field="bankAccountNumber" placeholder="Account number"/>
                            </div>
                        </div>

                        {/* Phone validation callout */}
                        {staff.phone && !validatePhone(staff.phone) && (
                            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                                <div>
                                    <p className="text-sm font-medium text-amber-800">Invalid phone on record</p>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        Current value <code className="bg-amber-100 px-1 rounded">{staff.phone}</code> is not a valid Kenyan number.
                                        Please update it above to ensure SMS delivery works correctly.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Salary Setup ── */}
                {activeTab === 'salary' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <LabeledInput label="Basic Salary (KES)" field="basicSalary" type="number" placeholder="0"
                                hint="Gross salary before allowances and deductions"/>
                            <LabeledInput label="Employment Type" field="employmentType">
                                <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)}
                                    className={inputClass('employmentType')}>
                                    {['PERMANENT','CONTRACT','PART_TIME','CASUAL','INTERN'].map(t => (
                                        <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                                    ))}
                                </select>
                            </LabeledInput>
                            <LabeledInput label="Date of Joining" field="joinedAt" type="date"/>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Housing Levy</label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className={`relative w-11 h-6 rounded-full transition-colors ${form.housingLevyExempt ? 'bg-brand-teal' : 'bg-gray-300'}`}
                                        onClick={() => set('housingLevyExempt', !form.housingLevyExempt)}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.housingLevyExempt ? 'translate-x-6' : 'translate-x-1'}`}/>
                                    </div>
                                    <span className="text-sm text-gray-700">Exempt from Affordable Housing Levy</span>
                                </label>
                                <p className="text-xs text-gray-400 mt-1">Tick for staff contractually exempt from the 1.5% levy.</p>
                            </div>
                        </div>

                        {/* Tax preview */}
                        {form.basicSalary && Number(form.basicSalary) > 0 && (
                            <TaxPreview salary={Number(form.basicSalary)} exempt={form.housingLevyExempt}/>
                        )}
                    </div>
                )}

                {/* ── Allowances ── */}
                {activeTab === 'allowances' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">Per-month recurring allowances added on top of basic salary.</p>
                            <button onClick={addAllowance} className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-xl font-medium text-sm hover:bg-brand-teal/90 transition-all">
                                <Plus size={15}/> Add Allowance
                            </button>
                        </div>

                        {allowances.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Layers size={32} className="mx-auto mb-3 opacity-30"/>
                                <p className="text-sm">No allowances configured yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {allowances.map((item, idx) => (
                                    <div key={idx} className={`grid grid-cols-12 gap-3 items-end p-4 rounded-2xl border transition-all ${
                                        item._saved ? 'border-emerald-200 bg-emerald-50/30' : item._dirty ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                                        <div className="col-span-3">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">Type</label>
                                            <select value={item.type} onChange={e => updateAllowance(idx, 'type', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none">
                                                {ALLOWANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-4">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">Label</label>
                                            <input value={item.label} onChange={e => updateAllowance(idx, 'label', e.target.value)}
                                                placeholder="e.g. House Allowance"
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal/30"/>
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">Amount (KES)</label>
                                            <input type="number" value={item.amount} onChange={e => updateAllowance(idx, 'amount', Number(e.target.value))}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal/30"/>
                                        </div>
                                        <div className="col-span-2 flex gap-2 justify-end">
                                            <button onClick={() => saveAllowance(idx, item)}
                                                className="p-2 bg-brand-teal text-white rounded-xl hover:bg-brand-teal/90 transition-all" title="Save">
                                                <CheckCircle2 size={15}/>
                                            </button>
                                            <button onClick={() => removeAllowance(idx, item)}
                                                className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all" title="Remove">
                                                <Trash2 size={15}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {allowances.length > 0 && (
                                    <div className="flex justify-between items-center px-4 py-3 bg-blue-50 rounded-xl text-sm">
                                        <span className="text-blue-700 font-medium">Total monthly allowances</span>
                                        <span className="font-medium text-blue-900">KES {fmt(allowances.reduce((s, a) => s + Number(a.amount||0), 0))}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Deductions ── */}
                {activeTab === 'deductions' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">Custom deductions (loans, SACCO, advances) applied after statutory deductions.</p>
                            <button onClick={addDeduction} className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-xl font-medium text-sm hover:bg-brand-teal/90 transition-all">
                                <Plus size={15}/> Add Deduction
                            </button>
                        </div>

                        {deductions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <CreditCard size={32} className="mx-auto mb-3 opacity-30"/>
                                <p className="text-sm">No custom deductions configured.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {deductions.map((item, idx) => (
                                    <div key={idx} className={`grid grid-cols-12 gap-3 items-end p-4 rounded-2xl border transition-all ${
                                        item._saved ? 'border-emerald-200 bg-emerald-50/30' : item._dirty ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">Type</label>
                                            <select value={item.type} onChange={e => updateDeduction(idx, 'type', e.target.value)}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none">
                                                {DEDUCTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">Label</label>
                                            <input value={item.label} onChange={e => updateDeduction(idx, 'label', e.target.value)}
                                                placeholder="e.g. Equity SACCO"
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none"/>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">Amount</label>
                                            <input type="number" value={item.amount} onChange={e => updateDeduction(idx, 'amount', Number(e.target.value))}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none"/>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">Months</label>
                                            <input type="number" min={0} value={item.totalMonths||0} onChange={e => updateDeduction(idx, 'totalMonths', Number(e.target.value))}
                                                placeholder="0 = ∞"
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none"/>
                                        </div>
                                        <div className="col-span-1 flex items-center justify-center pt-4">
                                            <span className="text-xs text-gray-400 text-center">{item.monthsApplied||0}/{item.totalMonths||'∞'}</span>
                                        </div>
                                        <div className="col-span-2 flex gap-1.5 justify-end">
                                            <button onClick={() => saveDeduction(idx, item)}
                                                className="p-2 bg-brand-teal text-white rounded-xl hover:bg-brand-teal/90 transition-all">
                                                <CheckCircle2 size={14}/>
                                            </button>
                                            <button onClick={() => removeDeduction(idx, item)}
                                                className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Live Tax Preview (salary tab) ────────────────────────────────────────────
const TaxPreview = ({ salary, exempt }) => {
    // Client-side mirror of TaxCalculator for instant preview
    const calculateNSSF = (g) => {
        const t1 = Math.min(g, 7000) * 0.06;
        const t2 = g > 7000 ? (Math.min(g, 36000) - 7000) * 0.06 : 0;
        return +(t1 + t2).toFixed(2);
    };
    const calculatePAYE = (taxable, shif) => {
        const tiers = [[24000,0.10],[32333,0.25],[500000,0.30],[800000,0.325],[Infinity,0.35]];
        let tax = 0, rem = taxable, prev = 0;
        for (const [upper, rate] of tiers) {
            const w = upper - prev;
            const t = Math.min(rem, w);
            tax += t * rate;
            rem -= t;
            prev = upper;
            if (rem <= 0) break;
        }
        return Math.max(0, +(tax - 2400 - shif * 0.15).toFixed(2));
    };
    const nssf = calculateNSSF(salary);
    const shif = +(salary * 0.0275).toFixed(2);
    const levy = exempt ? 0 : +(salary * 0.015).toFixed(2);
    const paye = calculatePAYE(salary - nssf, shif);
    const totalDed = paye + nssf + shif + levy;
    const net = salary - totalDed;

    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-4">2024 Tax Preview (Basic Salary only)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {[['Gross', salary], ['PAYE', -paye], ['NSSF', -nssf], ['SHIF', -shif], ['Housing Levy', -levy], ['Net Pay', net]].map(([label, val]) => (
                    <div key={label} className={`p-3 rounded-xl ${label==='Net Pay' ? 'bg-brand-teal/20 border border-brand-teal/40' : 'bg-white/5'}`}>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                        <p className={`text-lg font-medium mt-0.5 ${label==='Net Pay' ? 'text-brand-teal' : val < 0 ? 'text-red-400' : 'text-white'}`}>
                            {val < 0 ? '-' : ''}KES {fmt(Math.abs(val))}
                        </p>
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-slate-500">* Preview excludes allowances and custom deductions. Final payslip will reflect all components.</p>
        </div>
    );
};

// ─── Main StaffDirectory ──────────────────────────────────────────────────────
const StaffDirectory = () => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [editingStaff, setEditingStaff] = useState(null);

    const fetchStaff = useCallback(async () => {
        try {
            setLoading(true);
            const response = await hrAPI.getStaffDirectory();
            if (response.success) setStaff(response.data);
        } catch (error) {
            console.error('Error fetching staff:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);

    const filtered = staff.filter(member => {
        const matchSearch = (member.firstName + ' ' + member.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.staffId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = roleFilter === 'ALL' || member.role === roleFilter;
        return matchSearch && matchRole;
    });

    const roles = ['ALL', ...new Set(staff.map(s => s.role))];

    const invalidPhones = staff.filter(s => s.phone && !validatePhone(s.phone));

    if (editingStaff) {
        return (
            <HRProfileEditor
                staff={editingStaff}
                onCancel={() => setEditingStaff(null)}
                onSaved={() => { setEditingStaff(null); fetchStaff(); }}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-medium text-gray-900">Staff Directory</h1>
                    <p className="text-gray-500 text-sm">View and manage HR profiles for all employees.</p>
                </div>
            </div>

            {/* Data quality warning */}
            {invalidPhones.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                    <div>
                        <p className="text-sm font-medium text-amber-800">{invalidPhones.length} staff with invalid phone numbers</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            {invalidPhones.map(s => `${s.firstName} ${s.lastName} (${s.phone})`).join(', ')} — click Edit to fix.
                        </p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                    <input type="text" placeholder="Search by name, email or Staff ID…"
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal/30"
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                    <Filter size={14} className="text-gray-400"/>
                    <select className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700"
                        value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                        {roles.map(role => <option key={role} value={role}>{role.replace('_',' ')}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-gray-100">
                            <tr>
                                {['Staff Member','Staff ID','Role','Contact','Status','Basic Salary','Actions'].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-5 py-5">
                                            <div className="h-4 bg-gray-100 rounded w-3/4"/>
                                        </td>
                                    </tr>
                                ))
                            ) : filtered.length > 0 ? (
                                filtered.map(member => {
                                    const phoneInvalid = member.phone && !validatePhone(member.phone);
                                    const missingData = !member.basicSalary || Number(member.basicSalary) === 0 || !member.kraPin || !member.bankAccountNumber;
                                    return (
                                        <tr key={member.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-brand-purple/10 flex items-center justify-center font-medium text-brand-purple text-xs overflow-hidden flex-shrink-0">
                                                        {member.profilePicture
                                                            ? <img src={member.profilePicture} alt="" className="w-full h-full object-cover"/>
                                                            : `${member.firstName[0]}${member.lastName[0]}`}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm group-hover:text-brand-teal transition-colors">
                                                            {member.firstName} {member.lastName}
                                                        </p>
                                                        <p className="text-xs text-gray-400 lowercase">{member.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 font-mono text-sm text-gray-600">{member.staffId || '—'}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Shield size={12} className="text-brand-purple/40"/>
                                                    <span className="text-sm text-gray-600">{(member.role||'').replace('_',' ')}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <a href={`tel:${member.phone}`} className={`p-1.5 rounded-lg transition-all ${phoneInvalid ? 'bg-amber-100 text-amber-500' : 'bg-gray-100 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10'}`} title={phoneInvalid ? `Invalid: ${member.phone}` : member.phone}>
                                                        <Phone size={13}/>
                                                    </a>
                                                    <a href={`mailto:${member.email}`} className="p-1.5 bg-gray-100 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-all">
                                                        <Mail size={13}/>
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4"><StatusBadge status={member.status}/></td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Banknote size={14} className={Number(member.basicSalary) > 0 ? 'text-emerald-500' : 'text-gray-300'}/>
                                                    <span className={`text-sm font-medium ${Number(member.basicSalary) > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                        {Number(member.basicSalary) > 0 ? `KES ${fmt(member.basicSalary)}` : 'Not set'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    {missingData && (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-medium rounded-full border border-amber-200">
                                                            Incomplete
                                                        </span>
                                                    )}
                                                    <button onClick={() => setEditingStaff(member)}
                                                        className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-xl transition-all">
                                                        <Edit2 size={15}/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-gray-400 text-sm">
                                        No staff members found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm text-gray-400 px-1">
                <span>{filtered.length} of {staff.length} staff shown</span>
                <span>{staff.filter(s => Number(s.basicSalary) > 0).length} with salary configured · {invalidPhones.length} invalid phones</span>
            </div>
        </div>
    );
};

export default StaffDirectory;
