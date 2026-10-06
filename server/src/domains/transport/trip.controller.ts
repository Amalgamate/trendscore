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
    const { routeId, date, direction, driverUserId, vehicleId, notes } = req.body;

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
      vehicleId:    vehicleId || undefined,
      notes:        notes || undefined,
    });

    res.status(201).json({ success: true, data: trip });
  }

  /** Create all selected weekday/direction runs in a date range (up to one year). */
  async createRunPlan(req: AuthRequest, res: Response) {
    const { routeId, startDate, endDate, directions, daysOfWeek, driverUserId, vehicleId, notes } = req.body;
    if (!routeId || !startDate || !endDate) throw new ApiError(400, 'routeId, startDate and endDate are required');
    if (!Array.isArray(directions) || directions.some((d) => !['OUTBOUND', 'INBOUND'].includes(d))) throw new ApiError(400, 'directions must contain OUTBOUND and/or INBOUND');
    if (!Array.isArray(daysOfWeek) || daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new ApiError(400, 'daysOfWeek must contain weekdays from 0 (Sunday) to 6 (Saturday)');
    const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00.000Z`);
    const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new ApiError(400, 'Start and end dates must be valid ISO dates');
    const result = await tripService.createRunPlan({
      schoolId: await this.resolveSchoolId(), routeId: String(routeId), startDate: start, endDate: end,
      directions, daysOfWeek, driverUserId: driverUserId || null, vehicleId: vehicleId || null,
      notes: notes ? String(notes) : null,
    });
    res.status(201).json({ success: true, data: result });
  }

  async listRunTrips(req: AuthRequest, res: Response) {
    const { fromDate, toDate, routeId } = req.query;
    if (!fromDate || !toDate) throw new ApiError(400, 'fromDate and toDate are required');
    const from = new Date(`${String(fromDate).slice(0, 10)}T00:00:00.000Z`);
    const to = new Date(`${String(toDate).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new ApiError(400, 'Date range must use YYYY-MM-DD');
    const trips = await tripService.listRunTrips({ fromDate: from, toDate: to, routeId: routeId ? String(routeId) : undefined });
    res.json({ success: true, data: trips, count: trips.length });
  }

  async updateRunAssignment(req: AuthRequest, res: Response) {
    const { driverUserId, vehicleId } = req.body;
    if (!Object.prototype.hasOwnProperty.call(req.body, 'driverUserId') && !Object.prototype.hasOwnProperty.call(req.body, 'vehicleId')) {
      throw new ApiError(400, 'Provide a driverUserId and/or vehicleId');
    }
    const trip = await tripService.updateRunAssignment(req.params.tripId, {
      ...(Object.prototype.hasOwnProperty.call(req.body, 'driverUserId') ? { driverUserId: driverUserId || null } : {}),
      ...(Object.prototype.hasOwnProperty.call(req.body, 'vehicleId') ? { vehicleId: vehicleId || null } : {}),
    });
    res.json({ success: true, data: trip, message: 'Run assignment updated' });
  }

  async updateRunAssignments(req: AuthRequest, res: Response) {
    const { tripIds, driverUserId, vehicleId } = req.body;
    if (!Array.isArray(tripIds)) throw new ApiError(400, 'tripIds must be an array');
    const result = await tripService.updateRunAssignments(tripIds.map(String), {
      ...(Object.prototype.hasOwnProperty.call(req.body, 'driverUserId') ? { driverUserId: driverUserId || null } : {}),
      ...(Object.prototype.hasOwnProperty.call(req.body, 'vehicleId') ? { vehicleId: vehicleId || null } : {}),
    });
    res.json({ success: true, data: result, message: 'Selected run assignments updated' });
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

  // ── Skip pickup (confirmed not collected) ───────────────────────────────────

  /**
   * POST /api/v1/driver/trips/:tripId/skip
   *
   * Driver confirms a learner was not collected. Triggers the guardian alert,
   * which is the whole point: a parent who is not told may assume their child is
   * on the bus.
   *
   * Ownership is enforced, and reportedBy is forced to the signed-in driver so
   * nobody can be framed for another driver's report.
   */
  async recordMySkip(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { learnerId, reason, note, deviceId } = req.body;
    if (!learnerId) throw new ApiError(400, 'learnerId is required');

    const allowedReasons = [
      'NO_ANSWER', 'REFUSED', 'ABSENT', 'ALREADY_COLLECTED', 'LATE', 'OTHER',
    ];
    if (reason && !allowedReasons.includes(reason)) {
      throw new ApiError(400, `reason must be one of ${allowedReasons.join(', ')}`);
    }
    if (reason === 'OTHER' && !note?.trim()) {
      throw new ApiError(400, 'A note is required when reason is OTHER');
    }

    await tripService.assertDriverOwnsTrip(userId, req.params.tripId);

    const result = await tripService.recordNoShow({
      tripId:     req.params.tripId,
      learnerId,
      reason:     reason || 'NO_ANSWER',
      note:       note?.trim() || undefined,
      reportedBy: userId,
      deviceId:   deviceId ?? undefined,
    });

    res.status(201).json({
      success: true,
      data: result.noShow,
      // The app must warn the driver when the alert did not go out, so they
      // phone the office instead of assuming the parent was told.
      meta: { guardianNotified: result.guardianNotified },
    });
  }

  /**
   * GET /api/v1/driver/trips/:tripId/skips
   *
   * Confirmed skips for a trip. `unnotified` counts skips whose guardian alert
   * failed, which is what the office needs to chase.
   */
  async getMySkips(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    await tripService.assertDriverOwnsTrip(userId, req.params.tripId);
    const report = await tripService.getNoShows(req.params.tripId);
    res.json({ success: true, data: report });
  }

  // ── Driver-scoped endpoints ────────────────────────────────────────────────

  /**
   * GET /api/v1/driver/today
   *
   * The single call the driver app makes on launch: which vehicle am I assigned,
   * what runs today, and how many learners are still pending. Everything is
   * scoped to the signed-in driver rather than filtered by permission, so a
   * driver can never see another driver's routes.
   */
  async reportMyLocation(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { latitude, longitude, accuracyMeters, speedMps, headingDegrees, capturedAt } = req.body;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new ApiError(400, 'A valid latitude and longitude are required');
    }

    const captured = capturedAt ? new Date(capturedAt) : new Date();
    if (Number.isNaN(captured.getTime()) || Math.abs(Date.now() - captured.getTime()) > 3 * 60 * 1000) {
      throw new ApiError(400, 'Location timestamp must be within three minutes of now');
    }
    const optionalNumber = (value: unknown) => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    await tripService.assertDriverOwnsTrip(userId, req.params.tripId);
    const location = await tripService.recordDriverLocation({
      tripId: req.params.tripId,
      driverUserId: userId,
      latitude: lat,
      longitude: lon,
      accuracyMeters: optionalNumber(accuracyMeters),
      speedMps: optionalNumber(speedMps),
      headingDegrees: optionalNumber(headingDegrees),
      capturedAt: captured,
    });

    res.json({ success: true, data: { receivedAt: location.updatedAt } });
  }
  async getMyDay(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const dateParam = req.query.date ? new Date(String(req.query.date)) : undefined;
    if (dateParam && Number.isNaN(dateParam.getTime())) {
      throw new ApiError(400, 'date must be a valid ISO date');
    }

    const day = await tripService.getDriverDay(userId, dateParam);
    res.json({ success: true, data: day });
  }

  /**
   * GET /api/v1/driver/vehicle
   * The driver's own vehicle, or null when none is assigned yet.
   */
  async getMyVehicle(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const vehicle = await tripService.getDriverVehicle(userId);
    res.json({ success: true, data: vehicle });
  }

  /**
   * GET /api/v1/driver/trips/:tripId/manifest
   * Driver-scoped read of the boarding manifest. Ownership is enforced so a
   * driver cannot read the manifest of a trip they do not run.
   */
  async getMyTripManifest(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    await tripService.assertDriverOwnsTrip(userId, req.params.tripId);
    const manifest = await tripService.getTripManifest(req.params.tripId);
    res.json({ success: true, data: manifest });
  }

  /**
   * POST /api/v1/driver/trips/:tripId/board
   * Driver-scoped boarding record. Delegates to the shared trip service so the
   * presence event and parent notification behave exactly as they do for admins.
   */
  async recordMyBoarding(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { learnerId, eventType, method, deviceId } = req.body;
    if (!learnerId)                throw new ApiError(400, 'learnerId is required');
    if (!['BOARDED', 'ALIGHTED'].includes(eventType)) {
      throw new ApiError(400, 'eventType must be BOARDED or ALIGHTED');
    }

    await tripService.assertDriverOwnsTrip(userId, req.params.tripId);

    const result = await tripService.recordBoardingEvent({
      tripId:      req.params.tripId,
      learnerId,
      eventType,
      method:      method ?? 'MANUAL',
      // Attribution is forced to the signed-in driver, never client-supplied.
      recordedBy:  userId,
      deviceId:    deviceId ?? undefined,
    });

    res.status(201).json({ success: true, data: result.boardingEvent });
  }

  /**
   * PATCH /api/v1/driver/trips/:tripId/status
   * Driver-scoped status change (DEPART / COMPLETE).
   */
  async updateMyTripStatus(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { status } = req.body;
    const allowed = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      throw new ApiError(400, `status must be one of ${allowed.join(', ')}`);
    }

    await tripService.assertDriverOwnsTrip(userId, req.params.tripId);

    const now = new Date();
    const trip = await tripService.updateTripStatus(
      req.params.tripId,
      status,
      status === 'IN_PROGRESS' ? { departedAt: now }
        : status === 'COMPLETED'  ? { arrivedAt: now }
        : undefined,
    );

    res.json({ success: true, data: trip });
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
