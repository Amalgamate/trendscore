/**
 * Chatbot Controller — School Assistant
 *
 * Rule-based assistant that understands school context:
 * roles, grades, fees, CBC, attendance, timetable, etc.
 * No external AI API — all deterministic logic.
 */

import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../utils/error.util';
import prisma from '../config/database';

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.string().optional(), // e.g. 'fees', 'attendance', 'grades'
});

// ── Intents ────────────────────────────────────────────────────────────────

function detectIntent(msg: string): string {
  const m = msg.toLowerCase();
  if (/\b(fee|payment|invoice|balance|owing|arrear|pay|mpesa|ksh|kes)\b/.test(m)) return 'fees';
  if (/\b(attend|absent|present|late|class|mark|register)\b/.test(m)) return 'attendance';
  if (/\b(grade|score|result|assessment|exam|test|report|cbc|formative|summative)\b/.test(m)) return 'grades';
  if (/\b(timetable|schedule|lesson|period|subject|class|time)\b/.test(m)) return 'timetable';
  if (/\b(staff|teacher|employee|hr|leave|payroll|salary)\b/.test(m)) return 'hr';
  if (/\b(learner|student|pupil|admission|enrol|class list)\b/.test(m)) return 'learners';
  if (/\b(notice|announcement|event|news|update|bulletin)\b/.test(m)) return 'notices';
  if (/\b(hello|hi|hey|good morning|good afternoon|good evening|how are you|help|what can|assist)\b/.test(m)) return 'greeting';
  if (/\b(thank|thanks|appreciated|great|perfect|got it)\b/.test(m)) return 'thanks';
  if (/\b(bye|goodbye|later|see you|ok done)\b/.test(m)) return 'bye';
  return 'general';
}

// ── Role-aware responses ────────────────────────────────────────────────────

function buildResponse(
  intent: string,
  role: string,
  firstName: string,
  stats: any
): string {
  const r = role.toUpperCase();
  const name = firstName;

  switch (intent) {
    case 'greeting':
      return `Hello ${name}! 👋 I'm your school assistant. I can help you with fees, grades, attendance, timetables, and more. What do you need today?`;

    case 'thanks':
      return `You're welcome, ${name}! Is there anything else I can help with?`;

    case 'bye':
      return `Goodbye, ${name}! Have a great day. 👋`;

    case 'fees': {
      if (r === 'PARENT') {
        const outstanding = stats?.feeBalance ?? 'N/A';
        return `💰 **Fee Summary for your child**\n\nOutstanding balance: **KES ${outstanding}**\n\nYou can make payment via Mpesa directly from the Fees section. Would you like me to navigate you there?`;
      }
      if (['ACCOUNTANT', 'ADMIN', 'HEAD_TEACHER', 'SUPER_ADMIN'].includes(r)) {
        const collected = stats?.feeCollected ?? 0;
        const outstanding = stats?.feeOutstanding ?? 0;
        return `💰 **Fee Overview**\n\nCollected this term: **KES ${Number(collected).toLocaleString()}**\nOutstanding: **KES ${Number(outstanding).toLocaleString()}**\n\nHead to the Fee Collection module for detailed reports and payment recording.`;
      }
      return `For fee-related queries, please contact the accounts office or check the Fee Collection section of the portal.`;
    }

    case 'attendance': {
      if (r === 'TEACHER') {
        return `📋 **Attendance**\n\nYou can mark attendance for your class under the Attendance module. Sessions not yet marked for today will appear highlighted. Need help with bulk marking or late arrivals?`;
      }
      if (r === 'PARENT') {
        return `📋 **Attendance**\n\nYou can view your child's attendance record in the Learner Profile. If you have concerns about absences, please contact the class teacher directly via this chat.`;
      }
      const pct = stats?.attendanceRate ?? 0;
      return `📋 **School Attendance**\n\nOverall attendance rate today: **${pct}%**\n\nDetailed class-by-class breakdown is available in the Attendance module.`;
    }

    case 'grades': {
      if (r === 'TEACHER') {
        return `📊 **Grades & Assessments**\n\nYou can enter formative and summative results from the Gradebook. CBC rubric-based grading (EE/ME/AE/BE) is pre-configured for all learning areas. Need help generating report cards?`;
      }
      if (r === 'PARENT') {
        return `📊 **Your Child's Grades**\n\nCurrent term results and CBC performance reports are available in the Learner Profile. Report cards can be downloaded as PDF from the Reports section.`;
      }
      return `📊 **Grades**\n\nThe Gradebook module supports CBC formative assessments, summative exams, and auto-generated report cards. Head there for detailed entry and analysis.`;
    }

    case 'timetable':
      return `📅 **Timetable**\n\nThe class timetable and lesson schedule are available under the Timetable section. Teachers can also view their personal schedules from the Staff Dashboard. Is there a specific class you're looking for?`;

    case 'hr':
      if (['ADMIN', 'HEAD_TEACHER', 'SUPER_ADMIN'].includes(r)) {
        return `👥 **HR & Staff**\n\nStaff records, leave requests, payroll, and attendance logs are managed in the HR module. You can also generate payslips and process monthly payroll from there.`;
      }
      if (r === 'TEACHER') {
        return `👥 **HR**\n\nYou can submit leave requests and view your payslip from the Staff section. Your attendance log is also available there.`;
      }
      return `For HR queries, please contact the school administrator.`;

    case 'learners':
      if (['ADMIN', 'HEAD_TEACHER', 'TEACHER', 'SUPER_ADMIN'].includes(r)) {
        const count = stats?.learnerCount ?? 0;
        return `🎓 **Learners**\n\nTotal enrolled learners: **${count}**\n\nFull learner registry, admission management, and class lists are in the Learners module. You can also search by name, grade, or admission number.`;
      }
      return `For learner registry queries, please contact the school office.`;

    case 'notices':
      return `📢 **Notices & Announcements**\n\nAll school notices and announcements are in the Noticeboard section. Admins and Head Teachers can post new notices visible to specific roles (staff, parents, or all).`;

    case 'general':
    default:
      return `I'm your school assistant for **${stats?.schoolName ?? 'Trends CORE'}**. I can help with:\n\n• 💰 Fees & payments\n• 📋 Attendance\n• 📊 Grades & CBC assessments\n• 📅 Timetable\n• 👥 HR & staff\n• 🎓 Learner registry\n• 📢 Notices\n\nWhat would you like to know, ${name}?`;
  }
}

