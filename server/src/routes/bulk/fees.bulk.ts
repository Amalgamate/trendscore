import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/permissions.middleware';
import { rateLimit } from '../../middleware/enhanced-rateLimit.middleware';
import { auditLog } from '../../middleware/permissions.middleware';
import { Term, PaymentMethod, PaymentStatus } from '@prisma/client';
import prisma from '../../config/database';
import multer from 'multer';
import { accountingService } from '../../services/accounting.service';
import { buildLearnerMapFromAdmNos } from '../../services/admissionNumber.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS: typeof import('exceljs') = require('exceljs');

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

async function parseWorkbook(buffer: Buffer): Promise<Record<string, any>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: Record<string, any>[] = [];
  let headers: string[] = [];
  const hasAdmissionHeader = (vals: any[]) =>
    vals.some((v) => {
      const s = String(v ?? '').trim().toLowerCase();
      return s === 'adm no' || s === 'admission number';
    });

  ws.eachRow((row: import('exceljs').Row, rowNumber: number) => {
    const values = (row.values as any[]).slice(1);
    const normalizedValues = values.map((v: any) => (v == null ? '' : String(v).trim()));

    // Row 1 is the default header row.
    if (rowNumber === 1) {
      headers = normalizedValues;
      return;
    }

    // Support files where row 1 is a title and row 2 has real headers.
    // Only treat row 2 as headers when row 1 does not contain admission header
    // but row 2 does.
    if (rowNumber === 2 && !hasAdmissionHeader(headers) && hasAdmissionHeader(normalizedValues)) {
      headers = normalizedValues;
      return;
    }

    const obj: Record<string, any> = {};
    let hasData = false;
    headers.forEach((h: string, i: number) => {
      if (!h) return;
      const cell = values[i];
      const val = cell && typeof cell === 'object' && 'richText' in cell
        ? cell.richText.map((r: any) => r.text).join('')
        : cell ?? null;

      obj[h] = val;
      if (val != null && val !== '') hasData = true;
    });

    if (hasData) {
      rows.push(obj);
    }
  });

  return rows;
}

/**
 * POST /api/bulk/fees/upload-balances
 * Import Opening Balances (Cumulative Billed/Paid/Balance)
 */
