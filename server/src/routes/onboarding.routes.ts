import { Router } from 'express';
import { z } from 'zod';
import { OnboardingController } from '../controllers/onboarding.controller';
import { createTicket } from '../controllers/support.controller';
import { authRateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { optionalAuthenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';

const router = Router();
const onboardingController = new OnboardingController();

const guestSupportSchema = z.object({
  subject: z.string().min(5).max(200),
  message: z.string().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  guestName: z.string().min(2).max(120).optional(),
  guestEmail: z.string().email().optional(),
});

// Support both paths while clients converge.
router.post('/register', authRateLimit(5, 60_000), onboardingController.registerFull.bind(onboardingController));
router.post('/register-full', authRateLimit(5, 60_000), onboardingController.registerFull.bind(onboardingController));
router.get('/verify-email', onboardingController.verifyEmail.bind(onboardingController));
router.post('/verify-phone', authRateLimit(10, 60_000), onboardingController.verifyPhone.bind(onboardingController));

/** Guest support during onboarding (unauthenticated) */
router.post(
  '/support',
  optionalAuthenticate,
  authRateLimit(10, 60_000),
  validate(guestSupportSchema),
  createTicket
);

export default router;
