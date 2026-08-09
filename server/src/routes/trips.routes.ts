/**
 * Trip Routes
 *
 * Registered under /api/v1/transport/trips (added to routes/index.ts)
 *
 * Design note: trips are under /v1/ because they are new in 2.0.
 * The existing /api/transport/* routes remain unchanged.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { tripController } from '../domains/transport/trip.controller';

const router = Router();

// All routes require authentication (registered after authenticate in index.ts)

/**
 * @route POST /api/v1/transport/trips
 * @desc  Create or get existing trip for route/date/direction
 */
router.post(
  '/',
  requirePermission('MANAGE_TRANSPORT_TRIPS'),
  asyncHandler(tripController.createOrGetTrip.bind(tripController)),
);

/**
 * @route GET /api/v1/transport/trips?routeId=&date=
 * @desc  List trips for a route (optional date filter)
 */
router.get(
  '/',
  requireAnyPermission(['MANAGE_TRANSPORT_TRIPS', 'VIEW_TRANSPORT_TRIPS', 'RECORD_BOARDING_EVENTS']),
  asyncHandler(tripController.getTrips.bind(tripController)),
);

/**
 * @route GET /api/v1/transport/trips/:tripId
 * @desc  Get a single trip with boarding events
 */
router.get(
  '/:tripId',
  requireAnyPermission(['MANAGE_TRANSPORT_TRIPS', 'VIEW_TRANSPORT_TRIPS', 'RECORD_BOARDING_EVENTS']),
  asyncHandler(tripController.getTripById.bind(tripController)),
);

/**
 * @route PATCH /api/v1/transport/trips/:tripId/status
 * @desc  Update trip status (admin or driver)
 */
router.patch(
  '/:tripId/status',
  requireAnyPermission(['MANAGE_TRANSPORT_TRIPS', 'RECORD_BOARDING_EVENTS']),
  asyncHandler(tripController.updateTripStatus.bind(tripController)),
);

/**
 * @route GET /api/v1/transport/trips/:tripId/manifest
 * @desc  Driver boarding manifest
 */
router.get(
  '/:tripId/manifest',
  requireAnyPermission(['MANAGE_TRANSPORT_TRIPS', 'VIEW_TRANSPORT_TRIPS', 'RECORD_BOARDING_EVENTS']),
  asyncHandler(tripController.getManifest.bind(tripController)),
);

/**
 * @route POST /api/v1/transport/trips/:tripId/board
 * @desc  Record single learner boarding/alighting
 */
router.post(
  '/:tripId/board',
  requirePermission('RECORD_BOARDING_EVENTS'),
  asyncHandler(tripController.recordBoarding.bind(tripController)),
);

/**
 * @route POST /api/v1/transport/trips/:tripId/board/bulk
 * @desc  Bulk record boarding for multiple learners
 */
router.post(
  '/:tripId/board/bulk',
  requirePermission('RECORD_BOARDING_EVENTS'),
  asyncHandler(tripController.recordBulkBoarding.bind(tripController)),
);

export default router;
