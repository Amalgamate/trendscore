/**
 * Free Workflow Engine
 *
 * Deterministic, permission-aware assistant responses backed by TrendSCORE data.
 * This mode never sends school data to an external model and has no token cost.
 */

import prisma from '../../config/database';
import { executeTool } from '../tools/ToolRegistry';
import type { AIContext, AIRequest, AIResponse, UserRole } from '../types';

export type WorkflowIntent =
  | 'finance'
  | 'attendance'
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

const FINANCE_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'ACCOUNTANT']);
const SCHOOL_DATA_ROLES = new Set<UserRole>([
  'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST',
]);
const STAFF_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);

const NAVIGATION: Record<WorkflowIntent, { page: string; label: string }> = {
  finance: { page: 'fees-overview', label: 'Open Fees' },
  attendance: { page: 'attendance-daily', label: 'Open Attendance' },
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

const moduleIntent = (module = ''): WorkflowIntent | null => {
  const value = module.toLowerCase();
  if (/fee|finance|payment|invoice/.test(value)) return 'finance';
  if (/attend|presence/.test(value)) return 'attendance';
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
  if (/\b(fee|payment|invoice|balance|owing|outstanding|arrear|mpesa|ksh|kes|collection)\b/.test(value)) return 'finance';
  if (/\b(attendance|absent|present|late|register|presence)\b/.test(value)) return 'attendance';
  if (/\b(grade|score|result|assessment|exam|test|cbc|formative|summative)\b/.test(value)) return 'assessments';
  if (/\b(pathway|career|senior school|stem|social sciences|arts and sports)\b/.test(value)) return 'pathways';
  if (/\b(report|analytics|analysis|insight|trend)\b/.test(value)) return 'reports';
  if (/\b(message|inbox|notice|announcement|communication|unread)\b/.test(value)) return 'communication';
  if (/\b(library|book|loan|overdue|borrow)\b/.test(value)) return 'library';
  if (/\b(staff|teacher|employee|human resources|\bhr\b|leave|payroll|salary)\b/.test(value)) return 'staff';
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
const meta = (start: number) => ({
  provider: 'workflow', model: 'deterministic-v1', inputTokens: 0, outputTokens: 0, durationMs: Date.now() - start,
});

const response = (start: number, message: string, intent: WorkflowIntent, data?: Record<string, unknown>): AIResponse => ({
  message,
  data: { intent, navigation: NAVIGATION[intent], ...(data || {}) },
  meta: meta(start),
});

async function getScopedLearners(context: AIContext): Promise<ScopedLearner[] | null> {
  if (SCHOOL_DATA_ROLES.has(context.user.role)) return null;
  if (context.user.role === 'PARENT') {
    return prisma.learner.findMany({
      where: {
        archived: false,
        OR: [
          { parentId: context.user.id },
          { familyLinks: { some: { familyAccount: { members: { some: { userId: context.user.id } } } } } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
  }
  if (context.user.role === 'STUDENT') {
    const user = await prisma.user.findUnique({ where: { id: context.user.id }, select: { username: true } });
    if (!user?.username) return [];
    const learner = await prisma.learner.findUnique({
      where: { admissionNumber: user.username },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
    return learner ? [learner] : [];
  }
  return [];
}

const learnerWhere = (learners: ScopedLearner[] | null) => learners === null ? {} : { learnerId: { in: learners.map(({ id }) => id) } };

async function financeWorkflow(context: AIContext, start: number): Promise<AIResponse> {
  const learners = await getScopedLearners(context);
  if (!FINANCE_ROLES.has(context.user.role) && learners === null) {
    return response(start, 'Fee totals are restricted to authorised finance and school leaders. You can still open Fees for the actions available to your role.', 'finance');
  }
  if (learners !== null && learners.length === 0) {
    return response(start, 'I could not find a learner record linked to your account, so I cannot show a fee balance yet.', 'finance');
  }
  const summary = await prisma.feeInvoice.aggregate({
    where: { archived: false, ...learnerWhere(learners) },
    _count: { _all: true },
    _sum: { totalAmount: true, paidAmount: true, balance: true },
  });
  const scope = learners === null ? 'School fee overview' : `Fee overview for ${learners.map(displayName).join(', ')}`;
  return response(start,
    `${scope}: ${summary._count._all} invoice(s), ${money(summary._sum.totalAmount)} billed, ${money(summary._sum.paidAmount)} paid, and ${money(summary._sum.balance)} outstanding.`,
    'finance', { summary });
}

async function attendanceWorkflow(context: AIContext, start: number): Promise<AIResponse> {
  const learners = await getScopedLearners(context);
  if (learners !== null && learners.length === 0) {
    return response(start, 'I could not find a learner record linked to your account, so no attendance summary is available.', 'attendance');
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const rows = await prisma.attendance.groupBy({
    by: ['status'],
    where: { archived: false, date: { gte: today, lt: tomorrow }, ...learnerWhere(learners) },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  const present = Number(counts.PRESENT || 0);
  const rate = total ? Math.round((present / total) * 100) : 0;
  const scope = learners === null ? 'Today’s school attendance' : `Today’s attendance for ${learners.map(displayName).join(', ')}`;
  return response(start,
    total
      ? `${scope}: ${present} present out of ${total} marked (${rate}%). Absent: ${counts.ABSENT || 0}; late: ${counts.LATE || 0}; excused/sick: ${Number(counts.EXCUSED || 0) + Number(counts.SICK || 0)}.`
      : `${scope} has not been marked yet.`,
    'attendance', { counts, total, rate });
}

async function learnerWorkflow(context: AIContext, start: number): Promise<AIResponse> {
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

async function assessmentWorkflow(context: AIContext, start: number): Promise<AIResponse> {
  const learners = await getScopedLearners(context);
  if (learners !== null && learners.length === 0) return response(start, 'I could not find a learner record linked to your account.', 'assessments');
  const where = { archived: false, ...learnerWhere(learners) };
  const [summative, formativeCount] = await Promise.all([
    prisma.summativeResult.aggregate({ where, _count: { _all: true }, _avg: { percentage: true } }),
    prisma.formativeAssessment.count({ where }),
  ]);
  const average = summative._avg.percentage == null ? 'not available' : `${Math.round(summative._avg.percentage)}%`;
  const scope = learners === null ? 'Assessment overview' : `Assessment overview for ${learners.map(displayName).join(', ')}`;
  return response(start, `${scope}: ${formativeCount} formative record(s), ${summative._count._all} summative result(s), with a ${average} summative average.`, 'assessments', { summative, formativeCount });
}

async function communicationWorkflow(context: AIContext, start: number): Promise<AIResponse> {
  const unread = await prisma.messageReceipt.count({ where: { recipientId: context.user.id, readAt: null } });
  return response(start, `You have ${unread} unread message${unread === 1 ? '' : 's'}. Open Messages to read or reply.`, 'communication', { unread });
}

async function libraryWorkflow(context: AIContext, start: number): Promise<AIResponse> {
  const [books, loans] = await Promise.all([
    prisma.book.aggregate({ _count: { _all: true }, _sum: { totalCopies: true, availableCopies: true } }),
    prisma.bookLoan.groupBy({ by: ['status'], where: { status: { in: ['ACTIVE', 'OVERDUE'] } }, _count: { _all: true } }),
  ]);
  const loanCounts = Object.fromEntries(loans.map((row) => [row.status, row._count._all]));
  return response(start, `Library overview: ${books._count._all} titles, ${books._sum.availableCopies || 0} of ${books._sum.totalCopies || 0} copies available, ${loanCounts.ACTIVE || 0} active loan(s), and ${loanCounts.OVERDUE || 0} overdue.`, 'library', { books, loanCounts });
}

async function staffWorkflow(context: AIContext, start: number): Promise<AIResponse> {
  if (!STAFF_ROLES.has(context.user.role)) {
    return response(start, context.user.role === 'TEACHER'
      ? 'You can use Staff & HR to view your profile, attendance, payslips, and leave actions available to you.'
      : 'Staff records are restricted. Open Staff & HR to see the options available to your role.', 'staff');
  }
  const count = await prisma.user.count({
    where: { archived: false, status: 'ACTIVE', role: { notIn: ['PARENT', 'STUDENT'] } },
  });
  return response(start, `There are ${count} active staff accounts. Open Staff & HR for records, leave, attendance, and payroll workflows.`, 'staff', { count });
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
  const card = extractCardContext(request.userMessage);
  const vagueCardQuestion = /what should i know|explain this|summari[sz]e|what is this|help with this/i.test(request.userMessage);
  if (card && vagueCardQuestion) return cardWorkflow(card, request, start);

  const intent = detectWorkflowIntent(request.userMessage, request.context.currentModule);
  try {
    switch (intent) {
      case 'finance': return await financeWorkflow(request.context, start);
      case 'attendance': return await attendanceWorkflow(request.context, start);
      case 'assessments': return await assessmentWorkflow(request.context, start);
      case 'learners': return await learnerWorkflow(request.context, start);
      case 'pathways': return await pathwayWorkflow(request, start);
      case 'communication': return await communicationWorkflow(request.context, start);
      case 'library': return await libraryWorkflow(request.context, start);
      case 'staff': return await staffWorkflow(request.context, start);
      case 'reports':
        return response(start, 'Reports brings together academic, attendance, fee, and operational reporting. Open Reports and choose the report you need; I can then explain the visible card or guide the next workflow.', 'reports');
      case 'timetable':
        return response(start, 'Open Timetable to view class and teacher schedules. Select a class or teacher there for the most relevant schedule.', 'timetable');
      case 'thanks':
        return response(start, `You’re welcome, ${request.context.user.name || 'there'}.`, 'thanks');
      case 'greeting':
      case 'help':
      default:
        return response(start, `Hello ${request.context.user.name || 'there'}. I’m the built-in TrendSCORE workflow assistant. I can securely summarize fees, attendance, assessments, learners, messages, library activity, staff, reports, and AI Pathways using the access already assigned to your role.`, intent);
    }
  } catch (error: any) {
    return response(start, `I could not load that ${intent} summary right now. ${error?.message || 'Please try again.'}`, intent);
  }
}
