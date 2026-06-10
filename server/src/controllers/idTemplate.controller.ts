import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { v2 as cloudinary } from 'cloudinary';
import { PRODUCT_STORAGE_PREFIX } from '../config/productIdentity';

import logger from '../utils/logger';
export class IdTemplateController {
    /**
     * Get all ID Card templates
     */
    async getAll(req: AuthRequest, res: Response) {
        try {
            const templates = await prisma.iDCardTemplate.findMany({
                where: { archived: false },
                orderBy: { templateName: 'asc' }
            });
            res.json({ success: true, data: templates });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get active template for printing
     */
    async getActive(req: AuthRequest, res: Response) {
        try {
            const template = await prisma.iDCardTemplate.findFirst({
                where: { isActive: true, archived: false }
            });
            res.json({ success: true, data: template });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get specific template by ID
     */
    async getById(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const template = await prisma.iDCardTemplate.findUnique({
                where: { id }
            });

            if (!template || template.archived) {
                return res.status(404).json({ success: false, message: 'Template not found' });
            }

            res.json({ success: true, data: template });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Create new template
     */
    async create(req: AuthRequest, res: Response) {
        try {
            const {
                templateName,
                templateType,
                templateDesign, // expects base64 or URL
                layoutConfig,
                width,
                height,
                orientation,
                backgroundColor,
                textColor,
                isActive
            } = req.body;

            const userId = req.user!.userId;

            // Optional: Check uniqueness
            const existing = await prisma.iDCardTemplate.findUnique({
                where: { templateName }
            });

            if (existing) {
                return res.status(400).json({ success: false, message: 'Template with this name already exists' });
            }

            // Upload base64 image immediately if it's base64 format and cloudinary is available
            let finalDesignUrl = templateDesign;
            if (templateDesign && templateDesign.startsWith('data:image')) {
                try {
                    const result = await cloudinary.uploader.upload(templateDesign, {
                        folder: `${PRODUCT_STORAGE_PREFIX}/id_templates`
                    });
                    finalDesignUrl = result.secure_url;
                } catch (uploadError) {
                    logger.warn("Cloudinary upload failed, using raw string (may be large)", uploadError);
                    // continue using the raw base64 string if upload fails or is not configured
                }
            }

            // If this is set to active, deactivate others
            if (isActive) {
                await prisma.iDCardTemplate.updateMany({
                    where: { templateType },
                    data: { isActive: false }
                });
            }

            const template = await prisma.iDCardTemplate.create({
                data: {
                    templateName,
                    templateType: templateType || 'LEARNER',
                    templateDesign: finalDesignUrl || '',
                    layoutConfig: layoutConfig || {},
                    width: parseInt(width) || 320,
                    height: parseInt(height) || 204,
                    orientation: orientation || 'horizontal',
                    backgroundColor: backgroundColor || '#FFFFFF',
                    textColor: textColor || '#000000',
                    isActive: isActive || false,
                    createdBy: userId
                }
            });

            res.status(201).json({ success: true, data: template });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Update template
     */
    async update(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const {
                templateName,
                templateType,
                templateDesign,
                layoutConfig,
                width,
                height,
                isActive
            } = req.body;

            // If this is set to active, deactivate others
            if (isActive) {
                const current = await prisma.iDCardTemplate.findUnique({ where: { id } });
                const type = templateType || current?.templateType || 'LEARNER';
                
                await prisma.iDCardTemplate.updateMany({
                    where: { templateType: type },
                    data: { isActive: false }
                });
            }

            let finalDesignUrl = templateDesign;
            // Only upload if it's a new base64 string
            if (templateDesign && templateDesign.startsWith('data:image')) {
                try {
                    const result = await cloudinary.uploader.upload(templateDesign, {
                        folder: `${PRODUCT_STORAGE_PREFIX}/id_templates`
                    });
                    finalDesignUrl = result.secure_url;
                } catch (uploadError) {
                    logger.warn("Cloudinary upload failed", uploadError);
                }
            }

            const updateData: any = {};
            if (templateName) updateData.templateName = templateName;
            if (finalDesignUrl) updateData.templateDesign = finalDesignUrl;
            if (layoutConfig) updateData.layoutConfig = layoutConfig;
            if (width) updateData.width = parseInt(width);
            if (height) updateData.height = parseInt(height);
            if (isActive !== undefined) updateData.isActive = isActive;

            const template = await prisma.iDCardTemplate.update({
                where: { id },
                data: updateData
            });

            res.json({ success: true, data: template });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Delete/Archive template
     */
    async delete(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.userId;

            await prisma.iDCardTemplate.update({
                where: { id },
                data: {
                    archived: true,
                    archivedAt: new Date(),
                    archivedBy: userId,
                    isActive: false
                }
            });

            res.json({ success: true, message: 'Template deleted safely' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const idTemplateController = new IdTemplateController();
