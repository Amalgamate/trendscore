/**
 * Driver Routes
 *
 * Registered under /api/v1/driver (see routes/index.ts).
 *
 * These endpoints back the native driver app (sideloaded APK, one per school).
 * They differ from the admin trip endpoints in /api/v1/transport/trips in one
 * important way: they are scoped to the SIGNED-IN DRIVER's identity, not to a
 * permission. A driver holds RECORD_BOARDING_EVENTS, which is enough to satisfy
 * the permission guard on the admin routes — and therefore enough to read or
 * write any trip in the school. Everything here re-checks ownership explicitly.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { tripController } from '../domains/transport/trip.controller';

const router = Router();

// authenticate is applied globally in routes/index.ts — do not re-apply here.
router.use(authenticate);

// A driver account is the only audience. Staff keep using the admin trip routes.
router.use(requireRole(['DRIVER']));

/**
 * @route GET /api/v1/driver/today
 * @desc  Today's trips for the signed-in driver, with per-trip boarding counts
 */
router.get(
  '/today',
  asyncHandler(tripController.getMyDay.bind(tripController)),
);

/**
 * @route GET /api/v1/driver/vehicle
 * @desc  The vehicle assigned to the signed-in driver (null when unassigned)
 */
router.get(
  '/vehicle',
  asyncHandler(tripController.getMyVehicle.bind(tripController)),
);

/**
 * @route GET /api/v1/driver/trips/:tripId/manifest
 * @desc  Boarding manifest for a trip the signed-in driver owns
 */
router.get(
  '/trips/:tripId/manifest',
  asyncHandler(tripController.getMyTripManifest.bind(tripController)),
);

/**
 * @route POST /api/v1/driver/trips/:tripId/board
 * @desc  Record boarding/alighting. recordedBy is forced to the signed-in driver.
 */
router.post(
  '/trips/:tripId/board',
  asyncHandler(tripController.recordMyBoarding.bind(tripController)),
);

/**
 * @route PATCH /api/v1/driver/trips/:tripId/status
 * @desc  Mark the trip IN_PROGRESS (departed) or COMPLETED (arrived)
 */
router.patch(
  '/trips/:tripId/status',
  asyncHandler(tripController.updateMyTripStatus.bind(tripController)),
);

/**
 * @route POST /api/v1/driver/trips/:tripId/skip
 * @desc  Confirm a learner was not collected. Alerts the guardian.
 */
router.post(
  '/trips/:tripId/skip',
  asyncHandler(tripController.recordMySkip.bind(tripController)),
);

/**
 * @route GET /api/v1/driver/trips/:tripId/skips
 * @desc  Confirmed skips for a trip, with a count of alerts still unsent
 */
router.get(
  '/trips/:tripId/skips',
  asyncHandler(tripController.getMySkips.bind(tripController)),
);

export default router;