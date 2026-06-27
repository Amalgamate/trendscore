import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../config/database';

export type ModulePackageId = 'starter' | 'standard' | 'professional' | 'enterprise';

type TxClient = Prisma.TransactionClient | PrismaClient;

export const APP_CATALOG = [
  { slug: 'student-registry', name: 'Student Registry', description: 'Learner admissions, profiles, parents and records.', category: 'Core', icon: 'users', sortOrder: 10 },
  { slug: 'fee-management', name: 'Fees & Billing', description: 'Invoices, collections, balances, statements and fee reports.', category: 'Finance', icon: 'wallet', sortOrder: 20 },
  { slug: 'attendance', name: 'Attendance', description: 'Daily learner attendance and reports.', category: 'Core', icon: 'check-square', sortOrder: 30 },
  { slug: 'gradebook', name: 'Gradebook', description: 'Formative, summative and CBC assessment entry.', category: 'Academics', icon: 'bar-chart', sortOrder: 40 },
  { slug: 'exams', name: 'Reports & Exams', description: 'Exam reporting, academic analytics and report cards.', category: 'Academics', icon: 'file-text', sortOrder: 50 },
  { slug: 'planner', name: 'Planner', description: 'Calendar, annual planner and duty rosters.', category: 'Operations', icon: 'calendar', sortOrder: 60 },
  { slug: 'timetable', name: 'Timetable', description: 'Class and teacher timetable management.', category: 'Operations', icon: 'clock', sortOrder: 70 },
  { slug: 'curriculum', name: 'Curriculum', description: 'Schemes of work and curriculum planning.', category: 'Academics', icon: 'book-open', sortOrder: 80 },
  { slug: 'sms-notifications', name: 'Messages', description: 'SMS, WhatsApp and inbox communication.', category: 'Communication', icon: 'message-square', sortOrder: 90 },
  { slug: 'announcements', name: 'Notices & Announcements', description: 'School notices and public announcements.', category: 'Communication', icon: 'megaphone', sortOrder: 100 },
  { slug: 'user-management', name: 'User Management', description: 'Users, roles and school account access.', category: 'Administration', icon: 'shield', sortOrder: 110 },
  { slug: 'school-settings', name: 'School Settings', description: 'Institution profile, branding and operating settings.', category: 'Administration', icon: 'settings', sortOrder: 120 },
  { slug: 'approvals', name: 'Approvals', description: 'Approval workflows, unlock requests and controlled changes.', category: 'Administration', icon: 'stamp', sortOrder: 130 },
  { slug: 'transport', name: 'Transport', description: 'Routes, riders, drivers and transport billing support.', category: 'Operations', icon: 'bus', sortOrder: 140 },
  { slug: 'inventory', name: 'Inventory', description: 'Stock, assets, stores and requisitions.', category: 'Operations', icon: 'package', sortOrder: 150 },
  { slug: 'staff-hr', name: 'Staff HR', description: 'Staff profiles, leave, attendance and HR documents.', category: 'HR', icon: 'briefcase', sortOrder: 160 },
  { slug: 'payroll', name: 'Payroll', description: 'Payroll processing and staff compensation.', category: 'HR', icon: 'receipt', sortOrder: 170, dependencies: ['staff-hr'] },
  { slug: 'accounting', name: 'Accounting', description: 'Expenses, chart of accounts, journals and reconciliations.', category: 'Finance', icon: 'landmark', sortOrder: 180 },
  { slug: 'lms', name: 'Learning Management', description: 'Courses, content, enrollments and learner progress.', category: 'Academics', icon: 'play-circle', sortOrder: 190 },
  { slug: 'library', name: 'Library', description: 'Book catalog, circulation and library fees.', category: 'Academics', icon: 'library', sortOrder: 200 },
  { slug: 'biometric', name: 'Biometric Attendance', description: 'Biometric devices, logs and attendance authority.', category: 'Operations', icon: 'fingerprint', sortOrder: 210 },
  { slug: 'tertiary-modules', name: 'Tertiary Modules', description: 'Programs, departments, units and tertiary workflows.', category: 'Academics', icon: 'graduation-cap', sortOrder: 220 },
];

export const MODULE_PACKAGES: Record<ModulePackageId, { name: string; description: string; active: string[]; mandatory: string[] }> = {
  starter: {
    name: 'Starter',
    description: 'Core school operations for schools starting with fees, attendance, assessment and communication.',
    active: [
      'student-registry',
      'fee-management',
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
    ],
    mandatory: ['student-registry', 'user-management', 'school-settings'],
  },
  standard: {
    name: 'Standard',
    description: 'Starter plus transport, inventory and approvals.',
    active: ['transport', 'inventory', 'approvals'],
    mandatory: ['student-registry', 'user-management', 'school-settings'],
  },
  professional: {
    name: 'Professional',
    description: 'Standard plus HR, accounting, LMS, library and biometric support.',
    active: ['staff-hr', 'payroll', 'accounting', 'lms', 'library', 'biometric'],
    mandatory: ['student-registry', 'user-management', 'school-settings'],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Professional plus tertiary workflows and full app catalog support.',
    active: ['tertiary-modules'],
    mandatory: ['student-registry', 'user-management', 'school-settings'],
  },
};

