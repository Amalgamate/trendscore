import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { accountingService } from './accounting.service';
import { TaxCalculator } from '../utils/tax.calculator';
import { SmsService } from './sms.service';
import { whatsappService } from './whatsapp.service';
import { ApiError } from '../utils/error.util';

type AttendanceLocationPayload = {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    capturedAt?: string | Date;
    timestamp?: string | Date;
    source?: string;
    metadata?: Record<string, unknown> | null;
};

type AttendanceGeofenceMode = 'STRICT' | 'SOFT' | 'OFF';
type AttendanceGeofenceReasonCode =
    | 'NO_SCHOOL_PIN'
    | 'MISSING_LOCATION'
    | 'INVALID_LOCATION'
    | 'ACCURACY_TOO_LOW'
    | 'OUT_OF_RANGE'
    | 'GEOFENCE_DISABLED';

type AttendanceAction = 'clock-in' | 'clock-out';

type SchoolGeofenceContext = {
    id: string;
    latitude: number | null;
    longitude: number | null;
    geofenceRadiusMeters: number | null;
    geofenceEnforcementMode: AttendanceGeofenceMode | null;
} | null;

type AttendanceGeofenceDecision = {
    allowed: boolean;
    enforcementMode: AttendanceGeofenceMode;
    radiusMeters: number;
    distanceMeters: number | null;
    accuracyMeters: number | null;
    reasonCode: AttendanceGeofenceReasonCode | null;
    message: string;
    // Debug fields — always populated when a distance check is possible
    submittedLatitude: number | null;
    submittedLongitude: number | null;
    schoolLatitude: number | null;
    schoolLongitude: number | null;
};

type AttendanceRequestContext = {
    ipAddress?: string | null;
    userAgent?: string | null;
};

export class HRService {
    private readonly staffRoles = ['ADMIN', 'HEAD_TEACHER', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST'] as const;
    // 30m default: practical minimum for browser GPS (indoor accuracy is typically 5–50m).
    // Admin can tighten this per-school via geofenceRadiusMeters in school settings.
    private readonly defaultGeofenceRadiusMeters = 30;
    private readonly defaultGeofenceEnforcementMode: AttendanceGeofenceMode = 'STRICT';
    private readonly strictAccuracyThresholdMeters = 30;

    private toDateOnly(dateValue: Date) {
        const date = new Date(dateValue);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    private toWorkedMinutes(clockInAt: Date, clockOutAt: Date) {
        const ms = new Date(clockOutAt).getTime() - new Date(clockInAt).getTime();
        return Math.max(0, Math.floor(ms / 60000));
    }

    private resolveAttendanceTimestamp(payload: AttendanceLocationPayload = {}) {
        const rawTimestamp = payload.timestamp || payload.capturedAt;
        return rawTimestamp ? new Date(rawTimestamp) : new Date();
    }

    private async resolveCurrentSchoolGeofenceContext(): Promise<SchoolGeofenceContext> {
        return prisma.school.findFirst({
            where: { archived: false },
            orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                latitude: true,
                longitude: true,
                geofenceRadiusMeters: true,
                geofenceEnforcementMode: true
            }
        });
    }

    private normalizeGeofenceMode(mode?: AttendanceGeofenceMode | null): AttendanceGeofenceMode {
        return mode || this.defaultGeofenceEnforcementMode;
    }

    private isFiniteCoordinate(value: number | undefined | null, min: number, max: number) {
        return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
    }

    private toRadians(value: number) {
        return (value * Math.PI) / 180;
    }

    private haversineDistanceMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
        const earthRadiusMeters = 6_371_000;
        const latitudeDelta = this.toRadians(latitudeB - latitudeA);
        const longitudeDelta = this.toRadians(longitudeB - longitudeA);
        const latitudeARadians = this.toRadians(latitudeA);
        const latitudeBRadians = this.toRadians(latitudeB);

        const haversine =
            Math.sin(latitudeDelta / 2) ** 2 +
            Math.cos(latitudeARadians) * Math.cos(latitudeBRadians) * Math.sin(longitudeDelta / 2) ** 2;

        return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }

    private buildGeofenceDecision(params: {
        allowed: boolean;
        enforcementMode: AttendanceGeofenceMode;
        radiusMeters: number;
        distanceMeters?: number | null;
        accuracyMeters?: number | null;
        reasonCode?: AttendanceGeofenceReasonCode | null;
        message: string;
        submittedLatitude?: number | null;
        submittedLongitude?: number | null;
        schoolLatitude?: number | null;
        schoolLongitude?: number | null;
    }): AttendanceGeofenceDecision {
        return {
            allowed: params.allowed,
            enforcementMode: params.enforcementMode,
            radiusMeters: params.radiusMeters,
            distanceMeters: params.distanceMeters == null ? null : Math.round(params.distanceMeters * 100) / 100,
            accuracyMeters: params.accuracyMeters == null ? null : params.accuracyMeters,
            reasonCode: params.reasonCode ?? null,
            message: params.message,
            submittedLatitude: params.submittedLatitude ?? null,
            submittedLongitude: params.submittedLongitude ?? null,
            schoolLatitude: params.schoolLatitude ?? null,
            schoolLongitude: params.schoolLongitude ?? null,
        };
    }

