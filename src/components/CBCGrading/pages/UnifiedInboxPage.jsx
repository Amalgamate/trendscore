import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArrowLeft, BellOff, Check, CheckCheck, Inbox, Loader2, Mail,
  MessageCircle, Pin, Plus, RotateCcw, Search, Send, Sparkles, User, X,
} from 'lucide-react';
import { chatAPI } from '../../../services/api/chat.api';
import { communicationAPI } from '../../../services/api';
import { useChat } from '../../../contexts/ChatContext';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'archived', label: 'Archived' },
];

const roleLabel = (role = '') => String(role).toLowerCase().replaceAll('_', ' ');
const initials = (value = '') => value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'S';
const timeLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

function ConversationRow({ item, active, onClick }) {
  const unread = Number(item.unreadCount || 0) > 0;
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition hover:bg-blue-50/60 ${active ? 'bg-blue-50' : 'bg-white'}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${item.kind === 'announcement' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-900 ring-2 ring-white'}`}>
        {item.kind === 'announcement' ? <Mail size={18} /> : initials(item.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${unread ? 'font-extrabold text-slate-950' : 'font-bold text-slate-800'}`}>{item.name}</span>
          <span className="shrink-0 text-[10px] text-slate-500">{timeLabel(item.timestamp)}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-600">{item.preview || (item.kind === 'announcement' ? 'School announcement' : 'Start the conversation')}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[10px] capitalize text-slate-500">
          {item.pinned && <Pin size={10} className="text-blue-700" />}
          {item.kind === 'announcement' ? 'Announcement' : roleLabel(item.subtitle || 'school contact')}
        </span>
      </span>
      {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-700" aria-label="Unread" />}
    </button>
  );
}

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

export default function UnifiedInboxPage({ user }) {
  const { conversations, fetchInbox, openConversation, sendMessage, messagesByConv } = useChat();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [archiveConversations, setArchiveConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [composeBody, setComposeBody] = useState('');
  const [composing, setComposing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const recipientSearchSequence = useRef(0);

  const loadAnnouncements = useCallback(async (includeArchived = false) => {
    const response = await communicationAPI.getInboxMessages(includeArchived);
    const rows = response?.data || [];
    setReceipts(rows.map(receipt => ({
      id: receipt.id,
      kind: 'announcement',
      name: receipt.message?.subject || 'School announcement',
      subtitle: 'School',
      preview: receipt.message?.body || '',
      body: receipt.message?.body || '',
      timestamp: receipt.createdAt || receipt.message?.createdAt,
      unreadCount: !receipt.readAt && receipt.status !== 'READ' ? 1 : 0,
      archivedAt: receipt.archivedAt,
      raw: receipt,
    })));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchInbox(), loadAnnouncements(filter === 'archived')]);
      if (filter === 'archived') {
        const response = await chatAPI.getInbox(true);
        setArchiveConversations((response?.data || []).filter(item => item.archivedAt));
      }
    } catch {
      setError('Could not load your inbox. Try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchInbox, filter, loadAnnouncements]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const value = query.trim();
    const sequence = ++recipientSearchSequence.current;
    if (value.length < 2 || selectedRecipient) { setRecipients([]); setSearchingRecipients(false); return undefined; }
    const timer = setTimeout(async () => {
      setSearchingRecipients(true);
      try {
        const response = await chatAPI.searchUsers(value);
        if (sequence === recipientSearchSequence.current) setRecipients(response?.data || []);
      } catch {
        if (sequence === recipientSearchSequence.current) setRecipients([]);
      } finally {
        if (sequence === recipientSearchSequence.current) setSearchingRecipients(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selectedRecipient]);

  const chatItems = useMemo(() => {
    const source = filter === 'archived' ? archiveConversations : conversations;
    return source.map(conversation => {
      const other = conversation.participants?.find(participant => participant.userId !== user?.id)?.user;
      const name = conversation.name || `${other?.firstName || ''} ${other?.lastName || ''}`.trim() || 'School conversation';
      return {
        id: conversation.id,
        kind: 'conversation',
        name,
        subtitle: other?.role || (conversation.type === 'GROUP' ? 'Staff group' : 'School contact'),
        preview: conversation.lastMessage?.body || '',
        timestamp: conversation.lastMessage?.createdAt || conversation.updatedAt,
        unreadCount: Number(conversation.unreadCount || 0),
        archivedAt: conversation.archivedAt,
        pinned: Boolean(conversation.pinnedAt),
        mutedUntil: conversation.mutedUntil,
        raw: conversation,
      };
    });
  }, [archiveConversations, conversations, filter, user?.id]);

  const visibleItems = useMemo(() => {
    const source = filter === 'announcements'
      ? receipts
      : filter === 'archived'
        ? [...chatItems, ...receipts.filter(item => item.archivedAt)]
        : [...chatItems, ...receipts.filter(item => !item.archivedAt)];
    return source
      .filter(item => filter !== 'unread' || Number(item.unreadCount || 0) > 0)
      .filter(item => `${item.name} ${item.preview}`.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [chatItems, filter, receipts, search]);

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
        setReceipts(current => current.map(receipt => receipt.id === item.id ? { ...receipt, unreadCount: 0 } : receipt));
        setSelected(current => current?.id === item.id ? { ...current, unreadCount: 0 } : current);
      } catch {
        setError('Could not mark this announcement as read.');
      }
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

  const startConversation = async (event) => {
    event.preventDefault();
    if (!selectedRecipient || !composeBody.trim() || composing) return;
    setComposing(true);
    setError('');
    try {
      const conversation = await chatAPI.startDirect(selectedRecipient.id);
      const id = conversation?.data?.id;
      if (!id) throw new Error('Conversation was not created');
      await chatAPI.sendMessage(id, composeBody.trim());
      await fetchInbox();
      setSelected({ id, kind: 'conversation', name: `${selectedRecipient.firstName} ${selectedRecipient.lastName}`.trim(), subtitle: selectedRecipient.role });
      await openConversation(id);
      setMode('thread');
      setSelectedRecipient(null);
      setQuery('');
      setComposeBody('');
    } catch (e) {
      setError(e?.message || 'Could not start this conversation. Please try again.');
    } finally {
      setComposing(false);
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

  const threadMessages = selected?.kind === 'conversation' ? (messagesByConv[selected.id] || []) : [];
  const openCompose = () => {
    setSelected(null);
    setMode('compose');
    setQuery('');
    setSelectedRecipient(null);
    setComposeBody('');
  };

  const threadPane = selected ? (
    <section className={`min-h-0 flex-1 flex-col bg-white md:flex ${mode === 'thread' ? 'flex' : 'hidden'}`} aria-label="Conversation">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <button type="button" onClick={() => { setSelected(null); setMode('list'); }} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Back to inbox"><ArrowLeft size={18} /></button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-extrabold text-blue-900">{selected.kind === 'announcement' ? <Mail size={18} /> : initials(selected.name)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-slate-950">{selected.name}</h2>
          <p className="truncate text-xs capitalize text-slate-600">{selected.kind === 'announcement' ? 'School announcement' : roleLabel(selected.subtitle)}</p>
        </div>
        <div className="flex items-center gap-1">
          {selected.kind === 'conversation' && <>
            <button type="button" onClick={() => updateSelected({ pinned: !selected.pinned })} title={selected.pinned ? 'Unpin conversation' : 'Pin conversation'} className={`rounded-lg p-2 hover:bg-slate-100 ${selected.pinned ? 'text-blue-800' : 'text-slate-500'}`}><Pin size={17} /></button>
            <button type="button" onClick={() => updateSelected({ markUnread: true })} title="Mark unread" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Mail size={17} /></button>
            <button type="button" onClick={() => updateSelected({ mutedUntil: selected.mutedUntil && new Date(selected.mutedUntil) > new Date() ? null : new Date(Date.now() + 30 * 86400000).toISOString() })} title={selected.mutedUntil && new Date(selected.mutedUntil) > new Date() ? 'Unmute conversation' : 'Mute for 30 days'} className={`rounded-lg p-2 hover:bg-slate-100 ${selected.mutedUntil && new Date(selected.mutedUntil) > new Date() ? 'text-blue-800' : 'text-slate-500'}`}><BellOff size={17} /></button>
          </>}
          <button type="button" onClick={() => updateSelected({ archived: !selected.archivedAt })} title={selected.archivedAt ? 'Restore to inbox' : 'Archive'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{selected.archivedAt ? <RotateCcw size={17} /> : <Archive size={17} />}</button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
        {selected.kind === 'announcement' ? (
          <article className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-blue-800">School announcement</p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.body}</p>
          </article>
        ) : detailLoading ? (
          <div className="flex justify-center py-10 text-blue-700"><Loader2 className="animate-spin" /></div>
        ) : threadMessages.length ? threadMessages.map(message => (
          <div key={message.id} className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-5 ${message.senderId === user?.id ? 'rounded-br-sm bg-blue-800 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-900'}`}>
              <p className="whitespace-pre-wrap">{message.body || (message.attachmentName ? `Attachment: ${message.attachmentName}` : '')}</p>
              <p className={`mt-1 text-[10px] ${message.senderId === user?.id ? 'text-blue-100' : 'text-slate-500'}`}>{timeLabel(message.createdAt)}</p>
            </div>
          </div>
        )) : <div className="py-12 text-center text-sm text-slate-600">Start the conversation below.</div>}
      </div>

      {selected.kind === 'conversation' && <form onSubmit={submitMessage} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <textarea value={draft} onChange={event => setDraft(event.target.value)} rows={1} maxLength={4000} placeholder="Write a message…" className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        <button type="submit" disabled={!draft.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40" aria-label="Send message">{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
      </form>}
    </section>
  ) : null;

  const composePane = (
    <section className={`min-h-0 flex-1 flex-col bg-white ${mode === 'compose' ? 'flex' : 'hidden'}`}>
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <button type="button" onClick={() => setMode('list')} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Back to inbox"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold text-slate-950">New conversation</h2><p className="text-xs text-slate-600">{getRecipientHint(user?.role)}</p></div>
      </header>
      <form onSubmit={startConversation} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <label className="text-xs font-bold text-slate-800">To
          <div className="relative mt-1.5">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={selectedRecipient ? `${selectedRecipient.firstName} ${selectedRecipient.lastName}` : query} onChange={event => { setSelectedRecipient(null); setQuery(event.target.value); }} placeholder="Find an approved contact" className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-10 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
            {searchingRecipients && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-700" />}
            {selectedRecipient && <button type="button" onClick={() => { setSelectedRecipient(null); setQuery(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Change recipient"><X size={16} /></button>}
          </div>
        </label>
        {!selectedRecipient && recipients.length > 0 && <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
          {recipients.map(contact => <button key={contact.id} type="button" onClick={() => { setSelectedRecipient(contact); setRecipients([]); }} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-blue-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-900">{initials(`${contact.firstName} ${contact.lastName}`)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{contact.firstName} {contact.lastName}</span><span className="block text-xs capitalize text-slate-600">{roleLabel(contact.role)}</span></span>
            <User size={16} className="text-blue-700" />
          </button>)}
        </div>}
        {query.trim().length >= 2 && !searchingRecipients && recipients.length === 0 && !selectedRecipient && <p className="text-xs text-slate-600">No approved contacts found for that search.</p>}
        {selectedRecipient && <label className="flex min-h-0 flex-1 flex-col text-xs font-bold text-slate-800">Message
          <textarea value={composeBody} onChange={event => setComposeBody(event.target.value)} rows={5} maxLength={4000} placeholder="What would you like to discuss?" className="mt-1.5 min-h-32 flex-1 rounded-lg border border-slate-300 p-3 text-sm font-normal text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </label>}
        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-auto flex justify-between border-t border-slate-100 pt-3">
          <button type="button" onClick={() => setMode('list')} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={!selectedRecipient || !composeBody.trim() || composing} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-extrabold text-white hover:bg-blue-800 disabled:opacity-40">{composing ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}Send message</button>
        </div>
      </form>
    </section>
  );

  return (
    <div className="flex h-full min-h-[min(78vh,720px)] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white"><Inbox size={20} /></span>
          <div className="min-w-0"><h1 className="text-lg font-extrabold text-slate-950">Inbox</h1><p className="text-xs text-slate-600">School conversations and announcements</p></div>
        </div>
        <button type="button" onClick={openCompose} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-extrabold text-white hover:bg-blue-800"><Plus size={17} />New message</button>
      </header>

      {error && <div role="alert" className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><span>{error}</span><button type="button" onClick={load} className="font-bold underline">Retry</button></div>}

      <div className={`grid min-h-0 flex-1 md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] ${mode === 'thread' || mode === 'compose' ? 'grid-cols-1' : 'grid-cols-1'}`}>
        <aside className={`min-h-0 flex-col border-r border-slate-200 bg-white ${mode === 'list' ? 'flex' : 'hidden md:flex'}`}>
          <div className="border-b border-slate-200 p-3">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search inbox" className="h-10 w-full rounded-lg bg-slate-100 pl-9 pr-3 text-sm text-slate-950 outline-none focus:bg-white focus:ring-2 focus:ring-blue-200" /></div>
            <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Inbox filters">{FILTERS.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={filter === tab.id} onClick={() => { setFilter(tab.id); setSelected(null); setMode('list'); }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${filter === tab.id ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{tab.label}</button>)}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && visibleItems.length === 0 ? <div className="flex justify-center py-12 text-blue-700"><Loader2 className="animate-spin" /></div> : visibleItems.length ? visibleItems.map(item => <ConversationRow key={`${item.kind}-${item.id}`} item={item} active={selected?.id === item.id} onClick={() => selectItem(item)} />) : <EmptyInbox archived={filter === 'archived'} onCompose={openCompose} />}
          </div>
          {visibleItems.length > 0 && filter !== 'archived' && <button type="button" onClick={async () => { await Promise.all(chatItems.filter(item => item.unreadCount).map(item => chatAPI.markRead(item.id))); await load(); }} className="flex min-h-10 items-center justify-center gap-2 border-t border-slate-200 text-xs font-bold text-blue-800 hover:bg-blue-50"><CheckCheck size={15} />Mark conversations read</button>}
        </aside>

        {mode === 'compose' ? composePane : selected ? threadPane : <div className="hidden min-h-0 flex-col items-center justify-center bg-slate-50 px-6 text-center md:flex"><span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-800 shadow-sm"><MessageCircle size={25} /></span><h2 className="text-base font-extrabold text-slate-900">Choose a conversation</h2><p className="mt-1 max-w-sm text-sm text-slate-600">Open a message or start a new conversation with an approved school contact.</p><button type="button" onClick={openCompose} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-700 px-4 text-sm font-bold text-blue-800 hover:bg-blue-50"><Plus size={16} />New message</button><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('trendscore:open-ai-tab'))} className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-800"><Sparkles size={15} />Ask the assistant</button></div>}
      </div>
    </div>
  );
}
