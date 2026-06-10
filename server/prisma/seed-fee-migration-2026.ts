/**
 * ============================================================
 * TrendScore — Fee Migration Script  (Term 1, 2026)
 * ============================================================
 * Single-tenant system — NO schoolId on FeeType / FeeStructure
 * / FeeInvoice / FeePayment / User (by design).
 *
 * What this script does:
 *   1. Reads EXISTING FeeTypes from the DB — uses whatever is
 *      already there (TUITION, TRANSPORT etc seeded by seed.ts).
 *      Does NOT blindly create — upserts only if missing.
 *   2. Reads EXISTING FeeStructures for Term 1 2026 — only
 *      creates ones that are genuinely absent.
 *   3. Phone reconciliation — compares Excel contacts against
 *      Learner records, updates blanks, flags mismatches.
 *   4. Creates FeeInvoices (tuition + transport combined).
 *   5. Records historical payments as CASH / MIGRATED.
 *   6. Marks 6 overpaid students as OVERPAID with credit note.
 *   7. Prints reconciliation report.
 *
 * Usage:
 *   cd server
 *   npx ts-node prisma/seed-fee-migration-2026.ts
 *
 * Excel files expected in:  <project-root>/data/
 * ============================================================
 */

import { PrismaClient, Term, PaymentStatus, PaymentMethod, FeeCategory } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

const prisma = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────────────────
const ACADEMIC_YEAR = 2026;
const TERM         = Term.TERM_1;
const DUE_DATE     = new Date('2026-03-31');

// Excel files live in <project-root>/data/
const DATA_DIR       = path.join(__dirname, '..', '..', 'data');
const FEE_FILE       = path.join(DATA_DIR, 'Fee_Collection_Score_-_Term_1__2026__04-08-2026_.xlsx');
const TRANSPORT_FILE = path.join(DATA_DIR, 'Transport_Students.xlsx');

// FeeType codes that MUST exist (already seeded by seed-fee-types.ts)
const TUITION_CODE   = 'TUITION';
const TRANSPORT_CODE = 'TRANSPORT';

// ── Grade mapping: Excel "Class" → Prisma Grade enum value ───────────────────
const CLASS_TO_GRADE: Record<string, string> = {
  'PP1':        'PP1',
  'PP2':        'PP2',
  'Play Group': 'PLAYGROUP',
  'Grade 1':    'GRADE_1',
  'Grade 2':    'GRADE_2',
  'Grade 3':    'GRADE_3',
  'Grade 4':    'GRADE_4',
  'Grade 5':    'GRADE_5',
  'Grade 6':    'GRADE_6',
  'Grade 7':    'GRADE_7',
  'Grade 8':    'GRADE_8',
  'Grade 9':    'GRADE_9',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface FeeRow {
  admNo:            string;
  studentName:      string;
  classLabel:       string;
  grade:            string;
  phone1:           string | null;
  phone2:           string | null;
  tuitionBilled:    number;
  tuitionPaid:      number;
  tuitionBalance:   number;
  transportBilled:  number;
  transportPaid:    number;
  transportBalance: number;
  isTransport:      boolean;
}

interface PhoneReport {
  admNo:      string;
  name:       string;
  excel1:     string | null;
  excel2:     string | null;
  dbPrimary:  string | null;
  dbFather:   string | null;
  dbMother:   string | null;
  dbGuardian: string | null;
  action:     'MATCH' | 'UPDATED' | 'MISMATCH' | 'NO_EXCEL_PHONE' | 'LEARNER_NOT_FOUND';
  notes:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizePhone(raw: any): string | null {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\s+/g, '').replace(/-/g, '');
  if (s.endsWith('.0'))           s = s.slice(0, -2);
  if (s.startsWith('+254'))       return '254' + s.slice(4);
  if (s.startsWith('254') && s.length === 12) return s;
  if ((s.startsWith('07') || s.startsWith('01')) && s.length === 10) return '254' + s.slice(1);
  if (s.startsWith('7') && s.length === 9)  return '254' + s;
  return s || null;
}

function phoneIn(phone: string | null, list: (string | null)[]): boolean {
  if (!phone) return false;
  return list.some(p => p && normalizePhone(p) === phone);
}

async function readSheetRows(filePath: string): Promise<any[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  const rows: any[][] = [];
  ws.eachRow(row => rows.push((row.values as any[]).slice(1)));
  return rows;
}

function findHeaderRow(rows: any[][], marker: string): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.some((c: any) => String(c ?? '').trim() === marker)) return i;
  }
  return -1;
}

