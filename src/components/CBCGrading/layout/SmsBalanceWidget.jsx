import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Smartphone, Wallet, MessageSquare, AlertCircle, Globe2 } from 'lucide-react';
import api from '../../../services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';

const formatNumber = (value, maximumFractionDigits = 2) =>
  Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits });

const normalizeProvider = (provider) => String(provider || '').toLowerCase();

const formatAfricasTalkingBalance = (balance) => {
  if (balance === null || balance === undefined || balance === '') return 'Unavailable';
  if (typeof balance === 'number') return `KES ${formatNumber(balance)}`;

  const raw = String(balance).trim();
  const numericMatch = raw.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/);
  if (!numericMatch) return raw;

  const amount = Number(numericMatch[0].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return raw;

  const currencyMatch = raw.match(/[A-Z]{3}/i);
  const currency = currencyMatch ? currencyMatch[0].toUpperCase() : 'KES';
  return `${currency} ${formatNumber(amount)}`;
};

const SmsBalanceWidget = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTopUp, setShowTopUp] = useState(false);
  const [phone, setPhone] = useState(() => localStorage.getItem('testContactPhone') || '');
  const [amount, setAmount] = useState('100');
  const [accountNo, setAccountNo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [topUpError, setTopUpError] = useState('');
  const [topUpSuccess, setTopUpSuccess] = useState('');

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.communication.getSmsBalance();
      if (!response?.success) {
        throw new Error(response?.message || 'SMS balance is unavailable');
      }

      setSummary(response.data || null);
      setError(response?.data?.available === false ? response?.data?.reason || 'SMS balance is unavailable' : '');
    } catch (fetchError) {
      setError(fetchError?.message || 'Unable to load SMS balance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 300000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const provider = normalizeProvider(summary?.provider);
  const isAfricasTalking = provider === 'africastalking';
  const isMobileSasa = provider === 'mobilesasa';
  const currency = summary?.currency || 'KES';
  const smsBalance = Number(summary?.balance || 0);
  const displayBalance = isAfricasTalking
    ? formatAfricasTalkingBalance(summary?.balance)
    : `${formatNumber(smsBalance, 0)} SMS`;
  const providerLabel = isAfricasTalking
    ? "Africa's Talking"
    : isMobileSasa
      ? 'MobileSasa'
      : 'SMS Provider';
  const ProviderIcon = isAfricasTalking ? Globe2 : Wallet;
  const accountOptions = useMemo(() => [
    { label: 'SMS', value: summary?.localAccountNumber },
    { label: 'Wallet', value: summary?.walletAccountNumber },
  ].filter((option) => option.value), [summary]);

  useEffect(() => {
    if (!accountNo && accountOptions.length > 0) {
      setAccountNo(accountOptions[0].value);
    }
  }, [accountNo, accountOptions]);

  const handleTopUp = async (event) => {
    event.preventDefault();
    setTopUpError('');
    setTopUpSuccess('');

    const numericAmount = Number(amount);
    if (!phone.trim()) {
      setTopUpError('Enter the Safaricom phone number that should receive the M-Pesa prompt.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount < 10) {
      setTopUpError('Enter an amount of at least KES 10.');
      return;
    }
    if (!accountNo) {
      setTopUpError('Select a MobileSasa destination account.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.communication.initiateSmsTopUp({
        phone: phone.trim(),
        amount: numericAmount,
        accountNo,
      });
      setTopUpSuccess(response?.message || 'M-Pesa prompt sent successfully. Complete it on your phone.');
      window.setTimeout(fetchBalance, 15000);
    } catch (submitError) {
      setTopUpError(submitError?.message || 'Unable to initiate the M-Pesa top-up.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="hidden md:flex h-10 items-center gap-2 px-2 text-slate-600 hover:text-brand-purple hover:bg-brand-purple/5 transition-all duration-200 rounded-lg"
            aria-label="View SMS account balance"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-purple text-white shadow-sm">
              <ProviderIcon size={13} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
              {loading && !summary ? 'SMS Balance' : displayBalance}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 overflow-hidden bg-white border border-slate-100 rounded-xl shadow-lg shadow-slate-200/40" align="end">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-800 tracking-tight">{providerLabel}</h3>
              <p className="text-[10px] font-medium text-slate-400">SMS billing balance</p>
            </div>
            <button
              type="button"
              onClick={fetchBalance}
              disabled={loading}
              className="p-1 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-slate-50 transition-all duration-200 disabled:opacity-50"
              aria-label="Refresh SMS balance"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>

          {error && !summary ? (
            <div className="px-4 py-6 text-center bg-white">
              <div className="inline-flex p-1.5 rounded-full bg-rose-50 text-rose-500 mb-1.5">
                <AlertCircle size={16} />
              </div>
              <p className="text-xs font-semibold text-rose-600">Balance unavailable</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">{error}</p>
            </div>
          ) : isAfricasTalking ? (
            <div className="bg-white">
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-50 text-orange-600">
                    <Globe2 size={14} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-700">Africa's Talking Balance</span>
                    <span className="block text-[10px] font-medium text-slate-400">Current provider selected in Communication Settings</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">{displayBalance}</span>
                </div>
              </div>

              {summary?.available === false && (
                <div className="mx-4 mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] font-medium text-amber-800">
                  {summary?.reason || "Africa's Talking balance is unavailable."}
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 bg-white">
              {/* SMS Balance Row */}
              <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                    <MessageSquare size={13} />
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs font-semibold text-slate-700">SMS Balance</span>
                    {smsBalance < 200 && (
                      <span className="ml-1.5 inline-flex items-center rounded bg-amber-50 px-1 py-0.5 text-[8px] font-bold text-amber-700 border border-amber-100">
                        Low
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800">
                    {formatNumber(smsBalance, 0)} SMS
                  </span>
                </div>
              </div>

              {/* Wallet Row */}
              <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                    <Wallet size={13} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Wallet Account</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800">
                    {summary?.walletAccountNumber ? `${currency} ${formatNumber(summary.walletBalance || 0)}` : 'Not Available'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {isMobileSasa && (
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => {
                  setTopUpError('');
                  setTopUpSuccess('');
                  setShowTopUp(true);
                }}
                disabled={!summary?.localAccountNumber}
                className="h-9 w-full bg-brand-purple text-white hover:bg-brand-purple/90 transition-all duration-200 shadow-sm shadow-brand-purple/10 font-semibold text-xs rounded-lg transform active:scale-[0.98]"
              >
                Top Up Account
              </Button>
              {summary?.paymentDetails?.mpesa && (
                <div className="text-center bg-white border border-slate-100 rounded-lg p-2 text-[9px] text-slate-400 font-medium leading-relaxed shadow-sm">
                  {summary.paymentDetails.mpesa}
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={showTopUp} onOpenChange={setShowTopUp}>
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-white border border-slate-100 rounded-xl shadow-2xl">
          <DialogHeader className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-purple/10 text-brand-purple">
                <Smartphone size={14} />
              </div>
              M-Pesa Online Top Up
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleTopUp} className="p-5 space-y-4">
            {topUpSuccess ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
                <div className="inline-flex p-1.5 rounded-full bg-emerald-100 text-emerald-600 mb-2.5">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-bold text-emerald-950">{topUpSuccess}</p>
                <p className="mt-1 text-[10px] text-emerald-700 leading-relaxed max-w-[220px] mx-auto font-medium">
                  Enter your M-Pesa PIN on the phone. Refresh the balance after payment is processed.
                </p>
                <div className="mt-4 flex gap-2.5">
                  <Button type="button" variant="outline" onClick={fetchBalance} className="flex-1 h-8 text-[10px] font-semibold rounded-md">
                    Refresh
                  </Button>
                  <Button type="button" onClick={() => setShowTopUp(false)} className="flex-1 h-8 text-[10px] font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Safaricom Kenya Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="254713612141"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/5 transition-all duration-200 text-slate-800 placeholder-slate-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount (KES)</label>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/5 transition-all duration-200 text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Choose Destination Account</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {accountOptions.map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-lg border p-2.5 text-xs transition-all duration-200 flex items-center justify-center font-bold ${
                          accountNo === option.value
                            ? 'border-brand-purple bg-brand-purple/5 text-brand-purple shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="mobileSasaAccount"
                          value={option.value}
                          checked={accountNo === option.value}
                          onChange={() => setAccountNo(option.value)}
                          className="mr-1.5 h-3.5 w-3.5 accent-brand-purple"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {topUpError && (
                  <div className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2.5 text-[10px] text-rose-700 leading-relaxed font-medium">
                    {topUpError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || accountOptions.length === 0}
                  className="h-10 w-full bg-brand-purple text-white hover:bg-brand-purple/90 font-semibold text-xs rounded-lg transition-all duration-200 transform active:scale-[0.98]"
                >
                  {submitting ? <Loader2 size={14} className="mr-1.5 animate-spin text-white" /> : null}
                  {submitting ? 'Initiating M-Pesa Payment...' : `Initiate M-Pesa Payment (${currency})`}
                </Button>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SmsBalanceWidget;
