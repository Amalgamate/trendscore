import React, { useMemo } from 'react';
import { average, formatScore, getScoreTone, SUBJECT_CATEGORIES } from './useAcademicAnalytics';

const GENDER_ROWS = ['Boys', 'Girls', 'Unspecified'];

const getGenderRows = ({ learners = [], results = [], getScores }) => (
  GENDER_ROWS.map((gender) => {
    const genderLearners = learners.filter((learner) => learner.gender === gender);
    const genderResults = results.filter((result) => result.gender === gender);
    const scores = getScores(genderResults);
    const sortedScores = scores.filter(Number.isFinite).sort((a, b) => b - a);

    return {
      gender,
      learners: genderLearners.length || new Set(genderResults.map((result) => result.learnerId).filter(Boolean)).size,
      records: genderResults.length,
      average: average(scores),
      highest: sortedScores[0] ?? null,
      lowest: sortedScores[sortedScores.length - 1] ?? null,
    };
  }).filter((row) => row.learners || row.records || row.gender !== 'Unspecified')
);

const getLeaderText = (rows) => {
  const boys = rows.find((row) => row.gender === 'Boys')?.average;
  const girls = rows.find((row) => row.gender === 'Girls')?.average;
  if (!Number.isFinite(boys) || !Number.isFinite(girls)) return 'Gap unavailable';
  if (Math.round(boys) === Math.round(girls)) return 'Boys and girls are level';
  const gap = Math.abs(boys - girls);
  return `${boys > girls ? 'Boys' : 'Girls'} lead by ${formatScore(gap)}`;
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

const ClassPerformanceTable = ({ rows }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <SectionHeader
      title="Class Performance"
      description="Boys and girls comparison across the whole selected class or grade."
      meta={getLeaderText(rows)}
    />
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-left">Gender</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Learners</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Records</th>
            {SUBJECT_CATEGORIES.map((section) => (
              <th key={section.key} className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">
                {section.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.gender} className="hover:bg-slate-50">
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 font-semibold text-slate-800">{row.gender}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-black text-slate-900">{row.learners}</td>
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-semibold text-slate-700">{row.records}</td>
              {SUBJECT_CATEGORIES.map((section) => (
                <td
                  key={`${row.gender}-${section.key}`}
                  className={`whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center font-bold ${getScoreTone(row[section.key])}`}
                >
                  {formatScore(row[section.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const SubjectPerformanceTable = ({ rows, subjectLabel }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <SectionHeader
      title="Selected Subject Performance"
      description="Boys and girls comparison for the selected subject in the current class or grade."
      meta={subjectLabel}
    />
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-left">Gender</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Learners</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Records</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Average</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Highest</th>
            <th className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 text-center">Lowest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.gender} className="hover:bg-slate-50">
              <td className="whitespace-nowrap border-b border-r border-slate-100 px-4 py-3 font-semibold text-slate-800">{row.gender}</td>
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

const GenderAnalysis = ({ academicFilters, analytics }) => {
  const report = useMemo(() => {
    const results = (analytics?.results || []).filter((result) => Number.isFinite(result.percentage));
    const learners = analytics?.learners || [];
    const selectedSubject = academicFilters?.subject || 'all';
    const subjectRecords = selectedSubject === 'all'
      ? results
      : results.filter((result) => result.subjectKey === selectedSubject);
    const selectedSubjectLabel = selectedSubject === 'all'
      ? 'All subjects'
      : subjectRecords[0]?.subject || 'Selected subject';

    const classRows = getGenderRows({
      learners,
      results,
      getScores: (records) => records.map((result) => result.percentage),
    }).map((row) => {
      const genderRecords = results.filter((result) => result.gender === row.gender);
      const sectionScores = SUBJECT_CATEGORIES.reduce((acc, section) => ({
        ...acc,
        [section.key]: average(genderRecords
          .filter((result) => section.key === 'overall' || result.category === section.key)
          .map((result) => result.percentage)),
      }), {});

      return { ...row, ...sectionScores };
    });

    const subjectRows = getGenderRows({
      learners: [],
      results: subjectRecords,
      getScores: (records) => records.map((result) => result.percentage),
    });

    return { classRows, subjectRows, selectedSubjectLabel };
  }, [academicFilters, analytics]);

  return (
    <div className="space-y-4">
      <ClassPerformanceTable rows={report.classRows} />
      <SubjectPerformanceTable rows={report.subjectRows} subjectLabel={report.selectedSubjectLabel} />
      {!report.subjectRows.some((row) => row.records) && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-500">
          No subject records available for the selected subject, class and grade filters.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Class Gap</p>
          <p className="mt-2 text-xl font-black text-slate-950">{getLeaderText(report.classRows)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Subject Gap</p>
          <p className="mt-2 text-xl font-black text-slate-950">{getLeaderText(report.subjectRows)}</p>
        </div>
      </div>
    </div>
  );
};

export default GenderAnalysis;
