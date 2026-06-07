import React, { useMemo } from 'react';
import { getLearnerName, groupLearners } from './SimpleTablePage';
import { average, formatScore, getScoreTone } from './useAcademicAnalytics';

const getUniqueLearnerCount = (results) => new Set(results.map((result) => result.learnerId).filter(Boolean)).size;

const getScoreStats = (results) => {
  const scores = results.map((result) => result.percentage).filter(Number.isFinite).sort((a, b) => b - a);
  return {
    learners: getUniqueLearnerCount(results),
    records: results.length,
    average: average(scores),
    highest: scores[0] ?? null,
    lowest: scores[scores.length - 1] ?? null,
  };
};

const getGenderAverage = (results, gender) => average(
  results.filter((result) => result.gender === gender).map((result) => result.percentage)
);

const getGapText = (boysAverage, girlsAverage) => {
  if (!Number.isFinite(boysAverage) || !Number.isFinite(girlsAverage)) return '-';
  if (Math.round(boysAverage) === Math.round(girlsAverage)) return 'Level';
  return `${boysAverage > girlsAverage ? 'Boys' : 'Girls'} +${formatScore(Math.abs(boysAverage - girlsAverage))}`;
};

const getSubjectMeritRows = (results) => {
  const byLearner = new Map();
  results.forEach((result) => {
    if (!byLearner.has(result.learnerId)) {
      byLearner.set(result.learnerId, {
        id: result.learnerId,
        name: result.learnerName || getLearnerName(result.raw?.learner),
        admissionNumber: result.admissionNumber || '-',
        grade: result.grade || '-',
        className: result.className || 'Unspecified',
        scores: [],
        tests: new Set(),
      });
    }
    const learner = byLearner.get(result.learnerId);
    learner.scores.push(result.percentage);
    if (result.testTitle) learner.tests.add(result.testTitle);
  });

  return [...byLearner.values()]
    .map((learner) => ({
      ...learner,
      average: average(learner.scores),
      records: learner.scores.length,
      tests: [...learner.tests].join(', ') || '-',
    }))
    .filter((learner) => Number.isFinite(learner.average))
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name))
    .map((learner, index) => ({
      ...learner,
      position: index + 1,
    }));
};

const SectionHeader = ({ title, description, meta }) => (
  <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
    <div>
      <h2 className="text-base font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
    </div>
    {meta && (
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{meta}</span>
    )}
  </div>
);

