/**
 * ChatPanel — Fully rebuilt in-app messaging panel
 *
 * Features:
 *  ✦ Modern header with avatar, name, online status
 *  ✦ Focused staff and family messaging inbox
 *  ✦ Greeting message on first open
 *  ✦ Animated typing indicators
 *  ✦ File & image attachment support
 *  ✦ Screenshot capture
 *  ✦ Video room prep (generates a shareable room link)
 *  ✦ Emoji reactions, reply threading, edit, delete
 *  ✦ Load earlier messages
 *  ✦ New conversation search
 */

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import {
  X, Search, Plus, ArrowLeft, Send, Smile, Users,
  MessageSquare, Loader2, Trash2, Edit3, Reply, Check,
  Video, Paperclip, Image, Camera, Copy,
  CheckCheck, Phone, MoreHorizontal, Mic, MicOff,
  ExternalLink, Hash, Sparkles,
} from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../utils/cn';
import api from '../../services/api';
import { AIAssistantPanel } from '../help/AIAssistant';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getInitials(user) {
  if (!user) return '?';
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(4)}-${seg(4)}-${seg(4)}`;
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function MessageBody({ body, isOwn, onJoinVideo }) {
  return String(body || '').split(URL_PATTERN).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return <React.Fragment key={index}>{part}</React.Fragment>;
    const cleanUrl = part.replace(/[),.!?]+$/, '');
    const suffix = part.slice(cleanUrl.length);
    const isJitsi = /^https:\/\/meet\.jit\.si\//i.test(cleanUrl);
    return (
      <React.Fragment key={index}>
        <a
          href={cleanUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            if (!isJitsi || !onJoinVideo) return;
            event.preventDefault();
            onJoinVideo(cleanUrl);
          }}
          className={cn('font-semibold underline underline-offset-2', isOwn ? 'text-white' : 'text-blue-600')}
        >
          {cleanUrl}
        </a>
        {suffix}
      </React.Fragment>
    );
  });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = 'md', online = false, className }) {
  const [imgErr, setImgErr] = useState(false);
  const sizes = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
    xl: 'w-14 h-14 text-base',
  };
  const dotSizes = { xs: 'w-1.5 h-1.5', sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3', xl: 'w-3.5 h-3.5' };

  const hasImg = user?.profilePicture && !imgErr;
  return (
    <div className={cn('relative shrink-0', className)}>
      <div className={cn(
        'rounded-full flex items-center justify-center font-semibold overflow-hidden',
        sizes[size] || sizes.md,
        !hasImg && 'bg-brand-purple text-white',
      )}>
        {hasImg
          ? <img src={user.profilePicture} alt={user.firstName} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <span>{getInitials(user)}</span>
        }
      </div>
      {online && (
        <span className={cn(
          'absolute bottom-0 right-0 rounded-full bg-emerald-400 border-2 border-white',
          dotSizes[size] || dotSizes.md,
        )} />
      )}
    </div>
  );
}

// ─── GroupAvatar ──────────────────────────────────────────────────────────────

function GroupAvatar({ size = 'md' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' };
  return (
    <div className={cn(
      'rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shrink-0',
      sizes[size] || sizes.md,
    )}>
      <Users size={size === 'lg' ? 16 : 14} />
    </div>
  );
}

// ─── TypingDots ───────────────────────────────────────────────────────────────

function TypingDots({ label = 'typing…' }) {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-400 italic">{label}</span>
    </div>
  );
}

// ─── AttachmentPreview ────────────────────────────────────────────────────────

function AttachmentPreview({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
      {files.map((f, i) => (
        <div key={i} className="relative group flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 max-w-[140px]">
          {f.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(f)} alt={f.name} className="w-8 h-8 object-cover rounded" />
          ) : (
            <Paperclip size={14} className="text-gray-500 shrink-0" />
          )}
          <span className="text-[10px] text-gray-600 truncate">{f.name}</span>
          <button
            onClick={() => onRemove(i)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={9} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── VideoRoomModal ───────────────────────────────────────────────────────────

function VideoRoomModal({ onClose, onSend, onJoin, conversationName, excludedUserIds = [] }) {
  const [roomId] = useState(generateRoomId);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);
  const roomUrl = `https://meet.jit.si/tread-${roomId}`;

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setResults([]); return undefined; }
    const timer = setTimeout(async () => {
      const resp = await api.chat.searchUsers(value);
      if (resp.success) {
        const hiddenIds = new Set([...excludedUserIds, ...selected.map((user) => user.id)]);
        setResults(resp.data.filter((user) => !hiddenIds.has(user.id)));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected, excludedUserIds]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    const sent = await onSend(
      `📹 Video call invited you to join: ${roomUrl}`,
      selected.map((user) => user.id),
    );
    setSending(false);
    if (sent !== false) onClose();
  };

  return (
    <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-brand-purple to-purple-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-white" />
            <span className="text-sm font-semibold text-white">Start Video Call</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            A video room has been prepared for <span className="font-semibold text-gray-800">{conversationName}</span>. Share the link to invite participants.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex items-center gap-2">
            <Hash size={12} className="text-brand-purple shrink-0" />
            <span className="text-[11px] text-gray-700 flex-1 truncate font-mono">{roomUrl}</span>
            <button
              onClick={handleCopy}
              className="shrink-0 text-brand-purple hover:text-purple-700 transition-colors"
            >
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Invite more people
            </label>
            <div className="mt-1 flex flex-wrap gap-1">
              {selected.map((user) => (
                <button key={user.id} onClick={() => setSelected((items) => items.filter((item) => item.id !== user.id))}
                  className="rounded-full bg-brand-purple/10 px-2 py-1 text-[10px] font-semibold text-brand-purple">
                  {user.firstName} {user.lastName} ×
                </button>
              ))}
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Search names to create a group invite…"
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs focus:border-brand-purple focus:outline-none" />
            {results.length > 0 && (
              <div className="mt-1 max-h-24 overflow-y-auto rounded-lg border border-gray-100 bg-white shadow-sm">
                {results.slice(0, 8).map((user) => (
                  <button key={user.id} onClick={() => { setSelected((items) => [...items, user]); setQuery(''); setResults([]); }}
                    className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs hover:bg-gray-50">
                    <span>{user.firstName} {user.lastName}</span>
                    <span className="text-[9px] uppercase text-gray-400">{user.role?.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { onJoin(roomUrl); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-brand-purple/30 text-brand-purple text-xs font-semibold rounded-xl hover:bg-brand-purple/5 transition-colors"
            >
              <Video size={12} /> Join in app
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-purple text-white text-xs font-semibold rounded-xl hover:bg-brand-purple/90 transition-colors"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send Invite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, isOwn, onReply, onDelete, onEdit, onReact, onJoinVideo, currentUserId }) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body);
  const { editMessage } = useChat();
  const isDeleted = !!message.deletedAt;

  const handleEdit = async () => {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === message.body) { setEditing(false); return; }
    await editMessage(message.conversationId, message.id, trimmed);
    setEditing(false);
  };

  const reactionMap = useMemo(() => (message.reactions ?? []).reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] ?? [];
    acc[r.emoji].push(r.userId);
    return acc;
  }, {}), [message.reactions]);

  return (
    <div
      className={cn('flex gap-2 group mb-2', isOwn ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
    >
      {/* Avatar — only for incoming */}
      {!isOwn && (
        <Avatar user={message.sender} size="sm" className="mt-1 shrink-0" />
      )}

      <div className={cn('flex flex-col max-w-[78%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name */}
        {!isOwn && (
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 px-1">
            {message.sender?.firstName} {message.sender?.lastName}
          </span>
        )}

        {/* Reply preview */}
        {message.replyTo && !message.replyTo.deletedAt && (
          <div className={cn(
            'text-[10px] px-2 py-1 mb-1 rounded-lg border-l-2 opacity-75 max-w-full truncate',
            isOwn
              ? 'bg-white/20 border-white/50 text-right'
              : 'bg-gray-100 border-brand-purple/40 text-gray-600',
          )}>
            <span className="font-semibold">{message.replyTo.sender?.firstName}:</span>
            <span className="ml-1">{message.replyTo.body}</span>
          </div>
        )}

        {/* Body / editing */}
        {isDeleted ? (
          <div className="px-3 py-2 rounded-2xl text-xs italic text-gray-400 border border-dashed border-gray-200 bg-gray-50">
            Message deleted
          </div>
        ) : editing ? (
          <div className="flex gap-1.5 items-center w-full">
            <input
              autoFocus
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 px-3 py-1.5 border-2 border-brand-purple rounded-xl text-sm focus:outline-none bg-white"
            />
            <button onClick={handleEdit} className="text-brand-purple hover:text-purple-700"><Check size={15} /></button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
          </div>
        ) : (
          <div className={cn(
            'relative px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
            isOwn
              ? 'bg-brand-purple text-white rounded-tr-sm'
              : 'bg-white text-gray-900 rounded-tl-sm border border-gray-100 shadow-sm',
            message._pending && 'opacity-60',
          )}>
            <MessageBody body={message.body} isOwn={isOwn} onJoinVideo={onJoinVideo} />
            {message.editedAt && (
              <span className={cn('text-[9px] ml-1', isOwn ? 'text-white/50' : 'text-gray-400')}>·edited</span>
            )}
            {/* Attachments */}
            {message.attachments?.map((att, i) => (
              <div key={i} className="mt-1.5">
                {att.mimeType?.startsWith('image/') ? (
                  <img src={att.url} alt={att.name} className="max-w-full rounded-lg max-h-36 object-cover" />
                ) : (
                  <a href={att.url} target="_blank" rel="noreferrer"
                    className={cn('flex items-center gap-1.5 text-xs underline', isOwn ? 'text-white/80' : 'text-brand-purple')}>
                    <Paperclip size={11} />{att.name}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reactions row */}
        {Object.keys(reactionMap).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactionMap).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className={cn(
                  'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors',
                  users.includes(currentUserId)
                    ? 'bg-brand-purple/10 border-brand-purple/30 text-brand-purple'
                    : 'bg-white border-gray-200 hover:bg-gray-50',
                )}
              >
                {emoji}{users.length > 1 && <span className="ml-0.5 text-[9px]">{users.length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp + status */}
        <div className={cn('flex items-center gap-1 mt-0.5 px-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[9px] text-gray-400">{timeAgo(message.createdAt)}</span>
          {isOwn && !message._pending && <CheckCheck size={10} className="text-brand-purple/60" />}
          {isOwn && message._pending && <Loader2 size={9} className="animate-spin text-gray-300" />}
        </div>
      </div>

      {/* Hover action bar */}
      {!isDeleted && showActions && !editing && (
        <div className={cn(
          'flex items-center self-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
          isOwn ? 'flex-row-reverse' : 'flex-row',
        )}>
          {/* Emoji reaction picker */}
          <div className="relative">
            <button
              onClick={() => setShowReactions((v) => !v)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="React"
            >
              <Smile size={13} />
            </button>
            {showReactions && (
              <div className={cn(
                'absolute bottom-7 z-20 bg-white border border-gray-100 rounded-2xl shadow-xl p-1.5 flex gap-0.5',
                isOwn ? 'right-0' : 'left-0',
              )}>
                {QUICK_REACTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onReact(message.id, e); setShowReactions(false); }}
                    className="text-base px-1 py-0.5 hover:scale-125 transition-transform rounded"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => onReply(message)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Reply">
            <Reply size={13} />
          </button>

          {isOwn && (
            <>
              <button onClick={() => { setEditing(true); setEditBody(message.body); }} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Edit">
                <Edit3 size={13} />
              </button>
              <button onClick={() => onDelete(message.id)} className="p-1 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MessageThread ────────────────────────────────────────────────────────────

function MessageThread({
  conversationId, conv, currentUserId,
  showVideoModal: showVideoModalFromHeader = false,
  onVideoModalClose,
}) {
  const {
    messagesByConv, sendMessage, sendTyping,
    deleteMessage, toggleReaction, loadMessages, typingUsers, createGroup, openConversation,
  } = useChat();
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // synchronous guard — immune to React batching
  const [loadingMore, setLoadingMore] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [activeMeetingUrl, setActiveMeetingUrl] = useState(null);
  const videoSendingRef = useRef(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imgInputRef = useRef(null);

  const messages = messagesByConv[conversationId] ?? [];
  const typingSet = typingUsers[conversationId] ?? new Set();
  const typingCount = typingSet.size;

  const convName = useMemo(() => {
    if (!conv) return '';
    if (conv.type === 'GROUP') return conv.name || 'Group';
    if (conv.type === 'RECORD_THREAD') return `${conv.recordType} Thread`;
    const other = conv.participants?.find((p) => p.userId !== currentUserId);
    return other?.user ? `${other.user.firstName} ${other.user.lastName}` : 'Direct Message';
  }, [conv, currentUserId]);
  const conversationParticipantIds = useMemo(
    () => (conv?.participants ?? []).map((participant) => participant.userId),
    [conv?.participants],
  );

  useEffect(() => {
    if (showVideoModalFromHeader) setShowVideoModal(true);
  }, [showVideoModalFromHeader]);

  const closeVideoModal = () => {
    setShowVideoModal(false);
    onVideoModalClose?.();
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  const handleSend = async () => {
    const body = input.trim();
    if ((!body && !attachments.length) || sendingRef.current) return;
    // Set both the ref (synchronous, prevents re-entry) and state (drives UI)
    sendingRef.current = true;
    setSending(true);
    const opts = {};
    if (replyTo) opts.replyToId = replyTo.id;
    const msgBody = body || (attachments.length ? `📎 ${attachments.map((f) => f.name).join(', ')}` : '');
    setInput('');
    setReplyTo(null);
    setAttachments([]);
    sendTyping(conversationId, false);
    await sendMessage(conversationId, msgBody, opts);
    sendingRef.current = false;
    setSending(false);
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    sendTyping(conversationId, true);
  };

  const handleLoadMore = async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    await loadMessages(conversationId, messages[0].createdAt);
    setLoadingMore(false);
  };

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      track.stop();
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      canvas.toBlob((blob) => {
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
        setAttachments((prev) => [...prev, file]);
      }, 'image/png');
    } catch (err) {
      console.warn('[ChatPanel] screenshot cancelled or failed', err);
    }
  };

  const handleVideoSend = async (msg, extraParticipantIds = []) => {
    if (videoSendingRef.current) return false;
    videoSendingRef.current = true;
    try {
      if (extraParticipantIds.length > 0) {
        const existingIds = (conv?.participants ?? [])
          .map((participant) => participant.userId)
          .filter((id) => id && id !== currentUserId);
        const participantIds = [...new Set([...existingIds, ...extraParticipantIds])];
        const group = await createGroup(`Video call · ${convName}`, participantIds);
        if (!group) return false;
        await sendMessage(group.id, msg);
        await openConversation(group.id);
        return true;
      }
      await sendMessage(conversationId, msg);
      return true;
    } finally {
      videoSendingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* Video room modal */}
      {showVideoModal && (
        <VideoRoomModal
          onClose={closeVideoModal}
          onSend={handleVideoSend}
          onJoin={setActiveMeetingUrl}
          conversationName={convName}
          excludedUserIds={conversationParticipantIds}
        />
      )}

      {/* Load earlier */}
      <button
        onClick={handleLoadMore}
        disabled={loadingMore}
        className="w-full text-[10px] text-gray-400 hover:text-brand-purple font-bold uppercase tracking-widest py-2 bg-white border-b border-gray-100 flex items-center justify-center gap-1.5 transition-colors"
      >
        {loadingMore ? <Loader2 size={10} className="animate-spin" /> : <MoreHorizontal size={12} />}
        Load earlier messages
      </button>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <div className="w-12 h-12 rounded-full bg-brand-purple/10 flex items-center justify-center mb-3">
              <MessageSquare size={20} className="text-brand-purple/50" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">No messages yet</p>
            <p className="text-[10px] text-gray-400 mt-1">Be the first to say something</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === currentUserId}
            currentUserId={currentUserId}
            onReply={setReplyTo}
            onDelete={(id) => deleteMessage(conversationId, id)}
            onReact={(id, emoji) => toggleReaction(conversationId, id, emoji)}
            onJoinVideo={setActiveMeetingUrl}
          />
        ))}

        {typingCount > 0 && (
          <div className="flex items-center gap-2 mt-1 px-1">
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {activeMeetingUrl && (
        <div className="fixed bottom-4 right-4 z-[100] flex h-[min(70vh,620px)] w-[min(92vw,860px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gray-950 px-4 py-2.5 text-white">
            <div className="flex items-center gap-2 text-xs font-bold"><Video size={14} /> Video session</div>
            <div className="flex items-center gap-1">
              <button onClick={() => window.open(activeMeetingUrl, '_blank', 'noopener,noreferrer')}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Open in new tab">
                <ExternalLink size={14} />
              </button>
              <button onClick={() => setActiveMeetingUrl(null)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Close video">
                <X size={14} />
              </button>
            </div>
          </div>
          <iframe
            src={activeMeetingUrl}
            title="TrendSCORE video session"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="min-h-0 flex-1 border-0"
          />
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="mx-3 mb-1 px-3 py-2 bg-brand-purple/5 border-l-2 border-brand-purple rounded-r-xl flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-brand-purple uppercase tracking-wider">{replyTo.sender?.firstName}</p>
            <p className="text-xs text-gray-600 line-clamp-1">{replyTo.body}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <AttachmentPreview
          files={attachments}
          onRemove={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
        />
      )}

      {/* Composer */}
      <div className="bg-white border-t border-gray-200 px-3 py-2.5">
        {/* Toolbar */}
        <div className="flex items-center gap-1 mb-2">
          {/* File attachment */}
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={(e) => setAttachments((p) => [...p, ...Array.from(e.target.files)])} />
          <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => setAttachments((p) => [...p, ...Array.from(e.target.files)])} />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-purple hover:bg-brand-purple/5 transition-colors"
            title="Attach file"
          >
            <Paperclip size={14} />
          </button>
          <button
            onClick={() => imgInputRef.current?.click()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-purple hover:bg-brand-purple/5 transition-colors"
            title="Attach image"
          >
            <Image size={14} />
          </button>
          <button
            onClick={handleScreenshot}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-purple hover:bg-brand-purple/5 transition-colors"
            title="Capture screenshot"
          >
            <Camera size={14} />
          </button>
          <button
            onClick={() => setShowVideoModal(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-colors"
            title="Start video call"
          >
            <Video size={14} />
          </button>
        </div>

        {/* Input row */}
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-200 focus-within:border-brand-purple/50 focus-within:bg-white transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleTyping}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Type a message…"
            className="flex-1 bg-transparent resize-none text-sm focus:outline-none max-h-24 leading-relaxed placeholder:text-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachments.length) || sending}
            className="h-8 w-8 rounded-full bg-brand-purple text-white flex items-center justify-center shrink-0 disabled:opacity-30 transition-all hover:bg-brand-purple/90 hover:scale-105 active:scale-95"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
        <p className="text-[9px] text-gray-400 text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ─── NewConversation ──────────────────────────────────────────────────────────

function NewConversation({ onBack }) {
  const { startDirect } = useChat();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [openingId, setOpeningId] = useState(null); // tracks which user is being opened

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await api.chat.searchUsers(q);
        if (resp.success) setResults(resp.data);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = async (userId) => {
    if (openingId) return; // prevent double-tap
    setOpeningId(userId);
    try {
      const conv = await startDirect(userId);
      if (conv) {
        // startDirect already calls openConversation which sets activeConversationId
        // — navigate to thread view
        onBack('thread');
      }
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-brand-purple/40 transition-colors">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
          />
          {searching && <Loader2 size={12} className="animate-spin text-gray-400" />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
        {query.length < 2 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Search size={24} className="opacity-20 mb-2" />
            <p className="text-xs">Type at least 2 characters</p>
          </div>
        )}
        {results.length === 0 && query.length >= 2 && !searching && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p className="text-xs font-bold uppercase tracking-widest">No users found</p>
          </div>
        )}
        {results.map((u) => (
          <button
            key={u.id}
            onClick={() => handleSelect(u.id)}
            disabled={!!openingId}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 disabled:opacity-60"
          >
            <Avatar user={u} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{u.firstName} {u.lastName}</p>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{u.role?.replace(/_/g, ' ')}</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-brand-purple/10 flex items-center justify-center shrink-0">
              {openingId === u.id
                ? <Loader2 size={12} className="text-brand-purple animate-spin" />
                : <MessageSquare size={12} className="text-brand-purple" />
              }
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ThreadHeader ─────────────────────────────────────────────────────────────

function ThreadHeader({ conv, currentUserId, onBack, onVideoCall }) {
  const otherParticipant = useMemo(() => {
    if (!conv || conv.type !== 'DIRECT') return null;
    const p = conv.participants?.find((p) => p.userId !== currentUserId);
    return p?.user ?? null;
  }, [conv, currentUserId]);

  const name = useMemo(() => {
    if (!conv) return '';
    if (conv.type === 'GROUP') return conv.name || 'Group Chat';
    if (conv.type === 'RECORD_THREAD') return `${conv.recordType} Discussion`;
    return otherParticipant
      ? `${otherParticipant.firstName} ${otherParticipant.lastName}`
      : 'Direct Message';
  }, [conv, otherParticipant]);

  const subtitle = useMemo(() => {
    if (!conv) return '';
    if (conv.type === 'GROUP') {
      const count = conv.participants?.length ?? 0;
      return `${count} member${count !== 1 ? 's' : ''}`;
    }
    if (conv.type === 'RECORD_THREAD') return 'Record discussion';
    return otherParticipant?.role?.replace(/_/g, ' ') || 'Staff';
  }, [conv, otherParticipant]);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white border-b border-gray-100">
      <button
        onClick={onBack}
        className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
      >
        <ArrowLeft size={15} />
      </button>

      {conv?.type === 'GROUP' ? (
        <GroupAvatar size="md" />
      ) : (
        <Avatar user={otherParticipant} size="md" online />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate leading-tight">{name}</p>
        <p className="text-[10px] text-gray-400 capitalize truncate">{subtitle}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onVideoCall}
          className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 transition-colors"
          title="Start video call"
        >
          <Video size={14} />
        </button>
        <button
          className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10 transition-colors"
          title="Voice call (coming soon)"
        >
          <Phone size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── InboxList ────────────────────────────────────────────────────────────────

function InboxList({ conversations, currentUserId, activeConversationId, onOpen, onNew }) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 bg-white">
        <div className="w-14 h-14 rounded-full bg-brand-purple/10 flex items-center justify-center mb-3">
          <MessageSquare size={22} className="text-brand-purple/40" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1">No conversations</p>
        <p className="text-[10px] text-gray-400 mb-4">Start a conversation with anyone</p>
        <button
          onClick={onNew}
          className="px-4 py-2 bg-brand-purple text-white text-xs font-semibold rounded-full hover:bg-brand-purple/90 transition-colors"
        >
          New Message
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
      {conversations.map((conv) => {
        const isGroup = conv.type === 'GROUP';
        const other = !isGroup ? conv.participants?.find((p) => p.userId !== currentUserId) : null;
        const name = isGroup
          ? (conv.name || 'Group')
          : (other?.user ? `${other.user.firstName} ${other.user.lastName}` : 'Direct Message');
        const lastMsg = conv.lastMessage;
        const unread = conv.unreadCount ?? 0;
        const isActive = activeConversationId === conv.id;

        return (
          <button
            key={conv.id}
            onClick={() => onOpen(conv.id)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b border-gray-50',
              isActive ? 'bg-brand-purple/5 border-l-2 border-l-brand-purple' : 'hover:bg-gray-50',
            )}
          >
            <div className="relative shrink-0">
              {isGroup ? (
                <GroupAvatar size="md" />
              ) : (
                <Avatar user={other?.user} size="md" />
              )}
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 bg-brand-purple text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <p className={cn(
                  'text-sm font-semibold truncate',
                  unread > 0 ? 'text-brand-purple' : 'text-gray-900',
                )}>
                  {name}
                </p>
                {lastMsg && (
                  <span className="text-[9px] text-gray-400 shrink-0 font-medium">{timeAgo(lastMsg.createdAt)}</span>
                )}
              </div>
              {lastMsg && (
                <p className={cn(
                  'text-[11px] truncate',
                  unread > 0 ? 'text-gray-800 font-medium' : 'text-gray-400',
                )}>
                  {lastMsg.senderId === currentUserId && <span className="text-gray-500">You: </span>}
                  {lastMsg.body || '📎 Attachment'}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── PanelHeader ──────────────────────────────────────────────────────────────

function PanelHeader({ user, onClose, onNew, activeTab, onTabChange, chatUnreadCount }) {
  return (
    <div className="bg-white border-b border-gray-100">
      {/* Top row: title + actions */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <Avatar user={user} size="sm" online />
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : 'Messages'}
            </p>
            <p className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">● Online</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {activeTab === 'messages' && (
            <button
              onClick={onNew}
              className="h-7 w-7 rounded-full bg-brand-purple text-white flex items-center justify-center hover:bg-brand-purple/90 transition-colors"
              title="New conversation"
            >
              <Plus size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex border-t border-gray-100">
        <button
          onClick={() => onTabChange('messages')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors relative',
            activeTab === 'messages'
              ? 'text-brand-purple'
              : 'text-gray-400 hover:text-gray-600',
          )}
        >
          <MessageSquare size={13} />
          Messages
          {chatUnreadCount > 0 && activeTab !== 'messages' && (
            <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
              {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
            </span>
          )}
          {activeTab === 'messages' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-purple" />
          )}
        </button>

        <button
          onClick={() => onTabChange('ai')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors relative',
            activeTab === 'ai'
              ? 'text-violet-700'
              : 'text-gray-400 hover:text-gray-600',
          )}
        >
          <Sparkles size={13} />
          AI
          {activeTab === 'ai' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-violet-600" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── GreetingBanner ───────────────────────────────────────────────────────────

function GreetingBanner({ user, onDismiss }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = user?.firstName || 'there';

  return (
    <div className="mx-3 mt-3 p-3 bg-brand-purple text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -right-6 w-20 h-20 rounded-full bg-white/5" />

      <div className="relative z-10">
        <p className="text-xs font-bold opacity-80 uppercase tracking-widest">{greeting}</p>
        <p className="text-sm font-bold mt-0.5">{name} 👋</p>
        <p className="text-[10px] opacity-70 mt-1 leading-relaxed">
          You have your inbox open. Start a conversation with staff, parents, or learners.
        </p>
        <button
          onClick={onDismiss}
          className="mt-2 text-[10px] font-semibold opacity-70 hover:opacity-100 underline transition-opacity"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Main ChatPanel ───────────────────────────────────────────────────────────

export default function ChatPanel({ onClose, initialTab = 'messages', currentPage, onNavigate }) {
  const { user } = useAuth();
  const { conversations, activeConversationId, openConversation, isChatOpen, unreadTotal } = useChat();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [view, setView] = useState('inbox');     // 'inbox' | 'thread' | 'new'
  const [showGreeting, setShowGreeting] = useState(true);
  const [showVideoFromHeader, setShowVideoFromHeader] = useState(false);
  const greetingDismissed = useRef(false);

  // Honour external tab switches (e.g. when ASK_AI_EVENT fires)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Auto-dismiss greeting after 8s
  useEffect(() => {
    if (!showGreeting || greetingDismissed.current) return;
    const t = setTimeout(() => setShowGreeting(false), 8000);
    return () => clearTimeout(t);
  }, [showGreeting]);

  // Switch to thread view when an active conversation is set
  useEffect(() => {
    if (activeConversationId) setView('thread');
  }, [activeConversationId]);

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  const handleBack = (target = 'inbox') => {
    setView(target);
    setShowVideoFromHeader(false);
  };

  const handleNew = () => {
    setView('new');
  };

  // ── Messages tab body ──────────────────────────────────────────────────────
  const renderMessagesBody = () => {
    if (view === 'new') {
      return <NewConversation onBack={handleBack} />;
    }

    if (view === 'thread') {
      if (!activeConversationId) {
        return (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-brand-purple/40" />
          </div>
        );
      }
      return (
        <MessageThread
          conversationId={activeConversationId}
          conv={activeConv}
          currentUserId={user?.id}
          showVideoModal={showVideoFromHeader}
          onVideoModalClose={() => setShowVideoFromHeader(false)}
        />
      );
    }

    return (
      <div className="flex flex-col h-full">
        {showGreeting && !greetingDismissed.current && (
          <GreetingBanner
            user={user}
            onDismiss={() => { setShowGreeting(false); greetingDismissed.current = true; }}
          />
        )}
        <InboxList
          conversations={conversations}
          currentUserId={user?.id}
          activeConversationId={activeConversationId}
          onOpen={(id) => { openConversation(id); setView('thread'); }}
          onNew={handleNew}
        />
      </div>
    );
  };

  // ── Thread / new-conversation sub-headers (messages tab only) ─────────────
  const renderMessagesSubHeader = () => {
    if (activeTab !== 'messages') return null;

    if (view === 'thread') {
      return (
        <div className="flex items-center justify-between border-b border-gray-100 bg-white">
          {activeConv ? (
            <ThreadHeader
              conv={activeConv}
              currentUserId={user?.id}
              onBack={handleBack}
              onVideoCall={() => setShowVideoFromHeader(true)}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 flex-1">
              <button
                onClick={handleBack}
                className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={15} />
              </button>
              <Loader2 size={14} className="animate-spin text-gray-400" />
            </div>
          )}
          <button
            onClick={onClose}
            className="h-7 w-7 mr-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      );
    }

    if (view === 'new') {
      return (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-100">
          <button
            onClick={handleBack}
            className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">New Message</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Search for a person</p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Shared panel header with tab strip
          Hidden when drilling into thread/new-message (those have their own headers) */}
      {!(activeTab === 'messages' && (view === 'thread' || view === 'new')) && (
        <PanelHeader
          user={user}
          onClose={onClose}
          onNew={handleNew}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          chatUnreadCount={unreadTotal}
        />
      )}

      {/* Thread / new-message sub-headers */}
      {renderMessagesSubHeader()}

      {/* Tab bodies */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'messages' && renderMessagesBody()}

        {activeTab === 'ai' && (
          <AIAssistantPanel
            currentPage={currentPage}
            user={user}
            onNavigate={onNavigate}
            isActive={activeTab === 'ai'}
          />
        )}
      </div>
    </div>
  );
}
