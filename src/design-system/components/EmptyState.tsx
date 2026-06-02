import React from 'react';
import { TOKENS } from '../tokens';

/**
 * EmptyState - Standardized empty state component for no data scenarios
 * 
 * @component
 * @example
 * <EmptyState
 *   icon={<Database />}
 *   title="No Data"
 *   description="There are no records yet"
 *   action={<Button>Create Item</Button>}
 * />
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode | EmptyStateAction;
  secondaryAction?: React.ReactNode | EmptyStateAction;
  variant?: 'default' | 'subtle' | 'outlined';
  fullHeight?: boolean;
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
}

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  fullHeight = true,
  className = '',
  iconSize = 'lg',
}) => {
  const variantStyles = {
    default: {
      background: TOKENS.colors.surface.bgSubtle,
      border: `1px dashed ${TOKENS.colors.border.subtle}`,
    },
    subtle: {
      background: TOKENS.colors.surface.bg,
      border: 'none',
    },
    outlined: {
      background: TOKENS.colors.surface.bg,
      border: `2px dashed ${TOKENS.colors.brand.primary}20`,
    },
  };

  const iconSizeMap = {
    sm: TOKENS.spacing.icon.sm,
    md: TOKENS.spacing.icon.md,
    lg: TOKENS.spacing.icon.lg,
  };

  const style = variantStyles[variant];

  const renderAction = (actionConfig: React.ReactNode | EmptyStateAction) => {
    if (!actionConfig) return null;

    if (React.isValidElement(actionConfig) || typeof actionConfig !== 'object') {
      return actionConfig;
    }

    const {
      label,
      onClick,
      href,
      disabled = false,
      variant: actionVariant = 'primary',
    } = actionConfig as EmptyStateAction;

    if (!label) return null;

    const actionStyle: React.CSSProperties = {
      appearance: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40px',
      padding: `0 ${TOKENS.spacing.gap.lg}`,
      borderRadius: TOKENS.radius.button.default,
      border: actionVariant === 'primary'
        ? `1px solid ${TOKENS.colors.brand.primary}`
        : `1px solid ${TOKENS.colors.border.subtle}`,
      background: actionVariant === 'primary'
        ? TOKENS.colors.brand.primary
        : TOKENS.colors.surface.bg,
      color: actionVariant === 'primary'
        ? TOKENS.colors.text.inverse
        : TOKENS.colors.text.primary,
      fontSize: TOKENS.typography.fontSize.body.sm.size,
      fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      textDecoration: 'none',
    };

    if (href) {
      return (
        <a href={href} style={actionStyle} aria-disabled={disabled}>
          {label}
        </a>
      );
    }

    return (
      <button type="button" onClick={onClick} disabled={disabled} style={actionStyle}>
        {label}
      </button>
    );
  };

  return (
    <div
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: TOKENS.spacing.gap.md,
        padding: TOKENS.spacing.section.desktop,
        background: style.background,
        border: style.border,
        borderRadius: TOKENS.radius.card.default,
        minHeight: fullHeight ? '300px' : 'auto',
        textAlign: 'center',
        transition: `all ${TOKENS.transitions.base}`,
      }}
    >
      {icon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: iconSizeMap[iconSize],
            height: iconSizeMap[iconSize],
            borderRadius: TOKENS.radius.md,
            backgroundColor: TOKENS.colors.brand.primary + '10',
            color: TOKENS.colors.brand.primary,
            fontSize: '2rem',
          }}
        >
          {icon}
        </div>
      )}

      <div>
        <h3
          style={{
            margin: 0,
            fontSize: TOKENS.typography.fontSize.heading.h3.size,
            fontWeight: TOKENS.typography.fontSize.heading.h3.fontWeight,
            color: TOKENS.colors.text.primary,
            marginBottom: TOKENS.spacing.rhythm.xs,
          }}
        >
          {title}
        </h3>

        {description && (
          <p
            style={{
              margin: 0,
              fontSize: TOKENS.typography.fontSize.body.sm.size,
              color: TOKENS.colors.text.secondary,
              lineHeight: TOKENS.typography.fontSize.body.sm.lineHeight,
              maxWidth: '400px',
            }}
          >
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            gap: TOKENS.spacing.gap.sm,
            justifyContent: 'center',
            marginTop: TOKENS.spacing.rhythm.sm,
            flexWrap: 'wrap',
          }}
        >
          {action && <div>{renderAction(action)}</div>}
          {secondaryAction && <div>{renderAction(secondaryAction)}</div>}
        </div>
      )}
    </div>
  );
};
