import { timingSafeEqual } from 'crypto';

/**
 * A deliberately opt-in credential override for local test environments.
 *
 * It never changes a user's saved password and is unavailable in production.
 * Keeping the password in environment configuration (rather than source code)
 * makes disabling it a one-line configuration change after testing.
 */
export const isTestPasswordOverrideEnabled = (): boolean =>
  process.env.NODE_ENV !== 'production' &&
  process.env.ENABLE_TEST_PASSWORD_OVERRIDE === 'true' &&
  Boolean(process.env.TEST_PASSWORD_OVERRIDE);

export const matchesTestPasswordOverride = (password: string): boolean => {
  const configuredPassword = process.env.TEST_PASSWORD_OVERRIDE;
  if (!isTestPasswordOverrideEnabled() || !configuredPassword) return false;

  const supplied = Buffer.from(password, 'utf8');
  const expected = Buffer.from(configuredPassword, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};
