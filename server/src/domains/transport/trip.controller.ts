/**
 * Trip Controller
 *
 * Handles TransportTrip and TransportBoardingEvent endpoints.
 * All routes are under /api/v1/transport/trips/
 *
 * These endpoints are primarily used by:
 *  - Admins: create trips, view manifests, view reports
 *  - Drivers: mark trip status, record boarding (mobile-friendly)
 */

import { Response } from 'express';
import { AuthRequest } from '../../middleware/permissions.middleware';
import { ApiError } from '../../utils/error.util';
import { tripService } from './trip.service';
import prisma from '../../config/database';

// Roles that can manage trips (not just record boarding)
const TRIP_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);

export class TripController {

  // ── Trip CRUD ──────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/transport/trips
   * Create or return the existing trip for route/date/direction.
   */
  async createOrGetTrip(req: AuthRequest, res: Response) {
    const { routeId, date, direction, driverUserId, notes } = req.body;

    if (!routeId)    throw new ApiError(400, 'routeId is required');
    if (!date)       throw new ApiError(400, 'date is required');
    if (!direction)  throw new ApiError(400, 'direction is required (OUTBOUND | INBOUND)');
    if (!['OUTBOUND', 'INBOUND'].includes(direction)) {
      throw new ApiError(400, 'direction must be OUTBOUND or INBOUND');
    }

    const schoolId = await this.resolveSchoolId();

    const trip = await tripService.getOrCreateTrip({
      schoolId,
      routeId,
      date: new Date(date),
      direction,
      driverUserId: driverUserId || undefined,
      notes:        notes || undefined,
    });

    res.status(201).json({ success: true, data: trip });
  }

  /**
   * GET /api/v1/transport/trips?routeId=&date=
   */
  async getTrips(req: AuthRequest, res: Response) {
    const { routeId, date } = req.query;
    if (!routeId) throw new ApiError(400, 'routeId query parameter is required');

    const trips = await tripService.getTripsForRoute(
      routeId as string,
      date ? new Date(date as string) : undefined,
    );
    res.json({ success: true, data: trips, count: trips.length });
  }

  /**
   * GET /api/v1/transport/trips/:tripId
   */
  async getTripById(req: AuthRequest, res: Response) {
    const trip = await tripService.getTripById(req.params.tripId);
    res.json({ success: true, data: trip });
  }

  /**
   * PATCH /api/v1/transport/trips/:tripId/status
   * Update trip status (SCHEDULED → IN_PROGRESS → COMPLETED | CANCELLED).
   */
  async updateTripStatus(req: AuthRequest, res: Response) {
    const { tripId } = req.params;
    const { status, departedAt, arrivedAt } = req.body;

    const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      throw new ApiError(400, `status must be one of: ${validStatuses.join(', ')}`);
    }

    const trip = await tripService.updateTripStatus(tripId, status, {
      departedAt: departedAt ? new Date(departedAt) : undefined,
      arrivedAt:  arrivedAt  ? new Date(arrivedAt)  : undefined,
    });

    res.json({ success: true, data: trip, message: `Trip marked as ${status}` });
  }

  // ── Boarding Events ────────────────────────────────────────────────────────

  /**
   * POST /api/v1/transport/trips/:tripId/board
   * Record a single learner boarding or alighting.
   * Used by driver mobile UI — minimal auth requirement.
   */
  async recordBoarding(req: AuthRequest, res: Response) {
    const { tripId } = req.params;
    const { learnerId, eventType, method, deviceId } = req.body;

    if (!learnerId)  throw new ApiError(400, 'learnerId is required');
    if (!eventType || !['BOARDED', 'ALIGHTED'].includes(eventType)) {
      throw new ApiError(400, 'eventType must be BOARDED or ALIGHTED');
    }

    const result = await tripService.recordBoardingEvent({
      tripId,
      learnerId,
      eventType,
      method:     method || 'MANUAL',
      recordedBy: req.user?.userId,
      deviceId:   deviceId || undefined,
    });

    res.status(201).json({
      success: true,
      data: result.boardingEvent,
      message: `${eventType === 'BOARDED' ? 'Boarding' : 'Alighting'} recorded`,
    });
  }

  /**
   * POST /api/v1/transport/trips/:tripId/board/bulk
   * Record boarding for multiple learners at once.
   * Used by driver to confirm all learners boarded before departing.
   */
  async recordBulkBoarding(req: AuthRequest, res: Response) {
    const { tripId } = req.params;
    const { learnerIds, eventType } = req.body;

    if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
      throw new ApiError(400, 'learnerIds must be a non-empty array');
    }
    if (!eventType || !['BOARDED', 'ALIGHTED'].includes(eventType)) {
      throw new ApiError(400, 'eventType must be BOARDED or ALIGHTED');
    }

    const results = await tripService.bulkRecordBoarding(
      tripId, learnerIds, eventType, req.user?.userId,
    );

    const ok      = results.filter(r => r.status === 'ok').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors  = results.filter(r => r.status === 'error').length;

    res.json({
      success: true,
      data: results,
      message: `Recorded ${ok} boarding events (${skipped} skipped, ${errors} errors)`,
    });
  }

  /**
   * GET /api/v1/transport/trips/:tripId/manifest
   * Driver-facing boarding manifest for a trip.
   */
  async getManifest(req: AuthRequest, res: Response) {
    const manifest = await tripService.getTripManifest(req.params.tripId);
    res.json({ success: true, data: manifest });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async resolveSchoolId(): Promise<string> {
    const school = await prisma.school.findFirst({
      where: { archived: false, active: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!school) throw new ApiError(500, 'No active school found');
    return school.id;
  }
}

export const tripController = new TripController();
