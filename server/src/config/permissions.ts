/**
 * Permissions Configuration
 * Defines which roles have access to which features/actions
 * 
 * @module config/permissions
 */

export const PERMISSIONS = {
  // ============================================
  // USER MANAGEMENT
  // ============================================
  CREATE_ADMIN: ['SUPER_ADMIN'],
  CREATE_TEACHER: ['SUPER_ADMIN', 'ADMIN'],
  CREATE_PARENT: ['SUPER_ADMIN', 'ADMIN'],
  CREATE_ACCOUNTANT: ['SUPER_ADMIN', 'ADMIN'],
  CREATE_RECEPTIONIST: ['SUPER_ADMIN', 'ADMIN'],
  EDIT_USER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  DELETE_USER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_ALL_USERS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  MANAGE_TEACHERS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'], // Can view/manage teacher list (hidden from teachers)

  // ============================================
  // LEARNER MANAGEMENT
  // ============================================
  CREATE_LEARNER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  EDIT_LEARNER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  DELETE_LEARNER: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_ALL_LEARNERS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'],
  VIEW_OWN_LEARNERS: ['TEACHER'], // Teachers see only assigned classes
  VIEW_OWN_CHILDREN: ['PARENT'],  // Parents see only their children
  PROMOTE_LEARNER: ['SUPER_ADMIN', 'ADMIN'],
  TRANSFER_LEARNER: ['SUPER_ADMIN', 'ADMIN'],

  // ============================================
  // ASSESSMENTS
  // ============================================
  ACCESS_ASSESSMENT_MODULE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'], // Full assessment module access
  CREATE_ASSESSMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  EDIT_ASSESSMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  DELETE_ASSESSMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_ALL_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  VIEW_OWN_REPORTS: ['TEACHER'],      // Teachers see only their classes
  VIEW_CHILDREN_REPORTS: ['PARENT'],  // Parents see only their children
  GRADE_ASSESSMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  VIEW_ASSESSMENT_PAGES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'], // Can access assessment pages
  DOWNLOAD_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'PARENT'],

  // ============================================
  // ATTENDANCE
  // ============================================
  MARK_ATTENDANCE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  EDIT_ATTENDANCE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  VIEW_ALL_ATTENDANCE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  VIEW_OWN_ATTENDANCE: ['TEACHER'],      // Teachers see only their classes
  VIEW_CHILDREN_ATTENDANCE: ['PARENT'],  // Parents see only their children
  GENERATE_ATTENDANCE_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],

  // ============================================
  // SETTINGS
  // ============================================
  SYSTEM_SETTINGS: ['SUPER_ADMIN'],
  SCHOOL_SETTINGS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  ACADEMIC_SETTINGS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  GRADING_SYSTEM: ['SUPER_ADMIN', 'ADMIN'],
  MANAGE_ID_TEMPLATES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  TERMS_AND_STREAMS: ['SUPER_ADMIN', 'ADMIN'],
  BRANDING_SETTINGS: ['SUPER_ADMIN'],
  BACKUP_SETTINGS: ['SUPER_ADMIN'],
  USER_ROLES_SETTINGS: ['SUPER_ADMIN'],
  VIEW_ACADEMIC_SETTINGS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  MANAGE_LEARNING_AREAS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'], // Head teacher can manage learning areas
  MANAGE_FACILITIES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'], // Head teacher can manage classes and facilities

  // ============================================
  // COMMUNICATIONS
  // ============================================
  SEND_SCHOOL_NOTICES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'RECEPTIONIST'],
  SEND_MESSAGES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT'],
  VIEW_INBOX: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST'],
  DELETE_OWN_MESSAGES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST'],
  DELETE_ANY_MESSAGE: ['SUPER_ADMIN'],

  // ============================================
  // FINANCE
  // ============================================
  FEE_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST', 'PARENT'],
  MANAGE_FEE_STRUCTURE: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  RECORD_PAYMENT: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  VIEW_ALL_BALANCES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST'],
  VIEW_OWN_BALANCE: ['PARENT'], // Parents see only their children's balances
  GENERATE_RECEIPTS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  FINANCIAL_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  SEND_FEE_REMINDERS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],

  // ============================================
  // AUDIT & LOGS
  // ============================================
  VIEW_AUDIT_LOGS: ['SUPER_ADMIN'],
  VIEW_SYSTEM_LOGS: ['SUPER_ADMIN'],
  VIEW_USER_ACTIVITY: ['SUPER_ADMIN', 'ADMIN'],

  // ============================================
  // BIOMETRIC SYSTEM (Coming Soon)
  // ============================================
  MANAGE_BIOMETRIC_DEVICES: ['SUPER_ADMIN', 'ADMIN'],
  ENROLL_FINGERPRINTS: ['SUPER_ADMIN', 'ADMIN'],
  VIEW_BIOMETRIC_LOGS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  CONFIGURE_BIOMETRIC_API: ['SUPER_ADMIN'],

  // ============================================
  // BOOKS & RESOURCES
  // ============================================
  MANAGE_BOOKS: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],
  VIEW_BOOKS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'LIBRARIAN'],
  VIEW_LIBRARY_INVENTORY: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],
  MANAGE_BOOK_CATALOG: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],
  BORROW_RETURN_BOOKS: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],
  MANAGE_LIBRARY_MEMBERS: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],
  MANAGE_LIBRARY_FEES: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'LIBRARIAN'],
  LIBRARY_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],

  // ============================================
  // LEARNING MANAGEMENT SYSTEM (LMS)
  // ============================================
  ACCESS_LMS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'STUDENT'],
  CREATE_COURSES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  EDIT_COURSES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  DELETE_COURSES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  UPLOAD_CONTENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  MANAGE_ENROLLMENTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_LEARNING_PROGRESS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'STUDENT'],
  VIEW_LEARNING_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],

  // ============================================
  // TIMETABLE
  // ============================================
  ACCESS_TIMETABLE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  EDIT_TIMETABLE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
} as const;

