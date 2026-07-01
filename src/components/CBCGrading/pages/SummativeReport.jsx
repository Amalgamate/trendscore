/**
 * Summary Report Page
 * Clean, minimal design matching Summative Assessment setup - Single Source of Truth
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, Loader, MessageCircle, Printer, MessageSquare, AlertCircle, CheckCircle, XCircle, Edit2, FileText } from 'lucide-react';
import ExcelJS from 'exceljs';
import VirtualizedTable from '../shared/VirtualizedTable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { useNotifications } from '../hooks/useNotifications';
import api, { configAPI, communicationAPI } from '../../../services/api';
import { gradingAPI } from '../../../services/api/grading.api';
import { useAssessmentSetup } from '../hooks/useAssessmentSetup';
import { getLearningAreasByGrade } from '../../../constants/learningAreas';
import { useSchoolData } from '../../../contexts/SchoolDataContext';
import { reportAPI } from '../../../services/api/report.api';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';
import { getSchoolDisplayName } from '../../../utils/schoolDisplayName';
import { getAcademicYearOptions, getCurrentAcademicYear, getCurrentTerm } from '../utils/academicYear';
import { resolveTestType, formatTestTypeLabel, compareTestTypes } from '../utils/testType';
import Toast from '../shared/Toast';
import {
  captureElement,
  printWindow as pdfPrintWindow,
} from '../../../utils/simplePdfGenerator';

// Capture as JPEG/PNG remains frontend-only (routed via captureElement)
const generateJPEG = async (elementId, filename, onProgress) => {
  try {
    const el = document.getElementById(elementId);
    if (!el) return { success: false, error: 'Element not found' };
    if (onProgress) onProgress('Capturing image...');
    const canvas = await captureElement(el);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// (Legacy dead code fully removed — see simplePdfGenerator.js)


const LEARNING_AREA_ABBREVIATIONS = {
  'MATHEMATICS': 'MAT',
  'ENGLISH': 'ENG',
  'KISWAHILI': 'KIS',
  'KISWAHILI ACTIVITIES': 'KIS',
  'SCIENCE AND TECHNOLOGY': 'SCITECH',
  'SOCIAL STUDIES': 'SST',
  'CHRISTIAN RELIGIOUS EDUCATION': 'CRE',
  'ISLAMIC RELIGIOUS EDUCATION': 'IRE',
  'CREATIVE ARTS AND SPORTS': 'CREATIVE',
  'AGRICULTURE': 'AGRI',
  'ENVIRONMENTAL ACTIVITIES': 'ENV',
  'HOMESCIENCE': 'H SCI',
  'MUSIC': 'MUSIC',
  'ART AND CRAFT': 'ART',
  'PHYSICAL AND HEALTH EDUCATION': 'PHE',
  'SHUGHULI ZA KISWAHILI': 'KIS',
  'MATHEMATICAL ACTIVITIES': 'MAT',
  'ENGLISH LANGUAGE ACTIVITIES': 'ENG',
  'KISWAHILI LANGUAGE ACTIVITIES': 'KIS',
  'SCIENCE & TECHNOLOGY': 'SCITECH',
  'AGRICULTURE': 'AGRI',
  'PRE-TECHNICAL STUDIES': 'PRE-TECH',
  'INTEGRATED SCIENCE': 'INT SCI',
  'SOCIAL STUDIES & LIFE SKILLS': 'SST',
  'MOVEMENT AND CREATIVE ACTIVITIES': 'CREATIVE',
  'ENVIRONMENTAL STUDIES': 'ENV'
};

const LEARNING_AREA_CANONICAL_KEYS = {
  'MATHEMATICAL ACTIVITIES': 'MATHEMATICS',
  'MATHEMATICS ACTIVITIES': 'MATHEMATICS',
  'ENGLISH LANGUAGE ACTIVITIES': 'ENGLISH',
  'ENGLISH ACTIVITIES': 'ENGLISH',
  'KISWAHILI LANGUAGE ACTIVITIES': 'KISWAHILI',
  'KISWAHILI ACTIVITIES': 'KISWAHILI',
  'SHUGHULI ZA KISWAHILI': 'KISWAHILI',
  'MOVEMENT AND CREATIVE ACTIVITIES': 'CREATIVE ACTIVITIES'
};

const getCanonicalLearningAreaKey = (name) => {
  const upper = String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();
  return LEARNING_AREA_CANONICAL_KEYS[upper] || upper;
};

const getCanonicalLearningAreaName = (name) => {
  const key = getCanonicalLearningAreaKey(name);
  if (!key) return '';
  if (key === 'MATHEMATICS') return 'Mathematics';
  if (key === 'ENGLISH') return 'English';
  if (key === 'KISWAHILI') return 'Kiswahili';
  if (key === 'CREATIVE ACTIVITIES') return 'Creative Activities';
  if (key === 'ENVIRONMENTAL ACTIVITIES') return 'Environmental Activities';
  return String(name || key).trim();
};

const formatSubjectName = (name) => {
  if (!name) return name;
  const canonical = getCanonicalLearningAreaName(name);
  if (canonical && canonical !== name) return canonical;
  return name.charAt(0) + name.slice(1).toLowerCase();
};



const getAbbreviatedName = (name) => {
  if (!name) return '';
  const upper = getCanonicalLearningAreaKey(name);
  return LEARNING_AREA_ABBREVIATIONS[upper] || (name.length > 8 ? name.substring(0, 8).toUpperCase() : name.toUpperCase());
};

const getLearnerPhone = (learner) => {
  if (!learner) return '';
  return learner.primaryContactPhone ||
    learner.guardianPhone ||
    learner.parent?.phone ||
    learner.fatherPhone ||
    learner.motherPhone ||
    learner.parentPhone ||
    learner.parentPhoneNumber ||
    '';
};

const getLearnerContactOptions = (learner) => {
  if (!learner) return [];
  const options = [];

  if (learner.primaryContactPhone) options.push({ label: 'Primary', phone: learner.primaryContactPhone, name: learner.primaryContactName });
  if (learner.guardianPhone) options.push({ label: 'Parent/Guardian', phone: learner.guardianPhone, name: learner.guardianName });
  if (learner.fatherPhone) options.push({ label: 'Father', phone: learner.fatherPhone, name: learner.fatherName });
  if (learner.motherPhone) options.push({ label: 'Mother', phone: learner.motherPhone, name: learner.motherName });
  if (learner.parent?.phone) options.push({ label: 'ParentAccount', phone: learner.parent.phone, name: learner.parent.firstName });
  if (learner.parentPhone) options.push({ label: 'Secondary', phone: learner.parentPhone });
  if (learner.parentPhoneNumber) options.push({ label: 'Secondary', phone: learner.parentPhoneNumber });

  // Filter out empty phones and duplicates
  const uniquePhones = new Set();
  return options.filter(opt => {
    if (!opt.phone || uniquePhones.has(opt.phone)) return false;
    uniquePhones.add(opt.phone);
    return true;
  });
};


// Helper to refine learning area based on test title (fixes aggregation issues)
const getRefinedLearningArea = (currentArea, testTitle) => {
  return currentArea; // Disable fuzzy merging to prevent data corruption
};

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316'  // orange
];

// ============================================================================
// CBC SMS COMPLIANCE REQUIREMENTS CHECKER
// ============================================================================
/**
 * Validates report data against CBC-compliant SMS requirements
 * Returns { isCompliant: boolean, gaps: Array<string>, warnings: Array<string> }
 */

// ============================================================================
// GRADING UTILITIES
// ============================================================================

/**
 * Default CBC grade thresholds — used when the school has not configured
 * custom grading ranges in Settings → Grading System.
 */
const DEFAULT_CBC_RANGES = [
  { grade: 'EE1', minScore: 90, maxScore: 100, remark: 'Exceeding Expectations 1 - Outstanding', color: '#006400', points: 8 },
  { grade: 'EE2', minScore: 75, maxScore: 89,  remark: 'Exceeding Expectations 2 - Very High',   color: '#008000', points: 7 },
  { grade: 'ME1', minScore: 58, maxScore: 74,  remark: 'Meeting Expectations 1 - High Average',  color: '#000080', points: 6 },
  { grade: 'ME2', minScore: 41, maxScore: 57,  remark: 'Meeting Expectations 2 - Average',       color: '#0000CD', points: 5 },
  { grade: 'AE1', minScore: 31, maxScore: 40,  remark: 'Approaching Expectations 1 - Low Average', color: '#8B4513', points: 4 },
  { grade: 'AE2', minScore: 21, maxScore: 30,  remark: 'Approaching Expectations 2 - Below Average', color: '#A0522D', points: 3 },
  { grade: 'BE1', minScore: 11, maxScore: 20,  remark: 'Below Expectations 1 - Low',             color: '#D2691E', points: 2 },
  { grade: 'BE2', minScore: 0,  maxScore: 10,  remark: 'Below Expectations 2 - Very Low',        color: '#8B0000', points: 1 },
];

/**
 * Grade color map — keeps visual consistency even when using DB ranges
 * that may not carry a color field.
 */
const GRADE_COLORS = {
  EE1: '#006400', EE2: '#008000',
  ME1: '#000080', ME2: '#0000CD',
  AE1: '#8B4513', AE2: '#A0522D',
  BE1: '#D2691E', BE2: '#8B0000',
};

/**
 * Build a getCBCGrade function from a DB ranges array.
 * Falls back to DEFAULT_CBC_RANGES when ranges is empty/null.
 *
 * Each range is expected to have: { grade, minScore, maxScore, remark? }
 * Ranges are sorted descending by minScore so the first match wins.
 *
 * @param {Array|null} ranges  — from gradingAPI.getSystems() → CBC system ranges
 * @returns {(percentage: number) => { grade, remark, color, points }}
 */
const makeCBCGrader = (ranges) => {
  const active = (ranges && ranges.length > 0) ? ranges : DEFAULT_CBC_RANGES;

  // Sort descending so we match the highest percentage band first
  // Note: Standardizes on minPercentage (DB) or minScore (Legacy)
  const sorted = [...active].sort((a, b) => {
    const minA = b.minPercentage ?? b.minScore ?? b.min ?? 0;
    const minB = a.minPercentage ?? a.minScore ?? a.min ?? 0;
    return minA - minB;
  });

  return (percentage) => {
    const pct = typeof percentage === 'number' ? percentage : parseFloat(percentage) || 0;
    for (const r of sorted) {
      const min = r.minPercentage ?? r.minScore ?? r.min ?? 0;
      if (pct >= min) {
        const grade = r.label || r.grade || r.gradeName || 'BE1';
        return {
          grade,
          remark: r.parentBand ? `${r.parentBand} (${grade})` : (r.description || r.remark || grade),
          color:  r.color || GRADE_COLORS[grade] || '#111827',
          points: r.points ?? r.point ?? 1,
        };
      }
    }
    // Below all ranges
    const last = sorted[sorted.length - 1];
    const grade = last?.label || last?.grade || 'BE1';
    return {
      grade,
      remark: last?.description || last?.remark || grade,
      color:  last?.color || GRADE_COLORS[grade] || '#111827',
      points: last?.points ?? 1,
    };
  };
};

// Module-level fallback — used by any call-site that runs before the
// parent component has fetched the DB ranges (e.g. the Grading Key table).
const getCBCGrade = makeCBCGrader(null);

// ============================================================================
// PATHWAY & MESSAGING UTILITIES
// ============================================================================
const PATHWAY_MAP = {
  STEM: [
    'MATHEMATICS', 'MATH', 'MAT',
    'INTEGRATED SCIENCE', 'INT SCI', 'I-SCI',
    'SCIENCE AND TECHNOLOGY', 'SCITECH', 'SCIENCE & TECHNOLOGY',
    'PRE-TECHNICAL STUDIES', 'PRE-TECH', 'P-TECH',
    'AGRICULTURE', 'AGRI', 'HOMESCIENCE', 'H SCI',
  ],
  SOCIAL: [
    'ENGLISH', 'ENG', 'KISWAHILI', 'KIS',
    'SOCIAL STUDIES', 'SST', 'RELIGIOUS EDUCATION', 'REL',
    'CHRISTIAN RELIGIOUS EDUCATION', 'CRE', 'ISLAMIC RELIGIOUS EDUCATION', 'IRE', 'RE',
    'HISTORY', 'GEOGRAPHY',
  ],
  ARTS: [
    'CREATIVE ARTS AND SPORTS', 'CREATIVE', 'CREA', 'CREATIVE ARTS & SPORTS',
    'ART AND CRAFT', 'ART', 'MUSIC', 'MUS',
    'PHYSICAL AND HEALTH EDUCATION', 'PHE', 'MOVEMENT AND CREATIVE ACTIVITIES',
  ],
};

const calculatePathwayInsights = (results) => {
  if (!results || results.length === 0) return { pathways: [], recommended: null };

  const calcScore = (keywords) => {
    const matched = results.filter(r =>
      keywords.some(k => (r.learningArea || r.area || '').toUpperCase().includes(k))
    );
    if (matched.length === 0) return { pct: null };
    const total = matched.reduce((s, r) => s + (r.score || 0), 0);
    const max = matched.reduce((s, r) => s + (r.totalMarks || 0), 0);
    return { pct: max > 0 ? Math.round((total / max) * 100) : null };
  };

  const stem = calcScore(PATHWAY_MAP.STEM);
  const social = calcScore(PATHWAY_MAP.SOCIAL);
  const arts = calcScore(PATHWAY_MAP.ARTS);

  const pathways = [
    { label: 'STEM', pct: stem.pct },
    { label: 'Social Sciences', pct: social.pct },
    { label: 'Arts & Sports', pct: arts.pct },
  ];

  const recommended = [...pathways]
    .filter(p => p.pct !== null)
    .sort((a, b) => b.pct - a.pct)[0] || null;

  return { pathways, recommended };
};

const formatTestName = (str) => (formatTestTypeLabel(str) || '').toUpperCase();
const resolveTestGroup = (item) => resolveTestType(item);
const compareTestGroups = (a, b) => compareTestTypes(a, b);
const CORE_GROUPS_WITHOUT_STAMP = new Set(['OPENER', 'MID_TERM', 'END_TERM']);

const CATEGORY_KEYWORDS = {
  STEM: PATHWAY_MAP.STEM,
  SOCIAL: PATHWAY_MAP.SOCIAL,
  ARTS: PATHWAY_MAP.ARTS,
};

