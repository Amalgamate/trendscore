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
import { parentService } from '../../services/parent.service';
import { buildLearnerNameParts } from '../../utils/learnerName.util';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const learnerSchema = z.object({
  'S/No': z.string().optional(),
  'Surname': z.string().optional(),
  'First Name': z.string().optional(),
  'Other Names': z.string().optional(),
  'Learner Name': z.string().optional(),
  'Leaner Name': z.string().optional(),
  'Name': z.string().optional(),
  'Adm No': z.string().optional(),
  'Class': z.string().min(1, 'Class or Grade is required'),
  'Stream': z.string().optional(),
  'Term': z.string().optional(),
  'Year': z.string().optional(),
  'Gender': z.string().optional(),
  'DOB': z.string().optional(),
  'Date of Birth': z.string().optional(),
  'Age': z.string().optional(),
  'Birth Entry Number': z.string().optional(),
  'ULI': z.string().optional(),
  'Special Needs': z.string().optional(),
  'SNE Status': z.string().optional(),
  'Index Number': z.string().optional(),
  'Parent/Guardian': z.string().optional(),
  'Parent Name': z.string().optional(),
  'Phone 1': z.string().optional(),
  'Phone 2': z.string().optional(),
  'Parent Phone': z.string().optional(),
  'Relationship': z.string().optional(),
  'Reg Date': z.string().optional(),
  'Bal Due': z.string().optional(),
}).refine(data => data['Learner Name'] || data['Leaner Name'] || data['Name'] || data['Surname'] || data['First Name'] || data['Other Names'], {
  message: "Learner Name is required",
  path: ['Learner Name']
});

type ParsedUploadRow = {
  line: number;
  data: Record<string, any>;
  sourceFile?: string;
};

const HEADER_ALIASES: Record<string, string> = {
  SNO: 'S/No',
  SERIALNO: 'S/No',
  SERIALNUMBER: 'S/No',
  SURNAME: 'Surname',
  LASTNAME: 'Surname',
  LEARNERLASTNAME: 'Surname',
  FIRSTNAME: 'First Name',
  GIVENNAME: 'First Name',
  LEARNERSFIRSTNAME: 'First Name',
  LEARNERFIRSTNAME: 'First Name',
  OTHERNAMES: 'Other Names',
  MIDDLENAME: 'Other Names',
  MIDDLENAMES: 'Other Names',
  LEARNERMIDDLENAME: 'Other Names',
  LEARNERSMIDDLENAME: 'Other Names',
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
  AGE: 'Age',
  BIRTHENTRYNUMBER: 'Birth Entry Number',
  BIRTHENTRYNO: 'Birth Entry Number',
  BIRTHENTRY: 'Birth Entry Number',
  BIRTHCERTIFICATENUMBER: 'Birth Entry Number',
  BIRTHCERTIFICATENO: 'Birth Entry Number',
  BIRTHCERTNO: 'Birth Entry Number',
  BCNO: 'Birth Entry Number',
  UNIQUELEARNERIDENTIFIERULI: 'Birth Entry Number',
  UNIQUELEARNERIDENTIFIER: 'Birth Entry Number',
  ULI: 'Birth Entry Number',
  UPI: 'Birth Entry Number',
  UPINUMBER: 'Birth Entry Number',
  NEMISUPI: 'Birth Entry Number',
  KEMISULI: 'Birth Entry Number',
  KCPEKCSEINDEXNUMBER: 'Index Number',
  KCPEINDEXNUMBER: 'Index Number',
  KCSEINDEXNUMBER: 'Index Number',
  INDEXNUMBER: 'Index Number',
  INDEXNO: 'Index Number',
  SNESTATUS: 'SNE Status',
  SNETYPE: 'Special Needs',
  DISABILITYTYPEIFANY: 'Special Needs',
  DISABILITYTYPE: 'Special Needs',
  DISABILITY: 'Special Needs',
  SPECIALNEEDS: 'Special Needs',
  SPECIALNEED: 'Special Needs',
  PARENTGUARDIAN: 'Parent/Guardian',
  GUARDIAN: 'Parent/Guardian',
  PARENT: 'Parent/Guardian',
  PARENTNAME: 'Parent/Guardian',
  GUARDIANNAME: 'Parent/Guardian',
  PARENTSNAME: 'Parent/Guardian',
  PHONE1: 'Phone 1',
  PHONE: 'Phone 1',
  PHONENO: 'Phone 1',
  PHONENUMBER: 'Phone 1',
  PARENTPHONE: 'Phone 1',
  GUARDIANPHONE: 'Phone 1',
  CONTACT: 'Phone 1',
  CONTACTNO: 'Phone 1',
  PHONE2: 'Phone 2',
  ALTERNATEPHONE: 'Phone 2',
  RELATIONSHIP: 'Relationship',
  GUARDIANRELATION: 'Relationship',
  REGDATE: 'Reg Date',
  REGISTRATIONDATE: 'Reg Date',
  ADMISSIONDATE: 'Reg Date',
  CREATEDDATE: 'Reg Date',
  CREATEDBY: 'Created By',
  INSTITUTION: 'Institution',
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
    const hasLearnerName = knownHeaders.includes('Learner Name') ||
      knownHeaders.includes('Surname') ||
      knownHeaders.includes('First Name');
    return hasLearnerName && (
      knownHeaders.includes('Class') ||
      knownHeaders.includes('Adm No') ||
      knownHeaders.includes('Year') ||
      knownHeaders.includes('Gender') ||
      knownHeaders.includes('Date of Birth')
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

function rowToRecord(headers: string[], values: any[], fallbackClass?: string): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    if (!header) return;
    const value = normalizeCellValue(values[index]);
    if (record[header] === undefined || record[header] === '') {
      record[header] = value;
    }
  });
  const normalized = normalizeUploadRow(record);
  if (!normalized['Class'] && fallbackClass) {
    normalized['Class'] = fallbackClass;
  }
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

