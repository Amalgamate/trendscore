const STARTER_CORE_APPS = [
  'student-registry',
  'attendance',
  'gradebook',
  'exams',
  'planner',
  'timetable',
  'curriculum',
  'sms-notifications',
  'announcements',
  'user-management',
  'school-settings',
];

const NON_STARTER_APPS = [
  'transport',
  'inventory',
  'staff-hr',
  'payroll',
  'accounting',
  'lms',
  'library',
  'biometric',
  'tertiary-modules',
  'approvals',
];

export const normalizeEnabledApps = (apps) => (
  Array.isArray(apps)
    ? apps.map((app) => String(app || '').trim()).filter(Boolean)
    : []
);

export const getEnabledAppsForUser = (user) => normalizeEnabledApps(
  user?.enabledApps || user?.activeModules || user?.school?.enabledApps || user?.school?.activeModules
);

export const isStarterPackageApps = (apps) => {
  const enabled = normalizeEnabledApps(apps);
  if (enabled.length === 0) return false;
  const enabledSet = new Set(enabled);
  const hasStarterCore = STARTER_CORE_APPS.some((slug) => enabledSet.has(slug));
  const hasNonStarterApp = NON_STARTER_APPS.some((slug) => enabledSet.has(slug));
  return hasStarterCore && !hasNonStarterApp;
};

export const getActiveModuleSlugs = (modules) => (
  Array.isArray(modules)
    ? modules
        .filter((module) => module?.isActive !== false && module?.isVisible !== false)
        .map((module) => module?.slug)
    : []
);

export const isStarterPackageModules = (modules) => isStarterPackageApps(getActiveModuleSlugs(modules));

export const isStarterPackageUser = (user) => isStarterPackageApps(getEnabledAppsForUser(user));

export const hasFeeModuleAccess = (apps) => normalizeEnabledApps(apps).includes('fee-management');
