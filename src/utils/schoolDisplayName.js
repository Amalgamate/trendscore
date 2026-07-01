import { LEGACY_BRAND_NAMES, PRODUCT_DISPLAY_NAME } from '../config/productIdentity';

const PRODUCT_DEFAULT_NAMES = new Set([
  PRODUCT_DISPLAY_NAME.toLowerCase(),
  PRODUCT_DISPLAY_NAME.replace(/\s+/g, '').toLowerCase(),
  'trendscore v1.0',
  'trendscorev1.0',
  'trend score v1.0',
  'trends core v1.0',
  ...LEGACY_BRAND_NAMES,
]);

const normalizeComparableName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const isProductDefaultSchoolName = (value) => {
  const normalized = normalizeComparableName(value);
  if (!normalized) return false;
  return PRODUCT_DEFAULT_NAMES.has(normalized) || PRODUCT_DEFAULT_NAMES.has(normalized.replace(/\s+/g, ''));
};

export const getExplicitSchoolName = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed || isProductDefaultSchoolName(trimmed)) return '';
  return trimmed;
};

export const getSchoolDisplayName = (...values) => {
  let fallback = PRODUCT_DISPLAY_NAME;
  const names = values;
  const last = names[names.length - 1];

  if (last && typeof last === 'object' && !Array.isArray(last)) {
    fallback = last.fallback || fallback;
    names.pop();
  }

  for (const value of names) {
    const explicitName = getExplicitSchoolName(value);
    if (explicitName) return explicitName;
  }

  return fallback;
};
