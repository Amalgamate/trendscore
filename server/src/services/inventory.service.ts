import prisma from '../config/database';

// Using local types to bypass IDE caching issues with Prisma Client
type InventoryItemType = 'CONSUMABLE' | 'ASSET';
type StockMovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
type RequisitionStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED';
type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'BROKEN' | 'REJECTED';

/**
 * Inventory & Asset Management Service
 * Handles stock, stores, requisitions, and fixed assets.
 */
export class InventoryService {
    // ============================================
    // CATEGORIES & STORES
    // ============================================

    async createCategory(data: { name: string; description?: string; parentId?: string }) {
        return (prisma as any).inventoryCategory.create({
            data: { ...data }
        });
    }

    async getCategories() {
        return prisma.inventoryCategory.findMany({
            include: { children: true }
        });
    }

    async createStore(data: { name: string; code?: string; location?: string }) {
        return (prisma as any).inventoryStore.create({
            data: { ...data }
        });
    }

    async getStores() {
        return prisma.inventoryStore.findMany({
            where: { isActive: true }
        });
    }

    // ============================================
    // ITEMS & STOCK MOVEMENTS
    // ============================================

    async createItem(data: {
        name: string;
        sku?: string;
        categoryId?: string;
        type: InventoryItemType;
        unitOfMeasure?: string;
        reorderLevel?: number;
    }) {
        return (prisma as any).inventoryItem.create({
            data: { ...data }
        });
    }

    async getItems(categoryId?: string) {
        const items = await prisma.inventoryItem.findMany({
            where: {
                isActive: true,
                ...(categoryId ? { categoryId } : {})
            },
            include: {
                category: true,
                _count: { select: { movements: true } },
                movements: {
                    select: {
                        type: true,
                        quantity: true,
                        fromStoreId: true,
                        toStoreId: true,
                    },
                },
            }
        });

        return items.map((item: any) => {
            let stockLevel = 0;
            const stockByStore: Record<string, number> = {};
            for (const movement of item.movements) {
                const quantity = Number(movement.quantity);
                if (movement.type === 'IN') {
                    stockLevel += quantity;
                    if (movement.toStoreId) stockByStore[movement.toStoreId] = (stockByStore[movement.toStoreId] ?? 0) + quantity;
                } else if (movement.type === 'OUT') {
                    stockLevel -= quantity;
                    if (movement.fromStoreId) stockByStore[movement.fromStoreId] = (stockByStore[movement.fromStoreId] ?? 0) - quantity;
                } else if (movement.type === 'ADJUSTMENT') {
                    stockLevel += quantity;
                    const storeId = movement.toStoreId ?? movement.fromStoreId;
                    if (storeId) stockByStore[storeId] = (stockByStore[storeId] ?? 0) + quantity;
                } else if (movement.type === 'TRANSFER') {
                    if (movement.fromStoreId) stockByStore[movement.fromStoreId] = (stockByStore[movement.fromStoreId] ?? 0) - quantity;
                    if (movement.toStoreId) stockByStore[movement.toStoreId] = (stockByStore[movement.toStoreId] ?? 0) + quantity;
                }
            }
            const { movements: _movements, ...itemData } = item;
            return { ...itemData, stockLevel, stockByStore };
        });
    }

    async recordMovement(data: {
        itemId: string;
        quantity: number;
        type: StockMovementType;
        fromStoreId?: string;
        toStoreId?: string;
        reference?: string;
        description?: string;
        performedById?: string;
    }) {
        if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
            throw new Error('Movement quantity must be greater than zero');
        }
        if ((data.type === 'IN' || data.type === 'ADJUSTMENT') && !data.toStoreId && !data.fromStoreId) {
            throw new Error('Select the store receiving the stock');
        }
        if (data.type === 'OUT' && !data.fromStoreId) {
            throw new Error('Select the store issuing the stock');
        }

        return prisma.$transaction(async (tx) => {
            // 1. Record the movement
            const movement = await tx.stockMovement.create({
                data: { ...data }
            });

            // 2. If it's an asset and being moved into a store, update asset location
            if (data.type === 'IN' || data.type === 'TRANSFER') {
                const item = await tx.inventoryItem.findUnique({ where: { id: data.itemId } });
                if (item?.type === 'ASSET' && data.toStoreId) {
                    // Logic to update assets if they are tracked individually
                }
            }

            return movement;
        });
    }

    async getStockLevels(itemId: string) {
        const movements = await prisma.stockMovement.findMany({
            where: { itemId }
        });

        let balance = 0;
        movements.forEach((m: any) => {
            if (m.type === 'IN') balance += Number(m.quantity);
            if (m.type === 'OUT') balance -= Number(m.quantity);
            if (m.type === 'ADJUSTMENT') balance += Number(m.quantity);
        });

        return balance;
    }

    async getMovements() {
        return prisma.stockMovement.findMany({
            include: {
                item: true,
                fromStore: true,
                toStore: true
            },
            orderBy: { createdAt: 'desc' },
            take: 100 // Limit for performance
        });
    }

    // ============================================
    // REQUISITIONS
    // ============================================

    async createRequisition(requestedById: string, data: {
        department?: string;
        priority?: string;
        requiredDate?: Date;
        notes?: string;
        items: { itemId: string; quantity: number }[];
    }) {
        const requisitionNo = `REQ/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

        return prisma.stockRequisition.create({
            data: {
                requisitionNo,
                requestedById,
                department: data.department,
                priority: data.priority,
                requiredDate: data.requiredDate,
                notes: data.notes,
                items: {
                    create: data.items.map((item: any) => ({
                        itemId: item.itemId,
                        quantity: item.quantity
                    }))
                }
            },
            include: { items: true }
        });
    }

    async updateRequisitionStatus(id: string, status: RequisitionStatus, approvedById?: string) {
        return (prisma as any).stockRequisition.update({
            where: { id },
            data: {
                status,
                approvedById,
                approvedAt: status === 'APPROVED' ? new Date() : undefined
            }
        });
    }

    async getRequisitions() {
        return prisma.stockRequisition.findMany({
            include: {
                requestedBy: true,
                approvedBy: true,
                items: { include: { item: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // ============================================
    // FIXED ASSETS & ASSIGNMENTS
    // ============================================

    async registerFixedAsset(data: {
        assetCode: string;
        name: string;
        itemId?: string;
        serialNumber?: string;
        purchaseDate?: Date;
        purchaseCost?: number;
        currentStoreId?: string;
    }) {
        return prisma.fixedAsset.create({
            data: { ...data }
        });
    }

    async assignAsset(data: {
        assetId: string;
        assignedToId?: string;
        assignedToClassId?: string;
        expectedReturn?: Date;
        conditionOnAssigned: AssetCondition;
        notes?: string;
    }) {
        return prisma.$transaction(async (tx) => {
            // 1. Create assignment
            const assignment = await tx.assetAssignment.create({
                data: { ...data }
            });

            // 2. Update asset status
            await tx.fixedAsset.update({
                where: { id: data.assetId },
                data: { status: 'ASSIGNED' }
            });

            return assignment;
        });
    }

    async getAssetRegister() {
        return prisma.fixedAsset.findMany({
            include: {
                assignments: {
                    where: { returnedAt: null },
                    include: { assignedTo: true, assignedToClass: true }
                },
                currentStore: true
            }
        });
    }
}

export default new InventoryService();
