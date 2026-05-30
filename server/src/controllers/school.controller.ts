import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { generateAdmissionNumber, getCurrentSequenceValue, resetSequence, getNextAdmissionNumberPreview } from '../services/admissionNumber.service';
import { provisionNewSchool } from '../services/school-provisioning.service';
import { deleteSchoolSafely } from '../services/school-deletion.service';
import { clearSchoolCache } from '../middleware/schoolContext.middleware';

import logger from '../utils/logger';
const VALID_INSTITUTION_TYPES = new Set(['PRIMARY_CBC', 'SECONDARY', 'TERTIARY']);
const validInstitutionTypeOrThrow = (raw: string) => {
  const normalized = String(raw || '').toUpperCase();
  if (!VALID_INSTITUTION_TYPES.has(normalized)) {
    throw new ApiError(400, 'Invalid institutionType. Use PRIMARY_CBC, SECONDARY, or TERTIARY.');
  }
  return normalized as 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';
};

const resolveCurrentSchool = () =>
  prisma.school.findFirst({
    where: { archived: false },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

const isDataUri = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('data:');

const resolveBrandingAssetUrl = (assetType: 'logo' | 'favicon' | 'stamp' | 'pwa-logo', value: string | null | undefined, updatedAt?: Date) => {
  if (!value) return value;
  if (!isDataUri(value)) return value;
  const version = updatedAt ? updatedAt.getTime() : Date.now();
  return `/api/schools/public/assets/${assetType}?v=${version}`;
};

const optimizeSchoolPayload = <T extends { logoUrl?: string | null; faviconUrl?: string | null; pwaLogoUrl?: string | null; stampUrl?: string | null; updatedAt?: Date }>(school: T) => ({
  ...school,
  logoUrl: resolveBrandingAssetUrl('logo', school.logoUrl, school.updatedAt),
  faviconUrl: resolveBrandingAssetUrl('favicon', school.faviconUrl, school.updatedAt),
  pwaLogoUrl: resolveBrandingAssetUrl('pwa-logo', school.pwaLogoUrl, school.updatedAt),
  stampUrl: resolveBrandingAssetUrl('stamp', school.stampUrl, school.updatedAt),
});

const decodeDataUri = (value: string): { mimeType: string; buffer: Buffer } | null => {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, base64Payload] = match;
  try {
    return { mimeType, buffer: Buffer.from(base64Payload, 'base64') };
  } catch {
    return null;
  }
};
// ============================================
// SCHOOL MANAGEMENT ENDPOINTS (Single-Tenant)
// ============================================

export const getPublicBranding = async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findFirst({
      where: { archived: false },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        logoUrl: true,
        faviconUrl: true,
        pwaLogoUrl: true,
        brandColor: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor1: true,
        accentColor2: true,
        welcomeTitle: true,
        welcomeMessage: true,
        onboardingTitle: true,
        onboardingMessage: true,
        phone: true,
        email: true,
        motto: true,
        address: true,
        vision: true,
        mission: true,
        latitude: true,
        longitude: true,
        stampUrl: true,
        updatedAt: true,
      },
    });

    // Return defaults when no school record exists yet (single-tenant, not yet provisioned)
    const branding = school ? optimizeSchoolPayload(school) : {
      id: null,
      name: 'Trends CORE V1.0',
      logoUrl: '/branding/logo.png',
      faviconUrl: '/branding/favicon.png',
      pwaLogoUrl: '/logo512.png',
      brandColor: '#030b82',
      primaryColor: '#030b82',
      secondaryColor: '#0D9488',
      accentColor1: '#3b82f6',
      accentColor2: '#e11d48',
      welcomeTitle: 'Welcome back!',
      welcomeMessage: 'Sign in to access your dashboard.',
      onboardingTitle: 'Join Our Community',
      onboardingMessage: 'Create an account to start managing your school today.',
      motto: 'School Management System',
      address: 'Nairobi, Kenya',
      phone: '+254700000000',
      email: 'info@zawadijunioracademy.co.ke',
      vision: 'To be a leading center of excellence in education.',
      mission: 'To provide quality education through modern technology.',
      latitude: -1.2921,
      longitude: 36.8219,
      stampUrl: '/branding/stamp.svg'
    };

    res.status(200).json({ success: true, data: branding });
  } catch (error) {
    logger.error('Error fetching public branding:', error);
    throw error;
  }
};

