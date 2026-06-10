
import { Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import prisma from '../config/database';
import { getIO } from '../services/socket.service';
import { EmailService } from '../services/email-resend.service';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';

import logger from '../utils/logger';
export const createTicket = async (req: AuthRequest, res: Response) => {
    try {
        const { subject, message, priority, guestName, guestEmail } = req.body;
        // Check if user is authenticated
        const userId = req.user?.userId || null;

        if (!userId && (!guestEmail || !guestName)) {
            return res.status(400).json({ message: "Guest Name and Email are required for unauthenticated tickets." });
        }

        const ticketData: any = {
            subject,
            priority: priority || 'MEDIUM',
            userId,
            guestName,
            guestEmail,
        };

        // If authenticated, we add the message using nested create
        if (userId) {
            ticketData.messages = {
                create: {
                    message,
                    senderId: userId
                }
            };
        }

        const ticket = await prisma.supportTicket.create({
            data: ticketData,
            include: {
                messages: true,
                user: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
        });

        // Send Email Notification to Support Team
        try {
            const schoolName = PRODUCT_DISPLAY_NAME;
            let userName = 'Guest';

            if (userId) {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, firstName: true, lastName: true }
                });
                if (user) {
                    userName = `${user.firstName} ${user.lastName}`;
                }
            } else {
                userName = `${guestName} (Guest)`;
            }

            await EmailService.sendTicketCreated({
                schoolName,
                userName: userName,
                ticketSubject: subject,
                ticketPriority: priority || 'MEDIUM',
                ticketMessage: message,
                ticketId: ticket.id
            });
        } catch (emailError) {
            logger.error('Failed to send ticket email notification:', emailError);
        }

        res.status(201).json(ticket);
    } catch (error) {
        logger.error('Error creating ticket:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getTickets = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const userRole = req.user?.role;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        let whereClause: any = {};

        if (userRole === 'SUPER_ADMIN') {
            // Super Admin sees all tickets
            whereClause = {};
        } else {
            // Others see their own tickets
            whereClause = { userId };
        }

        const tickets = await prisma.supportTicket.findMany({
            where: whereClause,
            include: {
                user: { select: { id: true, firstName: true, lastName: true } },
                _count: { select: { messages: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(tickets);
    } catch (error) {
        logger.error('Error fetching tickets:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getTicket = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const userRole = req.user?.role;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const ticket = await prisma.supportTicket.findUnique({
            where: { id },
            include: {
                messages: {
                    include: {
                        sender: { select: { id: true, firstName: true, lastName: true, role: true } }
                    },
                    orderBy: { createdAt: 'asc' }
                },
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                assignedTo: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Access Control
        if (userRole !== 'SUPER_ADMIN' && ticket.userId !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(ticket);
    } catch (error) {
        logger.error('Error fetching ticket:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const addMessage = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // Verify ticket exists
        const ticket = await prisma.supportTicket.findUnique({
            where: { id }
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const newMessage = await prisma.supportMessage.create({
            data: {
                ticketId: id,
                senderId: userId,
                message
            },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, role: true } }
            }
        });

        // Update ticket updated time
        await prisma.supportTicket.update({
            where: { id },
            data: { updatedAt: new Date(), status: 'IN_PROGRESS' }
        });

        // Emit Socket Event
        try {
            const io = getIO();
            io.to(id).emit('new_message', newMessage);
        } catch (e) {
            logger.warn('Socket emit failed (socket might not be init)', e);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        logger.error('Error adding message:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateTicket = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, priority, assignedToId } = req.body;
        const userRole = req.user?.role;

        if (!userRole) return res.status(401).json({ message: 'Unauthorized' });

        if (userRole !== 'SUPER_ADMIN') {
            // Basic users can only close tickets maybe?
            if (status !== 'CLOSED' && status !== 'RESOLVED') {
                return res.status(403).json({ message: "Only admins can update ticket details" });
            }
        }

        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: {
                status,
                priority,
                assignedToId
            }
        });

        res.json(ticket);
    } catch (error) {
        logger.error("Error updating ticket", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
