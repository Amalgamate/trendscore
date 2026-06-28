import { ApiError } from './error.util';

export interface NormalizedPhone {
  raw: string;
  digits: string;
  e164: string;
  local: string;
}

export const normalizeKenyanPhone = (phone: string): NormalizedPhone => {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');

  let core = '';
  if (digits.startsWith('254') && digits.length === 12) {
    core = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    core = digits.slice(1);
  } else if (digits.length === 9) {
    core = digits;
  }

  if (!/^[17]\d{8}$/.test(core)) {
    throw new ApiError(400, 'Invalid Kenyan phone number');
  }

  return {
    raw,
    digits: `254${core}`,
    e164: `+254${core}`,
    local: `0${core}`,
  };
};

export const getKenyanPhoneLookupCandidates = (phone: string): string[] => {
  const normalized = normalizeKenyanPhone(phone);
  return Array.from(new Set([
    normalized.e164,
    normalized.digits,
    normalized.local,
    normalized.raw,
  ].filter(Boolean)));
};
