/**
 * Natural Language Insight Generator
 * Converts data analysis into human-readable insights and recommendations
 */

export class NaturalLanguageInsightGenerator {
  /**
   * Generate natural language summary from combined insights
   */
  async generateSummary(insights) {
    const summaryParts = [];

    // Risk summary
    if (insights.risk && !insights.risk.error) {
      summaryParts.push(this.generateRiskSummary(insights.risk));
    }

    // Fee collection summary
    if (insights.feeCollection && !insights.feeCollection.error) {
      summaryParts.push(this.generateFeeSummary(insights.feeCollection));
    }

    // Attendance summary
    if (insights.attendance && !insights.attendance.error) {
      summaryParts.push(this.generateAttendanceSummary(insights.attendance));
    }

    // Academic summary
    if (insights.academics && !insights.academics.error) {
      summaryParts.push(this.generateAcademicSummary(insights.academics));
    }

    // Combine into executive summary
    return {
      executive: this.generateExecutiveSummary(insights),
      detailed: summaryParts.filter(p => p).join(' '),
      keyMetrics: this.extractKeyMetrics(insights),
      recommendations: this.generateActionableRecommendations(insights),
    };
  }

  generateExecutiveSummary(insights) {
    const components = [];

    // Risk assessment
    if (insights.risk?.riskScores) {
      const criticalCount = insights.risk.riskScores.filter(r => r.riskLevel === 'critical').length;
      if (criticalCount > 0) {
        components.push(`${criticalCount} learner(s) require immediate intervention`);
      }
    }

    // Fee status
    if (insights.feeCollection?.currentMetrics) {
      const rate = (insights.feeCollection.currentMetrics.collectionRate * 100).toFixed(0);
      if (rate < 65) {
        components.push(`Fee collection is below target at ${rate}%`);
      }
    }

    // Attendance status
    if (insights.attendance?.currentMetrics) {
      const rate = (insights.attendance.currentMetrics.attendanceRate * 100).toFixed(0);
      if (rate < 85) {
        components.push(`Attendance rate of ${rate}% requires attention`);
      }
    }

    // Academic status
    if (insights.academics?.currentMetrics) {
      const avgGrade = insights.academics.currentMetrics.averageGrade?.toFixed(2) || 'N/A';
      components.push(`Academic average is ${avgGrade} across all learners`);
    }

    if (components.length === 0) {
      return 'Overall, systems are performing within acceptable parameters.';
    }

    return components.join('. ') + '.';
  }

  generateRiskSummary(riskInsights) {
    const { distribution, riskScores } = riskInsights;
    
    if (!distribution || !riskScores || riskScores.length === 0) {
      return 'Risk analysis is pending completion.';
    }

    const sentences = [];

    // Overall risk picture
    sentences.push(
      `Risk assessment identified ${riskScores.length} learners across the institution. ` +
      `${distribution.critical || 0} are at critical risk, ${distribution.high || 0} at high risk. `
    );

    // Top risk factors
    const riskFactorCount = riskScores.filter(r => r.factors.attendance.score > 0.4).length;
    if (riskFactorCount > 0) {
      sentences.push(`Attendance is the primary risk factor affecting ${riskFactorCount} learners. `);
    }

    const academicRiskCount = riskScores.filter(r => r.factors.academics.score > 0.4).length;
    if (academicRiskCount > 0) {
      sentences.push(`Academic performance concerns involve ${academicRiskCount} learners. `);
    }

    return sentences.join('');
  }

  generateFeeSummary(feeInsights) {
    const { currentMetrics, trends, forecast } = feeInsights;
    
    if (!currentMetrics) return '';

    const sentences = [];
    const collected = currentMetrics.totalCollected;
    const expected = currentMetrics.totalExpected;
    const outstanding = currentMetrics.outstanding;
    const rate = (currentMetrics.collectionRate * 100).toFixed(0);

    // Current status
    sentences.push(
      `Fee collection stands at ${rate}% with KES ${(outstanding / 1000000).toFixed(1)}M outstanding. `
    );

    // Trend analysis
    if (trends?.trend === 'declining') {
      sentences.push(`Collection rate is declining, requiring intervention. `);
    } else if (trends?.trend === 'improving') {
      sentences.push(`Positive momentum in fee collection is noted. `);
    }

    // Forecast
    if (forecast?.confidence === 'high') {
      sentences.push(
        `Forecasts indicate ${(forecast.nextMonthRate * 100).toFixed(0)}% collection expected next month. `
      );
    }

    return sentences.join('');
  }