function inferClassFromSheetName(sheetName: string): string | undefined {
  const normalized = normalizeCellValue(sheetName);
  if (!normalized) return undefined;
  return /GRADE|CLASS|PLAYGROUP|PP\s*[12]|PP[12]/i.test(normalized) ? normalized : undefined;
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
      const fallbackClass = inferClassFromSheetName(sheetName);
      const sheetRows = rows
        .slice(headerRowIndex + 1)
        .map((row, index) => ({
          line: headerRowIndex + index + 2,
          data: rowToRecord(headers, row, fallbackClass),
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
    const uploadedFiles = Object.values((req.files || {}) as Record<string, Express.Multer.File[]>).flat();
    if (!uploadedFiles.length) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results: any[] = [];
    const errors: any[] = [];
    const parsedRows = (await Promise.all(uploadedFiles.map(parseUploadRows))).flat();
    const importRows = parsedRows.filter((row) => !shouldSkipParsedRow(row.data));
    const skippedRows = parsedRows.length - importRows.length;

    // Imports use the authoritative Stream catalogue. KEMIS exports commonly
    // omit Stream, so those learners are placed in the school's configured
    // default stream or the first eligible active class for their grade.
    const schoolStreams = await prisma.stream.findMany({
      where: { active: true, archived: false },
      select: { id: true, name: true, isDefault: true },
    });
    if (!schoolStreams.length) {
      return res.status(409).json({ error: 'School setup is incomplete: create at least one active stream before importing learners.' });
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

    for (const row of importRows) {
      try {
        const validated = learnerSchema.parse(row.data);
        const grade = resolveGrade((validated['Class'] || '').toString());
        const academicYear = Number.parseInt(String(validated['Year'] || ''), 10) || new Date().getFullYear();
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
          error: error instanceof z.ZodError ? error.errors : 'Validation failed',
          valid: false
        });
      }
    }

    // The file is all-or-nothing: configuration and row errors must be fixed
    // before any learner, parent, account, or enrolment record is written.
    if (errors.length) {
      return res.status(422).json({
        error: 'Import blocked. Complete school setup and correct the listed rows before retrying.',
        summary: { total: importRows.length, processed: 0, skipped: skippedRows, failed: errors.length, validationErrors: errors.length },
        details: { validationErrors: errors },
      });
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
        const streamCode = String(csvData['Stream'] || '').trim();
        const providedAdmNo = String(csvData['Adm No'] || '').trim();

        const { rawName, firstName, middleName, lastName } = buildLearnerNameParts(csvData);
        const birthEntryNumber = normalizeCellValue(csvData['Birth Entry Number'] || csvData['ULI']);

        // Date of birth: compute from Age if exact DOB is absent (common in KEMIS)
        let dob = parseUploadDate(csvData['DOB'] || csvData['Date of Birth'], new Date(2015, 0, 1));
        const rawAge = normalizeCellValue(csvData['Age']);
        if ((!csvData['DOB'] && !csvData['Date of Birth']) && rawAge) {
          const ageNum = Number.parseInt(rawAge, 10);
          if (!Number.isNaN(ageNum) && ageNum > 0 && ageNum < 40) {
            dob = new Date(new Date().getFullYear() - ageNum, 0, 1);
          }
        }

        // Special Needs
        let specialNeeds = normalizeCellValue(csvData['Special Needs']);
        const sneStatus = normalizeCellValue(csvData['SNE Status']).toUpperCase();
        if (specialNeeds === 'NA' || specialNeeds === 'NONE' || specialNeeds === 'NO') {
          specialNeeds = '';
        }
        if (sneStatus === 'YES' && !specialNeeds) {
          specialNeeds = 'Special Needs Education (SNE)';
        }

        let parentId: string | undefined;
        const parentName = csvData['Parent/Guardian'] || csvData['Parent Name'] || (lastName ? `${lastName} Family` : 'Parent');
        const parentPhone = csvData['Phone 1'] || csvData['Parent Phone'] ? String(csvData['Phone 1'] || csvData['Parent Phone']).trim() : null;

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

        const admNo = providedAdmNo || existing?.admissionNumber || await generateBulkAdmissionNumber(streamCode || 'A', academicYear);

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
              specialNeeds: specialNeeds || existing.specialNeeds || undefined,
              parentId: parentId || existing.parentId,
              guardianName: parentName || existing.guardianName,
              guardianPhone: parentPhone || existing.guardianPhone,
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
              specialNeeds: specialNeeds || undefined,
              guardianName: parentName || undefined,
              guardianPhone: parentPhone || undefined,
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
      'Surname': learner.lastName,
      'First Name': learner.firstName,
      'Other Names': learner.middleName || '',
      'Gender': learner.gender,
      'Date of Birth': learner.dateOfBirth ? new Date(learner.dateOfBirth).toLocaleDateString('en-GB') : '',
      'Birth Entry Number': learner.upiNumber || '',
      'Disability type (if any)': learner.specialNeeds || '',
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
      fields: ['S/No', 'Surname', 'First Name', 'Other Names', 'Gender', 'Date of Birth', 'Birth Entry Number', 'Disability type (if any)', 'Learner Name', 'Adm No', 'Class', 'Term', 'Year', 'Parent/Guardian', 'Phone 1', 'Phone 2', 'Reg Date', 'Bal Due']
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
  const fields = [
    'S/No',
    'Unique Learner Identifier (ULI)',
    'Learners First Name',
    'Learner Middle Name',
    'Learner Last Name',
    'Grade',
    'Gender',
    'Age',
    'Date of Birth',
    'SNE Status',
    'SNE Type',
    'KCPE/KCSE Index Number',
    'Admission Number',
    'Stream',
    'Parent/Guardian Name',
    'Parent Phone',
    'Relationship',
    'Reg Date'
  ];
  const template = [
    {
      'S/No': '1',
      'Unique Learner Identifier (ULI)': 'KEN202611RMCJE8YO-0',
      'Learners First Name': 'Munira',
      'Learner Middle Name': 'Hussein',
      'Learner Last Name': 'Boru',
      'Grade': 'Grade 4',
      'Gender': 'Female',
      'Age': '9',
      'Date of Birth': '2017-04-12',
      'SNE Status': 'NO',
      'SNE Type': 'NA',
      'KCPE/KCSE Index Number': 'B007601065',
      'Admission Number': '',
      'Stream': 'Blue',
      'Parent/Guardian Name': 'Hussein Boru',
      'Parent Phone': '0712345678',
      'Relationship': 'Father',
      'Reg Date': '29-07-2026'
    },
    {
      'S/No': '2',
      'Unique Learner Identifier (ULI)': 'KEN202611YC9KSJI-6',
      'Learners First Name': 'Farhat',
      'Learner Middle Name': 'Abdishakur',
      'Learner Last Name': 'Mohamed',
      'Grade': 'Grade 4',
      'Gender': 'Female',
      'Age': '9',
      'Date of Birth': '2017-06-20',
      'SNE Status': 'NO',
      'SNE Type': 'NA',
      'KCPE/KCSE Index Number': 'B007600983',
      'Admission Number': '',
      'Stream': 'Blue',
      'Parent/Guardian Name': 'Abdishakur Mohamed',
      'Parent Phone': '0722000111',
      'Relationship': 'Father',
      'Reg Date': '29-07-2026'
    }
  ];
  const parser = new Parser({ fields });
  const csv = parser.parse(template);
  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename="trendscore_learners_template.csv"');
  res.send(csv);
});

/**
 * GET /api/bulk/learners/template/kemis
 * Direct KEMIS Standard CSV Template
 */
router.get(
  '/template/kemis',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  (_req: Request, res: Response) => {
  const fields = [
    'S. No',
    'Unique Learner Identifier(ULI)',
    'KCPE/KCSE Index Number',
    'Learners First Name',
    'Learner Middle Name',
    'Learner Last Name',
    'Institution',
    'Grade',
    'Gender',
    'SNE Status',
    'SNE Type',
    'Age',
    'Created Date',
    'Created By',
    'Stream',
    'Parent Name',
    'Parent Phone',
    'Relationship'
  ];
  const template = [
    {
      'S. No': '1',
      'Unique Learner Identifier(ULI)': 'KEN202611RMCJE8YO-0',
      'KCPE/KCSE Index Number': 'B007601065',
      'Learners First Name': 'Munira',
      'Learner Middle Name': 'Hussein',
      'Learner Last Name': 'Boru',
      'Institution': 'IBSE ACADEMY',
      'Grade': 'Grade 4',
      'Gender': 'Female',
      'SNE Status': 'NO',
      'SNE Type': 'NA',
      'Age': '9',
      'Created Date': '29-07-2026',
      'Created By': 'IBSE ACADEMY',
      'Stream': 'Blue',
      'Parent Name': 'Hussein Boru',
      'Parent Phone': '0712345678',
      'Relationship': 'Father'
    },
    {
      'S. No': '2',
      'Unique Learner Identifier(ULI)': 'KEN202611YC9KSJI-6',
      'KCPE/KCSE Index Number': 'B007600983',
      'Learners First Name': 'Farhat',
      'Learner Middle Name': 'Abdishakur',
      'Learner Last Name': 'Mohamed',
      'Institution': 'IBSE ACADEMY',
      'Grade': 'Grade 4',
      'Gender': 'Female',
      'SNE Status': 'NO',
      'SNE Type': 'NA',
      'Age': '9',
      'Created Date': '29-07-2026',
      'Created By': 'IBSE ACADEMY',
      'Stream': 'Blue',
      'Parent Name': 'Abdishakur Mohamed',
      'Parent Phone': '0722000111',
      'Relationship': 'Father'
    }
  ];
  const parser = new Parser({ fields });
  const csv = parser.parse(template);
  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename="kemis_learners_template.csv"');
  res.send(csv);
});

export default router;
