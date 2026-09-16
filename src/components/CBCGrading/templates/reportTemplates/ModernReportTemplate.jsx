import React from 'react';
import { ASSESSMENT_STATUS_CODES, CBE_GRADE_LEGEND } from '../../../../utils/cbeGrading';
import PathwayPredictionPage from '../PathwayPredictionPage';
import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';

/**
 * ModernReportTemplate — "MODERN EDITION"
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 6 (Initial Report Templates)
 *
 * Second design registered in `reportTemplates/registry.js` under the key
 * "modern". A sidebar-led dashboard layout, distinct from the "classic"
 * (TermlyReportTemplate.jsx, CORPORATE EDITION) full-width table layout —
 * same underlying data, different presentation, per Decision D2.
 *
 * Consumes exactly the `reportData` prop documented in
 * `reportTemplates/types.js` — no new fields required. It additionally
 * renders `reportData.attendance` (the CORPORATE EDITION template does not),
 * which is safe: that field already exists on every `TermlyReportData`
 * object (report.service.ts) whether or not a template chooses to show it.
 *
 * Same DOM/A4-page/html2canvas conventions as the existing template
 * (ER-006): each page is a real 794×1123px node, letterhead rendered
 * inline, root element carries the `id` prop for simplePdfGenerator.js to
 * capture.
 */
