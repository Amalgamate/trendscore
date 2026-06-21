/**
 * TreadSCORE Design System Tokens
 * Central export for all design tokens and utilities
 *
 * This file re-exports all design system modules and provides
 * convenience methods for common design tasks.
 */

import { COLORS } from './colors';
import { SPACING } from './spacing';
import { RADIUS } from './radius';
import { TYPOGRAPHY } from './typography';

export * from './colors';
export * from './spacing';
export * from './radius';
export * from './typography';

/**
 * Centralized design tokens object
 * Use this for easy access to all design system values
 *
 * @example
 * import { TOKENS } from '@/design-system/tokens';
 *
 * const cardStyle = {
 *   padding: TOKENS.spacing.card.md,
 *   borderRadius: TOKENS.radius.card.default,
 *   background: TOKENS.colors.surface.bg,
 *   boxShadow: TOKENS.shadows.md,
 * };
 */
export const TOKENS = {
  colors: COLORS,
  spacing: SPACING,
  radius: RADIUS,
  typography: TYPOGRAPHY,

  // Shadow definitions
  shadows: {
    none: '0 0 #0000',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  },

  // Breakpoints
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Animation/Transition timings
  transitions: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  easing: {
    ease: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Z-index scale
  zIndex: {
    hide: '-1',
    auto: 'auto',
    base: '0',
    dropdown: '1000',
    sticky: '1020',
    fixed: '1030',
    backdrop: '1040',
    offcanvas: '1050',
    modal: '1060',
    popover: '1070',
    tooltip: '1080',
  },

  // Opacity scale
  opacity: {
    0: '0',
    5: '0.05',
    10: '0.1',
    20: '0.2',
    25: '0.25',
    30: '0.3',
    40: '0.4',
    50: '0.5',
    60: '0.6',
    70: '0.7',
    75: '0.75',
    80: '0.8',
    90: '0.9',
    95: '0.95',
    100: '1',
  },
} as const;

/**
 * Design system preset for component styling
 * Pre-configured combinations of tokens for common component patterns
 */
export const COMPONENT_PRESETS = {
  // Card presets
  card: {
    default: {
      padding: SPACING.card.md,
      borderRadius: RADIUS.card.default,
      backgroundColor: COLORS.surface.bg,
      border: `1px solid ${COLORS.border.default}`,
      boxShadow: 'none',
    },
    elevated: {
      padding: SPACING.card.md,
      borderRadius: RADIUS.card.elevated,
      backgroundColor: COLORS.surface.bg,
      border: 'none',
      boxShadow: TOKENS.shadows.md,
    },
    flat: {
      padding: SPACING.card.md,
      borderRadius: RADIUS.card.flat,
      backgroundColor: COLORS.surface.bgSecondary,
      border: 'none',
      boxShadow: 'none',
    },
  },

  // Button presets
  button: {
    primary: {
      backgroundColor: COLORS.brand.primary,
      color: COLORS.text.inverse,
      padding: `${SPACING.button.paddingY} ${SPACING.button.paddingX}`,
      borderRadius: RADIUS.button.default,
      border: 'none',
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      cursor: 'pointer',
      transition: `all ${TOKENS.transitions.base} ${TOKENS.easing.easeInOut}`,
    },
    secondary: {
      backgroundColor: COLORS.surface.bgSecondary,
      color: COLORS.text.primary,
      border: `1px solid ${COLORS.border.default}`,
      padding: `${SPACING.button.paddingY} ${SPACING.button.paddingX}`,
      borderRadius: RADIUS.button.default,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      cursor: 'pointer',
      transition: `all ${TOKENS.transitions.base} ${TOKENS.easing.easeInOut}`,
    },
  },

  // Input presets
  input: {
    default: {
      padding: SPACING.component.sm,
      borderRadius: RADIUS.input.default,
      border: `1px solid ${COLORS.border.default}`,
      backgroundColor: COLORS.surface.bg,
      color: COLORS.text.primary,
      fontFamily: TYPOGRAPHY.fontFamily.sans,
      fontSize: TYPOGRAPHY.fontSize.body.md.size,
      lineHeight: TYPOGRAPHY.fontSize.body.md.lineHeight,
      transition: `all ${TOKENS.transitions.base} ${TOKENS.easing.easeInOut}`,
    },
    focused: {
      borderColor: COLORS.brand.primary,
      outline: 'none',
      boxShadow: `0 0 0 2px ${COLORS.brand.primary}20`,
    },
  },

  // Badge presets
  badge: {
    default: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: `${SPACING.badge ? SPACING.badge.y || '0.25rem' : '0.25rem'} ${SPACING.badge ? SPACING.badge.x || '0.75rem' : '0.75rem'}`,
      borderRadius: RADIUS.badge.default,
      fontSize: TYPOGRAPHY.fontSize.badge.sm.size,
      fontWeight: TYPOGRAPHY.fontSize.badge.sm.fontWeight,
      lineHeight: TYPOGRAPHY.fontSize.badge.sm.lineHeight,
      backgroundColor: COLORS.surface.bgMuted,
      color: COLORS.text.secondary,
      border: 'none',
    },
    success: {
      backgroundColor: COLORS.status.successLight,
      color: COLORS.status.success,
    },
    error: {
      backgroundColor: COLORS.status.errorLight,
      color: COLORS.status.error,
    },
    warning: {
      backgroundColor: COLORS.status.warningLight,
      color: COLORS.status.warning,
    },
  },

  // Section presets
  section: {
    default: {
      padding: SPACING.section.desktop,
      borderRadius: RADIUS.section.default,
      backgroundColor: COLORS.surface.bg,
    },
    contained: {
      padding: SPACING.section.desktop,
      borderRadius: RADIUS.card.default,
      backgroundColor: COLORS.surface.bg,
      border: `1px solid ${COLORS.border.default}`,
    },
  },

  // Table presets
  table: {
    cellPadding: SPACING.table.cellPadding,
    headerPadding: SPACING.table.headerPadding,
    borderColor: COLORS.border.table,
    headerBgColor: COLORS.border.tableHeader,
    bgColor: COLORS.surface.bg,
    hoverBgColor: '#f8fbff',
    borderWidth: '1px',
    borderStyle: 'solid',
    className: 'data-table',
    cssVars: {
      border: '--table-border',
      headerBg: '--table-header-bg',
      headerFg: '--table-header-fg',
      bg: '--table-bg',
      hoverBg: '--table-row-hover-bg',
      cellPadding: '--table-cell-padding',
      headerPadding: '--table-header-padding',
    },
  },

  // Modal presets
  modal: {
    default: {
      borderRadius: RADIUS.modal.default,
      padding: SPACING.modal.padding,
      backgroundColor: COLORS.surface.bg,
      boxShadow: TOKENS.shadows.xl,
    },
  },
} as const;

/**
 * Design system validation utilities
 */
export const designSystemUtils = {
  /**
   * Check if a color is valid from the design system
   */
  isValidColor: (color: string): boolean => {
    return Object.values(COLORS).some(
      (colorObj) => {
        const values = typeof colorObj === 'string' ? [colorObj] : Object.values(colorObj);
        return (values as string[]).includes(color);
      }
    );
  },

  /**
   * Check if spacing is valid
   */
  isValidSpacing: (spacing: string): boolean => {
    return Object.values(SPACING).some(
      (spacingVal) => {
        const values = typeof spacingVal === 'string' ? [spacingVal] : Object.values(spacingVal);
        return (values as string[]).includes(spacing);
      }
    );
  },

  /**
   * Get contrasting text color (white or black) for a background color
   */
  getContrastingTextColor: (bgColor: string): string => {
    // Simple contrast checker - for production, use a proper library
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? COLORS.text.primary : COLORS.text.inverse;
  },
};
