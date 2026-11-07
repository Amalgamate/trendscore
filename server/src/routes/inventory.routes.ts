import { Router } from 'express';
import { z } from 'zod';
import inventoryController from '../controllers/inventory.controller';
import { authenticate } from '../middleware/auth.middleware';
import { auditLog, requireRole } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();

const ROLE_INVENTORY_ADMIN = ['SUPER_ADMIN', 'ADMIN'] as const;

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional()
});

const createStoreSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().max(50).optional(),
  location: z.string().max(200).optional()
});

const createItemSchema = z.object({
  name: z.string().min(2).max(200),
  categoryId: z.string().min(1),
  storeId: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0).optional()
});

const recordMovementSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().min(0),
  storeId: z.string().min(1).optional(),
  fromStoreId: z.string().min(1).optional(),
  toStoreId: z.string().min(1).optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional()
}).refine(
  (movement) => movement.type === 'OUT'
    ? Boolean(movement.storeId || movement.fromStoreId)
    : Boolean(movement.storeId || movement.toStoreId || movement.fromStoreId),
  { message: 'Select a store for this stock movement', path: ['storeId'] }
);

const createRequisitionSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().min(1),
  purpose: z.string().max(500).optional()
});

const registerAssetSchema = z.object({
  name: z.string().min(2).max(200),
  assetCode: z.string().min(2).max(50),
  itemId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  serialNumber: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  purchaseDate: z.coerce.date().optional(),
  purchaseCost: z.number().min(0).optional(),
  warrantyExpiry: z.coerce.date().optional(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR', 'BROKEN', 'REJECTED']).optional().default('NEW'),
  location: z.string().max(200).optional(),
  currentStoreId: z.string().uuid().optional()
});

// ============================================
// CATEGORY ROUTES
// ============================================

/**
 * @route   POST /api/inventory/categories
 * @desc    Create item category
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/categories',
  authenticate,
  requireRole([...ROLE_INVENTORY_ADMIN]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createCategorySchema),
  auditLog('CREATE_INVENTORY_CATEGORY'),
  inventoryController.createCategory
);

/**
 * @route   GET /api/inventory/categories
 * @desc    Get item categories
 * @access  Authenticated
 */
router.get(
  '/categories',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  inventoryController.getCategories
);

// ============================================
// STORE ROUTES
// ============================================

/**
 * @route   POST /api/inventory/stores
 * @desc    Create store
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/stores',
  authenticate,
  requireRole([...ROLE_INVENTORY_ADMIN]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createStoreSchema),
  auditLog('CREATE_STORE'),
  inventoryController.createStore
);

/**
 * @route   GET /api/inventory/stores
 * @desc    Get stores
 * @access  Authenticated
 */
router.get(
  '/stores',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  inventoryController.getStores
);

// ============================================
// ITEM ROUTES
// ============================================

/**
 * @route   POST /api/inventory/items
 * @desc    Create inventory item
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/items',
  authenticate,
  requireRole([...ROLE_INVENTORY_ADMIN]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createItemSchema),
  auditLog('CREATE_INVENTORY_ITEM'),
  inventoryController.createItem
);

/**
 * @route   GET /api/inventory/items
 * @desc    Get inventory items
 * @access  Authenticated
 */
router.get(
  '/items',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  inventoryController.getItems
);

// ============================================
// STOCK MOVEMENT ROUTES
// ============================================

/**
 * @route   POST /api/inventory/movements
 * @desc    Record stock movement
 * @access  ADMIN, SUPER_ADMIN, LIBRARIAN
 */
router.post(
  '/movements',
  authenticate,
  requireRole([...ROLE_INVENTORY_ADMIN]),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(recordMovementSchema),
  auditLog('RECORD_STOCK_MOVEMENT'),
  inventoryController.recordMovement
);

/**
 * @route   GET /api/inventory/movements
 * @desc    Get stock movements
 * @access  Authenticated
 */
router.get(
  '/movements',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  inventoryController.getMovements
);

// ============================================
// REQUISITION ROUTES
// ============================================

/**
 * @route   POST /api/inventory/requisitions
 * @desc    Create requisition
 * @access  Authenticated
 */
router.post(
  '/requisitions',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(createRequisitionSchema),
  auditLog('CREATE_REQUISITION'),
  inventoryController.createRequisition
);

/**
 * @route   GET /api/inventory/requisitions
 * @desc    Get requisitions
 * @access  Authenticated
 */
router.get(
  '/requisitions',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  inventoryController.getRequisitions
);

/**
 * @route   PATCH /api/inventory/requisitions/:id/status
 * @desc    Update requisition status
 * @access  ADMIN, SUPER_ADMIN
 */
router.patch(
  '/requisitions/:id/status',
  authenticate,
  requireRole([...ROLE_INVENTORY_ADMIN]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('UPDATE_REQUISITION_STATUS'),
  inventoryController.updateRequisitionStatus
);

// ============================================
// ASSET ROUTES
// ============================================

/**
 * @route   POST /api/inventory/assets
 * @desc    Register asset
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/assets',
  authenticate,
  requireRole([...ROLE_INVENTORY_ADMIN]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(registerAssetSchema),
  auditLog('REGISTER_ASSET'),
  inventoryController.registerAsset
);

/**
 * @route   POST /api/inventory/assets/assign
 * @desc    Assign asset to user
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/assets/assign',
  authenticate,
  requireRole([...ROLE_INVENTORY_ADMIN]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('ASSIGN_ASSET'),
  inventoryController.assignAsset
);

/**
 * @route   GET /api/inventory/assets
 * @desc    Get asset register
 * @access  Authenticated
 */
router.get(
  '/assets',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  inventoryController.getAssetRegister
);

export default router;


