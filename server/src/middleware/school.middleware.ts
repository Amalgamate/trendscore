import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

interface SchoolContextRequest extends Request {
  schoolContext?: { schoolId: string };
}

/**
 * Finance models are not school-scoped, so these routes are safe only while
 * the documented single-school-per-database invariant holds.
 */
export const requireSingleSchoolContext = async (
  req: SchoolContextRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const schools = await prisma.school.findMany({
      select: { id: true, active: true, archived: true },
      take: 2,
    });

    if (schools.length !== 1 || !schools[0].active || schools[0].archived) {
      return next(
        new ApiError(503, 'Finance services require exactly one active school in this database')
          .withCode('SINGLE_SCHOOL_REQUIRED')
      );
    }

    req.schoolContext = { schoolId: schools[0].id };
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Pass-through for single-tenant architecture.
 * In a more restrictive setup, this could verify a School record exists.
 */
export const requireSchoolContext = (req: Request, _res: Response, next: NextFunction) => {
  (req as any).schoolContext = { schoolId: null };
  next();
};

/**
 * Pass-through for single-tenant architecture.
 */
export const enforceSchoolContextConsistency = (req: Request, _res: Response, next: NextFunction) => {
  (req as any).schoolContext = { schoolId: null };
  next();
};

export const requireSchool = (req: Request, _res: Response, next: NextFunction) => {
  (req as any).schoolContext = (req as any).schoolContext || { schoolId: null };
  next();
};

export const requireBranch = (_req: Request, _res: Response, next: NextFunction) => next();
