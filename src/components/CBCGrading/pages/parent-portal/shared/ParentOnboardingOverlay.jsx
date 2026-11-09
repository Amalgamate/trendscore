import React, { useState, useEffect } from 'react';
import {
  CalendarCheck, Wallet, BarChart3, Bell,
  ChevronRight, X,
} from 'lucide-react';

const STORAGE_KEY = 'trendscore:parent_onboarding_seen';

const CARDS = [
  {
    icon: CalendarCheck,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    title: 'Track Attendance',
    body: "See if your child is at school right now. Get instant SMS alerts if they're absent.",
  },
  {
    icon: Wallet,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    title: 'Pay Fees via M-Pesa',
    body: 'Check balances and pay school fees with a quick M-Pesa STK push — no forms to fill.',
  },
  {
    icon: BarChart3,
    color: 'text-[#3B1FA3]',
    bgColor: 'bg-[#3B1FA3]/10',
    title: 'Results in Real-Time',
    body: "See exam scores and term results as soon as teachers publish them — no waiting for report card day.",
  },
  {
    icon: Bell,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    title: 'SMS & WhatsApp Alerts',
    body: 'Get notified about absences, assignments, and school announcements straight to your phone.',
  },
];

export default function ParentOnboardingOverlay({ user }) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setVisible(true);
    } catch (_) {
      // localStorage not available — skip onboarding
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
    setVisible(false);
  };

  const next = () => {
    if (index < CARDS.length - 1) setIndex(i => i + 1);
    else dismiss();
  };

  if (!visible) return null;

  const card = CARDS[index];
  const Icon = card.icon;
  const isLast = index === CARDS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Skip button */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-4 right-4 z-10 text-white/80 hover:text-white text-sm font-semibold flex items-center gap-1"
      >
        Skip <X size={16} />
      </button>

      {/* Card */}
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm mx-0 sm:mx-4 p-6 pb-8 animate-in">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {CARDS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-[#3B1FA3]' : 'w-1.5 bg-gray-300'}`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className={`w-16 h-16 rounded-2xl ${card.bgColor} flex items-center justify-center mx-auto mb-5`}>
          <Icon size={28} className={card.color} />
        </div>

        {/* Content */}
        <h2 className="text-lg font-black text-gray-900 text-center mb-2">{card.title}</h2>
        <p className="text-sm text-gray-600 text-center leading-relaxed">{card.body}</p>

        {/* CTA */}
        <button
          type="button"
          onClick={next}
          className="w-full mt-6 py-3.5 bg-[#3B1FA3] text-white text-sm font-bold rounded-xl hover:bg-[#2d1680] transition-colors flex items-center justify-center gap-2"
        >
          {isLast ? 'Get Started' : 'Next'}
          {!isLast && <ChevronRight size={16} />}
        </button>

        {/* Skip link for non-last cards */}
        {!isLast && (
          <button
            type="button"
            onClick={dismiss}
            className="w-full mt-2 py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip introduction
          </button>
        )}
      </div>
    </div>
  );
}
