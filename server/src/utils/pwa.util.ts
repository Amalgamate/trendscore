import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';

/** Keep the installed shortcut label short and recognisable. */
export const buildInstalledAppName = (schoolName: string | null | undefined): string => {
  const words = String(schoolName || PRODUCT_DISPLAY_NAME).trim().split(/\s+/).filter(Boolean);
  const candidate = words[0]?.toLowerCase() === 'the' && words[1] ? words[1] : words[0];
  const firstName = String(candidate || PRODUCT_DISPLAY_NAME).replace(/[^\p{L}\p{N}'-]/gu, '') || PRODUCT_DISPLAY_NAME;
  return `${firstName} School`;
};
