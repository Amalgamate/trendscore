/**
 * Attendance Anomaly Detector
 * Detects unusual attendance patterns and behavioral changes
 */

export class AttendanceAnomalyDetector {
  async detectAnomalies(contextType, contextId, options = {}) {
    try {
      const attendanceData = await this.fetchAttendanceData(contextType, contextId);
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
          attendanceRate: attendanceData.presentToday / attendanceData.totalExpected,
          daysPresent: attendanceData.daysPresent,
          daysAbsent: attendanceData.daysAbsent,
        },
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

  async fetchAttendanceData(contextType, contextId) {
    // Mock data - replace with actual API calls
    const dailyData = [
      { date: 'Monday', present: 420, absent: 30, rate: 0.933 },
      { date: 'Tuesday', present: 418, absent: 32, rate: 0.929 },
      { date: 'Wednesday', present: 350, absent: 100, rate: 0.778 }, // Anomaly
      { date: 'Thursday', present: 425, absent: 25, rate: 0.944 },
      { date: 'Friday', present: 410, absent: 40, rate: 0.911 },
    ];

    return {
      presentToday: 420,
      totalExpected: 450,
      daysPresent: 2065,
      daysAbsent: 160,
      dailyData,
      weeklyHistory: [
        { week: 'Week 1', avgRate: 0.92 },
        { week: 'Week 2', avgRate: 0.91 },
        { week: 'Week 3', avgRate: 0.88 },
        { week: 'Week 4', avgRate: 0.85 },
        { week: 'Week 5', avgRate: 0.83 },
        { week: 'Week 6', avgRate: 0.79 },
        { week: 'Week 7', avgRate: 0.81 },
        { week: 'Week 8', avgRate: 0.80 },
        { week: 'Week 9', avgRate: 0.82 },
      ],
    };
  }

  calculateBaseline(attendanceData) {
    const rates = attendanceData.weeklyHistory.map(w => w.avgRate);
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
    const overallRate = attendanceData.presentToday / attendanceData.totalExpected;
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
    const fridayRate = dailyRates[4] || dailyRates[dailyRates.length - 1];
    if (fridayRate < mondayRate - 0.05) {
      patterns.push({
        pattern: 'friday_effect',
        description: 'Lower attendance on Fridays',
        impact: mondayRate - fridayRate,
      });
    }

    // Trend pattern
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
