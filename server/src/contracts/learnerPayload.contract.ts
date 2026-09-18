import { z } from 'zod';

const asOptionalString = z.string().trim().max(255).optional().or(z.literal(''));
const asOptionalPhotoString = z.preprocess(
  (value) => (value === null || value === '' ? undefined : value),
  z.string().optional()
);

const rawLearnerSchema = z.object({
  admissionNumber: z.string().trim().max(50).optional(),
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().min(2).max(100).optional(),
  middleName: asOptionalString,
  dateOfBirth: z.string().optional(),
  gender: z.string().trim().optional(),
  grade: z.string().trim().max(50).optional(),
  stream: asOptionalString,
  upiNumber: asOptionalString,
  dateOfAdmission: z.string().optional(),
  parentId: asOptionalString,
  guardianName: asOptionalString,
  guardianPhone: asOptionalString,
  guardianEmail: asOptionalString,
  guardianRelation: asOptionalString,
  fatherName: asOptionalString,
  fatherPhone: asOptionalString,
  fatherEmail: asOptionalString,
  fatherDeceased: z.boolean().optional(),
  motherName: asOptionalString,
  motherPhone: asOptionalString,
  motherEmail: asOptionalString,
  motherDeceased: z.boolean().optional(),
  primaryContactType: asOptionalString,
  primaryContactName: asOptionalString,
  primaryContactPhone: asOptionalString,
  primaryContactEmail: asOptionalString,
  bloodGroup: asOptionalString,
  allergies: asOptionalString,
  medicalConditions: asOptionalString,
  specialNeeds: asOptionalString,
  emergencyContact: asOptionalString,
  emergencyPhone: asOptionalString,
  address: asOptionalString,
  county: asOptionalString,
  subCounty: asOptionalString,
  previousSchool: asOptionalString,
  religion: asOptionalString,
  nationality: asOptionalString,
  previousClass: asOptionalString,
  doctorName: asOptionalString,
  doctorPhone: asOptionalString,
  isTransportStudent: z.boolean().optional(),
  photo: asOptionalPhotoString,
  isScholarshipStudent: z.boolean().optional(),
  scholarshipType: asOptionalString,
  scholarshipAmount: z.union([z.string(), z.number()]).optional(),
  generateInvoice: z.boolean().optional(),
  changeReason: z.string().trim().max(500).optional().or(z.literal('')),
  status: asOptionalString,
  exitDate: z.string().optional(),
  exitReason: asOptionalString,
  orphanFields: z.record(z.string()).optional(),
}).strict();

const applyOrphanMapping = (payload: Record<string, any>) => {
  const normalized: Record<string, any> = { ...payload };
  const orphanFields = { ...(payload.orphanFields || {}) };

  if (payload.previousClass) orphanFields.previousClass = String(payload.previousClass).trim();
  if (payload.doctorName) orphanFields.doctorName = String(payload.doctorName).trim();
  if (payload.doctorPhone) orphanFields.doctorPhone = String(payload.doctorPhone).trim();

  if (!normalized.emergencyContact && payload.doctorName) normalized.emergencyContact = payload.doctorName;
  if (!normalized.emergencyPhone && payload.doctorPhone) normalized.emergencyPhone = payload.doctorPhone;

  delete normalized.previousClass;
  delete normalized.doctorName;
  delete normalized.doctorPhone;
  normalized.orphanFields = orphanFields;
  return normalized;
};

export const createLearnerPayloadSchema = rawLearnerSchema
  .extend({
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().min(2).max(100),
    grade: z.string().trim().max(50),
  })
  .transform(applyOrphanMapping);

export const updateLearnerPayloadSchema = rawLearnerSchema
  .partial()
  .transform(applyOrphanMapping);
