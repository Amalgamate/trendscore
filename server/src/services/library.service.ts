/**
 * Library Service
 * Handles all library management operations including books, loans, members, and fines
 *
 * @module services/library.service
 */

import {
    BookStatus,
    BookCondition,
    CopyStatus,
    LoanStatus,
    FineStatus,
    FineReason,
    MemberStatus,
    MemberType
} from '@prisma/client';
import { ApiError } from '../utils/error.util';
import prisma from '../config/database';
import { accountingService } from './accounting.service';
import { SmsService } from './sms.service';
import { NotificationService, NotificationType } from './notification.service';

export class LibraryService {
    /**
     * Book Management
     */

    async createBook(data: {
        title: string;
        author?: string;
        isbn?: string;
        publisher?: string;
        publicationYear?: number;
        category?: string;
        description?: string;
        language?: string;
        pages?: number;
        edition?: string;
        coverImage?: string;
        totalCopies?: number;
    }) {
        // Check if ISBN already exists
        if (data.isbn) {
            const existingBook = await prisma.book.findUnique({
                where: { isbn: data.isbn }
            });
            if (existingBook) {
                throw new ApiError(400, 'Book with this ISBN already exists');
            }
        }

        const book = await prisma.book.create({
            data: {
                ...data,
                availableCopies: data.totalCopies || 1,
                status: data.totalCopies && data.totalCopies > 0 ? BookStatus.AVAILABLE : BookStatus.OUT_OF_STOCK
            }
        });

        // Create book copies for ALL totalCopies values (including 1)
        if (data.totalCopies && data.totalCopies >= 1) {
            const copies = [];
            for (let i = 1; i <= data.totalCopies; i++) {
                copies.push({
                    bookId: book.id,
                    copyNumber: `${book.id.slice(-6)}-${i.toString().padStart(3, '0')}`,
                    condition: 'GOOD' as const,
                    status: CopyStatus.AVAILABLE
                });
            }
            await prisma.bookCopy.createMany({ data: copies });
        }

        return book;
    }

    async updateBook(id: string, data: Partial<{
        title: string;
        author?: string;
        isbn?: string;
        publisher?: string;
        publicationYear?: number;
        category?: string;
        description?: string;
        language?: string;
        pages?: number;
        edition?: string;
        coverImage?: string;
        totalCopies?: number;
        status: BookStatus;
    }>) {
        const book = await prisma.book.findUnique({ where: { id } });
        if (!book) {
            throw new ApiError(404, 'Book not found');
        }

        // Check ISBN uniqueness if being updated
        if (data.isbn && data.isbn !== book.isbn) {
            const existingBook = await prisma.book.findUnique({
                where: { isbn: data.isbn }
            });
            if (existingBook) {
                throw new ApiError(400, 'Book with this ISBN already exists');
            }
        }

        return await prisma.book.update({
            where: { id },
            data
        });
    }

    async deleteBook(id: string) {
        const book = await prisma.book.findUnique({
            where: { id },
            include: { copies: { include: { loans: true } } }
        });

        if (!book) {
            throw new ApiError(404, 'Book not found');
        }

        // Check if book has active loans
        const activeLoans = book.copies.some(copy =>
            copy.loans.some(loan => loan.status === LoanStatus.ACTIVE)
        );

        if (activeLoans) {
            throw new ApiError(400, 'Cannot delete book with active loans');
        }

        // Delete in correct order due to foreign key constraints
        await prisma.bookLoan.deleteMany({
            where: { bookId: id }
        });

        await prisma.bookCopy.deleteMany({
            where: { bookId: id }
        });

        await prisma.book.delete({
            where: { id }
        });
    }

