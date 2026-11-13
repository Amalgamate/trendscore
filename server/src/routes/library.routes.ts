import { Router } from 'express';
import { z } from 'zod';
import { LibraryController } from '../controllers/library.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, auditLog } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { requireApp } from '../middleware/requireApp';

const router = Router();
const libraryController = new LibraryController();

const createBookSchema = z.object({
  title: z.string().min(1).max(300),
  author: z.string().max(200).optional(),
  isbn: z.string().min(5).max(50).optional(),
  publisher: z.string().max(200).optional(),
  publicationYear: z.number().int().min(1000).max(9999).optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  language: z.string().max(100).optional(),
  pages: z.number().int().positive().optional(),
  edition: z.string().max(100).optional(),
  coverImage: z.string().max(1000).optional(),
  totalCopies: z.number().int().min(1).optional()
});

const updateBookSchema = createBookSchema.partial();

const createBookCopySchema = z.object({
  condition: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  barcode: z.string().max(100).optional(),
  acquiredAt: z.string().datetime().optional(),
  acquiredFrom: z.string().max(200).optional(),
  notes: z.string().max(1000).optional()
});

const createMemberSchema = z.object({
  learnerId: z.string().uuid().optional(),
  membershipType: z.enum(['STUDENT', 'TEACHER', 'STAFF', 'EXTERNAL']).optional(),
  maxBooks: z.number().int().min(1).optional(),
  maxDays: z.number().int().min(1).optional(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional()
});

const updateMemberSchema = createMemberSchema.partial();

const borrowSchema = z.object({
  bookCopyId: z.string().min(1),
  dueDate: z.string().datetime().optional()
});

const scanBorrowSchema = z.object({
  barcode: z.string().min(1),
  memberIdentifier: z.string().min(1),
  dueDate: z.string().datetime().optional()
});

const returnSchema = z.object({
  condition: z.string().max(50).optional(),
  notes: z.string().max(1000).optional()
});

const renewSchema = z.object({
  newDueDate: z.string().datetime().optional()
});

const waiveFineSchema = z.object({
  notes: z.string().max(1000).optional()
});

router.use(authenticate, requireApp('library'));

router.get(
  '/books',
  requirePermission('LIBRARY_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  libraryController.getBooks
);

router.get(
  '/books/:id',
  requirePermission('LIBRARY_MANAGEMENT'),
  libraryController.getBook
);

router.post(
  '/books',
  requirePermission('MANAGE_BOOK_CATALOG'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createBookSchema),
  auditLog('CREATE_BOOK'),
  libraryController.createBook
);

router.put(
  '/books/:id',
  requirePermission('MANAGE_BOOK_CATALOG'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(updateBookSchema),
  auditLog('UPDATE_BOOK'),
  libraryController.updateBook
);

router.delete(
  '/books/:id',
  requirePermission('MANAGE_BOOK_CATALOG'),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('DELETE_BOOK'),
  libraryController.deleteBook
);

router.get(
  '/books/:bookId/copies',
  requirePermission('VIEW_LIBRARY_INVENTORY'),
  libraryController.getBookCopies
);

router.post(
  '/books/:bookId/copies',
  requirePermission('MANAGE_BOOK_CATALOG'),
  validate(createBookCopySchema),
  auditLog('CREATE_BOOK_COPY'),
  libraryController.createBookCopy
);

router.post(
  '/copies/:id/reserve',
  requirePermission('BORROW_RETURN_BOOKS'),
  auditLog('RESERVE_BOOK_COPY'),
  libraryController.reserveBookCopy
);

router.put(
  '/copies/:id',
  requirePermission('MANAGE_BOOK_CATALOG'),
  validate(createBookCopySchema.partial()),
  auditLog('UPDATE_BOOK_COPY'),
  libraryController.updateBookCopy
);

router.delete(
  '/copies/:id',
  requirePermission('MANAGE_BOOK_CATALOG'),
  auditLog('DELETE_BOOK_COPY'),
  libraryController.deleteBookCopy
);

router.get(
  '/members',
  requirePermission('MANAGE_LIBRARY_MEMBERS'),
  libraryController.getLibraryMembers
);

router.get(
  '/members/:userId',
  requirePermission('MANAGE_LIBRARY_MEMBERS'),
  libraryController.getLibraryMember
);

router.get(
  '/members/:userId/history',
  requirePermission('MANAGE_LIBRARY_MEMBERS'),
  libraryController.getMemberLoanHistory
);

router.post(
  '/members/:userId',
  requirePermission('MANAGE_LIBRARY_MEMBERS'),
  validate(createMemberSchema),
  auditLog('CREATE_LIBRARY_MEMBER'),
  libraryController.createLibraryMember
);

router.put(
  '/members/:userId',
  requirePermission('MANAGE_LIBRARY_MEMBERS'),
  validate(updateMemberSchema),
  auditLog('UPDATE_LIBRARY_MEMBER'),
  libraryController.updateLibraryMember
);

router.get(
  '/loans',
  requirePermission('LIBRARY_MANAGEMENT'),
  libraryController.getLoans
);

router.post(
  '/loans/borrow/scan',
  requirePermission('BORROW_RETURN_BOOKS'),
  validate(scanBorrowSchema),
  auditLog('BORROW_BOOK_SCAN'),
  libraryController.borrowByScan
);

router.post(
  '/loans/borrow',
  requirePermission('BORROW_RETURN_BOOKS'),
  validate(borrowSchema),
  auditLog('BORROW_BOOK'),
  libraryController.borrowBook
);

router.post(
  '/loans/borrow-for-member',
  requirePermission('BORROW_RETURN_BOOKS'),
  validate(z.object({
    memberIdentifier: z.string().min(1),
    bookCopyId: z.string().min(1),
    dueDate: z.string().datetime().optional()
  })),
  auditLog('BORROW_BOOK_FOR_MEMBER'),
  libraryController.borrowForMember
);

router.post(
  '/loans/:loanId/return',
  requirePermission('BORROW_RETURN_BOOKS'),
  validate(returnSchema),
  auditLog('RETURN_BOOK'),
  libraryController.returnBook
);

router.post(
  '/loans/:loanId/renew',
  requirePermission('BORROW_RETURN_BOOKS'),
  validate(renewSchema),
  auditLog('RENEW_LOAN'),
  libraryController.renewLoan
);

router.get(
  '/fines',
  requirePermission('LIBRARY_MANAGEMENT'),
  libraryController.getFines
);

router.post(
  '/fines/manual',
  requirePermission('MANAGE_LIBRARY_FEES'),
  validate(z.object({
    memberId: z.string().min(1),
    loanId: z.string().optional(),
    reason: z.enum(['OVERDUE', 'DAMAGED', 'LOST']),
    amount: z.number().positive(),
    notes: z.string().max(1000).optional()
  })),
  auditLog('CREATE_MANUAL_FINE'),
  libraryController.createManualFine
);

router.post(
  '/fines/:id/pay',
  requirePermission('MANAGE_LIBRARY_FEES'),
  auditLog('PAY_FINE'),
  libraryController.payFine
);

router.post(
  '/fines/:id/waive',
  requirePermission('MANAGE_LIBRARY_FEES'),
  validate(waiveFineSchema),
  auditLog('WAIVE_FINE'),
  libraryController.waiveFine
);

router.get(
  '/reports/overdue',
  requirePermission('LIBRARY_MANAGEMENT'),
  libraryController.getOverdueLoans
);

router.get(
  '/reports/stats',
  requirePermission('LIBRARY_MANAGEMENT'),
  libraryController.getLibraryStats
);

router.get(
  '/reports/popular',
  requirePermission('LIBRARY_MANAGEMENT'),
  libraryController.getPopularBooks
);

router.post(
  '/reports/send-overdue-reminders',
  requirePermission('LIBRARY_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SEND_OVERDUE_REMINDERS'),
  libraryController.sendOverdueReminders
);

export default router;
