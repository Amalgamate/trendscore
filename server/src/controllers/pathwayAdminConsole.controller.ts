import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../utils/error.util';
import { pathwayAdminConsoleService as service } from '../services/pathway-admin-console.service';

const actor = (req: AuthRequest) => req.user?.userId;

export const pathwayAdminConsoleController = {
  dashboard: async (_req: AuthRequest, res: Response) => res.json({ success: true, data: await service.dashboard() }),
  listReferences: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.listReferences(req.params.type) }),
  referenceImpact: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.referenceImpact(req.params.type, req.params.id) }),
  saveReference: async (req: AuthRequest, res: Response) => res.status(req.body?.id ? 200 : 201).json({ success: true, data: await service.saveReference(req.params.type, req.body, actor(req)) }),
  publishReference: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.transitionReference(req.params.type, req.params.id, 'PUBLISHED', actor(req), req.body?.reason) }),
  retireReference: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.transitionReference(req.params.type, req.params.id, 'RETIRED', actor(req), req.body?.reason) }),
  versions: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.listVersions(req.query.type ? String(req.query.type) : undefined, req.query.entityId ? String(req.query.entityId) : undefined) }),
  rollbackVersion: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.rollbackVersion(req.params.id, actor(req), req.body?.reason) }),
  rules: async (_req: AuthRequest, res: Response) => res.json({ success: true, data: await service.listRules() }),
  createRule: async (req: AuthRequest, res: Response) => res.status(201).json({ success: true, data: await service.createRule(req.body, actor(req)) }),
  publishRule: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.publishRule(req.params.id) }),
  imports: async (_req: AuthRequest, res: Response) => res.json({ success: true, data: await service.listImports() }),
  createImport: async (req: AuthRequest, res: Response) => res.status(201).json({ success: true, data: await service.createImport(req.body, actor(req)) }),
  approveImport: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.approveImport(req.params.id, actor(req)) }),
  dataQuality: async (_req: AuthRequest, res: Response) => res.json({ success: true, data: await service.dataQuality() }),
  analytics: async (_req: AuthRequest, res: Response) => res.json({ success: true, data: await service.analytics() }),
  auditLogs: async (req: AuthRequest, res: Response) => res.json({ success: true, data: await service.auditLogs(req.query.query ? String(req.query.query) : undefined) }),
  validateJson: async (req: AuthRequest, _res: Response) => {
    if (!req.body || typeof req.body !== 'object') throw new ApiError(400, 'A JSON object is required');
  },
};
