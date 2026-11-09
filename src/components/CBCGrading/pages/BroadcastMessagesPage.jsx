import React, { useState, useEffect } from 'react';
import {
  Send, Users, Phone, MessageSquare, CheckCircle, AlertCircle,
  Loader2, RefreshCw, FileUp, Eye, Plus, ChevronRight, ChevronLeft, Download
} from 'lucide-react';
import {
  Card, CardHeader, CardContent, CardTitle, CardDescription, Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Badge
} from '../../../components/ui';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';
import { getStoredUser } from '../../../services/schoolContext';
import { formatPhoneNumber, getDisplayPhoneNumber } from '../../../utils/phoneFormatter';
import { useSchoolData } from '../../../contexts/SchoolDataContext';

const BROADCAST_TEMPLATES = [
  { id: 'update', label: 'School update', message: 'Hello {name}, {schoolName} has an update for {grade}. Please check the parent portal for details.' },
  { id: 'event', label: 'Event reminder', message: 'Hello {name}, this is a reminder from {schoolName} about an upcoming school activity for {grade}. Please check the parent portal for details.' },
  { id: 'urgent', label: 'Important notice', message: '{schoolName}: Please check the parent portal for an important update about {grade}. Contact the school if you need help.' },
  { id: 'fees', label: 'Fee reminder', message: 'Hello {name}, please review the fee statement for {grade} in the {schoolName} parent portal. Contact the school if you need help.' },
  { id: 'attendance', label: 'Attendance follow-up', message: 'Hello {name}, please check the attendance update for {grade} in the {schoolName} parent portal. Contact the school if you have questions.' },
];

const getSmsSegments = (message) => {
  if (!message) return 0;
  const gsmBasic = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  const gsmExtension = '^{}\\[~]|€';
  const usesGsm = [...message].every(char => gsmBasic.includes(char) || gsmExtension.includes(char));
  if (!usesGsm) return message.length <= 70 ? 1 : Math.ceil(message.length / 67);
  const units = [...message].reduce((total, char) => total + (gsmExtension.includes(char) ? 2 : 1), 0);
  return units <= 160 ? 1 : Math.ceil(units / 153);
};