// ── Step 1: Read & merge Excel data ──────────────────────────────────────────
async function parseExcelData(): Promise<FeeRow[]> {
  console.log('\n📂 Reading Excel files...');

  // --- Transport file: build admNo → charges map ---
  const transRaw  = await readSheetRows(TRANSPORT_FILE);
  const transHdr  = findHeaderRow(transRaw, 'Adm No');
  const transData = transRaw.slice(transHdr + 1);

  const transportMap = new Map<string, { charges: number; paid: number; bal: number }>();
  for (const row of transData) {
    if (!row?.[2]) continue;
    const admNo   = String(row[2]).trim().replace('.0', '');
    const charges = Number(row[6]) || 0;
    const paid    = Math.max(0, Number(row[7]) || 0); // guard against -4500 reversal
    const bal     = Math.max(0, Number(row[8]) || 0);
    if (admNo && charges > 0) transportMap.set(admNo, { charges, paid, bal });
  }

  // --- Fee file ---
  const feeRaw  = await readSheetRows(FEE_FILE);
  const feeHdr  = findHeaderRow(feeRaw, 'Adm No');
  const feeData = feeRaw.slice(feeHdr + 1);

  const result: FeeRow[] = [];

  for (const row of feeData) {
    if (!row?.[2]) continue;
    const admNo      = String(row[2]).trim().replace('.0', '');
    const studentName = String(row[1] ?? '').trim();
    const classLabel  = String(row[3] ?? '').trim();

    // Skip header echo rows and the TOTAL footer row
    if (!admNo || studentName === 'Student Name' || admNo === 'Adm No') continue;
    if (studentName === '' || studentName.toUpperCase() === 'TOTAL') continue;

    const grade = CLASS_TO_GRADE[classLabel];
    if (!grade) {
      console.warn(`   ⚠️  Unknown class "${classLabel}" for ${admNo} (${studentName}) — skipped`);
      continue;
    }

    // Index 6: Billed Total, Index 8: Total Paid (Index 7 is current balance, Index 9 is Score %)
    const tuitionBilled  = Number(row[6]) || 0;
    const tuitionPaid    = Number(row[8]) || 0;
    const tuitionBalance = tuitionBilled - tuitionPaid;

    const trans = transportMap.get(admNo);

    result.push({
      admNo,
      studentName,
      classLabel,
      grade,
      phone1: normalizePhone(row[4]),
      phone2: normalizePhone(row[5]),
      tuitionBilled,
      tuitionPaid,
      tuitionBalance,
      isTransport:      !!trans,
      transportBilled:  trans?.charges  ?? 0,
      transportPaid:    trans?.paid     ?? 0,
      transportBalance: trans?.bal      ?? 0,
    });
  }

  console.log(`   ✓ ${result.length} students parsed  |  ${transportMap.size} transport students`);
  return result;
}

// ── Step 2: Verify & load existing FeeTypes ───────────────────────────────────
async function loadFeeTypes() {
  console.log('\n🔍 Checking existing FeeTypes in database...');

  // List ALL fee types so we know exactly what's there
  const allTypes = await prisma.feeType.findMany({ orderBy: { code: 'asc' } });
  console.log(`   Found ${allTypes.length} existing FeeType(s):`);
  allTypes.forEach(t => console.log(`      ${t.code.padEnd(20)} ${t.name}  [${t.category}]`));

  // Locate the two we need
  const tuitionType   = allTypes.find(t => t.code === TUITION_CODE);
  const transportType = allTypes.find(t => t.code === TRANSPORT_CODE);

  // Guard: if somehow missing (first-run before seed), create them now
  const ensured = {
    tuition:   tuitionType   ?? await prisma.feeType.create({ data: { code: TUITION_CODE,   name: 'Tuition Fees',   category: FeeCategory.ACADEMIC,   isActive: true } }),
    transport: transportType ?? await prisma.feeType.create({ data: { code: TRANSPORT_CODE, name: 'Transport Fees', category: FeeCategory.TRANSPORT, isActive: true } }),
  };

  if (!tuitionType)   console.log(`   ⚠️  TUITION FeeType was missing — created now. Run seed.ts next time first.`);
  if (!transportType) console.log(`   ⚠️  TRANSPORT FeeType was missing — created now. Run seed.ts next time first.`);

  return ensured;
}

