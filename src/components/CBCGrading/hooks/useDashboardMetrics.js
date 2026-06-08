import { useMemo } from 'react';

/**
 * Shared Dashboard Metrics Hook
 * Consolidates metric calculations used across all dashboard components
 * Single source of truth for health score and metric formatting
 */

export const useDashboardMetrics = (stats = {}) => {
  return useMemo(() => {
    // Extract stats with fallbacks
    const {
      totalStudents = 0,
      activeStudents = 0,
      totalTeachers = 0,
      activeTeachers = 0,
      presentToday = 0,
      absentToday = 0,
      feeCollected = 0,
      feePending = 0,
      totalMissedExams = 0,
      atRiskStudents = 0,
    } = stats;

    // Calculate rates
    const attendanceRate = totalStudents > 0
      ? Math.round((presentToday / (presentToday + absentToday || totalStudents)) * 100)
      : 0;

    const collectionRate = (feeCollected + feePending) > 0
      ? Math.round((feeCollected / (feeCollected + feePending)) * 100)
      : 0;

    const assessmentRate = totalStudents > 0
      ? Math.round(((totalStudents - totalMissedExams) / totalStudents) * 100)
      : 0;

    const teacherActiveRate = totalTeachers > 0
      ? Math.round((activeTeachers / totalTeachers) * 100)
      : 0;

    // Overall health score
    const healthScore = Math.round(
      (attendanceRate + collectionRate + assessmentRate) / 3
    );

    // Health status label
    const getHealthStatus = (score) => {
      if (score >= 80) return 'GOOD';
      if (score >= 60) return 'STABLE';
      return 'PENDING';
    };

    return {
      // Individual rates
      attendanceRate,
      collectionRate,
      assessmentRate,
      teacherActiveRate,
      
      // Overall score
      healthScore,
      healthStatus: getHealthStatus(healthScore),
      
      // Derived stats
      inactiveTeachers: Math.max(0, totalTeachers - activeTeachers),
      inactiveStudents: Math.max(0, totalStudents - activeStudents),
    };
  }, [stats]);
};

/**
 * Format utility functions - shared across all dashboards
 */
export const formatKesAmount = (amount = 0) => {
  const value = Number(amount) || 0;
  if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `KES ${Math.round(value / 1000)}K`;
  return `KES ${value.toLocaleString()}`;
};

export const formatPercent = (value = 0) => {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return `${percent}%`;
};

export const getHealthColor = (rate) => {
  if (rate >= 80) return 'emerald';
  if (rate >= 60) return 'amber';
  return 'red';
};

export const getHealthColorClasses = (rate) => {
  const color = getHealthColor(rate);
  const colors = {
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      bar: 'bg-emerald-600',
      border: 'border-emerald-100',
      badge: 'bg-emerald-600 text-white',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      bar: 'bg-amber-600',
      border: 'border-amber-100',
      badge: 'bg-amber-600 text-white',
    },
    red: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      bar: 'bg-red-600',
      border: 'border-red-100',
      badge: 'bg-red-600 text-white',
    },
  };
  return colors[color];
};
