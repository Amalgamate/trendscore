/**
 * ParentPortalCommunicationCenter
 * Unified communication hub — school announcements + direct messages in one view.
 * Replaces the split Messages / Announcements pattern.
 *
 * Tabs: All | Messages | Announcements
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Loader2, Mail, MessageCircle,
  MessageSquare, Paperclip, RefreshCw, Search, Send, X,
} from 'lucide-react';
import { communicationAPI } from '../../../../services/api';
import { chatAPI } from '../../../../services/api/chat.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000)   return `${Math.round(diff / 60000)} min ago`;
  if (diff < 86400000)  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

const COLORS = ['bg-violet-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500'];
const colorFor = (id) => COLORS[(String(id).charCodeAt(0) || 0) % COLORS.length];

const DOT_COLORS = {
  teacher: 'bg-violet-500',
  admin:   'bg-blue-500',
  school:  'bg-indigo-500',
};
const dotColor = (msg) => {
  const role = String(msg?.senderRole || '').toLowerCase();
  if (role.includes('teacher')) return DOT_COLORS.teacher;
  if (role.includes('admin'))   return DOT_COLORS.admin;
  return DOT_COLORS.school;
};

// ─── MessageItem ──────────────────────────────────────────────────────────────
function MessageItem({ item, selected, onClick }) {
  const unread = Number(item.unreadCount || 0);
  const isAnnouncement = item.type === 'announcement';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
        selected
          ? 'bg-[#3B1FA3]/10 border border-[#3B1FA3]'
          : 'bg-white border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm ${colorFor(item.id)}`}>
        {item.avatarText || initials(item.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold truncate ${unread ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
              {item.name}
            </p>
            {item.subtitle && (
              <p className="text-[10px] text-gray-400 truncate">{item.subtitle}</p>
            )}
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtTime(item.timestamp)}</span>
        </div>
        <p className={`text-xs truncate mt-1 ${unread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
          {item.preview || 'No messages yet'}
        </p>
      </div>

      {/* Unread dot */}
      {unread > 0 && (
        <span className="w-5 h-5 bg-[#3B1FA3] text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────
function ChatWindow({ item, userId, onClose }) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState(item.messages || []);
  const [sending, setSending] = useState(false);
  const bottomRef = React.useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const optimistic = { id: Date.now(), body, isSent: true, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setSending(true);
    try {
      if (item.type === 'chat' && item.id) {
        await chatAPI.sendMessage?.(item.id, { body });
      }
    } catch (_) {}
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-600">
          <ArrowLeft size={18} />
        </button>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0 ${colorFor(item.id)}`}>
          {item.avatarText || initials(item.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
          <p className="text-[10px] text-gray-500">{item.subtitle || 'School communication'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center py-12 text-xs text-gray-400">No messages yet</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isSent ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.isSent
                ? 'bg-[#3B1FA3] text-white rounded-br-none'
                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
            }`}>
              {msg.body || msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {item.type === 'chat' && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <div className="flex items-center gap-2">
            <button type="button" className="p-2 text-gray-400 hover:text-gray-600">
              <Paperclip size={17} />
            </button>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a message…"
              className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3B1FA3]/30"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-full bg-[#3B1FA3] flex items-center justify-center text-white disabled:opacity-40"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'all',           label: 'All',           icon: MessageSquare },
  { id: 'messages',      label: 'Messages',       icon: MessageCircle },
  { id: 'announcements', label: 'Announcements',  icon: Mail         },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ParentPortalCommunicationCenter({ user, onNavigate }) {
  const [tab, setTab]           = useState('all');
  const [schoolMsgs, setSchoolMsgs] = useState([]);
  const [chats, setChats]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [schoolRes, chatRes] = await Promise.allSettled([
        communicationAPI.getInboxMessages(),
        chatAPI.getInbox(),
      ]);

      if (schoolRes.status === 'fulfilled') {
        const raw = schoolRes.value?.data || [];
        setSchoolMsgs(raw.map(receipt => ({
          id: receipt.id,
          type: 'announcement',
          name: receipt.message?.subject || 'School message',
          avatarText: '🏫',
          subtitle: 'School Administration',
          preview: receipt.message?.body || '',
          timestamp: receipt.createdAt || receipt.message?.createdAt,
          unreadCount: !receipt.readAt && receipt.status !== 'READ' ? 1 : 0,
          messages: [],
          _raw: receipt,
        })));
      }

      if (chatRes.status === 'fulfilled') {
        const raw = chatRes.value?.data || [];
        setChats(raw.map(conv => {
          const other = conv.participants?.find(p => p.userId !== user?.id);
          const otherUser = other?.user;
          const name = conv.name
            || (otherUser ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() : 'Chat')
            || 'Direct message';
          return {
            id: conv.id,
            type: 'chat',
            name,
            subtitle: otherUser?.role || 'Staff',
            preview: conv.lastMessage?.body || '',
            timestamp: conv.lastMessage?.createdAt || conv.updatedAt,
            unreadCount: Number(conv.unreadCount || 0),
            messages: (conv.messages || []).map(m => ({
              id: m.id,
              body: m.body,
              isSent: m.senderId === user?.id,
              createdAt: m.createdAt,
            })),
            _raw: conv,
          };
        }));
      }

      if (schoolRes.status === 'rejected' && chatRes.status === 'rejected') {
        setError('Could not load messages. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const allItems = [...chats, ...schoolMsgs].sort((a, b) =>
    new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
  );
  const filtered = (
    tab === 'all'           ? allItems :
    tab === 'messages'      ? chats :
    tab === 'announcements' ? schoolMsgs : []
  ).filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.preview || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = allItems.reduce((s, i) => s + (i.unreadCount || 0), 0);

  if (selected) {
    return <ChatWindow item={selected} userId={user?.id} onClose={() => setSelected(null)} />;
  }

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      {/* Sticky header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">Communication Center</h1>
            {totalUnread > 0 && (
              <p className="text-xs text-[#3B1FA3] font-semibold">{totalUnread} unread</p>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-400"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search messages & announcements…"
              className="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#3B1FA3]/30"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-0 gap-1">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            const src = t.id === 'messages' ? chats : t.id === 'announcements' ? schoolMsgs : allItems;
            const cnt = src.reduce((s, i) => s + (i.unreadCount || 0), 0);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                  isActive ? 'border-[#3B1FA3] text-[#3B1FA3]' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={12} />
                {t.label}
                {cnt > 0 && (
                  <span className="min-w-[15px] h-4 bg-[#3B1FA3] text-white rounded-full text-[9px] font-black flex items-center justify-center px-1">
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="px-4 py-4 space-y-2">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center justify-between">
            {error}
            <button type="button" onClick={load} className="font-bold underline ml-2">Retry</button>
          </div>
        )}

        {loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-gray-400 gap-3">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-xs font-semibold">Loading…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3 text-gray-400">
              <MessageSquare size={26} />
            </div>
            <p className="text-sm font-bold text-gray-700">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">School communications will appear here</p>
          </div>
        )}

        {filtered.map(item => (
          <MessageItem
            key={`${item.type}-${item.id}`}
            item={item}
            selected={selected?.id === item.id}
            onClick={() => setSelected(item)}
          />
        ))}
      </div>
    </div>
  );
}
