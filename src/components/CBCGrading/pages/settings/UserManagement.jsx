import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserPlus, Edit, Trash2, X, Save, Shield, Users, Search,
  Eye, EyeOff, Mail, Archive, ArchiveRestore,
  Lock, Check, AlertCircle, Clock, Activity, BookOpen, MessageCircle, Key, RefreshCw,
  Upload,
  Crown, GraduationCap, Calculator, UserCircle, MoreVertical, LayoutGrid, List,
  Copy, Power, Plus, CheckCircle
} from 'lucide-react';
import { userAPI, learnerAPI } from '../../../../services/api';
import { getStoredUser } from '../../../../services/schoolContext';
import { PERMISSIONS, ROLE_NAMES } from '../../../../config/permissions';
import ModuleTabNav from '../../shared/ModuleTabNav';
import ResetPasswordModal from '../../shared/ResetPasswordModal';

// Real API is imported from services/api.js

// Role definitions with permissions
const ROLES_CONFIG = [
  {
    value: 'SUPER_ADMIN',
    label: ROLE_NAMES.SUPER_ADMIN,
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
    label: ROLE_NAMES.ADMIN,
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

const ROLE_ACCESS_STORAGE_KEY = 'trendscore.roleAccessOverrides.v1';

const ROLE_META = {
  SUPER_ADMIN: {
    title: ROLE_NAMES.SUPER_ADMIN,
    description: 'Full system access and control',
    detail: 'Full system access and control. Can manage all modules and settings.',
    tone: 'purple',
    icon: Crown,
    created: 'Jan 10, 2024',
  },
  ADMIN: {
    title: ROLE_NAMES.ADMIN,
    description: 'Manage users, learners, finance and reports',
    detail: 'Operational administration access across users, students, reports and finance.',
    tone: 'purple',
    icon: Crown,
    created: 'Jan 10, 2024',
  },
  HEAD_TEACHER: {
    title: 'Head Teacher',
    description: 'Manage school academics and learners',
    detail: 'School leadership access for academic oversight, reports and learner operations.',
    tone: 'indigo',
    icon: Shield,
    created: 'Jan 10, 2024',
  },
  HEAD_OF_CURRICULUM: {
    title: 'Head of Curriculum',
    description: 'Manage curriculum, assessments and learners',
    detail: 'Curriculum leadership access for academic setup, assessments and reports.',
    tone: 'violet',
    icon: BookOpen,
    created: 'Jan 10, 2024',
  },
  TEACHER: {
    title: 'Teacher',
    description: 'Manage classes, assessments and learners',
    detail: 'Teacher access for classes, assessments, attendance and student records.',
    tone: 'blue',
    icon: GraduationCap,
    created: 'Jan 10, 2024',
  },
  ACCOUNTANT: {
    title: 'Accountant',
    description: 'Manage fees, payments and financial reports',
    detail: 'Finance access for fee collection, balances, reports and accounting workflows.',
    tone: 'green',
    icon: Calculator,
    created: 'Jan 10, 2024',
  },
  RECEPTIONIST: {
    title: 'Receptionist',
    description: 'Manage enquiries and basic records',
    detail: 'Front office access for enquiries, communication and basic student records.',
    tone: 'amber',
    icon: UserCircle,
    created: 'Jan 10, 2024',
  },
  PARENT: {
    title: 'Parent',
    description: 'View own children information',
    detail: 'Guardian portal access for linked children, balances, reports and messages.',
    tone: 'sky',
    icon: Users,
    created: 'Jan 10, 2024',
  },
  STUDENT: {
    title: 'Student',
    description: 'Access own learning portal',
    detail: 'Student portal access for courses, assignments, progress and reports.',
    tone: 'violet',
    icon: UserCircle,
    created: 'Jan 10, 2024',
  },
  SYSTEM_VIEWER: {
    title: 'System Viewer',
    description: 'View reports and system information',
    detail: 'Read-only system access for monitoring and reporting.',
    tone: 'slate',
    icon: Lock,
    created: 'Jan 10, 2024',
  },
};

const ROLE_TONE_CLASSES = {
  purple: { bg: 'bg-purple-600', soft: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
  indigo: { bg: 'bg-indigo-600', soft: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
  violet: { bg: 'bg-violet-600', soft: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
  blue: { bg: 'bg-blue-500', soft: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  green: { bg: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  amber: { bg: 'bg-amber-500', soft: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  sky: { bg: 'bg-sky-500', soft: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100' },
  slate: { bg: 'bg-slate-500', soft: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-100' },
};

const PERMISSION_GROUPS = [
  { key: 'users', label: 'User Management', match: (permission) => permission.includes('USER') || permission.includes('TEACHER') || permission.includes('PARENT') || permission.includes('ACCOUNTANT') || permission.includes('RECEPTIONIST') || permission.includes('STAFF') },
  { key: 'learners', label: 'Learner Management', match: (permission) => permission.includes('LEARNER') || permission.includes('CHILDREN') },
  { key: 'academics', label: 'Academic Management', match: (permission) => permission.includes('ASSESSMENT') || permission.includes('REPORT') || permission.includes('GRADING') || permission.includes('LEARNING') || permission.includes('COURSE') || permission.includes('LMS') || permission.includes('TIMETABLE') },
  { key: 'attendance', label: 'Attendance', match: (permission) => permission.includes('ATTENDANCE') },
  { key: 'finance', label: 'Finance & Accounting', match: (permission) => permission.includes('FEE') || permission.includes('BALANCE') || permission.includes('PAYMENT') || permission.includes('FINANCIAL') || permission.includes('ACCOUNTING') || permission.includes('RECEIPT') },
  { key: 'operations', label: 'Operations', match: (permission) => permission.includes('HR') || permission.includes('LEAVE') || permission.includes('LIBRARY') || permission.includes('TRANSPORT') || permission.includes('HOSTEL') || permission.includes('BIOMETRIC') },
  { key: 'settings', label: 'Settings & Security', match: (permission) => permission.includes('SETTING') || permission.includes('LOG') || permission.includes('AUDIT') || permission.includes('TEMPLATE') },
  { key: 'communication', label: 'Communication', match: (permission) => permission.includes('MESSAGE') || permission.includes('NOTICE') || permission.includes('INBOX') },
  { key: 'tertiary', label: 'Tertiary Modules', match: (permission) => permission.includes('TERTIARY') },
];

const permissionNames = Object.keys(PERMISSIONS);
const formatPermissionLabel = (permission) => permission
  .toLowerCase()
  .split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const getPermissionGroup = (permission) => (
  PERMISSION_GROUPS.find(group => group.match(permission)) || { key: 'other', label: 'Other Permissions' }
);

const getStoredRoleOverrides = () => {
  try {
    return JSON.parse(localStorage.getItem(ROLE_ACCESS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const getCatalogPermissionsForRole = (role, overrides = {}) => (
  Array.isArray(overrides[role])
    ? overrides[role]
    : permissionNames.filter(permission => (PERMISSIONS[permission] || []).includes(role))
);

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
  const [activeTab, setActiveTab] = useState('all');
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
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [roleStatusFilter, setRoleStatusFilter] = useState('ALL');
  const [selectedRoleValue, setSelectedRoleValue] = useState('ADMIN');
  const [roleAccessOverrides, setRoleAccessOverrides] = useState(() => getStoredRoleOverrides());
  const [editingRoleValue, setEditingRoleValue] = useState(null);
  const [draftRolePermissions, setDraftRolePermissions] = useState([]);

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
        lastLogin: user.lastLogin,
        lockedUntil: user.lockedUntil || null
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

  const getParentLoginEmail = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `${digits}@trendscore.co.ke` : '';
  };

  const handleSave = async () => {
    try {
      const isParent = formData.role === 'PARENT';
      if (!formData.firstName || !formData.lastName || (!isParent && !formData.email) || (isParent && !formData.phone)) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }

      if (!editingUser && !formData.password) {
        showNotification('Password is required for new users', 'error');
        return;
      }

      const payload = {
        ...formData,
        email: isParent ? getParentLoginEmail(formData.phone) : formData.email,
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
    } else if (activeTab === 'admins') {
      matchesTab = ['SUPER_ADMIN', 'ADMIN'].includes(user.role) && !user.archived;
    } else if (activeTab === 'staff') {
      matchesTab = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'].includes(user.role) && !user.archived;
    } else if (activeTab === 'archive') {
      matchesTab = user.archived === true;
    }

    if (!matchesTab) return false;

    // 2. Role filter
    if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;

    // 3. Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && user.status !== 'ACTIVE') return false;
      if (statusFilter === 'INACTIVE' && user.status !== 'INACTIVE' && user.status !== 'SUSPENDED') return false;
      if (statusFilter === 'ARCHIVED' && !user.archived) return false;
    }

    // 4. Search
    const matchesSearch = searchTerm === '' ||
      String(user.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(user.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(user.phone || '').includes(searchTerm) ||
      String(user.staffId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(user.admissionNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const roleAccessRows = useMemo(() => {
    const systemRoles = ['ADMIN', 'TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'ACCOUNTANT', 'RECEPTIONIST', 'PARENT', 'STUDENT'];
    const existingRoleValues = new Set(ROLES_CONFIG.map(role => role.value));
    const roleValues = [...new Set([...systemRoles, ...ROLES_CONFIG.map(role => role.value), 'SYSTEM_VIEWER'])]
      .filter(role => role === 'SYSTEM_VIEWER' || existingRoleValues.has(role));

    return roleValues.map((role) => {
      const baseConfig = ROLES_CONFIG.find(item => item.value === role) || {};
      const meta = ROLE_META[role] || {};
      const assignedUsers = users.filter(user => user.role === role && !user.archived).length;
      const permissions = getCatalogPermissionsForRole(role, roleAccessOverrides);
      const isInactive = role === 'SYSTEM_VIEWER' || assignedUsers === 0;
      const Icon = meta.icon || Shield;
      const tone = ROLE_TONE_CLASSES[meta.tone || baseConfig.color] || ROLE_TONE_CLASSES.slate;

      return {
        value: role,
        label: meta.title || baseConfig.label || getRoleLabel(role),
        description: meta.description || 'Custom access role',
        detail: meta.detail || meta.description || 'Controls what this user type can access.',
        assignedUsers,
        permissions,
        permissionCount: permissions.length,
        isInactive,
        icon: Icon,
        tone,
        created: meta.created || 'Jan 10, 2024',
      };
    });
  }, [users, roleAccessOverrides]);

  const selectedRoleAccess = roleAccessRows.find(role => role.value === selectedRoleValue) || roleAccessRows[0];
  const activeRoleCount = roleAccessRows.filter(role => !role.isInactive).length;
  const totalAssignedRoleUsers = roleAccessRows.reduce((sum, role) => sum + role.assignedUsers, 0);
  const groupedPermissions = useMemo(() => {
    return permissionNames.reduce((groups, permission) => {
      const group = getPermissionGroup(permission);
      if (!groups[group.key]) groups[group.key] = { ...group, permissions: [] };
      groups[group.key].permissions.push(permission);
      return groups;
    }, {});
  }, []);

  const filteredRoleRows = roleAccessRows.filter((role) => {
    const matchesSearch = !roleSearchTerm ||
      role.label.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
      role.description.toLowerCase().includes(roleSearchTerm.toLowerCase());
    const matchesStatus =
      roleStatusFilter === 'ALL' ||
      (roleStatusFilter === 'ACTIVE' && !role.isInactive) ||
      (roleStatusFilter === 'INACTIVE' && role.isInactive);
    return matchesSearch && matchesStatus;
  });

  const openRoleEditor = (roleValue) => {
    setEditingRoleValue(roleValue);
    setDraftRolePermissions(getCatalogPermissionsForRole(roleValue, roleAccessOverrides));
  };

  const toggleDraftRolePermission = (permission) => {
    setDraftRolePermissions((current) => (
      current.includes(permission)
        ? current.filter(item => item !== permission)
        : [...current, permission]
    ));
  };

  const saveRolePermissions = () => {
    if (!editingRoleValue) return;
    const nextOverrides = {
      ...roleAccessOverrides,
      [editingRoleValue]: [...new Set(draftRolePermissions)].sort(),
    };
    setRoleAccessOverrides(nextOverrides);
    localStorage.setItem(ROLE_ACCESS_STORAGE_KEY, JSON.stringify(nextOverrides));
    setEditingRoleValue(null);
    showNotification('Role permissions updated for this browser session.', 'success');
  };

  const activeUsers = users.filter(u => !u.archived);
  const staffRoles = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'];
  const staffCount = activeUsers.filter(u => staffRoles.includes(u.role)).length;

  // ── Activity Log Helpers ──
  const getActionColor = (action) => {
    if (action.includes('CREATED')) return 'text-emerald-600';
    if (action.includes('UPDATED')) return 'text-blue-600';
    if (action.includes('DELETED')) return 'text-red-600';
    if (action.includes('ARCHIVED')) return 'text-orange-600';
    if (action.includes('RESTORED')) return 'text-purple-600';
    if (action.includes('VERIFICATION')) return 'text-cyan-600';
    if (action.includes('SYNC')) return 'text-emerald-600';
    return 'text-gray-600';
  };

  const getActionIcon = (action) => {
    if (action.includes('CREATED')) return <UserPlus size={14} className="text-emerald-600" />;
    if (action.includes('UPDATED')) return <Edit size={14} className="text-blue-600" />;
    if (action.includes('DELETED')) return <Trash2 size={14} className="text-red-600" />;
    if (action.includes('ARCHIVED')) return <Archive size={14} className="text-orange-600" />;
    if (action.includes('RESTORED')) return <ArchiveRestore size={14} className="text-purple-600" />;
    if (action.includes('VERIFICATION')) return <Shield size={14} className="text-cyan-600" />;
    if (action.includes('SYNC')) return <RefreshCw size={14} className="text-emerald-600" />;
    return <Activity size={14} className="text-gray-600" />;
  };

  const getActionLabel = (action) => {
    return action.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  };

  // Get unique roles currently in the tab for the role dropdown
  const rolesInCurrentTab = useMemo(() => {
    const roles = new Set();
    users.forEach(user => {
      let inTab = false;
      if (activeTab === 'parents') inTab = user.role === 'PARENT' && !user.archived;
      else if (activeTab === 'students') inTab = user.role === 'STUDENT' && !user.archived;
      else if (activeTab === 'staff') inTab = ['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(user.role) && !user.archived;
      else if (activeTab === 'subordinate') inTab = ['ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'].includes(user.role) && !user.archived;
      else if (activeTab === 'admins') inTab = ['SUPER_ADMIN', 'ADMIN'].includes(user.role) && !user.archived;
      else if (activeTab === 'archive') inTab = user.archived === true;
      if (inTab) roles.add(user.role);
    });
    return Array.from(roles);
  }, [users, activeTab]);

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)]">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 backdrop-blur-sm ${notification.type === 'success'
          ? 'bg-emerald-500/95 text-white'
          : 'bg-red-500/95 text-white'
          } animate-fade-in`}
          style={{ animation: 'slideDown 0.3s ease-out' }}
        >
          {notification.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="font-medium text-sm">{notification.message}</span>
        </div>
      )}

      <ModuleTabNav
        sectionLabel="USER MANAGEMENT"
        tabs={[
          { id: 'list', label: 'User List', icon: <Users size={13} /> },
          { id: 'config', label: 'System Roles', icon: <Shield size={13} /> },
          { id: 'logs', label: 'Activity Logs', icon: <Activity size={13} /> },
        ]}
        activeTab={viewMode}
        onTabChange={setViewMode}
      />

      <div className="p-4 space-y-4 lg:p-5">
        <div className="flex items-center justify-end gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => {
                setEditingUser(null);
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm shadow-blue-600/20 font-semibold text-xs"
            >
              <UserPlus size={14} />
              Add User
            </button>
            {canSyncStudentUsers && (
              <button
                onClick={handleSyncStudentUsers}
                disabled={syncingStudentUsers}
                className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg transition-all shadow-sm font-semibold text-xs ${
                  syncingStudentUsers
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                <RefreshCw size={14} className={syncingStudentUsers ? 'animate-spin' : ''} />
                {syncingStudentUsers ? 'Syncing...' : 'Sync Students'}
              </button>
            )}
            <button className="inline-flex shrink-0 items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all shadow-sm font-semibold text-xs">
              <Upload size={14} />
              Bulk Import
            </button>
            <button className="inline-flex shrink-0 items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all shadow-sm font-semibold text-xs">
              <Mail size={14} />
              Invite Users
            </button>
            {canManageVerification && (
            <button
              onClick={handleSchoolVerificationToggle}
              disabled={verificationSaving}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all shadow-sm ${
                verificationSaving
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : verificationSettings.requiresUserVerification
                    ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
              title={verificationSettings.requiresUserVerification ? 'Disable school-wide verification' : 'Enable school-wide verification'}
            >
              <Shield size={14} />
              {verificationSaving
                ? 'Saving...'
                : verificationSettings.requiresUserVerification
                  ? 'Disable Verification'
                  : 'Enable Verification'}
            </button>
            )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            USER LIST VIEW — TWO-COLUMN LAYOUT
        ═══════════════════════════════════════════════════════════ */}
        {viewMode === 'list' && (
          <div className="flex flex-col xl:flex-row gap-5">

            {/* ── LEFT: User Management Workspace ── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Category Tabs */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'All Users', icon: Users, color: 'blue' },
                  { id: 'admins', label: 'Admins', icon: Shield, color: 'purple' },
                  { id: 'staff', label: 'Staff', icon: Shield, color: 'blue' },
                  { id: 'parents', label: 'Parents', icon: Users, color: 'green' },
                  { id: 'students', label: 'Students', icon: BookOpen, color: 'orange' },
                  { id: 'archive', label: 'Archived', icon: Archive, color: 'gray' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setRoleFilter('ALL'); setStatusFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === tab.id
                      ? `bg-${tab.color}-600 text-white shadow-sm`
                      : 'text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                    <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                      }`}>
                      {tab.id === 'archive' ? users.filter(u => u.archived).length :
                        tab.id === 'students' ? (learnerStats.total > 0 ? learnerStats.total : getStudentUsers().length) :
                          tab.id === 'parents' ? getParentUsers().length :
                            tab.id === 'admins' ? activeUsers.filter(u => ['SUPER_ADMIN', 'ADMIN'].includes(u.role)).length :
                            tab.id === 'staff' ? staffCount :
                              activeUsers.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search by name, email, phone, staff ID or admission number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition shadow-sm text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-blue-500/30 shadow-sm"
                  >
                    <option value="ALL">All Roles</option>
                    {rolesInCurrentTab.map(r => (
                      <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-blue-500/30 shadow-sm"
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                {selectedUsers.length > 0 && (
                  <div className="flex items-center gap-2 p-1.5 bg-purple-50 rounded-xl border border-purple-100 shadow-sm">
                    <span className="text-xs font-medium text-purple-700 px-2">{selectedUsers.length} Selected</span>
                    <button
                      onClick={() => setShowBulkActions(!showBulkActions)}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium transition"
                    >
                      Bulk Actions
                    </button>
                  </div>
                )}
              </div>

              {/* Bulk Actions Expanded */}
              {showBulkActions && selectedUsers.length > 0 && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-purple-900">Change Role:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLES_CONFIG.slice(0, 7).map(role => (
                      <button
                        key={role.value}
                        onClick={() => handleBulkRoleChange(role.value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white border border-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white shadow-sm"
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedUsers([])}
                    className="ml-auto p-1.5 text-gray-400 hover:text-red-500 transition"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Users Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500 text-sm">Loading users...</p>
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
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider">
                          <tr className="bg-gray-50/50">
                            <th className="px-4 py-3 text-left w-10">
                              <input
                                type="checkbox"
                                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">User</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Role</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Status</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Last Active</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredUsers.map(user => (
                            <tr key={user.id} className={`group hover:bg-blue-50/30 transition-colors ${user.archived ? 'bg-gray-50/50' : ''}`}>
                              <td className="px-4 py-3.5">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.includes(user.id)}
                                  onChange={() => toggleUserSelection(user.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-xs shadow-sm ${user.archived ? 'bg-gray-400' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                    }`}>
                                    {user.firstName[0]}{user.lastName[0]}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                                      {user.firstName} {user.lastName}
                                      {user.staffId && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded font-mono font-normal">{user.staffId}</span>}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider border ${user.role === 'SUPER_ADMIN' ? 'bg-red-50 text-red-700 border-red-100' :
                                  user.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                    user.role === 'PARENT' ? 'bg-green-50 text-green-700 border-green-100' :
                                      user.role === 'STUDENT' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                        'bg-blue-50 text-blue-700 border-blue-100'
                                  }`}>
                                  {getRoleLabel(user.role)}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex flex-col gap-1 items-start">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${user.archived ? 'bg-gray-100 text-gray-400' :
                                    user.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                      'bg-amber-100 text-amber-700'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${user.archived ? 'bg-gray-300' :
                                      user.status === 'ACTIVE' ? 'bg-emerald-500' :
                                        'bg-amber-500'
                                      }`}></span>
                                    {user.archived ? 'Archived' : user.status}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    !verificationSettings.requiresUserVerification
                                      ? 'bg-gray-50 text-gray-400'
                                      : user.verificationRequired
                                        ? user.emailVerified
                                          ? 'bg-emerald-50 text-emerald-600'
                                          : 'bg-red-50 text-red-600'
                                        : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    <Shield size={10} />
                                    {!verificationSettings.requiresUserVerification
                                      ? 'Bypass'
                                      : user.verificationRequired
                                        ? user.emailVerified ? 'Verified' : 'Unverified'
                                        : 'Bypassed'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  <Clock size={12} />
                                  {formatDate(user.lastLogin)}
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
                                  <button onClick={() => handleEdit(user)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Edit"><Edit size={15} /></button>
                                  {user.phone && (
                                    <button
                                      onClick={() => window.open(`https://wa.me/${user.phone.replace(/\D/g, '')}`, '_blank')}
                                      className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
                                      title="WhatsApp"
                                    >
                                      <MessageCircle size={15} />
                                    </button>
                                  )}
                                  {canManageVerification && !user.archived && (
                                    <button
                                      onClick={() => handleUserVerificationToggle(user)}
                                      disabled={verificationUserId === user.id}
                                      className={`p-1.5 rounded-lg transition ${
                                        user.verificationRequired
                                          ? 'text-amber-600 hover:bg-amber-100'
                                          : 'text-emerald-600 hover:bg-emerald-100'
                                      } ${verificationUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      title={user.verificationRequired ? 'Bypass verification' : 'Require verification'}
                                    >
                                      <Shield size={15} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => user.archived ? handleUnarchive(user.id) : handleArchive(user.id)}
                                    className={`p-1.5 rounded-lg transition ${user.archived ? 'text-emerald-600 hover:bg-emerald-100' : 'text-orange-600 hover:bg-orange-100'}`}
                                    title={user.archived ? "Restore" : "Archive"}
                                  >
                                    {user.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setResetTargetUser(user);
                                      setShowResetModal(true);
                                    }}
                                    className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition"
                                    title="Reset Password"
                                  >
                                    <Key size={15} />
                                  </button>
                                  <button onClick={() => handleDelete(user.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition" title="Delete">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile User Cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {filteredUsers.map(user => (
                        <div key={user.id} className="p-4 hover:bg-blue-50/20 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-sm flex-shrink-0 ${user.archived ? 'bg-gray-400' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                              {user.firstName[0]}{user.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900 text-sm truncate">{user.firstName} {user.lastName}</div>
                                <span className={`shrink-0 ml-2 inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase ${user.role === 'SUPER_ADMIN' ? 'bg-red-50 text-red-700' :
                                  user.role === 'ADMIN' ? 'bg-purple-50 text-purple-700' :
                                    'bg-blue-50 text-blue-700'
                                  }`}>
                                  {getRoleLabel(user.role)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${user.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                  {user.archived ? 'Archived' : user.status}
                                </span>
                                <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10} />{formatDate(user.lastLogin)}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-2">
                                <button onClick={() => handleEdit(user)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"><Edit size={14} /></button>
                                <button onClick={() => user.archived ? handleUnarchive(user.id) : handleArchive(user.id)} className="p-1.5 text-orange-600 hover:bg-orange-100 rounded transition">
                                  {user.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                </button>
                                <button onClick={() => { setResetTargetUser(user); setShowResetModal(true); }} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition"><Key size={14} /></button>
                                <button onClick={() => handleDelete(user.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Result Count */}
                {!loading && filteredUsers.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/50">
                    <span className="text-xs text-gray-400">Showing {filteredUsers.length} of {users.filter(u => !u.archived).length} users</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ROLES & PERMISSIONS VIEW
        ═══════════════════════════════════════════════════════════ */}
        {viewMode === 'config' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-950">Roles & Access</h2>
                <p className="text-xs text-slate-500 mt-1">Create and manage roles. Define what users can access and what actions they can perform.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-purple-200 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50">
                  <Users size={14} />
                  Role Templates
                </button>
                <button
                  onClick={() => showNotification('Custom role creation needs backend role storage before it can be assigned to users.', 'warning')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-purple-700 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-800"
                >
                  <Plus size={14} />
                  Create Role
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total Roles', value: roleAccessRows.length, helper: 'System roles', icon: Shield, tone: 'purple' },
                { label: 'Active Roles', value: activeRoleCount, helper: 'Currently in use', icon: Users, tone: 'green' },
                { label: 'Total Users Assigned', value: totalAssignedRoleUsers, helper: 'Across all roles', icon: UserCircle, tone: 'blue' },
                { label: 'Permissions', value: permissionNames.length, helper: 'Available permissions', icon: Key, tone: 'amber' },
              ].map((card) => {
                const tone = ROLE_TONE_CLASSES[card.tone];
                const CardIcon = card.icon;
                return (
                  <div key={card.label} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${tone.soft}`}>
                        <CardIcon size={22} className={tone.text} />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600">{card.label}</p>
                        <p className="mt-1 text-2xl font-bold text-slate-950">{card.value}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{card.helper}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-base font-bold text-slate-950">Roles</h3>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={roleSearchTerm}
                        onChange={(event) => setRoleSearchTerm(event.target.value)}
                        className="h-9 w-full rounded-md border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 sm:w-72"
                        placeholder="Search roles..."
                      />
                    </div>
                    <select
                      value={roleStatusFilter}
                      onChange={(event) => setRoleStatusFilter(event.target.value)}
                      className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                    <div className="hidden h-9 overflow-hidden rounded-md border border-slate-200 sm:flex">
                      <button className="grid w-10 place-items-center bg-purple-50 text-purple-700" title="Grid view"><LayoutGrid size={15} /></button>
                      <button className="grid w-10 place-items-center text-slate-500 hover:bg-slate-50" title="List view"><List size={15} /></button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {filteredRoleRows.map((role) => {
                    const RoleIcon = role.icon;
                    const selected = selectedRoleAccess?.value === role.value;
                    return (
                      <button
                        key={role.value}
                        onClick={() => setSelectedRoleValue(role.value)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${selected ? 'bg-purple-50/60' : 'hover:bg-slate-50'}`}
                      >
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ${role.tone.bg}`}>
                          <RoleIcon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-950">{role.label}</p>
                          <p className="truncate text-xs text-slate-500">{role.description}</p>
                        </div>
                        <div className="hidden w-24 text-xs text-slate-600 sm:block">
                          <p className="font-semibold">Users</p>
                          <p>{role.assignedUsers}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${role.isInactive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {role.isInactive ? 'Inactive' : 'Active'}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); openRoleEditor(role.value); }}
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-500 hover:border-purple-200 hover:text-purple-700"
                          title="Edit role permissions"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-slate-500">Showing 1 to {filteredRoleRows.length} of {roleAccessRows.length} roles</p>
              </div>

              {selectedRoleAccess && (
                <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="mb-5 flex items-start justify-between">
                    <h3 className="text-base font-bold text-slate-950">Role Details</h3>
                    <button onClick={() => setSelectedRoleValue(roleAccessRows[0]?.value)} className="text-slate-400 hover:text-slate-700" title="Close details">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`grid h-14 w-14 place-items-center rounded-full text-white ${selectedRoleAccess.tone.bg}`}>
                      {React.createElement(selectedRoleAccess.icon, { size: 24 })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-950">{selectedRoleAccess.label}</h4>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedRoleAccess.isInactive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {selectedRoleAccess.isInactive ? 'Inactive' : 'Active'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{selectedRoleAccess.detail}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500">Users Assigned</p>
                      <p className="mt-1 text-sm font-bold text-slate-950">{selectedRoleAccess.assignedUsers}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500">Permissions</p>
                      <p className="mt-1 text-sm font-bold text-slate-950">{selectedRoleAccess.permissionCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500">Created</p>
                      <p className="mt-1 text-xs font-bold text-slate-950">{selectedRoleAccess.created}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => openRoleEditor(selectedRoleAccess.value)} className="flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border border-purple-300 px-2 text-xs font-semibold text-purple-700 hover:bg-purple-50">
                      <Edit size={14} />
                      Edit Role
                    </button>
                    <button onClick={() => showNotification('Role cloning needs backend role storage before it can be assigned to users.', 'warning')} className="flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border border-purple-300 px-2 text-xs font-semibold text-purple-700 hover:bg-purple-50">
                      <Copy size={14} />
                      Clone Role
                    </button>
                    <button onClick={() => showNotification('Role activation is derived from assigned users in the current system.', 'warning')} className="col-span-2 flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border border-red-300 px-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                      <Power size={14} />
                      Deactivate Role
                    </button>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-950">Permission Summary</p>
                      <button onClick={() => openRoleEditor(selectedRoleAccess.value)} className="text-[11px] font-semibold text-purple-700">View all</button>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-purple-700"
                        style={{ width: `${Math.round((selectedRoleAccess.permissionCount / permissionNames.length) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                      <span>{selectedRoleAccess.permissionCount} of {permissionNames.length} permissions</span>
                      <span>{Math.round((selectedRoleAccess.permissionCount / permissionNames.length) * 100)}%</span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="mb-3 text-xs font-bold text-slate-950">Top Permissions</p>
                    <div className="space-y-2">
                      {selectedRoleAccess.permissions.slice(0, 5).map(permission => (
                        <div key={permission} className="flex items-center gap-2 text-xs text-slate-700">
                          <CheckCircle size={14} className="text-emerald-600" />
                          <span>{formatPermissionLabel(permission)}</span>
                        </div>
                      ))}
                      {selectedRoleAccess.permissions.length === 0 && (
                        <p className="text-xs text-slate-500">No permissions currently allowed.</p>
                      )}
                    </div>
                  </div>

                  <button className="mt-5 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-purple-300 text-xs font-semibold text-purple-700 hover:bg-purple-50">
                    <Eye size={14} />
                    Preview As Role
                  </button>
                </div>
              )}
            </div>

            {editingRoleValue && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">Edit Role Permissions</h3>
                      <p className="text-xs text-slate-500">{getRoleLabel(editingRoleValue)} - allow or disallow access below.</p>
                    </div>
                    <button onClick={() => setEditingRoleValue(null)} className="text-slate-400 hover:text-slate-700">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="max-h-[65vh] overflow-y-auto p-5">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {Object.values(groupedPermissions).map(group => (
                        <div key={group.key} className="rounded-lg border border-slate-100 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900">{group.label}</h4>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {group.permissions.filter(permission => draftRolePermissions.includes(permission)).length}/{group.permissions.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {group.permissions.map(permission => {
                              const enabled = draftRolePermissions.includes(permission);
                              return (
                                <label key={permission} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-slate-50">
                                  <span className="text-xs font-medium text-slate-700">{formatPermissionLabel(permission)}</span>
                                  <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={() => toggleDraftRolePermission(permission)}
                                    className="h-4 w-4 rounded border-slate-300 text-purple-700 focus:ring-purple-500"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                    <button onClick={() => setEditingRoleValue(null)} className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Cancel
                    </button>
                    <button onClick={saveRolePermissions} className="rounded-md bg-purple-700 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-800">
                      Save Permissions
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ACTIVITY LOG VIEW
        ═══════════════════════════════════════════════════════════ */}
        {viewMode === 'logs' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h2 className="text-xl font-medium text-white flex items-center gap-2">
                <Activity size={24} />
                Activity Log
              </h2>
              <p className="text-blue-100 text-sm mt-1">Track all user management actions with detailed timestamps</p>
            </div>

            {/* Activity Filter */}
            {activityLogs.length > 0 && (
              <div className="px-6 py-4 border-b bg-gray-50/50 flex gap-4 items-center flex-wrap">
                <label className="font-semibold text-sm text-gray-700">Filter by Admin:</label>
                <select
                  value={activityFilterUser}
                  onChange={(e) => setActivityFilterUser(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
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
              <div className="divide-y divide-gray-50">
                {activityLogs
                  .filter(log => activityFilterUser === 'all' || log.user === activityFilterUser)
                  .map(log => {
                    const getLogBg = (action) => {
                      if (action.includes('CREATED')) return 'border-l-4 border-emerald-500 bg-emerald-50/30';
                      if (action.includes('UPDATED')) return 'border-l-4 border-blue-500 bg-blue-50/30';
                      if (action.includes('DELETED')) return 'border-l-4 border-red-500 bg-red-50/30';
                      if (action.includes('ARCHIVED')) return 'border-l-4 border-orange-500 bg-orange-50/30';
                      if (action.includes('RESTORED')) return 'border-l-4 border-purple-500 bg-purple-50/30';
                      return 'border-l-4 border-gray-300 bg-gray-50/30';
                    };

                    return (
                      <div key={log.id} className={`p-4 ${getLogBg(log.action)} hover:bg-opacity-75 transition`}>
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

        {/* ═══════════════════════════════════════════════════════════
            ADD/EDIT USER MODAL
        ═══════════════════════════════════════════════════════════ */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-lg font-semibold text-white">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition">
                  <X size={20} />
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
                      {formData.role === 'PARENT' ? 'Login Email' : 'Email'} <span className="text-red-500">*</span>
                    </label>
                    {formData.role === 'PARENT' ? (
                      <>
                        <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                          {getParentLoginEmail(formData.phone) || 'Enter a phone number to generate the login email'}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">Parent login is generated from phone number.</p>
                      </>
                    ) : (
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="john.doe@school.com"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      Phone {formData.role === 'PARENT' && <span className="text-red-500">*</span>}
                    </label>
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
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold flex items-center justify-center gap-2 transition shadow-sm shadow-blue-600/20"
                  >
                    <Save size={18} />
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
