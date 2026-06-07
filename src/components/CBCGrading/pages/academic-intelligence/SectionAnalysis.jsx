import React, { useMemo } from 'react';
import { getLearningAreasByGrade } from '../../../../constants/learningAreas';
import { average, getScoreTone } from './useAcademicAnalytics';

const SECTION_GROUPS = [
  { key: 'pre-primary', title: 'Pre Primary', grades: ['PP1', 'PP2'] },
  { key: 'lower', title: 'Lower Primary', grades: ['Grade 1', 'Grade 2', 'Grade 3'] },
  { key: 'upper', title: 'Upper Primary', grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
  { key: 'junior-sec', title: 'Junior Sec', grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
];

const normalizeValue = (value) => String(value || '').trim().toLowerCase();

const normalizeSubject = (value) => normalizeValue(value).replace(/&/g, 'and').replace(/\s+/g, ' ');

const normalizeGradeNumber = (grade) => {
  const value = normalizeValue(grade);
  if (value.includes('playgroup')) return 0;
  if (value.includes('pp1')) return -2;
  if (value.includes('pp2')) return -1;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const normalizeGradeLabel = (grade) => {
  const gradeNumber = normalizeGradeNumber(grade);
  if (gradeNumber === -2) return 'PP1';
  if (gradeNumber === -1) return 'PP2';
  if (gradeNumber > 0) return `Grade ${gradeNumber}`;
  return String(grade || 'Unspecified');
};

const compactGradeLabel = (grade) => {
  const gradeNumber = normalizeGradeNumber(grade);
  if (gradeNumber === -2) return 'PP1';
  if (gradeNumber === -1) return 'PP2';
  if (gradeNumber > 0) return `G${gradeNumber}`;
  return grade;
};

const getSectionFromGrade = (grade) => {
  const gradeNumber = normalizeGradeNumber(grade);
  if (gradeNumber === -2 || gradeNumber === -1) return 'pre-primary';
  if (gradeNumber >= 1 && gradeNumber <= 3) return 'lower';
  if (gradeNumber >= 4 && gradeNumber <= 6) return 'upper';
  if (gradeNumber >= 7 && gradeNumber <= 9) return 'junior-sec';
  return 'unspecified';
};

const getSubjectAverage = (results, grade, subject) => average(results
  .filter((result) => normalizeGradeLabel(result.grade) === grade)
  .filter((result) => normalizeSubject(result.subject) === normalizeSubject(subject))
  .map((result) => result.percentage));

const getLeader = (row, grades) => {
  const ranked = grades
    .map((grade) => ({ grade, score: Number(row[grade]) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);

  return ranked[0] ? compactGradeLabel(ranked[0].grade) : '-';
};

const getSubjectsForGrades = (grades) => {
  const subjects = new Set();
  grades.forEach((grade) => {
    getLearningAreasByGrade(grade).forEach((subject) => subjects.add(subject));
  });
  return [...subjects];
};

const SectionTable = ({ section }) => (
  <section className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
    <h2 className="mb-3 text-lg font-bold text-slate-950">{section.title}</h2>
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-sm font-bold text-slate-900">
            <th className="w-[26%] py-3 pr-4">Subject</th>
            {section.grades.map((grade) => (
              <th key={grade} className="py-3 px-4 text-center">{compactGradeLabel(grade)}</th>
            ))}
            <th className="py-3 pl-4 text-left">Leader</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={`${section.key}-${row.subject}`} className="border-b border-slate-100 last:border-b-0">
              <td className="py-3 pr-4 font-semibold text-slate-950">{row.subject}</td>
              {section.grades.map((grade) => (
                <td key={grade} className={`py-3 px-4 text-center font-bold ${getScoreTone(row[grade])}`}>
                  {row[grade]}
                </td>
              ))}
              <td className="py-3 pl-4 font-bold text-slate-950">{row.leader}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const SectionAnalysis = ({ analytics, academicFilters = {} }) => {
  const sections = useMemo(() => {
    const results = (analytics?.results || []).filter((result) => Number.isFinite(result.percentage));
    const activeSection = academicFilters.section || 'all';

    return SECTION_GROUPS
      .filter((section) => activeSection === 'all' || section.key === activeSection)
      .map((section) => {
        const sectionResults = results.filter((result) => getSectionFromGrade(result.grade) === section.key);
        const resultSubjects = [...new Set(sectionResults.map((result) => result.subject).filter(Boolean))];
        const subjects = resultSubjects.length ? resultSubjects.sort() : getSubjectsForGrades(section.grades);
        const rows = subjects.map((subject) => {
          const row = { subject };
          section.grades.forEach((grade) => {
            const score = getSubjectAverage(sectionResults, grade, subject);
            row[grade] = Number.isFinite(score) ? Math.round(score) : '-';
          });
          row.leader = getLeader(row, section.grades);
          return row;
        });

        return { ...section, rows };
      });
  }, [academicFilters, analytics]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-8">
        {sections.map((section) => (
          <SectionTable key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
};

export default SectionAnalysis;
