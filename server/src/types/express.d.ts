/**
 * Express global augmentation — impersonation session fields
 *
 * These two optional fields extend the existing req.user shape (declared in
 * permissions.middleware.ts) so that the authenticate middleware and any
 * downstream controller/guard can distinguish impersonation sessions from
 * normal sessions without breaking existing callers.
 *
 * Requirements: 6.1, 6.2, 6.3
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: import('../config/permissions').Role;
        roles?: import('../config/permissions').Role[];
        /**
         * True when the current request is authenticated with an impersonation
         * token (isImpersonation: true in the JWT payload).  Undefined / false
         * on all normal (non-impersonation) requests — downstream code should
         * use `=== true` rather than truthiness alone to avoid false positives.
         */
        isImpersonation?: boolean;
        /**
         * The userId of the original admin who initiated the impersonation
         * session.  Present whenever isImpersonation === true; undefined on
         * all normal requests.
         */
        originalAdminId?: string;
      };
    }
  }
}

export {};
