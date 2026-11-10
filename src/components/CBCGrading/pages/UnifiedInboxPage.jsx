import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArrowLeft, BellOff, CheckCheck, Forward, Gift, Inbox, Loader2,
  Mail, MessageCircle, MoreHorizontal, Paperclip, Pin, Plus, Reply, RotateCcw,
  Search, Send, SlidersHorizontal, Star, Trash2, User, X,
} from 'lucide-react';
import { chatAPI } from '../../../services/api/chat.api';
import api, { communicationAPI } from '../../../services/api';
import { useChat } from '../../../contexts/ChatContext';

// ═══════════════════════════════════════════════════════════════════════════════
// FOLDERS / FILTERS
// ═══════════════════════════════════════════════════════════════════════════════
const FILTERS = [
  { id: 'all',           label: 'All messages',    icon: Inbox,          color: 'text-blue-800',    selected: 'bg-blue-50 text-blue-950' },
  { id: 'unread',        label: 'Unread',          icon: Mail,           color: 'text-indigo-700',  selected: 'bg-indigo-50 text-indigo-950' },
  { id: 'starred',       label: 'Starred',         icon: Star,           color: 'text-amber-700',   selected: 'bg-amber-50 text-amber-950' },
  { id: 'in_app',        label: 'In-app chat',     icon: MessageCircle,  color: 'text-violet-700',  selected: 'bg-violet-50 text-violet-950' },
  { id: 'sms',           label: 'SMS',             icon: Mail,           color: 'text-teal-700',    selected: 'bg-teal-50 text-teal-950' },
  { id: 'whatsapp',      label: 'WhatsApp',        icon: MessageCircle,  color: 'text-emerald-700', selected: 'bg-emerald-50 text-emerald-950' },
  { id: 'email',         label: 'Email',           icon: Mail,           color: 'text-orange-700',  selected: 'bg-orange-50 text-orange-950' },
  { id: 'announcements', label: 'Announcements',   icon: BellOff,        color: 'text-sky-700',     selected: 'bg-sky-50 text-sky-950' },
  { id: 'birthdays',     label: 'Birthdays',       icon: Gift,           color: 'text-pink-700',    selected: 'bg-pink-50 text-pink-950' },
  { id: 'attachments',   label: 'Has attachments',  icon: Paperclip,      color: 'text-purple-700',  selected: 'bg-purple-50 text-purple-950' },
  { id: 'outbox',        label: 'Outbox',          icon: Send,           color: 'text-blue-700',    selected: 'bg-blue-50 text-blue-950' },
  { id: 'archived',      label: 'Archived',        icon: Archive,        color: 'text-slate-600',   selected: 'bg-slate-100 text-slate-950' },
];

const MESSAGE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT']);
const BROADCAST_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']);

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE MESSAGES (dev-only scaffolding — gated behind import.meta.env.DEV)
// ═══════════════════════════════════════════════════════════════════════════════
const SAMPLE_MESSAGES = [
  { id: 'sample-in-app', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · In-app chat', subtitle: 'Class teacher', channel: 'IN_APP', status: 'Sample', category: 'message',
    preview: 'The class revision notes are ready to view.',
    body: 'Hello families, the class revision notes are ready to view in the Digital Diary. Please ask your learner to review pages 12–15 before Friday.',
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), unreadCount: 0, archivable: false, hasAttachment: true, attachmentName: 'revision-notes.pdf' },
  { id: 'sample-sms', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · SMS', subtitle: 'Grade 5', channel: 'SMS', status: 'Sample', category: 'message',
    preview: 'Reminder: school closes at 3:30 pm today.',
    body: 'ZAWADI ACADEMY: Reminder that school closes at 3:30 pm today. Please arrange collection on time.',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), unreadCount: 0, archivable: false },
  { id: 'sample-whatsapp', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · WhatsApp', subtitle: 'Grade 3', channel: 'WHATSAPP', status: 'Sample', category: 'message',
    preview: 'A reminder from the school office.',
    body: 'Good afternoon. Please remember to send your child with a labelled water bottle for tomorrow\u2019s sports activity. Thank you.',
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(), unreadCount: 0, archivable: false },
  { id: 'sample-email', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · Email', subtitle: 'School office', channel: 'EMAIL', status: 'Sample', category: 'message',
    preview: 'Term dates and parent meeting information.',
    body: 'Dear parent, the term dates and parent meeting schedule are available from the school office. This is a sample email preview only.',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), unreadCount: 0, archivable: false, hasAttachment: true, attachmentName: 'term-dates.pdf' },
  { id: 'sample-announcement', kind: 'announcement', source: 'sample', sampleOnly: true,
    name: 'Sample · Announcement', subtitle: 'School notice', channel: 'IN_APP', status: 'Sample',
    preview: 'The inter-house games will take place next Thursday.',
    body: 'The inter-house games will take place next Thursday. Learners should come in their house colours and bring a packed lunch.',
    timestamp: new Date(Date.now() - 4 * 86400000).toISOString(), unreadCount: 0, archivable: false },
  { id: 'sample-birthday', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · Birthday wishes', subtitle: 'Grade 2', channel: 'WHATSAPP', status: 'Sample', category: 'birthday',
    preview: 'Happy birthday, Amani!',
    body: 'Happy birthday, Amani! The TrendSCORE school community wishes you a joyful day and a wonderful year ahead.',
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), unreadCount: 0, archivable: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const roleLabel = (role = '') => String(role).toLowerCase().replaceAll('_', ' ');
const initials = (value = '') => value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'S';
const timeLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffH = diffMs / 3_600_000;
  if (diffH < 24 && now.getDate() === date.getDate()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffH < 48) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
const fullDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function getRecipientHint(role) {
  switch (String(role || '').toUpperCase()) {
    case 'PARENT': return "Choose your child's teacher or a school office contact.";
    case 'TEACHER': return 'Contact a parent in your assigned classes or a colleague.';
    case 'STUDENT': return 'Contact an assigned teacher, your parent, or the school office.';
    case 'ADMIN':
    case 'HEAD_TEACHER':
    case 'DEPUTY_HEAD_TEACHER': return 'Start a private conversation with a school user.';
    default: return 'Start a private conversation with an approved school contact.';
  }
}

// ── Audience / category tag derivation ──────────────────────────────────────
const GRADE_RE = /\b(?:grade|gr|std|class)\s*([0-9]+)\b/i;

