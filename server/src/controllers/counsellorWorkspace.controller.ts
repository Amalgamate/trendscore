import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  createCounsellingSession,
  createCounsellorActionItem,
  createPathwayIntervention,
  bulkUpdatePathwayInterventions,
  escalatePathwayIntervention,
  getCounsellorCaseManagement,
  getPathwayInterventionQueue,
  getCounsellorWorkspaceReport,
  updateCounsellingSession,
  updateCounsellorActionItem,
  updatePathwayIntervention,
} from '../services/counsellor-workspace.service';
import { ApiError } from '../utils/error.util';
import prisma from '../config/database';
import { NotificationService, NotificationType } from '../services/notification.service';

function actorId(req: AuthRequest): string {
  const id = req.user?.userId;
  if (!id) throw new ApiError(401, 'Authentication required');
  return id;
}

async function notifyFamily(
  learnerId: string,
  title: string,
  message: string,
  audience: { student?: boolean; parent?: boolean } = { student: true, parent: true },
) {
  try {
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { admissionNumber: true, parentId: true },
    });
    if (!learner) return;
    const student = audience.student && learner.admissionNumber
      ? await prisma.user.findUnique({
          where: { username: learner.admissionNumber },
          select: { id: true },
        })
      : null;
    const recipients = new Set<string>();
    if (student?.id) recipients.add(student.id);
    if (audience.parent && learner.parentId) recipients.add(learner.parentId);
    await Promise.allSettled([...recipients].map(userId =>
      NotificationService.createNotification({
        userId,
        title,
        message,
        type: NotificationType.INFO,
        link: '/app/student-pathway-planner',
      })
    ));
  } catch {
    // Case-management writes remain authoritative if a delivery channel is unavailable.
  }
}

async function notifyAdministrators(title: string, message: string, learnerId: string) {
  try {
    const administrators = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'] },
        status: 'ACTIVE',
        archived: false,
      },
      select: { id: true },
    });
    await Promise.allSettled(administrators.map(({ id: userId }) =>
      NotificationService.createNotification({
        userId,
        title,
        message,
        type: NotificationType.WARNING,
        link: '/app/sec-pathway-counsellor',
        showAsPopup: true,
        metadata: { learnerId, event: 'PATHWAY_CASE_ESCALATED' },
      })
    ));
  } catch {
    // Escalation remains recorded and auditable if notification delivery fails.
  }
}

