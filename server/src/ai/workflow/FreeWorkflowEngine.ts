/**
 * Free Workflow Engine
 *
 * Deterministic, permission-aware assistant responses backed by TrendSCORE data.
 * This mode never sends school data to an external model and has no token cost.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { executeTool } from '../tools/ToolRegistry';
import type { AIContext, AIRequest, AIResponse, UserRole } from '../types';
import { parentAccessService } from '../../services/parent-access.service';
import { getStudentLearnerIds, getTeacherLearnerScope } from '../../services/learner-record-access.service';

export type WorkflowIntent =
  | 'finance'
  | 'accounting'
  | 'attendance'
  | 'homework'
  | 'transport'
  | 'assessments'
  | 'learners'
  | 'pathways'
  | 'reports'
  | 'communication'
  | 'library'
  | 'staff'
  | 'timetable'
  | 'greeting'
  | 'thanks'
  | 'help';

type CardContext = { title?: string; description?: string; visibleContent?: string };
type ScopedLearner = { id: string; firstName: string; lastName: string; grade: string };

const FINANCE_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'ACCOUNTANT']);
const ACCOUNTING_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT']);
const SCHOOL_WIDE_LEARNER_ROLES = new Set<UserRole>([
  'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'HEAD_OF_CURRICULUM',
]);
const LEARNER_WORKFLOW_ROLES = new Set<UserRole>([
  ...SCHOOL_WIDE_LEARNER_ROLES,
  'TEACHER',
  'PARENT',
  'STUDENT',
]);
const LIBRARY_ROLES = new Set<UserRole>([
  'SUPER_ADMIN', 'ADMIN', 'LIBRARIAN',
]);
const STAFF_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN']);
const LEARNING_ROLES = new Set<UserRole>([
  'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'PARENT', 'STUDENT',
]);
const TRANSPORT_MANAGER_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER']);
const TRANSPORT_TRIP_VIEW_ROLES = new Set<UserRole>([
  ...TRANSPORT_MANAGER_ROLES,
  'TEACHER',
  'DRIVER',
]);
const STAFF_DIRECTORY_ROLES: UserRole[] = [
  'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'HEAD_OF_CURRICULUM',
  'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 'NURSE', 'SECURITY', 'DRIVER',
  'COOK', 'CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT',
];

const NAVIGATION: Record<WorkflowIntent, { page: string; label: string }> = {
  finance: { page: 'fees-overview', label: 'Open Fees' },
  accounting: { page: 'accounting-expenses', label: 'Open Expenses' },
  attendance: { page: 'attendance-daily', label: 'Open Attendance' },
  homework: { page: 'learning-assignments', label: 'Open Assignments' },
  transport: { page: 'transport-routes', label: 'Open Transport' },
  assessments: { page: 'assess-mobile-dashboard', label: 'Open Assessments' },
  learners: { page: 'learners-list', label: 'Open Learners' },
  pathways: { page: 'pathways', label: 'Open AI Pathways' },
  reports: { page: 'reports-center', label: 'Open Reports' },
  communication: { page: 'comm-messages', label: 'Open Messages' },
  library: { page: 'library', label: 'Open Library' },
  staff: { page: 'hr-dashboard', label: 'Open Staff & HR' },
  timetable: { page: 'timetable', label: 'Open Timetable' },
  greeting: { page: 'dashboard', label: 'Open Dashboard' },
  thanks: { page: 'dashboard', label: 'Open Dashboard' },
  help: { page: 'dashboard', label: 'Open Dashboard' },
};

const PARENT_NAVIGATION: Partial<Record<WorkflowIntent, { page: string; label: string } | null>> = {
  finance: { page: 'parent-portal-fees', label: 'Open School Fees' },
  attendance: { page: 'parent-portal-attendance', label: 'Open Attendance' },
  homework: { page: 'parent-portal-homework', label: 'Open Diary & Homework' },
  assessments: { page: 'parent-portal-results', label: 'Open Results' },
  learners: { page: 'parent-portal-children', label: 'Open My Children' },
  communication: { page: 'parent-portal-messages', label: 'Open Inbox' },
  pathways: { page: 'parent-portal-pathway', label: 'Open Pathway Planner' },
  transport: null,
};
const STUDENT_NAVIGATION: Partial<Record<WorkflowIntent, { page: string; label: string } | null>> = {
  homework: { page: 'student-assignments', label: 'Open My Assignments' },
  attendance: { page: 'student-attendance', label: 'Open My Attendance' },
  assessments: { page: 'student-results', label: 'Open My Results' },
  pathways: { page: 'student-pathway-planner', label: 'Open My Pathway' },
};

const moduleIntent = (module = ''): WorkflowIntent | null => {
  const value = module.toLowerCase();
  if (/accounting|expense|expenditure|vendor|reconcil|journal|procurement|purchase|spend|ledger/.test(value)) return 'accounting';
  if (/fee|finance|payment|invoice/.test(value)) return 'finance';
  if (/attend|presence/.test(value)) return 'attendance';
  if (/homework|assignment|learning\.hub|lms|learning/.test(value)) return 'homework';
  if (/transport|bus|route|trip|vehicle|driver/.test(value)) return 'transport';
  if (/assess|grade|academic/.test(value)) return 'assessments';
  if (/learner|student/.test(value)) return 'learners';
  if (/pathway|career|senior.school/.test(value)) return 'pathways';
  if (/report|analytic|insight/.test(value)) return 'reports';
  if (/comm|message|inbox|notice/.test(value)) return 'communication';
  if (/library|book/.test(value)) return 'library';
  if (/staff|human|\bhr\b|payroll|leave/.test(value)) return 'staff';
  if (/timetable|schedule/.test(value)) return 'timetable';
  return null;
};

export function detectWorkflowIntent(message: string, currentModule = ''): WorkflowIntent {
  const value = message.toLowerCase();
  if (/\b(thank|thanks|appreciate|perfect|great)\b/.test(value)) return 'thanks';
  if (/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/.test(value)) return 'greeting';
  if (/\b(?:expense|expenses|accounting|expenditure|vendor|vendors|spending|spend|spent|journal|reconciliation|reconcile|bank statement|purchase|procurement|ledger)\b/.test(value)) return 'accounting';
  if (/\b(fee|payment|invoice|receipt|reference|refund|balance|owing|outstanding|arrear|mpesa|ksh|kes|collection|fee structure|fee schedule)\b/.test(value)) return 'finance';
  if (/\b(?:staff|employee|our)\s+(?:attendance|clock(?:ed)?\s*(?:in|out)|presence)\b|\bclock(?:ed)?\s*(?:in|out)\b|\b(?:leave|payroll|salary|payslip|pay slip|earnings|net pay)\b/.test(value)) return 'staff';
  if (/\b(attendance|absent|present|late|register|presence)\b/.test(value)) return 'attendance';
  if (/\b(?:how many|count|number of|headcount)\s+(?:active\s+)?(?:teachers?|drivers?|nurses?|accountants?|receptionists?|librarians?|guards?|security staff|cooks?|cleaners?|groundskeepers?|it support staff)\b/i.test(value)) return 'staff';
  if (/\b(homework|assignment|assignments|holiday work|project|revision work)\b/.test(value)) return 'homework';
  if (/\b(?:transport|bus|route|trip|vehicle|driver|boarding|pickup|drop.?off)\b/.test(value)) return 'transport';
  if (/\b(grade|score|result|assessment|exam|test|cbc|formative|summative)\b/.test(value)) return 'assessments';
  if (/\b(pathway|career|senior school|stem|social sciences|arts and sports)\b/.test(value)) return 'pathways';
  if (/\b(report|analytics|analysis|insight|trend)\b/.test(value)) return 'reports';
  if (/\b(message|inbox|notice|announcement|communication|unread)\b/.test(value)) return 'communication';
  if (/\b(library|book|loan|overdue|borrow)\b/.test(value)) return 'library';
  if (/\b(staff|teacher|employee|human resources|\bhr\b|leave|payroll|salary|payslip|pay slip|driver|nurse|accountant|receptionist|librarian|security|cook|cleaner|groundskeeper|it support|workforce)\b/.test(value)) return 'staff';
  if (/\b(timetable|schedule|lesson|period)\b/.test(value)) return 'timetable';
  if (/\b(learner|student|pupil|admission|enrol|class list)\b/.test(value)) return 'learners';
  return moduleIntent(currentModule) || 'help';
}

export function extractCardContext(message: string): CardContext | null {
  if (!message.includes('Use this visible card context when answering:')) return null;
  const read = (label: string) => {
    const match = message.match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'));
    return match?.[1]?.trim();
  };
  return {
    title: read('Card'),
    description: read('Description'),
    visibleContent: read('Visible card content'),
  };
}

const money = (value: unknown) => `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
const displayName = (learner: ScopedLearner) => `${learner.firstName} ${learner.lastName}`.trim();
const looksLikeSchoolRecordLookup = (message: string) =>
  /\b(?:what|when|where|who|which|does|do|is|are|did|was|were|has|have|how (?:much|many)|show|list|report|total|check|give me|tell me|can i)\b/i.test(message) &&
  /\b(?:school|office|class|staff|teacher|learner|student|pupil|fee|payment|collection|receipt|refund|attendance|assessment|result|score|homework|diary|library|book|loan|transport|trip|route|vehicle|inventory|stock|payroll|salary|leave|incident|discipline|medical|health|admission|application|term|calendar|policy|procedure|deadline|course|uniform|expense|spending|expenditure|accounting|ledger|vendor|journal|reconciliation|fuel|maintenance|meal|kitchen|hostel|boarding|safeguarding|asset|store|purchase|procurement|visitor)\b/i.test(message);
const SCHOOL_TIME_ZONE = 'Africa/Nairobi';
const UNSUPPORTED_DATE_PATTERNS = [
  /\b(?:this|last|past|previous|current|next|upcoming)\s+(?:week|month|term|year|morning|afternoon|quarter|\d+\s+days?)\b/i,
  /\b(?:financial|fiscal)\s+year\b/i,
  /\bterm\s*[123]\b|\b(?:first|second|third)\s+term\b/i,
  /\b20\d{2}(?:-\d{2}-\d{2})?\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/i,
  /\b(?:in|during|for|on)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{1,2}(?:st|nd|rd|th)?)?\b/i,
  /\b(?:on|for|during)\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
];
const asksUnsupportedDateRange = (message: string) => UNSUPPORTED_DATE_PATTERNS.some((pattern) => pattern.test(message));

function getNairobiDayRange(dayOffset = 0, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localDate = new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day) + dayOffset));
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();

  // Kenya uses UTC+03:00 year-round. Build the UTC instants for local midnight
  // so a host running in UTC still reports the school's calendar day correctly.
  const start = new Date(Date.UTC(year, month, day, -3));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const label = new Intl.DateTimeFormat('en-KE', {
    timeZone: SCHOOL_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(start);

  const calendarStart = new Date(Date.UTC(year, month, day));
  const calendarEnd = new Date(calendarStart.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, calendarStart, calendarEnd, label };
}

const meta = (start: number) => ({
  provider: 'workflow', model: 'deterministic-v1', inputTokens: 0, outputTokens: 0, durationMs: Date.now() - start,
});

const response = (
  start: number,
  message: string,
  intent: WorkflowIntent,
  data?: Record<string, unknown>,
  navigation: { page: string; label: string } | null = NAVIGATION[intent],
): AIResponse => ({
  message,
  data: { intent, ...(navigation ? { navigation } : {}), ...(data || {}) },
  meta: meta(start),
});

function roleScopedNavigation(result: AIResponse, role: UserRole): AIResponse {
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) return result;
  const resultData = result.data as Record<string, unknown>;
  const intent = resultData.intent as WorkflowIntent | undefined;
  if (!intent) return result;
  const roleMap = role === 'PARENT' ? PARENT_NAVIGATION : role === 'STUDENT' ? STUDENT_NAVIGATION : null;
  if (!roleMap) return result;
  const navigation = roleMap[intent] ?? null;
  const data = { ...resultData };
  delete data.navigation;
  if (navigation) data.navigation = navigation;
  return { ...result, data };
}

async function getScopedLearners(context: AIContext): Promise<ScopedLearner[] | null> {
  if (SCHOOL_WIDE_LEARNER_ROLES.has(context.user.role)) return null;
  if (context.user.role === 'TEACHER') {
    const teacherScope = await getTeacherLearnerScope(context.user.id);
    return prisma.learner.findMany({
      where: { archived: false, status: 'ACTIVE', ...teacherScope },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
  }
  if (context.user.role === 'PARENT') {
    const learnerIds = await parentAccessService.getAccessibleLearnerIds(context.user.id);
    if (!learnerIds.length) return [];
    return prisma.learner.findMany({
      where: {
        archived: false,
        id: { in: learnerIds },
      },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
  }
  if (context.user.role === 'STUDENT') {
    const learnerIds = await getStudentLearnerIds(context.user.id);
    if (!learnerIds.length) return [];
    return prisma.learner.findMany({
      where: { id: { in: learnerIds }, archived: false },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
  }
  return [];
}

const learnerWhere = (learners: ScopedLearner[] | null) => learners === null ? {} : { learnerId: { in: learners.map(({ id }) => id) } };

async function financeWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  const hasFinanceAccess = FINANCE_ROLES.has(context.user.role);
  const canViewOwnFees = context.user.role === 'PARENT';
  if (!hasFinanceAccess && !canViewOwnFees) {
    return response(start, 'Fee information is available to authorised finance staff and school leaders. Parents can ask about fees linked to their own account.', 'finance');
  }
  const learners = hasFinanceAccess ? null : await getScopedLearners(context);
  if (learners !== null && learners.length === 0) {
    return response(start, 'I could not find a learner record linked to your account, so I cannot show a fee balance yet.', 'finance');
  }

  const asksYesterday = /\byesterday\b/i.test(userMessage);
  const asksToday = /\b(?:today|daily|this day|for the day|the day)\b/i.test(userMessage) && !/\bby the day\b/i.test(userMessage);
  if (/\b(?:expected|projected|forecast|budgeted|planned|target|refund|refunded|refunds|fee structure|fee schedule|transaction reference|reference number|receipt number|mpesa code)\b/i.test(userMessage)) {
    return response(start, 'I can report recorded payment totals from the ledger, but I can’t verify forecasts, budgets, fee structures, refunds, or individual receipt/reference details in this assistant. Use Fees → Reports or the relevant payment record.', 'finance');
  }
  if (/\b(?:due|payable|deadline)\b/i.test(userMessage) && /\b(?:today|yesterday|date|when)\b/i.test(userMessage)) {
    return response(start, 'I can’t verify invoice due-date totals in this assistant. Use Fees → Reports and select the due-date filter; I won’t substitute collected payments for amounts due.', 'finance');
  }
  const asksUnsupportedPeriod = asksUnsupportedDateRange(userMessage);
  if (asksUnsupportedPeriod) {
    return response(start,
      'I can verify fee payments for today or yesterday from the payment ledger. For another date range, use Fees → Reports and set the report dates; I will not estimate a total.',
      'finance');
  }
  if (/\b(?:by class|by grade|by month|by day|by date|by staff|by teacher|by method|by channel|breakdown|split|grouped)\b/i.test(userMessage) && !asksToday && !asksYesterday) {
    return response(start,
      'I do not have a verified grouped fee report for that request yet. Use Fees → Reports to select the date range and breakdown; I will not invent group totals.',
      'finance');
  }
  if (/\b(?:for grade\s*\d|for class\s+[a-z0-9]|for stream\s+[a-z0-9]|learner named|student named|admission number)\b/i.test(userMessage)) {
    return response(start, 'I can verify school-wide fee totals for authorised finance staff, or linked account totals for a parent. I can’t filter fee records by a requested grade, class, stream, or learner name here yet; use Fees to apply that filter.', 'finance');
  }

  const paymentWhere: Prisma.FeePaymentWhereInput = {
    archived: false,
    ...(learners !== null ? { invoice: { learnerId: { in: learners.map(({ id }) => id) } } } : {}),
  };

  if (asksYesterday || asksToday) {
    const { start: rangeStart, end: rangeEnd, label } = getNairobiDayRange(asksYesterday ? -1 : 0);
    paymentWhere.paymentDate = { gte: rangeStart, lt: rangeEnd };
    const daily = await prisma.feePayment.aggregate({
      where: paymentWhere,
      _count: { _all: true },
      _sum: { amount: true },
    });
    const count = daily._count._all;
    const period = asksYesterday ? 'yesterday' : 'today';
    const scope = learners === null ? 'school-wide' : context.user.role === 'PARENT'
      ? 'for learners linked to your parent account'
      : 'for your learner account';
    const breakdownNote = /\b(?:by class|by grade|by month|by day|by date|by staff|by teacher|by method|by channel|breakdown|split|grouped)\b/i.test(userMessage)
      ? ' This is the overall total only; it does not include the requested group breakdown.'
      : '';
    const message = count
      ? `Fee payments dated ${period} (${label}, East Africa Time) total ${money(daily._sum.amount)} across ${count} recorded payment${count === 1 ? '' : 's'} ${scope}.${breakdownNote}`
      : `No non-archived fee payment records dated ${period} (${label}, East Africa Time) were found ${scope}.${breakdownNote}`;
    return response(start, message, 'finance', {
      collection: {
        period,
        date: label,
        timeZone: SCHOOL_TIME_ZONE,
        basis: 'non-archived fee payment records by paymentDate',
        paymentCount: count,
        amount: Number(daily._sum.amount || 0),
      },
    });
  }

  const [invoices, payments] = await Promise.all([
    prisma.feeInvoice.aggregate({
      where: { archived: false, ...learnerWhere(learners) },
      _count: { _all: true },
      _sum: { totalAmount: true, balance: true },
    }),
    prisma.feePayment.aggregate({
      where: paymentWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);
  const scope = learners === null ? 'All-time school fee ledger overview' : `All-time fee ledger overview for ${learners.map(displayName).join(', ')}`;
  return response(start,
    `${scope} (all non-archived records, no date filter): ${invoices._count._all} invoice(s), ${money(invoices._sum.totalAmount)} billed, ${money(payments._sum.amount)} in ${payments._count._all} recorded payment(s), and ${money(invoices._sum.balance)} outstanding.`,
    'finance', { invoices, payments });
}

async function accountingWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  if (!ACCOUNTING_ROLES.has(context.user.role)) {
    return response(start, 'Expense and accounting summaries are available to authorised school administrators and accountants. For fee balances or recorded fee payments, ask about Fees.', 'accounting');
  }
  if (asksUnsupportedDateRange(userMessage)) {
    return response(start, 'I can summarize recorded expenses for today or yesterday, or give an all-time overview. For another period, use Accounting → Expenses and select the dates.', 'accounting');
  }
  if (/\b(?:by vendor|vendor|supplier|by category|category|fuel|uniform|food|meal|maintenance|purchase|procurement|by account|payment method|reference|receipt|journal|reconcil|bank balance|cash flow|profit|loss|budget|forecast|pending|unpaid|due|individual|specific expense|show me|list|details?)\b/i.test(userMessage)) {
    return response(start, 'I can summarize recorded expense totals and their recorded statuses, but I can’t verify a specific vendor, category, reference, unpaid balance, journal, or bank reconciliation here. Open Accounting → Expenses or Reconciliation to verify those records.', 'accounting');
  }

  const asksYesterday = /\byesterday\b/i.test(userMessage);
  const asksToday = /\b(?:today|daily|this day|for the day|the day)\b/i.test(userMessage) && !/\bby the day\b/i.test(userMessage);
  const where: Prisma.ExpenseWhereInput = {};
  const dayRange = asksYesterday || asksToday ? getNairobiDayRange(asksYesterday ? -1 : 0) : null;
  if (dayRange) where.date = { gte: dayRange.start, lt: dayRange.end };
  const rows = await prisma.expense.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
    _sum: { amount: true },
  });
  const totalCount = rows.reduce((sum, row) => sum + row._count._all, 0);
  const recordedAmount = rows.reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
  const paid = rows.find((row) => row.status.toUpperCase() === 'PAID');
  const paidAmount = Number(paid?._sum.amount || 0);
  const paidCount = paid?._count._all || 0;
  const otherRows = rows.filter((row) => row.status.toUpperCase() !== 'PAID');
  const otherCount = otherRows.reduce((sum, row) => sum + row._count._all, 0);
  const date = dayRange?.label || null;
  const period = asksYesterday ? `for yesterday (${date}, East Africa Time)`
    : asksToday ? `for today (${date}, East Africa Time)`
      : 'across all recorded dates';
  const message = totalCount
    ? `Expense records ${period}: ${money(recordedAmount)} across ${totalCount} record(s); ${money(paidAmount)} across ${paidCount} marked PAID${otherCount ? `, with ${otherCount} record(s) in other statuses` : ''}. These are expense entries recorded in the school database; this summary does not confirm bank reconciliation.`
    : `No expense records ${period} were found in the school database.`;
  return response(start, message, 'accounting', {
    period: date || 'all recorded dates',
    recordCount: totalCount,
    recordedAmount,
    paidCount,
    paidAmount,
    otherStatuses: otherRows.map((row) => ({ status: row.status, count: row._count._all, amount: Number(row._sum.amount || 0) })),
    source: 'expense records; not bank reconciliation',
  });
}

async function attendanceWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  if (!LEARNER_WORKFLOW_ROLES.has(context.user.role)) {
    return response(start, 'Attendance summaries are available to school leaders, teachers for their assigned classes, and parents or learners for linked records.', 'attendance');
  }
  if (asksUnsupportedDateRange(userMessage)) {
    return response(start, 'I can summarize today’s or yesterday’s attendance only. For another date range, use Attendance and select the required dates.', 'attendance');
  }
  if (/\b(?:grade\s*\d|class\s+[a-z0-9]|stream\s+[a-z0-9]|which learners|list learners|attendance for .+class)\b/i.test(userMessage)) {
    return response(start, 'I can give the overall attendance summary for your permitted learner scope, but I can’t filter it by a requested grade, class, or stream yet. Use Attendance to select that group.', 'attendance');
  }
  const learners = await getScopedLearners(context);
  if (learners !== null && learners.length === 0) {
    return response(start, 'I could not find a learner record linked to your account, so no attendance summary is available.', 'attendance');
  }
  const asksYesterday = /\byesterday\b/i.test(userMessage);
  const { calendarStart: today, calendarEnd: tomorrow, label: todayLabel } = getNairobiDayRange(asksYesterday ? -1 : 0);
  const rows = await prisma.attendance.groupBy({
    by: ['status'],
    where: { archived: false, date: { gte: today, lt: tomorrow }, ...learnerWhere(learners) },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  const present = Number(counts.PRESENT || 0);
  const rate = total ? Math.round((present / total) * 100) : 0;
  const scope = learners === null
    ? `Attendance for ${todayLabel} (East Africa Time)`
    : `Attendance for ${learners.map(displayName).join(', ')} on ${todayLabel} (East Africa Time)`;
  return response(start,
    total
      ? `${scope}: ${present} present out of ${total} marked (${rate}%). Absent: ${counts.ABSENT || 0}; late: ${counts.LATE || 0}; excused/sick: ${Number(counts.EXCUSED || 0) + Number(counts.SICK || 0)}.`
      : `${scope} has not been marked yet.`,
    'attendance', { counts, total, rate });
}

async function homeworkWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  if (!LEARNING_ROLES.has(context.user.role)) {
    return response(start, 'Assignments are available to school leaders, teachers, students, and parents of linked learners.', 'homework');
  }
  if (/\b(?:due today|due tomorrow|overdue|this week|next week|grade\s*\d|class\s+[a-z0-9]+|stream\s+[a-z0-9]+|subject|learning area|specific assignment)\b/i.test(userMessage)) {
    return response(start, 'I can list recent assignments in your permitted scope, but I can’t filter the assistant summary by subject, class, or due-date status yet. Open Assignments to apply those filters.', 'homework');
  }

  const isParentOrStudent = context.user.role === 'PARENT' || context.user.role === 'STUDENT';
  const learners = isParentOrStudent ? await getScopedLearners(context) : null;
  if (learners !== null && learners.length === 0) {
    return response(start, 'I could not find an active learner record linked to your account, so I can’t show assignments.', 'homework');
  }

  let classIds: string[] | undefined;
  let scopedLearnersByClass = new Map<string, ScopedLearner[]>();
  if (learners !== null) {
    const enrollments = await prisma.classEnrollment.findMany({
      where: { learnerId: { in: learners.map(({ id }) => id) }, active: true, archived: false },
      select: { classId: true, learnerId: true },
    });
    classIds = [...new Set(enrollments.map(({ classId }) => classId))];
    const learnerById = new Map(learners.map((learner) => [learner.id, learner]));
    for (const enrollment of enrollments) {
      const learner = learnerById.get(enrollment.learnerId);
      if (!learner) continue;
      scopedLearnersByClass.set(enrollment.classId, [...(scopedLearnersByClass.get(enrollment.classId) || []), learner]);
    }
    if (!classIds.length) {
      return response(start, 'No active class enrollment is linked to the learners on your account, so no published assignments are available.', 'homework');
    }
  }

  const where: Prisma.LearningAssignmentWhereInput = {
    schoolId: context.school.id,
    archived: false,
    ...(context.user.role === 'TEACHER' ? { createdById: context.user.id } : {}),
    ...(classIds ? { classId: { in: classIds }, status: { in: ['PUBLISHED', 'CLOSED'] } } : {}),
  };
  const [assignments, total] = await Promise.all([
    prisma.learningAssignment.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 8,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        dueDate: true,
        createdAt: true,
        classId: true,
        class: { select: { name: true, grade: true, stream: true } },
        learningArea: { select: { name: true } },
        submissions: {
          where: { learnerId: { in: learners?.map(({ id }) => id) || [] }, archived: false },
          select: { learnerId: true, status: true, submittedAt: true },
        },
      },
    }),
    prisma.learningAssignment.count({ where }),
  ]);

  const formatter = new Intl.DateTimeFormat('en-KE', { timeZone: SCHOOL_TIME_ZONE, dateStyle: 'medium' });
  const rows = assignments.map((assignment) => {
    const category = assignment.category.toLowerCase().replace(/_/g, ' ');
    const due = assignment.dueDate ? `due ${formatter.format(assignment.dueDate)}` : 'no due date recorded';
    const classLabel = assignment.class.name || `${assignment.class.grade}${assignment.class.stream ? ` ${assignment.class.stream}` : ''}`;
    const learnerStatus = learners === null ? '' : (scopedLearnersByClass.get(assignment.classId) || [])
      .map((learner) => {
        const submission = assignment.submissions?.find((item) => item.learnerId === learner.id);
        const status = submission?.status.toLowerCase().replace(/_/g, ' ') || 'not submitted';
        return `${displayName(learner)}: ${status}`;
      }).join(', ');
    return `• ${assignment.title} (${category}) — ${assignment.learningArea.name}, ${classLabel}; ${due}${learnerStatus ? `; ${learnerStatus}` : ''}.`;
  });

  if (!total) {
    const scope = context.user.role === 'TEACHER' ? 'No assignments created by you were found' : 'No assignments were found';
    return response(start, `${scope} in your permitted scope. Diary notes and published LMS assignments are separate records.`, 'homework', { total: 0, assignments: [] });
  }

  const intro = context.user.role === 'TEACHER'
    ? `Your assignments: ${total} record(s), including your drafts and published work.`
    : learners === null
      ? `School assignments: ${total} record(s).`
      : `Published assignments for learners linked to your account: ${total} record(s).`;
  const more = total > assignments.length ? ` Showing the ${assignments.length} closest due dates.` : '';
  return response(start, `${intro}${more}\n${rows.join('\n')}`, 'homework', { total, assignments });
}

async function transportWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  const role = context.user.role;
  const isFamily = role === 'PARENT' || role === 'STUDENT';
  const isDriver = role === 'DRIVER';
  const canViewTrips = TRANSPORT_TRIP_VIEW_ROLES.has(role);
  const canManageTransport = TRANSPORT_MANAGER_ROLES.has(role);
  const transportNavigation = canManageTransport ? NAVIGATION.transport : null;
  const answer = (message: string, data?: Record<string, unknown>) =>
    response(start, message, 'transport', data, transportNavigation);

  if (!canViewTrips && !isFamily) {
    return answer('Transport information is available to authorised school leaders, teachers, assigned drivers, and parents or learners linked to an active transport assignment.');
  }
  if (asksUnsupportedDateRange(userMessage)) {
    return answer(isFamily
      ? 'I can check active transport assignments, but historical trip summaries are not available in Parent Portal yet. Please contact the school office for another date range.'
      : 'I can check today’s or yesterday’s transport records only. Open the Transport module for another date range.');
  }
  if (/\b(?:live location|gps|track(?:ing)?|manifest|who(?:'s| is) on (?:the )?bus|other learners|driver(?:'s)? phone|driver contact|fuel|maintenance|incident)\b/i.test(userMessage)) {
    const nextStep = isFamily
      ? 'Please contact the school office.'
      : isDriver
        ? 'Please use your assigned trip screen.'
        : 'Please use the authorised Transport screen or contact the school office.';
    return answer(`I can’t provide live GPS, passenger manifests, another learner’s details, driver contact details, fuel, or maintenance records in this assistant. ${nextStep}`);
  }

  const asksYesterday = /\byesterday\b/i.test(userMessage);
  const { calendarStart, calendarEnd, label } = getNairobiDayRange(asksYesterday ? -1 : 0);

  if (isFamily) {
    const learners = await getScopedLearners(context);
    if (!learners?.length) {
      return answer('I could not find a learner linked to your account, so I can’t look up a transport assignment.');
    }
    const assignments = await prisma.transportAssignment.findMany({
      where: {
        passengerId: { in: learners.map(({ id }) => id) },
        passengerType: 'LEARNER',
        status: 'ACTIVE',
        archived: false,
        route: { is: { status: 'ACTIVE', archived: false } },
      },
      select: {
        passengerId: true,
        pickupPoint: true,
        dropoffPoint: true,
        route: { select: { name: true, vehicle: { select: { registrationNumber: true, status: true, archived: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!assignments.length) {
      return answer('No active transport assignment was found for the learners linked to your account. Contact the school office if you expected a route to be assigned.', { assignments: [] });
    }
    const learnerById = new Map(learners.map((learner) => [learner.id, learner]));
    const lines = assignments.map((assignment) => {
      const learner = learnerById.get(assignment.passengerId);
      const details = [
        `route ${assignment.route.name}`,
        assignment.pickupPoint ? `pickup: ${assignment.pickupPoint}` : null,
        assignment.dropoffPoint ? `drop-off: ${assignment.dropoffPoint}` : null,
        assignment.route.vehicle && !assignment.route.vehicle.archived && assignment.route.vehicle.status === 'ACTIVE'
          ? `vehicle: ${assignment.route.vehicle.registrationNumber}`
          : null,
      ].filter(Boolean).join('; ');
      return `• ${learner ? displayName(learner) : 'Linked learner'} — ${details}.`;
    });
    return answer(`Active transport assignments for learners linked to your account:\n${lines.join('\n')}\n\nThis is the school’s recorded assignment; it does not show live vehicle location or confirm today’s pickup.`, {
      assignments: assignments.map((assignment) => ({
        learner: learnerById.has(assignment.passengerId) ? displayName(learnerById.get(assignment.passengerId)!) : null,
        route: assignment.route.name,
        pickupPoint: assignment.pickupPoint,
        dropoffPoint: assignment.dropoffPoint,
        vehicleRegistration: assignment.route.vehicle && !assignment.route.vehicle.archived && assignment.route.vehicle.status === 'ACTIVE'
          ? assignment.route.vehicle.registrationNumber
          : null,
      })),
    });
  }

  if (isDriver) {
    const trips = await prisma.transportTrip.findMany({
      where: {
        schoolId: context.school.id,
        driverUserId: context.user.id,
        archived: false,
        date: { gte: calendarStart, lt: calendarEnd },
      },
      orderBy: [{ direction: 'asc' }],
      take: 10,
      select: {
        direction: true,
        status: true,
        route: { select: { name: true } },
      },
    });
    if (!trips.length) {
      return answer(`No transport trips assigned to your account were found for ${asksYesterday ? 'yesterday' : 'today'} (${label}, East Africa Time).`, { date: label, trips: [] });
    }
    const lines = trips.map((trip) => `• ${trip.route.name} — ${trip.direction.toLowerCase()}, ${trip.status.toLowerCase().replace(/_/g, ' ')}.`);
    return answer(`Your assigned trips for ${label} (East Africa Time):\n${lines.join('\n')}`, {
      date: label,
      trips: trips.map((trip) => ({ route: trip.route.name, direction: trip.direction, status: trip.status })),
    });
  }

  if (!canViewTrips) {
    return answer('Transport trip summaries are not available to your role. Please contact the school office.');
  }

  // Trips are schoolId-scoped in the shared schema. The route, vehicle, and
  // assignment tables are in each school’s dedicated database.
  const tripsPromise = prisma.transportTrip.groupBy({
    by: ['status', 'direction'],
    where: {
      schoolId: context.school.id,
      archived: false,
      date: { gte: calendarStart, lt: calendarEnd },
    },
    _count: { _all: true },
  });
  const [tripRows, routeCount, vehicleCount, assignmentCount] = await Promise.all([
    tripsPromise,
    canManageTransport ? prisma.transportRoute.count({ where: { archived: false, status: 'ACTIVE' } }) : Promise.resolve(null),
    canManageTransport ? prisma.transportVehicle.count({ where: { archived: false, status: 'ACTIVE' } }) : Promise.resolve(null),
    canManageTransport ? prisma.transportAssignment.count({ where: { archived: false, status: 'ACTIVE', passengerType: 'LEARNER' } }) : Promise.resolve(null),
  ]);
  const tripTotal = tripRows.reduce((sum, row) => sum + row._count._all, 0);
  const tripSummary = tripRows.length
    ? tripRows.map((row) => `${row.direction.toLowerCase()} ${row.status.toLowerCase().replace(/_/g, ' ')}: ${row._count._all}`).join('; ')
    : 'no trips recorded';
  const inventorySummary = canManageTransport
    ? ` Active setup: ${routeCount ?? 0} route(s), ${vehicleCount ?? 0} vehicle(s), and ${assignmentCount ?? 0} learner assignment(s).`
    : '';
  const scope = role === 'TEACHER' ? 'School trip status summary' : 'Transport operations summary';
  const message = `${scope} for ${label} (East Africa Time): ${tripTotal} trip(s) — ${tripSummary}.${inventorySummary}`;
  return answer(message, {
    date: label,
    tripCount: tripTotal,
    tripRows,
    ...(canManageTransport ? { routeCount, vehicleCount, assignmentCount } : {}),
  });
}

async function learnerWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  if (!LEARNER_WORKFLOW_ROLES.has(context.user.role)) {
    return response(start, 'Learner summaries are available to school leaders, teachers for their assigned classes, parents for linked children, and learners for their own record.', 'learners');
  }
  if (/\b(?:grade\s*\d|class\s+[a-z0-9]|stream\s+[a-z0-9]|admission number|specific learner|learner named|student named)\b/i.test(userMessage)) {
    return response(start, 'I can show the learner records in your permitted scope or an overall grade distribution, but I can’t filter the assistant summary by a requested grade, class, stream, or name yet. Open Learners to apply that filter.', 'learners');
  }
  const learners = await getScopedLearners(context);
  if (learners !== null) {
    if (!learners.length) return response(start, 'I could not find a learner record linked to your account.', 'learners');
    return response(start, `Linked learner${learners.length === 1 ? '' : 's'}: ${learners.map((item) => `${displayName(item)} (${item.grade})`).join(', ')}.`, 'learners', { learners });
  }
  const [count, grades] = await Promise.all([
    prisma.learner.count({ where: { archived: false, status: 'ACTIVE' } }),
    prisma.learner.groupBy({ by: ['grade'], where: { archived: false, status: 'ACTIVE' }, _count: { _all: true }, orderBy: { grade: 'asc' } }),
  ]);
  const gradeText = grades.slice(0, 8).map((row) => `${row.grade}: ${row._count._all}`).join('; ');
  return response(start, `There are ${count} active learners. Grade distribution: ${gradeText || 'not available'}.`, 'learners', { count, grades });
}

async function assessmentWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  if (!LEARNER_WORKFLOW_ROLES.has(context.user.role)) {
    return response(start, 'Assessment summaries are available to school leaders, teachers for their assigned classes, and parents or learners for published results linked to them.', 'assessments');
  }
  if (/\b(?:latest|last|individual|specific|subject|learning area|report card|score for|result for|marks for|grade in)\b/i.test(userMessage)) {
    return response(start, 'I can summarize the overall assessment records in your permitted learner scope, but I can’t verify a specific subject, exam, or learner result in this assistant yet. Open Results to view the published assessment details.', 'assessments');
  }
  const learners = await getScopedLearners(context);
  if (learners !== null && learners.length === 0) return response(start, 'I could not find a learner record linked to your account.', 'assessments');
  const parentOrStudent = context.user.role === 'PARENT' || context.user.role === 'STUDENT';
  const resultWhere: Prisma.SummativeResultWhereInput = {
    archived: false,
    ...learnerWhere(learners),
    ...(parentOrStudent ? { test: { is: { published: true, active: true, archived: false } } } : {}),
  };
  const formativeWhere: Prisma.FormativeAssessmentWhereInput = {
    archived: false,
    ...learnerWhere(learners),
    ...(parentOrStudent ? { status: 'PUBLISHED' } : {}),
  };
  const [summative, formativeCount] = await Promise.all([
    prisma.summativeResult.aggregate({ where: resultWhere, _count: { _all: true }, _avg: { percentage: true } }),
    prisma.formativeAssessment.count({ where: formativeWhere }),
  ]);
  const average = summative._avg.percentage == null ? 'not available' : `${Math.round(summative._avg.percentage)}%`;
  const scope = learners === null ? 'Assessment overview' : `Assessment overview for ${learners.map(displayName).join(', ')}`;
  return response(start, `${scope}: ${formativeCount} formative record(s), ${summative._count._all} summative result(s), with a ${average} summative average.`, 'assessments', { summative, formativeCount });
}

async function communicationWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  if (/\b(?:announcement|notice|broadcast|from parents?|from teachers?|from drivers?|from staff|message content|what did .* (?:say|send))\b/i.test(userMessage)) {
    return response(start, 'I can count your unread inbox messages, but I can’t yet search message contents, announcements, or filter by sender here. Open Messages to verify those details.', 'communication');
  }
  const unread = await prisma.messageReceipt.count({ where: { recipientId: context.user.id, readAt: null } });
  return response(start, `You have ${unread} unread message${unread === 1 ? '' : 's'}. Open Messages to read or reply.`, 'communication', { unread });
}

async function libraryWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  if (!LIBRARY_ROLES.has(context.user.role)) {
    return response(start, 'Library inventory and circulation summaries are available to the librarian and authorised school leaders.', 'library');
  }
  if (/\b(?:which|who|title|name|due today|due tomorrow|due on|borrowed by|borrower|specific book|individual loan)\b/i.test(userMessage)) {
    return response(start, 'I can summarize total library stock and active or overdue loan counts, but I can’t identify specific books, borrowers, or due dates here yet. Open Library to view those records.', 'library');
  }
  const [books, loans] = await Promise.all([
    prisma.book.aggregate({ _count: { _all: true }, _sum: { totalCopies: true, availableCopies: true } }),
    prisma.bookLoan.groupBy({ by: ['status'], where: { status: { in: ['ACTIVE', 'OVERDUE'] } }, _count: { _all: true } }),
  ]);
  const loanCounts = Object.fromEntries(loans.map((row) => [row.status, row._count._all]));
  return response(start, `Library overview: ${books._count._all} titles, ${books._sum.availableCopies || 0} of ${books._sum.totalCopies || 0} copies available, ${loanCounts.ACTIVE || 0} active loan(s), and ${loanCounts.OVERDUE || 0} overdue.`, 'library', { books, loanCounts });
}

async function staffWorkflow(context: AIContext, start: number, userMessage: string): Promise<AIResponse> {
  const selfRequest = /\b(?:my|mine|me|i am|am i|did i|have i|i clocked|i signed)\b/i.test(userMessage);
  const asksAttendance = /\b(?:attendance|clock(?:ed)?\s*in|clock(?:ed)?\s*out|presence)\b/i.test(userMessage);
  const asksLeave = /\b(?:leave|time off|holiday request)\b/i.test(userMessage);
  const asksPayroll = /\b(?:payroll|salary|salaries|payslip|pay slip|earnings|net pay)\b/i.test(userMessage);

  // Personal workforce information is available only for the authenticated user.
  if (selfRequest && asksAttendance) {
    const asksYesterday = /\byesterday\b/i.test(userMessage);
    if (asksUnsupportedDateRange(userMessage)) {
      return response(start, 'I can check your clock record for today or yesterday. Open Staff Attendance for another date range.', 'staff');
    }
    const { calendarStart: dayStart, calendarEnd: dayEnd, label } = getNairobiDayRange(asksYesterday ? -1 : 0);
    const attendance = await prisma.staffAttendanceLog.findFirst({
      where: { userId: context.user.id, date: { gte: dayStart, lt: dayEnd } },
      select: { status: true, clockInAt: true, clockOutAt: true },
    });
    if (!attendance) return response(start, `I found no staff clock record for you on ${label} (East Africa Time).`, 'staff', { date: label, attendance: null });
    const time = (value: Date | null) => value ? new Intl.DateTimeFormat('en-KE', { timeZone: SCHOOL_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(value) : 'not recorded';
    return response(start, `Your staff attendance on ${label}: ${attendance.status.toLowerCase().replace(/_/g, ' ')}; clock-in ${time(attendance.clockInAt)}; clock-out ${time(attendance.clockOutAt)}.`, 'staff', { date: label, attendance });
  }

  if (selfRequest && asksLeave) {
    const leave = await prisma.leaveRequest.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { status: true, startDate: true, endDate: true, createdAt: true, leaveType: { select: { name: true } } },
    });
    if (!leave.length) return response(start, 'I found no leave requests for your account. Open Staff & HR to submit a request or check the leave policy.', 'staff', { leaveRequests: [] });
    const rows = leave.map((item) => `${item.leaveType.name}: ${item.status.toLowerCase()} (${new Intl.DateTimeFormat('en-KE', { timeZone: SCHOOL_TIME_ZONE, dateStyle: 'medium' }).format(item.startDate)}–${new Intl.DateTimeFormat('en-KE', { timeZone: SCHOOL_TIME_ZONE, dateStyle: 'medium' }).format(item.endDate)})`);
    return response(start, `Your recent leave requests: ${rows.join('; ')}.`, 'staff', { leaveRequests: leave });
  }

  if (selfRequest && asksPayroll) {
    const payroll = await prisma.payrollRecord.findMany({
      where: { userId: context.user.id, status: { in: ['GENERATED', 'PAID'] } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 3,
      select: { month: true, year: true, netSalary: true, status: true, paidAt: true },
    });
    if (!payroll.length) return response(start, 'I found no released or paid payslip for your account. Draft payroll is not shown here; contact the school office if you expected a payslip.', 'staff', { payroll: [] });
    const lines = payroll.map((item) => `${new Intl.DateTimeFormat('en-KE', { month: 'long' }).format(new Date(Date.UTC(item.year, item.month - 1, 1)))} ${item.year}: ${money(item.netSalary)} (${item.status.toLowerCase()})`);
    return response(start, `Your latest released payroll records: ${lines.join('; ')}.`, 'staff', { payroll });
  }

  if (!STAFF_ROLES.has(context.user.role)) {
    return response(start, 'Staff records are restricted. You can ask about your own attendance, leave requests, or released payslips; other staff records are not available to your role.', 'staff');
  }

  // Do not turn a question about a particular employee's leave, attendance, or
  // pay into an unrelated school-wide headcount.
  if (asksAttendance || asksLeave || asksPayroll || /\b(?:who|which|list|name|show|details?)\b/i.test(userMessage)) {
    return response(start, 'This assistant can provide approved staff headcounts, but it does not expose another person’s attendance, leave, or payroll details. Use the relevant Staff & HR page for records you are authorised to review.', 'staff');
  }

  const roleCounts: Array<{ label: string; roles: UserRole[]; pattern: RegExp }> = [
    { label: 'teaching staff', roles: ['TEACHER', 'HEAD_OF_CURRICULUM', 'DEPUTY_HEAD_TEACHER', 'HEAD_TEACHER'], pattern: /\b(?:teachers?|teaching staff|class teachers?)\b/i },
    { label: 'drivers', roles: ['DRIVER'], pattern: /\bdrivers?\b/i },
    { label: 'nurses', roles: ['NURSE'], pattern: /\bnurses?\b/i },
    { label: 'accountants', roles: ['ACCOUNTANT'], pattern: /\baccountants?|finance staff\b/i },
    { label: 'reception staff', roles: ['RECEPTIONIST'], pattern: /\breceptionists?|reception staff\b/i },
    { label: 'librarians', roles: ['LIBRARIAN'], pattern: /\blibrarians?\b/i },
    { label: 'security staff', roles: ['SECURITY'], pattern: /\bsecurity (?:staff|guards?)|guards?\b/i },
    { label: 'IT support staff', roles: ['IT_SUPPORT'], pattern: /\bit (?:staff|support)|it support staff\b/i },
    { label: 'cooks', roles: ['COOK'], pattern: /\bcooks?|kitchen staff\b/i },
    { label: 'cleaners', roles: ['CLEANER'], pattern: /\bcleaners?\b/i },
    { label: 'grounds staff', roles: ['GROUNDSKEEPER'], pattern: /\bgroundskeepers?|grounds staff\b/i },
  ];
  const asksForCount = /\b(?:how many|count|number of|headcount|total)\b/i.test(userMessage);
  const subgroup = roleCounts.find((item) => item.pattern.test(userMessage));
  if (!asksForCount || (!subgroup && !/\bstaff\b|\bworkforce\b/i.test(userMessage))) {
    return response(start, 'I can provide active staff headcounts by role. Ask “How many teachers/drivers/nurses are active?” For individual staff records, use the authorised Staff & HR screens.', 'staff');
  }

  const roles = subgroup?.roles || STAFF_DIRECTORY_ROLES;
  const count = await prisma.user.count({
    where: {
      archived: false,
      status: 'ACTIVE',
      OR: [
        { role: { in: roles } },
        { roles: { hasSome: roles } },
      ],
    },
  });
  const label = subgroup?.label || 'staff accounts';
  return response(start, `There are ${count} active ${label}. Counts include users whose primary or additional role matches; a person with multiple roles may be counted in more than one role-specific answer.`, 'staff', { count, roles });
}

async function pathwayWorkflow(request: AIRequest, start: number): Promise<AIResponse> {
  const { context, userMessage } = request;
  const selected = context.selectedEntity;
  let toolName: string | null = null;
  let input: Record<string, unknown> = {};
  if (selected?.type === 'learner') {
    toolName = /readiness|recommend|strength|fit/i.test(userMessage) ? 'get_learner_readiness' : 'get_learner_pathway_status';
    input = { learnerId: selected.id };
  } else if (selected?.type === 'class') {
    toolName = 'get_class_pathway_summary';
    input = { classId: selected.id };
  } else {
    const pathway = /social sciences?/i.test(userMessage) ? 'SOCIAL_SCIENCES'
      : /arts?(?:\s*(?:and|&))?\s*sports?/i.test(userMessage) ? 'ARTS_SPORTS'
      : /\bstem\b/i.test(userMessage) ? 'STEM' : null;
    if (pathway && /school|college|find|search|offer/i.test(userMessage)) {
      toolName = 'search_senior_schools';
      input = { pathway, limit: 10 };
    }
  }
  if (!toolName) {
    return response(start, 'AI Pathways can check a selected learner’s readiness or pathway status, summarize a selected class, and find senior schools by pathway. Select a learner/class or name STEM, Social Sciences, or Arts & Sports.', 'pathways');
  }
  const result = await executeTool(toolName, input, context);
  if (!result.success) return response(start, result.error || 'I could not complete that pathway lookup.', 'pathways');
  return {
    message: `The ${toolName.replace(/_/g, ' ')} workflow completed. The detailed result is attached to this response.`,
    toolCalls: [{ toolName, input }],
    data: { intent: 'pathways', navigation: NAVIGATION.pathways, result: result.data },
    meta: meta(start),
  };
}

function cardWorkflow(card: CardContext, request: AIRequest, start: number): AIResponse {
  const intent = detectWorkflowIntent(`${card.title || ''} ${card.description || ''} ${request.userMessage}`, request.context.currentModule);
  const parts = [card.description, card.visibleContent].filter(Boolean);
  return response(start,
    parts.length
      ? `${card.title || 'This card'} shows: ${parts.join(' — ')}. This answer uses only the visible card context; ask about ${intent} if you want me to check the permitted live records.`
      : `${card.title || 'This card'} belongs to the ${intent} workflow. Ask a specific question and I can check the permitted live records.`,
    intent, { card });
}

export async function processFreeWorkflowRequest(request: AIRequest): Promise<AIResponse> {
  const start = Date.now();
  const withRoleNavigation = (result: AIResponse) => roleScopedNavigation(result, request.context.user.role);
  if (!request.context.user.id || !request.context.user.schoolId || !request.context.school.id ||
      request.context.user.schoolId !== request.context.school.id) {
    return withRoleNavigation(response(start, 'I can’t access school records because your account’s school context could not be verified. Refresh the page or contact the school administrator.', 'help'));
  }
  const card = extractCardContext(request.userMessage);
  const vagueCardQuestion = /what should i know|explain this|summari[sz]e|what is this|help with this/i.test(request.userMessage);
  if (card && vagueCardQuestion) return withRoleNavigation(cardWorkflow(card, request, start));

  const asksSchoolPolicy = /\b(?:our|your|this school'?s|the school'?s)\b.{0,80}\b(?:policy|policies|rule|rules|procedure|procedures|requirement|requirements|deadline|calendar|dates?)\b|\b(?:policy|policies|rule|rules|procedure|procedures|requirement|requirements|deadline|calendar)\b.{0,60}\b(?:at this school|at our school|here)\b/i.test(request.userMessage);
  if (asksSchoolPolicy) {
    return withRoleNavigation(response(start, 'I can’t confirm this school’s current policy or calendar from an approved live record yet. Please check the relevant school settings or ask the school office; I won’t infer a policy from general guidance.', 'reports'));
  }

  const isStaffRole = !['PARENT', 'STUDENT'].includes(request.context.user.role);
  const asksOwnStaffAttendance = isStaffRole && /\b(?:my\s+(?:attendance|clock(?:ed)?\s*(?:in|out)|presence)|i\s+(?:clocked|signed)\s*(?:in|out))\b/i.test(request.userMessage);
  const intent = asksOwnStaffAttendance ? 'staff' : detectWorkflowIntent(request.userMessage, request.context.currentModule);
  try {
    switch (intent) {
      case 'finance': return withRoleNavigation(await financeWorkflow(request.context, start, request.userMessage));
      case 'accounting': return withRoleNavigation(await accountingWorkflow(request.context, start, request.userMessage));
      case 'attendance': return withRoleNavigation(await attendanceWorkflow(request.context, start, request.userMessage));
      case 'homework': return withRoleNavigation(await homeworkWorkflow(request.context, start, request.userMessage));
      case 'transport': return withRoleNavigation(await transportWorkflow(request.context, start, request.userMessage));
      case 'assessments': return withRoleNavigation(await assessmentWorkflow(request.context, start, request.userMessage));
      case 'learners': return withRoleNavigation(await learnerWorkflow(request.context, start, request.userMessage));
      case 'pathways': return withRoleNavigation(await pathwayWorkflow(request, start));
      case 'communication': return withRoleNavigation(await communicationWorkflow(request.context, start, request.userMessage));
      case 'library': return withRoleNavigation(await libraryWorkflow(request.context, start, request.userMessage));
      case 'staff': return withRoleNavigation(await staffWorkflow(request.context, start, request.userMessage));
      case 'reports':
        return withRoleNavigation(response(start, 'Reports brings together academic, attendance, fee, and operational reporting. Open Reports and choose the report you need; I can then explain the visible card or guide the next workflow.', 'reports'));
      case 'timetable':
        return withRoleNavigation(response(start, 'Open Timetable to view class and teacher schedules. Select a class or teacher there for the most relevant schedule.', 'timetable'));
      case 'thanks':
        return withRoleNavigation(response(start, `You’re welcome, ${request.context.user.name || 'there'}.`, 'thanks'));
      case 'greeting':
      case 'help':
      default:
        if (looksLikeSchoolRecordLookup(request.userMessage)) {
          return withRoleNavigation(response(start, 'I can’t verify that school-specific information from the records I can currently query. Open the relevant module for the live records, or ask about fees, attendance, assessments, learners, messages, library summaries, or pathway information.', 'reports'));
        }
        return withRoleNavigation(response(start, `Hello ${request.context.user.name || 'there'}. I’m the TrendSCORE assistant. Ask about a school task and I’ll use only information available to your account; if a topic needs access you don’t have, I’ll let you know.`, intent));
    }
  } catch (error: any) {
    return withRoleNavigation(response(start, `I could not retrieve that ${intent} information right now. Please try again or open the relevant module.`, intent));
  }
}
