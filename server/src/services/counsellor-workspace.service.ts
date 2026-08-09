import { Prisma, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

const ACTION_ROLES = ['STUDENT', 'PARENT', 'COUNSELLOR'];
const ACTION_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const PRIORITIES = ['LOW', 'NORMAL', 'MEDIUM', 'HIGH', 'URGENT'];
const SESSION_MODES = ['IN_PERSON', 'VIRTUAL', 'PHONE'];
const SESSION_STATUSES = [
  'REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'FOLLOW_UP_REQUIRED',
];
const VISIBILITIES = [
  'COUNSELLOR_ONLY', 'SHARED_WITH_STUDENT', 'SHARED_WITH_PARENT', 'SCHOOL_TEAM_VISIBLE',
];
const INTERVENTION_STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CANCELLED'];
const INTERVENTION_TYPES = [
  'LOW_CONFIDENCE',
  'ACADEMIC_MISMATCH',
  'INTEREST_MISMATCH',
  'PARENT_STUDENT_CONFLICT',
  'NO_VALID_COMBINATION',
  'NO_ELIGIBLE_SCHOOL',
  'INCOMPLETE_ASSESSMENT',
  'REPEATED_INDECISION',
  'MISSED_DEADLINE',
  'SUPPORT_NEED',
];
const COUNSELLOR_ROLES: UserRole[] = [
  UserRole.HEAD_OF_CURRICULUM,
  UserRole.HEAD_TEACHER,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];

function requiredText(value: unknown, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new ApiError(422, `${label} is required`);
  return normalized;
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function enumValue(value: unknown, allowed: string[], label: string, fallback?: string): string {
  const normalized = String(value ?? fallback ?? '').trim().toUpperCase();
  if (!allowed.includes(normalized)) {
    throw new ApiError(422, `${label} must be one of: ${allowed.join(', ')}`);
  }
  return normalized;
}

function optionalDate(value: unknown, label: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new ApiError(422, `${label} is invalid`);
  return parsed;
}

async function assertLearnerExists(learnerId: string) {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: { id: true },
  });
  if (!learner) throw new ApiError(404, 'Learner not found');
}

