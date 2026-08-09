/**
 * AI & Performance Controller
 * Exposes smart features and analytics to the frontend.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { aiAssistantService } from '../services/ai-assistant.service';
import { performanceService } from '../services/performance.service';
import { ApiError } from '../utils/error.util';
import { processAIRequest, buildAIContext } from '../ai';
import type { UserRole } from '../ai/types';
import { randomUUID } from 'crypto';
import {
    archiveAIConversation,
    getAIConversationHistory,
    saveAIExchange,
} from '../ai/conversations/AIConversationStore';

import logger from '../utils/logger';
export const aiController = {
    /**
     * Generate AI Feedback for a learner
     */
    generateFeedback: async (req: AuthRequest, res: Response) => {
        try {
            const { learnerId } = req.params;
            const { term, academicYear } = req.query;

            if (!term || !academicYear) {
                throw new ApiError(400, 'Term and academic year are required');
            }

            const feedback = await aiAssistantService.generateTeacherFeedback(
                learnerId,
                term,
                parseInt(academicYear as string)
            );

            res.json({
                success: true,
                data: feedback
            });
        } catch (error: any) {
            logger.error('AI Feedback Error:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to generate AI feedback'
            });
        }
    },

    /**
     * Analyze learner risk levels
     */
    analyzeRisk: async (req: AuthRequest, res: Response) => {
        try {
            const { learnerId } = req.params;
            const analysis = await aiAssistantService.analyzeLearnerRisk(learnerId);

            res.json({
                success: true,
                data: analysis
            });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to analyze learner risk'
            });
        }
    },

    /**
     * POST /api/ai/chat
     *
     * Main AI copilot endpoint.
     * Accepts a user message + optional context hints.
     * Routes through TrendSCOREAI: context → tools → permissions → provider → response.
     *
     * Body:
     *   message        string   The user's question or command
     *   currentRoute   string   What page/route the user is on (e.g. "/app/pathways")
     *   selectedEntityId?   string   ID of entity in focus (learner, class, etc.)
     *   selectedEntityType? string   Type: "learner" | "class" | "teacher" | ...
     *   confirmationId?     string   Return this to confirm a pending consequential action
     *   modelTier?          string   "fast" | "standard" | "reasoning" (default: auto-routed)
     */
    chat: async (req: AuthRequest, res: Response) => {
        try {
            const {
                message,
                currentRoute = '/app/dashboard',
                selectedEntityId,
                selectedEntityType,
                confirmationId,
                modelTier,
                sessionId: requestedSessionId,
            } = req.body || {};

            if (!confirmationId && (!message || typeof message !== 'string' || !message.trim())) {
                throw new ApiError(400, 'message is required');
            }
            if (confirmationId && (typeof confirmationId !== 'string' || !confirmationId.trim())) {
                throw new ApiError(400, 'confirmationId must be a non-empty string');
            }
            const allowedEntityTypes = ['learner', 'class', 'teacher', 'parent', 'staff'];
            if (selectedEntityType && !allowedEntityTypes.includes(selectedEntityType)) {
                throw new ApiError(422, `selectedEntityType must be one of: ${allowedEntityTypes.join(', ')}`);
            }
            const allowedModelTiers = ['fast', 'standard', 'reasoning'];
            if (modelTier && !allowedModelTiers.includes(modelTier)) {
                throw new ApiError(422, `modelTier must be one of: ${allowedModelTiers.join(', ')}`);
            }
            if (requestedSessionId && !/^[A-Za-z0-9_-]{8,100}$/.test(String(requestedSessionId))) {
                throw new ApiError(422, 'sessionId must contain 8-100 letters, numbers, underscores, or hyphens');
            }

            const userId = req.user?.userId;
            const role = req.user?.role as UserRole;

            if (!userId || !role) {
                throw new ApiError(401, 'Unauthenticated');
            }

            const context = await buildAIContext({
                userId,
                role,
                currentRoute: typeof currentRoute === 'string' ? currentRoute : '/app/dashboard',
                schoolId: req.school?.id,
                schoolName: req.school?.name,
                selectedEntityId: selectedEntityId || undefined,
                selectedEntityType: selectedEntityType || undefined,
            });

            const response = await processAIRequest({
                userMessage: typeof message === 'string' && message.trim() ? message.trim() : 'Confirmed action',
                context,
                confirmationId: confirmationId || undefined,
                modelTier: modelTier || undefined,
            });

            const sessionId = requestedSessionId ? String(requestedSessionId) : randomUUID();
            try {
                await saveAIExchange({
                    sessionId,
                    userMessage: typeof message === 'string' && message.trim() ? message.trim() : 'Confirmed action',
                    response,
                    context,
                });
            } catch (persistError) {
                logger.warn({ err: persistError, sessionId }, '[AI Chat] Failed to persist exchange');
            }

            res.json({ success: true, data: { ...response, sessionId } });
        } catch (error: any) {
            logger.error({ err: error }, '[AI Chat] Request failed');
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'AI request failed',
            });
        }
    },

    getHistory: async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) throw new ApiError(401, 'Unauthenticated');
        const sessionId = String(req.params.sessionId || '');
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(sessionId)) throw new ApiError(422, 'Invalid sessionId');
        const requestedLimit = Number(req.query?.limit ?? 50);
        const history = await getAIConversationHistory({
            sessionId,
            userId,
            schoolId: req.school?.id,
            limit: Number.isFinite(requestedLimit) ? requestedLimit : 50,
        });
        res.json({ success: true, data: history });
    },

    archiveHistory: async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) throw new ApiError(401, 'Unauthenticated');
        const sessionId = String(req.params.sessionId || '');
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(sessionId)) throw new ApiError(422, 'Invalid sessionId');
        const archived = await archiveAIConversation({
            sessionId,
            userId,
            schoolId: req.school?.id,
        });
        res.json({ success: true, data: { archived } });
    },

    /**
     * GET /api/ai/tools
     * List available AI tools (for debugging / UI discovery).
     */
    listTools: async (req: AuthRequest, res: Response) => {
        try {
            const { listTools } = await import('../ai');
            const tools = listTools().map((t) => ({
                name: t.name,
                description: t.description,
                category: t.category,
                allowedRoles: t.allowedRoles,
                requiresConfirmation: t.requiresConfirmation,
            }));
            res.json({ success: true, data: tools });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Get learner performance trend
     */
    getTrend: async (req: AuthRequest, res: Response) => {
        try {
            const { learnerId } = req.params;
            const trend = await performanceService.getLearnerPerformanceTrend(learnerId);

            res.json({
                success: true,
                data: trend
            });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to get learner trend'
            });
        }
    }
};
