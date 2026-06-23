/**
 * Teachers List Page
 * Display and manage all teachers in table format
 */

import React, { useState, useEffect } from 'react';
import { Plus, Upload, Eye, Edit, Trash2, GraduationCap, BookOpen, Search, RefreshCw, MoreVertical, Filter, X, MessageCircle, MessageSquare, Loader2, Send } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import EmptyState from '../shared/EmptyState';
import { DataCard } from '../shared';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import { useMobile } from '../../../hooks/useMobileDetection';
import BulkOperationsModal from '../shared/bulk/BulkOperationsModal';
import TeacherClassAssignmentModal from '../shared/TeacherClassAssignmentModal';
import { communicationAPI } from '../../../services/api';
import { formatPhoneNumber } from '../../../utils/phoneFormatter';

const TeachersList = ({
  teachers,
  loading,
  pagination,
  onFetchTeachers,
  onAddTeacher,
  onEditTeacher,
  onViewTeacher,
  onDeleteTeacher,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [showQuickCommunication, setShowQuickCommunication] = useState(false);
  const [bulkChannel, setBulkChannel] = useState('sms');
  const [bulkMessage, setBulkMessage] = useState('');
  const [isSendingBulkMessage, setIsSendingBulkMessage] = useState(false);
  const isMobile = useMobile();

  const activeFilterCount = filterStatus !== 'all' ? 1 : 0;
  const [selectedTeacherForAssignment, setSelectedTeacherForAssignment] = useState(null);
  useAuth();

  // Server-side filtering effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFetchTeachers) {
        const params = {
          page: 1,
          search: searchTerm,
          limit: pagination?.limit || 20
        };

        if (filterStatus !== 'all') params.status = filterStatus;

        onFetchTeachers(params);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, filterStatus, onFetchTeachers, pagination?.limit]);

  const handlePageChange = (newPage) => {
    if (onFetchTeachers) {
      const params = {
        page: newPage,
        search: searchTerm,
        limit: pagination?.limit || 20
      };

      if (filterStatus !== 'all') params.status = filterStatus;

      onFetchTeachers(params);
    }
  };

  const handleReset = () => {
    setSearchTerm('');
    setFilterStatus('all');
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const allVisibleSelected = teachers.length > 0 && teachers.every((t) => selectedTeacherIds.includes(t.id));

  const handleToggleSelectAll = (checked) => {
    if (checked) {
      setSelectedTeacherIds(teachers.map((t) => t.id));
      return;
    }
    setSelectedTeacherIds([]);
  };

  const handleToggleTeacherSelection = (teacherId, checked) => {
    setSelectedTeacherIds((prev) => {
      if (checked) return [...new Set([...prev, teacherId])];
      return prev.filter((id) => id !== teacherId);
    });
  };

  const selectedTeachers = teachers.filter((t) => selectedTeacherIds.includes(t.id));
  const selectedTeachersWithPhone = selectedTeachers.filter((t) => String(t.phone || '').trim().length > 0);

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
    if (selectedTeachersWithPhone.length === 0) {
      alert('No selected tutors have phone numbers.');
      return;
    }

    setIsSendingBulkMessage(true);
    try {
      if (bulkChannel === 'whatsapp') {
        selectedTeachersWithPhone.forEach((teacher) => {
          const formatted = formatPhoneNumber(teacher.phone).replace(/\D/g, '');
          const encodedMessage = encodeURIComponent(bulkMessage);
          window.open(`https://wa.me/${formatted}?text=${encodedMessage}`, '_blank');
        });
        alert(`Opened WhatsApp chats for ${selectedTeachersWithPhone.length} tutors.`);
      } else {
        const results = await Promise.allSettled(
          selectedTeachersWithPhone.map((teacher) =>
            communicationAPI.sendTestSMS({
              phoneNumber: formatPhoneNumber(teacher.phone),
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

          <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1 items-center">
            {/* Search */}
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, employee number, or subject..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
              />
            </div>

            {/* Unified Filter */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowGlobalFilters(!showGlobalFilters)}
                className={`px-5 py-2.5 border rounded-xl font-medium flex items-center gap-2 transition-all ${activeFilterCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50 text-gray-700 bg-white shadow-sm'}`}
              >
                <Filter size={16} className={activeFilterCount > 0 ? 'text-blue-600' : 'text-gray-500'} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] ml-1">{activeFilterCount}</span>
                )}
              </button>

              {showGlobalFilters && (
                <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in origin-top-right">
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-medium text-gray-800 flex items-center gap-2"><Filter size={16} className="text-blue-600" /> Tutor Filters</h3>
                    {activeFilterCount > 0 && <button onClick={() => setFilterStatus('all')} className="text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md">Clear</button>}
                  </div>
                  <div className="p-5">
                    <h4 className="text-[11px] font-semibold text-blue-500 uppercase tracking-widest mb-3">Employment Status</h4>
                    <div className="flex flex-col gap-1.5">
                      {['all', 'ACTIVE', 'ON_LEAVE', 'INACTIVE'].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)} className={`text-left text-sm px-3 py-1.5 rounded-lg font-semibold transition-all ${filterStatus === s ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                          {s === 'all' ? 'All Status' : s.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button onClick={() => setShowGlobalFilters(false)} className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Apply & Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons & Metrics */}
          <div className="flex gap-3 w-full xl:w-auto justify-end items-center">
            {/* Metrics */}
            <div className="hidden lg:flex items-center gap-4 mr-2 border-r pr-4 border-gray-200 h-10">
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wider">Total Tutors</p>
                <p className="text-xl font-medium text-gray-800 leading-none">{pagination?.total || 0}</p>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="p-2 bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 rounded-lg transition"
                title="Quick Actions"
              >
                <MoreVertical size={20} />
              </button>
              {showQuickActions && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-20 py-1">
                    <button
                      onClick={() => {
                        setShowQuickActions(false);
                        setShowBulkModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Upload size={16} />
                      Bulk Operations
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={onAddTeacher}
              className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-lg hover:bg-brand-teal/90 transition shadow-sm font-medium"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add Tutor</span>
              <span className="inline sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Teachers Table */}
      {loading && teachers.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-teal"></div>
        </div>
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No Teachers Found"
          message={searchTerm || filterStatus !== 'all'
            ? "No teachers match your search criteria."
            : "No teachers have been added yet."}
          actionText={!searchTerm && filterStatus === 'all' ? "Add Your First Teacher" : null}
          onAction={onAddTeacher}
        />
      ) : (
        <div className={`bg-white rounded-xl shadow-md overflow-hidden ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          <table className="w-full border-collapse text-xs">
            <thead className="border-b border-[color:var(--table-border)]">
              <tr>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    aria-label="Select all tutors"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Teacher</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Employee No</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Role</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Subject</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Contact</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Status</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-medium text-[color:var(--table-header-fg)] uppercase border-r border-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teachers.map((teacher) => (
                <tr key={teacher.id} onClick={() => onViewTeacher(teacher)} className="hover:bg-gray-50 cursor-pointer transition">
                  <td className="px-3 py-1.5 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedTeacherIds.includes(teacher.id)}
                      onChange={(e) => handleToggleTeacherSelection(teacher.id, e.target.checked)}
                      aria-label={`Select ${teacher.firstName || ''} ${teacher.lastName || ''}`.trim()}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple flex items-center justify-center text-xs font-medium">
                        {teacher.avatar || getInitials(teacher.firstName, teacher.lastName)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{teacher.firstName} {teacher.lastName}</p>
                        <p className="text-xs text-gray-500">{teacher.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 font-mono border-r border-gray-100">{teacher.staffId || '---'}</td>
                  <td className="px-3 py-1.5 font-semibold border-r border-gray-100">{teacher.role}</td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <div className="flex items-center gap-1">
                      <BookOpen size={16} className="text-brand-teal" />
                      <span className="text-sm">{teacher.subject}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <p className="text-sm font-semibold">{teacher.email}</p>
                    <p className="text-xs text-gray-500">{teacher.phone}</p>
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <StatusBadge status={teacher.status} />
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedTeacherForAssignment(teacher); }}
                        className="p-1.5 text-brand-purple hover:bg-brand-purple/10 rounded-lg transition"
                        title="Assign to Grade"
                      >
                        <GraduationCap size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewTeacher(teacher); }}
                        className="p-1.5 text-brand-teal hover:bg-brand-teal/10 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditTeacher(teacher); }}
                        className="p-1.5 text-brand-purple hover:bg-brand-purple/10 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteTeacher(teacher.id); }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {pagination && pagination.pages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tutors
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePageChange(pagination.page - 1); }}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium text-brand-purple"
                >
                  Previous
                </button>
                <div className="flex items-center px-2 text-sm font-medium text-gray-700">
                  Page {pagination.page} of {pagination.pages}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePageChange(pagination.page + 1); }}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium text-brand-purple"
                >
                  Next
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
        title="Bulk Tutor Operations"
        entityType="teachers"
        onUploadComplete={() => {
          setShowBulkModal(false);
          if (onRefresh) onRefresh();
        }}
      />

      {/* Teacher-Class Assignment Modal */}
      <TeacherClassAssignmentModal
        isOpen={!!selectedTeacherForAssignment}
        onClose={() => setSelectedTeacherForAssignment(null)}
        teacher={selectedTeacherForAssignment}
        onAssignmentComplete={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* Bulk Communication Action Bar */}
      {selectedTeacherIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-5 z-50">
          <span className="font-semibold text-sm">{selectedTeacherIds.length} tutors selected</span>
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
            onClick={() => setSelectedTeacherIds([])}
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
                  {selectedTeachersWithPhone.length} with phone numbers out of {selectedTeacherIds.length} selected
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
                disabled={isSendingBulkMessage || !bulkMessage.trim() || selectedTeachersWithPhone.length === 0}
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

export default TeachersList;


