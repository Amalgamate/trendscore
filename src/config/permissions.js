/**
 * Frontend Permissions Configuration
 * Mirror of backend permissions for UI access control
 *
 * @module config/permissions
 */

const SYSTEM_ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SYSTEM_ADMINISTRATOR'];

export const PERMISSIONS = {
  // ============================================
  // USER MANAGEMENT
  // ============================================
  CREATE_ADMIN: SYSTEM_ADMIN_ROLES,
  CREATE_TEACHER: ['SUPER_ADMIN', 'ADMIN'],
  CREATE_PARENT: ['SUPER_ADMIN', 'ADMIN'],
  CREATE_ACCOUNTANT: ['SUPER_ADMIN', 'ADMIN'],
  CREATE_RECEPTIONIST: ['SUPER_ADMIN', 'ADMIN'],
  EDIT_USER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  DELETE_USER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_ALL_USERS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'],
  MANAGE_TEACHERS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'], // Can view/manage teacher list (hidden from teachers)

  // ============================================
  // LEARNER MANAGEMENT
  // ============================================
  CREATE_LEARNER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  EDIT_LEARNER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  DELETE_LEARNER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_ALL_LEARNERS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'],
  VIEW_OWN_LEARNERS: ['TEACHER'],
  VIEW_OWN_CHILDREN: ['PARENT'],
  PROMOTE_LEARNER: ['SUPER_ADMIN', 'ADMIN'],
  TRANSFER_LEARNER: ['SUPER_ADMIN', 'ADMIN'],

  // ============================================
  // ASSESSMENTS
  // ============================================
  ACCESS_ASSESSMENT_MODULE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'], // Full assessment module access
  CREATE_ASSESSMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'],
  EDIT_ASSESSMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'],
  DELETE_ASSESSMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_ASSESSMENT_PAGES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'], // Can access assessment pages
  VIEW_ALL_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'],
  VIEW_OWN_REPORTS: ['TEACHER'],
  VIEW_CHILDREN_REPORTS: ['PARENT'], // Parents can only view their children's reports
  GRADE_ASSESSMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER'],
  DOWNLOAD_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'PARENT'],

  // ============================================
  // ATTENDANCE
  // ============================================
  MARK_ATTENDANCE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER'],
  EDIT_ATTENDANCE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER'],
  VIEW_ALL_ATTENDANCE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_OWN_ATTENDANCE: ['TEACHER'],
  VIEW_CHILDREN_ATTENDANCE: ['PARENT'],
  GENERATE_ATTENDANCE_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER'],

  // ============================================
  // SETTINGS
  // ============================================
  SYSTEM_SETTINGS: SYSTEM_ADMIN_ROLES,
  SCHOOL_SETTINGS: [...SYSTEM_ADMIN_ROLES, 'ADMIN', 'HEAD_TEACHER'],
  ACADEMIC_SETTINGS: [...SYSTEM_ADMIN_ROLES, 'ADMIN', 'HEAD_TEACHER'],
  GRADING_SYSTEM: [...SYSTEM_ADMIN_ROLES, 'ADMIN'],
  TERMS_AND_STREAMS: ['SUPER_ADMIN', 'ADMIN'],
  BRANDING_SETTINGS: SYSTEM_ADMIN_ROLES,
  BACKUP_SETTINGS: SYSTEM_ADMIN_ROLES,
  USER_ROLES_SETTINGS: SYSTEM_ADMIN_ROLES,
  VIEW_ACADEMIC_SETTINGS: [...SYSTEM_ADMIN_ROLES, 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  MANAGE_LEARNING_AREAS: [...SYSTEM_ADMIN_ROLES, 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'], // Head teacher can manage learning areas
  MANAGE_FACILITIES: [...SYSTEM_ADMIN_ROLES, 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'], // Head teacher can manage classes and facilities

  // ============================================
  // COMMUNICATIONS
  // ============================================
  SEND_SCHOOL_NOTICES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'RECEPTIONIST'],
  SEND_MESSAGES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'ACCOUNTANT'],
  VIEW_INBOX: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST'],
  DELETE_OWN_MESSAGES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST'],
  DELETE_ANY_MESSAGE: SYSTEM_ADMIN_ROLES,

  // ============================================
  // FINANCE / FEE MANAGEMENT
  // ============================================
  FEE_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST'], // Access to fee management module
  MANAGE_FEE_STRUCTURE: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  RECORD_PAYMENT: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  VIEW_ALL_BALANCES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST'],
  VIEW_OWN_BALANCE: ['PARENT'],
  GENERATE_RECEIPTS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  FINANCIAL_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  SEND_FEE_REMINDERS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],

  // ============================================
  // HUMAN RESOURCES / STAFF MANAGEMENT
  // ============================================
  HR_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN'], // Access to HR module
  MANAGE_STAFF_PROFILES: ['SUPER_ADMIN', 'ADMIN'],
  PROCESS_PAYROLL: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  MANAGE_LEAVE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_OWN_LEAVE: ['TEACHER', 'ACCOUNTANT', 'RECEPTIONIST'],
  SUBMIT_LEAVE_REQUEST: ['TEACHER', 'ACCOUNTANT', 'RECEPTIONIST', 'HEAD_TEACHER'],
  APPROVE_LEAVE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  STAFF_PERFORMANCE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_STAFF_DOCUMENTS: ['SUPER_ADMIN', 'ADMIN'],

  // ============================================
  // LIBRARY MANAGEMENT
  // ============================================
  LIBRARY_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN'], // Access to library module
  MANAGE_BOOK_CATALOG: ['SUPER_ADMIN', 'ADMIN'],
  BORROW_RETURN_BOOKS: ['SUPER_ADMIN', 'ADMIN'],
  MANAGE_LIBRARY_FEES: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  VIEW_LIBRARY_INVENTORY: ['SUPER_ADMIN', 'ADMIN'],
  MANAGE_LIBRARY_MEMBERS: ['SUPER_ADMIN', 'ADMIN'],

  // ============================================
  // LEARNING MANAGEMENT SYSTEM (LMS)
  // ============================================
  ACCESS_LMS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM', 'STUDENT'], // Access to LMS module
  CREATE_COURSES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'],
  EDIT_COURSES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'],
  DELETE_COURSES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  UPLOAD_CONTENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM'],
  MANAGE_ENROLLMENTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_LEARNING_PROGRESS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'HEAD_OF_CURRICULUM', 'STUDENT'],
  VIEW_LEARNING_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_OWN_COURSES: ['STUDENT'],
  VIEW_OWN_ASSIGNMENTS: ['STUDENT'],
  SUBMIT_ASSIGNMENTS: ['STUDENT'],

  // ============================================
  // TRANSPORT & HOSTEL MANAGEMENT
  // ============================================
  TRANSPORT_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN'], // Access to transport module
  MANAGE_BUS_ROUTES: ['SUPER_ADMIN', 'ADMIN'],
  GPS_TRACKING: ['SUPER_ADMIN', 'ADMIN'],
  MANAGE_DRIVERS: ['SUPER_ADMIN', 'ADMIN'],
  MANAGE_HOSTEL_ALLOCATION: ['SUPER_ADMIN', 'ADMIN'],
  TRANSPORT_HOSTEL_FEES: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  VIEW_TRANSPORT_REPORTS: ['SUPER_ADMIN', 'ADMIN'],

  // ============================================
  // BIOMETRIC ATTENDANCE
  // ============================================
  BIOMETRIC_ATTENDANCE: ['SUPER_ADMIN', 'ADMIN'], // Access to biometric module
  MANAGE_BIOMETRIC_DEVICES: ['SUPER_ADMIN', 'ADMIN'],
  ENROLL_FINGERPRINTS: ['SUPER_ADMIN', 'ADMIN'],
  VIEW_BIOMETRIC_LOGS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  CONFIGURE_BIOMETRIC_API: SYSTEM_ADMIN_ROLES,

  // ============================================
  // AUDIT & LOGS
  // ============================================
  VIEW_AUDIT_LOGS: SYSTEM_ADMIN_ROLES,
  VIEW_SYSTEM_LOGS: SYSTEM_ADMIN_ROLES,
  VIEW_USER_ACTIVITY: ['SUPER_ADMIN', 'ADMIN'],

  // ============================================
  // ACCOUNTING MANAGEMENT
  // ============================================
  ACCOUNTING_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],

  // ============================================
  // TIMETABLE
  // ============================================
  ACCESS_TIMETABLE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  EDIT_TIMETABLE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],

  // ============================================
  // TERTIARY MODULES
  // ============================================
  TERTIARY_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN'],
  VIEW_TERTIARY_DATA: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER'],
  MANAGE_TERTIARY_ACADEMICS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
};

