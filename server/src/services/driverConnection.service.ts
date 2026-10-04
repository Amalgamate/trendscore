import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import {
  DEPLOYMENT_DOMAIN,
  isReservedSubdomain,
  normalizeSchoolCode,
} from '../config/schoolDomains';

export type ResolvedBranding = {
  displayName: string;
  motto: string | null;
  logoUrl: string | null;
  brandColorHex: string | null;
};

export type ResolvedSchool = {
  schoolCode: string;
  schoolId: string;
  apiOrigin: string;
  branding: ResolvedBranding;
};

export type DeviceStatus = 'PENDING' | 'APPROVED' | 'REVOKED';

/**
 * Resolve a driver-entered school CODE into the origin the app must talk to.
 *
 * Security note, and the whole point of this service: the client NEVER supplies
 * a URL. The origin is rebuilt here from DEPLOYMENT_DOMAIN plus the validated
 * code, so a compromised or careless client cannot point the driver app at an
 * attacker host and harvest a real school's credentials and learner data.
 *
 * Unknown codes return 404 and reveal nothing about which schools exist.
 */
export const driverConnectionService = {
  /** Validate a code without touching the DB. Used by the route for 400s. */
  validateCode(raw: unknown): string {
    const code = normalizeSchoolCode(raw);
    if (!code) {
      throw new ApiError(400, 'That is not a valid school code.');
    }
    if (isReservedSubdomain(code)) {
      // Deliberately the same message as "malformed": a reserved word is not a
      // school, and confirming which words are reserved would help enumeration.
      throw new ApiError(400, 'That is not a valid school code.');
    }
    return code;
  },

  /** Build the origin for a validated code. Never derived from user input beyond the code. */
  originFor(code: string): string {
    return `https://${code}.${DEPLOYMENT_DOMAIN}/api`;
  },

  async schoolForCode(rawCode: unknown, hostname?: string) {
    const code = this.validateCode(rawCode);

    // The app derives a fixed TrendsCORE subdomain from the code, then this
    // tenant API confirms that the request reached that exact school host.
    // This works with isolated tenant databases and never trusts a client URL.
    if (hostname) {
      const host = hostname.trim().toLowerCase().replace(/:\\d+$/, '');
      if (host !== `${code}.${DEPLOYMENT_DOMAIN}`) return null;
    }

    const configuredSchool = await prisma.school.findFirst({
      where: { driverCode: code, active: true },
      select: {
        id: true,
        name: true,
        motto: true,
        logoUrl: true,
        brandColor: true,
      },
    });

    if (configuredSchool) return { code, school: configuredSchool };

    // Separate school stacks commonly contain just one active School row and
    // have no driverCode configured yet. The verified host is the tenant key.
    if (hostname) {
      const tenantSchools = await prisma.school.findMany({
        where: { active: true },
        take: 2,
        select: {
          id: true,
          name: true,
          motto: true,
          logoUrl: true,
          brandColor: true,
          driverCode: true,
        },
      });
      if (tenantSchools.length === 1 && !tenantSchools[0].driverCode) {
        return { code, school: tenantSchools[0] };
      }
      return null;
    }

    return null;
  },

  async resolve(rawCode: unknown, hostname?: string): Promise<ResolvedSchool> {
    const resolved = await this.schoolForCode(rawCode, hostname);
    if (!resolved) throw new ApiError(404, 'No school found for that code.');
    const { code, school } = resolved;

    return {
      schoolCode: code,
      schoolId: school.id,
      apiOrigin: this.originFor(code),
      branding: {
        displayName: school.name,
        motto: school.motto,
        logoUrl: school.logoUrl,
        brandColorHex: school.brandColor,
      },
    };
  },

  /**
   * Register (or re-register) a phone. Idempotent on (schoolId, deviceId): a
   * dropped request must never create a second row the office cannot see.
   *
   * Deliberately does NOT flip an existing APPROVED/REVOKED device back to
   * PENDING — otherwise anyone knowing the code could un-approve a working
   * phone just by re-registering it.
   */
  async registerDevice(rawCode: unknown, deviceId: unknown, label?: unknown, hostname?: string) {
    const code = this.validateCode(rawCode);
    const id = typeof deviceId === 'string' ? deviceId.trim() : '';
    if (!id || id.length > 128) {
      throw new ApiError(400, 'A device id is required.');
    }
    const resolved = await this.schoolForCode(code, hostname);
    if (!resolved) throw new ApiError(404, 'No school found for that code.');
    const { school } = resolved;

    const existing = await prisma.driverDevice.findUnique({
      where: { schoolId_deviceId: { schoolId: school.id, deviceId: id } },
      select: { id: true, status: true, requestedAt: true },
    });

    if (existing) {
      if (label) {
        await prisma.driverDevice.update({
          where: { id: existing.id },
          data: { label: String(label).slice(0, 80) },
        });
      }
      return { status: existing.status as DeviceStatus, requestedAt: existing.requestedAt };
    }

    const created = await prisma.driverDevice.create({
      data: { schoolId: school.id, deviceId: id, label: label ? String(label).slice(0, 80) : null },
      select: { status: true, requestedAt: true },
    });

    return { status: created.status as DeviceStatus, requestedAt: created.requestedAt };
  },

  async deviceStatus(rawCode: unknown, deviceId: unknown, hostname?: string): Promise<DeviceStatus> {
    const code = this.validateCode(rawCode);
    const id = typeof deviceId === 'string' ? deviceId.trim() : '';
    if (!id) throw new ApiError(400, 'A device id is required.');
    const resolved = await this.schoolForCode(code, hostname);
    if (!resolved) throw new ApiError(404, 'No school found for that code.');
    const { school } = resolved;

    const device = await prisma.driverDevice.findUnique({
      where: { schoolId_deviceId: { schoolId: school.id, deviceId: id } },
      select: { status: true, lastSeenAt: true },
    });
    if (!device) return 'PENDING';

    await prisma.driverDevice.update({
      where: { schoolId_deviceId: { schoolId: school.id, deviceId: id } },
      data: { lastSeenAt: new Date() },
    });

    return device.status as DeviceStatus;
  },

  /**
   * Gate for /api/auth/login.
   *
   * Deliberately opt-IN: this only runs when the caller sends a deviceId, which
   * only the driver app does. The web portal, parent portal and every other
   * client send no deviceId and are unaffected — a MISSING deviceId must never
   * mean "approved".
   *
   * @throws 403 DEVICE_NOT_APPROVED when the phone is unknown, still pending,
   *         or revoked.
   */
  async assertDeviceApproved(rawCode: unknown, deviceId: unknown, hostname?: string): Promise<void> {
    const status = await this.deviceStatus(rawCode, deviceId, hostname);

    if (status !== 'APPROVED') {
      throw new ApiError(
        403,
        status === 'REVOKED'
          ? 'This phone has been removed from the driver app.'
          : 'Waiting for your school to approve this phone.',
      ).withCode('DEVICE_NOT_APPROVED');
    }
  },
};
