/**
 * AppLevelClockInToast
 *
 * Thin wrapper rendered once at the app-shell level (CBCGradingSystem).
 * Manages its own Socket.io subscription so clock-in toasts appear on
 * every page — not just when the admin is on the Attendance page.
 *
 * Only mounts the socket for SUPER_ADMIN, ADMIN, and HEAD_TEACHER roles.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getAuthItem } from '../../../../utils/authStorage';
import FloatingClockInToast from './FloatingClockInToast';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);

const AppLevelClockInToast = ({ user }) => {
    const [latestEvent, setLatestEvent] = useState(null);
    const socketRef = useRef(null);

    const isAdmin = ADMIN_ROLES.has(String(user?.role || '').toUpperCase());

    const handleEvent = useCallback((event) => {
        if (!event?.userId) return;
        setLatestEvent({ ...event, _ts: Date.now() }); // force re-render even for same user
    }, []);

    useEffect(() => {
        if (!isAdmin || !user?.id) return;

        const socket = io(window.location.origin, {
            withCredentials: true,
            auth: { token: getAuthItem('token') },
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            // Join the generic school attendance room
            socket.emit('join_attendance', 'attendance:school');
        });

        socket.on('hr:clock_event', handleEvent);

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isAdmin, user?.id, handleEvent]);

    if (!isAdmin) return null;

    return <FloatingClockInToast latestEvent={latestEvent} />;
};

export default AppLevelClockInToast;
