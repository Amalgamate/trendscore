import { Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { EventType } from '@prisma/client';
import { broadcastKeyDatesChanged } from '../services/keyDates.service';
import { assertClassIdsExist, buildEventVisibilityWhere, resolveAudienceFields } from '../services/eventVisibility.service';

export class PlannerController {
    /**
     * Get all events for the school
     */
    async getEvents(req: AuthRequest, res: Response) {
        const { start, end, type, academicYear, term, isParentVisible } = req.query;

        const where: any = {};

        if (start && end) {
            const rangeStart = new Date(start as string);
            const rangeEnd = new Date(end as string);
            if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
                throw new ApiError(400, 'A valid start and end date range is required');
            }
            where.AND = [
                { startDate: { lte: rangeEnd } },
                { endDate: { gte: rangeStart } },
            ];
        }

        if (type) {
            where.type = type as EventType;
        }

        if (academicYear) {
            where.academicYear = parseInt(academicYear as string, 10);
        }

        if (term) {
            where.term = term as string;
        }

        const visibility = await buildEventVisibilityWhere(req.user as any);
        Object.assign(where, visibility);
        if (isParentVisible !== undefined && where.isParentVisible === undefined) {
            where.isParentVisible = isParentVisible === 'true';
        }

        const events = await prisma.event.findMany({
            where,
            include: {
                creator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: { startDate: 'asc' },
        });

        res.json({ success: true, data: events });
    }

    /**
     * Create a new event
     */
    async createEvent(req: AuthRequest, res: Response) {
        const userId = req.user!.userId;
        const { title, description, startDate, endDate, allDay, type, location, meetingLink, isParentVisible, audience, classIds, academicYear, term } = req.body;

        if (!title) throw new ApiError(400, 'Title is required');
        if (!startDate || !endDate) throw new ApiError(400, 'Start and End dates are required');

        // Valid types validation
        const validTypes = Object.values(EventType);
        if (type && !validTypes.includes(type)) {
            throw new ApiError(400, `Invalid event type. Must be one of: ${validTypes.join(', ')}`);
        }

        const targeting = resolveAudienceFields({ audience, classIds, isParentVisible });
        await assertClassIdsExist(targeting.classIds);

        const event = await prisma.event.create({
            data: {
                title,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                allDay: allDay || false,
                type: (type as EventType) || 'GENERAL',
                location,
                meetingLink,
                creatorId: userId,
                isParentVisible: targeting.isParentVisible,
                audience: targeting.audience,
                classIds: targeting.classIds,
                academicYear: academicYear ? parseInt(academicYear.toString(), 10) : null,
                term: term || null,
            },
        });

        broadcastKeyDatesChanged();
        res.status(201).json({ success: true, data: event });
    }

    /**
     * Update an event
     */
    async updateEvent(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { title, description, startDate, endDate, allDay, type, location, meetingLink, isParentVisible, audience, classIds, academicYear, term } = req.body;

        const existingEvent = await prisma.event.findUnique({ where: { id } });

        if (!existingEvent) throw new ApiError(404, 'Event not found');

        const targeting = resolveAudienceFields({ audience, classIds, isParentVisible }, existingEvent);
        await assertClassIdsExist(targeting.classIds);

        const event = await prisma.event.update({
            where: { id },
            data: {
                title,
                description,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                allDay,
                type: type as EventType,
                location,
                meetingLink,
                isParentVisible: targeting.isParentVisible,
                audience: targeting.audience,
                classIds: targeting.classIds,
                academicYear: academicYear !== undefined ? (academicYear ? parseInt(academicYear.toString(), 10) : null) : undefined,
                term: term !== undefined ? term : undefined,
            },
        });

        broadcastKeyDatesChanged();
        res.json({ success: true, data: event });
    }

    /**
     * Delete an event
     */
    async deleteEvent(req: AuthRequest, res: Response) {
        const { id } = req.params;

        const existingEvent = await prisma.event.findUnique({ where: { id } });

        if (!existingEvent) throw new ApiError(404, 'Event not found');

        await prisma.event.delete({ where: { id } });

        broadcastKeyDatesChanged();
        res.json({ success: true, message: 'Event deleted successfully' });
    }

    /**
     * Bulk create/update annual events
     */
    async bulkCreateAnnualPlan(req: AuthRequest, res: Response) {
        const userId = req.user!.userId;
        const { events } = req.body;

        if (!Array.isArray(events)) {
            throw new ApiError(400, 'Events must be an array');
        }

        const createdOrUpdated: any[] = [];

        await prisma.$transaction(async (tx) => {
            for (const eventData of events) {
                const { id, title, description, startDate, endDate, allDay, type, location, meetingLink, isParentVisible, audience, classIds, academicYear, term } = eventData;

                if (!title) throw new ApiError(400, 'Title is required for all events');
                if (!startDate || !endDate) throw new ApiError(400, 'Start and End dates are required for all events');

                const dataPayload: any = {
                    title,
                    description,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    allDay: allDay || false,
                    type: (type as EventType) || 'GENERAL',
                    location,
                    meetingLink,
                    academicYear: academicYear ? parseInt(academicYear.toString(), 10) : null,
                    term: term || null,
                    creatorId: userId,
                };

                let existingEvent = null;

                if (id) {
                    existingEvent = await tx.event.findUnique({ where: { id } });
                } else if (academicYear && term && ['TERM_OPENING', 'TERM_CLOSING', 'MIDTERM_BREAK', 'EXAM_WEEK'].includes(type)) {
                    existingEvent = await tx.event.findFirst({
                        where: {
                            academicYear: parseInt(academicYear.toString(), 10),
                            term: term as string,
                            type: type as EventType,
                        }
                    });
                }

                const targeting = resolveAudienceFields({ audience, classIds, isParentVisible }, existingEvent || undefined);
                await assertClassIdsExist(targeting.classIds);
                const audienceData = {
                    isParentVisible: targeting.isParentVisible,
                    audience: targeting.audience,
                    classIds: targeting.classIds,
                };

                if (existingEvent) {
                    const updated = await tx.event.update({
                        where: { id: existingEvent.id },
                        data: {
                            ...dataPayload,
                            ...audienceData,
                            creatorId: undefined,
                        }
                    });
                    createdOrUpdated.push(updated);
                } else {
                    const created = await tx.event.create({
                        data: { ...dataPayload, ...audienceData }
                    });
                    createdOrUpdated.push(created);
                }
            }
        });

        broadcastKeyDatesChanged();
        res.status(200).json({ success: true, data: createdOrUpdated });
    }

    /**
     * Get annual summary of events grouped by term
     */
    async getAnnualSummary(req: AuthRequest, res: Response) {
        const { academicYear } = req.query;

        if (!academicYear) {
            throw new ApiError(400, 'Academic year is required');
        }

        const year = parseInt(academicYear as string, 10);
        if (isNaN(year)) {
            throw new ApiError(400, 'Invalid academic year');
        }

        const where: any = { academicYear: year };
        Object.assign(where, await buildEventVisibilityWhere(req.user as any));

        const events = await prisma.event.findMany({
            where,
            orderBy: { startDate: 'asc' },
        });

        const grouped: Record<string, any[]> = {
            TERM_1: [],
            TERM_2: [],
            TERM_3: [],
            OTHER: [],
        };

        events.forEach(event => {
            const t = event.term;
            if (t === 'TERM_1' || t === 'TERM_2' || t === 'TERM_3') {
                grouped[t].push(event);
            } else {
                grouped.OTHER.push(event);
            }
        });

        res.json({ success: true, data: grouped });
    }
}
