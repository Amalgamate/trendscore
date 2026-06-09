import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { rateLimit } from '../../middleware/enhanced-rateLimit.middleware';
import { auditLog } from '../../middleware/permissions.middleware';
import { hasAnyRole } from '../../utils/roleNormalizer';
import { ApiError } from '../../utils/error.util';

import prisma from '../../config/database';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { Readable } from 'stream';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { ensureStudentAccountForLearner } from '../../services/studentAccount.service';
import { generateAdmissionNumber } from '../../services/admissionNumber.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const learnerSchema = z.object({
  'Learner Name': z.string().optional(),
  'Leaner Name': z.string().optional(),
  'Name': z.string().optional(),
  'Adm No': z.string().optional(),
  'Class': z.string().min(1, 'Class is required'),
  'Stream': z.string().optional(),
  'Term': z.string().optional(),
  'Year': z.string().optional(),
  'Gender': z.string().optional(),
  'DOB': z.string().optional(),
  'Date of Birth': z.string().optional(),
  'Parent/Guardian': z.string().optional(),
  'Phone 1': z.string().optional(),
  'Phone 2': z.string().optional(),
  'Reg Date': z.string().optional(),
  'Bal Due': z.string().optional(),
}).refine(data => data['Learner Name'] || data['Leaner Name'] || data['Name'], {
  message: "Learner Name is required",
  path: ['Learner Name']
});

type ParsedUploadRow = {
  line: number;
  data: Record<string, any>;
};

const HEADER_ALIASES: Record<string, string> = {
  LEARNERNAME: 'Learner Name',
  LEANERNAME: 'Learner Name',
  STUDENTNAME: 'Learner Name',
  PUPILNAME: 'Learner Name',
  FULLNAME: 'Learner Name',
  NAME: 'Learner Name',
  ADMISSIONNO: 'Adm No',
  ADMISSIONNUMBER: 'Adm No',
  ADMNO: 'Adm No',
  ADMNUMBER: 'Adm No',
  ADMISSION: 'Adm No',
  ADM: 'Adm No',
  CLASS: 'Class',
  GRADE: 'Class',
  GRADECLASS: 'Class',
  LEVEL: 'Class',
  STREAM: 'Stream',
  TERM: 'Term',
  YEAR: 'Year',
  GENDER: 'Gender',
  SEX: 'Gender',
  DOB: 'DOB',
  DATEOFBIRTH: 'Date of Birth',
  BIRTHDATE: 'Date of Birth',
  PARENTGUARDIAN: 'Parent/Guardian',
  GUARDIAN: 'Parent/Guardian',
  PARENT: 'Parent/Guardian',
  PARENTNAME: 'Parent/Guardian',
  GUARDIANNAME: 'Parent/Guardian',
  PHONE1: 'Phone 1',
  PHONE: 'Phone 1',
  PHONENO: 'Phone 1',
  PHONENUMBER: 'Phone 1',
  CONTACT: 'Phone 1',
  CONTACTNO: 'Phone 1',
  PHONE2: 'Phone 2',
  ALTERNATEPHONE: 'Phone 2',
  REGDATE: 'Reg Date',
  REGISTRATIONDATE: 'Reg Date',
  ADMISSIONDATE: 'Reg Date',
  BALDUE: 'Bal Due',
  BALANCE: 'Bal Due',
};

function normalizeCellValue(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeHeaderKey(key: any): string {
  return normalizeCellValue(key).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function canonicalHeaderName(key: any): string {
  const normalized = normalizeHeaderKey(key);
  return HEADER_ALIASES[normalized] || normalizeCellValue(key);
}

function normalizeUploadRow(row: Record<string, any>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row || {})) {
    const canonicalKey = canonicalHeaderName(key);
    if (!canonicalKey || canonicalKey.startsWith('__EMPTY')) continue;
    const normalizedValue = normalizeCellValue(value);
    if (normalized[canonicalKey] === undefined || normalized[canonicalKey] === '') {
      normalized[canonicalKey] = normalizedValue;
    }
  }
  return normalized;
}

