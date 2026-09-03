/**
 * User Controller
 * Handles user management operations for a single-tenant environment
 * 
 * @module controllers/user.controller
 */

import { Response } from 'express';
import bcrypt from 'bcrypt';
import { PRODUCT_APP_URL, PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { Role, canManageRole } from '../config/permissions';
import { USER_ROLES } from '../config/roleDefinitions';
import { whatsappService } from '../services/whatsapp.service';
import { SmsService } from '../services/sms.service';
import { SMS_MESSAGES } from '../config/communication.messages';
import { generateStaffId } from '../services/staffId.service';
import { redisCacheService } from '../services/redis-cache.service';
import { buildParentLoginEmail } from '../services/parent.service';

const VALID_ROLES = [...USER_ROLES];

const normalizeRoles = (input: unknown): Role[] => {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((r) => String(r || '').toUpperCase())
    .filter((r): r is Role => VALID_ROLES.includes(r as Role));
  return Array.from(new Set(normalized));
};

const trimOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const userProfileSelect = {
  id: true,
  email: true,
  firstName: true,
  middleName: true,
  lastName: true,
  phone: true,
  role: true,
  roles: true,
  status: true,
  institutionType: true,
  staffId: true,
  subject: true,
  gender: true,
  profilePicture: true,
  createdAt: true,
  updatedAt: true
} as const;

export class UserController {
  /**
   * Get all users
   */
  async getAllUsers(req: AuthRequest, res: Response) {
    const currentUserRole = req.user!.role;
    const includeArchived = req.query.includeArchived === 'true';
    const { search, role, status } = req.query;

    let whereClause: any = {};
    if (!includeArchived) {
      whereClause.archived = false;
    }

    if (currentUserRole === 'HEAD_TEACHER' || currentUserRole === 'HEAD_OF_CURRICULUM') {
      whereClause.role = { in: ['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'] };
    }

    if (role && typeof role === 'string' && !['HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(currentUserRole)) {
      whereClause.role = role.toUpperCase();
    }

    if (status && typeof status === 'string' && status.toLowerCase() !== 'all') {
      whereClause.status = status.toUpperCase();
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { middleName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { staffId: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phone: true,
        role: true,
        roles: true,
        status: true,
        emailVerified: true,
        verificationRequired: true,
        archived: true,
        createdAt: true,
        lastLogin: true,
        staffId: true,
        subject: true,
        gender: true,
        lockedUntil: true,
        classesAsTeacher: {
          where: { active: true, archived: false },
          select: { id: true, name: true, grade: true, stream: true, academicYear: true, term: true },
          orderBy: [{ academicYear: 'desc' }, { term: 'desc' }]
        },
        subjectAssignments: {
          where: { active: true },
          select: {
            id: true,
            grade: true,
            classId: true,
            learningArea: {
              select: { id: true, name: true, shortName: true, gradeLevel: true }
            },
            class: {
              select: { id: true, name: true, grade: true, stream: true }
            }
          },
          orderBy: [
            { grade: 'asc' },
            { createdAt: 'asc' }
          ]
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  }

  /**
   * Get single user by ID
   */
  async getUserById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        role: true,
        roles: true,
        status: true,
        profilePicture: true,
        emailVerified: true,
        verificationRequired: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        staffId: true,
        subject: true,
        gender: true,
        learners: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            grade: true,
            stream: true
          }
        },
        classesAsTeacher: {
          select: { id: true, name: true, grade: true, stream: true }
        }
      }
    });

    if (!user) throw new ApiError(404, 'User not found');

    const canAccess = currentUserId === id || ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(currentUserRole);
    if (!canAccess) throw new ApiError(403, 'Access denied');

    res.json({ success: true, data: user });
  }

  /**
   * Create new user
   */
  async createUser(req: AuthRequest, res: Response) {
    let { email, password, firstName, lastName, middleName, phone, role, roles, subject, gender } = req.body;
    const currentUserRole = req.user!.role;

    if (!password || !firstName || !lastName || !role) {
      throw new ApiError(400, 'Missing required fields');
    }

    if (!VALID_ROLES.includes(role as Role)) {
      throw new ApiError(400, `Invalid role`);
    }

    const normalizedRoles = normalizeRoles(roles);
    const assignedRoles: Role[] = normalizedRoles.length > 0
      ? Array.from(new Set([role as Role, ...normalizedRoles]))
      : [role as Role];

    if ((role as Role) === 'PARENT') {
      const parentLoginEmail = buildParentLoginEmail(phone);
      if (!parentLoginEmail) {
        throw new ApiError(400, 'Parent phone number is required before issuing a login account');
      }
      email = parentLoginEmail;
    } else if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    for (const assignedRole of assignedRoles) {
      if (!canManageRole(currentUserRole, assignedRole)) {
        throw new ApiError(403, `You cannot create users with role: ${assignedRole}`);
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ApiError(400, 'User with this email already exists');

    const hashedPassword = await bcrypt.hash(password, 12);

    let staffId = req.body.staffId;
    const staffRoles: Role[] = ['ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST'];

    if (!staffId && staffRoles.includes(role as Role)) {
      staffId = await generateStaffId();
    }

    const user = await prisma.user.create({
      data: {
        email,
        username: (role as Role) === 'PARENT' ? email : req.body.username,
        password: hashedPassword,
        firstName,
        lastName,
        middleName,
        phone,
        role: role as Role,
        roles: assignedRoles,
        status: 'ACTIVE',
        verificationRequired: req.body.verificationRequired !== false,
        staffId,
        subject,
        gender,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        roles: true,
        status: true,
        staffId: true
      }
    });

    res.status(201).json({ success: true, data: user });
  }

  async getVerificationSettings(req: AuthRequest, res: Response) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
      throw new ApiError(403, 'Only admins can manage verification settings');
    }

    const school = await prisma.school.findFirst({
      where: { archived: false },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, requiresUserVerification: true }
    });

    res.json({
      success: true,
      data: {
        schoolId: school?.id || null,
        schoolName: school?.name || null,
        requiresUserVerification: school?.requiresUserVerification !== false
      }
    });
  }

  async updateSchoolVerificationSettings(req: AuthRequest, res: Response) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
      throw new ApiError(403, 'Only admins can manage verification settings');
    }

    const requiresUserVerification = req.body?.requiresUserVerification;
    if (typeof requiresUserVerification !== 'boolean') {
      throw new ApiError(400, 'requiresUserVerification must be true or false');
    }

    const school = await prisma.school.findFirst({
      where: { archived: false },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
    if (!school) throw new ApiError(404, 'School not found');

    const updated = await prisma.school.update({
      where: { id: school.id },
      data: { requiresUserVerification },
      select: { id: true, name: true, requiresUserVerification: true }
    });

    await redisCacheService.deleteByPrefix('auth:user:');

    res.json({
      success: true,
      message: requiresUserVerification
        ? 'User verification is now required for this school'
        : 'User verification is now disabled for this school',
      data: updated
    });
  }

  async updateUserVerificationRequirement(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const currentUserRole = req.user!.role;
    const verificationRequired = req.body?.verificationRequired;

    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole)) {
      throw new ApiError(403, 'Only admins can manage user verification');
    }
    if (typeof verificationRequired !== 'boolean') {
      throw new ApiError(400, 'verificationRequired must be true or false');
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new ApiError(404, 'User not found');
    if (!canManageRole(currentUserRole, targetUser.role as Role)) {
      throw new ApiError(403, 'Permission denied');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { verificationRequired },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        emailVerified: true,
        verificationRequired: true
      }
    });

    await redisCacheService.delete(`auth:user:${updated.email}`);

    res.json({
      success: true,
      message: verificationRequired
        ? 'Verification is now required for this user'
        : 'Verification is now bypassed for this user',
      data: updated
    });
  }

  async updateOwnProfile(req: AuthRequest, res: Response) {
    const currentUserId = req.user!.userId;
    const { firstName, middleName, lastName, phone, profilePicture } = req.body || {};

    const updateData: Record<string, unknown> = {};
    const normalizedFirstName = trimOptionalString(firstName);
    const normalizedMiddleName = trimOptionalString(middleName);
    const normalizedLastName = trimOptionalString(lastName);
    const normalizedPhone = trimOptionalString(phone);
    const normalizedProfilePicture = trimOptionalString(profilePicture);

    if (normalizedFirstName !== undefined) {
      if (!normalizedFirstName || normalizedFirstName.length < 2 || normalizedFirstName.length > 50) {
        throw new ApiError(400, 'First name must be between 2 and 50 characters');
      }
      updateData.firstName = normalizedFirstName;
    }

    if (normalizedLastName !== undefined) {
      if (!normalizedLastName || normalizedLastName.length < 2 || normalizedLastName.length > 50) {
        throw new ApiError(400, 'Last name must be between 2 and 50 characters');
      }
      updateData.lastName = normalizedLastName;
    }

    if (normalizedMiddleName !== undefined) {
      if (normalizedMiddleName && normalizedMiddleName.length > 50) {
        throw new ApiError(400, 'Middle name must be 50 characters or less');
      }
      updateData.middleName = normalizedMiddleName;
    }

    if (normalizedPhone !== undefined) {
      if (normalizedPhone && normalizedPhone.length > 30) {
        throw new ApiError(400, 'Phone number must be 30 characters or less');
      }
      updateData.phone = normalizedPhone;
    }

    if (normalizedProfilePicture !== undefined) {
      if (normalizedProfilePicture && normalizedProfilePicture.length > 2000) {
        throw new ApiError(400, 'Profile image URL is too long');
      }
      updateData.profilePicture = normalizedProfilePicture;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No profile changes provided');
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUserId },
      data: updateData,
      select: userProfileSelect
    });

    await redisCacheService.delete(`auth:user:${updatedUser.email}`);

    res.json({
      success: true,
      data: {
        ...updatedUser,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
        roles: updatedUser.roles && updatedUser.roles.length > 0 ? updatedUser.roles : [updatedUser.role],
      }
    });
  }

  /**
   * Update user
   */
  async updateUser(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;
    const { firstName, lastName, middleName, phone, role, roles, status, password, subject, gender, email } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new ApiError(404, 'User not found');

    const isSelfUpdate = currentUserId === id;
    const isSuperAdminEditingPeerSuperAdmin =
      currentUserRole === 'SUPER_ADMIN' && targetUser.role === 'SUPER_ADMIN' && !isSelfUpdate;
    const canUpdate = isSelfUpdate || canManageRole(currentUserRole, targetUser.role as Role) || isSuperAdminEditingPeerSuperAdmin;
    if (!canUpdate) throw new ApiError(403, 'Permission denied');

    const updateData: any = {};

    const resultingRole = ((role as Role) || targetUser.role) as Role;
    if (resultingRole === 'PARENT') {
      const parentPhone = phone !== undefined ? phone : targetUser.phone;
      const parentLoginEmail = buildParentLoginEmail(parentPhone);
      if (!parentLoginEmail) {
        throw new ApiError(400, 'Parent phone number is required before issuing a login account');
      }
      if (parentLoginEmail !== targetUser.email) {
        const existingUser = await prisma.user.findUnique({ where: { email: parentLoginEmail } });
        if (existingUser && existingUser.id !== id) {
          throw new ApiError(400, 'A parent login account already exists for this phone number');
        }
        updateData.email = parentLoginEmail;
        updateData.username = parentLoginEmail;
      }
    }

    // Only update email if it's provided and different from current
    if (resultingRole !== 'PARENT' && email && email !== targetUser.email) {
      // Security: Check if new email is already taken
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
      }
      updateData.email = email;
    }

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (middleName !== undefined) updateData.middleName = middleName;
    if (phone !== undefined) updateData.phone = phone;
    if (subject !== undefined) updateData.subject = subject;
    if (gender !== undefined) updateData.gender = gender;

    if (!isSelfUpdate && ['SUPER_ADMIN', 'ADMIN'].includes(currentUserRole)) {
      if (role) updateData.role = role as Role;
      if (roles !== undefined || role) {
        const normalizedRoles = normalizeRoles(roles);
        const baseRole = resultingRole;
        const assignedRoles: Role[] = normalizedRoles.length > 0
          ? Array.from(new Set([baseRole, ...normalizedRoles]))
          : [baseRole];
        for (const assignedRole of assignedRoles) {
          // A school admin may promote a user they already manage to the
          // ADMIN role. This does not allow managing an existing peer admin,
          // and SUPER_ADMIN remains restricted to system administrators.
          const canPromoteToPeerAdmin =
            currentUserRole === 'ADMIN' &&
            targetUser.role !== 'ADMIN' &&
            targetUser.role !== 'SUPER_ADMIN' &&
            assignedRole === 'ADMIN';
          if (!canManageRole(currentUserRole, assignedRole) && !canPromoteToPeerAdmin) {
            throw new ApiError(403, `You cannot assign role: ${assignedRole}`);
          }
        }
        updateData.roles = assignedRoles;
      }
      if (status) updateData.status = status;
    }

    if (password) {
      if (password.length < 8) throw new ApiError(400, 'Password too short');
      updateData.password = await bcrypt.hash(password, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        roles: true,
        status: true,
        staffId: true
      }
    });

    res.json({ success: true, data: updatedUser });
  }

  /**
   * Archive user
   */
  async archiveUser(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;

    if (currentUserId === id) throw new ApiError(403, 'Cannot archive self');

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new ApiError(404, 'User not found');

    if (currentUserRole === 'TEACHER' && targetUser.role !== 'PARENT') {
      throw new ApiError(403, 'Teachers can only archive parents');
    }

    const archivedUser = await prisma.user.update({
      where: { id },
      data: { archived: true, archivedAt: new Date(), archivedBy: currentUserId, status: 'INACTIVE' },
    });

    res.json({ success: true, message: 'User archived', data: archivedUser });
  }

  async unarchiveUser(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const currentUserRole = req.user!.role;

    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole)) {
      throw new ApiError(403, 'Only admins can unarchive');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { archived: false, archivedAt: null, archivedBy: null, status: 'ACTIVE' },
    });

    res.json({ success: true, message: 'User unarchived', data: updated });
  }

  async deleteUser(req: AuthRequest, res: Response) {
    const { id } = req.params;
    if (req.user!.role !== 'SUPER_ADMIN') throw new ApiError(403, 'SUPER_ADMIN only');

    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'Permanently deleted' });
  }

  async getUsersByRole(req: AuthRequest, res: Response) {
    const roleParam = (req.params.role || '').toUpperCase();
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let whereClause: any = { archived: false };
    
    // If requesting TEACHER role, include other teaching roles
    if (roleParam === 'TEACHER') {
        whereClause.role = { 
            in: ['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'] 
        };
    } else {
        whereClause.role = roleParam as any;
    }

    if (search) {
      const terms = String(search)
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean);

      if (terms.length > 0) {
        whereClause.AND = terms.map((term) => ({
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term } },
          ]
        }));
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          firstName: true,
          middleName: true,
          lastName: true,
          phone: true,
          role: true,
          roles: true,
          status: true,
          staffId: true,
          subject: true,
          gender: true,
          profilePicture: true,
          createdAt: true,
          learners: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              grade: true,
              stream: true
            }
          },
          classesAsTeacher: {
            where: { active: true, archived: false },
            select: { id: true, name: true, grade: true, stream: true, academicYear: true, term: true },
            orderBy: [{ academicYear: 'desc' }, { term: 'desc' }]
          },
          subjectAssignments: {
            where: { active: true },
            select: {
              id: true,
              grade: true,
              classId: true,
              learningArea: {
                select: { id: true, name: true, shortName: true, gradeLevel: true }
              },
              class: {
                select: { id: true, name: true, grade: true, stream: true }
              }
            },
            orderBy: [
              { grade: 'asc' },
              { createdAt: 'asc' }
            ]
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.user.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { total, page: Number(page), limit: Number(limit) }
    });
  }

  async getUserStats(req: AuthRequest, res: Response) {
    const counts = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    res.json({
      success: true,
      data: counts.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {} as any)
    });
  }

  async uploadProfilePicture(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { photoData } = req.body;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;

    if (currentUserId !== id && !['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(currentUserRole)) {
      throw new ApiError(403, 'Permission denied');
    }

    if (typeof photoData !== 'string' || !photoData.trim()) {
      throw new ApiError(400, 'Profile photo data is required');
    }

    if (!photoData.startsWith('data:image/')) {
      throw new ApiError(400, 'Profile photo must be an image');
    }

    const user = await prisma.user.update({
      where: { id },
      data: { profilePicture: photoData },
      select: userProfileSelect
    });

    await redisCacheService.delete(`auth:user:${user.email}`);

    res.json({ success: true, data: user });
  }

  async resetPassword(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { newPassword } = req.body;
    const currentUserRole = req.user!.role;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new ApiError(404, 'User not found');

    if (!canManageRole(currentUserRole, targetUser.role as Role)) {
      throw new ApiError(403, 'You do not have permission to reset this user\'s password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword, loginAttempts: 0, lockedUntil: null }
    });

    res.json({ success: true, message: 'Password reset' });
  }

  /**
   * Send Login Credentials
   * POST /api/users/:id/credentials
   */
  async sendCredentials(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const currentUserRole = req.user!.role;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new ApiError(404, 'User not found');

    if (!canManageRole(currentUserRole, targetUser.role as Role)) {
      throw new ApiError(403, 'Permission denied to send credentials for this user');
    }

    const tempPassword = randomBytes(9).toString('base64url');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    
    // Set passwordResetToken to trigger the "must change password" flag on login
    // set expiry to 24 hours from now
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);

    await prisma.user.update({
      where: { id },
      data: { 
        password: hashedPassword, 
        passwordResetToken: 'INITIAL_SETUP_REQUIRED',
        passwordResetExpiry: expiry,
        loginAttempts: 0,
        lockedUntil: null
      }
    });

    const school = await prisma.school.findFirst({ select: { name: true } });
    const schoolName = school?.name || PRODUCT_DISPLAY_NAME;
    const frontendUrl = process.env.FRONTEND_URL || PRODUCT_APP_URL;
    
    const loginId = targetUser.role === 'PARENT' ? (targetUser.parentCode || targetUser.username || targetUser.email) : (targetUser.username || targetUser.email);
    const message = `Welcome to ${schoolName}! Your account is ready.\n\nLogin URL: ${frontendUrl}\nUsername: ${loginId}\nTemp Password: ${tempPassword}\n\nPlease change your password immediately after logging in.`;

    const results: any = { sms: null, whatsapp: null };

    if (targetUser.phone) {
      results.sms = await SmsService.sendSms(targetUser.phone, message);
      results.whatsapp = await whatsappService.sendMessage({ to: targetUser.phone, message });
    }

    res.json({ 
      success: true, 
      message: 'Credentials dispatched successfully', 
      recipient: targetUser.phone,
      results 
    });
  }

  async searchParents(req: AuthRequest, res: Response) {
    const { search } = req.query;
    const whereClause: any = {
      role: 'PARENT',
      archived: false,
    };

    if (search) {
      const terms = String(search)
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean);

      if (terms.length > 0) {
        whereClause.AND = terms.map((term) => ({
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term } },
          ],
        }));
      }
    }

    const parents = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        profilePicture: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      data: parents,
    });
  }
}

export const userController = new UserController();
