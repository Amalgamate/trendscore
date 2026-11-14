import { Router } from 'express';
import { z } from 'zod';
import { BookController } from '../controllers/book.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, auditLog } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { requireApp } from '../middleware/requireApp';

const router = Router();
const bookController = new BookController();

// Validation schemas
const createBookSchema = z.object({
  title: z.string().min(1).max(300),
  isbn: z.string().min(5).max(20).optional(),
  author: z.string().min(1).max(200),
  publisher: z.string().max(200).optional(),
  quantity: z.number().min(1),
  category: z.string().max(100).optional()
});

const assignBookSchema = z.object({
  learnerId: z.string().min(1),
  learnedDate: z.string().datetime().optional(),
  expectedReturnDate: z.string().datetime().optional()
});

// All book routes require authentication
router.use(authenticate, requireApp('library'));

/**
 * @route   GET /api/books
 * @desc    Get all books
 * @access  Authenticated, requires VIEW_LIBRARY_INVENTORY permission
 */
router.get(
  '/',
  requirePermission('VIEW_LIBRARY_INVENTORY'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  bookController.getAllBooks
);

/**
 * @route   POST /api/books
 * @desc    Create book
 * @access  Authenticated, requires MANAGE_BOOK_CATALOG permission
 */
router.post(
  '/',
  requirePermission('MANAGE_BOOK_CATALOG'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createBookSchema),
  auditLog('CREATE_BOOK'),
  bookController.createBook
);

/**
 * @route   PUT /api/books/:id
 * @desc    Update book
 * @access  Authenticated, requires MANAGE_BOOK_CATALOG permission
 */
router.put(
  '/:id',
  requirePermission('MANAGE_BOOK_CATALOG'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createBookSchema),
  auditLog('UPDATE_BOOK'),
  bookController.updateBook
);

/**
 * @route   POST /api/books/:id/assign
 * @desc    Assign book to learner
 * @access  Authenticated, requires BORROW_RETURN_BOOKS permission
 */
router.post(
  '/:id/assign',
  requirePermission('BORROW_RETURN_BOOKS'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(assignBookSchema),
  auditLog('ASSIGN_BOOK'),
  bookController.assignBook
);

/**
 * @route   POST /api/books/:id/return
 * @desc    Return book from learner
 * @access  Authenticated, requires BORROW_RETURN_BOOKS permission
 */
router.post(
  '/:id/return',
  requirePermission('BORROW_RETURN_BOOKS'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  auditLog('RETURN_BOOK'),
  bookController.returnBook
);

/**
 * @route   DELETE /api/books/:id
 * @desc    Delete book
 * @access  Authenticated, requires MANAGE_BOOK_CATALOG permission
 */
router.delete(
  '/:id',
  requirePermission('MANAGE_BOOK_CATALOG'),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('DELETE_BOOK'),
  bookController.deleteBook
);

export default router;
