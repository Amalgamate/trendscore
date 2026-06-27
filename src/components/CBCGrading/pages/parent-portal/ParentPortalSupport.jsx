/**
 * Parent Portal Support Screen
 * Parent-focused FAQ + real support ticket system backed by supportAPI
 * (createTicket / getTickets / getTicket / addMessage — same tickets a SUPER_ADMIN manages).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, HelpCircle, Mail, ChevronDown, ChevronUp, Plus, Send,
  AlertCircle, X, MessageCircle,
} from 'lucide-react';
import { supportAPI } from '../../../../services/supportApi';
import { PRODUCT_SUPPORT_EMAIL } from '../../../../config/productIdentity';

// ─── Parent FAQ content ─────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How do I check my child\'s fee balance?',
    a: 'Open the Fees tab from the home screen or bottom navigation. It shows the outstanding balance, payment progress, and a breakdown by fee category for each child.',
  },
  {
    q: 'How do I view my child\'s exam results?',
    a: 'Go to More → Results, or tap a child on the Children tab and open their profile. Results are grouped by term and learning area as soon as the school publishes them.',
  },
  {
    q: 'Why am I not receiving SMS or app notifications?',
    a: 'Check Settings → Notifications to confirm SMS and Push are switched on, and that your phone number on file is correct. If it still doesn\'t work after that, contact the school office to verify the number they have for you.',
  },
  {
    q: 'How do I update my phone number or email?',
    a: 'Go to Settings → Profile Information to edit your contact details. Changes save immediately.',
  },
  {
    q: 'How do I report my child absent?',
    a: 'Absence reporting isn\'t self-service yet — please call or message the class teacher or school office directly so attendance is recorded correctly.',
  },
  {
    q: 'How do I add another child to my account?',
    a: 'Linking a child to your parent account has to be done by the school. Contact the school office with the child\'s admission number and they\'ll link it for you.',
  },
  {
    q: 'How do I make a fee payment?',
    a: 'On the Fees tab, open an invoice and choose a payment method (e.g. M-Pesa) under Payment Methods. You\'ll get a confirmation once the payment is received.',
  },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const STATUS_STYLES = {
  OPEN: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

// ─── FAQ Accordion Item ─────────────────────────────────────────────────────

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition"
      >
        <span className="text-sm font-semibold text-gray-900">{item.q}</span>
        {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
        </div>
      )}
    </div>
  );
}

// ─── Ticket Card ────────────────────────────────────────────────────────────

function TicketCard({ ticket, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ticket)}
      className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 text-left hover:border-violet-300 transition"
    >
      <div className="p-2.5 rounded-lg bg-violet-50 text-violet-600 flex-shrink-0">
        <MessageCircle size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{ticket.subject}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {fmtDateTime(ticket.updatedAt)} · {ticket._count?.messages ?? 0} message{(ticket._count?.messages ?? 0) !== 1 ? 's' : ''}
        </p>
      </div>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[ticket.status] || 'bg-gray-100 text-gray-600'}`}>
        {(ticket.status || 'OPEN').replace('_', ' ')}
      </span>
    </button>
  );
}

// ─── Ticket Detail Modal ────────────────────────────────────────────────────

function TicketDetailModal({ ticketId, onClose, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await supportAPI.getTicket(ticketId);
      setTicket(data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await supportAPI.addMessage(ticketId, reply.trim());
      setReply('');
      await load();
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{ticket?.subject || 'Ticket'}</p>
            {ticket && (
              <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[ticket.status] || 'bg-gray-100 text-gray-600'}`}>
                {(ticket.status || 'OPEN').replace('_', ' ')}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-12 w-2/3 ml-auto" />
            </>
          ) : error ? (
            <p className="text-xs text-rose-600">{error}</p>
          ) : (
            (ticket?.messages || []).map((m) => (
              <div key={m.id} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] font-bold text-gray-500 mb-1">
                  {m.sender?.firstName ? `${m.sender.firstName} ${m.sender.lastName || ''}`.trim() : 'You'}
                </p>
                <p className="text-sm text-gray-800">{m.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{fmtDateTime(m.createdAt)}</p>
              </div>
            ))
          )}
          {!loading && (ticket?.messages || []).length === 0 && !error && (
            <p className="text-xs text-gray-400 text-center py-6">No messages yet</p>
          )}
        </div>

        {/* Reply box */}
        {ticket?.status !== 'CLOSED' && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type a reply…"
              className="flex-1 bg-gray-100 rounded-xl px-3 h-10 text-sm outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }}
            />
            <button
              type="button"
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              className="w-10 h-10 rounded-xl bg-brand-purple text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Ticket Modal ───────────────────────────────────────────────────────

function NewTicketModal({ onClose, onCreated }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both a subject and a message.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await supportAPI.createTicket({ subject: subject.trim(), message: message.trim(), priority });
      onCreated();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">New Support Ticket</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Unable to make M-Pesa payment"
              className="w-full bg-gray-100 rounded-xl px-3 h-10 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue in detail…"
              rows={4}
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${
                    priority === p.value ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full mt-1 px-4 py-3 bg-brand-purple text-white font-semibold rounded-xl hover:bg-purple-700 transition text-sm disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentPortalSupport = ({ onNavigate }) => {
  const [tab, setTab] = useState('faq'); // 'faq' | 'tickets'
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState(null);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const data = await supportAPI.getTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      setTicketsError(e?.response?.data?.message || 'Failed to load your tickets');
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'tickets') loadTickets();
  }, [tab, loadTickets]);

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onNavigate('parent-portal-more')}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">Support</h1>
            <p className="text-[10px] text-gray-500">Help center & tickets</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('faq')}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${
              tab === 'faq' ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            FAQs
          </button>
          <button
            type="button"
            onClick={() => setTab('tickets')}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${
              tab === 'tickets' ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            My Tickets
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-2.5">
        {tab === 'faq' ? (
          <>
            {FAQS.map((item, i) => (
              <FaqItem
                key={i}
                item={item}
                isOpen={openFaqIndex === i}
                onToggle={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
              />
            ))}

            {/* Still need help */}
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle size={16} className="text-violet-700" />
                <p className="text-sm font-bold text-violet-900">Still need help?</p>
              </div>
              <p className="text-xs text-violet-700/80 mb-3">
                Raise a support ticket and our team will get back to you, or email us directly.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTicket(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-purple text-white text-xs font-semibold rounded-xl"
                >
                  <Plus size={14} /> New Ticket
                </button>
                <a
                  href={`mailto:${PRODUCT_SUPPORT_EMAIL}`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-violet-200 text-violet-700 text-xs font-semibold rounded-xl"
                >
                  <Mail size={14} /> Email Us
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowNewTicket(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-3 bg-brand-purple text-white text-sm font-semibold rounded-xl mb-2"
            >
              <Plus size={15} /> New Ticket
            </button>

            {ticketsError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
                <p className="text-xs text-rose-700 flex-1">{ticketsError}</p>
                <button type="button" onClick={loadTickets} className="text-[10px] text-rose-600 font-bold underline">Retry</button>
              </div>
            )}

            {ticketsLoading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : tickets.length > 0 ? (
              tickets.map((t) => (
                <TicketCard key={t.id} ticket={t} onOpen={(ticket) => setActiveTicketId(ticket.id)} />
              ))
            ) : !ticketsError && (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
                <MessageCircle size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-semibold text-gray-700 mb-1">No tickets yet</p>
                <p className="text-xs text-gray-400">Raise a ticket above and we'll respond here.</p>
              </div>
            )}
          </>
        )}
      </div>

      {showNewTicket && (
        <NewTicketModal
          onClose={() => setShowNewTicket(false)}
          onCreated={() => {
            setShowNewTicket(false);
            setTab('tickets');
            loadTickets();
          }}
        />
      )}

      {activeTicketId && (
        <TicketDetailModal
          ticketId={activeTicketId}
          onClose={() => setActiveTicketId(null)}
          onChanged={loadTickets}
        />
      )}

    </div>
  );
};

export default ParentPortalSupport;
