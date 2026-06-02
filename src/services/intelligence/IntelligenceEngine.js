/**
 * TrendSCORE Intelligence Engine
 * Core orchestration for all AI-driven insights
 * Analyzes learner data, fees, attendance, and academics to surface actionable insights
 */

import { RiskDetectionAnalyzer } from './analyzers/RiskDetectionAnalyzer';
import { FeeCollectionForecaster } from './analyzers/FeeCollectionForecaster';
import { AttendanceAnomalyDetector } from './analyzers/AttendanceAnomalyDetector';
import { AcademicTrendAnalyzer } from './analyzers/AcademicTrendAnalyzer';
import { NaturalLanguageInsightGenerator } from './analyzers/NaturalLanguageInsightGenerator';

/**
 * Intelligence Engine Configuration
 */
const ENGINE_CONFIG = {
  cacheTimeout: 1800000, // 30 minutes
  maxInsightsPerType: 10,
  anomalyThreshold: 0.2, // 20% deviation
  riskScoringWeights: {
    attendance: 0.3,
    academics: 0.35,
    fees: 0.25,
    behavior: 0.1,
  },
};

class IntelligenceEngine {
  constructor(config = ENGINE_CONFIG) {
    this.config = { ...ENGINE_CONFIG, ...config };
    this.cache = new Map();
    this.analyzers = {
      risk: new RiskDetectionAnalyzer(),
      fees: new FeeCollectionForecaster(),
      attendance: new AttendanceAnomalyDetector(),
      academics: new AcademicTrendAnalyzer(),
      nlg: new NaturalLanguageInsightGenerator(),
    };
    this.lastUpdate = new Map();
  }

  /**
   * Get all insights for a specific context (school, class, learner, etc.)
   * @param {string} contextType - 'school', 'class', 'learner', 'teacher'
   * @param {string|number} contextId - ID of the context
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Combined insights object
   */
  async getInsights(contextType, contextId, options = {}) {
    const cacheKey = `${contextType}:${contextId}`;
    
    // Check cache validity
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      const age = Date.now() - cached.timestamp;
      if (age < this.config.cacheTimeout && !options.forceRefresh) {
        return cached.data;
      }
    }

    try {
      const insights = await Promise.all([
        this.analyzers.risk.analyze(contextType, contextId, options),
        this.analyzers.fees.forecast(contextType, contextId, options),
        this.analyzers.attendance.detectAnomalies(contextType, contextId, options),
        this.analyzers.academics.analyzeTrends(contextType, contextId, options),
      ]);

      const combinedInsights = {
        timestamp: Date.now(),
        context: { type: contextType, id: contextId },
        risk: insights[0],
        feeCollection: insights[1],
        attendance: insights[2],
        academics: insights[3],
        summary: null,
        alerts: this.prioritizeAlerts([
          ...insights[0].alerts || [],
          ...insights[1].alerts || [],
          ...insights[2].alerts || [],
          ...insights[3].alerts || [],
        ]),
      };

      // Generate natural language summary
      combinedInsights.summary = await this.analyzers.nlg.generateSummary(combinedInsights);

      // Cache the results
      this.cache.set(cacheKey, {
        data: combinedInsights,
        timestamp: Date.now(),
      });

      this.lastUpdate.set(cacheKey, Date.now());
      return combinedInsights;
    } catch (error) {
      console.error('Intelligence Engine error:', error);
      return {
        timestamp: Date.now(),
        context: { type: contextType, id: contextId },
        error: error.message,
        fallback: true,
      };
    }
  }

  /**
   * Get only risk-related insights (optimized for dashboards)
   */
  async getRiskInsights(contextType, contextId, options = {}) {
    const insights = await this.getInsights(contextType, contextId, options);
    return {
      timestamp: insights.timestamp,
      risk: insights.risk,
      alerts: insights.alerts.filter(a => a.severity !== 'info').slice(0, 5),
      summary: insights.summary,
    };
  }

  /**
   * Get only financial insights (optimized for accountant dashboard)
   */
  async getFinancialInsights(contextType, contextId, options = {}) {
    const insights = await this.getInsights(contextType, contextId, options);
    return {
      timestamp: insights.timestamp,
      feeCollection: insights.feeCollection,
      alerts: insights.alerts.filter(a => a.type === 'fee').slice(0, 5),
      summary: insights.summary,
    };
  }

  /**
   * Get only academic insights (optimized for teacher/headteacher dashboard)
   */
  async getAcademicInsights(contextType, contextId, options = {}) {
    const insights = await this.getInsights(contextType, contextId, options);
    return {
      timestamp: insights.timestamp,
      academics: insights.academics,
      attendance: insights.attendance,
      alerts: insights.alerts.filter(a => a.type === 'academic' || a.type === 'attendance').slice(0, 5),
      summary: insights.summary,
    };
  }

  /**
   * Get learner-specific insights (for parents)
   */
  async getLearnerInsights(learnerId, options = {}) {
    const insights = await this.getInsights('learner', learnerId, options);
    return {
      timestamp: insights.timestamp,
      risk: insights.risk,
      academics: insights.academics,
      attendance: insights.attendance,
      feeCollection: insights.feeCollection,
      summary: insights.summary,
    };
  }

  /**
   * Prioritize alerts by severity and impact
   */
  prioritizeAlerts(alerts) {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return alerts
      .filter(a => a && a.severity)
      .sort((a, b) => {
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return (b.impact || 0) - (a.impact || 0);
      })
      .slice(0, this.config.maxInsightsPerType);
  }

  /**
   * Clear cache for a specific context
   */
  clearCache(contextType, contextId) {
    const cacheKey = `${contextType}:${contextId}`;
    this.cache.delete(cacheKey);
    this.lastUpdate.delete(cacheKey);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear();
    this.lastUpdate.clear();
  }

  /**
   * Get engine health and statistics
   */
  getStatus() {
    return {
      status: 'operational',
      cacheSize: this.cache.size,
      cacheTimeout: this.config.cacheTimeout,
      analyzersAvailable: Object.keys(this.analyzers),
      lastUpdate: Object.fromEntries(this.lastUpdate),
    };
  }
}

// Singleton instance
let engineInstance = null;

/**
 * Get or create Intelligence Engine instance
 */
export function getIntelligenceEngine(config) {
  if (!engineInstance) {
    engineInstance = new IntelligenceEngine(config);
  }
  return engineInstance;
}

export { IntelligenceEngine, ENGINE_CONFIG };
