export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN' as const;
export const SCHOOL_ADMIN_ROLE = 'ADMIN' as const;

export const USER_ROLES = [
  SUPER_ADMIN_ROLE,
  SCHOOL_ADMIN_ROLE,
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
  'PARENT',
  'ACCOUNTANT',
  'RECEPTIONIST',
  'LIBRARIAN',
  'NURSE',
  'SECURITY',
  'DRIVER',
  'COOK',
  'CLEANER',
  'GROUNDSKEEPER',
  'IT_SUPPORT',
  'STUDENT',
] as const;

export type Role = typeof USER_ROLES[number];

export const ROLES = USER_ROLES.reduce(
  (acc, role) => {
    acc[role] = role;
    return acc;
  },
  {} as Record<Role, Role>
);

export const ROLE_NAMES: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'School Admin',
  HEAD_TEACHER: 'Head Teacher',
  HEAD_OF_CURRICULUM: 'Head of Curriculum',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  ACCOUNTANT: 'Accountant',
  RECEPTIONIST: 'Receptionist',
  LIBRARIAN: 'Librarian',
  NURSE: 'Nurse',
  SECURITY: 'Security',
  DRIVER: 'Driver',
  COOK: 'Cook',
  CLEANER: 'Cleaner',
  GROUNDSKEEPER: 'Groundskeeper',
  IT_SUPPORT: 'IT Support',
  STUDENT: 'Student',
};

export const ROLE_HIERARCHY: Record<Role, number> = {
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
};

export const SUPER_ADMIN_ROLES: Role[] = [SUPER_ADMIN_ROLE];
export const SCHOOL_ADMIN_ROLES: Role[] = [SCHOOL_ADMIN_ROLE];
