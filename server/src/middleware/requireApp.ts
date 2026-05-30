/**
 * Legacy module gate.
 *
 * Package selection is now owned by admin-console school provisioning, so
 * in-school routes should not depend on SchoolAppConfig rows.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './permissions.middleware';

export const requireApp = (_slug: string) => {
  return (_req: AuthRequest, _res: Response, next: NextFunction): void => {
    next();
  };
};
