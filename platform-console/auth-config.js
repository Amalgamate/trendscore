// TrendScore Platform Console auth config.
// Credentials and secrets must come from environment variables so they are not
// committed to GitHub or baked into the Docker image.

function optionalUser({ emailKey, passwordKey, role, name }) {
  const email = process.env[emailKey];
  const password = process.env[passwordKey];

  if (!email && !password) return null;
  if (!email || !password) {
    throw new Error(`Both ${emailKey} and ${passwordKey} must be set.`);
  }

  return { email, password, role, name };
}

const USERS = [
  optionalUser({
    emailKey: 'CONSOLE_SUPER_ADMIN_EMAIL',
    passwordKey: 'CONSOLE_SUPER_ADMIN_PASSWORD',
    role: 'super_admin',
    name: 'Super Admin',
  }),
  optionalUser({
    emailKey: 'CONSOLE_PLATFORM_OWNER_EMAIL',
    passwordKey: 'CONSOLE_PLATFORM_OWNER_PASSWORD',
    role: 'platform_owner',
    name: 'Platform Owner',
  }),
].filter(Boolean);

const JWT_SECRET = process.env.CONSOLE_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.CONSOLE_JWT_EXPIRES_IN || '8h';

// Which roles can access which sections
const ROLE_ACCESS = {
  super_admin: ['overview', 'instances', 'storage', 'deployments', 'controls', 'pricing', 'logs'],
  platform_owner: ['overview', 'instances', 'storage', 'deployments', 'pricing', 'logs'],
};

module.exports = { USERS, JWT_SECRET, JWT_EXPIRES_IN, ROLE_ACCESS };
