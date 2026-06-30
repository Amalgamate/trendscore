/**
 * Validation Schemas using Zod
 * Centralized validation patterns for common inputs
 */

import { z } from 'zod';

// ============================================
// AUTH VALIDATION SCHEMAS
// ============================================

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase();

// Sanitize string: remove HTML and script tags
const sanitizePassword = (input: string): string => {
  // Remove any HTML-like patterns and script tags
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
};

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .refine(
    (val) => val === sanitizePassword(val),
    'Password cannot contain HTML or script tags'
  );

const optionalEmailSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  emailSchema.optional()
);

const optionalLoginPhoneSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(9, 'Phone number is required').max(20, 'Phone number is too long').optional()
);

export const loginSchema = z.object({
  email: optionalEmailSchema,
  phone: optionalLoginPhoneSchema,
  password: z.string().min(1, 'Password is required')
}).refine((data) => Boolean(data.email || data.phone), {
  message: 'Email or phone number is required',
  path: ['email'],
});

export const phoneOtpRequestSchema = z.object({
  phone: z.string().min(9, 'Phone number is required').max(20, 'Phone number is too long')
});

export const phoneOtpVerifySchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
  phone: z.string().min(9, 'Phone number is required').max(20, 'Phone number is too long'),
  code: z.string().regex(/^\d{6}$/, 'OTP code must be 6 digits')
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters'),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional(),
  role: z.enum([
    'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 
    'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 
    'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 
    'GROUNDSKEEPER', 'IT_SUPPORT', 'STUDENT'
  ]).optional()
});

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(2).max(50),
  middleName: z.string().max(50).optional().nullable(),
  lastName: z.string().min(2).max(50),
  phone: z.string().optional().nullable(),
  role: z.enum([
    'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 
    'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 
    'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 
    'GROUNDSKEEPER', 'IT_SUPPORT', 'STUDENT'
  ]),
  roles: z.array(
    z.enum([
      'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM',
      'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
      'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER',
      'GROUNDSKEEPER', 'IT_SUPPORT', 'STUDENT'
    ])
  ).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  staffId: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  firstName: z.string().min(2).max(50).optional(),
  middleName: z.string().max(50).optional().nullable(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().optional().nullable(),
  role: z.enum([
    'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 
    'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN', 
    'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER', 
    'GROUNDSKEEPER', 'IT_SUPPORT', 'STUDENT'
  ]).optional(),
  roles: z.array(
    z.enum([
      'SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM',
      'TEACHER', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
      'NURSE', 'SECURITY', 'DRIVER', 'COOK', 'CLEANER',
      'GROUNDSKEEPER', 'IT_SUPPORT', 'STUDENT'
    ])
  ).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  staffId: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  profilePicture: z.string().url().optional().nullable(),
});

// ============================================
// COMMON VALIDATION SCHEMAS
// ============================================

export const idSchema = z
  .string()
  .uuid('Invalid ID format')
  .or(z.string().min(1).max(255));

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50)
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
}).refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return new Date(data.startDate) <= new Date(data.endDate);
  },
  { message: 'startDate must be before or equal to endDate' }
);

// ============================================
// SCHOOL/TENANT VALIDATION
// ============================================

export const schoolNameSchema = z
  .string()
  .min(3, 'School name must be at least 3 characters')
  .max(100, 'School name must not exceed 100 characters');

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

// ============================================
// GRADING VALIDATION
// ============================================

export const gradeSchema = z
  .number()
  .min(0, 'Grade must be at least 0')
  .max(100, 'Grade must not exceed 100');

export const weightSchema = z
  .number()
  .min(0, 'Weight must be at least 0')
  .max(100, 'Weight must not exceed 100');

export const termWeightsSchema = z.object({
  formativeWeight: weightSchema,
  summativeWeight: weightSchema
}).refine(
  (data) => Math.abs(data.formativeWeight + data.summativeWeight - 100) < 0.01,
  { message: 'Formative and summative weights must sum to 100%' }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Safely validate data against schema
 * Returns parsed data or throws validation error
 */
export const validateInput = <T>(schema: z.ZodSchema, data: unknown): T => {
  try {
    return schema.parse(data) as T;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Validation failed: ${messages.join('; ')}`);
    }
    throw error;
  }
};

/**
 * Safe validation that returns result object
 */
export const validateInputSafe = <T>(
  schema: z.ZodSchema,
  data: unknown
): { success: boolean; data?: T; errors?: string[] } => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    return { success: false, errors };
  }
  return { success: true, data: result.data as T };
};

// ============================================
// STUDENT PHONE LOGIN SCHEMAS
// ============================================

// XSS patterns mirrored from password.util.ts for use in input validation
const XSS_PATTERNS_INLINE = [
  /<script[^>]*>/gi,
  /<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<object[^>]*>/gi,
];

const containsXSS = (value: string): boolean =>
  XSS_PATTERNS_INLINE.some((pattern) => {
    pattern.lastIndex = 0; // reset stateful regex flags
    return pattern.test(value);
  });

/**
 * Validates the phone lookup endpoint body.
 * Accepts phone strings that contain 9–12 digit characters after stripping
 * all non-digit characters (Kenyan phone format). Rejects XSS patterns.
 */
export const studentPhoneLookupSchema = z.object({
  phone: z
    .string()
    .refine((val) => !containsXSS(val), {
      message: 'Phone number contains unsafe content',
    })
    .refine(
      (val) => {
        const digits = val.replace(/\D/g, '');
        return digits.length >= 9 && digits.length <= 12;
      },
      {
        message: 'Phone number must contain between 9 and 12 digits',
      }
    ),
});

/**
 * Validates the student phone login endpoint body.
 * - sessionToken: non-empty, must match {base64url}.{hex-signature} format
 * - studentUserId: non-empty string
 * - password: 6–200 characters, rejects XSS patterns
 */
export const studentPhoneLoginSchema = z.object({
  sessionToken: z
    .string()
    .min(1, 'Session token is required')
    .refine(
      (val) => {
        // Must have at least two parts separated by a dot;
        // first part is base64url, second part is a hex signature
        const dotIndex = val.indexOf('.');
        if (dotIndex < 1) return false;
        const payload = val.slice(0, dotIndex);
        const signature = val.slice(dotIndex + 1);
        return (
          payload.length > 0 &&
          signature.length > 0 &&
          /^[A-Za-z0-9_-]+$/.test(payload) &&
          /^[0-9a-fA-F]+$/.test(signature)
        );
      },
      {
        message: 'Session token format is invalid',
      }
    ),
  studentUserId: z.string().min(1, 'Student user ID is required'),
  password: z
    .string()
    .min(6, 'Password must be between 6 and 200 characters')
    .max(200, 'Password must be between 6 and 200 characters')
    .refine((val) => !containsXSS(val), {
      message: 'Password contains unsafe content',
    }),
});

export type StudentPhoneLookupInput = z.infer<typeof studentPhoneLookupSchema>;
export type StudentPhoneLoginInput = z.infer<typeof studentPhoneLoginSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PhoneOtpRequestInput = z.infer<typeof phoneOtpRequestSchema>;
export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
