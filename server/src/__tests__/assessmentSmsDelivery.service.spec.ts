jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    learner: { findMany: jest.fn() },
    assessmentSmsAudit: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../services/sms.service', () => ({
  SmsService: { sendSms: jest.fn() },
}));

import prisma from '../config/database';
import { SmsService } from '../services/sms.service';
import { AssessmentSmsDeliveryService } from '../services/assessment-sms-delivery.service';

const learner = (id: string, phone?: string) => ({
  id,
  firstName: `Learner-${id}`,
  middleName: null,
  lastName: 'Test',
  grade: 'GRADE_9',
  archived: false,
  primaryContactPhone: phone || null,
  guardianPhone: null,
  guardianName: 'Guardian',
  fatherPhone: null,
  fatherName: null,
  motherPhone: null,
  motherName: null,
  parent: null,
});

describe('AssessmentSmsDeliveryService', () => {
  const db = prisma as any;
  const sendSms = SmsService.sendSms as jest.Mock;
  let service: AssessmentSmsDeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssessmentSmsDeliveryService();
    db.assessmentSmsAudit.create
      .mockResolvedValueOnce({ id: 'audit-1' })
      .mockResolvedValueOnce({ id: 'audit-2' })
      .mockResolvedValueOnce({ id: 'audit-3' });
    db.assessmentSmsAudit.update.mockResolvedValue({});
  });

  it('durably records sent, provider-failed, and missing-phone attempts', async () => {
    db.learner.findMany.mockResolvedValue([
      learner('one', '0711111111'),
      learner('two', '0722222222'),
      learner('three'),
    ]);
    sendSms
      .mockResolvedValueOnce({ success: true, messageId: 'provider-1' })
      .mockResolvedValueOnce({ success: false, error: 'Provider rejected recipient' });

    const result = await service.sendBulk({
      term: 'TERM_2',
      academicYear: 2026,
      sentByUserId: 'admin-1',
      entries: [
        { learnerId: 'one', message: 'Report one' },
        { learnerId: 'two', message: 'Report two' },
        { learnerId: 'three', message: 'Report three' },
      ],
    });

    expect(result).toMatchObject({ total: 3, sent: 1, failed: 2 });
    expect(db.assessmentSmsAudit.create).toHaveBeenCalledTimes(3);
    expect(db.assessmentSmsAudit.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'audit-1' },
      data: expect.objectContaining({ smsStatus: 'SENT', smsMessageId: 'provider-1' }),
    }));
    expect(db.assessmentSmsAudit.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'audit-2' },
      data: expect.objectContaining({ smsStatus: 'FAILED', failureReason: 'Provider rejected recipient' }),
    }));
    expect(db.assessmentSmsAudit.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'audit-3' },
      data: expect.objectContaining({ smsStatus: 'FAILED', failureReason: 'No parent or guardian phone number is configured' }),
    }));
  });

  it('previews the exact resolved recipients and messages without sending or auditing', async () => {
    db.learner.findMany.mockResolvedValue([
      learner('one', '0711111111'),
      learner('two'),
    ]);

    const result = await service.preview([
      { learnerId: 'one', message: 'Mathematics: 72% ME' },
      { learnerId: 'two', message: 'Mathematics: X' },
    ]);

    expect(result).toEqual([
      expect.objectContaining({ learnerId: 'one', phone: '0711111111', message: 'Mathematics: 72% ME', valid: true, smsParts: 1 }),
      expect.objectContaining({ learnerId: 'two', phone: '', message: 'Mathematics: X', valid: false }),
    ]);
    expect(sendSms).not.toHaveBeenCalled();
    expect(db.assessmentSmsAudit.create).not.toHaveBeenCalled();
  });

  it('retries a failed audit using the latest learner phone when the original was missing', async () => {
    db.assessmentSmsAudit.findUnique.mockResolvedValue({
      id: 'audit-missing',
      channel: 'SMS',
      parentPhone: 'MISSING',
      messageContent: 'Assessment report',
      learner: learner('one', '0711111111'),
    });
    sendSms.mockResolvedValue({ success: true, messageId: 'retry-provider-id' });

    const result = await service.retry('audit-missing', 'admin-2');

    expect(sendSms).toHaveBeenCalledWith('0711111111', 'Assessment report');
    expect(result).toMatchObject({ success: true, messageId: 'retry-provider-id' });
    expect(db.assessmentSmsAudit.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ smsStatus: 'SENT', failureReason: null }),
    }));
  });
});
