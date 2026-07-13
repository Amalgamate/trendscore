import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Eye, Gift, Bell, Megaphone, RefreshCw, Send, Save, CheckCircle, Loader, User, Smartphone, MessageCircle, Archive, Share2, Rocket, Wrench, Zap, Shield, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Tabs, TabsList, TabsTrigger, TabsContent, Badge } from '../../../components/ui';
import { useNotifications } from '../hooks/useNotifications';
import api, { communicationAPI } from '../../../services/api';
import { getCurrentSchoolId, getStoredUser } from '../../../services/schoolContext';

const cakeEmoji = String.fromCodePoint(0x1F382);
const balloonEmoji = String.fromCodePoint(0x1F388);
const confettiEmoji = String.fromCodePoint(0x1F38A);
const sparkleEmoji = String.fromCodePoint(0x2728);
const defaultBirthdayTemplate = `*Happy Birthday {firstName}!* ${cakeEmoji}${balloonEmoji}\n\n{schoolName} is thrilled to celebrate you on your *{ageOrdinal} birthday* today, {birthdayDate}! ${confettiEmoji} \n\nWe are so proud of your progress in *{grade}*. May your day be filled with joy, laughter, and wonderful memories. Keep shining bright! ${sparkleEmoji}\n\nBest wishes,\n*The {schoolName} Family*`;