    private buildGeofenceError(decision: AttendanceGeofenceDecision) {
        const error = new ApiError(403, decision.message).withCode(decision.reasonCode || 'GEOFENCE_DENIED') as ApiError & {
            reasonCode?: string;
            geofenceDecision?: AttendanceGeofenceDecision;
        };
        error.reasonCode = decision.reasonCode || undefined;
        error.geofenceDecision = decision;
        return error;
    }

    private enforceGeofenceDecision(decision: AttendanceGeofenceDecision) {
        if (!decision.allowed) {
            throw this.buildGeofenceError(decision);
        }
    }

    private evaluateAttendanceGeofence(
        action: AttendanceAction,
        school: SchoolGeofenceContext,
        payload: AttendanceLocationPayload = {}
    ): AttendanceGeofenceDecision {
        const enforcementMode = this.normalizeGeofenceMode(school?.geofenceEnforcementMode);
        const radiusMeters = school?.geofenceRadiusMeters ?? this.defaultGeofenceRadiusMeters;
        const accuracyMeters = typeof payload.accuracyMeters === 'number' && Number.isFinite(payload.accuracyMeters)
            ? payload.accuracyMeters
            : null;
        const actionLabel = action === 'clock-in' ? 'Clock-in' : 'Clock-out';

        // Debug coords — resolved once and threaded through all decision branches
        const submittedLatitude = typeof payload.latitude === 'number' && Number.isFinite(payload.latitude)
            ? payload.latitude
            : null;
        const submittedLongitude = typeof payload.longitude === 'number' && Number.isFinite(payload.longitude)
            ? payload.longitude
            : null;
        const schoolLatitude = school?.latitude ?? null;
        const schoolLongitude = school?.longitude ?? null;

        if (enforcementMode === 'OFF') {
            return this.buildGeofenceDecision({
                allowed: true,
                enforcementMode,
                radiusMeters,
                accuracyMeters,
                reasonCode: 'GEOFENCE_DISABLED',
                message: 'Geofence enforcement is disabled for this school.',
                submittedLatitude,
                submittedLongitude,
                schoolLatitude,
                schoolLongitude,
            });
        }

        const hasSchoolPin = this.isFiniteCoordinate(schoolLatitude, -90, 90) && this.isFiniteCoordinate(schoolLongitude, -180, 180);

        if (!hasSchoolPin) {
            const decision = this.buildGeofenceDecision({
                allowed: enforcementMode === 'SOFT',
                enforcementMode,
                radiusMeters,
                accuracyMeters,
                reasonCode: 'NO_SCHOOL_PIN',
                message: `${actionLabel} blocked because the school geofence pin is not configured. Ask an administrator to set the school GPS pin in School Settings.`,
                submittedLatitude,
                submittedLongitude,
                schoolLatitude,
                schoolLongitude,
            });
            return decision;
        }

        if (payload.latitude === undefined || payload.longitude === undefined) {
            return this.buildGeofenceDecision({
                allowed: enforcementMode === 'SOFT',
                enforcementMode,
                radiusMeters,
                accuracyMeters,
                reasonCode: 'MISSING_LOCATION',
                message: `${actionLabel} blocked: location is required for geofence verification. Enable location access and try again.`,
                submittedLatitude,
                submittedLongitude,
                schoolLatitude,
                schoolLongitude,
            });
        }

        if (
            !this.isFiniteCoordinate(payload.latitude, -90, 90) ||
            !this.isFiniteCoordinate(payload.longitude, -180, 180)
        ) {
            return this.buildGeofenceDecision({
                allowed: enforcementMode === 'SOFT',
                enforcementMode,
                radiusMeters,
                accuracyMeters,
                reasonCode: 'INVALID_LOCATION',
                message: `${actionLabel} blocked: the submitted location coordinates are invalid (lat=${payload.latitude}, lng=${payload.longitude}).`,
                submittedLatitude,
                submittedLongitude,
                schoolLatitude,
                schoolLongitude,
            });
        }

        if (accuracyMeters === null || accuracyMeters > this.strictAccuracyThresholdMeters) {
            const accuracyDetail = accuracyMeters === null
                ? 'accuracy not reported by device'
                : `reported accuracy: ${Math.round(accuracyMeters)}m, required: ≤${this.strictAccuracyThresholdMeters}m`;
            return this.buildGeofenceDecision({
                allowed: enforcementMode === 'SOFT',
                enforcementMode,
                radiusMeters,
                accuracyMeters,
                reasonCode: 'ACCURACY_TOO_LOW',
                message: `GPS accuracy is too low. Move outdoors and try again (${accuracyDetail}).`,
                submittedLatitude,
                submittedLongitude,
                schoolLatitude,
                schoolLongitude,
            });
        }

        const distanceMeters = this.haversineDistanceMeters(
            payload.latitude,
            payload.longitude,
            schoolLatitude!,
            schoolLongitude!
        );

        if (distanceMeters > radiusMeters) {
            return this.buildGeofenceDecision({
                allowed: enforcementMode === 'SOFT',
                enforcementMode,
                radiusMeters,
                distanceMeters,
                accuracyMeters,
                reasonCode: 'OUT_OF_RANGE',
                message: `${actionLabel} rejected: you are ${Math.round(distanceMeters)}m from the school (allowed radius: ${radiusMeters}m).`,
                submittedLatitude,
                submittedLongitude,
                schoolLatitude,
                schoolLongitude,
            });
        }

        return this.buildGeofenceDecision({
            allowed: true,
            enforcementMode,
            radiusMeters,
            distanceMeters,
            accuracyMeters,
            message: `${actionLabel} allowed within the school geofence (${Math.round(distanceMeters)}m from school, radius: ${radiusMeters}m).`,
            submittedLatitude,
            submittedLongitude,
            schoolLatitude,
            schoolLongitude,
        });
    }

