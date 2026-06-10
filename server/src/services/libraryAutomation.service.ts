/**
 * Library Automation Service — Phase 4
 * Scheduled jobs for late fee automation and loan lifecycle management.
 *
 * Jobs registered in src/index.ts via node-cron:
 *
 *   1. autoAssessLateFines()          — 00:05 daily  (mark overdue + create/update fine records)
 *   2. sendOverdueSmsBatch()          — 08:00 daily  (SMS reminders, one per member per day)
 *   3. autoSuspendMembersWithFines()  — 00:10 daily  (suspend members above fine threshold)
 *   4. autoExpireMemberships()        — 00:15 daily  (mark expired memberships EXPIRED)
 *
 * All jobs are idempotent and safe to run multiple times.
 * Manual trigger: POST /api/library/automation/run-all  (LIBRARY_MANAGEMENT permission)
 *
 * @module services/libraryAutomation.service
 */

import {
    LoanStatus,
    FineStatus,
    FineReason,
    MemberStatus
} from '@prisma/client';
import prisma from '../config/database';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import { SmsService } from './sms.service';
import { accountingService } from './accounting.service';
import logger from '../utils/logger';

// ─── Configurable via environment variables ───────────────────────────────────
/** KES charged per day overdue.  Default: 10 */
const FINE_RATE_PER_DAY    = parseFloat(process.env.LIBRARY_FINE_RATE_PER_DAY    || '10');
/** Total unpaid fines (KES) at which a member is auto-suspended.  Default: 500 */
const SUSPENSION_THRESHOLD = parseFloat(process.env.LIBRARY_SUSPENSION_THRESHOLD || '500');
/** Maximum days for which fines accrue (caps runaway fines).  Default: 90 */
const MAX_FINE_DAYS        = parseInt(process.env.LIBRARY_MAX_FINE_DAYS           || '90', 10);
// ─────────────────────────────────────────────────────────────────────────────

export class LibraryAutomationService {

    // =========================================================================
    // JOB 1 — Auto-assess late fines  (00:05 daily)
    // =========================================================================

    /**
     * Scans every ACTIVE/OVERDUE loan whose dueDate has passed.
     *
     * For each overdue loan:
     *  - Promotes status from ACTIVE → OVERDUE
     *  - Creates a new Fine record if none exists yet
     *  - Updates an existing UNPAID fine when the day count has grown
     *  - Posts incremental accrual to the accounting ledger (non-blocking)
     *
     * Safe to run multiple times — it compares the current calculated amount
     * against what's stored before writing anything.
     */
    async autoAssessLateFines(): Promise<{
        processed: number;
        newFines: number;
        updatedFines: number;
    }> {
        logger.info('[LibraryAutomation] autoAssessLateFines — starting');

        const now = new Date();

        const overdueLoans = await prisma.bookLoan.findMany({
            where: {
                status: { in: [LoanStatus.ACTIVE, LoanStatus.OVERDUE] },
                dueDate: { lt: now }
            },
            include: {
                member: { select: { id: true } },
                fines: {
                    where: {
                        status: FineStatus.UNPAID,
                        reason: FineReason.OVERDUE
                    }
                }
            }
        });

        let newFines     = 0;
        let updatedFines = 0;

        for (const loan of overdueLoans) {

            // 1. Promote status ACTIVE → OVERDUE
            if (loan.status === LoanStatus.ACTIVE) {
                await prisma.bookLoan.update({
                    where: { id: loan.id },
                    data:  { status: LoanStatus.OVERDUE }
                });
            }

            // 2. Calculate current fine
            const rawDays     = (now.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24);
            const daysOverdue = Math.min(Math.ceil(rawDays), MAX_FINE_DAYS);
            const fineAmount  = daysOverdue * FINE_RATE_PER_DAY;

            const existingFine = loan.fines[0];

            if (!existingFine) {
                // First occurrence — create fine record
                const fine = await prisma.fine.create({
                    data: {
                        loanId:   loan.id,
                        memberId: loan.member.id,
                        amount:   fineAmount,
                        reason:   FineReason.OVERDUE,
                        notes:    `Auto-assessed: ${daysOverdue} day(s) overdue @ KES ${FINE_RATE_PER_DAY}/day`
                    }
                });

                this.postAccrualToLedger(fine, fineAmount).catch(err =>
                    logger.error({ err }, '[LibraryAutomation] Ledger post failed (new fine)')
                );

                newFines++;

            } else if (Number(existingFine.amount) !== fineAmount) {
                // Fine has grown — update amount and post the delta
                const delta = fineAmount - Number(existingFine.amount);

                await prisma.fine.update({
                    where: { id: existingFine.id },
                    data: {
                        amount: fineAmount,
                        notes:  `Auto-updated: ${daysOverdue} day(s) overdue @ KES ${FINE_RATE_PER_DAY}/day`
                    }
                });

                if (delta > 0) {
                    this.postAccrualToLedger(existingFine, delta).catch(err =>
                        logger.error({ err }, '[LibraryAutomation] Ledger post failed (delta)')
                    );
                }

                updatedFines++;
            }
        }

        logger.info(
            { processed: overdueLoans.length, newFines, updatedFines },
            '[LibraryAutomation] autoAssessLateFines — done'
        );

        return { processed: overdueLoans.length, newFines, updatedFines };
    }


