import { buildInstalledAppName } from '../utils/pwa.util';

describe('buildInstalledAppName', () => {
  it('uses the first school-name word followed by School', () => {
    expect(buildInstalledAppName('Zawadi Junior Academy')).toBe('Zawadi School');
  });

  it('skips a leading The and still limits the label to two words', () => {
    expect(buildInstalledAppName('The Acacia Learning Centre')).toBe('Acacia School');
  });
});
