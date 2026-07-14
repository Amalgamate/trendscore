/**
 * Communication Settings - FULLY INTEGRATED VERSION
 * Connects to Backend API for SMS, Email, M-Pesa configuration and testing.
 */

import React, { useState, useEffect } from 'react';
import {
  Mail, MessageSquare, Send, Save,
  TestTube, CheckCircle, XCircle, Loader,
  Phone, QrCode, RefreshCw, LogOut, Key, Sparkles, Gift
} from 'lucide-react';
import ModuleTabNav from '../../shared/ModuleTabNav';
import { useNotifications } from '../../hooks/useNotifications';
import { communicationAPI, notificationAPI } from '../../../../services/api';
import { COMMUNICATION_DEFAULTS, TEST_MESSAGES } from '../../../../constants/communicationMessages';
import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';
import { QRCodeSVG } from 'qrcode.react';

const EMAIL_TEMPLATE_OPTIONS = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'feeInvoice', label: 'Fee Invoice' },
  { key: 'feeStatement', label: 'Fee Statement' },
  { key: 'parentPortal', label: 'Parent Portal' },
  { key: 'schemeReview', label: 'Scheme Review' },
  { key: 'feeWaiverRequest', label: 'Waiver Request' },
  { key: 'feeWaiverApproved', label: 'Waiver Approved' },
  { key: 'feeWaiverDeclined', label: 'Waiver Declined' },
  { key: 'generic', label: 'Generic' }
];

const DEFAULT_EMAIL_TEMPLATES = {
  welcome: { heading: '', body: '' },
  onboarding: { heading: '', body: '' },
  feeInvoice: { heading: 'New Fee Invoice', body: '<p>Dear {parentName},</p><p>A fee invoice for {learnerName} has been generated for {term}.</p><p><strong>Amount due:</strong> KES {amount}<br/><strong>Due date:</strong> {dueDate}</p>' },
  feeStatement: { heading: 'Fee Statement', body: '<p>Dear {parentName},</p><p>Please find attached the latest fee statement for {learnerName}.</p>' },
  parentPortal: { heading: 'Parent Portal Login Credentials', body: '<p>{messageText}</p>' },
  schemeReview: { heading: 'Scheme of Work Update', body: '<p>{messageBody}</p>' },
  feeWaiverRequest: { heading: 'New Fee Waiver Request', body: '<p>{messageBody}</p>' },
  feeWaiverApproved: { heading: 'Fee Waiver Approved', body: '<p>{messageBody}</p>' },
  feeWaiverDeclined: { heading: 'Fee Waiver Declined', body: '<p>{messageBody}</p>' },
  generic: { heading: '{subject}', body: '<p>{messageText}</p>' }
};

