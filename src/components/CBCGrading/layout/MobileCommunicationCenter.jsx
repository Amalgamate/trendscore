import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { communicationAPI } from '../../../services/api';
import { chatAPI } from '../../../services/api/chat.api';
import { useUserNotifications } from '../../../contexts/UserNotificationContext';

const tabs = [
  { id: 'inbox', label: 'Inbox', icon: MessageCircle },
  { id: 'messages', label: 'Messages', icon: Mail },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getChatTitle = (conversation, currentUserId) => {
  if (conversation?.name) return conversation.name;
  const other = conversation?.participants?.find((participant) => participant.userId !== currentUserId);
  const user = other?.user;
  return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Direct message';
};

const getCommunicationTitle = (receipt) =>
  receipt?.message?.subject || receipt?.message?.messageType || 'School message';

const MobileCommunicationCenter = ({ user, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const [loading, setLoading] = useState(false);
  const [chatInbox, setChatInbox] = useState([]);
  const [messageInbox, setMessageInbox] = useState([]);
  const [error, setError] = useState('');
  const {
    notifications = [],
    unreadCount = 0,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  } = useUserNotifications();

  const communicationUnread = useMemo(
    () => messageInbox.filter((receipt) => !receipt.readAt && receipt.status !== 'READ').length,
    [messageInbox]
  );

  const chatUnread = useMemo(
    () => chatInbox.reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0),
    [chatInbox]
  );

  const totalUnread = unreadCount + communicationUnread + chatUnread;

  const loadCenter = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [chatResponse, messageResponse] = await Promise.allSettled([
        chatAPI.getInbox(),
        communicationAPI.getInboxMessages(),
        fetchNotifications?.(),
      ]);

      if (chatResponse.status === 'fulfilled') {
        setChatInbox(chatResponse.value?.data || []);
      }
      if (messageResponse.status === 'fulfilled') {
        setMessageInbox(messageResponse.value?.data || []);
      }
      if (chatResponse.status === 'rejected' && messageResponse.status === 'rejected') {
        setError('Communication center is unavailable');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) loadCenter();
  }, [loadCenter, open]);

  const openCenter = () => {
    setOpen((current) => !current);
  };

  const openFullPage = () => {
    setOpen(false);
    if (activeTab === 'alerts') {
      onNavigate?.('notices');
    } else if (activeTab === 'messages') {
      onNavigate?.('comm-history');
    } else {
      onNavigate?.('comm-messages');
    }
  };

  const handleMessageRead = async (receipt) => {
    if (!receipt?.id) return;
    try {
      await communicationAPI.markMessageRead(receipt.id);
      setMessageInbox((prev) => prev.map((item) => (
        item.id === receipt.id ? { ...item, status: 'READ', readAt: new Date().toISOString() } : item
      )));
    } catch {
      setError('Could not mark message as read');
    }
  };

  const handleAlertRead = (notification) => {
    if (!notification?.id || notification.isRead) return;
    markAsRead?.(notification.id);
  };

  const renderInbox = () => (
    <div className="space-y-2">
      {chatInbox.slice(0, 5).map((conversation) => {
        const unread = Number(conversation.unreadCount || 0);
        const lastMessage = conversation.lastMessage;
        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onNavigate?.('comm-messages')}
            className="w-full rounded-xl border border-[#ff7900]/30 bg-white p-3 text-left text-[#06285a] shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{getChatTitle(conversation, user?.id)}</p>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#06285a]/60">
                  {lastMessage?.body || 'No messages yet'}
                </p>
              </div>
              {unread > 0 && (
                <span className="rounded-full bg-[#ff7900] px-2 py-0.5 text-[10px] font-black text-[#06285a]">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
          </button>
        );
      })}
      {chatInbox.length === 0 && <EmptyState label="No chat conversations yet" />}
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-2">
      {messageInbox.slice(0, 5).map((receipt) => {
        const unread = !receipt.readAt && receipt.status !== 'READ';
        return (
          <button
            key={receipt.id}
            type="button"
            onClick={() => handleMessageRead(receipt)}
            className={`w-full rounded-xl border p-3 text-left shadow-sm ${unread ? 'border-[#ff7900] bg-[#ff7900] text-[#06285a]' : 'border-[#ff7900]/30 bg-white text-[#06285a]'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{getCommunicationTitle(receipt)}</p>
                <p className="mt-1 line-clamp-2 text-xs font-semibold opacity-70">
                  {receipt.message?.body || 'Message received'}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-black opacity-70">
                {formatTime(receipt.createdAt || receipt.message?.createdAt)}
              </span>
            </div>
          </button>
        );
      })}
      {messageInbox.length === 0 && <EmptyState label="No communication messages" />}
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-2">
      {notifications.slice(0, 5).map((notification) => (
        <button
          key={notification.id}
          type="button"
          onClick={() => handleAlertRead(notification)}
          className={`w-full rounded-xl border p-3 text-left shadow-sm ${notification.isRead ? 'border-[#ff7900]/30 bg-white text-[#06285a]' : 'border-[#ff7900] bg-[#ff7900] text-[#06285a]'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{notification.title || 'Notification'}</p>
              <p className="mt-1 line-clamp-2 text-xs font-semibold opacity-70">
                {notification.message || notification.body || 'System alert'}
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-black opacity-70">
              {formatTime(notification.createdAt)}
            </span>
          </div>
        </button>
      ))}
      {notifications.length === 0 && <EmptyState label="No alerts" />}
    </div>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openCenter}
        className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#ff7900] bg-[#ff7900] text-[#06285a]"
        aria-expanded={open}
        aria-label="Open communication center"
      >
        <Bell size={16} />
        {totalUnread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full border-2 border-[#06285a] bg-white px-1 text-[9px] font-black text-[#06285a]">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[120] w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#ff7900] bg-[#06285a] text-white shadow-2xl">
          <div className="bg-[#ff7900] px-4 py-3 text-[#06285a]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-black">
                  <Sparkles size={15} />
                  Communication Center
                </p>
                <p className="text-[11px] font-bold opacity-75">Inbox, messages and system alerts</p>
              </div>
              <button type="button" onClick={loadCenter} className="rounded-full bg-[#06285a]/10 p-2" aria-label="Refresh communication center">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 border-b border-white/10 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-black ${active ? 'bg-white text-[#06285a]' : 'text-white/70'}`}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[21rem] overflow-y-auto p-3">
            {error && <div className="mb-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs font-bold text-red-700">{error}</div>}
            {loading && chatInbox.length === 0 && messageInbox.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-white/70">
                <Loader2 size={18} className="animate-spin" />
                Loading communication
              </div>
            ) : activeTab === 'inbox' ? renderInbox() : activeTab === 'messages' ? renderMessages() : renderAlerts()}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#ff7900] px-3 py-2 text-[11px] font-black text-white"
            >
              <CheckCheck size={13} />
              Mark alerts read
            </button>
            <button
              type="button"
              onClick={openFullPage}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff7900] px-3 py-2 text-[11px] font-black text-[#06285a]"
            >
              View all
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ label }) => (
  <div className="rounded-xl border border-white/15 bg-white/5 p-5 text-center text-xs font-bold text-white/60">
    {label}
  </div>
);

export default MobileCommunicationCenter;
