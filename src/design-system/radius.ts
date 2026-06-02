/**
 * TreadSCORE Border Radius System
 * Standardized border radius values for consistent rounded corners
 *
 * Current design philosophy: Flat panels with minimal rounding
 * Rounding increases hierarchy: buttons > inputs > cards > sections
 */

export const RADIUS = {
  // Base radius values
  none: '0px',          // Flat, no rounding - for most panels
  xs: '2px',            // Minimal rounding - for subtle elevation
  sm: '4px',            // Small rounding - for buttons, badges
  md: '6px',            // Medium rounding - for inputs, small cards
  lg: '8px',            // Large rounding - for standard cards
  xl: '12px',           // Extra large rounding - for modals, large cards
  '2xl': '16px',        // 2x extra large rounding
  '3xl': '20px',        // 3x extra large rounding
  full: '9999px',       // Full circle - for avatars, pills

  // Component-specific radius
  button: {
    default: '4px',     // Default button corners
    pill: '9999px',     // Pill-shaped buttons
    icon: '6px',        // Icon buttons
  },

  input: {
    default: '4px',     // Standard input fields
    focused: '4px',     // Same on focus
  },

  card: {
    default: '6px',     // Standard cards
    elevated: '8px',    // Elevated/modal cards
    flat: '0px',        // Flat panel cards
  },

  badge: {
    default: '2px',     // Standard badges
    pill: '9999px',     // Pill badges
  },

  modal: {
    default: '8px',     // Modal dialog corners
  },

  avatar: {
    default: '9999px',  // Circular avatars
    square: '0px',      // Square avatars
    rounded: '6px',     // Slightly rounded avatars
  },

  dropdown: {
    default: '4px',     // Dropdown menu
  },

  tooltip: {
    default: '4px',     // Tooltip boxes
  },

  table: {
    cell: '0px',        // No rounding for table cells
  },

  section: {
    default: '0px',     // Sections are flat
  },

  image: {
    default: '6px',     // Rounded images
    thumbnail: '4px',   // Thumbnail images
  },

  chart: {
    default: '8px',     // Chart container
    bar: '2px',         // Bar chart bars
  },
} as const;

/**
 * Utilities for applying radius consistently
 */
export const radiusUtils = {
  /**
   * Get the radius for a component type
   */
  forComponent: (component: 'button' | 'input' | 'card' | 'badge' | 'modal' | 'avatar') => {
    return RADIUS[component].default;
  },

  /**
   * Generate Tailwind class names for responsive radius
   * @example responsiveRadius('sm', 'md', 'lg') => 'rounded-sm sm:rounded-md lg:rounded-lg'
   */
  responsive: (mobile: keyof typeof RADIUS, tablet?: keyof typeof RADIUS, desktop?: keyof typeof RADIUS) => {
    let classes = '';
    if (mobile) classes += `rounded-${mobile}`;
    if (tablet) classes += ` sm:rounded-${tablet}`;
    if (desktop) classes += ` lg:rounded-${desktop}`;
    return classes;
  },
};

/**
 * Tailwind radius configuration
 */
export const tailwindRadiusConfig = {
  none: '0px',
  sm: '2px',
  xs: '2px',
  base: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '20px',
  full: '9999px',
} as const;
