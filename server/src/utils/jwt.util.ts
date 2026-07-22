import * as jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { Role } from '../config/permissions';

type InstitutionType = 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';

interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  roles?: Role[];
  institutionType: InstitutionType;
  isImpersonation?: boolean;
  originalAdminId?: string;
  iat?: number;
}

interface User {
  id: string;
  email: string;
  role: UserRole;
  roles?: UserRole[];
  institutionType: InstitutionType;
}

export const generateAccessToken = (user: User): string => {
  const roles = Array.from(new Set([
    user.role,
    ...(user.roles && user.roles.length > 0 ? user.roles : []),
  ])) as Role[];

  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    roles,
    institutionType: user.institutionType,
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET as jwt.Secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
  );
};

export const generateRefreshToken = (user: User, rememberMe = false): string => {
  return jwt.sign(
    { userId: user.id, rememberMe },
    process.env.JWT_REFRESH_SECRET!,
    {
      expiresIn: rememberMe
        ? process.env.JWT_REMEMBER_REFRESH_EXPIRES_IN || '30d'
        : process.env.JWT_REFRESH_EXPIRES_IN || '24h',
    } as jwt.SignOptions
  );
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
};

export const verifyRefreshToken = (token: string): { userId: string; rememberMe?: boolean; iat?: number } => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string; rememberMe?: boolean; iat?: number };
};
