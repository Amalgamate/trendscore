import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Edit, Trash2, X, Save, Shield, Users, Search,
  Eye, EyeOff, Mail, Archive, ArchiveRestore,
  Lock, Check, AlertCircle, Clock, Activity, BookOpen, MessageCircle, Key, RefreshCw
} from 'lucide-react';
import { userAPI, learnerAPI } from '../../../../services/api';
import { getStoredUser } from '../../../../services/schoolContext';
import ResetPasswordModal from '../../shared/ResetPasswordModal';

// Real API is imported from services/api.js

// Role definitions with permissions
const ROLES_CONFIG = [
  {
    value: 'SUPER_ADMIN',
    label: 'Super Admin',
    color: 'red',
    permissions: {
      users: { view: true, create: true, edit: true, delete: true },
      roles: { view: true, create: true, edit: true, delete: true },
      learners: { view: true, create: true, edit: true, delete: true },
      assessments: { view: true, create: true, edit: true, delete: true },
      reports: { view: true, create: true, edit: true, delete: true },
      fees: { view: true, create: true, edit: true, delete: true },
      settings: { view: true, create: true, edit: true, delete: true }
    }
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    color: 'purple',
    permissions: {
      users: { view: true, create: true, edit: true, delete: false },
      roles: { view: true, create: false, edit: true, delete: false },
      learners: { view: true, create: true, edit: true, delete: true },
      assessments: { view: true, create: true, edit: true, delete: true },
      reports: { view: true, create: true, edit: true, delete: false },
      fees: { view: true, create: true, edit: true, delete: false },
      settings: { view: true, create: false, edit: true, delete: false }
    }
  },
  {
    value: 'HEAD_TEACHER',
    label: 'Head Teacher',
    color: 'indigo',
    permissions: {
      users: { view: true, create: false, edit: false, delete: false },
      roles: { view: true, create: false, edit: false, delete: false },
      learners: { view: true, create: true, edit: true, delete: false },
      assessments: { view: true, create: true, edit: true, delete: true },
      reports: { view: true, create: true, edit: true, delete: false },
      fees: { view: true, create: false, edit: false, delete: false },
      settings: { view: true, create: false, edit: false, delete: false }
    }
  },
  {
    value: 'HEAD_OF_CURRICULUM',
    label: 'Head of Curriculum',
    color: 'violet',
    permissions: {
      users: { view: true, create: false, edit: false, delete: false },
      roles: { view: true, create: false, edit: false, delete: false },
      learners: { view: true, create: true, edit: true, delete: false },
      assessments: { view: true, create: true, edit: true, delete: false },
      reports: { view: true, create: true, edit: true, delete: false },
      fees: { view: false, create: false, edit: false, delete: false },
      settings: { view: true, create: false, edit: false, delete: false }
    }
  },
  {
    value: 'TEACHER',
    label: 'Teacher',
    color: 'blue',
    permissions: {
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      learners: { view: true, create: false, edit: false, delete: false },
      assessments: { view: true, create: true, edit: true, delete: false },
      reports: { view: true, create: false, edit: false, delete: false },
      fees: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false }
    }
  },
  {
    value: 'PARENT',
    label: 'Parent',
    color: 'green',
    permissions: {
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      learners: { view: true, create: false, edit: false, delete: false },
      assessments: { view: true, create: false, edit: false, delete: false },
      reports: { view: true, create: false, edit: false, delete: false },
      fees: { view: true, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false }
    }
  },
  {
    value: 'ACCOUNTANT',
    label: 'Accountant',
    color: 'yellow',
    permissions: {
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      learners: { view: true, create: false, edit: false, delete: false },
      assessments: { view: false, create: false, edit: false, delete: false },
      reports: { view: true, create: true, edit: false, delete: false },
      fees: { view: true, create: true, edit: true, delete: true },
      settings: { view: false, create: false, edit: false, delete: false }
    }
  },
  {
    value: 'RECEPTIONIST',
    label: 'Receptionist',
    color: 'pink',
    permissions: {
      users: { view: true, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      learners: { view: true, create: true, edit: true, delete: false },
      assessments: { view: false, create: false, edit: false, delete: false },
      reports: { view: false, create: false, edit: false, delete: false },
      fees: { view: true, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false }
    }
  },
  { value: 'LIBRARIAN', label: 'Librarian', color: 'teal', permissions: {} },
  { value: 'NURSE', label: 'Nurse', color: 'cyan', permissions: {} },
  { value: 'SECURITY', label: 'Security', color: 'gray', permissions: {} },
  { value: 'DRIVER', label: 'Driver', color: 'orange', permissions: {} },
  { value: 'COOK', label: 'Cook', color: 'amber', permissions: {} },
  { value: 'CLEANER', label: 'Cleaner', color: 'lime', permissions: {} },
  { value: 'GROUNDSKEEPER', label: 'Groundskeeper', color: 'emerald', permissions: {} },
  { value: 'IT_SUPPORT', label: 'IT Support', color: 'violet', permissions: {} },
  {
    value: 'STUDENT',
    label: 'Student',
    color: 'orange',
    permissions: {
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      learners: { view: true, create: false, edit: false, delete: false },
      assessments: { view: true, create: false, edit: false, delete: false },
      reports: { view: true, create: false, edit: false, delete: false },
      fees: { view: true, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false }
    }
  }
];

