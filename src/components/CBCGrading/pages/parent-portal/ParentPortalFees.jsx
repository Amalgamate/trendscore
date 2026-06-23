/**
 * ParentPortalFees — Family Fees Management
 *
 * Three payment modes:
 *  1. Pay One Child  — select child, pay that balance
 *  2. Pay Full Family Balance — clears all at once
 *  3. Partial Payment — enter amount then choose distribution strategy
 *
 * Real data from dashboardAPI.getParentMetrics + feeAPI.getLearnerInvoices
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Wallet, CheckCircle2, AlertTriangle,
  ChevronRight, RefreshCw, X, Users,
} from 'lucide-react';
import { dashboardAPI, feeAPI } from '../../../../services/api';

const fmt    = (n) => Number(n || 0).toLocaleString();
const fmtPct = (n) => `${Math.round(Number(n || 0))}%`;

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

// ─── Family Fee Overview ──────────────────────────────────────────────────────

function FamilyFeeHeader({ children, loading }) {
  const totalBalance = children.reduce((s, c) => s + Number(c.feeBalance || 0), 0);
  const allCleared   = totalBalance === 0 && children.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Outstanding</p>
        {loading ? (
          <Skeleton className="h-8 w-36" />
        ) : (
          <div className="flex items-end gap-2">
            <p className={`text-3xl font-bold ${allCleared ? 'text-emerald-600' : 'text-rose-600'}`}>
              KES {fmt(totalBalance)}
            </p>
            {allCleared && <CheckCircle2 size={18} className="text-emerald-500 mb-1" />}
            {!allCleared && totalBalance > 0 && <AlertTriangle size={18} className="text-amber-500 mb-1" />}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-0.5">across {children.length} child{children.length !== 1 ? 'ren' : ''}</p>
      </div>

      {!loading && children.length > 0 && (
        <div className="border-t border-gray-100">
          {children.map((child) => {
            const bal = Number(child.feeBalance || 0);
            return (
              <div key={child.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">
                    {child.name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm text-gray-800 font-medium">{child.name}</p>
                    <p className="text-[10px] text-gray-400">{child.grade}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {bal > 0 ? `KES ${fmt(bal)}` : '✓ Cleared'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, total }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i < step ? 'bg-[#3B1FA3]' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}

function StepHeader({ number, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-[#3B1FA3] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </div>
      <p className="text-sm font-bold text-[#3B1FA3]">{title}</p>
    </div>
  );
}

// ─── Step 1 — Choose payment type ────────────────────────────────────────────

function Step1ChooseType({ selected, onChange, children }) {
  const total = children.reduce((s, c) => s + Number(c.feeBalance || 0), 0);
  const modes = [
    { id: 'full',    icon: '💳', label: 'Pay Full Amount',  sub: `Pay KES ${fmt(total)}`       },
    { id: 'partial', icon: '💰', label: 'Partial Payment',  sub: 'Pay part of the total'       },
    { id: 'one',     icon: '👤', label: 'Pay One Child',    sub: 'Pay for a specific child'    },
  ];
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <StepHeader number={1} title="Choose payment type" />
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 border-t border-gray-50 transition-colors text-left ${selected === m.id ? 'bg-[#3B1FA3]/5' : 'hover:bg-gray-50'}`}
        >
          <span className="text-base">{m.icon}</span>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${selected === m.id ? 'text-[#3B1FA3]' : 'text-gray-800'}`}>{m.label}</p>
            <p className="text-[10px] text-gray-400">{m.sub}</p>
          </div>
          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected === m.id ? 'border-[#3B1FA3] bg-[#3B1FA3]' : 'border-gray-300'}`}>
            {selected === m.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Step 2 — Enter Amount ───────────────────────────────────────────────────

function Step2EnterAmount({ mode, amount, setAmount, children }) {
  if (mode === 'full') return null;
  const total = children.reduce((s, c) => s + Number(c.feeBalance || 0), 0);
  const n     = Number(amount) || 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <StepHeader number={2} title="Enter amount" />
      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Amount to Pay</p>
      <div className="flex items-center border-2 border-[#3B1FA3] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#3B1FA3]/30">
        <span className="px-3 py-3 text-sm font-bold text-gray-500 bg-gray-50 border-r border-gray-200">KES</span>
        <input
          type="number" min="1" max={total}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0"
          className="flex-1 px-3 py-3 text-xl font-bold text-gray-900 focus:outline-none"
        />
      </div>
      {n > total && <p className="text-xs text-rose-600 mt-1.5">Exceeds outstanding balance of KES {fmt(total)}</p>}
    </div>
  );
}

// ─── Step 3 — Choose distribution ────────────────────────────────────────────

function Step3Distribution({ mode, amount, strategy, setStrategy, custom, setCustom, children }) {
  if (mode === 'one') {
    const [selected, setSelected] = useState(null);
    // (Step 3 for 'one' is child selector)
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1"><StepHeader number={3} title="Select child" /></div>
        {children.map(c => {
          const bal = Number(c.feeBalance || 0);
          const isSel = selected === c.id;
          return (
            <button key={c.id} onClick={() => setSelected(isSel ? null : c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-t border-gray-50 text-left transition-colors ${isSel ? 'bg-[#3B1FA3]/5' : 'hover:bg-gray-50'}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${isSel ? 'border-[#3B1FA3] bg-[#3B1FA3]' : 'border-gray-300'}`} />
              <div className="flex-1"><p className="text-sm font-medium text-gray-800">{c.name}</p><p className="text-[10px] text-gray-400">{c.grade}</p></div>
              <span className={`text-sm font-bold ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{bal > 0 ? `KES ${fmt(bal)}` : 'Cleared'}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (mode !== 'partial') return null;
  const n        = Number(amount) || 0;
  const even     = children.length > 0 ? Math.floor(n / children.length) : 0;
  const options  = [
    { id: 'even',   label: 'Distribute Evenly',       sub: even > 0 ? `≈ KES ${fmt(even)} each` : '' },
    { id: 'oldest', label: 'Oldest Balances First',   sub: 'Clear oldest invoices first'             },
    { id: 'custom', label: 'Custom Allocation',       sub: 'Choose amount per child'                 },
  ];
  const customTotal = Object.values(custom).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1"><StepHeader number={3} title="Choose distribution" /></div>
        {options.map(o => (
          <button key={o.id} onClick={() => setStrategy(o.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 border-t border-gray-50 text-left transition-colors ${strategy === o.id ? 'bg-[#3B1FA3]/5' : 'hover:bg-gray-50'}`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${strategy === o.id ? 'border-[#3B1FA3] bg-[#3B1FA3]' : 'border-gray-300'}`}>
              {strategy === o.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </div>
            <div><p className={`text-sm font-semibold ${strategy === o.id ? 'text-[#3B1FA3]' : 'text-gray-800'}`}>{o.label}</p>
            {o.sub && <p className="text-[10px] text-gray-400">{o.sub}</p>}</div>
          </button>
        ))}
      </div>
      {strategy === 'custom' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 pt-3 pb-2">Allocate Per Child</p>
          {children.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-50">
              <span className="text-sm text-gray-700 flex-1 truncate">{c.name}</span>
              <input type="number" min="0" value={custom[c.id] ?? ''} onChange={e => setCustom(p => ({ ...p, [c.id]: e.target.value }))}
                placeholder="0" className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-[#3B1FA3]" />
            </div>
          ))}
          <div className="px-4 py-2.5 border-t border-gray-100 flex justify-between">
            <span className="text-xs text-gray-500">Allocated</span>
            <span className={`text-xs font-bold ${customTotal === n ? 'text-emerald-600' : 'text-rose-600'}`}>KES {fmt(customTotal)} / KES {fmt(n)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ParentPortalFees = ({ user, onNavigate }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [payMode, setPayMode]   = useState(null);   // null = not started
  const [amount, setAmount]     = useState('');
  const [strategy, setStrategy] = useState(null);
  const [custom, setCustom]     = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setChildren(res.data?.children || []);
      else setError(res?.message || 'Failed to load fee data');
    } catch (e) { setError(e?.message || 'Failed to load fee data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalBalance = children.reduce((s, c) => s + Number(c.feeBalance || 0), 0);

  // Determine current step for progress bar
  const step = !payMode ? 0 : payMode === 'full' ? 2 : amount ? (strategy ? 4 : 3) : 2;

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => onNavigate('parent-portal-home')} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">School Fees</h1>
            <p className="text-[10px] text-gray-500">Family fee management</p>
          </div>
          <button onClick={load} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {error && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3"><p className="text-xs text-rose-700">{error}</p></div>}

        {/* Family balance header */}
        <FamilyFeeHeader children={children} loading={loading} />

        {!loading && totalBalance > 0 && (
          <>
            {/* Section title */}
            <div>
              <h2 className="text-sm font-bold text-[#3B1FA3] mb-1">Smart Payment Flow</h2>
              <StepIndicator step={step} total={4} />
            </div>

            {/* Step 1 */}
            <Step1ChooseType
              selected={payMode}
              onChange={m => { setPayMode(m); setAmount(''); setStrategy(null); setCustom({}); }}
              children={children}
            />

            {/* Step 2 — amount (only for partial / one) */}
            {payMode && payMode !== 'full' && (
              <Step2EnterAmount mode={payMode} amount={amount} setAmount={setAmount} children={children} />
            )}

            {/* Step 3 — distribution */}
            {payMode && (payMode === 'full' || Number(amount) > 0) && (
              <Step3Distribution
                mode={payMode}
                amount={amount}
                strategy={strategy}
                setStrategy={setStrategy}
                custom={custom}
                setCustom={setCustom}
                children={children}
              />
            )}

            {/* Step 4 — Review & Pay CTA */}
            {payMode && (payMode === 'full' || (Number(amount) > 0 && strategy)) && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <StepHeader number={4} title="Review & Pay" />
                <button className="w-full py-3.5 bg-[#3B1FA3] text-white text-sm font-bold rounded-xl hover:bg-[#2d1680] transition-colors">
                  Review Payment
                </button>
              </div>
            )}
          </>
        )}

        {!loading && totalBalance === 0 && children.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-bold text-emerald-700">All fees are cleared!</p>
            <p className="text-xs text-emerald-600 mt-1">No outstanding balances for any child.</p>
          </div>
        )}

        {!loading && children.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No children linked to your account</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentPortalFees;
