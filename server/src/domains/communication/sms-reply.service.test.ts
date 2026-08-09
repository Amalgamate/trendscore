/**
 * Unit tests for SmsReplyService and SmsCallbackController pure logic.
 * DB is mocked — no connection required.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    school:           { findFirst: jest.fn() },
    smsOutboundAudit: { findFirst: jest.fn() },
    parentSmsReply:   { create: jest.fn(), update: jest.fn() },
    learner:          { findFirst: jest.fn(), findUnique: jest.fn() },
    user:             { findFirst: jest.fn(), findMany: jest.fn() },
    attendance:       { findUnique: jest.fn() },
    class:            { findFirst: jest.fn() },
  },
}));

jest.mock('../../services/notification.service', () => ({
  NotificationService: { createNotification: jest.fn().mockResolvedValue({}) },
  NotificationType: { INFO: 'INFO', WARNING: 'WARNING' },
}));

import prisma from '../../config/database';
import { SmsReplyService } from './sms-reply.service';

const db = prisma as any;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const SCHOOL   = { id: 'school-1' };
const LEARNER  = { id: 'learner-1', firstName: 'Alice', lastName: 'Mwangi', grade: 'Grade 5', stream: null };
const CLASS    = { teacherId: 'teacher-1' };
const REPLY_ID = 'reply-1';

function setupHappyPath() {
  db.school.findFirst.mockResolvedValue(SCHOOL);
  db.smsOutboundAudit.findFirst.mockResolvedValue({ learnerId: 'learner-1' });
  db.parentSmsReply.create.mockResolvedValue({ id: REPLY_ID });
  db.parentSmsReply.update.mockResolvedValue({});
  db.learner.findUnique.mockResolvedValue(LEARNER);
  db.attendance.findUnique.mockResolvedValue({ id: 'att-1' });
  db.class.findFirst.mockResolvedValue(CLASS);
  db.user.findMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Intent parsing (tested via processInbound behaviour)
// ---------------------------------------------------------------------------

describe('SmsReplyService — intent classification', () => {
  let service: SmsReplyService;
  beforeEach(() => {
    service = new SmsReplyService();
    jest.clearAllMocks();
    setupHappyPath();
  });

  const acknowledgements = ['OK', 'ok', 'Okay', 'acknowledged', 'noted', 'Received', 'SAWA', 'nimepokea', 'nimeona'];
  const callRequests     = ['Call me', 'please call', 'nipigie'];
  const others           = ['Thanks', 'Why was he absent?', 'Hello there'];

  it.each(acknowledgements)('"%s" is classified as ACKNOWLEDGE_ABSENCE', async (msg) => {
    db.smsOutboundAudit.findFirst.mockResolvedValue({ learnerId: 'learner-1' });
    const result = await service.processInbound({ fromPhone: '+254712345678', messageBody: msg, provider: 'africastalking' });
    expect(result.intent).toBe('ACKNOWLEDGE_ABSENCE');
  });

  it.each(callRequests)('"%s" is classified as REQUEST_CALL', async (msg) => {
    const result = await service.processInbound({ fromPhone: '+254712345678', messageBody: msg, provider: 'africastalking' });
    expect(result.intent).toBe('REQUEST_CALL');
  });

  it.each(others)('"%s" is classified as OTHER', async (msg) => {
    const result = await service.processInbound({ fromPhone: '+254712345678', messageBody: msg, provider: 'africastalking' });
    expect(result.intent).toBe('OTHER');
  });
});

// ---------------------------------------------------------------------------
// processInbound behaviour
// ---------------------------------------------------------------------------

describe('SmsReplyService.processInbound()', () => {
  let service: SmsReplyService;
  beforeEach(() => {
    service = new SmsReplyService();
    jest.clearAllMocks();
    setupHappyPath();
  });

  it('creates a ParentSmsReply record on every call', async () => {
    await service.processInbound({ fromPhone: '+254712345678', messageBody: 'ok', provider: 'mobilesasa' });
    expect(db.parentSmsReply.create).toHaveBeenCalledTimes(1);
    const data = db.parentSmsReply.create.mock.calls[0][0].data;
    expect(data.fromPhone).toBe('+254712345678');
    expect(data.provider).toBe('mobilesasa');
    expect(data.intent).toBe('ACKNOWLEDGE_ABSENCE');
  });

  it('marks reply as processed after handling', async () => {
    await service.processInbound({ fromPhone: '+254712345678', messageBody: 'ok', provider: 'africastalking' });
    expect(db.parentSmsReply.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ processed: true }),
    }));
  });

  it('links learnerId from recent outbound SMS', async () => {
    await service.processInbound({ fromPhone: '+254712345678', messageBody: 'ok', provider: 'africastalking' });
    const data = db.parentSmsReply.create.mock.calls[0][0].data;
    expect(data.linkedLearnerId).toBe('learner-1');
  });

  it('falls back to phone lookup when no recent outbound SMS exists', async () => {
    db.smsOutboundAudit.findFirst.mockResolvedValue(null);
    db.learner.findFirst.mockResolvedValue({ id: 'learner-2' });
    await service.processInbound({ fromPhone: '+254700000000', messageBody: 'ok', provider: 'africastalking' });
    expect(db.learner.findFirst).toHaveBeenCalled();
  });

  it('stores null learnerId when phone cannot be resolved', async () => {
    db.smsOutboundAudit.findFirst.mockResolvedValue(null);
    db.learner.findFirst.mockResolvedValue(null);
    db.user.findFirst.mockResolvedValue(null);
    await service.processInbound({ fromPhone: '+254700000001', messageBody: 'hello', provider: 'africastalking' });
    const data = db.parentSmsReply.create.mock.calls[0][0].data;
    expect(data.linkedLearnerId).toBeNull();
  });

  it('returns accepted=true and correct intent', async () => {
    const result = await service.processInbound({ fromPhone: '+254712345678', messageBody: 'ok', provider: 'africastalking' });
    expect(result.accepted).toBe(true);
    expect(result.intent).toBe('ACKNOWLEDGE_ABSENCE');
    expect(result.replyId).toBe(REPLY_ID);
  });

  it('does not throw when learner lookup fails mid-processing', async () => {
    db.learner.findUnique.mockResolvedValue(null); // absence acknowledgement handler will bail early
    await expect(
      service.processInbound({ fromPhone: '+254712345678', messageBody: 'ok', provider: 'africastalking' })
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// HMAC signature verification
// ---------------------------------------------------------------------------

describe('SmsReplyService.verifyMobileSasaSignature()', () => {
  const SECRET = 'my-test-secret-key';

  it('returns false when signature is missing', () => {
    expect(SmsReplyService.verifyMobileSasaSignature('body', undefined, SECRET)).toBe(false);
  });

  it('returns false when signature is wrong', () => {
    expect(SmsReplyService.verifyMobileSasaSignature('{"phone":"123"}', 'wrongsig', SECRET)).toBe(false);
  });

  it('returns true for correct HMAC', () => {
    const { createHmac } = require('crypto');
    const body = '{"phone":"+254712345678","message":"ok"}';
    const sig  = createHmac('sha256', SECRET).update(body).digest('hex');
    expect(SmsReplyService.verifyMobileSasaSignature(body, sig, SECRET)).toBe(true);
  });
});