const ModernReportTemplate = ({ reportData, id = 'termly-report-content' }) => {
    if (!reportData) return null;

    const brandColor = reportData.brandColor || '#0f766e'; // Teal default — distinct from classic's navy
    const attendance = reportData.attendance;
    const subjects = reportData.summative?.summary?.bySubject || [];
    const categoryAverages = reportData.summative?.summary?.byCategoryAverages || [];

    const pageStyle = {
        width: '794px',
        minHeight: '1123px',
        boxSizing: 'border-box',
        position: 'relative',
        border: '1px solid #eee'
    };

    return (
        <div id={id} className="bg-gray-100 pb-10 print:p-0 print:bg-white">
            {/* PAGE 1: PROFILE + ACADEMIC PERFORMANCE */}
            <div className="bg-white text-gray-900 font-sans mx-auto shadow-sm print:shadow-none mb-4 print:mb-0 flex" style={pageStyle}>
                {/* SIDEBAR */}
                <div className="w-[230px] shrink-0 p-6 text-white flex flex-col" style={{ backgroundColor: brandColor }}>
                    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-md mb-4">
                        {reportData.logoUrl && reportData.logoUrl !== '/branding/logo.png' ? (
                            <img src={reportData.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <img src="/branding/logo.png" alt="Logo" className="max-w-full max-h-full object-contain" />
                        )}
                    </div>
                    <h1 className="text-lg font-bold leading-tight mb-1">{reportData.schoolName || 'ACADEMIC SCHOOL'}</h1>
                    <p className="text-[10px] opacity-80 mb-6">{reportData.schoolAddress || 'P.O. Box 1234, Nairobi, Kenya'}</p>

                    <div className="bg-white/10 rounded-lg p-3 mb-3">
                        <p className="text-[9px] uppercase tracking-widest opacity-70 mb-1">Learner</p>
                        <p className="text-sm font-semibold leading-tight">{reportData.learner.firstName} {reportData.learner.lastName}</p>
                        <p className="text-[10px] opacity-80 mt-1">{reportData.learner.admissionNumber}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 mb-3">
                        <p className="text-[9px] uppercase tracking-widest opacity-70 mb-1">Grade</p>
                        <p className="text-sm font-semibold">{reportData.learner.grade?.replace('_', ' ')}{reportData.learner.stream ? ` — ${reportData.learner.stream}` : ''}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 mb-3">
                        <p className="text-[9px] uppercase tracking-widest opacity-70 mb-1">Term</p>
                        <p className="text-sm font-semibold">{reportData.term?.replace('_', ' ') || 'Term'} · {reportData.academicYear || ''}</p>
                    </div>

                    {attendance && (
                        <div className="bg-white/10 rounded-lg p-3 mb-3">
                            <p className="text-[9px] uppercase tracking-widest opacity-70 mb-1">Attendance</p>
                            <p className="text-2xl font-bold leading-none">{attendance.attendancePercentage ?? 0}%</p>
                            <p className="text-[9px] opacity-70 mt-1">{attendance.present ?? 0} present / {attendance.totalDays ?? 0} days</p>
                        </div>
                    )}

                    <div className="mt-auto pt-4">
                        {reportData.schoolStamp ? (
                            <img src={reportData.schoolStamp} alt="Stamp" className="w-14 h-14 object-contain opacity-90 bg-white rounded-full p-1" />
                        ) : null}
                        <p className="text-[8px] opacity-60 mt-3 leading-relaxed">
                            TEL: {reportData.schoolPhone || '+254 700 000000'}<br />
                            EMAIL: {reportData.schoolEmail || 'info@school.ac.ke'}
                        </p>
                    </div>
                </div>

                {/* MAIN COLUMN */}
                <div className="flex-1 p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-bold uppercase tracking-tight" style={{ color: brandColor }}>Termly Progress Report</h2>
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest text-white" style={{ backgroundColor: brandColor }}>
                            {reportData.overallPerformance?.overallGrade || reportData.overallPerformance?.grade || 'In Progress'}
                        </span>
                    </div>

                    {/* PERFORMANCE CARDS TABLE */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Learning Area</th>
                                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-500 w-24">Score</th>
                                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-500 w-24">Level</th>
                                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-500 w-24">Grade</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {subjects.map((subject, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-2 text-sm font-medium text-gray-700">{subject.subject}</td>
                                        <td className="px-4 py-2 text-center text-sm text-gray-600">{subject.averagePercentage}%</td>
                                        <td className="px-4 py-2 text-center text-sm text-gray-600">{subject.achievementLevel ?? '-'}</td>
                                        <td className="px-4 py-2 text-center">
                                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: brandColor }}>
                                                {subject.cbcGrade || subject.grade}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 9 - subjects.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="h-8"><td /><td /><td /><td /></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {categoryAverages.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {categoryAverages.map((row, idx) => (
                                <div key={`${row.category}-${idx}`} className="rounded-xl border border-gray-200 p-3 text-center bg-gray-50">
                                    <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest">{row.category}</p>
                                    <p className="text-xl font-bold text-gray-900 mt-0.5">{row.averagePercentage}%</p>
                                    <p className="text-[10px] font-semibold mt-0.5" style={{ color: brandColor }}>{row.grade}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-4 text-[9px] text-gray-600">
                        <div className="rounded-xl border border-gray-200 p-3">
                            <p className="font-semibold uppercase tracking-widest text-gray-500 mb-1.5">CBE Achievement Legend</p>
                            <div className="grid grid-cols-2 gap-1">
                                {CBE_GRADE_LEGEND.map((item) => (
                                    <span key={item.gradeCode}>{item.gradeCode} = Level {item.achievementLevel}</span>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-gray-200 p-3">
                            <p className="font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Special Codes</p>
                            <div className="grid grid-cols-2 gap-1">
                                {ASSESSMENT_STATUS_CODES.map((item) => (
                                    <span key={item.code}>{item.code} = {item.label}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-4">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Class Teacher's Remarks</p>
                        <p className="text-sm italic text-gray-700 leading-relaxed">
                            "{reportData.comments?.classTeacher || 'The learner has shown dedicated interest in all learning areas this term.'}"
                        </p>
                    </div>

                    {/* SIGNATURES */}
                    <div className="mt-auto pt-3 border-t border-gray-100 grid grid-cols-2 gap-8">
                        <div className="text-center">
                            <div className="border-b border-gray-300 h-7 mb-1" />
                            <p className="text-[9px] font-semibold text-gray-500 uppercase">Class Teacher</p>
                            {reportData.comments?.classTeacherName && (
                                <p className="text-[9px] font-medium text-gray-700 mt-0.5">{reportData.comments.classTeacherName}</p>
                            )}
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-300 h-7 mb-1" />
                            <p className="text-[9px] font-semibold text-gray-500 uppercase">Head Teacher</p>
                            {reportData.comments?.headTeacherName && (
                                <p className="text-[9px] font-medium text-gray-700 mt-0.5">{reportData.comments.headTeacherName}</p>
                            )}
                        </div>
                    </div>
                    {reportData.comments?.nextTermOpens && (
                        <p className="text-center text-[9px] font-medium text-gray-500 uppercase tracking-wider mt-3">
                            Next Term Opens: <span style={{ color: brandColor }}>{reportData.comments.nextTermOpens}</span>
                        </p>
                    )}
                    <p className="text-center text-[8px] font-medium text-gray-300 mt-3">
                        Valid only with official school stamp and signatures. Generated via {PRODUCT_DISPLAY_NAME} on {new Date().toLocaleDateString()}.
                    </p>
                </div>
            </div>

            {/* PAGE 2: QUALITATIVE ASSESSMENT */}
            <div className="bg-white text-gray-900 font-sans p-10 mx-auto shadow-sm print:shadow-none mb-4 print:mb-0 flex flex-col" style={pageStyle}>
                <h3 className="text-lg font-bold uppercase tracking-tight mb-6 pb-2 border-b-2" style={{ color: brandColor, borderColor: brandColor }}>
                    Qualitative Assessment &amp; Co-Curricular
                </h3>

                <div className="grid grid-cols-2 gap-6 flex-grow">
                    <div>
                        <h4 className="text-xs font-semibold rounded-lg p-2 uppercase tracking-wider text-white mb-3" style={{ backgroundColor: brandColor }}>Core Competencies</h4>
                        <div className="space-y-2">
                            {[
                                { label: 'Communication', val: reportData.coreCompetencies?.communication },
                                { label: 'Collaboration', val: reportData.coreCompetencies?.collaboration },
                                { label: 'Critical Thinking & Problem Solving', val: reportData.coreCompetencies?.criticalThinking },
                                { label: 'Creativity & Imagination', val: reportData.coreCompetencies?.creativity },
                                { label: 'Citizenship', val: reportData.coreCompetencies?.citizenship },
                                { label: 'Learning to Learn', val: reportData.coreCompetencies?.learningToLearn },
                                { label: 'Self-Efficacy', val: reportData.coreCompetencies?.selfEfficacy },
                                { label: 'Digital Literacy', val: reportData.coreCompetencies?.digitalLiteracy }
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                                    <span className="text-[10px] font-medium text-gray-600">{item.label}</span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>{item.val ?? 'N/A'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold rounded-lg p-2 uppercase tracking-wider text-white mb-3" style={{ backgroundColor: brandColor }}>Values Assessment</h4>
                        <div className="space-y-2">
                            {[
                                { label: 'Love', val: reportData.values?.love },
                                { label: 'Responsibility', val: reportData.values?.responsibility },
                                { label: 'Respect', val: reportData.values?.respect },
                                { label: 'Unity', val: reportData.values?.unity },
                                { label: 'Peace', val: reportData.values?.peace },
                                { label: 'Patriotism', val: reportData.values?.patriotism },
                                { label: 'Integrity', val: reportData.values?.integrity }
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                                    <span className="text-[10px] font-medium text-gray-600">{item.label}</span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>{item.val ?? 'N/A'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <h4 className="text-xs font-semibold rounded-lg p-2 uppercase tracking-wider text-white mb-3" style={{ backgroundColor: brandColor }}>Co-Curricular Activities</h4>
                    <div className="grid grid-cols-2 gap-3">
                        {(reportData.coCurricular || []).length > 0 ? (
                            reportData.coCurricular.map((activity, i) => (
                                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{activity.activityName}</p>
                                    <p className="text-xs font-medium text-gray-700">{activity.achievements || activity.remarks || 'Participation recorded'}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs italic text-gray-400 col-span-2">No co-curricular activities recorded for this term.</p>
                        )}
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-[8px] font-medium text-gray-400 uppercase tracking-widest">
                    <span>{reportData.learner.firstName} {reportData.learner.lastName}</span>
                    <span>Page 2 of {reportData.pathwayPrediction ? '3' : '2'}</span>
                </div>
            </div>

            {/* PAGE 3: AI PATHWAY PREDICTION — shared component, unchanged */}
            {reportData.pathwayPrediction && (
                <div className="mx-auto shadow-sm print:shadow-none bg-white">
                    <PathwayPredictionPage data={reportData} brandColor={brandColor} />
                </div>
            )}
        </div>
    );
};

export default ModernReportTemplate;
