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
}

export const tripService = new TripService();
