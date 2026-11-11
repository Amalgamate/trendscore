import { ROLE_HIERARCHY, type Role } from './roleDefinitions';

/**
 * Roles trusted to address school-wide audiences through Broadcast Messages.
 * Keep this separate from SEND_MESSAGES: teachers may send direct messages,
 * while broadcasts expose the school parent-contact directory.
 */
export const BROADCAST_MANAGER_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
];

// Deputies handle day-to-day teaching and learner operations, but the head
// teacher retains personnel, deletion, pathway-finalization, and school-wide
// leadership actions. Keep this set aligned with the frontend policy below.
export const DEPUTY_RESTRICTED_PERMISSIONS = new Set<Permission>([
  'EDIT_USER',
  'DELETE_USER',
  'DELETE_LEARNER',
  'LOCK_PATHWAY',
  'MANAGE_DORMITORIES',
  'ASSIGN_DORMITORY_BEDS',
  'MANAGE_HOUSE_MASTERS',
  'VIEW_BOARDING_REPORTS',
  'MANAGE_ID_TEMPLATES',
  'VIEW_AUDIT_LOGS',
  'VIEW_SYSTEM_LOGS',
  'DELETE_ANY_MESSAGE',
  'MARKETPLACE_APPROVE',
]);

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
  VIEW_ALL_LEARNERS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'],
  VIEW_OWN_LEARNERS: ['TEACHER'], // Teachers see only assigned classes
  VIEW_OWN_CHILDREN: ['PARENT'],  // Parents see only their children
  PROMOTE_LEARNER: ['SUPER_ADMIN', 'ADMIN'],
  TRANSFER_LEARNER: ['SUPER_ADMIN', 'ADMIN'],

  // ============================================
  // PATHWAY DECISION CENTRE
  // HEAD_OF_CURRICULUM is the explicit counsellor proxy until a dedicated
  // COUNSELLOR account role is approved and introduced across the product.
  // ============================================
  VIEW_PATHWAY_CASES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  COUNSEL_PATHWAY: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  APPROVE_PATHWAY: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  LOCK_PATHWAY: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  MANAGE_PATHWAY_CATALOG: ['SUPER_ADMIN', 'ADMIN'],
  MANAGE_PATHWAY_OFFERINGS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],

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
  // PRESENCE PLATFORM
  // ============================================
  // VIEW_PRESENCE_TIMELINE: individual learner timeline (teacher scoped, parent scoped)
  VIEW_PRESENCE_TIMELINE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'PARENT'],
  // VIEW_ALL_PRESENCE: school-wide snapshot, absent-today list, any learner
  VIEW_ALL_PRESENCE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  // VIEW_PRESENCE_ANALYTICS: analytics dashboard, at-risk list, reports
  VIEW_PRESENCE_ANALYTICS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  // SUPER_ADMIN_ONLY: most sensitive operations (NEMIS export, etc.)
  SUPER_ADMIN_ONLY: ['SUPER_ADMIN'],

  // ============================================
  // TRANSPORT TRIPS (Phase 2)
  // ============================================
  MANAGE_TRANSPORT_TRIPS:   ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  VIEW_TRANSPORT_TRIPS:     ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER'],
  // Drivers record boarding — role DRIVER maps here
  RECORD_BOARDING_EVENTS:   ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DRIVER'],

  // ============================================
  // BOARDING MODULE (Phase 5)
  // ============================================
  VIEW_BOARDING:            ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'PARENT'],
  MANAGE_DORMITORIES:       ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  ASSIGN_DORMITORY_BEDS:    ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  MANAGE_HOUSE_MASTERS:     ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  CONDUCT_ROLL_CALL:        ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HOUSE_MASTER'],
  MANAGE_EXEAT_REQUESTS:    ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HOUSE_MASTER'],
  SUBMIT_EXEAT_REQUEST:     ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'PARENT', 'HOUSE_MASTER'],
  VIEW_BOARDING_REPORTS:    ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],

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
  BETA_REVIEWER: ['SUPER_ADMIN', 'ADMIN'],
  VIEW_ACADEMIC_SETTINGS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  MANAGE_LEARNING_AREAS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'], // Head teacher can manage learning areas
  MANAGE_FACILITIES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'], // Head teacher can manage classes and facilities

  // ============================================
  // COMMUNICATIONS
  // ============================================
  SEND_SCHOOL_NOTICES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'RECEPTIONIST'],
  PUBLISH_CLASS_DIARY: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'RECEPTIONIST'],
  SEND_MESSAGES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT'],
  VIEW_INBOX: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'PARENT', 'STUDENT', 'ACCOUNTANT', 'RECEPTIONIST'],
  DELETE_OWN_MESSAGES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST'],
  DELETE_ANY_MESSAGE: ['SUPER_ADMIN'],

  // ============================================
  // FINANCE
  // ============================================
  // Finance-wide work is limited to finance leads. Parents use VIEW_OWN_BALANCE,
  // while reception uses the scoped invoice/payment permissions below.
  FEE_MANAGEMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'ACCOUNTANT'],
  VIEW_FEE_INVOICE: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'ACCOUNTANT'],
  VIEW_ASSIGNED_FEE_INFO: ['TEACHER'],
  MANAGE_FEE_STRUCTURE: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  RECORD_PAYMENT: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'],
  VIEW_ALL_BALANCES: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'ACCOUNTANT'],
  VIEW_OWN_BALANCE: ['PARENT'], // Parents see only their children's balances
  GENERATE_RECEIPTS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  FINANCIAL_REPORTS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  SEND_FEE_REMINDERS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],

  // M-Pesa money actions — previously any authenticated user could do these.
  // INITIATE_PAYOUT: trigger bulk salary disbursement via M-Pesa B2C.
  INITIATE_PAYOUT: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  // RELEASE_UNMATCHED: resolve or dismiss unmatched M-Pesa payments
  // (assigning an unmatched payment to a learner reduces that learner's
  // balance, so it must be restricted to finance staff).
  RELEASE_UNMATCHED: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  // VIEW_UNMATCHED_PAYMENTS: browse the unmatched payment queue.
  VIEW_UNMATCHED_PAYMENTS: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],

  // Overpayment credit allocation — finance staff can move excess payments
  // (held in Tuition Deposits 2100) to sibling invoices.
  ALLOCATE_OVERPAYMENT_CREDIT: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],

  // Refund requests may be submitted by finance staff or a linked parent;
  // approval is reserved for school leadership and cannot be self-approved.
  SUBMIT_REFUND: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'PARENT'],
  VIEW_REFUND_REQUESTS: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'ACCOUNTANT'],
  APPROVE_REFUND: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  APPROVE_FEE_ADJUSTMENT: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],

  // Mark-paid maker-checker: ACCOUNTANT can submit, only ADMIN/SUPER_ADMIN
  // can approve. This prevents creating receipts without money or oversight.
  MARK_INVOICE_PAID: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  APPROVE_MARK_PAID: ['SUPER_ADMIN', 'ADMIN'],

  // Bank reconciliation — finance staff can import M-Pesa statements and
  // match them against recorded payments. Only SUPER_ADMIN can finalise
  // (mark as reconciled) to prevent single-person errors going undetected.
  IMPORT_MPESA_STATEMENT: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  RECONCILE_MPESA_STATEMENT: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  VIEW_BANK_RECONCILIATION: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],

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

  // LMS Digital Learning Hub — Phase 1 additions (design §2.6)
  LEARNING_VIEW:        ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'STUDENT', 'PARENT'],
  LEARNING_MANAGE:      ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  LESSON_CREATE:        ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  LESSON_PUBLISH:       ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  ASSIGNMENT_CREATE:    ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  ASSIGNMENT_MARK:      ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],
  ASSIGNMENT_SUBMIT:    ['STUDENT'],
  ASSIGNMENT_REVIEW:    ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'],
  MARKETPLACE_PUBLISH:  ['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'ADMIN'],
  MARKETPLACE_APPROVE:  ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
  MARKETPLACE_PURCHASE: ['TEACHER', 'HEAD_TEACHER', 'ADMIN', 'PARENT', 'STUDENT'],
  ANALYTICS_LEARNING:   ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER'],

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

export type { Role };

/**
 * Check if a role has a specific permission
 * 
 * @param role - User role to check
 * @param permission - Permission to verify
 * @returns true if role has permission, false otherwise
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly Role[] | undefined;
  if (role === 'DEPUTY_HEAD_TEACHER') {
    return Boolean(allowedRoles?.includes('HEAD_TEACHER') && !DEPUTY_RESTRICTED_PERMISSIONS.has(permission));
  }
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
    .filter(([permission, roles]) => hasPermission(role, permission as Permission))
    .map(([permission]) => permission as Permission);
}

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
