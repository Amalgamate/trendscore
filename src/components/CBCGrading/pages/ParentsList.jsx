/**
 * Parents List Page - Table Format with WhatsApp Integration
 * Display and manage parent/guardian information in table format
 * Teachers can archive but not delete
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Edit, Trash2, Users, Mail, Phone, Eye, MessageCircle, Archive, Search, RefreshCw, ChevronLeft, ChevronRight, Key, UserCheck, Users2, ShieldAlert, ChevronDown, ChevronUp, Download, X, MessageSquare, Loader2, Send } from 'lucide-react';
import { userAPI } from '../../../services/api/user.api';
import { communicationAPI } from '../../../services/api';
import api from '../../../services/api';
import StatusBadge from '../shared/StatusBadge';
import EmptyState from '../shared/EmptyState';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuth } from '../../../hooks/useAuth';
import BulkOperationsModal from '../shared/bulk/BulkOperationsModal';
import { formatPhoneNumber } from '../../../utils/phoneFormatter';
import { getSelectedInstitutionType } from '../../../services/schoolContext';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';

const ParentsList = ({ parents = [], pagination, onFetchParents, onAddParent, onEditParent, onViewParent, onDeleteParent, onArchiveParent, onRefresh, loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const [metricsFilter, setMetricsFilter] = useState('all'); // all | linked | single | multi | guardians
  const [selectedParentIds, setSelectedParentIds] = useState([]);
  const [showQuickCommunication, setShowQuickCommunication] = useState(false);
  const [bulkChannel, setBulkChannel] = useState('sms');
  const [bulkMessage, setBulkMessage] = useState('');
  const [isSendingBulkMessage, setIsSendingBulkMessage] = useState(false);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [allLearners, setAllLearners] = useState([]);
  const { can, isRole } = usePermissions();
  const { user } = useAuth();
  const currentUserIsTeacher = isRole('TEACHER');

  // Check if user can delete (only admins)
  const canDelete = can('DELETE_PARENT');

  const isDemoParent = (parent) => {
    const email = String(parent?.email || '').toLowerCase();
    const firstName = String(parent?.firstName || '').toLowerCase();
    const lastName = String(parent?.lastName || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    return email.includes('demo') || fullName.includes('demo');
  };

  const getInitials = (parent) => {
    const fullName = `${parent?.firstName || ''} ${parent?.lastName || ''}`.trim();
    if (!fullName) return 'NA';
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  };

  // In dev, Fast Refresh can preserve previous collapsed state.
  // Force metrics open on mount so the cards are always visible by default.
  useEffect(() => {
    setShowMetrics(true);
  }, []);

  // Server-side filtering effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFetchParents) {
        onFetchParents({
          page: 1,
          search: searchTerm,
          limit: pagination?.limit || 20
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, onFetchParents, pagination?.limit]);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (onFetchParents) {
      onFetchParents({
        page: newPage,
        search: searchTerm,
        limit: pagination?.limit || 20
      });
    }
  };

  const selectedInstitutionType = String(getSelectedInstitutionType() || user?.institutionType || '').toUpperCase();
  const isSecondaryPortal = selectedInstitutionType === 'SECONDARY' || selectedInstitutionType === 'HIGH_SCHOOL';
  const isSecondaryGrade = (gradeValue) => {
    const g = String(gradeValue || '').trim().toUpperCase();
    return g.startsWith('FORM') || ['GRADE_10', 'GRADE_11', 'GRADE_12', 'GRADE10', 'GRADE11', 'GRADE12'].includes(g);
  };

  const scopedLearners = useMemo(() => {
    const rows = Array.isArray(allLearners) ? allLearners : [];
    return rows.filter((learner) => {
      const learnerIsSecondary = isSecondaryGrade(learner?.grade);
      return isSecondaryPortal ? learnerIsSecondary : !learnerIsSecondary;
    });
  }, [allLearners, isSecondaryPortal]);

  const scopedParentIds = useMemo(() => {
    const ids = new Set();
    scopedLearners.forEach((learner) => {
      if (learner?.parentId) ids.add(learner.parentId);
    });
    return ids;
  }, [scopedLearners]);

  const scopedParents = useMemo(() => {
    const source = Array.isArray(parents) ? parents : [];
    return source.filter((p) => scopedParentIds.has(p.id));
  }, [parents, scopedParentIds]);

  // Filter parents (fallback for client-side if onFetchParents is not provided)
  const filteredParents = onFetchParents ? scopedParents : scopedParents.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  const nonDemoParents = filteredParents.filter((p) => !isDemoParent(p));
  const displayTotalParents = nonDemoParents.length;

  const parentLearnerCountMap = React.useMemo(() => {
    const map = new Map();
    for (const learner of scopedLearners) {
      const parentId = learner?.parentId;
      if (!parentId) continue;
      map.set(parentId, (map.get(parentId) || 0) + 1);
    }
    return map;
  }, [scopedLearners]);

  const metricFilteredParents = nonDemoParents.filter((p) => {
    const childCount = parentLearnerCountMap.get(p.id) || 0;
    if (metricsFilter === 'linked') return childCount > 0;
    if (metricsFilter === 'single') return childCount === 1;
    if (metricsFilter === 'multi') return childCount > 1;
    if (metricsFilter === 'guardians') {
      const first = String(p.firstName || '').toLowerCase();
      const last = String(p.lastName || '').toLowerCase();
      const full = `${first} ${last}`;
      return full.includes('guardian') || last === 'guardian';
    }
    return true;
  });

  const metrics = React.useMemo(() => {
    const source = nonDemoParents;
    const linked = source.filter((p) => (parentLearnerCountMap.get(p.id) || 0) > 0);
    const unlinked = source.filter((p) => (parentLearnerCountMap.get(p.id) || 0) === 0);
    const singleChild = source.filter((p) => (parentLearnerCountMap.get(p.id) || 0) === 1);
    const multiChild = source.filter((p) => (parentLearnerCountMap.get(p.id) || 0) > 1);
    const guardiansOnly = source.filter((p) => {
      const first = String(p.firstName || '').toLowerCase();
      const last = String(p.lastName || '').toLowerCase();
      const full = `${first} ${last}`;
      return full.includes('guardian') || last === 'guardian';
    });
    const active = source.filter((p) => String(p.status || '').toUpperCase() === 'ACTIVE');
    const linkedChildrenTotal = linked.reduce((sum, p) => sum + (parentLearnerCountMap.get(p.id) || 0), 0);
    const avgChildrenPerLinked = linked.length ? (linkedChildrenTotal / linked.length) : 0;

    return {
      totalParents: source.length,
      linkedParents: linked.length,
      unlinkedParents: unlinked.length,
      singleChildParents: singleChild.length,
      multiChildParents: multiChild.length,
      guardiansOnly: guardiansOnly.length,
      activeParents: active.length,
      linkedChildrenTotal,
      avgChildrenPerLinked: avgChildrenPerLinked.toFixed(1)
    };
  }, [nonDemoParents, parentLearnerCountMap]);

  useEffect(() => {
    let mounted = true;
    const fetchLearnerTotal = async () => {
      try {
        const response = await api.learners.getAll({ page: 1, limit: 10000 });
        if (!mounted) return;
        const learners = Array.isArray(response?.data) ? response.data : [];
        setAllLearners(learners);
      } catch (e) {
        if (mounted) {
          setAllLearners([]);
          setStudentsTotal(0);
        }
      }
    };
    fetchLearnerTotal();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setStudentsTotal(scopedLearners.length);
  }, [scopedLearners]);

  // Handle WhatsApp message
  const handleWhatsAppMessage = (parent) => {
    if (!parent.phone) {
      alert('This parent does not have a phone number on file.');
      return;
    }

    // Format phone number (remove spaces, dashes, etc.)
    let phoneNumber = String(parent.phone).replace(/[\s()-]/g, '');

    // Ensure it starts with country code or at least positive digit
    if (!phoneNumber.startsWith('+')) {
      // If it starts with 0 (traditional local), we still need to decide how to handle it.
      // For now, we'll keep the logic but move it to a more generic helper if possible.
      // Since we want to remove the hardcoded +254 assumption:
      if (phoneNumber.startsWith('0')) {
        // We'll still need a way to know the default country code, but for now we'll just prepend +
        phoneNumber = '+' + phoneNumber;
      } else {
        phoneNumber = '+' + phoneNumber;
      }
    }

    // Default message template
    const message = encodeURIComponent(
      `Dear ${parent.name},\n\nGreetings from ${PRODUCT_DISPLAY_NAME} Academy.\n\n`
    );

    // Open WhatsApp with pre-filled message
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleReset = () => {
    setSearchTerm('');
    setMetricsFilter('all');
  };

  const toggleMetricFilter = (filterKey) => {
    setMetricsFilter((prev) => (prev === filterKey ? 'all' : filterKey));
  };

  const handleExportFilteredParents = () => {
    const rows = metricFilteredParents.map((p) => ({
      name: `${p.firstName || ''} ${p.middleName ? `${p.middleName} ` : ''}${p.lastName || ''}`.trim(),
      email: p.email || '',
      phone: p.phone || '',
      relationship: p.relationship || '',
      status: p.status || '',
      learners: parentLearnerCountMap.get(p.id) || 0
    }));

    const headers = ['Name', 'Email', 'Phone', 'Relationship', 'Status', 'Learners'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r) => [
        r.name,
        r.email,
        r.phone,
        r.relationship,
        r.status,
        r.learners
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parents_filtered_export_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendCredentials = async (parent) => {
    if (!parent.phone && !parent.email) {
      alert('This parent does not have a phone or email on file.');
      return;
    }

    if (!window.confirm(`Send login credentials to ${parent.firstName}? This will reset their password and notify them via SMS/WhatsApp.`)) {
      return;
    }

    try {
      const response = await userAPI.sendCredentials(parent.id);
      if (response.success) {
        alert('Credentials dispatched successfully!');
      } else {
        alert('Failed: ' + (response.message || 'Unknown error'));
      }
    } catch (err) {
      alert('An error occurred while sending credentials.');
    }
  };

  const visibleParentIds = metricFilteredParents.map((p) => p.id);
  const allVisibleSelected = visibleParentIds.length > 0 && visibleParentIds.every((id) => selectedParentIds.includes(id));

  const handleToggleSelectAll = (checked) => {
    if (checked) {
      setSelectedParentIds(visibleParentIds);
      return;
    }
    setSelectedParentIds([]);
  };

  const handleToggleParentSelection = (parentId, checked) => {
    setSelectedParentIds((prev) => {
      if (checked) return [...new Set([...prev, parentId])];
      return prev.filter((id) => id !== parentId);
    });
  };

  const selectedParents = metricFilteredParents.filter((p) => selectedParentIds.includes(p.id));
  const selectedParentsWithPhone = selectedParents.filter((p) => String(p.phone || '').trim().length > 0);

  const openBulkCommunicationModal = (channel) => {
    setBulkChannel(channel);
    setBulkMessage('');
    setShowQuickCommunication(true);
  };

  const handleSendBulkCommunication = async () => {
    if (!bulkMessage.trim()) {
      alert('Please type a message first.');
      return;
    }
    if (selectedParentsWithPhone.length === 0) {
      alert('No selected parents have phone numbers.');
      return;
    }

    setIsSendingBulkMessage(true);
    try {
      if (bulkChannel === 'whatsapp') {
        selectedParentsWithPhone.forEach((parent) => {
          const rawPhone = parent.phone || '';
          const formatted = formatPhoneNumber(rawPhone).replace(/\D/g, '');
          const encodedMessage = encodeURIComponent(bulkMessage);
          window.open(`https://wa.me/${formatted}?text=${encodedMessage}`, '_blank');
        });
        alert(`Opened WhatsApp chats for ${selectedParentsWithPhone.length} parents.`);
      } else {
        const results = await Promise.allSettled(
          selectedParentsWithPhone.map((parent) =>
            communicationAPI.sendTestSMS({
              phoneNumber: formatPhoneNumber(parent.phone),
              message: bulkMessage
            })
          )
        );
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failedCount = results.length - successCount;
        alert(`SMS sent: ${successCount} successful, ${failedCount} failed.`);
      }

      setShowQuickCommunication(false);
      setBulkMessage('');
    } catch (error) {
      alert(`Failed to send message: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSendingBulkMessage(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Quick Actions Toolbar */}
      <div className="toolbar-card">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">

          {/* Search */}
          <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search parents by name, phone, or email..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
              />
            </div>

            {/* Reset Button */}
            {searchTerm && (
              <button
                onClick={handleReset}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                title="Reset search"
              >
                <RefreshCw size={20} />
              </button>
            )}
          </div>

          {/* Action Buttons & Metrics */}
          <div className="flex gap-3 w-full xl:w-auto justify-end items-center">
            {/* Metrics */}
                  <div className="flex items-center gap-4 mr-2 border-r pr-4 border-gray-200 h-10">
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wider">Total Parents</p>
                <p className="text-xl font-medium text-gray-800 leading-none">{Math.max(metricsFilter === 'all' ? displayTotalParents : metricFilteredParents.length, 0)}</p>
              </div>
            </div>
            <button
              onClick={() => setShowMetrics((prev) => !prev)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-2"
            >
              <span>{showMetrics ? 'Hide Metrics' : 'Show Metrics'}</span>
              {showMetrics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={handleExportFilteredParents}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition flex items-center gap-2"
              title="Export currently filtered parent list"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Metrics */}
      <div className={`grid transition-all duration-500 ease-in-out ${showMetrics ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => toggleMetricFilter('linked')}
              className={`rounded-xl border p-3 text-left transition ${metricsFilter === 'linked' ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-100' : 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-sm'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-blue-700 font-semibold">Students Total</p>
                <Users size={16} className="text-blue-700" />
              </div>
              <p className="text-2xl font-bold text-blue-900 mt-2">{studentsTotal}</p>
            </button>
            <button
              type="button"
              onClick={() => toggleMetricFilter('linked')}
              className={`rounded-xl border p-3 text-left transition ${metricsFilter === 'linked' ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-100' : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-sm'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">Linked Parents</p>
                <UserCheck size={16} className="text-emerald-700" />
              </div>
              <p className="text-2xl font-bold text-emerald-900 mt-2">{metrics.linkedParents}</p>
              <p className="text-[11px] text-emerald-700 mt-1">{metrics.linkedChildrenTotal} linked learners</p>
            </button>
            <button
              type="button"
              onClick={() => setMetricsFilter((prev) => prev === 'single' ? 'all' : 'single')}
              className={`rounded-xl border p-3 text-left transition ${metricsFilter === 'single' ? 'ring-2 ring-amber-500 border-amber-400 bg-amber-100' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 hover:shadow-sm'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold">Single-Child Parents</p>
                <Users2 size={16} className="text-amber-700" />
              </div>
              <p className="text-2xl font-bold text-amber-900 mt-2">{metrics.singleChildParents}</p>
              <p className="text-[11px] text-amber-700 mt-1">Exactly 1 learner linked</p>
            </button>
            <button
              type="button"
              onClick={() => setMetricsFilter((prev) => prev === 'multi' ? 'all' : 'multi')}
              className={`rounded-xl border p-3 text-left transition ${metricsFilter === 'multi' ? 'ring-2 ring-orange-500 border-orange-400 bg-orange-100' : 'border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-sm'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-orange-700 font-semibold">Multi-Child Parents</p>
                <Users2 size={16} className="text-orange-700" />
              </div>
              <p className="text-2xl font-bold text-orange-900 mt-2">{metrics.multiChildParents}</p>
              <p className="text-[11px] text-orange-700 mt-1">2+ learners linked</p>
            </button>
            <button
              type="button"
              onClick={() => toggleMetricFilter('guardians')}
              className={`rounded-xl border p-3 text-left transition ${metricsFilter === 'guardians' ? 'ring-2 ring-purple-500 border-purple-400 bg-purple-100' : 'border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-sm'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-purple-700 font-semibold">Guardians Only</p>
                <ShieldAlert size={16} className="text-purple-700" />
              </div>
              <p className="text-2xl font-bold text-purple-900 mt-2">{metrics.guardiansOnly}</p>
            </button>
          </div>
        </div>
      </div>

      {/* Parents Table */}
      {metricFilteredParents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Parents Found"
          message={searchTerm ? "No parents match your search criteria." : "No parents have been added yet."}
          actionText={!searchTerm ? "Add Your First Parent" : null}
          onAction={onAddParent}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full border-collapse text-xs">
            <thead className="border-b border-[color:var(--table-border)]">
              <tr>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    aria-label="Select all parents"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Parent/Guardian</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Email</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Phone</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Occupation</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Learners</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Status</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">WhatsApp</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metricFilteredParents.map((parent) => (
                <tr
                  key={parent.id}
                  onClick={() => onViewParent(parent)}
                  className={`cursor-pointer transition ${isDemoParent(parent) ? 'bg-red-50 hover:bg-red-100/70' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-1.5 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedParentIds.includes(parent.id)}
                      onChange={(e) => handleToggleParentSelection(parent.id, e.target.checked)}
                      aria-label={`Select ${parent.firstName || ''} ${parent.lastName || ''}`.trim()}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs shadow-sm ${isDemoParent(parent) ? 'bg-red-600' : 'bg-brand-purple'}`}>
                        {getInitials(parent)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{parent.firstName} {parent.middleName ? `${parent.middleName} ` : ''}{parent.lastName}</p>
                        <p className="text-xs text-gray-500">{parent.county || 'Nairobi'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Mail size={14} className="text-brand-purple" />
                      <span className="truncate max-w-[150px] text-xs">{parent.email || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Phone size={14} className="text-brand-purple" />
                      <span className="text-xs">{parent.phone || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-gray-700 border-r border-gray-100">
                    {parent.occupation || 'N/A'}
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <div className="flex items-center gap-1 text-sm">
                      <Users size={14} className="text-gray-500" />
                      <span className="font-semibold text-gray-700 text-xs">{parentLearnerCountMap.get(parent.id) || 0}</span>
                      <span className="text-gray-500 text-[10px]">
                        {(parentLearnerCountMap.get(parent.id) || 0) === 1 ? 'child' : 'children'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <StatusBadge status={parent.status} size="sm" />
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleWhatsAppMessage(parent); }}
                      disabled={!parent.phone}
                      className={`p-1.5 rounded-lg transition ${parent.phone
                        ? 'text-brand-teal hover:bg-brand-teal/10'
                        : 'text-gray-300 cursor-not-allowed'
                        }`}
                      title={parent.phone ? 'Send WhatsApp message' : 'No phone number'}
                    >
                      <MessageCircle size={16} />
                    </button>
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewParent(parent); }}
                        className="p-1.5 text-brand-teal hover:bg-brand-teal/10 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleSendCredentials(parent); }}
                        className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition"
                        title="Send Login Credentials"
                      >
                        <Key size={16} />
                      </button>

                      {!currentUserIsTeacher && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditParent(parent); }}
                          className="p-1.5 text-brand-purple hover:bg-brand-purple/10 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                      )}

                      {/* Archive button for teachers, Delete for admins */}
                      {currentUserIsTeacher ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onArchiveParent && onArchiveParent(parent.id); }}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                          title="Archive Parent"
                        >
                          <Archive size={16} />
                        </button>
                      ) : canDelete ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteParent(parent.id); }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <button
                          disabled
                          className="p-1.5 text-gray-300 cursor-not-allowed rounded-lg"
                          title="No permission to delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{metricFilteredParents.length === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-medium">{metricsFilter === 'all' ? Math.min(pagination.page * pagination.limit, pagination.total) : metricFilteredParents.length}</span> of <span className="font-medium">{Math.max(metricsFilter === 'all' ? displayTotalParents : metricFilteredParents.length, 0)}</span> parents
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className={`p-2 rounded-lg border ${pagination.page === 1
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className={`p-2 rounded-lg border ${pagination.page === pagination.totalPages
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Operations Modal */}
      <BulkOperationsModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Parent Operations"
        entityType="parents"
        onUploadComplete={() => {
          setShowBulkModal(false);
          if (onRefresh) onRefresh();
        }}
      />

      {/* Bulk Communication Action Bar */}
      {selectedParentIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-5 z-50">
          <span className="font-semibold text-sm">{selectedParentIds.length} parents selected</span>
          <div className="h-6 w-px bg-gray-700" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => openBulkCommunicationModal('sms')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            >
              <MessageCircle size={16} /> SMS
            </button>
            <button
              onClick={() => openBulkCommunicationModal('whatsapp')}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            >
              <MessageSquare size={16} /> WhatsApp
            </button>
          </div>
          <button
            onClick={() => setSelectedParentIds([])}
            className="text-gray-400 hover:text-white transition-colors"
            title="Clear selection"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Quick Bulk Communication Modal */}
      {showQuickCommunication && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-brand-purple/10 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Quick Communication</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedParentsWithPhone.length} with phone numbers out of {selectedParentIds.length} selected
                </p>
              </div>
              <button
                onClick={() => setShowQuickCommunication(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-2 border-b border-gray-200">
                <button
                  onClick={() => setBulkChannel('sms')}
                  className={`flex items-center gap-2 px-4 py-2 pb-3 font-semibold border-b-2 transition ${bulkChannel === 'sms' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <MessageCircle size={16} />
                  SMS
                </button>
                <button
                  onClick={() => setBulkChannel('whatsapp')}
                  className={`flex items-center gap-2 px-4 py-2 pb-3 font-semibold border-b-2 transition ${bulkChannel === 'whatsapp' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <MessageSquare size={16} />
                  WhatsApp
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Message</label>
                <textarea
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="Type your bulk message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent text-sm resize-none"
                  rows={5}
                />
                <p className="text-xs text-gray-500 mt-1">{bulkMessage.length} characters</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-2 justify-end">
              <button
                onClick={() => setShowQuickCommunication(false)}
                className="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBulkCommunication}
                disabled={isSendingBulkMessage || !bulkMessage.trim() || selectedParentsWithPhone.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSendingBulkMessage ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentsList;

