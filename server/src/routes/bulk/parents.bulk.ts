import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { rateLimit } from '../../middleware/enhanced-rateLimit.middleware';
import { auditLog } from '../../middleware/permissions.middleware';
import { UserStatus } from '@prisma/client';
import prisma from '../../config/database';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { Readable } from 'stream';
import { z } from 'zod';
import { buildParentLoginEmail, parentService } from '../../services/parent.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const parentSchema = z.object({
  'First Name': z.string().min(1, 'First name is required'),
  'Last Name': z.string().min(1, 'Last name is required'),
  'Email': z.string().email('Invalid email').optional().or(z.literal('')),
  'Phone': z.string().min(1, 'Phone is required'),
  'Phone 2': z.string().optional(),
  'WhatsApp Number': z.string().optional(),
  'Student Admission Numbers': z.string().optional(),
  'Status': z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

/**
 * POST /api/bulk/parents/upload
 */
router.post(
  '/upload',
  upload.single('file'),
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('BULK_UPLOAD_PARENTS'),
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
            const validated = parentSchema.parse(data);
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
        const loginEmail = buildParentLoginEmail(csvData['Phone']);
        if (!loginEmail) {
          failed.push({
            line: item.line,
            email: csvData['Email'] || null,
            name: `${csvData['First Name']} ${csvData['Last Name']}`,
            reason: 'Phone is required before issuing a parent login account'
          });
          continue;
        }

        const existing = await prisma.user.findUnique({
          where: { email: loginEmail }
        });

        if (existing && existing.role !== 'PARENT') {
          failed.push({
            line: item.line,
            email: loginEmail,
            name: `${csvData['First Name']} ${csvData['Last Name']}`,
            reason: 'Login email already exists for a non-parent user'
          });
          continue;
        }

        const parent = await parentService.getOrCreateParent({
          name: `${csvData['First Name']} ${csvData['Last Name']}`,
          phone: csvData['Phone'],
          status: (csvData['Status'] as UserStatus) || 'ACTIVE'
        });

        if (!parent) {
          throw new Error('Failed to create parent account');
        }

        if (csvData['Student Admission Numbers']) {
          const admNos = csvData['Student Admission Numbers']
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);

          for (const admNo of admNos) {
            const learner = await prisma.learner.findFirst({
              where: { admissionNumber: admNo }
            });

            if (learner) {
              await prisma.learner.update({
                where: { id: learner.id },
                data: {
                  parentId: parent.id,
                  guardianName: `${csvData['First Name']} ${csvData['Last Name']}`,
                  guardianPhone: csvData['Phone'],
                }
              });
            }
          }
        }

        created.push({
          line: item.line,
          id: parent.id,
          email: parent.email,
          name: `${csvData['First Name']} ${csvData['Last Name']}`
        });

      } catch (error) {
        const csvData = item.data;
        failed.push({
          line: item.line,
          email: csvData['Email'] || null,
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
 * GET /api/bulk/parents/export
 */
router.get(
  '/export',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('BULK_EXPORT_PARENTS'),
  async (req: AuthRequest, res: Response) => {
  try {
    const parents = await prisma.user.findMany({
      where: {
        role: 'PARENT',
        archived: false,
      },
      include: {
        learners: {
          select: {
            admissionNumber: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { lastName: 'asc' }
    });

    const csvData = parents.map((parent, index) => ({
      'ID': index + 1,
      'First Name': parent.firstName,
      'Last Name': parent.lastName,
      'Email': parent.email,
      'Phone': parent.phone || '',
      'Phone 2': '',
      'WhatsApp Number': parent.phone || '',
      'Student Admission Numbers': parent.learners.map((l: any) => l.admissionNumber).join(', '),
      'Student Names': parent.learners.map((l: any) => `${l.firstName} ${l.lastName}`).join(', '),
      'Status': parent.status,
      'Created Date': parent.createdAt ?
        new Date(parent.createdAt).toLocaleDateString('en-GB') : ''
    }));

    const parser = new Parser({
      fields: [
        'ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Phone 2',
        'WhatsApp Number', 'Student Admission Numbers', 'Student Names', 'Status', 'Created Date'
      ]
    });
    const csv = parser.parse(csvData);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="parents_export_${Date.now()}.csv"`);
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
 * GET /api/bulk/parents/template
 */
router.get(
  '/template',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  (_req: Request, res: Response) => {
  const template = [
    {
      'ID': '1',
      'First Name': 'Jane',
      'Last Name': 'Doe',
      'Email': 'jane.doe@email.com',
      'Phone': '0712345678',
      'Phone 2': '0798765432',
      'WhatsApp Number': '0712345678',
      'Student Admission Numbers': '1001, 1002',
      'Status': 'ACTIVE'
    }
  ];

  const parser = new Parser({
    fields: [
      'ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Phone 2',
      'WhatsApp Number', 'Student Admission Numbers', 'Status'
    ]
  });
  const csv = parser.parse(template);

  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename="parents_template.csv"');
  res.send(csv);
});

export default router;
