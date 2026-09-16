/**
 * Report Template Controller
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 5 (Template Data Model / Configuration)
 *
 * Read-only for now: exposes the catalogue of selectable report templates.
 * Writing School.reportTemplateId is unchanged — it already works today via
 * the existing pass-through `PUT /schools` (see checklist ER-009), so this
 * controller does not duplicate that endpoint. It exists so a future
 * "Report Templates" tab (Phase 7) has something to populate its picker from
 * instead of querying prisma.template directly in a page component.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../utils/error.util';
import * as reportTemplateService from '../services/reportTemplate.service';
import logger from '../utils/logger';

export const reportTemplateController = {
  /**
   * List templates a school can currently select.
   * GET /api/report-templates
   */
  listTemplates: async (_req: AuthRequest, res: Response) => {
    try {
      const templates = await reportTemplateService.listActiveTemplates();
      res.json({ success: true, data: templates });
    } catch (error: any) {
      logger.error('Error listing report templates:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to list report templates',
      });
    }
  },

  /**
   * Get one template by id — including retired (isActive:false) ones, since
   * a historical ReportSnapshot may still need to resolve which component
   * rendered it (Decision D3) even after the template is retired from the
   * active picker.
   * GET /api/report-templates/:id
   */
  getTemplate: async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const template = await reportTemplateService.getTemplateById(id);
      if (!template) {
        throw new ApiError(404, 'Report template not found');
      }
      res.json({ success: true, data: template });
    } catch (error: any) {
      logger.error('Error fetching report template:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch report template',
      });
    }
  },
};
