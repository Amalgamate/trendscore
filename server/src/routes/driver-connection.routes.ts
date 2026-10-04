import { Router, Request, Response } from 'express';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { driverConnectionService } from '../services/driverConnection.service';

const router = Router();

/**
 * Driver app onboarding — public, unauthenticated.
 *
 * These are the only endpoints the app may call before it has a school or a
 * token, so they are deliberately the narrowest surface in the product:
 * a code in, an origin and branding out. Nothing here returns data beyond the
 * single school that code resolves to.
 *
 * Contract: apps/driver_app/API_CONTRACT.md
 */

// A whole school sits behind one NAT address, so per-IP ceilings stay generous,
// but registration is the endpoint worth throttling hardest: it is what an
// attacker hits when trying to spray codes or flood an office's approval list.
const resolveLimit = rateLimit({ windowMs: 60_000, maxRequests: 20 });
const registerLimit = rateLimit({ windowMs: 60_000, maxRequests: 5 });
const statusLimit = rateLimit({ windowMs: 60_000, maxRequests: 30 });

/**
 * @route   POST /api/driver-connection/resolve
 * @desc    Turn a school code into the API origin and branding for the app
 * @access  Public
 */
router.post('/resolve', resolveLimit, async (req: Request, res: Response, next) => {
  try {
    const data = await driverConnectionService.resolve(req.body?.code, req.hostname);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/driver-connection/devices/register
 * @desc    Ask for this phone to be approved for a school
 * @access  Public
 */
router.post('/devices/register', registerLimit, async (req: Request, res: Response, next) => {
  try {
    const data = await driverConnectionService.registerDevice(
      req.body?.code,
      req.body?.deviceId,
      req.body?.label,
      req.hostname,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/driver-connection/devices/status
 * @desc    PENDING | APPROVED | REVOKED for this phone
 * @access  Public
 */
router.get('/devices/status', statusLimit, async (req: Request, res: Response, next) => {
  try {
    const data = await driverConnectionService.deviceStatus(
      req.query.code,
      req.query.deviceId,
      req.hostname,
    );
    res.json({ success: true, data: { status: data } });
  } catch (err) {
    next(err);
  }
});

export default router;
