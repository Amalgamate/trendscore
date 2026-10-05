import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { requirePermission } from '../middleware/permissions.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { ApiError } from '../utils/error.util';

const router = Router();

// `authenticate` is applied globally in routes/index.ts before the protected
// section; this router is mounted there, so it must NOT re-apply it.
const guard = requirePermission('MANAGE_TRANSPORT_TRIPS');

async function deleteRevokedDevices(schoolId: string, ids: string[]) {
  return prisma.$transaction(async (tx) => {
    const matching = await tx.driverDevice.findMany({
      where: { schoolId, id: { in: ids }, status: 'REVOKED' },
      select: { id: true },
    });

    // Reject the whole request if any id is missing, belongs to another school,
    // or is not revoked. Never partially remove active/pending device records.
    if (matching.length !== ids.length) {
      throw new ApiError(409, 'Only revoked devices from this school can be deleted. Refresh the list and try again.');
    }

    const result = await tx.driverDevice.deleteMany({
      where: { schoolId, id: { in: ids }, status: 'REVOKED' },
    });
    if (result.count !== ids.length) {
      throw new ApiError(409, 'A device changed while deleting. Refresh the list and try again.');
    }
    return result.count;
  });
}

/**
 * Office-facing driver device management (AUTHENTICATED — the other half of
 * the public /driver-connection routes).
 *
 * Without this there is no way to approve a phone: the public routes can
 * register and poll, but only a school administrator may flip APPROVED.
 */

// ── List devices, optionally filtered by status ─────────────────────────────
router.get(
  '/',
  guard,
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  async (req: Request, res: Response, next) => {
    try {
      const schoolId = (req as any).school?.id;
      if (!schoolId) throw new ApiError(400, 'No school resolved for this request.');

      const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
      if (status && !['PENDING', 'APPROVED', 'REVOKED'].includes(status)) {
        throw new ApiError(400, 'status must be PENDING, APPROVED or REVOKED.');
      }

      const devices = await prisma.driverDevice.findMany({
        where: { schoolId, ...(status ? { status } : {}) },
        orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
        select: {
          id: true, deviceId: true, label: true, status: true,
          requestedAt: true, approvedAt: true, approvedBy: true,
          revokedAt: true, lastSeenAt: true,
        },
      });

      res.json({ success: true, data: devices });
    } catch (err) {
      next(err);
    }
  },
);

// ── Permanently delete revoked device records ───────────────────────────────
router.delete(
  '/',
  guard,
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  async (req: Request, res: Response, next) => {
    try {
      const schoolId = (req as any).school?.id;
      if (!schoolId) throw new ApiError(400, 'No school resolved for this request.');

      const rawIds = req.body?.ids;
      if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 200) {
        throw new ApiError(400, 'Provide between 1 and 200 device ids to delete.');
      }
      if (rawIds.some((id: unknown) => typeof id !== 'string' || !id.trim())) {
        throw new ApiError(400, 'Every device id must be a non-empty string.');
      }
      const ids = [...new Set((rawIds as string[]).map((id) => id.trim()))];
      if (ids.length !== rawIds.length) throw new ApiError(400, 'Device ids must be unique.');

      const deletedCount = await deleteRevokedDevices(schoolId, ids);
      res.json({ success: true, data: { deletedCount } });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  guard,
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  async (req: Request, res: Response, next) => {
    try {
      const schoolId = (req as any).school?.id;
      if (!schoolId) throw new ApiError(400, 'No school resolved for this request.');

      const deletedCount = await deleteRevokedDevices(schoolId, [req.params.id]);
      res.json({ success: true, data: { deletedCount } });
    } catch (err) {
      next(err);
    }
  },
);

// ── Approve ─────────────────────────────────────────────────────────────────
router.post(
  '/:id/approve',
  guard,
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  async (req: Request, res: Response, next) => {
    try {
      const schoolId = (req as any).school?.id;
      if (!schoolId) throw new ApiError(400, 'No school resolved for this request.');

      // Scoped by schoolId so an id from another tenant cannot be approved.
      const device = await prisma.driverDevice.findFirst({ where: { id: req.params.id, schoolId } });
      if (!device) throw new ApiError(404, 'That device was not found for this school.');

      const updated = await prisma.driverDevice.update({
        where: { id: device.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: (req as any).user?.userId ?? null,
          revokedAt: null,
        },
        select: { id: true, deviceId: true, status: true, approvedAt: true },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ── Revoke ──────────────────────────────────────────────────────────────────
router.post(
  '/:id/revoke',
  guard,
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  async (req: Request, res: Response, next) => {
    try {
      const schoolId = (req as any).school?.id;
      if (!schoolId) throw new ApiError(400, 'No school resolved for this request.');

      const device = await prisma.driverDevice.findFirst({ where: { id: req.params.id, schoolId } });
      if (!device) throw new ApiError(404, 'That device was not found for this school.');

      const updated = await prisma.driverDevice.update({
        where: { id: device.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
        select: { id: true, deviceId: true, status: true, revokedAt: true },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
