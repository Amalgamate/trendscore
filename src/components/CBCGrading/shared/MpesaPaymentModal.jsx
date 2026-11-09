import React, { useState, useEffect } from 'react';
import { 
  X, CreditCard, Phone, Loader2, CheckCircle2, 
  AlertCircle, Smartphone, ArrowRight, ShieldCheck 
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const MpesaPaymentModal = ({ isOpen, onClose, invoice, parentPhone, onPaymentSuccess }) => {
  const [amount, setAmount] = useState(invoice?.balance || 0);
  const [phone, setPhone] = useState(parentPhone || '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'initiating' | 'pending' | 'success' | 'failed'
  const [checkoutId, setCheckoutId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (invoice?.balance) setAmount(invoice.balance);
    if (parentPhone) setPhone(parentPhone);
  }, [invoice, parentPhone]);

  // Polling for status
  useEffect(() => {
    let pollInterval;
    if (status === 'pending' && checkoutId) {
      pollInterval = setInterval(async () => {
        try {
          const response = await axios.get(`/api/mpesa/status/${checkoutId}/${invoice.id}`);
          if (response.data.status === 'COMPLETE') {
            setStatus('success');
            clearInterval(pollInterval);
            toast.success('Payment received successfully!');
            setTimeout(() => {
              onPaymentSuccess?.();
              onClose();
            }, 3000);
          } else if (response.data.status === 'FAILED') {
            setStatus('failed');
            setError('Payment was cancelled or failed.');
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000);
    }
    return () => clearInterval(pollInterval);
  }, [status, checkoutId, invoice?.id, onClose, onPaymentSuccess]);

  if (!isOpen) return null;

  const handleInitiate = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return toast.error('Please enter a valid amount');
    const invoiceBalance = Number(invoice?.balance || 0);
    if (invoice?.id !== 'advance' && invoiceBalance > 0 && Number(amount) > invoiceBalance) {
      return toast.error(`Payment cannot exceed this invoice balance of KES ${invoiceBalance.toLocaleString()}`);
    }
    if (!phone) return toast.error('Please enter an M-Pesa phone number');

    setLoading(true);
    setStatus('initiating');
    setError(null);

    try {
      const response = await axios.post('/api/mpesa/initiate', {
        amount,
        phoneNumber: phone,
        invoiceId: invoice.id
      });

      if (response.data.success) {
        setCheckoutId(response.data.checkoutRequestId);
        setStatus('pending');
      } else {
        throw new Error(response.data.message || 'Failed to initiate payment');
      }
    } catch (err) {
      console.error('Payment initiation error:', err);
      setStatus('failed');
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
              <CreditCard size={18} className="text-white" />
            </div>
            <h3 className="text-sm font-medium uppercase tracking-wider">Fee Payment</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            disabled={status === 'pending'}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {status === 'idle' || status === 'initiating' ? (
            <form onSubmit={handleInitiate} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 ml-1">Payment Amount (KES)</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <span className="text-slate-400 font-medium">KES</span>
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    max={invoice?.id !== 'advance' ? Number(invoice?.balance || 0) || undefined : undefined}
                    className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-semibold text-slate-900 focus:bg-white focus:border-orange-500 focus:ring-0 transition-all outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 ml-1">M-Pesa Phone Number</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Phone size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-semibold text-slate-900 focus:bg-white focus:border-orange-500 focus:ring-0 transition-all outline-none"
                    placeholder="2547XXXXXXXX"
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <p className="text-[11px] font-semibold text-amber-800 leading-relaxed">
                  You will receive an M-Pesa prompt on your phone. Enter your PIN to complete the transaction.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-2xl font-semibold uppercase tracking-[0.2em] shadow-lg shadow-orange-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Smartphone size={20} />}
                {loading ? 'Initiating...' : 'Pay with M-Pesa'}
              </button>

              <div className="flex items-center justify-center gap-2 text-slate-400">
                <ShieldCheck size={14} />
                <span className="text-[10px] font-medium uppercase tracking-wider">Secured by M-Pesa Payment Gateway</span>
              </div>
            </form>
          ) : status === 'pending' ? (
            <div className="py-10 flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-600/20 rounded-full animate-ping" />
                <div className="relative p-6 bg-orange-50 rounded-full text-orange-600">
                  <Smartphone size={48} className="animate-bounce" />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">Check your Phone</h4>
                <p className="text-sm font-semibold text-slate-500 max-w-[240px]">
                  An M-Pesa PIN prompt has been sent to <span className="text-orange-600 font-medium">{phone}</span>.
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                <Loader2 size={14} className="animate-spin text-orange-600" />
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.1em]">Waiting for confirmation</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium uppercase underline cursor-pointer hover:text-slate-600" onClick={() => setStatus('idle')}>
                Didn't get a prompt? Try again
              </p>
            </div>
          ) : status === 'success' ? (
            <div className="py-10 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500">
              <div className="p-6 bg-emerald-100 rounded-full text-emerald-600">
                <CheckCircle2 size={64} />
              </div>
              <div className="space-y-1">
                <h4 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">Payment Complete!</h4>
                <p className="text-sm font-semibold text-slate-500">
                  Transaction of KES {amount} was successful.
                </p>
              </div>
              <div className="p-4 w-full bg-slate-50 rounded-2xl border border-slate-100 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Receipt No</span>
                  <span className="text-xs font-semibold text-slate-900">{checkoutId?.slice(-8).toUpperCase()}</span>
                </div>
                <div className="h-px bg-slate-200 w-full mb-2" />
                <p className="text-[10px] font-semibold text-slate-500">
                  Your student ledger has been updated. You will receive an SMS receipt shortly.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-10 flex flex-col items-center text-center space-y-6">
              <div className="p-6 bg-red-100 rounded-full text-red-600">
                <AlertCircle size={64} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">Payment Failed</h4>
                <p className="text-sm font-semibold text-slate-600">
                  {error || 'Something went wrong while processing your request.'}
                </p>
              </div>
              <button
                onClick={() => setStatus('idle')}
                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-semibold uppercase tracking-wider text-xs transition-transform active:scale-95"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MpesaPaymentModal;
