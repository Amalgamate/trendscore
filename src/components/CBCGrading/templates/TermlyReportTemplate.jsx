import React from 'react';
import { ASSESSMENT_STATUS_CODES, CBE_GRADE_LEGEND } from '../../../utils/cbeGrading';
import PathwayPredictionPage from './PathwayPredictionPage';

/**
 * TermlyReportTemplate - CORPORATE EDITION
 * Professional, clean design optimized for multi-page A4 output.
 */
const TermlyReportTemplate = ({ reportData, id = "termly-report-content" }) => {
    if (!reportData) return null;

    const brandColor = reportData.brandColor || '#1e3a8a'; // Deep navy default — schools override via branding settings

    return (
        <div id={id} className="bg-gray-100 pb-10 print:p-0 print:bg-white">
            {/* PAGE 1: ACADEMIC PERFORMANCE */}
            <div
                className="bg-white text-gray-900 font-sans p-10 mx-auto shadow-sm print:shadow-none mb-4 print:mb-0"
                style={{
                    width: '794px',
                    minHeight: '1123px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    position: 'relative',
                    border: '1px solid #eee'
                }}
            >
                {/* 1. CORPORATE HEADER */}
                <div className="flex justify-between items-start mb-6 border-b-2 pb-6" style={{ borderColor: brandColor }}>
                    <div className="flex items-center gap-5">
                        <div className="w-24 h-24 flex items-center justify-center rounded bg-white shadow-sm border border-gray-100 overflow-hidden">
                            {reportData.logoUrl && reportData.logoUrl !== '/branding/logo.png' ? (
                                <img src={reportData.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                            ) : (
                                <img src="/branding/logo.png" alt="Logo" className="max-w-full max-h-full object-contain" />
                            )}
                        </div>
                        <div className="text-left">
                            <h1 className="uppercase tracking-tight leading-none mb-1" style={{ fontSize: '36px', fontWeight: '950' }}>
                                {reportData.schoolName || 'ACADEMIC SCHOOL'}
                            </h1>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-[0.1em]">
                                {reportData.schoolAddress || 'P.O. Box 1234, Nairobi, Kenya'}
                            </p>
                            <div className="flex gap-4 mt-1 text-[10px] font-medium text-gray-400 uppercase">
                                <span>TEL: {reportData.schoolPhone || '+254 700 000000'}</span>
                                <span>•</span>
                                <span>EMAIL: {reportData.schoolEmail || 'info@school.ac.ke'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="px-5 py-2 text-white mb-2 inline-block rounded-sm font-semibold uppercase tracking-widest text-lg" style={{ backgroundColor: brandColor }}>
                            Progress Report
                        </div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                            {reportData.term?.replace('_', ' ') || 'Term'} | {reportData.academicYear || '2025'}
                        </p>
                    </div>
                </div>

                {/* 2. LEARNER INFO TILE */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6 grid grid-cols-4 gap-4 shadow-sm">
                    <div className="col-span-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Learner Full Name</p>
                        <p className="text-xl font-medium text-gray-800 uppercase tracking-tight border-b border-gray-300 pb-1">
                            {reportData.learner.firstName} {reportData.learner.lastName}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Admission No</p>
                        <p className="text-lg font-medium text-gray-800">{reportData.learner.admissionNumber}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Grade Level</p>
                        <p className="text-lg font-medium text-gray-800 uppercase">{reportData.learner.grade?.replace('_', ' ')}</p>
                    </div>
                </div>

                {/* 3. PERFORMANCE TABLE */}
                <div className="mb-6 flex-grow flex flex-col border border-gray-900 rounded-sm overflow-hidden shadow-md bg-white">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-white" style={{ backgroundColor: brandColor }}>
                                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest border-r border-white/20">Learning Area</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest border-r border-white/20 w-32">Points / Marks</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest border-r border-white/20 w-28">Level</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest w-32">Grade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(reportData.summative?.summary?.bySubject || []).map((subject, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-2.5 text-sm font-medium text-gray-700">{subject.subject}</td>
                                    <td className="px-4 py-2.5 text-center text-sm font-medium text-gray-900 border-x border-gray-100">{subject.averagePercentage}%</td>
                                    <td className="px-4 py-2.5 text-center text-sm font-medium text-gray-900 border-r border-gray-100">{subject.achievementLevel ?? '-'}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className="font-medium text-lg" style={{ color: brandColor }}>{subject.cbcGrade || subject.grade}</span>
                                    </td>
                                </tr>
                            ))}
                            {Array.from({ length: Math.max(0, 10 - (reportData.summative?.summary?.bySubject?.length || 0)) }).map((_, i) => (
                                <tr key={`empty-${i}`} className="h-9">
                                    <td className="border-r border-gray-100"></td>
                                    <td className="border-r border-gray-100"></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {(reportData.summative?.summary?.byCategoryAverages || []).length > 0 && (
                    <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                            Category Averages
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-gray-200">
                            {(reportData.summative.summary.byCategoryAverages || []).map((row, idx) => (
                                <div key={`${row.category}-${idx}`} className="px-4 py-3 text-center">
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{row.category}</p>
                                    <p className="text-lg font-semibold text-gray-900 mt-0.5">{row.averagePercentage}%</p>
                                    <p className="text-xs font-medium mt-0.5" style={{ color: brandColor }}>{row.grade}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-6 grid grid-cols-1 gap-3 text-[10px] text-gray-600">
                    <div className="border border-gray-200 rounded bg-white p-3">
                        <p className="font-semibold uppercase tracking-widest text-gray-500 mb-2">CBE Achievement Legend</p>
                        <div className="grid grid-cols-4 gap-1">
                            {CBE_GRADE_LEGEND.map((item) => (
                                <span key={item.gradeCode}>{item.gradeCode} = Achievement Level {item.achievementLevel}</span>
                            ))}
                        </div>
                    </div>
                    <div className="border border-gray-200 rounded bg-white p-3">
                        <p className="font-semibold uppercase tracking-widest text-gray-500 mb-2">Special Codes</p>
                        <div className="grid grid-cols-3 gap-1">
                            {ASSESSMENT_STATUS_CODES.map((item) => (
                                <span key={item.code}>{item.code} = {item.label}</span>
                            ))}
                        </div>
                        <p className="mt-2 italic">{reportData.summative?.summary?.exclusionNote || 'Administrative status codes are excluded from learner performance calculations.'}</p>
                    </div>
                </div>

                {/* 4. PERFORMANCE SUMMARY & KEY */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50 border border-gray-200 rounded p-4">
                        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 border-b pb-1">Teacher's General Remarks</h4>
                        <p className="text-sm font-medium italic text-gray-600 leading-relaxed">
                            "{reportData.comments?.classTeacher || 'The learner has shown dedicated interest in all learning areas. Remarkable progress observed in social skills and mathematical reasoning.'}"
                        </p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded p-4">
                        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 border-b pb-1 text-center">Grading System Key</h4>
                        <div className="grid grid-cols-2 gap-y-2 text-[9px] font-semibold uppercase">
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> <span>80 - 100 : EXCEEDING</span></div>
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> <span>60 - 79 : MEETING</span></div>
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> <span>50 - 59 : APPROACHING</span></div>
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> <span>BELOW 50 : SUPPORT</span></div>
                        </div>
                    </div>
                </div>

                {/* 5. CORPORATE FOOTER */}
                <div className="mt-auto border-t-2 pt-6" style={{ borderColor: brandColor }}>
                    <div className="grid grid-cols-3 gap-10 mb-4">
                        <div className="text-center">
                            <div className="border-b border-gray-300 h-8 mb-1"></div>
                            <p className="text-[9px] font-semibold text-gray-500 uppercase">Class Teacher</p>
                            {reportData.comments?.classTeacherName && (
                                <p className="text-[9px] font-medium text-gray-700 mt-0.5">{reportData.comments.classTeacherName}</p>
                            )}
                        </div>
                        <div className="text-center flex flex-col items-center justify-center">
                            {reportData.schoolStamp ? (
                                <img
                                    src={reportData.schoolStamp}
                                    alt="Stamp"
                                    className="w-16 h-16 object-contain mb-1 opacity-80"
                                    style={{ mixBlendMode: 'multiply' }}
                                />
                            ) : (
                                <div className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center mb-1">
                                    <span className="text-[8px] font-semibold text-gray-300 uppercase leading-none">School<br />Stamp</span>
                                </div>
                            )}
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-300 h-8 mb-1"></div>
                            <p className="text-[9px] font-semibold text-gray-500 uppercase">Head Teacher</p>
                            {reportData.comments?.headTeacherName && (
                                <p className="text-[9px] font-medium text-gray-700 mt-0.5">{reportData.comments.headTeacherName}</p>
                            )}
                        </div>
                    </div>

                    {/* Next Term Opens */}
                    {reportData.comments?.nextTermOpens && (
                        <div className="text-center mb-3 py-1.5 border border-gray-200 rounded text-[9px] font-medium text-gray-600 uppercase tracking-wider">
                            Next Term Opens: <span style={{ color: brandColor }}>{reportData.comments.nextTermOpens}</span>
                        </div>
                    )}

                    <div className="bg-gray-900 text-white p-3 rounded-sm text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1">
                            {reportData.schoolSlogan || 'Excellence in Knowledge and Character'}
                        </p>
                        <p className="text-[8px] font-medium opacity-60">
                            Valid only with official school stamp and signatures. Generated via Trends CORE V1.0 on {new Date().toLocaleDateString()}.
                        </p>
                    </div>
                </div>
            </div>

            {/* PAGE 2: QUALITATIVE ASSESSMENT (Competencies, Values, Co-curricular) */}
            <div
                className="bg-white text-gray-900 font-sans p-10 mx-auto shadow-sm print:shadow-none mb-4 print:mb-0"
                style={{
                    width: '794px',
                    minHeight: '1123px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    position: 'relative',
                    border: '1px solid #eee'
                }}
            >
                <h3 className="text-lg font-semibold uppercase tracking-widest mb-6 border-b-2 pb-2" style={{ color: brandColor, borderColor: brandColor }}>
                    Qualitative Assessment & Co-Curricular
                </h3>

                <div className="grid grid-cols-2 gap-8 flex-grow">
                    {/* Core Competencies */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold bg-gray-100 p-2 rounded uppercase tracking-wider">Core Competencies</h4>
                        <div className="space-y-3">
                            {[
                                { label: 'Communication & Collaboration', val: reportData.coreCompetencies?.communication },
                                { label: 'Critical Thinking & Problem Solving', val: reportData.coreCompetencies?.criticalThinking },
                                { label: 'Creativity & Imagination', val: reportData.coreCompetencies?.creativity },
                                { label: 'Citizenship', val: reportData.coreCompetencies?.citizenship },
                                { label: 'Learning to Learn', val: reportData.coreCompetencies?.learningToLearn }
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-1">
                                    <span className="text-[10px] font-medium text-gray-600">{item.label}</span>
                                    <span className="text-xs font-semibold" style={{ color: brandColor }}>{item.val ?? 'Not recorded'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Values Assessment */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold bg-gray-100 p-2 rounded uppercase tracking-wider">Values Assessment</h4>
                        <div className="space-y-3">
                            {[
                                { label: 'Love', val: reportData.values?.love },
                                { label: 'Responsibility', val: reportData.values?.responsibility },
                                { label: 'Respect', val: reportData.values?.respect },
                                { label: 'Unity', val: reportData.values?.unity },
                                { label: 'Peace', val: reportData.values?.peace },
                                { label: 'Patriotism', val: reportData.values?.patriotism },
                                { label: 'Integrity', val: reportData.values?.integrity }
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-1">
                                    <span className="text-[10px] font-medium text-gray-600">{item.label}</span>
                                    <span className="text-xs font-semibold" style={{ color: brandColor }}>{item.val ?? 'Not recorded'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Co-Curricular Activities */}
                <div className="mt-8">
                    <h4 className="text-xs font-semibold bg-gray-100 p-2 rounded uppercase tracking-wider mb-4">Co-Curricular Activities</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {(reportData.coCurricular || []).length > 0 ? (
                            reportData.coCurricular.map((activity, i) => (
                                <div key={i} className="bg-gray-50 p-3 rounded border border-gray-100">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{activity.activityName}</p>
                                    <p className="text-xs font-medium text-gray-700">{activity.remarks || 'Active participation and good teamwork shown.'}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs italic text-gray-400 col-span-2">No co-curricular activities recorded for this term.</p>
                        )}
                    </div>
                </div>

                {/* Footer on Page 2 */}
                <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-[8px] font-medium text-gray-400 uppercase tracking-widest">
                    <span>{reportData.learner.firstName} {reportData.learner.lastName}</span>
                    <span>Page 2 of {reportData.pathwayPrediction ? '3' : '2'}</span>
                </div>
            </div>

            {/* PAGE 3: AI PATHWAY PREDICTION */}
            {reportData.pathwayPrediction && (
                <div className="mx-auto shadow-sm print:shadow-none bg-white">
                    <PathwayPredictionPage data={reportData} brandColor={brandColor} />
                </div>
            )}
        </div>
    );
};

export default TermlyReportTemplate;
