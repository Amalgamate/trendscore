import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/permissions.middleware';

/**
 * Returns authoritative completion signals for the global setup journey.
 * Read-only: no setup record is changed by this endpoint.
 */
export const getSetupStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const role = String(req.user?.role || '').toUpperCase();
  const school = req.school;

  const [
    activeTerm,
    classCount,
    learningAreaCount,
    staffCount,
    learnerCount,
    communication,
    attendanceCount,
    earliestAttendance,
    assignedClassCount,
    teacherAttendanceCount,
    teacherTestCount,
    teacherResultCount,
    feeTypeCount,
    feeStructureCount,
    feeInvoiceCount,
    feePaymentCount,
    dormitoryCount,
    dormitoryAssignmentCount,
    houseMasterCount,
    completedRollCallCount,
  ] = await Promise.all([
    prisma.termConfig.count({ where: { isActive: true, archived: false } }),
    prisma.class.count({ where: { active: true, archived: false } }),
    prisma.learningArea.count(),
    prisma.user.count({ where: { archived: false, status: 'ACTIVE', role: { notIn: ['PARENT', 'STUDENT'] } } }),
    prisma.learner.count({ where: { archived: false, status: 'ACTIVE' } }),
    prisma.communicationConfig.findFirst({
      select: { smsEnabled: true, emailEnabled: true, whatsappEnabled: true },
    }),
    prisma.attendance.count({ where: { archived: false } }),
    prisma.attendance.findFirst({ where: { archived: false }, orderBy: { date: 'asc' }, select: { date: true } }),
    userId ? prisma.class.count({ where: { teacherId: userId, active: true, archived: false } }) : Promise.resolve(0),
    userId ? prisma.attendance.count({ where: { markedBy: userId, archived: false } }) : Promise.resolve(0),
    userId ? prisma.summativeTest.count({ where: { createdBy: userId, archived: false } }) : Promise.resolve(0),
    userId ? prisma.summativeResult.count({ where: { recordedBy: userId, archived: false } }) : Promise.resolve(0),
    prisma.feeType.count(),
    prisma.feeStructure.count({ where: { active: true, archived: false } }),
    prisma.feeInvoice.count({ where: { archived: false } }),
    prisma.feePayment.count({ where: { archived: false } }),
    prisma.dormitory.count({ where: { ...(school?.id ? { schoolId: school.id } : {}), active: true, archived: false } }),
    prisma.dormitoryAssignment.count({ where: { active: true, archived: false } }),
    prisma.houseMasterAssignment.count({ where: { active: true } }),
    prisma.dormRollCall.count({ where: { ...(school?.id ? { schoolId: school.id } : {}), status: 'COMPLETED' } }),
  ]);

  const hasIdentity = Boolean(
    school?.name?.trim()
    && (school.phone?.trim() || school.email?.trim() || school.address?.trim())
  );
  const hasWeekOfAttendance = Boolean(
    earliestAttendance?.date
    && Date.now() - new Date(earliestAttendance.date).getTime() >= 7 * 24 * 60 * 60 * 1000
  );

  const stages: Record<string, boolean> = {
    school_identity: hasIdentity,
    academics: activeTerm > 0 && classCount > 0 && learningAreaCount > 0,
    staff_accounts: staffCount > 1,
    learners: learnerCount > 0,
    communication: Boolean(communication?.smsEnabled || communication?.emailEnabled || communication?.whatsappEnabled),
    presence_snapshot: attendanceCount > 0,
    analytics_review: attendanceCount > 0 && hasWeekOfAttendance,
    teacher_assignments: assignedClassCount > 0,
    teacher_attendance: teacherAttendanceCount > 0,
    assessment_setup: teacherTestCount > 0,
    assessment_results: teacherResultCount > 0,
    fee_types: feeTypeCount > 0,
    fee_structures: feeStructureCount > 0,
    learner_balances: feeInvoiceCount > 0,
    payment_reconciliation: feePaymentCount > 0,
    financial_reports: feeInvoiceCount > 0 && feePaymentCount > 0,
    dormitories: dormitoryCount > 0,
    boarding_assignments: dormitoryAssignmentCount > 0,
    house_masters: houseMasterCount > 0,
    boarding_roll_call: completedRollCallCount > 0,
  };

  res.status(200).json({
    success: true,
    data: {
      role,
      stages,
      checkedAt: new Date().toISOString(),
    },
  });
};