function isKnownHeaderCell(value: any): boolean {
  return Boolean(HEADER_ALIASES[normalizeHeaderKey(value)]);
}

function findHeaderRowIndex(rows: any[][]): number {
  return rows.findIndex((row) => {
    const knownHeaders = row.filter(isKnownHeaderCell).map(canonicalHeaderName);
    return (
      knownHeaders.includes('Learner Name') &&
      (knownHeaders.includes('Class') || knownHeaders.includes('Adm No') || knownHeaders.includes('Year'))
    );
  });
}

function isEmptyExcelRow(row: any[]): boolean {
  return row.every((cell) => normalizeCellValue(cell) === '');
}

function isSectionRow(row: any[]): boolean {
  const populatedCells = row.filter((cell) => normalizeCellValue(cell) !== '');
  if (populatedCells.length !== 1) return false;
  return /GRADE|CLASS|PLAYGROUP|PP1|PP2/i.test(normalizeCellValue(populatedCells[0]));
}

function rowToRecord(headers: string[], values: any[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    if (!header) return;
    const value = normalizeCellValue(values[index]);
    if (record[header] === undefined || record[header] === '') {
      record[header] = value;
    }
  });
  return normalizeUploadRow(record);
}

function shouldSkipParsedRow(row: Record<string, any>): boolean {
  const learnerName = normalizeCellValue(row['Learner Name'] || row['Leaner Name'] || row['Name']);
  const learnerClass = normalizeCellValue(row['Class']);
  return learnerName === '' && learnerClass === '';
}

function isExcelUpload(file: Express.Multer.File): boolean {
  const name = String(file.originalname || '').toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel'
  );
}

