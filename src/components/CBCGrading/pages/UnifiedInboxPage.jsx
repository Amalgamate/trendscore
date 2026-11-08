import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArrowLeft, BellOff, CheckCheck, Gift, Inbox, Loader2, Mail,
  MessageCircle, Pin, Plus, RotateCcw, Search, Send, Sparkles, User, X,
} from 'lucide-react';
import { chatAPI } from '../../../services/api/chat.api';
import api, { communicationAPI } from '../../../services/api';
import { useChat } from '../../../contexts/ChatContext';

const FILTERS = [
  { id: 'all', label: 'All messages', icon: Inbox, color: 'text-blue-800', selected: 'bg-blue-50 text-blue-950' },
  { id: 'unread', label: 'Unread', icon: Mail, color: 'text-indigo-700', selected: 'bg-indigo-50 text-indigo-950' },
  { id: 'in_app', label: 'In-app chat', icon: MessageCircle, color: 'text-violet-700', selected: 'bg-violet-50 text-violet-950' },
  { id: 'sms', label: 'SMS', icon: Mail, color: 'text-teal-700', selected: 'bg-teal-50 text-teal-950' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-700', selected: 'bg-emerald-50 text-emerald-950' },
  { id: 'email', label: 'Email', icon: Mail, color: 'text-orange-700', selected: 'bg-orange-50 text-orange-950' },
  { id: 'announcements', label: 'Announcements', icon: Mail, color: 'text-sky-700', selected: 'bg-sky-50 text-sky-950' },
  { id: 'birthdays', label: 'Birthdays', icon: Gift, color: 'text-pink-700', selected: 'bg-pink-50 text-pink-950' },
  { id: 'outbox', label: 'Outbox', icon: Send, color: 'text-blue-700', selected: 'bg-blue-50 text-blue-950' },
  { id: 'archived', label: 'Archived', icon: Archive, color: 'text-slate-600', selected: 'bg-slate-100 text-slate-950' },
];

const MESSAGE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT']);
const BROADCAST_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']);

const SAMPLE_MESSAGES = [
  {
    id: 'sample-in-app', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · In-app chat', subtitle: 'Class teacher', channel: 'IN_APP', status: 'Sample', category: 'message',
    preview: 'The class revision notes are ready to view.',
    body: 'Hello families, the class revision notes are ready to view in the Digital Diary. Please ask your learner to review pages 12–15 before Friday.',
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), unreadCount: 0, archivable: false,
  },
  {
    id: 'sample-sms', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · SMS', subtitle: 'Grade 5', channel: 'SMS', status: 'Sample', category: 'message',
    preview: 'Reminder: school closes at 3:30 pm today.',
    body: 'ZAWADI ACADEMY: Reminder that school closes at 3:30 pm today. Please arrange collection on time.',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), unreadCount: 0, archivable: false,
  },
  {
    id: 'sample-whatsapp', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · WhatsApp', subtitle: 'Grade 3', channel: 'WHATSAPP', status: 'Sample', category: 'message',
    preview: 'A reminder from the school office.',
    body: 'Good afternoon. Please remember to send your child with a labelled water bottle for tomorrow’s sports activity. Thank you.',
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(), unreadCount: 0, archivable: false,
  },
  {
    id: 'sample-email', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · Email', subtitle: 'School office', channel: 'EMAIL', status: 'Sample', category: 'message',
    preview: 'Term dates and parent meeting information.',
    body: 'Dear parent, the term dates and parent meeting schedule are available from the school office. This is a sample email preview only.',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), unreadCount: 0, archivable: false,
  },
  {
    id: 'sample-announcement', kind: 'announcement', source: 'sample', sampleOnly: true,
    name: 'Sample · Announcement', subtitle: 'School notice', channel: 'IN_APP', status: 'Sample',
    preview: 'The inter-house games will take place next Thursday.',
    body: 'The inter-house games will take place next Thursday. Learners should come in their house colours and bring a packed lunch.',
    timestamp: new Date(Date.now() - 4 * 86400000).toISOString(), unreadCount: 0, archivable: false,
  },
  {
    id: 'sample-birthday', kind: 'delivery', source: 'sample', sampleOnly: true,
    name: 'Sample · Birthday wishes', subtitle: 'Grade 2', channel: 'WHATSAPP', status: 'Sample', category: 'birthday',
    preview: 'Happy birthday, Amani! 🎂',
    body: 'Happy birthday, Amani! 🎂 The TrendSCORE school community wishes you a joyful day and a wonderful year ahead.',
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), unreadCount: 0, archivable: false,
  },
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
  const isBirthday = item.category === 'birthday';
  const isFailed = ['FAILED', 'BOUNCED'].includes(String(item.status || '').toUpperCase());
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition ${active ? (isBirthday ? 'bg-pink-50' : 'bg-blue-50') : 'bg-white hover:bg-slate-50'}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${isBirthday ? 'bg-pink-100 text-pink-800 ring-2 ring-white' : item.kind === 'announcement' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-900 ring-2 ring-white'}`}>
        {isBirthday ? <Gift size={19} /> : item.kind === 'announcement' ? <Mail size={18} /> : initials(item.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${unread ? 'font-extrabold text-slate-950' : 'font-bold text-slate-800'}`}>{item.name}</span>
          <span className="shrink-0 text-[10px] text-slate-500">{timeLabel(item.timestamp)}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-600">{item.preview || (item.kind === 'announcement' ? 'School announcement' : 'Start the conversation')}</span>
        <span className={`mt-1 flex items-center gap-1.5 text-[10px] capitalize ${isBirthday ? 'text-pink-700' : isFailed ? 'text-red-700' : item.sampleOnly ? 'font-bold text-blue-700' : 'text-slate-500'}`}>
          {item.pinned && <Pin size={10} className="text-blue-700" />}
          {item.sampleOnly
            ? `Sample preview · ${item.channel}`
            : item.kind === 'announcement'
            ? 'In-app announcement'
            : item.kind === 'delivery'
              ? `${item.category === 'birthday' ? 'Birthday' : 'Delivery'} · ${item.channel} · ${item.status}`
              : item.kind === 'broadcast'
                ? `Broadcast · ${item.channel} · ${item.status}`
                : roleLabel(item.subtitle || 'school contact')}
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

export default function UnifiedInboxPage({ user, onNavigate }) {
  const { conversations, fetchInbox, openConversation, sendMessage, messagesByConv } = useChat();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [sentChatItems, setSentChatItems] = useState([]);
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
  const [composeChannel, setComposeChannel] = useState(null);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [composeBody, setComposeBody] = useState('');
  const [composing, setComposing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [samplePreviewEnabled, setSamplePreviewEnabled] = useState(false);
  const [samplePreviewDismissed, setSamplePreviewDismissed] = useState(false);
  const recipientSearchSequence = useRef(0);

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
      // Channel history is supplementary; keep the in-app inbox available if
      // the account cannot access an external delivery log.
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
        channel: 'IN_APP',
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

  const hasRealMessages = conversations.length + receipts.length + deliveryItems.length > 0;
  const showSamplePreview = import.meta.env.DEV && !samplePreviewDismissed && (samplePreviewEnabled || (!loading && !hasRealMessages));

  const visibleItems = useMemo(() => {
    const samples = showSamplePreview ? SAMPLE_MESSAGES : [];
    let source;
    if (filter === 'archived') source = [...chatItems, ...receipts.filter(item => item.archivedAt)];
    else if (filter === 'outbox') source = [...sentChatItems, ...deliveryItems.filter(item => item.raw?.sentByUserId === user?.id || item.raw?.senderId === user?.id || item.raw?.campaign?.senderId === user?.id || item.raw?.sentBy?.id === user?.id), ...receipts.filter(item => item.raw?.message?.senderId === user?.id && item.status !== 'DRAFT')];
    else if (filter === 'announcements') source = [...receipts.filter(item => item.kind === 'announcement' && !item.archivedAt), ...samples.filter(item => item.kind === 'announcement')];
    else if (filter === 'in_app') source = [...chatItems, ...samples.filter(item => item.kind === 'delivery' && item.channel === 'IN_APP')];
    else if (filter === 'sms' || filter === 'whatsapp' || filter === 'email') {
      const channel = filter.toUpperCase();
      source = [...receipts, ...deliveryItems, ...samples].filter(item => item.channel === channel && !item.archivedAt);
    } else if (filter === 'birthdays') source = [...deliveryItems, ...samples].filter(item => item.category === 'birthday');
    else source = [...chatItems, ...receipts.filter(item => !item.archivedAt), ...deliveryItems, ...samples];
    return source
      .filter(item => filter !== 'unread' || Number(item.unreadCount || 0) > 0)
      .filter(item => `${item.name} ${item.preview}`.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [chatItems, deliveryItems, filter, receipts, search, sentChatItems, showSamplePreview, user?.id]);

  const filterCounts = useMemo(() => ({
    all: chatItems.length + receipts.filter(item => !item.archivedAt).length + deliveryItems.length + (showSamplePreview ? SAMPLE_MESSAGES.length : 0),
    unread: chatItems.reduce((count, item) => count + Number(item.unreadCount || 0), 0)
      + receipts.reduce((count, item) => count + (!item.archivedAt ? Number(item.unreadCount || 0) : 0), 0),
    in_app: chatItems.length + (showSamplePreview ? SAMPLE_MESSAGES.filter(item => item.kind === 'delivery' && item.channel === 'IN_APP').length : 0),
    sms: [...receipts, ...deliveryItems].filter(item => item.channel === 'SMS' && !item.archivedAt).length + (showSamplePreview ? SAMPLE_MESSAGES.filter(item => item.channel === 'SMS').length : 0),
    whatsapp: [...receipts, ...deliveryItems].filter(item => item.channel === 'WHATSAPP' && !item.archivedAt).length + (showSamplePreview ? SAMPLE_MESSAGES.filter(item => item.channel === 'WHATSAPP').length : 0),
    email: [...receipts, ...deliveryItems].filter(item => item.channel === 'EMAIL' && !item.archivedAt).length + (showSamplePreview ? SAMPLE_MESSAGES.filter(item => item.channel === 'EMAIL').length : 0),
    announcements: receipts.filter(item => item.kind === 'announcement' && !item.archivedAt).length + (showSamplePreview ? SAMPLE_MESSAGES.filter(item => item.kind === 'announcement').length : 0),
    birthdays: deliveryItems.filter(item => item.category === 'birthday').length + (showSamplePreview ? SAMPLE_MESSAGES.filter(item => item.category === 'birthday').length : 0),
    outbox: sentChatItems.length + deliveryItems.filter(item => item.raw?.sentByUserId === user?.id || item.raw?.senderId === user?.id || item.raw?.campaign?.senderId === user?.id || item.raw?.sentBy?.id === user?.id).length + receipts.filter(item => item.raw?.message?.senderId === user?.id && item.status !== 'DRAFT').length,
    archived: chatItems.filter(item => item.archivedAt).length + receipts.filter(item => item.archivedAt).length,
  }), [chatItems, deliveryItems, receipts, sentChatItems, showSamplePreview, user?.id]);

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
    setComposeChannel(null);
    setComposeBody('');
  };

  const chooseComposeChannel = (channel) => {
    if (channel === 'SMS' || channel === 'WHATSAPP') {
      window.sessionStorage.setItem('trendscore.broadcast.channel', channel.toLowerCase());
      onNavigate?.('comm-broadcasts');
      return;
    }
    setComposeChannel(channel);
  };

  const threadPane = selected ? (
    <section className={`min-h-0 flex-1 flex-col bg-white md:flex ${mode === 'thread' ? 'flex' : 'hidden'}`} aria-label="Conversation">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <button type="button" onClick={() => { setSelected(null); setMode('list'); }} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Back to inbox"><ArrowLeft size={18} /></button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-extrabold text-blue-900">{selected.kind === 'announcement' ? <Mail size={18} /> : initials(selected.name)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-slate-950">{selected.name}</h2>
          <p className="truncate text-xs capitalize text-slate-600">
            {selected.kind === 'announcement'
              ? 'School announcement'
              : selected.kind === 'delivery' || selected.kind === 'broadcast'
                ? `${selected.channel} · ${selected.status}`
                : roleLabel(selected.subtitle)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {selected.kind === 'conversation' && <>
            <button type="button" onClick={() => updateSelected({ pinned: !selected.pinned })} title={selected.pinned ? 'Unpin conversation' : 'Pin conversation'} className={`rounded-lg p-2 hover:bg-slate-100 ${selected.pinned ? 'text-blue-800' : 'text-slate-500'}`}><Pin size={17} /></button>
            <button type="button" onClick={() => updateSelected({ markUnread: true })} title="Mark unread" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Mail size={17} /></button>
            <button type="button" onClick={() => updateSelected({ mutedUntil: selected.mutedUntil && new Date(selected.mutedUntil) > new Date() ? null : new Date(Date.now() + 30 * 86400000).toISOString() })} title={selected.mutedUntil && new Date(selected.mutedUntil) > new Date() ? 'Unmute conversation' : 'Mute for 30 days'} className={`rounded-lg p-2 hover:bg-slate-100 ${selected.mutedUntil && new Date(selected.mutedUntil) > new Date() ? 'text-blue-800' : 'text-slate-500'}`}><BellOff size={17} /></button>
          </>}
          {['conversation', 'announcement'].includes(selected.kind) && selected.archivable !== false && <button type="button" onClick={() => updateSelected({ archived: !selected.archivedAt })} title={selected.archivedAt ? 'Restore to inbox' : 'Archive'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{selected.archivedAt ? <RotateCcw size={17} /> : <Archive size={17} />}</button>}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
        {selected.kind === 'announcement' ? (
          <article className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-blue-800">School announcement</p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.body}</p>
          </article>
        ) : selected.kind === 'delivery' || selected.kind === 'broadcast' ? (
          <article className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">{selected.channel}</span>
              <span className={`rounded-full px-3 py-1.5 ${selected.sampleOnly ? 'bg-blue-50 text-blue-800' : ['FAILED', 'BOUNCED'].includes(String(selected.status).toUpperCase()) ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{selected.status}</span>
              {selected.category === 'birthday' && <span className="rounded-full bg-pink-100 px-3 py-1.5 text-pink-800">Birthday wishes</span>}
            </div>
            {selected.sampleOnly && <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">Sample preview only. This message was not sent or saved.</p>}
            {selected.kind === 'broadcast' && <p className="text-sm text-slate-600">{selected.subtitle}</p>}
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.body || 'Message content is not available.'}</p>
            {selected.raw?.failureReason && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Delivery detail: {selected.raw.failureReason}</p>}
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">Sent {selected.timestamp ? new Date(selected.timestamp).toLocaleString() : 'date unavailable'}{selected.kind === 'delivery' && selected.subtitle ? ` · ${selected.subtitle}` : ''}</p>
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
        <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold text-slate-950">New message</h2><p className="text-xs text-slate-600">{composeChannel === 'IN_APP' ? getRecipientHint(user?.role) : 'Choose how to reach your audience.'}</p></div>
      </header>
      {!composeChannel ? (
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
      ) : <form onSubmit={startConversation} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <button type="button" onClick={() => setComposeChannel(null)} className="self-start text-xs font-bold text-blue-800 hover:underline">Change channel</button>
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
      </form>}
    </section>
  );

  return (
    <div className="flex h-full min-h-[calc(100dvh-10rem)] w-full flex-col overflow-hidden bg-white">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className={`order-2 min-h-0 flex-col bg-white md:order-1 ${mode === 'list' ? 'flex' : 'hidden md:flex'}`}>
          {mode === 'compose' ? composePane : selected ? threadPane : <>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 md:px-6">
              <div className="relative min-w-0 flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={filter === 'outbox' ? 'Search sent messages' : 'Search inbox'} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div>
              {filter === 'unread' && <span className="text-xs font-semibold text-slate-500">Unread messages</span>}
            </div>
            {error && <div role="alert" className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 md:mx-6"><span>{error}</span><button type="button" onClick={load} className="font-bold underline">Retry</button></div>}
            {showSamplePreview && <div role="status" className="flex items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900 md:px-6"><span><strong>Sample messages</strong> · local previews only; they are not sent or saved.</span><button type="button" onClick={() => { setSamplePreviewDismissed(true); setSamplePreviewEnabled(false); }} className="shrink-0 font-bold underline">Hide samples</button></div>}
            <div className="min-h-0 flex-1 overflow-y-auto bg-white">
              {loading && visibleItems.length === 0 ? <div className="flex justify-center py-12 text-blue-700"><Loader2 className="animate-spin" /></div> : visibleItems.length ? visibleItems.map(item => <ConversationRow key={`${item.kind}-${item.id}`} item={item} active={selected?.id === item.id} onClick={() => selectItem(item)} />) : <EmptyInbox archived={filter === 'archived'} onCompose={openCompose} />}
            </div>
            {visibleItems.length > 0 && filter !== 'archived' && filter !== 'outbox' && <button type="button" onClick={async () => { await Promise.all(chatItems.filter(item => item.unreadCount).map(item => chatAPI.markRead(item.id))); await load(); }} className="flex min-h-10 items-center justify-center gap-2 border-t border-slate-200 text-xs font-bold text-blue-800 hover:bg-blue-50"><CheckCheck size={15} />Mark conversations read</button>}
          </>}
        </div>

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
    </div>
  );
}