    private buildAttendanceMetadata(
        payload: AttendanceLocationPayload = {},
        geofenceDecision?: AttendanceGeofenceDecision
    ) {
        const metadataObject = payload.metadata && typeof payload.metadata === 'object'
            ? payload.metadata
            : {};

        const metadata: Record<string, unknown> = { ...metadataObject };

        if (payload.latitude !== undefined && payload.longitude !== undefined) {
            metadata.location = {
                latitude: payload.latitude,
                longitude: payload.longitude,
                accuracyMeters: payload.accuracyMeters ?? null,
                capturedAt: payload.capturedAt || payload.timestamp || null
            };
        }

        if (geofenceDecision) {
            metadata.geofence = geofenceDecision;
        }

        if (!Object.keys(metadata).length) {
            return payload.metadata === null ? Prisma.DbNull : undefined;
        }

        return metadata as Prisma.InputJsonValue;
    }

    private async recordAttendanceAttempt(params: {
        userId: string;
        schoolId: string | null;
        action: 'CLOCK_IN' | 'CLOCK_OUT';
        payload: AttendanceLocationPayload;
        geofenceDecision: AttendanceGeofenceDecision;
        context?: AttendanceRequestContext;
    }) {
        const { userId, schoolId, action, payload, geofenceDecision, context } = params;
        const latitude = typeof payload.latitude === 'number' && Number.isFinite(payload.latitude) ? payload.latitude : undefined;
        const longitude = typeof payload.longitude === 'number' && Number.isFinite(payload.longitude) ? payload.longitude : undefined;
        const accuracyMeters = typeof payload.accuracyMeters === 'number' && Number.isFinite(payload.accuracyMeters) ? payload.accuracyMeters : undefined;
        try {
            await prisma.staffAttendanceAttemptLog.create({
                data: {
                    userId,
                    schoolId: schoolId || undefined,
                    action,
                    result: geofenceDecision.allowed ? 'ALLOWED' : 'DENIED',
                    reasonCode: geofenceDecision.reasonCode || undefined,
                    latitude,
                    longitude,
                    accuracyMeters,
                    distanceMeters: geofenceDecision.distanceMeters ?? undefined,
                    radiusMeters: geofenceDecision.radiusMeters,
                    enforcementMode: geofenceDecision.enforcementMode,
                    ipAddress: context?.ipAddress || undefined,
                    userAgent: context?.userAgent || undefined
                }
            });
        } catch {
            return;
        }
    }

    /**
     * Calculate the number of working days (Mon–Fri) between two dates, inclusive.
     */
    private calcBusinessDays(startDate: Date, endDate: Date): number {
        let count = 0;
        const cur = new Date(startDate);
        cur.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    }

    // ─── Staff Directory ──────────────────────────────────────────────────────