async function parseUploadRows(file: Express.Multer.File): Promise<ParsedUploadRow[]> {
  if (isExcelUpload(file)) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];

    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[firstSheetName], {
      header: 1,
      defval: '',
      raw: false,
    });
    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex === -1) return [];

    const headers = rows[headerRowIndex].map(canonicalHeaderName);
    return rows
      .slice(headerRowIndex + 1)
      .map((row, index) => ({
        line: headerRowIndex + index + 2,
        data: rowToRecord(headers, row),
      }))
      .filter((row) => !isEmptyExcelRow(Object.values(row.data)) && !isSectionRow(Object.values(row.data)));
  }

  const rows: ParsedUploadRow[] = [];
  let lineNumber = 1;
  const stream = Readable.from(file.buffer.toString());

  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(csvParser())
      .on('data', (data) => {
        lineNumber++;
        rows.push({
          line: lineNumber,
          data: normalizeUploadRow(data),
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return rows;
}

async function generateBulkAdmissionNumber(stream: string, academicYear: number): Promise<string> {
  try {
    return await generateAdmissionNumber(stream || 'A', academicYear);
  } catch (error: any) {
    // Bulk imports must still work when school settings are in manual mode.
    // Use a deterministic fallback and check uniqueness before returning.
    let seq = await prisma.learner.count();
    while (true) {
      seq += 1;
      const candidate = `ADM-${academicYear}-${String(seq).padStart(4, '0')}`;
      const exists = await prisma.learner.findUnique({ where: { admissionNumber: candidate } });
      if (!exists) return candidate;
    }
  }
}

/**
 * Normalise a raw class/grade string from a CSV into a Prisma Grade enum value.
 * Handles variants like "Play Group", "PLAY GROUP", "Playgroup", "PLAYGROUP",
 * "Grade 1", "GRADE 1", "GRADE_1", "1", "PP1", "PP2", etc.
 */
function resolveGrade(raw: string): string {
  // Strip all spaces and underscores, uppercase — gives a canonical token
  const normalised = raw.toUpperCase().replace(/[\s_]+/g, '');

  const gradeMap: { [key: string]: string } = {
    // Playgroup — all spacing variants collapse to PLAYGROUP
    'PLAYGROUP': 'PLAYGROUP',
    'PLAYGRP':   'PLAYGROUP',
    'PG':        'PLAYGROUP',
    // Pre-primary
    'PP1': 'PP1',
    'PP2': 'PP2',
    // Grade 1–9 (with or without the word GRADE)
    'GRADE1': 'GRADE_1', 'GRADE2': 'GRADE_2', 'GRADE3': 'GRADE_3',
    'GRADE4': 'GRADE_4', 'GRADE5': 'GRADE_5', 'GRADE6': 'GRADE_6',
    'GRADE7': 'GRADE_7', 'GRADE8': 'GRADE_8', 'GRADE9': 'GRADE_9',
    'GRADE_1': 'GRADE_1', 'GRADE_2': 'GRADE_2', 'GRADE_3': 'GRADE_3',
    'GRADE_4': 'GRADE_4', 'GRADE_5': 'GRADE_5', 'GRADE_6': 'GRADE_6',
    'GRADE_7': 'GRADE_7', 'GRADE_8': 'GRADE_8', 'GRADE_9': 'GRADE_9',
    '1': 'GRADE_1', '2': 'GRADE_2', '3': 'GRADE_3', '4': 'GRADE_4',
    '5': 'GRADE_5', '6': 'GRADE_6', '7': 'GRADE_7', '8': 'GRADE_8',
    '9': 'GRADE_9',
  };

  if (gradeMap[normalised]) return gradeMap[normalised];

  // Fuzzy fallback: find first key contained in the normalised string
  const match = Object.keys(gradeMap).find(k => normalised.includes(k));
  if (match) return gradeMap[match];

  return 'GRADE_1'; // absolute last resort
}

/**
 * POST /api/bulk/learners/upload
 */
router.post(
  '/upload',
  upload.single('file'),
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('BULK_UPLOAD_LEARNERS'),
  async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const forceCreate = req.query.forceCreate === 'true';

    const results: any[] = [];
    const errors: any[] = [];
    const parsedRows = await parseUploadRows(req.file);
    const importRows = parsedRows.filter((row) => !shouldSkipParsedRow(row.data));
    const skippedRows = parsedRows.length - importRows.length;

    for (const row of importRows) {
      try {
        const validated = learnerSchema.parse(row.data);
        results.push({
          line: row.line,
          data: validated,
          valid: true
        });
      } catch (error) {
        errors.push({
          line: row.line,
          data: row.data,
          error: error instanceof z.ZodError ? error.errors : 'Validation failed',
          valid: false
        });
      }
    }

    const created: any[] = [];
    const updated: any[] = [];
    const failed: any[] = [];
    let studentAccountsCreated = 0;

    for (const item of results) {
      try {
        const csvData = item.data;
        const grade = resolveGrade((csvData['Class'] || '').toString());
        const academicYear = Number.parseInt(String(csvData['Year'] || ''), 10) || new Date().getFullYear();
        const streamCode = csvData['Stream'] || 'A';
        const providedAdmNo = String(csvData['Adm No'] || '').trim();
        const admNo = providedAdmNo || await generateBulkAdmissionNumber(streamCode, academicYear);

        const rawName = csvData['Learner Name'] || csvData['Leaner Name'] || csvData['Name'] || '';
        const nameParts = rawName.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Student';

        let parentId: string | undefined;
        const parentName = csvData['Parent/Guardian'];
        const parentPhone = csvData['Phone 1'] ? String(csvData['Phone 1']).trim() : null;

        if (parentPhone) {
          const existingParent = await prisma.user.findFirst({
            where: { phone: parentPhone, role: 'PARENT' }
          });

          if (existingParent) {
            parentId = existingParent.id;
          } else if (parentName) {
            const pNameParts = parentName.trim().split(' ');
            const pFirstName = pNameParts[0] || 'Parent';
            const pLastName = pNameParts.slice(1).join(' ') || 'Guardian';
            const cleanPhone = parentPhone.replace(/\D/g, '');
            const email = `parent.${cleanPhone || Math.random().toString(36).substring(7)}@edu-core.test`;

            const bcrypt = await import('bcrypt');
            const hashedPassword = await bcrypt.hash('Parent@123', 10);

            const newParent = await prisma.user.create({
              data: {
                email,
                password: hashedPassword,
                firstName: pFirstName,
                lastName: pLastName,
                phone: parentPhone,
                role: 'PARENT',
                status: 'ACTIVE',
              }
            });
            parentId = newParent.id;
          }
        }

        let admissionDate = new Date();
        if (csvData['Reg Date']) {
          const dateParts = csvData['Reg Date'].split('/');
          if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const year = parseInt(dateParts[2], 10);
            const parsedDate = new Date(year, month, day);
            if (!isNaN(parsedDate.getTime())) admissionDate = parsedDate;
          }
        }

        let gender: any = 'MALE';
        const rawGender = (csvData['Gender'] || '').toUpperCase().trim();
        if (rawGender.startsWith('F')) gender = 'FEMALE';
        else if (rawGender.startsWith('M')) gender = 'MALE';
        else if (rawGender.startsWith('O')) gender = 'OTHER';

        let dob = new Date(2010, 0, 1);
        const rawDob = csvData['DOB'] || csvData['Date of Birth'];
        if (rawDob) {
          const parsedDob = new Date(rawDob);
          if (!isNaN(parsedDob.getTime())) dob = parsedDob;
        }

        const existing = await prisma.learner.findUnique({
          where: { admissionNumber: admNo }
        });

        if (existing) {
          if (forceCreate) {
            await prisma.learner.delete({ where: { id: existing.id } });
            const learner = await prisma.learner.create({
              data: {
                admissionNumber: admNo,
                firstName,
                lastName,
                dateOfBirth: dob,
                gender: gender,
                grade,
                stream: streamCode,
                status: 'ACTIVE',
                admissionDate,
                guardianName: csvData['Parent/Guardian'] || undefined,
                guardianPhone: csvData['Phone 1'] || undefined,
                parentId: parentId,
              }
            });
            const studentAccount = await ensureStudentAccountForLearner({
              admissionNumber: learner.admissionNumber,
              firstName: learner.firstName,
              lastName: learner.lastName,
              middleName: learner.middleName || null,
              phone: (learner.guardianPhone || null) as string | null
            });
            if (studentAccount.created) studentAccountsCreated += 1;
            created.push({ line: item.line, id: learner.id, admNo, name: rawName });
          } else {
            const updatedLearner = await prisma.learner.update({
              where: { id: existing.id },
              data: {
                firstName,
                lastName,
                grade,
                stream: csvData['Stream'] || undefined,
                gender: gender,
                dateOfBirth: dob,
                parentId: parentId,
                guardianName: csvData['Parent/Guardian'] || undefined,
                guardianPhone: csvData['Phone 1'] || undefined,
              }
            });
            const studentAccount = await ensureStudentAccountForLearner({
              admissionNumber: updatedLearner.admissionNumber,
              firstName: updatedLearner.firstName,
              lastName: updatedLearner.lastName,
              middleName: updatedLearner.middleName || null,
              phone: (updatedLearner.guardianPhone || null) as string | null
            });
            if (studentAccount.created) studentAccountsCreated += 1;
            updated.push({ line: item.line, id: existing.id, admNo, name: rawName });
          }
        } else {
          const learner = await prisma.learner.create({
            data: {
              admissionNumber: admNo,
              firstName,
              lastName,
              dateOfBirth: dob,
              gender: gender,
              grade,
              stream: streamCode,
              status: 'ACTIVE',
              admissionDate,
              guardianName: csvData['Parent/Guardian'] || undefined,
              guardianPhone: csvData['Phone 1'] || undefined,
              parentId: parentId,
            }
          });
          const studentAccount = await ensureStudentAccountForLearner({
            admissionNumber: learner.admissionNumber,
            firstName: learner.firstName,
            lastName: learner.lastName,
            middleName: learner.middleName || null,
            phone: (learner.guardianPhone || null) as string | null
          });
          if (studentAccount.created) studentAccountsCreated += 1;
          created.push({ line: item.line, id: learner.id, admNo, name: rawName });
        }
      } catch (error) {
        failed.push({
          line: item.line,
          admNo: item.data['Adm No'],
          name: item.data['Learner Name'] || item.data['Leaner Name'],
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: importRows.length,
        processed: results.length,
        created: created.length,
        updated: updated.length,
        studentAccountsCreated,
        skipped: skippedRows,
        failed: failed.length + errors.length,
        validationErrors: errors.length
      },
      details: { created, updated, failed, validationErrors: errors }
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to process upload', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/bulk/learners/sync-student-users
 * Backfill student system accounts for existing learners missing accounts.
 */
router.post(
  '/sync-student-users',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SYNC_STUDENT_USERS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!hasAnyRole(req.user as any, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'])) {
        return next(
          new ApiError(403, 'Forbidden')
            .withCode('ROLE_FORBIDDEN')
            .withRoles(
              ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'],
              (req.user?.roles || [req.user?.role])
                .filter((role): role is NonNullable<typeof role> => role != null)
                .map((role) => String(role))
            )
        );
      }

      const learners = await prisma.learner.findMany({
        where: { archived: false },
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          middleName: true,
          guardianPhone: true,
          primaryContactPhone: true
        }
      });

      let created = 0;
      let existing = 0;
      const failures: Array<{ learnerId: string; admissionNumber: string; reason: string }> = [];

      for (const learner of learners) {
        try {
          const result = await ensureStudentAccountForLearner({
            admissionNumber: learner.admissionNumber,
            firstName: learner.firstName,
            lastName: learner.lastName,
            middleName: learner.middleName || null,
            phone: (learner.guardianPhone || learner.primaryContactPhone || null) as string | null
          });
          if (result.created) created += 1;
          else existing += 1;
        } catch (error) {
          failures.push({
            learnerId: learner.id,
            admissionNumber: learner.admissionNumber,
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return res.json({
        success: true,
        summary: {
          learnersScanned: learners.length,
          accountsCreated: created,
          accountsAlreadyPresent: existing,
          failed: failures.length
        },
        failures
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to sync student users',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/bulk/learners/export
 */
router.get(
  '/export',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('BULK_EXPORT_LEARNERS'),
  async (req: AuthRequest, res: Response) => {
  try {
    const { grade, status } = req.query;

    const where: any = {};
    if (grade) where.grade = grade;
    if (status) where.status = status;

    const learners = await prisma.learner.findMany({
      where,
      orderBy: [{ grade: 'asc' }, { admissionNumber: 'asc' }]
    });

    const csvData = learners.map((learner, index) => ({
      'ID': index + 1,
      'Learner Name': `${learner.firstName} ${learner.lastName}`,
      'Adm No': learner.admissionNumber,
      'Class': learner.grade.replace('_', ' '),
      'Term': req.query.term || 'Term 1',
      'Year': req.query.year || new Date().getFullYear(),
      'Parent/Guardian': learner.guardianName || '',
      'Phone 1': learner.guardianPhone || '',
      'Phone 2': '',
      'Reg Date': learner.admissionDate ? new Date(learner.admissionDate).toLocaleDateString('en-GB') : '',
      'Bal Due': '0.00'
    }));

    const parser = new Parser({
      fields: ['ID', 'Learner Name', 'Adm No', 'Class', 'Term', 'Year', 'Parent/Guardian', 'Phone 1', 'Phone 2', 'Reg Date', 'Bal Due']
    });
    const csv = parser.parse(csvData);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="learners_export_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/bulk/learners/template
 */
router.get(
  '/template',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  (_req: Request, res: Response) => {
  const template = [{ 'ID': '1', 'Learner Name': 'John Doe', 'Adm No': '1001', 'Class': 'Grade 1', 'Term': 'Term 1', 'Year': '2026', 'Parent/Guardian': 'Jane Doe', 'Phone 1': '0712345678', 'Phone 2': '0798765432', 'Reg Date': '02/01/2026', 'Bal Due': '0.00' }];
  const parser = new Parser({ fields: ['ID', 'Learner Name', 'Adm No', 'Class', 'Term', 'Year', 'Parent/Guardian', 'Phone 1', 'Phone 2', 'Reg Date', 'Bal Due'] });
  const csv = parser.parse(template);
  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename="learners_template.csv"');
  res.send(csv);
});

export default router;
