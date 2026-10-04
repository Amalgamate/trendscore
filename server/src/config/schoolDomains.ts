/**
 * Server-owned school domain rules for the universal driver app.
 *
 * A phone running one universal APK must discover which school's API to use at
 * runtime. It does that with a short CODE, never a URL: the origin is always
 * rebuilt from DEPLOYMENT_DOMAIN here, so a tampered client cannot redirect the
 * app at a host of its choosing.
 */

export const DEPLOYMENT_DOMAIN =
  (process.env.DEPLOYMENT_DOMAIN || 'trendscore.co.ke').trim().toLowerCase();

/**
 * Subdomains the platform itself uses. A school code matching one of these is
 * rejected so a school cannot shadow api./admin./mail. and hijack deep links or
 * password-reset mail.
 */
export const RESERVED_SUBDOMAINS: string[] = (
  process.env.SUBDOMAIN_RESERVED_WORDS ||
  'www,api,mail,admin,support,blog,contact,help,docs,status'
)
  .split(',')
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);

const CODE_PATTERN = /^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])$/;

/**
 * Normalise whatever the phone sent into a bare lowercase code, or null if it
 * cannot be one. Deliberately strict: no dots, slashes, ports, schemes or
 * whitespace, because this string is interpolated into a hostname.
 */
export function normalizeSchoolCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  if (!code || code.length > 32) return null;
  return CODE_PATTERN.test(code) ? code : null;
}

export function isReservedSubdomain(code: string): boolean {
  return RESERVED_SUBDOMAINS.includes(code.toLowerCase());
}