function deriveTags(item) {
  const tags = [];
  const subtitle = String(item.subtitle || '');
  const kind = item.kind;
  const channel = String(item.channel || '').toUpperCase();
  const category = String(item.category || '').toUpperCase();

  if (kind === 'announcement') {
    tags.push({ label: 'School-wide', tone: 'sky' });
  } else if (kind === 'broadcast') {
    tags.push({ label: 'Parents', tone: 'amber' });
  } else if (category === 'BIRTHDAY') {
    tags.push({ label: 'Birthday', tone: 'pink' });
  } else {
    const gradeMatch = subtitle.match(GRADE_RE);
    if (gradeMatch) {
      tags.push({ label: `Grade ${gradeMatch[1]}`, tone: 'indigo' });
    } else {
      const sub = subtitle.toLowerCase();
      if (sub.includes('parent')) tags.push({ label: 'Parents', tone: 'amber' });
      else if (sub.includes('teacher') || sub.includes('staff')) tags.push({ label: 'Teachers', tone: 'violet' });
      else if (sub.includes('student') || sub.includes('learner')) tags.push({ label: 'Students', tone: 'teal' });
      else if (subtitle) tags.push({ label: subtitle.split(/\s+/).slice(0, 2).join(' '), tone: 'slate' });
    }
  }

  if (channel && channel !== 'IN_APP') {
    tags.push({ label: channel, tone: 'slate' });
  } else if (kind === 'conversation') {
    tags.push({ label: 'Chat', tone: 'slate' });
  }

  return tags.slice(0, 3);
}

const TAG_TONES = {
  sky:    'bg-sky-100 text-sky-800',
  amber:  'bg-amber-100 text-amber-800',
  pink:   'bg-pink-100 text-pink-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  violet: 'bg-violet-100 text-violet-800',
  teal:   'bg-teal-100 text-teal-800',
  purple: 'bg-purple-100 text-purple-800',
  slate:  'bg-slate-100 text-slate-600',
};

