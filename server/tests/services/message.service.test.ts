import prisma from '../../src/config/database';
import { SmsService } from '../../src/services/sms.service';
import { MessageService } from '../../src/services/message.service';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: {
    messageReceipt: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    message: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/sms.service', () => ({
  SmsService: {
    sendSms: jest.fn(),
  },
}));

jest.mock('../../src/services/whatsapp.service', () => ({
  whatsappService: {
    sendMessage: jest.fn(),
  },
}));

jest.mock('../../src/services/email-resend.service', () => ({
  EmailService: {
    sendEmail: jest.fn(),
  },
}));

jest.mock('../../src/services/library.service', () => ({
  LibraryService: jest.fn().mockImplementation(() => ({
    sendOverdueReminders: jest.fn(),
  })),
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedSendSms = SmsService.sendSms as jest.MockedFunction<typeof SmsService.sendSms>;

describe('MessageService delivery errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockedPrisma.messageReceipt.update as jest.Mock).mockResolvedValue({});
    (mockedPrisma.message.update as jest.Mock).mockResolvedValue({});
  });

  it('returns the provider error when a single SMS delivery fails', async () => {
    mockedSendSms.mockResolvedValue({
      success: false,
      error: 'MobileSasa: Insufficient credits',
    });

    const result = await new MessageService()._deliverMessage({
      id: 'message-1',
      messageType: 'SMS',
      body: 'Test message',
      receipts: [{ id: 'receipt-1', recipientPhone: '+254712345678' }],
    });

    expect(result).toMatchObject({
      success: false,
      sent: 0,
      failed: 1,
      error: 'MobileSasa: Insufficient credits',
    });
    expect(mockedPrisma.messageReceipt.update).toHaveBeenCalledWith({
      where: { id: 'receipt-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        failureReason: 'MobileSasa: Insufficient credits',
      }),
    });
  });

  it('uses the generic error when a failed delivery has no reason', async () => {
    mockedSendSms.mockResolvedValue({ success: false });

    const result = await new MessageService()._deliverMessage({
      id: 'message-2',
      messageType: 'SMS',
      body: 'Test message',
      receipts: [{ id: 'receipt-2', recipientPhone: '+254712345678' }],
    });

    expect(result.error).toBe('Failed to deliver to any recipients');
  });
});