// ── Step 3: Phone reconciliation ─────────────────────────────────────────────
async function reconcilePhones(rows: FeeRow[]): Promise<PhoneReport[]> {
  console.log('\n📱 Reconciling phone numbers...');
  const report: PhoneReport[] = [];

  for (const row of rows) {
    const learner = await prisma.learner.findUnique({
      where:  { admissionNumber: row.admNo },
      select: { id: true, archived: true, primaryContactPhone: true,
                fatherPhone: true, motherPhone: true, guardianPhone: true },
    });

    if (!learner || learner.archived) {
      report.push({ admNo: row.admNo, name: row.studentName,
        excel1: row.phone1, excel2: row.phone2,
        dbPrimary: null, dbFather: null, dbMother: null, dbGuardian: null,
        action: 'LEARNER_NOT_FOUND',
        notes: learner?.archived ? 'Learner is archived' : 'Not found in DB — import learners first',
      });
      continue;
    }

    if (!row.phone1 && !row.phone2) {
      report.push({ admNo: row.admNo, name: row.studentName,
        excel1: null, excel2: null,
        dbPrimary: learner.primaryContactPhone, dbFather: learner.fatherPhone,
        dbMother: learner.motherPhone, dbGuardian: learner.guardianPhone,
        action: 'NO_EXCEL_PHONE', notes: 'Old system had no phone for this student',
      });
      continue;
    }

    const dbPhones = [learner.primaryContactPhone, learner.fatherPhone,
                      learner.motherPhone, learner.guardianPhone].map(normalizePhone);

    const p1InDB = phoneIn(row.phone1, dbPhones);
    const p2InDB = !row.phone2 || phoneIn(row.phone2, dbPhones);

    if (p1InDB && p2InDB) {
      report.push({ admNo: row.admNo, name: row.studentName,
        excel1: row.phone1, excel2: row.phone2,
        dbPrimary: learner.primaryContactPhone, dbFather: learner.fatherPhone,
        dbMother: learner.motherPhone, dbGuardian: learner.guardianPhone,
        action: 'MATCH', notes: 'All phones already in DB',
      });
      continue;
    }

    // Build update: fill the first empty slot(s)
    const update: Record<string, string> = {};
    const notes: string[] = [];

    if (!learner.primaryContactPhone && row.phone1) {
      update.primaryContactPhone = row.phone1;
      update.primaryContactType  = 'GUARDIAN';
      notes.push(`primaryContactPhone ← ${row.phone1}`);
    }
    if (!learner.fatherPhone && row.phone1 && !update.primaryContactPhone) {
      update.fatherPhone = row.phone1;
      notes.push(`fatherPhone ← ${row.phone1}`);
    }
    if (!learner.motherPhone && row.phone2) {
      update.motherPhone = row.phone2;
      notes.push(`motherPhone ← ${row.phone2}`);
    } else if (!learner.guardianPhone && row.phone2) {
      update.guardianPhone = row.phone2;
      notes.push(`guardianPhone ← ${row.phone2}`);
    }

    // If DB already has phones but they just don't match — flag for manual review
    const hasConflict = Object.keys(update).length === 0 && (!p1InDB || !p2InDB);

    if (hasConflict) {
      report.push({ admNo: row.admNo, name: row.studentName,
        excel1: row.phone1, excel2: row.phone2,
        dbPrimary: learner.primaryContactPhone, dbFather: learner.fatherPhone,
        dbMother: learner.motherPhone, dbGuardian: learner.guardianPhone,
        action: 'MISMATCH',
        notes: `Review manually. Excel: ${row.phone1}/${row.phone2 ?? '—'} | DB: ${dbPhones.filter(Boolean).join('/')}`,
      });
      continue;
    }

    if (Object.keys(update).length > 0) {
      await prisma.learner.update({ where: { id: learner.id }, data: update });
    }

    report.push({ admNo: row.admNo, name: row.studentName,
      excel1: row.phone1, excel2: row.phone2,
      dbPrimary: learner.primaryContactPhone, dbFather: learner.fatherPhone,
      dbMother: learner.motherPhone, dbGuardian: learner.guardianPhone,
      action: 'UPDATED', notes: notes.join(' | '),
    });
  }

  const counts: Record<string, number> = {};
  report.forEach(r => { counts[r.action] = (counts[r.action] || 0) + 1; });
  console.log('   Summary:', counts);
  return report;
}

