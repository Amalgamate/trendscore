/**
 * Academic Trend Analyzer
 * Analyzes academic performance trends and subject-specific patterns
 */

import { intelligenceDataService } from '../IntelligenceDataService';

export class AcademicTrendAnalyzer {
  constructor() {
    this._cachedData = null;
    this._cachedContextKey = null;
  }

  async analyzeTrends(contextType, contextId, options = {}) {
    try {
      const academicData = await this.fetchAcademicData(contextType, contextId, options);
      const trends = this.calculateTrends(academicData);
      const subjectAnalysis = this.analyzeSubjects(academicData);
      const alerts = this.generateAlerts(trends, subjectAnalysis, academicData);

      return {
        type: 'academics',
        timestamp: Date.now(),
        context: { type: contextType, id: contextId },
        currentMetrics: {
          averageGrade: academicData.averageGrade,
          assessmentCompletion: academicData.assessmentCompletion,
          topSubject: subjectAnalysis.topSubject,
          bottomSubject: subjectAnalysis.bottomSubject,
          learnersBelowAverage: academicData.learnersBelowAverage,
        },
        trends,
        subjectAnalysis,
        alerts,
        predictions: this.generatePredictions(trends),
      };
    } catch (error) {
      console.error('Academic Trend Analysis error:', error);
      return { type: 'academics', error: error.message, alerts: [], trends: {} };
    }
  }

  async fetchAcademicData(contextType, contextId, options = {}) {
    const contextKey = `${contextType}:${contextId}`;
    if (options.forceRefresh || this._cachedContextKey !== contextKey) {
      this._cachedData = null;
      this._cachedContextKey = contextKey;
    }

    if (this._cachedData) {
      return this._cachedData;
    }

    const summary = await intelligenceDataService.fetchSummary(options.forceRefresh);
    const academics = summary?.academics;

    if (!academics) {
      throw new Error('Academic intelligence data is unavailable');
    }

    const mappedData = {
      averageGrade: Number(academics.averagePercentage || 0) / 25,
      assessmentCompletion: Number(academics.assessmentCompletionRate || 0),
      learnersBelowAverage: Number(academics.learnersBelowExpectations || 0),
      totalLearners: Number(academics.totalLearners || 0),
      assessmentHistory: Array.isArray(academics.termHistory)
        ? academics.termHistory.map((entry) => ({
            week: entry.period,
            avg: Number(entry.avgPct || 0) / 25,
            completed: Number(academics.assessmentCompletionRate || 0),
          }))
        : [],
      subjectPerformance: Array.isArray(academics.subjectBreakdown)
        ? academics.subjectBreakdown.map((subject) => ({
            subject: subject.subject,
            avgGrade: Number(subject.avgPct || 0) / 25,
            completion: 1 - (Number(subject.bePct || 0) / 100),
            trend: 0,
          }))
        : [],
      gradeDistribution: {
        A: Number(academics.ratingDistribution?.EE || 0),
        B: Number(academics.ratingDistribution?.ME || 0),
        C: Number(academics.ratingDistribution?.AE || 0),
        D: Number(academics.ratingDistribution?.BE || 0),
        E: 0,
      },
    };

    this._cachedData = mappedData;
    return mappedData;
  }

  calculateTrends(academicData) {
    const { assessmentHistory } = academicData;

    if (!assessmentHistory || assessmentHistory.length === 0) {
      return {
        gradeChange: 0,
        gradeDirection: 'stable',
        completionChange: 0,
        completionDirection: 'stable',
        volatility: 0,
        weakestWeek: null,
        strongestWeek: null,
      };
    }
    
    // Calculate grade trend
    const firstAvg = assessmentHistory[0].avg;
    const lastAvg = assessmentHistory[assessmentHistory.length - 1].avg;
    const gradeTrend = lastAvg - firstAvg;
    
    // Calculate completion trend
    const firstCompletion = assessmentHistory[0].completed;
    const lastCompletion = assessmentHistory[assessmentHistory.length - 1].completed;
    const completionTrend = lastCompletion - firstCompletion;

    return {
      gradeChange: gradeTrend,
      gradeDirection: gradeTrend > 0.1 ? 'improving' : gradeTrend < -0.1 ? 'declining' : 'stable',
      completionChange: completionTrend,
      completionDirection: completionTrend > 0.02 ? 'improving' : completionTrend < -0.02 ? 'declining' : 'stable',
      volatility: this.calculateVolatility(assessmentHistory.map(a => a.avg)),
      weakestWeek: assessmentHistory.reduce((prev, curr) => 
        curr.avg < prev.avg ? curr : prev
      ),
      strongestWeek: assessmentHistory.reduce((prev, curr) => 
        curr.avg > prev.avg ? curr : prev
      ),
    };
  }

