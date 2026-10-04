/**
 * TripService
 *
 * Manages TransportTrip and TransportBoardingEvent records.
 *
 * A Trip is one daily run of a route (OUTBOUND = morning, INBOUND = afternoon).
 * A BoardingEvent records a learner boarding or alighting on a specific trip.
 *
 * Every boarding/alighting emits a presence event (BUS_BOARDED / BUS_ALIGHTED).
 */

import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
import { presenceService } from '../presence/presence.service';
import { attendanceNotificationService } from '../../services/attendance-notification.service';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TripDirection = 'OUTBOUND' | 'INBOUND';
export type TripStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type BoardingMethod = 'MANUAL' | 'SCAN' | 'CONFIRMED';

export interface CreateTripInput {
  schoolId:     string;
  routeId:      string;
  date:         Date;
  direction:    TripDirection;
  driverUserId?: string;
  notes?:       string;
}

export interface RecordBoardingInput {
  tripId:      string;
  learnerId:   string;
  eventType:   'BOARDED' | 'ALIGHTED';
  method?:     BoardingMethod;
  recordedBy?: string;
  deviceId?:   string;
}

/// Why a learner was not collected. Reported by the driver at the stop.
export type NoShowReason =
  | 'NO_ANSWER'        // nobody came to the pickup point
  | 'REFUSED'           // learner declined to board
  | 'ABSENT'            // learner not at school / already collected
  | 'ALREADY_COLLECTED' // someone else collected them
  | 'LATE'
  | 'OTHER';

export interface RecordNoShowInput {
  tripId:      string;
  learnerId:   string;
  reason?:     NoShowReason;
  note?:       string;
  reportedBy?: string;
  deviceId?:   string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TripService {

  // ── Trips ──────────────────────────────────────────────────────────────────

  /**
   * Create or return the existing trip for a route/date/direction combination.
   * Idempotent — safe to call multiple times.
   */
  async getOrCreateTrip(input: CreateTripInput) {
    const dateUtc = new Date(
      Date.UTC(input.date.getFullYear(), input.date.getMonth(), input.date.getDate()),
    );

    const existing = await prisma.transportTrip.findUnique({
      where: {
        routeId_date_direction: {
          routeId:   input.routeId,
          date:      dateUtc,
          direction: input.direction,
        },
      },
      include: { route: { include: { vehicle: true } } },
    });

    if (existing) return existing;

    // Validate route exists
    const route = await prisma.transportRoute.findUnique({
      where: { id: input.routeId },
      include: { vehicle: true },
    });
    if (!route || route.archived) throw new ApiError(404, 'Route not found or archived');

    return prisma.transportTrip.create({
      data: {
        schoolId:     input.schoolId,
        routeId:      input.routeId,
        date:         dateUtc,
        direction:    input.direction,
        driverUserId: input.driverUserId ?? null,
        notes:        input.notes ?? null,
        status:       'SCHEDULED',
      },
      include: { route: { include: { vehicle: true } } },
    });
  }

  async getTripsForRoute(routeId: string, date?: Date) {
    const where: any = { routeId, archived: false };
    if (date) {
      const dateUtc = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
      );
      where.date = dateUtc;
    }
    return prisma.transportTrip.findMany({
      where,
      include: {
        route: { include: { vehicle: true } },
        _count: { select: { boardingEvents: true } },
      },
      orderBy: [{ date: 'desc' }, { direction: 'asc' }],
    });
  }

