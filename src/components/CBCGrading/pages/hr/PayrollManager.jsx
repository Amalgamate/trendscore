import React, { useState, useEffect, useCallback } from 'react';
import {
    CreditCard, Download, Search, X, Printer, CheckCircle2,
    AlertCircle, Calendar, TrendingUp, DollarSign, Eye,
    CheckCheck, Banknote, RefreshCw, ChevronRight,
    Layers, Info, Ban
} from 'lucide-react';
import { hrAPI, communicationAPI } from '../../../../services/api';
import { printWindow, captureSingleReport } from '../../../../utils/simplePdfGenerator';
import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 });
const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];

const statusMeta = {
    DRAFT:      { label: 'Draft',     bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
    GENERATED:  { label: 'Confirmed', bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'  },
    PAID:       { label: 'Paid',      bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200'},
    VOID:       { label: 'Void',      bg: 'bg-red-50',     text: 'text-red-600',    border: 'border-red-200'   },
};

// ─── Off-screen payslip print template ───────────────────────────────────────
const PayslipPrintArea = ({ records, month, year }) => (
    <div id="payslip-bulk-content" style={{ position:'absolute', left:'-9999px', top:0 }}>
        {records.map(record => {
            const ded = record.deductions || {};
            const alw = record.allowances || {};
            const grossSalary = Number(record.grossSalary || record.basicSalary);
            const netPay = Number(record.netSalary);
            const totalDed = Number(ded.totalDeductions || (grossSalary - netPay));
            return (
                <div key={record.id} className="pdf-report-page bg-white"
                    style={{ width:'794px', minHeight:'1123px', padding:'60px', fontFamily:'sans-serif', boxSizing:'border-box' }}>
                    {/* Header */}
                    <div style={{ borderBottom:'3px solid #1e3a8a', paddingBottom:'20px', marginBottom:'30px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div>
                            <h1 style={{ fontSize:'28px', fontWeight:'900', color:'#1e3a8a', margin:0 }}>PAYSLIP</h1>
                            <p style={{ fontSize:'13px', color:'#64748b', marginTop:'4px' }}>{MONTHS[month-1]} {year}</p>
                        </div>
                        <div style={{ textAlign:'right' }}>
                            <p style={{ fontSize:'12px', color:'#64748b', margin:0 }}>Reference</p>
                            <p style={{ fontSize:'13px', fontWeight:'700', color:'#1e293b' }}>
                                PAY-{year}-{String(month).padStart(2,'0')}-{record.id.slice(-6).toUpperCase()}
                            </p>
                            <p style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>
                                Status: <strong>{statusMeta[record.status]?.label || record.status}</strong>
                            </p>
                        </div>
                    </div>

                    {/* Employee */}
                    <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'20px', marginBottom:'30px' }}>
                        <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#1e293b', margin:'0 0 8px 0' }}>
                            {record.user.firstName} {record.user.lastName}
                        </h2>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
                            {[
                                ['Role', (record.user.role||'').replace(/_/g,' ')],
                                ['Staff ID', record.user.staffId || 'N/A'],
                                ['Bank', record.user.bankName ? `${record.user.bankName} — ${record.user.bankAccountNumber||''}` : 'N/A'],
                                ['KRA PIN', record.user.kraPin || 'N/A'],
                                ['NSSF No.', record.user.nssfNumber || 'N/A'],
                                ['SHIF No.', record.user.shifNumber || 'N/A'],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <p style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'700', textTransform:'uppercase', margin:'0 0 2px 0' }}>{label}</p>
                                    <p style={{ fontSize:'12px', fontWeight:'600', color:'#334155', margin:0 }}>{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Earnings & Deductions */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px', marginBottom:'30px' }}>
                        {/* Earnings */}
                        <div>
                            <h3 style={{ fontSize:'11px', fontWeight:'800', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'12px' }}>Earnings</h3>
                            {[{ label:'Basic Salary', value: Number(record.basicSalary) }]
                                .concat((alw.items||[]).map(a => ({ label: a.label, value: Number(a.amount) })))
                                .map(item => (
                                    <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f1f5f9' }}>
                                        <span style={{ fontSize:'13px', color:'#475569' }}>{item.label}</span>
                                        <span style={{ fontSize:'13px', fontWeight:'600', color:'#1e293b' }}>KES {fmt(item.value)}</span>
                                    </div>
                                ))}
                            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderTop:'2px solid #1e3a8a', marginTop:'4px' }}>
                                <span style={{ fontSize:'13px', fontWeight:'800', color:'#1e293b' }}>Gross Pay</span>
                                <span style={{ fontSize:'14px', fontWeight:'800', color:'#16a34a' }}>KES {fmt(grossSalary)}</span>
                            </div>
                        </div>
                        {/* Deductions */}
                        <div>
                            <h3 style={{ fontSize:'11px', fontWeight:'800', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'12px' }}>Deductions</h3>
                            {[
                                { label:'PAYE (Income Tax)', value: ded.paye||0 },
                                { label:'NSSF',              value: ded.nssf||0 },
                                { label:'SHIF',              value: ded.shif||0 },
                                { label:'Housing Levy',      value: ded.housingLevy||0 },
                            ].concat((ded.customItems||[]).map(c => ({ label: c.label, value: Number(c.amount) })))
                            .map(item => (
                                <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f1f5f9' }}>
                                    <span style={{ fontSize:'13px', color:'#475569' }}>{item.label}</span>
                                    <span style={{ fontSize:'13px', fontWeight:'600', color:'#dc2626' }}>KES {fmt(item.value)}</span>
                                </div>
                            ))}
                            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderTop:'2px solid #dc2626', marginTop:'4px' }}>
                                <span style={{ fontSize:'13px', fontWeight:'800', color:'#1e293b' }}>Total Deductions</span>
                                <span style={{ fontSize:'14px', fontWeight:'800', color:'#dc2626' }}>KES {fmt(totalDed)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Net Pay */}
                    <div style={{ background:'#1e3a8a', borderRadius:'12px', padding:'24px 30px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px' }}>
                        <span style={{ fontSize:'16px', fontWeight:'700', color:'rgba(255,255,255,0.85)' }}>Net Pay (Take Home)</span>
                        <span style={{ fontSize:'28px', fontWeight:'900', color:'#ffffff' }}>KES {fmt(netPay)}</span>
                    </div>

                    {/* Worked days summary */}
                    {(record.workedDays > 0 || record.workedMinutes > 0) && (
                        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', padding:'12px 20px', marginBottom:'24px', display:'flex', gap:'32px' }}>
                            <div><p style={{ fontSize:'10px', color:'#16a34a', fontWeight:'700', textTransform:'uppercase', margin:0 }}>Days Worked</p><p style={{ fontSize:'16px', fontWeight:'800', color:'#15803d', margin:'2px 0 0' }}>{record.workedDays}</p></div>
                            <div><p style={{ fontSize:'10px', color:'#16a34a', fontWeight:'700', textTransform:'uppercase', margin:0 }}>Hours Worked</p><p style={{ fontSize:'16px', fontWeight:'800', color:'#15803d', margin:'2px 0 0' }}>{Math.floor((record.workedMinutes||0)/60)}h {(record.workedMinutes||0)%60}m</p></div>
                            {record.paymentReference && <div><p style={{ fontSize:'10px', color:'#16a34a', fontWeight:'700', textTransform:'uppercase', margin:0 }}>Payment Ref</p><p style={{ fontSize:'14px', fontWeight:'700', color:'#15803d', margin:'2px 0 0' }}>{record.paymentReference}</p></div>}
                        </div>
                    )}

                    {/* Footer signatures */}
                    <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:'20px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px' }}>
                        {['Employee Signature', 'Prepared By', 'Authorised By'].map(label => (
                            <div key={label} style={{ textAlign:'center' }}>
                                <div style={{ borderBottom:'1px solid #cbd5e1', height:'32px', marginBottom:'4px' }}/>
                                <p style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'700', textTransform:'uppercase' }}>{label}</p>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize:'9px', color:'#cbd5e1', textAlign:'center', marginTop:'20px', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                        Confidential — Generated by {PRODUCT_DISPLAY_NAME} · {new Date().toLocaleDateString()}
                    </p>
                </div>
            );
        })}
    </div>
);

