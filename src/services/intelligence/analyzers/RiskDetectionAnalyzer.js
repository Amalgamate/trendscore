/**
 * Risk Detection Analyzer
 * Identifies at-risk learners based on multiple factors
 */

import { intelligenceDataService } from '../IntelligenceDataService';

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const toRate = (value) => Math.max(0, Math.min(1, toNumber(value)));

export class RiskDetectionAnalyzer {
  constructor() {
    this._cachedData = null;
    this._cachedContextKey = null;
  }

  /**
   * Analyze risk factors for learners
   * @param {string} contextType - 'school', 'class', 'learner'
   * @param {string|number} contextId - ID of the context
   * @param {Object} options - Analysis options
   */
  async analyze(contextType, contextId, options = {}) {
    try {
      const learnerData = await this.fetchLearnerData(contextType, contextId, options);
      const riskFactors = this.calculateRiskFactors(learnerData);
      const riskScores = this.scoreRisks(riskFactors);
      const alerts = this.generateAlerts(riskScores, riskFactors);
      const distribution = learnerData.distribution || this.analyzeRiskDistribution(riskScores);
      const atRiskCount = learnerData.distribution
        ? distribution.critical + distribution.high + distribution.medium
        : riskScores.filter(r => r.riskScore > 0.5).length;

      return {
        type: 'risk',
        timestamp: Date.now(),
        context: { type: contextType, id: contextId },
        riskFactors,
        riskScores,
        alerts,
        atRiskCount,
        distribution,
        recommendations: this.generateRecommendations(riskScores, riskFactors),
      };
    } catch (error) {
      console.error('Risk Detection error:', error);
      return {
        type: 'risk',
        error: error.message,
        alerts: [],
        riskScores: [],
      };
    }
  }

  /**
   * Fetch learner data for analysis
   */
  async fetchLearnerData(contextType, contextId, options = {}) {
    const contextKey = `${contextType}:${contextId}`;
    if (options.forceRefresh || this._cachedContextKey !== contextKey) {
      this._cachedData = null;
      this._cachedContextKey = contextKey;
    }

    if (this._cachedData) {
      return this._cachedData;
    }

    const summary = await intelligenceDataService.fetchSummary(options.forceRefresh);
    const risk = summary?.risk || {};
    const learners = Array.isArray(risk.atRiskLearners)
      ? risk.atRiskLearners.map((learner, index) => ({
          id: learner?.learnerId || `risk-${index + 1}`,
          name: learner?.name || 'Unknown Learner',
          attendanceRate: toRate(learner?.attendanceRate),
          assessmentRate: 1,
          avgGrade: toNumber(learner?.avgPercentage) / 25,
          outstandingFees: toNumber(learner?.feeBalance),
          behaviorIncidents: 0,
          trendAttendance: 0,
          trendAcademics: 0,
        }))
      : [];

    const distribution = this.normalizeDistribution(risk.distribution);
    const mappedData = {
      learners,
      distribution,
    };

    this._cachedData = mappedData;
    return mappedData;
  }

  /**
   * Calculate individual risk factors
   */
  calculateRiskFactors(learnerData) {
    return learnerData.learners.map(learner => ({
      learnerId: learner.id,
      name: learner.name,
      factors: {
        // Attendance risk: below 85% is concerning
        attendance: {
          value: learner.attendanceRate,
          risk: learner.attendanceRate < 0.85 ? 'high' : 'low',
          trend: learner.trendAttendance < -0.1 ? 'declining' : 'stable',
          score: Math.max(0, (0.85 - learner.attendanceRate) * 2),
        },
        // Academic risk: below 2.0 (C- scale) is concerning
        academics: {
          value: learner.avgGrade,
          risk: learner.avgGrade < 2.0 ? 'high' : 'low',
          trend: learner.trendAcademics < -0.1 ? 'declining' : 'stable',
          score: Math.max(0, (2.5 - learner.avgGrade) / 2.5),
          assessmentCompletion: learner.assessmentRate,
        },
        // Fee risk: outstanding balance is concerning
        fees: {
          value: learner.outstandingFees,
          risk: learner.outstandingFees > 20000 ? 'high' : learner.outstandingFees > 5000 ? 'medium' : 'low',
          score: Math.min(1, learner.outstandingFees / 50000),
        },
        // Behavioral risk
        behavior: {
          value: learner.behaviorIncidents,
          risk: learner.behaviorIncidents > 3 ? 'high' : learner.behaviorIncidents > 1 ? 'medium' : 'low',
          score: Math.min(1, learner.behaviorIncidents / 5),
        },
      },
    }));
  }