export const getSchool = async (req: AuthRequest, res: Response) => {
  const school = await resolveCurrentSchool();
  if (!school) throw new ApiError(404, 'School not found');
  res.status(200).json({ success: true, data: optimizeSchoolPayload(school) });
};

export const getPublicBrandingAsset = async (req: Request, res: Response) => {
  const school = await prisma.school.findFirst({
    where: { archived: false },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: { logoUrl: true, faviconUrl: true, pwaLogoUrl: true, stampUrl: true }
  });

  const assetType = String(req.params.assetType || '').toLowerCase();
  const fallbackMap: Record<string, string> = {
    logo: '/branding/logo.png',
    favicon: '/branding/favicon.png',
    'pwa-logo': '/logo512.png',
    stamp: '/branding/stamp.svg'
  };

  const fieldMap: Record<string, 'logoUrl' | 'faviconUrl' | 'pwaLogoUrl' | 'stampUrl'> = {
    logo: 'logoUrl',
    favicon: 'faviconUrl',
    'pwa-logo': 'pwaLogoUrl',
    stamp: 'stampUrl'
  };

  const field = fieldMap[assetType];
  if (!field) throw new ApiError(400, 'Invalid asset type');

  const value = school?.[field] || fallbackMap[assetType];
  if (!value) throw new ApiError(404, 'Asset not found');

  if (!isDataUri(value)) {
    return res.redirect(302, value);
  }

  const decoded = decodeDataUri(value);
  if (!decoded) throw new ApiError(400, 'Invalid embedded branding asset');

  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.type(decoded.mimeType).status(200).send(decoded.buffer);
};

export const updateSchool = async (req: AuthRequest, res: Response) => {
  const school = await resolveCurrentSchool();

  if (!school) {
    // If no school exists, create it (handles first-time setup/branding)
    const created = await prisma.school.create({
      data: {
        ...req.body,
        name: req.body.name || 'Trends CORE V1.0', // Ensure a name exists
        motto: req.body.motto || 'School Management System',
        logoUrl: req.body.logoUrl || '/branding/logo.png',
        faviconUrl: req.body.faviconUrl || '/branding/favicon.png',
        pwaLogoUrl: req.body.pwaLogoUrl || '/logo512.png',
        stampUrl: req.body.stampUrl || '/branding/stamp.svg',
      },
    });
    return res.status(201).json({ success: true, message: 'School settings initialized', data: created });
  }

  const updated = await prisma.school.update({
    where: { id: school.id },
    data: req.body,
  });
  clearSchoolCache();
  res.status(200).json({ success: true, message: 'School updated', data: updated });
};

export const getPublicManifest = async (_req: Request, res: Response) => {
  const school = await prisma.school.findFirst({
    where: { archived: false },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      name: true,
      primaryColor: true,
      brandColor: true,
      pwaLogoUrl: true,
      updatedAt: true,
    },
  });

  const pwaIcon = resolveBrandingAssetUrl('pwa-logo', school?.pwaLogoUrl || '/logo512.png', school?.updatedAt) || '/logo512.png';
  const themeColor = school?.primaryColor || school?.brandColor || '#520050';
  const appName = school?.name || 'Trends CORE V1.0';

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    short_name: appName,
    name: `${appName} - School Management & CBC Grading`,
    description: 'Complete CBC School Management & Grading System for Kenyan schools',
    id: '/',
    scope: '/',
    start_url: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait',
    theme_color: themeColor,
    background_color: '#ffffff',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { src: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { src: pwaIcon, sizes: '192x192', type: 'image/png' },
      { src: pwaIcon, sizes: '512x512', type: 'image/png' },
      { src: pwaIcon, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
};

export const configureInstitutionTypeLock = async (req: AuthRequest, res: Response) => {
  const requestedType = validInstitutionTypeOrThrow(req.body?.institutionType);

  let school = await resolveCurrentSchool();
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: 'Trends CORE V1.0',
        institutionType: requestedType as any,
        institutionTypeLocked: true,
      },
    });
  } else {
    if (school.institutionTypeLocked && school.institutionType !== requestedType) {
      throw new ApiError(409, `Institution type is already locked to ${school.institutionType}`);
    }

    school = await prisma.school.update({
      where: { id: school.id },
      data: {
        institutionType: requestedType as any,
        institutionTypeLocked: true,
      },
    });
    clearSchoolCache();
  }

  res.status(school ? 200 : 201).json({
    success: true,
    message: 'Institution type configured and locked',
    data: school,
  });
};

