/**
 * Trends Core Unified Spacing System
 * Consistent padding, margins, and gaps throughout the application
 */

export const SPACING = {
  // Base spacing scale (8px base unit)
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '2.5rem',  // 40px
  '3xl': '3rem',    // 48px
  '4xl': '4rem',    // 64px
  '5xl': '5rem',    // 80px

  // Named spacing for common use cases
  gutter: {
    xs: '0.5rem',      // 8px - Compact screens
    sm: '1rem',        // 16px - Mobile
    md: '1.5rem',      // 24px - Tablet
    lg: '2rem',        // 32px - Desktop
    xl: '3rem',        // 48px - Wide screens
  },

  // Component padding (internal spacing)
  component: {
    xs: '0.5rem',      // Small components (badges, small buttons)
    sm: '0.75rem',     // Default buttons, inputs
    md: '1rem',        // Cards, panels
    lg: '1.5rem',      // Large cards, sections
    xl: '2rem',        // Full-page sections
  },

  // Card padding (internal spacing of cards)
  card: {
    xs: '0.75rem',     // Compact cards
    sm: '1rem',        // Standard cards
    md: '1.5rem',      // Large cards
    lg: '2rem',        // Extra-large cards
  },

  // Section padding (page sections)
  section: {
    mobile: '1rem',      // Mobile sections
    tablet: '1.5rem',    // Tablet sections
    desktop: '2rem',     // Desktop sections
    wide: '3rem',        // Wide screen sections
  },

  // Gap sizes (for grid and flex layouts)
  gap: {
    xs: '0.25rem',     // Minimal gap
    sm: '0.5rem',      // Small gap
    md: '1rem',        // Standard gap
    lg: '1.5rem',      // Large gap
    xl: '2rem',        // Extra-large gap
  },

  // Vertical rhythm
  rhythm: {
    xs: '0.5rem',      // Tight spacing between elements
    sm: '1rem',        // Standard spacing
    md: '1.5rem',      // Comfortable spacing
    lg: '2rem',        // Generous spacing
    xl: '3rem',        // Large spacing
  },

  // Specific component spacing
  table: {
    cellPadding: '0.625rem 0.75rem', // Standard table cell
    headerPadding: '0.75rem 0.75rem',
    compactPadding: '0.5rem 0.5rem',
    roomyPadding: '1rem 1rem',
  },

  header: {
    height: '3.5rem',     // Standard header height
    compact: '3rem',      // Compact header
    tall: '4rem',         // Tall header
  },

  sidebar: {
    width: '16rem',       // Standard sidebar (256px)
    compact: '12rem',     // Compact sidebar (192px)
    wide: '20rem',        // Wide sidebar (320px)
  },

  modal: {
    padding: '2rem',      // Modal content padding
    spaceBetween: '1rem', // Space between form fields
  },

  button: {
    paddingX: '1rem',
    paddingY: '0.5rem',
    gap: '0.5rem',        // Space between icon and text
  },

  badge: {
    x: '0.75rem',
    y: '0.25rem',
  },

  icon: {
    sm: '1rem',           // Small icons (16px)
    md: '1.5rem',         // Medium icons (24px)
    lg: '2rem',           // Large icons (32px)
    xl: '3rem',           // Extra-large icons (48px)
  },
} as const;

/**
 * Responsive spacing utilities
 */
export const responsiveSpacing = {
  /**
   * Mobile-first responsive padding
   * @example responsivePadding('md') => { xs: SPACING.component.sm, md: SPACING.component.md }
   */
  padding: (size: keyof typeof SPACING.component) => ({
    xs: SPACING.component.xs,
    md: SPACING.component[size],
    lg: SPACING.component[size],
  }),

  /**
   * Mobile-first responsive margin
   */
  margin: (size: keyof typeof SPACING.rhythm) => ({
    xs: SPACING.rhythm.xs,
    md: SPACING.rhythm[size],
    lg: SPACING.rhythm[size],
  }),

  /**
   * Mobile-first responsive gap
   */
  gap: (size: keyof typeof SPACING.gap) => ({
    xs: SPACING.gap.xs,
    md: SPACING.gap[size],
    lg: SPACING.gap[size],
  }),
} as const;

/**
 * Tailwind spacing scale
 */
export const spacingScale = {
  // Tailwind default + custom
  0: '0',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  9: '2.25rem',
  10: '2.5rem',
  11: '2.75rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  28: '7rem',
  32: '8rem',
  36: '9rem',
  40: '10rem',
  44: '11rem',
  48: '12rem',
  52: '13rem',
  56: '14rem',
  60: '15rem',
  64: '16rem',
  72: '18rem',
  80: '20rem',
  96: '24rem',
} as const;
