/**
 * NotificationCenter
 *
 * Unified notification feed — replaces the 400px bell popover with a full-page
 * experience. Combines all notification types into one scrollable, filterable,
 * AI-aware timeline.
 *
 * Features:
 *  ✦ All types in one feed, grouped by day
 *  ✦ Filter tabs: All · Approvals · Messages · Alerts · LMS · System
 *  ✦ Cursor-based "Load more" pagination (no page numbers)
 *  ✦ Mark single / mark all as read
 *  ✦ AI briefing card at the top (powered by get_notification_summary tool)
 *  ✦ Deep-link navigation on click
 *  ✦ Real-time: new notifications slide in via UserNotificationContext socket
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import {
  Bell, CheckCheck, Loader2, Sparkles, ArrowRight,
  ClipboardList, GitBranch, Zap, BookOpen, Info,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  MessageSquare, Filter, MailOpen, ChevronDown,
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useUserNotifications } from '../../../contexts/UserNotificationContext';
import { useChat } from '../../../contexts/ChatContext';
import { aiAPI } from '../../../services/api/ai.api';
import api from '../../../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

const FILTER_TABS = [
  { key: 'all',       label: 'All',       icon: Bell },
  { key: 'APPROVAL',  label: 'Approvals', icon: ClipboardList },
  { key: 'chat',      label: 'Messages',  icon: MessageSquare },
  { key: 'ERROR,WARNING', label: 'Alerts', icon: AlertTriangle },
  { key: 'INFO,SUCCESS',  label: 'LMS / Info', icon: BookOpen },
  { key: 'GIT_UPDATE',    label: 'System',     icon: GitBranch },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGroupDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function groupByDay(items) {
  const groups = [];
  let currentDay = null;
  let currentGroup = null;
  for (const item of items) {
    const day = new Date(item.createdAt).toDateString();
    if (day !== currentDay) {
      currentDay = day;
      currentGroup = { day: item.createdAt, label: formatGroupDate(item.createdAt), items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(item);
  }
  return groups;
}

// ─── Type config for icons / colours ──────────────────────────────────────────

const TYPE_CONFIG = {
  INFO:       { icon: Info,          color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100' },
  SUCCESS:    { icon: CheckCircle2,  color: 'text-emerald-500',bg: 'bg-emerald-50',border: 'border-emerald-100' },
  WARNING:    { icon: AlertTriangle, color: 'text-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  ERROR:      { icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100' },
  WAIVER:     { icon: CheckCircle2,  color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-100' },
  GIT_UPDATE: { icon: GitBranch,     color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  APPROVAL:   { icon: ClipboardList, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
};

const fallbackConfig = { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100' };

// ─── AI Briefing Card ─────────────────────────────────────────────────────────

function AIBriefingCard({ currentPage, onNavigate }) {
  const [loading, setLoading]   = useState(true);
  const [brief, setBrief]       = useState('');
  const [data, setData]         = useState(null);
  const [error, setError]       = useState('');
  const [sessionId]             = useState(() => {
    const k = 'trendscore:notif-center-session';
    const ex = localStorage.getItem(k);
    if (ex) return ex;
    const id = `nc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(k, id);
    return id;
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    aiAPI.chat({
      message: 'Give me a brief summary of my current notifications and what needs attention most urgently.',
      currentRoute: '/app/notification-center',
      sessionId,
    })
      .then((res) => {
        if (!active) return;
        const payload = res?.data || res;
        setBrief(payload?.message || '');
        setData(payload?.data || null);
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Could not load AI brief.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId]);

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-lg bg-violet-700 p-1.5 text-white">
          <Sparkles size={14} />
        </div>
        <p className="text-xs font-black text-violet-900 uppercase tracking-widest">AI Briefing</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-violet-600">
          <Loader2 size={13} className="animate-spin" />
          Analysing your notifications…
        </div>
      )}
      {error && !loading && (
        <p className="text-xs text-rose-600">{error}</p>
      )}
      {!loading && brief && (
        <p className="text-sm text-slate-700 leading-relaxed">{brief}</p>
      )}

      {/* Quick-action pills from pending approvals */}
      {data?.pendingApprovals?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.pendingApprovals.slice(0, 3).map((a) => (
            <button
              key={a.id}
              onClick={() => onNavigate?.('settings-approvals')}
              className="inline-flex items-center gap-1 rounded-full bg-violet-700 px-3 py-1 text-[10px] font-black text-white hover:bg-violet-800 transition-colors"
            >
              <ClipboardList size={10} />
              {a.title}
              <ArrowRight size={9} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper: parse notification metadata safely ───────────────────────────────

function parseMeta(notification) {
  const raw = notification?.metadata;
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw;
}

// ─── Single Notification Row ──────────────────────────────────────────────────

function NotificationRow({ notification, onMarkRead, onNavigate }) {
  const cfg = TYPE_CONFIG[notification.type] || fallbackConfig;
  const Icon = cfg.icon;
  const isUnread = !notification.isRead;
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');
  const [approved, setApproved] = useState(false);
  const { fetchNotifications } = useUserNotifications();

  const meta = parseMeta(notification);
  const isFeeApproval = meta.kind === 'FEE_CONFIGURATION_APPROVAL';

  // Navigate to the right destination for this notification type
  const navigateToTarget = () => {
    if (isFeeApproval && meta.learnerId) {
      onNavigate?.('learner-profile', { learnerId: meta.learnerId, tab: 'financials' });
      return;
    }
    if (notification.link) {
      const page   = notification.link.replace(/^\/app\//, '').split('?')[0];
      const paramStr = notification.link.includes('?') ? notification.link.split('?')[1] : '';
      const params   = paramStr ? Object.fromEntries(new URLSearchParams(paramStr).entries()) : {};
      onNavigate?.(page, params);
    }
  };

  const handleClick = () => {
    if (isUnread) onMarkRead(notification.id);
    navigateToTarget();
  };

  // Inline approve — lets ADMIN/SUPER_ADMIN approve without leaving the center
  const handleApprove = async (e) => {
    e.stopPropagation();
    if (!meta.configurationId) { setApproveError('Missing configuration ID'); return; }
    setApproving(true);
    setApproveError('');
    try {
      await api.fees.approveLearnerFeeConfiguration(meta.configurationId);
      await onMarkRead(notification.id);
      await fetchNotifications();
      setApproved(true);
    } catch (err) {
      setApproveError(err?.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors group border-b border-gray-50 last:border-0',
        isUnread ? 'bg-white hover:bg-violet-50/40' : 'bg-white/60 hover:bg-gray-50',
        approved && 'opacity-60',
      )}
    >
      {/* Type icon */}
      <div className={cn('shrink-0 mt-0.5 rounded-xl p-2 border', cfg.bg, cfg.border)}>
        <Icon size={14} className={cfg.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn(
            'text-sm truncate',
            isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-600',
          )}>
            {notification.title}
          </p>
          <span className="text-[10px] text-gray-400 shrink-0 font-medium">
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        <p className={cn(
          'mt-0.5 text-xs leading-relaxed line-clamp-2',
          isUnread ? 'text-gray-700' : 'text-gray-400',
        )}>
          {notification.message}
        </p>

        {/* Fee-config approval actions */}
        {isFeeApproval && isUnread && !approved && (
          <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait"
            >
              {approving ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle2 size={9} />}
              {approving ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (isUnread) onMarkRead(notification.id); navigateToTarget(); }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50"
            >
              Open profile <ArrowRight size={9} />
            </button>
            {approveError && (
              <span className="text-[10px] font-semibold text-red-500">{approveError}</span>
            )}
          </div>
        )}

        {approved && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <CheckCircle2 size={9} /> Approved
          </span>
        )}

        {/* Standard "Open" link for non-fee notifications */}
        {!isFeeApproval && notification.link && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 group-hover:text-violet-800">
            Open <ArrowRight size={9} />
          </span>
        )}
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-violet-600" />
      )}
    </button>
  );
}