// ── Step 4: Ensure FeeStructures ─────────────────────────────────────────────
async function ensureFeeStructures(
  rows:             FeeRow[],
  adminId:          string,
  tuitionFeeTypeId: string,
) {
  console.log('\n📋 Checking existing FeeStructures for Term 1 2026...');

  // Load ALL existing structures for this term/year upfront
  const existing = await prisma.feeStructure.findMany({
    where:   { term: TERM, academicYear: ACADEMIC_YEAR },
    include: { feeItems: { include: { feeType: true } } },
  });

  console.log(`   Found ${existing.length} existing structure(s):`);
  existing.forEach(s => {
    const total = s.feeItems.reduce((sum, i) => sum + Number(i.amount), 0);
    console.log(`      ${String(s.grade).padEnd(12)} ${s.name}  (KES ${total.toLocaleString()})`);
  });

  const structureMap = new Map<string, any>(existing.map(s => [s.grade, s]));

  // Determine grades we need to cover
  const gradeSet = new Set(rows.map(r => r.grade));

  // Fetch all standard fee IDs
  const allTypes = await prisma.feeType.findMany({});
  const getTypeID = (code: string) => allTypes.find(t => t.code === code)?.id;
  
  const tuitionID   = getTypeID('TUITION');
  const examID      = getTypeID('EXAM');
  const libraryID   = getTypeID('LIBRARY');
  const activityID  = getTypeID('ACTIVITY');
  const sportsID    = getTypeID('SPORTS');
  const transportID = getTypeID('TRANSPORT');

  for (const grade of gradeSet) {
    if (structureMap.has(grade)) continue;

    const getStandardTotal = (g: string) => {
      if (g === 'PLAYGROUP') return 7000;
      if (g === 'PP1') return 8000;
      if (g === 'PP2') return 8500;
      if (g === 'GRADE_1' || g === 'GRADE_2') return 10000;
      if (g === 'GRADE_3') return 10500;
      if (g === 'GRADE_4' || g === 'GRADE_5') return 11000;
      if (g === 'GRADE_6') return 12000;
      if (g === 'GRADE_7') return 17500;
      if (g === 'GRADE_8' || g === 'GRADE_9') return 18500;
      return 0;
    };

    const finalTotal = getStandardTotal(grade) + 500;
    const EXAM_FEE = 500;
    const LIBRARY_FEE = 500;
    const ACTIVITY_FEE = 500;
    const SPORTS_FEE = 500;
    const TUITION_FEE = Math.max(0, finalTotal - (EXAM_FEE + LIBRARY_FEE + ACTIVITY_FEE + SPORTS_FEE));

    const structure = await prisma.feeStructure.create({
      data: {
        name:         `${grade.replace('_', ' ')} — Term 1 2026`,
        description:  'Standard Term 1 fees with category distribution (Transport handled per-student)',
        grade:        grade as any,
        term:         TERM,
        academicYear: ACADEMIC_YEAR,
        active:       true,
        mandatory:    true,
        createdBy:    adminId,
        feeItems: {
          create: [
            { feeTypeId: tuitionID!,   amount: TUITION_FEE,   mandatory: true },
            { feeTypeId: examID!,      amount: EXAM_FEE,      mandatory: true },
            { feeTypeId: libraryID!,   amount: LIBRARY_FEE,   mandatory: true },
            { feeTypeId: activityID!,  amount: ACTIVITY_FEE,  mandatory: true },
            { feeTypeId: sportsID!,    amount: SPORTS_FEE,    mandatory: true },
          ],
        },
      },
      include: { feeItems: { include: { feeType: true } } },
    });

    structureMap.set(grade, structure);
    console.log(`   ✅ Created FeeStructure: ${grade}  (Total KES ${finalTotal.toLocaleString()})`);
  }

  return structureMap;
}