export const chatbotController = {
  async chat(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    const role = req.user?.role ?? 'TEACHER';
    const firstName = req.user?.firstName ?? 'there';

    if (!userId) throw new ApiError(401, 'Unauthorized');

    const { message } = messageSchema.parse(req.body);
    const intent = detectIntent(message);

    // Fetch contextual stats in parallel
    const [feeStats, learnerCount, school, attendanceToday] = await Promise.all([
      (async () => {
        try {
          if (['ACCOUNTANT', 'ADMIN', 'HEAD_TEACHER', 'SUPER_ADMIN'].includes(role.toUpperCase())) {
            const [collected, outstanding] = await Promise.all([
              prisma.feePayment.aggregate({ _sum: { amount: true } }),
              prisma.feeInvoice.aggregate({ where: { status: { not: 'PAID' } }, _sum: { balance: true } }),
            ]);
            return {
              feeCollected: collected._sum.amount ?? 0,
              feeOutstanding: outstanding._sum.balance ?? 0,
            };
          }
          if (role.toUpperCase() === 'PARENT') {
            // Get parent's child balance
            const child = await prisma.learner.findFirst({
              where: { parentId: userId },
              include: { feeInvoices: { where: { status: { not: 'PAID' } }, select: { balance: true } } },
            });
            const balance = child?.feeInvoices.reduce((s: any, i: any) => s + Number(i.balance ?? 0), 0) ?? 0;
            return { feeBalance: balance.toLocaleString() };
          }
          return {};
        } catch { return {}; }
      })(),
      prisma.learner.count({ where: { archived: false, status: 'ACTIVE' } }).catch(() => 0),
      prisma.school.findFirst({ select: { name: true } }).catch(() => null),
      (async () => {
        try {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const total = await prisma.attendance.count({ where: { date: { gte: today } } });
          const present = await prisma.attendance.count({ where: { date: { gte: today }, status: 'PRESENT' } });
          return total > 0 ? Math.round((present / total) * 100) : 0;
        } catch { return 0; }
      })(),
    ]);

    const stats = {
      ...feeStats,
      learnerCount,
      schoolName: school?.name ?? 'Trends CORE',
      attendanceRate: attendanceToday,
    };

    const reply = buildResponse(intent, role, firstName, stats);

    // Small simulated delay for natural feel
    res.json({
      success: true,
      data: {
        reply,
        intent,
        timestamp: new Date().toISOString(),
      },
    });
  },
};