  generateAttendanceSummary(attendanceInsights) {
    const { currentMetrics, patterns, anomalies } = attendanceInsights;
    
    if (!currentMetrics) return '';

    const sentences = [];
    const rate = (currentMetrics.attendanceRate * 100).toFixed(0);

    // Current status
    sentences.push(`Current attendance is ${rate}% with ${currentMetrics.daysAbsent} absence days recorded. `);

    // Anomalies
    if (anomalies && anomalies.length > 0) {
      const types = new Set(anomalies.map(a => a.type));
      if (types.has('sudden_drop')) {
        sentences.push('Unusual absence patterns have been detected on specific days. ');
      }
      if (types.has('declining_trend')) {
        sentences.push('Attendance is trending downward throughout the term. ');
      }
    }

    // Patterns
    if (patterns && patterns.length > 0) {
      patterns.forEach(p => {
        if (p.pattern === 'friday_effect') {
          sentences.push('Friday shows lower attendance compared to other days. ');
        }
      });
    }

    return sentences.join('');
  }

  generateAcademicSummary(academicInsights) {
    const { currentMetrics, trends, subjectAnalysis } = academicInsights;
    
    if (!currentMetrics) return '';

    const sentences = [];
    const avgGrade = currentMetrics.averageGrade?.toFixed(2) || 'N/A';
    const completion = (currentMetrics.assessmentCompletion * 100).toFixed(0);

    // Overall performance
    sentences.push(
      `Academic average stands at ${avgGrade} with ${completion}% assessment completion. `
    );

    // Trend
    if (trends?.gradeDirection === 'declining') {
      sentences.push(`Grade averages are declining, suggesting growing learner challenges. `);
    } else if (trends?.gradeDirection === 'improving') {
      sentences.push(`Academic performance is showing improvement throughout the term. `);
    }

    // Subject insights
    if (subjectAnalysis?.topSubject && subjectAnalysis?.bottomSubject) {
      sentences.push(
        `${subjectAnalysis.topSubject.subject} leads performance while ` +
        `${subjectAnalysis.bottomSubject.subject} requires focus. `
      );
    }

    return sentences.join('');
  }

  extractKeyMetrics(insights) {
    const metrics = {};

    // Risk
    if (insights.risk?.riskScores) {
      metrics.atRiskLearners = insights.risk.riskScores.filter(r => r.riskLevel === 'critical').length;
    }

    // Fees
    if (insights.feeCollection?.currentMetrics) {
      metrics.collectionRate = `${(insights.feeCollection.currentMetrics.collectionRate * 100).toFixed(0)}%`;
      metrics.outstanding = `KES ${(insights.feeCollection.currentMetrics.outstanding / 1000).toFixed(0)}k`;
    }

    // Attendance
    if (insights.attendance?.currentMetrics) {
      metrics.attendanceRate = `${(insights.attendance.currentMetrics.attendanceRate * 100).toFixed(0)}%`;
    }

    // Academics
    if (insights.academics?.currentMetrics) {
      metrics.avgGrade = insights.academics.currentMetrics.averageGrade?.toFixed(2);
      metrics.assessmentCompletion = `${(insights.academics.currentMetrics.assessmentCompletion * 100).toFixed(0)}%`;
    }

    return metrics;
  }

  generateActionableRecommendations(insights) {
    const recommendations = [];

    // Based on risk
    if (insights.risk?.recommendations) {
      recommendations.push(...insights.risk.recommendations.map(r => ({
        category: 'risk',
        priority: r.priority,
        title: r.title,
        action: r.action,
      })));
    }

    // Based on fees
    if (insights.feeCollection?.alerts) {
      const criticalFeeAlerts = insights.feeCollection.alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
      if (criticalFeeAlerts.length > 0) {
        recommendations.push({
          category: 'finance',
          priority: 'high',
          title: 'Fee Collection Campaign',
          action: criticalFeeAlerts[0]?.action || 'Implement fee collection strategy',
        });
      }
    }

    // Based on attendance
    if (insights.attendance?.alerts) {
      const attendanceAlerts = insights.attendance.alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
      if (attendanceAlerts.length > 0) {
        recommendations.push({
          category: 'attendance',
          priority: 'high',
          title: 'Attendance Improvement',
          action: attendanceAlerts[0]?.action || 'Launch attendance improvement initiative',
        });
      }
    }

    // Based on academics
    if (insights.academics?.alerts) {
      const academicAlerts = insights.academics.alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
      if (academicAlerts.length > 0) {
        recommendations.push({
          category: 'academics',
          priority: 'high',
          title: 'Academic Support Program',
          action: academicAlerts[0]?.action || 'Provide academic support',
        });
      }
    }

    return recommendations.slice(0, 5);
  }
}
