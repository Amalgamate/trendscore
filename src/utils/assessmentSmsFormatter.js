const numericScore = (result) => Number(result?.score ?? result?.marksObtained ?? result?.rawScore ?? 0);
const numericMaximum = (result) => Number(result?.totalMarks ?? result?.maxScore ?? result?.test?.totalMarks ?? 0);

export const buildAssessmentSmsMetrics = (row = {}) => {
  const results = Array.isArray(row.results) ? row.results : [];
  const totalScore = results.reduce((sum, result) => sum + numericScore(result), 0);
  const totalMaximum = results.reduce((sum, result) => sum + numericMaximum(result), 0);
  const calculatedAverage = totalMaximum > 0 ? Number(((totalScore / totalMaximum) * 100).toFixed(1)) : 0;
  const averageScore = Number(row.averageScore ?? row.averagePct ?? calculatedAverage);

  if (row.subjectScores && typeof row.subjectScores === 'object') {
    return {
      averageScore,
      subjects: Object.entries(row.subjectScores).map(([name, percentage]) => ({
        name,
        percentage: Number(percentage),
        displayCode: row.subjectDisplayCodes?.[name] || null,
        missing: Boolean(row.missingSubjectScores?.[name]),
      })),
    };
  }

  const grouped = new Map();
  results.forEach((result) => {
    const name = String(result.learningArea || result.test?.learningArea || 'General').trim().toUpperCase();
    const current = grouped.get(name) || { name, score: 0, maximum: 0, displayCode: null, missing: false };
    current.score += numericScore(result);
    current.maximum += numericMaximum(result);
    if (result.assessmentStatusCode) current.displayCode = String(result.assessmentStatusCode).toUpperCase();
    grouped.set(name, current);
  });

  return {
    averageScore,
    subjects: [...grouped.values()].map(subject => ({
      name: subject.name,
      percentage: subject.maximum > 0 ? Math.round((subject.score / subject.maximum) * 100) : 0,
      displayCode: subject.displayCode,
      missing: subject.missing,
    })),
  };
};
