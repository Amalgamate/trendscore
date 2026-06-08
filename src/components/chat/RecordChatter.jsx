/**
 * RecordChatter — Odoo-style chatter for any school record
 *
 * Usage:
 *   <RecordChatter recordType="FeeInvoice" recordId={invoice.id} participants={[teacherId, parentId]} />
 *   <RecordChatter recordType="Learner" recordId={learner.id} />
 *
 * Features:
 *  - Real-time messages via Socket.IO (joins record's conv room on mount)
 *  - Reply threading
 *  - Emoji reactions
 *  - Typing indicator
 *  - Collapsible (starts expanded, can be toggled)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Reply, Smile, ChevronDown, ChevronUp,
  Loader2, X, Check, Edit3, Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../utils/cn';
import api from '../../services/api';
import { io } from 'socket.io-client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getInitials(user) {
  return `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function MiniAvatar({ user }) {
  if (user?.profilePicture) {
    return <img src={user.profilePicture} alt={user.firstName} className="w-7 h-7 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-7 h-7 rounded-full bg-brand-purple/10 text-brand-purple text-[10px] font-semibold flex items-center justify-center shrink-0">
      {getInitials(user)}
    </div>
  );
}

const QUICK_REACTIONS = ['👍', '✅', '❓', '👀', '🙏'];

// ─── MessageRow ───────────────────────────────────────────────────────────────

function MessageRow({ msg, isOwn, currentUserId, onReply, onDelete, onEdit, onReact, convId }) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.body);
  const [showReactions, setShowReactions] = useState(false);

  const isDeleted = !!msg.deletedAt;

  const reactionMap = (msg.reactions ?? []).reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] ?? [];
    acc[r.emoji].push(r.userId);
    return acc;
  }, {});

  const handleEdit = async () => {
    if (!editVal.trim() || editVal === msg.body) { setEditing(false); return; }
    await onEdit(convId, msg.id, editVal.trim());
    setEditing(false);
  };

  return (
    <div
      className="flex gap-2.5 py-2 px-1 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowReactions(false); }}
    >
      <MiniAvatar user={msg.sender} />
      <div className="flex-1 min-w-0">
        {/* Author + time */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-semibold text-gray-800">
            {msg.sender?.firstName} {msg.sender?.lastName}
            {isOwn && <span className="text-[9px] text-brand-purple ml-1 font-normal">(you)</span>}
          </span>
          <span className="text-[9px] text-gray-400">{timeAgo(msg.createdAt)}</span>
          {msg.editedAt && <span className="text-[9px] text-gray-400 italic">edited</span>}
        </div>

        {/* Reply preview */}
        {msg.replyTo && !msg.replyTo.deletedAt && (
          <div className="border-l-2 border-brand-purple/30 pl-2 mb-1 text-xs text-gray-500 bg-gray-50 rounded py-0.5 pr-1 line-clamp-1">
            <span className="font-semibold text-gray-600">{msg.replyTo.sender?.firstName}:</span>
            <span className="ml-1">{msg.replyTo.body}</span>
          </div>
        )}

        {/* Body */}
        {isDeleted ? (
          <p className="text-xs italic text-gray-400">This message was deleted.</p>
        ) : editing ? (
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 text-sm px-2 py-1 border border-brand-purple rounded-lg focus:outline-none"
            />
            <button onClick={handleEdit} className="text-brand-purple"><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className="text-gray-400"><X size={14} /></button>
          </div>
        ) : (
          <p className="text-sm text-gray-800 break-words leading-relaxed">{msg.body}</p>
        )}

        {/* Reactions */}
        {Object.keys(reactionMap).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactionMap).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className={cn(
                  'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
                  users.includes(currentUserId)
                    ? 'bg-brand-purple/10 border-brand-purple/30 text-brand-purple'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                )}
              >
                {emoji}{users.length > 1 && ` ${users.length}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons — appear on hover */}
      {!isDeleted && hovered && (
        <div className="flex items-center gap-0.5 shrink-0 self-start mt-0.5">
          <div className="relative">
            <button
              onClick={() => setShowReactions((v) => !v)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="React"
            >
              <Smile size={13} />
            </button>
            {showReactions && (
              <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex gap-1">
                {QUICK_REACTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onReact(msg.id, e); setShowReactions(false); }}
                    className="text-base hover:scale-125 transition-transform"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Reply">
            <Reply size={13} />
          </button>
          {isOwn && (
            <>
              <button onClick={() => { setEditing(true); setEditVal(msg.body); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Edit">
                <Edit3 size={13} />
              </button>
              <button onClick={() => onDelete(convId, msg.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── RecordChatter ────────────────────────────────────────────────────────────

export default function RecordChatter({
  recordType,
  recordId,
  participants = [],
  defaultCollapsed = false,
  title = 'Discussion',
}) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [convId, setConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [typingCount, setTypingCount] = useState(0);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);

  // ── Load thread ────────────────────────────────────────────────────────────
  const loadThread = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const resp = await api.chat.getRecordThread(recordType, recordId);
      if (resp.success) {
        setConvId(resp.data.id);
        setMessages(resp.data.messages ?? []);
      }
    } catch (err) {
      console.error('[RecordChatter] loadThread failed:', err);
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId, user?.id]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!convId) return;

    const socket = io(window.location.origin, {
      withCredentials: true,
      auth: { token: localStorage.getItem('token') },
    });
    socketRef.current = socket;
    socket.emit('chat:join', convId);

    socket.on('chat:message', (msg) => {
      if (msg.conversationId !== convId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    socket.on('chat:edited', (msg) => {
      if (msg.conversationId !== convId) return;
      setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m));
    });
    socket.on('chat:deleted', ({ messageId }) => {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), body: '' } : m));
    });
    socket.on('chat:reaction', ({ messageId, emoji, userId: rId, removed }) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions ?? [];
        if (removed) return { ...m, reactions: reactions.filter((r) => !(r.userId === rId && r.emoji === emoji)) };
        if (reactions.some((r) => r.userId === rId && r.emoji === emoji)) return m;
        return { ...m, reactions: [...reactions, { userId: rId, emoji }] };
      }));
    });
    socket.on('chat:typing', ({ conversationId, userId, isTyping }) => {
      if (conversationId !== convId || userId === user?.id) return;
      setTypingCount((n) => Math.max(0, n + (isTyping ? 1 : -1)));
    });

    return () => {
      socket.emit('chat:leave', convId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [convId, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!collapsed) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, collapsed]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending || !convId) return;
    setSending(true);
    setInput('');
    setReplyTo(null);
    socketRef.current?.emit('chat:typing', { conversationId: convId, isTyping: false });

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversationId: convId,
      senderId: user?.id,
      sender: { id: user?.id, firstName: user?.firstName, lastName: user?.lastName, role: user?.role },
      body,
      replyToId: replyTo?.id ?? null,
      replyTo: replyTo ?? null,
      reactions: [],
      createdAt: new Date().toISOString(),
      _pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const resp = await api.chat.sendMessage(convId, body, replyTo ? { replyToId: replyTo.id } : {});
      if (resp.success) {
        setMessages((prev) => prev.map((m) => m.id === tempId ? resp.data : m));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (cId, msgId) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, deletedAt: new Date().toISOString(), body: '' } : m));
    try { await api.chat.deleteMessage(msgId); } catch (_) {}
  };

  const handleEdit = async (cId, msgId, newBody) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, body: newBody, editedAt: new Date().toISOString() } : m));
    try { await api.chat.editMessage(msgId, newBody); } catch (_) {}
  };

  const handleReact = async (msgId, emoji) => {
    try { await api.chat.toggleReaction(msgId, emoji); } catch (_) {}
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    if (convId) socketRef.current?.emit('chat:typing', { conversationId: convId, isTyping: true });
  };

  const visibleCount = messages.filter((m) => !m.deletedAt).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50/60 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={15} className="text-brand-purple" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-widest">{title}</span>
          {visibleCount > 0 && (
            <span className="bg-brand-purple text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {visibleCount}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
      </div>

      {!collapsed && (
        <>
          {/* Messages */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-gray-300" />
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs font-medium uppercase tracking-widest">No messages yet. Start the discussion.</p>
              </div>
            )}
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                msg={msg}
                isOwn={msg.senderId === user?.id}
                currentUserId={user?.id}
                convId={convId}
                onReply={setReplyTo}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onReact={handleReact}
              />
            ))}
            {typingCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
                <span className="text-[10px] text-gray-400">Someone is typing…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="mx-4 my-1 px-3 py-1.5 bg-brand-purple/5 border border-brand-purple/20 rounded-lg flex items-center justify-between">
              <p className="text-xs text-gray-600 line-clamp-1">
                <span className="font-semibold text-brand-purple">{replyTo.sender?.firstName}:</span>
                <span className="ml-1">{replyTo.body}</span>
              </p>
              <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-end gap-2">
              <MiniAvatar user={user} />
              <div className="flex-1 flex items-end gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-brand-purple/40 focus-within:bg-white transition-colors">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={handleTyping}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Add a comment… (Enter to send)"
                  className="flex-1 bg-transparent resize-none text-sm focus:outline-none max-h-24 leading-relaxed"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending || !convId}
                  className="h-7 w-7 rounded-full bg-brand-purple text-white flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
