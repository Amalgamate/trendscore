import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { rateLimit } from '../../middleware/enhanced-rateLimit.middleware';
import { auditLog } from '../../middleware/permissions.middleware';
import { UserRole, UserStatus } from '@prisma/client';
import prisma from '../../config/database';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { Readable } from 'stream';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const teacherSchema = z.object({
  'Staff ID': z.string().optional(),
  'First Name': z.string().min(1, 'First name is required'),
  'Last Name': z.string().min(1, 'Last name is required'),
  'Email': z.string().email('Invalid email'),
  'Phone': z.string().optional(),
  'Role': z.enum(['TEACHER', 'HEAD_TEACHER', 'ADMIN']).optional(),
  'Branch Code': z.string().optional(),
  'Subjects': z.string().optional(),
  'Status': z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

/**
 * POST /api/bulk/teachers/upload
 */
router.post(
  '/upload',
  upload.single('file'),
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('BULK_UPLOAD_TEACHERS'),
  async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results: any[] = [];
    const errors: any[] = [];
    let lineNumber = 1;

    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on('data', (data) => {
          lineNumber++;
          try {
            const validated = teacherSchema.parse(data);
            results.push({
              line: lineNumber,
              data: validated,
              valid: true
            });
          } catch (error) {
            errors.push({
              line: lineNumber,
              data,
              error: error instanceof z.ZodError ? error.errors : 'Validation failed',
              valid: false
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const created: any[] = [];
    const failed: any[] = [];

    for (const item of results) {
      try {
        const csvData = item.data;

        const existing = await prisma.user.findUnique({
          where: { email: csvData['Email'] }
        });

        if (existing) {
          failed.push({
            line: item.line,
            email: csvData['Email'],
            name: `${csvData['First Name']} ${csvData['Last Name']}`,
            reason: 'Email already exists'
          });
          continue;
        }

        const hashedPassword = await bcrypt.hash('Teacher@123', 10);

        const teacher = await prisma.user.create({
          data: {
            email: csvData['Email'],
            password: hashedPassword,
            firstName: csvData['First Name'],
            lastName: csvData['Last Name'],
            phone: csvData['Phone'],
            staffId: csvData['Staff ID'],
            role: (csvData['Role'] as UserRole) || 'TEACHER',
            status: (csvData['Status'] as UserStatus) || 'ACTIVE',
          }
        });

        created.push({
          line: item.line,
          id: teacher.id,
          email: csvData['Email'],
          name: `${csvData['First Name']} ${csvData['Last Name']}`
        });

      } catch (error) {
        const csvData = item.data;
        failed.push({
          line: item.line,
          email: csvData['Email'],
          name: `${csvData['First Name']} ${csvData['Last Name']}`,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: lineNumber - 1,
        processed: results.length,
        created: created.length,
        failed: failed.length + errors.length,
        validationErrors: errors.length
      },
      details: {
        created,
        failed,
        validationErrors: errors
      }
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/bulk/teachers/export
 */
router.get(
  '/export',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('BULK_EXPORT_TEACHERS'),
  async (req: AuthRequest, res: Response) => {
  try {
    const { role, status } = req.query;

    const where: any = {
      role: { in: ['TEACHER', 'HEAD_TEACHER', 'ADMIN'] },
      archived: false,
    };
    if (role) where.role = role;
    if (status) where.status = status;

    const teachers = await prisma.user.findMany({
      where,
      orderBy: { lastName: 'asc' }
    });

    const csvData = teachers.map((teacher, index) => ({
      'ID': index + 1,
      'Staff ID': teacher.staffId || '',
      'First Name': teacher.firstName,
      'Last Name': teacher.lastName,
      'Email': teacher.email,
      'Phone': teacher.phone || '',
      'Role': teacher.role,
      'Status': teacher.status,
      'Created Date': teacher.createdAt ?
        new Date(teacher.createdAt).toLocaleDateString('en-GB') : ''
    }));

    const parser = new Parser({
      fields: [
        'ID', 'Staff ID', 'First Name', 'Last Name', 'Email',
        'Phone', 'Role', 'Status', 'Created Date'
      ]
    });
    const csv = parser.parse(csvData);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="teachers_export_${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Failed to export data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/bulk/teachers/template
 */
router.get(
  '/template',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  (_req: Request, res: Response) => {
  const template = [
    {
      'ID': '1',
      'Staff ID': 'TCH001',
      'First Name': 'John',
      'Last Name': 'Smith',
      'Email': 'john.smith@school.com',
      'Phone': '0712345678',
      'Role': 'TEACHER',
      'Branch Code': 'KB',
      'Subjects': 'Mathematics, Science',
      'Status': 'ACTIVE'
    }
  ];

  const parser = new Parser({
    fields: [
      'ID', 'Staff ID', 'First Name', 'Last Name', 'Email',
      'Phone', 'Role', 'Branch Code', 'Subjects', 'Status'
    ]
  });
  const csv = parser.parse(template);

  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename="teachers_template.csv"');
  res.send(csv);
});

export default router;
