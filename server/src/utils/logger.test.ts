import pino from 'pino';
import { LOG_REDACTION_PATHS } from './logger';

describe('production log redaction', () => {
  it('removes request credentials and terminal secrets from serialized logs', () => {
    const lines: string[] = [];
    const destination = { write: (line: string) => lines.push(line) };
    const testLogger = pino({
      redact: { paths: LOG_REDACTION_PATHS, censor: '[REDACTED]' },
    }, destination);

    testLogger.info({
      req: {
        headers: {
          authorization: 'Bearer terminal-secret',
          cookie: 'accessToken=portal-secret',
        },
      },
      deviceToken: 'device-secret',
    }, 'request completed');

    const payload = JSON.parse(lines[0]);
    expect(payload.req.headers.authorization).toBe('[REDACTED]');
    expect(payload.req.headers.cookie).toBe('[REDACTED]');
    expect(payload.deviceToken).toBe('[REDACTED]');
    expect(lines[0]).not.toContain('terminal-secret');
    expect(lines[0]).not.toContain('portal-secret');
    expect(lines[0]).not.toContain('device-secret');
  });
});
