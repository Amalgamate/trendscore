import React from 'react';
import { TOKENS } from '../tokens';

/**
 * MetricBanner - Horizontal banner showing multiple related metrics
 * 
 * @component
 * @example
 * <MetricBanner
 *   title="School Performance Summary"
 *   metrics={[
 *     { label: 'Total Students', value: 500 },
 *     { label: 'Teachers', value: 45 },
 *     { label: 'Classes', value: 20 },
 *   ]}
 * />
 */
interface Metric {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  badge?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
}

interface MetricBannerProps {
  title?: string;
  metrics: Metric[];
  variant?: 'light' | 'dark' | 'gradient';
  layout?: 'horizontal' | 'grid';
  columns?: number;
  action?: React.ReactNode;
  className?: string;
}

export const MetricBanner: React.FC<MetricBannerProps> = ({
  title,
  metrics,
  variant = 'light',
  layout = 'horizontal',
  columns = 3,
  action,
  className = '',
}) => {
  const variantStyles = {
    light: {
      background: TOKENS.colors.surface.bg,
      border: `1px solid ${TOKENS.colors.border.default}`,
    },
    dark: {
      background: TOKENS.colors.brand.primary,
      border: 'none',
    },
    gradient: {
      background: `linear-gradient(135deg, ${TOKENS.colors.brand.primary}, ${TOKENS.colors.brand.primaryLight})`,
      border: 'none',
    },
  };

  const colorMap = {
    primary: TOKENS.colors.brand.primary,
    success: TOKENS.colors.status.success,
    warning: TOKENS.colors.status.warning,
    error: TOKENS.colors.status.error,
    neutral: TOKENS.colors.text.secondary,
  };

  const style = variantStyles[variant];
  const textColor = variant === 'light' ? TOKENS.colors.text.primary : TOKENS.colors.text.inverse;

  return (
    <div
      className={`metric-banner ${className}`}
      style={{
        background: style.background,
        border: style.border,
        borderRadius: TOKENS.radius.card.default,
        padding: TOKENS.spacing.section.desktop,
        transition: `all ${TOKENS.transitions.base}`,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: TOKENS.spacing.rhythm.lg,
          }}
        >
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: TOKENS.typography.fontSize.heading.h3.size,
                fontWeight: TOKENS.typography.fontSize.heading.h3.fontWeight,
                color: textColor,
              }}
            >
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            layout === 'grid'
              ? `repeat(${columns}, 1fr)`
              : `repeat(auto-fit, minmax(150px, 1fr))`,
          gap: TOKENS.spacing.gap.lg,
        }}
      >
        {metrics.map((metric, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: TOKENS.spacing.gap.xs,
            }}
          >
            {metric.icon && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: TOKENS.spacing.gap.sm,
                  color: metric.color ? colorMap[metric.color] : colorMap.primary,
                }}
              >
                {metric.icon}
              </div>
            )}

            <p
              style={{
                margin: 0,
                fontSize: TOKENS.typography.fontSize.body.sm.size,
                color: variant === 'light' ? TOKENS.colors.text.secondary : `${textColor}cc`,
                fontWeight: TOKENS.typography.fontWeight.normal,
              }}
            >
              {metric.label}
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: TOKENS.spacing.gap.sm,
              }}
            >
              <span
                style={{
                  fontSize: TOKENS.typography.fontSize.heading.h2.size,
                  fontWeight: TOKENS.typography.fontWeight.bold,
                  color: textColor,
                }}
              >
                {metric.value}
              </span>

              {metric.badge && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: `2px 8px`,
                    borderRadius: TOKENS.radius.badge.pill,
                    fontSize: TOKENS.typography.fontSize.badge.sm.size,
                    fontWeight: TOKENS.typography.fontWeight.semibold,
                    backgroundColor: variant === 'light' 
                      ? TOKENS.colors.status.infoLight 
                      : `${TOKENS.colors.text.inverse}20`,
                    color: variant === 'light' 
                      ? TOKENS.colors.status.info 
                      : TOKENS.colors.text.inverse,
                  }}
                >
                  {metric.badge}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