/**
 * All available user roles
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  SYSTEM_ADMINISTRATOR: 'SYSTEM_ADMINISTRATOR',
  ADMIN: 'ADMIN',
  HEAD_TEACHER: 'HEAD_TEACHER',
  TEACHER: 'TEACHER',
  PARENT: 'PARENT',
  ACCOUNTANT: 'ACCOUNTANT',
  RECEPTIONIST: 'RECEPTIONIST',
  HEAD_OF_CURRICULUM: 'HEAD_OF_CURRICULUM',
  STUDENT: 'STUDENT',
};

/**
 * Role display names
 */
export const ROLE_NAMES = {
  SUPER_ADMIN: 'Super Admin',
  SYSTEM_ADMIN: 'System Admin',
  SYSTEM_ADMINISTRATOR: 'System Administrator',
  ADMIN: 'Admin',
  HEAD_TEACHER: 'Head Teacher',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  ACCOUNTANT: 'Accountant',
  RECEPTIONIST: 'Receptionist',
  HEAD_OF_CURRICULUM: 'Head of Curriculum',
  STUDENT: 'Student',
};

/**
 * Role hierarchy - used for determining authority
 * Higher number = higher authority
 */
export const ROLE_HIERARCHY = {
  SUPER_ADMIN: 7,
  SYSTEM_ADMIN: 7,
  SYSTEM_ADMINISTRATOR: 7,
  ADMIN: 6,
  HEAD_TEACHER: 5,
  HEAD_OF_CURRICULUM: 5,
  TEACHER: 4,
  ACCOUNTANT: 3,
  RECEPTIONIST: 2,
  PARENT: 1,
  STUDENT: 0,
};

