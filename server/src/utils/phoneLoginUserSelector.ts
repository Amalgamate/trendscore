type PhoneLoginUser = {
  role?: string | null;
  roles?: Array<string | null> | null;
};

const PHONE_LOGIN_ROLE_PRIORITY = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
  'ACCOUNTANT',
  'RECEPTIONIST',
  'LIBRARIAN',
  'NURSE',
  'IT_SUPPORT',
  'GROUNDSKEEPER',
  'PARENT',
  'STUDENT',
];

const roleRank = new Map(PHONE_LOGIN_ROLE_PRIORITY.map((role, index) => [role, index]));

const getRoleRank = (user: PhoneLoginUser): number => {
  const roles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role];
  return roles.reduce((best, role) => {
    const rank = roleRank.get(String(role || '').toUpperCase());
    return rank === undefined ? best : Math.min(best, rank);
  }, PHONE_LOGIN_ROLE_PRIORITY.length);
};

export const selectPreferredPhoneLoginUser = <T extends PhoneLoginUser>(users: T[]): T | null => {
  if (!Array.isArray(users) || users.length === 0) return null;

  return [...users].sort((a, b) => getRoleRank(a) - getRoleRank(b))[0] || null;
};
