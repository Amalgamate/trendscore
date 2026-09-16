/**
 * Unit tests for reportEngine.service.ts
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 12 (Automated Testing)
 *
 * Mocks report.service, school-resolver.service, and the Prisma client so
 * these tests exercise generateReport()'s own dispatch/snapshot logic in
 * isolation, without a live database.
 */

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    template: {
      findUnique: jest.fn(),
    },
    reportSnapshot: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../services/report.service', () => ({
  __esModule: true,
  generateTermlyReport: jest.fn(),
}));

jest.mock('../services/school-resolver.service', () => ({
  __esModule: true,
  resolveCurrentSchool: jest.fn(),
}));

import prisma from '../config/database';
import * as reportService from '../services/report.service';
import { resolveCurrentSchool } from '../services/school-resolver.service';
import { generateReport, resolveEngine } from '../services/reportEngine.service';

const mockedPrisma = prisma as unknown as {
  template: { findUnique: jest.Mock };
  reportSnapshot: { upsert: jest.Mock };
};
const mockedGenerateTermlyReport = reportService.generateTermlyReport as jest.Mock;
const mockedResolveCurrentSchool = resolveCurrentSchool as jest.Mock;

// The exact shape of TermlyReportData doesn't matter to reportEngine.service.ts —
// it treats it as an opaque payload it passes through/stores. A minimal fake
// keeps these tests focused on the dispatch/snapshot logic, not the data layer.
const FAKE_REPORT_DATA = { learner: { id: 'learner-1' } } as any;

describe('reportEngine.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGenerateTermlyReport.mockResolvedValue(FAKE_REPORT_DATA);
  });

  describe('generateReport()', () => {
    it('passes through unchanged for a LEGACY school, writing no snapshot', async () => {
      mockedResolveCurrentSchool.mockResolvedValue({ reportEngine: 'LEGACY', reportTemplateId: null });

      const result = await generateReport('learner-1', 'TERM_1' as any, 2026, 'user-1');

      expect(result).toEqual({
        engine: 'LEGACY',
        data: FAKE_REPORT_DATA,
        templateId: null,
        templateKey: null,
        templateVersion: null,
      });
      expect(mockedPrisma.template.findUnique).not.toHaveBeenCalled();
      expect(mockedPrisma.reportSnapshot.upsert).not.toHaveBeenCalled();
    });

    it('defaults to LEGACY when no School row exists', async () => {
      mockedResolveCurrentSchool.mockResolvedValue(null);

      const result = await generateReport('learner-1', 'TERM_1' as any, 2026, 'user-1');

      expect(result.engine).toBe('LEGACY');
      expect(mockedPrisma.reportSnapshot.upsert).not.toHaveBeenCalled();
    });

    it('returns data with no snapshot when NEW but no template is selected', async () => {
      mockedResolveCurrentSchool.mockResolvedValue({ reportEngine: 'NEW', reportTemplateId: null });

      const result = await generateReport('learner-1', 'TERM_1' as any, 2026, 'user-1');

      expect(result).toEqual({
        engine: 'NEW',
        data: FAKE_REPORT_DATA,
        templateId: null,
        templateKey: null,
        templateVersion: null,
      });
      expect(mockedPrisma.template.findUnique).not.toHaveBeenCalled();
      expect(mockedPrisma.reportSnapshot.upsert).not.toHaveBeenCalled();
    });

    it('returns data with no snapshot when the selected template no longer exists', async () => {
      mockedResolveCurrentSchool.mockResolvedValue({ reportEngine: 'NEW', reportTemplateId: 'template-1' });
      mockedPrisma.template.findUnique.mockResolvedValue(null);

      const result = await generateReport('learner-1', 'TERM_1' as any, 2026, 'user-1');

      expect(result.templateId).toBeNull();
      expect(mockedPrisma.reportSnapshot.upsert).not.toHaveBeenCalled();
    });

    it('upserts a snapshot and returns full template info for a valid NEW template', async () => {
      mockedResolveCurrentSchool.mockResolvedValue({ reportEngine: 'NEW', reportTemplateId: 'template-1' });
      mockedPrisma.template.findUnique.mockResolvedValue({ id: 'template-1', key: 'modern', version: 2 });
      mockedPrisma.reportSnapshot.upsert.mockResolvedValue({});

      const result = await generateReport('learner-1', 'TERM_1' as any, 2026, 'user-42');

      expect(result).toEqual({
        engine: 'NEW',
        data: FAKE_REPORT_DATA,
        templateId: 'template-1',
        templateKey: 'modern',
        templateVersion: 2,
      });
      expect(mockedPrisma.reportSnapshot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { learnerId_term_academicYear: { learnerId: 'learner-1', term: 'TERM_1', academicYear: 2026 } },
          create: expect.objectContaining({
            learnerId: 'learner-1',
            term: 'TERM_1',
            academicYear: 2026,
            templateId: 'template-1',
            templateVersion: 2,
            reportData: FAKE_REPORT_DATA,
            generatedBy: 'user-42',
          }),
          update: expect.objectContaining({
            templateId: 'template-1',
            templateVersion: 2,
            reportData: FAKE_REPORT_DATA,
            generatedBy: 'user-42',
          }),
        })
      );
    });

    it('re-runs generateTermlyReport on every call rather than reading a snapshot back (Phase 9 decision)', async () => {
      mockedResolveCurrentSchool.mockResolvedValue({ reportEngine: 'NEW', reportTemplateId: 'template-1' });
      mockedPrisma.template.findUnique.mockResolvedValue({ id: 'template-1', key: 'modern', version: 2 });
      mockedPrisma.reportSnapshot.upsert.mockResolvedValue({});

      await generateReport('learner-1', 'TERM_1' as any, 2026, 'user-1');
      await generateReport('learner-1', 'TERM_1' as any, 2026, 'user-1');

      expect(mockedGenerateTermlyReport).toHaveBeenCalledTimes(2);
      expect(mockedPrisma.reportSnapshot.upsert).toHaveBeenCalledTimes(2);
    });

    it('upserts rather than creates on repeated views of the same report (session-5 fix)', async () => {
      mockedResolveCurrentSchool.mockResolvedValue({ reportEngine: 'NEW', reportTemplateId: 'template-1' });
      mockedPrisma.template.findUnique.mockResolvedValue({ id: 'template-1', key: 'modern', version: 2 });
      mockedPrisma.reportSnapshot.upsert.mockResolvedValue({});

      await generateReport('learner-1', 'TERM_1' as any, 2026, 'viewer-1');
      await generateReport('learner-1', 'TERM_1' as any, 2026, 'viewer-2');

      // Same upsert `where` both times — one live row per learner+term+year,
      // refreshed on each view, not one new row per view.
      const firstCallArgs = mockedPrisma.reportSnapshot.upsert.mock.calls[0][0];
      const secondCallArgs = mockedPrisma.reportSnapshot.upsert.mock.calls[1][0];
      expect(firstCallArgs.where).toEqual(secondCallArgs.where);
      expect(firstCallArgs.update.generatedBy).toBe('viewer-1');
      expect(secondCallArgs.update.generatedBy).toBe('viewer-2');
    });
  });

  describe('resolveEngine()', () => {
    it('returns LEGACY when no School row exists', async () => {
      mockedResolveCurrentSchool.mockResolvedValue(null);
      await expect(resolveEngine()).resolves.toBe('LEGACY');
    });

    it("returns the School's configured engine", async () => {
      mockedResolveCurrentSchool.mockResolvedValue({ reportEngine: 'NEW' });
      await expect(resolveEngine()).resolves.toBe('NEW');
    });
  });
});
