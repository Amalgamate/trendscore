import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { hrService } from '../services/hr.service';
import { ApiError } from '../utils/error.util';
import { SmsService } from '../services/sms.service';
import { getIpAddress } from '../utils/security-logging.util';

import logger from '../utils/logger';
export class HRController {

    // ─── Dashboard ────────────────────────────────────────────────────────────

    async getDashboardStats(req: AuthRequest, res: Response) {
        try {
            const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
            const year  = req.query.year  ? Number(req.query.year)  : new Date().getFullYear();
            const stats = await hrService.getDashboardStats(month, year);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            logger.error('[HR] getDashboardStats:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    // ─── Attendance ───────────────────────────────────────────────────────────

    async clockIn(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new ApiError(401, 'Unauthorized');
            const result = await hrService.clockInStaff(userId, req.body || {}, {
                ipAddress: getIpAddress(req),
                userAgent: req.get('user-agent')
            });
            res.status(201).json({ success: true, message: 'Clock-in recorded', data: result });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message,
                ...(error.reasonCode || error.code ? { reasonCode: error.reasonCode || error.code } : {}),
                ...(error.geofenceDecision ? { geofenceDecision: error.geofenceDecision } : {}),
                ...(error.ipCheckResult ? { ipCheckResult: error.ipCheckResult } : {})
            });
        }
    }

    async getTodayClockIn(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new ApiError(401, 'Unauthorized');
            const data = await hrService.getTodayClockIn(userId);
            res.json({ success: true, data });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async clockOut(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new ApiError(401, 'Unauthorized');
            const result = await hrService.clockOutStaff(userId, req.body || {}, {
                ipAddress: getIpAddress(req),
                userAgent: req.get('user-agent')
            });
            res.status(200).json({ success: true, message: 'Clock-out recorded', data: result });
        } catch (error: any) {
            const message    = error?.message || 'Failed to clock out';
            const statusCode = error?.statusCode ||
                (message.includes('No clock-in record') || message.includes('earlier than clock-in') ? 400 : 500);
            res.status(statusCode).json({
                success: false,
                message,
                ...(error.reasonCode || error.code ? { reasonCode: error.reasonCode || error.code } : {}),
                ...(error.geofenceDecision ? { geofenceDecision: error.geofenceDecision } : {}),
                ...(error.ipCheckResult ? { ipCheckResult: error.ipCheckResult } : {})
            });
        }
    }

    // ─── Staff Directory ──────────────────────────────────────────────────────