const PERMISSION_MODULES = [
  { key: 'users', label: 'User Management' },
  { key: 'roles', label: 'Role Management' },
  { key: 'learners', label: 'Learner Management' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'reports', label: 'Reports' },
  { key: 'fees', label: 'Fee Management' },
  { key: 'settings', label: 'System Settings' }
];

const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'];

const getRoleLabel = (role) => {
  const config = ROLES_CONFIG.find(r => r.value === role);
  return config?.label || role;
};

const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const UserManagement = () => {
  const [activeTab, setActiveTab] = useState('staff'); // 'staff', 'subordinate', 'students', 'parents', 'admins', 'archive'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'config', 'logs'
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityFilterUser, setActivityFilterUser] = useState('all');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [learnerStats, setLearnerStats] = useState({ total: 0 });
  const [syncingStudentUsers, setSyncingStudentUsers] = useState(false);
  const [verificationSettings, setVerificationSettings] = useState({
    requiresUserVerification: true,
    schoolName: null
  });
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationUserId, setVerificationUserId] = useState(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    role: 'TEACHER',
    roles: ['TEACHER'],
    staffId: ''
  });

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const currentUserRole = getStoredUser()?.role;
  const canSyncStudentUsers = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(currentUserRole);
  const canManageVerification = ['SUPER_ADMIN', 'ADMIN'].includes(currentUserRole);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Single-tenant: fetch all users directly
      const response = await userAPI.getAll();
      console.log('API Response:', response);

      // Handle different response formats
      let usersData = [];
      if (Array.isArray(response)) {
        usersData = response;
      } else if (response.data && Array.isArray(response.data)) {
        usersData = response.data;
      } else if (response.users && Array.isArray(response.users)) {
        usersData = response.users;
      } else if (response.success && response.data) {
        usersData = Array.isArray(response.data) ? response.data : [];
      }

      // Map database fields to component format
      const mappedUsers = usersData.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName || '',
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        roles: Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role],
        status: user.archived ? 'ARCHIVED' : (user.status || 'ACTIVE'),
        emailVerified: user.emailVerified === true,
        verificationRequired: user.verificationRequired !== false,
        staffId: user.staffId || '',
        archived: user.archived || false,
        lastLogin: user.lastLogin
      }));

      setUsers(mappedUsers);

      // Fetch Learner Stats for the tab count
      try {
        const stats = await learnerAPI.getStats();
        if (stats && stats.data) {
          setLearnerStats({ total: stats.data.totalActive || stats.data.total || 0 });
        }
      } catch (err) {
        console.warn('Failed to fetch learner stats', err);
      }

    } catch (error) {
      console.error('Failed to load users:', error);
      showNotification('Failed to load users: ' + error.message, 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Activity logging function with detailed timestamps
  const addActivityLog = useCallback((action, details) => {
    const currentUser = getStoredUser();
    const now = new Date();
    const log = {
      id: Date.now().toString(),
      timestamp: now,
      action,
      details,
      user: currentUser?.firstName + ' ' + currentUser?.lastName || 'System',
      userId: currentUser?.id,
      userRole: currentUser?.role,
      // Detailed time info
      date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      iso: now.toISOString()
    };
    setActivityLogs(prev => [log, ...prev]);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadVerificationSettings = useCallback(async () => {
    if (!canManageVerification) return;
    try {
      const response = await userAPI.getVerificationSettings();
      const settings = response?.data || response;
      setVerificationSettings({
        requiresUserVerification: settings?.requiresUserVerification !== false,
        schoolName: settings?.schoolName || null
      });
    } catch (error) {
      console.warn('Failed to load verification settings', error);
    }
  }, [canManageVerification]);

  useEffect(() => {
    loadVerificationSettings();
  }, [loadVerificationSettings]);

  const handleSave = async () => {
    try {
      if (!formData.firstName || !formData.lastName || !formData.email) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }

      if (!editingUser && !formData.password) {
        showNotification('Password is required for new users', 'error');
        return;
      }

      const payload = {
        ...formData,
        roles: Array.from(new Set([formData.role, ...(formData.roles || [])]))
      };

      if (editingUser) {
        await userAPI.update(editingUser.id, payload);
        addActivityLog('USER_UPDATED', `${formData.firstName} ${formData.lastName} (${formData.role})`);
        showNotification('User updated successfully!');
      } else {
        // Let backend generate incremental Staff ID (STF-0001, STF-0002, ...)
        delete payload.staffId;
        await userAPI.create(payload);
        addActivityLog('USER_CREATED', `${formData.firstName} ${formData.lastName} (${formData.role})`);
        showNotification('User created successfully!');
      }

      setShowModal(false);
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (error) {
      showNotification('Failed to save user: ' + error.message, 'error');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName || '',
      email: user.email,
      phone: user.phone || '',
      username: user.username || '',
      password: '',
      role: user.role,
      roles: Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role],
      staffId: user.staffId || ''
    });
    setShowModal(true);
  };

  const handleArchive = async (userId) => {
    if (!window.confirm('Archive this user?')) return;
    try {
      const user = users.find(u => u.id === userId);
      await userAPI.archive(userId);
      addActivityLog('USER_ARCHIVED', `${user?.firstName} ${user?.lastName}`);
      showNotification('User archived');
      loadUsers();
    } catch (error) {
      showNotification('Failed to archive user', 'error');
    }
  };

  const handleUnarchive = async (userId) => {
    try {
      const user = users.find(u => u.id === userId);
      await userAPI.unarchive(userId);
      addActivityLog('USER_RESTORED', `${user?.firstName} ${user?.lastName}`);
      showNotification('User restored');
      loadUsers();
    } catch (error) {
      showNotification('Failed to restore user', 'error');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Permanently delete this user? This cannot be undone.')) return;
    try {
      const user = users.find(u => u.id === userId);
      await userAPI.delete(userId);
      addActivityLog('USER_DELETED', `${user?.firstName} ${user?.lastName}`);
      showNotification('User deleted');
      loadUsers();
    } catch (error) {
      showNotification('Failed to delete user', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      role: 'TEACHER',
      roles: ['TEACHER'],
      staffId: ''
    });
  };

  const toggleFormRole = (roleValue) => {
    setFormData((prev) => {
      const existing = new Set(prev.roles || [prev.role]);
      if (existing.has(roleValue)) {
        if (roleValue === prev.role) return prev;
        existing.delete(roleValue);
      } else {
        existing.add(roleValue);
      }
      return { ...prev, roles: Array.from(existing) };
    });
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleBulkRoleChange = async (newRole) => {
    try {
      for (const userId of selectedUsers) {
        const user = users.find(u => u.id === userId);
        if (user) {
          await userAPI.update(userId, { ...user, role: newRole });
        }
      }
      addActivityLog('BULK_ROLE_CHANGED', `${selectedUsers.length} users updated to ${getRoleLabel(newRole)}`);
      showNotification(`Updated ${selectedUsers.length} users to ${getRoleLabel(newRole)}`);
      setSelectedUsers([]);
      setShowBulkActions(false);
      loadUsers();
    } catch (error) {
      showNotification('Bulk update failed', 'error');
    }
  };

  const handleSchoolVerificationToggle = async () => {
    if (!canManageVerification || verificationSaving) return;
    const nextValue = !verificationSettings.requiresUserVerification;
    const actionLabel = nextValue ? 'require verification for this school' : 'disable verification for this school';
    if (!window.confirm(`Are you sure you want to ${actionLabel}?`)) return;

    try {
      setVerificationSaving(true);
      const response = await userAPI.updateVerificationSettings({ requiresUserVerification: nextValue });
      const settings = response?.data || response;
      setVerificationSettings({
        requiresUserVerification: settings?.requiresUserVerification !== false,
        schoolName: settings?.name || verificationSettings.schoolName
      });
      addActivityLog(
        'SCHOOL_VERIFICATION_UPDATED',
        nextValue ? 'School-wide user verification enabled' : 'School-wide user verification disabled'
      );
      showNotification(nextValue ? 'School-wide verification enabled' : 'School-wide verification disabled');
    } catch (error) {
      showNotification(`Failed to update school verification: ${error.message}`, 'error');
    } finally {
      setVerificationSaving(false);
    }
  };

  const handleUserVerificationToggle = async (user) => {
    if (!canManageVerification || verificationUserId) return;
    const nextValue = !user.verificationRequired;
    const label = `${user.firstName} ${user.lastName}`;
    const actionLabel = nextValue ? 'require verification for' : 'bypass verification for';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${label}?`)) return;

    try {
      setVerificationUserId(user.id);
      await userAPI.updateVerificationRequired(user.id, nextValue);
      addActivityLog(
        'USER_VERIFICATION_UPDATED',
        `${label}: ${nextValue ? 'verification required' : 'verification bypassed'}`
      );
      showNotification(nextValue ? 'Verification required for user' : 'Verification bypassed for user');
      await loadUsers();
    } catch (error) {
      showNotification(`Failed to update user verification: ${error.message}`, 'error');
    } finally {
      setVerificationUserId(null);
    }
  };

  const handleSyncStudentUsers = async () => {
    if (!canSyncStudentUsers || syncingStudentUsers) return;

    try {
      setSyncingStudentUsers(true);
      const response = await userAPI.syncMissingStudentAccounts();
      const summary = response?.summary || {};
      const created = summary.accountsCreated || 0;
      const existing = summary.accountsAlreadyPresent || 0;
      const failed = summary.failed || 0;

      addActivityLog(
        'SYNC_STUDENT_USERS',
        `Created: ${created}, Existing: ${existing}, Failed: ${failed}`
      );
      showNotification(`Student sync complete: ${created} created, ${existing} existing, ${failed} failed.`);
      await loadUsers();
    } catch (error) {
      showNotification(`Student sync failed: ${error.message}`, 'error');
    } finally {
      setSyncingStudentUsers(false);
    }
  };

  // User grouping functions
  const getAdminUsers = () => users.filter(u => ['SUPER_ADMIN', 'ADMIN'].includes(u.role) && !u.archived);
  const getTutorUsers = () => users.filter(u => ['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(u.role) && !u.archived);
  const getSubordinateStaffUsers = () =>
    users.filter(
      u => ['ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'].includes(u.role) && !u.archived
    );
  const getParentUsers = () => users.filter(u => u.role === 'PARENT' && !u.archived);
  const getStudentUsers = () => users.filter(u => u.role === 'STUDENT' && !u.archived);

  const filteredUsers = users.filter(user => {
    // 1. Group Filtering (via main tabs)
    let matchesTab = true;
    if (activeTab === 'parents') {
      matchesTab = user.role === 'PARENT' && !user.archived;
    } else if (activeTab === 'students') {
      matchesTab = user.role === 'STUDENT' && !user.archived;
    } else if (activeTab === 'staff') {
      matchesTab = ['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(user.role) && !user.archived;
    } else if (activeTab === 'subordinate') {
      matchesTab = ['ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'].includes(user.role) && !user.archived;
    } else if (activeTab === 'admins') {
      matchesTab = ['SUPER_ADMIN', 'ADMIN'].includes(user.role) && !user.archived;
    } else if (activeTab === 'archive') {
      matchesTab = user.archived === true;
    }

    if (!matchesTab) return false;

    // 2. Search search
    const matchesSearch = searchTerm === '' ||
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone && user.phone.includes(searchTerm)) ||
      (user.staffId && user.staffId.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  const roleStats = ROLES_CONFIG.map(role => ({
    ...role,
    count: users.filter(u => u.role === role.value && !u.archived).length
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white animate-fade-in`}>
          {notification.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      <div className="space-y-4">

        {/* Unified Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500">Manage school staff, parents, and administrative access</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto overflow-x-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Users size={18} />
                User List
              </button>
              <button
                onClick={() => setViewMode('config')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${viewMode === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Shield size={18} />
                System Roles
              </button>
              <button
                onClick={() => setViewMode('logs')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${viewMode === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Activity size={18} />
                Activity Logs
              </button>
            </div>

            <div className="w-px h-8 bg-gray-200 hidden sm:block mx-1"></div>

            <button
              onClick={() => {
                setEditingUser(null);
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md font-medium whitespace-nowrap"
            >
              <UserPlus size={20} />
              Add New User
            </button>
            {canSyncStudentUsers && (
              <button
                onClick={handleSyncStudentUsers}
                disabled={syncingStudentUsers}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition shadow-md font-medium whitespace-nowrap ${
                  syncingStudentUsers
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <RefreshCw size={18} className={syncingStudentUsers ? 'animate-spin' : ''} />
                {syncingStudentUsers ? 'Syncing Students...' : 'Sync Student Accounts'}
              </button>
            )}
          </div>
        </div>

        {/* View Selection: List View */}
        {viewMode === 'list' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Primary Navigation Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200 overflow-x-auto no-scrollbar">
              {[
                { id: 'staff', label: 'Academic Staff', icon: BookOpen, color: 'blue' },
                { id: 'subordinate', label: 'Subordinate Staff', icon: Users, color: 'teal' },
                { id: 'students', label: 'Students', icon: Users, color: 'orange' },
                { id: 'parents', label: 'Parents', icon: Users, color: 'green' },
                { id: 'admins', label: 'Administrators', icon: Shield, color: 'purple' },
                { id: 'archive', label: 'Archived', icon: Archive, color: 'gray' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === tab.id
                    ? `bg-${tab.color}-600 text-white shadow-md`
                    : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                  <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {tab.id === 'archive' ? users.filter(u => u.archived).length :
                      tab.id === 'students' ? (learnerStats.total > 0 ? learnerStats.total : getStudentUsers().length) :
                        tab.id === 'subordinate' ? getSubordinateStaffUsers().length :
                        tab.id === 'parents' ? getParentUsers().length :
                          tab.id === 'staff' ? getTutorUsers().length :
                            getAdminUsers().length}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Search & Filter Strip */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder={`Search in ${activeTab}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition shadow-sm"
                />
              </div>
              {selectedUsers.length > 0 && (
                <div className="flex items-center gap-2 p-1.5 bg-purple-50 rounded-xl border border-purple-100 shadow-sm animate-in zoom-in-95">
                  <span className="text-xs font-medium text-purple-700 px-2 line-clamp-1">{selectedUsers.length} Selected</span>
                  <button
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium transition"
                  >
                    Bulk Actions
                  </button>
                </div>
              )}
            </div>

            {canManageVerification && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    verificationSettings.requiresUserVerification
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">School Verification Requirement</h3>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                        verificationSettings.requiresUserVerification
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {verificationSettings.requiresUserVerification ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {verificationSettings.requiresUserVerification
                        ? 'Unverified users are blocked unless their individual account is bypassed.'
                        : 'Verification is bypassed for the whole school. Individual user settings remain saved.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSchoolVerificationToggle}
                  disabled={verificationSaving}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    verificationSaving
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : verificationSettings.requiresUserVerification
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <Shield size={16} />
                  {verificationSaving
                    ? 'Saving...'
                    : verificationSettings.requiresUserVerification
                      ? 'Disable for School'
                      : 'Require for School'}
                </button>
              </div>
            )}

            {/* Bulk Actions Menu Expanded */}
            {showBulkActions && selectedUsers.length > 0 && (
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 shadow-inner flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-purple-900">Change Role:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES_CONFIG.slice(0, 7).map(role => (
                    <button
                      key={role.value}
                      onClick={() => handleBulkRoleChange(role.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white border border-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white shadow-sm`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="ml-auto p-1.5 text-gray-400 hover:text-red-500 transition"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading users...</p>
                </div>
              ) : activeTab === 'students' && filteredUsers.length === 0 ? (
                <div className="p-12 text-center bg-orange-50/20">
                  <BookOpen size={48} className="mx-auto text-orange-200 mb-4" />
                  <p className="text-gray-800 font-medium text-lg">Managing {learnerStats.total || 'All'} Students</p>
                  <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
                    Uploaded students appear here once they are assigned portal login accounts. To manage your full student database, use the Admissions page.
                  </p>
                  <div className="mt-8 flex justify-center gap-4">
                    <button 
                      onClick={() => window.location.href = '/learners/list'}
                      className="px-6 py-2.5 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-600/20 font-medium hover:bg-orange-700 transition-all flex items-center gap-2"
                    >
                      <Users size={18} />
                      Go to Full Student List
                    </button>
                  </div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 font-semibold">No users found</p>
                  <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-[color:var(--table-border)] text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-4 text-left w-10">
                          <input
                            type="checkbox"
                            checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-4 py-4 text-left font-semibold text-[color:var(--table-header-fg)]">User Identity</th>
                        <th className="px-4 py-4 text-left font-semibold text-[color:var(--table-header-fg)]">Role & Access</th>
                        <th className="px-4 py-4 text-left font-semibold text-[color:var(--table-header-fg)]">Status</th>
                        <th className="px-4 py-4 text-right font-semibold text-[color:var(--table-header-fg)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map(user => (
                        <tr key={user.id} className={`group hover:bg-blue-50/30 transition-colors ${user.archived ? 'bg-gray-50/50' : ''}`}>
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user.id)}
                              onChange={() => toggleUserSelection(user.id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl transition-transform group-hover:scale-110 flex items-center justify-center text-white font-medium text-sm shadow-sm ${user.archived ? 'bg-gray-500' : 'bg-blue-600'
                                }`}>
                                {user.firstName[0]}{user.lastName[0]}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors flex items-center gap-2">
                                  {user.firstName} {user.lastName}
                                  {user.staffId && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono font-normal">{user.staffId}</span>}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <Mail size={12} className="opacity-70" /> {user.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`w-fit px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-widest border shadow-sm ${user.role === 'SUPER_ADMIN' ? 'bg-red-50 text-red-700 border-red-100' :
                                user.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                  user.role === 'PARENT' ? 'bg-green-50 text-green-700 border-green-100' :
                                    user.role === 'STUDENT' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                      'bg-blue-50 text-blue-700 border-blue-100'
                                }`}>
                                {getRoleLabel(user.role)}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                                <Clock size={10} /> Active {formatDate(user.lastLogin)}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${user.archived ? 'bg-gray-100 text-gray-400' :
                                user.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${user.archived ? 'bg-gray-300' :
                                  user.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' :
                                    'bg-amber-500'
                                  }`}></span>
                                {user.archived ? 'Archived' : user.status}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                !verificationSettings.requiresUserVerification
                                  ? 'bg-gray-100 text-gray-500'
                                  : user.verificationRequired
                                    ? user.emailVerified
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-red-50 text-red-700'
                                    : 'bg-amber-50 text-amber-700'
                              }`}>
                                <Shield size={11} />
                                {!verificationSettings.requiresUserVerification
                                  ? 'School bypass'
                                  : user.verificationRequired
                                    ? user.emailVerified ? 'Verified' : 'Needs verification'
                                    : 'Bypassed'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(user)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Edit Profile">
                                <Edit size={16} />
                              </button>
                              {user.phone && (
                                <button
                                  onClick={() => window.open(`https://wa.me/${user.phone.replace(/\D/g, '')}`, '_blank')}
                                  className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
                                  title="WhatsApp"
                                >
                                  <MessageCircle size={16} />
                                </button>
                              )}
                              {canManageVerification && !user.archived && (
                                <button
                                  onClick={() => handleUserVerificationToggle(user)}
                                  disabled={verificationUserId === user.id}
                                  className={`p-2 rounded-lg transition ${
                                    user.verificationRequired
                                      ? 'text-amber-600 hover:bg-amber-100'
                                      : 'text-emerald-600 hover:bg-emerald-100'
                                  } ${verificationUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title={user.verificationRequired ? 'Bypass verification for this user' : 'Require verification for this user'}
                                >
                                  <Shield size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => user.archived ? handleUnarchive(user.id) : handleArchive(user.id)}
                                className={`p-2 rounded-lg transition ${user.archived ? 'text-emerald-600 hover:bg-emerald-100' : 'text-orange-600 hover:bg-orange-100'}`}
                                title={user.archived ? "Restore" : "Archive"}
                              >
                                {user.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                              </button>
                              <button
                                onClick={() => {
                                  setResetTargetUser(user);
                                  setShowResetModal(true);
                                }}
                                className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition"
                                title="Reset Password"
                              >
                                <Key size={16} />
                              </button>
                              <button onClick={() => handleDelete(user.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition" title="Delete Permanent">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROLES & PERMISSIONS VIEW */}
        {viewMode === 'config' && (
          <div className="space-y-6">
            {/* Role Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {roleStats.map(role => (
                <div key={role.value} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition">
                  <div className={`w-12 h-12 rounded-lg bg-${role.color}-100 flex items-center justify-center mb-3`}>
                    <Shield className={`text-${role.color}-600`} size={24} />
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm mb-1">{role.label}</h3>
                  <p className={`text-2xl font-medium text-${role.color}-600`}>{role.count}</p>
                  <p className="text-xs text-gray-500 mt-1">users</p>
                </div>
              ))}
            </div>

            {/* Permission Matrix */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-purple-600 px-6 py-4">
                <h2 className="text-xl font-medium text-white flex items-center gap-2">
                  <Lock size={24} />
                  Permission Matrix
                </h2>
                <p className="text-purple-100 text-sm mt-1">Control what each role can access</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[color:var(--table-border)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[color:var(--table-header-fg)] sticky left-0 bg-[color:var(--table-header-bg)]">Role</th>
                      {PERMISSION_MODULES.map(module => (
                        <th key={module.key} className="px-2 py-2 text-center" colSpan={4}>
                          <div className="font-semibold text-[color:var(--table-header-fg)]">{module.label}</div>
                          <div className="flex gap-1 justify-center mt-1 text-xs text-gray-500">
                            <span>V</span>
                            <span>C</span>
                            <span>E</span>
                            <span>D</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ROLES_CONFIG.slice(0, 7).map(role => (
                      <tr key={role.value} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-semibold text-gray-900 sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full bg-${role.color}-500`}></div>
                            {role.label}
                          </div>
                        </td>
                        {PERMISSION_MODULES.map(module => (
                          <React.Fragment key={module.key}>
                            {PERMISSION_ACTIONS.map(action => {
                              const hasPermission = role.permissions?.[module.key]?.[action];
                              return (
                                <td key={action} className="px-1 py-2 text-center">
                                  <div className="flex justify-center">
                                    {hasPermission ? (
                                      <Check size={14} className="text-green-600" />
                                    ) : (
                                      <X size={14} className="text-gray-300" />
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Role Details with Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {ROLES_CONFIG.slice(0, 6).map(role => {
                const roleUsers = users.filter(u => u.role === role.value && !u.archived);
                return (
                  <div key={role.value} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className={`bg-${role.color}-50 px-4 py-3 border-b border-${role.color}-100`}>
                      <div className="flex items-center justify-between">
                        <h3 className={`font-medium text-${role.color}-900`}>{role.label}</h3>
                        <span className={`px-3 py-1 bg-${role.color}-100 text-${role.color}-800 rounded-full text-sm font-medium`}>
                          {roleUsers.length}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      {roleUsers.length > 0 ? (
                        <div className="space-y-2">
                          {roleUsers.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                  {user.firstName[0]}{user.lastName[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-900 text-sm truncate">
                                    {user.firstName} {user.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleEdit(user)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded flex-shrink-0"
                              >
                                <Edit size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <Shield size={32} className="mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No users in this role</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ACTIVITY LOG VIEW */}
        {viewMode === 'logs' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-green-600 px-6 py-4">
              <h2 className="text-xl font-medium text-white flex items-center gap-2">
                <Activity size={24} />
                Activity Log
              </h2>
              <p className="text-green-100 text-sm mt-1">Track all user management actions with detailed timestamps</p>
            </div>

            {/* Activity Filter */}
            {activityLogs.length > 0 && (
              <div className="px-6 py-4 border-b bg-gray-50 flex gap-4 items-center flex-wrap">
                <label className="font-semibold text-sm text-gray-700">Filter by Admin:</label>
                <select
                  value={activityFilterUser}
                  onChange={(e) => setActivityFilterUser(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                >
                  <option value="all">Everyone</option>
                  {[...new Set(activityLogs.map(log => log.user))].map(user => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </div>
            )}

            {activityLogs.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 font-semibold">No activity yet</p>
                <p className="text-gray-500 text-sm mt-2">User management actions will appear here</p>
              </div>
            ) : (
              <div className="divide-y">
                {activityLogs
                  .filter(log => activityFilterUser === 'all' || log.user === activityFilterUser)
                  .map(log => {
                    const getActionColor = (action) => {
                      if (action.includes('CREATED')) return 'bg-green-50 border-l-4 border-green-500';
                      if (action.includes('UPDATED')) return 'bg-blue-50 border-l-4 border-blue-500';
                      if (action.includes('DELETED')) return 'bg-red-50 border-l-4 border-red-500';
                      if (action.includes('ARCHIVED')) return 'bg-orange-50 border-l-4 border-orange-500';
                      if (action.includes('RESTORED')) return 'bg-purple-50 border-l-4 border-purple-500';
                      return 'bg-gray-50 border-l-4 border-gray-500';
                    };

                    const getActionIcon = (action) => {
                      if (action.includes('CREATED')) return <UserPlus size={16} className="text-green-600" />;
                      if (action.includes('UPDATED')) return <Edit size={16} className="text-blue-600" />;
                      if (action.includes('DELETED')) return <Trash2 size={16} className="text-red-600" />;
                      if (action.includes('ARCHIVED')) return <Archive size={16} className="text-orange-600" />;
                      if (action.includes('RESTORED')) return <ArchiveRestore size={16} className="text-purple-600" />;
                      return <Activity size={16} className="text-gray-600" />;
                    };

                    const getActionLabel = (action) => {
                      return action.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                    };

                    return (
                      <div key={log.id} className={`p-4 ${getActionColor(log.action)} hover:bg-opacity-75 transition`}>
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 mt-1">
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">
                                  {getActionLabel(log.action)}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <Clock size={14} />
                                    <span className="font-medium">{log.time}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span>{log.date}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 min-w-fit">
                                <p className="text-xs font-medium text-gray-700 bg-gray-200 px-2 py-1 rounded">
                                  {log.userRole}
                                </p>
                                <p className="text-xs text-gray-600 mt-2">
                                  By: <span className="font-semibold">{log.user}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Add/Edit User Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-blue-600 px-6 py-4 rounded-t-xl flex justify-between items-center sticky top-0">
                <h3 className="text-xl font-medium text-white">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-white hover:bg-blue-800 rounded-lg p-1">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Middle Name</label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Staff ID</label>
                    <input
                      type="text"
                      value={editingUser ? (formData.staffId || '') : 'Auto-generated'}
                      onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Auto-generated"
                      disabled={!editingUser}
                    />
                    {!editingUser && (
                      <p className="mt-1 text-xs text-gray-500">Staff ID is assigned automatically in sequence.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="john.doe@school.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+254712345678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const selectedRole = e.target.value;
                        const existing = new Set(formData.roles || []);
                        existing.add(selectedRole);
                        setFormData({ ...formData, role: selectedRole, roles: Array.from(existing) });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {ROLES_CONFIG.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Additional Roles</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {ROLES_CONFIG.map((roleOption) => (
                          <label key={roleOption.value} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={(formData.roles || []).includes(roleOption.value)}
                              onChange={() => toggleFormRole(roleOption.value)}
                              disabled={roleOption.value === formData.role}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{roleOption.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      Password {!editingUser && <span className="text-red-500">*</span>}
                      {editingUser && <span className="text-gray-500 text-xs ml-2">(leave blank to keep current)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={editingUser ? 'Enter new password to change' : 'Enter password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ResetPasswordModal
          isOpen={showResetModal}
          onClose={() => {
            setShowResetModal(false);
            setResetTargetUser(null);
          }}
          user={resetTargetUser}
          onResetSuccess={(msg) => {
            showNotification(msg);
            addActivityLog('PASSWORD_RESET', `Password reset for ${resetTargetUser?.firstName} ${resetTargetUser?.lastName}`);
          }}
        />
      </div>
    </div>
  );
};

export default UserManagement;
