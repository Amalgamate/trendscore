/**
 * WhatsApp Service - Powered by Baileys (WebSocket-based)
 * @see https://github.com/WhiskeySockets/Baileys
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  MediaType,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import * as path from 'path';
import * as fs from 'fs';
import * as pino from 'pino';

// Auth state persisted to disk — survives server restarts
const AUTH_FOLDER = path.resolve(__dirname, '../../whatsapp-auth');

type ConnectionStatus = 'disconnected' | 'qr_needed' | 'authenticated' | 'initializing';

class WhatsAppService {
  private sock: ReturnType<typeof makeWASocket> | null = null;
  private status: ConnectionStatus = 'disconnected';
  private qrCode: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private initializePromise: Promise<void> | null = null;
  private manualLogout = false;

  constructor() {
    console.log('[WhatsApp] Baileys service ready. Call initialize() to connect.');
    // Auto-connect on startup if auth already exists
    if (fs.existsSync(path.join(AUTH_FOLDER, 'creds.json'))) {
      console.log('[WhatsApp] Found existing session — reconnecting...');
      this.initialize().catch(err => console.error('[WhatsApp] Auto-reconnect failed:', err));
    }
  }

  getStatus(): { status: ConnectionStatus; qrCode: string | null } {
    return { status: this.status, qrCode: this.qrCode };
  }

  async initialize(): Promise<void> {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this.initializeInternal();
    try {
      await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  private async initializeInternal(): Promise<void> {
    if (process.env.DISABLE_WHATSAPP === 'true') {
      console.log('[WhatsApp] Service disabled via environment variable.');
      return;
    }
    if (this.status === 'initializing' || this.status === 'authenticated') return;

    // A user-initiated initialize should resume normal reconnect behavior.
    this.manualLogout = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.end(undefined);
      } catch (socketCleanupErr) {
        console.error('[WhatsApp] Socket cleanup warning:', socketCleanupErr);
      } finally {
        this.sock = null;
      }
    }

    this.status = 'initializing';
    this.qrCode = null;

    try {
      if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const { version } = await fetchLatestBaileysVersion();

      const logger = (pino as any).default
        ? (pino as any).default({ level: 'silent' })
        : (pino as any)({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        browser: Browsers.macOS('Desktop'),
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
      });

      // Save auth credentials whenever they update
      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', (update) => {
        try {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            // QR code available — store as raw string, frontend renders it via qrserver API
            this.qrCode = qr;
            this.status = 'qr_needed';
            console.log('[WhatsApp] QR code ready — waiting for scan...');
          }

          if (connection === 'close') {
            this.status = 'disconnected';
            this.qrCode = null;
            
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.manualLogout;

            console.log('[WhatsApp] Connection closed. Status code:', statusCode, '| Reconnect:', shouldReconnect);
            
            if (lastDisconnect?.error) {
              console.error('[WhatsApp] Disconnect error details:', lastDisconnect.error);
            }

            if (statusCode === DisconnectReason.loggedOut) {
              console.log('[WhatsApp] Session invalid or logged out. Clearing auth data to generate a fresh QR code...');
              if (fs.existsSync(AUTH_FOLDER)) {
                fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
              }
            }

            if (shouldReconnect) {
              if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
              }
              const delayMs = statusCode === 408 ? 2000 : 3000;
              console.log(`[WhatsApp] Reconnecting in ${Math.floor(delayMs / 1000)} seconds...`);
              // Reconnect after a short delay with disconnected status so initialize() bypasses the lock
              this.status = 'disconnected';
              this.reconnectTimeout = setTimeout(() => {
                this.reconnectTimeout = null;
                this.initialize().catch(err => console.error('[WhatsApp] Reconnect task failed:', err));
              }, delayMs);
            }
          }

          if (connection === 'open') {
            this.status = 'authenticated';
            this.qrCode = null;
            this.manualLogout = false;
            console.log('[WhatsApp] ✅ Connected and authenticated!');
          }
        } catch (eventErr) {
          console.error('[WhatsApp] Error in connection.update listener:', eventErr);
        }
      });
    } catch (err) {
      this.status = 'disconnected';
      console.error('[WhatsApp] Initialization error:', err);
      // Don't throw, just log it so the server doesn't crash
    }
  }

  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      this.manualLogout = true;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      if (this.sock) {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        await this.sock.logout();
        this.sock = null;
      }
      // Remove saved auth so next initialize() generates fresh QR
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      }
      this.status = 'disconnected';
      this.qrCode = null;
      return { success: true, message: 'Logged out and session cleared.' };
    } catch (err: any) {
      this.manualLogout = false;
      return { success: false, message: err.message };
    }
  }

  async stopClient(): Promise<void> {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    if (this.sock) {
      this.sock.ev.removeAllListeners('connection.update');
      this.sock.ev.removeAllListeners('creds.update');
      this.sock.end(undefined);
      this.sock = null;
    }
    this.status = 'disconnected';
  }

  private formatPhone(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '254' + clean.slice(1);
    if (!clean.startsWith('254')) clean = '254' + clean;
    return clean + '@s.whatsapp.net';
  }

  async sendMessage(params: {
    to: string;
    message: string;
    mediaBuffer?: Buffer;
    mediaType?: string;
    mediaFileName?: string;
    mediaBase64?: string;
  }): Promise<{ success: boolean; message: string; messageId?: string; error?: string }> {
    if (!this.sock || this.status !== 'authenticated') {
      return { success: false, message: 'WhatsApp is not connected. Please scan the QR code first.' };
    }

    try {
      const jid = this.formatPhone(params.to);

      let buffer: Buffer | null = null;
      let mimeType: string = params.mediaType || 'application/pdf';
      let fileName: string = params.mediaFileName || 'document.pdf';

      if (params.mediaBuffer) {
        buffer = params.mediaBuffer;
      } else if (params.mediaBase64) {
        // Convert base64 data URL to Buffer
        const matches = (params.mediaBase64 as string).match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          // Assume raw base64 string
          buffer = Buffer.from(params.mediaBase64, 'base64');
        }
      }

      if (buffer) {
        if (!fileName) fileName = mimeType.includes('image') ? 'report.jpg' : 'document.pdf';
        
        let mediaOptions: any;
        // Choose between image and document based on mimeType
        if (mimeType.startsWith('image/')) {
          mediaOptions = { 
            image: buffer, 
            caption: params.message 
          };
        } else {
          mediaOptions = {
            document: buffer,
            mimetype: mimeType,
            fileName,
            caption: params.message,
          };
        }

        const sent = await this.sock.sendMessage(jid, mediaOptions);
        return { success: true, message: 'Sent', messageId: sent?.key?.id ?? undefined };
      }

      // Plain text
      const sent = await this.sock.sendMessage(jid, { text: params.message });
      return { success: true, message: 'Sent', messageId: sent?.key?.id ?? undefined };
    } catch (err: any) {
      console.error('[WhatsApp] Send error:', err);
      return { success: false, message: err.message, error: err.message };
    }
  }

  async sendAssessmentReport(data: any): Promise<{ success: boolean; message: string; error?: string }> {
    // 1. Build a text-based summary of scores
    let subjectsText = '';
    if (data.subjects && typeof data.subjects === 'object') {
      const header = `SUBJECT   | SCR | GRD`;
      const sep    = `----------|-----|----`;
      
      const rows = Object.entries(data.subjects).map(([name, info]: [string, any]) => {
        const subName = name.toUpperCase().padEnd(10).slice(0, 10);
        const score = (info.score + '%').padStart(4);
        const grade = (info.grade || '').padStart(4);
        return `${subName}|${score} |${grade}`;
      });

      subjectsText = `\`\`\`\n${header}\n${sep}\n${rows.join('\n')}\n\`\`\`\n\n`;
    }

    const averageText = data.averageScore ? `*Average:* ${data.averageScore}% (${data.overallGrade || ''})\n` : '';
    const schoolName = data.schoolName || PRODUCT_DISPLAY_NAME;

    const message = 
      `*${schoolName.toUpperCase()}*\n` +
      `_Assessment Report: ${data.term || ''}_\n\n` +
      `Dear *${data.parentName || 'Parent'}*,\n` +
      `Results for *${data.learnerName}*:\n\n` +
      subjectsText +
      averageText +
      `Please find the detailed report attached below.\n\n` +
      `_Sent via ${PRODUCT_DISPLAY_NAME} System_`;

    return this.sendMessage({
      to: data.parentPhone,
      message,
      mediaBase64: data.reportImageBase64,
      mediaType: 'image/jpeg',
      mediaFileName: `${data.learnerName}_Report.jpg`,
    });
  }

  async sendCustomMessage(params: any): Promise<{ success: boolean; message: string; error?: string }> {
    return this.sendMessage({ to: params.parentPhone, message: params.message });
  }

  async sendAnnouncement(params: any): Promise<{ success: boolean; message: string; error?: string }> {
    return this.sendMessage({
      to: params.parentPhone,
      message: `*${params.title}*\n\n${params.content}`,
    });
  }

  async sendFeeReminder(params: any): Promise<{ success: boolean; message: string; error?: string }> {
    return this.sendMessage({ to: params.parentPhone, message: params.message || 'Fee Reminder' });
  }

  async sendAssessmentNotification(params: any): Promise<{ success: boolean; message: string; error?: string }> {
    return this.sendMessage({ to: params.parentPhone, message: params.message });
  }

  async sendFeePaymentNotification(params: {
    parentPhone: string;
    parentName: string;
    learnerName: string;
    receiptNumber: string;
    amount: number;
    balance: number;
    status: string;
    schoolName: string;
  }): Promise<{ success: boolean; message: string; error?: string }> {
    const message = 
      `*${params.schoolName.toUpperCase()}*\n` +
      `_OFFICIAL RECEIPT: ${params.receiptNumber}_\n\n` +
      `Dear *${params.parentName}*,\n` +
      `We have received KES *${params.amount.toLocaleString()}* for *${params.learnerName}*.\n\n` +
      `*Status:* ${params.status}\n` +
      `*Current Balance:* KES ${params.balance.toLocaleString()}\n\n` +
      `Thank you for your payment.\n` +
      `_${PRODUCT_DISPLAY_NAME}_`;

    return this.sendMessage({ to: params.parentPhone, message });
  }

  async sendBulkMessages(messages: Array<{ phone: string; message: string; mediaBuffer?: Buffer; mediaType?: string; mediaFileName?: string }>): Promise<{ sent: number; failed: number; results: Array<any> }> {
    let sent = 0;
    let failed = 0;
    const results = [];
    for (const msg of messages) {
      // 1-second delay between messages to avoid rate-limiting
      await new Promise(r => setTimeout(r, 1000));
      const res = await this.sendMessage({ to: msg.phone, message: msg.message, mediaBuffer: msg.mediaBuffer, mediaType: msg.mediaType, mediaFileName: msg.mediaFileName });
      if (res.success) sent++; else failed++;
      results.push({ success: res.success, phone: msg.phone, error: res.error });
    }
    return { sent, failed, results };
  }

  async sendBulkAnnouncement(recipients: string[], messageText: string): Promise<{ success: boolean; sent: number; failed: number; message: string }> {
    const messages = recipients.map(phone => ({ phone, message: messageText }));
    const result = await this.sendBulkMessages(messages);
    return { success: result.sent > 0, sent: result.sent, failed: result.failed, message: `Sent ${result.sent}/${recipients.length}` };
  }

  async sendBulkAssessmentNotifications(notifications: Array<any>): Promise<{ success: boolean; sent: number; failed: number }> {
    const messages = notifications.map(n => ({ phone: n.parentPhone, message: n.message }));
    const result = await this.sendBulkMessages(messages);
    return { success: result.sent > 0, sent: result.sent, failed: result.failed };
  }
}

export const whatsappService = new WhatsAppService();
