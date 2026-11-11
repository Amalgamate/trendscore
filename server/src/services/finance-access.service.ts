import type { AuthRequest } from '../middleware/permissions.middleware';
import { ApiError } from '../utils/error.util';
import prisma from '../config/database';
import { parentAccessService } from './parent-access.service';
import type { FeeInvoice } from '@prisma/client';
import { getCanonicalRoles } from '../utils/roleNormalizer';
import { hasPermission } from '../config/permissions';
import type { NextFunction, Response } from 'express';

type FeeScope = Pick<FeeInvoice, 'id' | 'learnerId'>;

const hasRolePermission = (req: AuthRequest, permission: Parameters<typeof hasPermission>[1]) =>
  getCanonicalRoles(req.user).some((role) => hasPermission(role, permission));

async function teacherHasLearnerAssignment(teacherId: string, learnerId: string): Promise<boolean> {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      learnerId,
      active: true,
      archived: false,
      class: {
        active: true,
        archived: false,
        OR: [
          { teacherId },
          { teacherAssignments: { some: { teacherId } } },
        ],
      },
    },
    select: { id: true },
  });
  return Boolean(enrollment);
}

/** Enforce record-level access before returning an invoice or learner fee record. */
export async function assertCanViewFeeRecord(req: AuthRequest, record: FeeScope): Promise<void> {
  const userId = req.user?.userId;
  const roles = getCanonicalRoles(req.user);
  if (!userId || roles.length === 0) {
    throw new ApiError(401, 'Sign in to view this fee information.').withCode('AUTH_REQUIRED');
  }

  if (hasRolePermission(req, 'VIEW_ALL_BALANCES') || hasRolePermission(req, 'VIEW_FEE_INVOICE')) return;
  // Cashiers can retrieve the selected learner's limited invoice list only via
  // the payment workflow route, which separately requires RECORD_PAYMENT.
  if (req.path?.startsWith('/fees/cashier/learners/') &&
      hasRolePermission(req, 'RECORD_PAYMENT')) return;
  if (roles.includes('TEACHER') && hasRolePermission(req, 'VIEW_ASSIGNED_FEE_INFO') &&
      await teacherHasLearnerAssignment(userId, record.learnerId)) return;
  if (roles.includes('PARENT') && hasRolePermission(req, 'VIEW_OWN_BALANCE') &&
      await parentAccessService.canAccessLearner(userId, record.learnerId)) return;

  throw new ApiError(403, 'You do not have access to this learner’s fee information.')
    .withCode('FEE_RECORD_FORBIDDEN');
}

/** Learner-ID route middleware for fee statements/invoice lists. */
export function requireLearnerFeeAccess(req: AuthRequest, _res: Response, next: NextFunction): void {
  const learnerId = req.params.learnerId || req.params.id || req.body?.learnerId || req.query.learnerId;
  if (!learnerId) {
    next(new ApiError(400, 'Choose a learner to view fee information.').withCode('LEARNER_REQUIRED'));
    return;
  }
  void assertCanViewFeeRecord(req, { id: '', learnerId: String(learnerId) })
    .then(() => next())
    .catch(next);
}

/** Enforce learner-level scope for parent payments and payment status checks. */
export async function assertCanAccessInvoicePayment(
  req: AuthRequest,
  invoice: Pick<FeeInvoice, 'id' | 'learnerId'>,
): Promise<void> {
  const userId = req.user?.userId;
  const roles = getCanonicalRoles(req.user);
  if (!userId || roles.length === 0) {
    throw new ApiError(401, 'Sign in to continue with this payment.').withCode('AUTH_REQUIRED');
  }

  const canRecordPayments = roles.some((role) => hasPermission(role, 'RECORD_PAYMENT'));
  if (canRecordPayments) return;

  const isParent = roles.includes('PARENT');
  if (isParent && await parentAccessService.canAccessLearner(userId, invoice.learnerId)) return;

  throw new ApiError(403, 'This fee account is not linked to your family.').withCode('ROLE_FORBIDDEN');
}
