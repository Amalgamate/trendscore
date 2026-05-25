import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { accountingController } from '../../src/controllers/accounting.controller';
import accountingRoutes from '../../src/routes/accounting.routes';

// Mock Middleware
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'ADMIN' };
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../src/middleware/permissions.middleware', () => ({
    requireRole: () => (req: any, res: any, next: any) => next(),
    auditLog: () => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../src/middleware/enhanced-rateLimit.middleware', () => ({
    rateLimit: () => (req: any, res: any, next: any) => next(),
}));

// Mock Controller
jest.mock('../../src/controllers/accounting.controller', () => {
  const mockController = {
    getDashboardStats: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    getAccounts: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    createAccount: jest.fn().mockImplementation((req: any, res: any) => res.status(201).json({ success: true })),
    getJournals: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    initializeCoA: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    createJournalEntry: jest.fn().mockImplementation((req: any, res: any) => res.status(201).json({ success: true })),
    postJournalEntry: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    getJournalEntries: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    getTrialBalance: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    getVendors: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    createVendor: jest.fn().mockImplementation((req: any, res: any) => res.status(201).json({ success: true })),
    getExpenses: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    recordExpense: jest.fn().mockImplementation((req: any, res: any) => res.status(201).json({ success: true })),
    getBankStatements: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    importBankStatement: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    reconcileLine: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
    suggestMatches: jest.fn().mockImplementation((req: any, res: any) => res.json({ success: true })),
  };
  return {
    AccountingController: jest.fn().mockImplementation(() => mockController),
    accountingController: mockController,
  };
});

describe('Accounting Routes — Validation Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/accounting', accountingRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/accounting/accounts', () => {
    it('should fail if code is missing', async () => {
      const response = await request(app)
        .post('/api/accounting/accounts')
        .send({ name: 'Test Account', type: 'ASSET_CASH' });

      expect(response.status).toBe(400); // Validation error
      expect(accountingController.createAccount).not.toHaveBeenCalled();
    });

    it('should pass with valid data', async () => {
      const response = await request(app)
        .post('/api/accounting/accounts')
        .send({ code: '1000', name: 'Test', type: 'ASSET_CASH' });

      expect(response.status).toBe(201);
      expect(accountingController.createAccount).toHaveBeenCalled();
    });
  });

  describe('POST /api/accounting/entries', () => {
      it('should fail if items are missing', async () => {
          const response = await request(app)
              .post('/api/accounting/entries')
              .send({ journalId: 'j1' });

          expect(response.status).toBe(400);
      });

      it('should pass with valid data', async () => {
          const response = await request(app)
              .post('/api/accounting/entries')
              .send({ 
                  journalId: 'j1', 
                  items: [
                    { accountId: 'a1', debit: 100 },
                    { accountId: 'a2', credit: 100 }
                  ] 
              });

          expect(response.status).toBe(201);
          expect(accountingController.createJournalEntry).toHaveBeenCalled();
      });
  });
});
