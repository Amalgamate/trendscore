import prisma from '../config/database';
import { ensureAppCatalog } from '../services/moduleCatalog.service';

type CliOptions = {
  school?: string;
  module: string;
  visible: boolean;
  actor?: string | null;
};

const ZAWADI_ALIASES = new Set([
  'jrn',
  'zawadi',
  'zawadijrn',
  'zawadi-jrn',
  'zawadi-junior',
  'zawadi junior',
  'jrn-zawadi',
]);

const readOption = (args: string[], name: string): string | undefined => {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  return {
    school: readOption(args, 'school') || readOption(args, 'school-id') || readOption(args, 'slug'),
    module: (readOption(args, 'module') || readOption(args, 'app') || 'staff-hr').trim(),
    visible: readOption(args, 'visible') !== 'false',
    actor: readOption(args, 'actor') || 'system-script',
  };
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[_\s]+/g, '-');

const schoolMatches = (school: { id: string; name: string; email: string | null }, selector: string) => {
  const target = normalize(selector);
  const values = [school.id, school.name, school.email || ''].map(normalize);

  if (ZAWADI_ALIASES.has(target)) {
    return values.some((value) => value.includes('zawadi') || value.includes('jrn'));
  }

  return values.some((value) => value === target || value.includes(target));
};

async function resolveSchool(selector?: string) {
  const schools = await prisma.school.findMany({
    where: { archived: false },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, name: true, email: true, active: true },
  });

  if (schools.length === 0) {
    throw new Error('No active school record found.');
  }

  if (!selector) return schools[0];

  const match = schools.find((school) => schoolMatches(school, selector));
  if (!match) {
    throw new Error(`No school matched "${selector}". Available: ${schools.map((s) => `${s.name} (${s.id})`).join(', ')}`);
  }
  return match;
}

async function main() {
  const options = parseArgs();
  if (!options.module) throw new Error('Module slug is required.');

  await ensureAppCatalog();

  const school = await resolveSchool(options.school);
  const app = await prisma.app.findUnique({ where: { slug: options.module } });
  if (!app) throw new Error(`Module not found: ${options.module}`);

  const existing = await prisma.schoolAppConfig.findFirst({
    where: { schoolId: school.id, appId: app.id },
  });

  const config = existing
    ? await prisma.schoolAppConfig.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          isVisible: options.visible,
          updatedById: null,
        },
      })
    : await prisma.schoolAppConfig.create({
        data: {
          schoolId: school.id,
          appId: app.id,
          isActive: true,
          isVisible: options.visible,
          isMandatory: false,
          updatedById: null,
        },
      });

  await prisma.appAuditLog.create({
    data: {
      schoolId: school.id,
      appId: app.id,
      action: 'ACTIVATED',
      performedBy: options.actor || 'system-script',
      roleAtTime: 'SYSTEM_SCRIPT',
      ipAddress: null,
      userAgent: 'enable-school-module.ts',
    },
  }).catch(() => null);

  console.log(JSON.stringify({
    success: true,
    school: { id: school.id, name: school.name },
    module: { slug: app.slug, name: app.name },
    config: { id: config.id, isActive: config.isActive, isVisible: config.isVisible },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
