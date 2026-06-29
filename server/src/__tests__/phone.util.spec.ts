import { normalizeKenyanPhone, getKenyanPhoneLookupCandidates } from '../utils/phone.util';

describe('phone.util', () => {
  it.each([
    ['0712345678', '+254712345678', '254712345678', '0712345678'],
    ['712345678', '+254712345678', '254712345678', '0712345678'],
    ['254712345678', '+254712345678', '254712345678', '0712345678'],
    ['+254 712 345 678', '+254712345678', '254712345678', '0712345678'],
    ['0112345678', '+254112345678', '254112345678', '0112345678'],
  ])('normalizes %s', (input, e164, digits, local) => {
    expect(normalizeKenyanPhone(input)).toMatchObject({ raw: input, e164, digits, local });
  });

  it('returns lookup candidates for common stored formats', () => {
    expect(getKenyanPhoneLookupCandidates('0712345678')).toEqual([
      '+254712345678',
      '254712345678',
      '0712345678',
    ]);
  });

  it('rejects non-Kenyan or invalid phone numbers', () => {
    expect(() => normalizeKenyanPhone('123')).toThrow('Invalid Kenyan phone number');
    expect(() => normalizeKenyanPhone('+255712345678')).toThrow('Invalid Kenyan phone number');
  });
});
