import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/permissions.middleware';
import { hasPermission, type Role } from '../config/permissions';
import { getCanonicalRoles, hasAnyRole } from '../utils/roleNormalizer';

/** Roles that author and manage notices (drafts, scheduled and archived included). */
const canManageNotices = (user: AuthRequest['user']) =>
  getCanonicalRoles(user).some((role) => hasPermission(role as Role, 'SEND_SCHOOL_NOTICES'));

/** Roles that may publish class-level diary entries (teachers, but not school-wide). */
const canPublishClassDiary = (user: AuthRequest['user']) =>
  getCanonicalRoles(user).some((role) => hasPermission(role as Role, 'PUBLISH_CLASS_DIARY'));

/**
 * Audience tokens a reader matches. A notice's targetAudience may be empty or
 * ALL (everyone) or a comma separated list of PARENTS, STUDENTS, TEACHERS, STAFF.
 */
const audienceTokensFor = (user: AuthRequest['user']) => {
  const roles = getCanonicalRoles(user) as string[];
  const tokens = new Set<string>(['ALL']);
  if (roles.includes('PARENT')) tokens.add('PARENTS');
  if (roles.includes('STUDENT')) tokens.add('STUDENTS');
  if (roles.includes('TEACHER')) tokens.add('TEACHERS');
  if (roles.some((role) => role !== 'PARENT' && role !== 'STUDENT')) tokens.add('STAFF');
  return tokens;
};

/** What a non-manager may see: published, already live, not expired, and aimed at them. */
const isNoticeVisibleTo = (notice: any, user: AuthRequest['user'], now: Date) => {
  if (String(notice.status || 'PUBLISHED').toUpperCase() !== 'PUBLISHED') return false;
  if (notice.archived) return false;
  if (notice.publishedAt && new Date(notice.publishedAt) > now) return false;
  if (notice.expiresAt && new Date(notice.expiresAt) <= now) return false;

  const audience = String(notice.targetAudience || '').trim();
  if (!audience) return true;
  const tokens = audienceTokensFor(user);
  return audience
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .some((part) => tokens.has(part));
};

/** Parents and students do not need to see staff email addresses. */
const withoutAuthorEmail = (notice: any) =>
  notice.createdBy
    ? { ...notice, createdBy: { id: notice.createdBy.id, firstName: notice.createdBy.firstName, lastName: notice.createdBy.lastName } }
    : notice;



export class NoticeController {
  async getNotices(req: AuthRequest, res: Response) {
    try {

      const { status, category, includeArchived } = req.query;
      const isManager = canManageNotices(req.user);
      const isDiaryPublisher = canPublishClassDiary(req.user);
      const userId = req.user?.userId;
      const now = new Date();
      const notices = await prisma.notice.findMany({
        where: {
          ...(includeArchived === 'true' && (isManager || isDiaryPublisher) ? {} : { archived: false }),
          ...(status && (isManager || isDiaryPublisher) ? { status: String(status) } : {}),
          ...(category ? { category: String(category) } : {})
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }]
      });

      const visibleNotices = isManager
        ? notices
        : isDiaryPublisher
          ? notices.filter((notice) =>
              notice.createdById === userId || isNoticeVisibleTo(notice, req.user, now)
            ).map(withoutAuthorEmail)
          : notices.filter((notice) => isNoticeVisibleTo(notice, req.user, now)).map(withoutAuthorEmail);

      return res.json({ success: true, data: visibleNotices });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch notices' });
    }
  }

  async getNoticeById(req: AuthRequest, res: Response) {
    try {

      const notice = await prisma.notice.findFirst({
        where: {
          id: req.params.id,
          archived: false
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      if (!notice) {
        return res.status(404).json({ success: false, error: 'Notice not found' });
      }

      if (!canManageNotices(req.user)) {
        const isAuthor = notice.createdById === req.user?.userId;
        if (!isAuthor && !isNoticeVisibleTo(notice, req.user, new Date())) {
          return res.status(404).json({ success: false, error: 'Notice not found' });
        }
        return res.json({ success: true, data: withoutAuthorEmail(notice) });
      }

      return res.json({ success: true, data: notice });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch notice' });
    }
  }

  async createNotice(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(403).json({ success: false, error: 'Authentication required' });
      }

      const { title, content, category, priority, status, targetAudience, publishedAt, expiresAt } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, error: 'title and content are required' });
      }

      // Teachers may only post class-level diary entries targeting parents or
      // students. School-wide audiences (ALL, STAFF, TEACHERS) are reserved for
      // roles holding SEND_SCHOOL_NOTICES.
      const isSchoolNoticeManager = canManageNotices(req.user);
      const audience = String(targetAudience || '').trim().toUpperCase();
      if (!isSchoolNoticeManager && audience) {
        const allowed = audience.split(',').map((t) => t.trim()).filter(Boolean);
        const forbidden = allowed.some((t) => ['ALL', 'STAFF', 'TEACHERS'].includes(t.toUpperCase()));
        if (forbidden) {
          return res.status(403).json({
            success: false,
            error: 'Teachers can only publish diary entries to parents or students, not school-wide audiences.',
          });
        }
      }

      const notice = await prisma.notice.create({
        data: {
          createdById: userId,
          title,
          content,
          category: category || null,
          priority: priority || 'NORMAL',
          status: status || 'PUBLISHED',
          targetAudience: targetAudience || null,
          publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });

      return res.status(201).json({ success: true, message: 'Notice created', data: notice });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to create notice' });
    }
  }

  async updateNotice(req: AuthRequest, res: Response) {
    try {

      const existing = await prisma.notice.findFirst({ where: { id: req.params.id, archived: false } });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Notice not found' });
      }

      const { title, content, category, priority, status, targetAudience, publishedAt, expiresAt } = req.body;
      const updated = await prisma.notice.update({
        where: { id: req.params.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(targetAudience !== undefined ? { targetAudience } : {}),
          ...(publishedAt ? { publishedAt: new Date(publishedAt) } : {}),
          ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {})
        }
      });

      return res.json({ success: true, message: 'Notice updated', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to update notice' });
    }
  }

  async deleteNotice(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      if (!userId) {
        return res.status(403).json({ success: false, error: 'Authentication required' });
      }

      const existing = await prisma.notice.findFirst({
        where: { id: req.params.id, archived: false },
        include: {
          createdBy: {
            select: {
              role: true
            }
          }
        }
      });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Notice not found' });
      }

      const isOwner = existing.createdById === userId;
      const isSchoolAdmin = hasAnyRole(req.user, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);
      const isSystemAdminOwner = isOwner && userRole === 'SUPER_ADMIN';

      // Authors can archive their own notices; school admins can archive any
      // notice (e.g. one posted by a staff member who has since left).
      if (!isOwner && !isSchoolAdmin) {
        return res.status(403).json({ success: false, error: 'You can only archive your own notices' });
      }

      if (isSystemAdminOwner) {
        await prisma.notice.delete({
          where: { id: req.params.id }
        });

        return res.json({ success: true, message: 'Notice deleted permanently' });
      }

      await prisma.notice.update({
        where: { id: req.params.id },
        data: { archived: true, archivedAt: new Date(), archivedBy: userId }
      });

      return res.json({ success: true, message: 'Notice archived' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to delete notice' });
    }
  }
}

export const noticeController = new NoticeController();