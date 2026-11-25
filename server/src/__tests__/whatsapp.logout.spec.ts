/**
 * Regression tests for WhatsApp logout.
 *
 * A logout used to answer HTTP 200 while leaving the Baileys auth directory on
 * disk: `fs.rmSync` threw EBUSY because the socket still held the key files, and
 * the controller ignored `{ success: false }`. The school's number stayed paired
 * with nothing in the UI to say so.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const authDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-auth-spec-'));
process.env.WHATSAPP_AUTH_DIR = authDir;

// The service auto-connects in its constructor when creds exist; write ours
// after import so construction stays quiet.
import { whatsappService } from '../services/whatsapp.service';

function seedAuthFolder(): void {
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(authDir, 'creds.json'), '{"me":{"id":"254700000000:1@s.whatsapp.net"}}');
  fs.writeFileSync(path.join(authDir, 'app-state-sync-key-AAAA.json'), '{}');
}

/** Entries left in the auth dir. The directory itself survives (mount point). */
function authDirEntries(): string[] {
  return fs.existsSync(authDir) ? fs.readdirSync(authDir) : [];
}

afterAll(() => {
  fs.rmSync(authDir, { recursive: true, force: true });
});

describe('WhatsApp logout', () => {
  beforeEach(() => {
    seedAuthFolder();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(authDir, { recursive: true, force: true });
  });

  it('clears the auth folder even when the socket rejects logout()', async () => {
    // Simulates a device already revoked from the phone: the remote call fails,
    // but the local pairing must still be dropped.
    const fakeSock = {
      user: { id: '254700000000:1@s.whatsapp.net' },
      ev: { removeAllListeners: jest.fn() },
      logout: jest.fn().mockRejectedValue(new Error('Connection Closed')),
    };
    (whatsappService as any).sock = fakeSock;

    const result = await whatsappService.logout();

    expect(fakeSock.logout).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(authDirEntries()).toHaveLength(0);
  });

  it('retries an EBUSY purge instead of reporting false success', async () => {
    // The original bug: a busy handle made rm() throw while logout still
    // reported success. Fail once, then let the retry succeed.
    let attempts = 0;
    const realRm = fs.promises.rm.bind(fs.promises);
    jest.spyOn(fs.promises, 'rm').mockImplementation(async (target: any, opts: any) => {
      attempts += 1;
      if (attempts === 1) {
        const err: any = new Error('EBUSY: resource busy or locked, rmdir');
        err.code = 'EBUSY';
        throw err;
      }
      return realRm(target, opts);
    });

    const result = await whatsappService.logout();

    expect(attempts).toBeGreaterThan(1);
    expect(result.success).toBe(true);
    expect(authDirEntries()).toHaveLength(0);
  });

  it('reports failure when the auth folder cannot be removed at all', async () => {
    jest.spyOn(fs.promises, 'rm').mockImplementation(async () => {
      const err: any = new Error('EBUSY: resource busy or locked, rmdir');
      err.code = 'EBUSY';
      throw err;
    });

    const result = await whatsappService.logout();

    // Must not claim success — the operator needs to know to log out on the phone.
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Linked devices/i);
  });

  it('never reports authenticated without a live socket', () => {
    (whatsappService as any).status = 'authenticated';
    (whatsappService as any).sock = null;

    expect(whatsappService.getStatus().status).toBe('disconnected');

    (whatsappService as any).sock = { user: { id: '254700000000:1@s.whatsapp.net' } };
    expect(whatsappService.getStatus().status).toBe('authenticated');
  });
});
