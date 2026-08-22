import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Circle, FileCheck2, Lock } from 'lucide-react';

export const MPESA_ONBOARDING_GROUPS = [
  {
    id: 'business',
    title: 'School business & KYC',
    description: 'Documents requested by Safaricom or the selected payment provider.',
    items: [
      { id: 'registration', label: 'Certificate of incorporation or school/business registration' },
      { id: 'ownership', label: 'Current CR12 and beneficial ownership/BOF1 documents, where applicable' },
      { id: 'tax_identity', label: 'School KRA PIN plus requested director/owner IDs and KRA PINs' },
      { id: 'permits', label: 'Valid county business permit and Ministry of Education registration/licence' },
      { id: 'authorization', label: 'Board resolution or stamped M-PESA authorization letter' },
      { id: 'provider_forms', label: 'Completed provider application, terms, administrator form and tariff guide' }
    ]
  },
  {
    id: 'settlement',
    title: 'PayBill & settlement',
    description: 'Funds should settle directly to the school.',
    items: [
      { id: 'school_paybill', label: 'School-owned PayBill/short code or approved provider merchant account' },
      { id: 'bank_account', label: 'Settlement bank name, branch, account name and account number' },
      { id: 'bank_proof', label: 'Certified bank letter, statement or cancelled cheque, as requested' },
      { id: 'contacts', label: 'Named M-PESA administrator, finance contact and technical contact' },
      { id: 'charges', label: 'Written decision on who pays transaction/provider charges' }
    ]
  },
  {
    id: 'finance',
    title: 'Finance rules',
    description: 'Required before accepting current or future-term payments.',
    items: [
      { id: 'calendar_fees', label: 'Academic calendar and approved current/future fee structures' },
      { id: 'allocation', label: 'Payment allocation order for debt, transport, tuition and future terms' },
      { id: 'credit_scope', label: 'Decision whether credit is learner-specific or may be family-level' },
      { id: 'refunds', label: 'Approved overpayment, transfer, withdrawal, refund and reversal policy' },
      { id: 'accounting', label: 'Receipt numbering, ledger accounts and tax/eTIMS treatment confirmed' },
      { id: 'roles', label: 'Named reconciler plus separate refund requester and approver' }
    ]
  },
  {
    id: 'data',
    title: 'Learner data readiness',
    description: 'Payments can only allocate safely against clean school records.',
    items: [
      { id: 'learner_ids', label: 'A unique admission/account identifier for every learner' },
      { id: 'guardian_links', label: 'Verified parent/guardian links and sibling/family groupings' },
      { id: 'payer_phones', label: 'Normalized payer phone numbers with appropriate consent' },
      { id: 'opening_balances', label: 'Opening balances, invoices and existing credits reconciled and signed off' },
      { id: 'unmatched_owner', label: 'A named finance owner for unmatched payment resolution' }
    ]
  },
  {
    id: 'technical',
    title: 'Provider credentials & testing',
    description: 'Secrets must be entered only in the secure credentials page.',
    items: [
      { id: 'provider_account', label: 'Approved Daraja or payment-provider production account' },
      { id: 'credentials', label: 'Consumer/application key, secret and provider-specific passkey/API key' },
      { id: 'callback', label: 'TrendSCORE callback URL registered in the provider portal' },
      { id: 'sandbox_test', label: 'Sandbox STK Push and callback test completed' },
      { id: 'production_test', label: 'Controlled production payment and receipt test reconciled' },
      { id: 'rotation', label: 'Credential owner, rotation and administrator recovery process agreed' }
    ]
  }
];

const allItems = MPESA_ONBOARDING_GROUPS.flatMap((group) => group.items);

const readSavedState = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || '{}');
  } catch {
    return {};
  }
};

export default function MpesaOnboardingChecklist({
  compact = false,
  interactive = false,
  storageKey = 'trendscore_mpesa_onboarding_checklist_v1',
  credentialReadiness = {},
  onReadinessChange,
  value,
  onChange
}) {
  const [checked, setChecked] = useState(() => value || readSavedState(interactive ? storageKey : null));

  useEffect(() => {
    if (value) setChecked(value);
  }, [value]);

  useEffect(() => {
    if (!interactive || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, interactive, storageKey]);

  const resolved = useMemo(() => ({ ...checked, ...credentialReadiness }), [checked, credentialReadiness]);
  const completed = allItems.filter((item) => resolved[item.id]).length;
  const percent = Math.round((completed / allItems.length) * 100);

  useEffect(() => {
    onReadinessChange?.({ completed, total: allItems.length, ready: completed === allItems.length });
  }, [completed, onReadinessChange]);

  const content = (
    <div className="space-y-4">
      {MPESA_ONBOARDING_GROUPS.map((group) => {
        const groupDone = group.items.filter((item) => resolved[item.id]).length;
        return (
          <section key={group.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{group.title}</h4>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{group.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">
                {groupDone}/{group.items.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {group.items.map((item) => {
                const isDone = Boolean(resolved[item.id]);
                const isCredentialDerived = Object.prototype.hasOwnProperty.call(credentialReadiness, item.id);
                return (
                  <label key={item.id} className={`flex items-start gap-2.5 text-xs leading-relaxed ${interactive && !isCredentialDerived ? 'cursor-pointer' : ''}`}>
                    {interactive && !isCredentialDerived ? (
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={(event) => {
                          const next = { ...checked, [item.id]: event.target.checked };
                          setChecked(next);
                          onChange?.(next);
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-green-600"
                      />
                    ) : isDone ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle size={16} className="mt-0.5 shrink-0 text-gray-300" />
                    )}
                    <span className={isDone ? 'text-gray-500 line-through' : 'text-gray-700'}>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-600 p-2 text-white"><FileCheck2 size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-emerald-950">M-PESA activation prerequisites</h3>
            <span className="text-xs font-semibold text-emerald-800">{completed}/{allItems.length} ready</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
            Registration can continue now, but collections should remain disabled until this checklist and a controlled production test are complete.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {compact ? (
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900">
            View the documents and decisions to prepare
            <ChevronDown size={17} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4">{content}</div>
        </details>
      ) : (
        <div className="mt-5">{content}</div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-[11px] leading-relaxed text-gray-600">
        <Lock size={15} className="mt-0.5 shrink-0 text-emerald-700" />
        Never send API secrets through email, chat or spreadsheets. Enter them only in the secure M-PESA credentials fields.
      </div>
    </div>
  );
}