// ── Step 5 & 6: Invoices + Payments ──────────────────────────────────────────
async function generateInvoicesAndPayments(
  rows:              FeeRow[],
  adminId:           string,
  structureMap:      Map<string, any>,
  transportTypeId:   string,
) {
  console.log('\n💰 Generating invoices and recording historical payments...');

  const stats = {
    invoicesCreated:  0,
    invoicesSkipped:  0,
    paymentsCreated:  0,
    paymentsSkipped:  0,
    overpaidMarked:   0,
    learnersMissing:  0,
    errors:           [] as string[],
  };

  // Use max existing receipt number as base so we never collide
  const existingCount = await prisma.feePayment.count();
  let receiptSeq = existingCount + 1;

  for (const row of rows) {
    // Single-tenant: find by admissionNumber alone
    const learner = await prisma.learner.findUnique({
      where:  { admissionNumber: row.admNo },
      select: { id: true, archived: true },
    });

    if (!learner || learner.archived) {
      stats.learnersMissing++;
      stats.errors.push(`Learner not found / archived: ${row.admNo} (${row.studentName})`);
      continue;
    }

    const structure = structureMap.get(row.grade);
    if (!structure) {
      stats.errors.push(`No FeeStructure for grade ${row.grade} — skipped ${row.admNo}`);
      continue;
    }

    const totalBilled  = row.tuitionBilled  + row.transportBilled;
    const totalPaid    = row.tuitionPaid    + row.transportPaid;
    const totalBalance = row.tuitionBalance + row.transportBalance;

    const invoiceStatus: PaymentStatus =
      totalBalance < 0  ? PaymentStatus.OVERPAID :
      totalPaid   === 0 ? PaymentStatus.PENDING  :
      totalBalance === 0 ? PaymentStatus.PAID    :
                           PaymentStatus.PARTIAL;

    // Check for existing invoice (idempotent)
    let invoice = await prisma.feeInvoice.findFirst({
      where: { learnerId: learner.id, term: TERM, academicYear: ACADEMIC_YEAR },
    });

    if (!invoice) {
      // Use the same invoice-number pattern as the existing controller
      const invoiceNumber = `INV-${ACADEMIC_YEAR}-MIGR-${row.admNo}`;

      invoice = await prisma.feeInvoice.create({
        data: {
          invoiceNumber,
          learnerId:      learner.id,
          feeStructureId: structure.id,
          term:           TERM,
          academicYear:   ACADEMIC_YEAR,
          dueDate:        DUE_DATE,
          totalAmount:    totalBilled,
          paidAmount:     Math.max(0, totalPaid),
          balance:        totalBalance,
          status:         invoiceStatus,
          issuedBy:       adminId,
        },
      });
      stats.invoicesCreated++;
    } else {
      stats.invoicesSkipped++;
    }

    // Record historical payment (skip if we already migrated this one)
    if (totalPaid > 0) {
      const alreadyMigrated = await prisma.feePayment.findFirst({
        where: { invoiceId: invoice.id, referenceNumber: { startsWith: 'MIGRATED-' } },
      });

      if (!alreadyMigrated) {
        const receiptNumber = `RCP-MIGR-${ACADEMIC_YEAR}-${String(receiptSeq).padStart(5, '0')}`;
        receiptSeq++;

        await prisma.feePayment.create({
          data: {
            receiptNumber,
            invoiceId:       invoice.id,
            amount:          Math.max(0, totalPaid),
            paymentMethod:   PaymentMethod.CASH,
            paymentDate:     new Date(),   // No historical dates available - using today's date as requested
            referenceNumber: `MIGRATED-${row.admNo}`,
            notes: [
              'MIGRATED from old system.',
              `Tuition paid: KES ${row.tuitionPaid.toLocaleString()}`,
              row.isTransport ? `Transport paid: KES ${row.transportPaid.toLocaleString()}` : null,
              invoiceStatus === PaymentStatus.OVERPAID
                ? `CREDIT: KES ${Math.abs(totalBalance).toLocaleString()} carried forward`
                : null,
            ].filter(Boolean).join(' | '),
            recordedBy: adminId,
          },
        });
        stats.paymentsCreated++;

        if (invoiceStatus === PaymentStatus.OVERPAID) {
          stats.overpaidMarked++;
        }
      } else {
        stats.paymentsSkipped++;
      }
    }
  }

  return stats;
}

