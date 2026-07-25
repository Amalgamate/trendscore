const PERCENTAGE_PRECISION = 1_000_000;

export const normalizePercentage = (percentage) => {
  if (!Number.isFinite(percentage)) return 0;

  const capped = Math.min(100, Math.max(0, percentage));
  return Math.round((capped + Number.EPSILON) * PERCENTAGE_PRECISION) / PERCENTAGE_PRECISION;
};

export const percentageFromMark = (mark, totalMarks) => {
  const numericMark = Number(mark);
  const numericTotal = Number(totalMarks);

  if (!Number.isFinite(numericMark) || !Number.isFinite(numericTotal) || numericTotal <= 0) {
    return 0;
  }

  return normalizePercentage((numericMark / numericTotal) * 100);
};
