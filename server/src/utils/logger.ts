import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

// pino-http serializes request headers by default. Keep credentials out of
// application and container logs even when a caller logs the surrounding
// request/response object.
export const LOG_REDACTION_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'authorization',
  'cookie',
  'accessToken',
  'refreshToken',
  'deviceToken',
  'password',
  'secret',
];

const pinoInstance = pino({
  level: logLevel,
  redact: {
    paths: LOG_REDACTION_PATHS,
    censor: '[REDACTED]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
  base: isProduction ? { env: process.env.NODE_ENV } : undefined,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Normalise variadic console.log-style args into pino's (obj, msg) form.
// logger.error('msg', err)       → pinoInstance.error({ err }, 'msg')
// logger.info('msg', { foo })    → pinoInstance.info({ foo }, 'msg')
// logger.info('simple msg')      → pinoInstance.info('simple msg')
function normalise(args: unknown[]): [object, string] | [string] {
  if (args.length === 0) return [''];
  if (args.length === 1) return [String(args[0])];

  const [first, second, ...rest] = args;

  if (typeof first === 'string') {
    if (second instanceof Error) {
      return [{ err: second, extra: rest.length ? rest : undefined }, first];
    }
    if (typeof second === 'object' && second !== null) {
      return [second as object, first];
    }
    // Primitive second arg — embed as 'value'
    return [{ value: second, extra: rest.length ? rest : undefined }, first];
  }

  // Non-string first arg (object/Error) — treat as context, rest as message
  if (first instanceof Error) {
    return [{ err: first }, rest.length ? String(rest[0]) : String(second ?? '')];
  }
  return [first as object, String(second ?? '')];
}

export type LogFn = (...args: unknown[]) => void;

export interface AppLogger {
  info:  LogFn;
  error: LogFn;
  warn:  LogFn;
  debug: LogFn;
  /** Expose the raw pino instance for libraries that require it (e.g. pino-http). */
  pino: typeof pinoInstance;
}

const logger: AppLogger = {
  info:  (...args) => (pinoInstance.info  as any)(...normalise(args)),
  error: (...args) => (pinoInstance.error as any)(...normalise(args)),
  warn:  (...args) => (pinoInstance.warn  as any)(...normalise(args)),
  debug: (...args) => (pinoInstance.debug as any)(...normalise(args)),
  pino: pinoInstance,
};

export default logger;
