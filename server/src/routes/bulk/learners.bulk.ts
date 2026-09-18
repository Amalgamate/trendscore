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
import { generateAdmissionNumber, generateAdmissionNumberFrom, getNextAdmissionNumberPreview } from '../../services/admissionNumber.service';
import { parentService } from '../../services/parent.service';
import { buildLearnerNameParts } from '../../utils/learnerName.util';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const STANDARD_LEARNER_FIELDS = [
  'S/No', 'Admission Number', 'First Name', 'Middle Name', 'Last Name',
  'Grade', 'Stream', 'Academic Year', 'Gender', 'Date of Birth', 'Age', 'ULI',
  'Nationality', 'Religion', 'Parent/Guardian Name', 'Parent Phone',
  'Relationship', 'Father Name', 'Father Phone', 'Mother Name', 'Mother Phone',
  'Guardian Name', 'Guardian Phone', 'Guardian Relationship',
  'Transport Student', 'Reg Date',
];

const STANDARD_HEADER_MAP: Record<string, string> = {
  'S/No': 'S/No', 'Admission Number': 'Adm No', 'First Name': 'First Name',
  'Middle Name': 'Other Names', 'Last Name': 'Surname', 'Grade': 'Class',
  'Stream': 'Stream', 'Academic Year': 'Year', 'Gender': 'Gender', 'Date of Birth': 'Date of Birth',
  'Age': 'Age', 'ULI': 'Birth Entry Number', 'Nationality': 'Nationality', 'Religion': 'Religion',
  'Parent/Guardian Name': 'Parent/Guardian', 'Parent Phone': 'Phone 1', 'Relationship': 'Relationship',
  'Father Name': 'Father Name', 'Father Phone': 'Father Phone', 'Mother Name': 'Mother Name',
  'Mother Phone': 'Mother Phone', 'Guardian Name': 'Guardian Name', 'Guardian Phone': 'Guardian Phone',
  'Guardian Relationship': 'Guardian Relationship', 'Transport Student': 'Transport Student',
  'Reg Date': 'Reg Date',
};

const learnerSchema = z.object({
  'S/No': z.string().optional(),
  'Surname': z.string().min(1, 'Last Name is required'),
  'First Name': z.string().min(1, 'First Name is required'),
  'Other Names': z.string().optional(),
  'Adm No': z.string().optional(),
  'Class': z.string().min(1, 'Grade is required'),
  'Stream': z.string().optional(),
  'Year': z.string().min(4, 'Academic Year is required'),
  'Gender': z.string().optional(),
  'Date of Birth': z.string().optional(),
  'Age': z.string().optional(),
  'Birth Entry Number': z.string().optional(),
  'Nationality': z.string().optional(),
  'Religion': z.string().optional(),
  'Parent/Guardian': z.string().optional(),
  'Phone 1': z.string().optional(),
  'Relationship': z.string().optional(),
  'Father Name': z.string().optional(),
  'Father Phone': z.string().optional(),
  'Mother Name': z.string().optional(),
  'Mother Phone': z.string().optional(),
  'Guardian Name': z.string().optional(),
  'Guardian Phone': z.string().optional(),
  'Guardian Relationship': z.string().optional(),
  'Transport Student': z.string().optional(),
  'Reg Date': z.string().optional(),
}).strict();

type ParsedUploadRow = {
  line: number;
  data: Record<string, any>;
  sourceFile?: string;
};

