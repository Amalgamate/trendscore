import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

import logger from '../utils/logger';
import { accountingService } from '../services/accounting.service';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Resolve the active term + academic year from TermConfig (best-effort). */
async function getActiveTerm(): Promise<{ term: string; academicYear: number } | null> {
    const config = await prisma.termConfig.findFirst({
        where: { isActive: true, archived: false }
    });
    return config ? { term: config.term, academicYear: config.academicYear } : null;
}

/** Get a unique, sequential invoice number for the academic year. */
async function getSafeInvoiceNumber(academicYear: number): Promise<string> {
    for (let i = 0; i < 10; i++) {
        const count = await prisma.feeInvoice.count({
            where: { academicYear }
        });
        const num = `INV-${academicYear}-${String(count + 1 + i).padStart(6, '0')}`;
        const exists = await prisma.feeInvoice.findUnique({ where: { invoiceNumber: num } });
        if (!exists) return num;
    }
    return `INV-${academicYear}-${Date.now().toString().slice(-6)}`;
}

/** Ensure a FeeStructure exists for creating standalone transport invoices. */
async function getOrCreateFeeStructure(academicYear: number, term: string, grade?: string | null) {
    let feeStructure = await prisma.feeStructure.findFirst({
        where: {
            academicYear,
            archived: false,
            ...(grade ? { grade: grade as any } : {})
        },
        orderBy: { createdAt: 'desc' }
    });

    if (!feeStructure) {
        feeStructure = await prisma.feeStructure.findFirst({
            where: { academicYear, archived: false },
            orderBy: { createdAt: 'desc' }
        });
    }

    if (!feeStructure) {
        feeStructure = await prisma.feeStructure.findFirst({
            where: { archived: false },
            orderBy: { createdAt: 'desc' }
        });
    }

    if (!feeStructure) {
        feeStructure = await prisma.feeStructure.create({
            data: {
                name: `Transport Services Fee Structure ${academicYear}`,
                academicYear,
                term: term as any,
                active: true,
                mandatory: false
            }
        });
    }

    return feeStructure;
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
            // Source of truth: isTransportStudent flag, NOT assignments.
            // A student may be marked as a transport student before being assigned
            // to a route, or may have been admitted with the flag set manually.
            const allAssignments = await prisma.transportAssignment.findMany({
                where: { archived: false, passengerType: 'LEARNER' },
                select: { passengerId: true, routeId: true, pickupPoint: true, dropoffPoint: true }
            });

            const learners = await prisma.learner.findMany({
                where: { isTransportStudent: true, archived: false },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    grade: true,
                    stream: true,
                    primaryContactPhone: true,
                    guardianPhone: true
                },
                orderBy: [{ grade: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }]
            });

            const learnerIds = learners.map(l => l.id);

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
            // Iterate all transport students (by flag), merging in route data
            // where an assignment exists. Students with no assignment yet still
            // appear — they're transport students without a route.
            const routeById = Object.fromEntries(routes.map(r => [r.id, r]));
            const assignmentByLearner = new Map(allAssignments.map(a => [a.passengerId, a]));
            const roster = learners.map(learner => {
                const assignment = assignmentByLearner.get(learner.id);
                const route      = assignment ? routeById[assignment.routeId] : null;
                return {
                    learnerId:       learner.id,
                    admissionNumber: learner.admissionNumber,
                    name:            `${learner.firstName} ${learner.lastName}`,
                    grade:           learner.grade,
                    stream:          learner.stream,
                    phone:           learner.primaryContactPhone || learner.guardianPhone || null,
                    routeId:         assignment?.routeId ?? null,
                    routeName:       route?.name ?? null,
                    feePerTerm:      Number(route?.amount ?? 0),
                    driverName:      route?.vehicle?.driverName ?? null,
                    driverPhone:     route?.vehicle?.driverPhone ?? null,
                    vehicle:         route?.vehicle?.registrationNumber ?? null,
                    pickupPoint:     assignment?.pickupPoint ?? null,
                    dropoffPoint:    assignment?.dropoffPoint ?? null,
                };
            });

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
                totalStudents:  learners.length,
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

    // ============================================
    // TRANSPORT FEE ROSTER & INVOICING
    // ============================================

    /**
     * GET /api/transport/fee-roster
     * Returns all marked transport students along with their active term invoice/billing status
     * and computed summary KPIs.
     */
    async getFeeRoster(req: AuthRequest, res: Response) {
        try {
            const active = await getActiveTerm();
            const term = (req.query.term as string) || active?.term || 'TERM_1';
            const academicYear = parseInt((req.query.academicYear as string) || String(active?.academicYear || 2026), 10);

            // 1. Get active route assignments
            const assignments = await prisma.transportAssignment.findMany({
                where: { archived: false, passengerType: 'LEARNER' },
                include: {
                    route: {
                        include: { vehicle: true }
                    }
                }
            });
            const assignmentByPassengerId = new Map(assignments.map(a => [a.passengerId, a]));
            const assignedLearnerIds = assignments.map(a => a.passengerId);

            // 2. Get all transport learners
            const learners = await prisma.learner.findMany({
                where: {
                    archived: false,
                    OR: [
                        { isTransportStudent: true },
                        { id: { in: assignedLearnerIds } }
                    ]
                },
                select: {
                    id: true,
                    admissionNumber: true,
                    firstName: true,
                    lastName: true,
                    grade: true,
                    stream: true,
                    isTransportStudent: true,
                    primaryContactPhone: true,
                    guardianPhone: true,
                    primaryContactName: true
                },
                orderBy: [{ grade: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }]
            });

            // 3. Invoices for these learners for the term/academicYear
            const invoices = await prisma.feeInvoice.findMany({
                where: {
                    learnerId: { in: learners.map(l => l.id) },
                    term: term as any,
                    academicYear,
                    archived: false
                },
                select: {
                    id: true,
                    learnerId: true,
                    invoiceNumber: true,
                    dueDate: true,
                    status: true,
                    totalAmount: true,
                    balance: true,
                    paidAmount: true,
                    transportBilled: true,
                    transportPaid: true,
                    transportBalance: true
                }
            });
            const invoiceByLearnerId = new Map(invoices.map(i => [i.learnerId, i]));

            // 4. Map each learner with billing status
            const roster = learners.map(learner => {
                const assignment = assignmentByPassengerId.get(learner.id);
                const route = assignment?.route;
                const invoice = invoiceByLearnerId.get(learner.id);

                const routeAmount = Number(route?.amount || 0);
                const billed = invoice ? Number(invoice.transportBilled || 0) : 0;
                const paid = invoice ? Number(invoice.transportPaid || 0) : 0;
                const balance = invoice ? Number(invoice.transportBalance || 0) : 0;
                const isBilled = invoice !== undefined && billed > 0;

                let transportStatus: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'UNBILLED';
                if (!isBilled) {
                    transportStatus = 'UNBILLED';
                } else if (balance <= 0) {
                    transportStatus = 'PAID';
                } else if (paid > 0) {
                    transportStatus = 'PARTIAL';
                } else if (invoice?.dueDate && new Date(invoice.dueDate) < new Date()) {
                    transportStatus = 'OVERDUE';
                } else {
                    transportStatus = 'PENDING';
                }

                return {
                    learner,
                    route: route ? {
                        id: route.id,
                        name: route.name,
                        amount: routeAmount,
                        vehicle: route.vehicle ? {
                            id: route.vehicle.id,
                            registrationNumber: route.vehicle.registrationNumber,
                            driverName: route.vehicle.driverName
                        } : null
                    } : null,
                    pickupPoint: assignment?.pickupPoint || null,
                    dropoffPoint: assignment?.dropoffPoint || null,
                    invoice: invoice ? {
                        id: invoice.id,
                        invoiceNumber: invoice.invoiceNumber,
                        dueDate: invoice.dueDate,
                        totalAmount: Number(invoice.totalAmount),
                        balance: Number(invoice.balance),
                        transportBilled: billed,
                        transportPaid: paid,
                        transportBalance: balance
                    } : null,
                    billed,
                    paid,
                    balance,
                    expectedFee: billed > 0 ? billed : routeAmount,
                    status: transportStatus,
                    isBilled
                };
            });

            // 5. Summary metrics
            const totalStudents = roster.length;
            const billedStudents = roster.filter(r => r.isBilled).length;
            const unbilledStudents = totalStudents - billedStudents;
            const totalBilled = roster.reduce((s, r) => s + r.billed, 0);
            const totalCollected = roster.reduce((s, r) => s + r.paid, 0);
            const totalOutstanding = roster.reduce((s, r) => s + r.balance, 0);
            const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

            res.json({
                success: true,
                data: {
                    term,
                    academicYear,
                    summary: {
                        totalStudents,
                        billedStudents,
                        unbilledStudents,
                        totalBilled,
                        totalCollected,
                        totalOutstanding,
                        collectionRate
                    },
                    roster
                }
            });
        } catch (error: any) {
            logger.error('[TransportController] getFeeRoster:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/transport/fee-roster/bill
     * Bills transport fee for a single student, creating or updating their fee invoice
     * and posting to the Transport Fees Income account (4100).
     */
    async billSingleLearner(req: AuthRequest, res: Response) {
        try {
            const { learnerId, term, academicYear, amount, dueDate, routeId, pickupPoint } = req.body;
            if (!learnerId || !term || !academicYear || amount === undefined) {
                throw new ApiError(400, 'learnerId, term, academicYear, and amount are required');
            }

            const billAmount = Number(amount);
            if (isNaN(billAmount) || billAmount < 0) {
                throw new ApiError(400, 'amount must be a non-negative number');
            }

            const learner = await prisma.learner.findUnique({
                where: { id: learnerId }
            });
            if (!learner || learner.archived) {
                throw new ApiError(404, 'Learner not found or is archived');
            }

            // Ensure learner has isTransportStudent flag set
            if (!learner.isTransportStudent) {
                await prisma.learner.update({
                    where: { id: learnerId },
                    data: { isTransportStudent: true }
                });
            }

            // If routeId provided, manage route assignment
            if (routeId) {
                const existingAssignment = await prisma.transportAssignment.findFirst({
                    where: { passengerId: learnerId, archived: false }
                });
                if (existingAssignment) {
                    await prisma.transportAssignment.update({
                        where: { id: existingAssignment.id },
                        data: { routeId, ...(pickupPoint ? { pickupPoint } : {}) }
                    });
                } else {
                    await prisma.transportAssignment.create({
                        data: {
                            passengerId: learnerId,
                            passengerType: 'LEARNER',
                            routeId,
                            pickupPoint: pickupPoint || undefined
                        }
                    });
                }
            }

            const normalizedYear = parseInt(String(academicYear), 10);
            const invoiceDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            // Check if invoice exists for this term/year
            const existingInvoice = await prisma.feeInvoice.findFirst({
                where: {
                    learnerId,
                    term: term as any,
                    academicYear: normalizedYear,
                    archived: false
                }
            });

            let invoice: any;
            if (existingInvoice) {
                const oldTransportBilled = Number(existingInvoice.transportBilled || 0);
                const oldTransportPaid = Number(existingInvoice.transportPaid || 0);
                const diff = billAmount - oldTransportBilled;
                const newTotal = Math.max(0, Number(existingInvoice.totalAmount) + diff);
                const newTransportBalance = Math.max(0, billAmount - oldTransportPaid);
                const newBalance = Math.max(0, Number(existingInvoice.balance) + diff);
                const newStatus = newBalance <= 0 ? 'PAID' : Number(existingInvoice.paidAmount) > 0 ? 'PARTIAL' : 'PENDING';

                invoice = await prisma.feeInvoice.update({
                    where: { id: existingInvoice.id },
                    data: {
                        transportBilled: billAmount,
                        transportBalance: newTransportBalance,
                        totalAmount: newTotal,
                        balance: newBalance,
                        status: newStatus as any,
                        ...(dueDate ? { dueDate: invoiceDueDate } : {})
                    },
                    include: { learner: true }
                });
            } else {
                const feeStructure = await getOrCreateFeeStructure(normalizedYear, term, learner.grade);
                const invoiceNumber = await getSafeInvoiceNumber(normalizedYear);

                invoice = await prisma.feeInvoice.create({
                    data: {
                        invoiceNumber,
                        learnerId,
                        feeStructureId: feeStructure.id,
                        term: term as any,
                        academicYear: normalizedYear,
                        dueDate: invoiceDueDate,
                        totalAmount: billAmount,
                        paidAmount: 0,
                        balance: billAmount,
                        transportBilled: billAmount,
                        transportPaid: 0,
                        transportBalance: billAmount,
                        studentAmount: billAmount,
                        grossAmount: billAmount,
                        status: billAmount === 0 ? 'PAID' : 'PENDING',
                        issuedBy: req.user?.userId || 'SYSTEM'
                    },
                    include: { learner: true }
                });
            }

            // Post to ledger crediting 4100
            setImmediate(async () => {
                try {
                    await accountingService.postFeeInvoiceToLedger(invoice);
                } catch (e) {
                    logger.error('[TransportController] postFeeInvoiceToLedger error:', e);
                }
            });

            res.json({
                success: true,
                message: `Transport fee of KES ${billAmount.toLocaleString()} billed successfully for ${learner.firstName} ${learner.lastName}`,
                data: invoice
            });
        } catch (error: any) {
            logger.error('[TransportController] billSingleLearner:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/transport/fee-roster/bulk-bill
     * Generates transport billing in bulk for all transport students.
     */
    async bulkBillLearners(req: AuthRequest, res: Response) {
        try {
            const { term, academicYear, dueDate, billingMode = 'ROUTE_FEE', flatAmount = 0, onlyUnbilled = true } = req.body;
            if (!term || !academicYear) {
                throw new ApiError(400, 'term and academicYear are required');
            }

            const normalizedYear = parseInt(String(academicYear), 10);
            const invoiceDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            // Fetch assignments with route
            const assignments = await prisma.transportAssignment.findMany({
                where: { archived: false, passengerType: 'LEARNER' },
                include: { route: true }
            });
            const assignmentByPassengerId = new Map(assignments.map(a => [a.passengerId, a]));
            const assignedLearnerIds = assignments.map(a => a.passengerId);

            // Fetch all transport learners
            const learners = await prisma.learner.findMany({
                where: {
                    archived: false,
                    OR: [
                        { isTransportStudent: true },
                        { id: { in: assignedLearnerIds } }
                    ]
                },
                select: { id: true, firstName: true, lastName: true, grade: true }
            });

            // Fetch existing invoices for these learners
            const existingInvoices = await prisma.feeInvoice.findMany({
                where: {
                    learnerId: { in: learners.map(l => l.id) },
                    term: term as any,
                    academicYear: normalizedYear,
                    archived: false
                }
            });
            const existingInvoiceByLearnerId = new Map(existingInvoices.map(i => [i.learnerId, i]));

            let billedCount = 0;
            let totalAmountBilled = 0;
            const updatedInvoices: any[] = [];

            for (const learner of learners) {
                const existing = existingInvoiceByLearnerId.get(learner.id);
                if (onlyUnbilled && existing && Number(existing.transportBilled || 0) > 0) {
                    continue; // Skip already billed
                }

                // Determine fee
                let billAmount = 0;
                if (billingMode === 'FLAT_RATE') {
                    billAmount = Number(flatAmount);
                } else {
                    const assignment = assignmentByPassengerId.get(learner.id);
                    billAmount = Number(assignment?.route?.amount || flatAmount || 0);
                }

                if (billAmount <= 0) continue;

                let inv: any;
                if (existing) {
                    const oldTransportBilled = Number(existing.transportBilled || 0);
                    const oldTransportPaid = Number(existing.transportPaid || 0);
                    const diff = billAmount - oldTransportBilled;
                    const newTotal = Math.max(0, Number(existing.totalAmount) + diff);
                    const newTransportBalance = Math.max(0, billAmount - oldTransportPaid);
                    const newBalance = Math.max(0, Number(existing.balance) + diff);
                    const newStatus = newBalance <= 0 ? 'PAID' : Number(existing.paidAmount) > 0 ? 'PARTIAL' : 'PENDING';

                    inv = await prisma.feeInvoice.update({
                        where: { id: existing.id },
                        data: {
                            transportBilled: billAmount,
                            transportBalance: newTransportBalance,
                            totalAmount: newTotal,
                            balance: newBalance,
                            status: newStatus as any,
                            dueDate: invoiceDueDate
                        }
                    });
                } else {
                    const feeStructure = await getOrCreateFeeStructure(normalizedYear, term, learner.grade);
                    const invoiceNumber = await getSafeInvoiceNumber(normalizedYear);

                    inv = await prisma.feeInvoice.create({
                        data: {
                            invoiceNumber,
                            learnerId: learner.id,
                            feeStructureId: feeStructure.id,
                            term: term as any,
                            academicYear: normalizedYear,
                            dueDate: invoiceDueDate,
                            totalAmount: billAmount,
                            paidAmount: 0,
                            balance: billAmount,
                            transportBilled: billAmount,
                            transportPaid: 0,
                            transportBalance: billAmount,
                            studentAmount: billAmount,
                            grossAmount: billAmount,
                            status: billAmount === 0 ? 'PAID' : 'PENDING',
                            issuedBy: req.user?.userId || 'SYSTEM'
                        }
                    });
                }

                billedCount++;
                totalAmountBilled += billAmount;
                updatedInvoices.push(inv);
            }

            // Post ledger entries asynchronously
            setImmediate(async () => {
                for (const inv of updatedInvoices) {
                    try {
                        await accountingService.postFeeInvoiceToLedger(inv);
                    } catch (e) {
                        logger.error('[TransportController] bulk postFeeInvoiceToLedger error:', e);
                    }
                }
            });

            res.json({
                success: true,
                message: `Bulk transport billing complete. ${billedCount} students billed, total KES ${totalAmountBilled.toLocaleString()}.`,
                data: {
                    billedCount,
                    totalAmountBilled
                }
            });
        } catch (error: any) {
            logger.error('[TransportController] bulkBillLearners:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }
}

export const transportController = new TransportController();