    // =========================================================================
    // JOB 2 — Send overdue SMS reminders  (08:00 daily)
    // =========================================================================

    /**
     * Sends one combined SMS per member (listing all their overdue books) at
     * most once every 24 hours.
     *
     * Throttle mechanism: the last reminder date is stamped into the member's
     * notes field as `LAST_LIB_REMINDER:YYYY-MM-DD`.  A proper
     * `lastLibraryReminderAt DateTime?` column is the clean future solution —
     * this avoids a schema migration for Phase 4.
     */
    async sendOverdueSmsBatch(): Promise<{
        attempted: number;
        sent: number;
        failed: number;
    }> {
        logger.info('[LibraryAutomation] sendOverdueSmsBatch — starting');

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const overdueLoans = await prisma.bookLoan.findMany({
            where: {
                status: LoanStatus.OVERDUE,
                dueDate: { lt: new Date() }
            },
            include: {
                book:   { select: { title: true } },
                member: {
                    include: {
                        user:  { select: { firstName: true, phone: true } },
                        fines: {
                            where:  { status: FineStatus.UNPAID },
                            select: { amount: true }
                        }
                    }
                }
            }
        });

        // Group loans by member
        const byMember = new Map<string, typeof overdueLoans>();
        for (const loan of overdueLoans) {
            const mid = loan.member.id;
            if (!byMember.has(mid)) byMember.set(mid, []);
            byMember.get(mid)!.push(loan);
        }

        let attempted = 0;
        let sent      = 0;
        let failed    = 0;

        const school     = await prisma.school.findFirst({ select: { name: true } });
        const schoolName = school?.name || `${PRODUCT_DISPLAY_NAME} Library`;

        for (const [, loans] of byMember) {
            const member = loans[0].member;
            const phone  = member.user.phone;
            if (!phone) continue;

            // Throttle: skip if already messaged in the last 24 h
            const match = member.notes?.match(/LAST_LIB_REMINDER:([\d-]+)/);
            if (match && new Date(match[1]) > yesterday) continue;

            const totalFine = member.fines.reduce((sum, f) => sum + Number(f.amount), 0);
            const bookList  = loans.map(l => `"${l.book.title}"`).join(', ');
            const fineText  = totalFine > 0
                ? ` Accrued fine: KES ${totalFine.toFixed(0)}.`
                : '';

            const message =
                `Dear ${member.user.firstName}, you have ${loans.length} overdue ` +
                `book(s) at ${schoolName}: ${bookList}.${fineText} ` +
                `Please return them to avoid further fines (KES ${FINE_RATE_PER_DAY}/day).`;

            attempted++;
            try {
                const result = await SmsService.sendSms(phone, message);
                if (result.success) {
                    sent++;
                    const today      = new Date().toISOString().split('T')[0];
                    const cleanNotes = (member.notes || '').replace(/LAST_LIB_REMINDER:[\d-]+/, '').trim();
                    await prisma.libraryMember.update({
                        where: { id: member.id },
                        data:  { notes: `${cleanNotes} LAST_LIB_REMINDER:${today}`.trim() }
                    });
                } else {
                    failed++;
                }
            } catch (err) {
                failed++;
                logger.error({ err, memberId: member.id }, '[LibraryAutomation] SMS failed');
            }
        }

        logger.info(
            { attempted, sent, failed },
            '[LibraryAutomation] sendOverdueSmsBatch — done'
        );

        return { attempted, sent, failed };
    }


    // =========================================================================
    // JOB 3 — Auto-suspend members with large unpaid fines  (00:10 daily)
    // =========================================================================