router.post(
  '/upload-balances',
  upload.single('file'),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('BULK_UPLOAD_FEE_BALANCES'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const { academicYear, term } = req.body;
      if (!academicYear || !term) {
        return res.status(400).json({ success: false, error: 'Academic year and term are required' });
      }

      const yearInt = parseInt(academicYear);
      const data = await parseWorkbook(req.file.buffer);

      // Set headers for streaming NDJSON
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const results = { updated: 0, created: 0, failed: 0, errors: [] as any[] };

      // [CANCELLATION SUPPORT] Monitor for client disconnect
      let isAborted = false;
      req.on('close', () => {
        if (!res.writableEnded) {
          isAborted = true;
          console.log('[BulkImport] Client disconnected. Aborting balance import...');
        }
      });

      // Helper to send progress
      const sendStatus = (type: string, payload: any) => {
        res.write(JSON.stringify({ type, ...payload }) + '\n');
      };

      // [OPTIMIZATION] 1. Pre-fetch and Cache Accounting Lookups
      sendStatus('info', { message: 'Initializing accounting cache...' });
      try {
        await accountingService.getAccountByCode('1100');
        await accountingService.getAccountByCode('4000');
        await accountingService.getAccountByCode('1200');
        await accountingService.getAccountByCode('1210');
        await accountingService.getAccountByCode('2100');
        await accountingService.getJournalByCode('INV');
        await accountingService.getJournalByCode('CSH1');
      } catch (e) {
        console.warn('[BulkImport-Optimization] Failed to pre-warm accounting cache', e);
      }

      // [OPTIMIZATION] 2. Extract Admission Numbers and Bulk Fetch Learners
      sendStatus('info', { message: 'Loading student records...' });
      const uniqueAdmNos = Array.from(new Set(
        data.map(row => String(row['Adm No'] ?? row['Admission Number'] ?? '').trim()).filter(Boolean)
      ));

      // buildLearnerMapFromAdmNos handles both "1100" (legacy) and "ADM-2026-1100"
      // (prefixed) admission number formats, resolving either direction automatically.
      const learnerMap = await buildLearnerMapFromAdmNos(uniqueAdmNos, prisma);
      const learners = Array.from(learnerMap.values());
      const learnerIds = learners.map(l => l.id);

      // [OPTIMIZATION] 3. Pre-fetch existing Invoices
      sendStatus('info', { message: 'Analyzing existing invoices...' });
      const existingInvoices = await prisma.feeInvoice.findMany({
        where: {
          learnerId: { in: learnerIds },
          term: term as Term,
          academicYear: yearInt,
          archived: false
        }
      });
      const invoiceMap = new Map(existingInvoices.map(i => [i.learnerId, i]));

      // [OPTIMIZATION] 4. Pre-fetch Fee Structures
      const distinctGrades = Array.from(new Set(learners.map(l => l.grade)));
      const searchGrades = distinctGrades.map(g => {
        if (g === 'GRADE_10') return 'FORM_1' as any;
        if (g === 'GRADE_11') return 'FORM_2' as any;
        if (g === 'GRADE_12') return 'FORM_3' as any;
        return g;
      });

      const structures = await prisma.feeStructure.findMany({
        where: {
          grade: { in: searchGrades },
          term: term as Term,
          academicYear: yearInt,
          archived: false
        }
      });
      const structureMap = new Map(structures.map(s => [s.grade, s]));

      // [OPTIMIZATION] 5. Pre-fetch existing Payments (Opening Balances)
      const existingPayments = await prisma.feePayment.findMany({
        where: {
          invoiceId: { in: existingInvoices.map(i => i.id) },
          paymentMethod: 'OTHER',
          notes: 'Opening Balance Import'
        }
      });
      const paymentMap = new Map(existingPayments.map(p => [p.invoiceId, p]));

      // 6. Process Main Loop (Now using in-memory lookups)
      // [FIX] Pre-filter to ensure "Total" is honest
      const filteredData = data.filter(row => {
        const adm = String(row['Adm No'] ?? row['Admission Number'] ?? '').trim();
        return adm && adm !== 'undefined';
      });

      const totalRows = filteredData.length;
      sendStatus('start', { total: totalRows });

      for (const [index, row] of filteredData.entries()) {
        if (isAborted) {
          console.log('[BulkImport] Stopping balance loop due to cancellation.');
          break;
        }

        let currentAdmNo = '';
        let currentStudentName: string | undefined;

        try {
          const admNo = String(row['Adm No'] ?? row['Admission Number'] ?? '').trim();
          currentAdmNo = admNo;
          if (!admNo || admNo === 'undefined') {
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          const billedRaw = row['Billed'] ?? row['Total Amount'];
          const paidRaw = row['Paid'] ?? row['Paid Amount'];
          const balanceRaw = row['Balance'] ?? row['Balances'] ?? row['Outstanding'];
          
          const tBilledRaw = row['Transport Billed'];
          const tPaidRaw = row['Transport Paid'];

          if (billedRaw == null && paidRaw == null && balanceRaw == null && tBilledRaw == null && tPaidRaw == null) {
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          const billed = parseFloat(String(billedRaw || 0).replace(/,/g, '')) || 0;
          const paid = parseFloat(String(paidRaw || 0).replace(/,/g, '')) || 0;
          const balance = parseFloat(String(balanceRaw || 0).replace(/,/g, '')) || 0;

          const tBilled = parseFloat(String(tBilledRaw || 0).replace(/,/g, '')) || 0;
          const tPaid = parseFloat(String(tPaidRaw || 0).replace(/,/g, '')) || 0;
          const tBalance = tBilled - tPaid;

          const learner = learnerMap.get(admNo);
          if (!learner) {
            results.failed++;
            results.errors.push({ row: index + 3, admNo, error: 'Student not found in registry' });
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }
          currentStudentName = `${Math.max(0, 0) === 0 ? learner.firstName : ''} ${learner.lastName}`.trim();
          if (!currentStudentName || currentStudentName === 'undefined') {
             currentStudentName = `${learner.firstName} ${learner.lastName}`;
          }

          let invoice = invoiceMap.get(learner.id);

          if (!invoice) {
            let mappedGrade = learner.grade;
            if (mappedGrade === 'GRADE_10') mappedGrade = 'FORM_1' as any;
            if (mappedGrade === 'GRADE_11') mappedGrade = 'FORM_2' as any;
            if (mappedGrade === 'GRADE_12') mappedGrade = 'FORM_3' as any;

            const structure = structureMap.get(mappedGrade as any);
            if (!structure) {
              results.failed++;
              results.errors.push({ row: index + 3, admNo, studentName: currentStudentName, error: `No fee structure found for grade ${learner.grade}` });
              sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
              continue;
            }

            invoice = await prisma.feeInvoice.create({
              data: {
                invoiceNumber: `INV-${admNo}-${term}-${Date.now().toString().slice(-4)}`,
                learnerId: learner.id,
                feeStructureId: structure.id,
                term: term as Term,
                academicYear: yearInt,
                dueDate: new Date(),
                totalAmount: billed,
                paidAmount: paid,
                balance: balance,
                transportBilled: tBilled,
                transportPaid: tPaid,
                transportBalance: tBalance,
                status: balance < 0 ? 'OVERPAID' : balance === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
                issuedBy: req.user!.userId
              }
            });
            results.created++;
          } else {
            invoice = await prisma.feeInvoice.update({
              where: { id: invoice.id },
              data: {
                totalAmount: billed,
                paidAmount: paid,
                balance: balance,
                transportBilled: tBilled,
                transportPaid: tPaid,
                transportBalance: tBalance,
                status: balance < 0 ? 'OVERPAID' : balance === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING'
              }
            });
            results.updated++;
          }

          // Sync with Accounting Ledger
          try {
            await accountingService.postFeeInvoiceToLedger(invoice);
          } catch (accErr) {
            console.error(`[BulkImport-Accounting] Failed to post invoice ledger: ${admNo}`, accErr);
          }

          if (paid > 0) {
            const existingPayment = paymentMap.get(invoice.id);

            if (existingPayment) {
              await prisma.feePayment.update({
                where: { id: existingPayment.id },
                data: { amount: paid }
              });
            } else {
              const payment = await prisma.feePayment.create({
                data: {
                  receiptNumber: `REC-${admNo}-OB-${Date.now().toString().slice(-4)}`,
                  invoiceId: invoice.id,
                  amount: paid + tPaid,
                  transportAmount: tPaid,
                  paymentMethod: 'OTHER',
                  notes: 'Opening Balance Import',
                  paymentDate: new Date(),
                  recordedBy: req.user!.userId
                }
              });

              try {
                await accountingService.postFeePaymentToLedger(payment, 'OTHER');
              } catch (accErr) {
                console.error(`[BulkImport-Accounting] Failed to post payment ledger: ${admNo}`, accErr);
              }
            }
          }

          // [PROGRESS UPDATE]
          sendStatus('progress', { 
            current: index + 1, 
            total: totalRows, 
            percent: Math.round(((index + 1) / totalRows) * 100) 
          });

        } catch (err: any) {
          results.failed++;
          results.errors.push({ row: index + 3, admNo: currentAdmNo, studentName: currentStudentName, error: err.message });
          sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
        }
      }

      // [FINAL RESULT]
      sendStatus('complete', {
        summary: { totalRows: data.length, ...results },
        errors: results.errors.slice(0, 50)
      });
      res.end();
    } catch (error: any) {
      console.error('Upload Balances Error:', error);
      // Since we already might have started streaming, this catch might fail to send status code
      res.write(JSON.stringify({ type: 'error', error: 'Failed to process import', details: error.message }) + '\n');
      res.end();
    }
  }
);

/**
 * POST /api/bulk/fees/upload-payments
 * Import Daily Bank Payments (Transaction rows)
 */
router.post(
  '/upload-payments',
  upload.single('file'),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('BULK_UPLOAD_FEE_PAYMENTS'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // Expected columns: Adm No, Date, Amount, Reference, Method
      const { academicYear, term } = req.body;
      const data = await parseWorkbook(req.file.buffer);

      // Set headers for streaming NDJSON
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const results = { processed: 0, failed: 0, errors: [] as any[] };

      // [CANCELLATION SUPPORT] Monitor for client disconnect
      let isAborted = false;
      req.on('close', () => {
        if (!res.writableEnded) {
          isAborted = true;
          console.log('[BulkImport] Client disconnected. Aborting payment import...');
        }
      });

      // Helper to send progress
      const sendStatus = (type: string, payload: any) => {
        res.write(JSON.stringify({ type, ...payload }) + '\n');
      };

      // 5. Process Main Loop (Now using in-memory lookups)
      // [FIX] Pre-filter for honest progress
      const filteredData = data.filter(row => {
        const adm = String(row['Adm No'] ?? row['Admission Number'] ?? '').trim();
        return adm && adm !== 'undefined';
      });

      const totalRows = filteredData.length;
      sendStatus('start', { total: totalRows });

      for (const [index, row] of filteredData.entries()) {
        if (isAborted) {
          console.log('[BulkImport] Stopping payment loop due to cancellation.');
          break;
        }

        let currentAdmNo = '';
        let currentStudentName: string | undefined;

        try {
          const admNo = String(row['Adm No'] ?? row['Admission Number'] ?? '').trim();
          currentAdmNo = admNo;
          if (!admNo || admNo === 'undefined') {
             sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
             continue;
          }

          const amountRaw = row['Amount'] ?? row['Paid'];
          const dateRaw = row['Date'] ?? row['Payment Date'];
          const refRaw = row['Reference'] ?? row['Ref No'];
          const modeRaw = row['Mode'] ?? row['Payment Method'] ?? row['Method'];
          const allocationRaw = row['Allocation'] ?? row['Allocate To'];

          if (!amountRaw) {
             sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
             continue;
          }

          const amount = parseFloat(String(amountRaw).replace(/,/g, ''));
          if (isNaN(amount) || amount <= 0) {
             sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
             continue;
          }

          let parsedPaymentMethod: any = 'CASH'; // Default to cash
          if (modeRaw) {
             const m = String(modeRaw).toUpperCase().trim();
             if (m.includes('MPESA') || m.includes('M-PESA') || m.includes('M PESA')) parsedPaymentMethod = 'MPESA';
             else if (m.includes('BANK')) parsedPaymentMethod = 'BANK';
             else if (m.includes('CHEQUE')) parsedPaymentMethod = 'CHEQUE';
             else if (m.includes('CARD') || m.includes('DEBIT') || m.includes('CREDIT')) parsedPaymentMethod = 'CARD';
             else parsedPaymentMethod = 'OTHER';
          }

          const learner = await (async () => {
            const exact = await prisma.learner.findUnique({ where: { admissionNumber: admNo } });
            if (exact) return exact;
            const { resolveAdmissionNumber } = await import('../../services/admissionNumber.service');
            return resolveAdmissionNumber(admNo, prisma);
          })();
          if (!learner) {
            results.failed++;
            results.errors.push({ row: index + 2, admNo, error: 'Student not found' });
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }
          currentStudentName = `${learner.firstName} ${learner.lastName}`;

          // Use active invoice
          const invoice = await prisma.feeInvoice.findFirst({
            where: { learnerId: learner.id, term: term as Term, academicYear: parseInt(academicYear), archived: false },
            orderBy: { createdAt: 'desc' }
          });

          if (!invoice) {
            results.failed++;
            results.errors.push({ row: index + 2, admNo, studentName: currentStudentName, error: `No active invoice for ${term} found` });
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          // Generate a unique receipt number
          const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
          const receiptNumber = `RCP-${Date.now().toString().slice(-4)}${randStr}`;

          // Calculate explicit vs intelligent allocation
          const currentTuitionBal = Number(invoice.balance || 0);
          const currentTransportBal = Number(invoice.transportBalance || 0);
          
          let tuitionChunk = 0;
          let transportChunk = 0;

          const passedAllocation = String(allocationRaw || '').toUpperCase().trim();

          if (passedAllocation === 'TRANSPORT') {
            transportChunk = amount;
          } else if (passedAllocation === 'TUITION') {
            tuitionChunk = amount;
          } else {
             // AUTO
             if (amount <= currentTuitionBal) {
                 tuitionChunk = amount;
             } else {
                 tuitionChunk = currentTuitionBal;
                 transportChunk = amount - currentTuitionBal;
             }
          }

          // Create payment
          const payment = await prisma.$transaction(async (tx) => {
            const createdPayment = await tx.feePayment.create({
              data: {
                receiptNumber,
                invoiceId: invoice.id,
                amount: amount,
                transportAmount: transportChunk,
                paymentMethod: parsedPaymentMethod,
                referenceNumber: refRaw ? String(refRaw) : undefined,
                paymentDate: dateRaw ? new Date(dateRaw) : new Date(),
                notes: 'Bulk imported payment',
                recordedBy: req.user!.userId
              }
            });

            await tx.feeInvoice.update({
              where: { id: invoice.id },
              data: {
                paidAmount: { increment: tuitionChunk },
                balance: { decrement: tuitionChunk },
                transportPaid: { increment: transportChunk },
                transportBalance: { decrement: transportChunk }
              }
            });

            // Need to pull fresh balance to determine enum Status
            const freshInvoice = await tx.feeInvoice.findUnique({ where: { id: invoice.id } });
            if (freshInvoice) {
               await tx.feeInvoice.update({
                  where: { id: invoice.id },
                  data: {
                     status: Number(freshInvoice.balance) <= 0 ? 'PAID' : 'PARTIAL'
                  }
               });
            }

            return createdPayment;
          });

          // Sync with Ledger
          try {
             await accountingService.postFeePaymentToLedger(payment, 'OTHER');
          } catch (e) {
             console.error(`Ledger sync failed for payment ${payment.id}`, e);
          }

          results.processed++;
          
          // [PROGRESS UPDATE]
          sendStatus('progress', { 
            current: index + 1, 
            total: totalRows, 
            percent: Math.round(((index + 1) / totalRows) * 100) 
          });

        } catch (err: any) {
          results.failed++;
          results.errors.push({ row: index + 2, admNo: currentAdmNo, studentName: currentStudentName, error: err.message });
          sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
        }
      }

      // [FINAL RESULT]
      sendStatus('complete', {
        summary: { totalRows: data.length, ...results },
        errors: results.errors.slice(0, 50)
      });
      res.end();
    } catch (error: any) {
      console.error('Upload Payments Error:', error);
      res.write(JSON.stringify({ type: 'error', error: 'Failed to process payments', details: error.message }) + '\n');
      res.end();
    }
  }
);

/**
 * POST /api/bulk/fees/upload-waivers
 * Import Bulk Waivers (Adjustments for past periods)
 */
router.post(
  '/upload-waivers',
  upload.single('file'),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('BULK_UPLOAD_FEE_WAIVERS'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const { academicYear, term } = req.body;
      const data = await parseWorkbook(req.file.buffer);

      // Set headers for streaming NDJSON
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const results = { processed: 0, failed: 0, errors: [] as any[] };

      // [CANCELLATION SUPPORT] Monitor for client disconnect
      let isAborted = false;
      req.on('close', () => {
        if (!res.writableEnded) {
          isAborted = true;
          console.log('[BulkImport] Client disconnected. Aborting waiver import...');
        }
      });

      // Helper to send progress
      const sendStatus = (type: string, payload: any) => {
        if (!res.writableEnded) {
          res.write(JSON.stringify({ type, ...payload }) + '\n');
        }
      };

      // Filter data and skip "TOTAL" rows or empty ones
      const filteredData = data.filter(row => {
        const adm = String(row['Adm No'] ?? row['Admission Number'] ?? '').trim();
        return adm && adm !== 'undefined' && adm.toUpperCase() !== 'TOTAL';
      });

      const totalRows = filteredData.length;
      sendStatus('start', { total: totalRows });

      for (const [index, row] of filteredData.entries()) {
        if (isAborted) break;

        let currentAdmNo = '';
        let currentStudentName: string | undefined;

        try {
          const admNo = String(row['Adm No'] ?? row['Admission Number'] ?? '').trim();
          currentAdmNo = admNo;
          const amountRaw = row['Waiver'] ?? row['Amount'] ?? row['Amount Waived'];
          const dateRaw = row['Date'] ?? row['Waiver Date'];
          const reason = row['Reason'] ?? row['Notes'] ?? `Bulk Adjustment for ${term} ${academicYear}`;

          if (!amountRaw || amountRaw === 0) {
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          const amount = parseFloat(String(amountRaw).replace(/,/g, ''));
          if (isNaN(amount) || amount <= 0) {
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          const learner = await (async () => {
            const exact = await prisma.learner.findUnique({ where: { admissionNumber: admNo } });
            if (exact) return exact;
            const { resolveAdmissionNumber } = await import('../../services/admissionNumber.service');
            return resolveAdmissionNumber(admNo, prisma);
          })();
          if (!learner) {
            results.failed++;
            results.errors.push({ row: index + 3, admNo, error: 'Student not found' });
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }
          currentStudentName = `${learner.firstName} ${learner.lastName}`;

          // Find relevant invoice for the period
          const invoice = await prisma.feeInvoice.findFirst({
            where: { 
              learnerId: learner.id, 
              term: term as Term, 
              academicYear: parseInt(academicYear), 
              archived: false 
            },
            orderBy: { createdAt: 'desc' }
          });

          if (!invoice) {
            results.failed++;
            results.errors.push({ row: index + 3, admNo, studentName: currentStudentName, error: `No invoice found for ${term} ${academicYear}` });
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          // [FIX] cumulative waiver check to avoid over-waiving
          const approvedAggregate = await prisma.feeWaiver.aggregate({
            where: { invoiceId: invoice.id, status: 'APPROVED', archived: false },
            _sum: { amountWaived: true }
          });
          const alreadyWaived = Number(approvedAggregate._sum.amountWaived ?? 0);
          
          if (alreadyWaived + amount > Number(invoice.totalAmount)) {
             results.failed++;
             results.errors.push({ 
               row: index + 3, 
               admNo, 
               studentName: currentStudentName,
               error: `Waiver amount exceeds remaining invoice total (Already waived: ${alreadyWaived})` 
             });
             sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
             continue;
          }

          // Create waiver and update invoice in transaction
          const waiver = await prisma.$transaction(async (tx) => {
            const createdWaiver = await tx.feeWaiver.create({
              data: {
                invoiceId: invoice.id,
                amountWaived: amount,
                reason: String(reason),
                status: 'APPROVED',
                waiverCategory: 'OTHER',
                createdById: req.user!.userId,
                approvedById: req.user!.userId,
                approvedAt: dateRaw ? new Date(dateRaw) : new Date(),
                createdAt: dateRaw ? new Date(dateRaw) : new Date()
              }
            });

            // Re-read invoice for fresh balance
            const freshInv = await tx.feeInvoice.findUnique({ where: { id: invoice.id } });
            const newBalance = Math.max(0, Number(freshInv!.balance) - amount);
            
            let newStatus: PaymentStatus;
            if (newBalance <= 0) {
              newStatus = Number(freshInv!.paidAmount) > 0 ? 'PAID' : 'WAIVED';
            } else if (Number(freshInv!.paidAmount) > 0) {
              newStatus = 'PARTIAL';
            } else {
              newStatus = 'PENDING';
            }

            await tx.feeInvoice.update({
              where: { id: invoice.id },
              data: {
                balance: newBalance,
                status: newStatus
              }
            });

            return createdWaiver;
          });

          // Sync with Ledger
          try {
             await accountingService.postFeeWaiverToLedger(waiver);
          } catch (e) {
             console.error(`Ledger sync failed for waiver ${waiver.id}`, e);
          }

          results.processed++;
          sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });

        } catch (err: any) {
          results.failed++;
          results.errors.push({ row: index + 3, admNo: currentAdmNo, studentName: currentStudentName, error: err.message });
          sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
        }
      }

      sendStatus('complete', {
        summary: { totalRows: data.length, ...results },
        errors: results.errors.slice(0, 50)
      });
      res.end();
    } catch (error: any) {
      console.error('Upload Waivers Error:', error);
      if (!res.writableEnded) {
        res.write(JSON.stringify({ type: 'error', error: 'Failed to process waivers', details: error.message }) + '\n');
        res.end();
      }
    }
  }
);

/**
 * POST /api/bulk/fees/upload-transport
 * Append Transport Fees to existing invoices by Admission Number.
 * Only updates students who are marked as isTransportStudent.
 * Columns: Adm No, Transport Billed
 */
router.post(
  '/upload-transport',
  upload.single('file'),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('BULK_UPLOAD_TRANSPORT_FEES'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const { academicYear, term } = req.body;
      if (!academicYear || !term) {
        return res.status(400).json({ success: false, error: 'academicYear and term are required' });
      }

      const data = await parseWorkbook(req.file.buffer);

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const results = { updated: 0, skipped: 0, failed: 0, errors: [] as any[] };

      let isAborted = false;
      req.on('close', () => {
        if (!res.writableEnded) {
          isAborted = true;
        }
      });

      const sendStatus = (type: string, payload: any) => {
        res.write(JSON.stringify({ type, ...payload }) + '\n');
      };

      const filteredData = data.filter(row => {
        const adm = String(row['Adm No'] ?? row['Admission Number'] ?? '').trim();
        return adm && adm !== 'undefined';
      });

      const totalRows = filteredData.length;
      sendStatus('start', { total: totalRows });

      for (const [index, row] of filteredData.entries()) {
        if (isAborted) break;

        let currentAdmNo = '';
        try {
          const admNo = String(row['Adm No'] ?? row['Admission Number'] ?? '').trim();
          currentAdmNo = admNo;

          const tBilledRaw = row['Transport Billed'] ?? row['TransportBilled'] ?? row['Charges'] ?? row['Billed'];
          const tPaidRaw = row['Transport Paid'] ?? row['TransportPaid'] ?? row['Paid'];
          const tBalRaw = row['Transport Balance'] ?? row['Bal'] ?? row['Balance'];
          if (!tBilledRaw) {
            results.skipped++;
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          const tBilled = parseFloat(String(tBilledRaw).replace(/,/g, '')) || 0;
          const tPaid = tPaidRaw ? (parseFloat(String(tPaidRaw).replace(/,/g, '')) || 0) : 0;
          const tBalDerived = tBalRaw ? (parseFloat(String(tBalRaw).replace(/,/g, '')) || 0) : Math.max(0, tBilled - tPaid);
          if (tBilled <= 0) {
            results.skipped++;
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          // Find learner — must be a transport student
          const learner = await prisma.learner.findUnique({
            where: { admissionNumber: admNo },
            select: { id: true, isTransportStudent: true, firstName: true, lastName: true }
          });

          if (!learner) {
            results.failed++;
            results.errors.push({ row: index + 2, admNo, error: 'Student not found' });
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          if (!learner.isTransportStudent) {
            // Auto-enroll them as transport students when transport fees are being imported
            await prisma.learner.update({
              where: { id: learner.id },
              data: { isTransportStudent: true }
            });
          }

          // Find the active invoice for this term
          const invoice = await prisma.feeInvoice.findFirst({
            where: {
              learnerId: learner.id,
              term: term as Term,
              academicYear: parseInt(academicYear),
              archived: false
            },
            orderBy: { createdAt: 'desc' }
          });

          if (!invoice) {
            results.failed++;
            results.errors.push({ row: index + 2, admNo, error: `No active invoice for ${term} ${academicYear}` });
            sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
            continue;
          }

          // Append/overwrite transport billed on the invoice
          await prisma.feeInvoice.update({
            where: { id: invoice.id },
            data: {
              transportBilled: tBilled,
              transportPaid: tPaid,
              transportBalance: tBalDerived
            }
          });

          results.updated++;
          sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });

        } catch (err: any) {
          results.failed++;
          results.errors.push({ row: index + 2, admNo: currentAdmNo, error: err.message });
          sendStatus('progress', { current: index + 1, total: totalRows, percent: Math.round(((index + 1) / totalRows) * 100) });
        }
      }

      sendStatus('complete', {
        summary: { totalRows: filteredData.length, ...results },
        errors: results.errors.slice(0, 50)
      });
      res.end();
    } catch (error: any) {
      console.error('Upload Transport Error:', error);
      if (!res.writableEnded) {
        res.write(JSON.stringify({ type: 'error', error: 'Failed to process transport import', details: error.message }) + '\n');
        res.end();
      }
    }
  }
);

export default router;
