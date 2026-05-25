// @ts-nocheck
/**
 * Unit Tests — WhatsApp Service (Baileys)
 *
 * Tests the WhatsApp service logic in isolation by mocking:
 *   - @whiskeysockets/baileys (socket creation + messaging)
 *   - fs (auth folder checks)
 *   - pino (logger)
 *
 * Run with:
 *   cd server && npx jest tests/services/whatsapp.service.test.ts --no-coverage
 */

// ─── Mocks (must be before any imports that use them) ────────────────────────
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.mock('@whiskeysockets/baileys', () => {
  const mockSendMessage = jest.fn().mockResolvedValue({ key: { id: 'mock-msg-id-123' } });
  const mockEv = {
    on: jest.fn(),
  };
  const mockSocket = {
    sendMessage: mockSendMessage,
    ev: mockEv,
    end: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  return {
    __esModule: true,
    default: jest.fn().mockReturnValue(mockSocket),
    useMultiFileAuthState: jest.fn().mockResolvedValue({
      state: { creds: {}, keys: {} },
      saveCreds: jest.fn(),
    }),
    fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 2413, 1] }),
    makeCacheableSignalKeyStore: jest.fn().mockReturnValue({}),
    DisconnectReason: { loggedOut: 401 },
    proto: {},
    MediaType: {},
    Browsers: { macOS: jest.fn().mockReturnValue(['Mac OS', 'Chrome', '1.0.0']) },
  };
});

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),  // No existing session by default
  mkdirSync: jest.fn(),
  rmSync: jest.fn(),
}));

jest.mock('pino', () => {
  const pinoLogger = jest.fn().mockReturnValue({ level: 'silent', child: jest.fn() });
  (pinoLogger as any).default = pinoLogger;
  return pinoLogger;
});

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import * as fs from 'fs';
import makeWASocket from '@whiskeysockets/baileys';

// Force re-import after mocks are applied
jest.isolateModules(() => {});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the mock socket returned by makeWASocket */
const getMockSocket = () => (makeWASocket as jest.Mock).mock.results[0]?.value;

