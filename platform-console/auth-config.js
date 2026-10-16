// TrendScore Platform Console auth config.
//
// Stage 2 (DB-backed users): bootstrap-only env credentials for the initial
// super_admin seed. platform_owner accounts are no longer created from env
// vars — they're created by hand through the Users UI once a super_admin is
// logged in. See TRENDSCORE_ERP_ADMIN_PLAN.md Phase 0 and the attached
// Console User Management execution plan.

const CONSOLE_BOOTSTRAP_SUPER_ADMIN_EMAIL = process.env.CONSOLE_SUPER_ADMIN_EMAIL || '';
const CONSOLE_BOOTSTRAP_SUPER_ADMIN_PASSWORD = process.env.CONSOLE_SUPER_ADMIN_PASSWORD || '';

if (
  (CONSOLE_BOOTSTRAP_SUPER_ADMIN_EMAIL && !CONSOLE_BOOTSTRAP_SUPER_ADMIN_PASSWORD)
  || (!CONSOLE_BOOTSTRAP_SUPER_ADMIN_EMAIL && CONSOLE_BOOTSTRAP_SUPER_ADMIN_PASSWORD)
) {
  throw new Error('Both CONSOLE_SUPER_ADMIN_EMAIL and CONSOLE_SUPER_ADMIN_PASSWORD must be set.');
}

const JWT_SECRET = process.env.CONSOLE_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.CONSOLE_JWT_EXPIRES_IN || '8h';
// Short-lived — only covers the gap between password check and TOTP
// verification, not a real session.
const MFA_PENDING_EXPIRES_IN = process.env.CONSOLE_MFA_PENDING_EXPIRES_IN || '5m';

// Which roles can access which sections. 'leads' was previously missing
// here entirely (found in the TRENDSCORE_ERP_ADMIN_PLAN.md v3 audit) even
// though the Leads & CRM nav item isn't gated in index.html and the
// /api/leads routes are gated separately at the route level — fixed by
// including it explicitly for both roles below. 'users' is new, and is
// deliberately super_admin-only: user management is the one console
// capability that can create or remove access for everyone else.
const ROLE_ACCESS = {
  super_admin: ['overview', 'instances', 'storage', 'deployments', 'controls', 'billing', 'communications', 'leads', 'logs', 'users'],
  platform_owner: ['overview', 'instances', 'storage', 'deployments', 'billing', 'leads', 'logs'],
};

module.exports = {
  CONSOLE_BOOTSTRAP_SUPER_ADMIN_EMAIL,
  CONSOLE_BOOTSTRAP_SUPER_ADMIN_PASSWORD,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  MFA_PENDING_EXPIRES_IN,
  ROLE_ACCESS,
};