export const getInstitutionSetupProgress = async (req: AuthRequest, res: Response) => {
  const institutionType = validInstitutionTypeOrThrow(req.params?.institutionType);

  const [
    school,
    activeTermCount,
    feeStructureCount,
    usersCount,
    streamCount,
    classCount,
    learningAreaCount,
    gradingRangeCount,
    departmentCount,
    programCount,
    unitCount,
  ] = await Promise.all([
    prisma.school.findFirst({
      where: { archived: false },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { name: true, motto: true, phone: true, email: true, address: true, logoUrl: true }
    }),
    prisma.termConfig.count({ where: { isActive: true } }),
    prisma.feeStructure.count({ where: { archived: false } as any }),
    prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' }, archived: false } as any }),
    prisma.stream.count({ where: { archived: false } }),
    prisma.class.count({ where: { archived: false, institutionType: institutionType as any } }),
    prisma.learningArea.count({ where: { institutionType: institutionType as any } }),
    prisma.gradingRange.count({ where: { archived: false } as any }),
    prisma.tertiaryDepartment.count(),
    prisma.tertiaryProgram.count(),
    prisma.tertiaryUnit.count(),
  ]);

  const commonItems = [
    {
      key: 'school_profile',
      label: 'School profile configured',
      current: school?.name ? 1 : 0,
      target: 1,
      note: 'School name is required.'
    },
    {
      key: 'active_term',
      label: 'Active term configured',
      current: activeTermCount,
      target: 1,
      note: 'At least one active academic term.'
    },
    {
      key: 'fee_structure',
      label: 'Fee structure available',
      current: feeStructureCount,
      target: 1,
      note: 'At least one fee structure is recommended before admissions.'
    },
    {
      key: 'users',
      label: 'Operational users added',
      current: usersCount,
      target: 1,
      note: 'At least one non-super-admin user.'
    },
  ];

  const institutionItems = institutionType === 'TERTIARY'
    ? [
      { key: 'departments', label: 'Departments configured', current: departmentCount, target: 1, note: 'Add at least one department.' },
      { key: 'programs', label: 'Programs configured', current: programCount, target: 1, note: 'Add at least one program.' },
      { key: 'units', label: 'Units configured', current: unitCount, target: 1, note: 'Add at least one unit.' },
    ]
    : [
      { key: 'streams', label: 'Streams configured', current: streamCount, target: 1, note: 'Add at least one stream.' },
      { key: 'classes', label: 'Classes configured', current: classCount, target: 1, note: 'Add at least one class.' },
      { key: 'learning_areas', label: 'Learning areas configured', current: learningAreaCount, target: 1, note: 'Add at least one learning area.' },
      { key: 'grading', label: 'Grading ranges configured', current: gradingRangeCount, target: 1, note: 'Add at least one grading range.' },
    ];

  const items = [...commonItems, ...institutionItems].map(item => ({
    ...item,
    completed: item.current >= item.target
  }));

  const completedItems = items.filter(i => i.completed).length;
  const totalItems = items.length;
  const percent = Math.round((completedItems / totalItems) * 100);

  res.json({
    success: true,
    data: {
      institutionType,
      summary: {
        completed: completedItems,
        total: totalItems,
        percent,
      },
      items,
      nextSteps: items.filter(i => !i.completed).map(i => i.label),
    }
  });
};