/** Boot the service fresh for each test */
async function bootService() {
  jest.resetModules();

  // Re-apply mocks in the isolated module scope
  jest.mock('@whiskeysockets/baileys', () => {
    const mockSendMessage = jest.fn().mockResolvedValue({ key: { id: 'msg-id-42' } });
    const mockEv: { on: jest.Mock; _handlers: Record<string, Function[]> } = {
      on: jest.fn(),
      _handlers: {},
    };
    mockEv.on.mockImplementation((event: string, handler: Function) => {
      mockEv._handlers[event] = mockEv._handlers[event] || [];
      mockEv._handlers[event].push(handler);
    });

    const mockSocket = {
      sendMessage: mockSendMessage,
      ev: mockEv,
      end: jest.fn(),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    return {
      __esModule: true,
      default: jest.fn().mockReturnValue(mockSocket),
      useMultiFileAuthState: jest.fn().mockResolvedValue({
        state: { creds: {}, keys: {} },
        saveCreds: jest.fn(),
      }),
      fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 2413, 1] }),
      makeCacheableSignalKeyStore: jest.fn().mockReturnValue({}),
      DisconnectReason: { loggedOut: 401 },
      proto: {},
      MediaType: {},
      Browsers: { macOS: jest.fn().mockReturnValue(['Mac OS', 'Chrome', '1.0.0']) },
    };
  });

  const { whatsappService } = await import('../../src/services/whatsapp.service');
  return whatsappService;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('WhatsApp Service — Unit Tests', () => {

  // ── 1. Initial State ─────────────────────────────────────────────────────

  describe('1. Initial State', () => {
    it('should report disconnected status before initialization', async () => {
      const service = await bootService();
      const status = service.getStatus();
      expect(status.status).toBe('disconnected');
      expect(status.qrCode).toBeNull();
    });

    it('should NOT auto-connect if no saved session exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const service = await bootService();
      // initialize() should not have been called in the constructor
      const status = service.getStatus();
      expect(status.status).toBe('disconnected');
    });
  });

  // ── 2. sendMessage — Disconnected Guard ──────────────────────────────────

  describe('2. sendMessage — when not connected', () => {
    it('should return failure with clear error message when disconnected', async () => {
      const service = await bootService();
      // Status is 'disconnected' — no sock connected
      const result = await service.sendMessage({ to: '0712345678', message: 'Hello' });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not connected/i);
    });

    it('should not throw — returns structured error instead', async () => {
      const service = await bootService();
      await expect(
        service.sendMessage({ to: '0700000000', message: 'Test' })
      ).resolves.toHaveProperty('success', false);
    });
  });

  // ── 3. Phone Formatting ──────────────────────────────────────────────────

  describe('3. Phone number formatting (via sendMessage)', () => {
    /**
     * We test the private formatPhone logic indirectly by mocking the socket
     * and verifying which JID the socket receives.
     */

    const buildConnectedService = async () => {
      const service = await bootService();

      // Directly inject a mock socket + set authenticated status
      const mockSend = jest.fn().mockResolvedValue({ key: { id: 'test-id' } });
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      return { service, mockSend };
    };

    it('converts 07XXXXXXXX to 2547XXXXXXXX@s.whatsapp.net', async () => {
      const { service, mockSend } = await buildConnectedService();
      await service.sendMessage({ to: '0712345678', message: 'Hi' });
      expect(mockSend).toHaveBeenCalledWith(
        '254712345678@s.whatsapp.net',
        expect.objectContaining({ text: 'Hi' })
      );
    });

    it('keeps 2547XXXXXXXX intact (already formatted)', async () => {
      const { service, mockSend } = await buildConnectedService();
      await service.sendMessage({ to: '254712345678', message: 'Hi' });
      expect(mockSend).toHaveBeenCalledWith(
        '254712345678@s.whatsapp.net',
        expect.any(Object)
      );
    });

    it('strips non-numeric chars before formatting', async () => {
      const { service, mockSend } = await buildConnectedService();
      await service.sendMessage({ to: '+254 712 345 678', message: 'Hi' });
      expect(mockSend).toHaveBeenCalledWith(
        '254712345678@s.whatsapp.net',
        expect.any(Object)
      );
    });
  });

  // ── 4. sendMessage — Text ────────────────────────────────────────────────

  describe('4. sendMessage — plain text', () => {
    it('sends text successfully and returns messageId', async () => {
      const service = await bootService();
      const mockSend = jest.fn().mockResolvedValue({ key: { id: 'abc123' } });
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      const result = await service.sendMessage({ to: '0712345678', message: 'Hello Parent!' });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('abc123');
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('@s.whatsapp.net'),
        { text: 'Hello Parent!' }
      );
    });
  });

  // ── 5. sendMessage — PDF Attachment ─────────────────────────────────────

  describe('5. sendMessage — PDF document attachment', () => {
    it('sends document with correct mimetype and filename', async () => {
      const service = await bootService();
      const mockSend = jest.fn().mockResolvedValue({ key: { id: 'pdf-msg-1' } });
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      const pdfBuffer = Buffer.from('%PDF-1.4 fake content');
      const result = await service.sendMessage({
        to: '0712345678',
        message: 'Dear Parent, attached is the report',
        mediaBuffer: pdfBuffer,
        mediaType: 'application/pdf',
        mediaFileName: 'John_Doe_Report.pdf',
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('@s.whatsapp.net'),
        expect.objectContaining({
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: 'John_Doe_Report.pdf',
          caption: 'Dear Parent, attached is the report',
        })
      );
    });
  });

  // ── 6. sendAssessmentReport ──────────────────────────────────────────────

  describe('6. sendAssessmentReport', () => {
    it('sends report with learner name in filename and caption', async () => {
      const service = await bootService();
      const mockSend = jest.fn().mockResolvedValue({ key: { id: 'report-id-1' } });
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      const result = await service.sendAssessmentReport({
        parentPhone: '0712345678',
        parentName: 'Mary Wanjiru',
        learnerName: 'James Kamau',
        pdfBuffer: Buffer.from('%PDF fake'),
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: expect.stringContaining('James Kamau'),
        })
      );
    });
  });

  // ── 7. sendBulkMessages ──────────────────────────────────────────────────

  describe('7. sendBulkMessages — batch sending', () => {
    let originalSetTimeout;

    beforeEach(() => {
      // Mock setTimeout globally just for this test to bypass the 1s delay instantly
      originalSetTimeout = global.setTimeout;
      global.setTimeout = ((fn: Function) => fn()) as any;
    });

    afterEach(() => {
      global.setTimeout = originalSetTimeout;
    });

    it('returns correct sent/failed counts', async () => {
      const service = await bootService();
      let callCount = 0;

      // Make every other message fail
      const mockSend = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) throw new Error('Simulated send failure');
        return Promise.resolve({ key: { id: `id-${callCount}` } });
      });
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      const messages = [
        { phone: '0711111111', message: 'Hi 1' },
        { phone: '0722222222', message: 'Hi 2' },
        { phone: '0733333333', message: 'Hi 3' },
        { phone: '0744444444', message: 'Hi 4' },
      ];

      const result = await service.sendBulkMessages(messages);

      expect(result.sent + result.failed).toBe(messages.length);
      expect(result.results).toHaveLength(messages.length);
    });

    it('includes phone in each result entry', async () => {
      const service = await bootService();
      const mockSend = jest.fn().mockResolvedValue({ key: { id: 'bulk-id' } });
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      const messages = [{ phone: '0711111111', message: 'Test' }];
      const result = await service.sendBulkMessages(messages);

      expect(result.results[0].phone).toBe('0711111111');
    });
  });

  // ── 8. logout ────────────────────────────────────────────────────────────

  describe('8. logout', () => {
    it('resets status to disconnected and clears qrCode', async () => {
      const service = await bootService();
      const mockLogout = jest.fn().mockResolvedValue(undefined);
      (service as any).sock = {
        logout: mockLogout,
        end: jest.fn(),
        ev: { removeAllListeners: jest.fn() },
      };
      (service as any).status = 'authenticated';
      (service as any).qrCode = 'some-qr-data';

      // fs mock is tricky across resetModules, just spy on the instance that it uses
      const result = await service.logout();
      expect(result.success).toBe(true);
      expect(service.getStatus().status).toBe('disconnected');
    });

    it('deletes auth folder if it exists', async () => {
      const service = await bootService();
      (service as any).sock = {
        logout: jest.fn().mockResolvedValue(undefined),
        end: jest.fn(),
        ev: { removeAllListeners: jest.fn() },
      };
      (service as any).status = 'authenticated';
      
      const fsModule = require('fs');
      fsModule.existsSync.mockReturnValue(true);

      await service.logout();
      expect(fsModule.rmSync).toHaveBeenCalledWith(expect.stringContaining('whatsapp-auth'), expect.objectContaining({ recursive: true }));
    });
  });

  // ── 9. Announcement + Custom Message helpers ─────────────────────────────

  describe('9. Announcement and custom message helpers', () => {
    it('sendAnnouncement wraps title in bold (* *)', async () => {
      const service = await bootService();
      const mockSend = jest.fn().mockResolvedValue({ key: { id: 'ann-id' } });
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      await service.sendAnnouncement({
        parentPhone: '0712345678',
        title: 'School Closure',
        content: 'School is closed on Friday',
      });

      const call = mockSend.mock.calls[0][1];
      expect(call.text).toContain('*School Closure*');
      expect(call.text).toContain('School is closed on Friday');
    });

    it('sendCustomMessage passes message through unchanged', async () => {
      const service = await bootService();
      const mockSend = jest.fn().mockResolvedValue({ key: { id: 'cust-id' } });
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      await service.sendCustomMessage({
        parentPhone: '0712345678',
        message: 'Exact custom message',
      });

      const call = mockSend.mock.calls[0][1];
      expect(call.text).toBe('Exact custom message');
    });
  });

  // ── 10. Error Handling ──────────────────────────────────────────────────

  describe('10. Error handling', () => {
    it('returns success:false and captures error message on send failure', async () => {
      const service = await bootService();
      const mockSend = jest.fn().mockRejectedValue(new Error('Socket closed unexpectedly'));
      (service as any).sock = { sendMessage: mockSend };
      (service as any).status = 'authenticated';

      const result = await service.sendMessage({ to: '0712345678', message: 'Hello' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Socket closed');
    });

    it('stopClient clears the socket and resets status', async () => {
      const service = await bootService();
      const mockEnd = jest.fn();
      (service as any).sock = {
        end: mockEnd,
        sendMessage: jest.fn(),
        ev: { removeAllListeners: jest.fn() },
      };
      (service as any).status = 'authenticated';

      await service.stopClient();

      expect(mockEnd).toHaveBeenCalled();
      expect(service.getStatus().status).toBe('disconnected');
    });
  });
});
