/**
 * Academic Trend Analyzer
 * Analyzes academic performance trends and subject-specific patterns
 */

export class AcademicTrendAnalyzer {
  async analyzeTrends(contextType, contextId, options = {}) {
    try {
      const academicData = await this.fetchAcademicData(contextType, contextId);
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

  async fetchAcademicData(contextType, contextId) {
    // Mock data - replace with actual API calls
    const assessmentHistory = [
      { week: 'Week 1', avg: 3.2, completed: 0.88 },
      { week: 'Week 2', avg: 3.15, completed: 0.87 },
      { week: 'Week 3', avg: 3.1, completed: 0.85 },
      { week: 'Week 4', avg: 3.05, completed: 0.83 },
      { week: 'Week 5', avg: 2.95, completed: 0.80 },
      { week: 'Week 6', avg: 2.9, completed: 0.78 },
      { week: 'Week 7', avg: 2.85, completed: 0.76 },
      { week: 'Week 8', avg: 2.88, completed: 0.77 },
      { week: 'Week 9', avg: 2.92, completed: 0.79 },
    ];

    return {
      averageGrade: 2.92,
      assessmentCompletion: 0.79,
      learnersBelowAverage: 145,
      totalLearners: 450,
      subjectPerformance: [
        { subject: 'English', avgGrade: 3.2, completion: 0.88, trend: 0.05 },
        { subject: 'Mathematics', avgGrade: 2.8, completion: 0.75, trend: -0.08 },
        { subject: 'Science', avgGrade: 3.0, completion: 0.82, trend: -0.02 },
        { subject: 'History', avgGrade: 3.4, completion: 0.90, trend: 0.03 },
        { subject: 'Geography', avgGrade: 2.9, completion: 0.80, trend: -0.05 },
      ],
      assessmentHistory,
      gradeDistribution: {
        A: 85,
        B: 135,
        C: 150,
        D: 60,
        E: 20,
      },
    };
  }

  calculateTrends(academicData) {
    const { assessmentHistory } = academicData;
    
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
    const projection = trends.gradeDirection === 'declining' 
      ? currentGrade - Math.random() * 0.3
      : trends.gradeDirection === 'improving'
      ? currentGrade + Math.random() * 0.2
      : currentGrade;

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
