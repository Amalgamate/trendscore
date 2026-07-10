import { Response, NextFunction } from 'express';
import { AuthRequest } from './permissions.middleware';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { isStarterLikeActiveSlugs } from '../services/moduleCatalog.service';

export const requireApp = (slug: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const fallbackSchool = !req.school?.id
        ? await prisma.school.findFirst({
            where: { archived: false },
            orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
            select: { id: true },
          })
        : null;
      const schoolId = req.school?.id || fallbackSchool?.id;

      if (!schoolId) return next();

      const configCount = await prisma.schoolAppConfig.count({ where: { schoolId } });
      if (configCount === 0) return next();

      const config = await prisma.schoolAppConfig.findFirst({
        where: { schoolId, app: { slug } },
        include: { app: true },
      });

      if (!config) return next();
      if (slug === 'fee-management') {
        const activeConfigs = await prisma.schoolAppConfig.findMany({
          where: { schoolId, isActive: true, isVisible: true },
          select: { app: { select: { slug: true } } },
        });
        const activeSlugs = activeConfigs.map((item) => item.app.slug);
        if (isStarterLikeActiveSlugs(activeSlugs)) {
          return next(
            new ApiError(403, 'Fees & Billing is not available on the Starter package').withCode('APP_DISABLED')
          );
        }
      }
      if (config.isActive && config.isVisible) return next();

      return next(
        new ApiError(403, `${config.app.name} is disabled for this school`).withCode('APP_DISABLED')
      );
    } catch (error) {
      next(error);
    }
  };
};