    async getStaffDirectory(req: AuthRequest, res: Response) {
        try {
            const staff = await hrService.getStaffDirectory();
            res.json({ success: true, data: staff });
        } catch (error: any) {
            logger.error('[HR] getStaffDirectory:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async updateStaffHR(req: AuthRequest, res: Response) {
        try {
            const { userId } = req.params;
            const updated = await hrService.updateStaffHRDetails(userId, req.body);
            res.json({ success: true, message: 'Staff HR details updated', data: updated });
        } catch (error: any) {
            logger.error('[HR] updateStaffHR:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    // ─── Allowances ───────────────────────────────────────────────────────────

    async getStaffAllowances(req: AuthRequest, res: Response) {
        try {
            const { userId } = req.params;
            const data = await hrService.getStaffAllowances(userId);
            res.json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async upsertAllowance(req: AuthRequest, res: Response) {
        try {
            const { userId } = req.params;
            const data = await hrService.upsertAllowance(userId, req.body);
            res.json({ success: true, message: 'Allowance saved', data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deleteAllowance(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            await hrService.deleteAllowance(id);
            res.json({ success: true, message: 'Allowance deleted' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ─── Custom Deductions ────────────────────────────────────────────────────

    async getStaffDeductions(req: AuthRequest, res: Response) {
        try {
            const { userId } = req.params;
            const data = await hrService.getStaffDeductions(userId);
            res.json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async upsertDeduction(req: AuthRequest, res: Response) {
        try {
            const { userId } = req.params;
            const data = await hrService.upsertDeduction(userId, req.body);
            res.json({ success: true, message: 'Deduction saved', data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deleteDeduction(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            await hrService.deleteDeduction(id);
            res.json({ success: true, message: 'Deduction deleted' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ─── Leave ────────────────────────────────────────────────────────────────

    async getLeaveTypes(req: AuthRequest, res: Response) {
        try {
            const types = await hrService.getLeaveTypes();
            res.json({ success: true, data: types });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async submitLeave(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new ApiError(401, 'Unauthorized');
            const request = await hrService.submitLeaveRequest(userId, req.body);
            res.status(201).json({ success: true, message: 'Leave request submitted', data: request });
        } catch (error: any) {
            res.status(error.statusCode || 400).json({ success: false, message: error.message });
        }
    }

    async getLeaveRequests(req: AuthRequest, res: Response) {
        try {
            // Admin/HR sees all; regular staff sees only their own
            const role   = req.user?.role;
            const userId = req.user?.userId;
            const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER'].includes(role || '');
            const filters: any = {
                status: req.query.status || undefined,
                userId: isAdmin ? (req.query.userId as string | undefined) : userId
            };
            const requests = await hrService.getLeaveRequests(filters);
            res.json({ success: true, data: requests });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async approveLeave(req: AuthRequest, res: Response) {
        try {
            const { requestId } = req.params;
            const { approved, rejectionReason } = req.body;
            const approvedBy = req.user?.userId;
            if (!approvedBy) throw new ApiError(401, 'Unauthorized');
            const updated = await hrService.approveLeaveRequest(requestId, approvedBy, approved, rejectionReason);
            res.json({ success: true, message: `Leave ${approved ? 'approved' : 'rejected'}`, data: updated });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    // ─── Leave Type CRUD ──────────────────────────────────────────────────────

    async createLeaveType(req: AuthRequest, res: Response) {
        try {
            const type = await hrService.createLeaveType(req.body);
            res.status(201).json({ success: true, message: 'Leave type created', data: type });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async updateLeaveType(req: AuthRequest, res: Response) {
        try {
            const type = await hrService.updateLeaveType(req.params.id, req.body);
            res.json({ success: true, message: 'Leave type updated', data: type });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async deleteLeaveType(req: AuthRequest, res: Response) {
        try {
            await hrService.deleteLeaveType(req.params.id);
            res.json({ success: true, message: 'Leave type deactivated' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getLeaveBalance(req: AuthRequest, res: Response) {
        try {
            const userId  = req.params.userId;
            const year    = req.query.year ? Number(req.query.year) : new Date().getFullYear();
            const balance = await hrService.getLeaveBalance(userId, year);
            res.json({ success: true, data: balance });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ─── Attendance Report ────────────────────────────────────────────────────

    async getAttendanceReport(req: AuthRequest, res: Response) {
        try {
            const { userId, startDate, endDate } = req.query as Record<string, string>;
            if (!startDate || !endDate) throw new ApiError(400, 'startDate and endDate are required');
            const data = await hrService.getAttendanceReport({ userId, startDate, endDate });
            res.json({ success: true, data, count: data.rows.length });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async markAttendance(req: AuthRequest, res: Response) {
        try {
            const markedBy = req.user?.userId;
            if (!markedBy) throw new ApiError(401, 'Unauthorized');
            const data = await hrService.markStaffAttendance({
                userId: req.body.userId,
                status: req.body.status,
                date: req.body.date,
                markedBy,
                reason: req.body.reason
            });
            res.json({ success: true, message: `Staff member marked ${req.body.status.toLowerCase()}`, data });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    // ─── Payroll ──────────────────────────────────────────────────────────────

    async generatePayroll(req: AuthRequest, res: Response) {
        try {
            const { month, year } = req.body;
            const generatedBy = req.user?.userId;
            if (!generatedBy) throw new ApiError(401, 'Unauthorized');
            const result = await hrService.generateMonthlyPayroll(Number(month), Number(year), generatedBy);
            res.json({ success: true, message: 'Payroll generation complete', data: result });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async getPayroll(req: AuthRequest, res: Response) {
        try {
            const { month, year } = req.query;
            const records = await hrService.getPayrollRecords(Number(month), Number(year));
            res.json({ success: true, data: records });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/hr/payroll/:id
     * Returns a single payroll record with full staff detail for payslip rendering.
     */
    async getPayslip(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const record = await hrService.getPayrollRecordById(id);
            res.json({ success: true, data: record });
        } catch (error: any) {
            res.status(error.statusCode || 404).json({ success: false, message: error.message });
        }
    }

    async confirmPayroll(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const confirmed = await hrService.confirmPayrollRecord(id);
            res.json({ success: true, message: 'Payroll record confirmed and posted to ledger', data: confirmed });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async bulkConfirmPayroll(req: AuthRequest, res: Response) {
        try {
            const { month, year } = req.body;
            const result = await hrService.bulkConfirmPayroll(Number(month), Number(year));
            res.json({
                success: true,
                message: `Bulk confirmed ${result.confirmed} of ${result.total} records`,
                data: result
            });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async markPayrollPaid(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { paymentReference } = req.body;
            const updated = await hrService.markPayrollPaid(id, paymentReference);
            res.json({ success: true, message: 'Payroll record marked as paid', data: updated });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async bulkMarkPaid(req: AuthRequest, res: Response) {
        try {
            const { month, year, paymentReference } = req.body;
            const result = await hrService.bulkMarkPaid(Number(month), Number(year), paymentReference);
            res.json({
                success: true,
                message: `Marked ${result.paid} records as PAID`,
                data: result
            });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    /**
     * PUT /api/hr/payroll/void/:id
     * Voids a DRAFT or GENERATED payroll record. Requires a reason.
     */
    async voidPayroll(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const voidedBy = req.user?.userId;
            if (!voidedBy) throw new ApiError(401, 'Unauthorized');
            if (!reason?.trim()) throw new ApiError(400, 'A reason is required to void a payroll record');
            const voided = await hrService.voidPayrollRecord(id, voidedBy, reason);
            res.json({ success: true, message: 'Payroll record voided', data: voided });
        } catch (error: any) {
            res.status(error.statusCode || 400).json({ success: false, message: error.message });
        }
    }

    // ─── Performance ──────────────────────────────────────────────────────────

    async getPerformance(req: AuthRequest, res: Response) {
        try {
            const { userId } = req.query;
            const reviews = await hrService.getPerformanceReviews(userId as string);
            res.json({ success: true, data: reviews });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createPerformance(req: AuthRequest, res: Response) {
        try {
            const reviewerId = req.user?.userId;
            if (!reviewerId) throw new ApiError(401, 'Unauthorized');
            const review = await hrService.createPerformanceReview({ ...req.body, reviewerId });
            res.status(201).json({ success: true, message: 'Performance review created', data: review });

            if (review.user?.phone) {
                const reviewerName = `${review.reviewer?.firstName || 'HR'} ${review.reviewer?.lastName || ''}`.trim();
                const message = `Hello ${review.user.firstName}, your performance review for the period ${new Date(req.body.periodStart).toLocaleDateString()} – ${new Date(req.body.periodEnd).toLocaleDateString()} has been added by ${reviewerName}. Please check your HR portal.`;
                SmsService.sendSms(review.user.phone, message).catch(console.error);
            }
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async updatePerformance(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const updated = await hrService.updatePerformanceReview(id, req.body);
            res.json({ success: true, message: 'Performance review updated', data: updated });

            if (updated.user?.phone) {
                const message = `Hello ${updated.user.firstName}, your performance review has been updated. Please review the latest feedback on your HR dashboard.`;
                SmsService.sendSms(updated.user.phone, message).catch(console.error);
            }
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }
}

export const hrController = new HRController();