const CommunicationSettings = () => {
  const { showSuccess, showError } = useNotifications();
  const [activeTab, setActiveTab] = useState('sms'); // Default to SMS as requested
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // WhatsApp connection states
  const [whatsappStatus, setWhatsappStatus] = useState({ status: 'disconnected', qrCode: null });
  const [wsLoading, setWsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Edit mode states
  const [editingTestContact, setEditingTestContact] = useState(false);

  // WhatsApp status polling
  useEffect(() => {
    let interval;
    if (activeTab === 'whatsapp' || isPolling) {
      const checkStatus = async () => {
        try {
          const res = await notificationAPI.getWhatsAppStatus();
          if (res.success) {
            setWhatsappStatus(res.data);
            if (res.data.status === 'authenticated') setIsPolling(false);
          }
        } catch (err) {
          // Silently ignore — backend may be starting up
        }
      };
      checkStatus();
      interval = setInterval(checkStatus, 4000);
    }
    return () => clearInterval(interval);
  }, [activeTab, isPolling]);

  const handleInitializeWhatsApp = async () => {
    try {
      setWsLoading(true);
      await notificationAPI.initializeWhatsApp();
      setIsPolling(true);
      showSuccess('WhatsApp starting — scan the QR code when it appears');
    } catch (err) {
      showError(err.message || 'Failed to start WhatsApp');
    } finally {
      setWsLoading(false);
    }
  };

  const handleLogoutWhatsApp = async () => {
    if (!window.confirm('Disconnect WhatsApp and clear the saved session?')) return;
    try {
      setWsLoading(true);
      await notificationAPI.logoutWhatsApp();
      setWhatsappStatus({ status: 'disconnected', qrCode: null });
      showSuccess('Disconnected successfully');
    } catch (err) {
      showError(err.message || 'Failed to disconnect');
    } finally {
      setWsLoading(false);
    }
  };

  // Template State
  const [editingTemplate, setEditingTemplate] = useState('welcome');
  const [templates, setTemplates] = useState(DEFAULT_EMAIL_TEMPLATES);

  const [aiBirthdaySettings, setAiBirthdaySettings] = useState({
    enabled: false,
    persona: 'Enthusiastic Principal',
    customInstructions: '',
    channelStrategy: 'Smart Fallback'
  });

  const [emailSettings, setEmailSettings] = useState({
    provider: COMMUNICATION_DEFAULTS.email.provider,
    apiKey: '',
    fromEmail: COMMUNICATION_DEFAULTS.email.fromEmail,
    fromName: COMMUNICATION_DEFAULTS.email.fromName,
    enabled: false,
    hasApiKey: false
  });

  const [aiSettings, setAiSettings] = useState({
    enabled: false,
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    hasApiKey: false,
    source: 'none'
  });

  const [smsSettings, setSmsSettings] = useState({
    provider: COMMUNICATION_DEFAULTS.sms.provider,
    baseUrl: COMMUNICATION_DEFAULTS.sms.baseUrl,
    apiKey: COMMUNICATION_DEFAULTS.sms.apiKey || '',
    username: COMMUNICATION_DEFAULTS.sms.username || '',
    senderId: COMMUNICATION_DEFAULTS.sms.senderId,
    customName: '',
    customBaseUrl: '',
    customAuthHeader: 'Authorization',
    customToken: '',
    enabled: false,
    otpEnabled: true
  });

  const [testContact, setTestContact] = useState('');
  const [testMessage, setTestMessage] = useState(TEST_MESSAGES.sms);
  const [testEmailTemplate, setTestEmailTemplate] = useState('welcome');
  const [schoolPhone, setSchoolPhone] = useState(''); // Store school phone for fallback

  // Removed deprecated browser-session QR status logic

  // Load Configuration on Mount

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        // Restore persisted test contact from localStorage
        const savedTestContact = localStorage.getItem('testContactPhone');
        if (savedTestContact) {
          setTestContact(savedTestContact);
        }

        // Single-tenant: no schoolId needed — backend uses findFirst()
        const response = await communicationAPI.getConfig();
        const data = response.data;
        console.log('Config loaded from API:', data);

        if (data) {
          // Store school phone for fallback when switching tabs
          if (data.schoolPhone) {
            const cleanPhone = data.schoolPhone.replace('+', '');
            setSchoolPhone(cleanPhone);
            console.log('School phone stored:', cleanPhone);
            // If no test contact was in localStorage, use school phone as default
            if (!savedTestContact) {
              setTestContact(cleanPhone);
              console.log('Test contact set to school phone:', cleanPhone);
            }
          }
          // Update Email Settings
          if (data && data.email) {
            setEmailSettings(prev => ({
              ...prev,
              provider: data.email.provider || COMMUNICATION_DEFAULTS.email.provider,
              enabled: !!data.email.enabled,
              fromEmail: data.email.fromEmail || COMMUNICATION_DEFAULTS.email.fromEmail || '',
              fromName: data.email.fromName || COMMUNICATION_DEFAULTS.email.fromName || '',
              hasApiKey: !!data.email.hasApiKey
            }));

            // Load templates
            if (data.email.emailTemplates) {
              setTemplates(prev => ({
                ...prev,
                ...data.email.emailTemplates
              }));
            }
          }

          // Load birthday AI settings from dedicated config field
          if (data && data.birthdayAi) {
            setAiBirthdaySettings(prev => ({
              ...prev,
              enabled: !!data.birthdayAi.enabled,
              persona: data.birthdayAi.persona || 'Enthusiastic Principal',
              customInstructions: data.birthdayAi.customInstructions || '',
              channelStrategy: data.birthdayAi.channelStrategy || 'Smart Fallback'
            }));
          }

          if (data && data.ai) {
            setAiSettings(prev => ({
              ...prev,
              enabled: !!data.ai.enabled,
              provider: data.ai.provider || 'openai',
              model: data.ai.model || 'gpt-4o-mini',
              apiUrl: data.ai.apiUrl || 'https://api.openai.com/v1/chat/completions',
              hasApiKey: !!data.ai.hasApiKey,
              source: data.ai.source || 'none',
              apiKey: ''
            }));
          }

          // Update SMS Settings
          if (data && data.sms) {
            setSmsSettings(prev => ({
              ...prev,
              provider: data.sms.provider || COMMUNICATION_DEFAULTS.sms.provider,
              enabled: !!data.sms.enabled,
              baseUrl: data.sms.baseUrl || COMMUNICATION_DEFAULTS.sms.baseUrl,
              senderId: data.sms.senderId || COMMUNICATION_DEFAULTS.sms.senderId,
              hasApiKey: !!data.sms.hasApiKey,

              // AT specific
              username: data.sms.username || COMMUNICATION_DEFAULTS.sms.username || '',

              // Custom fields
              customName: data.sms.customName || '',
              customBaseUrl: data.sms.customUrl || '',
              customAuthHeader: data.sms.customAuthHeader || 'Authorization',
              hasCustomToken: !!data.sms.hasCustomToken,
              otpEnabled: data.otp?.enabled !== false
            }));
          }


        }
      } catch (error) {
        console.error('Error loading config:', error);
        // Don't show error toast on load to avoid spamming if no config exists yet
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async (type) => {
    try {
      setLoading(true);
      const payload = {};

      if (type === 'Email' || type === 'All') {
        payload.email = {
          provider: emailSettings.provider,
          enabled: emailSettings.enabled,
          fromEmail: emailSettings.fromEmail,
          fromName: emailSettings.fromName,
          // Only send API key if it's changed (not empty)
          apiKey: emailSettings.apiKey || undefined,
          emailTemplates: templates // Templates only, no birthday settings here
        };
      }

      if (type === 'Birthdays') {
        // Save birthday AI settings as __birthday in emailTemplates
        payload.email = {
          emailTemplates: {
            __birthday: aiBirthdaySettings
          }
        };
      }

      if (type === 'AI' || type === 'All') {
        payload.ai = {
          enabled: aiSettings.enabled,
          provider: 'openai',
          model: aiSettings.model,
          apiUrl: aiSettings.apiUrl,
          apiKey: aiSettings.apiKey || undefined
        };
      }

      if (type === 'SMS' || type === 'All') {
        payload.sms = {
          provider: smsSettings.provider,
          enabled: true, // Auto-enable on save
          baseUrl: smsSettings.baseUrl,
          senderId: smsSettings.senderId,
          username: smsSettings.username,
          // Only send API key if it's entered
          apiKey: smsSettings.apiKey || undefined,

          // Custom
          customName: smsSettings.customName,
          customBaseUrl: smsSettings.customBaseUrl,
          customAuthHeader: smsSettings.customAuthHeader,
          customToken: smsSettings.customToken || undefined
        };
        payload.otp = {
          enabled: smsSettings.otpEnabled
        };
      }




      await communicationAPI.saveConfig(payload);
      showSuccess(`${type} settings saved successfully!`);

      // Refresh to get 'hasApiKey' flags updated? Use local state for now
      if (payload.sms?.apiKey) setSmsSettings(s => ({ ...s, hasApiKey: true }));
      if (payload.email?.apiKey) setEmailSettings(s => ({ ...s, hasApiKey: true, apiKey: '' }));
      if (payload.ai?.apiKey) setAiSettings(s => ({ ...s, hasApiKey: true, source: 'settings', apiKey: '' }));

    } catch (error) {
      console.error('Save Error:', error);
      showError(error.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSMS = async () => {
    if (testContact.length < 9) {
      showError('Enter valid phone (e.g. 07... or 254...)');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const payload = {
        phoneNumber: testContact,
        message: testMessage
      };
      console.log('Sending SMS with payload:', payload);

      const response = await communicationAPI.sendTestSMS(payload);
      console.log('SMS sent successfully:', response);

      setTestResult({
        success: true,
        message: response.message || 'SMS sent successfully!',
        timestamp: new Date().toLocaleString(),
        provider: response.provider,
        messageId: response.messageId
      });
      showSuccess('SMS sent successfully!');
    } catch (error) {
      console.error('Test SMS Error:', error);
      setTestResult({
        success: false,
        message: error.message || 'Failed to send SMS',
        timestamp: new Date().toLocaleString(),
        errorDetails: error.toString()
      });
      showError('Failed to send Test SMS');
    } finally {
      setTesting(false);
    }
  };

  const handleDraftEmailTemplate = async () => {
    try {
      setAiDrafting(true);
      const currentOption = EMAIL_TEMPLATE_OPTIONS.find(option => option.key === editingTemplate);
      const response = await communicationAPI.draftEmailTemplate({
        templateType: editingTemplate,
        audience: ['welcome', 'onboarding', 'schemeReview'].includes(editingTemplate)
          ? 'school administrators and staff'
          : 'parents and guardians',
        goal: `Create a clear ${currentOption?.label || editingTemplate} email template for a school management system. Use only placeholders already present in the existing body when placeholders are needed.`,
        existingHeading: templates[editingTemplate]?.heading || '',
        existingBody: templates[editingTemplate]?.body || ''
      });

      const draft = response.data || {};
      if (!draft.heading || !draft.body) {
        throw new Error('AI did not return usable template content');
      }

      setTemplates(prev => ({
        ...prev,
        [editingTemplate]: {
          ...prev[editingTemplate],
          heading: draft.heading,
          body: draft.body
        }
      }));
      showSuccess('AI draft added. Review and save the template.');
    } catch (error) {
      showError(error.message || 'Failed to generate AI draft');
    } finally {
      setAiDrafting(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (testContact.length < 9) {
      showError('Enter valid phone (e.g. 07... or 254...)');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      console.log('Sending WhatsApp test message to:', testContact);
      const response = await notificationAPI.testWhatsApp(testContact, testMessage);
      
      setTestResult({
        success: response.success,
        message: response.message || 'WhatsApp message sent successfully!',
        timestamp: new Date().toLocaleString()
      });
      showSuccess('WhatsApp test executed!');
    } catch (error) {
      console.error('Test WhatsApp Error:', error);
      setTestResult({
        success: false,
        message: error.message || 'Failed to send WhatsApp message',
        timestamp: new Date().toLocaleString(),
        errorDetails: error.toString()
      });
      showError('Failed to send Test WhatsApp');
    } finally {
      setTesting(false);
    }
  };
  const renderAiSettingsPanel = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-lg font-medium">AI Assistant Settings</h3>
              <p className="text-sm text-gray-500">
                Configure OpenAI for email template drafting and future AI-assisted communication tools.
              </p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${aiSettings.hasApiKey ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {aiSettings.hasApiKey ? <CheckCircle size={14} /> : <Key size={14} />}
            {aiSettings.hasApiKey ? `Configured via ${aiSettings.source === 'environment' ? 'server env' : 'settings'}` : 'Not configured'}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <input
              type="checkbox"
              checked={aiSettings.enabled}
              onChange={(e) => setAiSettings({ ...aiSettings, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-semibold text-gray-700">Enable AI drafting</span>
          </label>

          <div>
            <label className="block text-sm font-semibold mb-2">Provider</label>
            <select
              value={aiSettings.provider}
              onChange={(e) => setAiSettings({ ...aiSettings, provider: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">OpenAI API Key</label>
            <input
              type="password"
              value={aiSettings.apiKey}
              onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
              placeholder={aiSettings.hasApiKey ? 'Saved - enter a new key to replace' : 'sk-...'}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">The key is write-only and encrypted on the server. It is never shown back in the browser.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Model</label>
            <input
              type="text"
              value={aiSettings.model}
              onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="gpt-4o-mini"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold mb-2">API URL</label>
            <input
              type="url"
              value={aiSettings.apiUrl}
              onChange={(e) => setAiSettings({ ...aiSettings, apiUrl: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="https://api.openai.com/v1/chat/completions"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleSave('AI')}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
            {loading ? 'Saving...' : 'Save AI Settings'}
          </button>
          <p className="text-xs text-gray-500">
            Email template AI drafting will use this saved key first, then fall back to server environment variables.
          </p>
        </div>
      </div>
    </div>
  );

  const COMM_TABS = [
    { id: 'email',    label: 'Email',    icon: <Mail size={13} /> },
    { id: 'sms',      label: 'SMS',      icon: <MessageSquare size={13} /> },
    { id: 'whatsapp', label: 'WhatsApp', icon: <Phone size={13} /> },
    { id: 'voip',     label: 'VoIP',     icon: <Phone size={13} /> },
    { id: 'ai',       label: 'AI',       icon: <Sparkles size={13} /> },
    { id: 'birthdays',label: 'Birthdays',icon: <Gift size={13} /> },
  ];

  // Render Logic
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <ModuleTabNav
        sectionLabel="COMMUNICATION"
        variant="dropdown"
        tabs={COMM_TABS}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setTestResult(null);
          if (tab === 'email') {
            setTestContact('');
            setTestEmailTemplate('welcome');
            const saved = localStorage.getItem('testContactEmail');
            if (saved) setTestContact(saved);
          } else if (tab === 'voip' || tab === 'ai') {
            setTestContact('');
            setTestMessage('');
          } else {
            setTestContact('');
            setTestMessage(`This is a test message from ${PRODUCT_DISPLAY_NAME}. Thank you.`);
            const saved = localStorage.getItem('testContactPhone');
            if (saved) {
              setTestContact(saved);
            } else if (schoolPhone) {
              setTestContact(schoolPhone);
            }
          }
        }}
      />

      {activeTab === 'ai' && renderAiSettingsPanel()}

      {/* BIRTHDAYS TAB */}
      {activeTab === 'birthdays' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                  <Gift size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-medium">Magic AI Birthdays</h3>
                  <p className="text-sm text-gray-500">
                    Automatically generate and send highly personalized birthday wishes to students.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={aiBirthdaySettings.enabled}
                  onChange={(e) => setAiBirthdaySettings({ ...aiBirthdaySettings, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
                <span className="text-sm font-semibold text-gray-700">Enable Automated Magic Birthdays</span>
              </label>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold mb-2">AI Persona</label>
                  <select
                    value={aiBirthdaySettings.persona}
                    onChange={(e) => setAiBirthdaySettings({ ...aiBirthdaySettings, persona: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="Enthusiastic Principal">Enthusiastic Principal (Warm & Professional)</option>
                    <option value="Fun Mascot">Fun Mascot (Playful & Energetic)</option>
                    <option value="Wise Mentor">Wise Mentor (Inspirational & Encouraging)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select the tone of voice for the generated messages.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Channel Delivery Strategy</label>
                  <select
                    value={aiBirthdaySettings.channelStrategy}
                    onChange={(e) => setAiBirthdaySettings({ ...aiBirthdaySettings, channelStrategy: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="Smart Fallback">Smart Fallback (WhatsApp first, SMS if fail)</option>
                    <option value="Both Channels">Both Channels (Send via WhatsApp and SMS)</option>
                    <option value="WhatsApp Only">WhatsApp Only</option>
                    <option value="SMS Only">SMS Only</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Determine how messages are routed to parents.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Custom Instructions (Optional)</label>
                <textarea
                  value={aiBirthdaySettings.customInstructions}
                  onChange={(e) => setAiBirthdaySettings({ ...aiBirthdaySettings, customInstructions: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
                  rows={4}
                  placeholder="e.g., Mention our school motto 'Striving for Excellence'. Keep it under 2 sentences."
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => handleSave('Birthdays')}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-semibold disabled:opacity-50"
              >
                {loading ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                {loading ? 'Saving...' : 'Save Birthday Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL TAB */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
            <h3 className="text-lg font-medium mb-6">Email Configuration (Resend)</h3>

            {loading && <div className="text-center py-4"><Loader className="animate-spin inline" /> Loading config...</div>}

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-800 rounded-lg mb-4">
                <Mail size={20} />
                <p className="text-sm">Configure your own Resend account to use custom domains and track your school's email delivery.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">From Email Address</label>
                  <input
                    type="email"
                    value={emailSettings.fromEmail}
                    onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="onboarding@resend.dev"
                  />
                  <p className="text-xs text-gray-500 mt-1">Default: onboarding@resend.dev (Resend Sandbox)</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">From Name</label>
                  <input
                    type="text"
                    value={emailSettings.fromName}
                    onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder={`${PRODUCT_DISPLAY_NAME} / Your School Name`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Resend API Key</label>
                <div className="relative">
                  <input
                    type="password"
                    value={emailSettings.apiKey}
                    onChange={(e) => setEmailSettings({ ...emailSettings, apiKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg pr-24 bg-white text-gray-900 focus:ring-2 focus:ring-brand-purple outline-none transition"
                    placeholder={emailSettings.hasApiKey ? '••••••••••••••••' : 're_YourActualAPIKey...'}
                  />
                  {emailSettings.hasApiKey && !emailSettings.apiKey && (
                    <span className="absolute right-3 top-2 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                      Saved
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Resend Dashboard</a>.</p>
              </div>

              <div className="flex items-center gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={emailSettings.enabled}
                      onChange={(e) => setEmailSettings({ ...emailSettings, enabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">Enable Email Notifications</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={() => handleSave('Email')}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
                >
                  {loading ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                  {loading ? 'Saving...' : 'Save Email Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
          <h3 className="text-lg font-medium mb-6 flex items-center gap-2">
            <MessageSquare size={20} className="text-purple-600" />
            Email Templates
          </h3>

          <div className="space-y-6">
            {/* Template Selector */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {EMAIL_TEMPLATE_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setEditingTemplate(key)}
                    className={`px-3 py-2 rounded-lg border text-sm ${editingTemplate === key
                      ? 'bg-purple-50 border-purple-200 text-purple-700 font-semibold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleDraftEmailTemplate}
                disabled={aiDrafting}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 disabled:opacity-50"
              >
                {aiDrafting ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {aiDrafting ? 'Drafting...' : 'Draft with AI'}
              </button>
            </div>

            {/* Editor Fields */}
            <div className="space-y-4 border p-4 rounded-lg bg-gray-50">
              <div>
                <label className="block text-sm font-semibold mb-2">Email Heading</label>
                <input
                  type="text"
                  value={templates[editingTemplate]?.heading || ''}
                  onChange={(e) => setTemplates(prev => ({
                    ...prev,
                    [editingTemplate]: { ...prev[editingTemplate], heading: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Template heading"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Body Content (HTML/Text)</label>
                <textarea
                  value={templates[editingTemplate]?.body || ''}
                  onChange={(e) => setTemplates(prev => ({
                    ...prev,
                    [editingTemplate]: { ...prev[editingTemplate], body: e.target.value }
                  }))}
                  className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
                  rows={6}
                  placeholder="Type your custom message here. You can use HTML tags like <b>bold</b> or <br/> for line breaks."
                />
                <p className="text-xs text-gray-500 mt-2">
                  Leave blank to use the system default template.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleSave('Email')}
                  className="text-sm px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Email */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <TestTube size={20} className="text-blue-600" />
            Test Email
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
              <p className="font-semibold">Verify your templates:</p>
              <ul className="list-disc list-inside mt-1">
                <li><strong>Welcome and onboarding:</strong> Account setup flows.</li>
                <li><strong>Finance and waiver:</strong> Parent-facing fee communication.</li>
                <li><strong>Generic and scheme review:</strong> Staff and scheduled communication.</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Template to Test</label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {EMAIL_TEMPLATE_OPTIONS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 px-3 py-2">
                    <input
                      type="radio"
                      name="template"
                      value={key}
                      checked={testEmailTemplate === key}
                      onChange={() => setTestEmailTemplate(key)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Recipient Email</label>
              {!editingTestContact ? (
                <div className="flex items-center justify-between px-4 py-2 border rounded-lg bg-gray-50">
                  <span className="text-gray-800 font-mono font-semibold">{testContact}</span>
                  <button
                    onClick={() => setEditingTestContact(true)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                    title="Edit Email Address"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testContact}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setTestContact(newValue);
                      if (newValue) localStorage.setItem('testContactEmail', newValue);
                    }}
                    className="flex-1 px-4 py-2 border rounded-lg"
                    placeholder="admin@school.com"
                    autoFocus
                  />
                  <button
                    onClick={() => setEditingTestContact(false)}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    ✓
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                if (!testContact || !testContact.includes('@')) {
                  showError('Enter valid email');
                  return;
                }
                setTesting(true);
                setTestResult(null);
                try {
                  const res = await communicationAPI.sendTestEmail({
                    email: testContact,
                    template: testEmailTemplate,
                    subject: `Test ${testEmailTemplate} email`,
                    message: `This is a test ${testEmailTemplate} email from ${PRODUCT_DISPLAY_NAME}.`
                  });
                  setTestResult({
                    success: true,
                    message: res.message,
                    timestamp: new Date().toLocaleString()
                  });
                  showSuccess('Email sent successfully!');
                } catch (err) {
                  setTestResult({
                    success: false,
                    message: err.message || 'Failed to send email',
                    timestamp: new Date().toLocaleString(),
                    errorDetails: err.toString()
                  });
                  showError('Failed to send Test Email');
                } finally {
                  setTesting(false);
                }
              }}
              disabled={testing || !testContact}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {testing ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
              {testing ? 'Sending...' : 'Send Test Email'}
            </button>

            {testResult && (
              <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-3">
                  {testResult.success ? <CheckCircle className="text-green-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                  <div>
                    <p className="font-semibold">{testResult.message}</p>
                    <p className="text-xs text-gray-600 mt-1">{testResult.timestamp}</p>
                    {testResult.errorDetails && (
                      <p className="text-xs text-red-700 mt-2 font-mono whitespace-pre-wrap">{testResult.errorDetails}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SMS TAB */}
      {activeTab === 'sms' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
            <h3 className="text-lg font-medium mb-6">SMS Configuration</h3>

            {loading && <div className="text-center py-4"><Loader className="animate-spin inline" /> Loading config...</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Provider</label>
                <select
                  value={smsSettings.provider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    setSmsSettings({
                      ...smsSettings,
                      provider: newProvider,
                      apiKey: '', // Clear API key on switch
                      hasApiKey: false, // Force user to re-enter
                      username: '' // Clear AT username
                    });
                  }}
                  className="w-full px-4 py-2 border rounded-lg font-semibold"
                >
                  <option value="africastalking">🌍 Africa's Talking</option>
                  <option value="mobilesasa">📱 MobileSasa</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  {smsSettings.provider === 'africastalking' && "You will need Africa's Talking API Key and Username to proceed"}
                  {smsSettings.provider === 'mobilesasa' && "You will need MobileSasa API Key to proceed"}
                </p>
              </div>

              {/* Africa's Talking Fields */}
              {smsSettings.provider === 'africastalking' && (
                <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 rounded text-gray-900">
                  <p className="text-sm font-semibold text-yellow-800 mb-3">Africa's Talking Configuration</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        Africa's Talking Username <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={smsSettings.username}
                        onChange={(e) => setSmsSettings({ ...smsSettings, username: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="e.g. 'sandbox' or your production username"
                      />
                      <p className="text-xs text-gray-600 mt-1">Your AT account username</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        API Key / Token <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          value={smsSettings.apiKey}
                          onChange={(e) => setSmsSettings({ ...smsSettings, apiKey: e.target.value })}
                          className={`w-full px-4 py-2 border rounded-lg pr-24 ${!smsSettings.apiKey && smsSettings.hasApiKey ? 'bg-green-50 border-green-300' : ''}`}
                          placeholder={smsSettings.hasApiKey && !smsSettings.apiKey ? 'Saved (Edit to change)' : 'Enter your Africa\'s Talking API Key'}
                        />
                        {smsSettings.hasApiKey && !smsSettings.apiKey && (
                          <span className="absolute right-3 top-2 text-xs text-green-600 font-medium bg-green-50 px-3 py-1 rounded border border-green-300">
                            ✓ Saved
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Found in your AT dashboard under API Keys</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Sender ID (Optional)</label>
                      <input
                        type="text"
                        value={smsSettings.senderId}
                        onChange={(e) => setSmsSettings({ ...smsSettings, senderId: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="Your registered AT Sender ID"
                      />
                      <p className="text-xs text-gray-600 mt-1">Leave blank if not configured</p>
                    </div>
                  </div>
                </div>
              )}

              {/* MobileSasa Fields */}
              {smsSettings.provider === 'mobilesasa' && (
                <div className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded text-gray-900">
                  <p className="text-sm font-semibold text-blue-800 mb-3">MobileSasa Configuration</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        API Key <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          value={smsSettings.apiKey}
                          onChange={(e) => setSmsSettings({ ...smsSettings, apiKey: e.target.value })}
                          className={`w-full px-4 py-2 border rounded-lg pr-24 ${!smsSettings.apiKey && smsSettings.hasApiKey ? 'bg-green-50 border-green-300' : ''}`}
                          placeholder={smsSettings.hasApiKey && !smsSettings.apiKey ? 'Saved (Edit to change)' : 'Enter your MobileSasa API Key'}
                        />
                        {smsSettings.hasApiKey && !smsSettings.apiKey && (
                          <span className="absolute right-3 top-2 text-xs text-green-600 font-medium bg-green-50 px-3 py-1 rounded border border-green-300">
                            ✓ Saved
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">From your MobileSasa portal</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Sender ID (Optional)</label>
                      <input
                        type="text"
                        value={smsSettings.senderId}
                        onChange={(e) => setSmsSettings({ ...smsSettings, senderId: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="Your registered MobileSasa Sender ID"
                      />
                      <p className="text-xs text-gray-600 mt-1">Leave blank if not configured</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 mt-6">
                <label className="inline-flex items-center gap-3 px-4 py-2 border rounded-lg bg-gray-50">
                  <input
                    type="checkbox"
                    checked={smsSettings.otpEnabled}
                    onChange={(e) => setSmsSettings({ ...smsSettings, otpEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Require OTP on Login</span>
                </label>
                <button
                  onClick={() => handleSave('SMS')}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save SMS settings"
                >
                  {loading ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                  {loading ? 'Saving...' : 'Save SMS Settings'}
                </button>

                {/* Connection Indicator */}
                {(smsSettings.apiKey || smsSettings.hasApiKey) && (
                  <div className="flex items-center gap-2 text-sm px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="font-medium">Ready to Test</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Test SMS */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <TestTube size={20} className="text-blue-600" />
              Test SMS
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Recipient Phone</label>
                {!editingTestContact ? (
                  <div className="flex items-center justify-between px-4 py-2 border rounded-lg bg-gray-50">
                    <span className="text-gray-800 font-mono font-semibold">{testContact}</span>
                    <button
                      onClick={() => setEditingTestContact(true)}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                      title="Edit Phone Number"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      value={testContact}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setTestContact(newValue);
                        // Save to localStorage for persistence
                        if (newValue) {
                          localStorage.setItem('testContactPhone', newValue);
                        }
                      }}
                      className="flex-1 px-4 py-2 border rounded-lg"
                      placeholder="254712345678"
                      autoFocus
                    />
                    <button
                      onClick={() => setEditingTestContact(false)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      ✓
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">💾 Auto-saved to your browser</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Message</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Enter a test message"
                  rows={3}
                />
              </div>

              <button
                onClick={handleTestSMS}
                disabled={testing || !testContact}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {testing ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
                {testing ? 'Sending...' : 'Send Test SMS'}
              </button>

              {testResult && (
                <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-3">
                    {testResult.success ? <CheckCircle className="text-green-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                    <div>
                      <p className="font-semibold">{testResult.message}</p>
                      <p className="text-xs text-gray-600 mt-1">{testResult.timestamp}</p>
                      {testResult.errorDetails && (
                        <p className="text-xs text-red-700 mt-2 font-mono whitespace-pre-wrap">{testResult.errorDetails}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP TAB */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">WhatsApp Connection</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => { setIsPolling(true); handleInitializeWhatsApp(); }}
                  disabled={wsLoading || whatsappStatus.status === 'initializing'}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Start / Refresh"
                >
                  <RefreshCw size={20} className={whatsappStatus.status === 'initializing' ? 'animate-spin' : ''} />
                </button>
                {whatsappStatus.status === 'authenticated' && (
                  <button
                    onClick={handleLogoutWhatsApp}
                    disabled={wsLoading}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Logout"
                  >
                    <LogOut size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Status pill */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className={`p-3 rounded-full ${
                  whatsappStatus.status === 'authenticated' ? 'bg-green-100 text-green-600' :
                  whatsappStatus.status === 'qr_needed'     ? 'bg-yellow-100 text-yellow-600' :
                  whatsappStatus.status === 'initializing'  ? 'bg-blue-100 text-blue-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  <Phone size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                      whatsappStatus.status === 'authenticated' ? 'bg-green-100 text-green-700' :
                      whatsappStatus.status === 'qr_needed'     ? 'bg-yellow-100 text-yellow-700' :
                      whatsappStatus.status === 'initializing'  ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {whatsappStatus.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {whatsappStatus.status === 'authenticated' ? '✅ Connected! You can now send assessment reports via WhatsApp.' :
                     whatsappStatus.status === 'qr_needed'     ? 'Scan the QR code below with your WhatsApp phone.' :
                     whatsappStatus.status === 'initializing'  ? 'Starting... QR code will appear shortly.' :
                     'Not connected. Click the refresh button to start.'}
                  </p>
                </div>
              </div>

              {/* QR Code */}
              {(whatsappStatus.status === 'qr_needed') && (
                <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-200 rounded-2xl">
                  <div className="text-center">
                    <h4 className="font-medium flex items-center justify-center gap-2"><QrCode size={18} className="text-green-600" /> Scan with WhatsApp</h4>
                    <p className="text-xs text-gray-500 mt-1">Open WhatsApp → Linked Devices → Link a Device</p>
                  </div>
                  {whatsappStatus.qrCode ? (
                    <div className="bg-white p-4 rounded-xl shadow border">
                      <QRCodeSVG
                        value={whatsappStatus.qrCode}
                        size={220}
                        bgColor={"#ffffff"}
                        fgColor={"#000000"}
                        level={"L"}
                        includeMargin={false}
                        className="w-56 h-56"
                      />
                    </div>
                  ) : (
                    <div className="w-56 h-56 bg-gray-50 rounded-xl flex items-center justify-center border">
                      <Loader className="animate-spin text-gray-300" size={32} />
                    </div>
                  )}
                </div>
              )}

              {/* Authenticated view */}
              {whatsappStatus.status === 'authenticated' && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center space-y-2">
                  <CheckCircle className="text-green-600 mx-auto" size={32} />
                  <h4 className="font-medium text-gray-900">WhatsApp is Connected!</h4>
                  <p className="text-sm text-gray-600">Bulk reports and reminders will now be delivered via WhatsApp. The session persists across server restarts.</p>
                </div>
              )}

              {/* Disconnected / initializing view */}
              {(whatsappStatus.status === 'disconnected' || whatsappStatus.status === 'initializing') && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  {whatsappStatus.status === 'initializing' ? (
                    <>
                      <div className="w-14 h-14 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
                      <p className="text-gray-500 font-medium">Starting WhatsApp service...</p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center">
                        <Phone size={28} />
                      </div>
                      <p className="text-gray-500 font-medium">WhatsApp not connected</p>
                      <button
                        onClick={handleInitializeWhatsApp}
                        disabled={wsLoading}
                        className="px-8 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition shadow disabled:opacity-50"
                      >
                        {wsLoading ? 'Starting...' : '📱 Connect WhatsApp'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Test WhatsApp block (only visible when authenticated) */}
          {whatsappStatus.status === 'authenticated' && (
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <TestTube size={20} className="text-green-600" />
                Test WhatsApp
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Recipient Phone</label>
                  {!editingTestContact ? (
                    <div className="flex items-center justify-between px-4 py-2 border rounded-lg bg-gray-50">
                      <span className="text-gray-800 font-mono font-semibold">{testContact}</span>
                      <button
                        onClick={() => setEditingTestContact(true)}
                        className="p-1 text-green-600 hover:bg-green-100 rounded transition"
                        title="Edit Phone Number"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={testContact}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setTestContact(newValue);
                          if (newValue) {
                            localStorage.setItem('testContactPhone', newValue);
                          }
                        }}
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="254712345678"
                        autoFocus
                      />
                      <button
                        onClick={() => setEditingTestContact(false)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        ✓
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">💾 Auto-saved to your browser</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Message</label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Enter a test message"
                    rows={3}
                  />
                </div>

                <button
                  onClick={handleTestWhatsApp}
                  disabled={testing || !testContact}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {testing ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
                  {testing ? 'Sending...' : 'Send Test WhatsApp'}
                </button>

                {testResult && (
                  <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-3">
                      {testResult.success ? <CheckCircle className="text-green-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                      <div>
                        <p className="font-semibold">{testResult.message}</p>
                        <p className="text-xs text-gray-600 mt-1">{testResult.timestamp}</p>
                        {testResult.errorDetails && (
                          <p className="text-xs text-red-700 mt-2 font-mono whitespace-pre-wrap">{testResult.errorDetails}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VOIP TAB */}
          {activeTab === 'voip' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-colors duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <Phone size={24} className="text-blue-600" />
                  <div>
                    <h3 className="text-lg font-medium">VoIP Settings</h3>
                    <p className="text-sm text-gray-500">This feature is coming soon. We’ll add VoIP calling and telephony integration here.</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                  <p className="text-xl font-semibold text-gray-700">VoIP Coming Soon</p>
                  <p className="mt-3 text-sm text-gray-500 max-w-xl mx-auto">We are preparing the VoIP integration. You can return later to configure SIP providers, calling numbers, and voice communication routing.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default CommunicationSettings;
