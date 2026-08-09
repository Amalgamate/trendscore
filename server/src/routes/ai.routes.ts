/**
 * AI & Performance Routes
 */

import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireCsrf } from '../middleware/csrf.middleware';

const router = Router();

router.use(authenticate);

// AI Copilot — main chat endpoint
router.post('/chat', requireCsrf, aiController.chat);
router.get('/history/:sessionId', aiController.getHistory);
router.delete('/history/:sessionId', requireCsrf, aiController.archiveHistory);
router.get('/tools', aiController.listTools);

// AI Assistant (rule-based, existing)
router.get('/feedback/:learnerId', aiController.generateFeedback);
router.get('/analyze-risk/:learnerId', aiController.analyzeRisk);

// Performance Analytics
router.get('/trend/:learnerId', aiController.getTrend);

export default router;
