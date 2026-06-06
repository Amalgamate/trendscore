export const resolveLearnerSaveIntent = (data = {}, options = {}, editingLearner = null) => {
  const targetLearnerId = options?.targetLearnerId
    || data?.__targetLearnerId
    || editingLearner?.id
    || data?.id
    || null;
  const { __targetLearnerId, ...payload } = data || {};

  return {
    targetLearnerId,
    payload,
    missingEditId: Boolean(options?.isEdit && !targetLearnerId),
  };
};
