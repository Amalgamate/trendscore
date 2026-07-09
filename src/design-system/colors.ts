/**
 * Trends Core Unified Color System
 * All colors used across the application for consistency
 */

export const COLORS = {
  // Brand Colors (Primary & Secondary)
  brand: {
    primary: '#030b82',
    primaryDark: '#02075e',
    primaryLight: '#1e26a1',
    primaryRgb: '3 11 130',
    
    secondary: '#0D9488',
    secondaryDark: '#0a736a',
    secondaryRgb: '13 148 136',
    
    accent1: '#3b82f6',
    accent1Rgb: '59 130 246',
    
    accent2: '#e11d48',
    accent2Rgb: '225 29 72',
  },

  // Background & Surface Colors
  surface: {
    bg: '#ffffff',
    bgSecondary: '#f8fafc',
    bgTertiary: '#f3f4f6',
    bgSubtle: '#fafbfc',
    bgMuted: 'rgba(3, 11, 130, 0.02)',
    bgMutedStrong: 'rgba(3, 11, 130, 0.05)',
  },

  // Text Colors
  text: {
    primary: '#000000',
    secondary: '#4b5563',
    tertiary: '#6b7280',
    muted: '#9ca3af',
    light: '#f3f4f6',
    inverse: '#ffffff',
  },

  // Borders & Dividers
  border: {
    default: '#e5e7eb',
    subtle: '#d1d5db',
    strong: '#9ca3af',
    muted: '#f3f4f6',
    table: '#d1d5db',
    tableHeader: '#f9fafb',
  },

  // Status Colors
  status: {
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    info: '#0ea5e9',
    infoLight: '#cffafe',
  },

  // Assessment Rating Colors (CBC System)
  assessment: {
    // EE - Exceeding Expectations
    ee: '#059669', // Green
    
    // ME - Meeting Expectations
    me: '#0891b2', // Cyan
    
    // AE - Approaching Expectations
    ae: '#f59e0b', // Amber
    
    // BE - Below Expectations
    be: '#dc2626', // Red
  },

  // Grade Colors (Secondary System)
  grades: {
    a: '#10b981', // Green
    b: '#3b82f6', // Blue
    c: '#f59e0b', // Amber
    d: '#ec4899', // Pink
    e: '#dc2626', // Red
  },

  // Gender Colors
  gender: {
    male: '#3b82f6', // Blue
    female: '#ec4899', // Pink
    other: '#8b5cf6', // Violet
  },

  // Chart Colors (Recharts palette)
  chart: {
    primary: '#030b82',
    secondary: '#0D9488',
    accent: '#3b82f6',
    accent2: '#e11d48',
    neutral1: '#6b7280',
    neutral2: '#d1d5db',
    neutral3: '#f3f4f6',
  },

  // Shadow Colors (for consistency)
  shadow: {
    sm: 'rgba(0, 0, 0, 0.05)',
    md: 'rgba(0, 0, 0, 0.1)',
    lg: 'rgba(0, 0, 0, 0.15)',
  },

  // Overlay Colors
  overlay: {
    dark: 'rgba(0, 0, 0, 0.5)',
    light: 'rgba(255, 255, 255, 0.8)',
  },
} as const;

/**
 * Color utility functions
 */
export const colorUtils = {
  /**
   * Convert hex to RGB values (for use with alpha channel)
   * @example toRgb('#030b82') => '3, 11, 130'
   */
  toRgb: (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '0, 0, 0';
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `${r} ${g} ${b}`;
  },

  /**
   * Apply alpha channel to a color
   * @example withAlpha('#030b82', 0.5) => 'rgba(3, 11, 130, 0.5)'
   */
  withAlpha: (hex: string, alpha: number): string => {
    const rgb = colorUtils.toRgb(hex);
    return `rgba(${rgb}, ${alpha})`;
  },

  /**
   * Lighten a color (increase brightness)
   */
  lighten: (hex: string, amount: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, (num >> 8 & 0x00FF) + amount);
    const b = Math.min(255, (num & 0x0000FF) + amount);
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  /**
   * Darken a color (decrease brightness)
   */
  darken: (hex: string, amount: number): string => {
    return colorUtils.lighten(hex, -amount);
  },
};

/**
 * Color palette export for Tailwind config
 */
export const colorPalette = {
  brand: {
    primary: 'var(--brand-primary)',
    primaryDark: 'var(--brand-primary-dark)',
    primaryLight: 'var(--brand-purple-light)',
    secondary: 'var(--brand-secondary)',
    secondaryDark: 'var(--brand-secondary-dark)',
    accent1: 'var(--brand-accent-1)',
    accent2: 'var(--brand-accent-2)',
  },
  surface: {
    bg: 'var(--bg-primary)',
    bgSecondary: 'var(--bg-secondary)',
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
  },
  border: {
    default: 'var(--border-color)',
    table: 'var(--table-border)',
  },
} as const;
