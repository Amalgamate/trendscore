import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

import logger from '../utils/logger';
// ─── helpers ────────────────────────────────────────────────────────────────

/** Resolve the active term + academic year from TermConfig (best-effort). */
async function getActiveTerm(): Promise<{ term: string; academicYear: number } | null> {
    const config = await prisma.termConfig.findFirst({
        where: { isActive: true, archived: false }
    });
    return config ? { term: config.term, academicYear: config.academicYear } : null;
}

export class TransportController {

    // ============================================
    // VEHICLES
    // ============================================

    async getVehicles(req: AuthRequest, res: Response) {
        try {
            const vehicles = await prisma.transportVehicle.findMany({
                where: { archived: false },
                include: { _count: { select: { routes: true } } },
                orderBy: { createdAt: 'desc' }
            });
            res.json({ success: true, data: vehicles });
        } catch (error: any) {
            logger.error('[TransportController] getVehicles:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createVehicle(req: AuthRequest, res: Response) {
        try {
            const { registrationNumber, capacity, driverName, driverPhone } = req.body;

            if (!registrationNumber?.trim()) throw new ApiError(400, 'Registration number is required');
            if (!driverName?.trim())         throw new ApiError(400, 'Driver name is required');
            if (!driverPhone?.trim())        throw new ApiError(400, 'Driver phone number is required');
            if (!capacity || isNaN(Number(capacity))) throw new ApiError(400, 'Valid capacity is required');

            const existing = await prisma.transportVehicle.findUnique({
                where: { registrationNumber: registrationNumber.trim().toUpperCase() }
            });
            if (existing && !existing.archived) throw new ApiError(400, 'Registration number already exists');

            const vehicle = await prisma.transportVehicle.create({
                data: {
                    registrationNumber: registrationNumber.trim().toUpperCase(),
                    capacity: parseInt(capacity),
                    driverName: driverName.trim(),
                    driverPhone: driverPhone?.trim() || null,
                }
            });

            res.status(201).json({ success: true, data: vehicle });
        } catch (error: any) {
            logger.error('[TransportController] createVehicle:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async updateVehicle(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { registrationNumber, capacity, driverName, driverPhone, status } = req.body;

            const existing = await prisma.transportVehicle.findUnique({ where: { id } });
            if (!existing || existing.archived) throw new ApiError(404, 'Vehicle not found');

            // If reg number is changing, check uniqueness
            if (registrationNumber && registrationNumber.trim().toUpperCase() !== existing.registrationNumber) {
                const conflict = await prisma.transportVehicle.findUnique({
                    where: { registrationNumber: registrationNumber.trim().toUpperCase() }
                });
                if (conflict && !conflict.archived) throw new ApiError(400, 'Registration number already in use');
            }

            const updated = await prisma.transportVehicle.update({
                where: { id },
                data: {
                    ...(registrationNumber && { registrationNumber: registrationNumber.trim().toUpperCase() }),
                    ...(capacity           && { capacity: parseInt(capacity) }),
                    ...(driverName         && { driverName: driverName.trim() }),
                    ...(driverPhone !== undefined && { driverPhone: driverPhone?.trim() || null }),
                    ...(status             && { status }),
                }
            });

            res.json({ success: true, data: updated });
        } catch (error: any) {
            logger.error('[TransportController] updateVehicle:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async deleteVehicle(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            await prisma.transportVehicle.update({
                where: { id },
                data: { archived: true }
            });
            res.json({ success: true, message: 'Vehicle archived' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ============================================
    // ROUTES
    // ============================================

    async getRoutes(req: AuthRequest, res: Response) {
        try {
            const routes = await prisma.transportRoute.findMany({
                where: { archived: false },
                include: {
                    vehicle: true,
                    _count: { select: { assignments: { where: { archived: false } } } }
                },
                orderBy: { createdAt: 'desc' }
            });
            res.json({ success: true, data: routes });
        } catch (error: any) {
            logger.error('[TransportController] getRoutes:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createRoute(req: AuthRequest, res: Response) {
        try {
            const { name, description, amount, vehicleId } = req.body;

            if (!name?.trim()) throw new ApiError(400, 'Route name is required');

            // Validate vehicleId if provided
            if (vehicleId) {
                const vehicle = await prisma.transportVehicle.findUnique({ where: { id: vehicleId } });
                if (!vehicle || vehicle.archived) throw new ApiError(400, 'Assigned vehicle not found or archived');
            }

            const route = await prisma.transportRoute.create({
                data: {
                    name: name.trim(),
                    description: description?.trim() || null,
                    amount: amount ?? 0,
                    vehicleId: vehicleId || null
                },
                include: { vehicle: true }
            });

            res.status(201).json({ success: true, data: route });
        } catch (error: any) {
            logger.error('[TransportController] createRoute:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async updateRoute(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { name, description, amount, vehicleId, status } = req.body;

            const existing = await prisma.transportRoute.findUnique({ where: { id } });
            if (!existing || existing.archived) throw new ApiError(404, 'Route not found');

            if (vehicleId !== undefined && vehicleId !== null && vehicleId !== '') {
                const vehicle = await prisma.transportVehicle.findUnique({ where: { id: vehicleId } });
                if (!vehicle || vehicle.archived) throw new ApiError(400, 'Assigned vehicle not found or archived');
            }

            const updated = await prisma.transportRoute.update({
                where: { id },
                data: {
                    ...(name        && { name: name.trim() }),
                    ...(description !== undefined && { description: description?.trim() || null }),
                    ...(amount      !== undefined && { amount }),
                    ...(vehicleId   !== undefined && { vehicleId: vehicleId || null }),
                    ...(status      && { status }),
                },
                include: { vehicle: true }
            });

            res.json({ success: true, data: updated });
        } catch (error: any) {
            logger.error('[TransportController] updateRoute:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async deleteRoute(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            await prisma.transportRoute.update({
                where: { id },
                data: { archived: true }
            });
            res.json({ success: true, message: 'Route archived' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ============================================
    // ASSIGNMENTS & PASSENGERS
    // ============================================

    async getAssignments(req: AuthRequest, res: Response) {
        try {
            const { routeId } = req.params;
            const assignments = await prisma.transportAssignment.findMany({
                where: { routeId, archived: false },
                include: { route: { include: { vehicle: true } } },
                orderBy: { createdAt: 'asc' }
            });

            const learnerIds = assignments
                .filter(a => a.passengerType === 'LEARNER')
                .map(a => a.passengerId);

            const learners = await prisma.learner.findMany({
                where: { id: { in: learnerIds } },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    grade: true,
                    stream: true,
                    primaryContactPhone: true,
                    guardianPhone: true
                }
            });

            const data = assignments.map(a => ({
                ...a,
                passenger: learners.find(l => l.id === a.passengerId) || null
            }));

            res.json({ success: true, data });
        } catch (error: any) {
            logger.error('[TransportController] getAssignments:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /** GET /assignments/learner/:learnerId — look up which route(s) a learner is on */
    async getLearnerAssignments(req: AuthRequest, res: Response) {
        try {
            const { learnerId } = req.params;

            const assignments = await prisma.transportAssignment.findMany({
                where: { passengerId: learnerId, passengerType: 'LEARNER', archived: false },
                include: {
                    route: {
                        include: { vehicle: true }
                    }
                }
            });

            res.json({ success: true, data: assignments });
        } catch (error: any) {
            logger.error('[TransportController] getLearnerAssignments:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createAssignment(req: AuthRequest, res: Response) {
        try {
            const {
                routeId,
                passengerId,
                passengerType = 'LEARNER',
                pickupPoint,
                dropoffPoint
            } = req.body;

            if (!routeId)      throw new ApiError(400, 'routeId is required');
            if (!passengerId)  throw new ApiError(400, 'passengerId is required');

            // Validate passengerType
            const validTypes = ['LEARNER', 'STAFF'];
            if (!validTypes.includes(passengerType)) {
                throw new ApiError(400, `passengerType must be one of: ${validTypes.join(', ')}`);
            }

            // Duplicate check
            const existing = await prisma.transportAssignment.findFirst({
                where: { routeId, passengerId, archived: false }
            });
            if (existing) throw new ApiError(400, 'Student is already assigned to this route');

            // ── Capacity enforcement ──────────────────────────────────────────
            const route = await prisma.transportRoute.findUnique({
                where: { id: routeId },
                include: { vehicle: true }
            });
            if (!route || route.archived) throw new ApiError(404, 'Route not found');

            if (route.vehicle) {
                const currentCount = await prisma.transportAssignment.count({
                    where: { routeId, archived: false }
                });
                if (currentCount >= route.vehicle.capacity) {
                    throw new ApiError(400,
                        `Vehicle ${route.vehicle.registrationNumber} is at full capacity ` +
                        `(${route.vehicle.capacity} seats). Remove a passenger first or assign a larger vehicle.`
                    );
                }
            }

            const result = await prisma.$transaction(async (tx) => {
                const assignment = await tx.transportAssignment.create({
                    data: {
                        routeId,
                        passengerId,
                        passengerType,
                        pickupPoint: pickupPoint?.trim() || null,
                        dropoffPoint: dropoffPoint?.trim() || null
                    }
                });

                // Automark learner as transport student + sync open invoice
                if (passengerType === 'LEARNER') {
                    await tx.learner.update({
                        where: { id: passengerId },
                        data: { isTransportStudent: true }
                    });

                    // ── Mid-term invoice sync (C1 fix) ────────────────────────
                    // If the learner already has an open invoice for the active term,
                    // update its transportBilled / transportBalance fields immediately.
                    if (Number(route.amount) > 0) {
                        const activeTerm = await getActiveTerm();
                        if (activeTerm) {
                            const openInvoice = await tx.feeInvoice.findFirst({
                                where: {
                                    learnerId: passengerId,
                                    term: activeTerm.term as any,
                                    academicYear: activeTerm.academicYear,
                                    archived: false,
                                    status: { in: ['PENDING', 'PARTIAL'] }
                                }
                            });
                            if (openInvoice && Number(openInvoice.transportBilled) === 0) {
                                const transportAmount = Number(route.amount);
                                await tx.feeInvoice.update({
                                    where: { id: openInvoice.id },
                                    data: {
                                        transportBilled:  transportAmount,
                                        transportBalance: transportAmount,
                                        totalAmount:      Number(openInvoice.totalAmount) + transportAmount,
                                        balance:          Number(openInvoice.balance)     + transportAmount,
                                    }
                                });
                            }
                        }
                    }
                }

                return assignment;
            });

            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            logger.error('[TransportController] createAssignment:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async updateAssignment(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { pickupPoint, dropoffPoint } = req.body;

            const existing = await prisma.transportAssignment.findUnique({ where: { id } });
            if (!existing || existing.archived) throw new ApiError(404, 'Assignment not found');

            const updated = await prisma.transportAssignment.update({
                where: { id },
                data: {
                    ...(pickupPoint  !== undefined && { pickupPoint:  pickupPoint?.trim()  || null }),
                    ...(dropoffPoint !== undefined && { dropoffPoint: dropoffPoint?.trim() || null }),
                }
            });

            res.json({ success: true, data: updated });
        } catch (error: any) {
            logger.error('[TransportController] updateAssignment:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async deleteAssignment(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            const assignment = await prisma.transportAssignment.findUnique({ where: { id } });
            if (!assignment) throw new ApiError(404, 'Assignment not found');

            const { passengerId, passengerType } = assignment;

            await prisma.$transaction(async (tx) => {
                await tx.transportAssignment.update({
                    where: { id },
                    data: { archived: true, status: 'INACTIVE' }
                });

                if (passengerType === 'LEARNER') {
                    const otherAssignmentsCount = await tx.transportAssignment.count({
                        where: { passengerId, passengerType: 'LEARNER', archived: false }
                    });

                    if (otherAssignmentsCount === 0) {
                        await tx.learner.update({
                            where: { id: passengerId },
                            data: { isTransportStudent: false }
                        });
                    }
                }
            });

            res.json({ success: true, message: 'Assignment removed' });
        } catch (error: any) {
            logger.error('[TransportController] deleteAssignment:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    // ============================================
    // SUMMARY / STATS
    // ============================================

    async getSummary(req: AuthRequest, res: Response) {
        try {
            const [vehicleCount, routeCount, assignmentCount, transportStudentCount] = await Promise.all([
                prisma.transportVehicle.count({ where: { archived: false } }),
                prisma.transportRoute.count({ where: { archived: false } }),
                prisma.transportAssignment.count({ where: { archived: false } }),
                prisma.learner.count({ where: { isTransportStudent: true, archived: false } })
            ]);

            const routesWithCapacity = await prisma.transportRoute.findMany({
                where: { archived: false },
                include: {
                    vehicle: true,
                    _count: { select: { assignments: { where: { archived: false } } } }
                }
            });

            const overCapacity = routesWithCapacity.filter(r =>
                r.vehicle && r._count.assignments > r.vehicle.capacity
            );

            res.json({
                success: true,
                data: {
                    vehicleCount,
                    routeCount,
                    assignmentCount,
                    transportStudentCount,
                    overCapacityRoutes: overCapacity.map(r => ({
                        id: r.id,
                        name: r.name,
                        assigned: r._count.assignments,
                        capacity: r.vehicle!.capacity
                    }))
                }
            });
        } catch (error: any) {
            logger.error('[TransportController] getSummary:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ============================================
    // REPORTS
    // ============================================

    async getReports(req: AuthRequest, res: Response) {
        try {
            // ── 1. Fleet overview ────────────────────────────────────────────
            const vehicles = await prisma.transportVehicle.findMany({
                where: { archived: false },
                include: {
                    routes: {
                        where: { archived: false },
                        include: {
                            _count: { select: { assignments: { where: { archived: false } } } }
                        }
                    }
                }
            });

            // ── 2. Routes with billing data ──────────────────────────────────
            const routes = await prisma.transportRoute.findMany({
                where: { archived: false },
                include: {
                    vehicle: true,
                    assignments: {
                        where: { archived: false },
                        select: { passengerId: true, passengerType: true, pickupPoint: true, dropoffPoint: true }
                    }
                },
                orderBy: { name: 'asc' }
            });

            // ── 3. Transport billing from fee invoices ───────────────────────
            const invoices = await prisma.feeInvoice.findMany({
                where: { archived: false, transportBilled: { gt: 0 } },
                select: {
                    transportBilled: true,
                    transportPaid: true,
                    transportBalance: true,
                    learnerId: true,
                    term: true,
                    academicYear: true,
                    status: true
                }
            });

            // ── 4. All transport learner IDs for grade distribution ──────────
            const allAssignments = await prisma.transportAssignment.findMany({
                where: { archived: false, passengerType: 'LEARNER' },
                select: { passengerId: true, routeId: true, pickupPoint: true, dropoffPoint: true }
            });

            const learnerIds = [...new Set(allAssignments.map(a => a.passengerId))];

            const learners = await prisma.learner.findMany({
                where: { id: { in: learnerIds }, archived: false },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    grade: true,
                    stream: true,
                    primaryContactPhone: true,
                    guardianPhone: true
                }
            });

            // ── 5. Compute route utilisation rows ────────────────────────────
            const routeRows = routes.map(r => {
                const capacity   = r.vehicle?.capacity ?? null;
                const assigned   = r.assignments.length;
                const fillPct    = capacity ? Math.round((assigned / capacity) * 100) : null;

                // billing from invoices for learners on this route
                const routeLearnerIds = r.assignments.map(a => a.passengerId);
                const routeInvoices   = invoices.filter(i => routeLearnerIds.includes(i.learnerId));
                const billed     = routeInvoices.reduce((s, i) => s + Number(i.transportBilled),  0);
                const collected  = routeInvoices.reduce((s, i) => s + Number(i.transportPaid),    0);
                const outstanding = routeInvoices.reduce((s, i) => s + Number(i.transportBalance), 0);

                return {
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    feePerTerm: Number(r.amount),
                    vehicle: r.vehicle ? {
                        registrationNumber: r.vehicle.registrationNumber,
                        driverName: r.vehicle.driverName,
                        driverPhone: r.vehicle.driverPhone,
                        capacity: r.vehicle.capacity,
                        status: r.vehicle.status
                    } : null,
                    capacity,
                    assigned,
                    fillPct,
                    isFull: capacity !== null && assigned >= capacity,
                    billing: { billed, collected, outstanding,
                        collectionRate: billed > 0 ? Math.round((collected / billed) * 100) : 0 }
                };
            });

            // ── 6. Grade distribution ────────────────────────────────────────
            const gradeMap: Record<string, number> = {};
            learners.forEach(l => {
                gradeMap[l.grade] = (gradeMap[l.grade] || 0) + 1;
            });
            const gradeDistribution = Object.entries(gradeMap)
                .map(([grade, count]) => ({ grade, count }))
                .sort((a, b) => a.grade.localeCompare(b.grade));

            // ── 7. Full student roster ───────────────────────────────────────
            const routeById = Object.fromEntries(routes.map(r => [r.id, r]));
            const roster = allAssignments.map(a => {
                const learner = learners.find(l => l.id === a.passengerId);
                const route   = routeById[a.routeId];
                return learner ? {
                    learnerId:       learner.id,
                    admissionNumber: learner.admissionNumber,
                    name:            `${learner.firstName} ${learner.lastName}`,
                    grade:           learner.grade,
                    stream:          learner.stream,
                    phone:           learner.primaryContactPhone || learner.guardianPhone || null,
                    routeId:         a.routeId,
                    routeName:       route?.name ?? 'Unknown',
                    feePerTerm:      Number(route?.amount ?? 0),
                    driverName:      route?.vehicle?.driverName ?? null,
                    driverPhone:     route?.vehicle?.driverPhone ?? null,
                    vehicle:         route?.vehicle?.registrationNumber ?? null,
                    pickupPoint:     a.pickupPoint,
                    dropoffPoint:    a.dropoffPoint
                } : null;
            }).filter(Boolean).sort((a: any, b: any) => a.grade.localeCompare(b.grade) || a.name.localeCompare(b.name));

            // ── 8. Billing totals ────────────────────────────────────────────
            const billingTotals: {
                totalBilled: number;
                totalCollected: number;
                totalOutstanding: number;
                collectionRate?: number;
            } = {
                totalBilled:      invoices.reduce((s, i) => s + Number(i.transportBilled),  0),
                totalCollected:   invoices.reduce((s, i) => s + Number(i.transportPaid),    0),
                totalOutstanding: invoices.reduce((s, i) => s + Number(i.transportBalance), 0),
            };
            billingTotals['collectionRate'] = billingTotals.totalBilled > 0
                ? Math.round((billingTotals.totalCollected / billingTotals.totalBilled) * 100)
                : 0;

            // ── 9. Fleet summary ─────────────────────────────────────────────
            const fleetSummary = {
                totalVehicles:  vehicles.length,
                totalCapacity:  vehicles.reduce((s, v) => s + (v.capacity ?? 0), 0),
                totalAssigned:  allAssignments.length,
                totalRoutes:    routes.length,
                totalStudents:  learnerIds.length,
                overCapacity:   routeRows.filter(r => r.isFull).length
            };

            res.json({
                success: true,
                data: {
                    fleetSummary,
                    billingTotals,
                    routeUtilisation: routeRows,
                    gradeDistribution,
                    roster
                }
            });
        } catch (error: any) {
            logger.error('[TransportController] getReports:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const transportController = new TransportController();