  /**
   * Score overall risk for each learner
   */
  scoreRisks(riskFactors) {
    const weights = {
      attendance: 0.3,
      academics: 0.35,
      fees: 0.25,
      behavior: 0.1,
    };

    return riskFactors.map(factor => ({
      learnerId: factor.learnerId,
      name: factor.name,
      riskScore:
        factor.factors.attendance.score * weights.attendance +
        factor.factors.academics.score * weights.academics +
        factor.factors.fees.score * weights.fees +
        factor.factors.behavior.score * weights.behavior,
      factors: factor.factors,
      riskLevel:
        factor.factors.attendance.score > 0.6 ||
        factor.factors.academics.score > 0.6 ||
        (factor.factors.fees.score > 0.5 && factor.factors.behavior.score > 0.3)
          ? 'critical'
          : factor.factors.attendance.score > 0.4 ||
            factor.factors.academics.score > 0.4 ||
            factor.factors.fees.score > 0.3
          ? 'high'
          : 'medium',
    }));
  }

  /**
   * Generate risk alerts
   */
  generateAlerts(riskScores, riskFactors) {
    const alerts = [];

    riskScores.forEach(score => {
      const factors = score.factors;

      // Attendance alerts
      if (factors.attendance.score > 0.4) {
        alerts.push({
          type: 'attendance',
          severity: factors.attendance.score > 0.6 ? 'critical' : 'high',
          learner: score.name,
          learnerId: score.learnerId,
          title: `Low Attendance - ${score.name}`,
          description: `Attendance rate: ${(factors.attendance.value * 100).toFixed(0)}%${
            factors.attendance.trend === 'declining' ? ' and declining' : ''
          }`,
          impact: factors.attendance.score,
          action: 'Schedule attendance review meeting',
        });
      }

      // Academic alerts
      if (factors.academics.score > 0.4) {
        alerts.push({
          type: 'academic',
          severity: factors.academics.score > 0.6 ? 'critical' : 'high',
          learner: score.name,
          learnerId: score.learnerId,
          title: `Academic Performance - ${score.name}`,
          description: `Grade average: ${factors.academics.value.toFixed(2)}${
            factors.academics.trend === 'declining' ? ' and declining' : ''
          }. Assessment completion: ${(factors.academics.assessmentCompletion * 100).toFixed(0)}%`,
          impact: factors.academics.score,
          action: 'Provide academic support or tutoring',
        });
      }

      // Fee alerts
      if (factors.fees.score > 0.3) {
        alerts.push({
          type: 'fee',
          severity: factors.fees.score > 0.6 ? 'critical' : factors.fees.score > 0.4 ? 'high' : 'medium',
          learner: score.name,
          learnerId: score.learnerId,
          title: `Outstanding Fees - ${score.name}`,
          description: `Outstanding balance: KES ${factors.fees.value.toLocaleString()}`,
          impact: factors.fees.score,
          action: 'Contact parent/guardian regarding fee payment',
        });
      }

      // Behavioral alerts
      if (factors.behavior.score > 0.3) {
        alerts.push({
          type: 'behavior',
          severity: factors.behavior.score > 0.6 ? 'high' : 'medium',
          learner: score.name,
          learnerId: score.learnerId,
          title: `Behavioral Concerns - ${score.name}`,
          description: `${factors.behavior.value} incident(s) recorded`,
          impact: factors.behavior.score,
          action: 'Schedule counseling or disciplinary meeting',
        });
      }
    });

    return alerts.sort((a, b) => b.impact - a.impact).slice(0, 15);
  }

  /**
   * Analyze risk distribution
   */
  analyzeRiskDistribution(riskScores) {
    const critical = riskScores.filter(r => r.riskLevel === 'critical').length;
    const high = riskScores.filter(r => r.riskLevel === 'high').length;
    const medium = riskScores.filter(r => r.riskLevel === 'medium').length;
    const total = riskScores.length;

    return {
      critical,
      high,
      medium,
      total,
      criticalPercentage: total > 0 ? ((critical / total) * 100).toFixed(1) : '0.0',
      highPercentage: total > 0 ? ((high / total) * 100).toFixed(1) : '0.0',
    };
  }

  normalizeDistribution(distribution) {
    const critical = toNumber(distribution?.critical);
    const high = toNumber(distribution?.high);
    const medium = toNumber(distribution?.medium);
    const reportedTotal = toNumber(distribution?.total);
    const total = Math.max(reportedTotal, critical + high + medium);

    return {
      critical,
      high,
      medium,
      total,
      criticalPercentage: total > 0 ? ((critical / total) * 100).toFixed(1) : '0.0',
      highPercentage: total > 0 ? ((high / total) * 100).toFixed(1) : '0.0',
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(riskScores, riskFactors) {
    const criticalCount = riskScores.filter(r => r.riskLevel === 'critical').length;
    const recommendations = [];

    if (criticalCount > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Focus on High-Risk Learners',
        description: `${criticalCount} learner(s) require immediate intervention`,
        action: 'Review critical risk cases this week',
      });
    }

    const attendanceIssues = riskFactors.filter(
      r => r.factors.attendance.score > 0.4
    ).length;
    if (attendanceIssues > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Attendance Intervention Program',
        description: `${attendanceIssues} learner(s) with attendance concerns`,
        action: 'Implement attendance support strategies',
      });
    }

    return recommendations;
  }
}