// ─── Payslip Detail Modal ─────────────────────────────────────────────────────
const PayslipModal = ({ record, onClose, onConfirm, onMarkPaid, confirming, paying }) => {
    const [payRef, setPayRef] = useState('');
    const [showPayInput, setShowPayInput] = useState(false);
    if (!record) return null;

    const ded = record.deductions || {};
    const alw = record.allowances || {};
    const grossSalary = Number(record.grossSalary || record.basicSalary);
    const netPay = Number(record.netSalary);
    const totalDed = Number(ded.totalDeductions || (grossSalary - netPay));
    const sm = statusMeta[record.status] || statusMeta.DRAFT;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
                    <div>
                        <h2 className="text-lg font-medium text-gray-900">{record.user.firstName} {record.user.lastName}</h2>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-0.5">{(record.user.role||'').replace(/_/g,' ')} · {record.user.staffId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-medium uppercase border ${sm.bg} ${sm.text} ${sm.border}`}>{sm.label}</span>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={18}/></button>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {/* Earnings breakdown */}
                    <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Earnings</p>
                        <div className="space-y-1">
                            <div className="flex justify-between py-1.5 border-b border-gray-50">
                                <span className="text-sm text-gray-600">Basic Salary</span>
                                <span className="text-sm font-medium text-gray-900">KES {fmt(record.basicSalary)}</span>
                            </div>
                            {(alw.items||[]).map(a => (
                                <div key={a.id} className="flex justify-between py-1.5 border-b border-gray-50">
                                    <span className="text-sm text-gray-600">{a.label}</span>
                                    <span className="text-sm font-semibold text-gray-700">KES {fmt(a.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 bg-green-50 px-3 rounded-lg mt-2">
                                <span className="text-sm font-medium text-gray-800">Gross Pay</span>
                                <span className="text-sm font-medium text-green-700">KES {fmt(grossSalary)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Deductions breakdown */}
                    <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Statutory Deductions</p>
                        <div className="space-y-1">
                            {[['PAYE (Income Tax)', ded.paye], ['NSSF', ded.nssf], ['SHIF', ded.shif], ['Housing Levy', ded.housingLevy]]
                                .filter(([, v]) => Number(v) > 0)
                                .map(([label, value]) => (
                                    <div key={label} className="flex justify-between py-1.5 border-b border-gray-50">
                                        <span className="text-sm text-gray-600">{label}</span>
                                        <span className="text-sm font-semibold text-red-600">KES {fmt(value)}</span>
                                    </div>
                                ))}
                        </div>

                        {(ded.customItems||[]).length > 0 && (
                            <>
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2 mt-3">Other Deductions</p>
                                <div className="space-y-1">
                                    {(ded.customItems||[]).map(c => (
                                        <div key={c.id} className="flex justify-between py-1.5 border-b border-gray-50">
                                            <span className="text-sm text-gray-600">{c.label}</span>
                                            <span className="text-sm font-semibold text-red-600">KES {fmt(c.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="flex justify-between py-2 bg-red-50 px-3 rounded-lg mt-2">
                            <span className="text-sm font-medium text-gray-800">Total Deductions</span>
                            <span className="text-sm font-medium text-red-600">KES {fmt(totalDed)}</span>
                        </div>
                    </div>

                    {/* Net Pay */}
                    <div className="bg-brand-purple text-white rounded-2xl p-4 flex justify-between items-center">
                        <span className="font-medium text-sm">Net Pay (Take Home)</span>
                        <span className="text-xl font-semibold">KES {fmt(netPay)}</span>
                    </div>

                    {/* Worked info */}
                    {record.workedDays > 0 && (
                        <div className="flex gap-4 text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                            <span><strong className="text-gray-800">{record.workedDays}</strong> days worked</span>
                            <span><strong className="text-gray-800">{Math.floor((record.workedMinutes||0)/60)}h {(record.workedMinutes||0)%60}m</strong> clocked</span>
                        </div>
                    )}

                    {/* Payment reference if paid */}
                    {record.status === 'PAID' && record.paymentReference && (
                        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">
                            <CheckCircle2 size={16}/>
                            <span>Paid · Ref: <strong>{record.paymentReference}</strong></span>
                        </div>
                    )}

                    {/* Action buttons */}
                    {record.status === 'DRAFT' && (
                        <button onClick={() => onConfirm(record.id)} disabled={confirming}
                            className="w-full py-3 bg-blue-600 text-white rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
                            {confirming ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"/> : <CheckCircle2 size={18}/>}
                            Confirm & Post to Ledger
                        </button>
                    )}

                    {record.status === 'GENERATED' && !showPayInput && (
                        <button onClick={() => setShowPayInput(true)}
                            className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all">
                            <Banknote size={18}/>
                            Mark as Paid
                        </button>
                    )}

                    {record.status === 'GENERATED' && showPayInput && (
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Payment reference (e.g. M-Pesa code, EFT ref)…"
                                value={payRef}
                                onChange={e => setPayRef(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none"
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setShowPayInput(false)} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl font-medium text-sm hover:bg-gray-50 transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => onMarkPaid(record.id, payRef)} disabled={paying}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50">
                                    {paying ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"/> : <CheckCircle2 size={16}/>}
                                    Confirm Payment
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Void Modal ─────────────────────────────────────────────────────────────
const VoidModal = ({ record, onClose, onConfirm, loading }) => {
    const [reason, setReason] = useState('');
    if (!record) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Void Payroll Record</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={18}/></button>
                </div>
                <p className="text-sm text-gray-500">
                    Voiding the record for <strong>{record.user?.firstName} {record.user?.lastName}</strong>.
                    This cannot be undone.
                </p>
                <textarea
                    placeholder="Reason for voiding (min 5 chars)…"
                    value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/30 outline-none resize-none"
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl font-medium text-sm hover:bg-gray-50 transition-all">Cancel</button>
                    <button onClick={() => onConfirm(record.id, reason)} disabled={loading || reason.trim().length < 5}
                        className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50">
                        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"/> : <Ban size={15}/>}
                        Void Record
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Bulk Pay Modal ───────────────────────────────────────────────────────────
const BulkPayModal = ({ month, year, count, onClose, onConfirm, loading }) => {
    const [ref, setRef] = useState('');
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Mark All as Paid</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={18}/></button>
                </div>
                <p className="text-sm text-gray-500">
                    This will mark <strong>{count} confirmed</strong> payroll records for{' '}
                    <strong>{MONTHS[month-1]} {year}</strong> as PAID.
                </p>
                <input
                    type="text"
                    placeholder="Batch payment reference (optional)…"
                    value={ref}
                    onChange={e => setRef(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none"
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl font-medium text-sm hover:bg-gray-50 transition-all">
                        Cancel
                    </button>
                    <button onClick={() => onConfirm(ref)} disabled={loading}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50">
                        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"/> : <Banknote size={16}/>}
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Bulk Disburse Modal (M-Pesa) ───────────────────────────────────────────
const BulkDisburseModal = ({ month, year, records, onClose, onConfirm, loading }) => {
    const totalNet = records.reduce((acc, r) => acc + Number(r.netSalary), 0);
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                            <CreditCard size={24}/>
                        </div>
                        <h2 className="text-xl font-medium text-gray-900">M-Pesa Payout</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={18}/></button>
                </div>
                
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-sm text-amber-800 leading-relaxed font-medium">
                        You are about to disburse salaries for <strong>{records.length} staff members</strong> via M-Pesa.
                    </p>
                </div>

                <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                    <span className="text-gray-500 text-sm font-medium">Total Disbursement</span>
                    <span className="text-2xl font-semibold text-gray-900">KES {fmt(totalNet)}</span>
                </div>

                <div className="space-y-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold text-center">Security Verification Required</p>
                    <button onClick={onConfirm} disabled={loading}
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-semibold text-base flex items-center justify-center gap-3 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 disabled:active:scale-100">
                        {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/50 border-t-white"/> : <CheckCheck size={20}/>}
                        Authorize Disburse
                    </button>
                    <button onClick={onClose} className="w-full py-3 text-gray-400 font-medium text-sm hover:text-gray-600 transition-all">
                        Cancel & Review
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main PayrollManager ──────────────────────────────────────────────────────
const PayrollManager = () => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [paying, setPaying] = useState(false);
    const [bulkConfirming, setBulkConfirming] = useState(false);
    const [showBulkPay, setShowBulkPay] = useState(false);
    const [bulkPaying, setBulkPaying] = useState(false);
    const [voidRecord, setVoidRecord] = useState(null);
    const [voiding, setVoiding] = useState(false);
    const [isKopoKopo, setIsKopoKopo] = useState(false);
    const [showBulkDisburse, setShowBulkDisburse] = useState(false);
    const [disbursing, setDisbursing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState(null);

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchPayroll = useCallback(async () => {
        try {
            setLoading(true);
            const res = await hrAPI.getPayrollRecords({ month, year });
            setRecords(res.data || []);
        } catch (error) {
            console.error('Error fetching payroll:', error);
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => { 
        fetchPayroll(); 
        checkGateway();
    }, [fetchPayroll]);

    const checkGateway = async () => {
        try {
            const config = await communicationAPI.getConfig();
            const provider = config?.data?.mpesa?.provider || config?.mpesa?.provider;
            setIsKopoKopo(provider === 'kopokopo');
        } catch (err) {
            console.error('Failed to check gateway:', err);
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            const res = await hrAPI.generatePayroll({ month, year });
            if (res.success) {
                showToast(`Generated ${res.data?.count || 0} payroll records`);
                fetchPayroll();
            }
        } catch (error) {
            showToast('Error generating payroll: ' + error.message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleBulkConfirm = async () => {
        try {
            setBulkConfirming(true);
            const res = await hrAPI.bulkConfirmPayroll(month, year);
            showToast(`Confirmed ${res.data?.confirmed} of ${res.data?.total} records`);
            fetchPayroll();
        } catch (error) {
            showToast('Bulk confirm failed: ' + error.message, 'error');
        } finally {
            setBulkConfirming(false);
        }
    };

    const handleConfirmSingle = async (id) => {
        try {
            setConfirming(true);
            await hrAPI.confirmPayroll(id);
            showToast('Record confirmed and posted to ledger');
            fetchPayroll();
            setSelectedRecord(null);
        } catch (error) {
            showToast('Error confirming: ' + error.message, 'error');
        } finally {
            setConfirming(false);
        }
    };

    const handleMarkPaid = async (id, ref) => {
        try {
            setPaying(true);
            await hrAPI.markPayrollPaid(id, ref);
            showToast('Marked as paid');
            fetchPayroll();
            setSelectedRecord(null);
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        } finally {
            setPaying(false);
        }
    };

    const handleBulkPay = async (ref) => {
        try {
            setBulkPaying(true);
            const res = await hrAPI.bulkMarkPaid(month, year, ref);
            showToast(`${res.data?.paid} records marked as paid`);
            fetchPayroll();
            setShowBulkPay(false);
        } catch (error) {
            showToast('Bulk pay failed: ' + error.message, 'error');
        } finally {
            setBulkPaying(false);
        }
    };

    const handleVoid = async (id, reason) => {
        try {
            setVoiding(true);
            await hrAPI.voidPayroll(id, reason);
            showToast('Record voided');
            fetchPayroll();
            setVoidRecord(null);
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            setVoiding(false);
        }
    };

    const handleBulkDisburse = async () => {
        const confirmedRecords = records.filter(r => r.status === 'GENERATED');
        if (confirmedRecords.length === 0) return;

        try {
            setDisbursing(true);
            const ids = confirmedRecords.map(r => r.id);
            const res = await hrAPI.bulkDisburseMpesa(ids);
            
            const successCount = res.results?.filter(r => r.success).length || 0;
            const failCount = (res.results?.length || 0) - successCount;
            
            showToast(`Batch processed: ${successCount} successful, ${failCount} failed.`);
            fetchPayroll();
            setShowBulkDisburse(false);
        } catch (error) {
            showToast('Disbursement failed: ' + error.message, 'error');
        } finally {
            setDisbursing(false);
        }
    };

    const handlePrintAll = async () => {
        setPrinting(true);
        await printWindow('payslip-bulk-content');
        setPrinting(false);
    };

    const handleDownloadAll = async () => {
        setPrinting(true);
        await captureSingleReport('payslip-bulk-content', `Payslips_${MONTHS[month-1]}_${year}.pdf`);
        setPrinting(false);
    };

    const filtered = records.filter(r =>
        (r.user.firstName + ' ' + r.user.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.user.staffId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Summary stats
    const draftCount = records.filter(r => r.status === 'DRAFT').length;
    const confirmedCount = records.filter(r => r.status === 'GENERATED').length;
    const paidCount = records.filter(r => r.status === 'PAID').length;
    const totalGross = records.reduce((acc, r) => acc + Number(r.grossSalary || r.basicSalary), 0);
    const totalNet = records.reduce((acc, r) => acc + Number(r.netSalary), 0);
    const totalDed = totalGross - totalNet;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Off-screen print area */}
            {records.length > 0 && <PayslipPrintArea records={records} month={month} year={year}/>}

            {/* Modals */}
            <PayslipModal
                record={selectedRecord}
                onClose={() => setSelectedRecord(null)}
                onConfirm={handleConfirmSingle}
                onMarkPaid={handleMarkPaid}
                confirming={confirming}
                paying={paying}
            />
            {showBulkPay && (
                <BulkPayModal
                    month={month} year={year} count={confirmedCount}
                    onClose={() => setShowBulkPay(false)}
                    onConfirm={handleBulkPay} loading={bulkPaying}
                />
            )}
            <VoidModal record={voidRecord} onClose={() => setVoidRecord(null)} onConfirm={handleVoid} loading={voiding}/>
            {showBulkDisburse && (
                <BulkDisburseModal
                    month={month} year={year} records={records.filter(r => r.status === 'GENERATED')}
                    onClose={() => setShowBulkDisburse(false)}
                    onConfirm={handleBulkDisburse} loading={disbursing}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium transition-all animate-in slide-in-from-top duration-300
                    ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
                    {toast.msg}
                </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-medium text-gray-900">Payroll Center</h1>
                    <p className="text-gray-500 text-sm">Process salaries with statutory deductions and custom allowances.</p>
                </div>
                {/* Month / Year picker */}
                <div className="flex bg-white border border-gray-200 rounded-xl px-4 py-2 gap-4 shadow-sm items-center">
                    <Calendar size={16} className="text-gray-400"/>
                    <select value={month} onChange={e => setMonth(Number(e.target.value))}
                        className="bg-transparent border-none focus:ring-0 font-medium text-gray-700 text-sm">
                        {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))}
                        className="bg-transparent border-none focus:ring-0 font-medium text-gray-700 text-sm">
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label:'Gross Payroll', value:`KES ${fmt(totalGross)}`, icon: TrendingUp,  color:'blue'   },
                    { label:'Total Net Pay',  value:`KES ${fmt(totalNet)}`,   icon: DollarSign, color:'emerald'},
                    { label:'Total Deductions', value:`KES ${fmt(totalDed)}`, icon: CreditCard, color:'red'   },
                    { label:'Draft Records',  value:draftCount,  icon: AlertCircle,  color:'amber'  },
                    { label:'Paid Records',   value:paidCount,   icon: CheckCircle2, color:'green'  },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl bg-${color}-50 text-${color}-600`}><Icon size={20}/></div>
                        <div className="min-w-0">
                            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">{label}</p>
                            <p className="text-base font-medium text-gray-900">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                    <input type="text" placeholder="Search by name or staff ID…"
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal/30"/>
                </div>

                {/* Actions depending on state */}
                <div className="flex items-center gap-2 flex-wrap">
                    {records.length === 0 && (
                        <button onClick={handleGenerate} disabled={generating}
                            className="px-5 py-2.5 bg-brand-teal text-white rounded-xl font-medium text-sm shadow-lg shadow-teal-100 hover:bg-brand-teal/90 transition-all flex items-center gap-2 disabled:opacity-60">
                            {generating ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"/> : <DollarSign size={16}/>}
                            Generate Payroll
                        </button>
                    )}

                    {records.length > 0 && (
                        <>
                            {/* Regen (add missing staff) */}
                            <button onClick={handleGenerate} disabled={generating}
                                className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-60"
                                title="Add payroll for any newly added staff">
                                {generating ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"/> : <RefreshCw size={15}/>}
                                Update
                            </button>

                            {/* Bulk confirm drafts */}
                            {draftCount > 0 && (
                                <button onClick={handleBulkConfirm} disabled={bulkConfirming}
                                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-60">
                                    {bulkConfirming ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"/> : <Layers size={15}/>}
                                    Confirm All ({draftCount})
                                </button>
                            )}

                            {/* Bulk mark paid / Disburse */}
                            {confirmedCount > 0 && (
                                <>
                                    {isKopoKopo ? (
                                        <button onClick={() => setShowBulkDisburse(true)}
                                            className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-50">
                                            <CreditCard size={15}/>
                                            Batch Payout ({confirmedCount})
                                        </button>
                                    ) : (
                                        <button onClick={() => setShowBulkPay(true)}
                                            className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-all flex items-center gap-2">
                                            <CheckCheck size={15}/>
                                            Mark All Paid ({confirmedCount})
                                        </button>
                                    )}
                                </>
                            )}

                            <button onClick={handlePrintAll} disabled={printing}
                                className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-60">
                                <Printer size={15}/>
                                Print
                            </button>
                            <button onClick={handleDownloadAll} disabled={printing}
                                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-60">
                                <Download size={15}/>
                                PDF
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Status pipeline indicator */}
            {records.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                    {[['DRAFT', draftCount, 'amber'], ['GENERATED', confirmedCount, 'blue'], ['PAID', paidCount, 'emerald']].map(([s, count, c], i) => (
                        <React.Fragment key={s}>
                            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium bg-${c}-50 text-${c}-700`}>
                                <span className={`w-1.5 h-1.5 rounded-full bg-${c}-500 inline-block`}/>
                                {s === 'GENERATED' ? 'Confirmed' : s} · {count}
                            </span>
                            {i < 2 && <ChevronRight size={14} className="text-gray-300"/>}
                        </React.Fragment>
                    ))}
                    <span className="ml-auto text-gray-400">{records.length} total staff</span>
                </div>
            )}

            {/* Payroll Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-gray-100">
                            <tr>
                                {['Employee', 'Basic Salary', 'Allowances', 'Gross Pay', 'Deductions', 'Net Pay', 'Days', 'Status', ''].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={9} className="px-5 py-5">
                                            <div className="h-4 bg-gray-100 rounded w-3/4"/>
                                        </td>
                                    </tr>
                                ))
                            ) : filtered.length > 0 ? (
                                filtered.map(record => {
                                    const ded = record.deductions || {};
                                    const alw = record.allowances || {};
                                    const grossSalary = Number(record.grossSalary || record.basicSalary);
                                    const totalDed = Number(ded.totalDeductions || (grossSalary - Number(record.netSalary)));
                                    const sm = statusMeta[record.status] || statusMeta.DRAFT;
                                    return (
                                        <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                                            onClick={() => setSelectedRecord(record)}>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple flex items-center justify-center font-medium text-xs flex-shrink-0">
                                                        {record.user.firstName[0]}{record.user.lastName[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm group-hover:text-brand-teal transition-colors">
                                                            {record.user.firstName} {record.user.lastName}
                                                        </p>
                                                        <p className="text-xs text-gray-400 font-mono">{record.user.staffId}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-600 font-mono">KES {fmt(record.basicSalary)}</td>
                                            <td className="px-5 py-4 text-sm text-blue-600 font-mono">
                                                {Number(alw.total||0) > 0 ? `+KES ${fmt(alw.total)}` : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-medium text-gray-800 font-mono">KES {fmt(grossSalary)}</td>
                                            <td className="px-5 py-4 text-sm text-red-500 font-mono">-KES {fmt(totalDed)}</td>
                                            <td className="px-5 py-4 text-sm font-medium text-emerald-600 font-mono">KES {fmt(record.netSalary)}</td>
                                            <td className="px-5 py-4 text-sm text-gray-500">
                                                {record.workedDays > 0 ? `${record.workedDays}d` : <span className="text-gray-200">—</span>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-medium uppercase border ${sm.bg} ${sm.text} ${sm.border}`}>
                                                    {sm.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={e => { e.stopPropagation(); setSelectedRecord(record); }}
                                                        className="p-1.5 text-gray-300 group-hover:text-brand-teal transition-colors" title="View">
                                                        <Eye size={15}/>
                                                    </button>
                                                    {['DRAFT','GENERATED'].includes(record.status) && (
                                                        <button onClick={e => { e.stopPropagation(); setVoidRecord(record); }}
                                                            className="p-1.5 text-gray-200 hover:text-red-500 transition-colors" title="Void record">
                                                            <Ban size={14}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="p-4 bg-amber-50 text-amber-400 rounded-full"><AlertCircle size={40}/></div>
                                            <div>
                                                <h3 className="text-base font-medium text-gray-800">No Payroll Records</h3>
                                                <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
                                                    {records.length === 0
                                                        ? `No payroll generated for ${MONTHS[month-1]} ${year} yet. Click Generate Payroll above.`
                                                        : 'No records match your search.'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info tip */}
            {records.length > 0 && draftCount > 0 && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-sm text-blue-700">
                    <Info size={16} className="flex-shrink-0 mt-0.5"/>
                    <p><strong>Next step:</strong> Review individual records by clicking any row, then use <em>Confirm All</em> to post to the accounting ledger, or confirm individually per employee.</p>
                </div>
            )}
        </div>
    );
};

export default PayrollManager;