const NoticesPage = ({ initialTab }) => {
  const { showSuccess, showError } = useNotifications();

  // Get initial tab from prop, localStorage or URL, default to 'notices'
  const getInitialTab = () => {
    // 0. Check prop first
    if (initialTab && ['notices', 'birthdays', 'changelog'].includes(initialTab)) {
      return initialTab;
    }
    // 1. Check URL params
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab && ['notices', 'birthdays', 'changelog'].includes(urlTab)) {
      return urlTab;
    }
    // 2. Check localStorage
    const savedTab = localStorage.getItem('noticesPage_activeTab');
    if (savedTab && ['notices', 'birthdays', 'changelog'].includes(savedTab)) {
      return savedTab;
    }
    return 'notices';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [showModal, setShowModal] = useState(false);
  const [loadingBirthdays, setLoadingBirthdays] = useState(false);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [birthdays, setBirthdays] = useState([]);
  const [notices, setNotices] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  // Changelog state
  const [changelogs, setChangelogs] = useState([]);
  const [loadingChangelogs, setLoadingChangelogs] = useState(false);
  const [expandedChangelogId, setExpandedChangelogId] = useState(null);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [editingChangelogId, setEditingChangelogId] = useState(null);
  const [changelogForm, setChangelogForm] = useState({
    version: '', title: '', description: '', type: 'FEATURE', tags: '', publish: false
  });
  const [focusedNoticeId, setFocusedNoticeId] = useState(null);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [sharingNotice, setSharingNotice] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '', category: 'Academic', priority: 'Medium' });
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id || currentUser?.userId;
  const isSystemAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Birthday features states
  const [schoolId, setSchoolId] = useState(null);
  const [birthdaySettings, setBirthdaySettings] = useState({
    enabled: false,
    template: defaultBirthdayTemplate
  });
  const [selectedLearners, setSelectedLearners] = useState([]);
  const [isBulkSendingWhatsApp, setIsBulkSendingWhatsApp] = useState(false);
  const [sendingWhatsAppWishes, setSendingWhatsAppWishes] = useState({}); // { id: true/false }
  const [editingPhone, setEditingPhone] = useState(null); // { id, phone }
  const [sendingWishes, setSendingWishes] = useState({}); // { id: true/false }
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [birthdaysToday, setBirthdaysToday] = useState([]);

  // Update localStorage and URL when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('noticesPage_activeTab', tab);
    // Update URL without page reload
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
  };

  const formatTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(/[_\s]+/).map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
  };

  // Refresh function that maintains current tab
  const handleRefresh = () => {
    if (activeTab === 'notices') {
      fetchNotices();
    } else if (activeTab === 'birthdays') {
      fetchBirthdays();
    } else if (activeTab === 'changelog') {
      fetchSystemAlerts();
      fetchChangelogs();
    }
    showSuccess('Page refreshed!');
  };

  useEffect(() => {
    // Determine School ID
    let sid = getCurrentSchoolId();
    if (!sid) {
      const user = getStoredUser();
      sid = user?.schoolId || user?.school?.id;
    }
    setSchoolId(sid);

    loadBirthdayConfig(sid);

    if (activeTab === 'notices') {
      fetchNotices();
    } else if (activeTab === 'birthdays') {
      fetchBirthdays();
      fetchBirthdaysToday(sid);
    } else if (activeTab === 'changelog') {
      fetchSystemAlerts();
      fetchChangelogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (initialTab && ['notices', 'birthdays', 'changelog'].includes(initialTab) && initialTab !== activeTab) {
      setActiveTab(initialTab);
      localStorage.setItem('noticesPage_activeTab', initialTab);
    }
  }, [initialTab, activeTab]);

  const loadBirthdayConfig = async (sid) => {
    try {
      const response = await communicationAPI.getConfig(sid);
      const data = response.data;
      if (data && data.birthdays) {
        setBirthdaySettings({
          enabled: data.birthdays.enabled,
          template: data.birthdays.template || defaultBirthdayTemplate
        });
      }
    } catch (error) {
      console.error('Error loading birthday config:', error);
    }
  };

  const fetchBirthdaysToday = async (sid) => {
    try {
      const response = await communicationAPI.getBirthdaysToday(sid);
      setBirthdaysToday(response.data || []);
    } catch (error) {
      console.error('Error fetching birthdays today:', error);
    }
  };

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

  const fetchNotices = async () => {
    setLoadingNotices(true);
    try {
      const resp = await api.notices.getAll();
      const mappedNotices = (resp.data || []).map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        category: n.category || 'General',
        priority: n.priority ? n.priority.charAt(0).toUpperCase() + n.priority.slice(1).toLowerCase() : 'Medium',
        author: n.createdBy ? `${n.createdBy.firstName} ${n.createdBy.lastName}` : 'Admin',
        createdById: n.createdBy?.id || n.createdById,
        date: formatDate(n.publishedAt || n.createdAt),
        status: n.status || 'Published',
        raw: n
      }));
      setNotices(mappedNotices);
    } catch (error) {
      console.error('Failed to fetch notices:', error);
      showError('Failed to load notices');
      setNotices([]);
    } finally {
      setLoadingNotices(false);
    }
  };

  const fetchChangelogs = async () => {
    setLoadingChangelogs(true);
    try {
      const fn = isSystemAdmin ? api.changelog.getAllAdmin : api.changelog.getAll;
      const resp = await fn();
      setChangelogs(resp.data || []);
    } catch (err) {
      console.error('Failed to fetch changelogs:', err);
      showError('Failed to load changelog');
    } finally {
      setLoadingChangelogs(false);
    }
  };

  const handleSaveChangelog = async () => {
    const { version, title, description, type, tags, publish } = changelogForm;
    if (!version.trim() || !title.trim() || !description.trim()) {
      showError('Version, title, and description are required');
      return;
    }
    try {
      const payload = {
        version: version.trim(),
        title: title.trim(),
        description: description.trim(),
        type,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        publish,
      };
      if (editingChangelogId) {
        await api.changelog.update(editingChangelogId, payload);
        showSuccess('Changelog updated' + (publish ? ' and published!' : '!'));
      } else {
        await api.changelog.create(payload);
        showSuccess('Changelog created' + (publish ? ' and published — users notified!' : '!'));
      }
      setShowChangelogModal(false);
      setEditingChangelogId(null);
      setChangelogForm({ version: '', title: '', description: '', type: 'FEATURE', tags: '', publish: false });
      fetchChangelogs();
    } catch (err) {
      showError(err.message || 'Failed to save changelog');
    }
  };

  const handleEditChangelog = (entry) => {
    setEditingChangelogId(entry.id);
    setChangelogForm({
      version: entry.version,
      title: entry.title,
      description: entry.description,
      type: entry.type,
      tags: (entry.tags || []).join(', '),
      publish: entry.isPublished,
    });
    setShowChangelogModal(true);
  };

  const handleDeleteChangelog = async (id) => {
    if (!window.confirm('Delete this changelog entry permanently?')) return;
    try {
      await api.changelog.delete(id);
      showSuccess('Changelog entry deleted');
      fetchChangelogs();
    } catch (err) {
      showError('Failed to delete entry');
    }
  };

  const changelogTypeConfig = {
    FEATURE:     { label: 'New Feature',  icon: Rocket,  color: 'bg-brand-purple text-white' },
    FIX:         { label: 'Bug Fix',      icon: Wrench,  color: 'bg-rose-500 text-white' },
    IMPROVEMENT: { label: 'Improvement',  icon: Zap,     color: 'bg-amber-500 text-white' },
    SECURITY:    { label: 'Security',     icon: Shield,  color: 'bg-emerald-600 text-white' },
  };

  const fetchSystemAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const resp = await api.userNotifications.getAll();
      if (resp.success) {
        setSystemAlerts(resp.data || []);
        setUnreadAlertsCount((resp.data || []).filter(n => !n.isRead).length);
      }
    } catch (error) {
      console.error('Failed to fetch system alerts:', error);
      showError('Failed to load system alerts');
    } finally {
      setLoadingAlerts(false);
    }
  };

  const markAlertAsRead = async (id) => {
    try {
      const resp = await api.userNotifications.markAsRead(id);
      if (resp.success) {
        setSystemAlerts(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadAlertsCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAlertsRead = async () => {
    try {
      const resp = await api.userNotifications.markAllAsRead();
      if (resp.success) {
        setSystemAlerts(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadAlertsCount(0);
        showSuccess('All alerts marked as read');
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleSaveBirthdaySettings = async () => {
    setSavingSettings(true);
    try {
      await communicationAPI.saveConfig({
        schoolId,
        birthdays: {
          enabled: birthdaySettings.enabled,
          template: birthdaySettings.template
        }
      });
      showSuccess('Birthday settings saved!');
    } catch (error) {
      console.error('Error saving birthday settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendWish = async (learnerId, isBulk = false) => {
    try {
      if (isBulk) {
        setIsBulkSending(true);
      } else {
        setSendingWishes(prev => ({ ...prev, [learnerId]: true }));
      }

      const learnerIds = isBulk ? (selectedLearners.length > 0 ? selectedLearners : birthdaysToday.map(b => b.id)) : [learnerId];

      const response = await communicationAPI.sendBirthdayWishes({
        schoolId,
        learnerIds,
        template: birthdaySettings.template,
        channel: 'sms'
      });

      showSuccess(response.message || 'Birthday wishes sent!');
      if (isBulk) setSelectedLearners([]);
    } catch (error) {
      console.error('Send Birthday Wish Error:', error);
      showSuccess('Wishes process completed');
    } finally {
      if (isBulk) {
        setIsBulkSending(false);
      } else {
        setSendingWishes(prev => ({ ...prev, [learnerId]: false }));
      }
    }
  };

  const handleSendWhatsApp = async (learner, isBulk = false) => {
    if (isBulk) {
      // Server-side bulk WhatsApp
      try {
        setIsBulkSendingWhatsApp(true);
        const learnerIds = selectedLearners.length > 0 ? selectedLearners : birthdaysToday.map(b => b.id);

        const response = await communicationAPI.sendBirthdayWishes({
          schoolId,
          learnerIds,
          template: birthdaySettings.template,
          channel: 'whatsapp'
        });

        showSuccess(response.message || 'WhatsApp birthday wishes sent!');
        setSelectedLearners([]);
      } catch (error) {
        console.error('Bulk WhatsApp Error:', error);
        showSuccess('WhatsApp process completed');
      } finally {
        setIsBulkSendingWhatsApp(false);
      }
    } else {
      // Client-side single WhatsApp (Better for individual interaction)
      const phone = learner.primaryContactPhone || learner.guardianPhone || (learner.parent?.phone);
      if (!phone) {
        showError(`Phone number missing for ${learner.name}`);
        return;
      }

      setSendingWhatsAppWishes(prev => ({ ...prev, [learner.id]: true }));

      try {
        const user = getStoredUser();
        const schoolName = user?.school?.name || 'our school';

        const birthday = new Date(learner.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthday.getFullYear();
        const m = today.getMonth() - birthday.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) {
          age--;
        }

        const gradeName = formatTitleCase(learner.grade || '');
        const firstName = formatTitleCase(learner.name.split(' ')[0]);
        const lastName = formatTitleCase(learner.name.split(' ').slice(1).join(' '));
        const fullName = `${firstName} ${lastName}`;

        const message = birthdaySettings.template
          .replace(/{learnerName}/g, fullName)
          .replace(/{firstName}/g, firstName)
          .replace(/{lastName}/g, lastName)
          .replace(/{schoolName}/g, schoolName)
          .replace(/{grade}/g, gradeName)
          .replace(/{age}/g, age)
          .replace(/{ageOrdinal}/g, getOrdinal(age))
          .replace(/{birthdayDate}/g, formatDate(learner.dateOfBirth));

        // Format for WhatsApp: International format, no '+' or leading '0'
        let formattedPhone = phone.replace(/\D/g, '');
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '254' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
          // Add 254 if it's 9 digits starting with 7 or 1
          if (formattedPhone.length === 9) {
            formattedPhone = '254' + formattedPhone;
          }
        }

        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
        showSuccess('Opening WhatsApp...');
      } finally {
        // Delay clearing the loader to show it actually happened
        setTimeout(() => {
          setSendingWhatsAppWishes(prev => ({ ...prev, [learner.id]: false }));
        }, 1000);
      }
    }
  };

  const handleUpdatePhone = async (learnerId, newPhone) => {
    try {
      // Optimistic update
      setBirthdays(prev => prev.map(b => b.id === learnerId ? { ...b, guardianPhone: newPhone, primaryContactPhone: newPhone } : b));
      setBirthdaysToday(prev => prev.map(b => b.id === learnerId ? { ...b, guardianPhone: newPhone, primaryContactPhone: newPhone } : b));

      // Call API to update learner phone - using learnerAPI if available
      await api.learners.update(learnerId, { guardianPhone: newPhone });
      showSuccess('Phone number updated!');
      setEditingPhone(null);
    } catch (error) {
      console.error('Error updating phone:', error);
      fetchBirthdays(); // Rollback
    }
  };

  const toggleSelectLearner = (id) => {
    setSelectedLearners(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllBirthdays = () => {
    if (selectedLearners.length === birthdays.length && birthdays.length > 0) {
      setSelectedLearners([]);
    } else {
      setSelectedLearners(birthdays.map(b => b.id));
    }
  };

  const focusNoticeInList = (noticeId) => {
    if (!noticeId) return;
    setFocusedNoticeId(noticeId);
    setTimeout(() => {
      const el = document.getElementById(`notice-card-${noticeId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    setTimeout(() => setFocusedNoticeId(null), 2500);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      showError('Title and content are required');
      return;
    }

    try {
      const priorityMap = {
        Low: 'LOW',
        Medium: 'NORMAL',
        High: 'HIGH'
      };

      const payload = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        priority: priorityMap[formData.priority] || 'NORMAL'
      };

      if (editingNoticeId) {
        const updatedNoticeId = editingNoticeId;
        await api.notices.update(editingNoticeId, payload);
        showSuccess('Notice updated successfully!');

        setShowModal(false);
        setFormData({ title: '', content: '', category: 'Academic', priority: 'Medium' });
        setEditingNoticeId(null);

        handleTabChange('notices');
        await fetchNotices();
        focusNoticeInList(updatedNoticeId);
        return;
      } else {
        const createdResp = await api.notices.create(payload);
        const createdNoticeId = createdResp?.data?.id;
        showSuccess('Notice published successfully!');

        setShowModal(false);
        setFormData({ title: '', content: '', category: 'Academic', priority: 'Medium' });
        setEditingNoticeId(null);

        handleTabChange('notices');
        await fetchNotices();

        focusNoticeInList(createdNoticeId);

        return;
      }
    } catch (error) {
      console.error('Failed to save notice:', error);
      showError(error.message || 'Failed to save notice');
    }
  };

  const handleEditClick = (notice) => {
    setEditingNoticeId(notice.id);
    setFormData({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      priority: notice.priority
    });
    setShowModal(true);
  };

  const handleShareWhatsApp = (notice) => {
    const message = `*${notice.title}*\n\n${notice.content}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    showSuccess('Opening WhatsApp share...');
    setSharingNotice(null);
  };

  const handleShareSms = (notice) => {
    const message = `${notice.title}\n\n${notice.content}`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_self');
    showSuccess('Opening SMS share...');
    setSharingNotice(null);
  };

  return (
    <div className="h-full flex flex-col bg-white border border-slate-200 overflow-hidden">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Bell size={24} className="text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Notices & Announcements</h1>
            <p className="text-sm text-slate-600">Manage school communications and announcements</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors text-slate-700"
          title="Refresh"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Tabs Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <TabsList className="hidden">
            <TabsTrigger
              value="notices"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-teal data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-4 flex items-center gap-2"
            >
              <Megaphone size={16} />
              <span className="font-medium">School Notices</span>
            </TabsTrigger>
            <TabsTrigger
              value="birthdays"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-purple data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-4 flex items-center gap-2"
            >
              <Gift size={16} />
              <span className="font-medium">This Week's Birthdays</span>
              {birthdays.length > 0 && (
                <Badge variant="purple" className="ml-2">
                  {birthdays.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="changelog"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-purple data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-4 flex items-center gap-2"
            >
              <Rocket size={16} />
              <span className="font-medium">What's New</span>
              {unreadAlertsCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadAlertsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Notices Tab */}
          <TabsContent value="notices" className="flex-1 overflow-auto p-6 space-y-4">
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => {
                  setEditingNoticeId(null);
                  setFormData({ title: '', content: '', category: 'Academic', priority: 'Medium' });
                  setShowModal(true);
                }}
                className="bg-brand-teal hover:bg-brand-teal/90 text-white font-medium gap-2"
              >
                <Plus size={20} />
                Create Notice
              </Button>
            </div>

            {loadingNotices ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader className="mx-auto mb-4 animate-spin text-brand-teal" size={32} />
                  <p className="text-gray-500 font-medium">Loading notices...</p>
                </div>
              </div>
            ) : notices.length > 0 ? (
              <div className="space-y-4">
                {notices.map(notice => (
                  (() => {
                    const isOwner = notice.createdById && currentUserId && notice.createdById === currentUserId;
                    const canArchive = !!isOwner;
                    const canDelete = !!isOwner && isSystemAdmin;

                    return (
                      <Card
                        key={notice.id}
                        id={`notice-card-${notice.id}`}
                        className={`border-l-4 border-l-brand-teal hover:shadow-lg transition ${focusedNoticeId === notice.id ? 'ring-2 ring-brand-teal/60 shadow-lg' : ''}`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-lg font-medium text-gray-800">{notice.title}</h3>
                                <Badge variant={notice.priority === 'High' ? 'destructive' : 'secondary'}>
                                  {notice.priority}
                                </Badge>
                                <Badge variant="outline">
                                  {notice.category}
                                </Badge>
                              </div>
                              <p className="text-gray-600 text-sm mb-3">{notice.content}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="font-medium">By {notice.author}</span>
                                <span>•</span>
                                <span>{notice.date}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-brand-teal hover:bg-brand-teal/10"
                                onClick={() => setSelectedNotice(notice)}
                                title="View notice"
                              >
                                <Eye size={18} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-indigo-600 hover:bg-indigo-50"
                                onClick={() => setSharingNotice(notice)}
                                title="Share notice"
                              >
                                <Share2 size={18} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => handleEditClick(notice)}
                              >
                                <Edit size={18} />
                              </Button>
                              {canArchive && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (window.confirm('Archive this notice?')) {
                                      try {
                                        await api.notices.delete(notice.id);
                                        showSuccess('Notice archived');
                                        fetchNotices();
                                      } catch (err) {
                                        showError(err.message || 'Failed to archive notice');
                                      }
                                    }
                                  }}
                                  className="text-amber-600 hover:bg-amber-50"
                                  title="Archive notice"
                                >
                                  <Archive size={18} />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (window.confirm('Delete this notice permanently?')) {
                                      try {
                                        await api.notices.delete(notice.id);
                                        showSuccess('Notice deleted permanently');
                                        fetchNotices();
                                      } catch (err) {
                                        showError(err.message || 'Failed to delete notice');
                                      }
                                    }
                                  }}
                                  className="text-red-600 hover:bg-red-50"
                                  title="Delete notice permanently"
                                >
                                  <Trash2 size={18} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No Notices Yet</h3>
                  <p className="text-gray-400 max-w-sm">Create your first notice to communicate important updates to the school community.</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Birthdays Tab */}
          <TabsContent value="birthdays" className="flex-1 flex flex-col overflow-auto">
            <div className="flex-1 flex flex-col overflow-auto p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-purple/10 rounded-lg">
                    <Gift size={24} className="text-brand-purple" />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-gray-800">Birthday Celebrations</h2>
                    <p className="text-gray-500 text-sm">Upcoming birthdays for this week</p>
                  </div>
                </div>

                {/* Automation Settings */}
                <Card className="w-full md:w-auto">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-sm font-medium text-gray-700">Automation</span>
                      <button
                        onClick={() => setBirthdaySettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                        className={`w-10 h-5 rounded-full transition-colors relative ${birthdaySettings.enabled ? 'bg-brand-teal' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${birthdaySettings.enabled ? 'right-0.5' : 'left-0.5'}`}
                        />
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPhone({ type: 'settings' })}
                      className="text-brand-teal hover:bg-brand-teal/10 justify-start gap-2 font-medium"
                    >
                      <Edit size={14} />
                      Edit Template
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Birthdays Today Alert */}
              {birthdaysToday.length > 0 && (
                <Card className="border-l-4 border-l-brand-purple bg-brand-purple/5 mb-6">
                  <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-purple text-white rounded-full">
                        <Gift size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-brand-purple">{birthdaysToday.length} Celebrations Today!</p>
                        <p className="text-xs text-brand-purple/70">Send wishes to celebrate with parents</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSendWish(null, true)}
                      disabled={isBulkSending}
                      className="bg-brand-purple hover:bg-brand-purple/90 text-white font-medium gap-2 whitespace-nowrap"
                    >
                      {isBulkSending ? (
                        <Loader size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                      Send Wishes
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Birthdays List */}
              {loadingBirthdays ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader className="mx-auto mb-4 animate-spin text-brand-purple" size={32} />
                    <p className="text-gray-500 font-medium">Loading celebrations...</p>
                  </div>
                </div>
              ) : birthdays.length > 0 ? (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-[color:var(--table-border)]">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedLearners.length === birthdays.length && birthdays.length > 0}
                              onChange={selectAllBirthdays}
                              className="rounded border-gray-300 text-brand-purple"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Student</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Grade</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Parent/Guardian Phone</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {birthdays.map((b) => (
                          <tr
                            key={b.id}
                            className={`hover:bg-gray-50 transition ${b.isToday ? 'bg-brand-purple/5' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedLearners.includes(b.id)}
                                onChange={() => toggleSelectLearner(b.id)}
                                className="rounded border-gray-300 text-brand-purple"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-brand-purple/10 rounded-full flex items-center justify-center text-brand-purple font-medium text-xs">
                                  {b.name?.charAt(0) || 'L'}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800 text-sm">{b.name}</p>
                                  <p className="text-[10px] text-gray-500">{b.admissionNumber}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-xs font-medium text-gray-700">{b.grade?.replace('GRADE_', 'Grade ') || 'N/A'}</p>
                                <p className="text-[10px] text-gray-500">Stream {b.stream || 'N/A'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {b.isToday ? (
                                <Badge className="bg-pink-600 text-white">Today! 🎉</Badge>
                              ) : (
                                <Badge variant="secondary">In {b.daysUntil} days</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative group max-w-[160px]">
                                <input
                                  type="tel"
                                  key={`${b.id}-${b.primaryContactPhone || b.guardianPhone || b.parent?.phone}`}
                                  defaultValue={b.primaryContactPhone || b.guardianPhone || b.parent?.phone || ''}
                                  onBlur={(e) => {
                                    const currentPhone = b.primaryContactPhone || b.guardianPhone || b.parent?.phone || '';
                                    if (e.target.value !== currentPhone) {
                                      handleUpdatePhone(b.id, e.target.value);
                                    }
                                  }}
                                  placeholder="Add number..."
                                  className="w-full pl-3 pr-8 py-1.5 text-[11px] font-medium border-2 border-gray-100 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple transition-all bg-white hover:border-gray-200"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-brand-purple transition-colors cursor-pointer p-1 rounded-md hover:bg-gray-100">
                                  <Edit size={10} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSendWhatsApp(b)}
                                  disabled={sendingWhatsAppWishes[b.id]}
                                  className={`${(b.primaryContactPhone || b.guardianPhone || b.parent?.phone) ? 'text-green-600 hover:bg-green-100' : 'text-gray-300'}`}
                                >
                                  {sendingWhatsAppWishes[b.id] ? (
                                    <Loader size={14} className="animate-spin" />
                                  ) : (
                                    <MessageCircle size={16} />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSendWish(b.id)}
                                  disabled={sendingWishes[b.id] || !(b.primaryContactPhone || b.guardianPhone || b.parent?.phone)}
                                  className="text-blue-600 hover:bg-blue-50"
                                >
                                  {sendingWishes[b.id] ? (
                                    <Loader size={14} className="animate-spin" />
                                  ) : (
                                    <Send size={16} />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">Total: {birthdays.length} this week</span>
                  </div>
                </Card>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Gift size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Birthdays This Week</h3>
                    <p className="text-gray-400 max-w-sm">Check back next week for upcoming celebrations</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* Changelog Tab                                                      */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="changelog" className="flex-1 overflow-auto p-6 space-y-8">
            {/* Combined System Alerts */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-medium text-gray-800 flex items-center gap-2">
                  <Bell className="text-brand-teal" size={22} />
                  System Alerts
                </h2>
                {unreadAlertsCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markAllAlertsRead}
                    className="text-brand-teal border-brand-teal hover:bg-brand-teal/10 font-medium"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Mark all as read
                  </Button>
                )}
              </div>

              {loadingAlerts ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader className="mx-auto mb-3 animate-spin text-brand-teal" size={28} />
                    <p className="text-gray-500 font-medium">Loading alerts...</p>
                  </div>
                </div>
              ) : systemAlerts.length > 0 ? (
                <div className="space-y-3">
                  {systemAlerts.map(alert => (
                    <Card
                      key={alert.id}
                      className={`border-l-4 ${alert.isRead ? 'border-l-gray-300 opacity-80' : 'border-l-brand-teal shadow-md'} transition hover:shadow-lg`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {alert.type === 'WAIVER' ? (
                                <Badge className="bg-brand-teal text-white">WAIVER</Badge>
                              ) : (
                                <Badge variant="secondary">{alert.type}</Badge>
                              )}
                              <h3 className={`font-medium ${alert.isRead ? 'text-gray-600' : 'text-gray-800'}`}>
                                {alert.title}
                              </h3>
                              {!alert.isRead && <div className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                            <div className="flex items-center gap-4 text-[10px] text-gray-500">
                              <span>{new Date(alert.createdAt).toLocaleString()}</span>
                              {alert.link && (
                                <a href={alert.link} className="text-brand-teal hover:underline font-medium flex items-center gap-1">
                                  View Details
                                  <Eye size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                          {!alert.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAlertAsRead(alert.id)}
                              className="text-gray-400 hover:text-brand-teal"
                              title="Mark as read"
                            >
                              <CheckCircle size={18} />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No active system alerts.</div>
              )}
            </section>

            {/* Header row */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-medium text-gray-800 flex items-center gap-2">
                  <Rocket className="text-brand-purple" size={22} />
                  System Updates & Changelog
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">Every improvement, fix, and new feature — in one place.</p>
              </div>
              {isSystemAdmin && (
                <Button
                  onClick={() => {
                    setEditingChangelogId(null);
                    setChangelogForm({ version: '', title: '', description: '', type: 'FEATURE', tags: '', publish: false });
                    setShowChangelogModal(true);
                  }}
                  className="bg-brand-purple hover:bg-brand-purple/90 text-white font-medium gap-2"
                >
                  <Plus size={16} /> New Entry
                </Button>
              )}
            </div>

            {loadingChangelogs ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader className="mx-auto mb-4 animate-spin text-brand-purple" size={32} />
                  <p className="text-gray-500 font-medium">Loading changelog...</p>
                </div>
              </div>
            ) : changelogs.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Rocket size={48} className="mx-auto text-gray-200 mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 mb-1">No updates yet</h3>
                  <p className="text-sm text-gray-400">
                    {isSystemAdmin ? 'Create your first changelog entry above.' : 'Check back soon for the latest updates.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {changelogs.map((entry) => {
                  const cfg = changelogTypeConfig[entry.type] || changelogTypeConfig.FEATURE;
                  const Icon = cfg.icon;
                  const isExpanded = expandedChangelogId === entry.id;

                  return (
                    <Card
                      key={entry.id}
                      className={`border border-gray-100 hover:shadow-md transition-shadow ${
                        !entry.isPublished ? 'opacity-60 border-dashed' : ''
                      }`}
                    >
                      <CardContent className="p-0">
                        {/* Card header row */}
                        <button
                          onClick={() => setExpandedChangelogId(isExpanded ? null : entry.id)}
                          className="w-full text-left p-5 flex items-start gap-4"
                        >
                          {/* Type pill */}
                          <div className={`mt-0.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest shrink-0 ${cfg.color}`}>
                            <Icon size={11} />
                            {cfg.label}
                          </div>

                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-800 text-sm">{entry.title}</span>
                              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{entry.version}</span>
                              {!entry.isPublished && (
                                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">DRAFT</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {entry.publishedAt
                                ? new Date(entry.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                                : new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                            {/* Tags */}
                            {(entry.tags || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {entry.tags.map(tag => (
                                  <span key={tag} className="text-[9px] font-medium px-2 py-0.5 bg-brand-purple/10 text-brand-purple rounded-full uppercase tracking-wide">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 text-gray-400">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </button>

                        {/* Expanded description */}
                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-gray-50">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap pt-4 leading-relaxed">
                              {entry.description}
                            </p>

                            {/* SUPER_ADMIN actions */}
                            {isSystemAdmin && (
                              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                                {!entry.isPublished && (
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      await api.changelog.update(entry.id, { publish: true });
                                      showSuccess('Published! All users notified.');
                                      fetchChangelogs();
                                    }}
                                    className="bg-brand-purple hover:bg-brand-purple/90 text-white font-medium gap-2 text-xs"
                                  >
                                    <Send size={13} /> Publish & Notify
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditChangelog(entry)}
                                  className="text-indigo-600 hover:bg-indigo-50 font-medium gap-1 text-xs"
                                >
                                  <Edit size={13} /> Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteChangelog(entry.id)}
                                  className="text-red-500 hover:bg-red-50 font-medium gap-1 text-xs"
                                >
                                  <Trash2 size={13} /> Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Changelog Create / Edit Modal                                        */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={showChangelogModal} onOpenChange={(open) => {
        if (!open) {
          setShowChangelogModal(false);
          setEditingChangelogId(null);
          setChangelogForm({ version: '', title: '', description: '', type: 'FEATURE', tags: '', publish: false });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium flex items-center gap-2">
              <Rocket size={20} className="text-brand-purple" />
              {editingChangelogId ? 'Edit Changelog Entry' : 'New Changelog Entry'}
            </DialogTitle>
            <DialogDescription>
              {editingChangelogId
                ? 'Update this system update entry. Toggle publish to notify all users.'
                : 'Document a system update. Publish immediately to notify all users via push notification.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Version <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. v2.4.1"
                  value={changelogForm.version}
                  onChange={e => setChangelogForm(f => ({ ...f, version: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Type</Label>
                <select
                  value={changelogForm.type}
                  onChange={e => setChangelogForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple"
                >
                  <option value="FEATURE">🚀 New Feature</option>
                  <option value="FIX">🔧 Bug Fix</option>
                  <option value="IMPROVEMENT">⚡ Improvement</option>
                  <option value="SECURITY">🛡️ Security</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-medium">Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Short summary of this update..."
                value={changelogForm.title}
                onChange={e => setChangelogForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medium">Description <span className="text-red-500">*</span></Label>
              <textarea
                rows={5}
                placeholder="Describe what changed, was fixed, or improved. Markdown-friendly."
                value={changelogForm.description}
                onChange={e => setChangelogForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medium flex items-center gap-1"><Tag size={14} /> Tags <span className="text-gray-400 font-normal text-xs">(comma-separated)</span></Label>
              <Input
                placeholder="e.g. Fees, Reports, CBC Grading"
                value={changelogForm.tags}
                onChange={e => setChangelogForm(f => ({ ...f, tags: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-brand-purple/5 border border-brand-purple/20 rounded-lg">
              <div>
                <p className="font-medium text-gray-800 text-sm">Publish & Notify Users</p>
                <p className="text-xs text-gray-500">Sends an in-app + push notification to every active user instantly</p>
              </div>
              <button
                onClick={() => setChangelogForm(f => ({ ...f, publish: !f.publish }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  changelogForm.publish ? 'bg-brand-purple' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  changelogForm.publish ? 'right-1' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangelogModal(false)}>Cancel</Button>
            <Button
              onClick={handleSaveChangelog}
              className="bg-brand-purple hover:bg-brand-purple/90 text-white font-medium gap-2"
            >
              <Save size={16} />
              {editingChangelogId ? 'Update' : changelogForm.publish ? 'Publish & Notify' : 'Save Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Birthday Settings Modal */}
      <Dialog open={editingPhone?.type === 'settings'} onOpenChange={(open) => !open && setEditingPhone(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="bg-pink-600 text-white px-6 py-4 -m-6 mb-4 rounded-t-lg">
            <DialogTitle className="text-lg font-medium flex items-center gap-2 text-white">
              <Gift size={20} />
              Birthday Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 px-6 py-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-gray-800">Automated Wishes</p>
                <p className="text-xs text-gray-500">Send SMS automatically on birthdays</p>
              </div>
              <button
                onClick={() => setBirthdaySettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${birthdaySettings.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${birthdaySettings.enabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="font-medium">Message Template</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBirthdaySettings(prev => ({ ...prev, template: defaultBirthdayTemplate }))}
                  className="text-pink-600 hover:bg-pink-50 text-xs font-medium"
                >
                  Reset
                </Button>
              </div>
              <textarea
                value={birthdaySettings.template}
                onChange={(e) => setBirthdaySettings({ ...birthdaySettings, template: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pink-500 min-h-[120px] font-sm"
                placeholder="Enter message template..."
              />
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="text-gray-500 font-medium uppercase">Placeholders:</span>
                {['{learnerName}', '{firstName}', '{lastName}', '{schoolName}', '{grade}', '{age}', '{ageOrdinal}', '{birthdayDate}'].map(p => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    onClick={() => setBirthdaySettings(prev => ({ ...prev, template: prev.template + ' ' + p }))}
                    className="text-xs font-mono h-auto py-1 px-2 bg-brand-purple/5 text-brand-purple border-brand-purple/20"
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 pt-0">
            <Button
              variant="outline"
              onClick={() => setEditingPhone(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleSaveBirthdaySettings();
                setEditingPhone(null);
              }}
              disabled={savingSettings}
              className="bg-pink-600 hover:bg-pink-700 text-white font-medium gap-2"
            >
              {savingSettings ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Notice Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium flex items-center gap-2">
              <Plus size={20} className="text-brand-teal" />
              {editingNoticeId ? 'Edit Notice' : 'Create New Notice'}
            </DialogTitle>
            <DialogDescription>
              Share important updates with your school community
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="font-medium">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter notice title..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="font-medium">Content</Label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-brand-teal resize-none"
                placeholder="Enter detailed content..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="font-medium">Category</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
                >
                  {['Academic', 'Event', 'Administrative', 'Sports', 'General'].map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className="font-medium">Priority</Label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
                >
                  {['Low', 'Medium', 'High'].map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-brand-teal hover:bg-brand-teal/90 text-white font-medium gap-2"
            >
              <Save size={18} />
              {editingNoticeId ? 'Update Notice' : 'Publish Notice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Notice Modal */}
      <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium">{selectedNotice?.title}</DialogTitle>
            <DialogDescription>
              {selectedNotice?.category} • {selectedNotice?.priority} priority
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedNotice?.content}</p>
            <div className="text-xs text-gray-500">
              By {selectedNotice?.author} • {selectedNotice?.date}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedNotice(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Notice Modal */}
      <Dialog open={!!sharingNotice} onOpenChange={(open) => !open && setSharingNotice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium">Share Notice</DialogTitle>
            <DialogDescription>
              Choose how you want to share this notice.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <Button
              onClick={() => handleShareWhatsApp(sharingNotice)}
              className="bg-green-600 hover:bg-green-700 text-white font-medium gap-2"
            >
              <MessageCircle size={16} />
              WhatsApp
            </Button>
            <Button
              onClick={() => handleShareSms(sharingNotice)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2"
            >
              <Send size={16} />
              SMS
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSharingNotice(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NoticesPage;