  analyzeSubjects(academicData) {
    const { subjectPerformance } = academicData;
    if (!subjectPerformance || subjectPerformance.length === 0) {
      return {
        topSubject: null,
        bottomSubject: null,
        byPerformance: [],
        atRisk: [],
        strong: [],
        completionIssues: [],
      };
    }
    
    const sorted = [...subjectPerformance].sort((a, b) => b.avgGrade - a.avgGrade);
    
    return {
      topSubject: sorted[0],
      bottomSubject: sorted[sorted.length - 1],
      byPerformance: sorted,
      atRisk: sorted.filter(s => s.avgGrade < 2.5),
      strong: sorted.filter(s => s.avgGrade > 3.3),
      completionIssues: sorted.filter(s => s.completion < 0.75),
    };
  }

  generateAlerts(trends, subjectAnalysis, academicData) {
    const alerts = [];

    // Grade decline alert
    if (trends.gradeChange < -0.15) {
      alerts.push({
        type: 'academic',
        severity: 'high',
        title: 'Academic Performance Declining',
        description: `Average grade dropped ${Math.abs(trends.gradeChange).toFixed(2)} points`,
        impact: 0.8,
        action: 'Investigate cause and provide support',
      });
    }

    // Completion alert
    if (trends.completionChange < -0.05 || academicData.assessmentCompletion < 0.75) {
      alerts.push({
        type: 'academic',
        severity: trends.completionChange < -0.1 ? 'high' : 'medium',
        title: 'Low Assessment Completion',
        description: `${(academicData.assessmentCompletion * 100).toFixed(0)}% of assessments completed`,
        impact: 1 - academicData.assessmentCompletion,
        action: 'Follow up with learners on incomplete assessments',
      });
    }

    // Subject alerts
    subjectAnalysis.atRisk.forEach(subject => {
      alerts.push({
        type: 'academic',
        severity: subject.avgGrade < 2.0 ? 'critical' : 'high',
        title: `Performance Issues - ${subject.subject}`,
        description: `${subject.subject} average: ${subject.avgGrade.toFixed(2)}${
          subject.trend < -0.05 ? ' and declining' : ''
        }`,
        impact: (3.0 - subject.avgGrade) / 3.0,
        action: `Provide targeted ${subject.subject} support`,
      });
    });

    // Completion issues alert
    if (subjectAnalysis.completionIssues.length > 0) {
      alerts.push({
        type: 'academic',
        severity: 'medium',
        title: 'Assessment Completion Issues',
        description: `${subjectAnalysis.completionIssues.map(s => s.subject).join(', ')} have low completion`,
        impact: 0.6,
        action: 'Investigate barriers to assessment completion',
      });
    }

    return alerts.slice(0, 10);
  }

  generatePredictions(trends) {
    const currentGrade = trends.strongestWeek?.avg || 3.0;
    const projection = currentGrade;

    return {
      projectedGradeByEndOfTerm: Math.max(0, Math.min(4, projection)),
      projectedTrend: trends.gradeDirection,
      confidence: 1 - trends.volatility / 2,
      riskOfFailing: Math.max(0, Math.min(1, (2.0 - projection) / 2.0)),
    };
  }

  calculateVolatility(grades) {
    if (grades.length < 2) return 0;
    const mean = grades.reduce((a, b) => a + b, 0) / grades.length;
    const variance = grades.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / grades.length;
    return Math.sqrt(variance);
  }
}