    async getStaffDirectory() {
        return prisma.user.findMany({
            where: {
                role: { in: [...this.staffRoles] as any },
                archived: false
            },
            select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                staffId: true,
                kraPin: true,
                nhifNumber: true,
                nssfNumber: true,
                bankName: true,
                bankAccountNumber: true,
                bankAccountName: true,
                basicSalary: true,
                employmentType: true,
                joinedAt: true,
                profilePicture: true,
                subject: true,
                gender: true,
                housingLevyExempt: true,
                staffAllowances: {
                    where: { isActive: true },
                    select: { id: true, type: true, label: true, amount: true }
                },
                staffDeductions: {
                    where: { isActive: true },
                    select: { id: true, type: true, label: true, amount: true, isRecurring: true, totalMonths: true, monthsApplied: true }
                }
            },
            orderBy: { lastName: 'asc' }
        });
    }

    async updateStaffHRDetails(userId: string, details: any) {
        if (details.phone) {
            const phoneStr = String(details.phone).trim();
            const isValidPhone = /^(\+?254|0)[17]\d{8}$/.test(phoneStr.replace(/\s/g, ''));
            if (!isValidPhone && phoneStr.length > 0) {
                console.warn(`[HR] Non-standard phone for userId ${userId}: ${phoneStr}`);
            }
        }

        return prisma.user.update({
            where: { id: userId },
            data: {
                kraPin: details.kraPin ?? undefined,
                nhifNumber: details.nhifNumber ?? undefined,
                nssfNumber: details.nssfNumber ?? undefined,
                bankName: details.bankName ?? undefined,
                bankAccountName: details.bankAccountName ?? undefined,
                bankAccountNumber: details.bankAccountNumber ?? undefined,
                basicSalary: details.basicSalary !== undefined ? Number(details.basicSalary) : undefined,
                employmentType: details.employmentType ?? undefined,
                housingLevyExempt: details.housingLevyExempt !== undefined ? Boolean(details.housingLevyExempt) : undefined,
                phone: details.phone !== undefined ? String(details.phone) : undefined,
                joinedAt: details.joinedAt ? new Date(details.joinedAt) : undefined
            }
        });
    }

    // ─── Allowances ───────────────────────────────────────────────────────────

    async getStaffAllowances(userId: string) {
        return prisma.staffAllowance.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' }
        });
    }

    async upsertAllowance(userId: string, data: {
        id?: string;
        type: string;
        label: string;
        amount: number;
        isActive?: boolean;
    }) {
        if (data.id) {
            return prisma.staffAllowance.update({
                where: { id: data.id },
                data: { type: data.type, label: data.label, amount: data.amount, isActive: data.isActive ?? true }
            });
        }
        return prisma.staffAllowance.create({
            data: { userId, type: data.type, label: data.label, amount: data.amount, isActive: data.isActive ?? true }
        });
    }

    async deleteAllowance(id: string) {
        return prisma.staffAllowance.delete({ where: { id } });
    }

    // ─── Custom Deductions ────────────────────────────────────────────────────

    async getStaffDeductions(userId: string) {
        return prisma.staffDeduction.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' }
        });
    }

    async upsertDeduction(userId: string, data: {
        id?: string;
        type: string;
        label: string;
        amount: number;
        isRecurring?: boolean;
        totalMonths?: number;
        isActive?: boolean;
    }) {
        if (data.id) {
            return prisma.staffDeduction.update({
                where: { id: data.id },
                data: {
                    type: data.type,
                    label: data.label,
                    amount: data.amount,
                    isRecurring: data.isRecurring ?? true,
                    totalMonths: data.totalMonths ?? 0,
                    isActive: data.isActive ?? true
                }
            });
        }
        return prisma.staffDeduction.create({
            data: {
                userId,
                type: data.type,
                label: data.label,
                amount: data.amount,
                isRecurring: data.isRecurring ?? true,
                totalMonths: data.totalMonths ?? 0,
                monthsApplied: 0,
                isActive: data.isActive ?? true
            }
        });
    }

    async deleteDeduction(id: string) {
        return prisma.staffDeduction.delete({ where: { id } });
    }

    // ─── Leave Management ─────────────────────────────────────────────────────

    async getLeaveTypes() {
        return prisma.leaveType.findMany({ where: { isActive: true } });
    }

    async submitLeaveRequest(userId: string, data: any) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);

        // Validate the leave type exists
        const leaveType = await prisma.leaveType.findUnique({ where: { id: data.leaveTypeId } });
        if (!leaveType) throw new Error('Invalid leave type');

        // Calculate business days requested
        const daysRequested = this.calcBusinessDays(startDate, endDate);

        // Check annual balance: sum approved + pending leave days this year for this type
        const yearStart = new Date(startDate.getFullYear(), 0, 1);
        const yearEnd = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59);
        const existingLeaves = await prisma.leaveRequest.findMany({
            where: {
                userId,
                leaveTypeId: data.leaveTypeId,
                status: { in: ['APPROVED', 'PENDING'] },
                startDate: { gte: yearStart, lte: yearEnd }
            }
        });
        const usedDays = existingLeaves.reduce(
            (sum, lr) => sum + this.calcBusinessDays(new Date(lr.startDate), new Date(lr.endDate)),
            0
        );
        const remainingDays = leaveType.maxDays - usedDays;

        if (daysRequested > remainingDays) {
            throw new Error(
                `Insufficient leave balance. Requested ${daysRequested} day(s) but only ${remainingDays} remaining for ${leaveType.name} this year.`
            );
        }

        return prisma.leaveRequest.create({
            data: {
                userId,
                leaveTypeId: data.leaveTypeId,
                startDate,
                endDate,
                reason: data.reason,
                status: 'PENDING'
            }
        });
    }

    /**
     * Get leave requests.
     * Supports filtering by status and/or userId.
     */
    async getLeaveRequests(filters: any = {}) {
        return prisma.leaveRequest.findMany({
            where: {
                status: filters.status || undefined,
                userId: filters.userId || undefined
            },
            include: {
                user: { select: { firstName: true, lastName: true, role: true } },
                leaveType: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async approveLeaveRequest(
        requestId: string,
        approvedById: string,
        approved: boolean,
        rejectionReason?: string
    ) {
        const updated = await prisma.leaveRequest.update({
            where: { id: requestId },
            data: {
                status: approved ? 'APPROVED' : 'REJECTED',
                approvedById: approved ? approvedById : null,
                approvedAt: approved ? new Date() : null,
                rejectionReason: approved ? null : rejectionReason
            },
            include: {
                user: { select: { firstName: true, phone: true } },
                leaveType: true
            }
        });

        // ── SMS notification to the staff member ──────────────────────────────
        if (updated.user?.phone) {
            const start = new Date(updated.startDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
            const end   = new Date(updated.endDate).toLocaleDateString('en-KE',   { day: '2-digit', month: 'short', year: 'numeric' });
            const days  = this.calcBusinessDays(new Date(updated.startDate), new Date(updated.endDate));
            let message: string;
            if (approved) {
                message = `Dear ${updated.user.firstName}, your ${updated.leaveType.name} leave request (${start} – ${end}, ${days} day(s)) has been APPROVED. Enjoy your time off!`;
            } else {
                const reasonNote = rejectionReason ? ` Reason: ${rejectionReason}.` : '';
                message = `Dear ${updated.user.firstName}, your ${updated.leaveType.name} leave request (${start} – ${end}) has been REJECTED.${reasonNote} Please contact HR for clarification.`;
            }
            SmsService.sendSms(updated.user.phone, message).catch(err =>
                console.error('[HR] Leave approval SMS failed:', err)
            );

            // Add WhatsApp Alerting (redundant delivery)
            whatsappService.sendMessage({ to: updated.user.phone, message }).catch(err =>
                console.error('[HR] Leave approval WhatsApp failed:', err)
            );
        }

        return updated;
    }

    // ─── Payroll: core generation logic ──────────────────────────────────────

    private async buildPayBreakdown(userId: string, basicSalary: number, housingLevyExempt: boolean) {
        const allowances = await prisma.staffAllowance.findMany({ where: { userId, isActive: true } });
        const allowanceTotal = allowances.reduce((sum, a) => sum + Number(a.amount), 0);
        const grossSalary = basicSalary + allowanceTotal;

        const statutory = TaxCalculator.getBreakdown(grossSalary, { exemptLevy: housingLevyExempt });

        const customDeductions = await prisma.staffDeduction.findMany({ where: { userId, isActive: true } });
        const eligibleCustom = customDeductions.filter(d => d.totalMonths === 0 || d.monthsApplied < d.totalMonths);
        const customDeductionTotal = eligibleCustom.reduce((sum, d) => sum + Number(d.amount), 0);

        const totalDeductions = statutory.totalDeductions + customDeductionTotal;
        const netSalary = grossSalary - totalDeductions;

        return {
            basicSalary,
            grossSalary,
            allowancesSnapshot: allowances.map(a => ({ id: a.id, type: a.type, label: a.label, amount: Number(a.amount) })),
            allowanceTotal,
            statutory,
            customDeductions: eligibleCustom.map(d => ({ id: d.id, type: d.type, label: d.label, amount: Number(d.amount) })),
            customDeductionTotal,
            totalDeductions,
            netSalary
        };
    }

    async generateMonthlyPayroll(month: number, year: number, generatedBy: string) {
        const staff = await prisma.user.findMany({
            where: {
                role: { notIn: ['PARENT', 'SUPER_ADMIN'] },
                archived: false,
                status: 'ACTIVE',
                basicSalary: { gt: 0 }
            },
            select: {
                id: true,
                basicSalary: true,
                housingLevyExempt: true
            }
        });

        const existingRecords = await prisma.payrollRecord.findMany({
            where: {
                month,
                year,
                userId: { in: staff.map(s => s.id) }
            }
        });
        const existingMap = new Map(existingRecords.map(r => [r.userId, r]));

        const payrollRecords = [];

        for (const member of staff) {
            const existing = existingMap.get(member.id);
            if (existing) {
                payrollRecords.push(existing);
                continue;
            }

            const basicSalary = Number(member.basicSalary);
            const pay = await this.buildPayBreakdown(member.id, basicSalary, !!member.housingLevyExempt);

            const record = await prisma.payrollRecord.create({
                data: {
                    userId: member.id,
                    month,
                    year,
                    basicSalary,
                    grossSalary: pay.grossSalary,
                    netSalary: pay.netSalary,
                    allowances: { items: pay.allowancesSnapshot, total: pay.allowanceTotal } as any,
                    deductions: {
                        paye: pay.statutory.paye,
                        nssf: pay.statutory.nssf,
                        shif: pay.statutory.shif,
                        housingLevy: pay.statutory.housingLevy,
                        statutoryTotal: pay.statutory.totalDeductions,
                        customItems: pay.customDeductions,
                        customTotal: pay.customDeductionTotal,
                        totalDeductions: pay.totalDeductions
                    } as any,
                    status: 'DRAFT',
                    generatedBy
                }
            });

            // Increment monthsApplied for bounded custom deductions
            for (const cd of pay.customDeductions) {
                const ded = await prisma.staffDeduction.findUnique({ where: { id: cd.id } });
                if (ded && ded.totalMonths > 0) {
                    const newApplied = ded.monthsApplied + 1;
                    await prisma.staffDeduction.update({
                        where: { id: cd.id },
                        data: { monthsApplied: newApplied, isActive: newApplied < ded.totalMonths }
                    });
                }
            }

            payrollRecords.push(record);
        }

        return { count: payrollRecords.length, records: payrollRecords };
    }

    async confirmPayrollRecord(recordId: string) {
        const record = await prisma.payrollRecord.findUnique({
            where: { id: recordId },
            include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } }
        });
        if (!record) throw new Error('Payroll record not found');
        if (record.status !== 'DRAFT') throw new Error('Record is not in DRAFT status');

        const updated = await prisma.payrollRecord.update({
            where: { id: recordId },
            data: { status: 'GENERATED' }
        });

        await accountingService.postPayrollToLedger(updated);
        return updated;
    }

    async bulkConfirmPayroll(month: number, year: number) {
        const drafts = await prisma.payrollRecord.findMany({ where: { month, year, status: 'DRAFT' } });
        let confirmed = 0;
        const errors: string[] = [];

        for (const record of drafts) {
            try {
                const updated = await prisma.payrollRecord.update({
                    where: { id: record.id },
                    data: { status: 'GENERATED' }
                });
                await accountingService.postPayrollToLedger(updated);
                confirmed++;
            } catch (err: any) {
                errors.push(`Record ${record.id}: ${err.message}`);
            }
        }

        return { total: drafts.length, confirmed, errors };
    }

    async markPayrollPaid(recordId: string, paymentReference?: string) {
        const record = await prisma.payrollRecord.findUnique({
            where: { id: recordId },
            include: { user: { select: { firstName: true, phone: true, bankName: true } } }
        });
        if (!record) throw new Error('Payroll record not found');
        if (record.status === 'PAID') throw new Error('Record is already marked as PAID');
        if (record.status === 'VOID') throw new Error('Cannot mark a VOID record as paid');

        const updated = await prisma.payrollRecord.update({
            where: { id: recordId },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                paymentReference: paymentReference || null
            }
        });

        // ── SMS notification to the staff member ──────────────────────────────
        if (record.user?.phone) {
            const monthName = new Date(record.year, record.month - 1)
                .toLocaleString('en-KE', { month: 'long', year: 'numeric' });
            const net = Number(record.netSalary).toLocaleString('en-KE', { minimumFractionDigits: 2 });
            const bankNote = record.user.bankName ? ` to ${record.user.bankName}` : '';
            const refNote  = paymentReference ? ` Ref: ${paymentReference}.` : '';
            const message  = `Dear ${record.user.firstName}, your salary for ${monthName} of KES ${net} has been disbursed${bankNote}.${refNote} Contact HR for any queries.`;
            SmsService.sendSms(record.user.phone, message).catch(err =>
                console.error('[HR] Payroll paid SMS failed:', err)
            );

            // Add WhatsApp Alerting (redundant delivery)
            whatsappService.sendMessage({ to: record.user.phone, message }).catch(err =>
                console.error('[HR] Payroll paid WhatsApp failed:', err)
            );
        }

        return updated;
    }

    async bulkMarkPaid(month: number, year: number, paymentReference?: string) {
        const generated = await prisma.payrollRecord.findMany({
            where: { month, year, status: 'GENERATED' },
            include: { user: { select: { firstName: true, phone: true, bankName: true } } }
        });

        const updated = await prisma.payrollRecord.updateMany({
            where: { month, year, status: 'GENERATED' },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                paymentReference: paymentReference || null
            }
        });

        // ── Bulk SMS notifications ────────────────────────────────────────────
        const monthName = new Date(year, month - 1).toLocaleString('en-KE', { month: 'long', year: 'numeric' });
        for (const rec of generated) {
            if (!rec.user?.phone) continue;
            const net      = Number(rec.netSalary).toLocaleString('en-KE', { minimumFractionDigits: 2 });
            const bankNote = rec.user.bankName ? ` to ${rec.user.bankName}` : '';
            const refNote  = paymentReference ? ` Ref: ${paymentReference}.` : '';
            const message  = `Dear ${rec.user.firstName}, your salary for ${monthName} of KES ${net} has been disbursed${bankNote}.${refNote} Contact HR for any queries.`;
            SmsService.sendSms(rec.user.phone, message).catch(err =>
                console.error('[HR] Bulk payroll paid SMS failed:', err)
            );

            // Add WhatsApp Alerting (redundant delivery)
            whatsappService.sendMessage({ to: rec.user.phone, message }).catch(err =>
                console.error('[HR] Bulk payroll paid WhatsApp failed:', err)
            );
        }

        return { total: generated.length, paid: updated.count };
    }

    /**
     * Void a payroll record (DRAFT or GENERATED only).
     * A PAID record cannot be voided — it must be reversed manually via the accounting module.
     */
    async voidPayrollRecord(recordId: string, voidedBy: string, reason: string) {
        if (!reason?.trim()) throw new Error('A reason is required to void a payroll record');
        const record = await prisma.payrollRecord.findUnique({ where: { id: recordId } });
        if (!record) throw new Error('Payroll record not found');
        if (record.status === 'PAID') {
            throw new Error('A PAID payroll record cannot be voided. Please create a correcting journal entry in the accounting module.');
        }
        if (record.status === 'VOID') throw new Error('Record is already VOID');

        return prisma.payrollRecord.update({
            where: { id: recordId },
            data: {
                status: 'VOID',
                notes: `VOIDED by userId:${voidedBy} on ${new Date().toISOString()}. Reason: ${reason}`
            }
        });
    }

    async getPayrollRecords(month: number, year: number) {
        return prisma.payrollRecord.findMany({
            where: { month, year },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        staffId: true,
                        bankName: true,
                        bankAccountNumber: true,
                        bankAccountName: true,
                        kraPin: true,
                        nssfNumber: true,
                        role: true
                    }
                }
            },
            orderBy: [{ status: 'asc' }, { user: { lastName: 'asc' } }]
        });
    }

    /**
     * Fetch a single payroll record with full staff details for payslip rendering.
     */
    async getPayrollRecordById(recordId: string) {
        const record = await prisma.payrollRecord.findUnique({
            where: { id: recordId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        staffId: true,
                        role: true,
                        email: true,
                        phone: true,
                        bankName: true,
                        bankAccountNumber: true,
                        bankAccountName: true,
                        kraPin: true,
                        nssfNumber: true,
                        employmentType: true,
                        joinedAt: true,
                        profilePicture: true
                    }
                }
            }
        });
        if (!record) throw new Error('Payroll record not found');
        return record;
    }

    // ─── Attendance / Dashboard ───────────────────────────────────────────────

    async getDashboardStats(month: number, year: number) {
        const [staffCount, pendingLeaveCount, payrollDraftsCount, payrollGeneratedCount, recentRequests] = await Promise.all([
            prisma.user.count({
                where: {
                    role: { in: [...this.staffRoles] as any },
                    archived: false,
                    status: 'ACTIVE'
                }
            }),
            prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
            prisma.payrollRecord.count({ where: { month, year, status: 'DRAFT' } }),
            prisma.payrollRecord.count({ where: { month, year, status: 'GENERATED' } }),
            prisma.leaveRequest.findMany({
                where: { status: 'PENDING' },
                include: {
                    user: { select: { firstName: true, lastName: true, role: true } },
                    leaveType: true
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            })
        ]);

        return { staffCount, pendingLeaveCount, payrollDraftsCount, payrollGeneratedCount, recentRequests };
    }

    async getTodayClockIn(userId: string, date = new Date()) {
        const dateOnly = this.toDateOnly(date);
        return prisma.staffAttendanceLog.findUnique({
            where: { userId_date: { userId, date: dateOnly } }
        });
    }

    async clockInStaff(userId: string, payload: AttendanceLocationPayload = {}, context: AttendanceRequestContext = {}) {
        const timestamp = this.resolveAttendanceTimestamp(payload);
        const dateOnly = this.toDateOnly(timestamp);
        const school = await this.resolveCurrentSchoolGeofenceContext();
        const schoolId = school?.id || null;
        const geofenceDecision = this.evaluateAttendanceGeofence('clock-in', school, payload);
        await this.recordAttendanceAttempt({
            userId,
            schoolId,
            action: 'CLOCK_IN',
            payload,
            geofenceDecision,
            context
        });
        if (!geofenceDecision.allowed) {
            throw this.buildGeofenceError(geofenceDecision);
        }
        const metadata = this.buildAttendanceMetadata(payload, geofenceDecision);

        const attendance = await prisma.staffAttendanceLog.upsert({
            where: { userId_date: { userId, date: dateOnly } },
            update: {
                schoolId: schoolId || undefined,
                clockInAt: timestamp,
                source: payload?.source || 'web',
                metadata
            },
            create: {
                userId,
                schoolId,
                date: dateOnly,
                clockInAt: timestamp,
                source: payload?.source || 'web',
                metadata
            }
        });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, basicSalary: true, housingLevyExempt: true }
        });

        const month = timestamp.getMonth() + 1;
        const year = timestamp.getFullYear();

        let payrollRecord = await prisma.payrollRecord.findUnique({
            where: { userId_month_year: { userId, month, year } }
        });

        let payrollCreated = false;
        if (!payrollRecord && user?.basicSalary && Number(user.basicSalary) > 0) {
            const basicSalary = Number(user.basicSalary);
            const pay = await this.buildPayBreakdown(userId, basicSalary, !!user.housingLevyExempt);
            payrollRecord = await prisma.payrollRecord.create({
                data: {
                    userId, month, year,
                    basicSalary,
                    grossSalary: pay.grossSalary,
                    netSalary: pay.netSalary,
                    allowances: { items: pay.allowancesSnapshot, total: pay.allowanceTotal } as any,
                    deductions: {
                        paye: pay.statutory.paye,
                        nssf: pay.statutory.nssf,
                        shif: pay.statutory.shif,
                        housingLevy: pay.statutory.housingLevy,
                        statutoryTotal: pay.statutory.totalDeductions,
                        customItems: pay.customDeductions,
                        customTotal: pay.customDeductionTotal,
                        totalDeductions: pay.totalDeductions
                    } as any,
                    workedMinutes: 0,
                    workedDays: 0,
                    status: 'DRAFT',
                    generatedBy: userId,
                    notes: 'Auto-created from first staff clock-in for the month'
                }
            });
            payrollCreated = true;
        }

        return { attendance, payroll: payrollRecord, payrollCreated, geofenceDecision };
    }

    async clockOutStaff(userId: string, payload: AttendanceLocationPayload = {}, context: AttendanceRequestContext = {}) {
        const timestamp = this.resolveAttendanceTimestamp(payload);
        const dateOnly = this.toDateOnly(timestamp);

        const attendance = await prisma.staffAttendanceLog.findUnique({
            where: { userId_date: { userId, date: dateOnly } }
        });
        if (!attendance) throw new Error('No clock-in record found for today');
        if (timestamp.getTime() < new Date(attendance.clockInAt).getTime()) {
            throw new Error('Clock-out time cannot be earlier than clock-in time');
        }

        const school = await this.resolveCurrentSchoolGeofenceContext();
        const schoolId = school?.id || null;
        const geofenceDecision = this.evaluateAttendanceGeofence('clock-out', school, payload);
        await this.recordAttendanceAttempt({
            userId,
            schoolId: attendance.schoolId || schoolId,
            action: 'CLOCK_OUT',
            payload,
            geofenceDecision,
            context
        });
        if (!geofenceDecision.allowed) {
            throw this.buildGeofenceError(geofenceDecision);
        }
        const metadata = this.buildAttendanceMetadata(payload, geofenceDecision);

        const previousWorkedMinutes = attendance.clockOutAt
            ? this.toWorkedMinutes(attendance.clockInAt, attendance.clockOutAt)
            : 0;
        const nextWorkedMinutes = this.toWorkedMinutes(attendance.clockInAt, timestamp);
        const workedMinutesDelta = nextWorkedMinutes - previousWorkedMinutes;
        const shouldIncrementWorkedDays = !attendance.clockOutAt && nextWorkedMinutes > 0;

        const updatedAttendance = await prisma.staffAttendanceLog.update({
            where: { id: attendance.id },
            data: {
                schoolId: attendance.schoolId || schoolId || undefined,
                clockOutAt: timestamp,
                source: payload?.source || attendance.source || 'web',
                metadata: metadata === undefined ? undefined : metadata
            }
        });

        const month = timestamp.getMonth() + 1;
        const year = timestamp.getFullYear();
        let payrollRecord = await prisma.payrollRecord.findUnique({
            where: { userId_month_year: { userId, month, year } }
        });
        if (payrollRecord) {
            payrollRecord = await prisma.payrollRecord.update({
                where: { id: payrollRecord.id },
                data: {
                    workedMinutes: { increment: workedMinutesDelta },
                    workedDays: shouldIncrementWorkedDays ? { increment: 1 } : undefined
                }
            });
        }

        return {
            attendance: updatedAttendance,
            payroll: payrollRecord,
            workedMinutesDelta,
            workedDaysIncremented: shouldIncrementWorkedDays,
            geofenceDecision
        };
    }

    // ─── Leave Type CRUD ──────────────────────────────────────────────────────

    async createLeaveType(data: { name: string; maxDays: number; description?: string }) {
        return prisma.leaveType.create({
            data: { name: data.name, maxDays: Number(data.maxDays), description: data.description, isActive: true }
        });
    }

    async updateLeaveType(id: string, data: { name?: string; maxDays?: number; description?: string; isActive?: boolean }) {
        return prisma.leaveType.update({
            where: { id },
            data: {
                name: data.name ?? undefined,
                maxDays: data.maxDays !== undefined ? Number(data.maxDays) : undefined,
                description: data.description ?? undefined,
                isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
            }
        });
    }

    async deleteLeaveType(id: string) {
        return prisma.leaveType.update({ where: { id }, data: { isActive: false } });
    }

    // ─── Leave Balance ────────────────────────────────────────────────────────

    async getLeaveBalance(userId: string, year: number) {
        const types = await prisma.leaveType.findMany({ where: { isActive: true } });
        const yearStart = new Date(year, 0, 1);
        const yearEnd   = new Date(year, 11, 31, 23, 59, 59);
        return Promise.all(types.map(async (type) => {
            const requests = await prisma.leaveRequest.findMany({
                where: {
                    userId, leaveTypeId: type.id,
                    status: { in: ['APPROVED', 'PENDING'] },
                    startDate: { gte: yearStart, lte: yearEnd }
                }
            });
            const usedDays = requests.reduce(
                (sum, lr) => sum + this.calcBusinessDays(new Date(lr.startDate), new Date(lr.endDate)), 0
            );
            return { typeId: type.id, typeName: type.name, maxDays: type.maxDays, usedDays, remainingDays: Math.max(0, type.maxDays - usedDays) };
        }));
    }

    // ─── Attendance Report ────────────────────────────────────────────────────

    async getAttendanceReport(params: { userId?: string; startDate: string; endDate: string }) {
        const start = new Date(params.startDate); start.setHours(0, 0, 0, 0);
        const end   = new Date(params.endDate);   end.setHours(23, 59, 59, 999);
        return prisma.staffAttendanceLog.findMany({
            where: {
                date: { gte: start, lte: end },
                ...(params.userId ? { userId: params.userId } : {})
            },
            include: { user: { select: { firstName: true, lastName: true, staffId: true, role: true } } },
            orderBy: [{ date: 'desc' }, { user: { lastName: 'asc' } }]
        });
    }

    // ─── Business days in a calendar month ───────────────────────────────────

    calcBusinessDaysInMonth(month: number, year: number): number {
        return this.calcBusinessDays(
            new Date(year, month - 1, 1),
            new Date(year, month, 0)   // last day of month
        );
    }

    // ─── Performance ──────────────────────────────────────────────────────────

    async getPerformanceReviews(userId?: string) {
        return prisma.performanceReview.findMany({
            where: { userId: userId || undefined },
            include: {
                user: { select: { firstName: true, lastName: true, role: true, staffId: true } },
                reviewer: { select: { firstName: true, lastName: true } }
            },
            orderBy: { reviewDate: 'desc' }
        });
    }

    async createPerformanceReview(data: any) {
        return prisma.performanceReview.create({
            data: {
                userId: data.userId,
                reviewerId: data.reviewerId,
                reviewDate: new Date(data.reviewDate || new Date()),
                periodStart: new Date(data.periodStart),
                periodEnd: new Date(data.periodEnd),
                technicalRating: data.technicalRating,
                behavioralRating: data.behavioralRating,
                collaborationRating: data.collaborationRating,
                overallRating: data.overallRating,
                comments: data.comments,
                goals: data.goals || [],
                status: data.status || 'COMPLETED'
            },
            include: {
                user: { select: { firstName: true, lastName: true, phone: true, email: true } },
                reviewer: { select: { firstName: true, lastName: true } }
            }
        });
    }

    async updatePerformanceReview(id: string, data: any) {
        return prisma.performanceReview.update({
            where: { id },
            data: {
                technicalRating: data.technicalRating,
                behavioralRating: data.behavioralRating,
                collaborationRating: data.collaborationRating,
                overallRating: data.overallRating,
                comments: data.comments,
                goals: data.goals,
                status: data.status
            },
            include: {
                user: { select: { firstName: true, lastName: true, phone: true, email: true } },
                reviewer: { select: { firstName: true, lastName: true } }
            }
        });
    }
}

export const hrService = new HRService();
