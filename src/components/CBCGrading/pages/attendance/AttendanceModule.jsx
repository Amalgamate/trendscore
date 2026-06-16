/**
 * AttendanceModule — Responsive router.
 * Serves MobileAttendance on small screens, DesktopAttendance on large screens.
 * This is the drop-in replacement for DailyAttendanceAPI.jsx.
 */

import React from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MobileAttendance } from './MobileAttendance';
import { DesktopAttendance } from './DesktopAttendance';

export function AttendanceModule() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  return isMobile ? <MobileAttendance /> : <DesktopAttendance />;
}

export default AttendanceModule;
