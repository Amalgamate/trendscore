jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    parentWhatsAppLink: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  },
}));

jest.mock('../services/parent-access.service', () => ({
  parentAccessService: { getAccessibleLearnerIds: jest.fn() },
}));

jest.mock('../services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    take: jest.fn(),
    increment: jest.fn(),
    getSecurityValue: jest.fn(),
    setSecurityValue: jest.fn(),
    takeSecurityValue: jest.fn(),
    incrementSecurityCounter: jest.fn(),
  },
  SecurityStateUnavailableError: class extends Error {},
}));

jest.mock('../domains/communication/whatsapp-channel', () => ({
  isWhatsAppChannelReady: jest.fn(() => true),
  sendWhatsAppText: jest.fn(),
}));

jest.mock('../services/whatsapp.service', () => ({
  whatsappService: {
    getLinkedNumber: jest.fn(() => '254700000000'),
    sendMessage: jest.fn(async () => ({ success: true, messageId: 'msg-1' })),
  },
}));

import prisma from '../config/database';
import { parentAccessService } from '../services/parent-access.service';
import { redisCacheService } from '../services/redis-cache.service';
import { whatsappService } from '../services/whatsapp.service';
import { ParentWhatsAppLinkService } from '../services/parent-whatsapp-link.service';

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  parentWhatsAppLink: { findUnique: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock };
};
const mockedAccess = parentAccessService as unknown as { getAccessibleLearnerIds: jest.Mock };
const mockedCache = redisCacheService as unknown as Record<string, jest.Mock>;
const mockedWhatsApp = whatsappService as unknown as {
  getLinkedNumber: jest.Mock;
  sendMessage: jest.Mock;
};

const PARENT_PHONE = '254712345678';

const parentRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'parent-1',
  role: 'PARENT',
  roles: ['PARENT'],
  status: 'ACTIVE',
  archived: false,
  phone: PARENT_PHONE,
  ...overrides,
});

const service = new ParentWhatsAppLinkService();

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.user.findUnique.mockResolvedValue(parentRecord());
  mockedPrisma.parentWhatsAppLink.findUnique.mockResolvedValue(null);
  mockedPrisma.parentWhatsAppLink.upsert.mockResolvedValue({});
  mockedAccess.getAccessibleLearnerIds.mockResolvedValue(['learner-1']);
  mockedCache.incrementSecurityCounter.mockResolvedValue(1);
  mockedCache.getSecurityValue.mockResolvedValue(null);
  mockedWhatsApp.getLinkedNumber.mockReturnValue('254700000000');
  mockedWhatsApp.sendMessage.mockResolvedValue({ success: true, messageId: 'msg-1' });
});

