jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation((_httpServer, options) => ({
    options,
    use: jest.fn(),
    on: jest.fn(),
  })),
}));

jest.mock('jsonwebtoken', () => ({ __esModule: true, default: { verify: jest.fn() } }));

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    supportTicket: { findUnique: jest.fn() },
    conversationParticipant: { findFirst: jest.fn() },
  },
}));

jest.mock('../services/auth-session.service', () => ({ isTokenGloballyInvalidated: jest.fn() }));
jest.mock('../services/redis-cache.service', () => ({ redisCacheService: { getSecurityValue: jest.fn() } }));

import { Server } from 'socket.io';
import { initializeSocket, getIO } from '../services/socket.service';

const mockedServer = Server as unknown as jest.Mock;

describe('Socket service instance boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'https://school.example.test/';
  });

  it('uses the configured frontend origin in production and rejects other origins', () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    initializeSocket({} as any);
    const instance = mockedServer.mock.results[0].value;
    const originCheck = instance.options.cors.origin;
    const allowed = jest.fn();
    const rejected = jest.fn();

    originCheck('https://school.example.test', allowed);
    originCheck('https://attacker.example.test', rejected);

    expect(allowed).toHaveBeenCalledWith(null, true);
    expect(rejected).toHaveBeenCalledWith(null, false);
    process.env.NODE_ENV = previousEnvironment;
  });

  it('allows only leadership roles into the container-local attendance room', async () => {
    initializeSocket({} as any);
    const instance = getIO() as any;
    const connection = instance.on.mock.calls.find(([event]: [string]) => event === 'connection')[1];
    const handlers: Record<string, (...args: any[]) => any> = {};
    const teacherSocket: any = {
      user: { userId: 'teacher-1', role: 'TEACHER', roles: ['TEACHER'] },
      connected: true,
      rooms: new Set<string>(),
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn((event, handler) => { handlers[event] = handler; }),
      disconnect: jest.fn(),
    };

    connection(teacherSocket);
    await handlers.join_attendance('attendance:school');
    handlers.disconnect();

    expect(teacherSocket.join).toHaveBeenCalledWith('teacher-1');
    expect(teacherSocket.join).not.toHaveBeenCalledWith('attendance:school');

    const headTeacherHandlers: Record<string, (...args: any[]) => any> = {};
    const headTeacherSocket: any = {
      user: { userId: 'head-1', role: 'HEAD_TEACHER', roles: ['HEAD_TEACHER'] },
      connected: true,
      rooms: new Set<string>(),
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn((event, handler) => { headTeacherHandlers[event] = handler; }),
      disconnect: jest.fn(),
    };
    connection(headTeacherSocket);
    await headTeacherHandlers.join_attendance('attendance:other-school');
    headTeacherHandlers.disconnect();

    expect(headTeacherSocket.join).toHaveBeenCalledWith('attendance:school');
    expect(headTeacherSocket.join).not.toHaveBeenCalledWith('attendance:other-school');
  });
});
