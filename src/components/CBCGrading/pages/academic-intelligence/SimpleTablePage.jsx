import React from 'react';

export const getLearnerName = (learner) => {
  const parts = [
    learner?.firstName,
    learner?.middleName,
    learner?.lastName,
  ].filter(Boolean);
  return learner?.name || learner?.fullName || parts.join(' ') || learner?.admissionNumber || 'Unnamed learner';
};

export const getLearnerStream = (learner) => learner?.stream || learner?.className || learner?.section || 'Unspecified';

export const getLearnerClass = (learner) => learner?.stream || learner?.className || learner?.section || learner?.class || 'Unspecified';

export const getLearnerGrade = (learner) => learner?.grade || learner?.classGrade || learner?.level || 'Unspecified';

const normalizeFilterValue = (value) => String(value || '').toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');

const getGradeNumber = (grade) => {
  const value = String(grade || '').trim().toLowerCase();
  if (value.includes('playgroup')) return 0;
  if (value.includes('pp1')) return -2;
  if (value.includes('pp2')) return -1;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
};

export const getLearnerSection = (learner) => {
  const gradeNumber = getGradeNumber(getLearnerGrade(learner));
  if (gradeNumber === 0 || gradeNumber === -2 || gradeNumber === -1) return 'pre-primary';
  if (gradeNumber >= 1 && gradeNumber <= 3) return 'lower';
  if (gradeNumber >= 4 && gradeNumber <= 6) return 'upper';
  if (gradeNumber >= 7 && gradeNumber <= 9) return 'junior-sec';
  return 'unspecified';
};

export const filterLearnersByAcademicFilters = (learners, filters = {}) => {
  const learnerList = Array.isArray(learners) ? learners : [];
  return learnerList.filter((learner) => {
    const matchesSection = !filters.section || filters.section === 'all' || getLearnerSection(learner) === filters.section;
    const matchesGrade = !filters.grade || filters.grade === 'all' || normalizeFilterValue(getLearnerGrade(learner)) === filters.grade;
    const matchesClass = !filters.classScope || filters.classScope === 'all' || normalizeFilterValue(getLearnerClass(learner)) === filters.classScope;
    return matchesSection && matchesGrade && matchesClass;
  });
};

export const normalizeGender = (value) => {
  const gender = String(value || '').trim().toLowerCase();
  if (['m', 'male', 'boy', 'boys'].includes(gender)) return 'Boys';
  if (['f', 'female', 'girl', 'girls'].includes(gender)) return 'Girls';
  return 'Unspecified';
};

export const uniqueCount = (items) => new Set(items.filter(Boolean)).size;

export const groupLearners = (learners, getKey) => {
  const groups = new Map();
  learners.forEach((learner) => {
    const key = getKey(learner) || 'Unspecified';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(learner);
  });
  return [...groups.entries()]
    .map(([label, records]) => ({ label, records, count: records.length }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
};

const TableEmpty = ({ colSpan, message }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
      {message}
    </td>
  </tr>
);

const getCellTone = (value) => {
  const score = Number(String(value ?? '').match(/\d+(\.\d+)?/)?.[0]);
  if (!String(value ?? '').includes('%') || !Number.isFinite(score)) return '';
  if (score >= 70) return 'bg-emerald-50 text-emerald-700';
  if (score >= 60) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
};

const SimpleTablePage = ({ columns, rows, emptyMessage = 'No records available.' }) => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key}
                className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 ${index === 0 ? 'text-left' : 'text-center'}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id || `${row.label || row.name || 'row'}-${index}`} className="hover:bg-slate-50">
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key}
                  className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 font-semibold ${
                    columnIndex === 0 ? 'text-left text-slate-800' : `text-center ${getCellTone(row[column.key]) || 'text-slate-700'}`
                  }`}
                >
                  {row[column.key] ?? '-'}
                </td>
              ))}
            </tr>
          )) : (
            <TableEmpty colSpan={columns.length} message={emptyMessage} />
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default SimpleTablePage;
