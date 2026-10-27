
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { normalizeRole } from '../utils/roleNormalizer';
import { isTokenGloballyInvalidated } from './auth-session.service';
import { redisCacheService } from './redis-cache.service';
import { revokedImpersonationKey } from './impersonation.service';

interface SocketClaims {
    userId?: string;
    id?: string;
    email?: string;
    role?: string;
    roles?: string[];
    iat?: number;
    exp?: number;
    authVersion?: number;
    isImpersonation?: boolean;
    originalAdminId?: string;
}

interface AuthenticatedSocket extends Socket {
    user?: SocketClaims;
}

let io: SocketIOServer;

export const initializeSocket = (httpServer: import('http').Server) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: (origin, callback) => {
                const configuredOrigins = [process.env.FRONTEND_URL]
                    .filter((value): value is string => Boolean(value))
                    .map(value => value.replace(/\/$/, ''));
                const developmentOrigins = [
                    'http://localhost:3000',
                    'http://localhost:5173',
                    'http://localhost',
                    'capacitor://localhost',
                    'https://localhost',
                ];
                const allowedOrigins = process.env.NODE_ENV === 'production'
                    ? configuredOrigins
                    : [...configuredOrigins, ...developmentOrigins];
                const normalizedOrigin = origin?.replace(/\/$/, '');

                if (!origin || allowedOrigins.includes(normalizedOrigin!)) {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.use(async (socket: AuthenticatedSocket, next) => {
        try {
            const authToken = socket.handshake.auth?.token;
            const authorization = socket.handshake.headers.authorization;
            let token = typeof authToken === 'string'
                ? authToken
                : authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

            // If token is missing or the special "__cookie__" placeholder, try to get it from cookies
            if (!token || token === '__cookie__') {
                const cookieHeader = socket.handshake.headers.cookie;
                if (cookieHeader) {
                    const match = cookieHeader.match(/accessToken=([^;]+)/);
                    if (match) {
                        token = match[1];
                    }
                }
            }

            if (!token || token === '__cookie__') {
                return next(new Error('Authentication error: No valid token or cookie provided'));
            }

            const secret = process.env.JWT_SECRET;
            if (!secret || secret.length < 32) {
                return next(new Error('Authentication unavailable'));
            }
            const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
                userId?: string;
                id?: string;
                role?: string;
                roles?: string[];
                authVersion?: number;
                iat?: number;
                isImpersonation?: boolean;
                originalAdminId?: string;
            };
            if (!decoded.userId && !decoded.id) {
                return next(new Error('Authentication error: Invalid token'));
            }
            if (await isTokenGloballyInvalidated(decoded)) {
                return next(new Error('Authentication error: Session invalidated'));
            }
            if (decoded.isImpersonation && !decoded.originalAdminId?.trim()) {
                return next(new Error('Authentication error: Invalid impersonation token'));
            }
            if (decoded.isImpersonation) {
                const revoked = await redisCacheService.getSecurityValue(revokedImpersonationKey(token));
                if (revoked) return next(new Error('Authentication error: Session revoked'));
            }
            const userId = decoded.userId || decoded.id;
            const currentUser = userId ? await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, role: true, roles: true, status: true, archived: true, authVersion: true },
            }) : null;
            if (!currentUser || currentUser.status !== 'ACTIVE' || currentUser.archived || (decoded.authVersion ?? 0) !== currentUser.authVersion) {
                return next(new Error('Authentication error: Account or session is inactive'));
            }
            const tokenRoles = [decoded.role, ...(decoded.roles ?? [])].map(normalizeRole).filter(Boolean).sort();
            const currentRoles = [currentUser.role, ...currentUser.roles].map(normalizeRole).filter(Boolean).sort();
            if (tokenRoles.length !== currentRoles.length || tokenRoles.some((role, index) => role !== currentRoles[index])) {
                return next(new Error('Authentication error: Role claims are no longer current'));
            }
            if (decoded.isImpersonation) {
                const administrator = await prisma.user.findUnique({
                    where: { id: decoded.originalAdminId },
                    select: { role: true, roles: true, status: true, archived: true },
                });
                const administratorRoles = [administrator?.role, ...(administrator?.roles ?? [])].map(normalizeRole);
                if (!administrator || administrator.status !== 'ACTIVE' || administrator.archived ||
                    !administratorRoles.some(role => role === 'ADMIN' || role === 'SUPER_ADMIN')) {
                    return next(new Error('Authentication error: Impersonation owner is no longer authorized'));
                }
            }
            socket.user = { ...decoded, userId: currentUser.id, email: currentUser.email, role: currentUser.role, roles: currentUser.roles, authVersion: currentUser.authVersion };
            socket.data.accessToken = token;
            next();
        } catch (err) {
            console.error("Socket auth error:", err);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`🔌 User connected to socket: ${socket.user?.userId || socket.user?.id}`);

        // Join user's personal room for direct notifications
        const userId = socket.user?.userId || socket.user?.id;
        if (userId) {
            socket.join(userId);
        }

        const roles = [socket.user?.role, ...(socket.user?.roles ?? [])].map(normalizeRole);
        const canViewStaffAttendance = roles.some(role =>
            ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(role)
        );
        if (canViewStaffAttendance) socket.join('attendance:school');

        // Re-check session state for long-lived connections so logout, account
        // suspension, and role/security changes take effect without a reconnect.
        const sessionGuard = setInterval(async () => {
            try {
                const [invalidated, revoked, currentUser, administrator] = await Promise.all([
                    isTokenGloballyInvalidated(socket.user || {}),
                    socket.user?.isImpersonation
                        ? redisCacheService.getSecurityValue(revokedImpersonationKey(socket.data.accessToken))
                        : Promise.resolve(null),
                    prisma.user.findUnique({
                        where: { id: userId },
                        select: { role: true, roles: true, status: true, archived: true, authVersion: true },
                    }),
                    socket.user?.isImpersonation
                        ? prisma.user.findUnique({
                            where: { id: socket.user.originalAdminId },
                            select: { role: true, roles: true, status: true, archived: true },
                        })
                        : Promise.resolve(null),
                ]);
                const rolesChanged = currentUser && (
                    JSON.stringify([currentUser.role, ...currentUser.roles].map(normalizeRole).sort()) !==
                    JSON.stringify([socket.user?.role, ...(socket.user?.roles ?? [])].map(normalizeRole).sort())
                );
                const administratorInvalid = socket.user?.isImpersonation && (
                    !administrator || administrator.status !== 'ACTIVE' || administrator.archived ||
                    ![administrator.role, ...administrator.roles].map(normalizeRole).some(role => role === 'ADMIN' || role === 'SUPER_ADMIN')
                );
                const expired = typeof socket.user?.exp === 'number' && socket.user.exp * 1000 <= Date.now();
                if (expired || invalidated || revoked || administratorInvalid || !currentUser || currentUser.status !== 'ACTIVE' || currentUser.archived || currentUser.authVersion !== socket.user?.authVersion || rolesChanged) {
                    socket.disconnect(true);
                }
            } catch {
                // Security state cannot be verified; fail closed for this socket.
                socket.disconnect(true);
            }
        }, 30_000);
        sessionGuard.unref?.();

        // Each school runs in an isolated deployment. This room is scoped to
        // this Socket.IO server/container; no school identifier is required.
        socket.on('join_attendance', async (room: string) => {
            if (typeof room !== 'string' || !userId) return;
            if (!canViewStaffAttendance) return;
            if (room === 'attendance:school') await socket.join('attendance:school');
        });

        // Join ticket room
        socket.on('join_ticket', async (ticketId: string) => {
            if (typeof ticketId !== 'string' || !ticketId.trim() || !userId) return;
            try {
                const ticket = await prisma.supportTicket.findUnique({
                    where: { id: ticketId },
                    select: { userId: true },
                });
                const roles = [socket.user?.role, ...(socket.user?.roles ?? [])].map(normalizeRole);
                if (ticket && (ticket.userId === userId || roles.includes('SUPER_ADMIN'))) {
                    await socket.join(ticketId);
                }
            } catch (error) {
                console.error('Socket ticket authorization failed:', error);
            }
        });

        socket.on('leave_ticket', (ticketId: string) => {
            if (typeof ticketId === 'string' && ticketId.trim()) socket.leave(ticketId);
        });

        // Join a chat conversation room
        socket.on('chat:join', async (conversationId: string) => {
            if (typeof conversationId !== 'string' || !conversationId.trim() || !userId) return;
            try {
                const participant = await prisma.conversationParticipant.findFirst({
                    where: { conversationId, userId, leftAt: null },
                    select: { id: true },
                });
                if (participant) await socket.join(`conv:${conversationId}`);
            } catch (error) {
                console.error('Socket conversation authorization failed:', error);
            }
        });

        socket.on('chat:leave', (conversationId: string) => {
            if (typeof conversationId === 'string' && conversationId.trim()) {
                socket.leave(`conv:${conversationId}`);
            }
        });

        // Ephemeral typing indicator — no DB write, just relay to the room
        socket.on('chat:typing', async (data: { conversationId: string; isTyping: boolean }) => {
            if (
                !userId ||
                typeof data?.conversationId !== 'string' ||
                !data.conversationId.trim() ||
                typeof data.isTyping !== 'boolean' ||
                !socket.rooms.has(`conv:${data.conversationId}`)
            ) return;

            try {
                const participant = await prisma.conversationParticipant.findFirst({
                    where: { conversationId: data.conversationId, userId, leftAt: null },
                    select: { id: true },
                });
                if (!participant) return;
                socket.to(`conv:${data.conversationId}`).emit('chat:typing', {
                    conversationId: data.conversationId,
                    userId,
                    isTyping: data.isTyping,
                });
            } catch (error) {
                console.error('Socket typing authorization failed:', error);
            }
        });

        socket.on('disconnect', () => {
            clearInterval(sessionGuard);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
