import React from 'react';
import { TOKENS } from '../tokens';
import AskAIButton from '../../components/help/AskAIButton';

/**
 * AppCard - Standard card component for consistent styling
 * 
 * @component
 * @example
 * <AppCard title="Sales" subtitle="Last 30 days">
 *   <p>Card content here</p>
 * </AppCard>
 */
interface AppCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'flat';
  onClick?: () => void;
  className?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  askAI?: boolean;
  aiContext?: unknown;
}

export const AppCard: React.FC<AppCardProps> = ({
  title,
  subtitle,
  children,
  variant = 'default',
  onClick,
  className = '',
  headerAction,
  footer,
  askAI = true,
  aiContext,
}) => {
  const variantStyles = {
    default: {
      border: `1px solid ${TOKENS.colors.border.default}`,
      background: TOKENS.colors.surface.bg,
      shadow: 'none',
    },
    elevated: {
      border: 'none',
      background: TOKENS.colors.surface.bg,
      shadow: TOKENS.shadows.md,
    },
    flat: {
      border: 'none',
      background: TOKENS.colors.surface.bgSecondary,
      shadow: 'none',
    },
  };

  const style = variantStyles[variant];
  const usesStandardSurface = variant === 'default';

  return (
    <div
      onClick={onClick}
      data-ai-card="true"
      data-ai-title={title}
      className={`app-card ${usesStandardSurface ? 'surface-panel' : ''} ${onClick ? 'surface-panel-interactive' : ''} ${className}`}
      style={{
        borderRadius: TOKENS.radius.card.default,
        padding: TOKENS.spacing.card.md,
        backgroundColor: usesStandardSurface ? undefined : style.background,
        border: usesStandardSurface ? undefined : style.border,
        boxShadow: usesStandardSurface ? undefined : style.shadow,
        cursor: onClick ? 'pointer' : 'default',
        transition: `all ${TOKENS.transitions.base}`,
      }}
    >
      {(title || subtitle || headerAction) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: TOKENS.spacing.rhythm.md,
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  fontSize: TOKENS.typography.fontSize.heading.h3.size,
                  fontWeight: TOKENS.typography.fontSize.heading.h3.fontWeight,
                  lineHeight: TOKENS.typography.fontSize.heading.h3.lineHeight,
                  color: TOKENS.colors.text.primary,
                  margin: 0,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: TOKENS.typography.fontSize.body.sm.size,
                  lineHeight: TOKENS.typography.fontSize.body.sm.lineHeight,
                  color: TOKENS.colors.text.secondary,
                  margin: `${TOKENS.spacing.rhythm.xs} 0 0 0`,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {(askAI || headerAction) && (
            <div className="flex shrink-0 items-center gap-2">
              {askAI && title && <AskAIButton title={title} description={subtitle} context={aiContext} />}
              {headerAction}
            </div>
          )}
        </div>
      )}

      <div style={{ color: TOKENS.colors.text.primary }}>{children}</div>

      {footer && (
        <div
          style={{
            marginTop: TOKENS.spacing.rhythm.md,
            borderTop: `1px solid ${TOKENS.colors.border.subtle}`,
            paddingTop: TOKENS.spacing.rhythm.md,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
