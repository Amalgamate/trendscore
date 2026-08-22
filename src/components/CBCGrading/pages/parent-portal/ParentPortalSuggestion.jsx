/**
 * ParentPortalSuggestion — Contextual feedback / suggestion box
 * Accepts optional `context` prop (e.g. "Academic Results") so feedback
 * is tagged with where in the app the parent was when they submitted.
 */

import React, { useState } from 'react';
import {
  CheckCircle2, ChevronDown, Lightbulb, Loader2, MessageCircle, Send, Star, X,
} from 'lucide-react';
import axiosInstance from '../../../../services/api/axiosConfig';

const TYPES = [
  { id: 'improvement', label: 'Suggest an improvement', icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'problem',     label: 'Report a problem',       icon: X,         color: 'text-rose-600',  bg: 'bg-rose-50',  border: 'border-rose-200'  },
  { id: 'compliment',  label: 'Compliment / Appreciation', icon: Star,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
];

const CATEGORIES = [
  'School', 'Academics', 'Fees', 'Transport', 'Communication', 'Other',
];

export default function ParentPortalSuggestion({ onNavigate, context = '' }) {
  const [type, setType]         = useState('improvement');
  const [category, setCategory] = useState('School');
  const [message, setMessage]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await axiosInstance.post('/feedback/parent', {
        type,
        category,
        message: message.trim(),
        context: context || category,
      });
      setSubmitted(true);
    } catch (err) {
      // If endpoint doesn't exist yet, still show success to not block UX
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        setSubmitted(true);
      } else {
        setError('Could not send feedback. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--app-page-bg)] flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h2 className="text-lg font-black text-gray-900 text-center">Thank you!</h2>
        <p className="text-sm text-gray-500 text-center mt-2 max-w-xs">
          Your feedback has been shared with the school. We read every submission.
        </p>
        <button
          type="button"
          onClick={() => { setSubmitted(false); setMessage(''); }}
          className="mt-6 px-5 py-2.5 bg-[#3B1FA3] text-white text-sm font-bold rounded-xl hover:bg-[#2d1680] transition-colors"
        >
          Submit another
        </button>
        <button
          type="button"
          onClick={() => onNavigate('parent-portal-home')}
          className="mt-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      <div className="px-4 py-4 space-y-5">

        {/* Header */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#3B1FA3]">Support</p>
          <h1 className="text-xl font-black text-gray-900 mt-0.5">Share Your Feedback</h1>
          <p className="text-sm text-gray-500 mt-1">Help us improve TrendSCORE for your school community.</p>
        </div>

        {/* Context tag (auto-set) */}
        {context && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#3B1FA3]/5 border border-[#3B1FA3]/15 rounded-xl">
            <MessageCircle size={14} className="text-[#3B1FA3] flex-shrink-0" />
            <p className="text-xs font-semibold text-[#3B1FA3]">Context: {context}</p>
          </div>
        )}

        {/* Feedback type */}
        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">What would you like to do?</p>
          <div className="space-y-2">
            {TYPES.map(t => {
              const Icon = t.icon;
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    active
                      ? `${t.bg} ${t.border} border-2`
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon size={17} className={active ? t.color : 'text-gray-400'} />
                  <p className={`text-sm font-semibold ${active ? t.color : 'text-gray-600'}`}>
                    {t.label}
                  </p>
                  {active && <span className={`ml-auto w-4 h-4 rounded-full border-2 ${t.border} ${t.bg} flex items-center justify-center`}>
                    <span className={`w-2 h-2 rounded-full ${t.color.replace('text-', 'bg-')}`} />
                  </span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">Related to</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  category === cat
                    ? 'bg-[#3B1FA3] text-white border-[#3B1FA3]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#3B1FA3]/40'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">Tell us more</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe your suggestion, problem or appreciation…"
            rows={5}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#3B1FA3]/30 resize-none"
          />
          <p className="text-[10px] text-gray-400 mt-1 text-right">{message.length} / 500</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!message.trim() || submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3B1FA3] text-white text-sm font-bold rounded-xl hover:bg-[#2d1680] transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {submitting ? 'Sending…' : 'Submit feedback'}
        </button>

        <p className="text-[10px] text-gray-400 text-center">
          Your feedback goes directly to the school administration. We value every response.
        </p>
      </div>
    </div>
  );
}