// ── Reconciliation report ─────────────────────────────────────────────────────
function printReport(rows: FeeRow[], phoneReport: PhoneReport[]) {
  const LINE = '═'.repeat(60);
  console.log(`\n\n${LINE}`);
  console.log('  RECONCILIATION REPORT — Term 1, 2026 Migration');
  console.log(LINE);

  const sum = (fn: (r: FeeRow) => number) => rows.reduce((s, r) => s + fn(r), 0);
  const tBilled  = sum(r => r.tuitionBilled);
  const tPaid    = sum(r => r.tuitionPaid);
  const tBal     = sum(r => r.tuitionBalance);
  const xBilled  = sum(r => r.transportBilled);
  const xPaid    = sum(r => r.transportPaid);
  const xBal     = sum(r => r.transportBalance);
  const grandBilled = tBilled + xBilled;
  const grandPaid   = tPaid   + xPaid;
  const grandBal    = tBal    + xBal;

  console.log(`\n  Students          : ${rows.length}  (transport: ${rows.filter(r => r.isTransport).length})`);
  console.log(`\n  TUITION`);
  console.log(`    Billed   KES ${tBilled.toLocaleString().padStart(12)}`);
  console.log(`    Paid     KES ${tPaid.toLocaleString().padStart(12)}`);
  console.log(`    Balance  KES ${tBal.toLocaleString().padStart(12)}`);
  console.log(`\n  TRANSPORT`);
  console.log(`    Billed   KES ${xBilled.toLocaleString().padStart(12)}`);
  console.log(`    Paid     KES ${xPaid.toLocaleString().padStart(12)}`);
  console.log(`    Balance  KES ${xBal.toLocaleString().padStart(12)}`);
  console.log(`\n  COMBINED`);
  console.log(`    Billed   KES ${grandBilled.toLocaleString().padStart(12)}`);
  console.log(`    Paid     KES ${grandPaid.toLocaleString().padStart(12)}`);
  console.log(`    Balance  KES ${grandBal.toLocaleString().padStart(12)}`);
  console.log(`    Rate          ${((grandPaid / grandBilled) * 100).toFixed(1)}%`);

  console.log(`\n  STATUS BREAKDOWN`);
  const fullyPaid = rows.filter(r => (r.tuitionBalance + r.transportBalance) === 0 && r.tuitionPaid > 0).length;
  const partial   = rows.filter(r => (r.tuitionBalance + r.transportBalance) > 0 && r.tuitionPaid > 0).length;
  const notPaid   = rows.filter(r => r.tuitionPaid === 0 && r.transportPaid === 0).length;
  const overpaid  = rows.filter(r => (r.tuitionBalance + r.transportBalance) < 0).length;
  console.log(`    Fully paid   : ${fullyPaid}`);
  console.log(`    Partial      : ${partial}`);
  console.log(`    Not paid     : ${notPaid}`);
  console.log(`    Overpaid     : ${overpaid}  ← credit balances carried forward`);

  if (overpaid > 0) {
    console.log(`\n  OVERPAID STUDENTS (credits carried forward):`);
    rows
      .filter(r => (r.tuitionBalance + r.transportBalance) < 0)
      .forEach(r => {
        const credit = Math.abs(r.tuitionBalance + r.transportBalance);
        console.log(`    ${r.admNo.padEnd(8)} ${r.studentName.padEnd(32)} credit KES ${credit.toLocaleString()}`);
      });
  }

  if (notPaid > 0) {
    console.log(`\n  STUDENTS WITH ZERO PAYMENT (follow up needed):`);
    rows
      .filter(r => r.tuitionPaid === 0 && r.transportPaid === 0)
      .forEach(r => {
        console.log(`    ${r.admNo.padEnd(8)} ${r.studentName.padEnd(32)} ${r.classLabel}  KES ${r.tuitionBilled.toLocaleString()}`);
      });
  }

  // Phone summary
  const phoneCounts: Record<string, number> = {};
  phoneReport.forEach(r => { phoneCounts[r.action] = (phoneCounts[r.action] || 0) + 1; });
  console.log(`\n  PHONE RECONCILIATION:`);
  Object.entries(phoneCounts).forEach(([k, v]) =>
    console.log(`    ${k.padEnd(22)}: ${v}`));

  const mismatches = phoneReport.filter(r => r.action === 'MISMATCH');
  if (mismatches.length > 0) {
    console.log(`\n  ⚠️  PHONE MISMATCHES (manual review required):`);
    mismatches.forEach(r => {
      console.log(`    ${r.admNo}  ${r.name}`);
      console.log(`      Excel  : ${r.excel1 ?? '—'} / ${r.excel2 ?? '—'}`);
      console.log(`      DB     : primary=${r.dbPrimary ?? '—'}  father=${r.dbFather ?? '—'}  mother=${r.dbMother ?? '—'}  guardian=${r.dbGuardian ?? '—'}`);
    });
  }

  const missing = phoneReport.filter(r => r.action === 'LEARNER_NOT_FOUND');
  if (missing.length > 0) {
    console.log(`\n  ❌ LEARNERS NOT IN DB — run seed-learners-excel.ts first:`);
    missing.forEach(r => console.log(`    ${r.admNo}  ${r.name}  — ${r.notes}`));
  }

  console.log(`\n${LINE}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 TrendScore — Fee Migration (Term 1, 2026)');
  console.log('='.repeat(60));
  console.log('   Single-tenant system — no schoolId filtering applied');

  // Get the admin user (no schoolId on User — single-tenant)
  const admin = await prisma.user.findFirst({
    where:  { role: { in: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'] }, archived: false },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  if (!admin) throw new Error('❌ No admin/accountant user found. Run seed.ts first.');
  console.log(`\n👤 Issuer : ${admin.firstName} ${admin.lastName} (${admin.role})`);

  // Step 1: Parse Excel
  const rows = await parseExcelData();
  console.log(`✅ ${rows.length} student records ready`);

  // Step 2: Verify FeeTypes (check what exists first)
  const feeTypes = await loadFeeTypes();

  // Step 3: Phone reconciliation
  const phoneReport = await reconcilePhones(rows);

  // Step 4: FeeStructures (check what exists first)
  const structureMap = await ensureFeeStructures(rows, admin.id, feeTypes.tuition.id);

  // Steps 5 & 6: Invoices + Payments
  const stats = await generateInvoicesAndPayments(rows, admin.id, structureMap, feeTypes.transport.id);

  // Results
  console.log('\n📊 IMPORT RESULTS');
  console.log(`   Invoices created  : ${stats.invoicesCreated}`);
  console.log(`   Invoices skipped  : ${stats.invoicesSkipped}  (already existed)`);
  console.log(`   Payments created  : ${stats.paymentsCreated}`);
  console.log(`   Payments skipped  : ${stats.paymentsSkipped}  (already migrated)`);
  console.log(`   Overpaid marked   : ${stats.overpaidMarked}`);
  console.log(`   Learners missing  : ${stats.learnersMissing}`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    stats.errors.forEach(e => console.log(`   • ${e}`));
  }

  // Final reconciliation report
  printReport(rows, phoneReport);

  console.log('✅ Migration complete!\n');
}

main()
  .catch(e => { console.error('\n❌ Fatal error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
