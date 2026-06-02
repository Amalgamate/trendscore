import { Router, Response } from 'express';
import { AccountType, PaymentStatus, Term, WaiverStatus } from '@prisma/client';
import prisma from '../config/database';
import { requireRole } from '../middleware/permissions.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();
const ROLE_FINANCE_ACCESS = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'] as const;

const toNumber = (value: unknown) => Number(value || 0);

const normalizeTerm = (value: unknown): Term => {
  const raw = String(value || 'TERM_2').trim().toUpperCase().replace(/\s+/g, '_');
  if (raw === 'TERM_1' || raw === 'TERM_2' || raw === 'TERM_3') return raw;
  if (raw === '1') return 'TERM_1';
  if (raw === '2') return 'TERM_2';
  if (raw === '3') return 'TERM_3';
  return 'TERM_2';
};

const previousTerm = (term: Term, academicYear: number) => {
  if (term === 'TERM_3') return { term: 'TERM_2' as Term, academicYear };
  if (term === 'TERM_2') return { term: 'TERM_1' as Term, academicYear };
  return { term: 'TERM_3' as Term, academicYear: academicYear - 1 };
};

const percent = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

const compare = (current: number, previous: number) => ({
  value: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
  direction: previous > 0 ? (current >= previous ? 'up' : 'down') : 'flat',
});

const unpaidStatuses: PaymentStatus[] = ['PENDING', 'PARTIAL'];

const summarizeTerm = async (term: Term, academicYear: number) => {
  const invoiceWhere = {
    archived: false,
    status: { not: 'CANCELLED' as PaymentStatus },
    term,
    academicYear,
  };
  const paymentWhere = {
    archived: false,
    invoice: invoiceWhere,
  };

  const [invoiceTotals, paymentTotals, waiverTotals, overdueTotals] = await Promise.all([
    prisma.feeInvoice.aggregate({
      where: invoiceWhere,
      _sum: { totalAmount: true, paidAmount: true, balance: true },
    }),
    prisma.feePayment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    }),
    prisma.feeWaiver.aggregate({
      where: {
        archived: false,
        status: WaiverStatus.APPROVED,
        invoice: invoiceWhere,
      },
      _sum: { amountWaived: true },
    }),
    prisma.feeInvoice.aggregate({
      where: {
        ...invoiceWhere,
        status: { in: unpaidStatuses },
        dueDate: { lt: new Date() },
      },
      _sum: { balance: true },
    }),
  ]);

  const expectedIncome = toNumber(invoiceTotals._sum.totalAmount);
  const totalCollected = toNumber(paymentTotals._sum.amount);
  const waivedAmount = toNumber(waiverTotals._sum.amountWaived);
  const outstandingBalance = Math.max(expectedIncome - totalCollected - waivedAmount, 0);

  return {
    expectedIncome,
    totalCollected,
    waivedAmount,
    outstandingBalance,
    overdueBalance: toNumber(overdueTotals._sum.balance),
    collectionRate: percent(totalCollected, expectedIncome),
  };
};