const SubjectSummaryTable = ({ rows }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <SectionHeader
      title="Subject Performance"
      description="Subject-level performance for the selected grade, class, term and test type."
      meta={`${rows.length} subjects`}
    />
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-left">Subject</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Learners</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Records</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Average</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Highest</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Lowest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.subject} className="hover:bg-slate-50">
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 font-semibold text-slate-800">{row.subject}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-black text-slate-900">{row.learners}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-semibold text-slate-700">{row.records}</td>
              <td className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-black ${getScoreTone(row.average)}`}>{formatScore(row.average)}</td>
              <td className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-bold ${getScoreTone(row.highest)}`}>{formatScore(row.highest)}</td>
              <td className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-bold ${getScoreTone(row.lowest)}`}>{formatScore(row.lowest)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const ClassSubjectPerformanceTable = ({ rows }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <SectionHeader
      title="Class Subject Performance"
      description="Performance per subject within each selected class, including boys and girls averages."
      meta={`${rows.length} class rows`}
    />
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-left">Subject</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Grade</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Class</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Learners</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Class Avg</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Boys Avg</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Girls Avg</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.subject}-${row.grade}-${row.className}`} className="hover:bg-slate-50">
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 font-semibold text-slate-800">{row.subject}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-semibold text-slate-700">{row.grade}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-semibold text-slate-700">{row.className}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-black text-slate-900">{row.learners}</td>
              <td className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-black ${getScoreTone(row.average)}`}>{formatScore(row.average)}</td>
              <td className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-bold ${getScoreTone(row.boysAverage)}`}>{formatScore(row.boysAverage)}</td>
              <td className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-bold ${getScoreTone(row.girlsAverage)}`}>{formatScore(row.girlsAverage)}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-bold text-slate-700">{row.gap}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const SubjectMeritTable = ({ table }) => (
  <section className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{table.subject}</h2>
        <p className="text-xs font-semibold text-slate-500">{table.grade} • {table.className}</p>
      </div>
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{table.rows.length} learners</span>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Pos</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-left">Learner</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Adm No.</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Grade</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Class</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Score</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Records</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-left">Tests</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-black text-slate-900">{row.position}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 font-semibold text-slate-800">{row.name}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-semibold text-slate-700">{row.admissionNumber}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-semibold text-slate-700">{row.grade}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-semibold text-slate-700">{row.className}</td>
              <td className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-black ${getScoreTone(row.average)}`}>
                {formatScore(row.average)}
              </td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-semibold text-slate-700">{row.records}</td>
              <td className="min-w-[220px] border-b border-r border-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">{row.tests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const SubjectIntelligence = ({ academicFilters, analytics }) => {
  const report = useMemo(() => {
    const selectedSubject = academicFilters?.subject || 'all';
    const results = (analytics?.results || [])
      .filter((result) => Number.isFinite(result.percentage))
      .filter((result) => selectedSubject === 'all' || result.subjectKey === selectedSubject);

    const subjectRows = groupLearners(results, (result) => result.subject || 'Unspecified Subject')
      .map((subjectGroup) => ({
        subject: subjectGroup.label,
        ...getScoreStats(subjectGroup.records),
      }))
      .sort((a, b) => b.average - a.average || a.subject.localeCompare(b.subject));

    const classRows = groupLearners(results, (result) => result.subject || 'Unspecified Subject')
      .flatMap((subjectGroup) => (
        groupLearners(subjectGroup.records, (result) => result.grade || '-')
          .flatMap((gradeGroup) => (
            groupLearners(gradeGroup.records, (result) => result.className || 'Unspecified')
              .map((classGroup) => {
                const stats = getScoreStats(classGroup.records);
                const boysAverage = getGenderAverage(classGroup.records, 'Boys');
                const girlsAverage = getGenderAverage(classGroup.records, 'Girls');

                return {
                  subject: subjectGroup.label,
                  grade: gradeGroup.label,
                  className: classGroup.label,
                  ...stats,
                  boysAverage,
                  girlsAverage,
                  gap: getGapText(boysAverage, girlsAverage),
                };
              })
          ))
      ))
      .sort((a, b) => (
        a.subject.localeCompare(b.subject)
        || a.grade.localeCompare(b.grade, undefined, { numeric: true })
        || a.className.localeCompare(b.className, undefined, { numeric: true })
      ));

    const meritTables = groupLearners(results, (result) => result.subject || 'Unspecified Subject')
      .flatMap((subjectGroup) => (
        groupLearners(subjectGroup.records, (result) => result.grade || '-')
          .flatMap((gradeGroup) => (
            groupLearners(gradeGroup.records, (result) => result.className || 'Unspecified')
              .map((classGroup) => ({
                subject: subjectGroup.label,
                grade: gradeGroup.label,
                className: classGroup.label,
                rows: getSubjectMeritRows(classGroup.records),
              }))
          ))
      ))
      .filter((table) => table.rows.length)
      .sort((a, b) => (
        a.subject.localeCompare(b.subject)
        || a.grade.localeCompare(b.grade, undefined, { numeric: true })
        || a.className.localeCompare(b.className, undefined, { numeric: true })
      ));

    return { subjectRows, classRows, meritTables };
  }, [academicFilters, analytics]);

  if (!report.meritTables.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
        No learner subject performance records available for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SubjectSummaryTable rows={report.subjectRows} />
      <ClassSubjectPerformanceTable rows={report.classRows} />
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Learner Merit List"
          description="Learners ranked by selected subject performance for each grade and class."
          meta={`${report.meritTables.length} tables`}
        />
        <div className="space-y-8">
          {report.meritTables.map((table) => (
            <SubjectMeritTable key={`${table.subject}-${table.grade}-${table.className}`} table={table} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default SubjectIntelligence;
