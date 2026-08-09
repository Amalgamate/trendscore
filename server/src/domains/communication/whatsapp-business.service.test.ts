/**
 * Unit tests for WhatsAppBusinessService
 * axios is mocked — no real HTTP calls.
 */

jest.mock('axios');

import axios from 'axios';
import { WhatsAppBusinessService, isWabaConfigured } from './whatsapp-business.service';

const mockAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const WABA_ENV = {
  WABA_PHONE_NUMBER_ID: '123456789',
  WABA_ACCESS_TOKEN:    'test-access-token',
  WABA_VERIFY_TOKEN:    'verify-me',
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(process.env, WABA_ENV);
});

afterEach(() => {
  delete process.env.WABA_PHONE_NUMBER_ID;
  delete process.env.WABA_ACCESS_TOKEN;
  delete process.env.WABA_VERIFY_TOKEN;
});

// ---------------------------------------------------------------------------
// isWabaConfigured
// ---------------------------------------------------------------------------

describe('isWabaConfigured()', () => {
  it('returns true when both env vars are set', () => {
    expect(isWabaConfigured()).toBe(true);
  });

  it('returns false when WABA_PHONE_NUMBER_ID is missing', () => {
    delete process.env.WABA_PHONE_NUMBER_ID;
    expect(isWabaConfigured()).toBe(false);
  });

  it('returns false when WABA_ACCESS_TOKEN is missing', () => {
    delete process.env.WABA_ACCESS_TOKEN;
    expect(isWabaConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sendText
// ---------------------------------------------------------------------------

describe('WhatsAppBusinessService.sendText()', () => {
  let service: WhatsAppBusinessService;
  beforeEach(() => { service = new WhatsAppBusinessService(); });

  it('sends a text message and returns messageId', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { messages: [{ id: 'wamid.test123' }] },
    });

    const result = await service.sendText({ to: '+254712345678', body: 'Hello parent' });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wamid.test123');
    expect(mockAxios.post).toHaveBeenCalledTimes(1);

    const [url, payload, config] = mockAxios.post.mock.calls[0] as [string, any, any];
    expect(url).toContain('123456789/messages');
    expect((payload as any).type).toBe('text');
    expect((payload as any).to).toBe('+254712345678');
    expect((config as any).headers.Authorization).toBe('Bearer test-access-token');
  });

  it('normalises Kenyan phone 0712... to +254712...', async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { messages: [{ id: 'msg-1' }] } });
    await service.sendText({ to: '0712345678', body: 'Test' });
    const payload = mockAxios.post.mock.calls[0][1] as any;
    expect(payload.to).toBe('+254712345678');
  });

  it('normalises 254712... to +254712...', async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { messages: [{ id: 'msg-1' }] } });
    await service.sendText({ to: '254712345678', body: 'Test' });
    const payload = mockAxios.post.mock.calls[0][1] as any;
    expect(payload.to).toBe('+254712345678');
  });

  it('returns error when API call fails', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: { data: { error: { message: 'Invalid access token' } } },
      message: 'Request failed',
    });

    const result = await service.sendText({ to: '+254712345678', body: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid access token');
  });

  it('returns error immediately when WABA not configured', async () => {
    delete process.env.WABA_PHONE_NUMBER_ID;
    const result = await service.sendText({ to: '+254712345678', body: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
    expect(mockAxios.post).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// sendTemplate
// ---------------------------------------------------------------------------

describe('WhatsAppBusinessService.sendTemplate()', () => {
  let service: WhatsAppBusinessService;
  beforeEach(() => { service = new WhatsAppBusinessService(); });

  it('sends a template message', async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { messages: [{ id: 'tmpl-1' }] } });

    const result = await service.sendTemplate({
      to:           '+254712345678',
      templateName: 'school_absent_child',
      languageCode: 'en',
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Alice' }] }],
    });

    expect(result.success).toBe(true);
    const payload = mockAxios.post.mock.calls[0][1] as any;
    expect(payload.type).toBe('template');
    expect(payload.template.name).toBe('school_absent_child');
  });
});

// ---------------------------------------------------------------------------
// verifyWebhook
// ---------------------------------------------------------------------------

describe('WhatsAppBusinessService.verifyWebhook()', () => {
  let service: WhatsAppBusinessService;
  beforeEach(() => { service = new WhatsAppBusinessService(); });

  it('returns challenge when token matches', () => {
    const result = service.verifyWebhook('subscribe', 'verify-me', 'challenge-abc');
    expect(result).toBe('challenge-abc');
  });

  it('returns null when mode is wrong', () => {
    expect(service.verifyWebhook('other', 'verify-me', 'challenge')).toBeNull();
  });

  it('returns null when token is wrong', () => {
    expect(service.verifyWebhook('subscribe', 'wrong-token', 'challenge')).toBeNull();
  });
});
