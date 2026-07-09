/**
 * Trends Core Typography System
 * Standardized font scales, weights, and styles
 */

export const TYPOGRAPHY = {
  // Font family definitions
  fontFamily: {
    sans: "var(--font-family-sans)",
    mono: "var(--font-family-mono)",
  },

  // Font weights
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  // Font sizes with line heights
  fontSize: {
    // Display sizes (page headings)
    display: {
      xl: {
        size: '3.75rem',  // 60px
        lineHeight: '1.1',
        letterSpacing: '-0.02em',
      },
      lg: {
        size: '3rem',     // 48px
        lineHeight: '1.2',
        letterSpacing: '-0.015em',
      },
      md: {
        size: '2.25rem',  // 36px
        lineHeight: '1.25',
        letterSpacing: '-0.01em',
      },
      sm: {
        size: '1.875rem', // 30px
        lineHeight: '1.3',
        letterSpacing: '-0.005em',
      },
    },

    // Heading sizes
    heading: {
      h1: {
        size: '2rem',      // 32px
        lineHeight: '1.3',
        letterSpacing: '-0.01em',
        fontWeight: 700,
      },
      h2: {
        size: '1.5rem',    // 24px
        lineHeight: '1.4',
        letterSpacing: '-0.005em',
        fontWeight: 600,
      },
      h3: {
        size: '1.25rem',   // 20px
        lineHeight: '1.4',
        fontWeight: 600,
      },
      h4: {
        size: '1rem',      // 16px
        lineHeight: '1.5',
        fontWeight: 600,
      },
      h5: {
        size: '0.875rem',  // 14px
        lineHeight: '1.5',
        fontWeight: 600,
        letterSpacing: '0.01em',
      },
      h6: {
        size: '0.75rem',   // 12px
        lineHeight: '1.5',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      },
    },

    // Body text sizes
    body: {
      lg: {
        size: '1.125rem',  // 18px
        lineHeight: '1.6',
      },
      md: {
        size: '1rem',      // 16px (default)
        lineHeight: '1.6',
      },
      sm: {
        size: '0.875rem',  // 14px
        lineHeight: '1.5',
      },
      xs: {
        size: '0.75rem',   // 12px
        lineHeight: '1.5',
      },
    },

    // Label sizes (for forms)
    label: {
      lg: {
        size: '1rem',      // 16px
        lineHeight: '1.5',
        fontWeight: 500,
      },
      md: {
        size: '0.875rem',  // 14px
        lineHeight: '1.5',
        fontWeight: 500,
      },
      sm: {
        size: '0.75rem',   // 12px
        lineHeight: '1.5',
        fontWeight: 500,
      },
    },

    // Caption sizes (for hints, meta)
    caption: {
      lg: {
        size: '0.875rem',  // 14px
        lineHeight: '1.4',
      },
      md: {
        size: '0.75rem',   // 12px
        lineHeight: '1.4',
      },
      sm: {
        size: '0.625rem',  // 10px
        lineHeight: '1.4',
      },
    },

    // Badge/Tag sizes
    badge: {
      lg: {
        size: '0.875rem',  // 14px
        lineHeight: '1.4',
        fontWeight: 600,
      },
      md: {
        size: '0.75rem',   // 12px
        lineHeight: '1.4',
        fontWeight: 600,
      },
      sm: {
        size: '0.625rem',  // 10px
        lineHeight: '1.4',
        fontWeight: 600,
      },
    },

    // Code sizes
    code: {
      block: {
        size: '0.875rem',  // 14px
        lineHeight: '1.6',
        fontFamily: "'Fira Code', monospace",
      },
      inline: {
        size: '0.8125rem', // 13px
        fontFamily: "'Fira Code', monospace",
      },
    },
  },

  // Line heights (for vertical rhythm)
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.6,
    loose: 1.8,
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Text transformation
  textTransform: {
    none: 'none',
    capitalize: 'capitalize',
    uppercase: 'uppercase',
    lowercase: 'lowercase',
  },

  // Text alignment
  textAlign: {
    left: 'left',
    center: 'center',
    right: 'right',
    justify: 'justify',
  },
} as const;

/**
 * Utility functions for typography
 */
export const typographyUtils = {
  /**
   * Get heading style
   * @example heading('h1') => { size: '2rem', lineHeight: '1.3', fontWeight: 700 }
   */
  heading: (level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => {
    return TYPOGRAPHY.fontSize.heading[level];
  },

  /**
   * Get body text style
   * @example body('md') => { size: '1rem', lineHeight: '1.6' }
   */
  body: (size: 'xs' | 'sm' | 'md' | 'lg') => {
    return TYPOGRAPHY.fontSize.body[size];
  },

  /**
   * Apply typography style as CSS classes
   * @example typographyClass('heading', 'h2') => 'text-2xl leading-7 font-semibold'
   */
  toClass: (category: keyof typeof TYPOGRAPHY.fontSize, variant: string): string => {
    const style = (TYPOGRAPHY.fontSize[category] as any)[variant];
    if (!style) return '';

    const sizeMap: { [key: string]: string } = {
      '0.625rem': 'text-xs',
      '0.75rem': 'text-sm',
      '0.875rem': 'text-base',
      '1rem': 'text-lg',
      '1.125rem': 'text-xl',
      '1.25rem': 'text-2xl',
      '1.5rem': 'text-3xl',
      '1.875rem': 'text-4xl',
      '2.25rem': 'text-5xl',
      '3rem': 'text-6xl',
      '3.75rem': 'text-7xl',
    };

    const weightMap: { [key: number]: string } = {
      300: 'font-light',
      400: 'font-normal',
      500: 'font-medium',
      600: 'font-semibold',
      700: 'font-bold',
      800: 'font-extrabold',
      900: 'font-black',
    };

    let classes = sizeMap[style.size] || '';
    if (style.fontWeight) {
      classes += ` ${weightMap[style.fontWeight] || 'font-normal'}`;
    }
    if (style.lineHeight) {
      const lineHeightMap: { [key: number]: string } = {
        1.1: 'leading-tight',
        1.2: 'leading-tight',
        1.25: 'leading-snug',
        1.3: 'leading-snug',
        1.4: 'leading-normal',
        1.5: 'leading-normal',
        1.6: 'leading-relaxed',
        1.8: 'leading-loose',
      };
      classes += ` ${lineHeightMap[style.lineHeight] || ''}`;
    }

    return classes.trim();
  },
};

/**
 * Tailwind typography configuration
 */
export const tailwindTypographyConfig = {
  fontFamily: {
    sans: TYPOGRAPHY.fontFamily.sans,
    mono: TYPOGRAPHY.fontFamily.mono,
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1.5' }],
    sm: ['0.875rem', { lineHeight: '1.5' }],
    base: ['1rem', { lineHeight: '1.6' }],
    lg: ['1.125rem', { lineHeight: '1.6' }],
    xl: ['1.25rem', { lineHeight: '1.5' }],
    '2xl': ['1.5rem', { lineHeight: '1.4' }],
    '3xl': ['1.875rem', { lineHeight: '1.3' }],
    '4xl': ['2.25rem', { lineHeight: '1.25' }],
    '5xl': ['3rem', { lineHeight: '1.2' }],
    '6xl': ['3.75rem', { lineHeight: '1.1' }],
  },
  fontWeight: TYPOGRAPHY.fontWeight,
  lineHeight: TYPOGRAPHY.lineHeight,
  letterSpacing: TYPOGRAPHY.letterSpacing,
} as const;