/**
 * Type for all available permissions
 */
export type Permission = keyof typeof PERMISSIONS;

/**
 * Type for all available roles (includes all UserRole enum values from Prisma)
 */
export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'HEAD_TEACHER'
  | 'HEAD_OF_CURRICULUM'
  | 'TEACHER'
  | 'PARENT'
  | 'ACCOUNTANT'
  | 'RECEPTIONIST'
  | 'STUDENT'
  | 'LIBRARIAN'
  | 'NURSE'
  | 'SECURITY'
  | 'DRIVER'
  | 'COOK'
  | 'CLEANER'
  | 'GROUNDSKEEPER'
  | 'IT_SUPPORT';

/**
 * Check if a role has a specific permission
 * 
 * @param role - User role to check
 * @param permission - Permission to verify
 * @returns true if role has permission, false otherwise
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly Role[] | undefined;
  return allowedRoles ? allowedRoles.includes(role) : false;
}

/**
 * Get all permissions for a specific role
 * 
 * @param role - User role
 * @returns Array of permissions the role has
 */
export function getRolePermissions(role: Role): Permission[] {
  return Object.entries(PERMISSIONS)
    .filter(([_, roles]) => (roles as readonly Role[]).includes(role))
    .map(([permission]) => permission as Permission);
}

/**
 * Role hierarchy - used for determining if a user can manage another user
 * Higher number = higher authority
 */
export const ROLE_HIERARCHY = {
  SUPER_ADMIN: 7,
  ADMIN: 6,
  HEAD_TEACHER: 5,
  HEAD_OF_CURRICULUM: 5,
  TEACHER: 4,
  ACCOUNTANT: 3,
  RECEPTIONIST: 2,
  LIBRARIAN: 2,
  NURSE: 2,
  IT_SUPPORT: 2,
  SECURITY: 1,
  DRIVER: 1,
  COOK: 1,
  CLEANER: 1,
  GROUNDSKEEPER: 1,
  PARENT: 1,
  STUDENT: 0,
} as const;

/**
 * Check if a role can manage another role
 * 
 * @param managerRole - Role attempting to manage
 * @param targetRole - Role being managed
 * @returns true if manager can manage target, false otherwise
 */
export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole];
}