function normalizeCellValue(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeHeaderKey(key: any): string {
  return normalizeCellValue(key).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function canonicalHeaderName(key: any): string {
  const standardField = STANDARD_LEARNER_FIELDS.find((field) => normalizeHeaderKey(field) === normalizeHeaderKey(key));
  return standardField ? STANDARD_HEADER_MAP[standardField] : normalizeCellValue(key);
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
  return STANDARD_LEARNER_FIELDS.some((field) => normalizeHeaderKey(field) === normalizeHeaderKey(value));
}

function findHeaderRowIndex(rows: any[][]): number {
  return rows.findIndex((row) => {
    const knownHeaders = row.filter(isKnownHeaderCell).map(canonicalHeaderName);
    return ['First Name', 'Surname', 'Class', 'Year'].every((header) => knownHeaders.includes(header));
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
  const normalized = normalizeUploadRow(record);
  return normalized;
}

function shouldSkipParsedRow(row: Record<string, any>): boolean {
  const learnerName = normalizeCellValue(row['Learner Name'] || row['Leaner Name'] || row['Name'] || row['Surname'] || row['First Name'] || row['Other Names']);
  const learnerClass = normalizeCellValue(row['Class']);
  const birthEntryNumber = normalizeCellValue(row['Birth Entry Number']);
  return learnerName === '' && learnerClass === '' && birthEntryNumber === '';
}

function parseUploadDate(value: any, fallback: Date): Date {
  const raw = normalizeCellValue(value);
  if (!raw) return fallback;

  const dmyMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1], 10);
    const month = Number.parseInt(dmyMatch[2], 10) - 1;
    const yearPart = Number.parseInt(dmyMatch[3], 10);
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    const parsed = new Date(year, month, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
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
    const parsedRows: ParsedUploadRow[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      });
      const headerRowIndex = findHeaderRowIndex(rows);
      if (headerRowIndex === -1) continue;

      const headers = rows[headerRowIndex].map(canonicalHeaderName);
      const sheetRows = rows
        .slice(headerRowIndex + 1)
        .map((row, index) => ({
          line: headerRowIndex + index + 2,
          data: rowToRecord(headers, row),
          sourceFile: file.originalname,
        }))
        .filter((row) => !isEmptyExcelRow(Object.values(row.data)) && !isSectionRow(Object.values(row.data)));

      parsedRows.push(...sheetRows);
    }

    return parsedRows;
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
          sourceFile: file.originalname,
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return rows;
}

/**
 * Generates the admission number for one bulk-import row.
 *
 * - No startFrom: uses the school's normal AUTO numbering sequence.
 * - startFrom: an admin explicitly chose a starting point for this whole
 *   batch (because the file had rows with no admission number). Passing the
 *   same startFrom value on every row in the batch is safe — the sequence
 *   only ever moves forward, so once the running counter passes startFrom it
 *   takes over automatically (see minValue handling in the service).
 */
async function generateBulkAdmissionNumber(stream: string, academicYear: number, startFrom?: number): Promise<string> {
  try {
    if (startFrom) {
      return await generateAdmissionNumberFrom(startFrom, stream || 'A', academicYear);
    }
    return await generateAdmissionNumber(stream || 'A', academicYear);
  } catch (error: any) {
    // Bulk imports must still work when school settings are in manual mode.
    // Use a deterministic fallback and check uniqueness before returning.
    let seq = startFrom ? startFrom - 1 : await prisma.learner.count();
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
    'G1': 'GRADE_1', 'G2': 'GRADE_2', 'G3': 'GRADE_3',
    'G4': 'GRADE_4', 'G5': 'GRADE_5', 'G6': 'GRADE_6',
    'G7': 'GRADE_7', 'G8': 'GRADE_8', 'G9': 'GRADE_9',
    'JSS1': 'GRADE_7', 'JSS2': 'GRADE_8', 'JSS3': 'GRADE_9',
    '1': 'GRADE_1', '2': 'GRADE_2', '3': 'GRADE_3', '4': 'GRADE_4',
    '5': 'GRADE_5', '6': 'GRADE_6', '7': 'GRADE_7', '8': 'GRADE_8',
    '9': 'GRADE_9',
  };

  if (gradeMap[normalised]) return gradeMap[normalised];

  // Fuzzy fallback: find first key contained in the normalised string
  const match = Object.keys(gradeMap).find(k => normalised.includes(k));
  if (match) return gradeMap[match];

  throw new ApiError(422, `Class "${raw}" is not recognised. Use a configured grade from the import template.`);
}

async function enrollLearnerInClass(learnerId: string, classId: string) {
  try {
    await prisma.classEnrollment.upsert({
      where: { classId_learnerId: { classId, learnerId } },
      update: { active: true, archived: false },
      create: { classId, learnerId, active: true },
    });
  } catch (err: any) {
    console.warn('[bulk enroll] Notice on class enrollment:', err?.message || err);
  }
}

function normalizeIdentityPart(value: any): string {
  return normalizeCellValue(value).toUpperCase().replace(/\s+/g, ' ');
}

function sameLearnerName(
  learner: { firstName: string; middleName: string | null; lastName: string; grade: string },
  identity: { firstName: string; middleName?: string; lastName: string; grade: string },
): boolean {
  return learner.grade === identity.grade &&
    normalizeIdentityPart(learner.firstName) === normalizeIdentityPart(identity.firstName) &&
    normalizeIdentityPart(learner.middleName) === normalizeIdentityPart(identity.middleName) &&
    normalizeIdentityPart(learner.lastName) === normalizeIdentityPart(identity.lastName);
}

type LearnerImportValidationResult = {
  /** Set when the whole import must be rejected before any per-row validation runs. */
  blocked: { status: number; body: any } | null;
  importRows: ParsedUploadRow[];
  skippedRows: number;
  results: any[];
  errors: any[];
  /** How many otherwise-valid rows had no Admission Number in the file. */
  missingAdmissionNumbers: number;
  /** Academic year taken from the file, used to preview the next AUTO admission number. */
  sampleAcademicYear: number;
};

/**
 * Parses and validates an uploaded learner file (or files) without writing
 * anything to the database. Shared by the real /upload endpoint and the
 * dry-run /preview endpoint so the two can never drift apart.
 */
async function runLearnerImportValidation(
  uploadedFiles: Express.Multer.File[]
): Promise<LearnerImportValidationResult> {
  const results: any[] = [];
  const errors: any[] = [];
  const parsedRows = (await Promise.all(uploadedFiles.map(parseUploadRows))).flat();
  const importRows = parsedRows.filter((row) => !shouldSkipParsedRow(row.data));
  const skippedRows = parsedRows.length - importRows.length;
  const nowYear = new Date().getFullYear();

  if (!importRows.length) {
    return {
      blocked: {
        status: 422,
        body: {
          error: 'Import blocked. Use the downloaded standard learner template and provide learner rows.',
          summary: { total: 0, processed: 0, skipped: skippedRows, failed: 1, validationErrors: 1, missingAdmissionNumbers: 0 },
          details: { validationErrors: [{ line: 1, error: 'No standard learner rows were found.' }] },
        },
      },
      importRows, skippedRows, results, errors, missingAdmissionNumbers: 0, sampleAcademicYear: nowYear,
    };
  }

  // Imports use the authoritative configured stream and class catalogues.
  const schoolStreams = await prisma.stream.findMany({
    where: { active: true, archived: false },
    select: { id: true, name: true, isDefault: true },
  });
  if (!schoolStreams.length) {
    return {
      blocked: {
        status: 409,
        body: { error: 'School setup is incomplete: create at least one active stream before importing learners.' },
      },
      importRows, skippedRows, results, errors, missingAdmissionNumbers: 0, sampleAcademicYear: nowYear,
    };
  }
  const defaultStream = schoolStreams.find((stream) => stream.isDefault)?.name;
  const streamByName = new Map(schoolStreams.map((stream) => [stream.name.trim().toUpperCase(), stream.name]));
  const configuredClasses = await prisma.class.findMany({
    where: { active: true, archived: false },
    select: { id: true, grade: true, stream: true, academicYear: true },
  });
  const classByGradeStreamYear = new Map(
    configuredClasses
      .filter((classItem) => classItem.stream)
      .map((classItem) => [`${classItem.grade}|${classItem.stream!.trim().toUpperCase()}|${classItem.academicYear}`, classItem.id]),
  );
  const automaticClassByGradeYear = new Map<string, { id: string; stream: string }>();
  configuredClasses
    .filter((classItem) => classItem.stream && streamByName.has(classItem.stream.trim().toUpperCase()))
    .sort((left, right) => left.stream!.localeCompare(right.stream!))
    .forEach((classItem) => {
      const key = `${classItem.grade}|${classItem.academicYear}`;
      if (!automaticClassByGradeYear.has(key)) {
        automaticClassByGradeYear.set(key, { id: classItem.id, stream: classItem.stream! });
      }
    });

  const existingLearners = await prisma.learner.findMany({
    where: { archived: false },
    select: {
      id: true,
      admissionNumber: true,
      upiNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      grade: true,
    },
  });
  const existingByAdmission = new Map(existingLearners.map((learner) => [normalizeIdentityPart(learner.admissionNumber), learner]));
  const existingByUpi = new Map(
    existingLearners
      .filter((learner) => learner.upiNumber)
      .map((learner) => [normalizeIdentityPart(learner.upiNumber), learner]),
  );
  const seenImportIdentities = new Map<string, number>();
  const seenImportNames = new Map<string, number>();

  let missingAdmissionNumbers = 0;
  let sampleAcademicYear = nowYear;

  for (const row of importRows) {
    try {
      const validated = learnerSchema.parse(row.data);
      const grade = resolveGrade((validated['Class'] || '').toString());
      const academicYear = Number.parseInt(String(validated['Year'] || ''), 10);
      if (Number.isFinite(academicYear)) sampleAcademicYear = academicYear;
      const requestedStream = String(validated['Stream'] || '').trim();
      let streamCode: string | undefined;
      let targetClassId: string | undefined;

      if (requestedStream) {
        streamCode = streamByName.get(requestedStream.toUpperCase());
        if (!streamCode) {
          throw new ApiError(422, `Stream "${requestedStream}" is not an active configured stream.`);
        }
        targetClassId = classByGradeStreamYear.get(`${grade}|${streamCode.toUpperCase()}|${academicYear}`);
      } else {
        const defaultClassId = defaultStream
          ? classByGradeStreamYear.get(`${grade}|${defaultStream.toUpperCase()}|${academicYear}`)
          : undefined;
        const automaticClass = automaticClassByGradeYear.get(`${grade}|${academicYear}`);
        targetClassId = defaultClassId || automaticClass?.id;
        streamCode = defaultClassId ? defaultStream : automaticClass?.stream;
      }

      if (!targetClassId) {
        throw new ApiError(422, `No active ${grade.replace('_', ' ')} class exists for ${academicYear}. Create a class before importing learners.`);
      }

      const firstName = normalizeCellValue(validated['First Name']);
      const middleName = normalizeCellValue(validated['Other Names']);
      const lastName = normalizeCellValue(validated['Surname']);
      const providedAdmNo = normalizeCellValue(validated['Adm No']);
      const birthEntryNumber = normalizeCellValue(validated['Birth Entry Number']);
      const identityKey = providedAdmNo
        ? `ADM:${normalizeIdentityPart(providedAdmNo)}`
        : birthEntryNumber
          ? `ULI:${normalizeIdentityPart(birthEntryNumber)}`
          : '';
      const nameKey = `${grade}|${normalizeIdentityPart(firstName)}|${normalizeIdentityPart(middleName)}|${normalizeIdentityPart(lastName)}`;
      const existingByAdm = providedAdmNo ? existingByAdmission.get(normalizeIdentityPart(providedAdmNo)) : undefined;
      const existingByBirthEntry = birthEntryNumber ? existingByUpi.get(normalizeIdentityPart(birthEntryNumber)) : undefined;

      if (identityKey && seenImportIdentities.has(identityKey)) {
        throw new ApiError(422, `Duplicate learner identity in this upload; first seen on line ${seenImportIdentities.get(identityKey)}.`);
      }
      if (!identityKey && seenImportNames.has(nameKey)) {
        throw new ApiError(422, `Possible duplicate learner name in this upload; first seen on line ${seenImportNames.get(nameKey)}. Add Admission Number or ULI.`);
      }
      if (existingByAdm && existingByBirthEntry && existingByAdm.id !== existingByBirthEntry.id) {
        throw new ApiError(422, 'Admission Number and ULI belong to different learners. Resolve the conflict before importing.');
      }

      const existingMatch = existingByAdm || existingByBirthEntry;
      if (existingMatch && !sameLearnerName(existingMatch, { firstName, middleName, lastName, grade })) {
        throw new ApiError(422, 'Admission Number or ULI matches a learner with a different name or grade. Resolve the conflict before importing.');
      }
      if (!existingMatch && existingLearners.some((learner) => sameLearnerName(learner, { firstName, middleName, lastName, grade }))) {
        throw new ApiError(422, 'A learner with the same name and grade already exists. Add Admission Number or ULI to confirm the intended record.');
      }

      if (identityKey) seenImportIdentities.set(identityKey, row.line);
      seenImportNames.set(nameKey, row.line);
      if (!providedAdmNo) missingAdmissionNumbers += 1;
      results.push({
        line: row.line,
        sourceFile: row.sourceFile,
        data: { ...validated, Stream: streamCode! },
        targetClassId,
        valid: true
      });
    } catch (error) {
      errors.push({
        line: row.line,
        sourceFile: row.sourceFile,
        data: row.data,
        error: error instanceof z.ZodError
          ? error.errors
          : error instanceof Error ? error.message : 'Validation failed',
        valid: false
      });
    }
  }

  return { blocked: null, importRows, skippedRows, results, errors, missingAdmissionNumbers, sampleAcademicYear };
}

/**
 * POST /api/bulk/learners/preview
 * Dry-run: parses and validates the file(s) exactly like /upload, but writes
 * nothing. Lets the UI ask "N students have no Admission Number — how should
 * we number them?" before the real import commits anything.
 */
router.post(
  '/preview',
  upload.fields([{ name: 'files', maxCount: 20 }, { name: 'file', maxCount: 1 }]),
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!hasAnyRole(req.user as any, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'])) {
        return res.status(403).json({ error: 'Only school administrators can import learners.' });
      }
      const uploadedFiles = Object.values((req.files || {}) as Record<string, Express.Multer.File[]>).flat();
      if (!uploadedFiles.length) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const validation = await runLearnerImportValidation(uploadedFiles);
      if (validation.blocked) {
        return res.status(validation.blocked.status).json(validation.blocked.body);
      }
      const { importRows, skippedRows, errors, missingAdmissionNumbers, sampleAcademicYear } = validation;

      let nextAdmissionNumberPreview: string | null = null;
      try {
        nextAdmissionNumberPreview = await getNextAdmissionNumberPreview('A', sampleAcademicYear);
      } catch {
        // Numbering mode is MANUAL, or no school settings yet — no preview available;
        // the UI falls back to just asking for a starting number.
        nextAdmissionNumberPreview = null;
      }

      res.json({
        success: true,
        summary: {
          total: importRows.length,
          skipped: skippedRows,
          failed: errors.length,
          validationErrors: errors.length,
          missingAdmissionNumbers,
        },
        nextAdmissionNumberPreview,
        details: { validationErrors: errors },
      });
    } catch (error) {
      console.error('Bulk preview error:', error);
      res.status(500).json({ error: 'Failed to preview upload', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
);

/**
 * POST /api/bulk/learners/upload
 */
router.post(
  '/upload',
  upload.fields([{ name: 'files', maxCount: 20 }, { name: 'file', maxCount: 1 }]),
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('BULK_UPLOAD_LEARNERS'),
  async (req: AuthRequest, res: Response) => {
  try {
    if (!hasAnyRole(req.user as any, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'])) {
      return res.status(403).json({ error: 'Only school administrators can import learners.' });
    }
    const uploadedFiles = Object.values((req.files || {}) as Record<string, Express.Multer.File[]>).flat();
    if (!uploadedFiles.length) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const validation = await runLearnerImportValidation(uploadedFiles);
    if (validation.blocked) {
      return res.status(validation.blocked.status).json(validation.blocked.body);
    }
    const { importRows, skippedRows, results, errors, missingAdmissionNumbers } = validation;

    // The file is all-or-nothing: configuration and row errors must be fixed
    // before any learner, parent, account, or enrolment record is written.
    if (errors.length) {
      return res.status(422).json({
        error: 'Import blocked. Complete school setup and correct the listed rows before retrying.',
        summary: { total: importRows.length, processed: 0, skipped: skippedRows, failed: errors.length, validationErrors: errors.length, missingAdmissionNumbers },
        details: { validationErrors: errors },
      });
    }

    // ── Admission numbering strategy for this batch ───────────────────────
    // 'auto' (default): continue the school's existing numbering sequence.
    // 'manual': the admin chose a specific starting number for the rows in
    // this file that had no Admission Number — every such row is passed the
    // same start value; the sequence only ever counts upward from there (see
    // generateAdmissionNumberFrom), so this is safe to pass on every row.
    const admissionNumberStrategy = String(req.body?.admissionNumberStrategy || 'auto').toLowerCase();
    const requestedStart = Number.parseInt(String(req.body?.admissionNumberStart || ''), 10);
    const admissionNumberStart = admissionNumberStrategy === 'manual' && Number.isFinite(requestedStart) && requestedStart > 0
      ? requestedStart
      : undefined;

    const created: any[] = [];
    const updated: any[] = [];
    const failed: any[] = [];
    let studentAccountsCreated = 0;

    for (const item of results) {
      try {
        const csvData = item.data;
        const grade = resolveGrade((csvData['Class'] || '').toString());
        const academicYear = Number.parseInt(String(csvData['Year'] || ''), 10);
        const streamCode = String(csvData['Stream'] || '').trim();
        const providedAdmNo = String(csvData['Adm No'] || '').trim();

        const { rawName, firstName, middleName, lastName } = buildLearnerNameParts(csvData);
        const birthEntryNumber = normalizeCellValue(csvData['Birth Entry Number'] || csvData['ULI']);

        // Date of birth: compute from Age if exact DOB is absent.
        let dob = parseUploadDate(csvData['DOB'] || csvData['Date of Birth'], new Date(2015, 0, 1));
        const rawAge = normalizeCellValue(csvData['Age']);
        if ((!csvData['DOB'] && !csvData['Date of Birth']) && rawAge) {
          const ageNum = Number.parseInt(rawAge, 10);
          if (!Number.isNaN(ageNum) && ageNum > 0 && ageNum < 40) {
            dob = new Date(new Date().getFullYear() - ageNum, 0, 1);
          }
        }

        let parentId: string | undefined;
        const fatherName = normalizeCellValue(csvData['Father Name']);
        const motherName = normalizeCellValue(csvData['Mother Name']);
        const guardianName = normalizeCellValue(csvData['Guardian Name']);
        const parentName = guardianName || fatherName || motherName || csvData['Parent/Guardian'] || csvData['Parent Name'] || (lastName ? `${lastName} Family` : 'Parent');
        let parentPhone = csvData['Guardian Phone'] || csvData['Father Phone'] || csvData['Mother Phone'] || csvData['Phone 1'] || csvData['Parent Phone'] ? String(csvData['Guardian Phone'] || csvData['Father Phone'] || csvData['Mother Phone'] || csvData['Phone 1'] || csvData['Parent Phone']).trim() : null;
        if (parentPhone) {
          const digitsOnly = parentPhone.replace(/\D/g, '');
          if (digitsOnly.length === 9 && (digitsOnly.startsWith('7') || digitsOnly.startsWith('1'))) {
            parentPhone = `0${digitsOnly}`;
          }
        }

        if (parentPhone) {
          const parent = await parentService.getOrCreateParent({
            phone: parentPhone,
            name: parentName,
            skipNotifications: true
          });
          if (parent) parentId = parent.id;
        }

        const admissionDate = parseUploadDate(csvData['Reg Date'], new Date());

        let gender: any = 'MALE';
        const rawGender = (csvData['Gender'] || '').toUpperCase().trim();
        if (rawGender.startsWith('F')) gender = 'FEMALE';
        else if (rawGender.startsWith('M')) gender = 'MALE';
        else if (rawGender.startsWith('O')) gender = 'OTHER';

        // Check if learner already exists by admission number OR UPI/ULI
        let existing = providedAdmNo
          ? await prisma.learner.findUnique({ where: { admissionNumber: providedAdmNo } })
          : null;

        if (!existing && birthEntryNumber) {
          existing = await prisma.learner.findUnique({ where: { upiNumber: birthEntryNumber } });
        }

        const admNo = providedAdmNo || existing?.admissionNumber || await generateBulkAdmissionNumber(streamCode || 'A', academicYear, admissionNumberStart);
        // Defensive guarantee: never let a row through without a number. If the
        // generation chain somehow returns nothing, fail this row explicitly
        // rather than silently writing a learner with a blank admission number.
        if (!admNo) {
          throw new Error('Failed to assign an admission number for this student.');
        }

        if (existing) {
          const updatedLearner = await prisma.learner.update({
            where: { id: existing.id },
            data: {
              firstName,
              middleName,
              lastName,
              grade,
              stream: streamCode || existing.stream,
              gender: gender,
              dateOfBirth: dob,
              upiNumber: birthEntryNumber || existing.upiNumber || undefined,
              nationality: normalizeCellValue(csvData['Nationality']) || existing.nationality || undefined,
              religion: normalizeCellValue(csvData['Religion']) || existing.religion || undefined,
              isTransportStudent: /^(Y|YES|TRUE|1)$/i.test(normalizeCellValue(csvData['Transport Student'])),
              fatherName: fatherName || existing.fatherName || undefined,
              fatherPhone: normalizeCellValue(csvData['Father Phone']) || existing.fatherPhone || undefined,
              motherName: motherName || existing.motherName || undefined,
              motherPhone: normalizeCellValue(csvData['Mother Phone']) || existing.motherPhone || undefined,
              parentId: parentId || existing.parentId,
              guardianName: guardianName || parentName || existing.guardianName,
              guardianPhone: parentPhone || existing.guardianPhone,
              guardianRelation: normalizeCellValue(csvData['Guardian Relationship'] || csvData['Relationship']) || existing.guardianRelation || undefined,
            }
          });

          if (parentPhone && parentName) {
            await parentService.syncPrimaryParentForLearner({
              learnerId: updatedLearner.id,
              admissionNumber: updatedLearner.admissionNumber,
              phone: parentPhone,
              name: parentName,
              relationship: csvData['Relationship'] || 'Guardian',
            });
          }

          await enrollLearnerInClass(updatedLearner.id, item.targetClassId);

          const studentAccount = await ensureStudentAccountForLearner({
            learnerId: updatedLearner.id,
            admissionNumber: updatedLearner.admissionNumber,
            firstName: updatedLearner.firstName,
            lastName: updatedLearner.lastName,
            middleName: updatedLearner.middleName || null,
            phone: null
          });
          if (studentAccount.created) studentAccountsCreated += 1;
          updated.push({ line: item.line, sourceFile: item.sourceFile, id: existing.id, admNo: updatedLearner.admissionNumber, name: rawName });
        } else {
          const learner = await prisma.learner.create({
            data: {
              admissionNumber: admNo,
              firstName,
              middleName,
              lastName,
              dateOfBirth: dob,
              gender: gender,
              grade,
              stream: streamCode,
              status: 'ACTIVE',
              admissionDate,
              upiNumber: birthEntryNumber || undefined,
              nationality: normalizeCellValue(csvData['Nationality']) || undefined,
              religion: normalizeCellValue(csvData['Religion']) || undefined,
              isTransportStudent: /^(Y|YES|TRUE|1)$/i.test(normalizeCellValue(csvData['Transport Student'])),
              fatherName: fatherName || undefined,
              fatherPhone: normalizeCellValue(csvData['Father Phone']) || undefined,
              motherName: motherName || undefined,
              motherPhone: normalizeCellValue(csvData['Mother Phone']) || undefined,
              guardianName: parentName || undefined,
              guardianPhone: parentPhone || undefined,
              guardianRelation: normalizeCellValue(csvData['Guardian Relationship'] || csvData['Relationship']) || undefined,
              parentId: parentId,
            }
          });

          if (parentPhone && parentName) {
            await parentService.syncPrimaryParentForLearner({
              learnerId: learner.id,
              admissionNumber: learner.admissionNumber,
              phone: parentPhone,
              name: parentName,
              relationship: csvData['Relationship'] || 'Guardian',
            });
          }

          await enrollLearnerInClass(learner.id, item.targetClassId);

          const studentAccount = await ensureStudentAccountForLearner({
            learnerId: learner.id,
            admissionNumber: learner.admissionNumber,
            firstName: learner.firstName,
            lastName: learner.lastName,
            middleName: learner.middleName || null,
            phone: null
          });
          if (studentAccount.created) studentAccountsCreated += 1;
          created.push({ line: item.line, sourceFile: item.sourceFile, id: learner.id, admNo: learner.admissionNumber, name: rawName });
        }
      } catch (error) {
        failed.push({
          line: item.line,
          sourceFile: item.sourceFile,
          admNo: item.data['Adm No'],
          name: item.data['Learner Name'] || item.data['Leaner Name'] || [item.data['First Name'], item.data['Other Names'], item.data['Surname']].filter(Boolean).join(' '),
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
        validationErrors: errors.length,
        missingAdmissionNumbers,
        admissionNumberStrategy: admissionNumberStart ? 'manual' : 'auto',
        ...(admissionNumberStart ? { admissionNumberStartedAt: admissionNumberStart } : {}),
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

      // Account provisioning performs several lookups per learner. Process a
      // modest number concurrently instead of making the administrator wait for
      // hundreds of sequential database round trips.
      const queue = [...learners];
      const workerCount = Math.min(12, queue.length);
      const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          const learner = queue.shift();
          if (!learner) break;
          try {
            const result = await ensureStudentAccountForLearner({
              learnerId: learner.id,
              admissionNumber: learner.admissionNumber,
              firstName: learner.firstName,
              lastName: learner.lastName,
              middleName: learner.middleName || null,
              phone: null
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
      });

      await Promise.all(workers);

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
      'S/No': index + 1,
      'Admission Number': learner.admissionNumber,
      'First Name': learner.firstName,
      'Middle Name': learner.middleName || '',
      'Last Name': learner.lastName,
      'Grade': learner.grade.replace('_', ' '),
      'Stream': learner.stream || '',
      'Gender': learner.gender,
      'Date of Birth': learner.dateOfBirth ? new Date(learner.dateOfBirth).toLocaleDateString('en-GB') : '',
      'Age': '',
      'ULI': learner.upiNumber || '',
      'Nationality': learner.nationality || '',
      'Religion': learner.religion || '',
      'Parent/Guardian Name': learner.guardianName || '',
      'Parent Phone': learner.guardianPhone || '',
      'Relationship': '',
      'Father Name': learner.fatherName || '',
      'Father Phone': learner.fatherPhone || '',
      'Mother Name': learner.motherName || '',
      'Mother Phone': learner.motherPhone || '',
      'Guardian Name': learner.guardianName || '',
      'Guardian Phone': learner.guardianPhone || '',
      'Guardian Relationship': learner.guardianRelation || '',
      'Transport Student': learner.isTransportStudent ? 'Yes' : 'No',
      'Reg Date': learner.admissionDate ? new Date(learner.admissionDate).toLocaleDateString('en-GB') : '',
    }));

    const parser = new Parser({
      fields: STANDARD_LEARNER_FIELDS
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
 * Standard CSV Template
 */
router.get(
  '/template',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  (_req: Request, res: Response) => {
  const fields = STANDARD_LEARNER_FIELDS;
  const template = [
    {
      'S/No': '1',
      'Admission Number': '',
      'First Name': '',
      'Middle Name': '',
      'Last Name': '',
      'Grade': '',
      'Stream': '',
      'Academic Year': String(new Date().getFullYear()),
      'Gender': '',
      'Age': '',
      'Date of Birth': '',
      'ULI': '',
      'Nationality': 'Kenya',
      'Religion': '',
      'Parent/Guardian Name': '',
      'Parent Phone': '',
      'Relationship': '',
      'Father Name': '',
      'Father Phone': '',
      'Mother Name': '',
      'Mother Phone': '',
      'Guardian Name': '',
      'Guardian Phone': '',
      'Guardian Relationship': '',
      'Transport Student': 'No',
      'Reg Date': ''
    }
  ];
  const parser = new Parser({ fields });
  const csv = parser.parse(template);
  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename="trendscore_learners_template.csv"');
  res.send(csv);
});

export default router;