// ── Local-starred persistence (localStorage) ────────────────────────────────
// The backend doesn't have a star endpoint yet, so we persist starred IDs
// locally. When the API adds star support, swap this for a real call.
const STAR_KEY = 'trendscore.inbox.starred';
const loadStarred = () => { try { return new Set(JSON.parse(localStorage.getItem(STAR_KEY) || '[]')); } catch { return new Set(); } };
const saveStarred = (set) => { try { localStorage.setItem(STAR_KEY, JSON.stringify([...set])); } catch { /* noop */ } };

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION ROW
// ═══════════════════════════════════════════════════════════════════════════════
function ConversationRow({ item, active, starred, onClick, onToggleStar }) {
  const unread = Number(item.unreadCount || 0) > 0;
  const isBirthday = item.category === 'birthday';
  const isFailed = ['FAILED', 'BOUNCED'].includes(String(item.status || '').toUpperCase());
  const tags = deriveTags(item);
  const hasAttachment = Boolean(item.hasAttachment || item.attachmentName);

  return (
    <div
      onClick={onClick}
      className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${active ? (isBirthday ? 'bg-pink-50 ring-1 ring-pink-200' : 'bg-blue-50 ring-1 ring-blue-200') : 'bg-white hover:bg-slate-50 ring-1 ring-transparent'}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${isBirthday ? 'bg-pink-100 text-pink-800' : item.kind === 'announcement' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-900'}`}>
        {isBirthday ? <Gift size={16} /> : item.kind === 'announcement' ? <Mail size={15} /> : initials(item.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1 truncate text-[13px] leading-tight ${unread ? 'font-extrabold text-slate-950' : 'font-bold text-slate-800'}`}>
            {item.pinned && <Pin size={10} className="shrink-0 text-blue-700" />}
            <span className="truncate">{item.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {hasAttachment && <Paperclip size={10} className="text-slate-400" />}
            <span className="text-[10px] text-slate-500">{timeLabel(item.timestamp)}</span>
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-tight text-slate-600">
          {item.preview || (item.kind === 'announcement' ? 'School announcement' : 'Start the conversation')}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          {tags.map((tag, i) => (
            <span key={i} className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${TAG_TONES[tag.tone] || TAG_TONES.slate}`}>{tag.label}</span>
          ))}
          {isFailed && <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-red-700">{item.status}</span>}
          {item.sampleOnly && <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-blue-700">Sample</span>}
        </span>
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
        className={`shrink-0 rounded-lg p-1.5 transition ${starred ? 'text-amber-500 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}
        aria-label={starred ? 'Remove star' : 'Add star'}
      >
        <Star size={14} fill={starred ? 'currentColor' : 'none'} />
      </button>
      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-700" aria-label="Unread" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════
function EmptyInbox({ archived, onCompose }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-800"><Inbox size={23} /></span>
      <h2 className="text-base font-extrabold text-slate-900">{archived ? 'No archived conversations' : 'Your inbox is clear'}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{archived ? 'Archived conversations will appear here.' : 'School messages and announcements will appear here.'}</p>
      {!archived && <button type="button" onClick={onCompose} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800"><Plus size={16} />Write a message</button>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function DeleteConfirmModal({ item, onCancel, onConfirm }) {
  if (!item) return null;
  const isConversation = item.kind === 'conversation';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700"><Trash2 size={17} /></span>
          <h3 className="text-base font-extrabold text-slate-950">Delete message</h3>
        </div>
        <p className="text-sm text-slate-600">
          {isConversation
            ? 'Choose how to delete this conversation. "Delete for me" removes it from your inbox only. "Delete for everyone" removes it for all participants.'
            : 'This message will be permanently removed from your inbox.'}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {isConversation && (
            <button
              type="button"
              onClick={() => onConfirm('everyone')}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              <Trash2 size={15} /> Delete for everyone
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm('me')}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <User size={15} /> Delete for me only
          </button>
          <button type="button" onClick={onCancel} className="mt-1 text-xs font-bold text-slate-500 hover:underline">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORWARD MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ForwardModal({ item, onCancel, onSend }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const value = query.trim();
    const s = ++seq.current;
    if (value.length < 2 || selected) { setResults([]); setSearching(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await chatAPI.searchUsers(value);
        if (s === seq.current) setResults(response?.data || []);
      } catch { if (s === seq.current) setResults([]); }
      finally { if (s === seq.current) setSearching(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Forward size={17} className="text-blue-700" />
            <h3 className="text-sm font-extrabold text-slate-950">Forward message</h3>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="p-4">
          <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Original from {item.name}</p>
            <p className="mt-1 line-clamp-3 text-xs text-slate-700">{item.preview || item.body}</p>
          </div>
          <label className="text-xs font-bold text-slate-800">Forward to</label>
          <div className="relative mt-1.5">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={selected ? `${selected.firstName} ${selected.lastName}` : query}
              onChange={e => { setSelected(null); setQuery(e.target.value); }}
              placeholder="Search for a contact…"
              className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-9 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />
            {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-700" />}
            {selected && <button type="button" onClick={() => { setSelected(null); setQuery(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"><X size={14} /></button>}
          </div>
          {!selected && results.length > 0 && (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200">
              {results.map(contact => (
                <button key={contact.id} type="button" onClick={() => { setSelected(contact); setResults([]); }} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[10px] font-extrabold text-blue-900">{initials(`${contact.firstName} ${contact.lastName}`)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{contact.firstName} {contact.lastName}</span><span className="block text-[11px] capitalize text-slate-600">{roleLabel(contact.role)}</span></span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <label className="mt-3 block text-xs font-bold text-slate-800">Add a note (optional)
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Add context for the recipient…" className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
            </label>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" disabled={!selected} onClick={() => onSend(selected, note)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-40">
              <Send size={14} /> Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED FILTER PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AdvancedFilterPanel({ open, onClose, filters, onApply }) {
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || '');
  const [dateTo, setDateTo] = useState(filters.dateTo || '');
  const [hasAttachment, setHasAttachment] = useState(filters.hasAttachment || false);
  const [channel, setChannel] = useState(filters.channel || 'all');
  const [sortBy, setSortBy] = useState(filters.sortBy || 'date_desc');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={17} className="text-blue-700" />
            <h3 className="text-sm font-extrabold text-slate-950">More filters</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-bold text-slate-800">Date range</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-blue-700" />
              <span className="text-slate-400">–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-blue-700" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-800">Channel</label>
            <select value={channel} onChange={e => setChannel(e.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-blue-700">
              <option value="all">All channels</option>
              <option value="IN_APP">In-app chat</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-800">Sort by</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-blue-700">
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="unread_first">Unread first</option>
              <option value="starred_first">Starred first</option>
              <option value="pinned_first">Pinned first</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={hasAttachment} onChange={e => setHasAttachment(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-100" />
            Has attachments only
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setHasAttachment(false); setChannel('all'); setSortBy('date_desc'); }} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:underline">Reset all</button>
          <button type="button" onClick={() => { onApply({ dateFrom, dateTo, hasAttachment, channel, sortBy }); onClose(); }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">Apply filters</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSE FORM (with CC / BCC / Reply / Forward support)
// ═══════════════════════════════════════════════════════════════════════════════
function ComposeForm({ user, onNavigate, onBack, prefill }) {
  const [query, setQuery] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(prefill?.recipient || null);
  const [ccQuery, setCcQuery] = useState('');
  const [ccResults, setCcResults] = useState([]);
  const [ccRecipient, setCcRecipient] = useState(null);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [bccQuery, setBccQuery] = useState('');
  const [bccResults, setBccResults] = useState([]);
  const [bccRecipient, setBccRecipient] = useState(null);
  const [subject, setSubject] = useState(prefill?.subject || '');
  const [body, setBody] = useState(prefill?.body || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [composeChannel, setComposeChannel] = useState(null);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  const searchUsers = useCallback(async (value, setResults, setSearchingState) => {
    const s = ++seq.current;
    if (value.length < 2) { setResults([]); setSearchingState(false); return; }
    setSearchingState(true);
    try {
      const response = await chatAPI.searchUsers(value);
      if (s === seq.current) setResults(response?.data || []);
    } catch { if (s === seq.current) setResults([]); }
    finally { if (s === seq.current) setSearchingState(false); }
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || selectedRecipient) { setRecipients([]); setSearching(false); return; }
    const timer = setTimeout(() => searchUsers(value, setRecipients, setSearching), 250);
    return () => clearTimeout(timer);
  }, [query, selectedRecipient, searchUsers]);

  useEffect(() => {
    const value = ccQuery.trim();
    if (value.length < 2 || ccRecipient) { setCcResults([]); return; }
    const timer = setTimeout(() => searchUsers(value, setCcResults, setSearching), 250);
    return () => clearTimeout(timer);
  }, [ccQuery, ccRecipient, searchUsers]);

  useEffect(() => {
    const value = bccQuery.trim();
    if (value.length < 2 || bccRecipient) { setBccResults([]); return; }
    const timer = setTimeout(() => searchUsers(value, setBccResults, setSearching), 250);
    return () => clearTimeout(timer);
  }, [bccQuery, bccRecipient, searchUsers]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedRecipient || !body.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const conversation = await chatAPI.startDirect(selectedRecipient.id);
      const id = conversation?.data?.id;
      if (!id) throw new Error('Conversation was not created');
      await chatAPI.sendMessage(id, body.trim());
      onBack();
    } catch (err) {
      setError(err?.message || 'Could not send this message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const chooseComposeChannel = (channel) => {
    if (channel === 'SMS' || channel === 'WHATSAPP') {
      window.sessionStorage.setItem('trendscore.broadcast.channel', channel.toLowerCase());
      onNavigate?.('comm-broadcasts');
      return;
    }
    setComposeChannel(channel);
  };

  if (!composeChannel) {
    return (
      <section className="flex min-h-0 flex-1 flex-col bg-white">
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <button type="button" onClick={onBack} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Back to inbox"><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold text-slate-950">New message</h2><p className="text-xs text-slate-600">Choose how to reach your audience.</p></div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Choose a channel</p>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            <button type="button" onClick={() => chooseComposeChannel('IN_APP')} className="flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-blue-50">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-800"><MessageCircle size={20} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900">In-app conversation</span><span className="block text-xs text-slate-600">Start a private chat with an approved school contact.</span></span>
              <span className="text-sm font-bold text-blue-800">Choose</span>
            </button>
            {BROADCAST_ROLES.has(String(user?.role || '').toUpperCase()) && <>
              <button type="button" onClick={() => chooseComposeChannel('SMS')} className="flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-teal-50">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-800"><Mail size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900">SMS</span><span className="block text-xs text-slate-600">Choose parents, grades, a contact list, or a CSV file.</span></span>
                <span className="text-sm font-bold text-teal-800">Choose</span>
              </button>
              <button type="button" onClick={() => chooseComposeChannel('WHATSAPP')} className="flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-emerald-50">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800"><MessageCircle size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900">WhatsApp</span><span className="block text-xs text-slate-600">Choose parents, grades, a contact list, or a CSV file.</span></span>
                <span className="text-sm font-bold text-emerald-800">Choose</span>
              </button>
            </>}
          </div>
        </div>
      </section>
    );
  }

  const renderRecipientPicker = (label, value, onChange, results, selected, onSelect, onClear, placeholder) => (
    <div>
      <label className="text-xs font-bold text-slate-800">{label}</label>
      <div className="relative mt-1.5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={selected ? `${selected.firstName} ${selected.lastName}` : value}
          onChange={e => { onSelect(null); onChange(e.target.value); }}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-9 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
        />
        {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-700" />}
        {selected && <button type="button" onClick={() => { onClear(); onChange(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"><X size={14} /></button>}
      </div>
      {!selected && results.length > 0 && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200">
          {results.map(contact => (
            <button key={contact.id} type="button" onClick={() => { onSelect(contact); }} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[10px] font-extrabold text-blue-900">{initials(`${contact.firstName} ${contact.lastName}`)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{contact.firstName} {contact.lastName}</span><span className="block text-[11px] capitalize text-slate-600">{roleLabel(contact.role)}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <button type="button" onClick={() => setComposeChannel(null)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Back"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold text-slate-950">{prefill?.forward ? 'Forward message' : prefill?.reply ? 'Reply' : 'New message'}</h2><p className="text-xs text-slate-600">{getRecipientHint(user?.role)}</p></div>
      </header>
      <form onSubmit={handleSend} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {renderRecipientPicker('To', query, setQuery, recipients, selectedRecipient, setSelectedRecipient, () => setSelectedRecipient(null), 'Find an approved contact')}

        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setShowCc(!showCc)} className={`font-bold ${showCc ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Cc</button>
          <button type="button" onClick={() => setShowBcc(!showBcc)} className={`font-bold ${showBcc ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Bcc</button>
        </div>
        {showCc && renderRecipientPicker('Cc', ccQuery, setCcQuery, ccResults, ccRecipient, setCcRecipient, () => setCcRecipient(null), 'Cc recipient (optional)')}
        {showBcc && renderRecipientPicker('Bcc', bccQuery, setBccQuery, bccResults, bccRecipient, setBccRecipient, () => setBccRecipient(null), 'Bcc recipient (optional)')}

        <label className="block text-xs font-bold text-slate-800">Subject (optional)
          <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} placeholder="Add a subject…" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </label>

        <label className="flex min-h-0 flex-1 flex-col text-xs font-bold text-slate-800">Message
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={4000} placeholder="What would you like to discuss?" className="mt-1.5 min-h-32 flex-1 rounded-lg border border-slate-300 p-3 text-sm font-normal text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </label>

        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1">
            <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Attach file"><Paperclip size={16} /></button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={!selectedRecipient || !body.trim() || sending} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-40">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// THREAD / DETAIL PANE
// ═══════════════════════════════════════════════════════════════════════════════
function ThreadPane({ selected, user, messages, detailLoading, onBack, onUpdate, onReply, onForward, onDelete, onToggleStar, starred, error }) {
  const [showActions, setShowActions] = useState(false);
  if (!selected) return null;

  const isConversation = selected.kind === 'conversation';
  const isAnnouncement = selected.kind === 'announcement';
  const isDelivery = selected.kind === 'delivery' || selected.kind === 'broadcast';
  const isFailed = ['FAILED', 'BOUNCED'].includes(String(selected.status || '').toUpperCase());
  const tags = deriveTags(selected);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white md:flex" aria-label="Conversation">
      {/* ── Thread Header ── */}
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <button type="button" onClick={onBack} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Back to inbox"><ArrowLeft size={18} /></button>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isAnnouncement ? 'bg-blue-700 text-white' : 'bg-blue-100 font-extrabold text-blue-900'}`}>
          {isAnnouncement ? <Mail size={18} /> : initials(selected.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-slate-950">{selected.name}</h2>
          <p className="truncate text-xs capitalize text-slate-600">
            {isAnnouncement ? 'School announcement' : isDelivery ? `${selected.channel} · ${selected.status}` : roleLabel(selected.subtitle)}
          </p>
          {tags.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {tags.map((tag, i) => <span key={i} className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${TAG_TONES[tag.tone] || TAG_TONES.slate}`}>{tag.label}</span>)}
            </div>
          )}
        </div>

        {/* ── Action Toolbar ── */}
        <div className="flex items-center gap-0.5">
          {/* Star */}
          <button type="button" onClick={onToggleStar} title={starred ? 'Remove star' : 'Star'} className={`rounded-lg p-2 hover:bg-slate-100 ${starred ? 'text-amber-500' : 'text-slate-500'}`}>
            <Star size={16} fill={starred ? 'currentColor' : 'none'} />
          </button>

          {/* Reply (conversations only) */}
          {isConversation && (
            <button type="button" onClick={onReply} title="Reply" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Reply size={16} />
            </button>
          )}

          {/* Forward */}
          <button type="button" onClick={onForward} title="Forward" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <Forward size={16} />
          </button>

          {/* Pin (conversations only) */}
          {isConversation && (
            <button type="button" onClick={() => onUpdate({ pinned: !selected.pinned })} title={selected.pinned ? 'Unpin' : 'Pin'} className={`rounded-lg p-2 hover:bg-slate-100 ${selected.pinned ? 'text-blue-800' : 'text-slate-500'}`}>
              <Pin size={16} />
            </button>
          )}

          {/* More actions dropdown */}
          <div className="relative">
            <button type="button" onClick={() => setShowActions(!showActions)} title="More actions" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <MoreHorizontal size={16} />
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {isConversation && (
                    <button type="button" onClick={() => { onUpdate({ markUnread: true }); setShowActions(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Mail size={14} className="text-slate-500" /> Mark as unread
                    </button>
                  )}
                  {isConversation && (
                    <button type="button" onClick={() => { onUpdate({ mutedUntil: selected.mutedUntil && new Date(selected.mutedUntil) > new Date() ? null : new Date(Date.now() + 30 * 86400000).toISOString() }); setShowActions(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <BellOff size={14} className="text-slate-500" /> {selected.mutedUntil && new Date(selected.mutedUntil) > new Date() ? 'Unmute' : 'Mute 30 days'}
                    </button>
                  )}
                  {['conversation', 'announcement'].includes(selected.kind) && selected.archivable !== false && (
                    <button type="button" onClick={() => { onUpdate({ archived: !selected.archivedAt }); setShowActions(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">
                      {selected.archivedAt ? <><RotateCcw size={14} className="text-slate-500" /> Restore to inbox</> : <><Archive size={14} className="text-slate-500" /> Archive</>}
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-100" />
                  <button type="button" onClick={() => { onDelete(); setShowActions(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-red-700 hover:bg-red-50">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Thread Body ── */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
        {error && <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{error}</div>}

        {isAnnouncement ? (
          <article className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-800">School announcement</p>
              <span className="text-[11px] text-slate-500">{fullDate(selected.timestamp)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.body}</p>
            {selected.raw?.targetAudience && <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">Audience: {selected.raw.targetAudience}</p>}
          </article>
        ) : isDelivery ? (
          <article className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">{selected.channel}</span>
              <span className={`rounded-full px-3 py-1.5 ${selected.sampleOnly ? 'bg-blue-50 text-blue-800' : isFailed ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{selected.status}</span>
              {selected.category === 'birthday' && <span className="rounded-full bg-pink-100 px-3 py-1.5 text-pink-800">Birthday wishes</span>}
            </div>
            {selected.sampleOnly && <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">Sample preview only. This message was not sent or saved.</p>}
            {selected.kind === 'broadcast' && <p className="text-sm text-slate-600">{selected.subtitle}</p>}
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.body || 'Message content is not available.'}</p>
            {selected.hasAttachment && selected.attachmentName && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Paperclip size={15} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-700">{selected.attachmentName}</span>
                <button type="button" className="ml-auto text-xs font-bold text-blue-700 hover:underline">Download</button>
              </div>
            )}
            {selected.raw?.failureReason && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Delivery detail: {selected.raw.failureReason}</p>}
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">Sent {fullDate(selected.timestamp)}{selected.subtitle ? ` · ${selected.subtitle}` : ''}</p>
          </article>
        ) : detailLoading ? (
          <div className="flex justify-center py-10 text-blue-700"><Loader2 className="animate-spin" /></div>
        ) : messages.length ? messages.map(message => (
          <div key={message.id} className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-5 ${message.senderId === user?.id ? 'rounded-br-sm bg-blue-800 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-900'}`}>
              <p className="whitespace-pre-wrap">{message.body || (message.attachmentName ? `Attachment: ${message.attachmentName}` : '')}</p>
              {message.attachmentName && (
                <div className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${message.senderId === user?.id ? 'bg-blue-900/30' : 'bg-slate-50'}`}>
                  <Paperclip size={12} />
                  <span className="font-bold">{message.attachmentName}</span>
                </div>
              )}
              <p className={`mt-1 text-[10px] ${message.senderId === user?.id ? 'text-blue-100' : 'text-slate-500'}`}>{timeLabel(message.createdAt)}</p>
            </div>
          </div>
        )) : <div className="py-12 text-center text-sm text-slate-600">Start the conversation below.</div>}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function UnifiedInboxPage({ user, onNavigate }) {
  const { conversations, fetchInbox, openConversation, sendMessage, messagesByConv } = useChat();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [sentChatItems, setSentChatItems] = useState([]);
  const [archiveConversations, setArchiveConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('list'); // list | thread | compose
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [composePrefill, setComposePrefill] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [samplePreviewEnabled, setSamplePreviewEnabled] = useState(false);
  const [samplePreviewDismissed, setSamplePreviewDismissed] = useState(false);
  const [starredIds, setStarredIds] = useState(loadStarred);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ dateFrom: '', dateTo: '', hasAttachment: false, channel: 'all', sortBy: 'date_desc' });

  // ── Data loading (same as original) ──────────────────────────────────────────
  const loadAnnouncements = useCallback(async (includeArchived = false) => {
    const [inboxResult, noticeResult] = await Promise.allSettled([
      communicationAPI.getInboxMessages(includeArchived),
      api.notices.getAll(),
    ]);
    if (inboxResult.status === 'rejected') throw inboxResult.reason;
    const response = inboxResult.value;
    const noticeResponse = noticeResult.status === 'fulfilled' ? noticeResult.value : null;
    const rows = response?.data || [];
    const receiptItems = rows.map(receipt => {
      const channel = String(receipt.message?.messageType || 'IN_APP').toUpperCase();
      return {
        id: receipt.id,
        kind: channel === 'IN_APP' ? 'announcement' : 'delivery',
        source: 'receipt',
        archivable: true,
        name: receipt.message?.subject || 'School announcement',
        subtitle: 'School',
        preview: receipt.message?.body || '',
        body: receipt.message?.body || '',
        channel,
        status: receipt.status || 'SENT',
        timestamp: receipt.createdAt || receipt.message?.createdAt,
        unreadCount: !receipt.readAt && receipt.status !== 'READ' ? 1 : 0,
        archivedAt: receipt.archivedAt,
        hasAttachment: Boolean(receipt.message?.attachments?.length),
        attachmentName: receipt.message?.attachments?.[0]?.filename,
        raw: receipt,
      };
    });
    const now = Date.now();
    const noticeItems = (noticeResponse?.data || [])
      .filter(notice => String(notice.status || 'PUBLISHED').toUpperCase() === 'PUBLISHED'
        && !notice.archived
        && (!notice.publishedAt || new Date(notice.publishedAt).getTime() <= now)
        && (!notice.expiresAt || new Date(notice.expiresAt).getTime() > now))
      .map(notice => ({
        id: `notice-${notice.id}`,
        kind: 'announcement',
        source: 'notice',
        archivable: false,
        name: notice.title || 'School announcement',
        subtitle: notice.category || 'School',
        preview: notice.content || '',
        body: notice.content || '',
        channel: 'IN_APP',
        status: notice.status || 'PUBLISHED',
        timestamp: notice.publishedAt || notice.createdAt,
        unreadCount: 0,
        raw: notice,
      }));
    const seenNoticeContent = new Set(receiptItems.filter(item => item.kind === 'announcement').map(item => `${item.name}|${item.body}`));
    setReceipts([
      ...receiptItems,
      ...noticeItems.filter(item => !seenNoticeContent.has(`${item.name}|${item.body}`)),
    ]);
  }, []);

  const loadDeliveryHistory = useCallback(async () => {
    const role = String(user?.role || '').toUpperCase();
    try {
      const sentChatsPromise = chatAPI.getOutbox(100).then(response => (response?.data || [])
        .map(message => {
          const conversation = message.conversation || {};
          const other = conversation.participants?.find(participant => participant.userId !== user?.id)?.user;
          return {
            id: `outbox-chat-${message.id}`,
            kind: 'delivery',
            category: 'message',
            name: `To ${conversation.name || `${other?.firstName || ''} ${other?.lastName || ''}`.trim() || 'School contact'}`,
            subtitle: 'In-app chat',
            preview: message.body || '',
            body: message.body || '',
            channel: 'IN_APP',
            status: 'SENT',
            timestamp: message.createdAt,
            unreadCount: 0,
            hasAttachment: Boolean(message.attachmentName),
            attachmentName: message.attachmentName,
            raw: { ...message, senderId: user?.id },
          };
        }));
      if (role === 'PARENT') {
        const [response, sentChats] = await Promise.all([communicationAPI.getParentDeliveryInbox(), sentChatsPromise]);
        const rows = response?.data || [];
        setSentChatItems(sentChats);
        setDeliveryItems(rows.map(row => ({
          id: `parent-delivery-${row.id}`,
          kind: 'delivery',
          category: String(row.assessmentType).toUpperCase() === 'BIRTHDAY' ? 'birthday' : 'message',
          name: row.assessmentType === 'BIRTHDAY' ? `Birthday wishes for ${row.learnerName}` : `School message about ${row.learnerName}`,
          subtitle: row.learnerGrade || 'Your child',
          preview: row.messageContent || '',
          body: row.messageContent || '',
          channel: String(row.channel || 'SMS').toUpperCase(),
          status: String(row.smsStatus || 'SENT').toUpperCase(),
          timestamp: row.sentAt,
          unreadCount: 0,
          raw: row,
        })));
        return;
      }
      if (!MESSAGE_ROLES.has(role)) {
        setDeliveryItems([]);
        setSentChatItems(await sentChatsPromise);
        return;
      }
      const [auditResult, broadcastResult] = await Promise.allSettled([
        api.notifications.getAuditLogs({ page: 1, limit: 100 }),
        BROADCAST_ROLES.has(role) ? api.broadcasts.getHistory(100, 0) : Promise.resolve(null),
      ]);
      const auditResponse = auditResult.status === 'fulfilled' ? auditResult.value : null;
      const broadcastResponse = broadcastResult.status === 'fulfilled' ? broadcastResult.value : null;
      const auditRows = auditResponse?.data?.logs || [];
      setSentChatItems(await sentChatsPromise);
      const mappedAudits = auditRows
        .filter(row => String(row.assessmentType || '').toUpperCase() !== 'BROADCAST')
        .map(row => ({
          id: `staff-delivery-${row.id}`,
          kind: 'delivery',
          category: String(row.assessmentType || '').toUpperCase() === 'BIRTHDAY' ? 'birthday' : 'message',
          name: row.learner?.firstName
            ? `Message for ${row.learner.firstName} ${row.learner.lastName || ''}`.trim()
            : 'School message',
          subtitle: row.learner?.grade || 'Parent contact',
          preview: row.messageContent || '',
          body: row.messageContent || '',
          channel: String(row.channel || 'SMS').toUpperCase(),
          status: String(row.status || 'SENT').toUpperCase(),
          timestamp: row.createdAt,
          unreadCount: 0,
          raw: { ...row, senderId: row.sentByUserId || row.sentBy?.id },
        }));
      const campaigns = broadcastResponse?.data || broadcastResponse?.campaigns || [];
      const mappedCampaigns = BROADCAST_ROLES.has(role) ? campaigns.map(campaign => ({
        id: `broadcast-${campaign.id}`,
        kind: 'broadcast',
        name: 'Parent broadcast',
        subtitle: `${campaign.successCount || 0} sent · ${campaign.failedCount || 0} failed`,
        preview: campaign.messagePreview || campaign.messageTemplate || '',
        body: campaign.messagePreview || campaign.messageTemplate || '',
        channel: String(campaign.messageChannel || 'SMS').toUpperCase(),
        status: String(campaign.status || 'SENT').toUpperCase(),
        timestamp: campaign.sentAt,
        unreadCount: 0,
        raw: { ...campaign, senderId: campaign.senderId },
      })) : [];
      setDeliveryItems([...mappedAudits, ...mappedCampaigns]);
    } catch (historyError) {
      setDeliveryItems([]);
      console.warn('[UnifiedInbox] Could not load channel history:', historyError);
    }
  }, [user?.id, user?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchInbox(), loadAnnouncements(filter === 'archived'), loadDeliveryHistory()]);
      if (filter === 'archived') {
        const response = await chatAPI.getInbox(true);
        setArchiveConversations((response?.data || []).filter(item => item.archivedAt));
      }
    } catch (loadError) {
      const reason = loadError?.message && loadError.message !== 'Network Error' ? ` (${loadError.message})` : '';
      setError(`Could not connect to the inbox service${reason}. Try again.`);
    } finally {
      setLoading(false);
    }
  }, [fetchInbox, filter, loadAnnouncements, loadDeliveryHistory]);

  useEffect(() => { load(); }, [load]);

  // ── Starred management ──────────────────────────────────────────────────────
  const toggleStar = useCallback((item) => {
    const key = `${item.kind}-${item.id}`;
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveStarred(next);
      return next;
    });
  }, []);

  const isStarred = useCallback((item) => starredIds.has(`${item.kind}-${item.id}`), [starredIds]);

  // ── Chat items mapping ──────────────────────────────────────────────────────
  const chatItems = useMemo(() => {
    const source = filter === 'archived' ? archiveConversations : conversations;
    return source.map(conversation => {
      const other = conversation.participants?.find(participant => participant.userId !== user?.id)?.user;
      const name = conversation.name || `${other?.firstName || ''} ${other?.lastName || ''}`.trim() || 'School conversation';
      return {
        id: conversation.id,
        kind: 'conversation',
        channel: 'IN_APP',
        name,
        subtitle: other?.role || (conversation.type === 'GROUP' ? 'Staff group' : 'School contact'),
        preview: conversation.lastMessage?.body || '',
        timestamp: conversation.lastMessage?.createdAt || conversation.updatedAt,
        unreadCount: Number(conversation.unreadCount || 0),
        archivedAt: conversation.archivedAt,
        pinned: Boolean(conversation.pinnedAt),
        mutedUntil: conversation.mutedUntil,
        hasAttachment: Boolean(conversation.lastMessage?.attachmentName),
        raw: conversation,
      };
    });
  }, [archiveConversations, conversations, filter, user?.id]);

  const hasRealMessages = conversations.length + receipts.length + deliveryItems.length > 0;
  const showSamplePreview = import.meta.env.DEV && !samplePreviewDismissed && (samplePreviewEnabled || (!loading && !hasRealMessages));

  // ── Filtered + sorted + searched items ──────────────────────────────────────
  const visibleItems = useMemo(() => {
    const samples = showSamplePreview ? SAMPLE_MESSAGES : [];
    let source;
    if (filter === 'archived') source = [...chatItems, ...receipts.filter(item => item.archivedAt)];
    else if (filter === 'outbox') source = [...sentChatItems, ...deliveryItems.filter(item => item.raw?.sentByUserId === user?.id || item.raw?.senderId === user?.id || item.raw?.campaign?.senderId === user?.id || item.raw?.sentBy?.id === user?.id), ...receipts.filter(item => item.raw?.message?.senderId === user?.id && item.status !== 'DRAFT')];
    else if (filter === 'announcements') source = [...receipts.filter(item => item.kind === 'announcement' && !item.archivedAt), ...samples.filter(item => item.kind === 'announcement')];
    else if (filter === 'starred') source = [...chatItems, ...receipts, ...deliveryItems, ...samples].filter(item => !item.archivedAt && isStarred(item));
    else if (filter === 'attachments') source = [...chatItems, ...receipts, ...deliveryItems, ...samples].filter(item => !item.archivedAt && (item.hasAttachment || item.attachmentName));
    else if (filter === 'in_app') source = [...chatItems, ...samples.filter(item => item.kind === 'delivery' && item.channel === 'IN_APP')];
    else if (filter === 'sms' || filter === 'whatsapp' || filter === 'email') {
      const channel = filter.toUpperCase();
      source = [...receipts, ...deliveryItems, ...samples].filter(item => item.channel === channel && !item.archivedAt);
    } else if (filter === 'birthdays') source = [...deliveryItems, ...samples].filter(item => item.category === 'birthday');
    else source = [...chatItems, ...receipts.filter(item => !item.archivedAt), ...deliveryItems, ...samples];

    // Apply advanced filters
    let filtered = source
      .filter(item => filter !== 'unread' || Number(item.unreadCount || 0) > 0)
      .filter(item => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${item.name} ${item.preview} ${item.subtitle || ''}`.toLowerCase().includes(q);
      })
      .filter(item => {
        if (advancedFilters.channel !== 'all' && item.channel !== advancedFilters.channel) return false;
        if (advancedFilters.hasAttachment && !(item.hasAttachment || item.attachmentName)) return false;
        if (advancedFilters.dateFrom) {
          const itemDate = new Date(item.timestamp || 0);
          const fromDate = new Date(advancedFilters.dateFrom);
          if (itemDate < fromDate) return false;
        }
        if (advancedFilters.dateTo) {
          const itemDate = new Date(item.timestamp || 0);
          const toDate = new Date(advancedFilters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (itemDate > toDate) return false;
        }
        return true;
      });

    // Sort
    const sortBy = advancedFilters.sortBy || 'date_desc';
    filtered = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
        case 'unread_first': return Number(Boolean(b.unreadCount)) - Number(Boolean(a.unreadCount)) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        case 'starred_first': return Number(isStarred(b)) - Number(isStarred(a)) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        case 'pinned_first': return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        default: return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      }
    });

    return filtered;
  }, [chatItems, deliveryItems, filter, receipts, search, sentChatItems, showSamplePreview, user?.id, advancedFilters, isStarred]);

  const filterCounts = useMemo(() => {
    const all = [...chatItems, ...receipts.filter(item => !item.archivedAt), ...deliveryItems, ...(showSamplePreview ? SAMPLE_MESSAGES : [])];
    return {
      all: all.length,
      unread: chatItems.reduce((c, i) => c + Number(i.unreadCount || 0), 0) + receipts.reduce((c, i) => c + (!i.archivedAt ? Number(i.unreadCount || 0) : 0), 0),
      starred: all.filter(i => isStarred(i)).length,
      in_app: chatItems.length + (showSamplePreview ? SAMPLE_MESSAGES.filter(i => i.kind === 'delivery' && i.channel === 'IN_APP').length : 0),
      sms: [...receipts, ...deliveryItems].filter(i => i.channel === 'SMS' && !i.archivedAt).length,
      whatsapp: [...receipts, ...deliveryItems].filter(i => i.channel === 'WHATSAPP' && !i.archivedAt).length,
      email: [...receipts, ...deliveryItems].filter(i => i.channel === 'EMAIL' && !i.archivedAt).length,
      announcements: receipts.filter(i => i.kind === 'announcement' && !i.archivedAt).length,
      birthdays: deliveryItems.filter(i => i.category === 'birthday').length,
      attachments: all.filter(i => i.hasAttachment || i.attachmentName).length,
      outbox: sentChatItems.length + deliveryItems.filter(i => i.raw?.sentByUserId === user?.id || i.raw?.senderId === user?.id).length,
      archived: chatItems.filter(i => i.archivedAt).length + receipts.filter(i => i.archivedAt).length,
    };
  }, [chatItems, deliveryItems, receipts, sentChatItems, showSamplePreview, user?.id, isStarred]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const selectItem = async (item) => {
    setSelected(item);
    setDraft('');
    if (item.kind === 'conversation') {
      setDetailLoading(true);
      try { await openConversation(item.id); }
      finally { setDetailLoading(false); }
    } else if (item.unreadCount) {
      try {
        await communicationAPI.markMessageRead(item.id);
        setReceipts(current => current.map(r => r.id === item.id ? { ...r, unreadCount: 0 } : r));
        setSelected(current => current?.id === item.id ? { ...current, unreadCount: 0 } : current);
      } catch { setError('Could not mark this announcement as read.'); }
    }
    if (window.matchMedia('(max-width: 767px)').matches) setMode('thread');
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selected || selected.kind !== 'conversation' || sending) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(selected.id, body);
      setDraft('');
    } catch {
      setError('Your message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const updateSelected = async (preferences) => {
    if (!selected) return;
    setError('');
    try {
      if (selected.kind === 'conversation') {
        await chatAPI.updateInboxPreferences(selected.id, preferences);
      } else if (preferences.archived !== undefined) {
        await communicationAPI.archiveMessage(selected.id, preferences.archived);
      }
      if (typeof preferences.archived === 'boolean') {
        setSelected(null);
        setMode('list');
      } else {
        setSelected(current => current ? {
          ...current,
          pinned: preferences.pinned ?? current.pinned,
          pinnedAt: preferences.pinned === undefined ? current.pinnedAt : (preferences.pinned ? new Date().toISOString() : null),
          mutedUntil: preferences.mutedUntil === undefined ? current.mutedUntil : preferences.mutedUntil,
          unreadCount: preferences.markUnread ? Math.max(1, Number(current.unreadCount || 0)) : current.unreadCount,
        } : current);
      }
      await load();
    } catch {
      setError('Could not update this inbox item. Please try again.');
    }
  };

  const handleDelete = async (scope) => {
    if (!deleteTarget) return;
    const item = deleteTarget;
    setDeleteTarget(null);
    setError('');
    try {
      if (item.kind === 'conversation') {
        if (scope === 'everyone') {
          // Delete all messages in the conversation for both parties
          const messages = messagesByConv[item.id] || [];
          await Promise.all(messages.map(m => chatAPI.deleteMessage(m.id)));
        } else {
          // Delete for me: archive + hide
          await chatAPI.updateInboxPreferences(item.id, { archived: true });
        }
      } else if (item.kind === 'announcement' || item.kind === 'delivery') {
        if (item.archivable !== false) {
          await communicationAPI.archiveMessage(item.id, true);
        }
      }
      setSelected(null);
      setMode('list');
      await load();
    } catch (err) {
      setError(err?.message || 'Could not delete this message. Please try again.');
    }
  };

  const handleForward = async (recipient, note) => {
    if (!forwardTarget || !recipient) return;
    const item = forwardTarget;
    setForwardTarget(null);
    setError('');
    try {
      const conversation = await chatAPI.startDirect(recipient.id);
      const id = conversation?.data?.id;
      if (!id) throw new Error('Conversation was not created');
      const forwardBody = note.trim()
        ? `--- Forwarded from ${item.name} ---\n${item.preview || item.body}\n\nNote: ${note.trim()}`
        : `--- Forwarded from ${item.name} ---\n${item.preview || item.body}`;
      await chatAPI.sendMessage(id, forwardBody);
      setSelected({ id, kind: 'conversation', name: `${recipient.firstName} ${recipient.lastName}`.trim(), subtitle: recipient.role });
      await openConversation(id);
      setMode('thread');
    } catch (err) {
      setError(err?.message || 'Could not forward this message. Please try again.');
    }
  };

  const openCompose = () => {
    setSelected(null);
    setMode('compose');
    setComposePrefill(null);
  };

  const openReply = () => {
    if (!selected) return;
    setComposePrefill({
      reply: true,
      recipient: null,
      subject: `Re: ${selected.name}`,
      body: `\n\n--- Original message from ${selected.name} ---\n${selected.preview || selected.body || ''}`,
    });
    setSelected(null);
    setMode('compose');
  };

  const threadMessages = selected?.kind === 'conversation' ? (messagesByConv[selected.id] || []) : [];

  // ── Active filter indicator ─────────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.dateFrom) count++;
    if (advancedFilters.dateTo) count++;
    if (advancedFilters.hasAttachment) count++;
    if (advancedFilters.channel !== 'all') count++;
    if (advancedFilters.sortBy !== 'date_desc') count++;
    return count;
  }, [advancedFilters]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full min-h-[calc(100dvh-10rem)] w-full flex-col overflow-hidden bg-white">
      {/* ── Page Header ── */}
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white"><Inbox size={20} /></span>
          <div className="min-w-0"><h1 className="text-lg font-extrabold text-slate-950">Inbox</h1><p className="text-xs text-slate-600">School conversations and announcements</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {BROADCAST_ROLES.has(String(user?.role || '').toUpperCase()) && <button type="button" onClick={() => onNavigate?.('comm-broadcasts')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-700 px-3 text-sm font-bold text-blue-800 hover:bg-blue-50"><Send size={15} />Broadcast parents</button>}
          <button type="button" onClick={openCompose} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-extrabold text-white hover:bg-blue-800"><Plus size={17} />New message</button>
        </div>
      </header>

      {/* ── Main Grid ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px]">
        {/* ── List + Thread + Compose (left column) ── */}
        <div className={`order-2 min-h-0 flex-col bg-white md:order-1 ${mode === 'list' ? 'flex' : 'hidden md:flex'}`}>
          {mode === 'compose' ? (
            <ComposeForm user={user} onNavigate={onNavigate} onBack={() => { setMode('list'); setComposePrefill(null); }} prefill={composePrefill} />
          ) : selected ? (
            <ThreadPane
              selected={selected}
              user={user}
              messages={threadMessages}
              detailLoading={detailLoading}
              error={error}
              starred={isStarred(selected)}
              onBack={() => { setSelected(null); setMode('list'); }}
              onUpdate={updateSelected}
              onReply={openReply}
              onForward={() => setForwardTarget(selected)}
              onDelete={() => setDeleteTarget(selected)}
              onToggleStar={() => toggleStar(selected)}
            />
          ) : (
            <>
              {/* ── Search + Filter Bar ── */}
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 md:px-6">
                <div className="relative min-w-0 flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder={filter === 'outbox' ? 'Search sent messages…' : 'Search inbox…'}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(true)}
                  title="More filters"
                  className={`relative flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition ${activeFilterCount > 0 ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                >
                  <SlidersHorizontal size={14} />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-700 px-1 text-[9px] text-white">{activeFilterCount}</span>}
                </button>
              </div>

              {error && <div role="alert" className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 md:mx-6"><span>{error}</span><button type="button" onClick={load} className="font-bold underline">Retry</button></div>}

              {showSamplePreview && <div role="status" className="flex items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900 md:px-6"><span><strong>Sample messages</strong> · local previews only; they are not sent or saved.</span><button type="button" onClick={() => { setSamplePreviewDismissed(true); setSamplePreviewEnabled(false); }} className="shrink-0 font-bold underline">Hide samples</button></div>}

              {/* ── Message List ── */}
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-slate-50/50 px-2 py-2 md:px-3">
                {loading && visibleItems.length === 0 ? (
                  <div className="flex justify-center py-12 text-blue-700"><Loader2 className="animate-spin" /></div>
                ) : visibleItems.length ? (
                  visibleItems.map(item => (
                    <ConversationRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      active={selected?.id === item.id}
                      starred={isStarred(item)}
                      onClick={() => selectItem(item)}
                      onToggleStar={() => toggleStar(item)}
                    />
                  ))
                ) : (
                  <EmptyInbox archived={filter === 'archived'} onCompose={openCompose} />
                )}
              </div>

              {/* ── Bulk Actions Bar ── */}
              {visibleItems.length > 0 && filter !== 'archived' && filter !== 'outbox' && (
                <button
                  type="button"
                  onClick={async () => { await Promise.all(chatItems.filter(item => item.unreadCount).map(item => chatAPI.markRead(item.id))); await load(); }}
                  className="flex min-h-10 items-center justify-center gap-2 border-t border-slate-200 text-xs font-bold text-blue-800 hover:bg-blue-50"
                >
                  <CheckCheck size={15} />Mark conversations read
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Folders Sidebar (right column) ── */}
        <aside className={`order-1 min-h-0 flex-col border-b border-slate-200 bg-white md:order-2 md:border-b-0 md:border-l ${mode === 'list' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex min-h-0 flex-1 flex-col p-2 md:p-3">
            <h2 className="mb-2 hidden px-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:block">Folders</h2>
            <nav className="flex gap-1 overflow-x-auto md:block md:overflow-visible" aria-label="Inbox folders">
              {FILTERS.map(category => {
                const Icon = category.icon;
                const count = filterCounts[category.id] || 0;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-current={filter === category.id ? 'page' : undefined}
                    onClick={() => { setFilter(category.id); setSelected(null); setMode('list'); }}
                    className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-left text-sm transition md:w-full md:gap-3 ${filter === category.id ? `${category.selected} font-extrabold` : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    <Icon size={17} className={category.color} />
                    <span className="min-w-0 flex-1 truncate">{category.label}</span>
                    {count > 0 && <span className="shrink-0 text-xs font-semibold text-slate-500">{count}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>
      </div>

      {/* ── Reply Box (shown when a conversation is selected) ── */}
      {selected?.kind === 'conversation' && mode === 'thread' && (
        <form onSubmit={submitMessage} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <button type="button" className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100" title="Attach file"><Paperclip size={18} /></button>
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            rows={1}
            maxLength={4000}
            placeholder="Write a reply…"
            className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
          />
          <button type="submit" disabled={!draft.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40" aria-label="Send message">
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      )}

      {/* ── Modals ── */}
      <DeleteConfirmModal item={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      <ForwardModal item={forwardTarget} onCancel={() => setForwardTarget(null)} onSend={handleForward} />
      <AdvancedFilterPanel
        open={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        filters={advancedFilters}
        onApply={setAdvancedFilters}
      />
    </div>
  );
}