// ─── Chat Unread Row ──────────────────────────────────────────────────────────

function ChatUnreadSection({ count, onNavigate, setIsChatOpen }) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setIsChatOpen?.(true);
        onNavigate?.('comm-messages');
      }}
      className="w-full flex items-start gap-3 px-4 py-3.5 text-left bg-white hover:bg-indigo-50/40 transition-colors border-b border-gray-50 group"
    >
      <div className="shrink-0 mt-0.5 rounded-xl p-2 bg-indigo-50 border border-indigo-100">
        <MessageSquare size={14} className="text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">
          {count} unread message{count > 1 ? 's' : ''}
        </p>
        <p className="mt-0.5 text-xs text-gray-700 leading-relaxed">
          Open the Messages tab in the chat panel to reply.
        </p>
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 group-hover:text-indigo-800">
          Open Chat <ArrowRight size={9} />
        </span>
      </div>
      <div className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-indigo-600" />
    </button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyFeed({ activeFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Bell size={24} className="opacity-30" />
      </div>
      <p className="text-sm font-black uppercase tracking-widest text-gray-400">All clear</p>
      <p className="text-xs text-gray-400 mt-1">
        {activeFilter === 'all'
          ? 'No notifications yet.'
          : `No ${activeFilter.toLowerCase()} notifications.`}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationCenter({ user, onNavigate }) {
  const {
    notifications: liveNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  } = useUserNotifications();

  const { unreadTotal: chatUnread, setIsChatOpen } = useChat();

  // Paged items fetched directly (separate from the context which holds last-30)
  const [pagedItems, setPagedItems]   = useState([]);
  const [cursor, setCursor]           = useState(null);
  const [hasMore, setHasMore]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const loadedRef = useRef(false);

  // ── Initial load ────────────────────────────────────────────────────────────
  const loadPage = useCallback(async (filterKey, afterCursor) => {
    const isInitial = !afterCursor;
    if (isInitial) setInitialLoading(true);
    else setLoadingMore(true);

    try {
      const typeParam = filterKey === 'all' || filterKey === 'chat'
        ? undefined
        : filterKey;

      const resp = await api.userNotifications.getPaged({
        limit: PAGE_SIZE,
        cursor: afterCursor || undefined,
        type:   typeParam,
      });

      const items = resp?.data ?? [];
      if (isInitial) {
        setPagedItems(items);
      } else {
        setPagedItems((prev) => [...prev, ...items]);
      }
      setHasMore(items.length === PAGE_SIZE);
      if (items.length > 0) {
        setCursor(items[items.length - 1].createdAt);
      }
    } catch (err) {
      console.error('[NotificationCenter] load failed', err);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load on mount and filter change
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    loadPage(activeFilter, null);
    loadedRef.current = true;
  }, [activeFilter, loadPage]);

  // Merge live socket notifications into the top of the paged list
  useEffect(() => {
    if (!loadedRef.current) return;
    setPagedItems((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const newOnes = liveNotifications.filter((n) => !existingIds.has(n.id));
      if (newOnes.length === 0) return prev;
      return [...newOnes, ...prev];
    });
  }, [liveNotifications]);

  // ── Mark read ───────────────────────────────────────────────────────────────
  const handleMarkRead = useCallback(async (id) => {
    await markAsRead(id);
    setPagedItems((prev) =>
      prev.map((n) => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
    );
  }, [markAsRead]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllAsRead();
    setPagedItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, [markAllAsRead]);

  // ── Filter the displayed items ──────────────────────────────────────────────
  const displayedItems = useMemo(() => {
    if (activeFilter === 'all' || activeFilter === 'chat') return pagedItems;
    const types = new Set(activeFilter.split(','));
    return pagedItems.filter((n) => types.has(n.type));
  }, [pagedItems, activeFilter]);

  const grouped = useMemo(() => groupByDay(displayedItems), [displayedItems]);

  const totalUnread = unreadCount + chatUnread;

  return (
    <div className="min-h-full bg-[var(--app-page-bg)]">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900">Notification Center</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalUnread > 0
                ? `${totalUnread} item${totalUnread > 1 ? 's' : ''} need${totalUnread === 1 ? 's' : ''} attention`
                : 'You\'re all caught up'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { loadPage(activeFilter, null); fetchNotifications(); }}
              className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-brand-purple hover:border-brand-purple/30 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:text-brand-purple hover:border-brand-purple/30 transition-colors"
              >
                <MailOpen size={13} />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* ── AI Briefing ───────────────────────────────────────────────── */}
        <AIBriefingCard currentPage="notification-center" onNavigate={onNavigate} />

        {/* ── Filter tabs ───────────────────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors',
                  isActive
                    ? 'bg-brand-purple text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-brand-purple/30 hover:text-brand-purple',
                )}
              >
                <Icon size={11} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Notification feed ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">

          {/* Chat unread banner — only on 'all' and 'chat' tabs */}
          {(activeFilter === 'all' || activeFilter === 'chat') && chatUnread > 0 && (
            <ChatUnreadSection
              count={chatUnread}
              onNavigate={onNavigate}
              setIsChatOpen={setIsChatOpen}
            />
          )}

          {initialLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-xs">
              <Loader2 size={16} className="animate-spin" />
              Loading notifications…
            </div>
          ) : grouped.length === 0 ? (
            <EmptyFeed activeFilter={activeFilter} />
          ) : (
            grouped.map((group) => (
              <div key={group.day}>
                {/* Day separator */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-gray-300">
                    · {group.items.length} item{group.items.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Items */}
                {group.items.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ))
          )}

          {/* Load more */}
          {hasMore && !initialLoading && grouped.length > 0 && (
            <div className="p-4 border-t border-gray-100">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => loadPage(activeFilter, cursor)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-white hover:text-brand-purple hover:border-brand-purple/30 transition-colors disabled:opacity-40"
              >
                {loadingMore
                  ? <><Loader2 size={12} className="animate-spin" /> Loading…</>
                  : <><ChevronDown size={12} /> Load earlier notifications</>
                }
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
