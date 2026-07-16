import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const sourceDir = path.resolve(process.cwd(), 'mck');

const files = [
  { filename: '1B_014939.xlsx', grade: 'GRADE_1', stream: 'B', sheet: 'Sheet1' },
  { filename: 'G4A  Midterm term2 2026.xlsx', grade: 'GRADE_4', stream: 'A', sheet: '4A' },
  { filename: 'GRADE 1 B 2026_101120.xlsx', grade: 'GRADE_1', stream: 'B', sheet: 'Sheet1' },
  { filename: 'GRADE 2B RESULTS.xlsx', grade: 'GRADE_2', stream: 'B', sheet: 'Sheet1' },
  { filename: 'GRADE 3AMID TERM EXAM_024959.xlsx', grade: 'GRADE_3', stream: 'A', sheet: 'Sheet1' },
  { filename: 'GRADE 6 TERM 2MID RESULTS.xlsx', grade: 'GRADE_6', stream: 'A', sheet: 'Sheet1' },
  { filename: 'MID-TERM EXAM.xlsx', grade: 'PLAYGROUP', stream: 'A', sheet: 'Sheet1' },
  { filename: 'P.G (B)MIDTERM 2ND TERM EXAM RESULTS.xlsx', grade: 'PLAYGROUP', stream: 'B', sheet: 'Sheet1' },
  { filename: 'PP1 B  MIDTERM EXAMS (1) (1) (2).xlsx', grade: 'PP1', stream: 'B', sheet: 'Sheet1' },
  { filename: 'PP2 (B) MIDTERM EXAM.xlsx', grade: 'PP2', stream: 'B', sheet: 'Sheet2' },
];

const asText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return String(value.text ?? value.result ?? '');
  return String(value);
};

const normalize = (value) => asText(value).replace(/[\s\u00a0]+/g, ' ').trim().toUpperCase();
const isHeaderRow = (values) => {
  const joined = values.map(normalize).join(' ');
  return (joined.includes('NAME') || joined.includes('NAMES')) &&
    (joined.includes('MATH') || joined.includes('ENG') || joined.includes('KISW') || joined.includes('LANG'));
};

async function auditFile(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(sourceDir, file.filename));
  const worksheet = workbook.getWorksheet(file.sheet);
  if (!worksheet) throw new Error(`Sheet ${file.sheet} was not found`);

  const rows = [];
  worksheet.eachRow({ includeEmpty: true }, (row, number) => rows.push({
    number,
    values: row.values.slice(1).map(asText),
  }));

  const evidence = rows.slice(0, 3).flatMap((row) => row.values).filter(Boolean).join(' ');
  const normalizedEvidence = normalize(evidence);
  let header = rows.find((row) => isHeaderRow(row.values));
  if (!header && file.filename.startsWith('PP1 B')) {
    header = rows.find((row) => {
      const joined = row.values.map(normalize).join(' ');
      return joined.includes('MATH') && joined.includes('LANG') && joined.includes('READ');
    });
  }
  if (!header) throw new Error('No score header row found');

  const nameIndex = header.values.findIndex((value) => ['NAME', 'NAMES'].includes(normalize(value)));
  const resolvedNameIndex = nameIndex >= 0 ? nameIndex : 1;
  const subjectHeaders = header.values
    .map((value, index) => ({ value: normalize(value), index }))
    .filter(({ value }) => value && !['NAME', 'NAMES', 'S/N', 'SN', 'NO', 'NO.', 'TOTAL', 'TOTALS', 'POSITION', 'POS', 'POST'].includes(value));

  const learnerRows = rows
    .filter((row) => row.number > header.number)
    .filter((row) => {
      const name = normalize(row.values[resolvedNameIndex]);
      return name && !['TOTAL', 'TOTALS', 'POSITION', 'AVERAGE', 'MEAN SCORE', 'MEAN SCORES'].includes(name);
    });

  const scoreCount = learnerRows.reduce((total, row) => total + subjectHeaders.reduce((scores, { index }) =>
    scores + (Number.isFinite(Number(row.values[index])) ? 1 : 0), 0), 0);

  const isOpener = normalizedEvidence.includes('OPENER');
  const isMidterm = normalizedEvidence.includes('MID TERM') || normalizedEvidence.includes('MID-TERM') || normalizedEvidence.includes('MIDTERM');
  const hasTerm2 = normalizedEvidence.includes('TERM 2') || normalizedEvidence.includes('TERM TWO') || normalizedEvidence.includes('2ND TERM') || normalizedEvidence.includes('MID TERM2') || normalizedEvidence.includes('MID-TERM 2');
  const has2026 = normalizedEvidence.includes('2026');
  const classification = isOpener
    ? 'exclude_opener'
    : isMidterm && hasTerm2 && has2026
      ? 'confirmed_term_2_midterm'
      : isMidterm
        ? 'needs_confirmation'
        : 'exclude_unclassified';

  return {
    ...file,
    classification,
    evidence: evidence.replace(/\s+/g, ' ').trim(),
    learnerCount: learnerRows.length,
    scoreCount,
    subjectHeaders: subjectHeaders.map(({ value }) => value),
  };
}

async function main() {
  const audit = await Promise.all(files.map(auditFile));
  const summary = audit.reduce((acc, item) => {
    acc[item.classification] ??= { files: 0, learners: 0, scores: 0 };
    acc[item.classification].files += 1;
    acc[item.classification].learners += item.learnerCount;
    acc[item.classification].scores += item.scoreCount;
    return acc;
  }, {});
  console.log(JSON.stringify({ summary, files: audit }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