const weekOfTerm = (date: Date, start: Date) =>
  Math.min(12, Math.max(1, Math.floor((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1));

router.get(
  '/dashboard-summary',
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  async (req: AuthRequest, res: Response) => {
    const term = normalizeTerm(req.query.term);
    const academicYear = Number(req.query.academicYear || 2026);
    const previous = previousTerm(term, academicYear);

    const termStart = new Date(academicYear, term === 'TERM_1' ? 0 : term === 'TERM_2' ? 4 : 8, 1);
    const termEnd = new Date(termStart);
    termEnd.setDate(termEnd.getDate() + 84);

    const invoiceWhere = {
      archived: false,
      status: { not: 'CANCELLED' as PaymentStatus },
      term,
      academicYear,
    };

    const [summary, previousSummary, invoices, payments, waivers, cashAccounts] = await Promise.all([
      summarizeTerm(term, academicYear),
      summarizeTerm(previous.term, previous.academicYear),
      prisma.feeInvoice.findMany({
        where: invoiceWhere,
        include: {
          learner: { select: { id: true, grade: true, stream: true } },
          feeStructure: {
            include: {
              feeItems: { include: { feeType: true } },
            },
          },
        },
      }),
      prisma.feePayment.findMany({
        where: { archived: false, invoice: invoiceWhere },
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              term: true,
              academicYear: true,
              learner: { select: { grade: true, stream: true } },
            },
          },
        },
      }),
      prisma.feeWaiver.findMany({
        where: { archived: false, invoice: invoiceWhere },
        orderBy: { createdAt: 'desc' },
        include: { invoice: { select: { invoiceNumber: true, learner: { select: { grade: true } } } } },
      }),
      prisma.account.findMany({
        where: { isActive: true, type: AccountType.ASSET_CASH },
        orderBy: { code: 'asc' },
        include: { journalItems: { where: { entry: { status: 'POSTED' } } } },
      }),
    ]);

    const trendByWeek = Array.from({ length: 12 }, (_, index) => ({
      week: `Week ${index + 1}`,
      expected: 0,
      collected: 0,
    }));
    invoices.forEach((invoice) => {
      const week = weekOfTerm(invoice.createdAt, termStart) - 1;
      trendByWeek[week].expected += toNumber(invoice.totalAmount);
    });
    payments.forEach((payment) => {
      const week = weekOfTerm(payment.paymentDate, termStart) - 1;
      trendByWeek[week].collected += toNumber(payment.amount);
    });
    let runningExpected = 0;
    let runningCollected = 0;
    trendByWeek.forEach((point) => {
      runningExpected += point.expected;
      runningCollected += point.collected;
      point.expected = runningExpected;
      point.collected = runningCollected;
    });

    const feeBreakdownMap = new Map<string, number>();
    invoices.forEach((invoice) => {
      const paidRatio = toNumber(invoice.totalAmount) > 0
        ? Math.min(toNumber(invoice.paidAmount) / toNumber(invoice.totalAmount), 1)
        : 0;
      invoice.feeStructure.feeItems.forEach((item) => {
        const category = item.feeType.category === 'TRANSPORT'
          ? 'Transport Fees'
          : item.feeType.category === 'EXTRA_CURRICULAR'
            ? 'Activity Fees'
            : item.feeType.category === 'OTHER'
              ? 'Other Fees'
              : 'Tuition Fees';
        feeBreakdownMap.set(category, (feeBreakdownMap.get(category) || 0) + toNumber(item.amount) * paidRatio);
      });
    });
    const feeBreakdown = Array.from(feeBreakdownMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        percentage: percent(value, summary.totalCollected),
      }))
      .sort((a, b) => b.value - a.value);

    const classMap = new Map<string, { className: string; outstanding: number; students: Set<string> }>();
    invoices.forEach((invoice) => {
      const balance = toNumber(invoice.balance);
      if (balance <= 0) return;
      const className = [invoice.learner?.grade, invoice.learner?.stream].filter(Boolean).join(' ') || 'Unassigned';
      const existing = classMap.get(className) || { className, outstanding: 0, students: new Set<string>() };
      existing.outstanding += balance;
      if (invoice.learner?.id) existing.students.add(invoice.learner.id);
      classMap.set(className, existing);
    });
    const topOutstandingClasses = Array.from(classMap.values())
      .map((item) => ({ className: item.className, outstanding: item.outstanding, students: item.students.size }))
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);

    const agingBuckets = [
      { key: 'current', label: 'Current', min: -Infinity, max: 0, amount: 0 },
      { key: 'days1to30', label: '1 - 30 Days', min: 1, max: 30, amount: 0 },
      { key: 'days31to60', label: '31 - 60 Days', min: 31, max: 60, amount: 0 },
      { key: 'days61to90', label: '61 - 90 Days', min: 61, max: 90, amount: 0 },
      { key: 'days90plus', label: '90+ Days', min: 91, max: Infinity, amount: 0 },
    ];
    invoices.forEach((invoice) => {
      const balance = toNumber(invoice.balance);
      if (balance <= 0 || !unpaidStatuses.includes(invoice.status)) return;
      const days = Math.floor((Date.now() - invoice.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const bucket = agingBuckets.find((item) => days >= item.min && days <= item.max);
      if (bucket) bucket.amount += balance;
    });
    const agingAnalysis = agingBuckets.map(({ key, label, amount }) => ({
      key,
      label,
      amount,
      percentage: percent(amount, summary.outstandingBalance),
    }));

    const invoiceTransactions = invoices
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        type: 'invoice_created',
        title: 'Invoice Created',
        reference: invoice.invoiceNumber,
        className: [invoice.learner?.grade, invoice.learner?.stream].filter(Boolean).join(' '),
        amount: toNumber(invoice.totalAmount),
        createdAt: invoice.createdAt,
      }));
    const paymentTransactions = payments.slice(0, 8).map((payment) => ({
      id: `payment-${payment.id}`,
      type: 'payment_received',
      title: 'Payment Received',
      reference: payment.invoice.invoiceNumber,
      className: [payment.invoice.learner?.grade, payment.invoice.learner?.stream].filter(Boolean).join(' '),
      amount: toNumber(payment.amount),
      createdAt: payment.createdAt,
    }));
    const waiverTransactions = waivers.slice(0, 5).map((waiver) => ({
      id: `waiver-${waiver.id}`,
      type: waiver.status === 'APPROVED' ? 'waiver' : 'waiver_pending',
      title: waiver.status === 'APPROVED' ? 'Waiver Approved' : 'Waiver Requested',
      reference: waiver.invoice.invoiceNumber,
      className: waiver.invoice.learner?.grade,
      amount: toNumber(waiver.amountWaived),
      createdAt: waiver.createdAt,
    }));
    const recentTransactions = [...paymentTransactions, ...invoiceTransactions, ...waiverTransactions]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    const bankAccounts = cashAccounts.map((account) => {
      const debits = account.journalItems.reduce((sum, item) => sum + toNumber(item.debit), 0);
      const credits = account.journalItems.reduce((sum, item) => sum + toNumber(item.credit), 0);
      return {
        id: account.id,
        name: account.name,
        code: account.code,
        bankName: account.code === '1210' ? 'NCBA Bank' : account.code === '1200' ? 'Cash Office' : 'School Bank',
        accountNumber: account.code,
        balance: debits - credits,
      };
    });

    res.json({
      success: true,
      data: {
        ...summary,
        kpiComparison: {
          expectedIncome: compare(summary.expectedIncome, previousSummary.expectedIncome),
          totalCollected: compare(summary.totalCollected, previousSummary.totalCollected),
          outstandingBalance: compare(summary.outstandingBalance, previousSummary.outstandingBalance),
          overdueBalance: compare(summary.overdueBalance, previousSummary.overdueBalance),
          collectionRate: compare(summary.collectionRate, previousSummary.collectionRate),
        },
        collectionTrend: trendByWeek,
        feeBreakdown,
        topOutstandingClasses,
        agingAnalysis,
        recentTransactions,
        bankAccounts,
        filters: { term, academicYear, schoolLevel: 'Junior School', termStart, termEnd },
      },
    });
  }
);

export default router;
