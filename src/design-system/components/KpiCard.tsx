import React from 'react';
import { TOKENS } from '../tokens';

/**
 * KpiCard - Key Performance Indicator card for dashboard metrics
 * 
 * @component
 * @example
 * <KpiCard
 *   label="Total Students"
 *   value={1234}
 *   icon={<Users />}
 *   trend={{ value: 5.2, isPositive: true }}
 *   variant="primary"
 * />
 */
interface KpiCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  onClick?: () => void;
  className?: string;
  layout?: 'horizontal' | 'vertical';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subvalue,
  icon,
  trend,
  variant = 'primary',
  onClick,
  className = '',
  layout = 'vertical',
}) => {
  const variantColors = {
    primary: {
      bgColor: TOKENS.colors.brand.primary,
      textColor: TOKENS.colors.text.inverse,
      trendPositive: TOKENS.colors.status.success,
      trendNegative: TOKENS.colors.status.error,
    },
    success: {
      bgColor: TOKENS.colors.status.success,
      textColor: TOKENS.colors.text.inverse,
      trendPositive: TOKENS.colors.status.success,
      trendNegative: TOKENS.colors.status.error,
    },
    warning: {
      bgColor: TOKENS.colors.status.warning,
      textColor: TOKENS.colors.text.inverse,
      trendPositive: TOKENS.colors.status.success,
      trendNegative: TOKENS.colors.status.error,
    },
    error: {
      bgColor: TOKENS.colors.status.error,
      textColor: TOKENS.colors.text.inverse,
      trendPositive: TOKENS.colors.status.success,
      trendNegative: TOKENS.colors.status.error,
    },
    neutral: {
      bgColor: TOKENS.colors.surface.bgSecondary,
      textColor: TOKENS.colors.text.primary,
      trendPositive: TOKENS.colors.status.success,
      trendNegative: TOKENS.colors.status.error,
    },
  };

  const colors = variantColors[variant];

  return (
    <div
      onClick={onClick}
      className={`kpi-card ${className}`}
      style={{
        backgroundColor: colors.bgColor,
        borderRadius: TOKENS.radius.card.default,
        padding: TOKENS.spacing.card.md,
        cursor: onClick ? 'pointer' : 'default',
        transition: `all ${TOKENS.transitions.base}`,
        display: 'flex',
        flexDirection: layout === 'vertical' ? 'column' : 'row',
        gap: TOKENS.spacing.gap.md,
        alignItems: layout === 'horizontal' ? 'center' : 'flex-start',
      }}
    >
      {icon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: TOKENS.spacing.icon.md,
            height: TOKENS.spacing.icon.md,
            borderRadius: TOKENS.radius.xs,
            backgroundColor: `${colors.textColor}20`,
            color: colors.textColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}

      <div style={{ flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: TOKENS.typography.fontSize.body.sm.size,
            color: colors.textColor,
            opacity: 0.85,
            fontWeight: TOKENS.typography.fontWeight.medium,
          }}
        >
          {label}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: TOKENS.spacing.gap.sm,
            marginTop: TOKENS.spacing.rhythm.xs,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: TOKENS.typography.fontSize.heading.h2.size,
              fontWeight: TOKENS.typography.fontSize.heading.h2.fontWeight,
              color: colors.textColor,
            }}
          >
            {value}
          </h3>

          {subvalue && (
            <span
              style={{
                fontSize: TOKENS.typography.fontSize.body.sm.size,
                color: colors.textColor,
                opacity: 0.75,
              }}
            >
              {subvalue}
            </span>
          )}
        </div>

        {trend && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: TOKENS.spacing.gap.xs,
              marginTop: TOKENS.spacing.rhythm.sm,
              fontSize: TOKENS.typography.fontSize.body.xs.size,
              color: trend.isPositive ? colors.trendPositive : colors.trendNegative,
              fontWeight: TOKENS.typography.fontWeight.medium,
            }}
          >
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
            {trend.label && <span style={{ opacity: 0.85 }}>({trend.label})</span>}
          </div>
        )}
      </div>
    </div>
  );
};
