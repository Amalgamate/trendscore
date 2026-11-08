import React, { useState, useEffect } from 'react';
import {
  Send, Upload, Users, Phone, MessageSquare, CheckCircle, AlertCircle,
  Loader2, RefreshCw, FileUp, X, Eye, Trash2, Plus, ChevronRight, ChevronLeft, Download, Copy
} from 'lucide-react';
import {
  Card, CardHeader, CardContent, CardTitle, CardDescription, Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Badge, Tabs, TabsList, TabsTrigger, TabsContent
} from '../../../components/ui';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';
import { getStoredUser } from '../../../services/schoolContext';
import { formatPhoneNumber, isValidPhoneNumber, getDisplayPhoneNumber } from '../../../utils/phoneFormatter';
import { useSchoolData } from '../../../contexts/SchoolDataContext';

const BroadcastMessagesPage = ({ onNavigate }) => {
  const { showSuccess, showError } = useNotifications();

  // Channel first, then audience, message, review, and delivery report.
  const [step, setStep] = useState(() => window.sessionStorage.getItem('trendscore.broadcast.channel') ? 'recipients' : 'channel');

  // Recipients State
  const [recipientSource, setRecipientSource] = useState(''); // 'manual', 'csv', 'group', 'all'
  const [manualNumbers, setManualNumbers] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [groups, setGroups] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Message State
  const [messageTemplate, setMessageTemplate] = useState('');
  const [channel, setChannel] = useState(() => window.sessionStorage.getItem('trendscore.broadcast.channel') || 'sms');
  const [previewData, setPreviewData] = useState({ name: 'John', grade: 'Grade 1', schoolName: '' });

  // Test State
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Send State
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deliveryReport, setDeliveryReport] = useState([]);

  // Message History & Tracking State
  const [messageHistory, setMessageHistory] = useState([]);
  const [showDeliveryLog, setShowDeliveryLog] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [failedRecipients, setFailedRecipients] = useState([]);

  useEffect(() => {
    window.sessionStorage.removeItem('trendscore.broadcast.channel');
    const user = getStoredUser();
    setPreviewData(prev => ({
      ...prev,
      schoolName: user?.school?.name || 'School'
    }));
    loadMessageHistory();
    loadHistoryFromDatabase(); // Load from DB too
  }, []);

  const { grades: fetchedGrades } = useSchoolData();

  useEffect(() => {
    if (fetchedGrades && fetchedGrades.length > 0) {
      setGroups(fetchedGrades.map(g => ({ id: g, name: g.replace(/_/g, ' ') })));
    }
  }, [fetchedGrades]);

  // Load message history from localStorage
  const loadMessageHistory = () => {
    try {
      const saved = localStorage.getItem('broadcastMessageHistory');
      if (saved) setMessageHistory(JSON.parse(saved));
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Save to message history - read from localStorage to ensure we have latest data
  const saveToHistory = (item) => {
    try {
      // Always read from localStorage to get the current state (not relying on state which might be stale)
      let current = [];
      const saved = localStorage.getItem('broadcastMessageHistory');
      if (saved) {
        current = JSON.parse(saved);
      }

      // Add new item to the beginning and keep only 50
      const updated = [item, ...current].slice(0, 50);

      // Save to localStorage
      localStorage.setItem('broadcastMessageHistory', JSON.stringify(updated));

      // Update state for real-time UI update
      setMessageHistory(updated);

      console.log('✅ Message saved to history. Total items:', updated.length);
    } catch (err) {
      console.error('Failed to save to history:', err);
    }
  };

  // Removed manual fetchGroups using learners API

  const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n');
          const numbers = [];

          lines.forEach((line, idx) => {
            if (idx === 0 && (line.toLowerCase().includes('phone') || line.toLowerCase().includes('number'))) return;
            const matches = line.match(/[\d+\-\s()]+/g);
            if (matches) {
              const phone = matches[0].replace(/[\s\-()]/g, '');
              if (/^\d+$/.test(phone) && phone.length >= 9) {
                numbers.push(phone);
              }
            }
          });

          resolve([...new Set(numbers)]);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
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

        loadedRecipients = validNumbers.map((phone, idx) => ({
          id: phone,
          phone: phone,
          displayPhone: getDisplayPhoneNumber(phone),
          name: `Contact ${phone.slice(-4)}`,
          source: 'manual'
        }));
      } else if (recipientSource === 'csv' && csvFile) {
        const numbers = await parseCSV(csvFile);
        loadedRecipients = numbers.map(phone => ({
          id: phone,
          phone: formatPhoneNumber(phone),
          displayPhone: getDisplayPhoneNumber(phone),
          name: `Contact ${phone.slice(-4)}`,
          source: 'csv'
        }));
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
      const messageToSend = messageTemplate
        .replace(/{name}/gi, previewData.name)
        .replace(/{grade}/gi, previewData.grade)
        .replace(/{schoolName}/gi, previewData.schoolName);

      const response = await api.communication.sendTestSMS({
        phoneNumber: formattedPhone,
        message: messageToSend
      });

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

    const confirmed = window.confirm(
      `Send to ${recipients.length} recipients via ${channel.toUpperCase()}?\n\nMessage preview:\n"${messageTemplate.substring(0, 60)}..."`
    );
    if (!confirmed) return;

    setSending(true);
    setDeliveryReport([]);
    setFailedRecipients([]);
    setProgress(0);

    try {
      // Use the new bulk API
      const response = await api.broadcasts.sendBulk({
        channel,
        messageTemplate: messageTemplate,
        messagePreview: messageTemplate.substring(0, 150),
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
        showSuccess(`Broadcast processed: ${response.sentCount} accepted, ${response.failedCount} failed`);

        // Update local results for display
        const report = response.results || [];
        // Map backend results back to frontend display format
        const displayReport = recipients.map((r, idx) => {
          const res = report.find(res => res.phone === r.phone) || report[idx];
          return {
            ...r,
            status: res.success ? 'Accepted' : 'Failed',
            error: res.error,
            messageId: res.messageId,
            sentAt: new Date().toLocaleTimeString()
          };
        });

        setDeliveryReport(displayReport);
        setFailedRecipients(displayReport.filter(r => r.status === 'Failed'));
        setProgress(100);

        // Refresh history from DB
        await loadHistoryFromDatabase();
      } else {
        throw new Error(response.message || 'Failed to send bulk broadcast');
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      showError('Failed to send broadcast: ' + err.message);
    } finally {
      setSending(false);
      setStep('send');
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
      let status = 'Accepted';
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

  // Save broadcast to database for audit trail
  const saveBroadcastToDatabase = async (historyItem, totalRecipients) => {
    try {
      // Build delivery report from report state  
      const deliveryData = deliveryReport.map(item => ({
        recipientPhone: item.phone || item.displayPhone || item.phoneNumber,
        recipientName: item.name || item.displayName || '',
        status: item.status === 'Accepted' ? 'SENT' : item.status === 'Failed' ? 'FAILED' : 'PENDING',
        messageId: item.messageId,
        failureReason: item.error || null,
        sentAt: new Date().toISOString()
      }));

      const campaignData = {
        messagePreview: messageTemplate.substring(0, 150),
        messageTemplate: messageTemplate,
        totalRecipients: totalRecipients,
        successCount: deliveryReport.filter(r => r.status === 'Accepted').length,
        failedCount: failedRecipients.length,
        recipientSource: recipientSource,
        status: failedRecipients.length === 0 ? 'COMPLETED' : 'PARTIAL',
        recipients: deliveryData
      };

      const response = await api.broadcasts.saveCampaign(campaignData);
      console.log('✅ Campaign saved to database:', response.id);
    } catch (err) {
      console.error('❌ Failed to save campaign to database:', err);
      // Continue - localStorage already has the data as fallback
      // Don't show error to user - broadcast already sent
    }
  };

  // Load history from database and merge with localStorage
  const loadHistoryFromDatabase = async () => {
    try {
      const response = await api.broadcasts.getHistory(100, 0); // Get last 100
      if (response?.campaigns) {
        // Convert database format to display format and merge with localStorage
        const dbItems = response.campaigns.map(campaign => ({
          id: campaign.id,
          timestamp: new Date(campaign.sentAt).toLocaleString(),
          totalRecipients: campaign.totalRecipients,
          successCount: campaign.successCount,
          failedCount: campaign.failedCount,
          messagePreview: campaign.messagePreview,
          source: 'database',
          databaseId: campaign.id
        }));

        // Merge database items with localStorage items (database first, then localStorage)
        const merged = [...dbItems, ...messageHistory.filter(h => h.source !== 'database')];
        setMessageHistory(merged);
        console.log('✅ Loaded', dbItems.length, 'campaigns from database');
      }
    } catch (err) {
      console.error('Failed to load from database:', err);
      // Gracefully fall back to localStorage
    }
  };

  // Open history modal and load from database
  const handleOpenHistory = async () => {
    setShowDeliveryLog(true);
    await loadHistoryFromDatabase();
  };

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
        <div className="flex items-center justify-between max-w-2xl">
          {['channel', 'recipients', 'compose', 'review', 'send'].map((s, idx) => (
            <React.Fragment key={s}>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full cursor-pointer transition-all ${step === s ? 'bg-brand-purple text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                onClick={() => idx < ['channel', 'recipients', 'compose', 'review', 'send'].indexOf(step) && setStep(s)}
              >
                {idx + 1}
              </div>
              {idx < 4 && <div className={`flex-1 h-1 mx-2 ${step !== s ? 'bg-gray-300' : 'bg-brand-purple'}`} />}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-600 mt-3 max-w-2xl">
          <span>Channel</span>
          <span>Audience</span>
          <span>Compose</span>
          <span>Review</span>
          <span>Send</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {step === 'channel' && (
          <div className="max-w-2xl space-y-4">
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
          <div className="max-w-3xl space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">Step 2: Choose the audience</h2><p className="mt-1 text-sm text-slate-600">Sending by {channel === 'sms' ? 'SMS' : 'WhatsApp'}.</p></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Manual Numbers */}
              <Card
                className={`cursor-pointer transition ${recipientSource === 'manual' ? 'border-brand-purple border-2' : ''}`}
                onClick={() => setRecipientSource('manual')}
              >
                <CardContent className="p-6 text-center">
                  <Phone size={32} className="mx-auto mb-2 text-brand-teal" />
                  <h3 className="font-medium text-gray-800">Manual Entry</h3>
                  <p className="text-sm text-gray-500 mt-1">Enter phone numbers directly</p>
                </CardContent>
              </Card>

              {/* CSV Upload */}
              <Card
                className={`cursor-pointer transition ${recipientSource === 'csv' ? 'border-brand-purple border-2' : ''}`}
                onClick={() => setRecipientSource('csv')}
              >
                <CardContent className="p-6 text-center">
                  <FileUp size={32} className="mx-auto mb-2 text-brand-teal" />
                  <h3 className="font-medium text-gray-800">CSV/Excel</h3>
                  <p className="text-sm text-gray-500 mt-1">Upload a file with phone numbers</p>
                </CardContent>
              </Card>

              {/* Group */}
              <Card
                className={`cursor-pointer transition ${recipientSource === 'group' ? 'border-brand-purple border-2' : ''}`}
                onClick={() => setRecipientSource('group')}
              >
                <CardContent className="p-6 text-center">
                  <Users size={32} className="mx-auto mb-2 text-brand-teal" />
                  <h3 className="font-medium text-gray-800">Grade/Group</h3>
                  <p className="text-sm text-gray-500 mt-1">Select a grade or group</p>
                </CardContent>
              </Card>

              {/* All Parents */}
              <Card
                className={`cursor-pointer transition ${recipientSource === 'all' ? 'border-brand-purple border-2' : ''}`}
                onClick={() => setRecipientSource('all')}
              >
                <CardContent className="p-6 text-center">
                  <Users size={32} className="mx-auto mb-2 text-brand-teal" />
                  <h3 className="font-medium text-gray-800">All Parents</h3>
                  <p className="text-sm text-gray-500 mt-1">Send to entire school</p>
                </CardContent>
              </Card>
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
                    rows={6}
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
                  <CardTitle>Upload CSV/Excel</CardTitle>
                  <CardDescription>File should contain phone numbers (with or without header)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setCsvFile(e.target.files?.[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-teal file:text-white file:font-medium hover:file:bg-brand-teal/90"
                  />
                  {csvFile && <p className="text-sm text-green-600 font-medium">✓ {csvFile.name}</p>}
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
          <div className="max-w-3xl space-y-6">
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
                <CardTitle>Message Template</CardTitle>
                <CardDescription>Use variables: {'{name}'}, {'{grade}'}, {'{schoolName}'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs font-bold text-slate-700">Channel: <span className={channel === 'whatsapp' ? 'text-emerald-700' : 'text-blue-800'}>{channel === 'sms' ? 'SMS' : 'WhatsApp'}</span></p>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Hello {name}, this is a message from {schoolName}..."
                  rows={5}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple resize-none"
                />
                <div className="flex justify-between items-center text-xs mt-1">
                  <div className="text-gray-500 font-medium">
                    {channel === 'sms' ? 'Standard SMS: 160 chars' : 'WhatsApp message'}
                  </div>
                  <div className={`font-medium ${messageTemplate.length > 160 ? 'text-orange-600' : 'text-brand-purple'}`}>
                    {channel === 'sms'
                      ? `${messageTemplate.length} characters | ${messageTemplate.length > 160 ? Math.ceil(messageTemplate.length / 153) : (messageTemplate.length > 0 ? 1 : 0)} SMS`
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
          <div className="max-w-3xl space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Step 4: Review and confirm</h2>

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
                      {channel === 'sms' ? `(${messageTemplate.length > 160 ? Math.ceil(messageTemplate.length / 153) : (messageTemplate.length > 0 ? 1 : 0)} SMS)` : '(WhatsApp)'}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Message Preview</CardTitle>
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
                onClick={() => setStep('send')}
                disabled={sending || !messageTemplate.trim()}
                title={!messageTemplate.trim() ? "Message cannot be empty" : ""}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium gap-2"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Send Broadcast
              </Button>
            </div>
          </div>
        )}

        {step === 'send' && (
          <div className="max-w-3xl space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Step 5: Sending report</h2>
            <p className="text-sm text-slate-600">This report records the provider's immediate response. Later delivery or bounce updates need a provider status callback, which is not connected yet.</p>

            {!sending && deliveryReport.length === 0 ? (
              <div className="text-center py-12">
                <Button
                  onClick={handleSendBroadcast}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium gap-2 px-6 py-3 text-lg"
                >
                  <Send size={20} />
                  Start Sending
                </Button>
              </div>
            ) : (
              <>
                {/* Progress */}
                {sending && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex justify-between font-medium">
                          <span>Sending Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div className="bg-brand-purple h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-sm text-gray-600">
                          {deliveryReport.length} of {recipients.length} messages processed...
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                            <p className="text-gray-600 text-sm">Accepted</p>
                            <p className="text-3xl font-medium text-green-600">
                              {deliveryReport.filter(r => r.status === 'Accepted').length}
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
                          <CardTitle>Delivery Report</CardTitle>
                          <p className="text-sm text-gray-500 mt-1">All messages with tracking IDs</p>
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
                            onClick={() => setShowDeliveryLog(!showDeliveryLog)}
                            className="gap-2 text-sm"
                          >
                            <Eye size={16} />
                            Details
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
                              <th className="px-3 py-2 text-left font-semibold text-[color:var(--table-header-fg)]">Sent At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y max-h-96 overflow-y-auto">
                            {deliveryReport.map((r, i) => (
                              <tr key={i} className={r.status === 'Accepted' ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}>
                                <td className="px-3 py-2 font-medium">{r.name}</td>
                                <td className="px-3 py-2 font-mono">{r.displayPhone}</td>
                                <td className="px-3 py-2">
                                  <Badge className={r.status === 'Accepted' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}>
                                    {r.status === 'Accepted' ? <CheckCircle size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
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
                    setDeliveryReport([]);
                    setProgress(0);
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
              View all recently sent broadcasts and delivery stats
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
                        <p className="text-xs text-gray-500 mt-1">Sent: {item.timestamp}</p>
                        <p className="text-xs text-gray-400 mt-1 font-mono">{item.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600 mb-1">Delivery</p>
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
                  ? `${messageTemplate.length} chars | ${messageTemplate.length > 160 ? Math.ceil(messageTemplate.length / 153) : (messageTemplate.length > 0 ? 1 : 0)} SMS`
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
