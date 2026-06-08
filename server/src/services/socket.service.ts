
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
    user?: any;
}

let io: SocketIOServer;

export const initializeSocket = (httpServer: any) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: (origin, callback) => {
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://localhost:5173',
                    process.env.FRONTEND_URL
                ].filter(Boolean);
                
                if (!origin || allowedOrigins.includes(origin)) {
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
            let token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

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

            const secret = process.env.JWT_SECRET || 'fallback_secret_should_be_changed';
            const decoded = jwt.verify(token, secret);
            socket.user = decoded;
            next();
        } catch (err) {
            console.error("Socket auth error:", err);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`🔌 User connected to socket: ${socket.user?.id} (${socket.user?.email})`);

        // Join user's personal room for direct notifications
        if (socket.user?.id) {
            socket.join(socket.user.id);
        }

        // Join ticket room
        socket.on('join_ticket', (ticketId: string) => {
            console.log(`User ${socket.user?.id} joined ticket room: ${ticketId}`);
            socket.join(ticketId);
        });

        socket.on('leave_ticket', (ticketId: string) => {
            socket.leave(ticketId);
        });

        // Join a chat conversation room
        socket.on('chat:join', (conversationId: string) => {
            socket.join(`conv:${conversationId}`);
        });

        socket.on('chat:leave', (conversationId: string) => {
            socket.leave(`conv:${conversationId}`);
        });

        // Ephemeral typing indicator — no DB write, just relay to the room
        socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
            if (!data?.conversationId) return;
            socket.to(`conv:${data.conversationId}`).emit('chat:typing', {
                conversationId: data.conversationId,
                userId: socket.user?.id,
                isTyping: !!data.isTyping,
            });
        });

        socket.on('disconnect', () => {
            // console.log('User disconnected from socket');
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