const PACKAGE_ORDER: ModulePackageId[] = ['starter', 'standard', 'professional', 'enterprise'];

export const normalizePackageId = (raw?: string | null): ModulePackageId => {
  const normalized = String(raw || 'starter').toLowerCase();
  return (PACKAGE_ORDER.includes(normalized as ModulePackageId) ? normalized : 'starter') as ModulePackageId;
};

export const getPackageDefinition = (packageId: ModulePackageId) => {
  const targetIndex = PACKAGE_ORDER.indexOf(packageId);
  const active = new Set<string>();
  const mandatory = new Set<string>();

  PACKAGE_ORDER.slice(0, targetIndex + 1).forEach((id) => {
    MODULE_PACKAGES[id].active.forEach((slug) => active.add(slug));
    MODULE_PACKAGES[id].mandatory.forEach((slug) => mandatory.add(slug));
  });

  return {
    id: packageId,
    name: MODULE_PACKAGES[packageId].name,
    description: MODULE_PACKAGES[packageId].description,
    active: Array.from(active),
    mandatory: Array.from(mandatory),
  };
};

export const ensureAppCatalog = async (client: TxClient = prisma) => {
  for (const app of APP_CATALOG) {
    await client.app.upsert({
      where: { slug: app.slug },
      update: {
        name: app.name,
        description: app.description,
        category: app.category,
        icon: app.icon,
        sortOrder: app.sortOrder,
        dependencies: app.dependencies || [],
        isSystem: false,
      },
      create: {
        slug: app.slug,
        name: app.name,
        description: app.description,
        category: app.category,
        icon: app.icon,
        sortOrder: app.sortOrder,
        dependencies: app.dependencies || [],
        isSystem: false,
      },
    });
  }
};

export const applyModulePackageToSchool = async (
  schoolId: string,
  packageId: ModulePackageId = 'starter',
  client: TxClient = prisma,
  updatedById?: string | null,
) => {
  await ensureAppCatalog(client);
  const packageDefinition = getPackageDefinition(packageId);
  const active = new Set(packageDefinition.active);
  const mandatory = new Set(packageDefinition.mandatory);
  const apps = await client.app.findMany({ where: { isSystem: false } });

  for (const app of apps) {
    await client.schoolAppConfig.upsert({
      where: { schoolId_appId: { schoolId, appId: app.id } },
      update: {
        isActive: active.has(app.slug),
        isMandatory: mandatory.has(app.slug),
        isVisible: true,
        updatedById: updatedById || undefined,
      },
      create: {
        schoolId,
        appId: app.id,
        isActive: active.has(app.slug),
        isMandatory: mandatory.has(app.slug),
        isVisible: true,
        updatedById: updatedById || undefined,
      },
    });
  }

  return packageDefinition;
};

export const ensureSchoolModuleConfigs = async (schoolId: string, packageId?: ModulePackageId | null) => {
  await ensureAppCatalog();
  const count = await prisma.schoolAppConfig.count({ where: { schoolId } });
  if (count > 0) return;

  if (packageId) {
    await applyModulePackageToSchool(schoolId, packageId);
    return;
  }

  const apps = await prisma.app.findMany({ where: { isSystem: false } });
  const starterMandatory = new Set(getPackageDefinition('starter').mandatory);
  for (const app of apps) {
    await prisma.schoolAppConfig.create({
      data: {
        schoolId,
        appId: app.id,
        isActive: true,
        isMandatory: starterMandatory.has(app.slug),
        isVisible: true,
      },
    });
  }
};

export const listSchoolModules = async (schoolId: string) => {
  await ensureSchoolModuleConfigs(schoolId);
  const configs = await prisma.schoolAppConfig.findMany({
    where: { schoolId },
    include: { app: true },
    orderBy: { app: { sortOrder: 'asc' } },
  });

  const modules = configs
    .filter((config) => !config.app.isSystem)
    .map((config) => ({
      id: config.app.id,
      slug: config.app.slug,
      name: config.app.name,
      description: config.app.description,
      category: config.app.category,
      icon: config.app.icon,
      sortOrder: config.app.sortOrder,
      dependencies: config.app.dependencies,
      isActive: config.isActive,
      isMandatory: config.isMandatory,
      isVisible: config.isVisible,
      updatedAt: config.updatedAt,
    }));

  return {
    packages: Object.fromEntries(
      PACKAGE_ORDER.map((id) => {
        const definition = getPackageDefinition(id);
        return [id, {
          id,
          name: definition.name,
          description: definition.description,
          active: definition.active,
          mandatory: definition.mandatory,
        }];
      }),
    ),
    modules,
    activeSlugs: modules.filter((module) => module.isActive && module.isVisible).map((module) => module.slug),
  };
};
