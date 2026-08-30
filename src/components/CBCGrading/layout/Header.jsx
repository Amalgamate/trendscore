import React, { useState, useRef, useEffect } from 'react';
import { Bell, Zap, ChevronDown, ClipboardList, BarChart3, MessageSquare, Calendar, Gift, User as UserIcon, GitBranch, Compass, HelpCircle } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { useRolePreview } from '../../../contexts/RolePreviewContext';
import api from '../../../services/api';
import { getReminderDelay, shouldScheduleReminder } from './notificationReminder';
import { clockInTeacher, clockOutTeacher, getCurrentUserClockInStatus, syncCurrentUserClockInStatus } from '../../../utils/teacherClockIn';
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { cn } from "../../../utils/cn";
import { useUserNotifications } from '../../../contexts/UserNotificationContext';
import { useChat } from '../../../contexts/ChatContext';
import { refreshBus } from '../../../utils/refreshBus';
import AccountSwitcherMenu from '../../common/AccountSwitcherMenu';
import ChatPanel from '../../chat/ChatPanel';
import SmsBalanceWidget from './SmsBalanceWidget';
import '../../../styles/notifications.css';

const Header = React.memo(({ user, onLogout, brandingSettings, title, onNavigate, showOnboarding, onOpenOnboarding, onboardingProgress, showHelp, onOpenHelp }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUnreadReminder, setShowUnreadReminder] = useState(false);
  const [birthdays, setBirthdays] = useState([]);
  const [latestNotices, setLatestNotices] = useState([]);
  const [, setLoadingBirthdays] = useState(false);
  const [readNotificationKeys, setReadNotificationKeys] = useState(() => new Set());
  const [reminderCycle, setReminderCycle] = useState(0);
  const [bellBuzzing, setBellBuzzing] = useState(false);
  const [clockInState, setClockInState] = useState(() => getCurrentUserClockInStatus(user));
  const [activeTermLabel, setActiveTermLabel] = useState('');
  const [activeTermMeta, setActiveTermMeta] = useState({ isFallback: false });
  
  // Real-time notifications from our new context.
  // `unreadNotifications` is pre-filtered to isRead:false so the bell
  // dropdown only ever shows notifications the user hasn't seen yet.
  const { 
    unreadNotifications: systemNotifications, 
    unreadCount: systemUnreadCount,
    lastBuzzAt,
    lastBuzzType,
    markAsRead,
    markAllAsRead: markAllSystemAsRead
  } = useUserNotifications();

  // Chat context for the messaging button
  const { unreadTotal: chatUnreadCount, isChatOpen, setIsChatOpen } = useChat();
  const [chatInitialTab, setChatInitialTab] = useState('messages');

  const notificationRef = useRef(null);
  const dropdownRef = useRef(null);
  const sessionStartedAtRef = useRef(Date.now());
  const { role } = usePermissions();

  // Listen for AI tab open requests (fired by AIAssistant when ASK_AI_EVENT is received)
  useEffect(() => {
    const handleOpenAITab = () => {
      setChatInitialTab('ai');
      setIsChatOpen(true);
    };
    window.addEventListener('trendscore:open-ai-tab', handleOpenAITab);
    return () => window.removeEventListener('trendscore:open-ai-tab', handleOpenAITab);
  }, [setIsChatOpen]);

  useEffect(() => {
    try {
      localStorage.removeItem('selectedInstitutionType');
    } catch {
      // Storage can be unavailable in restricted browser modes.
    }
  }, []);

  // Key is scoped to the resolved user id. We wait until user.id is available
  // before loading from localStorage so we never load from the 'unknown' key
  // created during the brief null-user window on app boot.
  const readStorageKey = user?.id
    ? `header_read_notifications_${user.id}`
    : null;
  const reminderStorageKey = `header_last_notification_reminder_${user?.id || user?.email || 'unknown'}`;
  const snoozeStorageKey = `header_notification_reminder_snooze_until_${user?.id || user?.email || 'unknown'}`;

  const portalLabel = (roleValue) => {
    const roleStr = String(roleValue || '').toUpperCase();
    if (roleStr === 'PARENT') return 'Parent Portal';
    if (roleStr === 'STUDENT') return 'Student Portal';
    return 'School Portal';
  };

  const portalPillClass = (roleValue) => {
    const roleStr = String(roleValue || '').toUpperCase();
    switch (roleStr) {
      case 'PARENT':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'STUDENT':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'TEACHER':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'HEAD_TEACHER':
      case 'HEAD_OF_CURRICULUM':
        return 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200';
      case 'ACCOUNTANT':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'RECEPTIONIST':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  const formatToday = () => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return new Date().toDateString();
    }
  };

  const termToLabel = (termVal) => {
    const t = String(termVal || '').toUpperCase();
    if (t === 'TERM_1') return 'Term 1';
    if (t === 'TERM_2') return 'Term 2';
    if (t === 'TERM_3') return 'Term 3';
    // Fallback for unexpected values
    return t ? t.replace(/_/g, ' ') : '';
  };

  // Fetch active term config for the appbar pill.
  // Date always renders immediately; term pill appears when fetch completes.
  useEffect(() => {
    let cancelled = false;

    const fetchActiveTerm = async () => {
      try {
        const resp = await api.config.getActiveTermConfig();
        const payload = resp?.data ?? resp ?? null;
        if (cancelled) return;

        if (payload?.term && payload?.academicYear) {
          setActiveTermLabel(`${termToLabel(payload.term)} · ${payload.academicYear}`);
          setActiveTermMeta({ isFallback: !!payload.isFallback });
          return;
        }

        setActiveTermLabel('');
        setActiveTermMeta({ isFallback: false });
      } catch {
        if (cancelled) return;
        setActiveTermLabel('');
        setActiveTermMeta({ isFallback: false });
      }
    };

    const unsub = refreshBus.on('term-config', fetchActiveTerm);
    fetchActiveTerm();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.id, user?.institutionType]);

  const birthdayNotificationItemsRaw = birthdays.map((b) => ({
    ...b,
    type: 'birthday',
    // Key must NOT include daysUntil — it changes daily and would make already-read
    // notifications reappear as new ones every day.
    key: `birthday-${b.id}-${b.turningAge}`
  }));

  const noticeNotificationItemsRaw = latestNotices.map((n) => ({
    ...n,
    type: 'notice',
    // Key must use only the stable id — publishedAt/createdAt can vary in format
    // between API calls and cause already-read notices to reappear.
    key: `notice-${n.id}`
  }));

  const birthdayNotificationItems = birthdayNotificationItemsRaw.filter(item => !readNotificationKeys.has(item.key));
  const noticeNotificationItems = noticeNotificationItemsRaw.filter(item => !readNotificationKeys.has(item.key));

  const notificationItems = [...birthdayNotificationItems, ...noticeNotificationItems];
  
  // Combined totals for the UI badge
  const totalUnreadCount = notificationItems.length + systemUnreadCount;

  useEffect(() => {
    if (!lastBuzzAt) return undefined;
    setBellBuzzing(true);
    const timer = setTimeout(() => setBellBuzzing(false), 1400);
    return () => clearTimeout(timer);
  }, [lastBuzzAt]);

  const markAllNotificationsAsRead = () => {
    setReadNotificationKeys((prev) => {
      const next = new Set(prev);
      notificationItems.forEach((item) => next.add(item.key));
      return next;
    });
    markAllSystemAsRead();
    setShowUnreadReminder(false);
  };

  const markLocalNotificationAsRead = (key) => {
    if (!key) return;
    setReadNotificationKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const snoozeReminder = () => {
    const snoozeUntil = Date.now() + (30 * 60 * 1000);
    try {
      localStorage.setItem(snoozeStorageKey, String(snoozeUntil));
    } catch { }
    setShowUnreadReminder(false);
    setReminderCycle((prev) => prev + 1);
  };

  const handleNotificationClick = (type, params = {}, key) => {
    markLocalNotificationAsRead(key);
    setShowNotifications(false);
    if (onNavigate) {
      if (type === 'birthday') {
        onNavigate('comm-notices', { activeTab: 'birthdays' });
      } else {
        onNavigate(type, params);
      }
    }
  };



  useEffect(() => {
    if (role === 'PARENT') {
      setBirthdays([]);
      return undefined;
    }
    const fetchBirthdays = async () => {
      setLoadingBirthdays(true);
      try {
        const resp = await api.learners.getBirthdays();
        if (resp.success) {
          setBirthdays(resp.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch birthdays:', error);
      } finally {
        setLoadingBirthdays(false);
      }
    };

    fetchBirthdays();
    const interval = setInterval(fetchBirthdays, 3600000);
    return () => clearInterval(interval);
  }, [role]);

  // Fetch latest notices for bell dropdown
  useEffect(() => {
    const fetchHeaderNotices = async () => {
      try {
        const resp = await api.notices.getAll();
        const notices = (resp?.data || []).slice(0, 5).map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          priority: n.priority,
          category: n.category,
          publishedAt: n.publishedAt,
          createdAt: n.createdAt
        }));
        setLatestNotices(notices);
      } catch (error) {
        console.error('Failed to fetch header notices:', error);
      }
    };

    fetchHeaderNotices();
    const interval = setInterval(fetchHeaderNotices, 300000);
    return () => clearInterval(interval);
  }, []);

  // Load persisted read-keys from localStorage. Only runs when readStorageKey
  // resolves to a real user-scoped key (i.e. after user.id is available).
  // This prevents loading from the 'unknown' fallback key and then immediately
  // discarding it when the real key arrives.
  useEffect(() => {
    if (!readStorageKey) return; // user not yet resolved — wait
    try {
      const raw = localStorage.getItem(readStorageKey);
      if (!raw) {
        setReadNotificationKeys(new Set());
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadNotificationKeys(new Set(parsed));
      }
    } catch {
      setReadNotificationKeys(new Set());
    }
  }, [readStorageKey]);

  // Persist read-keys back to localStorage whenever they change.
  // Guard against null readStorageKey (user not yet resolved).
  useEffect(() => {
    if (!readStorageKey) return;
    try {
      localStorage.setItem(readStorageKey, JSON.stringify(Array.from(readNotificationKeys)));
    } catch { }
  }, [readNotificationKeys, readStorageKey]);

  useEffect(() => {
    if (!shouldScheduleReminder({ unreadCount: totalUnreadCount })) {
      setShowUnreadReminder(false);
      return;
    }

    const now = Date.now();
    const snoozeUntil = Number(localStorage.getItem(snoozeStorageKey) || 0);
    if (snoozeUntil > now) {
      const snoozeTimer = setTimeout(() => {
        setShowUnreadReminder(true);
        try {
          localStorage.removeItem(snoozeStorageKey);
          localStorage.setItem(reminderStorageKey, String(Date.now()));
        } catch { }
        setReminderCycle((prev) => prev + 1);
      }, snoozeUntil - now);

      return () => clearTimeout(snoozeTimer);
    }

    if (snoozeUntil) {
      try {
        localStorage.removeItem(snoozeStorageKey);
      } catch { }
    }

    const lastReminderAt = Number(localStorage.getItem(reminderStorageKey) || 0) || null;
    const delay = getReminderDelay({
      unreadCount: totalUnreadCount,
      sessionStartedAt: sessionStartedAtRef.current,
      lastReminderAt,
      now
    });

    if (delay === null) return;

    const timer = setTimeout(() => {
      setShowUnreadReminder(true);
      try {
        localStorage.setItem(reminderStorageKey, String(Date.now()));
      } catch { }
      setReminderCycle((prev) => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [totalUnreadCount, reminderStorageKey, snoozeStorageKey, reminderCycle]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  useEffect(() => {
    let active = true;

    const refreshClockIn = async () => {
      // Check local status first to avoid immediate API call if already known
      const localStatus = getCurrentUserClockInStatus(user);
      if (localStatus.clockedIn) {
        setClockInState(localStatus);
      }
      
      const status = await syncCurrentUserClockInStatus(user);
      if (!active) return;
      setClockInState(status);
    };

    const handleClockInEvt = () => {
      if (!active) return;
      setClockInState(getCurrentUserClockInStatus(user));
    };

    refreshClockIn();
    window.addEventListener('teacherClockInChanged', handleClockInEvt);
    window.addEventListener('storage', handleClockInEvt);

    return () => {
      active = false;
      window.removeEventListener('teacherClockInChanged', handleClockInEvt);
      window.removeEventListener('storage', handleClockInEvt);
    };
  }, [user?.id]);

  const handleClockIn = async () => {
    await clockInTeacher(user, {
      source: 'header',
      role: user?.role
    });
    setClockInState(getCurrentUserClockInStatus(user));
  };

  const handleClockOut = async () => {
    await clockOutTeacher(user, {
      source: 'header',
      role: user?.role
    });
    setClockInState(getCurrentUserClockInStatus(user));
  };

  return (
    <>
    <header className="h-[var(--app-header-height)] bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm sticky top-0 z-50 app-header-loading">
      <div className="app-layout-row h-full flex items-center justify-between gap-4">
      <div className="min-w-0 flex items-center gap-3">
        <div className={cn(
          "inline-flex h-9 items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-[0.16em] shadow-sm",
          portalPillClass(user?.role)
        )}>
          {portalLabel(user?.role)}
        </div>
        <div className="hidden xl:flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          <span>{formatToday()}</span>
          {activeTermLabel && (
            <>
              <span className="h-1 w-1 rounded-full bg-gray-300" />
              <span className={cn(activeTermMeta.isFallback && "text-amber-600")}>{activeTermLabel}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        {showHelp && <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="hidden md:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label="Open help menu"
                title="Help"
              >
                <HelpCircle size={11} aria-hidden="true" /> Help <ChevronDown size={11} aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Help</div>
              <button type="button" onClick={onOpenHelp} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                <HelpCircle size={15} /> Help for this page
              </button>
            </PopoverContent>
        </Popover>}
        {showOnboarding && (
          <button
            type="button"
            onClick={onOpenOnboarding}
            className="hidden md:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            aria-label={`Open setup guide, ${onboardingProgress?.completed || 0} of ${onboardingProgress?.total || 0} complete`}
            title={`Setup: ${onboardingProgress?.completed || 0} of ${onboardingProgress?.total || 0} complete`}
          >
            <Compass size={11} aria-hidden="true" /> Setup {onboardingProgress?.completed || 0}/{onboardingProgress?.total || 0}
          </button>
        )}
        {(role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HEAD_TEACHER') && (
          <SmsBalanceWidget />
        )}



        {/* Notifications Popover */}
        {/* Bell popover — does NOT auto-mark-all on open.
            Items are marked read individually (on click) or via the
            explicit "Mark all read" button. This prevents the race where
            a mis-click would silently suppress notifications before the
            user actually saw them. */}
        <Popover open={showNotifications} onOpenChange={(open) => {
          setShowNotifications(open);
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "relative h-10 w-10 text-gray-600 hover:text-brand-purple hover:bg-brand-purple/5 transition-all outline-none ring-0",
                totalUnreadCount > 0 && "ripple-bell",
                bellBuzzing && "bell-buzz",
                bellBuzzing && lastBuzzType === 'APPROVAL' && "bell-buzz-approval"
              )}
            >
              <Bell size={20} className={cn(totalUnreadCount > 0 && "animate-wiggle")} />
              {totalUnreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center font-semibold text-[10px] border-2 border-white animate-in zoom-in-50 duration-300"
                >
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="notification-popover-content w-96 p-0 overflow-hidden" align="end">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-tight">Notifications</h3>
              {totalUnreadCount > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className="text-[10px] font-semibold uppercase tracking-widest text-brand-purple hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notificationItems.length > 0 ? (
                <div className="p-2 space-y-1">
                  {birthdayNotificationItems.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-3 py-2 text-[10px] font-semibold text-pink-500 uppercase tracking-widest flex items-center gap-2">
                        <Gift size={14} /> Birthdays
                      </div>
                      {birthdayNotificationItems.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => handleNotificationClick('birthday', {}, b.key)}
                          className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-all flex items-start gap-3 group"
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 shadow-sm border-2 transition-transform group-hover:scale-105",
                            b.isToday ? "bg-pink-600 text-white border-pink-200" : "bg-gray-100 text-gray-600 border-gray-200"
                          )}>
                            {b.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">
                              {b.isToday ? '🎂 ' : ''}{b.name}
                            </p>
                            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">
                              Turns {b.turningAge} • {b.grade.replace('_', ' ')}
                            </p>
                            <Badge variant={b.isToday ? "destructive" : "secondary"} className="mt-1.5 h-4 text-[8px] font-semibold px-1.5">
                              {b.isToday ? "TODAY" : `IN ${b.daysUntil} DAYS`}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {noticeNotificationItems.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-gray-50 mt-2">
                      <div className="px-3 py-2 text-[10px] font-semibold text-brand-purple uppercase tracking-widest flex items-center gap-2">
                        <Bell size={14} /> New Notices
                      </div>
                      {noticeNotificationItems.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotificationClick('comm-notices', { activeTab: 'notices', noticeId: n.id }, n.key)}
                          className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-all group"
                        >
                          <p className="text-sm font-medium text-gray-900 group-hover:text-brand-purple transition-colors line-clamp-1">{n.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.content}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {systemNotifications.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-gray-50 mt-2">
                      <div className="px-3 py-2 text-[10px] font-semibold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                        <Zap size={14} /> Approvals & Alerts
                      </div>
                      {systemNotifications.map((n) => {
                        const isGit = n.type === 'GIT_UPDATE';
                        const isApproval = n.type === 'APPROVAL';
                        const dotCls = n.type === 'SUCCESS' ? 'bg-emerald-500'
                          : n.type === 'ERROR' ? 'bg-rose-500'
                          : isApproval ? 'bg-violet-500'
                          : isGit ? 'bg-indigo-500'
                          : 'bg-amber-500';
                        return (
                        <button
                          key={n.id}
                          onClick={() => {
                            markAsRead(n.id);
                            setShowNotifications(false);
                            // Fee-config approval notifications carry a deep-link
                            // and a learnerId in metadata — route directly to the
                            // learner's financials tab so the approver can act.
                            const meta = (() => {
                              try { return typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {}); }
                              catch { return {}; }
                            })();
                            if (meta.kind === 'FEE_CONFIGURATION_APPROVAL' && meta.learnerId) {
                              onNavigate?.('learner-profile', { learnerId: meta.learnerId, tab: 'financials' });
                              return;
                            }
                            if (n.link) onNavigate?.(n.link.replace(/^\/app\//, '').split('?')[0]);
                          }}
                          className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-all group flex items-start gap-3"
                        >
                          {isGit
                            ? <GitBranch size={14} className="text-indigo-400 mt-1 flex-shrink-0" />
                            : isApproval
                              ? <ClipboardList size={14} className="text-violet-500 mt-1 flex-shrink-0" />
                            : <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${dotCls}`} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">{n.title}</p>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400">
                  <Bell size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-xs font-medium uppercase tracking-widest">No unread alerts</p>
                </div>
              )}
            </div>

            {/* Footer: View all + Close */}
            <div className="flex border-t border-gray-50">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowNotifications(false);
                  onNavigate?.('notification-center');
                }}
                className="flex-1 h-12 rounded-none text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-purple hover:bg-brand-purple/5 border-r border-gray-50"
              >
                View All
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowNotifications(false)}
                className="flex-1 h-12 rounded-none text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 hover:text-brand-purple hover:bg-brand-purple/5"
              >
                Close
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clock In/Out */}
        {String(user?.role || '').toUpperCase() === 'TEACHER' && (
          <Button
            onClick={clockInState.clockedIn ? handleClockOut : handleClockIn}
            variant={clockInState.clockedIn ? "secondary" : "outline"}
            className={cn(
              "hidden sm:flex h-10 px-4 font-semibold text-[10px] uppercase tracking-widest transition-all",
              clockInState.clockedIn ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "border-brand-purple/20 text-brand-purple hover:bg-brand-purple/5"
            )}
          >
            {clockInState.clockedIn ? 'Clock Out' : 'Clock In'}
          </Button>
        )}

        <div className="flex items-center gap-3 pl-4 border-l border-gray-100 ml-2">
          <div className="hidden lg:block text-right pr-2">
            <p className="text-sm font-semibold text-gray-900 leading-none">{user?.name || 'User'}</p>
            <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mt-1">
              {user?.role || 'Guest'}
            </p>
          </div>
          <AccountSwitcherMenu user={user} onLogout={onLogout} onProfile={() => onNavigate?.('settings-profile')} />
        </div>
      </div>

      {/* Unread Reminder Toast (Styled) */}
      {showUnreadReminder && totalUnreadCount > 0 && (
        <div className="fixed top-24 right-8 z-[140] w-80 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl p-5 animate-in slide-in-from-right-10 duration-500">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-full bg-brand-purple/10 text-brand-purple shadow-inner">
              <Bell size={20} className="animate-wiggle" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 uppercase tracking-tight">Gentle Reminder</p>
              <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">
                You have <span className="text-brand-purple font-semibold">{totalUnreadCount}</span> unread notification{totalUnreadCount === 1 ? '' : 's'}. Review them when convenient.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowUnreadReminder(false)} className="h-8 text-[9px] font-semibold uppercase flex-1 border-gray-200">
                  Later
                </Button>
                <Button variant="outline" size="sm" onClick={snoozeReminder} className="h-8 text-[9px] font-semibold uppercase flex-1 border-gray-200">
                  Snooze
                </Button>
                <Button size="sm" onClick={() => { setShowUnreadReminder(false); setShowNotifications(true); }} className="h-8 text-[9px] font-semibold uppercase flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-none">
                  Bell
                </Button>
                <Button size="sm" onClick={() => { setShowUnreadReminder(false); onNavigate?.('notification-center'); }} className="h-8 text-[9px] font-semibold uppercase flex-1 bg-brand-purple hover:bg-brand-purple/90 shadow-lg">
                  View All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </header>

    {/* ── Chat FAB — bottom-right floating button ────────────────────────── */}
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
      {/* Chat panel — slides up from the FAB */}
      {isChatOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setIsChatOpen(false); setChatInitialTab('messages'); }}
          />
          <div className="relative z-50 w-[380px] h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200">
            <ChatPanel
              onClose={() => { setIsChatOpen(false); setChatInitialTab('messages'); }}
              initialTab={chatInitialTab}
              currentPage={title}
              onNavigate={onNavigate}
            />
          </div>
        </>
      )}

      {/* FAB button */}
      <button
        onClick={() => {
          if (isChatOpen) {
            setIsChatOpen(false);
            setChatInitialTab('messages');
          } else {
            setIsChatOpen(true);
          }
        }}
        className={cn(
          "relative h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2",
          isChatOpen
            ? "bg-gray-700 hover:bg-gray-800 rotate-0"
            : "bg-brand-purple hover:bg-brand-purple/90"
        )}
        title="Messages & AI"
        aria-label="Open messages and AI"
      >
        <MessageSquare size={22} className="text-white" />
        {!isChatOpen && chatUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in-50 duration-300">
            {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
          </span>
        )}
      </button>
    </div>
    </>
  );
});

Header.displayName = 'Header';

export default Header;
