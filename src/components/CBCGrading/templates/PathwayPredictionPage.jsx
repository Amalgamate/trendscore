import React from 'react';
import {
    Trophy,
    Target,
    Brain,
    Lightbulb,
    TrendingUp,
    Briefcase,
} from 'lucide-react';

/**
 * PathwayPredictionPage — Page 2 of the Termly Report Card
 *
 * Rendered automatically for Grade 7, 8 and 9 learners.
 * The pathway data is computed deterministically in ai-assistant.service.ts
 * from summative cluster averages (STEM / Social Sciences / Arts & Sports).
 *
 * No external AI API is called — the service uses lookup tables for careers
 * and growth tips, and derives confidence from the gap between cluster scores.
 */
const PathwayPredictionPage = ({ data, brandColor = '#4a0404' }) => {
    if (!data || !data.pathwayPrediction) return null;

    const {
        predictedPathway,
        confidence,
        justification,
        careerRecommendations = [],
        growthAreas = [],
        clusterBreakdown = {},
    } = data.pathwayPrediction;

    const stem   = clusterBreakdown.STEM   ?? 0;
    const social = clusterBreakdown.Social ?? 0;
    const arts   = clusterBreakdown.Arts   ?? 0;

    // Bar widths — cap at 100 so a value > 100 doesn't overflow
    const stemWidth   = `${Math.min(stem,   100)}%`;
    const socialWidth = `${Math.min(social, 100)}%`;
    const artsWidth   = `${Math.min(arts,   100)}%`;

    // Pick icon by pathway
    const PathwayIcon =
        predictedPathway?.includes('STEM')   ? Target :
        predictedPathway?.includes('Social') ? Brain  :
        Trophy;

    // Learner grade label for the header sub-line
    const gradeLabel = data.learner?.grade?.replace('_', ' ') || 'Senior School';

    return (
        <div
            className="pdf-report-page bg-white text-gray-900 font-sans p-10 flex flex-col"
            style={{
                width: '794px',
                height: '1123px',
                minHeight: '1123px',
                maxWidth: '100%',
                margin: '0 auto',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid #eee',
                pageBreakBefore: 'always',
            }}
        >
            {/* ── HEADER ────────────────────────────────────────────────── */}
            <div
                className="flex items-center gap-4 mb-8 pb-5 border-b-2"
                style={{ borderColor: brandColor }}
            >
                <div
                    className="p-3 rounded-lg text-white flex-shrink-0"
                    style={{ backgroundColor: brandColor }}
                >
                    <Brain size={28} />
                </div>
                <div className="flex-1">
                    <h2 className="text-2xl font-semibold uppercase tracking-tight leading-none">
                        CBC Pathway Analysis
                    </h2>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                        {gradeLabel} · Junior School Career Navigator · {data.term?.replace('_', ' ')} {data.academicYear}
                    </p>
                </div>
                {/* Confidence pill */}
                <div
                    className="text-white text-xs font-semibold px-4 py-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: brandColor }}
                >
                    {confidence}% confidence
                </div>
            </div>

            {/* ── MAIN GRID ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-5 gap-8 flex-grow">

                {/* LEFT — visual analytics (2 / 5 columns) */}
                <div className="col-span-2 space-y-8">

                    {/* Pathway badge */}
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center shadow-sm">
                        <p
                            className="text-[9px] font-semibold uppercase tracking-[0.2em] mb-4"
                            style={{ color: brandColor }}
                        >
                            Recommended Pathway
                        </p>
                        <div
                            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 shadow-inner"
                            style={{ border: `4px solid ${brandColor}`, color: brandColor, background: '#fff' }}
                        >
                            <PathwayIcon size={38} />
                        </div>
                        <h3
                            className="text-lg font-semibold uppercase leading-tight"
                            style={{ color: brandColor }}
                        >
                            {predictedPathway || 'Pending'}
                        </h3>
                    </div>

                    {/* Cluster bars - Compact Multi-colored Graph */}
                    <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                        <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-[0.2em] mb-1">
                            Cluster Analysis
                        </p>

                        {/* STEM */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-semibold uppercase">
                                <span className="text-gray-600">STEM</span>
                                <span className="text-blue-600">{stem}%</span>
                            </div>
                            <div className="h-2 bg-gray-200/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-blue-500 shadow-sm"
                                    style={{ width: stemWidth }}
                                />
                            </div>
                        </div>

                        {/* Social */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-semibold uppercase">
                                <span className="text-gray-600">Social Sciences</span>
                                <span className="text-emerald-600">{social}%</span>
                            </div>
                            <div className="h-2 bg-gray-200/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-emerald-500 shadow-sm"
                                    style={{ width: socialWidth }}
                                />
                            </div>
                        </div>

                        {/* Arts */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-semibold uppercase">
                                <span className="text-gray-600">Arts &amp; Sports</span>
                                <span className="text-amber-600">{arts}%</span>
                            </div>
                            <div className="h-2 bg-gray-200/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-amber-500 shadow-sm"
                                    style={{ width: artsWidth }}
                                />
                            </div>
                        </div>

                        <p className="text-[6px] text-gray-400 font-medium uppercase pt-1 border-t border-gray-100 mt-2">
                            * Based on cluster averages
                        </p>
                    </div>
                </div>

                {/* RIGHT — insights (3 / 5 columns) */}
                <div className="col-span-3 space-y-7 border-l border-gray-100 pl-8">

                    {/* Counselor's insight */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb size={15} className="text-yellow-500 flex-shrink-0" />
                            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">
                                Counselor's Insight
                            </h4>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="text-[11px] text-gray-700 leading-relaxed font-medium italic">
                                "{justification || 'No analysis available — ensure all subject results are recorded.'}"
                            </p>
                        </div>
                    </div>

                    {/* Career horizons */}
                    {careerRecommendations.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Briefcase size={15} className="text-blue-500 flex-shrink-0" />
                                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">
                                    Potential Career Horizons
                                </h4>
                            </div>
                            <div className="space-y-2">
                                {careerRecommendations.map((career, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100"
                                    >
                                        <div
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: brandColor }}
                                        />
                                        <span className="text-[11px] font-medium text-gray-700">{career}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Growth tips */}
                    {growthAreas.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp size={15} className="text-orange-500 flex-shrink-0" />
                                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">
                                    Future Readiness Tips
                                </h4>
                            </div>
                            <ul className="space-y-2">
                                {growthAreas.map((tip, i) => (
                                    <li key={i} className="flex gap-2 text-[11px] font-medium text-gray-600 leading-snug">
                                        <span className="text-orange-400 mt-0.5 flex-shrink-0">•</span>
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* ── FOOTER NOTE ───────────────────────────────────────────── */}
            <div
                className="mt-8 p-5 rounded-lg text-white relative overflow-hidden"
                style={{ backgroundColor: '#1a1a2e' }}
            >
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] mb-1 opacity-50">
                    Important Note for Parents &amp; Guardians
                </p>
                <p className="text-[10px] font-medium leading-relaxed relative z-10">
                    This pathway analysis is computed from the learner's summative assessment scores using CBC
                    cluster methodology. It is designed to provide career guidance during the Junior School years
                    to help inform future Senior School choices. Please discuss results with teachers and counselors.
                </p>
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Brain size={72} />
                </div>
            </div>

            {/* ── SIGNATURES ────────────────────────────────────────────── */}
            <div className="mt-6 grid grid-cols-2 gap-10 pt-5 border-t border-gray-100">
                <div className="text-center">
                    <div className="border-b border-gray-200 h-8 mb-1" />
                    <p className="text-[8px] font-semibold text-gray-400 uppercase">Career Guidance Counselor</p>
                </div>
                <div className="text-center">
                    <div className="border-b border-gray-200 h-8 mb-1" />
                    <p className="text-[8px] font-semibold text-gray-400 uppercase">Parent / Guardian Signature</p>
                </div>
            </div>
        </div>
    );
};

export default PathwayPredictionPage;