export async function getCounsellorCaseManagement(learnerId: string) {
  await assertLearnerExists(learnerId);
  const [actionPlan, sessions, interventions] = await Promise.all([
    prisma.learnerActionPlan.findUnique({
      where: { learnerId },
      include: { items: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] } },
    }),
    prisma.counsellingSession.findMany({
      where: { learnerId },
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        counsellor: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.pathwayIntervention.findMany({
      where: { learnerId },
      orderBy: [{ resolvedAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        assignedCounsellor: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);
  return { actionPlan, sessions, interventions };
}

export async function createCounsellorActionItem(params: {
  learnerId: string;
  actorId: string;
  title?: string;
  description?: string;
  assignedToRole?: string;
  priority?: string;
  category?: string;
  dueDate?: string | null;
}) {
  await assertLearnerExists(params.learnerId);
  const decisionPlan = await prisma.decisionPlan.findUnique({
    where: { learnerId: params.learnerId },
    select: { id: true },
  });
  const actionPlan = await prisma.learnerActionPlan.upsert({
    where: { learnerId: params.learnerId },
    create: {
      learnerId: params.learnerId,
      decisionPlanId: decisionPlan?.id,
    },
    update: decisionPlan ? { decisionPlanId: decisionPlan.id } : {},
  });
  return prisma.actionItem.create({
    data: {
      actionPlanId: actionPlan.id,
      title: requiredText(params.title, 'Action title'),
      description: optionalText(params.description),
      assignedToRole: enumValue(params.assignedToRole, ACTION_ROLES, 'Assigned role', 'STUDENT'),
      priority: enumValue(params.priority, PRIORITIES, 'Priority', 'NORMAL'),
      category: optionalText(params.category),
      dueDate: optionalDate(params.dueDate, 'Due date'),
      createdById: params.actorId,
    },
  });
}

export async function updateCounsellorActionItem(params: {
  learnerId: string;
  actionId: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  completionNote?: string;
}) {
  const item = await prisma.actionItem.findUnique({
    where: { id: params.actionId },
    include: { actionPlan: { select: { learnerId: true } } },
  });
  if (!item || item.actionPlan.learnerId !== params.learnerId) {
    throw new ApiError(404, 'Action item not found');
  }
  const status = params.status === undefined
    ? undefined
    : enumValue(params.status, ACTION_STATUSES, 'Action status');
  return prisma.actionItem.update({
    where: { id: params.actionId },
    data: {
      status,
      priority: params.priority === undefined
        ? undefined
        : enumValue(params.priority, PRIORITIES, 'Priority'),
      dueDate: optionalDate(params.dueDate, 'Due date'),
      completionNote: optionalText(params.completionNote),
      completedAt: status === 'COMPLETED' ? new Date() : status ? null : undefined,
    },
  });
}

export async function createCounsellingSession(params: {
  learnerId: string;
  actorId: string;
  scheduledAt?: string | null;
  durationMinutes?: number;
  mode?: string;
  priority?: string;
  reason?: string;
  purpose?: string;
  location?: string;
  onlineLink?: string;
  parentParticipants?: string[];
  visibility?: string;
}) {
  await assertLearnerExists(params.learnerId);
  const duration = Number(params.durationMinutes ?? 30);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    throw new ApiError(422, 'Session duration must be between 5 and 480 minutes');
  }
  return prisma.counsellingSession.create({
    data: {
      learnerId: params.learnerId,
      counsellorId: params.actorId,
      scheduledAt: optionalDate(params.scheduledAt, 'Scheduled date'),
      durationMinutes: duration,
      mode: enumValue(params.mode, SESSION_MODES, 'Session mode', 'IN_PERSON'),
      status: 'SCHEDULED',
      priority: enumValue(params.priority, PRIORITIES, 'Priority', 'MEDIUM'),
      reason: optionalText(params.reason),
      purpose: requiredText(params.purpose ?? params.reason, 'Session purpose'),
      location: optionalText(params.location),
      onlineLink: optionalText(params.onlineLink),
      parentParticipants: Array.isArray(params.parentParticipants)
        ? params.parentParticipants.map(item => String(item).trim()).filter(Boolean)
        : [],
      visibility: enumValue(params.visibility, VISIBILITIES, 'Visibility', 'COUNSELLOR_ONLY'),
    },
    include: { counsellor: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function updateCounsellingSession(params: {
  learnerId: string;
  sessionId: string;
  status?: string;
  scheduledAt?: string | null;
  outcomeSummary?: string;
  nextActions?: string;
  followUpAt?: string | null;
  notes?: string;
}) {
  const session = await prisma.counsellingSession.findUnique({
    where: { id: params.sessionId },
    select: { learnerId: true },
  });
  if (!session || session.learnerId !== params.learnerId) {
    throw new ApiError(404, 'Counselling session not found');
  }
  const status = params.status === undefined
    ? undefined
    : enumValue(params.status, SESSION_STATUSES, 'Session status');
  if (status === 'COMPLETED' && !String(params.outcomeSummary ?? '').trim()) {
    throw new ApiError(422, 'Outcome summary is required to complete a session');
  }
  return prisma.counsellingSession.update({
    where: { id: params.sessionId },
    data: {
      status,
      scheduledAt: optionalDate(params.scheduledAt, 'Scheduled date'),
      outcomeSummary: optionalText(params.outcomeSummary),
      nextActions: optionalText(params.nextActions),
      followUpAt: optionalDate(params.followUpAt, 'Follow-up date'),
      notes: optionalText(params.notes),
      resolvedAt: ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status || '') ? new Date() : undefined,
    },
    include: { counsellor: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function createPathwayIntervention(params: {
  learnerId: string;
  actorId: string;
  interventionType?: string;
  priority?: string;
  summary?: string;
  dueDate?: string | null;
  assignedCounsellorId?: string | null;
}) {
  await assertLearnerExists(params.learnerId);
  return prisma.pathwayIntervention.create({
    data: {
      learnerId: params.learnerId,
      interventionType: enumValue(params.interventionType, INTERVENTION_TYPES, 'Intervention type'),
      priority: enumValue(params.priority, PRIORITIES, 'Priority', 'NORMAL'),
      summary: requiredText(params.summary, 'Intervention summary'),
      dueDate: optionalDate(params.dueDate, 'Due date'),
      assignedCounsellorId: optionalText(params.assignedCounsellorId) ?? params.actorId,
      createdById: params.actorId,
    },
    include: { assignedCounsellor: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function updatePathwayIntervention(params: {
  learnerId: string;
  interventionId: string;
  status?: string;
  priority?: string;
  outcome?: string;
  resolutionNotes?: string;
  dueDate?: string | null;
}) {
  const intervention = await prisma.pathwayIntervention.findUnique({
    where: { id: params.interventionId },
    select: { learnerId: true },
  });
  if (!intervention || intervention.learnerId !== params.learnerId) {
    throw new ApiError(404, 'Pathway intervention not found');
  }
  const status = params.status === undefined
    ? undefined
    : enumValue(params.status, INTERVENTION_STATUSES, 'Intervention status');
  if (status === 'ESCALATED') {
    throw new ApiError(422, 'Use the escalation action so a reason and administrator notification are recorded');
  }
  if (status === 'RESOLVED' && !String(params.outcome ?? '').trim()) {
    throw new ApiError(422, 'Intervention outcome is required when resolving a case');
  }
  return prisma.pathwayIntervention.update({
    where: { id: params.interventionId },
    data: {
      status,
      priority: params.priority === undefined
        ? undefined
        : enumValue(params.priority, PRIORITIES, 'Priority'),
      outcome: optionalText(params.outcome),
      resolutionNotes: optionalText(params.resolutionNotes),
      dueDate: optionalDate(params.dueDate, 'Due date'),
      resolvedAt: status === 'RESOLVED' ? new Date() : status ? null : undefined,
    },
    include: { assignedCounsellor: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function getPathwayInterventionQueue(filters: {
  status?: string;
  priority?: string;
  interventionType?: string;
  assignedCounsellorId?: string;
  grade?: string;
  search?: string;
  escalated?: string | boolean;
  page?: string | number;
  limit?: string | number;
}) {
  const page = Math.max(1, Number.parseInt(String(filters.page ?? '1')) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(filters.limit ?? '50')) || 50));
  const learnerWhere: Prisma.LearnerWhereInput = {};
  if (filters.grade) learnerWhere.grade = filters.grade;
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    learnerWhere.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { admissionNumber: { contains: search, mode: 'insensitive' } },
    ];
  }
  const where: Prisma.PathwayInterventionWhereInput = {
    status: filters.status
      ? enumValue(filters.status, INTERVENTION_STATUSES, 'Intervention status')
      : undefined,
    priority: filters.priority
      ? enumValue(filters.priority, PRIORITIES, 'Priority')
      : undefined,
    interventionType: filters.interventionType
      ? enumValue(filters.interventionType, INTERVENTION_TYPES, 'Intervention type')
      : undefined,
    assignedCounsellorId: filters.assignedCounsellorId || undefined,
    escalatedAt: filters.escalated === true || filters.escalated === 'true'
      ? { not: null }
      : undefined,
    learner: Object.keys(learnerWhere).length ? { is: learnerWhere } : undefined,
  };

  const [items, total, counsellors] = await Promise.all([
    prisma.pathwayIntervention.findMany({
      where,
      orderBy: [{ resolvedAt: 'asc' }, { dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        learner: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true, stream: true },
        },
        assignedCounsellor: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    }),
    prisma.pathwayIntervention.count({ where }),
    prisma.user.findMany({
      where: {
        role: { in: COUNSELLOR_ROLES },
        status: 'ACTIVE',
        archived: false,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, role: true },
    }),
  ]);
  return {
    items,
    counsellors,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function bulkUpdatePathwayInterventions(params: {
  interventionIds?: string[];
  assignedCounsellorId?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
}) {
  const interventionIds = Array.from(new Set(
    (params.interventionIds || []).map(id => String(id).trim()).filter(Boolean),
  ));
  if (!interventionIds.length || interventionIds.length > 200) {
    throw new ApiError(422, 'Select between 1 and 200 interventions');
  }
  const requestedStatus = params.status
    ? enumValue(params.status, INTERVENTION_STATUSES, 'Intervention status')
    : undefined;
  if (requestedStatus === 'RESOLVED' || requestedStatus === 'ESCALATED') {
    throw new ApiError(422, 'Resolve or escalate cases individually so the required outcome or reason is recorded');
  }
  if (params.assignedCounsellorId) {
    const counsellor = await prisma.user.findUnique({
      where: { id: params.assignedCounsellorId },
      select: { role: true, status: true, archived: true },
    });
    if (!counsellor
      || counsellor.status !== 'ACTIVE'
      || counsellor.archived
      || !COUNSELLOR_ROLES.includes(counsellor.role)) {
      throw new ApiError(422, 'Assigned user is not an active pathway counsellor');
    }
  }
  const data: Prisma.PathwayInterventionUncheckedUpdateManyInput = {
    assignedCounsellorId: params.assignedCounsellorId === undefined
      ? undefined
      : params.assignedCounsellorId,
    status: requestedStatus,
    priority: params.priority === undefined
      ? undefined
      : enumValue(params.priority, PRIORITIES, 'Priority'),
    dueDate: optionalDate(params.dueDate, 'Due date'),
  };
  if (Object.values(data).every(value => value === undefined)) {
    throw new ApiError(422, 'Choose at least one bulk update');
  }
  await prisma.pathwayIntervention.updateMany({
    where: { id: { in: interventionIds } },
    data,
  });
  return prisma.pathwayIntervention.findMany({
    where: { id: { in: interventionIds } },
    include: {
      learner: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true } },
      assignedCounsellor: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
}

export async function escalatePathwayIntervention(params: {
  learnerId: string;
  interventionId?: string;
  actorId: string;
  reason?: string;
  summary?: string;
}) {
  await assertLearnerExists(params.learnerId);
  const reason = requiredText(params.reason, 'Escalation reason');
  if (params.interventionId) {
    const existing = await prisma.pathwayIntervention.findUnique({
      where: { id: params.interventionId },
      select: { learnerId: true },
    });
    if (!existing || existing.learnerId !== params.learnerId) {
      throw new ApiError(404, 'Pathway intervention not found');
    }
    return prisma.pathwayIntervention.update({
      where: { id: params.interventionId },
      data: {
        status: 'ESCALATED',
        priority: 'URGENT',
        escalationReason: reason,
        escalatedAt: new Date(),
        escalatedById: params.actorId,
      },
      include: { learner: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true } } },
    });
  }
  return prisma.pathwayIntervention.create({
    data: {
      learnerId: params.learnerId,
      interventionType: 'SUPPORT_NEED',
      priority: 'URGENT',
      status: 'ESCALATED',
      summary: requiredText(params.summary ?? reason, 'Escalation summary'),
      assignedCounsellorId: params.actorId,
      escalationReason: reason,
      escalatedAt: new Date(),
      escalatedById: params.actorId,
      createdById: params.actorId,
    },
    include: { learner: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true } } },
  });
}

export async function getCounsellorWorkspaceReport() {
  const now = new Date();
  const [
    decisionStatuses,
    interventionStatuses,
    interventionPriorities,
    upcomingSessionCount,
    upcomingSessions,
    overdueActions,
    pathwaySelections,
  ] = await Promise.all([
    prisma.decisionPlan.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.pathwayIntervention.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.pathwayIntervention.groupBy({
      by: ['priority'],
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      _count: { _all: true },
    }),
    prisma.counsellingSession.count({
      where: { scheduledAt: { gte: now }, status: { in: ['REQUESTED', 'SCHEDULED'] } },
    }),
    prisma.counsellingSession.findMany({
      where: { scheduledAt: { gte: now }, status: { in: ['REQUESTED', 'SCHEDULED'] } },
      orderBy: { scheduledAt: 'asc' },
      take: 8,
      include: {
        learner: { select: { id: true, firstName: true, lastName: true, grade: true } },
        counsellor: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.actionItem.count({
      where: { dueDate: { lt: now }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    }),
    prisma.learnerPathwaySelection.groupBy({ by: ['pathwayId'], _count: { _all: true } }),
  ]);

  const pathwayIds = pathwaySelections.map(item => item.pathwayId);
  const pathways = pathwayIds.length
    ? await prisma.pathway.findMany({
        where: { id: { in: pathwayIds } },
        select: { id: true, name: true },
      })
    : [];
  const pathwayNames = new Map(pathways.map(item => [item.id, item.name]));
  const decisionCounts = Object.fromEntries(
    decisionStatuses.map(item => [item.status, item._count._all]),
  );

  return {
    summary: {
      awaitingParent: decisionCounts.SUBMITTED || 0,
      awaitingCounsellor: decisionCounts.PARENT_REVIEWED || 0,
      awaitingApproval: decisionCounts.COUNSELLOR_REVIEWED || 0,
      revisionRequired: decisionCounts.REVISION_REQUIRED || 0,
      approved: decisionCounts.APPROVED || 0,
      locked: decisionCounts.LOCKED || 0,
      overdueActions,
      upcomingSessions: upcomingSessionCount,
    },
    approvalProgress: decisionStatuses.map(item => ({ status: item.status, count: item._count._all })),
    interventionOutcomes: interventionStatuses.map(item => ({ status: item.status, count: item._count._all })),
    interventionPriorities: interventionPriorities.map(item => ({ priority: item.priority, count: item._count._all })),
    pathwayDistribution: pathwaySelections.map(item => ({
      pathwayId: item.pathwayId,
      pathway: pathwayNames.get(item.pathwayId) || 'Unknown pathway',
      count: item._count._all,
    })),
    upcomingSessionList: upcomingSessions,
  };
}