describe('ParentWhatsAppLinkService.requestConfirmation', () => {
  it('stores a single-use challenge and messages the profile number', async () => {
    const result = await service.requestConfirmation('parent-1');

    expect(result.awaitingReply).toBe(true);
    expect(result.phone).toBe('+254••••678');

    expect(mockedCache.setSecurityValue).toHaveBeenCalledTimes(1);
    const [key, value, ttl] = mockedCache.setSecurityValue.mock.calls[0];
    expect(key).toContain('parent-confirm');
    expect(value).toMatchObject({ userId: 'parent-1', phone: PARENT_PHONE, codeHash: null });
    expect(ttl).toBe(15 * 60);

    expect(mockedWhatsApp.sendMessage).toHaveBeenCalledTimes(1);
    const payload = mockedWhatsApp.sendMessage.mock.calls[0][0];
    expect(payload.to).toBe(PARENT_PHONE);
    expect(payload.message).toContain('Reply YES');
  });

  it('refuses when the school session is not paired', async () => {
    mockedWhatsApp.getLinkedNumber.mockReturnValue(null);
    await expect(service.requestConfirmation('parent-1')).rejects.toMatchObject({ statusCode: 503 });
    expect(mockedWhatsApp.sendMessage).not.toHaveBeenCalled();
  });

  it('refuses when the parent has no learners', async () => {
    mockedAccess.getAccessibleLearnerIds.mockResolvedValue([]);
    await expect(service.requestConfirmation('parent-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses when the phone belongs to another parent link', async () => {
    mockedPrisma.parentWhatsAppLink.findUnique.mockResolvedValue({ userId: 'someone-else' });
    await expect(service.requestConfirmation('parent-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('clears the challenge when the message cannot be delivered', async () => {
    mockedWhatsApp.sendMessage.mockResolvedValue({ success: false, error: 'socket closed' });

    await expect(service.requestConfirmation('parent-1')).rejects.toMatchObject({ statusCode: 503 });

    // The prompt was written then removed, so no orphan challenge is left behind.
    expect(mockedCache.setSecurityValue).toHaveBeenCalledTimes(1);
    expect(mockedCache.delete).toHaveBeenCalledWith(expect.stringContaining('parent-confirm'));
  });
});

describe('ParentWhatsAppLinkService.confirmFromInbound', () => {
  const pending = { userId: 'parent-1', phone: PARENT_PHONE, codeHash: null, requestedAt: Date.now() };

  it('links the account when YES matches an open challenge', async () => {
    mockedCache.getSecurityValue.mockResolvedValue(pending);
    mockedCache.takeSecurityValue.mockResolvedValue(pending);

    await expect(service.confirmFromInbound(PARENT_PHONE, 'YES')).resolves.toBe(true);

    expect(mockedPrisma.parentWhatsAppLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'parent-1' },
        create: expect.objectContaining({ phone: PARENT_PHONE, enabled: true }),
      }),
    );
  });

  it('accepts Swahili and casual confirmations', async () => {
    for (const reply of ['ndio', 'Sawa', 'yep', 'okay']) {
      jest.clearAllMocks();
      mockedPrisma.user.findUnique.mockResolvedValue(parentRecord());
      mockedPrisma.parentWhatsAppLink.findUnique.mockResolvedValue(null);
      mockedAccess.getAccessibleLearnerIds.mockResolvedValue(['learner-1']);
      mockedCache.getSecurityValue.mockResolvedValue(pending);
      mockedCache.takeSecurityValue.mockResolvedValue(pending);

      await expect(service.confirmFromInbound(PARENT_PHONE, reply)).resolves.toBe(true);
    }
  });

  it('ignores a YES that has no open challenge, leaving it for the intent router', async () => {
    mockedCache.getSecurityValue.mockResolvedValue(null);
    await expect(service.confirmFromInbound(PARENT_PHONE, 'YES')).resolves.toBe(false);
    expect(mockedPrisma.parentWhatsAppLink.upsert).not.toHaveBeenCalled();
  });

  it('ignores non-confirmation words', async () => {
    mockedCache.getSecurityValue.mockResolvedValue(pending);
    await expect(service.confirmFromInbound(PARENT_PHONE, 'fees')).resolves.toBe(false);
    expect(mockedPrisma.parentWhatsAppLink.upsert).not.toHaveBeenCalled();
  });

  it('rejects a YES from a different number than the one challenged', async () => {
    mockedCache.getSecurityValue.mockResolvedValue(pending);
    await expect(service.confirmFromInbound('254799999999', 'YES')).resolves.toBe(false);
    expect(mockedPrisma.parentWhatsAppLink.upsert).not.toHaveBeenCalled();
  });

  it('is single-use — a replayed YES cannot link twice', async () => {
    mockedCache.getSecurityValue.mockResolvedValue(pending);
    mockedCache.takeSecurityValue.mockResolvedValueOnce(pending).mockResolvedValueOnce(null);

    await expect(service.confirmFromInbound(PARENT_PHONE, 'YES')).resolves.toBe(true);
    await expect(service.confirmFromInbound(PARENT_PHONE, 'YES')).resolves.toBe(false);
    expect(mockedPrisma.parentWhatsAppLink.upsert).toHaveBeenCalledTimes(1);
  });

  it('refuses when the parent phone changed after the prompt was sent', async () => {
    mockedCache.getSecurityValue.mockResolvedValue(pending);
    mockedCache.takeSecurityValue.mockResolvedValue(pending);
    mockedPrisma.user.findUnique.mockResolvedValue(parentRecord({ phone: '254700000001' }));

    await expect(service.confirmFromInbound(PARENT_PHONE, 'YES')).resolves.toBe(false);
    expect(mockedPrisma.parentWhatsAppLink.upsert).not.toHaveBeenCalled();
  });

  it('refuses when the parent account was deactivated meanwhile', async () => {
    mockedCache.getSecurityValue.mockResolvedValue(pending);
    mockedCache.takeSecurityValue.mockResolvedValue(pending);
    mockedPrisma.user.findUnique.mockResolvedValue(parentRecord({ status: 'INACTIVE' }));

    await expect(service.confirmFromInbound(PARENT_PHONE, 'YES')).resolves.toBe(false);
  });
});

describe('ParentWhatsAppLinkService.getStatus', () => {
  it('reports a pending confirmation so the UI can resume waiting', async () => {
    mockedCache.getSecurityValue.mockResolvedValue({
      userId: 'parent-1', phone: PARENT_PHONE, codeHash: null, requestedAt: Date.now(),
    });

    const status = await service.getStatus('parent-1');

    expect(status.linked).toBe(false);
    expect(status.awaitingConfirmation).toBe(true);
    expect(status.profilePhone).toBe('+254••••678');
    expect(status.assistantAvailable).toBe(true);
  });

  it('does not report a pending confirmation once linked', async () => {
    mockedPrisma.parentWhatsAppLink.findUnique.mockResolvedValue({
      phone: PARENT_PHONE, enabled: true, linkedAt: new Date(),
    });

    const status = await service.getStatus('parent-1');

    expect(status.linked).toBe(true);
    expect(status.awaitingConfirmation).toBe(false);
    expect(mockedCache.getSecurityValue).not.toHaveBeenCalled();
  });
});
