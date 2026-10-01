# School provisioning reference

Use this as the standing reference for every new TrendScore school. The machine-readable source of truth for shared defaults is [`server/src/config/superAdminAccess.json`](../server/src/config/superAdminAccess.json); provisioning workflows, the school app, and the platform-console provisioner consume that file.

## Permanent super-admin access

Each school's database receives the same platform super-admin identity:

- Email: `admin@trendscore.app`
- Primary account phone: `0713612141` (`+254713612141`)
- Password login password: `Admin@123!`
- Approved phone aliases: `0713612141`, `0720705588`, and `0797985794`
- Fixed phone OTP for those aliases: `123456`

The aliases resolve to the same `SUPER_ADMIN` account on the school database. They remain subject to the account being present, active, and assigned the super-admin role. Do not request or configure a separate `SCHOOL_INITIAL_ADMIN_PASSWORD` for school provisioning. Do not send credentials in chat or print them in workflow output.

## New school checklist

Before provisioning, collect these details from the requester one at a time:

1. School display name.
2. Institution type: `PRIMARY_CBC`, `SECONDARY`, or `TERTIARY`.
3. School slug and public domain, if not already provided.

Then verify:

- The domain's A record points to the deployment host IP in `deploy/instances.manifest.json`.
- The school has an active manifest entry with its compose project, env file, and public domain.
- The published frontend and backend image tags exist. The default pinned tag is `defaultImageTag` in `server/src/config/superAdminAccess.json`; an explicit release tag may be supplied when provisioning.
- Free frontend and backend host ports can be allocated in the configured ranges.
- The `deploy-production-school` GitHub Actions environment has the SSH connection configured. The super-admin password is not a GitHub Actions secret; it comes from the shared policy file.

Run **Provision and Secure New School** from the release branch. It creates the isolated database and app stack, applies Prisma migrations, seeds the permanent super-admin, then binds HTTPS and verifies the certificate. The selected image tag is pinned in the school's env file.

## Keeping this reference current

Update `server/src/config/superAdminAccess.json` when the permanent identity, approved phone aliases, fixed OTP, or default release image changes. Keep the runtime login and seed code, GitHub provisioning workflow, platform-console provisioner, and this reference aligned with that policy. Never reintroduce a separate password prompt or duplicate credentials in workflow summaries.
