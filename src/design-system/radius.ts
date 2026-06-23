/**
 * TrendSCORE Border Radius System
 * Base unit: 0.5rem (8px) — matches --radius in index.css and tailwind.config.
 * All component-specific values are derived from this scale.
 * To retheme globally, update --radius in :root (index.css) AND the base values here.
 */

export const RADIUS = {
  // Base radius scale
  none: '0px',
  xs:   '2px',    // Minimal — icon accents, chart bars
  sm:   '4px',    // Small — badge labels, tab triggers
  md:   '6px',    // Medium — selects, dropdowns, small buttons
  lg:   '8px',    // Standard — cards, inputs, default buttons (= --radius)
  xl:   '12px',   // Large — modals, drawers, large cards
  '2xl': '16px',  // Extra large — mobile sheets, hero panels
  '3xl': '20px',  // Maximum panel rounding
  full: '9999px', // Pill — avatars, badges, status chips

  // Component-specific (aligned to base scale above)
  button: {
    default: '8px',     // Matches rounded-lg → --radius
    pill:    '9999px',  // Pill variant
    icon:    '8px',     // Icon buttons
  },

  input: {
    default: '8px',     // Matches rounded-lg → --radius
    focused: '8px',
  },

  card: {
    default:  '8px',    // Standard content cards
    elevated: '12px',   // Modal/drawer cards
    flat:     '8px',    // Flat surface panels
  },

  badge: {
    default: '4px',     // Rectangular badge
    pill:    '9999px',  // Pill badge (StatusBadge, RubricBadge)
  },

  modal: {
    default: '12px',    // Dialogs / bottom sheets
  },

  avatar: {
    default: '9999px',  // Circular
    square:  '0px',
    rounded: '8px',     // Slightly rounded square avatar
  },

  dropdown: {
    default: '8px',     // Dropdown / popover menus
  },

  tooltip: {
    default: '6px',
  },

  table: {
    cell:      '0px',   // Table cells stay sharp
    container: '8px',   // Outer table wrapper
  },

  section: {
    default: '8px',
  },

  image: {
    default:   '8px',
    thumbnail: '6px',
  },

  chart: {
    default: '8px',     // Chart container
    bar:     '4px',     // Bar chart top corners
    tooltip: '8px',     // Recharts tooltip (matches hardcoded 8px in Dashboard)
  },
} as const;

/**
 * Utilities for applying radius consistently
 */
export const radiusUtils = {
  forComponent: (component: 'button' | 'input' | 'card' | 'badge' | 'modal' | 'avatar') => {
    return RADIUS[component].default;
  },

  responsive: (mobile: keyof typeof RADIUS, tablet?: keyof typeof RADIUS, desktop?: keyof typeof RADIUS) => {
    let classes = '';
    if (mobile) classes += `rounded-${mobile}`;
    if (tablet) classes += ` sm:rounded-${tablet}`;
    if (desktop) classes += ` lg:rounded-${desktop}`;
    return classes;
  },
};

/**
 * Tailwind radius config export (mirrors tailwind.config.js borderRadius values)
 */
export const tailwindRadiusConfig = {
  none:  '0px',
  xs:    '2px',
  sm:    '4px',
  md:    '6px',
  lg:    '8px',    // = --radius base
  xl:    '12px',
  '2xl': '16px',
  '3xl': '20px',
  full:  '9999px',
} as const;