export const resetWholeInstitution = async (req: AuthRequest, res: Response) => {
  const { confirmToken } = req.body || {};
  if (confirmToken !== 'RESET_WHOLE_INSTITUTION') {
    throw new ApiError(400, 'Invalid confirmation token for institution reset');
  }

  const school = await prisma.school.findFirst({
    where: { archived: false },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, name: true }
  });
  if (!school) throw new ApiError(404, 'School not found');

  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true }
  });
  if (superAdmins.length === 0) {
    throw new ApiError(400, 'At least one SUPER_ADMIN is required before reset');
  }

  const keepTables = new Set(['_prisma_migrations', 'users', 'schools', 'apps']);
  const superAdminIds = superAdmins.map(u => u.id);

  await prisma.$transaction(async (tx) => {
    // Truncate all business/operational tables first while preserving core bootstrap tables.
    // This avoids FK RESTRICT failures (e.g. attendances.markedBy -> users.id).
    const tables = await tx.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    const toTruncate = tables
      .map(t => t.table_name)
      .filter(tableName => !keepTables.has(tableName));

    if (toTruncate.length > 0) {
      const quoted = toTruncate.map(tableName => `"${tableName}"`).join(', ');
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
    }

    // Remove all non-super-admin accounts after dependent tables are cleared.
    await tx.user.deleteMany({
      where: { id: { notIn: superAdminIds } }
    });

    // Keep super-admins usable immediately after reset.
    await tx.user.updateMany({
      where: { id: { in: superAdminIds } },
      data: { status: 'ACTIVE', loginAttempts: 0, lockedUntil: null }
    });

    // Return school context to fresh-setup mode so super-admin can choose institution type again.
    await tx.school.update({
      where: { id: school.id },
      data: {
        active: true,
        status: 'ACTIVE',
        institutionType: 'PRIMARY_CBC' as any,
        institutionTypeLocked: false
      }
    });
  });

  res.json({
    success: true,
    message: 'Institution reset complete. Super admin retained. Please log in again to configure institution type.',
    data: {
      schoolId: school.id,
      schoolName: school.name,
      preservedSuperAdmins: superAdminIds.length
    }
  });
};

export const createSchoolWithProvisioning = async (req: AuthRequest, res: Response) => {
  const existing = await resolveCurrentSchool();
  if (existing) throw new ApiError(400, 'School already provisioned');

  const result = await provisionNewSchool(req.body);
  res.status(201).json({ success: true, message: 'Provisioned', data: result });
};

export const deleteSchool = async (req: AuthRequest, res: Response) => {
  const school = await resolveCurrentSchool();
  if (!school) throw new ApiError(404, 'School not found');

  const result = await deleteSchoolSafely(school.id, {
    hardDelete: req.query.permanent === 'true',
    deletedBy: req.user!.userId,
    reason: req.body.reason || 'Requested through API',
  });
  res.json({ success: true, data: result, message: 'School deletion processed' });
};

export const deactivateSchool = async (req: AuthRequest, res: Response) => {
  const school = await resolveCurrentSchool();
  if (!school) throw new ApiError(404, 'School not found');

  const updated = await prisma.school.update({
    where: { id: school.id },
    data: { active: false, status: 'DEACTIVATED' },
  });
  clearSchoolCache();
  res.json({ success: true, message: 'School deactivated', data: updated });
};

// ============================================
// ADMISSION SEQUENCE (Simplified)
// ============================================

export const getAdmissionSequence = async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.params.academicYear);
  const value = await getCurrentSequenceValue(year);
  res.json({ success: true, data: { academicYear: year, currentValue: value || 0 } });
};

export const getAdmissionNumberPreview = async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.params.academicYear);
  const preview = await getNextAdmissionNumberPreview('ADM', year);
  res.json({ success: true, data: { preview } });
};

export const resetAdmissionSequence = async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.body.academicYear);
  await resetSequence(year, 0);
  res.json({ success: true, message: 'Sequence reset' });
};
