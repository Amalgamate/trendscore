import { describe, expect, it } from 'vitest';
import { makeHelpProgressKey, readHelpProgress, writeHelpProgress } from './helpProgress';

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

describe('help progress persistence', () => {
  it('isolates progress by user, version and guide', () => {
    expect(makeHelpProgressKey('guide', 2, 'user-1', 'attendance')).toBe('trendscore:guide:v2:user-1:attendance');
  });

  it('round-trips seen and completed-step state', () => {
    const storage = memoryStorage();
    const key = makeHelpProgressKey('onboarding', 1, 'user-1', 'teacher-start');
    writeHelpProgress(storage, key, { seen: true, steps: { 0: true, 2: true } });
    expect(readHelpProgress(storage, key)).toEqual({ seen: true, steps: { 0: true, 2: true } });
  });

  it('recovers safely from malformed stored data', () => {
    const storage = { getItem: () => '{bad-json', setItem: () => {} };
    expect(readHelpProgress(storage, 'broken')).toEqual({});
  });
});
