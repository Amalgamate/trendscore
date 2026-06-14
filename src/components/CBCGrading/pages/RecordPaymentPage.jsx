/**
 * Record Payment Page
 * Full-page payment recording — replaces the former modal.
 *
 * CHANGES FROM ORIGINAL:
 *  - Payment date is explicitly selectable for back-posting
 *  - Notes field removed from payment form
 *  - after success, navigates to invoice detail so they can see the history
 */

import React, { useState } from 'react';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import usePageNavigation from '../../../hooks/usePageNavigation';
import { useNotifications } from '../hooks/useNotifications';
import Toast from '../shared/Toast';
import InvoiceA5 from '../shared/InvoiceA5';
import ThermalReceipt from '../shared/ThermalReceipt';
import api from '../../../services/api';

const RecordPaymentPage = ({ invoice, initialMode }) => {
  const navigateTo = usePageNavigation();
  const { showSuccess, showError, showToast, toastMessage, toastType, hideNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: invoice?.balance ?? '',
    payerType: 'STUDENT',
    paymentMethod: initialMode || 'CASH',
    referenceNumber: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  
  const hasTransport = Number(invoice?.transportBalance || 0) > 0;
  const [allocationMode, setAllocationMode] = useState('AUTO');
  const [allocatedTuition, setAllocatedTuition] = useState('');
  const [allocatedTransport, setAllocatedTransport] = useState('');

  // After success we show an inline confirmation panel before navigating
  const [successResult, setSuccessResult] = useState(null);
  const [showA5Preview, setShowA5Preview] = useState(false);
  const [showThermalReceipt, setShowThermalReceipt] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState(null);

  React.useEffect(() => {
    const fetchBranding = async () => {
      try {
        const resp = await api.branding.get();
        if (resp.success) setSchoolInfo(resp.data);
      } catch (err) {
        console.error('Failed to load branding:', err);
      }
    };
    fetchBranding();
  }, []);

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-4">
        <p className="text-lg font-semibold">No invoice selected.</p>
        <button
          onClick={() => navigateTo('fees-collection')}
          className="flex items-center gap-2 px-4 py-2 bg-[#002C60] text-white rounded-lg font-semibold hover:bg-[#003a7a] transition"
        >
          <ArrowLeft size={16} /> Back to Invoices
        </button>
      </div>
    );
  }

  const handleRecordPayment = async () => {
    if (!paymentData.amount) {
      showError('Please enter a payment amount');
      return;
    }
    if (paymentData.paymentMethod === 'MPESA' && !paymentData.referenceNumber) {
      showError('M-Pesa reference number is required');
      return;
    }
    if (paymentData.paymentMethod === 'CHEQUE' && !paymentData.referenceNumber) {
      showError('Cheque number is required');
      return;
    }

    try {
      setLoading(true);

      let finalAllocation = {};
      
      if (paymentData.payerType !== 'SPONSOR' && hasTransport && allocationMode === 'CUSTOM') {
        const tuit = parseFloat(allocatedTuition) || 0;
        const trans = parseFloat(allocatedTransport) || 0;
        if (Math.abs(tuit + trans - parseFloat(paymentData.amount)) > 0.01) {
           showError('The allocated tuition and transport amounts must equal the total payment amount.');
           return;
        }
        finalAllocation = { allocatedTuition: tuit, allocatedTransport: trans };
      }

      const result = await api.fees.recordPayment({
        invoiceId: invoice.id,
        amount: parseFloat(paymentData.amount),
        paymentMethod: paymentData.paymentMethod,
        referenceNumber: paymentData.referenceNumber || null,
        paymentDate: paymentData.paymentDate,
        payerType: paymentData.payerType,
        ...finalAllocation
      });

      setSuccessResult({ data: result.data });
      // Removed auto-navigate to allow for printing
    } catch (error) {
      showError(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  // ── Success confirmation panel ──────────────────────────────
  if (successResult) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-12 pt-8">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 flex flex-col items-center text-center space-y-4 shadow-sm">
          <CheckCircle2 size={56} className="text-green-500" />
          <h2 className="text-2xl font-medium text-green-800">Payment Recorded!</h2>
          <p className="text-green-700 font-semibold">
            KES {Number(paymentData.amount).toLocaleString()} recorded via{' '}
            {paymentData.paymentMethod.replace('_', ' ')}.
          </p>
          <p className="text-sm text-green-600">
            Receipt #{successResult.data?.payment?.receiptNumber}
          </p>

          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            <button
              onClick={() => setShowA5Preview(true)}
              className="flex items-center justify-center gap-2 bg-[#002C60] text-white px-4 py-3 rounded-xl font-medium text-sm hover:bg-[#003a7a] transition shadow-md"
            >
              Print A5 Receipt
            </button>
            <button
              onClick={() => setShowThermalReceipt(true)}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition shadow-md"
            >
              Print Thermal
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 mt-6">
            <button
              onClick={() => navigateTo('fees-collection')}
              className="text-[#002C60] font-medium text-sm hover:underline"
            >
              Done & Return to List
            </button>
            <p className="text-[10px] text-gray-400">The parent has also been notified via SMS/WhatsApp.</p>
          </div>
        </div>

        {showA5Preview && (
          <InvoiceA5
            invoice={successResult.data.invoice}
            schoolInfo={schoolInfo}
            onClose={() => setShowA5Preview(false)}
          />
        )}

        {showThermalReceipt && (
          <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
              <button 
                onClick={() => setShowThermalReceipt(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft size={20} className="rotate-90" />
              </button>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Thermal Preview</h3>
              <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 overflow-auto max-h-[60vh]">
                <ThermalReceipt invoice={successResult.data.invoice} schoolInfo={schoolInfo} />
              </div>
              <button
                onClick={() => {
                   const win = window.open('', '_blank');
                   const content = document.getElementById('printable-thermal-receipt-hidden').innerHTML;
                   win.document.write(`<html><head><style>@page { size: 58mm auto; margin: 0; } body { margin: 0; }</style></head><body>${content}</body></html>`);
                   win.document.close();
                   win.print();
                }}
                className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition"
              >
                Send to Printer
              </button>
            </div>
          </div>
        )}

        {/* Hidden area for printing */}
        <div id="printable-thermal-receipt-hidden" className="hidden">
           <ThermalReceipt invoice={successResult.data.invoice} schoolInfo={schoolInfo} />
        </div>
      </div>
    );
  }

  // ── Normal form ─────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Back link */}
      <button
        onClick={() => navigateTo('fees-invoice-detail', { invoice })}
        className="flex items-center gap-2 text-gray-500 hover:text-[#002C60] font-semibold transition-colors"
      >
        <ArrowLeft size={20} /> Back to Invoice
      </button>

      {/* Page Header */}
      <div className="bg-green-600 rounded-2xl px-8 py-6 text-white shadow-lg">
        <h1 className="text-2xl font-medium">Record Payment</h1>
        <p className="text-green-100 text-sm mt-1">{invoice.invoiceNumber}</p>
      </div>

      {/* Invoice Summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Invoice Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm pt-1">
          <div>
            <span className="text-gray-500">Student:</span>
            <span className="ml-2 font-semibold text-gray-800">
              {invoice.learner?.firstName} {invoice.learner?.lastName}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Invoice #:</span>
            <span className="ml-2 font-semibold">{invoice.invoiceNumber}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Billed:</span>
            <span className="ml-2 font-semibold">KES {Number(invoice.totalAmount).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Amount Paid:</span>
            <span className="ml-2 font-semibold text-green-600">KES {Number(invoice.paidAmount).toLocaleString()}</span>
          </div>
          {hasTransport && (
            <>
              <div className="pt-2 border-t border-gray-100">
                <span className="text-gray-500">Transport:</span>
                <span className="ml-2 font-semibold">KES {Number(invoice.transportBilled || 0).toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 items-center">
                <span className="text-gray-500">Transport Paid:</span>
                <span className="ml-2 font-semibold text-green-600">KES {Number(invoice.transportPaid || 0).toLocaleString()}</span>
              </div>
            </>
          )}
          <div className={`col-span-2 pt-2 border-t border-gray-100 flex items-center justify-between`}>
            <div>
              <span className="text-gray-500">Tuition Balance:</span>
              <span className="ml-2 font-medium text-red-600 text-xl">
                KES {Number(invoice.balance).toLocaleString()}
              </span>
            </div>
            {hasTransport && (
              <div>
                <span className="text-gray-500">Transport Bal:</span>
                <span className="ml-2 font-medium text-orange-600 text-xl">
                  KES {Number(invoice.transportBalance).toLocaleString()}
                </span>
              </div>
            )}
            {Number(invoice.sponsorAmount || 0) > 0 && (
              <div>
                <span className="text-gray-500">Sponsor Balance:</span>
                <span className="ml-2 font-medium text-indigo-600 text-xl">
                  KES {Number(invoice.sponsorBalance || 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Payment Information</h2>

        {Number(invoice.sponsorAmount || 0) > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Payment responsibility</label>
            <select
              value={paymentData.payerType}
              onChange={(e) => {
                const payerType = e.target.value;
                setPaymentData({
                  ...paymentData,
                  payerType,
                  amount: payerType === 'SPONSOR' ? Number(invoice.sponsorBalance || 0) : Number(invoice.balance || 0),
                });
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
            >
              <option value="STUDENT">Student / Parent</option>
              <option value="SPONSOR">Sponsor</option>
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Payment Date *</label>
          <input
            type="date"
            value={paymentData.paymentDate}
            onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Amount to Pay *</label>
          <input
            type="number"
            value={paymentData.amount}
            onChange={(e) => {
              setPaymentData({ ...paymentData, amount: e.target.value });
              if (allocationMode === 'AUTO') {
                const amt = parseFloat(e.target.value) || 0;
                const tuitBal = Number(invoice.balance || 0);
                if (amt <= tuitBal) {
                   setAllocatedTuition(amt.toString());
                   setAllocatedTransport('0');
                } else {
                   setAllocatedTuition(tuitBal.toString());
                   setAllocatedTransport((amt - tuitBal).toString());
                }
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-lg font-semibold"
            placeholder="Enter amount"
            step="0.01"
          />
        </div>

        {paymentData.payerType !== 'SPONSOR' && hasTransport && paymentData.amount && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mt-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-orange-900">Payment Allocation</label>
                <div className="flex bg-white rounded-lg p-0.5 border border-orange-200">
                  <button 
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${allocationMode === 'AUTO' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-100'}`}
                    onClick={() => {
                        setAllocationMode('AUTO');
                        const amt = parseFloat(paymentData.amount) || 0;
                        const tuitBal = Number(invoice.balance || 0);
                        if (amt <= tuitBal) {
                           setAllocatedTuition(amt.toString());
                           setAllocatedTransport('0');
                        } else {
                           setAllocatedTuition(tuitBal.toString());
                           setAllocatedTransport((amt - tuitBal).toString());
                        }
                    }}
                  >
                    Auto
                  </button>
                  <button 
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${allocationMode === 'CUSTOM' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-100'}`}
                    onClick={() => setAllocationMode('CUSTOM')}
                  >
                    Custom Split
                  </button>
                </div>
              </div>

              {allocationMode === 'AUTO' ? (
                 <p className="text-xs text-orange-700">
                   Automatically pays off general tuition first <span className="font-medium border-b border-orange-400">({allocatedTuition})</span>, and puts the remainder towards transport <span className="font-medium border-b border-orange-400">({allocatedTransport})</span>.
                 </p>
              ) : (
                 <div className="grid grid-cols-2 gap-3 pb-1">
                   <div>
                     <label className="block text-xs font-medium text-orange-800 mb-1">To Tuition</label>
                     <input type="number" value={allocatedTuition} onChange={e => setAllocatedTuition(e.target.value)} className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-orange-500 focus:border-orange-500" placeholder="0.00" />
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-orange-800 mb-1">To Transport</label>
                     <input type="number" value={allocatedTransport} onChange={e => setAllocatedTransport(e.target.value)} className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-orange-500 focus:border-orange-500" placeholder="0.00" />
                   </div>
                 </div>
              )}
            </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Payment Method *</label>
          <select
            value={paymentData.paymentMethod}
            onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
          >
            <option value="CASH">Cash</option>
            <option value="MPESA">M-Pesa</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
          </select>
        </div>

        {paymentData.paymentMethod !== 'CASH' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="block text-sm font-semibold text-gray-700">
              {paymentData.paymentMethod === 'CHEQUE' ? 'Cheque Number *' : `Reference Number${paymentData.paymentMethod === 'MPESA' ? ' *' : ''}`}
            </label>
            <input
              type="text"
              value={paymentData.referenceNumber}
              onChange={(e) => setPaymentData({ ...paymentData, referenceNumber: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder={
                paymentData.paymentMethod === 'MPESA' ? 'M-Pesa transaction code' : 
                paymentData.paymentMethod === 'CHEQUE' ? 'Enter cheque number' : 
                'Reference number (optional)'
              }
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleRecordPayment}
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-medium text-base flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Processing...' : 'Record Payment'}
          </button>
          <button
            onClick={() => navigateTo('fees-invoice-detail', { invoice })}
            className="px-6 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-all"
          >
            Cancel
          </button>
        </div>
      </div>

      <Toast show={showToast} message={toastMessage} type={toastType} onClose={hideNotification} />
    </div>
  );
};

export default RecordPaymentPage;