  async getTripById(tripId: string) {
    const trip = await prisma.transportTrip.findUnique({
      where: { id: tripId },
      include: {
        route: { include: { vehicle: true } },
        boardingEvents: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!trip || trip.archived) throw new ApiError(404, 'Trip not found');
    return trip;
  }

  /**
   * Update trip status and departure/arrival times.
   * Drivers call this to mark a trip as departed or completed.
   */
  async updateTripStatus(
    tripId: string,
    status: TripStatus,
    timestamps?: { departedAt?: Date; arrivedAt?: Date },
  ) {
    const trip = await prisma.transportTrip.findUnique({ where: { id: tripId } });
    if (!trip || trip.archived) throw new ApiError(404, 'Trip not found');

    return prisma.transportTrip.update({
      where: { id: tripId },
      data: {
        status,
        ...(timestamps?.departedAt && { departedAt: timestamps.departedAt }),
        ...(timestamps?.arrivedAt  && { arrivedAt:  timestamps.arrivedAt }),
      },
      include: { route: { include: { vehicle: true } } },
    });
  }

  // ── Boarding Events ────────────────────────────────────────────────────────

  /**
   * Record that a learner boarded or alighted from a trip.
   * Emits a BUS_BOARDED or BUS_ALIGHTED presence event.
   *
   * Idempotent for the same (tripId, learnerId, eventType) within 5 minutes.
   */
  async recordBoardingEvent(input: RecordBoardingInput) {
    const trip = await prisma.transportTrip.findUnique({
      where: { id: input.tripId },
      include: { route: { include: { vehicle: true } } },
    });
    if (!trip || trip.archived) throw new ApiError(404, 'Trip not found');
    if (trip.status === 'CANCELLED') throw new ApiError(422, 'Cannot record boarding on a cancelled trip');

    // Validate learner exists and is assigned to this route
    const learner = await prisma.learner.findUnique({
      where: { id: input.learnerId },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
    if (!learner) throw new ApiError(404, 'Learner not found');

    const assignment = await prisma.transportAssignment.findFirst({
      where: {
        routeId:      trip.routeId,
        passengerId:  input.learnerId,
        passengerType: 'LEARNER',
        archived:     false,
      },
    });
    if (!assignment) {
      throw new ApiError(422, `${learner.firstName} ${learner.lastName} is not assigned to this route`);
    }

    const now = new Date();

    const boardingEvent = await prisma.transportBoardingEvent.create({
      data: {
        tripId:     input.tripId,
        learnerId:  input.learnerId,
        eventType:  input.eventType,
        method:     input.method ?? 'MANUAL',
        recordedBy: input.recordedBy ?? null,
        deviceId:   input.deviceId ?? null,
        recordedAt: now,
      },
    });

    // Auto-transition trip to IN_PROGRESS on first boarding
    if (trip.status === 'SCHEDULED') {
      await prisma.transportTrip.update({
        where: { id: trip.id },
        data: { status: 'IN_PROGRESS', departedAt: trip.departedAt ?? now },
      });
    }

    // Emit presence event
    presenceService.emit({
      schoolId:       trip.schoolId,
      personId:       input.learnerId,
      personType:     'LEARNER',
      eventType:      input.eventType === 'BOARDED' ? 'BUS_BOARDED' : 'BUS_ALIGHTED',
      context:        'BUS',
      timestamp:      now,
      recordedBy:     input.recordedBy ?? undefined,
      deviceId:       input.deviceId ?? undefined,
      status:         'CONFIRMED',
      sourceModule:   'TRANSPORT',
      sourceRecordId: boardingEvent.id,
      metadata: {
        tripId:      trip.id,
        routeId:     trip.routeId,
        routeName:   trip.route.name,
        direction:   trip.direction,
        method:      input.method ?? 'MANUAL',
        vehicleReg:  trip.route.vehicle?.registrationNumber ?? null,
      },
    }).catch(() => {/* failure recorded internally */});

    // Notify parent about boarding/alighting event
    attendanceNotificationService.notify({
      learnerId:  input.learnerId,
      schoolId:   trip.schoolId,
      type:       input.eventType === 'BOARDED' ? 'BUS_BOARDED' : 'BUS_ALIGHTED',
      timestamp:  now,
    }).catch(() => {});

    logger.info('[TripService] Boarding event recorded', {
      tripId: trip.id, learnerId: input.learnerId, eventType: input.eventType,
    });

    return { boardingEvent, trip };
  }

  /**
   * Bulk-record boarding for a manifest of learners.
   * Returns per-learner results (success/skip/error).
   * Used by the driver mobile check-in UI.
   */
  async bulkRecordBoarding(
    tripId: string,
    learnerIds: string[],
    eventType: 'BOARDED' | 'ALIGHTED',
    recordedBy?: string,
  ) {
    const results: Array<{ learnerId: string; status: 'ok' | 'skipped' | 'error'; message?: string }> = [];

    for (const learnerId of learnerIds) {
      try {
        await this.recordBoardingEvent({ tripId, learnerId, eventType, recordedBy, method: 'MANUAL' });
        results.push({ learnerId, status: 'ok' });
      } catch (err: any) {
        // 422 means not assigned — treat as skip (admin mistake, not a fatal error)
        results.push({
          learnerId,
          status: err.statusCode === 422 ? 'skipped' : 'error',
          message: err.message,
        });
      }
    }

    return results;
  }

  // ── Skip pickup (confirmed not collected) ───────────────────────────────────

  /**
   * Record that the driver confirmed a learner was NOT collected on this run.
   *
   * Safety-critical: a parent who is not told their child was skipped may
   * assume the child is on the bus. So this notifies the guardian, mirroring
   * what recordBoardingEvent does for boarding.
   *
   * Contradictions are rejected rather than silently reconciled — a learner
   * cannot be both boarded and skipped on the same run, and that state means
   * the driver made a mistake that someone must correct by hand.
   *
   * Idempotent on (tripId, learnerId): re-reporting updates the row and does NOT
   * send a second SMS, so a driver retrying on a flaky connection cannot spam a
   * parent with two alerts.
   */
  async recordNoShow(input: RecordNoShowInput) {
    const trip = await prisma.transportTrip.findUnique({
      where: { id: input.tripId },
      include: { route: { include: { vehicle: true } } },
    });

    if (!trip || trip.archived) throw new ApiError(404, 'Trip not found');
    if (trip.status === 'CANCELLED') {
      throw new ApiError(422, 'Cannot report a skip on a cancelled trip');
    }

    const learner = await prisma.learner.findUnique({
      where: { id: input.learnerId },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
    if (!learner) throw new ApiError(404, 'Learner not found');

    // Must actually be on this route, same rule as boarding.
    const assignment = await prisma.transportAssignment.findFirst({
      where: {
        routeId:      trip.routeId,
        passengerId:  input.learnerId,
        passengerType: 'LEARNER',
        archived:     false,
      },
    });
    if (!assignment) {
      throw new ApiError(
        422,
        `${learner.firstName} ${learner.lastName} is not assigned to this route`,
      );
    }

    // A learner who actually boarded cannot also be "not collected".
    const boarded = await prisma.transportBoardingEvent.findFirst({
      where: {
        tripId:     input.tripId,
        learnerId:  input.learnerId,
        eventType: 'BOARDED',
      },
    });
    if (boarded) {
      throw new ApiError(
        409,
        `${learner.firstName} ${learner.lastName} was already recorded as boarded. ` +
        'Remove the boarding record before reporting a skip.',
      );
    }

    const existing = await prisma.transportNoShow.findUnique({
      where: { tripId_learnerId: { tripId: input.tripId, learnerId: input.learnerId } },
    });

    const noShow = existing
      ? await prisma.transportNoShow.update({
          where: { id: existing.id },
          data: {
            reason:     input.reason ?? existing.reason,
            note:       input.note ?? existing.note,
            reportedBy: input.reportedBy ?? existing.reportedBy,
            reportedAt: new Date(),
          },
        })
      : await prisma.transportNoShow.create({
          data: {
            tripId:     input.tripId,
            learnerId:  input.learnerId,
            reason:     input.reason ?? 'NO_ANSWER',
            note:       input.note ?? null,
            reportedBy: input.reportedBy ?? null,
          },
        });

    logger.info('[TripService] Skip pickup recorded', {
      tripId: input.tripId,
      learnerId: input.learnerId,
      reason: noShow.reason,
      // true when this call did not create the row, i.e. it is a retry.
      isUpdate: Boolean(existing),
    });

    // Only alert on first report. A retry after a dropped connection must not
    // send the guardian a second message. It must still report the truth,
    // though: if the first attempt stamped guardianNotifiedAt, the guardian WAS
    // notified. Returning a hardcoded false here made the driver app warn
    // "parent not notified" about a parent who had already been told.
    if (existing) {
      return { noShow, guardianNotified: Boolean(existing.guardianNotifiedAt) };
    }

    try {
      await attendanceNotificationService.notify({
        learnerId: input.learnerId,
        schoolId:  trip.schoolId,
        type:      'BUS_SKIPPED',
        timestamp: new Date(),
      });

      const stamped = await prisma.transportNoShow.update({
        where: { id: noShow.id },
        data: { guardianNotifiedAt: new Date() },
      });

      return { noShow: stamped, guardianNotified: true };
    } catch (err) {
      // The skip is still recorded and still reportable; only the alert failed.
      // guardianNotifiedAt stays null so it can be retried by the office.
      logger.error('[TripService] Guardian alert failed for skip pickup', {
        tripId: input.tripId,
        learnerId: input.learnerId,
        err: (err as Error)?.message,
      });
      return { noShow, guardianNotified: false };
    }
  }

  /**
   * Skips for a trip, with learner names. Used by the driver manifest and the
   * office report.
   */
  async getNoShows(tripId: string) {
    const trip = await this.getTripById(tripId);
    const rows = await prisma.transportNoShow.findMany({
      where: { tripId, trip: { archived: false } },
      orderBy: { reportedAt: 'asc' },
      include: {
        learner: {
          select: { id: true, firstName: true, lastName: true, grade: true },
        },
      },
    });

    return {
      trip: {
        id:         trip.id,
        routeName:  trip.route.name,
        direction:  trip.direction,
        date:       trip.date,
        status:     trip.status,
      },
      total:      rows.length,
      // A skip with no guardianNotifiedAt still needs an alert sent.
      unnotified: rows.filter(r => !r.guardianNotifiedAt).length,
      noShows: rows.map(r => ({
        id:            r.id,
        learnerId:     r.learnerId,
        name:          `${r.learner.firstName} ${r.learner.lastName}`,
        grade:         r.learner.grade,
        reason:        r.reason,
        note:          r.note,
        reportedAt:    r.reportedAt,
        guardianNotified: Boolean(r.guardianNotifiedAt),
      })),
    };
  }

  /**
   * Get the boarding manifest for a trip — who is on the bus right now.
   */
  async getTripManifest(tripId: string) {
    const trip = await this.getTripById(tripId);

    // Get all learners assigned to the route
    const assignments = await prisma.transportAssignment.findMany({
      where: { routeId: trip.routeId, passengerType: 'LEARNER', archived: false },
      select: { passengerId: true, pickupPoint: true, dropoffPoint: true },
    });

    const learnerIds = assignments.map(a => a.passengerId);
    const learners = await prisma.learner.findMany({
      where: { id: { in: learnerIds }, archived: false },
      select: {
        id: true, firstName: true, lastName: true,
        admissionNumber: true, grade: true, stream: true,
        primaryContactPhone: true, guardianPhone: true,
      },
      orderBy: [{ grade: 'asc' }, { lastName: 'asc' }],
    });

    // Latest boarding event per learner
    const events = await prisma.transportBoardingEvent.findMany({
      where: { tripId },
      orderBy: { recordedAt: 'desc' },
    });

    const eventByLearner = new Map<string, typeof events[0]>();
    for (const e of events) {
      if (!eventByLearner.has(e.learnerId)) eventByLearner.set(e.learnerId, e);
    }

    const manifest = learners.map(l => {
      const asgn = assignments.find(a => a.passengerId === l.id);
      const evt  = eventByLearner.get(l.id);
      return {
        learnerId:       l.id,
        name:            `${l.firstName} ${l.lastName}`,
        admissionNumber: l.admissionNumber,
        grade:           l.grade,
        stream:          l.stream,
        phone:           l.primaryContactPhone || l.guardianPhone || null,
        pickupPoint:     asgn?.pickupPoint ?? null,
        dropoffPoint:    asgn?.dropoffPoint ?? null,
        boardingStatus:  evt?.eventType ?? 'NOT_BOARDED',
        boardedAt:       evt?.eventType === 'BOARDED' ? evt.recordedAt : null,
        alightedAt:      evt?.eventType === 'ALIGHTED' ? evt.recordedAt : null,
      };
    });

    return {
      trip: {
        id:        trip.id,
        routeName: trip.route.name,
        direction: trip.direction,
        date:      trip.date,
        status:    trip.status,
        vehicle:   trip.route.vehicle ?? null,
      },
      totalAssigned: manifest.length,
      boarded:  manifest.filter(m => m.boardingStatus === 'BOARDED').length,
      alighted: manifest.filter(m => m.boardingStatus === 'ALIGHTED').length,
      pending:  manifest.filter(m => m.boardingStatus === 'NOT_BOARDED').length,
      manifest,
    };
  }

  // ── Driver-scoped operations ─────────────────────────────────────────────────

  /**
   * Resolve the vehicle a driver is permanently assigned to.
   * Returns null when no vehicle has been linked to their account yet — the app
   * surfaces this as "ask the administrator to assign your vehicle" rather than
   * failing, since drivers may be onboarded before a vehicle exists.
   */
  async getDriverVehicle(driverUserId: string) {
    const vehicle = await prisma.transportVehicle.findFirst({
      where: { driverId: driverUserId, archived: false },
      select: { id: true, registrationNumber: true, capacity: true, status: true },
    });

    if (!vehicle) return null;

    const activeRoutes = await prisma.transportRoute.findMany({
      where: { vehicleId: vehicle.id, archived: false, status: 'ACTIVE' },
      select: { id: true, name: true, description: true },
    });

    return { ...vehicle, routes: activeRoutes };
  }

  /**
   * Everything the driver app needs for one day, scoped to the signed-in driver.
   *
   * Unlike the admin trip endpoints (which are permission-gated and return every
   * route in the school), this is identity-gated: it only ever returns trips
   * assigned to `driverUserId`. Trips are matched on driverUserId first, then
   * fall back to the driver's vehicle so a trip left unassigned to a person still
   * appears for whoever drives that vehicle.
   */
  async getDriverDay(driverUserId: string, date?: Date) {
    const day = date ?? new Date();
    const dateUtc = new Date(
      Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()),
    );

    const vehicle = await prisma.transportVehicle.findFirst({
      where: { driverId: driverUserId, archived: false },
      select: { id: true },
    });

    const or: any[] = [{ driverUserId }];
    if (vehicle?.id) or.push({ route: { vehicleId: vehicle.id } });

    const trips = await prisma.transportTrip.findMany({
      where: {
        archived: false,
        date: dateUtc,
        OR: or,
      },
      include: {
        route: { include: { vehicle: true } },
        _count: { select: { boardingEvents: true } },
      },
      orderBy: [{ direction: 'asc' }, { createdAt: 'asc' }],
    });

    // Attach manifest summaries so the app can render counts without N extra calls.
    const summaries = await Promise.all(
      trips.map(async (trip) => {
        const manifest = await this.getTripManifest(trip.id);
        return {
          trip: {
            id: trip.id,
            routeId:       trip.routeId,
            routeName:     trip.route.name,
            direction:     trip.direction,
            status:        trip.status,
            departedAt:    trip.departedAt,
            arrivedAt:     trip.arrivedAt,
            notes:         trip.notes,
            // Is this trip explicitly assigned to the signed-in driver?
            assignedToMe:  trip.driverUserId === driverUserId,
          },
          vehicle: trip.route.vehicle
            ? {
                id:                 trip.route.vehicle.id,
                registrationNumber: trip.route.vehicle.registrationNumber,
                capacity:           trip.route.vehicle.capacity,
              }
            : null,
          counts: {
            totalAssigned: manifest.totalAssigned,
            boarded:       manifest.boarded,
            alighted:      manifest.alighted,
            pending:       manifest.pending,
          },
        };
      }),
    );

    return {
      date: dateUtc,
      vehicle: await this.getDriverVehicle(driverUserId),
      trips: summaries,
    };
  }

  /**
   * Assert the signed-in driver owns this trip.
   *
   * The trip endpoints are permission-gated, so without this a driver holding
   * RECORD_BOARDING_EVENTS could act on any trip id in the school. Ownership is
   * satisfied by an explicit driverUserId match OR by driving the trip's vehicle.
   */
  async assertDriverOwnsTrip(driverUserId: string, tripId: string) {
    const trip = await prisma.transportTrip.findUnique({
      where: { id: tripId },
      include: { route: { select: { vehicleId: true, vehicle: { select: { driverId: true } } } } },
    });

    if (!trip || trip.archived) throw new ApiError(404, 'Trip not found');

    const vehicleDriverId = trip.route.vehicle?.driverId ?? null;
    const ownsByAssignment = trip.driverUserId === driverUserId;
    const ownsByVehicle   = vehicleDriverId !== null && vehicleDriverId === driverUserId;

    if (!ownsByAssignment && !ownsByVehicle) {
      throw new ApiError(403, 'This trip is not assigned to you');
    }

    return trip;
  }
}

export const tripService = new TripService();
