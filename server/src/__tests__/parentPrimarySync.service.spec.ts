const txMock = {
  user: { update: jest.fn() },
  learner: { update: jest.fn() },
  learnerFamilyLink: { deleteMany: jest.fn(), upsert: jest.fn() },
  familyMember: { update: jest.fn() },
  familyAccount: { update: jest.fn() },
};

const prismaMock = {
  user: { updateMany: jest.fn() },
  familyMember: { findUnique: jest.fn() },
  $transaction: jest.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
};

jest.mock('../config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../services/sms.service', () => ({ SmsService: { sendSms: jest.fn() } }));
jest.mock('../services/email.service', () => ({ EmailService: { sendNotificationEmail: jest.fn() } }));

import { ParentService } from '../services/parent.service';

describe('ParentService.syncPrimaryParentForLearner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.familyMember.findUnique.mockResolvedValue({
      id: 'member-mary',
      familyAccountId: 'family-mary',
    });
  });

  it('moves the shared phone from the learner login to the authoritative parent', async () => {
    const service = new ParentService();
    jest.spyOn(service, 'getOrCreateParent').mockResolvedValue({
      id: 'parent-mary',
      firstName: 'MARY',
      lastName: 'KOKWAMO',
      email: '254710350374@edu-core.test',
      phone: '254710350374',
    } as any);

    await service.syncPrimaryParentForLearner({
      learnerId: 'learner-khadija',
      admissionNumber: '969',
      phone: '0710350374',
      name: 'MARY KOKWAMO',
      relationship: 'FATHER',
    });

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        role: 'STUDENT',
        OR: expect.arrayContaining([
          { email: { startsWith: '969@', mode: 'insensitive' } },
        ]),
      }),
      data: { phone: null },
    }));
    expect(txMock.learner.update).toHaveBeenCalledWith({
      where: { id: 'learner-khadija' },
      data: { parentId: 'parent-mary' },
    });
    expect(txMock.learnerFamilyLink.deleteMany).toHaveBeenCalledWith({
      where: {
        learnerId: 'learner-khadija',
        familyAccountId: { not: 'family-mary' },
      },
    });
    expect(txMock.learnerFamilyLink.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ isPrimary: true }),
      create: expect.objectContaining({ isPrimary: true }),
    }));
    expect(txMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'parent-mary' },
      data: expect.objectContaining({
        phone: '254710350374',
        role: 'PARENT',
        roles: ['PARENT'],
        status: 'ACTIVE',
      }),
    }));
  });
});
