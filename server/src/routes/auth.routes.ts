import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async.util';
import { sendOTP, verifyOTP } from '../controllers/otp.controller';
import { authRateLimit, progressiveRateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { loginSchema, registerSchema, emailSchema, phoneOtpRequestSchema, phoneOtpVerifySchema } from '../utils/validation.util';
import { requireRole } from '../middleware/permissions.middleware';

const router = Router();
const authController = new AuthController();

// Public routes with enhanced security rate limiting
router.post('/register',
  optionalAuthenticate,
  authRateLimit(5, 60_000), // 5 registrations per minute per IP+email
  validate(registerSchema),
  asyncHandler(authController.register.bind(authController))
);

router.post('/check-availability',
  authRateLimit(20, 60_000), // Higher limit for realtime checks
  validate(emailSchema, 'body'),
  asyncHandler(authController.checkAvailability.bind(authController))
);

router.post('/login',
  progressiveRateLimit({
    windowMs: 60_000, // 1 minute
    maxRequests: 10, // 10 attempts initially, reduces after failures
    message: 'Too many login attempts. Please try again later.'
  }),
  validate(loginSchema),
  asyncHandler(authController.login.bind(authController))
);

// Additive parent-only phone OTP login. Password login remains unchanged.
router.post('/phone-otp/request',
  authRateLimit(3, 60_000),
  validate(phoneOtpRequestSchema),
  asyncHandler(authController.requestPhoneOtp.bind(authController))
);

router.post('/phone-otp/verify',
  authRateLimit(5, 60_000),
  validate(phoneOtpVerifySchema),
  asyncHandler(authController.verifyPhoneOtp.bind(authController))
);

// Token refresh
router.post('/refresh',
  authRateLimit(10, 60_000), // 10 refresh attempts per minute
  asyncHandler(authController.refresh.bind(authController))
);

// Password reset flow
router.post('/forgot-password',
  authRateLimit(3, 60_000), // 3 password reset requests per minute
  validate(emailSchema, 'body'),
  asyncHandler(authController.forgotPassword.bind(authController))
);

router.post('/reset-password',
  authRateLimit(3, 60_000), // 3 reset attempts per minute
  asyncHandler(authController.resetPassword.bind(authController))
);

// OTP routes
router.post('/otp/send',
  authRateLimit(3, 60_000), // 3 OTP requests per minute
  asyncHandler(sendOTP)
);

router.post('/otp/verify',
  authRateLimit(5, 60_000), // 5 verification attempts per minute
  asyncHandler(verifyOTP)
);

// Verification routes
router.post('/send-whatsapp-verification',
  authRateLimit(3, 60_000),
  asyncHandler(authController.sendWhatsAppVerification.bind(authController))
);

// Development route - Get seeded users
if (process.env.NODE_ENV === 'development') {
  router.get('/seeded-users', asyncHandler(authController.getSeededUsers.bind(authController)));
}

// Protected routes
router.get('/me', authenticate, asyncHandler(authController.me.bind(authController)));

router.post('/logout',
  authenticate,
  asyncHandler(authController.logout.bind(authController))
);

/**
 * @route  POST /api/auth/logout-all
 * @desc   Invalidate all active user sessions (force-logout everyone)
 * @access SUPER_ADMIN, ADMIN
 */
router.post('/logout-all',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  authRateLimit(5, 60_000),
  asyncHandler(authController.logoutAll.bind(authController))
);

/**
 * @route  POST /api/auth/flush-cache
 * @desc   Clear the application Redis cache
 * @access SUPER_ADMIN, ADMIN
 */
router.post('/flush-cache',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  authRateLimit(5, 60_000),
  asyncHandler(authController.flushCache.bind(authController))
);

export default router;
