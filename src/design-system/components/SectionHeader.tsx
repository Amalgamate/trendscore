import React from 'react';
import { TOKENS } from '../tokens';

/**
 * SectionHeader - Standardized section header with optional actions
 * 
 * @component
 * @example
 * <SectionHeader 
 *   title="Recent Activities" 
 *   description="Last 7 days"
 *   action={<Button>View All</Button>}
 * />
 */
interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  level?: 'h1' | 'h2' | 'h3' | 'h4';
  variant?: 'default' | 'bordered' | 'underline';
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  action,
  actions,
  level = 'h2',
  variant = 'default',
  className = '',
}) => {
  const headingStyle = TOKENS.typography.fontSize.heading[level];
  const actionContent = actions || action;

  const variantStyles = {
    default: {
      borderBottom: 'none',
      paddingBottom: 0,
    },
    bordered: {
      borderBottom: `1px solid ${TOKENS.colors.border.default}`,
      paddingBottom: TOKENS.spacing.rhythm.md,
    },
    underline: {
      borderBottom: `2px solid ${TOKENS.colors.brand.primary}`,
      paddingBottom: TOKENS.spacing.rhythm.sm,
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      className={`section-header ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: TOKENS.spacing.gap.lg,
        marginBottom: TOKENS.spacing.section.desktop,
        ...style,
      }}
    >
      <div style={{ flex: 1 }}>
        {React.createElement(
          level,
          {
            style: {
              margin: 0,
              fontSize: headingStyle.size,
              fontWeight: headingStyle.fontWeight,
              lineHeight: headingStyle.lineHeight,
              color: TOKENS.colors.text.primary,
              letterSpacing: headingStyle.letterSpacing,
            },
          },
          title
        )}

        {description && (
          <p
            style={{
              margin: `${TOKENS.spacing.rhythm.xs} 0 0 0`,
              fontSize: TOKENS.typography.fontSize.body.sm.size,
              color: TOKENS.colors.text.secondary,
              lineHeight: TOKENS.typography.fontSize.body.sm.lineHeight,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {actionContent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: TOKENS.spacing.gap.sm,
            flexShrink: 0,
          }}
        >
          {actionContent}
        </div>
      )}
    </div>
  );
};