    async getBooks(filters: {
        search?: string;
        category?: string;
        status?: BookStatus;
        availableOnly?: boolean;
        page?: number;
        limit?: number;
    }) {
        const { search, category, status, availableOnly, page = 1, limit = 20 } = filters;

        const where: any = {};

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { author: { contains: search, mode: 'insensitive' } },
                { isbn: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (category) {
            where.category = category;
        }

        if (status) {
            where.status = status;
        }

        if (availableOnly) {
            where.availableCopies = { gt: 0 };
        }

        const [books, total] = await Promise.all([
            prisma.book.findMany({
                where,
                include: {
                    copies: {
                        where: { status: CopyStatus.AVAILABLE },
                        select: { id: true }
                    }
                },
                orderBy: { title: 'asc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.book.count({ where })
        ]);

        return {
            books,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Book Copy Management
     */

    async createBookCopy(bookId: string, data: {
        condition?: BookCondition;
        location?: string;
        barcode?: string;
        acquiredAt?: Date;
        acquiredFrom?: string;
        notes?: string;
    }) {
        const book = await prisma.book.findUnique({ where: { id: bookId } });
        if (!book) {
            throw new ApiError(404, 'Book not found');
        }

        // Generate copy number
        const copyCount = await prisma.bookCopy.count({ where: { bookId } });
        const copyNumber = `${bookId.slice(-6)}-${(copyCount + 1).toString().padStart(3, '0')}`;

        const copy = await prisma.bookCopy.create({
            data: {
                bookId,
                copyNumber,
                condition: data.condition,
                location: data.location,
                barcode: data.barcode,
                acquiredAt: data.acquiredAt,
                acquiredFrom: data.acquiredFrom,
                notes: data.notes
            }
        });

        // Update book available copies
        await this.updateBookCopyCount(bookId);

        return copy;
    }

    async updateBookCopy(id: string, data: Partial<{
        condition: BookCondition;
        location: string;
        barcode: string;
        acquiredAt: Date;
        acquiredFrom: string;
        notes: string;
        status: CopyStatus;
    }>) {
        const copy = await prisma.bookCopy.findUnique({
            where: { id },
            include: { book: true }
        });

        if (!copy) {
            throw new ApiError(404, 'Book copy not found');
        }

        // Check barcode uniqueness
        if (data.barcode && data.barcode !== copy.barcode) {
            const existingCopy = await prisma.bookCopy.findUnique({
                where: { barcode: data.barcode }
            });
            if (existingCopy) {
                throw new ApiError(400, 'Barcode already exists');
            }
        }

        const updatedCopy = await prisma.bookCopy.update({
            where: { id },
            data: {
                condition: data.condition,
                location: data.location,
                barcode: data.barcode,
                acquiredAt: data.acquiredAt,
                acquiredFrom: data.acquiredFrom,
                notes: data.notes,
                status: data.status
            }
        });

        // Update book available copies
        await this.updateBookCopyCount(copy.bookId);

        return updatedCopy;
    }

    private async updateBookCopyCount(bookId: string) {
        const availableCopies = await prisma.bookCopy.count({
            where: {
                bookId,
                status: CopyStatus.AVAILABLE
            }
        });

        const totalCopies = await prisma.bookCopy.count({
            where: { bookId }
        });

        let status: BookStatus = BookStatus.AVAILABLE;
        if (availableCopies === 0 && totalCopies > 0) {
            status = BookStatus.OUT_OF_STOCK;
        } else if (availableCopies > 0 && availableCopies <= 2) {
            status = BookStatus.LIMITED;
        }

        await prisma.book.update({
            where: { id: bookId },
            data: {
                availableCopies,
                totalCopies,
                status
            }
        });
    }

    /**
     * Library Member Management
     */

    async createLibraryMember(userId: string, data: {
        membershipType?: MemberType;
        maxBooks?: number;
        maxDays?: number;
        expiryDate?: Date;
        notes?: string;
        learnerId?: string;
    }) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        // Check if user is already a member
        const existingMember = await prisma.libraryMember.findUnique({
            where: { userId }
        });

        if (existingMember) {
            throw new ApiError(400, 'User is already a library member');
        }

        // Generate member number
        const memberCount = await prisma.libraryMember.count();
        const memberNumber = `LM${(memberCount + 1).toString().padStart(6, '0')}`;

        return await prisma.libraryMember.create({
            data: {
                userId,
                memberNumber,
                ...data
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
    }

    async getLibraryMember(userId: string) {
        return await prisma.libraryMember.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                    }
                },
                loans: {
                    include: {
                        book: { select: { title: true, author: true } },
                        bookCopy: { select: { copyNumber: true } }
                    },
                    where: { status: LoanStatus.ACTIVE },
                    orderBy: { dueDate: 'asc' }
                },
                fines: {
                    where: { status: FineStatus.UNPAID },
                    orderBy: { issuedAt: 'desc' }
                }
            }
        });
    }

    /**
     * Book Loan Management
     */

    async borrowBookByScan(barcode: string, memberIdentifier: string, dueDate?: Date) {
        const bookCopy = await prisma.bookCopy.findFirst({
            where: { barcode },
            include: { book: true }
        });

        if (!bookCopy) {
            throw new ApiError(404, 'Book copy with this barcode not found');
        }

        const member = await prisma.libraryMember.findFirst({
            where: {
                OR: [
                    { id: memberIdentifier },
                    { userId: memberIdentifier },
                    { memberNumber: memberIdentifier }
                ]
            }
        });

        if (!member) {
            throw new ApiError(404, 'Library member not found');
        }

        return this.borrowBook(member.userId, bookCopy.id, dueDate);
    }

    async reserveBookCopy(bookCopyId: string) {
        const copy = await prisma.bookCopy.findUnique({ where: { id: bookCopyId } });
        
        if (!copy) {
            throw new ApiError(404, 'Book copy not found');
        }

        if (copy.status !== CopyStatus.AVAILABLE) {
            throw new ApiError(400, 'Book copy is not available to reserve');
        }

        const updated = await prisma.bookCopy.update({
            where: { id: bookCopyId },
            data: { status: CopyStatus.RESERVED }
        });

        await this.updateBookCopyCount(copy.bookId);
        return updated;
    }

    async getMemberLoanHistory(userId: string, page: number = 1, limit: number = 20) {
        const member = await prisma.libraryMember.findUnique({ where: { userId } });
        if (!member) throw new ApiError(404, 'Member not found');

        const [loans, total] = await Promise.all([
            prisma.bookLoan.findMany({
                where: {
                    memberId: member.id,
                    status: { not: LoanStatus.ACTIVE }  // history = completed/overdue only
                },
                include: {
                    book: { select: { title: true, author: true } },
                    bookCopy: { select: { copyNumber: true, barcode: true } }
                },
                orderBy: { loanedAt: 'desc' },  // corrected from borrowedAt
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.bookLoan.count({
                where: {
                    memberId: member.id,
                    status: { not: LoanStatus.ACTIVE }
                }
            })
        ]);

        return {
            loans,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        };
    }

    async borrowBook(userId: string, bookCopyId: string, dueDate?: Date) {
        // Check if user is a library member
        const member = await prisma.libraryMember.findUnique({
            where: { userId },
            include: {
                loans: {
                    where: { status: LoanStatus.ACTIVE }
                }
            }
        });

        if (!member) {
            throw new ApiError(400, 'User is not a library member');
        }

        if (member.status !== MemberStatus.ACTIVE) {
            throw new ApiError(400, 'Library membership is not active');
        }

        // Check membership expiry
        if (member.expiryDate && new Date() > member.expiryDate) {
            throw new ApiError(400, 'Library membership has expired. Please renew before borrowing.');
        }

        // Check if member has reached max books limit
        if (member.loans.length >= member.maxBooks) {
            throw new ApiError(400, `Member has reached maximum books limit (${member.maxBooks})`);
        }

        // Check if member has unpaid fines
        const unpaidFines = await prisma.fine.count({
            where: {
                memberId: member.id,
                status: FineStatus.UNPAID
            }
        });

        if (unpaidFines > 0) {
            throw new ApiError(400, 'Member has unpaid fines. Please clear fines before borrowing.');
        }

        // Check if book copy exists and is available
        const bookCopy = await prisma.bookCopy.findUnique({
            where: { id: bookCopyId },
            include: { book: true }
        });

        if (!bookCopy) {
            throw new ApiError(404, 'Book copy not found');
        }

        if (bookCopy.status !== CopyStatus.AVAILABLE) {
            throw new ApiError(400, 'Book copy is not available for borrowing');
        }

        // Check if member already has this book
        const existingLoan = member.loans.find(loan =>
            loan.bookCopyId === bookCopyId && loan.status === LoanStatus.ACTIVE
        );

        if (existingLoan) {
            throw new ApiError(400, 'Member already has this book copy on loan');
        }

        // Calculate due date
        const loanDueDate = dueDate || new Date(Date.now() + member.maxDays * 24 * 60 * 60 * 1000);

        // Create loan
        const loan = await prisma.bookLoan.create({
            data: {
                bookId: bookCopy.bookId,
                bookCopyId,
                memberId: member.id,
                dueDate: loanDueDate
            }
        });

        // Update book copy status
        await prisma.bookCopy.update({
            where: { id: bookCopyId },
            data: { status: CopyStatus.BORROWED }
        });

        // Update book available copies
        await this.updateBookCopyCount(bookCopy.bookId);

        return loan;
    }

    /**
     * Allows a LIBRARIAN to issue a book to a specific member (by userId/memberNumber).
     * This is the correct flow for desk-based borrowing — the librarian selects the
     * member rather than borrowing on their own behalf.
     */
    async borrowForMember(
        memberIdentifier: string,
        bookCopyId: string,
        dueDate?: Date
    ) {
        const member = await prisma.libraryMember.findFirst({
            where: {
                OR: [
                    { userId: memberIdentifier },
                    { memberNumber: memberIdentifier }
                ]
            }
        });

        if (!member) {
            throw new ApiError(404, 'Library member not found');
        }

        return this.borrowBook(member.userId, bookCopyId, dueDate);
    }

    async returnBook(loanId: string, condition?: string, notes?: string) {
        const loan = await prisma.bookLoan.findUnique({
            where: { id: loanId },
            include: {
                bookCopy: true,
                member: true
            }
        });

        if (!loan) {
            throw new ApiError(404, 'Loan not found');
        }

        if (loan.status !== LoanStatus.ACTIVE) {
            throw new ApiError(400, 'Loan is not active');
        }

        const returnDate = new Date();
        let fineAmount = 0;
        let fineReason: FineReason | undefined;

        // Fine rate in KES — configurable via LIBRARY_FINE_RATE_PER_DAY env var (default 10)
        const FINE_RATE_PER_DAY = parseFloat(process.env.LIBRARY_FINE_RATE_PER_DAY || '10');

        // Check if overdue
        if (returnDate > loan.dueDate) {
            const daysOverdue = Math.ceil((returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            fineAmount = daysOverdue * FINE_RATE_PER_DAY;
            fineReason = FineReason.OVERDUE;
        }

        // Update loan
        await prisma.bookLoan.update({
            where: { id: loanId },
            data: {
                returnedAt: returnDate,
                status: LoanStatus.RETURNED
            }
        });

        // Update book copy — if a RESERVED copy is returned, mark as AVAILABLE
        // and flag it so a reservation queue hook can notify the waiting member
        const wasReserved = loan.bookCopy.status === CopyStatus.RESERVED;

        await prisma.bookCopy.update({
            where: { id: loan.bookCopyId },
            data: {
                status: CopyStatus.AVAILABLE,
                condition: condition as any || loan.bookCopy.condition
            }
        });

        // Notify the member who reserved this copy that it is now available
        if (wasReserved) {
            this.notifyReservationAvailable(loan.bookCopyId, loan.bookId).catch(err =>
                console.error('[Library] Reservation SMS notify failed:', err)
            );
        }

        // Update book available copies
        await this.updateBookCopyCount(loan.bookId);

        // Create fine if overdue
        if (fineAmount > 0) {
            const fine = await prisma.fine.create({
                data: {
                    loanId,
                    memberId: loan.memberId,
                    amount: fineAmount,
                    reason: fineReason as FineReason,
                    notes: `Overdue by ${Math.ceil((returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24))} days`
                }
            });

            // Post auto-created fine to the accounting ledger (non-blocking)
            this.postFinePaymentToLedger(fine).catch(err =>
                console.error('[Library] Accounting overdue fine post failed:', err)
            );
        }

        return { fineAmount, fineReason };
    }

    async renewLoan(loanId: string, newDueDate?: Date) {
        const loan = await prisma.bookLoan.findUnique({
            where: { id: loanId },
            include: { member: true }
        });

        if (!loan) {
            throw new ApiError(404, 'Loan not found');
        }

        if (loan.status !== LoanStatus.ACTIVE) {
            throw new ApiError(400, 'Loan is not active');
        }

        if (loan.renewedCount >= loan.maxRenewals) {
            throw new ApiError(400, 'Maximum renewals reached');
        }

        // Check if overdue
        if (new Date() > loan.dueDate) {
            throw new ApiError(400, 'Cannot renew overdue loan');
        }

        const dueDate = newDueDate || new Date(Date.now() + loan.member.maxDays * 24 * 60 * 60 * 1000);

        return await prisma.bookLoan.update({
            where: { id: loanId },
            data: {
                dueDate,
                renewedCount: { increment: 1 }
            }
        });
    }

    /**
     * Fine Management
     */

    /**
     * Create a manual fine for DAMAGED or LOST books.
     * This covers the two FineReason enum values that were previously unreachable.
     */
    async createManualFine(data: {
        memberId: string;
        loanId?: string;
        reason: FineReason;  // DAMAGED | LOST | OVERDUE
        amount: number;
        notes?: string;
    }) {
        if (data.amount <= 0) {
            throw new ApiError(400, 'Fine amount must be greater than zero');
        }

        const member = await prisma.libraryMember.findUnique({
            where: { id: data.memberId }
        });
        if (!member) {
            throw new ApiError(404, 'Library member not found');
        }

        if (data.loanId) {
            const loan = await prisma.bookLoan.findUnique({ where: { id: data.loanId } });
            if (!loan) throw new ApiError(404, 'Loan not found');
            if (loan.memberId !== data.memberId) throw new ApiError(400, 'Loan does not belong to this member');
        }

        const fine = await prisma.fine.create({
            data: {
                memberId: data.memberId,
                loanId: data.loanId,
                amount: data.amount,
                reason: data.reason,
                notes: data.notes
            }
        });

        return fine;
    }

    async payFine(fineId: string) {
        const fine = await prisma.fine.findUnique({
            where: { id: fineId }
        });

        if (!fine) {
            throw new ApiError(404, 'Fine not found');
        }

        if (fine.status !== FineStatus.UNPAID) {
            throw new ApiError(400, 'Fine is already paid or waived');
        }

        const updatedFine = await prisma.fine.update({
            where: { id: fineId },
            data: {
                status: FineStatus.PAID,
                paidAt: new Date()
            }
        });

        // Post payment to accounting ledger (non-blocking)
        this.postFinePaymentToLedger(updatedFine).catch(err =>
            console.error('[Library] Accounting fine payment post failed:', err)
        );

        return updatedFine;
    }

    async sendOverdueReminders() {
        const overdueLoans = await prisma.bookLoan.findMany({
            where: {
                status: LoanStatus.ACTIVE,
                dueDate: { lt: new Date() }
            },
            include: {
                member: {
                    include: { user: true }
                },
                book: true
            }
        });

        let sentCount = 0;
        for (const loan of overdueLoans) {
            const phone = loan.member.user.phone;
            if (!phone) continue;

            const message = `Library Notice: Dear ${loan.member.user.firstName}, the book "${loan.book.title}" is overdue since ${loan.dueDate.toLocaleDateString()}. Please return it as soon as possible. Fines apply.`;
            
            try {
                const result = await SmsService.sendSms(phone, message);
                if (result.success) {
                    sentCount++;
                }
            } catch (error) {
                console.error(`Failed to send overdue SMS for loan ${loan.id}:`, error);
            }

            // ── In-app notification ──
            try {
                await NotificationService.createNotification({
                    userId: loan.member.userId,
                    title: 'Library Book Overdue',
                    message: `The book "${loan.book.title}" is overdue since ${loan.dueDate.toLocaleDateString()}. Please return it as soon as possible. Fines apply.`,
                    type: NotificationType.WARNING,
                    link: '/app/library',
                    metadata: {
                        module: 'LIBRARY',
                        event: 'BOOK_OVERDUE',
                        bookTitle: loan.book.title,
                        loanId: loan.id,
                        dueDate: loan.dueDate.toISOString(),
                    },
                });
            } catch (appErr: any) {
                console.error(`Failed to send overdue in-app notification for loan ${loan.id}:`, appErr?.message);
            }
        }

        return sentCount;
    }

    async waiveFine(fineId: string, waivedById: string, notes?: string) {
        const fine = await prisma.fine.findUnique({
            where: { id: fineId }
        });

        if (!fine) {
            throw new ApiError(404, 'Fine not found');
        }

        if (fine.status !== FineStatus.UNPAID) {
            throw new ApiError(400, 'Fine is already paid or waived');
        }

        const updated = await prisma.fine.update({
            where: { id: fineId },
            data: {
                status: FineStatus.WAIVED,
                waivedById,
                notes
            }
        });

        // Post waiver to accounting ledger (non-blocking)
        this.postFineWaiverToLedger(updated).catch(err =>
            console.error('[Library] Accounting waiver post failed:', err)
        );

        return updated;
    }

    /**
     * Posts a fine payment to the accounting ledger.
     * Dr: Cash in Hand (1200) — money received
     * Cr: Library Fines Income (4300) — revenue recognised
     *
     * Falls back silently if the Chart of Accounts has not been initialised.
     */
    private async postFinePaymentToLedger(fine: any) {
        const school = await prisma.school.findFirst({ select: { name: true } });
        const label = `Library fine payment — ${fine.reason} | Fine #${fine.id.slice(-8)}`;

        const cashAccount = await accountingService.getAccountByCode('1200');
        const incomeAccount = await accountingService.getAccountByCode('4300');
        const journal = await accountingService.getJournalByCode('CSH1');

        if (!cashAccount || !incomeAccount || !journal) {
            // Account 4300 may not exist yet — create it on first use
            if (!incomeAccount) {
                await prisma.account.create({
                    data: {
                        code: '4300',
                        name: 'Library Fines Income',
                        type: 'REVENUE' as any
                    }
                });
            }
            if (!cashAccount || !journal) {
                console.warn('[Library] Accounting CoA incomplete — skipping fine payment post.');
                return;
            }
        }

        // Re-fetch income account in case we just created it
        const incomeAcc = incomeAccount ?? await accountingService.getAccountByCode('4300');
        const cashAcc = cashAccount!;
        const journalAcc = journal!;

        const entry = await accountingService.createJournalEntry({
            journalId: journalAcc.id,
            reference: `LIB-FINE-${fine.id.slice(-8).toUpperCase()}`,
            date: new Date(),
            items: [
                { accountId: cashAcc.id, debit: Number(fine.amount), label },
                { accountId: incomeAcc!.id, credit: Number(fine.amount), label }
            ]
        });

        await accountingService.postJournalEntry(entry.id);
    }

    /**
     * Posts a fine waiver to the accounting ledger as a contra entry.
     * Dr: Library Fines Income (4300) — revenue reversed
     * Cr: Fine Waivers Expense (5400) — waiver cost recognised
     *
     * Falls back silently if the Chart of Accounts has not been initialised.
     */
    private async postFineWaiverToLedger(fine: any) {
        const label = `Library fine waiver — ${fine.reason} | Fine #${fine.id.slice(-8)}`;

        const incomeAccount = await accountingService.getAccountByCode('4300');
        let waiverAccount = await accountingService.getAccountByCode('5400');
        const journal = await accountingService.getJournalByCode('MISC');

        // Auto-provision accounts if not yet in CoA
        if (!incomeAccount) {
            await prisma.account.create({
                data: { code: '4300', name: 'Library Fines Income', type: 'REVENUE' as any }
            });
        }
        if (!waiverAccount) {
            await prisma.account.create({
                data: { code: '5400', name: 'Fine Waivers Expense', type: 'EXPENSE' as any }
            });
            waiverAccount = await accountingService.getAccountByCode('5400');
        }

        const incomeAcc = incomeAccount ?? await accountingService.getAccountByCode('4300');

        if (!incomeAcc || !waiverAccount || !journal) {
            console.warn('[Library] Accounting CoA incomplete — skipping fine waiver post.');
            return;
        }

        const entry = await accountingService.createJournalEntry({
            journalId: journal.id,
            reference: `LIB-WAIVE-${fine.id.slice(-8).toUpperCase()}`,
            date: new Date(),
            items: [
                { accountId: incomeAcc.id, debit: Number(fine.amount), label },
                { accountId: waiverAccount.id, credit: Number(fine.amount), label }
            ]
        });

        await accountingService.postJournalEntry(entry.id);
    }

    /**
     * Sends an SMS to the library member who has a reservation on a copy
     * that has just become available. Called fire-and-forget from returnBook.
     */
    private async notifyReservationAvailable(bookCopyId: string, bookId: string) {
        // Find the member currently holding a reservation on ANY copy of this book
        // (reservation is at the copy level, so we look for the specific copy status)
        const reservedCopy = await prisma.bookCopy.findFirst({
            where: { bookId, status: CopyStatus.RESERVED }
        });

        // If another copy is still reserved, look up the member via the most recent active loan
        // that targeted a reserved copy. Since we don't store a reservation-to-member link yet,
        // we fall back to notifying via the book's most recent borrow on any copy by a member
        // who has an active loan for this book — as a best-effort until a Reservation model lands.
        const book = await prisma.book.findUnique({
            where: { id: bookId },
            select: { title: true }
        });

        if (!book) return;

        // Best-effort: find any active loan on this book to get a candidate member
        // In a full reservation queue, this would query a Reservation table
        const candidateLoan = await prisma.bookLoan.findFirst({
            where: { bookId, status: LoanStatus.ACTIVE },
            include: {
                member: {
                    include: {
                        user: { select: { id: true, phone: true, firstName: true } }
                    }
                }
            },
            orderBy: { loanedAt: 'asc' }  // oldest active = most likely waiting
        });

        if (!candidateLoan?.member?.user?.phone) {
            console.log('[Library] Reservation notify: no phone found for candidate member.');
            return;
        }

        const { phone, firstName, id: userId } = candidateLoan.member.user;
        const school = await prisma.school.findFirst({ select: { name: true } });
        const schoolName = school?.name || 'The Library';

        const message = `Dear ${firstName}, a copy of "${book.title}" that you reserved is now available for collection. Please visit ${schoolName} library to borrow it. — ${schoolName}`;

        await SmsService.sendSms(phone, message);
        console.log(`[Library] Reservation SMS sent to ${phone} for book "${book.title}"`);

        // ── In-app notification ──
        try {
            await NotificationService.createNotification({
                userId,
                title: 'Book Available for Collection',
                message: `"${book.title}" is now available for collection from the ${schoolName} library. Please collect it within 2 days.`,
                type: NotificationType.SUCCESS,
                link: '/app/library',
                metadata: {
                    module: 'LIBRARY',
                    event: 'BOOK_AVAILABLE',
                    bookTitle: book.title,
                    bookId,
                },
            });
        } catch (appErr: any) {
            console.error(`[Library] Failed to send reservation in-app notification:`, appErr?.message);
        }
    }

    /**
     * Reports and Analytics
     */

    async getOverdueLoans() {
        return await prisma.bookLoan.findMany({
            where: {
                status: LoanStatus.ACTIVE,
                dueDate: { lt: new Date() }
            },
            include: {
                book: { select: { title: true, author: true } },
                bookCopy: { select: { copyNumber: true } },
                member: {
                    include: {
                        user: { select: { firstName: true, lastName: true, email: true } }
                    }
                }
            },
            orderBy: { dueDate: 'asc' }
        });
    }

    async getLibraryStats() {
        const [
            totalBooks,
            totalCopies,
            availableCopies,
            totalMembers,
            activeLoans,
            overdueLoans,
            totalFines
        ] = await Promise.all([
            prisma.book.count(),
            prisma.bookCopy.count(),
            prisma.bookCopy.count({ where: { status: CopyStatus.AVAILABLE } }),
            prisma.libraryMember.count({ where: { status: MemberStatus.ACTIVE } }),
            prisma.bookLoan.count({ where: { status: LoanStatus.ACTIVE } }),
            prisma.bookLoan.count({
                where: {
                    status: LoanStatus.ACTIVE,
                    dueDate: { lt: new Date() }
                }
            }),
            prisma.fine.aggregate({
                where: { status: FineStatus.UNPAID },
                _sum: { amount: true }
            })
        ]);

        return {
            books: {
                total: totalBooks,
                copies: totalCopies,
                available: availableCopies
            },
            members: {
                total: totalMembers
            },
            loans: {
                active: activeLoans,
                overdue: overdueLoans
            },
            fines: {
                totalUnpaid: totalFines._sum.amount || 0
            }
        };
    }

    async getBook(id: string) {
        return await prisma.book.findUnique({
            where: { id },
            include: {
                copies: {
                    include: {
                        loans: {
                            where: { status: LoanStatus.ACTIVE },
                            include: {
                                member: {
                                    include: {
                                        user: { select: { firstName: true, lastName: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async getBookCopies(bookId: string, status?: string) {
        const where: any = { bookId };

        if (status) {
            where.status = status;
        }

        return await prisma.bookCopy.findMany({
            where,
            orderBy: { copyNumber: 'asc' }
        });
    }

    async deleteBookCopy(id: string) {
        const copy = await prisma.bookCopy.findUnique({
            where: { id },
            include: { book: true, loans: { where: { status: LoanStatus.ACTIVE } } }
        });

        if (!copy) {
            throw new ApiError(404, 'Book copy not found');
        }

        if (copy.loans.length > 0) {
            throw new ApiError(400, 'Cannot delete book copy with active loans');
        }

        await prisma.bookCopy.delete({ where: { id } });

        // Update book available copies
        await this.updateBookCopyCount(copy.bookId);
    }

    async getLibraryMembers(filters: {
        page: number;
        limit: number;
        search?: string;
    }) {
        const { page, limit, search } = filters;

        const where: any = {};

        if (search) {
            where.OR = [
                { user: { firstName: { contains: search, mode: 'insensitive' } } },
                { user: { lastName: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { memberNumber: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [members, total] = await Promise.all([
            prisma.libraryMember.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true
                        }
                    },
                    loans: {
                        where: { status: LoanStatus.ACTIVE },
                        select: { id: true }
                    },
                    fines: {
                        where: { status: FineStatus.UNPAID },
                        select: { id: true, amount: true }
                    }
                },
                orderBy: { joinedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.libraryMember.count({ where })
        ]);

        return {
            members,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async updateLibraryMember(userId: string, data: Partial<{
        membershipType: MemberType;
        status: MemberStatus;
        maxBooks: number;
        maxDays: number;
        expiryDate: Date;
        notes: string;
        learnerId: string;
    }>) {
        const member = await prisma.libraryMember.findUnique({
            where: { userId }
        });

        if (!member) {
            throw new ApiError(404, 'Library member not found');
        }

        return await prisma.libraryMember.update({
            where: { userId },
            data
        });
    }

    async getLoans(filters: {
        status?: string;
        overdue?: boolean;
        memberId?: string;
        page: number;
        limit: number;
    }) {
        const { status, overdue, memberId, page, limit } = filters;

        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (overdue) {
            where.dueDate = { lt: new Date() };
            where.status = LoanStatus.ACTIVE;
        }

        if (memberId) {
            where.memberId = memberId;
        }

        const [loans, total] = await Promise.all([
            prisma.bookLoan.findMany({
                where,
                include: {
                    book: { select: { title: true, author: true, isbn: true } },
                    bookCopy: { select: { copyNumber: true, barcode: true } },
                    member: {
                        include: {
                            user: { select: { firstName: true, lastName: true, email: true } }
                        }
                    }
                },
                orderBy: { loanedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.bookLoan.count({ where })
        ]);

        return {
            loans,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getFines(filters: {
        status?: string;
        memberId?: string;
        page: number;
        limit: number;
    }) {
        const { status, memberId, page, limit } = filters;

        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (memberId) {
            where.memberId = memberId;
        }

        const [fines, total] = await Promise.all([
            prisma.fine.findMany({
                where,
                include: {
                    loan: {
                        include: {
                            book: { select: { title: true, author: true } },
                            bookCopy: { select: { copyNumber: true } }
                        }
                    },
                    member: {
                        include: {
                            user: { select: { firstName: true, lastName: true } }
                        }
                    }
                },
                orderBy: { issuedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.fine.count({ where })
        ]);

        return {
            fines,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getPopularBooks(limit: number = 10) {
        const popularBooks = await prisma.bookLoan.groupBy({
            by: ['bookId'],
            _count: { bookId: true },
            orderBy: { _count: { bookId: 'desc' } },
            take: limit
        });

        const bookIds = popularBooks.map(item => item.bookId);

        const books = await prisma.book.findMany({
            where: { id: { in: bookIds } },
            select: {
                id: true,
                title: true,
                author: true,
                category: true,
                totalCopies: true,
                availableCopies: true
            }
        });

        // Combine with loan counts
        return books.map(book => ({
            ...book,
            loanCount: popularBooks.find(item => item.bookId === book.id)?._count.bookId || 0
        }));
    }
}