export const counsellorWorkspaceController = {
  getCaseManagement: async (req: AuthRequest, res: Response) => {
    const data = await getCounsellorCaseManagement(req.params.learnerId);
    res.json({ success: true, data });
  },

  getParticipantProgress: async (req: AuthRequest, res: Response) => {
    const role = String(req.user?.role || '').toUpperCase();
    const sharedVisibility = role === 'PARENT' ? 'SHARED_WITH_PARENT' : 'SHARED_WITH_STUDENT';
    const [sessions, interventions] = await Promise.all([
      prisma.counsellingSession.findMany({
        where: { learnerId: req.params.learnerId, visibility: sharedVisibility },
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        select: { id: true, scheduledAt: true, durationMinutes: true, mode: true, status: true, priority: true, reason: true, location: true, onlineLink: true, purpose: true, outcomeSummary: true, nextActions: true, followUpAt: true, counsellor: { select: { firstName: true, lastName: true } } },
      }),
      prisma.pathwayIntervention.findMany({
        where: { learnerId: req.params.learnerId },
        orderBy: [{ resolvedAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        select: { id: true, interventionType: true, priority: true, status: true, summary: true, dueDate: true, resolvedAt: true, assignedCounsellor: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    res.json({ success: true, data: { sessions, interventions } });
  },

  createAction: async (req: AuthRequest, res: Response) => {
    const data = await createCounsellorActionItem({
      learnerId: req.params.learnerId,
      actorId: actorId(req),
      ...req.body,
    });
    const assignedRole = String(data.assignedToRole || '').toUpperCase();
    if (assignedRole !== 'COUNSELLOR') {
      await notifyFamily(
        req.params.learnerId,
        'New pathway action',
        data.title,
        { student: assignedRole === 'STUDENT', parent: assignedRole === 'PARENT' },
      );
    }
    res.status(201).json({ success: true, data });
  },

  updateAction: async (req: AuthRequest, res: Response) => {
    const data = await updateCounsellorActionItem({
      learnerId: req.params.learnerId,
      actionId: req.params.actionId,
      ...req.body,
    });
    res.json({ success: true, data });
  },

  updateOwnAction: async (req: AuthRequest, res: Response) => {
    const role = req.user?.role === 'PARENT' ? 'PARENT' : 'STUDENT';
    const item = await prisma.actionItem.findUnique({
      where: { id: req.params.actionId },
      include: { actionPlan: { select: { learnerId: true } } },
    });
    if (!item || item.actionPlan.learnerId !== req.params.learnerId) throw new ApiError(404, 'Action item not found');
    if (item.assignedToRole !== role) throw new ApiError(403, 'This action is assigned to another participant');
    const status = String(req.body?.status ?? '').toUpperCase();
    if (!['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)) throw new ApiError(400, 'Invalid action status');
    const data = await updateCounsellorActionItem({
      learnerId: req.params.learnerId,
      actionId: req.params.actionId,
      status,
      completionNote: req.body?.completionNote,
    });
    res.json({ success: true, data });
  },

  createSession: async (req: AuthRequest, res: Response) => {
    const data = await createCounsellingSession({
      learnerId: req.params.learnerId,
      actorId: actorId(req),
      ...req.body,
    });
    await notifyFamily(
      req.params.learnerId,
      'Counselling session scheduled',
      data.scheduledAt
        ? `A pathway counselling session is scheduled for ${data.scheduledAt.toLocaleString('en-GB')}.`
        : 'A pathway counselling session has been requested.',
    );
    res.status(201).json({ success: true, data });
  },

  updateSession: async (req: AuthRequest, res: Response) => {
    const data = await updateCounsellingSession({
      learnerId: req.params.learnerId,
      sessionId: req.params.sessionId,
      ...req.body,
    });
    res.json({ success: true, data });
  },

  createIntervention: async (req: AuthRequest, res: Response) => {
    const data = await createPathwayIntervention({
      learnerId: req.params.learnerId,
      actorId: actorId(req),
      ...req.body,
    });
    res.status(201).json({ success: true, data });
  },

  getInterventionQueue: async (req: AuthRequest, res: Response) => {
    const data = await getPathwayInterventionQueue({
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      interventionType: req.query.interventionType as string | undefined,
      assignedCounsellorId: req.query.assignedCounsellorId as string | undefined,
      grade: req.query.grade as string | undefined,
      search: req.query.search as string | undefined,
      escalated: req.query.escalated as string | undefined,
    });
    res.json({ success: true, data });
  },

  bulkUpdateInterventions: async (req: AuthRequest, res: Response) => {
    const data = await bulkUpdatePathwayInterventions(req.body || {});
    res.json({ success: true, data });
  },

  escalate: async (req: AuthRequest, res: Response) => {
    const data = await escalatePathwayIntervention({
      learnerId: req.params.learnerId,
      interventionId: req.body?.interventionId,
      actorId: actorId(req),
      reason: req.body?.reason,
      summary: req.body?.summary,
    });
    await notifyAdministrators(
      'Pathway case escalated',
      `${data.learner.firstName} ${data.learner.lastName}: ${data.escalationReason}`,
      req.params.learnerId,
    );
    res.status(201).json({ success: true, data });
  },

  updateIntervention: async (req: AuthRequest, res: Response) => {
    const data = await updatePathwayIntervention({
      learnerId: req.params.learnerId,
      interventionId: req.params.interventionId,
      ...req.body,
    });
    res.json({ success: true, data });
  },

  getReport: async (_req: AuthRequest, res: Response) => {
    const data = await getCounsellorWorkspaceReport();
    res.json({ success: true, data });
  },
};
