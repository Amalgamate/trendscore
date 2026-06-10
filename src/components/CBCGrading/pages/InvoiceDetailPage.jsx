/**
 * Invoice Detail Page — with Activity Timeline & Pledge Recording
 *
 * New sections added:
 *  - "Activity" tab below the main invoice card showing comments, call logs, pledges
 *  - "Add Note" inline form
 *  - "Record Pledge" modal (parent promises to pay on a date)
 *
 * Replace: src/components/CBCGrading/pages/InvoiceDetailPage.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MessageSquare, Phone, User, ShieldCheck, Info, Plus, Loader2,
  FileText, Bookmark, Calendar, X, CheckCircle2, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Send, Gift, Download
} from 'lucide-react';
import usePageNavigation from '../../../hooks/usePageNavigation';
import { generateDocument } from '../../../utils/simplePdfGenerator';
import { useNotifications } from '../hooks/useNotifications';
import DownloadReportButton from '../shared/DownloadReportButton';
import FeeWaiverModal from '../shared/FeeWaiverModal';
import ThermalReceipt from '../shared/ThermalReceipt';
import InvoiceA5 from '../shared/InvoiceA5';
import Toast from '../shared/Toast';
import api from '../../../services/api';
import '../../../styles/receipt-print.css';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';

// ─── helpers ──────────────────────────────────────────────────────────────────

const COMMENT_TYPE_META = {
  NOTE:           { label: 'Note',           icon: FileText,    color: 'text-blue-600',  bg: 'bg-blue-50'  },
  CALL_LOG:       { label: 'Call Log',        icon: Phone,       color: 'text-purple-600',bg: 'bg-purple-50'},
  PLEDGE:         { label: 'Pledge Recorded', icon: Bookmark,   color: 'text-amber-600', bg: 'bg-amber-50' },
  REMINDER_SENT:  { label: 'Reminder Sent',   icon: Send,        color: 'text-teal-600',  bg: 'bg-teal-50'  },
};

const PLEDGE_STATUS_META = {
  PENDING:   { label: 'Pending',   color: 'text-amber-700',  bg: 'bg-amber-100'  },
  DUE:       { label: 'Due Today', color: 'text-orange-700', bg: 'bg-orange-100' },
  FULFILLED: { label: 'Fulfilled', color: 'text-green-700',  bg: 'bg-green-100'  },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-500',   bg: 'bg-gray-100'   },
  BROKEN:    { label: 'Broken',    color: 'text-red-700',    bg: 'bg-red-100'    },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Component ────────────────────────────────────────────────────────────────

const InvoiceDetailPage = ({ invoice }) => {
  const navigateTo = usePageNavigation();
  const { showSuccess, showError, showToast, toastMessage, toastType, hideNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printingInvoice, setPrintingInvoice] = useState(null);
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState({ status: 'fetching', qrCode: null });

  // Activity section state
  const [comments, setComments] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [payments, setPayments] = useState(invoice?.payments || []);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(true);

  // Add note inline
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('NOTE');
  const [savingNote, setSavingNote] = useState(false);

  // Pledge modal
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [pledgeForm, setPledgeForm] = useState({
    pledgedAmount: invoice?.balance ?? '',
    pledgeDate: '',
    notes: ''
  });
  const [savingPledge, setSavingPledge] = useState(false);

  // Waiver modal
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showA5Preview, setShowA5Preview] = useState(false);

  // ── data fetching ──────────────────────────────────────────────────────────
  const fetchActivity = useCallback(async () => {
    if (!invoice?.id) return;
    setActivityLoading(true);
    try {
      const res = await api.fees.getInvoiceComments(invoice.id);
      setComments(res.data?.comments || []);
      setPledges(res.data?.pledges || []);
      setPayments(res.data?.payments || []);
    } catch (e) {
      console.error('Failed to fetch invoice activity:', e);
    } finally {
      setActivityLoading(false);
    }
  }, [invoice?.id]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  useEffect(() => {
    const checkWhatsApp = async () => {
      try {
        const res = await api.notifications.getWhatsAppStatus();
        if (res.success) setWhatsappStatus(res.data);
      } catch (e) { /* non-critical */ }
    };
    checkWhatsApp();

    const fetchBranding = async () => {
      try {
        const resp = await api.branding.get();
        if (resp.success) setSchoolInfo(resp.data);
      } catch (e) {}
    };
    fetchBranding();
  }, []);

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleSendReminder = async (channel) => {
    try {
      setLoading(true);
      const result = await api.fees.sendReminder(invoice.id, { channel });
      if (result.success) {
        const failed = channel === 'SMS' ? result.data?.sms?.startsWith('Failed')
                     : result.data?.whatsapp?.startsWith('Failed');
        if (failed) showError(`${channel} reminder failed`);
        else { showSuccess(`Reminder sent via ${channel}`); fetchActivity(); }
      }
    } catch (error) {
      showError(error.message || 'Failed to send reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.fees.addComment(invoice.id, { type: noteType, body: noteText.trim() });
      setNoteText('');
      showSuccess('Note saved');
      fetchActivity();
    } catch (e) {
      showError(e.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSavePledge = async () => {
    if (!pledgeForm.pledgedAmount || !pledgeForm.pledgeDate) {
      showError('Amount and date are required');
      return;
    }
    setSavingPledge(true);
    try {
      await api.fees.addPledge(invoice.id, pledgeForm);
      showSuccess('Pledge recorded! Reminder will be sent automatically on the pledge date.');
      setShowPledgeModal(false);
      setPledgeForm({ pledgedAmount: invoice?.balance ?? '', pledgeDate: '', notes: '' });
      fetchActivity();
    } catch (e) {
      showError(e.message || 'Failed to record pledge');
    } finally {
      setSavingPledge(false);
    }
  };

  const handleCancelPledge = async (pledgeId) => {
    if (!window.confirm('Cancel this pledge?')) return;
    try {
      await api.fees.cancelPledge(pledgeId);
      showSuccess('Pledge cancelled');
      fetchActivity();
    } catch (e) {
      showError(e.message || 'Failed to cancel pledge');
    }
  };

  const handleDownloadPdf = async () => {
    const isPaid = ['PAID', 'OVERPAID', 'WAIVED'].includes(invoice.status);
    const docType = isPaid ? 'OFFICIAL RECEIPT' : 'FEE INVOICE';
    const docRef = isPaid ? `RCT-${invoice.invoiceNumber}` : `INV-${invoice.invoiceNumber}`;
    const filename = isPaid ? `Receipt_${invoice.invoiceNumber}.pdf` : `Invoice_${invoice.invoiceNumber}.pdf`;
    const rowItems = invoice.feeStructure?.items?.length
      ? invoice.feeStructure.items
      : (invoice.items || [{ name: 'School Fees', amount: invoice.totalAmount, mandatory: true }]);

    const html = `
      <div style="margin-bottom:30px;display:flex;justify-content:space-between;background:#f8fafc;padding:20px;border-radius:8px;">
        <div>
          <p style="font-size:10px;font-weight:800;color:#64748b;margin:0 0 5px 0;text-transform:uppercase;">Bill To:</p>
          <p style="font-size:14px;font-weight:800;margin:0;color:#1e293b;">${invoice.learner?.firstName||''} ${invoice.learner?.lastName||''}</p>
          <p style="font-size:12px;color:#64748b;margin:3px 0;">ADM: ${invoice.learner?.admissionNumber||'-'}</p>
          <p style="font-size:12px;color:#64748b;margin:0;">Class: ${(invoice.learner?.grade||'').replace(/_/g,' ')}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:10px;font-weight:800;color:#64748b;margin:0 0 5px 0;text-transform:uppercase;">Details:</p>
          <p style="font-size:12px;color:#1e293b;margin:0;">Term: ${(invoice.term||'').replace(/_/g,' ')} ${invoice.academicYear||''}</p>
          <p style="font-size:12px;color:#1e293b;margin:3px 0;">Issued: ${new Date(invoice.createdAt||Date.now()).toLocaleDateString('en-GB')}</p>
          <p style="font-size:12px;font-weight:700;color:${isPaid?'#16a34a':'#dc2626'};margin:0;">Status: ${invoice.status}</p>
        </div>
      </div>
      <table>
        <thead><tr><th style="width:40px;">#</th><th>Description</th><th style="width:100px;text-align:center;">Type</th><th style="width:150px;text-align:right;">Amount (KES)</th></tr></thead>
        <tbody>${rowItems.map((item,i)=>`<tr><td>${i+1}</td><td style="font-weight:600;">${item.name||item.description||'General Fees'}</td><td style="text-align:center;font-size:10px;color:#64748b;">${item.mandatory!==false?'MANDATORY':'OPTIONAL'}</td><td style="text-align:right;font-weight:700;">${Number(item.amount||0).toLocaleString('en-KE')}</td></tr>`).join('')}</tbody>
      </table>
      <div style="margin-top:30px;display:flex;justify-content:flex-end;">
        <div style="width:250px;">
          <div style="display:flex;justify-content:space-between;padding:5px 0;color:#64748b;font-size:12px;"><span>Subtotal Charged:</span><span>KES ${Number(invoice.totalAmount||0).toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;color:#16a34a;font-size:12px;font-weight:600;"><span>Total Paid:</span><span>KES ${Number(invoice.paidAmount||0).toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;color:#00A09D;font-size:12px;font-weight:600;"><span>Total Waived:</span><span>KES ${(invoice.waivers || []).reduce((acc, w) => acc + Number(w.amountWaived), 0).toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #e2e8f0;margin-top:5px;color:${Number(invoice.balance||0)<=0?'#16a34a':'#dc2626'};font-size:16px;font-weight:800;"><span>BALANCE DUE:</span><span>KES ${Number(invoice.balance||0).toLocaleString()}</span></div>
        </div>
      </div>`;

    await generateDocument({ html, fileName: filename, docInfo: { type: docType, ref: docRef }, includeStamp: true, stampOptions: { status: isPaid ? 'PAID' : 'APPROVED', dept: 'FINANCE OFFICE' }, includeLetterhead: false });
  };

  const handlePrintThermal = () => {
    setPrintingInvoice(invoice);
    setTimeout(() => {
      window.print();
      setPrintingInvoice(null);
    }, 100);
  };

  // ── guard ──────────────────────────────────────────────────────────────────
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-4">
        <p className="text-lg font-semibold">No invoice selected.</p>
        <button onClick={() => navigateTo('fees-collection')} className="flex items-center gap-2 px-4 py-2 bg-[#002C60] text-white rounded-lg font-semibold">
          <ArrowLeft size={16} /> Back to Invoices
        </button>
      </div>
    );
  }

  const activePledges = pledges.filter(p => ['PENDING', 'DUE'].includes(p.status));

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Back */}
      <button onClick={() => navigateTo('fees-collection')} className="flex items-center gap-2 text-gray-500 hover:text-[#002C60] font-semibold transition-colors">
        <ArrowLeft size={20} /><span>Back to Invoices</span>
      </button>

      {/* Header card */}
      <div className="bg-[#002C60] rounded-2xl px-8 py-6 text-white flex justify-between items-start shadow-lg">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight">Invoice Details</h1>
          <p className="text-white text-sm font-semibold uppercase tracking-widest">{invoice.invoiceNumber}</p>
          {activePledges.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-medium px-2 py-0.5 rounded-full mt-1">
              <Bookmark size={11} /> {activePledges.length} Active Pledge{activePledges.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowA5Preview(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl font-medium text-xs transition-all shadow-sm"
            title="Download/Print A5 Invoice"
          >
            <Download size={14} />
            <span>A5</span>
          </button>
          
          <button
            onClick={handlePrintThermal}
            className="flex items-center gap-1.5 bg-amber-500 text-white hover:bg-amber-600 px-3 py-2 rounded-xl font-medium text-xs transition-all shadow-sm"
            title="Thermal Printer (POS)"
          >
            <Download size={14} className="rotate-180" />
            <span>POS</span>
          </button>

          <div className="h-8 w-px bg-white/20 mx-1" />

          <button onClick={() => navigateTo('fees-record-payment', { invoice })} className="flex items-center gap-2 bg-white text-[#002C60] hover:bg-blue-50 px-4 py-2 rounded-xl font-medium text-sm transition-all border border-blue-100">
            <Plus size={16} /> Collect Payment
          </button>
          
          <button 
            onClick={() => setShowWaiverModal(true)} 
            className="flex items-center gap-2 bg-[#00A09D] text-white hover:bg-[#008c89] px-4 py-2 rounded-xl font-medium text-sm transition-all"
            title="Request Fee Waiver"
          >
            <Gift size={16} /> Waiver
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Due', value: `KES ${Number(invoice.totalAmount).toLocaleString()}`, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Total Paid', value: `KES ${Number(invoice.paidAmount).toLocaleString()}`, color: 'text-green-600', bg: 'bg-white' },
          { label: 'Waived', value: `KES ${(invoice.waivers || []).reduce((acc, w) => acc + Number(w.amountWaived), 0).toLocaleString()}`, color: 'text-teal-600', bg: 'bg-white' },
          { 
            label: Number(invoice.balance) < 0 ? 'Overpaid (Credit)' : 'Balance Due', 
            value: `KES ${Math.abs(Number(invoice.balance)).toLocaleString()}`, 
            color: Number(invoice.balance) < 0 ? 'text-purple-600' : 'text-rose-600',
            bg: Number(invoice.balance) < 0 ? 'bg-purple-50/50 border-purple-100' : 'bg-white'
          },
        ].map(s => (
          <div key={s.label} className={`${s.bg} p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center transition-all`}>
            <span className="text-[10px] font-medium text-gray-400 uppercase mb-1">{s.label}</span>
            <span className={`text-xl font-medium ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Transport sub-ledger card */}
      {invoice.learner?.isTransportStudent && Number(invoice.transportBilled || 0) > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-orange-600 text-lg">🚌</span>
            <div>
              <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider">Transport Sub-Ledger</p>
              <p className="text-[10px] text-orange-600">Billed separately from tuition</p>
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-[10px] font-medium text-orange-600 uppercase">Billed</p>
              <p className="text-base font-semibold text-orange-900">KES {Number(invoice.transportBilled || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-orange-600 uppercase">Paid</p>
              <p className="text-base font-semibold text-green-700">KES {Number(invoice.transportPaid || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-orange-600 uppercase">Balance</p>
              <p className={`text-base font-semibold ${Number(invoice.transportBalance || 0) <= 0 ? 'text-green-700' : 'text-red-600'}`}>
                KES {Number(invoice.transportBalance || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Student & parent */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-[#002C60] font-medium text-xs uppercase tracking-wider"><User size={14} /> Student Information</div>
          <div className="space-y-1 pt-1">
            <p className="font-medium text-gray-900 text-lg">{invoice.learner?.firstName} {invoice.learner?.lastName}</p>
            <p className="text-sm text-gray-500">ADM: {invoice.learner?.admissionNumber}</p>
            <p className="text-sm text-gray-500">Grade: {invoice.learner?.grade} {invoice.learner?.stream}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-[#002C60] font-medium text-xs uppercase tracking-wider"><ShieldCheck size={14} /> Parent / Guardian</div>
          <div className="space-y-1 pt-1">
            <p className="font-medium text-gray-900">{invoice.learner?.primaryContactName || 'N/A'}</p>
            <p className="text-sm text-green-600 font-medium">Phone: {invoice.learner?.primaryContactPhone || invoice.learner?.guardianPhone || 'N/A'}</p>
            <p className="text-xs text-gray-400 italic">Preferred contact for reminders</p>
          </div>
        </div>
      </div>

      {/* Billing details */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-[#002C60] font-medium text-xs uppercase tracking-wider"><Info size={14} /> Billing Details</div>
        <div className="grid grid-cols-2 gap-8 pt-1">
          <div className="space-y-3">
            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-xs text-gray-400 font-medium uppercase">Term</span><span className="text-sm font-semibold">{invoice.term} {invoice.academicYear}</span></div>
            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-xs text-gray-400 font-medium uppercase">Due Date</span><span className="text-sm font-semibold text-rose-500">{new Date(invoice.dueDate).toLocaleDateString()}</span></div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-xs text-gray-400 font-medium uppercase">Structure</span><span className="text-sm font-semibold truncate max-w-[140px]">{invoice.feeStructure?.name}</span></div>
            <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-xs text-gray-400 font-medium uppercase">Issued On</span><span className="text-sm font-semibold">{new Date(invoice.createdAt).toLocaleDateString()}</span></div>
          </div>
        </div>
      </div>

      {/* Payment History — Fee Statement */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-[#f8fafc] px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#002C60] font-medium text-xs uppercase tracking-wider">
            <FileText size={14} /> Payment History / Fee Statement
          </div>
          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase">
            {payments.length} Transactions
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-3 font-medium text-gray-400 uppercase tracking-widest text-[9px]">Date</th>
                <th className="px-6 py-3 font-medium text-gray-400 uppercase tracking-widest text-[9px]">Receipt #</th>
                <th className="px-6 py-3 font-medium text-gray-400 uppercase tracking-widest text-[9px]">Method</th>
                <th className="px-6 py-3 font-medium text-gray-400 uppercase tracking-widest text-[9px]">Reference</th>
                <th className="px-6 py-3 font-medium text-gray-400 uppercase tracking-widest text-[9px] text-right">Total</th>
                {invoice.learner?.isTransportStudent && (
                  <th className="px-6 py-3 font-medium text-orange-400 uppercase tracking-widest text-[9px] text-right">Transport</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-400 italic">
                    No payments have been recorded for this invoice yet.
                  </td>
                </tr>
              ) : (
                <>
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3 text-gray-600 font-medium">
                        {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-900">{p.receiptNumber}</td>
                      <td className="px-6 py-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase tracking-tighter">
                          {p.paymentMethod.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 font-mono tracking-tighter uppercase whitespace-nowrap">
                        {p.referenceNumber || 'INTERNAL'}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-emerald-600">
                        {Number(p.amount).toLocaleString()}
                      </td>
                      {invoice.learner?.isTransportStudent && (
                        <td className="px-6 py-3 text-right font-medium text-orange-600">
                          {Number(p.transportAmount || 0) > 0 ? Number(p.transportAmount).toLocaleString() : '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/30">
                    <td colSpan="4" className="px-6 py-3 text-right text-[10px] font-semibold text-emerald-700 uppercase tracking-widest">
                      Total Payments Recorded
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-base text-emerald-700">
                      KES {payments.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminders */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Send Payment Reminder</p>
        <div className="flex gap-3">
          <button onClick={() => handleSendReminder('SMS')} disabled={loading} className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />} Send SMS
          </button>
          <button onClick={() => handleSendReminder('WHATSAPP')} disabled={loading || whatsappStatus.status !== 'authenticated'} className={`flex-1 text-white px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${whatsappStatus.status === 'authenticated' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} WhatsApp
          </button>
        </div>
      </div>

      {/* ── Activity Section ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Activity header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition"
          onClick={() => setActivityExpanded(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#002C60]" />
            <span className="font-medium text-[#002C60] text-sm uppercase tracking-wider">Activity & Notes</span>
            {(comments.length + pledges.length) > 0 && (
              <span className="bg-[#002C60] text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {comments.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {invoice.status !== 'PAID' && invoice.status !== 'WAIVED' && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowPledgeModal(true); }}
                className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-lg transition"
              >
                <Bookmark size={13} /> Record Pledge
              </button>
            )}
            {activityExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </div>
        </div>

        {activityExpanded && (
          <div className="p-6 space-y-5">

            {/* Active pledge banner */}
            {activePledges.length > 0 && (
              <div className="space-y-2">
                {activePledges.map(pledge => {
                  const meta = PLEDGE_STATUS_META[pledge.status] || PLEDGE_STATUS_META.PENDING;
                  return (
                    <div key={pledge.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Bookmark size={18} className="text-amber-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-900">
                            KES {Number(pledge.pledgedAmount).toLocaleString()} pledged by{' '}
                            {new Date(pledge.pledgeDate).toLocaleDateString('en-GB')}
                          </p>
                          <p className="text-xs text-amber-700">
                            By {pledge.createdBy?.firstName} · {pledge.reminderCount > 0 ? `${pledge.reminderCount} reminder(s) sent` : 'No reminder sent yet'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                        <button onClick={() => handleCancelPledge(pledge.id)} className="text-xs text-gray-400 hover:text-red-600 transition" title="Cancel pledge">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add note inline */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={noteType}
                  onChange={e => setNoteType(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 focus:ring-2 focus:ring-[#002C60] bg-gray-50"
                >
                  <option value="NOTE">📝 Note</option>
                  <option value="CALL_LOG">📞 Call Log</option>
                </select>
                <input
                  type="text"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSaveNote()}
                  placeholder="Add a note or call log… (Enter to save)"
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#002C60] focus:border-transparent"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={!noteText.trim() || savingNote}
                  className="px-4 py-2 bg-[#002C60] text-white rounded-lg text-sm font-medium hover:bg-[#003a7a] disabled:opacity-40 transition flex items-center gap-1"
                >
                  {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>

            {/* Timeline */}
            {activityLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Clock size={28} className="mx-auto mb-2 opacity-30" />
                No activity yet. Add a note or record a pledge above.
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map(c => {
                  const meta = COMMENT_TYPE_META[c.type] || COMMENT_TYPE_META.NOTE;
                  const Icon = meta.icon;
                  return (
                    <div key={c.id} className={`flex gap-3 p-3 rounded-xl ${meta.bg}`}>
                      <div className={`flex-shrink-0 mt-0.5 ${meta.color}`}><Icon size={15} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">
                            {c.createdBy?.firstName} {c.createdBy?.lastName}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 break-words">{c.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest pt-4">
        Official Financial Document — {PRODUCT_DISPLAY_NAME} Core Unit
      </p>

      {/* ── Pledge Modal ────────────────────────────────────────────────── */}
      {showPledgeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-amber-500 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-white font-medium text-lg">Record Pledge</h3>
                <p className="text-amber-100 text-xs mt-0.5">Parent promises to pay on a specific date</p>
              </div>
              <button onClick={() => setShowPledgeModal(false)} className="text-white hover:bg-white/20 p-1.5 rounded-lg transition"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 uppercase">Pledged Amount (KES) *</label>
                <input
                  type="number"
                  value={pledgeForm.pledgedAmount}
                  onChange={e => setPledgeForm(f => ({ ...f, pledgedAmount: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 text-lg font-medium"
                  placeholder="e.g. 5000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 uppercase">Promise to Pay By *</label>
                <input
                  type="date"
                  value={pledgeForm.pledgeDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setPledgeForm(f => ({ ...f, pledgeDate: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 uppercase">Notes (optional)</label>
                <textarea
                  value={pledgeForm.notes}
                  onChange={e => setPledgeForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 resize-none text-sm"
                  placeholder="e.g. Parent will pay after salary at end of month"
                />
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <Calendar size={14} className="flex-shrink-0 mt-0.5" />
                <span>An SMS reminder will automatically be sent to the parent on the pledge date.</span>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSavePledge}
                  disabled={savingPledge}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingPledge ? <Loader2 size={16} className="animate-spin" /> : <Bookmark size={16} />}
                  Save Pledge
                </button>
                <button onClick={() => setShowPledgeModal(false)} className="px-6 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast show={showToast} message={toastMessage} type={toastType} onClose={hideNotification} />

      {showWaiverModal && (
        <FeeWaiverModal
          isOpen={showWaiverModal}
          onClose={() => setShowWaiverModal(false)}
          invoice={invoice}
          onSuccess={() => {
            setShowWaiverModal(false);
            fetchActivity(); // Refresh activity to show the new waiver request
          }}
        />
      )}

      {/* Thermal Print Overlay */}
      {printingInvoice && (
        <div id="printable-thermal-receipt" className="thermal-print-overlay">
          <ThermalReceipt invoice={printingInvoice} schoolInfo={schoolInfo} />
        </div>
      )}
      {showA5Preview && (
        <InvoiceA5
          invoice={invoice}
          schoolInfo={schoolInfo}
          onClose={() => setShowA5Preview(false)}
        />
      )}
    </div>
  );
};

export default InvoiceDetailPage;
