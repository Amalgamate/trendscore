import { Request, Response } from 'express';
import inventoryService from '../services/inventory.service';

export class InventoryController {
    // CATEGORIES
    async createCategory(req: Request, res: Response) {
        try {
            const category = await inventoryService.createCategory(req.body);
            res.json({ success: true, data: category });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getCategories(req: Request, res: Response) {
        try {
            const categories = await inventoryService.getCategories();
            res.json({ success: true, data: categories });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // STORES
    async createStore(req: Request, res: Response) {
        try {
            const store = await inventoryService.createStore(req.body);
            res.json({ success: true, data: store });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getStores(req: Request, res: Response) {
        try {
            const stores = await inventoryService.getStores();
            res.json({ success: true, data: stores });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ITEMS
    async createItem(req: Request, res: Response) {
        try {
            const item = await inventoryService.createItem(req.body);
            res.json({ success: true, data: item });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getItems(req: Request, res: Response) {
        try {
            const { categoryId } = req.query;
            const items = await inventoryService.getItems(categoryId as string);
            res.json({ success: true, data: items });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // MOVEMENTS
    async recordMovement(req: Request, res: Response) {
        try {
            const { storeId, notes, ...movementData } = req.body;
            const movement = await inventoryService.recordMovement({
                ...movementData,
                fromStoreId: movementData.fromStoreId ?? (movementData.type === 'OUT' ? storeId : undefined),
                toStoreId: movementData.toStoreId ?? (movementData.type !== 'OUT' ? storeId : undefined),
                description: notes ?? movementData.description,
                performedById: (req as any).user?.id
            });
            res.json({ success: true, data: movement });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getMovements(req: Request, res: Response) {
        try {
            const movements = await inventoryService.getMovements();
            res.json({ success: true, data: movements });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // REQUISITIONS
    async createRequisition(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const requisition = await inventoryService.createRequisition(userId, req.body);
            res.json({ success: true, data: requisition });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async updateRequisitionStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const approvedById = (req as any).user?.id;
            const updated = await inventoryService.updateRequisitionStatus(id, status, approvedById);
            res.json({ success: true, data: updated });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getRequisitions(req: Request, res: Response) {
        try {
            const requisitions = await inventoryService.getRequisitions();
            res.json({ success: true, data: requisitions });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ASSETS
    async registerAsset(req: Request, res: Response) {
        try {
            const asset = await inventoryService.registerFixedAsset(req.body);
            res.json({ success: true, data: asset });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async assignAsset(req: Request, res: Response) {
        try {
            const assignment = await inventoryService.assignAsset(req.body);
            res.json({ success: true, data: assignment });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getAssetRegister(req: Request, res: Response) {
        try {
            const register = await inventoryService.getAssetRegister();
            res.json({ success: true, data: register });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

export default new InventoryController();
