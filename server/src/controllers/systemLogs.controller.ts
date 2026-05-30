import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/permissions.middleware';

type UiLogEntry = {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  source: 'ACADEMIC' | 'SYSTEM';
  action: string;
  message: string;
  details?: string;
  sensitiveLearnerChange?: boolean;
};

const formatRole = (role?: string | null) => {
  if (!role) return 'Staff';
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
};

const cleanEntityType = (entityType: string) => {
  const normalized = entityType
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return normalized.replace(/\b\w/g, (m) => m.toUpperCase());
};

const humanizeAuditLog = (path: string, method: string, action: string) => {
  if (path.includes('/config/grades')) {
    return method === 'GET'
      ? 'opened grade settings'
      : 'updated grade settings';
  }
  if (path.includes('/assessments') || path.includes('/grading') || path.includes('/cbc')) {
    return method === 'GET'
      ? 'viewed assessment records'
      : 'updated assessment records';
  }
  if (path.includes('/learners') || path.includes('/admissions')) {
    return method === 'GET'
      ? 'viewed learners list'
      : 'updated learner records';
  }
  if (path.includes('/schools')) {
    return method === 'GET'
      ? 'viewed school settings'
      : 'updated school settings';
  }

  return action?.trim() ? action.toLowerCase() : `${method.toUpperCase()} ${path}`;
};

const humanizeChangeHistory = (entry: {
  entityType: string;
  action: string;
  field: string | null;
  reason: string | null;
  oldValue: string | null;
  newValue: string | null;
}) => {
  const subject = cleanEntityType(entry.entityType);
  const action = (entry.action || '').toUpperCase();
  const field = entry.field || '';

  if (subject.toLowerCase().includes('summative') || subject.toLowerCase().includes('assessment')) {
    if (action === 'CREATE') return 'uploaded scores for a class assessment';
    if (action === 'UPDATE') return 'updated learner scores';
    if (action === 'DELETE') return 'removed some assessment scores';
  }

  if (action === 'CREATE') return `created ${subject.toLowerCase()} record`;
  if (action === 'UPDATE') {
    if (field) return `updated ${subject.toLowerCase()} ${field}`;
    return `updated ${subject.toLowerCase()} record`;
  }
  if (action === 'DELETE') return `deleted ${subject.toLowerCase()} record`;
  if (action === 'ARCHIVE') return `archived ${subject.toLowerCase()} record`;

  return `${action.toLowerCase()} ${subject.toLowerCase()} record`;
};

const SENSITIVE_LEARNER_FIELDS = new Set(['upiNumber', 'dateOfBirth', 'grade']);

export const getSystemLogs = async (req: AuthRequest, res: Response) => {
  const limitRaw = Number(req.query.limit || 120);
  const limit = Number.isFinite(limitRaw) ? Math.max(20, Math.min(limitRaw, 300)) : 120;

  const [changes, audits] = await Promise.all([
    prisma.changeHistory.findMany({
      take: limit,
      orderBy: { changedAt: 'desc' },
      include: {
        changer: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
            email: true,
          }
        }
      }
    }),
    prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: {
        OR: [
          { path: { contains: '/assessments' } },
          { path: { contains: '/grading' } },
          { path: { contains: '/cbc' } },
          { path: { contains: '/learners' } },
          { path: { contains: '/admissions' } },
          { path: { contains: '/config/grades' } },
          { path: { contains: '/schools' } },
        ]
      }
    })
  ]);

  const changeLogs: UiLogEntry[] = changes.map((entry) => {
    const actorName = [entry.changer?.firstName, entry.changer?.lastName].filter(Boolean).join(' ')
      || entry.changer?.email
      || 'System User';
    const actorRole = formatRole(entry.changer?.role);
    const message = humanizeChangeHistory(entry);
    const isSensitiveLearnerChange =
      entry.entityType?.toLowerCase() === 'learner' &&
      entry.action?.toUpperCase() === 'UPDATE' &&
      !!entry.field &&
      SENSITIVE_LEARNER_FIELDS.has(entry.field);
    const details = isSensitiveLearnerChange
      ? `Field: ${entry.field}${entry.reason ? ` • Reason: ${entry.reason}` : ''}`
      : (entry.reason || entry.field || undefined);

    return {
      id: `chg-${entry.id}`,
      timestamp: entry.changedAt.toISOString(),
      actorName,
      actorRole,
      source: 'ACADEMIC',
      action: entry.action,
      message,
      details,
      sensitiveLearnerChange: isSensitiveLearnerChange,
    };
  });

  const auditLogs: UiLogEntry[] = audits.map((entry) => {
    const actorName = entry.userEmail || 'System User';
    const actorRole = formatRole(entry.userRole);
    const message = humanizeAuditLog(entry.path, entry.method, entry.action);

    return {
      id: `aud-${entry.id}`,
      timestamp: entry.createdAt.toISOString(),
      actorName,
      actorRole,
      source: 'SYSTEM',
      action: entry.action || entry.method,
      message,
      details: entry.path,
    };
  });

  const merged = [...changeLogs, ...auditLogs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  res.json({
    success: true,
    data: merged,
    meta: {
      total: merged.length,
      generatedAt: new Date().toISOString(),
    }
  });
};
