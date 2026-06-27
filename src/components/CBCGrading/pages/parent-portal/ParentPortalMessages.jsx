/**
 * ParentPortalMessages
 * Real inbox for school–parent communication.
 * Pulls from:
 *   - communicationAPI.getInboxMessages()  → broadcast/school messages
 *   - chatAPI.getInbox()                   → direct teacher/staff chats
 *   - userNotifications (context)          → system alerts badge
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Loader2, Mail, MessageCircle,
  MessageSquare, Paperclip, RefreshCw, Search, Send, X,
} from 'lucide-react';
import { communicationAPI } from '../../../../services/api';
import { chatAPI } from '../../../../services/api/chat.api';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (v) =>
  v
    ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

const COLORS = [
  'bg-violet-500', 'bg-emerald-500', 'bg-blue-500',
  'bg-amber-500',  'bg-rose-500',    'bg-teal-500',
];
const colorFor = (id) => COLORS[(String(id).charCodeAt(0) || 0) % COLORS.length];

// ─── ConversationItem ─────────────────────────────────────────────────────────

function ConversationItem({ item, selected, onClick }) {
  const unread = Number(item.unreadCount || 0);
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
      <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm ${colorFor(item.id)}`}>
        {item.avatarText || initials(item.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold truncate ${unread ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
            {item.name}
          </p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{fmt(item.timestamp)}</span>
        </div>
        <p className={`text-xs truncate mt-0.5 ${unread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
          {item.preview || 'No messages yet'}
        </p>
      </div>
      {unread > 0 && (
        <span className="w-5 h-5 bg-[#3B1FA3] text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────

function ChatWindow({ item, onClose }) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState(item.messages || []);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const optimistic = { id: Date.now(), body, isSent: true, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      if (item.type === 'chat' && item.id) {
        await chatAPI.sendMessage?.(item.id, { body });
      }
    } catch {
      // optimistic — message still shows
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-600"
        >
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center py-12 text-xs text-gray-400">No messages yet</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isSent ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.isSent
                  ? 'bg-[#3B1FA3] text-white rounded-br-none'
                  : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
              }`}
            >
              {msg.body || msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <div className="flex items-center gap-2">
          <button type="button" className="p-2 text-gray-400 hover:text-gray-600">
            <Paperclip size={17} />
          </button>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
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
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'school', label: 'School',   icon: Mail          },
  { id: 'chats',  label: 'Chats',    icon: MessageCircle },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const ParentPortalMessages = ({ user, onNavigate }) => {
  const [tab, setTab]                     = useState('school');
  const [schoolMsgs, setSchoolMsgs]       = useState([]);
  const [chats, setChats]                 = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState(null);

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
        setSchoolMsgs(raw.map((receipt) => ({
          id: receipt.id,
          type: 'school',
          name: receipt.message?.subject || receipt.message?.messageType || 'School message',
          avatarText: '🏫',
          preview: receipt.message?.body || '',
          timestamp: receipt.createdAt || receipt.message?.createdAt,
          unreadCount: !receipt.readAt && receipt.status !== 'READ' ? 1 : 0,
          messages: [],
          _raw: receipt,
        })));
      }

      if (chatRes.status === 'fulfilled') {
        const raw = chatRes.value?.data || [];
        setChats(raw.map((conv) => {
          const other = conv.participants?.find((p) => p.userId !== user?.id);
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
            messages: (conv.messages || []).map((m) => ({
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

  const items = tab === 'school' ? schoolMsgs : chats;
  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.preview.toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread = [...schoolMsgs, ...chats].reduce((s, i) => s + (i.unreadCount || 0), 0);

  if (selected) {
    return <ChatWindow item={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <div className="min-h-screen bg-[#eef3f8] pb-24">

      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onNavigate('parent-portal-home')}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">Messages</h1>
            {totalUnread > 0 && (
              <p className="text-xs text-[#3B1FA3] font-semibold">{totalUnread} unread</p>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-400"
            disabled={loading}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
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
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                  active
                    ? 'border-[#3B1FA3] text-[#3B1FA3]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={13} />
                {t.label}
                {/* unread badge per tab */}
                {(() => {
                  const src = t.id === 'school' ? schoolMsgs : chats;
                  const cnt = src.reduce((s, i) => s + (i.unreadCount || 0), 0);
                  return cnt > 0 ? (
                    <span className="min-w-[16px] h-4 bg-[#3B1FA3] text-white rounded-full text-[9px] font-black flex items-center justify-center px-1">
                      {cnt}
                    </span>
                  ) : null;
                })()}
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
            <span className="text-xs font-semibold">Loading messages…</span>
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

        {filtered.map((item) => (
          <ConversationItem
            key={`${item.type}-${item.id}`}
            item={item}
            selected={selected?.id === item.id}
            onClick={() => setSelected(item)}
          />
        ))}
      </div>
    </div>
  );
};

export default ParentPortalMessages;
