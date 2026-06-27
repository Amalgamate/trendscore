import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/permissions.middleware';
import { ApiError } from '../utils/error.util';
import {
  applyModulePackageToSchool,
  listSchoolModules,
  normalizePackageId,
} from '../services/moduleCatalog.service';
import { clearSchoolCache } from '../middleware/schoolContext.middleware';
import logger from '../utils/logger';

const resolveCurrentSchool = async () => {
  const school = await prisma.school.findFirst({
    where: { archived: false },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
  });
  if (!school) throw new ApiError(404, 'School not found');
  return school;
};

const getUserId = (req: AuthRequest) => req.user?.userId || null;
const getRole = (req: AuthRequest) => String(req.user?.role || 'UNKNOWN');

export const getSchoolModules = async (_req: AuthRequest, res: Response) => {
  const school = await resolveCurrentSchool();
  const data = await listSchoolModules(school.id);
  res.status(200).json({ success: true, data });
};

export const applySchoolModulePackage = async (req: AuthRequest, res: Response) => {
  const school = await resolveCurrentSchool();
  const packageId = normalizePackageId(req.body?.packageId);

  const definition = await prisma.$transaction(async (tx) => (
    applyModulePackageToSchool(school.id, packageId, tx, getUserId(req))
  ));

  clearSchoolCache();
  const data = await listSchoolModules(school.id);
  logger.info(`[modules] Applied ${definition.name} package to ${school.name}`);
  res.status(200).json({ success: true, message: `${definition.name} package applied`, data });
};

export const updateSchoolModules = async (req: AuthRequest, res: Response) => {
  const school = await resolveCurrentSchool();
  const updates = Array.isArray(req.body?.modules) ? req.body.modules : [];
  if (updates.length === 0) throw new ApiError(400, 'No module updates provided');

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      const slug = String(update.slug || '').trim();
      if (!slug) continue;

      const existing = await tx.schoolAppConfig.findFirst({
        where: { schoolId: school.id, app: { slug } },
        include: { app: true },
      });

      if (!existing) throw new ApiError(404, `Module not found: ${slug}`);
      if (existing.isMandatory && update.isActive === false) {
        throw new ApiError(400, `${existing.app.name} is mandatory and cannot be disabled`);
      }

      const nextActive = typeof update.isActive === 'boolean' ? update.isActive : existing.isActive;
      const nextVisible = typeof update.isVisible === 'boolean' ? update.isVisible : existing.isVisible;

      await tx.schoolAppConfig.update({
        where: { id: existing.id },
        data: {
          isActive: nextActive,
          isVisible: nextVisible,
          updatedById: getUserId(req) || undefined,
        },
      });

      if (nextActive !== existing.isActive) {
        await tx.appAuditLog.create({
          data: {
            schoolId: school.id,
            appId: existing.appId,
            action: nextActive ? 'ACTIVATED' : 'DEACTIVATED',
            performedBy: getUserId(req) || existing.updatedById || '',
            roleAtTime: getRole(req),
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || null,
          },
        });
      }
    }
  });

  clearSchoolCache();
  const data = await listSchoolModules(school.id);
  res.status(200).json({ success: true, message: 'Module configuration updated', data });
};

