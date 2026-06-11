/**
 * Fee Collection Forecaster
 * Predicts collection patterns and forecasts cash flow
 */

import { intelligenceDataService } from '../IntelligenceDataService';

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const toRate = (value) => Math.max(0, Math.min(1, toNumber(value)));

export class FeeCollectionForecaster {
  constructor() {
    this._cachedData = null;
    this._cachedContextKey = null;
  }

  async forecast(contextType, contextId, options = {}) {
    try {
      const feeData = await this.fetchFeeData(contextType, contextId, options);
      const trends = this.analyzeTrends(feeData);
      const forecast = this.generateForecast(trends, feeData);
      const alerts = this.generateAlerts(forecast, feeData);

      return {
        type: 'feeCollection',
        timestamp: Date.now(),
        context: { type: contextType, id: contextId },
        currentMetrics: {
          totalExpected: feeData.totalExpected,
          totalCollected: feeData.totalCollected,
          outstanding: feeData.outstanding,
          collectionRate: feeData.collectionRate,
          daysInTerm: feeData.daysInTerm,
        },
        history: feeData.monthlyHistory,
        trends,
        forecast,
        alerts,
        predictions: this.generatePredictions(forecast),
      };
    } catch (error) {
      console.error('Fee Collection Forecast error:', error);
      return { type: 'feeCollection', error: error.message, alerts: [] };
    }
  }

  async fetchFeeData(contextType, contextId, options = {}) {
    const contextKey = `${contextType}:${contextId}`;
    if (options.forceRefresh || this._cachedContextKey !== contextKey) {
      this._cachedData = null;
      this._cachedContextKey = contextKey;
    }

    if (this._cachedData) {
      return this._cachedData;
    }

    const summary = await intelligenceDataService.fetchSummary(options.forceRefresh);
    const fees = summary?.fees || {};
    const monthlyHistory = Array.isArray(fees.monthlyHistory)
      ? fees.monthlyHistory.map((entry, index) => ({
          month: entry?.month || `Month ${index + 1}`,
          collected: toNumber(entry?.collected),
          expected: toNumber(entry?.billed),
          rate: toRate(entry?.rate),
        }))
      : [];

    const mappedData = {
      totalExpected: toNumber(fees.totalBilled),
      totalCollected: toNumber(fees.totalCollected),
      outstanding: toNumber(fees.totalOutstanding),
      collectionRate: toRate(fees.collectionRate),
      daysInTerm: Math.max(1, monthlyHistory.length * 30),
      monthlyHistory,
    };

    this._cachedData = mappedData;
    return mappedData;
  }

  analyzeTrends(feeData) {
    const { monthlyHistory, collectionRate } = feeData;

    if (!monthlyHistory || monthlyHistory.length === 0) {
      return {
        averageRate: collectionRate || 0,
        currentRate: collectionRate || 0,
        trend: 'stable',
        trendMagnitude: 0,
        volatility: 0,
        seasonalPattern: 'insufficient_data',
      };
    }
    
    // Calculate trend slope
    let totalRate = 0;
    monthlyHistory.forEach(m => (totalRate += m.rate));
    const avgRate = totalRate / monthlyHistory.length;
    
    const trend = monthlyHistory[monthlyHistory.length - 1].rate - monthlyHistory[0].rate;

    return {
      averageRate: avgRate,
      currentRate: monthlyHistory[monthlyHistory.length - 1].rate,
      trend: trend < -0.05 ? 'declining' : trend > 0.05 ? 'improving' : 'stable',
      trendMagnitude: Math.abs(trend),
      volatility: this.calculateVolatility(monthlyHistory),
      seasonalPattern: this.detectSeasonality(monthlyHistory),
    };
  }

  generateForecast(trends, feeData) {
    const { currentRate, trend, trendMagnitude, averageRate } = trends;
    const monthlyExpected = Math.round(feeData.totalExpected / Math.max(1, feeData.monthlyHistory.length));
    const trendDelta =
      trend === 'declining' ? -trendMagnitude : trend === 'improving' ? trendMagnitude : 0;
    const forecastedRate = Math.max(0.3, Math.min(1, currentRate + trendDelta * 0.5));

    return {
      totalExpected: feeData.totalExpected,
      nextMonthRate: forecastedRate,
      nextMonthRevenue: Math.round(forecastedRate * monthlyExpected),
      confidence: trends.volatility < 0.15 ? 'high' : trends.volatility < 0.25 ? 'medium' : 'low',
      expectedTotalByEndOfTerm: Math.round(averageRate * feeData.totalExpected),
      riskFactors: this.identifyRiskFactors(trends),
    };
  }

  generateAlerts(forecast, feeData) {
    const alerts = [];

    if (feeData.collectionRate < 0.6) {
      alerts.push({
        type: 'fee',
        severity: feeData.collectionRate < 0.5 ? 'critical' : 'high',
        title: 'Low Fee Collection Rate',
        description: `Current collection rate: ${(feeData.collectionRate * 100).toFixed(0)}%`,
        impact: 1 - feeData.collectionRate,
        action: 'Increase fee collection efforts',
      });
    }

    if (forecast.riskFactors.length > 0) {
      alerts.push({
        type: 'fee',
        severity: 'medium',
        title: 'Fee Collection Risk Factors Identified',
        description: forecast.riskFactors.join(', '),
        impact: 0.6,
        action: 'Monitor collection patterns closely',
      });
    }

    if (feeData.outstanding > 1500000) {
      alerts.push({
        type: 'fee',
        severity: 'high',
        title: 'High Outstanding Balance',
        description: `Outstanding: KES ${(feeData.outstanding / 1000000).toFixed(1)}M`,
        impact: 0.8,
        action: 'Implement collection strategy',
      });
    }

    return alerts;
  }

  generatePredictions(forecast) {
    return {
      nextMonthPrediction: {
        expectedCollection: forecast.nextMonthRevenue,
        confidence: forecast.confidence,
        bestCase: Math.round(forecast.nextMonthRevenue * 1.15),
        worstCase: Math.round(forecast.nextMonthRevenue * 0.8),
      },
      termEndPrediction: {
        expectedTotal: forecast.expectedTotalByEndOfTerm,
        expectedShortfall: Math.round(forecast.totalExpected - forecast.expectedTotalByEndOfTerm),
      },
    };
  }

  calculateVolatility(monthlyHistory) {
    if (!monthlyHistory || monthlyHistory.length === 0) return 0;
    const rates = monthlyHistory.map(m => m.rate);
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance =
      rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
    return Math.sqrt(variance);
  }

  detectSeasonality(monthlyHistory) {
    // Simple pattern detection
    if (monthlyHistory.length < 3) return 'insufficient_data';
    
    const trend = monthlyHistory[monthlyHistory.length - 1].rate - monthlyHistory[0].rate;
    return trend > 0.1 ? 'seasonal_increase' : trend < -0.1 ? 'seasonal_decline' : 'stable';
  }

  identifyRiskFactors(trends) {
    const factors = [];
    
    if (trends.trend === 'declining' && trends.trendMagnitude > 0.05) factors.push('declining_collection_rate');
    if (trends.volatility > 0.2) factors.push('high_collection_volatility');
    if (trends.currentRate < 0.55) factors.push('below_target_collection');
    
    return factors;
  }
}