const ROLE_ACCESS_STORAGE_KEY = 'trendscore.roleAccessOverrides.v1';

function getRoleAccessOverrides() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROLE_ACCESS_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getEffectiveRolePermissions(role) {
  const overrides = getRoleAccessOverrides();
  if (Array.isArray(overrides[role])) return overrides[role];
  return Object.entries(PERMISSIONS)
    .filter(([_, roles]) => roles.includes(role))
    .map(([permission]) => permission);
}

/**
 * Check if a role has a specific permission
 * 
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean} True if role has permission
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  return getEffectiveRolePermissions(role).includes(permission);
}

/**
 * Get all permissions for a specific role
 * 
 * @param {string} role - User role
 * @returns {string[]} Array of permission names
 */
export function getRolePermissions(role) {
  if (!role) return [];
  return getEffectiveRolePermissions(role);
}

/**
 * Check if a role can manage another role
 * 
 * @param {string} managerRole - Role attempting to manage
 * @param {string} targetRole - Role being managed
 * @returns {boolean} True if manager can manage target
 */
export function canManageRole(managerRole, targetRole) {
  if (!managerRole || !targetRole) return false;
  return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * Check if user has any of the provided permissions
 * 
 * @param {string} role - User role
 * @param {string[]} permissions - Array of permissions
 * @returns {boolean} True if has any permission
 */
export function hasAnyPermission(role, permissions) {
  if (!role || !permissions || !Array.isArray(permissions)) return false;
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if user has all of the provided permissions
 * 
 * @param {string} role - User role
 * @param {string[]} permissions - Array of permissions
 * @returns {boolean} True if has all permissions
 */
export function hasAllPermissions(role, permissions) {
  if (!role || !permissions || !Array.isArray(permissions)) return false;
  return permissions.every(permission => hasPermission(role, permission));
}
