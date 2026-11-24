import prisma from '../config/database';
import { normalizeKenyanPhone } from '../utils/phone.util';
import { parentAccessService } from './parent-access.service';
import { parentWhatsAppLinkService } from './parent-whatsapp-link.service';
import { classifyParentWhatsAppIntent } from './parent-whatsapp-intent.service';
import { whatsappService, InboundWhatsAppMessage } from './whatsapp.service';
import logger from '../utils/logger';

const formatKes = (amount: number) => new Intl.NumberFormat('en-KE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(amount);

const learnerName = (learner: { firstName: string; lastName: string }) =>
  `${learner.firstName} ${learner.lastName}`.trim();
const isParentAccount = (user: { role: string; roles: string[] }) =>
  user.role === 'PARENT' || user.roles.includes('PARENT');

export class ParentWhatsAppAssistantService {
  async handleMessage(from: string, text: string): Promise<void> {
    const message = text.trim().slice(0, 1000);
    if (!message) return;

    const linkCommand = message.match(/^link\s+([a-f0-9]{16})$/i);
    if (linkCommand) {
      const linked = await parentWhatsAppLinkService.completeLink(from, linkCommand[1]);
      await this.reply(from, linked
        ? '✅ Your WhatsApp number is linked to your parent account. Ask me about FEES or RESULTS any time. Send STOP to pause these replies.'
        : 'I could not verify that code. Codes expire after 10 minutes and can be used once. Sign in to the Parent Portal to request a fresh code.');
      return;
    }

    if (/^stop$/i.test(message)) {
      const disabled = await this.setEnabledByPhone(from, false);
      await this.reply(from, disabled
        ? 'WhatsApp assistant paused. Your school messages are not affected. Send START to resume or manage the link in your Parent Portal profile.'
        : 'To protect learner information, link your number from the signed-in Parent Portal profile first.');
      return;
    }

    if (/^start$/i.test(message)) {
      const enabled = await this.setEnabledByPhone(from, true);
      await this.reply(from, enabled
        ? 'WhatsApp assistant is active again. Ask me about FEES or RESULTS.'
        : 'To protect learner information, link your number from the signed-in Parent Portal profile first.');
      return;
    }

    const link = await this.findActiveLink(from);
    if (!link) {
      await this.reply(from, 'For learner privacy, please sign in to the Parent Portal, open My Profile, and link your WhatsApp number before asking about school records.');
      return;
    }
    if (!link.enabled) {
      await this.reply(from, 'The WhatsApp assistant is paused for this number. Send START to resume or manage it in your Parent Portal profile.');
      return;
    }

    const learnerIds = await parentAccessService.getAccessibleLearnerIds(link.userId);
    if (learnerIds.length === 0) {
      await this.reply(from, 'I could not find learners currently linked to your parent account. Please contact the school office to update the account links.');
      return;
    }

    const intent = await classifyParentWhatsAppIntent(message);
    if (intent === 'FEES') {
      await this.reply(from, await this.getFeeSummary(learnerIds));
      return;
    }
    if (intent === 'RESULTS') {
      await this.reply(from, await this.getPublishedResults(learnerIds));
      return;
    }

    await this.reply(from, 'I can look up current fee balances and published assessment results for learners linked to your account. Try “fees” or “results”. Send STOP to pause this assistant.');
  }

  private async findActiveLink(phoneInput: string) {
    let phone: string;
    try { phone = normalizeKenyanPhone(phoneInput).digits; } catch { return null; }

    const link = await prisma.parentWhatsAppLink.findUnique({
      where: { phone },
      select: {
        userId: true,
        phone: true,
        enabled: true,
        parent: { select: { role: true, roles: true, status: true, archived: true, phone: true } },
      },
    });
    if (!link || !isParentAccount(link.parent) || link.parent.status !== 'ACTIVE' || link.parent.archived) return null;

    try {
      if (normalizeKenyanPhone(link.parent.phone || '').digits !== phone) return null;
    } catch { return null; }
    return link;
  }

  private async setEnabledByPhone(phoneInput: string, enabled: boolean): Promise<boolean> {
    const link = await this.findActiveLink(phoneInput);
    if (!link) return false;
    await prisma.parentWhatsAppLink.update({ where: { userId: link.userId }, data: { enabled } });
    return true;
  }

  private async getFeeSummary(learnerIds: string[]): Promise<string> {
    const invoices = await prisma.feeInvoice.findMany({
      where: {
        learnerId: { in: learnerIds },
        archived: false,
        status: { in: ['PENDING', 'PARTIAL', 'OVERPAID'] },
        balance: { gt: 0 },
        learner: { is: { archived: false } },
      },
      select: {
        balance: true,
        learner: { select: { id: true, firstName: true, lastName: true, grade: true } },
      },
    });

    const balances = new Map<string, { learner: typeof invoices[number]['learner']; balance: number }>();
    for (const invoice of invoices) {
      const current = balances.get(invoice.learner.id) || { learner: invoice.learner, balance: 0 };
      current.balance += Number(invoice.balance || 0);
      balances.set(invoice.learner.id, current);
    }

    if (balances.size === 0) return 'I found no outstanding fee balance for the learners linked to your account. For a recent payment that is not reflected yet, please allow the school time to reconcile it.';

    const allBalances = [...balances.values()];
    const rows = allBalances.slice(0, 30).map(({ learner, balance }) =>
      `• ${learnerName(learner)}${learner.grade ? ` (${learner.grade})` : ''}: KES ${formatKes(balance)}`,
    );
    if (allBalances.length > rows.length) rows.push(`• And ${allBalances.length - rows.length} more learners`);
    const total = allBalances.reduce((sum, row) => sum + row.balance, 0);
    return `💰 Outstanding school fees\n${rows.join('\n')}\nTotal: KES ${formatKes(total)}\n\nThis reflects outstanding invoices currently recorded by the school.`;
  }

  private async getPublishedResults(learnerIds: string[]): Promise<string> {
    const [summativeResults, formativeResults] = await Promise.all([
      prisma.summativeResult.findMany({
        where: {
          learnerId: { in: learnerIds },
          archived: false,
          learner: { is: { archived: false } },
          test: { published: true, status: 'PUBLISHED', active: true, archived: false },
        },
        select: {
          marksObtained: true,
          percentage: true,
          grade: true,
          outOf: true,
          learner: { select: { firstName: true, lastName: true } },
          test: { select: { title: true, learningArea: true, testDate: true, totalMarks: true, term: true, academicYear: true } },
        },
        orderBy: [{ test: { testDate: 'desc' } }, { createdAt: 'desc' }],
        take: 12,
      }),
      prisma.formativeAssessment.findMany({
        where: {
          learnerId: { in: learnerIds },
          archived: false,
          status: 'PUBLISHED',
          learner: { is: { archived: false } },
        },
        select: {
          learningArea: true,
          title: true,
          overallRating: true,
          percentage: true,
          date: true,
          term: true,
          academicYear: true,
          learner: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 12,
      }),
    ]);

    if (summativeResults.length === 0 && formativeResults.length === 0) return 'There are no published assessment results available for the learners linked to your account yet.';

    const resultRows = summativeResults.map((result) => {
      const percent = result.percentage ?? (
        result.marksObtained !== null && (result.outOf ?? result.test.totalMarks) > 0
          ? (result.marksObtained / (result.outOf ?? result.test.totalMarks)) * 100
          : null
      );
      const score = percent === null ? 'score not recorded' : `${Math.round(percent)}%${result.grade ? ` (${result.grade})` : ''}`;
      const date = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(result.test.testDate);
      return {
        date: result.test.testDate,
        line: `• ${learnerName(result.learner)} — ${result.test.learningArea}: ${score} (${date})`,
      };
    });
    const formativeRows = formativeResults.map((result) => {
      const date = result.date
        ? new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(result.date)
        : `${result.term.replace('_', ' ')} ${result.academicYear}`;
      const score = result.percentage !== null ? `${Math.round(result.percentage)}% (${result.overallRating})` : result.overallRating;
      const assessment = result.title ? `${result.learningArea} · ${result.title}` : result.learningArea;
      return {
        date: result.date,
        line: `• ${learnerName(result.learner)} — ${assessment}: ${score} (${date})`,
      };
    });
    const rows = [...resultRows, ...formativeRows]
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, 12)
      .map((row) => row.line);
    return `📊 Latest published results\n${rows.join('\n')}\n\nOnly results released by the school are shown.`;
  }

  private async reply(to: string, body: string): Promise<void> {
    if (whatsappService.getStatus().status !== 'authenticated') {
      throw new Error('WhatsApp assistant reply failed: session is not connected');
    }
    const result = await whatsappService.sendMessage({ to, message: body });
    if (!result.success) throw new Error(`WhatsApp assistant reply failed: ${result.error || result.message}`);
  }
}

export const parentWhatsAppAssistantService = new ParentWhatsAppAssistantService();

let inboundRegistered = false;

/**
 * Route inbound Baileys messages into the parent assistant.
 *
 * Safe to call before pairing: the handler only runs when a message actually
 * arrives, which cannot happen until an admin has scanned the QR code.
 * Idempotent so repeated startup paths do not stack duplicate handlers.
 */
export function registerParentWhatsAppInbound(): void {
  if (inboundRegistered) return;
  inboundRegistered = true;

  whatsappService.onInbound(async (inbound: InboundWhatsAppMessage) => {
    try {
      await parentWhatsAppAssistantService.handleMessage(inbound.phone, inbound.text);
    } catch (error: any) {
      logger.warn('[ParentWhatsAppAssistant] Failed to handle inbound message', {
        error: error?.message || String(error),
        messageId: inbound.messageId,
      });
    }
  });

  logger.info('[ParentWhatsAppAssistant] Inbound handler registered');
}
