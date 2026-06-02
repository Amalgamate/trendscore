import React from 'react';
import { TOKENS } from '../tokens';

/**
 * DashboardHero - Large hero section at the top of dashboards
 * 
 * @component
 * @example
 * <DashboardHero
 *   title="Welcome, Admin"
 *   subtitle="Here's your school overview"
 *   backgroundImage="/hero-bg.jpg"
 *   actions={<Button>Settings</Button>}
 * />
 */
interface DashboardHeroProps {
  title: string;
  subtitle?: string;
  backgroundImage?: string;
  backgroundColor?: string;
  actions?: React.ReactNode;
  stats?: Array<{
    label: string;
    value: string | number;
  }>;
  variant?: 'default' | 'dark' | 'gradient' | 'image';
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  title,
  subtitle,
  backgroundImage,
  backgroundColor,
  actions,
  stats,
  variant = 'gradient',
  height = 'md',
  className = '',
}) => {
  const heightMap = {
    sm: '150px',
    md: '240px',
    lg: '320px',
  };

  const variantStyles = {
    default: {
      background: `linear-gradient(135deg, ${TOKENS.colors.brand.primary}, ${TOKENS.colors.brand.primaryLight})`,
      overlay: 'none',
    },
    dark: {
      background: TOKENS.colors.brand.primaryDark,
      overlay: 'none',
    },
    gradient: {
      background: `linear-gradient(135deg, ${TOKENS.colors.brand.primary} 0%, ${TOKENS.colors.brand.secondary} 100%)`,
      overlay: 'none',
    },
    image: {
      background: `url(${backgroundImage}) center/cover no-repeat`,
      overlay: 'rgba(0, 0, 0, 0.4)',
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      className={`dashboard-hero ${className}`}
      style={{
        position: 'relative',
        height: heightMap[height],
        background: style.background || backgroundColor,
        borderRadius: TOKENS.radius.card.default,
        padding: TOKENS.spacing.section.desktop,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: TOKENS.colors.text.inverse,
        overflow: 'hidden',
        marginBottom: TOKENS.spacing.section.desktop,
      }}
    >
      {/* Overlay for image variant */}
      {variant === 'image' && style.overlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: style.overlay,
            zIndex: 1,
          }}
        />
      )}

      {/* Content wrapper */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: TOKENS.spacing.gap.md }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: TOKENS.spacing.gap.lg }}>
          <div style={{ flex: 1 }}>
            <h1
              style={{
                margin: 0,
                fontSize: TOKENS.typography.fontSize.heading.h1.size,
                fontWeight: TOKENS.typography.fontSize.heading.h1.fontWeight,
                lineHeight: TOKENS.typography.fontSize.heading.h1.lineHeight,
                color: TOKENS.colors.text.inverse,
              }}
            >
              {title}
            </h1>

            {subtitle && (
              <p
                style={{
                  margin: `${TOKENS.spacing.rhythm.sm} 0 0 0`,
                  fontSize: TOKENS.typography.fontSize.body.md.size,
                  lineHeight: TOKENS.typography.fontSize.body.md.lineHeight,
                  color: `${TOKENS.colors.text.inverse}dd`,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {actions && (
            <div
              style={{
                display: 'flex',
                gap: TOKENS.spacing.gap.sm,
                flexShrink: 0,
              }}
            >
              {actions}
            </div>
          )}
        </div>

        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
              gap: TOKENS.spacing.gap.lg,
              marginTop: TOKENS.spacing.rhythm.md,
            }}
          >
            {stats.map((stat, index) => (
              <div key={index}>
                <p
                  style={{
                    margin: 0,
                    fontSize: TOKENS.typography.fontSize.body.sm.size,
                    color: `${TOKENS.colors.text.inverse}aa`,
                    fontWeight: TOKENS.typography.fontWeight.normal,
                  }}
                >
                  {stat.label}
                </p>
                <p
                  style={{
                    margin: `${TOKENS.spacing.rhythm.xs} 0 0 0`,
                    fontSize: TOKENS.typography.fontSize.heading.h3.size,
                    fontWeight: TOKENS.typography.fontWeight.bold,
                    color: TOKENS.colors.text.inverse,
                  }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