// ============================================================================
// LEARNER REPORT TEMPLATE COMPONENT (Reusable for Bulk Print)
// ============================================================================
const LearnerReportTemplate = ({ learner, results, pathwayPrediction, term, academicYear, brandingSettings, user, streamConfigs, remarks, commentData, gradingRanges, categoryAverages }) => {
  // Build a grade function from DB ranges (or defaults if not yet loaded).
  // useMemo keeps it stable across re-renders when gradingRanges hasn't changed.
  const getGrade = React.useMemo(() => makeCBCGrader(gradingRanges), [gradingRanges]);

  // --- DATA PREPARATION LOGIC ---
  const standardAreas = getLearningAreasByGrade(learner.grade);
  const resultAreas = new Set(results?.map(r => r.learningArea || 'General') || []);
  const configAreas = [];
  if (streamConfigs && streamConfigs.length > 0) {
    const gradeConfig = streamConfigs.find(sc => sc.grade === learner.grade);
    if (gradeConfig?.streams) {
      const streamConfig = gradeConfig.streams.find(s => !s.name || s.name === learner.stream);
      if (streamConfig?.learningAreas) configAreas.push(...streamConfig.learningAreas);
    }
  }
  const allAreasSet = new Set([...standardAreas, ...resultAreas, ...configAreas]);
  const areasToDisplay = Array.from(allAreasSet).sort();
  if (areasToDisplay.length === 0) areasToDisplay.push('General');

  // Organize results by Area
  const resultsByArea = {};
  results?.forEach(result => {
    const area = result.learningArea || 'General';
    if (!resultsByArea[area]) resultsByArea[area] = [];
    resultsByArea[area].push(result);
  });

  // Identify unique Test Types for Columns
  const testTypesFound = new Set();
  const colDates = {};

  results?.forEach(r => {
    const type = resolveTestGroup({
      testType: r.test?.testType || r.testType,
      title: r.test?.title || r.title
    });
    testTypesFound.add(type);

    // Track the earliest date for each test group to assist in sorting
    const date = new Date(r.testDate || r.test?.testDate || 0);
    if (!colDates[type] || (date > new Date(0) && date < colDates[type])) {
      colDates[type] = date;
    }
  });

  // Sort columns: Opener -> Midterm -> End Term -> Others by Date
  const testColumns = Array.from(testTypesFound).sort((a, b) => {
    const byGroupPriority = compareTestGroups(a, b);
    if (byGroupPriority !== 0) return byGroupPriority;

    // Fallback to date sorting if priorities are equal
    const dateA = colDates[a] || 0;
    const dateB = colDates[b] || 0;
    if (dateA && dateB) return dateA - dateB;

    return String(a || '').localeCompare(String(b || ''));
  });

  // Prepare row data
  const tableRows = areasToDisplay.map(area => {
    const areaResults = resultsByArea[area] || [];

    // Map scores by test column
    const scoresByCol = {};
    const maxByCol = {};
    testColumns.forEach(col => {
      const match = areaResults.find(r => resolveTestGroup({
        testType: r.test?.testType || r.testType,
        title: r.test?.title || r.title
      }) === col);
      scoresByCol[col] = match ? (match.score || 0) : null;
      maxByCol[col] = match ? (match.totalMarks || 0) : null;
    });

    const testCount = areaResults.length;
    const totalScore = areaResults.reduce((sum, r) => sum + (r.score || 0), 0);
    const totalMarks = areaResults.reduce((sum, r) => sum + (r.totalMarks || 0), 0);
    const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;

    let grade = '—';
    let remark = '—';
    let color = '#d1d5db';
    let points = null;

    if (testCount > 0 && totalMarks > 0) {
      const res = getGrade(percentage);
      grade = res.grade;
      remark = res.remark;
      color = res.color;
      points = res.points;
    }

    let displayArea = formatSubjectName(area).toUpperCase();
    if (displayArea === 'IRE' || displayArea === 'ISLAMIC RELIGIOUS EDUCATION') {
      displayArea = 'RE';
    }

    return {
      area: displayArea,
      scoresByCol,
      maxByCol,
      testCount,
      totalScore,
      totalMarks,
      percentage: parseFloat(percentage.toFixed(0)),
      grade,
      remark,
      color,
      points
    };
  }).filter(row => row.testCount > 0);
  const totalsByTestColumn = testColumns.reduce((acc, col) => {
    acc[col] = { score: 0, max: 0 };
    return acc;
  }, {});

  tableRows.forEach(row => {
    testColumns.forEach(col => {
      const score = row.scoresByCol[col];
      const max = row.maxByCol[col];
      if (typeof score === 'number' && Number.isFinite(score)) {
        totalsByTestColumn[col].score += score;
      }
      if (typeof max === 'number' && Number.isFinite(max)) {
        totalsByTestColumn[col].max += max;
      }
    });
  });

  const pointRows = tableRows.filter((r) => typeof r.points === 'number' && Number.isFinite(r.points));
  const totalPoints = pointRows.reduce((acc, r) => acc + r.points, 0);
  const meanPoints = pointRows.length > 0
    ? (pointRows.reduce((acc, r) => acc + r.points, 0) / pointRows.length)
    : 0;

  const roundedMeanPoints = Math.max(1, Math.min(8, Math.round(meanPoints)));
  const rangesWithPoints = (gradingRanges || []).filter(
    (r) => Number.isFinite(Number(r?.points ?? r?.point))
  );
  const pointBand = rangesWithPoints.find((r) => Number(r?.points ?? r?.point) === roundedMeanPoints);
  const meanPointsPct = (meanPoints / 8) * 100;
  const gradeByPct = getGrade(meanPointsPct);
  const gradeFromMeanPoints = pointRows.length > 0
    ? (pointBand?.grade || pointBand?.label || gradeByPct?.grade || '—')
    : '—';
  const gradeFromMeanPointsColor = pointRows.length > 0
    ? (pointBand?.color || gradeByPct?.color || '#64748b')
    : '#64748b';

  const fallbackCategoryAverages = React.useMemo(() => {
    const compute = (keywords) => {
      const matched = tableRows.filter((r) =>
        keywords.some((k) => String(r.area || '').toUpperCase().includes(String(k).toUpperCase()))
      );
      if (!matched.length) return null;
      const totalScore = matched.reduce((sum, row) => sum + Number(row.totalScore || 0), 0);
      const totalMarks = matched.reduce((sum, row) => sum + Number(row.totalMarks || 0), 0);
      if (totalMarks <= 0) return null;
      const averagePercentage = Math.round((totalScore / totalMarks) * 100);
      return {
        averagePercentage,
        subjectCount: matched.length,
        grade: getGrade(averagePercentage)?.grade || '—',
      };
    };

    return [
      { key: 'STEM', label: 'STEM', color: '#2563eb', bg: '#eff6ff', ...compute(CATEGORY_KEYWORDS.STEM) },
      { key: 'SOCIAL', label: 'Social', color: '#16a34a', bg: '#f0fdf4', ...compute(CATEGORY_KEYWORDS.SOCIAL) },
      { key: 'ARTS', label: 'Arts', color: '#d97706', bg: '#fffbeb', ...compute(CATEGORY_KEYWORDS.ARTS) },
    ].filter((row) => row.averagePercentage !== undefined);
  }, [tableRows, getGrade]);
  const effectiveCategoryAverages =
    Array.isArray(fallbackCategoryAverages) && fallbackCategoryAverages.length > 0
      ? fallbackCategoryAverages
      : (Array.isArray(categoryAverages) ? categoryAverages : []);

  const isJSS = /\b(GRADE_7|GRADE_8|GRADE_9|7|8|9)\b/.test((learner.grade || '').toUpperCase());
  const pdfTypeWeight = {
    regular: 500,
    semibold: 600,
    bold: 700,
    title: 800
  };
  const schoolName = getSchoolDisplayName(brandingSettings?.schoolName, user?.school?.name, { fallback: PRODUCT_DISPLAY_NAME }).toUpperCase();
  const schoolNameLength = schoolName.length;
  const schoolNameFontSize = Math.max(22, Math.min(34, Math.round(980 / Math.max(schoolNameLength, 1))));
  const schoolNameLetterSpacing =
    schoolNameLength <= 18 ? '0.8px' : schoolNameLength <= 28 ? '0.5px' : '0.2px';

  // commentData is now passed in as a prop from the parent (pre-fetched before bulk render)

  return (
    <div className="report-card pdf-report-root relative bg-white mx-auto"
      style={{
        fontFamily: "'Raleway', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        lineHeight: '1.2',
        width: '794px',    // 210mm at 96 DPI
        minHeight: '1123px', // ensure card is never shorter than A4
        // height is intentionally omitted — html2canvas reads scrollHeight,
        // so reports with many subjects expand instead of clipping.
        padding: '30px 40px 30px 40px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff'
      }}
    >
      {/* Header Section - Ultra-Slim Horizontal Redesign */}
      <div className="mb-2 pdf-report-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 0 6px 0',
        borderBottom: `2.5px solid ${brandingSettings?.brandColor || '#1e3a8a'}`,
        gap: '24px'
      }}>
        {/* LEFT: Logo */}
        <div style={{
          flexShrink: 0,
          width: '96px',
          height: '96px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible'
        }}>
          {(() => {
            const logoSrc = brandingSettings?.logoUrl || user?.school?.logoUrl || user?.school?.logo || user?.schoolLogo || user?.logoUrl || '/branding/logo.png';
            return (
              <img
                src={logoSrc}
                alt="School Logo"
                style={{ maxHeight: '92px', maxWidth: '92px', width: 'auto', objectFit: 'contain', display: 'block' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            );
          })()}
        </div>

        {/* CENTER: Vertical Separator */}
        <div style={{ width: '1.5px', height: '64px', backgroundColor: '#e2e8f0' }}></div>

        {/* RIGHT: High-Density Text Stack */}
        <div style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1px' }}>
          {/* School Name */}
          <div style={{ width: '100%' }}>
            <h1 style={{
              fontSize: `${schoolNameFontSize}px`,
              fontWeight: pdfTypeWeight.title,
              fontFamily: "'Raleway', sans-serif",
              color: brandingSettings?.brandColor || '#1e3a8a',
              textTransform: 'uppercase',
              margin: 0,
              lineHeight: '1',
              letterSpacing: schoolNameLetterSpacing,
              whiteSpace: 'nowrap',
              display: 'block',
              width: '100%'
            }}>
              {schoolName}
            </h1>
          </div>

          {/* Motto & Location Stack */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '9.5px', color: '#64748b', fontWeight: pdfTypeWeight.semibold, textTransform: 'uppercase' }}>
            {user?.school?.motto && <span style={{ fontStyle: 'italic' }}>"{user.school.motto}"</span>}
            {user?.school?.location && (
              <>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>{user.school.location}</span>
                {user?.school?.email && <> <span style={{ color: '#cbd5e1' }}>•</span> {user.school.email} </>}
              </>
            )}
          </div>

          {/* Report Title */}
          <h2 style={{ fontSize: '15px', fontWeight: pdfTypeWeight.bold, color: '#0f172a', margin: '4px 0 1px 0', textTransform: 'uppercase', letterSpacing: '0.7px', lineHeight: '1' }}>
            Summative Assessment Report
          </h2>

          {/* Exam Name / Termly Details Inline Row */}
          <div style={{
            fontSize: '9.5px',
            fontWeight: pdfTypeWeight.semibold,
            color: brandingSettings?.brandColor || '#1E3A8A',
            textTransform: 'uppercase',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            letterSpacing: '0.5px'
          }}>
            <span>
              {Array.from(testTypesFound).map(formatTestName).join(', ')}
            </span>
            <span>{term ? (typeof term === 'string' ? term.replace(/_/g, ' ') : (term.label || '')) : 'TERM'} | {academicYear || new Date().getFullYear()}</span>
          </div>
        </div>
      </div>


      {/* Student Info + Summary Stats — 2-col header */}
      {(() => {
        const totalScore = tableRows.reduce((acc, r) => acc + r.totalScore, 0);
        const totalMax = tableRows.reduce((acc, r) => acc + r.totalMarks, 0);
        const avgPct = totalMax > 0 ? (totalScore / totalMax * 100).toFixed(0) : 0;
        const overallGrade = getGrade(parseFloat(avgPct)).grade;
        return (
          <div className="mb-3" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', border: '1px solid #dbe4ee', borderRadius: '4px', overflow: 'hidden', fontSize: '12px', lineHeight: '1.25' }}>
            {/* LEFT: Learner Info */}
            <div style={{ padding: '8px 14px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', alignContent: 'center', borderRight: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: pdfTypeWeight.semibold, color: '#64748b', fontSize: '10.5px' }}>NAME:</div>
              <div style={{ fontWeight: pdfTypeWeight.bold, color: '#0f172a', textTransform: 'uppercase' }}>{learner.firstName} {learner.lastName}</div>
              <div style={{ fontWeight: pdfTypeWeight.semibold, color: '#64748b', fontSize: '10.5px' }}>ADM NO:</div>
              <div style={{ fontWeight: pdfTypeWeight.bold, color: '#0f172a' }}>{learner.admissionNumber || '—'}</div>
              <div style={{ fontWeight: pdfTypeWeight.semibold, color: '#64748b', fontSize: '10.5px' }}>GRADE:</div>
              <div style={{ fontWeight: pdfTypeWeight.bold, textTransform: 'uppercase', color: '#1e40af' }}>{learner.grade?.replace(/_/g, ' ')}</div>
              <div style={{ fontWeight: pdfTypeWeight.semibold, color: '#64748b', fontSize: '10.5px' }}>STREAM:</div>
              <div style={{ fontWeight: pdfTypeWeight.bold, color: '#0f172a' }}>{learner.stream || 'A'}</div>
            </div>
            {/* RIGHT: Assessment Summary */}
            <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', height: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '8px 4px', textAlign: 'center', borderRight: '1.2px solid #e2e8f0', borderBottom: '1.2px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#f8fafc', gap: '2px' }}>
                  <div style={{ fontSize: '8px', fontWeight: pdfTypeWeight.semibold, color: '#64748b', textTransform: 'uppercase' }}>Subjects</div>
                  <div style={{ fontSize: '16px', fontWeight: pdfTypeWeight.bold, color: '#0f172a' }}>{tableRows.length}</div>
                </div>
                <div style={{ padding: '8px 4px', textAlign: 'center', borderBottom: '1.2px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#f8fafc', gap: '2px' }}>
                  <div style={{ fontSize: '8px', fontWeight: pdfTypeWeight.semibold, color: '#64748b', textTransform: 'uppercase' }}>Points</div>
                  <div style={{ fontSize: '16px', fontWeight: pdfTypeWeight.bold, color: '#0f172a' }}>{pointRows.length > 0 ? totalPoints : '—'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '8px 4px', textAlign: 'center', borderRight: '1.2px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
                  <div style={{ fontSize: '8px', fontWeight: pdfTypeWeight.semibold, color: '#64748b', textTransform: 'uppercase' }}>Average</div>
                  <div style={{ fontSize: '16px', fontWeight: pdfTypeWeight.bold, color: '#0f172a' }}>{avgPct}%</div>
                </div>
                <div style={{ padding: '8px 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#f1f5f9', gap: '2px' }}>
                  <div style={{ fontSize: '8px', fontWeight: pdfTypeWeight.semibold, color: '#1e40af', textTransform: 'uppercase' }}>Grade</div>
                  <div style={{ fontSize: '16px', fontWeight: pdfTypeWeight.bold, color: '#1e40af' }}>{overallGrade}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* === CONTENT BODY — grows to fill available space === */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>


        <table className="report-marks-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '6px' }}>
          <thead>
            <tr style={{ color: '#000000' }}>
              <th style={{ padding: '5px 10px', textAlign: 'left', fontWeight: pdfTypeWeight.title, border: '1.5px solid #dbe4ee', letterSpacing: '0.3px', backgroundColor: '#ffffff' }}>SUBJECT</th>
              {testColumns.map(col => (
                <th key={col} style={{ padding: '5px 6px', textAlign: 'center', fontWeight: pdfTypeWeight.title, border: '1.5px solid #dbe4ee', minWidth: '76px', whiteSpace: 'nowrap', letterSpacing: '0.3px', backgroundColor: '#ffffff' }}>
                  {formatTestName(col)}
                </th>
              ))}
              {testColumns.length > 1 && (
                <th style={{ padding: '5px 6px', textAlign: 'center', fontWeight: pdfTypeWeight.title, border: '1.5px solid #dbe4ee', minWidth: '64px', letterSpacing: '0.3px', backgroundColor: '#ffffff' }}>AVG %</th>
              )}
              <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: pdfTypeWeight.title, border: '1.5px solid #dbe4ee', borderLeft: '1.5px solid #dbe4ee', minWidth: '64px', letterSpacing: '0.3px', backgroundColor: '#ffffff' }}>GRADE</th>
              <th style={{ padding: '5px 6px', textAlign: 'center', fontWeight: pdfTypeWeight.title, border: '1.5px solid #dbe4ee', borderLeft: '1.5px solid #dbe4ee', borderRight: '1.5px solid #dbe4ee', minWidth: '44px', letterSpacing: '0.3px', backgroundColor: '#ffffff' }}>PTS</th>

            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => (
              <tr key={row.area} style={{ backgroundColor: 'white', borderBottom: '1.5px solid #e2e8f0' }}>
                <td style={{ padding: '6px 10px', fontWeight: pdfTypeWeight.bold, fontSize: '12px', color: '#0f172a', letterSpacing: '-0.1px', border: '1.5px solid #e2e8f0' }}>{row.area}</td>
                {testColumns.map(col => {
                  const score = row.scoresByCol[col];
                  const maxForCol = row.maxByCol[col];
                  const colGrade = score !== null && typeof maxForCol === 'number' && maxForCol > 0
                    ? getGrade((score / maxForCol) * 100).grade
                    : null;
                  return (
                    <td key={col} style={{ padding: '6px 6px', textAlign: 'center', border: '1.5px solid #e2e8f0' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: pdfTypeWeight.bold, lineHeight: '1.1', color: '#0f172a' }}>
                        {score !== null ? score : '—'}
                      </div>
                      {colGrade && (
                        <div style={{ fontSize: '8px', fontWeight: pdfTypeWeight.semibold, color: '#64748b', lineHeight: '1', marginTop: '1px', textTransform: 'uppercase' }}>{colGrade}</div>
                      )}
                    </td>
                  );
                })}
                {testColumns.length > 1 && (
                  <td style={{ padding: '6px 6px', textAlign: 'center', fontWeight: pdfTypeWeight.bold, fontSize: '13px', color: '#0f172a', border: '1.5px solid #e2e8f0' }}>{row.percentage}%</td>
                )}
                <td style={{ padding: '6px 6px', textAlign: 'left', fontWeight: pdfTypeWeight.bold, fontSize: '13px', color: row.color, border: '1.5px solid #e2e8f0', borderLeft: '1.5px solid #e2e8f0' }}>{row.grade}</td>
                <td style={{ padding: '6px 6px', textAlign: 'center', fontWeight: pdfTypeWeight.bold, fontSize: '13px', color: '#0f172a', border: '1.5px solid #e2e8f0', borderLeft: '1.5px solid #e2e8f0', borderRight: '1.5px solid #e2e8f0' }}>{row.points || '—'}</td>

              </tr>
            ))}
            {(() => {
              const overallTotalScore = tableRows.reduce((acc, r) => acc + r.totalScore, 0);
              const overallTotalMarks = tableRows.reduce((acc, r) => acc + r.totalMarks, 0);
              const overallAvgPct = overallTotalMarks > 0 ? Math.round((overallTotalScore / overallTotalMarks) * 100) : 0;
              const overallGradeResult = overallTotalMarks > 0 ? getGrade(overallAvgPct) : null;
              return tableRows.length > 0 && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td style={{ padding: '6px 10px', fontWeight: pdfTypeWeight.bold, fontSize: '13px', color: '#0f172a', border: '1.5px solid #e2e8f0' }}>
                    TOTAL
                  </td>
                  {testColumns.map(col => (
                    <td key={`total-${col}`} style={{ padding: '6px 6px', textAlign: 'center', fontWeight: pdfTypeWeight.bold, fontSize: '13px', color: '#0f172a', border: '1.5px solid #e2e8f0' }}>
                      {totalsByTestColumn[col].max > 0
                        ? `${totalsByTestColumn[col].score}/${totalsByTestColumn[col].max}`
                        : totalsByTestColumn[col].score}
                    </td>
                  ))}
                  {testColumns.length > 1 && (
                    <td style={{ padding: '6px 6px', textAlign: 'center', fontWeight: pdfTypeWeight.bold, fontSize: '13px', color: '#0f172a', border: '1.5px solid #e2e8f0' }}>
                      {overallAvgPct}%
                    </td>
                  )}
                  <td style={{ padding: '6px 6px', textAlign: 'left', fontWeight: pdfTypeWeight.bold, fontSize: '13px', color: overallGradeResult?.color || '#64748b', border: '1.5px solid #e2e8f0', borderLeft: '1.5px solid #e2e8f0' }}>
                    {overallGradeResult?.grade || '—'}
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'center', fontWeight: pdfTypeWeight.bold, fontSize: '13px', color: '#0f172a', border: '1.5px solid #e2e8f0', borderLeft: '1.5px solid #e2e8f0', borderRight: '1.5px solid #e2e8f0' }}>
                    {pointRows.length > 0 ? totalPoints : '—'}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>

        {/* Chart + Pathway Insight Section */}
        <div style={{ display: 'flex', gap: '30px', marginTop: '16px', marginBottom: '8px', alignItems: 'start', justifyContent: 'flex-start' }}>
          {/* LEFT: Bar Chart — Show for ALL grades */}
          <div style={{ width: '50%', minWidth: '340px', maxWidth: '50%' }}>
            <h3 style={{ fontSize: '10px', fontWeight: '800', color: '#111827', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', marginBottom: '6px', paddingBottom: '2px' }}>Subject Performance</h3>
            <div style={{ width: '100%' }}>
              {tableRows && tableRows.length > 0 ? (
                <div style={{
                  height: '114px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '12px',
                  padding: '12px 10px 18px 10px',
                  borderBottom: '0.8px solid #e2e8f0',
                  position: 'relative',
                  boxSizing: 'border-box',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                  colorAdjust: 'exact'
                }}>
                  {tableRows.map((row, i) => {
                    const barH = Math.max(4, Math.round((row.percentage / 100) * 88));
                    // Dynamically calculate bar width
                    // max-width of container is ~770 if full, 400 if half
                    const containerW = 370;
                    const barW = Math.max(14, Math.floor((containerW / tableRows.length) - 10));
                    return (
                      <div key={row.area} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: '100%'
                      }}>
                        {/* Score Label - Increased spacing from bar */}
                        <div style={{
                          fontSize: '9px',
                          fontWeight: '1000',
                          color: '#1e40af',
                          marginBottom: '6px',
                          fontFamily: "'Raleway', sans-serif",
                          background: 'white',
                          padding: '0 2px',
                          zIndex: 2
                        }}>
                          {row.percentage}%
                        </div>

                        {/* Bar */}
                        <div className="report-chart-bar" style={{
                          '--bar-color': CHART_COLORS[i % CHART_COLORS.length],
                          width: `${barW}px`,
                          height: `${barH}px`,
                          backgroundColor: 'var(--bar-color)',
                          border: `1px solid ${CHART_COLORS[i % CHART_COLORS.length]}`,
                          borderRadius: '3px 3px 0 0',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                          colorAdjust: 'exact'
                        }} />

                        {/* Subject Label (Absolute positioned below the baseline) */}
                        <div style={{
                          position: 'absolute',
                          bottom: '-16px',
                          fontSize: '8px',
                          fontWeight: '800',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          fontFamily: "'Raleway', sans-serif",
                          textAlign: 'center',
                          width: 'auto',
                          whiteSpace: 'nowrap'
                        }}>
                          {getAbbreviatedName(row.area).slice(0, 6)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', background: '#f8fafc', fontSize: '10px', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase' }}>No data</div>
              )}
            </div>
          </div>

          {/* RIGHT: Pathway Insight — ONLY FOR JUNIOR SECONDARY (GRADE 7, 8, 9) */}
          {(() => {
            if (!isJSS) return null;

            // Map each subject row to a pathway bucket
            const PATHWAY_MAP = {
              STEM: [
                'MATHEMATICS', 'MATH', 'MAT',
                'INTEGRATED SCIENCE', 'INT SCI', 'I-SCI',
                'SCIENCE AND TECHNOLOGY', 'SCITECH', 'SCIENCE & TECHNOLOGY',
                'PRE-TECHNICAL STUDIES', 'PRE-TECH', 'P-TECH',
                'AGRICULTURE', 'AGRI',
                'HOMESCIENCE', 'H SCI',
              ],
              SOCIAL: [
                'ENGLISH', 'ENG',
                'KISWAHILI', 'KIS',
                'SOCIAL STUDIES', 'SST',
                'RELIGIOUS EDUCATION', 'REL',
                'CHRISTIAN RELIGIOUS EDUCATION', 'CRE',
                'ISLAMIC RELIGIOUS EDUCATION', 'IRE', 'RE',
                'HISTORY', 'GEOGRAPHY',
              ],
              ARTS: [
                'CREATIVE ARTS AND SPORTS', 'CREATIVE', 'CREA',
                'CREATIVE ARTS & SPORTS',
                'ART AND CRAFT', 'ART',
                'MUSIC', 'MUS',
                'PHYSICAL AND HEALTH EDUCATION', 'PHE',
                'MOVEMENT AND CREATIVE ACTIVITIES',
              ],
            };

            const calcPathwayScore = (keywords) => {
              const matched = tableRows.filter(r =>
                keywords.some(k => r.area.toUpperCase().includes(k.toUpperCase()))
              );
              if (matched.length === 0) return { pct: null, subjects: '' };
              const total = matched.reduce((s, r) => s + r.totalScore, 0);
              const max = matched.reduce((s, r) => s + r.totalMarks, 0);
              return {
                pct: max > 0 ? Math.round((total / max) * 100) : null,
                subjects: matched.map(r => getAbbreviatedName(r.area)).join(', ')
              };
            };

            const stem = calcPathwayScore(PATHWAY_MAP.STEM);
            const social = calcPathwayScore(PATHWAY_MAP.SOCIAL);
            const arts = calcPathwayScore(PATHWAY_MAP.ARTS);

            const pathways = [
              { label: 'STEM', pct: stem.pct, subjects: stem.subjects, color: '#2563eb', bg: '#eff6ff' },
              { label: 'Social Sciences', pct: social.pct, subjects: social.subjects, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Arts & Sports', pct: arts.pct, subjects: arts.subjects, color: '#d97706', bg: '#fffbeb' },
            ];

            // Recommended pathway = highest scoring one
            const recommended = [...pathways]
              .filter(p => p.pct !== null)
              .sort((a, b) => b.pct - a.pct)[0];

            return (
              <div style={{ flex: 1, borderLeft: '1px solid #e2e8f0', paddingLeft: '24px' }}>
                <h3 style={{ fontSize: '10px', fontWeight: '800', color: '#111827', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', marginBottom: '8px', paddingBottom: '2px' }}>Pathways Insight</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
                  {pathways.map(p => (
                    <div key={p.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#374151', whiteSpace: 'nowrap' }}>{p.label}</span>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: p.pct !== null ? p.color : '#9ca3af' }}>
                          {p.pct !== null ? `${p.pct}%` : 'N/A'}
                          {recommended && p.label === recommended.label && (
                            <span style={{ marginLeft: '8px', fontSize: '9px', color: '#ef4444', fontWeight: '1000', textTransform: 'uppercase' }}>BEST FIT</span>
                          )}
                        </span>
                      </div>
                      <div style={{ height: '7px', background: '#f1f5f9', overflow: 'hidden', marginBottom: '4px', marginTop: '6px' }}>
                        <div style={{
                          height: '100%',
                          width: `${p.pct ?? 0}%`,
                          background: p.pct !== null ? p.color : '#e2e8f0'
                        }} />
                      </div>
                      {p.subjects && (
                        <div style={{ fontSize: '8px', color: '#9ca3af', fontStyle: 'italic', lineHeight: '1' }}>
                          ({p.subjects})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Grading Key — full width below */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '30px', marginBottom: '2px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#374151', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Grading Key</div>
            <table className="w-full page-break-inside-avoid" style={{ borderCollapse: 'collapse', tableLayout: 'fixed', borderTop: 'none' }}>
              <tbody>
                {[
                  [
                    { code: 'EE1', range: '90–100%', label: 'Outstanding' },
                    { code: 'EE2', range: '75–89%', label: 'Very High' },
                    { code: 'ME1', range: '58–74%', label: 'High Average' },
                    { code: 'ME2', range: '41–57%', label: 'Average' }
                  ],
                  [
                    { code: 'AE1', range: '31–40%', label: 'Low Average' },
                    { code: 'AE2', range: '21–30%', label: 'Below Average' },
                    { code: 'BE1', range: '11–20%', label: 'Low' },
                    { code: 'BE2', range: '0–10%', label: 'Very Low' }
                  ],
                ].map((rowItems, idx) => (
                  <tr key={idx}>
                    {rowItems.map(g => (
                      <td key={g.code} style={{ border: '1px solid #d1d5db', padding: '8px 10px', textAlign: 'left', backgroundColor: idx % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                        <div style={{ lineHeight: '1.2' }}>
                          <span style={{ fontWeight: '900', color: '#111827', fontSize: '12px', marginRight: '8px' }}>{g.code}</span>
                          <span style={{ fontWeight: '700', color: '#374151', fontSize: '11px' }}>{g.range}</span>
                        </div>
                        <div style={{ fontWeight: '600', color: '#6b7280', fontSize: '10px', marginTop: '3px' }}>
                          ({g.label})
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* School Stamp */}
          <div style={{ minWidth: '200px', textAlign: 'right', alignSelf: 'center', marginRight: '20px' }}>
            {(() => {
              const stampSrc = brandingSettings?.stampUrl || user?.school?.stampUrl || user?.schoolStamp || user?.stampUrl;
              if (!stampSrc) return null;
              return (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={stampSrc}
                    alt="School Stamp"
                    style={{ height: '140px', width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto', opacity: '0.9' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>OFFICIAL STAMP</div>
                </div>
              );
            })()}
          </div>
        </div>

      </div>{/* end CONTENT BODY */}

      {/* Class Teacher's Remarks — anchored just above the footer */}
      <div style={{ marginTop: 'auto', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Class Teacher's Remarks:
          </span>
          <div style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', paddingBottom: '2px', minHeight: '32px' }}>
            {/* Blank for handwriting as requested */}
          </div>
        </div>
      </div>

      {/* Footer Disclaimer - Absolute Bottom */}
      <div className="report-footer-note" style={{ position: 'absolute', bottom: '6mm', left: '8mm', right: '8mm', textAlign: 'center', fontSize: '10px', color: '#64748b', fontWeight: '400' }}>
        This is an official summative assessment report. Verified by School Administration System. © {new Date().getFullYear()} {getSchoolDisplayName(brandingSettings?.schoolName, user?.school?.name, { fallback: PRODUCT_DISPLAY_NAME })}.
      </div>
    </div >
  );
};


const SUMMATIVE_REPORT_TYPES = [
  { value: 'GRADE_REPORT', label: 'Grade Sheet' },
  { value: 'STREAM_REPORT', label: 'Stream Sheet' },
  { value: 'LEARNER_REPORT', label: 'Learner Sheet' },
];

const SummativeReport = ({ learners, onFetchLearners, brandingSettings, user, pageParams = {}, onNavigate }) => {
  const { showSuccess, showError, showInfo, showToast, toastMessage, toastType, hideNotification } = useNotifications();

  // Use centralized hooks for assessment state management
  const setup = useAssessmentSetup({ defaultTerm: getCurrentTerm() });

  const [selectedType, setSelectedType] = useState('LEARNER_REPORT');
  const [selectedTestGroups, setSelectedTestGroups] = useState([]);
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [streamConfigs, setStreamConfigs] = useState([]);
  const { grades: contextGrades } = useSchoolData();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);

  // ── DB-backed grading ranges ──────────────────────────────────────────────
  // Fetched once on mount. Passed to LearnerReportTemplate so grade calculations
  // use the school's configured ranges instead of the hardcoded thresholds.
  const [gradingRanges, setGradingRanges] = useState(null);

  useEffect(() => {
    gradingAPI.getSystems()
      .then(response => {
        // response is { data: [ { type, ranges: [...] } ] } or similar
        const systems = Array.isArray(response?.data) ? response.data
          : Array.isArray(response) ? response : [];
        const cbcSystem = systems.find(
          s => (s.type || s.name || '').toUpperCase().includes('CBC')
        );
        const ranges = cbcSystem?.ranges || cbcSystem?.gradingRanges || [];
        if (ranges.length > 0) setGradingRanges(ranges);
      })
      .catch(() => {
        // Non-fatal: component falls back to DEFAULT_CBC_RANGES silently
      });
  }, []);

  // Custom Tick component for wrapping long learning area names in charts
  const CustomXAxisTick = ({ x, y, payload }) => {
    const text = payload.value;
    if (!text) return null;

    // Split text by space and wrap into lines
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + word).length > 12) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    lines.push(currentLine.trim());

    return (
      <g transform={`translate(${x},${y})`}>
        {lines.map((line, index) => (
          <text
            key={index}
            x={0}
            y={index * 10}
            dy={10}
            textAnchor="middle"
            fill="#64748b"
            fontSize={8}
            fontWeight="bold"
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  const [statusMessage, setStatusMessage] = useState('');
  const [showTestGroupOptions, setShowTestGroupOptions] = useState(false);
  const [showTestOptions, setShowTestOptions] = useState(false);
  const [complianceCheckResult, setComplianceCheckResult] = useState(null);
  const [showComplianceDetails, setShowComplianceDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  // Bulk Actions State
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const bulkPrintAbortController = useRef(null);
  const [selectedReportRows, setSelectedReportRows] = useState([]); // Track selected rows for bulk action
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, active: false, success: 0, failed: 0 });
  const [singleDownloadData, setSingleDownloadData] = useState(null);
  const [bulkDownloadData, setBulkDownloadData] = useState(null);
  const [isSingleDownloading, setIsSingleDownloading] = useState(false);
  const [singleCommentData, setSingleCommentData] = useState(null);
  const [commentMap, setCommentMap] = useState({});
  const cellBorder = { border: '1px solid #d1d5db' };

  const reportRef = useRef(null);
  const testGroupRef = useRef(null);
  const testOptionsRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (testGroupRef.current && !testGroupRef.current.contains(event.target)) {
        setShowTestGroupOptions(false);
      }
      if (testOptionsRef.current && !testOptionsRef.current.contains(event.target)) {
        setShowTestOptions(false);
      }
      if (learnerOptionsRef.current && !learnerOptionsRef.current.contains(event.target)) {
        setShowLearnerOptions(false);
      }
      if (subjectOptionsRef.current && !subjectOptionsRef.current.contains(event.target)) {
        setShowSubjectOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (bulkPrintAbortController.current) {
        bulkPrintAbortController.current.abort();
      }
    };
  }, []);

  // Grade ordering for sorting (lowest to highest)
  const gradeOrder = [
    'CRECHE', 'RECEPTION', 'TRANSITION',
    'PLAYGROUP', 'PP1', 'PP2',
    'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6',
    'GRADE_7', 'GRADE_8', 'GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12'
  ];

  const [generateTrigger, setGenerateTrigger] = useState(0);

  // Apply staged filters to actual state
  const applyFilters = () => {
    if (stagedType === 'CUSTOM_REPORT') {
      if (typeof onNavigate === 'function') onNavigate('assess-custom-reports');
      else showInfo('Custom reports page is unavailable in this context.');
      return;
    }
    if (stagedType === 'DETAILED_REPORTS') {
      showInfo('Open Top / Bottom Performers under Reports & Growth for ranking reports.');
      return;
    }
    setSelectedType(stagedType);
    setSelectedGrade(stagedGrade);
    setSelectedStream(stagedStream);
    setSelectedTerm(stagedTerm);
    setSelectedTestGroups(stagedTestGroups);
    setSelectedTestIds(stagedTestIds);
    setSelectedLearnerIds(stagedLearnerIds);
    setSelectedSubjectNames(stagedSubjectNames);

    // Trigger handleGenerate after state has been set
    setGenerateTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (generateTrigger > 0) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateTrigger]);

  const handleToggleSelectRow = (idx) => {
    setSelectedReportRows(prev => {
      if (prev.includes(idx)) {
        return prev.filter(i => i !== idx);
      } else {
        return [...prev, idx];
      }
    });
  };

  const handleSelectAll = (total) => {
    if (selectedReportRows.length === total) {
      setSelectedReportRows([]);
    } else {
      setSelectedReportRows(Array.from({ length: total }, (_, i) => i));
    }
  };


  // Local learner fetching state
  const [fetchedReportLearners, setFetchedReportLearners] = useState([]);
  const [loadingLearners, setLoadingLearners] = useState(false);

  // SMS sending state
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [showSMSPreview, setShowSMSPreview] = useState(false);
  const [smsPreviewData, setSmsPreviewData] = useState(null);
  const [editedPhoneNumber, setEditedPhoneNumber] = useState('');
  const [showSMSBulkConfirm, setShowSMSBulkConfirm] = useState(false);
  const [smsProgress, setSmsProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // WhatsApp sending state
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [whatsAppProgress, setWhatsAppProgress] = useState({ current: 0, total: 0, status: '' });
  const [showWhatsAppConfirm, setShowWhatsAppConfirm] = useState(false);

  // General Notification Modal state
  const [notificationModal, setNotificationModal] = useState({ show: false, title: '', message: '', type: 'info' });

  // Local state for grade, stream, term selections (instead of relying on setup hook)
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(getCurrentTerm());

  // Staged filter state - filters only apply when button is clicked
  const [stagedType, setStagedType] = useState('LEARNER_REPORT');
  const [stagedGrade, setStagedGrade] = useState('');
  const [stagedStream, setStagedStream] = useState('');
  const [stagedTerm, setStagedTerm] = useState(getCurrentTerm());
  const [stagedAcademicYear, setStagedAcademicYear] = useState(getCurrentAcademicYear());
  const [stagedTestGroups, setStagedTestGroups] = useState([]);
  const [stagedTestIds, setStagedTestIds] = useState([]);
  const [stagedLearnerIds, setStagedLearnerIds] = useState([]);
  const [stagedSubjectNames, setStagedSubjectNames] = useState([]);

  // Get terms from hook
  const terms = setup.terms;
  const academicYear = setup.academicYear;

  // Selection mappings - use local state for learner selection
  const [selectedLearnerIds, setSelectedLearnerIds] = useState([]);
  const [showLearnerOptions, setShowLearnerOptions] = useState(false);
  const [selectedSubjectNames, setSelectedSubjectNames] = useState([]);
  const [showSubjectOptions, setShowSubjectOptions] = useState(false);
  const learnerOptionsRef = useRef(null);
  const subjectOptionsRef = useRef(null);
  const initializedFromParamsRef = useRef(false);

  // Helper to normalize strings for comparison (e.g., "Grade 1" -> "GRADE_1")
  const normalize = (str) => {
    if (!str) return '';
    return String(str).trim().replace(/\s+/g, '_').toUpperCase();
  };

  useEffect(() => {
    if (initializedFromParamsRef.current) return;
    initializedFromParamsRef.current = true;

    if (pageParams?.grade) {
      const grade = normalize(pageParams.grade);
      setStagedGrade(grade);
      setSelectedGrade(grade);
    }

    if (pageParams?.stream) {
      const stream = String(pageParams.stream);
      setStagedStream(stream);
      setSelectedStream(stream);
    }

    if (pageParams?.term) {
      const term = normalize(pageParams.term);
      if (['TERM_1', 'TERM_2', 'TERM_3'].includes(term)) {
        setStagedTerm(term);
        setSelectedTerm(term);
      }
    }

    if (pageParams?.academicYear && !Number.isNaN(Number(pageParams.academicYear))) {
      setStagedAcademicYear(Number(pageParams.academicYear));
      setup.setSelectedAcademicYear(Number(pageParams.academicYear));
    }
    if (pageParams?.reportType && SUMMATIVE_REPORT_TYPES.some((type) => type.value === pageParams.reportType)) {
      setStagedType(pageParams.reportType);
    }
  }, [pageParams, setup]);

  // Dynamic learner fetching whenever grade or stream changes
  useEffect(() => {
    const fetchReportLearners = async () => {
      // If grade is not selected, we don't fetch specific learners
      if (!stagedGrade || stagedGrade === 'all') {
        setFetchedReportLearners([]);
        return;
      }

      try {
        setLoadingLearners(true);
        const params = {
          grade: stagedGrade,
          limit: 1000 // Ensure we get all students for the grade
        };
        if (stagedStream && stagedStream !== 'all') params.stream = stagedStream;

        const response = await api.learners.getAll(params);

        if (response.success) {
          const data = response.data || [];
          setFetchedReportLearners(data.sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
          ));
        }
      } catch (err) {
        console.error('❌ Error fetching learners in SummativeReport:', err);
      } finally {
        setLoadingLearners(false);
      }
    };

    fetchReportLearners();
  }, [stagedGrade, stagedStream]);

  // Filter learners by grade and stream - Properly named useMemo
  const filteredLearners = useMemo(() => {
    // Priority: Use locally fetched learners if we have a grade selection
    if (stagedGrade && stagedGrade !== 'all' && fetchedReportLearners.length > 0) {
      return fetchedReportLearners;
    }

    // Fallback: Use the learners prop passed from parent (limited to 50)
    if (!learners || learners.length === 0) return [];

    return learners.filter(l => {
      // Filter by grade
      if (stagedGrade && stagedGrade !== 'all') {
        if (normalize(l.grade) !== normalize(stagedGrade)) return false;
      }

      // Filter by stream
      if (stagedStream && stagedStream !== 'all') {
        if (normalize(l.stream) !== normalize(stagedStream)) return false;
      }

      return true;
    }).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [learners, fetchedReportLearners, stagedGrade, stagedStream]);

  // Fetch learners on component mount
  useEffect(() => {
    if (onFetchLearners && typeof onFetchLearners === 'function') {
      onFetchLearners();
    } else {
      console.warn('⚠️ onFetchLearners not available or not a function');
    }
  }, [onFetchLearners]);

  // Fetch grades from backend (Source of Truth)
  useEffect(() => {
    if (contextGrades && contextGrades.length > 0) {
      const formattedGrades = contextGrades.map(g => ({
        value: g,
        label: g.replace(/_/g, ' ')
      }));
      setGrades(formattedGrades);
    }
  }, [contextGrades]);

  // Fetch stream configurations from backend (Source of Truth)
  // Single-tenant: no schoolId needed, backend knows which school context
  useEffect(() => {
    const fetchStreamConfigs = async () => {
      try {

        const response = await configAPI.getStreamConfigs();


        const configs = Array.isArray(response) ? response : (response?.data ? response.data : []);

        if (configs.length === 0) {
          console.warn('⚠️ No stream configs returned from API');
        } else {
        }

        setStreamConfigs(configs || []);
      } catch (err) {
        console.error('❌ Error fetching stream configs:', err);
        console.error('   Error message:', err.message);
        console.error('   Error response:', err.response?.data);
        setStreamConfigs([]);
      }
    };

    if (user) {
      fetchStreamConfigs();
    } else {
    }
  }, [user]);

  // Monitor learners prop changes
  useEffect(() => {
    if (learners && learners.length > 0) {
    } else {
      // If no learners after a delay, try to fetch them again
      const timer = setTimeout(() => {
        if (!learners || learners.length === 0) {
          console.warn('⚠️ Still no learners after 2 seconds, retrying fetch...');
          if (onFetchLearners && typeof onFetchLearners === 'function') {
            onFetchLearners();
          }
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [learners, onFetchLearners]);

  // Fetch tests when grade, term or year changes - use local state
  useEffect(() => {
    const fetchTests = async () => {
      try {
        const params = {
          term: stagedTerm,
          academicYear: academicYear // from setup hook or local
        };

        if (stagedGrade && stagedGrade !== 'all') {
          params.grade = stagedGrade;
        }

        const res = await api.assessments.getTests(params);

        if (res.success) {
          // Reset selections when available tests change significantly
          setStagedTestGroups([]);
          setStagedTestIds([]);
          setStagedSubjectNames([]);

          setAvailableTests(res.data || []);
        }
      } catch (err) {
        console.error('Fetch tests error:', err);
      }
    };
    fetchTests();
  }, [stagedGrade, stagedTerm, academicYear]);

  // Helper to extract group from test
  const getTestGroup = (test) => {
    return resolveTestGroup(test);
  };

  // Derive unique test groups (testType) from available tests
  const availableTestGroups = useMemo(() => {
    if (!availableTests || availableTests.length === 0) {
      return [];
    }

    // Get unique test types/groups from all available tests (removed results count filter)
    const groupsSet = new Set();
    availableTests.forEach(t => {
      groupsSet.add(getTestGroup(t));
    });

    const groups = Array.from(groupsSet);
    return groups.sort(compareTestGroups);
  }, [availableTests]);

  const groupDateStampMap = useMemo(() => {
    const map = {};
    if (!availableTests || availableTests.length === 0) return map;

    availableTests.forEach((test) => {
      const group = getTestGroup(test);
      if (!group) return;
      const ts = new Date(test?.testDate || test?.updatedAt || test?.createdAt || 0).getTime();
      const prev = map[group] ? new Date(map[group]).getTime() : 0;
      if (ts > prev) {
        map[group] = test?.testDate || test?.updatedAt || test?.createdAt || '';
      }
    });

    return map;
  }, [availableTests]);

  // Derive tests within the selected test group(s)
  const testsInGroups = useMemo(() => {
    // Show all tests, even those without results (removed results count filter)
    if (!stagedTestGroups || stagedTestGroups.length === 0) {
      // If no groups selected, show all tests
      return availableTests;
    }

    const filtered = availableTests.filter(t => {
      return stagedTestGroups.includes(getTestGroup(t));
    });
    return filtered;
  }, [availableTests, stagedTestGroups]);

  const formatAnalysisTestLabel = (test) => {
    if (!test) return 'Select Test';
    const subject = formatSubjectName(String(test.learningArea || 'Test').trim());
    const title = String(test.title || formatTestName(getTestGroup(test)) || '').trim();
    return title && normalize(title) !== normalize(subject)
      ? `${subject} - ${title}`
      : subject;
  };

  const selectedAnalysisTest = useMemo(() => {
    if (!stagedTestIds.length) return null;
    return (testsInGroups || availableTests || []).find((test) => test.id === stagedTestIds[0]) || null;
  }, [stagedTestIds, testsInGroups, availableTests]);

  // Derive unique streams from stream configurations (Source of Truth)
  // Falls back to learner streams if configs not loaded yet
  const availableStreams = useMemo(() => {

    // Priority 1: Use official stream configs if available
    if (streamConfigs && streamConfigs.length > 0) {
      const activeStreams = streamConfigs
        .filter(s => s.active !== false)  // Include by default if not explicitly set to false
        .map(s => ({
          id: s.id,
          name: s.name,  // Full name like "ABC&D"
          value: s.name
        }));

      return activeStreams;
    }

    // Fallback: Extract from learners if configs haven't loaded yet
    if (!learners || learners.length === 0) {
      return [];
    }

    let filtered = learners;
    if (selectedGrade !== 'all') {
      filtered = learners.filter(l => l.grade === selectedGrade);
    }

    const learnerStreams = Array.from(new Set(filtered.map(l => l.stream).filter(Boolean)));

    return learnerStreams.map(s => ({
      id: s,
      name: s,
      value: s
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [streamConfigs, learners, selectedGrade]);

  const handleExportJPEG = async () => {
    if (!reportData) {
      showError('No report data to export. Please generate a report first.');
      return;
    }
    if (isExporting) return;

    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const learner = reportData.learner || reportData.rows?.[0]?.learner;
      const filename = learner
        ? `${learner.firstName}_${learner.lastName}_Report_${timestamp}.jpg`
        : `Summative_Report_${timestamp}.jpg`;

      const result = await generateJPEG(
        'single-print-content',
        filename,
        (msg) => { setPdfProgress(msg); }
      );

      if (result?.success) {
        showSuccess('Report saved as JPEG!');
      } else {
        showError(result?.error || 'JPEG export failed');
      }
    } catch (err) {
      console.error('JPEG export error:', err);
      showError(err?.message || 'Failed to export JPEG. Please try again.');
    } finally {
      setIsExporting(false);
      setPdfProgress('');
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) {
      showError(
        'No report data to export. Please generate a report first by clicking the "Generate Report" button.'
      );
      return;
    }
    if (isExporting) return;

    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = `Summative_Report_${timestamp}.pdf`;

      if (reportData.learner) {
        filename = `${reportData.learner.firstName}_${reportData.learner.lastName}_Summative_Report_${timestamp}.pdf`;
      } else if (reportData.title) {
        filename = `${reportData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
      }



      const reportType = reportData?.type;
      const isBroadsheetReport =
        reportType === 'GRADE_REPORT' ||
        reportType === 'STREAM_REPORT' ||
        reportType === 'STREAM_RANKING_REPORT';
      const isSingleLearnerReport =
        reportType === 'LEARNER_REPORT' ||
        reportType === 'LEARNER_TERMLY_REPORT' ||
        Boolean(reportData?.learner) ||
        (Array.isArray(reportData?.rows) && reportData.rows.length === 1);

      const targetId = isSingleLearnerReport ? 'single-print-content' : 'summative-report-content';
      const result = await pdfPrintWindow(targetId, {
        title: filename,
        autoPrint: true,
        fitToSinglePage: isSingleLearnerReport,
        orientation: isBroadsheetReport ? 'landscape' : 'portrait',
        onProgress: (msg) => { setPdfProgress(msg); }
      });

      if (result?.success) {
        showSuccess('Print dialog opened. Choose "Save as PDF" for best quality.');
      } else {
        showError(result?.error || 'Unable to open print preview');
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showError(err?.message || 'Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setPdfProgress('');
    }
  };

  const handlePrintPDF = async () => {
    if (!reportData) return;
    setIsExporting(true);
    try {
      setPdfProgress('Opening print preview...');
      const reportType = reportData?.type;
      const isBroadsheetReport =
        reportType === 'GRADE_REPORT' ||
        reportType === 'STREAM_REPORT' ||
        reportType === 'STREAM_RANKING_REPORT';
      const isSingleLearnerReport =
        reportType === 'LEARNER_REPORT' ||
        reportType === 'LEARNER_TERMLY_REPORT' ||
        Boolean(reportData?.learner) ||
        (Array.isArray(reportData?.rows) && reportData.rows.length === 1);
      const targetId = isSingleLearnerReport ? 'single-print-content' : 'summative-report-content';
      const result = await pdfPrintWindow(
        targetId,
        {
          onProgress: (msg) => setPdfProgress(msg),
          autoPrint: true,
          fitToSinglePage: isSingleLearnerReport,
          orientation: isBroadsheetReport ? 'landscape' : 'portrait'
        }
      );
      if (result?.success) {
        showSuccess('Print dialog opened. Use Save as PDF for a crisp copy.');
      } else {
        showError(result?.error || 'Failed to open print preview');
      }
    } catch (err) {
      console.error('Print error:', err);
      showError('Failed to open high-fidelity print preview');
    } finally {
      setIsExporting(false);
      setPdfProgress('');
    }
  };

  const formatBroadsheetNumber = (value, decimals = 1) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '-';
    const rounded = Number(numericValue.toFixed(decimals));
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals);
  };

  const getBroadsheetSummaryRows = (data = reportData) => {
    if (!data?.rows?.length || !data?.subjects?.length) return [];

    const rows = data.rows;
    const subjects = data.subjects;
    const summaries = data.subjectSummaries || {};
    const totalScore = rows.reduce((sum, row) => sum + (Number(row.totalScore) || 0), 0);
    const meanTotal = totalScore / rows.length;
    const meanAveragePct = rows.reduce((sum, row) => sum + (Number(row.averagePct) || 0), 0) / rows.length;

    const getGradeForPct = (pct) => {
      const value = parseFloat(pct);
      if (isNaN(value) || value <= 0) return { grade: '—', points: '—' };
      const result = getCBCGrade(value);
      return { grade: result.grade, points: result.points };
    };

    const totalSubjectGrade = subjects.map((subject) => getGradeForPct(summaries[subject]?.averagePct));
    const overallGrade = getGradeForPct(meanAveragePct);

    return [
      {
        key: 'total',
        label: 'TOTAL',
        subjectValues: subjects.map((subject) => formatBroadsheetNumber(summaries[subject]?.total || 0, 1)),
        total: formatBroadsheetNumber(totalScore, 1),
        average: '-',
      },
      {
        key: 'grade',
        label: 'GRADE',
        subjectValues: subjects.map((subject) => getGradeForPct(summaries[subject]?.averagePct).grade),
        total: '-',
        average: overallGrade.grade,
      },
      {
        key: 'average',
        label: 'AVG %',
        subjectValues: subjects.map((subject) => `${formatBroadsheetNumber(summaries[subject]?.averagePct || 0, 1)}%`),
        total: '-',
        average: `${formatBroadsheetNumber(meanAveragePct, 1)}%`,
      },
      {
        key: 'points',
        label: 'PTS',
        subjectValues: subjects.map((subject) => String(getGradeForPct(summaries[subject]?.averagePct).points)),
        total: '-',
        average: String(overallGrade.points),
        meanPts: (() => {
          const validPts = rows.map((r) => r.meritPoints).filter((p) => typeof p === 'number');
          if (!validPts.length) return '-';
          return String(Math.round(validPts.reduce((a, b) => a + b, 0) / validPts.length));
        })(),
      },
      {
        key: 'rank',
        label: 'RANK',
        // subjects are already sorted highest → lowest avg%, so rank is 1-based index
        subjectValues: subjects.map((_, idx) => `${idx + 1}`),
        total: '-',
        average: '-',
      },
    ];
  };

  const handleExportBroadsheetExcel = async () => {
    if (!reportData?.rows?.length || !reportData?.subjects?.length) {
      showError('No broadsheet data to export');
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Broadsheet', {
        pageSetup: {
          orientation: 'landscape',
          paperSize: 9, // A4
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
        }
      });

      const subjectHeaders = reportData.subjects.map((s) => getAbbreviatedName(s));
      const headers = ['#', 'LEARNER NAME', ...subjectHeaders, 'TOTAL', 'AVG %', 'GRD', 'PTS'];
      const totalColumns = headers.length;
      const lastColLetter = worksheet.getColumn(totalColumns).letter;
      const schoolName = getSchoolDisplayName(brandingSettings?.schoolName, user?.school?.name, { fallback: PRODUCT_DISPLAY_NAME }).toUpperCase();
      const brandColor = brandingSettings?.brandColor || 'FF1E3A8A';
      const reportTitle = (reportData?.title || 'GRADE REPORT').toUpperCase();
      const streamLabel = reportData?.meta?.stream && reportData.meta.stream !== 'all' ? reportData.meta.stream : 'ALL';
      const headerMeta = `CLASS: ${(reportData?.meta?.grade || '').replace(/_/g, ' ')} ${streamLabel} | TERM: ${(reportData?.meta?.term || '').replace(/_/g, ' ')} | GENERATED: ${new Date().toLocaleDateString()}`;

      // Logo + School Header
      const logoUrl = brandingSettings?.logoUrl || user?.school?.logoUrl || user?.school?.logo || user?.schoolLogo || user?.logoUrl;
      if (logoUrl) {
        try {
          const logoImg = new Image();
          logoImg.src = logoUrl;
          worksheet.mergeCells(`A1:${lastColLetter}1`);
          worksheet.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };

          // Insert logo image at cell A1
          const logoId = workbook.addImage({
            base64: logoUrl.split(',')[1] || logoUrl,
            extension: 'png',
          });
          worksheet.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: 80, height: 80 },
            editAs: 'oneCell',
          });
        } catch (e) {
          console.warn('Could not embed logo in Excel export', e);
        }
      }

      worksheet.mergeCells(`A2:${lastColLetter}2`);
      worksheet.getCell('A2').value = schoolName;
      worksheet.getCell('A2').font = { bold: true, size: 18, color: { argb: brandColor } };
      worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`A3:${lastColLetter}3`);
      worksheet.getCell('A3').value = reportTitle;
      worksheet.getCell('A3').font = { bold: true, size: 13, color: { argb: 'FF111827' } };
      worksheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`A4:${lastColLetter}4`);
      worksheet.getCell('A4').value = headerMeta;
      worksheet.getCell('A4').font = { bold: true, size: 10, color: { argb: 'FF475569' } };
      worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`A5:${lastColLetter}5`);
      worksheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      worksheet.getRow(5).height = 4;

      const tableHeaderRow = 6;
      worksheet.getRow(tableHeaderRow).values = headers;

      reportData.rows.forEach((row) => {
        const subjectValues = reportData.subjects.map((subj) => row.subjectScores[subj] ?? '-');
        worksheet.addRow([
          row.position,
          `${row.learner.firstName} ${row.learner.lastName}`,
          ...subjectValues,
          Math.round(row.totalScore),
          Number(row.averagePct) / 100,
          row.grade || '',
          row.meritPoints ?? ''
        ]);
      });

      const summaryRows = getBroadsheetSummaryRows(reportData);
      summaryRows.forEach((summaryRow) => {
        worksheet.addRow([
          '',
          summaryRow.label,
          ...summaryRow.subjectValues,
          summaryRow.total,
          summaryRow.average,
          '',
          summaryRow.key === 'points' ? (summaryRow.meanPts ?? '') : ''
        ]);
      });

      worksheet.columns = headers.map((h, idx) => ({
        header: h,
        key: `c${idx}`,
        width: idx === 1 ? 32 : 10
      }));

      worksheet.getRow(tableHeaderRow).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      worksheet.eachRow((r, rowNumber) => {
        if (rowNumber <= tableHeaderRow) return;
        const isSummaryRow = rowNumber > tableHeaderRow + reportData.rows.length;
        r.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFBFC7D4' } },
            left: { style: 'thin', color: { argb: 'FFBFC7D4' } },
            bottom: { style: 'thin', color: { argb: 'FFBFC7D4' } },
            right: { style: 'thin', color: { argb: 'FFBFC7D4' } }
          };
          if (colNumber !== 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          if (isSummaryRow) {
            cell.font = { bold: true, color: { argb: 'FF111827' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          }
        });
      });

      const avgCol = headers.indexOf('AVG %') + 1;
      worksheet.getColumn(avgCol).numFmt = '0.0%';
      worksheet.views = [{ state: 'frozen', ySplit: tableHeaderRow }];

      const ts = new Date().toISOString().split('T')[0];
      const fileName = `Broadsheet_${reportData?.meta?.grade || 'Grade'}_${reportData?.meta?.stream || 'All'}_${ts}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSuccess('Broadsheet exported to Excel (landscape print setup).');
    } catch (err) {
      console.error('Excel export error:', err);
      showError('Failed to export broadsheet Excel.');
    }
  };

  /**
   * Helper to format SMS message for a row
   */
  const formatSmsReport = (row) => {
    const learner = row.learner;
    // 1. Data Preparation (Priority: Parent/Guardian -> Parent)
    const parentName = learner.guardianName || learner.parent?.firstName || 'Parent';
    const termLabel = terms.find(t => t.value === selectedTerm)?.label || selectedTerm;
    const schoolName = getSchoolDisplayName(brandingSettings?.schoolName, user?.school?.name, { fallback: PRODUCT_DISPLAY_NAME });

    const results = row.results || [];
    const totalMarks = results.reduce((sum, r) => sum + (r.score || 0), 0);
    const maxPossibleMarks = results.reduce((sum, r) => sum + (r.totalMarks || 0), 0);
    const averageScore = row.averageScore || row.averagePct || (maxPossibleMarks > 0 ? ((totalMarks / maxPossibleMarks) * 100).toFixed(1) : 0);
    const { grade: overallGrade } = getCBCGrade(parseFloat(averageScore));

    const processedSmsTests = new Set();
    const { pathways, recommended } = calculatePathwayInsights(results);

    const subjects = results.reduce((acc, r) => {
      const area = (r.learningArea || r.test?.learningArea || 'General').trim().toUpperCase();
      if (!acc[area]) acc[area] = { score: 0, total: 0 };
      acc[area].score += (r.score || 0);
      acc[area].total += (r.totalMarks || 0);
      return acc;
    }, {});

    const subjectsList = Object.entries(subjects).map(([name, detail]) => {
      const shortName = getAbbreviatedName(name);
      const pct = detail.total > 0 ? Math.round((detail.score / detail.total) * 100) : 0;
      const { grade } = getCBCGrade(pct);
      return `${shortName}: ${pct}% ${grade.replace(/\d+/g, '')}`;
    }).join('\n');

    const pathwayText = pathways
      .filter(p => p.pct !== null)
      .map(p => `${p.label.substring(0, 4)}: ${p.pct}%`)
      .join(', ');

    return `${schoolName.toUpperCase()}\n` +
      `Official Assessment Report\n\n` +
      `Dear ${parentName},\n` +
      `Summary for ${learner.firstName} ${learner.lastName} (${termLabel}):\n\n` +
      `${subjectsList}\n\n` +
      `AVERAGE: ${averageScore}% ${overallGrade.replace(/\d+/g, '')}\n` +
      (recommended ? `BEST FIT: ${recommended.label.toUpperCase()}\n(${pathwayText})\n` : '') +
      `Status: ${overallGrade.replace(/\d+/g, '')}`;
  };

  const handleSendSMS = async (directRow = null) => {
    const row = (directRow && directRow.learner) ? directRow : (reportData?.type === 'LEARNER_REPORT' || reportData?.type === 'LEARNER_TERMLY_REPORT' ? reportData : null);

    if (!row) {
      showError('Learner information not available');
      return;
    }

    let learner = row.learner;
    if (!learner) {
      showError('Learner information not available');
      return;
    }

    // Fix stale number by fetching latest (addresses user request)
    try {
      const latest = await api.learners.getById(learner.id);
      const unpackedLearner = latest?.data || latest;
      if (unpackedLearner && unpackedLearner.id) {
        learner = unpackedLearner;
        // Optionally update the row object if it's from the table
        if (directRow) {
          directRow.learner = unpackedLearner;
        }
      }
    } catch (e) {
      console.warn("Could not fetch latest learner contact, using row data", e);
    }

    // Get parent phone from learner data (Priority: Guardian -> Parent)
    const parentPhone = getLearnerPhone(learner);
    const parentName = learner.guardianName || learner.parent?.firstName || 'Parent';
    const termLabel = terms.find(t => t.value === selectedTerm)?.label || selectedTerm;
    const contactOptions = getLearnerContactOptions(learner);

    // Proceed to SMS preview even if phone is missing (user can enter it)
    const message = formatSmsReport(row);

    setEditedPhoneNumber(parentPhone); // Initialize edit field
    setSmsPreviewData({
      recipient: parentPhone,
      parentName: parentName,
      learnerName: `${learner.firstName} ${learner.lastName}`,
      message: message,
      termLabel: termLabel,
      learnerId: learner.id, // Store learner ID for tracking
      contactOptions: contactOptions
    });
    setShowSMSPreview(true);
  };



  /**
   * Send summary via WhatsApp - Clean Rewrite to avoid duplication
   */
  const handleSendWhatsApp = async (directRow = null) => {
    // 0. Argument handling: if called as an onClick without params, directRow is an Event
    const row = (directRow && directRow.learner) ? directRow : (reportData?.type === 'LEARNER_REPORT' || reportData?.type === 'LEARNER_TERMLY_REPORT' ? reportData : null);

    if (!row) {
      showError('Learner information not available');
      return;
    }

    const currentLearner = row.learner;
    if (!currentLearner) {
      showError('Learner details missing');
      return;
    }

    // Refresh contact info for WhatsApp too
    let learnerObj = currentLearner;
    try {
      const latest = await api.learners.getById(currentLearner.id);
      const unpacked = latest?.data || latest;
      if (unpacked && unpacked.id) {
        learnerObj = unpacked;
      }
    } catch (e) {
      console.warn("Could not fetch latest learner contact for WhatsApp", e);
    }

    // 1. Data Preparation (Priority: Guardian -> Parent)
    const parentPhone = getLearnerPhone(learnerObj);
    const parentName = learnerObj.guardianName || learnerObj.parent?.firstName || 'Parent';
    const termLabel = terms.find(t => t.value === selectedTerm)?.label || selectedTerm;
    const schoolName = getSchoolDisplayName(brandingSettings?.schoolName, user?.school?.name, { fallback: PRODUCT_DISPLAY_NAME });

    const results = row.results || [];

    // Aggregate results by area (to avoid duplicates in the WhatsApp message)
    // and normalize area names to avoid nearly-identical keys
    const { pathways, recommended } = calculatePathwayInsights(results);

    const areaSummary = {};
    const processedTests = new Set();

    results.forEach(r => {
      const resultKey = r.id || `${r.testId}-${r.score}`;
      if (processedTests.has(resultKey)) return;
      processedTests.add(resultKey);

      const area = (r.learningArea || 'General').trim().toUpperCase();
      if (!areaSummary[area]) areaSummary[area] = { score: 0, total: 0 };
      areaSummary[area].score += (r.score || 0);
      areaSummary[area].total += (r.totalMarks || 0);
    });

    const tableRows = Object.keys(areaSummary).map(area => {
      const summary = areaSummary[area];
      const percentage = summary.total > 0 ? (summary.score / summary.total) * 100 : 0;
      const { grade } = getCBCGrade(percentage);
      return {
        area,
        pct: Math.round(percentage),
        grade
      };
    }).sort((a, b) => a.area.localeCompare(b.area));

    const totalMarks = results.reduce((sum, r) => sum + (r.score || 0), 0);
    const maxPossibleMarks = results.reduce((sum, r) => sum + (r.totalMarks || 0), 0);
    const averageScore = row.averageScore || (maxPossibleMarks > 0 ? ((totalMarks / maxPossibleMarks) * 100).toFixed(1) : 0);
    const { grade: overallGrade } = getCBCGrade(parseFloat(averageScore));

    const subjectsListText = tableRows.map(r => {
      const name = getAbbreviatedName(r.area).toUpperCase().padEnd(10).slice(0, 10);
      const score = (r.pct + "%").padStart(5);
      const grade = r.grade.replace(/\d+/g, '').padStart(5);
      return `${name}|${score} |${grade}`;
    }).join('\n');

    const tableHeader = `SUBJECT   |  SCR |  GRD`;
    const separator = `----------|-----|----`;

    const avgLabel = "AVERAGE".padEnd(10);
    const avgScore = (averageScore + "%").padStart(6);
    const avgGrade = overallGrade.replace(/\d+/g, '').padStart(4);
    const avgRow = `${avgLabel}|${avgScore}|${avgGrade}`;

    // 3. Construct the Final Message (Matching user request)
    const waMessage =
      `*${schoolName.toUpperCase()}*\n` +
      `_Official Assessment Report_\n\n` +
      `Dear *${parentName}*,\n` +
      `Assessment summary for\n*${learnerObj.firstName || ''} ${learnerObj.lastName || ''}* (*${termLabel}*):\n\n` +
      `\`\`\`\n` +
      `${tableHeader}\n` +
      `${separator}\n` +
      `${subjectsListText}\n` +
      `${separator}\n` +
      `${avgRow}\n` +
      `\`\`\`\n\n` +
      `*Average Grade:* ${overallGrade.replace(/\d+/g, '')}\n` +
      (recommended ? `*BEST FIT: ${recommended.label.toUpperCase()}*\n` +
        pathways.filter(p => p.pct !== null).map(p => `-${p.label}: ${p.pct}%`).join('\n') + '\n\n' : '') +
      `_Generated on ${new Date().toLocaleDateString()}_`;

    // 3.5 Use Backend API to send with image attachment
    setIsSendingWhatsApp(true);
    setPdfProgress('Capturing report for WhatsApp...');
    try {
      const element = document.getElementById('single-print-content');
      if (!element) throw new Error("Report element not found");

      // Generate JPEG base64 on frontend
      // captureElement uses the shared options (scale=3, font-ready, etc.)
      const canvas = await captureElement(element);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      setPdfProgress('Sending via WhatsApp...');

      const subjectsPayload = {};
      tableRows.forEach(r => {
        subjectsPayload[r.area] = { score: r.pct, grade: r.grade };
      });

      const payload = {
        learnerId: learnerObj.id,
        learnerName: `${learnerObj.firstName || ''} ${learnerObj.lastName || ''}`,
        learnerGrade: learnerObj.grade,
        parentPhone: parentPhone,
        parentName: parentName,
        term: selectedTerm,
        academicYear: setup.academicYear,
        totalTests: results.length,
        averageScore: averageScore,
        overallGrade: overallGrade,
        subjects: subjectsPayload,
        pathwayPrediction: row.pathwayPrediction,
        reportImageBase64: base64Image // Send the pre-rendered image string
      };

      const result = await api.notifications.sendAssessmentReportWhatsApp(payload);

      if (result?.success || result?.message === 'WhatsApp sent') {
        showSuccess('WhatsApp sent successfully with the report image!');
        if (reportData?.rows) {
          setReportData(prev => ({
            ...prev,
            rows: prev.rows.map(r => r.learner.id === learnerObj.id
              ? { ...r, communication: { ...r.communication, hasSentWhatsApp: true, lastWhatsAppAt: new Date() } }
              : r)
          }));
        }
      } else {
        throw new Error(result?.error || 'Failed to send WhatsApp message');
      }
    } catch (e) {
      console.error('WhatsApp dispatch error:', e);
      
      const status = e?.response?.status;
      const errorMsg = e?.response?.data?.message || e.message;
      
      if (status === 503 || errorMsg?.includes('initializing')) {
        showError('WhatsApp is starting up. Please wait a moment for the connection to stabilize, then try again.', { duration: 5000 });
      } else if (status === 401 || errorMsg?.includes('qr_needed')) {
        showError(
          <div>
            WhatsApp needs authentication.<br/>
            Please go to <strong>WhatsApp Settings</strong> to scan the QR code.
          </div>, 
          { duration: 6000 }
        );
      } else {
        showError(errorMsg || 'Failed to send WhatsApp message. Is the system WhatsApp connected?');
      }
    } finally {
      setIsSendingWhatsApp(false);
      setPdfProgress('');
    }
  };



  /**
   * Bulk SMS Handler - Shows confirmation modal
   */
  const handleBulkSMS = async () => {
    if (!reportData?.rows || reportData.rows.length === 0) {
      showError('No learners to send SMS to');
      return;
    }

    // Show confirmation modal instead of browser alert
    setShowSMSBulkConfirm(true);
  };

  /**
   * Execute Bulk SMS - Called after user confirms in modal
   */
  const executeBulkSMS = async (testNumber = null) => {
    setShowSMSBulkConfirm(false);

    // Determine target rows (selected or all)
    const rowsToProcess = selectedReportRows.length > 0
      ? selectedReportRows.map(idx => reportData.rows[idx])
      : reportData.rows;

    setBulkProgress({ current: 0, total: rowsToProcess.length, active: true, success: 0, failed: 0 });
    const total = rowsToProcess.length;

    for (let i = 0; i < total; i++) {
      const row = rowsToProcess[i];
      const learner = row.learner;

      try {
        // Prepare Data (Priority: Parent/Guardian -> Parent)
        const parentPhone = getLearnerPhone(learner);
        if (!parentPhone) {
          setBulkProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }));
          continue;
        }

        const message = formatSmsReport(row);
        let formattedPhone = parentPhone.replace(/\D/g, '');
        if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1);

        // Send via Communication API (Direct delivery)
        await communicationAPI.sendTestSMS({
          phoneNumber: formattedPhone,
          message: message,
          schoolId: user?.schoolId || user?.school?.id || localStorage.getItem('currentSchoolId')
        });

        // Log communication to backend
        try {
          await api.notifications.logCommunication({
            learnerId: learner.id,
            channel: 'SMS',
            term: selectedTerm,
            academicYear: setup.academicYear,
            assessmentType: 'SUMMATIVE'
          });
        } catch (logErr) {
          console.warn("Failed to log SMS communication", logErr);
        }

        setBulkProgress(prev => ({ ...prev, current: i + 1, success: prev.success + 1 }));

      } catch (err) {
        console.error(`Failed to send SMS to ${learner.firstName}:`, err);
        setBulkProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }));
      }

      // Small delay to prevent rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    setTimeout(() => {
      setBulkProgress(prev => ({ ...prev, active: false }));
      showSuccess('Bulk SMS processing completed');
    }, 1000);
  };

  /**
   * Bulk Print Handler
   */
  const handleBulkPrint = async () => {
    if (!reportData?.rows || reportData.rows.length === 0) return;
    if (isBulkPrinting) return;

    // Determine rows to print
    const rowsToPrint = selectedReportRows.length > 0
      ? selectedReportRows.map(idx => reportData.rows[idx])
      : reportData.rows;

    if (rowsToPrint.length === 0) {
      showError('No learners selected for PDF generation');
      return;
    }

    // Pre-fetch all comments before mounting cards (avoids N API calls during PDF render)
    const fetchedComments = {};
    for (const row of rowsToPrint) {
      try {
        const res = await api.cbc.getComments(row.learner.id, { term: selectedTerm, academicYear: academicYear });
        if (res.success) fetchedComments[row.learner.id] = res.data;
      } catch (_) { }
    }

    setCommentMap(fetchedComments);
    const abortController = new AbortController();
    bulkPrintAbortController.current = abortController;
    setBulkDownloadData(rowsToPrint);
    setIsBulkPrinting(true);
    setPdfProgress('🚀 Initializing bulk report engine...');

    try {
      // 1. Give React one tick to mount the hidden bulk container before capture
      await new Promise(resolve => requestAnimationFrame(resolve));

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${(reportData?.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}_Detailed_Reports_${timestamp}.pdf`;

      if (abortController.signal.aborted) {
        throw new Error('Bulk PDF generation cancelled');
      }

      setPdfProgress('📄 Opening bulk print preview...');
      const result = await pdfPrintWindow('bulk-print-content', {
        title: filename,
        autoPrint: true,
        onProgress: (msg) => { setPdfProgress(msg); }
      });

      if (result.success) {
        showSuccess('Print dialog opened. Choose Save as PDF for a clean combined file.');
      } else if (result.error === 'Bulk PDF generation cancelled') {
        showInfo('Bulk PDF generation cancelled');
      } else {
        throw new Error(result.error || 'Failed to generate PDF');
      }
    } catch (err) {
      if (err?.message === 'Bulk PDF generation cancelled') {
        showInfo('Bulk PDF generation cancelled');
      } else {
        console.error('❌ Bulk print error:', err);
        showError(`PDF Generation Failed: ${err.message || 'An unexpected error occurred'}`);
      }
    } finally {
      bulkPrintAbortController.current = null;
      setIsBulkPrinting(false);
      setPdfProgress('');
      setBulkDownloadData(null);
    }
  };

  /**
   * Single Download Handler (Directly from list)
   */

  const handleSingleDownload = async (row) => {
    showInfo(`Downloading report for ${row.learner.firstName}...`);

    // Pre-fetch comment for single download
    try {
      const res = await api.cbc.getComments(row.learner.id, { term: selectedTerm, academicYear: academicYear });
      setSingleCommentData(res.success ? res.data : null);
    } catch (_) {
      setSingleCommentData(null);
    }

    setSingleDownloadData(row);
    setIsSingleDownloading(true);

    try {
      // One animation frame so React mounts the hidden container
      await new Promise(resolve => requestAnimationFrame(resolve));

      const filename = `${row.learner.firstName}_${row.learner.lastName}_Summative_Report.pdf`;
      const result = await pdfPrintWindow('single-print-content', {
        title: filename,
        autoPrint: true,
        fitToSinglePage: true,
        onProgress: () => {}
      });

      if (result.success) {
        showSuccess(`Print dialog opened for ${row.learner.firstName}. Choose Save as PDF.`);
      } else {
        throw new Error(result.error || 'Failed to open print preview');
      }
    } catch (err) {
      console.error('❌ Individual download error:', err);
      showError(`Failed to download: ${err.message}`);
    } finally {
      setIsSingleDownloading(false);
      setSingleDownloadData(null);
    }
  };

  const executeSendSMS = async () => {
    if (!smsPreviewData) return;

    // Use the edited number
    if (!editedPhoneNumber) {
      showError('Please enter a valid phone number');
      return;
    }

    try {
      setIsSendingSMS(true);

      // Format number to international standard if it starts with 0
      let formattedPhone = editedPhoneNumber;
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      }

      await communicationAPI.sendTestSMS({
        phoneNumber: formattedPhone,
        message: smsPreviewData.message
      });

      setNotificationModal({
        show: true,
        title: 'SMS Sent Successfully',
        message: `The report summary has been sent to ${editedPhoneNumber}.`,
        type: 'success'
      });

      setShowSMSPreview(false);
      // Refresh to update status if needed
      if (onFetchLearners) onFetchLearners();
    } catch (error) {
      console.error('SMS Error:', error);
      showError('Failed to send SMS');
      setNotificationModal({
        show: true,
        title: 'SMS Delivery Failed',
        message: error.message || 'An error occurred while sending the SMS.',
        type: 'error'
      });
    } finally {
      setIsSendingSMS(false);
    }
  };


  /**
   * Bulk WhatsApp Handler
   * Sends reports to selected learners in batches with intervals
   */
  const handleBulkWhatsApp = async (testNumber = null) => {
    const rowsToSend = selectedReportRows.length > 0
      ? selectedReportRows.map(idx => reportData.rows[idx])
      : reportData.rows;

    if (rowsToSend.length === 0) {
      showError('No learners selected for WhatsApp');
      return;
    }

    const confirmMsg = testNumber
      ? `Sending TEST reports for ${rowsToSend.length} learners to ${testNumber}. Continue?`
      : `Ready to send WhatsApp reports to ${rowsToSend.length} parents. This will take approx ${Math.ceil(rowsToSend.length * 2 / 60)} minutes. Continue?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSendingWhatsApp(true);
    setWhatsAppProgress({ current: 0, total: rowsToSend.length, status: 'Initializing...' });
    // setShowWhatsAppConfirm(false); // Kept open for progress display

    // 0. Pre-fetch all comments before mounting cards
    setPdfProgress('🔍 Preparing assessment data...');
    const commentMap = {};
    for (const row of rowsToSend) {
      try {
        const res = await api.cbc.getComments(row.learner.id, { term: selectedTerm, academicYear: academicYear });
        if (res.success) commentMap[row.learner.id] = res.data;
      } catch (_) { }
    }

    // 1. Mount reports in the hidden bulk container
    setBulkDownloadData(rowsToSend);
    setCommentMap(commentMap); // Ensure the template gets the comments

    // One animation frame so React mounts the hidden bulk container
    await new Promise(resolve => requestAnimationFrame(resolve));

    let successCount = 0;
    let failCount = 0;

    const bulkContainer = document.getElementById('bulk-print-content');
    const pageEls = bulkContainer?.querySelectorAll('.pdf-report-page') || [];

    for (let i = 0; i < rowsToSend.length; i++) {
      const row = rowsToSend[i];
      const learner = row.learner;
      const progress = Math.round(((i + 1) / rowsToSend.length) * 100);

      setWhatsAppProgress({
        current: i + 1,
        total: rowsToSend.length,
        status: `Preparing image for ${learner.firstName}...`,
        percent: progress
      });

      try {
        let reportImageBase64 = null;

        // Try to capture the specific page element from the bulk container
        const pageEl = pageEls[i];
        if (pageEl) {
          const canvas = await captureElement(pageEl);
          reportImageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        }

        const subjects = {};
        const processedBatchTests = new Set();
        if (row.results) {
          row.results.forEach(r => {
            const resultKey = r.id || `${r.testId}-${r.score}`;
            if (processedBatchTests.has(resultKey)) return;
            processedBatchTests.add(resultKey);

            const rawName = r.learningArea || r.test?.learningArea || 'Subject';
            const subjectName = rawName.trim().toUpperCase();

            if (subjects[subjectName]) {
              subjects[subjectName].score = (subjects[subjectName].score + (r.score || 0)) / 2;
            } else {
              subjects[subjectName] = {
                score: r.score || 0,
                grade: r.grade || '-'
              };
            }
          });
        }

        const parentPhone = testNumber || getLearnerPhone(learner);

        if (parentPhone) {
          setWhatsAppProgress(prev => ({ ...prev, status: `Sending to ${learner.firstName}...` }));

          await api.notifications.sendAssessmentReportWhatsApp({
            learnerId: learner.id,
            learnerName: `${learner.firstName} ${learner.lastName}`,
            learnerGrade: learner.grade,
            parentPhone: parentPhone,
            parentName: learner.guardianName || learner.parent?.firstName || 'Parent',
            term: reportData.term?.replace(/_/g, ' ') || 'Term',
            totalTests: row.results?.length || 0,
            averageScore: row.averageScore,
            overallGrade: row.grade,
            subjects: subjects,
            pathwayPrediction: row.pathwayPrediction,
            reportImageBase64 // ADDED THE IMAGE DATA
          });
          successCount++;
        } else {
          console.warn(`Skipping ${learner.firstName}: No phone number`);
          failCount++;
        }

      } catch (err) {
        console.error(`Failed to send WA to ${learner.firstName}`, err);
        failCount++;
      }

      // Interval between messages
      if (i < rowsToSend.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setIsSendingWhatsApp(false);
    setShowWhatsAppConfirm(false); // Close progress modal
    setNotificationModal({
      show: true,
      title: 'Bulk WhatsApp Complete',
      message: `Process finished.\n✅ Sent: ${successCount}\n❌ Failed/Skipped: ${failCount}`,
      type: successCount > 0 ? 'success' : 'warning'
    });
  };

  const handleGenerate = async () => {
    setStatusMessage('');
    setComplianceCheckResult(null); // Reset compliance check

    if (!selectedType) {
      setStatusMessage('❌ Error: Please select a report type');
      showError('Please select a report type');
      return;
    }

    // Validation for Learner Reports
    if (selectedType === 'LEARNER_REPORT') {
      if (!learners || learners.length === 0) {
        setStatusMessage('❌ Error: No learners available');
        showError('No learners found in the system');
        return;
      }

      if (selectedLearnerIds.length === 0) {
        setStatusMessage('❌ Error: Please select at least one learner');
        showError('Please select at least one learner');
        return;
      }

      if (selectedGrade === 'all') {
        setStatusMessage('❌ Error: Please select a grade');
        showError('Please select a grade');
        return;
      }
    }

    if (selectedType === 'STREAM_REPORT' && (!selectedStream || selectedStream === 'all')) {
      setStatusMessage('❌ Error: Please select a stream');
      showError('Please select a stream');
      return;
    }

    if (selectedType === 'SUBJECT_ANALYSIS' && selectedTestIds.length !== 1) {
      setStatusMessage('❌ Error: Please select one test');
      showError('Please select one test');
      return;
    }

    setLoading(true);
    setStatusMessage('⏳ Generating report...');
    setSelectedReportRows([]); // Reset selection on new report

    // CRITICAL: Ensure we have the latest tests for the selected grade to avoid race conditions
    // (where availableTests state might still be from the PREVIOUS grade)
    let currentTests = availableTests;
    try {
      if (stagedGrade && stagedGrade !== 'all') {
        const testParams = {
          grade: normalize(stagedGrade),
          term: normalize(stagedTerm),
          academicYear: stagedAcademicYear || setup.academicYear
        };
        const testsRes = await api.assessments.getTests(testParams);
        if (testsRes.success && testsRes.data) {
          currentTests = testsRes.data;
          setAvailableTests(testsRes.data); // Keep global state in sync
        }
      }
    } catch (e) {
      console.warn('[Report] Failed to pre-fetch tests, falling back to cached state', e);
    }

    const queryParams = {
      term: normalize(stagedTerm),
      academicYear: stagedAcademicYear || setup.academicYear,
      includePredictions: 'true'
    };
    if (stagedGrade && stagedGrade !== 'all') queryParams.grade = normalize(stagedGrade);
    if (selectedStream && selectedStream !== 'all') queryParams.stream = selectedStream;

    try {
      const isSeniorSecondaryGrade = (grade) => ['GRADE_10', 'GRADE_11', 'GRADE_12'].includes(String(grade || ''));
      const computeCategoryAveragesFromResults = (rows = []) => {
        const buckets = {
          STEM: { total: 0, max: 0, subjectCount: 0 },
          SOCIAL: { total: 0, max: 0, subjectCount: 0 },
          ARTS: { total: 0, max: 0, subjectCount: 0 },
        };
        rows.forEach((r) => {
          const area = String(r.learningArea || r.test?.learningArea || '').toUpperCase();
          if (!area) return;
          const score = Number(r.score || 0);
          const totalMarks = Number(r.totalMarks || 0);
          if (totalMarks <= 0) return;

          if (CATEGORY_KEYWORDS.STEM.some((k) => area.includes(k))) {
            buckets.STEM.total += score;
            buckets.STEM.max += totalMarks;
            buckets.STEM.subjectCount += 1;
          } else if (CATEGORY_KEYWORDS.SOCIAL.some((k) => area.includes(k))) {
            buckets.SOCIAL.total += score;
            buckets.SOCIAL.max += totalMarks;
            buckets.SOCIAL.subjectCount += 1;
          } else if (CATEGORY_KEYWORDS.ARTS.some((k) => area.includes(k))) {
            buckets.ARTS.total += score;
            buckets.ARTS.max += totalMarks;
            buckets.ARTS.subjectCount += 1;
          }
        });
        return Object.entries(buckets)
          .filter(([, values]) => values.max > 0)
          .map(([category, values]) => {
            const avg = Math.round((values.total / values.max) * 100);
            return {
              category,
              averagePercentage: avg,
              grade: getCBCGrade(avg)?.grade || '—',
              subjectCount: values.subjectCount,
            };
          });
      };
      const fetchCategoryAveragesFromReportApi = async (learnerId) => {
        try {
          const params = { term: normalize(stagedTerm), academicYear: stagedAcademicYear || setup.academicYear };
          if (selectedType === 'LEARNER_TERMLY_REPORT') {
            const resp = await reportAPI.getTermlyReport(learnerId, params);
            return resp?.data?.summative?.summary?.byCategoryAverages || [];
          }
          const resp = await reportAPI.getSummativeReport(learnerId, params);
          return resp?.data?.subjectSummary?.byCategoryAverages || [];
        } catch {
          return [];
        }
      };
      const buildCategoryAveragesMap = async (learnerRows = []) => {
        const pairs = await Promise.all(
          (learnerRows || []).map(async (learner) => {
            const rows = await fetchCategoryAveragesFromReportApi(learner.id);
            return [learner.id, rows];
          })
        );
        return new Map(pairs);
      };
      const buildAllowedSubjectsMap = async (learnerRows) => {
        const secondaryLearners = (learnerRows || []).filter((l) => isSeniorSecondaryGrade(l?.grade));
        if (secondaryLearners.length === 0) return new Map();

        const profiles = await Promise.all(
          secondaryLearners.map(async (learner) => {
            try {
              const resp = await api.pathways.getLearnerPathwayProfile(learner.id);
              const selections = resp?.data?.subjectSelections || [];
              const names = new Set(
                selections
                  .map((s) => getCanonicalLearningAreaKey(s?.learningArea?.name))
                  .filter(Boolean)
              );
              return [learner.id, names];
            } catch {
              return [learner.id, null];
            }
          })
        );

        return new Map(profiles);
      };

      if (selectedType === 'LEARNER_REPORT' || selectedType === 'LEARNER_TERMLY_REPORT') {
        setStatusMessage(`📚 Loading results for ${selectedLearnerIds.length} learner(s)...`);

        const allReportRows = [];
        const selectedLearners = selectedLearnerIds
          .map((id) => filteredLearners?.find((l) => l.id === id))
          .filter(Boolean);
        const allowedSubjectsByLearner = await buildAllowedSubjectsMap(selectedLearners);
        const categoryAveragesByLearner = await buildCategoryAveragesMap(selectedLearners);

        // OPTIMIZED: Fetch all results and communication history for the whole group in one hit
        const bulkRes = await api.assessments.getBulkResults(queryParams);
        const allResults = bulkRes.success ? (bulkRes.data || bulkRes.results || []) : [];
        const allCommunications = bulkRes.success ? (bulkRes.communications || []) : [];
        const allPredictions = bulkRes.success ? (bulkRes.predictions || {}) : {};


        for (const learnerId of selectedLearnerIds) {
          const learner = filteredLearners?.find(l => l.id === learnerId);
          if (!learner) continue;

          // Filter this student's results and communication from the bulk payload
          let processedResults = allResults.filter(r => r.learnerId === learnerId);
          let communication = allCommunications.find(c => c.learnerId === learnerId) || null;

          if (selectedTestIds.length > 0) {
            // Specific tests selected
            processedResults = processedResults.filter(r => selectedTestIds.includes(r.testId));
          }

          // Filter results by selected test groups if any
          if (selectedTestGroups.length > 0) {
            processedResults = processedResults.filter(r => {
              const matchingTest = currentTests.find(t => t.id === r.testId);
              const group = resolveTestGroup({
                testType: r.test?.testType || r.testType || matchingTest?.testType,
                title: r.test?.title || matchingTest?.title || r.title
              });
              return selectedTestGroups.includes(group);
            });
          }

          const allowedSubjects = allowedSubjectsByLearner.get(learnerId);
          if (allowedSubjects && allowedSubjects.size > 0) {
            processedResults = processedResults.filter((r) => {
              const test = r.test || currentTests.find((t) => t.id === r.testId) || {};
              const areaName = getCanonicalLearningAreaKey(r.learningArea || test.learningArea);
              return areaName ? allowedSubjects.has(areaName) : true;
            });
          }

          // Process and format results for the UI
          processedResults = processedResults.map(r => {
            const test = r.test || currentTests.find(t => t.id === r.testId) || {};
            const score = r.score !== undefined ? r.score : r.marksObtained;
            const totalMarks = r.totalMarks || test.totalMarks || 100;
            const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
            const { grade, remark } = getCBCGrade(percentage);

            const rawArea = r.learningArea || test.learningArea || 'General';
            const refinedArea = getRefinedLearningArea(rawArea, test.title);

            return {
              ...r,
              test: { ...test, ...r.test },
              learningArea: refinedArea,
              originalLearningArea: rawArea,
              score: Number(score || 0),
              totalMarks: Number(totalMarks),
              percentage: parseFloat(percentage.toFixed(1)),
              grade,
              remark,
              parentPhone: learner.parent?.phone || learner.parentPhone || learner.parentPhoneNumber || learner.guardianPhone
            };
          });

          processedResults.sort((a, b) => {
            const dateA = new Date(a.testDate || (a.test && a.test.testDate) || 0);
            const dateB = new Date(b.testDate || (b.test && b.test.testDate) || 0);
            return dateA - dateB;
          });

          const apiCategoryAverages = categoryAveragesByLearner.get(learnerId) || [];
          const rowCategoryAverages =
            Array.isArray(apiCategoryAverages) && apiCategoryAverages.length > 0
              ? apiCategoryAverages
              : computeCategoryAveragesFromResults(processedResults);

          allReportRows.push({
            learner,
            results: processedResults,
            communication,
            pathwayPrediction: allPredictions[learnerId] || null,
            byCategoryAverages: rowCategoryAverages,
            averageScore: processedResults.length > 0
              ? (processedResults.reduce((sum, r) => sum + (r.score || r.percentage || 0), 0) / processedResults.length).toFixed(1)
              : 0
          });
        }

        if (allReportRows.length === 0) {
          setStatusMessage('⚠️ Warning: No assessment results found for selected learner(s)');
        } else {
          setStatusMessage(`✅ Success: Loaded reports for ${allReportRows.length} learner(s)`);
        }

        setReportData({
          type: selectedType,
          rows: allReportRows,
          // Set primary learner/results for single student backward compatibility
          learner: allReportRows.length === 1 ? allReportRows[0].learner : null,
          results: allReportRows.length === 1 ? allReportRows[0].results : [],
          averageScore: allReportRows.length === 1 ? allReportRows[0].averageScore : 0,
          totalTests: allReportRows.length === 1 ? allReportRows[0].results.length : 0,
          academicYear: setup.academicYear,
          term: selectedTerm,
          testGroups: selectedTestGroups.length > 0 ? selectedTestGroups : 'All Groups',
          selectedTests: selectedTestIds.length > 0 ? selectedTestIds.length : 'All Tests',
          stream: selectedStream !== 'all' ? selectedStream : 'All Streams',
          grade: selectedGrade,
          totalLearners: allReportRows.length,
          generatedAt: new Date()
        });

        showSuccess(`Generated ${allReportRows.length} report(s) successfully`);
      }
      else if (selectedType === 'GRADE_REPORT' || selectedType === 'STREAM_REPORT' || selectedType === 'STREAM_RANKING_REPORT') {
        // --- BROADSHEET GENERATION LOGIC ---

        // 1. Identify Target Learners
        let targetLearners = filteredLearners;
        if (selectedType === 'STREAM_REPORT') {
          if (!selectedStream || selectedStream === 'all') {
            showError('Please select a specific stream for Stream Report');
            setLoading(false);
            return;
          }
        }

        if (targetLearners.length === 0) {
          showError('No learners found for the selected Grade/Stream');
          setLoading(false);
          return;
        }

        setStatusMessage(`⏳ Fetching results for ${targetLearners.length} learners...`);
        const allowedSubjectsByLearner = await buildAllowedSubjectsMap(targetLearners);

        // 2. Identify Target Tests
        let targetTests = currentTests;
        if (selectedTestIds.length > 0) {
          targetTests = currentTests.filter(t => selectedTestIds.includes(t.id));
        } else if (selectedTestGroups.length > 0) {
          targetTests = currentTests.filter(t => selectedTestGroups.includes(getTestGroup(t)));
        }

        if (targetTests.length === 0) {
          showError('No tests found for this selection');
          setLoading(false);
          return;
        }

        // 3. Fetch Results (Bulk or Iterative)
        const allResultsMap = {}; // learnerId -> [results]
        let processedCount = 0;

        // Initialize map
        targetLearners.forEach(l => allResultsMap[l.id] = []);

        for (const test of targetTests) {
          try {
            // Fetch results for this test
            const res = await api.assessments.getTestResults(test.id);
            if (res.success && res.data) {
              res.data.forEach(result => {
                if (allResultsMap[result.learnerId]) {
                  const learningArea = getCanonicalLearningAreaName(test.learningArea);
                  allResultsMap[result.learnerId].push({
                    ...result,
                    test: test,
                    learningArea,
                    score: result.marksObtained, // Normalize to .score for aggregation logic below
                    maxScore: test.totalMarks || 100
                  });
                }
              });
            }
            processedCount++;
            setStatusMessage(`⏳ Processing assessment data: ${processedCount}/${targetTests.length} subjects...`);
          } catch (err) {
            console.error(`Failed to fetch results for test ${test.id}`, err);
          }
        }

        // 4. Aggregate Data for Broadsheet
        // Critical fairness rule:
        // Every learner must be graded out of the SAME full subject/test denominator.
        // Missing subjects therefore contribute 0 marks but still count in totalMax.
        const expectedTotalMax = targetTests.reduce(
          (sum, t) => sum + (Number(t?.totalMarks) || 100),
          0
        );

        const broadsheetData = targetLearners.map(learner => {
          const learnerAllowedSubjects = allowedSubjectsByLearner.get(learner.id);
          const learnerResults = (allResultsMap[learner.id] || []).filter((r) => {
            if (!learnerAllowedSubjects || learnerAllowedSubjects.size === 0) return true;
            const areaName = getCanonicalLearningAreaKey(r.learningArea || r.test?.learningArea);
            return areaName ? learnerAllowedSubjects.has(areaName) : true;
          });

          // Aggregates
          const totalScore = learnerResults.reduce((sum, r) => sum + (r.score || 0), 0);
          const totalMax = (!learnerAllowedSubjects || learnerAllowedSubjects.size === 0)
            ? expectedTotalMax
            : targetTests
                .filter((t) => learnerAllowedSubjects.has(getCanonicalLearningAreaKey(t.learningArea)))
                .reduce((sum, t) => sum + (Number(t?.totalMarks) || 100), 0);
          const averagePct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
          const { grade, remark } = getCBCGrade(averagePct);

          // Subject Breakdown
          const subjectScores = {};
          learnerResults.forEach(r => {
            const area = getCanonicalLearningAreaName(r.learningArea || 'General');
            if (!subjectScores[area]) subjectScores[area] = 0;
            subjectScores[area] += (r.score || 0);
          });

          return {
            learner,
            results: learnerResults,
            totalScore,
            totalMax,
            averagePct: parseFloat(averagePct.toFixed(1)),
            grade,
            remark,
            subjectScores
          };
        });

        const subjectsRaw = Array.from(new Set(targetTests.map(t => getCanonicalLearningAreaName(t.learningArea)).filter(Boolean))).sort();
        const subjectMaxScores = subjectsRaw.reduce((acc, subject) => {
          acc[subject] = targetTests
            .filter((test) => getCanonicalLearningAreaName(test.learningArea) === subject)
            .reduce((sum, test) => sum + (Number(test?.totalMarks) || 100), 0);
          return acc;
        }, {});
        const subjectSummaries = subjectsRaw.reduce((acc, subject) => {
          const subjectMax = subjectMaxScores[subject] || 0;
          const values = broadsheetData.map((row) => Number(row.subjectScores?.[subject]) || 0);
          const total = values.reduce((sum, value) => sum + value, 0);
          const mean = values.length > 0 ? total / values.length : 0;
          const averagePct = subjectMax > 0 ? (mean / subjectMax) * 100 : 0;
          acc[subject] = {
            total: parseFloat(total.toFixed(1)),
            mean: parseFloat(mean.toFixed(1)),
            averagePct: parseFloat(averagePct.toFixed(1)),
          };
          return acc;
        }, {});

        // Sort subjects by average % descending so highest-performing subject appears first
        const subjects = [...subjectsRaw].sort(
          (a, b) => (subjectSummaries[b]?.averagePct ?? 0) - (subjectSummaries[a]?.averagePct ?? 0)
        );

        // 5. Compute per-learner merit points (sum of CBC points per subject)
        broadsheetData.forEach((d) => {
          let pts = 0;
          subjects.forEach((subj) => {
            const subjectMax = subjectMaxScores[subj] || 0;
            if (subjectMax > 0) {
              const subjectScore = Number(d.subjectScores?.[subj]) || 0;
              const subjectPct = (subjectScore / subjectMax) * 100;
              const { points } = getCBCGrade(subjectPct);
              if (typeof points === 'number') pts += points;
            }
          });
          d.meritPoints = pts;
        });

        // 5b. Ranking — primary: merit points desc, secondary: average % desc
        broadsheetData.sort((a, b) =>
          b.meritPoints !== a.meritPoints
            ? b.meritPoints - a.meritPoints
            : b.averagePct - a.averagePct
        );
        const rankedData = broadsheetData.map((d, index) => ({ ...d, position: index + 1 }));

        setReportData({
          type: selectedType,
          title: selectedType === 'GRADE_REPORT' ? `Grade Report - ${selectedGrade}` : `Stream Report - ${selectedGrade} ${selectedStream}`,
          rows: rankedData,
          subjects,
          subjectSummaries,
          generatedAt: new Date(),
          meta: {
            grade: selectedGrade,
            stream: selectedStream,
            term: selectedTerm,
            totalLearners: targetLearners.length
          }
        });
        setStatusMessage(`✅ Success: Generated broadsheet for ${targetLearners.length} learners`);
        showSuccess(`Generated ${selectedType.replace(/_/g, ' ')} for ${targetLearners.length} students`);
      }
      else if (selectedType.includes('ANALYSIS')) {
        // --- ANALYSIS REPORT LOGIC ---

        if (!selectedGrade || selectedGrade === 'all') {
          showError('Please select a Grade for analysis');
          setLoading(false);
          return;
        }

        let targetTests = currentTests;
        if (selectedTestIds.length > 0) {
          targetTests = currentTests.filter(t => selectedTestIds.includes(t.id));
        } else if (selectedTestGroups.length > 0) {
          targetTests = currentTests.filter(t => selectedTestGroups.includes(getTestGroup(t)));
        }

        if (selectedSubjectNames.length > 0) {
          const selectedSubjectSet = new Set(selectedSubjectNames.map((name) => normalize(name)));
          targetTests = targetTests.filter((test) => selectedSubjectSet.has(normalize(test.learningArea)));
        }

        if (targetTests.length === 0) {
          showError('No tests available for analysis');
          setLoading(false);
          return;
        }

        setStatusMessage('⏳ Analyzing subject performance...');

        // Fetch all results
        const allResults = [];
        for (const test of targetTests) {
          const res = await api.assessments.getTestResults(test.id);
          if (res.success && res.data) {
            res.data.forEach(r => {
              allResults.push({
                ...r,
                test,
                learningArea: test.learningArea,
                score: r.marksObtained // Normalize for analysis logic below
              });
            });
          }
        }

        // Aggregate by Subject
        const subjects = {};

        allResults.forEach(r => {
          const area = r.learningArea || 'General';
          if (!subjects[area]) subjects[area] = { totalScore: 0, totalMax: 0, count: 0, scores: [] };

          subjects[area].totalScore += (r.score || 0);
          subjects[area].totalMax += (r.test?.totalMarks || 100);
          subjects[area].count++;

          const pct = (r.test?.totalMarks > 0) ? ((r.score || 0) / r.test.totalMarks * 100) : 0;
          subjects[area].scores.push(pct);
        });

        // Calculate subject stats
        const subjectStats = Object.keys(subjects).map(area => {
          const data = subjects[area];
          const mean = data.totalMax > 0 ? (data.totalScore / data.totalMax * 100) : 0;
          return {
            subject: area,
            mean: parseFloat(mean.toFixed(1)),
            count: data.count,
            highest: Math.max(...data.scores).toFixed(1),
            lowest: Math.min(...data.scores).toFixed(1)
          };
        }).sort((a, b) => b.mean - a.mean);

        // Grade Distribution
        const gradeDist = { 'EE': 0, 'ME': 0, 'AE': 0, 'BE': 0 };

        const learnerMap = {};
        allResults.forEach(r => {
          if (!learnerMap[r.learnerId]) learnerMap[r.learnerId] = { score: 0, max: 0 };
          learnerMap[r.learnerId].score += (r.score || 0);
          learnerMap[r.learnerId].max += (r.test?.totalMarks || 100);
        });

        Object.values(learnerMap).forEach(l => {
          const avg = l.max > 0 ? (l.score / l.max * 100) : 0;
          const { grade } = getCBCGrade(avg);
          const simpleGrade = grade.substring(0, 2);
          if (gradeDist[simpleGrade] !== undefined) gradeDist[simpleGrade]++;
        });

        const selectedAnalysisSubjects = Array.from(new Set(
          targetTests
            .map((test) => String(test?.learningArea || '').trim())
            .filter(Boolean)
        ));
        const analysisTitlePrefix = selectedAnalysisSubjects.length === 1
          ? formatSubjectName(selectedAnalysisSubjects[0])
          : 'Subject';

        setReportData({
          type: selectedType,
          title: `${analysisTitlePrefix} Performance Analysis - ${selectedGrade}`,
          subjectStats,
          gradeDist,
          generatedAt: new Date(),
          meta: {
            grade: selectedGrade,
            stream: selectedStream,
            term: selectedTerm,
            subjects: selectedSubjectNames
          }
        });
        showSuccess('Analysis report generated');
      }

      setLoading(false);
    } catch (err) {
      console.error('❌ Error generating report:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to generate report';
      setStatusMessage(`❌ Error: ${errorMessage}`);
      showError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white -mt-6 -mx-6 h-[calc(100vh-80px)] overflow-y-auto relative custom-scrollbar">
      {/* STICKY HEADER & FILTER BAR */}
      <div className="sticky top-0 z-40 bg-white shadow-sm">
        {/* Dynamic Report Particulars Header */}
        <div className="border-b border-slate-100 px-6 py-3 flex justify-center items-center bg-slate-50">
          <div className="text-xs text-slate-500 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="font-semibold text-brand-teal uppercase tracking-wider">
              {SUMMATIVE_REPORT_TYPES.find(t => t.value === stagedType)?.label || 'Summative Report'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-medium">
              {stagedGrade ? (stagedGrade === 'all' ? 'All Grades' : normalize(stagedGrade).replace('_', ' ')) : 'Grade Not Selected'}
            </span>
            <span className="text-slate-300">•</span>
            <span>
              {stagedStream ? (stagedStream === 'all' ? 'All Streams' : stagedStream) : 'All Streams'}
            </span>
            <span className="text-slate-300">•</span>
            <span>
              {terms?.find(t => t.value === stagedTerm)?.label || stagedTerm}
            </span>
            <span className="text-slate-300">•</span>
            <span>
              {academicYear}
            </span>
          </div>
        </div>

        {/* Single Row Filter Bar */}
        <div className="border-t border-slate-200 px-4 md:px-6 py-3.5 flex flex-wrap justify-center gap-3 items-center w-full max-w-[1200px] mx-auto">
          {/* Type Selector */}
          <select
            value={stagedType}
            onChange={(e) => {
              const nextType = e.target.value;
              setStagedType(nextType);
              setStagedTestIds([]);
              setStagedSubjectNames([]);
              if (nextType === 'CUSTOM_REPORT') {
                if (typeof onNavigate === 'function') onNavigate('assess-custom-reports');
                else showInfo('Custom reports page is unavailable in this context.');
              }
            }}
            className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-teal focus:border-brand-teal outline-none flex-1 md:flex-none min-w-[140px]"
          >
            {SUMMATIVE_REPORT_TYPES.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Grade Selector */}
          <select
            value={stagedGrade}
            onChange={(e) => {
              setStagedGrade(e.target.value);
              setStagedStream('');
            }}
            className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-teal focus:border-brand-teal outline-none flex-1 md:flex-none md:w-28 min-w-[100px]"
          >
            <option value="">Grade</option>
            <option value="all">All Grades</option>
            {(grades || []).sort((a, b) => {
              const aVal = typeof a === 'string' ? a : (a.value || a.id || a.name);
              const bVal = typeof b === 'string' ? b : (b.value || b.id || b.name);

              const aIndex = gradeOrder.indexOf(aVal);
              const bIndex = gradeOrder.indexOf(bVal);

              // If not found in gradeOrder, push it to the end instead of the beginning (-1)
              const safeAIndex = aIndex === -1 ? 999 : aIndex;
              const safeBIndex = bIndex === -1 ? 999 : bIndex;

              return safeAIndex - safeBIndex;
            }).map(g => {
              const gradeValue = typeof g === 'string' ? g : (g.value || g.id || g.name);
              const gradeLabel = typeof g === 'string' ? g : (g.label || g.name || g);
              return (
                <option key={gradeValue} value={gradeValue}>
                  {gradeLabel}
                </option>
              );
            })}
          </select>

          {/* Stream Selector */}
          <select
            value={stagedStream}
            onChange={(e) => setStagedStream(e.target.value)}
            className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-teal focus:border-brand-teal outline-none flex-1 md:flex-none md:w-20 min-w-[100px]"
          >
            <option value="">Stream</option>
            <option value="all">All</option>
            {availableStreams?.map(s => (
              <option key={s.id || s.name} value={s.value || s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Term Selector */}
          <select
            value={stagedTerm}
            onChange={(e) => setStagedTerm(e.target.value)}
            className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-teal focus:border-brand-teal outline-none flex-1 md:flex-none md:w-20 min-w-[100px]"
          >
            {terms?.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Academic Year Selector */}
          <select
            value={stagedAcademicYear}
            onChange={(e) => setStagedAcademicYear(parseInt(e.target.value))}
            className="h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-teal focus:border-brand-teal outline-none flex-1 md:flex-none md:w-20 min-w-[100px]"
          >
            {getAcademicYearOptions().map(y => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>

          {/* Learner Selector */}
          {stagedType === 'LEARNER_REPORT' && (
            <div className="relative w-full md:w-auto flex-1 md:flex-none" ref={learnerOptionsRef}>
              <button
                onClick={() => setShowLearnerOptions(!showLearnerOptions)}
                className="h-9 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-teal focus:border-brand-teal outline-none flex items-center justify-between min-w-[180px] md:max-w-[280px] bg-white text-gray-700 w-full"
              >
                <span className="truncate">
                  {stagedLearnerIds.length === 0 ? 'Select Learner(s)'
                    : stagedLearnerIds.length === filteredLearners.length ? `All Learners (${filteredLearners.length})`
                      : `${stagedLearnerIds.length} Selected`}
                </span>
                <span className="text-gray-400 ml-2 text-[10px]">▼</span>
              </button>

              {showLearnerOptions && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-60 flex flex-col">
                  <div className="p-2 border-b bg-slate-50 flex gap-2 shrink-0">
                    <button
                      onClick={() => setStagedLearnerIds(filteredLearners.map(l => l.id))}
                      className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 flex-1 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setStagedLearnerIds([])}
                      className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 flex-1 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {loadingLearners ? (
                      <div className="p-4 text-center text-xs text-gray-500">Loading learners...</div>
                    ) : filteredLearners.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-500">No learners found</div>
                    ) : (
                      <div className="p-1">
                        {filteredLearners.map(learner => (
                          <label
                            key={learner.id}
                            className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={stagedLearnerIds.includes(learner.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setStagedLearnerIds(prev => [...prev, learner.id]);
                                } else {
                                  setStagedLearnerIds(prev => prev.filter(id => id !== learner.id));
                                }
                              }}
                              className="rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                            />
                            <span className="truncate">{learner.firstName} {learner.lastName}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test Selector */}
          {stagedType === 'SUBJECT_ANALYSIS' && (
            <div className="relative w-full md:w-auto flex-1 md:flex-none" ref={subjectOptionsRef}>
              <button
                type="button"
                onClick={() => setShowSubjectOptions(!showSubjectOptions)}
                className="h-9 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-teal focus:border-brand-teal outline-none flex items-center justify-between min-w-[220px] md:max-w-[320px] bg-white text-gray-700 w-full"
              >
                <span className="truncate">
                  {selectedAnalysisTest ? formatAnalysisTestLabel(selectedAnalysisTest) : 'Select Test'}
                </span>
                <span className="text-gray-400 ml-2 text-[10px]">▼</span>
              </button>

              {showSubjectOptions && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-60 flex flex-col">
                  <div className="overflow-y-auto flex-1">
                    {testsInGroups.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-500">No tests found for this selection</div>
                    ) : (
                      <div className="p-1">
                        {testsInGroups.map(test => (
                          <button
                            type="button"
                            key={test.id}
                            onClick={() => {
                              setStagedTestIds([test.id]);
                              setStagedSubjectNames(test.learningArea ? [test.learningArea] : []);
                              setShowSubjectOptions(false);
                            }}
                            className={`w-full text-left p-2 hover:bg-slate-50 rounded cursor-pointer text-xs ${stagedTestIds[0] === test.id ? 'bg-brand-teal/10 text-brand-teal font-medium' : 'text-slate-700'}`}
                          >
                            <span className="block truncate">{formatAnalysisTestLabel(test)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test Group Selector */}
          <div className="relative w-full md:w-auto flex-1 md:flex-none md:min-w-[140px]" ref={testGroupRef}>
            <button
              onClick={() => setShowTestGroupOptions(!showTestGroupOptions)}
              className="h-9 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-teal focus:border-brand-teal outline-none flex items-center justify-between min-w-full md:min-w-[140px] md:max-w-[200px] bg-white text-gray-700"
            >
              <span className="truncate">
                {stagedTestGroups.length === 0 ? 'All Test Groups' : stagedType === 'SUBJECT_ANALYSIS' ? formatTestName(stagedTestGroups[0]) : `${stagedTestGroups.length} Groups Selected`}
              </span>
              <span className="text-gray-400 ml-2 text-[10px]">▼</span>
            </button>
            {showTestGroupOptions && (
              <div className="absolute top-full left-0 mt-1 w-full md:w-56 bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1">
                {availableTestGroups.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-500">No test groups found for this grade/term</div>
                ) : (
                  <>
                    <div className="p-2 border-b bg-slate-50 flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setStagedTestGroups([]);
                          setStagedTestIds([]);
                          setStagedSubjectNames([]);
                        }}
                        className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 w-full transition-colors"
                      >
                        Reset Group Selection
                      </button>
                    </div>
                    {availableTestGroups.map(group => {
                      const normalizedGroup = String(group || '').toUpperCase().replace(/[\s-]+/g, '_');
                      const showDateStamp = !CORE_GROUPS_WITHOUT_STAMP.has(normalizedGroup);
                      const stampRaw = groupDateStampMap[group];
                      const dateStamp = stampRaw ? new Date(stampRaw).toLocaleDateString('en-GB') : '';
                      if (stagedType === 'SUBJECT_ANALYSIS') {
                        return (
                          <button
                            type="button"
                            key={group}
                            onClick={() => {
                              setStagedTestGroups([group]);
                              setStagedTestIds([]);
                              setStagedSubjectNames([]);
                              setShowTestGroupOptions(false);
                            }}
                            className={`w-full text-left p-2 px-3 hover:bg-slate-50 cursor-pointer text-xs ${stagedTestGroups[0] === group ? 'bg-brand-teal/10 text-brand-teal font-medium' : 'text-slate-700'}`}
                          >
                            <span className="min-w-0 flex flex-col leading-tight">
                              <span className="truncate">{formatTestName(group)}</span>
                              {showDateStamp && dateStamp && (
                                <span className="text-[10px] text-slate-400">{dateStamp}</span>
                              )}
                            </span>
                          </button>
                        );
                      }
                      return (
                      <label key={group} className="flex items-start gap-2 p-2 px-3 hover:bg-slate-50 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={stagedTestGroups.includes(group)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStagedTestGroups([...stagedTestGroups, group]);
                            } else {
                              setStagedTestGroups(stagedTestGroups.filter(g => g !== group));
                            }
                            setStagedTestIds([]); // Reset specific tests if group changes
                          }}
                          className="rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                        />
                        <span className="min-w-0 flex flex-col leading-tight">
                          <span className="truncate">{formatTestName(group)}</span>
                          {showDateStamp && dateStamp && (
                            <span className="text-[10px] text-slate-400">{dateStamp}</span>
                          )}
                        </span>
                      </label>
                    )})}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Specific Test Selector hidden per user request */}

          {/* Generate Button with Icon */}
          <button
            onClick={applyFilters}
            disabled={loading}
            className="h-9 px-3 rounded bg-brand-teal text-white flex items-center justify-center gap-1.5 hover:bg-brand-teal/90 disabled:opacity-50 transition text-xs font-medium whitespace-nowrap w-full md:w-auto mt-2 md:mt-0"
          >
            <FileText size={16} />
            <span>Generate</span>
          </button>

          {/* Status Message */}
          {statusMessage && (
            <div className="text-xs ml-2 flex items-center gap-1">
              {statusMessage.includes('✅') ? (
                <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
              ) : statusMessage.includes('⚠️') ? (
                <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
              ) : statusMessage.includes('⏳') ? (
                <Loader size={14} className="animate-spin text-blue-600 flex-shrink-0" />
              ) : (
                <XCircle size={14} className="text-red-600 flex-shrink-0" />
              )}
              <span className="text-gray-600 max-w-xs truncate">{statusMessage}</span>
            </div>
          )}
        </div>
      </div>


      {/* LEARNER REPORT DISPLAY - COMPACT PROFESSIONAL LAYOUT */}
      <div className="px-6 py-8">
        {(reportData?.type === 'LEARNER_REPORT' || reportData?.type === 'LEARNER_TERMLY_REPORT') && reportData?.rows?.length > 0 && (
          <div className="bg-gray-100 py-12 px-4 rounded-xl shadow-inner mb-8 no-print">
            {reportData.rows.length === 1 ? (
              <>
                <div
                  id="summative-report-content"
                  ref={reportRef}
                  className="pdf-report-root rounded-xl overflow-hidden shadow-2xl"
                >
                  <LearnerReportTemplate
                    learner={reportData.learner || reportData.rows[0].learner}
                    results={reportData.results?.length > 0 ? reportData.results : reportData.rows[0].results}
                    pathwayPrediction={reportData.pathwayPrediction || reportData.rows[0].pathwayPrediction}
                    categoryAverages={reportData.byCategoryAverages || reportData.rows?.[0]?.byCategoryAverages || []}
                    term={reportData.term}
                    academicYear={reportData.academicYear}
                    brandingSettings={brandingSettings}
                    user={user}
                    streamConfigs={streamConfigs}
                    remarks={reportData.rows?.[0]?.remarks || (reportData.results?.[0]?.remarks && reportData.results[0].remarks !== '-' ? reportData.results[0].remarks : null)}
                  />
                </div>

                {/* PRINT CONTROLS - SINGLE STUDENT */}
                <div className="no-print mt-8 flex gap-4 justify-center">
                  <button
                    onClick={() => setReportData(null)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => handleSendSMS(reportData.rows?.[0] || reportData)}
                    disabled={isSendingSMS}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold transition disabled:opacity-50"
                    title="Send report summary via SMS"
                  >
                    {isSendingSMS ? '📤 Sending...' : '📱 Send SMS'}
                  </button>
                  <button
                    onClick={() => handleSendWhatsApp(reportData.rows?.[0] || reportData)}
                    className="px-6 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-sm font-semibold transition flex items-center gap-2"
                  >
                    <MessageCircle size={18} />
                    WhatsApp
                  </button>
                  <button
                    onClick={handlePrintPDF}
                    disabled={isExporting}
                    className="hidden px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-semibold transition flex items-center gap-2 shadow-md shadow-indigo-100"
                  >
                    {isExporting ? <Loader size={18} className="animate-spin" /> : <Printer size={18} />}
                    Print Preview
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-semibold transition flex items-center gap-2 shadow-md shadow-emerald-100"
                  >
                    {isExporting ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
                    Print / Save PDF
                  </button>
                  <button
                    onClick={handleExportJPEG}
                    disabled={isExporting}
                    className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-semibold transition flex items-center gap-2 shadow-md shadow-orange-100"
                    title="Save report card as a JPEG image"
                  >
                    {isExporting ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
                    Download JPEG
                  </button>
                </div>
              </>
            ) : (
              /* BULK VIEW SUMMARY */
              <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
                <div className="text-center mb-8 pb-6 border-b">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Printer size={32} />
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">Bulk Summary Reports</h2>
                  <p className="text-slate-500 font-medium mt-1 uppercase text-sm">
                    GRADE: {selectedGrade} | STREAM: {selectedStream} | {reportData.rows.length} STUDENTS SELECTED
                  </p>
                </div>


                <div className="mb-8 border rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-50 border-b p-3 hidden md:grid grid-cols-12 text-[10px] font-semibold text-slate-500 uppercase tracking-widest items-center">
                    <div className="col-span-1 flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedReportRows.length === reportData.rows.length}
                        onChange={() => handleSelectAll(reportData.rows.length)}
                      />
                      <span>#</span>
                    </div>
                    <div className="col-span-4">Learner Name</div>
                    <div className="col-span-1 text-center">Avg</div>
                    <div className="col-span-2 text-left pl-6">Pathway</div>
                    <div className="col-span-4 text-right">Individual Actions</div>
                  </div>
                  {/* Mobile Select All row */}
                  <div className="md:hidden bg-slate-50 border-b p-3 flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedReportRows.length === reportData.rows.length && reportData.rows.length > 0}
                        onChange={() => handleSelectAll(reportData.rows.length)}
                      />
                      <span>Select All ({reportData.rows.length})</span>
                    </div>
                  </div>

                  <div className="max-h-[450px] overflow-y-auto">
                    {reportData.rows.map((row, idx) => (
                      <div key={idx} className={`flex flex-col md:grid md:grid-cols-12 md:items-center p-4 md:p-3 border-b border-slate-100 transition-colors gap-3 md:gap-0 ${selectedReportRows.includes(idx) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                        {/* Header for mobile / Col 1 & 4 for desktop */}
                        <div className="flex justify-between items-start md:contents">
                          <div className="md:col-span-1 flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={selectedReportRows.includes(idx)}
                              onChange={() => handleToggleSelectRow(idx)}
                            />
                            <span className="text-[10px] font-medium text-slate-400">{idx + 1}</span>
                          </div>
                          <div className="md:col-span-4 flex-1 ml-3 md:ml-0">
                            <p className="font-medium text-slate-800 text-sm md:text-sm">{row.learner.firstName} {row.learner.lastName}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-semibold">{row.learner.admissionNumber || 'ADM: N/A'}</p>
                          </div>
                          {/* Avg on mobile goes to top right */}
                          <div className="md:col-span-1 text-right md:text-center shrink-0">
                            <div className="md:hidden text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Avg</div>
                            <div className="font-semibold text-blue-600 text-sm">{row.averageScore}%</div>
                          </div>
                        </div>

                        <div className="md:col-span-2 flex flex-wrap justify-start items-center gap-2 mt-1 md:mt-0 pl-7 md:pl-6">
                          <span className="md:hidden text-[10px] text-slate-500 font-medium uppercase self-center mr-1">Pathway:</span>
                          {row.pathwayPrediction ? (
                            <div
                              className="flex items-center cursor-help"
                              title={`Pathway: ${row.pathwayPrediction.predictedPathway}\nConfidence: ${row.pathwayPrediction.confidence}%\n\nJustification: ${row.pathwayPrediction.justification}\n\nRecommended Careers:\n${(row.pathwayPrediction.careerRecommendations || []).map(c => '• ' + c).join('\n')}\n\nGrowth Areas:\n${(row.pathwayPrediction.growthAreas || []).map(g => '• ' + g).join('\n')}\n\n💡 Hint: Good fit for Kenyan Secondary Schools strong in ${row.pathwayPrediction.predictedPathway === 'STEM' ? 'Sciences & Math (e.g., Kenya High, Alliance High)' : row.pathwayPrediction.predictedPathway === 'Social Sciences' ? 'Humanities & Languages (e.g., Pangani Girls, Alliance Girls)' : 'Sports & Arts (e.g., Laiser Hill, Dagoretti High)'}.`}
                            >
                              <span className="px-2 py-0.5 bg-brand-teal/10 hover:bg-brand-teal/20 transition-colors text-brand-teal rounded text-[9px] font-semibold uppercase border border-brand-teal/30">
                                {row.pathwayPrediction.predictedPathway === 'Arts and Sports Science' ? 'Arts & Sports' : row.pathwayPrediction.predictedPathway}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-medium uppercase italic">-</span>
                          )}

                          {/* Keep mini-indicators for communication if they exist */}
                          <div className="flex gap-0.5 ml-1">
                            {row.communication?.hasSentSms && (
                              <div className="w-2 h-2 rounded-full bg-blue-500" title="SMS Sent" />
                            )}
                            {row.communication?.hasSentWhatsApp && (
                              <div className="w-2 h-2 rounded-full bg-green-500" title="WhatsApp Sent" />
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-4 flex justify-between md:justify-end gap-2 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 md:border-0 pl-0 md:pl-0">
                          <button
                            onClick={() => {
                              // Switch to single view for this learner
                              setReportData({
                                ...reportData,
                                rows: [row],
                                learner: row.learner,
                                results: row.results,
                                averageScore: row.averageScore,
                                communication: row.communication,
                                pathwayPrediction: row.pathwayPrediction
                              });
                            }}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition shadow-sm flex-1 md:flex-none flex justify-center items-center gap-1 text-[10px] font-medium uppercase"
                            title="View Full Report"
                          >
                            <Printer size={12} /> <span className="md:hidden">View</span>
                          </button>
                          <button
                            onClick={() => handleSingleDownload(row)}
                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded transition shadow-sm flex-1 md:flex-none flex justify-center items-center gap-1 text-[10px] font-medium uppercase"
                            title="Print / Save PDF"
                          >
                            <Download size={12} /> <span className="md:hidden">Save PDF</span>
                          </button>
                          <button
                            disabled={isSendingSMS}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition shadow-sm disabled:opacity-30 flex-1 md:flex-none flex justify-center items-center gap-1 text-[10px] font-medium uppercase"
                            title="Send SMS"
                            onClick={() => handleSendSMS(row)}
                          >
                            <MessageSquare size={12} /> <span className="md:hidden">SMS</span>
                          </button>
                          <button
                            disabled={!(row.learner.parent?.phone || row.learner.parentPhone || row.learner.parentPhoneNumber || row.learner.guardianPhone)}
                            className={`p-2 rounded transition shadow-sm disabled:opacity-30 flex-1 md:flex-none flex justify-center items-center gap-1 text-[10px] font-medium uppercase ${row.communication?.hasSentWhatsApp ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'}`}
                            title={row.communication?.hasSentWhatsApp ? "WhatsApp Sent - Click to resend" : "Send WhatsApp"}
                            onClick={() => {
                              const currentLearner = row.learner;
                              handleSendWhatsApp(row); // Update this function to handle direct send
                            }}
                          >
                            <MessageCircle size={12} /> <span className="md:hidden">WA</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 border-t pt-6">
                  {/* ACTION BAR FOR BULK PREVIEW */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full bg-indigo-50 p-4 rounded-xl border border-indigo-100 no-print gap-4 md:gap-0">
                    <div>
                      <p className="text-sm font-medium text-indigo-900">Combined Actions</p>
                      <p className="text-[10px] text-indigo-600 font-medium uppercase tracking-wider">
                        {selectedReportRows.length > 0 ? `${selectedReportRows.length} learners selected` : `Apply to all ${reportData.rows.length} learners`}
                      </p>
                    </div>
                    <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
                      <button
                        onClick={handleBulkSMS}
                        disabled={bulkProgress.active}
                        className="flex-1 md:flex-none justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md flex items-center gap-2 font-medium uppercase text-[10px]"
                      >
                        {bulkProgress.active ? <Loader className="animate-spin" size={14} /> : <MessageSquare size={14} />}
                        {bulkProgress.active ? 'Sending SMS...' : 'Bulk Send SMS'}
                      </button>
                      <button
                        onClick={() => setShowWhatsAppConfirm(true)}
                        disabled={isSendingWhatsApp}
                        className="flex-1 md:flex-none justify-center px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-md flex items-center gap-2 font-medium uppercase text-[10px]"
                      >
                        {isSendingWhatsApp ? <Loader className="animate-spin" size={14} /> : <MessageCircle size={14} />}
                        {isSendingWhatsApp ? 'Sending...' : 'Bulk WhatsApp'}
                      </button>
                      <div className="relative w-full md:w-auto mt-2 md:mt-0">
                        <button
                          onClick={handleBulkPrint}
                          disabled={isBulkPrinting}
                          className="w-full justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md flex items-center gap-2 font-medium uppercase text-[10px]"
                        >
                          {isBulkPrinting ? <Loader className="animate-spin" size={14} /> : <Printer size={14} />}
                          {isBulkPrinting ? 'Processing...' : 'Download Combined PDF'}
                        </button>
                        {isBulkPrinting && (
                          <button
                            type="button"
                            onClick={() => {
                              if (bulkPrintAbortController.current) {
                                bulkPrintAbortController.current.abort();
                                setPdfProgress('Cancelling bulk PDF generation…');
                              }
                            }}
                            className="mt-2 w-full justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-md flex items-center gap-2 font-medium uppercase text-[10px]"
                          >
                            Cancel
                          </button>
                        )}
                        {isBulkPrinting && pdfProgress && (
                          <div className="absolute top-full left-0 md:left-auto md:right-0 mt-1.5 text-[10px] font-medium text-indigo-600 animate-pulse whitespace-nowrap">
                            {pdfProgress}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setReportData(null)}
                    className="text-slate-500 hover:text-slate-800 font-medium uppercase text-xs transition px-4 py-2 border rounded-lg hover:bg-slate-50"
                  >
                    ← Back to Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GRADE / STREAM REPORT DISPLAY - BROADSHEET */}
      {
        (reportData?.type === 'GRADE_REPORT' || reportData?.type === 'STREAM_REPORT' || reportData?.type === 'STREAM_RANKING_REPORT') && reportData?.rows && (
          <div className="px-6 py-8">
            <div className="bg-gray-100 py-12 px-4 rounded-xl shadow-inner mb-8 no-print">
              <div
                id="summative-report-content"
                className="pdf-report-root print-landscape-root bg-white mx-auto shadow-2xl overflow-hidden"
                style={{
                  fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                  lineHeight: '1.2',
                  width: '297mm', // Landscape for broadsheet
                  minHeight: '210mm',
                  padding: '10mm',
                  boxSizing: 'border-box'
                }}
              >
                {/* Professional Letterhead - Matching Learner's Report Flow */}
                <div className="mb-6 flex flex-col items-center text-center pdf-report-header">
                  {/* Logo Middle */}
                  <div className="mb-4">
                    <img
                      src={brandingSettings?.logoUrl || user?.school?.logo || "/branding/logo.png"}
                      alt="Logo"
                      style={{ height: '100px', width: 'auto', objectFit: 'contain' }}
                      onError={(e) => { e.target.src = '/branding/logo.png'; }}
                    />
                  </div>

                  {/* School Info */}
                  <h1 style={{ fontSize: '36px', fontWeight: '950', color: brandingSettings?.brandColor || '#1E3A8A', margin: '0', textTransform: 'uppercase', letterSpacing: '1.5px', lineHeight: '1.1' }}>
                    {getSchoolDisplayName(brandingSettings?.schoolName, user?.school?.name, { fallback: PRODUCT_DISPLAY_NAME })}
                  </h1>

                  {user?.school?.motto && (
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginTop: '2px', textTransform: 'uppercase', fontStyle: 'italic' }}>
                      "{user.school.motto}"
                    </div>
                  )}

                  {/* Contact Details */}
                  <div style={{ fontSize: '11px', color: '#444', marginTop: '6px', fontWeight: '500', opacity: '0.8' }}>
                    {user?.school?.location && <span>{user.school.location}</span>}
                    {user?.school?.email && <span> • {user.school.email}</span>}
                  </div>

                  {/* Separator Line */}
                  <div className="w-full h-1 mt-4 mb-4" style={{ backgroundColor: brandingSettings?.brandColor || '#1e3a8a' }}></div>

                  {/* Bold Report Title */}
                  <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#000', margin: '0', textTransform: 'uppercase', letterSpacing: '2px' }}>
                    {reportData?.title}
                  </h2>

                  {/* Term/Academic Year Details In Pill */}
                  <div className="flex justify-between items-center w-full mt-4">
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', backgroundColor: '#eff6ff', padding: '6px 20px', borderRadius: '40px', border: '1px solid #dbeafe' }}>
                      {setup.academicYear} | {reportData.meta?.term?.replace(/_/g, ' ')}
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                      CLASS: {reportData.meta?.grade?.replace(/_/g, ' ')} {reportData.meta?.stream !== 'all' ? reportData.meta?.stream : ''} | GENERATED: {new Date().toLocaleDateString()}
                    </div>
                  </div>
                </div>


                {/* Broadsheet Table — unified for print + screen */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ fontSize: '11px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#1e3a8a', color: 'white' }}>
                        <th style={{ ...cellBorder, padding: '6px', textAlign: 'center', width: '30px' }}>#</th>
                        <th style={{ ...cellBorder, padding: '6px', textAlign: 'left', minWidth: '150px' }}>LEARNER NAME</th>
                        {reportData.subjects.map(subj => (
                          <th
                            key={subj}
                            style={{
                              ...cellBorder,
                              padding: '6px',
                              textAlign: 'center',
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                              minHeight: '80px',
                              boxShadow: 'inset 0 1px 0 #111827',
                            }}
                          >
                            {getAbbreviatedName(subj)}
                          </th>
                        ))}
                        <th style={{ ...cellBorder, padding: '6px', textAlign: 'center' }}>TOTAL</th>
                        <th style={{ ...cellBorder, padding: '6px', textAlign: 'center' }}>AVG %</th>
                        <th style={{ ...cellBorder, padding: '6px', textAlign: 'center' }}>GRD</th>
                        <th style={{ ...cellBorder, padding: '6px', textAlign: 'center', backgroundColor: '#1e3a8a', color: '#fbbf24' }}>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.map((row, idx) => (
                        <tr key={row.learner.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center' }}>{row.position}</td>
                          <td style={{ ...cellBorder, padding: '4px', fontWeight: 'bold' }}>
                            {row.learner.firstName} {row.learner.lastName}
                          </td>
                          {reportData.subjects.map(subj => (
                            <td key={`${row.learner.id}-${subj}`} style={{ ...cellBorder, padding: '4px', textAlign: 'center' }}>
                              {row.subjectScores[subj] || '-'}
                            </td>
                          ))}
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{Math.round(row.totalScore)}</td>
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{row.averagePct}%</td>
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: 'bold', color: row.grade?.includes('EE') ? 'green' : row.grade?.includes('ME') ? 'blue' : 'orange' }}>
                            {row.grade}
                          </td>
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: '900', color: '#1e3a8a', backgroundColor: idx % 2 === 0 ? '#eff6ff' : '#e0f2fe' }}>
                            {row.meritPoints ?? '-'}
                          </td>
                        </tr>
                      ))}
                      {getBroadsheetSummaryRows(reportData).map((summaryRow) => (
                        <tr
                          key={`summary-${summaryRow.key}`}
                          style={{
                            backgroundColor: '#eff6ff',
                            fontWeight: 'bold',
                          }}
                        >
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center' }}></td>
                          <td style={{ ...cellBorder, padding: '4px', fontWeight: '900' }}>
                            {summaryRow.label}
                          </td>
                          {summaryRow.subjectValues.map((value, subjectIdx) => (
                            <td
                              key={`summary-${summaryRow.key}-${reportData.subjects[subjectIdx]}`}
                              style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: 'bold' }}
                            >
                              {value}
                            </td>
                          ))}
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{summaryRow.total}</td>
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{summaryRow.average}</td>
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: 'bold', color: '#666' }}></td>
                          <td style={{ ...cellBorder, padding: '4px', textAlign: 'center', fontWeight: 'bold', color: '#1e3a8a', backgroundColor: '#dbeafe' }}>
                            {summaryRow.key === 'points' ? summaryRow.meanPts ?? '-' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* BULK ACTIONS & CONTROLS */}
                <div className="no-print mt-8 flex flex-wrap justify-center items-center gap-3 bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-4">
                  <button
                    onClick={() => setReportData(null)}
                    className="px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded text-sm font-semibold transition shadow-sm"
                  >
                    ← Back
                  </button>

                  <button
                    onClick={handleBulkPrint}
                    disabled={isBulkPrinting}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition shadow-sm font-semibold text-sm"
                  >
                    {isBulkPrinting ? <Loader className="animate-spin" size={16} /> : <Printer size={16} />}
                    {isBulkPrinting ? 'Generating...' : 'Print All'}
                  </button>

                  <button
                    onClick={handleBulkSMS}
                    disabled={bulkProgress.active}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow-sm font-semibold text-sm"
                  >
                    {bulkProgress.active ? <Loader className="animate-spin" size={16} /> : <MessageSquare size={16} />}
                    {bulkProgress.active ? `Sending (${bulkProgress.current}/${bulkProgress.total})` : 'Send SMS All'}
                  </button>

                  <button
                    onClick={() => setShowWhatsAppConfirm(true)}
                    disabled={isSendingWhatsApp}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition shadow-sm font-semibold text-sm"
                    title="Send via WhatsApp (Batched)"
                  >
                    {isSendingWhatsApp ? <Loader className="animate-spin" size={16} /> : <MessageCircle size={16} />}
                    {isSendingWhatsApp ? 'Wait...' : 'Bulk WhatsApp'}
                  </button>

                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition shadow-sm font-semibold text-sm"
                  >
                    {isExporting ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                    {isExporting ? 'Opening...' : 'Print / Save Broadsheet'}
                  </button>

                  <button
                    onClick={handleExportBroadsheetExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition shadow-sm font-semibold text-sm"
                  >
                    <FileText size={16} />
                    Export Excel
                  </button>

                  {(bulkProgress.active || isSendingWhatsApp) && (
                    <div className="w-full text-center mt-2 text-sm font-medium text-gray-700">
                      {isSendingWhatsApp ? (
                        <span className="text-green-600 flex items-center justify-center gap-2 font-medium animate-pulse">
                          <Loader className="animate-spin" size={12} />
                          WhatsApp Batch: {whatsAppProgress.current}/{whatsAppProgress.total}
                        </span>
                      ) : (
                        <div className="flex justify-center gap-3 font-medium">
                          <span className="text-green-600">SUCCESS: {bulkProgress.success}</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-red-500">FAILED: {bulkProgress.failed}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* ANALYSIS REPORT DISPLAY */}
      {
        reportData?.type?.includes('ANALYSIS') && (
          <div className="px-6 py-8">
            <div className="bg-gray-100 py-12 px-4 rounded-xl shadow-inner mb-8 no-print">
              <div
                id="summative-report-content"
                className="pdf-report-root bg-white mx-auto shadow-2xl overflow-hidden"
                style={{
                  fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                  lineHeight: '1.2',
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '12mm',
                  boxSizing: 'border-box'
                }}
              >
                {/* Professional Letterhead - Consistency across reports */}
                <div className="mb-6 flex flex-col items-center text-center pdf-report-header">
                  {/* Logo Middle */}
                  <div className="mb-4">
                    <img
                      src={brandingSettings?.logoUrl || user?.school?.logo || ""}
                      alt="Logo"
                      style={{ height: '80px', width: 'auto', objectFit: 'contain', display: brandingSettings?.logoUrl || user?.school?.logo ? 'block' : 'none' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>

                  {/* School Info */}
                  <h1 style={{ fontSize: '36px', fontWeight: '950', color: brandingSettings?.brandColor || '#1E3A8A', margin: '0', textTransform: 'uppercase', letterSpacing: '1.5px', lineHeight: '1.1' }}>
                    {getSchoolDisplayName(brandingSettings?.schoolName, user?.school?.name, { fallback: PRODUCT_DISPLAY_NAME })}
                  </h1>

                  {user?.school?.motto && (
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginTop: '2px', textTransform: 'uppercase', fontStyle: 'italic' }}>
                      "{user.school.motto}"
                    </div>
                  )}

                  {/* Separator Line */}
                  <div className="w-full h-0.5 mt-3 mb-3" style={{ backgroundColor: brandingSettings?.brandColor || '#1e3a8a' }}></div>

                  {/* Bold Report Title */}
                  <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#000', margin: '0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {reportData?.title}
                  </h2>

                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#1E3A8A', marginTop: '4px', textTransform: 'uppercase', backgroundColor: '#eff6ff', padding: '4px 16px', borderRadius: '40px' }}>
                    {setup.academicYear} | {reportData.meta?.term?.replace(/_/g, ' ')}
                  </div>
                </div>

                {/* Subject Performance Table */}
                <div className="mb-8">
                  <h2 className="text-lg font-medium text-gray-800 mb-4 border-l-4 border-blue-600 pl-2">Subject Performance Analysis</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>SUBJECT</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>LEARNERS</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>MEAN SCORE</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>HIGHEST</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>LOWEST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.subjectStats.map((stat, idx) => (
                        <tr key={stat.subject} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px', fontWeight: '600' }}>{stat.subject}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{stat.count}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>{stat.mean}%</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#16a34a' }}>{stat.highest}%</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#dc2626' }}>{stat.lowest}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Grade Distribution */}
                <div className="mb-8">
                  <h2 className="text-lg font-medium text-gray-800 mb-4 border-l-4 border-blue-600 pl-2">Grade Distribution</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                    <div className="p-4 bg-green-50 rounded border border-green-200 text-center">
                      <div className="text-2xl font-medium text-green-700">{reportData.gradeDist['EE'] || 0}</div>
                      <div className="text-xs font-medium text-green-800 uppercase mt-1">Exceeding Exp.</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded border border-blue-200 text-center">
                      <div className="text-2xl font-medium text-blue-700">{reportData.gradeDist['ME'] || 0}</div>
                      <div className="text-xs font-medium text-blue-800 uppercase mt-1">Meeting Exp.</div>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded border border-yellow-200 text-center">
                      <div className="text-2xl font-medium text-yellow-700">{reportData.gradeDist['AE'] || 0}</div>
                      <div className="text-xs font-medium text-yellow-800 uppercase mt-1">Approaching Exp.</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded border border-red-200 text-center">
                      <div className="text-2xl font-medium text-red-700">{reportData.gradeDist['BE'] || 0}</div>
                      <div className="text-xs font-medium text-red-800 uppercase mt-1">Below Exp.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="no-print mt-8 flex gap-4 justify-center">
                <button
                  onClick={() => setReportData(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold transition"
                >
                  ← Back
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-semibold transition flex items-center gap-2"
                >
                  {isExporting ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
                  {isExporting ? 'Opening...' : 'Print / Save Analysis PDF'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* CONSOLIDATED HIDDEN CONTAINERS FOR PDF GENERATION */}
      <div className="fixed -left-[10000px] top-0 no-print" style={{ pointerEvents: 'none', visibility: 'hidden' }}>
        {/* Bulk Download Container */}
        {bulkDownloadData && (
          <div id="bulk-print-content">
            {bulkDownloadData.map((row, index) => (
              <div
                key={`bulk-${row.learner.id}-${index}`}
                className="pdf-report-page"
                style={{ pageBreakAfter: index === bulkDownloadData.length - 1 ? 'auto' : 'always' }}
              >
                <LearnerReportTemplate
                  learner={row.learner}
                  results={row.results}
                  pathwayPrediction={row.pathwayPrediction}
                  categoryAverages={row.byCategoryAverages || []}
                  term={stagedTerm || selectedTerm}
                  academicYear={academicYear || setup.academicYear}
                  commentData={commentMap?.[row?.learner?.id]}
                  brandingSettings={brandingSettings}
                  user={user}
                  streamConfigs={streamConfigs}
                  remarks={row.remarks || row.results?.[0]?.remarks}
                />
              </div>
            ))}
          </div>
        )}

        {/* Single Download Container */}
        {singleDownloadData && (
          <div id="single-print-content" className="pdf-report-root">
            <LearnerReportTemplate
              learner={singleDownloadData.learner}
              results={singleDownloadData.results}
              pathwayPrediction={singleDownloadData.pathwayPrediction}
              categoryAverages={singleDownloadData.byCategoryAverages || []}
              term={stagedTerm || selectedTerm}
              academicYear={academicYear || setup.academicYear}
              commentData={singleCommentData}
              brandingSettings={brandingSettings}
              user={user}
              streamConfigs={streamConfigs}
              remarks={singleDownloadData.remarks || singleDownloadData.results?.[0]?.remarks}
            />
          </div>
        )}
      </div>

      {/* SMS PREVIEW MODAL */}
      {
        showSMSPreview && smsPreviewData && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowSMSPreview(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                      <AlertCircle className="h-6 w-6 text-blue-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Confirm SMS Delivery
                      </h3>
                      <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        {/* Editable Phone Number Input */}
                        <div className="mb-4">
                          <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Recipient Phone Number</label>
                          <input
                            type="text"
                            value={editedPhoneNumber}
                            onChange={(e) => setEditedPhoneNumber(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. 0712345678"
                          />

                          {/* Contact Suggestions */}
                          {smsPreviewData.contactOptions?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {smsPreviewData.contactOptions.map((opt, i) => (
                                <button
                                  key={i}
                                  onClick={() => setEditedPhoneNumber(opt.phone)}
                                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all border ${editedPhoneNumber === opt.phone
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                                    }`}
                                  title={`Use ${opt.label}: ${opt.phone}`}
                                >
                                  {opt.label}: {opt.phone}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                          <span>Message Preview</span>
                        </div>
                        <div className="text-sm text-gray-900 whitespace-pre-wrap font-mono bg-white p-3 border border-gray-200 rounded shadow-inner">
                          {smsPreviewData.message}
                        </div>
                        <div className="mt-2 text-[10px] text-gray-400 text-right italic">
                          Estimated: {Math.ceil(smsPreviewData.message.length / 160)} SMS Part(s)
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm text-gray-500">
                          This summary will be sent to the parent. Please verify the content before proceeding.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={executeSendSMS}
                    disabled={isSendingSMS}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isSendingSMS ? 'Sending...' : 'Send Now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSMSPreview(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* SMS BULK CONFIRMATION / PROGRESS MODAL */}
      {
        (showSMSBulkConfirm || bulkProgress.active) && (
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-100">

              {!bulkProgress.active ? (
                <>
                  <h3 className="text-xl font-medium mb-4 flex items-center gap-2 text-gray-800">
                    <MessageSquare className="text-blue-500" />
                    Start Bulk SMS?
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    You are about to send report summaries to <strong>{selectedReportRows.length > 0 ? selectedReportRows.length : reportData.rows.length}</strong> parents via SMS.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-4 text-xs text-blue-800 font-medium">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium mb-1">Cost Estimate</div>
                        <div>Approx. {Math.ceil((selectedReportRows.length > 0 ? selectedReportRows.length : reportData.rows.length) * 2)} SMS parts will be sent.</div>
                        <div className="text-[10px] text-blue-600 mt-1 italic">Each report is ~2-3 SMS parts (160 chars each)</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-medium mb-1 text-gray-500 uppercase">Send Test Message To (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 0712345678"
                      id="sms-test-number"
                      className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">If entered, ALL messages will be sent to this number for testing.</p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowSMSBulkConfirm(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const testNum = document.getElementById('sms-test-number').value;
                        executeBulkSMS(testNum || null);
                      }}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm shadow-lg shadow-blue-200 transition transform hover:scale-105"
                    >
                      Start Sending
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Sending SMS Messages...</h3>
                  <p className="text-gray-500 text-sm mb-6">Please do not close this window.</p>

                  <div className="w-full bg-gray-100 rounded-full h-4 mb-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs font-medium text-gray-500 uppercase mb-4">
                    <span>Progress</span>
                    <span>{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>

                  <div className="flex justify-center gap-4 text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <CheckCircle size={14} className="text-green-600" />
                      <span className="text-green-600">Success: {bulkProgress.success}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle size={14} className="text-red-600" />
                      <span className="text-red-600">Failed: {bulkProgress.failed}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* GENERAL NOTIFICATION MODAL */}

      {/* WHATSAPP PROGRESS / CONFIRMATION MODAL - GLOBAL */}
      {
        (showWhatsAppConfirm || isSendingWhatsApp) && (
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-100">

              {!isSendingWhatsApp ? (
                <>
                  <h3 className="text-xl font-medium mb-4 flex items-center gap-2 text-gray-800">
                    <MessageCircle className="text-green-500" />
                    Start Bulk WhatsApp?
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    You are about to send report summaries to <strong>{selectedReportRows.length > 0 ? selectedReportRows.length : reportData.rows.length}</strong> parents via WhatsApp.
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4 text-xs text-yellow-800 font-medium">
                    Messages will be sent in batches with intervals to comply with WhatsApp policies.
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-medium mb-1 text-gray-500 uppercase">Send Test Message To (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 0712345678"
                      id="wa-test-number"
                      className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none transition"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">If entered, ALL messages will be sent to this number for testing.</p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowWhatsAppConfirm(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const testNum = document.getElementById('wa-test-number').value;
                        handleBulkWhatsApp(testNum || null);
                      }}
                      className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium text-sm shadow-lg shadow-green-200 transition transform hover:scale-105"
                    >
                      Start Sending
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 border-4 border-green-100 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Sending WhatsApp Messages...</h3>
                  <p className="text-gray-500 text-sm mb-6">Please do not close this window.</p>

                  <div className="w-full bg-gray-100 rounded-full h-4 mb-2 overflow-hidden">
                    <div
                      className="bg-green-500 h-4 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${(whatsAppProgress.current / whatsAppProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs font-medium text-gray-500 uppercase">
                    <span>Progress</span>
                    <span>{whatsAppProgress.current} / {whatsAppProgress.total}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* HIDDEN CAPTURE CONTAINERS — Used by html2canvas for PDF/WhatsApp generation */}
      {/* NOTE: visibility:hidden (NOT opacity:0) is required here.
           html2canvas fails silently on opacity:0 and renders a blank/misaligned
           canvas. visibility:hidden keeps the element in the layout tree so
           html2canvas can read it, while remaining invisible to the user. */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '794px', minHeight: '1123px', visibility: 'hidden', pointerEvents: 'none', zIndex: -100, overflow: 'visible' }}>
        {/* Single Page Capture */}
        {(singleDownloadData || (reportData?.rows?.length === 1 && (reportData.type === 'LEARNER_REPORT' || reportData.type === 'LEARNER_TERMLY_REPORT'))) && (
          <div id="single-print-content" className="pdf-report-root">
            <LearnerReportTemplate
              learner={singleDownloadData?.learner || reportData?.learner || reportData?.rows?.[0]?.learner}
              results={singleDownloadData?.results || reportData?.results || reportData?.rows?.[0]?.results || []}
              pathwayPrediction={singleDownloadData?.pathwayPrediction || reportData?.pathwayPrediction || reportData?.rows?.[0]?.pathwayPrediction}
              categoryAverages={singleDownloadData?.byCategoryAverages || reportData?.byCategoryAverages || reportData?.rows?.[0]?.byCategoryAverages || []}
              term={selectedTerm || reportData?.term}
              academicYear={academicYear || reportData?.academicYear}
              brandingSettings={brandingSettings}
              user={user}
              streamConfigs={streamConfigs}
              gradingRanges={gradingRanges}
              commentData={singleCommentData || (reportData?.results?.[0]?.remarks && reportData.results[0].remarks !== '-' ? { principalComment: reportData.results[0].remarks } : null)}
            />
          </div>
        )}

        {/* Bulk Pages Capture */}
        {bulkDownloadData && bulkDownloadData.length > 0 && (
          <div id="bulk-print-content" style={{ display: 'flex', flexDirection: 'column' }}>
            {bulkDownloadData.map((row, idx) => (
              <div key={idx} className="pdf-report-page" style={{ width: '794px', minHeight: '1123px', overflow: 'visible', backgroundColor: '#fff' }}>
                <LearnerReportTemplate
                  learner={row.learner}
                  results={row.results || []}
                  pathwayPrediction={row.pathwayPrediction}
                  categoryAverages={row.byCategoryAverages || []}
                  term={selectedTerm || reportData?.term}
                  academicYear={academicYear || reportData?.academicYear}
                  brandingSettings={brandingSettings}
                  user={user}
                  streamConfigs={streamConfigs}
                  gradingRanges={gradingRanges}
                  commentData={commentMap?.[row?.learner?.id]}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NOTIFICATION MODAL */}
      {
        notificationModal.show && (
          <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setNotificationModal({ ...notificationModal, show: false })}></div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${notificationModal.type === 'error' ? 'bg-red-100' : notificationModal.type === 'success' ? 'bg-green-100' : 'bg-blue-100'}`}>
                      {notificationModal.type === 'error' ? (
                        <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : notificationModal.type === 'success' ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        {notificationModal.title}
                      </h3>
                      <div className="mt-2">
                        <pre className="text-sm text-gray-500 whitespace-pre-wrap font-sans">
                          {notificationModal.message}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${notificationModal.type === 'error' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`}
                    onClick={() => setNotificationModal({ ...notificationModal, show: false })}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* LOADING OVERLAY FOR PDF EXPORT */}
      {
        isExporting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white bg-opacity-90 backdrop-blur-sm">
            <div className="text-center p-8 bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-sm w-full">
              <div className="relative mb-6 flex justify-center">
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg animate-pulse flex items-center justify-center">
                    <span className="text-white text-[10px] font-medium">PDF</span>
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Preparing Print Preview</h3>
              <p className="text-sm text-gray-500 mb-4">Please wait while we open a clean print view. Choose "Save as PDF" in the print dialog.</p>
              <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold text-sm">
                <Loader className="animate-spin" size={14} />
                <span>{pdfProgress || 'Initializing...'}</span>
              </div>
            </div>
          </div>
        )
      }

      {/* Toast Notification for local feedback */}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={hideNotification}
      />
    </div>
  );
};

export default SummativeReport;
