/**
 * Attendance Anomaly Detector
 * Detects unusual attendance patterns and behavioral changes
 */

import { intelligenceDataService } from '../IntelligenceDataService';

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const toRate = (value) => Math.max(0, Math.min(1, toNumber(value)));

export class AttendanceAnomalyDetector {
  constructor() {
    this._cachedData = null;
    this._cachedContextKey = null;
  }

  async detectAnomalies(contextType, contextId, options = {}) {
    try {
      const attendanceData = await this.fetchAttendanceData(contextType, contextId, options);
      const baseline = this.calculateBaseline(attendanceData);
      const anomalies = this.findAnomalies(attendanceData, baseline);
      const alerts = this.generateAlerts(anomalies, attendanceData);

      return {
        type: 'attendance',
        timestamp: Date.now(),
        context: { type: contextType, id: contextId },
        currentMetrics: {
          presentToday: attendanceData.presentToday,
          totalExpected: attendanceData.totalExpected,
          attendanceRate:
            attendanceData.totalExpected > 0
              ? attendanceData.presentToday / attendanceData.totalExpected
              : 0,
          daysPresent: attendanceData.daysPresent,
          daysAbsent: attendanceData.daysAbsent,
        },
        weeklyHistory: attendanceData.weeklyHistory,
        baseline,
        anomalies,
        alerts,
        patterns: this.analyzePatterns(attendanceData),
      };
    } catch (error) {
      console.error('Attendance Anomaly Detection error:', error);
      return { type: 'attendance', error: error.message, alerts: [], anomalies: [] };
    }
  }

  async fetchAttendanceData(contextType, contextId, options = {}) {
    const contextKey = `${contextType}:${contextId}`;
    if (options.forceRefresh || this._cachedContextKey !== contextKey) {
      this._cachedData = null;
      this._cachedContextKey = contextKey;
    }

    if (this._cachedData) {
      return this._cachedData;
    }

    const summary = await intelligenceDataService.fetchSummary(options.forceRefresh);
    const attendance = summary?.attendance || {};
    const totalExpected = toNumber(attendance.totalExpected);
    const dailyData = Array.isArray(attendance.dailyBreakdown)
      ? attendance.dailyBreakdown.map((entry, index) => {
          const rate = toRate(entry?.avgRate);
          const present = Math.round(rate * totalExpected);
          return {
            date: entry?.dayOfWeek || `Day ${index + 1}`,
            present,
            absent: Math.max(0, Math.round((1 - rate) * totalExpected)),
            rate,
          };
        })
      : [];

    const mappedData = {
      presentToday: toNumber(attendance.presentToday),
      totalExpected,
      daysPresent: toNumber(attendance.presentToday),
      daysAbsent: toNumber(attendance.absentToday),
      dailyData,
      weeklyHistory: Array.isArray(attendance.weeklyHistory)
        ? attendance.weeklyHistory.map((entry, index) => ({
            week: entry?.week || `Week ${index + 1}`,
            avgRate: toRate(entry?.avgRate),
          }))
        : [],
    };

    this._cachedData = mappedData;
    return mappedData;
  }

  calculateBaseline(attendanceData) {
    const rates = attendanceData.weeklyHistory.map(w => w.avgRate);
    if (rates.length === 0) {
      return {
        expectedRate: 0,
        standardDeviation: 0,
        upperBound: 0,
        lowerBound: 0,
      };
    }

    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);

    return {
      expectedRate: mean,
      standardDeviation: stdDev,
      upperBound: mean + stdDev * 1.5,
      lowerBound: Math.max(0, mean - stdDev * 1.5),
    };
  }

  findAnomalies(attendanceData, baseline) {
    const anomalies = [];

    attendanceData.dailyData.forEach((day, idx) => {
      // Check if today's rate deviates significantly
      if (day.rate < baseline.lowerBound) {
        anomalies.push({
          date: day.date,
          type: 'sudden_drop',
          severity: day.rate < baseline.lowerBound - baseline.standardDeviation ? 'high' : 'medium',
          value: day.rate,
          baseline: baseline.expectedRate,
          deviation: ((baseline.expectedRate - day.rate) / baseline.expectedRate) * 100,
          description: `${day.absent} unexpected absences`,
        });
      }
    });

    // Check weekly trend
    if (attendanceData.weeklyHistory.length === 0) {
      return anomalies;
    }

    const lastWeekRate = attendanceData.weeklyHistory[attendanceData.weeklyHistory.length - 1].avgRate;
    const previousWeekRate = attendanceData.weeklyHistory[attendanceData.weeklyHistory.length - 2]?.avgRate || lastWeekRate;

    if (lastWeekRate < previousWeekRate - baseline.standardDeviation * 0.5) {
      anomalies.push({
        date: 'Last Week',
        type: 'declining_trend',
        severity: 'medium',
        value: lastWeekRate,
        baseline: previousWeekRate,
        deviation: ((previousWeekRate - lastWeekRate) / previousWeekRate) * 100,
        description: 'Attendance rate is declining week over week',
      });
    }

    return anomalies;
  }

  generateAlerts(anomalies, attendanceData) {
    const alerts = [];

    anomalies.forEach(anomaly => {
      alerts.push({
        type: 'attendance',
        severity: anomaly.severity,
        title: anomaly.type === 'sudden_drop' ? `Unusual Absence Pattern - ${anomaly.date}` : 'Declining Attendance Trend',
        description: `${anomaly.description}. Deviation: ${anomaly.deviation.toFixed(1)}% from baseline`,
        impact: Math.min(1, anomaly.deviation / 20),
        action: anomaly.type === 'sudden_drop' 
          ? 'Investigate cause of absences'
          : 'Review attendance patterns and intervene',
      });
    });

    // Alert if overall rate is below threshold
    const overallRate =
      attendanceData.totalExpected > 0
        ? attendanceData.presentToday / attendanceData.totalExpected
        : 0;
    if (overallRate < 0.85) {
      alerts.push({
        type: 'attendance',
        severity: overallRate < 0.75 ? 'critical' : 'high',
        title: 'Low Attendance Rate',
        description: `Current attendance: ${(overallRate * 100).toFixed(0)}%`,
        impact: 1 - overallRate,
        action: 'Conduct attendance improvement initiative',
      });
    }

    return alerts;
  }

  analyzePatterns(attendanceData) {
    const dailyRates = attendanceData.dailyData.map(d => d.rate);
    const weeklyRates = attendanceData.weeklyHistory.map(w => w.avgRate);

    // Identify patterns
    const patterns = [];

    // Day-of-week pattern
    const mondayRate = dailyRates[0];
    const fridayRate = dailyRates.length >= 5 ? dailyRates[4] : dailyRates[dailyRates.length - 1];
    if (fridayRate < mondayRate - 0.05) {
      patterns.push({
        pattern: 'friday_effect',
        description: 'Lower attendance on Fridays',
        impact: mondayRate - fridayRate,
      });
    }

    // Trend pattern
    if (weeklyRates.length === 0) {
      return patterns;
    }

    const firstWeekRate = weeklyRates[0];
    const lastWeekRate = weeklyRates[weeklyRates.length - 1];
    const trend = lastWeekRate - firstWeekRate;
    patterns.push({
      pattern: trend < -0.05 ? 'declining' : trend > 0.05 ? 'improving' : 'stable',
      description: `${trend > 0 ? 'Improving' : 'Declining'} attendance over term`,
      impact: Math.abs(trend),
    });

    return patterns;
  }
}