    /**
     * Suspends ACTIVE members whose total unpaid fines ≥ SUSPENSION_THRESHOLD.
     * Reinstates SUSPENDED members whose fines are now fully cleared.
     */
    async autoSuspendMembersWithFines(): Promise<{
        suspended: number;
        reinstated: number;
    }> {
        logger.info('[LibraryAutomation] autoSuspendMembersWithFines — starting');

        const members = await prisma.libraryMember.findMany({
            where:   { status: { in: [MemberStatus.ACTIVE, MemberStatus.SUSPENDED] } },
            include: {
                fines: {
                    where:  { status: FineStatus.UNPAID },
                    select: { amount: true }
                }
            }
        });

        let suspended  = 0;
        let reinstated = 0;

        for (const member of members) {
            const totalUnpaid = member.fines.reduce((s, f) => s + Number(f.amount), 0);

            if (member.status === MemberStatus.ACTIVE && totalUnpaid >= SUSPENSION_THRESHOLD) {
                await prisma.libraryMember.update({
                    where: { id: member.id },
                    data:  {
                        status: MemberStatus.SUSPENDED,
                        notes:  this.appendNote(
                            member.notes,
                            `Auto-suspended — unpaid fines KES ${totalUnpaid.toFixed(0)} ≥ KES ${SUSPENSION_THRESHOLD} threshold`
                        )
                    }
                });
                suspended++;

            } else if (member.status === MemberStatus.SUSPENDED && totalUnpaid === 0) {
                await prisma.libraryMember.update({
                    where: { id: member.id },
                    data:  {
                        status: MemberStatus.ACTIVE,
                        notes:  this.appendNote(member.notes, 'Auto-reinstated — all fines cleared')
                    }
                });
                reinstated++;
            }
        }

        logger.info(
            { suspended, reinstated },
            '[LibraryAutomation] autoSuspendMembersWithFines — done'
        );

        return { suspended, reinstated };
    }


    // =========================================================================
    // JOB 4 — Auto-expire memberships  (00:15 daily)
    // =========================================================================

    /**
     * Sets any ACTIVE membership whose expiryDate is in the past to EXPIRED.
     */
    async autoExpireMemberships(): Promise<{ expired: number }> {
        logger.info('[LibraryAutomation] autoExpireMemberships — starting');

        const result = await prisma.libraryMember.updateMany({
            where: {
                status:     MemberStatus.ACTIVE,
                expiryDate: { lt: new Date() }
            },
            data: { status: MemberStatus.EXPIRED }
        });

        logger.info(
            { expired: result.count },
            '[LibraryAutomation] autoExpireMemberships — done'
        );

        return { expired: result.count };
    }


    // =========================================================================
    // Manual trigger — POST /api/library/automation/run-all
    // =========================================================================

    async runAllJobs(): Promise<Record<string, unknown>> {
        const [fines, sms, suspension, expiry] = await Promise.allSettled([
            this.autoAssessLateFines(),
            this.sendOverdueSmsBatch(),
            this.autoSuspendMembersWithFines(),
            this.autoExpireMemberships()
        ]);

        return {
            fines:      fines.status      === 'fulfilled' ? fines.value      : { error: String((fines      as any).reason) },
            sms:        sms.status        === 'fulfilled' ? sms.value        : { error: String((sms        as any).reason) },
            suspension: suspension.status === 'fulfilled' ? suspension.value : { error: String((suspension as any).reason) },
            expiry:     expiry.status     === 'fulfilled' ? expiry.value     : { error: String((expiry     as any).reason) }
        };
    }


    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Posts fine accrual (or delta) to the accounting ledger.
     *
     * Dr: Accounts Receivable — Library Fines (1300)
     * Cr: Library Fines Income (4300)
     *
     * Using AR rather than Cash because the fine is accrued, not yet collected.
     * The cash settlement entry is posted by payFine() in library.service.ts.
     */
    private async postAccrualToLedger(fine: any, amount: number) {
        const arAccount     = await accountingService.getAccountByCode('1300');
        const incomeAccount = await accountingService.getAccountByCode('4300');
        const journal       = await accountingService.getJournalByCode('MISC');

        if (!arAccount || !incomeAccount || !journal) {
            logger.warn('[LibraryAutomation] Accounting CoA incomplete — skipping ledger post');
            return;
        }

        const label = `Library overdue fine accrual | Fine #${fine.id.slice(-8).toUpperCase()}`;

        const entry = await accountingService.createJournalEntry({
            journalId: journal.id,
            reference: `LIB-ACCRUE-${fine.id.slice(-8).toUpperCase()}`,
            date:      new Date(),
            items: [
                { accountId: arAccount.id,     debit:  amount, label },
                { accountId: incomeAccount.id, credit: amount, label }
            ]
        });

        await accountingService.postJournalEntry(entry.id);
    }

    private appendNote(existing: string | null, note: string): string {
        const date = new Date().toISOString().split('T')[0];
        return [(existing || '').trim(), `[${date}] ${note}`]
            .filter(Boolean)
            .join('\n');
    }
}

export const libraryAutomationService = new LibraryAutomationService();
