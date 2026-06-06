import { describe, expect, it } from 'vitest';
import { resolveLearnerSaveIntent } from './learnerSaveIntent';

describe('resolveLearnerSaveIntent', () => {
  it('uses the explicit target learner id for edit saves and strips transport-only fields', () => {
    const result = resolveLearnerSaveIntent(
      { firstName: 'Existing', __targetLearnerId: 'fallback-id' },
      { targetLearnerId: 'learner-123', isEdit: true }
    );

    expect(result).toEqual({
      targetLearnerId: 'learner-123',
      payload: { firstName: 'Existing' },
      missingEditId: false,
    });
  });

  it('marks edit saves without an id as invalid instead of allowing create fallback', () => {
    const result = resolveLearnerSaveIntent(
      { firstName: 'Existing' },
      { isEdit: true }
    );

    expect(result.targetLearnerId).toBeNull();
    expect(result.missingEditId).toBe(true);
  });
});