const BroadcastMessagesPage = ({ onNavigate }) => {
  const { showSuccess, showError } = useNotifications();

  // Channel first, then audience, message, review, and delivery report.
  const [step, setStep] = useState('channel');

  // Recipients State
  const [recipientSource, setRecipientSource] = useState(''); // 'manual', 'csv', 'group', 'all'
  const [manualNumbers, setManualNumbers] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [recipientImportNote, setRecipientImportNote] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [groups, setGroups] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Message State
  const [messageTemplate, setMessageTemplate] = useState('');
  const [templateSelection, setTemplateSelection] = useState('');
  const [channel, setChannel] = useState('sms');
  const [previewData, setPreviewData] = useState({ name: 'John', grade: 'Grade 1', schoolName: '' });

  // Test State
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Send State
  const [sending, setSending] = useState(false);
  const [deliveryReport, setDeliveryReport] = useState([]);
  const [campaignId, setCampaignId] = useState(null);
  const [sendError, setSendError] = useState('');

  // Message History & Tracking State
  const [messageHistory, setMessageHistory] = useState([]);
  const [showDeliveryLog, setShowDeliveryLog] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [failedRecipients, setFailedRecipients] = useState([]);

  useEffect(() => {
    const user = getStoredUser();
    setPreviewData(prev => ({
      ...prev,
      schoolName: user?.school?.name || 'School'
    }));
    loadHistoryFromDatabase();
  }, []);

  const { grades: fetchedGrades } = useSchoolData();

  useEffect(() => {
    if (fetchedGrades && fetchedGrades.length > 0) {
      setGroups(fetchedGrades.map(g => ({ id: g, name: g.replace(/_/g, ' ') })));
    }
  }, [fetchedGrades]);

  const parseDelimitedText = (text) => {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if ((char === ',' || char === '\t') && !quoted) { row.push(field.trim()); field = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
        row = []; field = '';
      } else field += char;
    }
    row.push(field.trim());
    if (row.some(cell => cell !== '')) rows.push(row);
    return rows;
  };

  const normalizeRecipientRows = (rows) => {
    const normalizedHeader = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const isPhoneColumn = (value) => /(phone|mobile|telephone|contactnumber)/.test(normalizedHeader(value));
    const headerIndex = rows.findIndex(row => row.some(isPhoneColumn));
    if (headerIndex < 0) throw new Error('Add a column named Phone, Mobile, Parent Phone, or Guardian Phone.');
    const headers = rows[headerIndex].map(normalizedHeader);
    const phoneIndex = headers.findIndex(isPhoneColumn);
    const nameIndex = headers.findIndex(value => /^(name|parentname|guardianname|contactname)$/.test(value));
    const gradeIndex = headers.findIndex(value => /^(grade|class|learnergrade)$/.test(value));
    const unique = new Map();
    let skippedInvalid = 0;
    let skippedDuplicates = 0;
    rows.slice(headerIndex + 1).forEach(row => {
      const rawPhone = String(row[phoneIndex] ?? '').trim();
      if (!rawPhone) return;
      const phone = formatPhoneNumber(rawPhone);
      if (!phone) { skippedInvalid += 1; return; }
      if (unique.has(phone)) { skippedDuplicates += 1; return; }
      unique.set(phone, {
        id: phone,
        phone,
        displayPhone: getDisplayPhoneNumber(phone),
        name: String(row[nameIndex] || `Contact ${phone.slice(-4)}`).trim(),
        grade: String(row[gradeIndex] || '').trim(),
        source: 'file'
      });
    });
    return { recipients: [...unique.values()], skippedInvalid, skippedDuplicates };
  };

  const parseRecipientFile = async (file) => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
      return normalizeRecipientRows(parseDelimitedText(await file.text()));
    }
    if (!lowerName.endsWith('.xlsx')) throw new Error('Use a CSV or .xlsx workbook. Older .xls files are not supported.');
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('The workbook has no worksheet.');
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, row => rows.push(row.values.slice(1).map(value => value?.text ?? value?.result ?? value ?? '')));
    return normalizeRecipientRows(rows);
  };

  const handleLoadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      let loadedRecipients = [];

      if (recipientSource === 'manual') {
        const entries = manualNumbers
          .split(/[,\n]/) // Split by comma or newline
          .map(n => n.trim())
          .filter(n => n); // Remove empty strings

        const validNumbers = [];
        const invalidNumbers = [];

        entries.forEach(entry => {
          // Check if it contains digits
          const hasDigits = /\d/.test(entry);
          if (!hasDigits) {
            invalidNumbers.push(entry);
            return;
          }

          // Try to format it
          const formatted = formatPhoneNumber(entry);
          if (formatted) {
            validNumbers.push(formatted);
          } else {
            invalidNumbers.push(entry);
          }
        });

        // Show warnings about invalid numbers
        if (invalidNumbers.length > 0) {
          console.warn(`⚠️  ${invalidNumbers.length} invalid phone numbers:`, invalidNumbers);
          if (validNumbers.length === 0) {
            showError(`❌ No valid phone numbers found. Please check formats.\n\nInvalid: ${invalidNumbers.slice(0, 3).join(', ')}${invalidNumbers.length > 3 ? '...' : ''}`);
            setLoadingRecipients(false);
            return;
          } else {
            showError(`⚠️  Skipped ${invalidNumbers.length} invalid numbers. Proceeding with ${validNumbers.length} valid numbers.`);
          }
        }

        loadedRecipients = [...new Set(validNumbers)].map((phone) => ({
          id: phone,
          phone: phone,
          displayPhone: getDisplayPhoneNumber(phone),
          name: `Contact ${phone.slice(-4)}`,
          source: 'manual'
        }));
      } else if (recipientSource === 'csv' && csvFile) {
        const imported = await parseRecipientFile(csvFile);
        loadedRecipients = imported.recipients;
        const notes = [];
        if (imported.skippedInvalid) notes.push(`${imported.skippedInvalid} invalid phone row${imported.skippedInvalid === 1 ? '' : 's'} skipped`);
        if (imported.skippedDuplicates) notes.push(`${imported.skippedDuplicates} duplicate contact${imported.skippedDuplicates === 1 ? '' : 's'} skipped`);
        setRecipientImportNote(notes.join(' · '));
      } else if (recipientSource === 'group' && selectedGroups.length > 0) {
        // Load recipients from each selected group (Grade)
        let allGroupRecipients = [];
        for (const groupId of selectedGroups) {
          try {
            // Groups are Grades here, so we use getRecipients with grade filter
            const response = await api.communication.getRecipients(groupId);
            if (response.success && response.data) {
              allGroupRecipients = allGroupRecipients.concat(response.data);
            }
          } catch (err) {
            console.warn(`Failed to load group ${groupId}:`, err);
          }
        }
        // Remove duplicates based on phone number
        const uniquePhones = new Set();
        loadedRecipients = allGroupRecipients
          .filter(r => {
            const formatted = formatPhoneNumber(r.phone || r.phoneNumber || '');
            if (formatted && !uniquePhones.has(formatted)) {
              uniquePhones.add(formatted);
              return true;
            }
            return false;
          })
          .map(r => ({
            ...r,
            phone: formatPhoneNumber(r.phone || r.phoneNumber || ''),
            displayPhone: getDisplayPhoneNumber(r.phone || r.phoneNumber || ''),
            id: r.id || r.phone,
            source: 'group'
          }))
          .filter(r => r.phone);
      } else if (recipientSource === 'all') {
        const response = await api.communication.getAllRecipients();
        if (response && response.data && Array.isArray(response.data)) {
          loadedRecipients = response.data
            .map(r => ({
              ...r,
              phone: formatPhoneNumber(r.phone || r.phoneNumber || ''),
              displayPhone: getDisplayPhoneNumber(r.phone || r.phoneNumber || ''),
              id: r.id || r.phone,
              source: 'all'
            }))
            .filter(r => r.phone);
        } else if (response && response.success && Array.isArray(response)) {
          // Handle case where response is directly the array
          loadedRecipients = response
            .map(r => ({
              ...r,
              phone: formatPhoneNumber(r.phone || r.phoneNumber || ''),
              displayPhone: getDisplayPhoneNumber(r.phone || r.phoneNumber || ''),
              id: r.id || r.phone,
              source: 'all'
            }))
            .filter(r => r.phone);
        }
      }

      setRecipients(loadedRecipients);
      if (loadedRecipients.length === 0) {
        showError('No valid recipients found');
      } else {
        setPreviewData(prev => ({
          ...prev,
          name: loadedRecipients[0].name || 'Parent',
          grade: loadedRecipients[0].grade || 'Learner'
        }));
        showSuccess(`Loaded ${loadedRecipients.length} recipients`);
        setStep('compose');
      }
    } catch (err) {
      console.error('Error loading recipients:', err);
      showError('Failed to load recipients: ' + err.message);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone || !messageTemplate.trim()) {
      showError('Phone and message required');
      return;
    }

    setIsSendingTest(true);
    try {
      const formattedPhone = formatPhoneNumber(testPhone);
      if (!formattedPhone) throw new Error('Enter a valid Kenyan phone number.');
      const messageToSend = messageTemplate
        .replace(/{name}/gi, previewData.name)
        .replace(/{grade}/gi, previewData.grade)
        .replace(/{schoolName}/gi, previewData.schoolName);

      const response = await api.communication.sendTestSMS({
        phoneNumber: formattedPhone,
        message: messageToSend
      });
      if (response?.success === false) throw new Error(response.message || 'The SMS provider did not accept the test.');

      setTestResult({
        success: true,
        message: `✓ Test sent to ${getDisplayPhoneNumber(testPhone)}`
      });
      showSuccess('Test message sent!');
    } catch (error) {
      console.error('Test error:', error);
      setTestResult({
        success: false,
        message: `✗ Failed: ${error.message}`
      });
      showError('Failed to send test');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!messageTemplate.trim() || recipients.length === 0) {
      showError('Message and recipients required');
      return;
    }

    setSending(true);
    setDeliveryReport([]);
    setFailedRecipients([]);
    setCampaignId(null);
    setSendError('');

    try {
      // Use the new bulk API
      const response = await api.broadcasts.sendBulk({
        channel,
        messageTemplate: messageTemplate,
        messagePreview: messageTemplate.substring(0, 150),
        recipientSource,
        recipients: recipients.map(r => ({
          id: r.id,
          phone: r.phone,
          name: r.name,
          message: messageTemplate
            .replace(/{name}/gi, r.name || 'Friend')
            .replace(/{grade}/gi, r.grade || '')
            .replace(/{schoolName}/gi, previewData.schoolName),
          studentName: r.name,
          grade: r.grade
        }))
      });

      if (response.success) {
        setCampaignId(response.campaignId || null);
        showSuccess(`Broadcast processed: ${response.sentCount} accepted, ${response.failedCount} failed`);

        // Update local results for display
        const report = response.results || [];
        // Map backend results back to frontend display format
        const displayReport = recipients.map((r, idx) => {
          const res = report.find(res => res.phone === r.phone) || report[idx];
          return {
            ...r,
            status: res?.success ? 'Accepted by provider' : 'Failed',
            error: res.error,
            messageId: res.messageId,
            sentAt: new Date().toLocaleTimeString()
          };
        });

        setDeliveryReport(displayReport);
        setFailedRecipients(displayReport.filter(r => r.status === 'Failed'));
        setStep('send');

        // Refresh history from DB
        await loadHistoryFromDatabase();
      } else {
        throw new Error(response.message || 'Failed to send bulk broadcast');
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      setSendError(`${err.message}. Check Broadcast History before trying again, in case the provider accepted some messages.`);
      showError('Failed to send broadcast: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // Retry sending to failed recipients
  const handleRetryFailed = async () => {
    if (failedRecipients.length === 0) {
      showError('No failed recipients to retry');
      return;
    }

    setRetryingFailed(true);
    const report = [];
    let successCount = 0;
    const newfailed = [];

    for (let i = 0; i < failedRecipients.length; i++) {
      const recipient = failedRecipients[i];
      let status = 'Accepted by provider';
      let error = null;
      let messageId = null;

      try {
        const messageToSend = messageTemplate
          .replace(/{name}/gi, recipient.name || 'Friend')
          .replace(/{grade}/gi, recipient.grade || '')
          .replace(/{schoolName}/gi, previewData.schoolName);

        const response = await api.broadcasts.sendBulk({
          channel,
          recipientSource: 'RETRY',
          messageTemplate,
          messagePreview: messageTemplate.substring(0, 150),
          recipients: [{
            id: recipient.id,
            phone: recipient.phone,
            name: recipient.name,
            message: messageToSend,
            studentName: recipient.studentName,
            grade: recipient.grade,
          }],
        });
        const sendResult = response?.results?.[0];
        if (!response?.success || !sendResult?.success) throw new Error(sendResult?.error || response?.message || 'Retry failed');
        messageId = sendResult.messageId || null;
        successCount++;
      } catch (err) {
        status = 'Failed';
        error = err.message;
        newfailed.push(recipient);
      }

      report.push({ ...recipient, status, error, messageId, sentAt: new Date().toLocaleTimeString() });
    }

    setRetryingFailed(false);
    setFailedRecipients(newfailed);

    if (successCount > 0) {
      showSuccess(`Retry complete: ${successCount} messages accepted`);
      setDeliveryReport(prev => [...prev, ...report]);
    }

    if (newfailed.length > 0) {
      showError(`${newfailed.length} still failed`);
    }
  };

  // The campaign API is the source of truth for send history.
  const loadHistoryFromDatabase = async () => {
    try {
      const response = await api.broadcasts.getHistory(100, 0); // Get last 100
      const campaigns = response?.data || response?.campaigns || [];
      if (Array.isArray(campaigns)) {
        const dbItems = campaigns.map(campaign => ({
          id: campaign.id,
          timestamp: new Date(campaign.sentAt).toLocaleString(),
          totalRecipients: campaign.totalRecipients,
          successCount: campaign.successCount,
          failedCount: campaign.failedCount,
          messagePreview: campaign.messagePreview,
          channel: campaign.messageChannel,
          status: campaign.status,
          source: 'database',
          databaseId: campaign.id
        }));
        setMessageHistory(dbItems);
        console.log('✅ Loaded', dbItems.length, 'campaigns from database');
      }
    } catch (err) {
      console.error('Failed to load from database:', err);
      showError('Could not load broadcast history. Try again later.');
    }
  };

  // Open history modal and load from database
  const handleOpenHistory = async () => {
    setShowDeliveryLog(true);
    await loadHistoryFromDatabase();
  };

  const workflowSteps = ['channel', 'recipients', 'compose', 'review'];
  const activeStep = step === 'send' ? 'review' : step;
  const activeStepIndex = workflowSteps.indexOf(activeStep);

  return (
    <div className="h-full flex flex-col bg-white border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Send size={24} className="text-slate-700" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Broadcast Messages</h1>
              <p className="text-sm text-slate-600">Send messages to multiple recipients</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onNavigate?.('comm-messages')} className="gap-2">
              <ChevronLeft size={16} />Back to Inbox
            </Button>
            {messageHistory.length > 0 && (
              <Button
                onClick={handleOpenHistory}
                className="bg-brand-teal hover:bg-brand-teal/90 text-white font-medium gap-2"
              >
                <Download size={16} />
                History ({messageHistory.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between">
            {workflowSteps.map((s, idx) => (
              <React.Fragment key={s}>
                <button
                  type="button"
                  aria-current={idx === activeStepIndex ? 'step' : undefined}
                  disabled={step === 'send' || idx >= activeStepIndex}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all disabled:cursor-default ${idx <= activeStepIndex ? 'bg-blue-800 text-white' : 'bg-gray-300 text-gray-600'} ${idx < activeStepIndex ? 'cursor-pointer hover:bg-blue-700' : ''
                    }`}
                  onClick={() => setStep(s)}
                >
                  {idx + 1}
                </button>
                {idx < workflowSteps.length - 1 && <div className={`flex-1 h-1 mx-2 ${idx < activeStepIndex ? 'bg-blue-800' : 'bg-gray-300'}`} />}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-xs font-medium text-gray-600">
            <span>Channel</span>
            <span>Audience</span>
            <span>Compose</span>
            <span>{step === 'send' ? 'Report' : 'Review & send'}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {step === 'channel' && (
          <div className="mx-auto w-full max-w-2xl space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Step 1: Choose a channel</h2>
            <p className="text-sm text-slate-600">How should the school reach this audience?</p>
            {[
              { id: 'sms', title: 'SMS', detail: 'Send a text message to parent or guardian numbers.', color: 'border-blue-700 bg-blue-50 text-blue-900', icon: Phone },
              { id: 'whatsapp', title: 'WhatsApp', detail: 'Send a WhatsApp message to parent or guardian numbers.', color: 'border-emerald-700 bg-emerald-50 text-emerald-900', icon: MessageSquare },
            ].map(option => {
              const Icon = option.icon;
              return (
                <button key={option.id} type="button" aria-pressed={channel === option.id} onClick={() => setChannel(option.id)} className={`flex min-h-16 w-full items-center gap-4 border-b px-3 py-3 text-left transition ${channel === option.id ? option.color : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'}`}>
                  <Icon size={22} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{option.title}</span><span className="mt-0.5 block text-xs opacity-80">{option.detail}</span></span>
                  <span className="text-xs font-bold">{channel === option.id ? 'Selected' : 'Choose'}</span>
                </button>
              );
            })}
            <Button onClick={() => setStep('recipients')} className="mt-2 w-full gap-2 bg-blue-800 py-5 font-bold text-white hover:bg-blue-900">
              Choose audience <ChevronRight size={18} />
            </Button>
          </div>
        )}

        {step === 'recipients' && (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-xl font-bold text-slate-900">Step 2: Choose the audience</h2>
              <p className="text-sm text-slate-600">Sending by {channel === 'sms' ? 'SMS' : 'WhatsApp'}</p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Choose recipients">
              {[
                { id: 'manual', title: 'Enter phone numbers', detail: 'Type or paste contacts', icon: Phone },
                { id: 'csv', title: 'Upload contacts', detail: 'CSV or .xlsx file', icon: FileUp },
                { id: 'group', title: 'Choose grades', detail: 'Select one or more grades', icon: Users },
                { id: 'all', title: 'All parents', detail: 'Reach every parent contact', icon: Users },
              ].map(option => {
                const Icon = option.icon;
                const selected = recipientSource === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRecipientSource(option.id)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${selected ? 'border-blue-800 bg-blue-50 text-blue-950' : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-slate-50'}`}
                  >
                    <Icon size={20} className={selected ? 'text-blue-800' : 'text-slate-500'} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{option.title}</span>
                      <span className="block text-xs text-slate-600">{option.detail}</span>
                    </span>
                    <span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-blue-800' : 'border-slate-400'}`}>
                      {selected && <span className="h-2 w-2 rounded-full bg-blue-800" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Source-specific input */}
            {recipientSource === 'manual' && (
              <Card>
                <CardHeader>
                  <CardTitle>Enter Phone Numbers</CardTitle>
                  <CardDescription>
                    Separate by comma or newline. Formats: 0712345678, +254712345678, 254712345678, 712345678
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <textarea
                    value={manualNumbers}
                    onChange={(e) => setManualNumbers(e.target.value)}
                    placeholder="0712345678, 0723456789&#10;+254734567890&#10;714567890"
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple resize-none font-mono text-sm"
                  />
                  {manualNumbers.trim() && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                      <p className="font-medium text-blue-900">
                        Preview: {manualNumbers.split(/[,\n]/).filter(n => n.trim()).length} total entries
                      </p>
                      <p className="text-blue-700 mt-1">
                        Valid numbers will be auto-formatted to +254... format
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {recipientSource === 'csv' && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload a contact list</CardTitle>
                  <CardDescription>Include a Phone, Mobile, Parent Phone, or Guardian Phone column. Name and Grade columns are optional.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    type="file"
                    accept=".csv,.tsv,.xlsx"
                    onChange={(e) => { setCsvFile(e.target.files?.[0] || null); setRecipientImportNote(''); }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-teal file:text-white file:font-medium hover:file:bg-brand-teal/90"
                  />
                  {csvFile && <p className="text-sm text-green-600 font-medium">✓ {csvFile.name}</p>}
                  {recipientImportNote && <p className="text-sm text-amber-800">{recipientImportNote}</p>}
                </CardContent>
              </Card>
            )}

            {recipientSource === 'group' && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Groups</CardTitle>
                  <CardDescription>Choose one or more grades to target</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {groups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroups(prev =>
                          prev.includes(group.id) ? prev.filter(g => g !== group.id) : [...prev, group.id]
                        )}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition ${selectedGroups.includes(group.id)
                          ? 'bg-brand-purple text-white'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep('channel')} variant="outline" className="min-h-12 flex-1 gap-2"><ChevronLeft size={18} />Channel</Button>
              <Button
                onClick={handleLoadRecipients}
                disabled={loadingRecipients || !recipientSource || (recipientSource === 'manual' && !manualNumbers) || (recipientSource === 'csv' && !csvFile) || (recipientSource === 'group' && selectedGroups.length === 0)}
                className="min-h-12 flex-1 gap-2 bg-blue-800 font-bold text-white hover:bg-blue-900"
              >
                {loadingRecipients ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                Load audience
              </Button>
            </div>
          </div>
        )}

        {step === 'compose' && (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Step 3: Write the message</h2>

            <Card>
              <CardHeader>
                <CardTitle>Recipients Loaded</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-medium text-brand-purple">{recipients.length}</p>
                <p className="text-gray-600 text-sm mt-1">Recipients ready to receive message</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Write the message</CardTitle>
                <CardDescription>Choose a starter, then edit it. Personalize with {'{name}'}, {'{grade}'}, and {'{schoolName}'}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs font-bold text-slate-700">Channel: <span className={channel === 'whatsapp' ? 'text-emerald-700' : 'text-blue-800'}>{channel === 'sms' ? 'SMS' : 'WhatsApp'}</span></p>
                <div className="space-y-1.5">
                  <Label htmlFor="broadcast-template">Message starter</Label>
                  <select
                    id="broadcast-template"
                    value={templateSelection}
                    onChange={(event) => {
                      const selected = BROADCAST_TEMPLATES.find(item => item.id === event.target.value);
                      setTemplateSelection(event.target.value);
                      if (selected) setMessageTemplate(selected.message);
                    }}
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    <option value="">Start from a blank message</option>
                    {BROADCAST_TEMPLATES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => { setMessageTemplate(e.target.value); setTemplateSelection(''); }}
                  placeholder="Hello {name}, this is a message from {schoolName}..."
                  rows={5}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple resize-none"
                />
                <div className="flex justify-between items-center text-xs mt-1">
                  <div className="text-gray-500 font-medium">
                    {channel === 'sms' ? 'SMS segment estimate' : 'WhatsApp message'}
                  </div>
                  <div className={`font-medium ${messageTemplate.length > 160 ? 'text-orange-600' : 'text-brand-purple'}`}>
                    {channel === 'sms'
                      ? `${messageTemplate.length} characters | about ${getSmsSegments(messageTemplate)} SMS per recipient`
                      : `${messageTemplate.length} characters`}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye size={18} />
                  Message Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-white rounded-lg p-4 border border-gray-200 space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Recipient:</strong> {previewData.name} ({previewData.grade})
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {messageTemplate
                    .replace(/{name}/gi, previewData.name)
                    .replace(/{grade}/gi, previewData.grade)
                    .replace(/{schoolName}/gi, previewData.schoolName) || '(Preview will appear here)'}
                </p>
              </CardContent>
            </Card>

            {/* Test */}
            <Button
              onClick={() => setShowTestDialog(true)}
              disabled={channel !== 'sms'}
              variant="outline"
              className="w-full border-brand-teal text-brand-teal hover:bg-brand-teal/10 font-medium gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Phone size={18} />
              {channel === 'sms' ? 'Send SMS Test' : 'Select SMS to send a test'}
            </Button>

            <div className="flex gap-3">
              <Button
                onClick={() => setStep('recipients')}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft size={18} />
                Back
              </Button>
              <Button
                onClick={() => setStep('review')}
                disabled={!messageTemplate.trim()}
                title={!messageTemplate.trim() ? "Please enter a message first" : ""}
                className="flex-1 bg-brand-purple hover:bg-brand-purple/90 text-white font-medium gap-2"
              >
                Next
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Review before sending</h2>
            <p className="text-sm text-slate-600">You’re sending by {channel === 'sms' ? 'SMS' : 'WhatsApp'} to {recipients.length} recipients from {recipientSource === 'all' ? 'all parent contacts' : recipientSource === 'group' ? selectedGroups.map(id => groups.find(group => group.id === id)?.name || id).join(', ') : recipientSource === 'manual' ? 'your entered contact list' : 'your uploaded contact list'}.</p>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-gray-600 text-sm">Recipients</p>
                  <p className="text-3xl font-medium text-brand-purple">{recipients.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-gray-600 text-sm">Message Length</p>
                  <p className="text-3xl font-medium text-brand-teal">
                    {messageTemplate.length}
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      {channel === 'sms' ? `(about ${getSmsSegments(messageTemplate)} SMS)` : '(WhatsApp)'}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                  <CardTitle>Message preview</CardTitle>
              </CardHeader>
              <CardContent className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {messageTemplate
                    .replace(/{name}/gi, previewData.name)
                    .replace(/{grade}/gi, previewData.grade)
                    .replace(/{schoolName}/gi, previewData.schoolName)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recipients Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recipients.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{r.name}</span>
                      <span className="text-gray-500 font-mono">{r.displayPhone}</span>
                    </div>
                  ))}
                  {recipients.length > 10 && (
                    <p className="text-sm text-gray-500 mt-4">+{recipients.length - 10} more</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={() => setStep('compose')}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft size={18} />
                Back
              </Button>
              <Button
                onClick={handleSendBroadcast}
                disabled={sending || !messageTemplate.trim() || recipients.length === 0}
                title={!messageTemplate.trim() ? "Message cannot be empty" : ""}
                className="flex-1 gap-2 bg-blue-800 font-bold text-white hover:bg-blue-900"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {sending ? 'Sending…' : `Send to ${recipients.length} recipients`}
              </Button>
            </div>
            {sendError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sendError}</div>}
          </div>
        )}

        {step === 'send' && (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Broadcast report</h2>
            <p className="text-sm text-slate-600">“Accepted by provider” means the SMS or WhatsApp service accepted the request. Delivery and bounce receipts are not available here yet.</p>
            {campaignId && <p className="text-xs text-slate-500">Campaign reference: <span className="font-mono">{campaignId}</span></p>}
            {deliveryReport.length === 0 ? (
              <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No recipient results were returned. Check Broadcast History before sending again.</div>
            ) : (
              <>
                {/* Results */}
                {deliveryReport.length > 0 && (
                  <>
                    <Card>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <p className="text-gray-600 text-sm">Total</p>
                            <p className="text-3xl font-medium text-gray-800">{deliveryReport.length}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-600 text-sm">Accepted by provider</p>
                            <p className="text-3xl font-medium text-green-600">
                              {deliveryReport.filter(r => r.status === 'Accepted by provider').length}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-600 text-sm">Failed</p>
                            <p className="text-3xl font-medium text-red-600">
                              {deliveryReport.filter(r => r.status === 'Failed').length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Report Table with Message IDs */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>Send results</CardTitle>
                          <p className="text-sm text-gray-500 mt-1">Provider response and message references</p>
                        </div>
                        <div className="flex gap-2">
                          {failedRecipients.length > 0 && (
                            <Button
                              onClick={handleRetryFailed}
                              disabled={retryingFailed}
                              className="bg-orange-600 hover:bg-orange-700 text-white font-medium gap-2 text-sm"
                            >
                              {retryingFailed ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                              Retry {failedRecipients.length} Failed
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={handleOpenHistory}
                            className="gap-2 text-sm"
                          >
                            <Eye size={16} />
                            View history
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[color:var(--table-header-bg)]">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-[color:var(--table-header-fg)]">Recipient</th>
                              <th className="px-3 py-2 text-left font-semibold text-[color:var(--table-header-fg)]">Phone</th>
                              <th className="px-3 py-2 text-left font-semibold text-[color:var(--table-header-fg)]">Status</th>
                              <th className="px-3 py-2 text-left font-semibold text-[color:var(--table-header-fg)]">Message ID</th>
                              <th className="px-3 py-2 text-left font-semibold text-[color:var(--table-header-fg)]">Result time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y max-h-96 overflow-y-auto">
                            {deliveryReport.map((r, i) => (
                              <tr key={i} className={r.status === 'Accepted by provider' ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}>
                                <td className="px-3 py-2 font-medium">{r.name}</td>
                                <td className="px-3 py-2 font-mono">{r.displayPhone}</td>
                                <td className="px-3 py-2">
                                  <Badge className={r.status === 'Accepted by provider' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}>
                                    {r.status === 'Accepted by provider' ? <CheckCircle size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                                    {r.status}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.messageId || '−'}</td>
                                <td className="px-3 py-2 text-gray-600">{r.sentAt || '−'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </>
                )}

                <Button
                  onClick={() => {
                    setStep('recipients');
                    setRecipients([]);
                    setMessageTemplate('');
                    setTemplateSelection('');
                    setDeliveryReport([]);
                    setCampaignId(null);
                    setSendError('');
                  }}
                  className="w-full bg-brand-purple hover:bg-brand-purple/90 text-white font-medium gap-2"
                >
                  <Plus size={18} />
                  Send Another Broadcast
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delivery Log Modal */}
      <Dialog open={showDeliveryLog} onOpenChange={setShowDeliveryLog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download size={20} className="text-brand-purple" />
              Broadcast Message History ({messageHistory.length})
            </DialogTitle>
            <DialogDescription>
              Review past campaigns and provider submission results
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[calc(80vh-150px)] overflow-y-auto">
            {messageHistory.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 font-semibold">No message history yet</p>
                <p className="text-gray-400 text-sm mt-1">Your broadcasts will appear here after sending</p>
              </div>
            ) : (
              messageHistory.map((item, idx) => (
                <Card key={idx} className={`border-l-4 ${item.failedCount === 0 ? 'border-l-green-500' : 'border-l-orange-500'}`}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-4 gap-3 items-start">
                      <div className="col-span-2">
                        <p className="font-medium text-gray-800 text-sm line-clamp-2">{item.messagePreview}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.channel || 'Message'} · {item.timestamp}</p>
                        <p className="text-xs text-gray-400 mt-1 font-mono">{item.id}</p>
                      </div>
                      <div className="text-right">
                          <p className="text-xs text-gray-600 mb-1">Accepted / failed</p>
                        <div className="flex gap-2 justify-end text-sm">
                          <Badge variant="default" className="bg-green-600">✓ {item.successCount}</Badge>
                          {item.failedCount > 0 && (
                            <Badge variant="destructive" className="bg-red-600">✗ {item.failedCount}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600 mb-1">Total</p>
                        <p className="text-lg font-medium text-gray-800">{item.totalRecipients}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone size={20} />
              Send Test Message
            </DialogTitle>
            <DialogDescription>
              Send a test message to verify before sending to all recipients
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testPhone">Phone Number</Label>
              <Input
                id="testPhone"
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="0712345678"
              />
            </div>

            <Card className="bg-gray-50">
              <CardContent className="p-4 text-sm text-gray-800 max-h-48 overflow-y-auto">
                {messageTemplate
                  .replace(/{name}/gi, previewData.name)
                  .replace(/{grade}/gi, previewData.grade)
                  .replace(/{schoolName}/gi, previewData.schoolName) || '(Message preview)'}
              </CardContent>
              <div className="px-4 pb-2 text-right text-[10px] text-gray-500 font-medium">
                {channel === 'sms'
                  ? `${messageTemplate.length} chars | about ${getSmsSegments(messageTemplate)} SMS`
                  : `${messageTemplate.length} chars | WhatsApp`}
              </div>
            </Card>

            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {testResult.message}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={isSendingTest || !testPhone}
              className="bg-brand-teal hover:bg-brand-teal/90 text-white font-medium gap-2"
            >
              {isSendingTest ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BroadcastMessagesPage;
