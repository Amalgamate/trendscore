/**
 * Fee Collection Forecaster
 * Predicts collection patterns and forecasts cash flow
 */

export class FeeCollectionForecaster {
  async forecast(contextType, contextId, options = {}) {
    try {
      const feeData = await this.fetchFeeData(contextType, contextId);
      const trends = this.analyzeTrends(feeData);
      const forecast = this.generateForecast(trends);
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

  async fetchFeeData(contextType, contextId) {
    // Mock data - replace with actual API calls
    return {
      totalExpected: 5000000, // 5M KES
      totalCollected: 3200000, // 3.2M KES
      outstanding: 1800000, // 1.8M KES
      collectionRate: 0.64, // 64%
      daysInTerm: 45,
      monthlyHistory: [
        { month: 'Month 1', collected: 1200000, expected: 1667000, rate: 0.72 },
        { month: 'Month 2', collected: 1100000, expected: 1667000, rate: 0.66 },
        { month: 'Month 3', collected: 900000, expected: 1667000, rate: 0.54 },
      ],
    };
  }

  analyzeTrends(feeData) {
    const { monthlyHistory, collectionRate } = feeData;
    
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

  generateForecast(trends) {
    const { currentRate, trend, averageRate } = trends;
    const forecastedRate = Math.max(0.3, Math.min(1, currentRate + trend * 0.5));

    return {
      nextMonthRate: forecastedRate,
      nextMonthRevenue: Math.round(forecastedRate * 1667000),
      confidence: trends.volatility < 0.15 ? 'high' : trends.volatility < 0.25 ? 'medium' : 'low',
      expectedTotalByEndOfTerm: Math.round(averageRate * 5000000),
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
        expectedShortfall: Math.round(5000000 - forecast.expectedTotalByEndOfTerm),
      },
    };
  }

  calculateVolatility(monthlyHistory) {
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
    
    if (trends.trend < -0.05) factors.push('declining_collection_rate');
    if (trends.volatility > 0.2) factors.push('high_collection_volatility');
    if (trends.currentRate < 0.55) factors.push('below_target_collection');
    
    return factors;
  }
}
