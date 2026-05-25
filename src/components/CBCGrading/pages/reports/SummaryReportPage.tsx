/**
 * Summary Report Page - Full Assessment Matrix
 * Professional, high-density grid for cross-subject analysis
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  FileText, 
  Download, 
  Loader, 
  Search, 
  ChevronRight, 
  AlertCircle, 
  Printer,
  Table as TableIcon,
  Filter,
  RefreshCw,
  DownloadCloud,
  FileSpreadsheet,
  CheckCircle,
  Layout,
  Users
} from 'lucide-react';
import api, { configAPI, assessmentAPI, learnerAPI } from '../../../../services/api';
import { useSchoolData } from '../../../../contexts/SchoolDataContext';
import VirtualizedTable from '../../shared/VirtualizedTable';
import { getAcademicYearOptions, getCurrentAcademicYear } from '../../utils/academicYear';
import { resolveTestType, formatTestTypeLabel } from '../../utils/testType';
import { learningAreas } from '../../data/learningAreas';
import { gradeStructure } from '../../data/gradeStructure';
import ExcelJS from 'exceljs';
import { toast } from 'react-hot-toast';

// ============================================================================
// CONSTANTS & UTILS
// ============================================================================

const LEARNING_AREA_ABBREVIATIONS = {
  'MATHEMATICS': 'MATH',
  'ENGLISH': 'LANG',
  'KISWAHILI': 'KISW',
  'SCIENCE AND TECHNOLOGY': 'SCI',
  'SOCIAL STUDIES': 'SOC',
  'CHRISTIAN RELIGIOUS EDUCATION': 'CRE',
  'ISLAMIC RELIGIOUS EDUCATION': 'IRE',
  'CREATIVE ARTS AND SPORTS': 'CREA',
  'AGRICULTURE': 'AGRI',
  'ENVIRONMENTAL ACTIVITIES': 'ENV',
  'HOMESCIENCE': 'H/SCI',
  'MUSIC': 'MUS',
  'ART AND CRAFT': 'ART',
  'PHYSICAL AND HEALTH EDUCATION': 'PHE',
  'SHUGHULI ZA KISWAHILI': 'KISW',
  'MATHEMATICAL ACTIVITIES': 'MATH',
  'ENGLISH LANGUAGE ACTIVITIES': 'LANG',
  'KISWAHILI LANGUAGE ACTIVITIES': 'KISW',
  'SCIENCE & TECHNOLOGY': 'SCI',
  'PRE-TECHNICAL STUDIES': 'P-TECH',
  'INTEGRATED SCIENCE': 'I-SCI',
  'SOCIAL STUDIES & LIFE SKILLS': 'SOC',
  'MOVEMENT AND CREATIVE ACTIVITIES': 'CREA',
  'ENVIRONMENTAL STUDIES': 'ENV',
  'LITERACY ACTIVITIES': 'LIT',
  'LITERACY': 'LIT',
  'HYGIENE AND NUTRITION ACTIVITIES': 'HYG',
  'RELIGIOUS EDUCATION': 'REL',
  'CREATIVE ACTIVITIES': 'CREA',
  'PSYCHOMOTOR AND CREATIVE ACTIVITIES': 'CREA',
  'PASTORAL PROGRAMME OF INSTRUCTION (PPI)': 'PASTO',
  'PASTORAL PROGRAMME OF INSTRUCTION': 'PASTO',
  'INDIGENOUS LANGUAGE': 'INDI',
  'LANGUAGE ACTIVITIES': 'LANG'
};
const CORE_EXAM_TYPES = ['OPENER', 'MID_TERM', 'END_TERM', 'MOCK'];

const getAbbreviatedName = (name) => {
  if (!name) return '';
  const upper = name.toUpperCase().trim();
  return LEARNING_AREA_ABBREVIATIONS[upper] || (name.length > 8 ? name.substring(0, 8).toUpperCase() : name.toUpperCase());
};

const getCBCGrade = (percentage) => {
  if (percentage >= 90) return { grade: 'EE1', remark: 'Exceeding', color: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (percentage >= 75) return { grade: 'EE2', remark: 'Exceeding', color: 'text-emerald-600', bg: 'bg-emerald-50/50' };
  if (percentage >= 58) return { grade: 'ME1', remark: 'Meeting', color: 'text-blue-700', bg: 'bg-blue-50' };
  if (percentage >= 41) return { grade: 'ME2', remark: 'Meeting', color: 'text-blue-600', bg: 'bg-blue-50/50' };
  if (percentage >= 31) return { grade: 'AE1', remark: 'Approaching', color: 'text-amber-700', bg: 'bg-amber-50' };
  if (percentage >= 21) return { grade: 'AE2', remark: 'Approaching', color: 'text-amber-600', bg: 'bg-amber-50/50' };
  if (percentage >= 11) return { grade: 'BE1', remark: 'Below', color: 'text-rose-700', bg: 'bg-rose-50' };
  return { grade: 'BE2', remark: 'Below', color: 'text-rose-800', bg: 'bg-rose-100' };
};

// ============================================================================
// COMPONENT
// ============================================================================

const SummaryReportPage = ({ pageParams = {} }: { pageParams?: any }) => {
  const { grades: fetchedGrades, loading: schoolDataLoading } = useSchoolData();

  // Filter States
  const [stagedGrade, setStagedGrade] = useState('');
  const [stagedStream, setStagedStream] = useState('all');
  const [stagedTerm, setStagedTerm] = useState('TERM_1');
  const [stagedYear, setStagedYear] = useState(getCurrentAcademicYear());
  const [stagedTestType, setStagedTestType] = useState('');



  // Data States
  const [loading, setLoading] = useState(false);
  const [matrixData, setMatrixData] = useState(null);
  const [noStudentsFound, setNoStudentsFound] = useState(false);
  const [availableStreams, setAvailableStreams] = useState([]);


  const [availableTestTypes, setAvailableTestTypes] = useState([]);
  const [examTypeTimestamps, setExamTypeTimestamps] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const mergedExamTypes = useMemo(() => {
    const merged = [...new Set([...(availableTestTypes || []), ...CORE_EXAM_TYPES])];
    return merged.sort((a, b) => {
      const order = { OPENER: 1, MID_TERM: 2, END_TERM: 3 };
      const ao = order[a] || 99;
      const bo = order[b] || 99;
      if (ao !== bo) return ao - bo;
      return a.localeCompare(b);
    });
  }, [availableTestTypes]);
  
  // Track last fetched configuration to avoid loops but allow auto-switching
  const lastFetchRef = useRef(null);
  const isFetchingRef = useRef(false);
  const initializedFromParamsRef = useRef(false);
  const latestDefaultsAppliedGradeRef = useRef('');

  useEffect(() => {
    if (initializedFromParamsRef.current) return;
    initializedFromParamsRef.current = true;

    const normalize = (value: any) => String(value || '').trim().replace(/\s+/g, '_').toUpperCase();

    if (pageParams?.grade) {
      const normalizedGrade = normalize(pageParams.grade);
      setStagedGrade(normalizedGrade);
    }
    if (pageParams?.stream) {
      setStagedStream(String(pageParams.stream));
    }
    if (pageParams?.term) {
      const normalizedTerm = normalize(pageParams.term);
      if (['TERM_1', 'TERM_2', 'TERM_3'].includes(normalizedTerm)) {
        setStagedTerm(normalizedTerm);
      }
    }
    if (pageParams?.academicYear && !Number.isNaN(Number(pageParams.academicYear))) {
      setStagedYear(Number(pageParams.academicYear));
    }
  }, [pageParams]);

  // Initial Fetch: Streams — single-tenant, no schoolId guard needed
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const resp = await configAPI.getStreamConfigs();
        const streamsArr = Array.isArray(resp?.data) ? resp.data
          : Array.isArray(resp) ? resp
          : [];
        setAvailableStreams(streamsArr.filter(s => s.active !== false));
      } catch (error) {
        console.error('Failed to fetch streams:', error);
      }
    };
    fetchStreams();
  }, []);

  // Fetch available test types when grade/term/year changes
  useEffect(() => {
    const fetchTestTypes = async () => {
      if (!stagedGrade || !stagedTerm || !stagedYear) {
        setAvailableTestTypes([]);
        return;
      }
      try {
        const resp = await assessmentAPI.getTests({
          grade: stagedGrade,
          term: stagedTerm,
          academicYear: stagedYear
        });
        const tests = resp?.data || [];
        const types = [...new Set(tests.map((t: any) => resolveTestType(t)).filter(Boolean))].sort() as string[];
        const typeDateMap: Record<string, string> = {};
        tests.forEach((t: any) => {
          const type = resolveTestType(t);
          if (!type) return;
          const ts = new Date(t?.testDate || t?.updatedAt || t?.createdAt || 0).getTime();
          const prev = typeDateMap[type] ? new Date(typeDateMap[type]).getTime() : 0;
          if (ts > prev) {
            typeDateMap[type] = t?.testDate || t?.updatedAt || t?.createdAt || '';
          }
        });
        setAvailableTestTypes(types);
        setExamTypeTimestamps(typeDateMap);
        const latestTest = [...tests].sort((a: any, b: any) => {
          const da = new Date(a?.testDate || a?.updatedAt || a?.createdAt || 0).getTime();
          const db = new Date(b?.testDate || b?.updatedAt || b?.createdAt || 0).getTime();
          return db - da;
        })[0];
        const latestType = latestTest ? resolveTestType(latestTest) : null;
        // Keep existing valid selection; otherwise default to OPENER, then first.
        setStagedTestType((prev: string) => {
          const nextTypes = [...new Set([...(types || []), ...CORE_EXAM_TYPES])];
          if (nextTypes.length === 0) return '';
          if (latestType && nextTypes.includes(latestType)) return latestType;
          // Accept if the exact value OR a case-insensitive normalized match exists
          const prevNorm = prev.toUpperCase().replace(/[\s-]+/g, '_');
          const hasMatch = nextTypes.some(t => t === prev || t.toUpperCase().replace(/[\s-]+/g, '_') === prevNorm);
          if (hasMatch) return prev;
          if (nextTypes.includes('OPENER')) return 'OPENER';
          return nextTypes[0];
        });
      } catch {
        setAvailableTestTypes([]);
        setStagedTestType('OPENER');
      }
    };
    fetchTestTypes();
  }, [stagedGrade, stagedTerm, stagedYear]);

  // Strict default on load: use the latest available test's term, year and exam type.
  useEffect(() => {
    const applyLatestExamDefaults = async () => {
      if (!stagedGrade || latestDefaultsAppliedGradeRef.current === stagedGrade) return;
      try {
        const resp = await assessmentAPI.getTests({ grade: stagedGrade });
        const allTests = Array.isArray(resp?.data) ? resp.data : [];
        if (!allTests.length) return;
        const latest = [...allTests].sort((a: any, b: any) => {
          const da = new Date(a?.testDate || a?.updatedAt || a?.createdAt || 0).getTime();
          const db = new Date(b?.testDate || b?.updatedAt || b?.createdAt || 0).getTime();
          return db - da;
        })[0];
        const latestType = resolveTestType(latest) || 'OPENER';
        const latestTerm = String(latest?.term || '').toUpperCase();
        const latestYear = Number(latest?.academicYear);

        if (['TERM_1', 'TERM_2', 'TERM_3'].includes(latestTerm)) {
          setStagedTerm(latestTerm);
        }
        if (Number.isFinite(latestYear) && latestYear > 0) {
          setStagedYear(latestYear);
        }
        setStagedTestType(latestType);
        latestDefaultsAppliedGradeRef.current = stagedGrade;
      } catch (error) {
        console.error('Failed to apply latest exam defaults:', error);
      }
    };
    applyLatestExamDefaults();
  }, [stagedGrade]);

  // Keep a stable ref to the latest filter values so the generate function
  // never needs to be in the auto-generate effect's dep array.
  const filtersRef = useRef({ stagedGrade, stagedStream, stagedTerm, stagedYear, stagedTestType });
  useEffect(() => {
    filtersRef.current = { stagedGrade, stagedStream, stagedTerm, stagedYear, stagedTestType };
  });

  // Handle Generation — stable function reference (no filter deps needed
  // because it reads from filtersRef instead of closing over state directly).
  const handleGenerate = useCallback(async (forced = false) => {
    const { stagedGrade, stagedStream, stagedTerm, stagedYear, stagedTestType } = filtersRef.current;
    if (!stagedGrade) return;

    const currentConfig = `${stagedGrade}-${stagedStream}-${stagedTerm}-${stagedYear}-${stagedTestType}`;

    // Prevent overlapping or redundant calls
    if (!forced && (isFetchingRef.current || lastFetchRef.current === currentConfig)) {
      return;
    }

    // Synchronously track fetching status to prevent race-condition loops
    isFetchingRef.current = true;
    lastFetchRef.current = currentConfig;

    setLoading(true);
    setMatrixData(null);
    setNoStudentsFound(false);

    try {
      const apiParams: Record<string, any> = {
        grade: stagedGrade,
        academicYear: stagedYear,
        term: stagedTerm
      };
      if (stagedStream && stagedStream !== 'all') {
          apiParams.stream = stagedStream;
      }
      if (stagedTestType) {
          apiParams.testType = stagedTestType;
      }

      // 1. Fetch Students & Results concurrently
      // Use getAll() — it carries institutionType scoping and proper pagination,
      // unlike getByGrade() which hits a separate route that can 500 on some grades.
      const studentsParams: Record<string, any> = {
        grade: stagedGrade,
        status: 'ACTIVE',
        limit: 1000,
      };
      if (apiParams.stream) studentsParams.stream = apiParams.stream;

      const [studentsResp, resultsResp] = await Promise.all([
        learnerAPI.getAll(studentsParams),
        assessmentAPI.getBulkResults(apiParams)
      ]);

      const students = studentsResp?.data || (Array.isArray(studentsResp) ? studentsResp : []);
      if (!Array.isArray(students)) throw new Error('Failed to fetch students');
      const rawResults = resultsResp.data || [];

      if (students.length === 0) {
        setNoStudentsFound(true);
        setLoading(false);
        return;
      }

      // 2. Identify Subjects — source from actual results first, fall back to static data
      const gradeObj = gradeStructure.find(g => g.code === stagedGrade);
      const gradeName = gradeObj ? gradeObj.name : stagedGrade.replace(/_/g, ' ');
      const gradeLevelName = gradeObj?.learningArea; // e.g. 'Lower Primary'

      // Build subject list from DB results first (authoritative names).
      // Only fall back to static learningAreas.js when no results exist yet,
      // so expected columns appear even for grades with no marks entered.
      // This eliminates the name-mismatch ABS bug where static names like
      // "Literacy" diverged from DB names like "Literacy Activities".
      const subjectsMap = new Map();

      // Primary: subjects from actual result data (DB-authoritative names)
      rawResults.forEach(r => {
        if (r.test?.learningArea) {
          subjectsMap.set(r.test.learningArea, r.test.learningArea);
        }
      });

      // Fallback: only use static data when there are zero results (no tests entered yet)
      if (subjectsMap.size === 0) {
        const getExpectedSubjectsForGrade = () => {
          const byGradeName = learningAreas.filter(la =>
            la.grades && la.grades.some(g => g.toLowerCase() === gradeName.toLowerCase())
          );
          if (byGradeName.length > 0) return byGradeName.map(la => la.name);

          const gradeLevelMap = {
            'Pre-Primary': ['Pre-Primary'],
            'Lower Primary': ['Lower Primary'],
            'Upper Primary': ['Upper Primary'],
            'Junior School': ['Junior School']
          };
          const matchingLevels = gradeLevelMap[gradeLevelName] || [gradeLevelName];
          const byLevel = learningAreas.filter(la => matchingLevels.includes(la.gradeLevel));
          if (byLevel.length > 0) return byLevel.map(la => la.name);
          return [];
        };
        getExpectedSubjectsForGrade().forEach(s => subjectsMap.set(s, s));
      }
      
      // Calculate performance for sorting
      const performanceMap = {};
      rawResults.forEach(r => {
        const sub = r.test?.learningArea;
        if (!sub) return;
        if (!performanceMap[sub]) performanceMap[sub] = { sum: 0, count: 0 };
        performanceMap[sub].sum += r.percentage || 0;
        performanceMap[sub].count += 1;
      });

      const subjects = Array.from(subjectsMap.keys()).sort((a, b) => {
        const perfA = performanceMap[a] ? (performanceMap[a].sum / performanceMap[a].count) : -1;
        const perfB = performanceMap[b] ? (performanceMap[b].sum / performanceMap[b].count) : -1;
        
        // If means are equal or both are -1, fall back to alphabetical
        if (perfA === perfB) return a.localeCompare(b);
        return perfB - perfA; // Descending (best first)
      });

      // 3. Transform into Grid Data
      const gridRows = students.map(student => {
        const studentResults = rawResults.filter(r => r.learnerId === student.id);
        
        const subjectScores = {};
        let totalScore = 0;
        let totalMax = 0;
        let subjectsAssessed = 0;

        subjects.forEach(sub => {
          const res = studentResults.find(r => r.test?.learningArea === sub);
            if (res) {
              const derivedBand = getCBCGrade(Number(res.percentage || 0)).grade;
              subjectScores[sub] = {
                marks: res.marksObtained,
                max: res.test?.totalMarks || 100,
                grade: res.cbcGrade || derivedBand,
                percentage: res.percentage
              };
            totalScore += res.marksObtained;
            totalMax += (res.test?.totalMarks || 100);
            subjectsAssessed++;
          } else {
            subjectScores[sub] = null;
          }
        });

        const overallPct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        const { grade: overallGrade, color: gradeColor, bg: gradeBg } = getCBCGrade(overallPct);

        return {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          stream: student.stream,
          subjectScores,
          totalScore: totalScore.toFixed(0),
          averagePct: overallPct.toFixed(1),
          overallGrade,
          gradeColor,
          gradeBg,
          subjectsAssessed,
          isComplete: subjectsAssessed === subjects.length
        };
      });

      gridRows.sort((a, b) => parseFloat(b.averagePct) - parseFloat(a.averagePct));
      const rankedRows = gridRows.map((row, idx) => ({ ...row, rank: idx + 1 }));

      setMatrixData({
        rows: rankedRows,
        subjects,
        meta: apiParams
      });

      toast.success('Matrix updated');
    } catch (error) {
      console.error('Matrix Generation Error:', error);
      toast.error(error.message || 'Failed to generate matrix');
      lastFetchRef.current = null; // FIX: clear guard so filter changes can retry
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — reads filters from filtersRef, never needs to change

  // Set default grade when data is ready
  useEffect(() => {
    if (!schoolDataLoading && fetchedGrades.length > 0 && !stagedGrade) {
        // Try to find a grade with students if possible, or just default to Playgroup
        const hasPlaygroup = fetchedGrades.includes('PLAYGROUP');
        setStagedGrade(hasPlaygroup ? 'PLAYGROUP' : fetchedGrades[0]);
    }
  }, [schoolDataLoading, fetchedGrades, stagedGrade]);

  // Auto-generate whenever filter values change.
  // handleGenerate is intentionally excluded from deps — it is now stable
  // (created once, reads filters via filtersRef) so including it would cause
  // no extra renders, but excluding it is also correct and avoids confusion.
  useEffect(() => {
    if (stagedGrade) {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedGrade, stagedStream, stagedTerm, stagedYear, stagedTestType]);

  // Filtered Rows (Search)
  const filteredRows = useMemo(() => {
    if (!matrixData) {
      return [];
    }
    if (!searchQuery) {
      return matrixData.rows;
    }
    const q = searchQuery.toLowerCase();
    const filtered = matrixData.rows.filter(r => 
      r.name.toLowerCase().includes(q) || 
      r.admissionNumber.toLowerCase().includes(q)
    );
    return filtered;
  }, [matrixData, searchQuery]);

  // Class mean per subject (excludes absent/null scores)
  const subjectMeans = useMemo(() => {
    if (!matrixData || filteredRows.length === 0) return {};
    const means = {};
    matrixData.subjects.forEach(sub => {
      const scored = filteredRows.filter(r => r.subjectScores[sub] !== null);
      if (scored.length === 0) {
        means[sub] = null;
        return;
      }
      const total = scored.reduce((acc, r) => acc + parseFloat(r.subjectScores[sub].marks), 0);
      const maxTotal = scored.reduce((acc, r) => acc + parseFloat(r.subjectScores[sub].max), 0);
      means[sub] = {
        mean: (total / scored.length).toFixed(1),
        totalSum: total.toFixed(0),
        totalMaxSum: maxTotal.toFixed(0),
        percentage: maxTotal > 0 ? (total / maxTotal) * 100 : 0,
        count: scored.length
      };
    });
    return means;
  }, [matrixData, filteredRows]);

  // Overall class mean percentage across all subjects
  const classMeanPct = useMemo(() => {
    const vals = Object.values(subjectMeans).filter(Boolean);
    if (vals.length === 0) return 0;
    
    // Grand totals for overall class mean percentage
    const grandTotalScored: number = (vals as any[]).reduce((acc: number, v: any) => acc + parseFloat(v.totalSum), 0);
    const grandTotalPossible: number = (vals as any[]).reduce((acc: number, v: any) => acc + parseFloat(v.totalMaxSum), 0);
    
    return grandTotalPossible > 0 ? (grandTotalScored / grandTotalPossible) * 100 : 0;
  }, [subjectMeans]);


  // Export to Excel
  const exportToExcel = async () => {
    if (!matrixData) return;

    const exportRows = matrixData.rows.map(r => {
      const row = {
        'Rank': r.rank,
        'Name': r.name,
        'Adm No': r.admissionNumber,
        'Stream': r.stream,
        ...matrixData.subjects.reduce((acc, sub) => {
          acc[sub] = r.subjectScores[sub] ? r.subjectScores[sub].marks : 'ABS';
          return acc;
        }, {}),
        'Total': r.totalScore,
        'Average %': r.averagePct,
        'Grade': r.overallGrade
      };
      return row;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Assessment Matrix');
    const headers = Object.keys(exportRows[0] || {});
    worksheet.columns = headers.map(header => ({ header, key: header, width: 18 }));
    exportRows.forEach(row => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AssessmentMatrix_${stagedGrade}_${stagedTerm}_${stagedYear}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Rendering Helpers
  const renderRow = (row, index) => {
    return (
      <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
        <td className="sticky left-0 z-10 bg-inherit border-r border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 text-center w-12">
          {row.rank}
        </td>
        <td className="sticky left-12 z-10 bg-inherit border-r border-slate-200 px-4 py-3 min-w-[200px]">
          <div>
            <div className="font-medium text-slate-800 uppercase text-xs">{row.name}</div>
            <div className="text-[10px] text-slate-500 font-mono">{row.admissionNumber} • {row.stream}</div>
          </div>
        </td>
        
        {matrixData.subjects.map(sub => {
          const score = row.subjectScores[sub];
          if (!score) {
            return (
              <td key={sub} className="border-r border-slate-100 px-2 py-3 text-center bg-rose-50/30">
                <span className="text-[10px] font-medium text-rose-400 opacity-40">ABS</span>
              </td>
            );
          }
          const { color } = getCBCGrade(score.percentage);
          return (
            <td key={sub} className="border-r border-slate-100 px-2 py-3 text-center">
              <div className={`text-sm font-medium ${color}`}>{score.marks}</div>
              <div className="text-[9px] text-slate-400 leading-none">{score.grade}</div>
            </td>
          );
        })}

        <td className="bg-indigo-50/30 border-r border-slate-200 px-4 py-3 text-center font-medium text-indigo-700 w-20">
          {row.totalScore}
        </td>
        <td className="bg-slate-50 border-r border-slate-200 px-4 py-3 text-center font-medium text-slate-700 w-20">
          {row.averagePct}%
        </td>
        <td className={`${row.gradeBg} px-4 py-3 text-center w-20`}>
          <div className={`text-sm font-semibold ${row.gradeColor}`}>{row.overallGrade}</div>
        </td>
      </tr>
    );
  };

  const tableHeader = (
    <tr>
      <th className="sticky left-0 z-30 bg-slate-100 border-b border-r border-slate-200 px-4 py-3 text-[10px] font-semibold text-slate-600 uppercase w-12">
        #
      </th>
      <th className="sticky left-12 z-30 bg-slate-100 border-b border-r border-slate-200 px-4 py-3 text-[10px] font-semibold text-slate-600 uppercase text-left min-w-[200px]">
        Student Details
      </th>
      {matrixData?.subjects.map(sub => (
        <th key={sub} className="bg-slate-50 border-b border-r border-slate-200 px-2 py-3 text-[10px] font-semibold text-slate-600 uppercase text-center min-w-[80px]">
          <div className="truncate px-1" title={sub}>{getAbbreviatedName(sub)}</div>
        </th>
      ))}
      <th className="bg-indigo-100/50 border-b border-r border-slate-200 px-4 py-3 text-[10px] font-semibold text-indigo-600 uppercase text-center w-20">
        Total
      </th>
      <th className="bg-slate-100 border-b border-r border-slate-200 px-4 py-3 text-[10px] font-semibold text-slate-600 uppercase text-center w-20">
        Avg %
      </th>
      <th className="bg-slate-200 border-b border-slate-200 px-4 py-3 text-[10px] font-semibold text-slate-600 uppercase text-center w-20">
        Grade
      </th>
    </tr>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col overflow-hidden">
      {/* Combined Sticky Header + Filter Bar - Unified Component */}
      <div className="sticky top-0 z-40 bg-white shadow-sm print:hidden">
        {/* Assessment Header */}
        <div className="border-b border-gray-100 px-6 py-5 flex gap-4">
          <div className="flex-1">
            {/* Top Row: Context & Helper (Breadcrumbs) */}
            <div className="flex items-center justify-between mb-2 h-5">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span>Assessment</span>
                <ChevronRight size={10} className="text-gray-300" />
                <span>Summary Report</span>
                {stagedGrade && (
                  <>
                    <ChevronRight size={10} className="text-gray-300" />
                    <span className="capitalize">{stagedGrade.replace(/_/g, ' ').toLowerCase()}</span>
                  </>
                )}
                {stagedTerm && (
                  <>
                    <ChevronRight size={10} className="text-gray-300" />
                    <span className="capitalize">{stagedTerm.replace(/_/g, ' ').toLowerCase()}</span>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Row: Title & Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100">
                  <Layout className="text-white" size={16} />
                </div>
                <h2 className="text-lg font-medium text-gray-800 leading-none">
                  Full Assessment Matrix
                </h2>
                
                {matrixData && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium tracking-wide border bg-blue-50 text-blue-700 border-blue-200">
                      {matrixData.rows.length} Students
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium tracking-wide border bg-emerald-50 text-emerald-700 border-emerald-200">
                      {matrixData.subjects.length} Subjects Assessed
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {matrixData && (
                  <button
                    onClick={exportToExcel}
                    className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    title="Export to Excel"
                  >
                    <FileSpreadsheet size={16} />
                    <span>Excel</span>
                  </button>
                )}
                <div className="h-3 w-px bg-gray-200 mx-1" />
                <button
                  onClick={() => window.print()}
                  disabled={!matrixData}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                >
                  <Printer size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar - Always visible below header */}
        <div className="border-t border-slate-200 px-6 py-3.5 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 px-1">Class Grade</label>
              <select
                value={stagedGrade}
                onChange={(e) => setStagedGrade(e.target.value)}
                className="w-full h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors"
              >
                <option value="">Select Grade...</option>
                {fetchedGrades.map(g => (
                  <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 px-1">Specific Stream</label>
              <select
                value={stagedStream}
                onChange={(e) => setStagedStream(e.target.value)}
                className="w-full h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors"
              >
                <option value="all">All Streams</option>
                {availableStreams.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="w-32">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 px-1">Active Term</label>
              <select
                value={stagedTerm}
                onChange={(e) => setStagedTerm(e.target.value)}
                className="w-full h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors"
              >
                <option value="TERM_1">Term 1</option>
                <option value="TERM_2">Term 2</option>
                <option value="TERM_3">Term 3</option>
              </select>
            </div>

            <div className="w-36">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 px-1">Year</label>
              <select
                value={stagedYear}
                onChange={(e) => setStagedYear(Number(e.target.value))}
                className="w-full h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors"
              >
                {getAcademicYearOptions().map(y => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            <div className="w-40">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 px-1">Exam Type</label>
              <select
                value={stagedTestType}
                onChange={(e) => setStagedTestType(e.target.value)}
                className="w-full h-9 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer hover:border-slate-400 transition-colors"
              >
                {mergedExamTypes.map(t => (
                  <option key={t} value={t}>
                    {`${String(formatTestTypeLabel(t) || t).toUpperCase()}${
                      examTypeTimestamps[t]
                        ? ` • ${new Date(examTypeTimestamps[t]).toLocaleDateString('en-GB')}`
                        : ''
                    }`}
                  </option>
                ))}
              </select>
            </div>

            <div className="self-end">
              <button
                onClick={() => handleGenerate(true)}
                disabled={loading || !stagedGrade}
                className="h-9 px-4 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-slate-200 text-white rounded font-medium text-xs transition-all flex items-center gap-2 shadow-sm"
              >
                {loading ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                Generate Matrix
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SEARCH & STATS ─────────────────────────────────────────────── */}
      {matrixData && (
        <div className="bg-slate-50 border-b border-slate-200 print:hidden">
          {/* Search + stats row */}
          <div className="px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student or adm..."
                  className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-400 uppercase">
                <span className="flex items-center gap-1"><CheckCircle size={10} className="text-emerald-500"/> {matrixData.subjects.length} Subjects Assessed</span>
                <span className="flex items-center gap-1"><AlertCircle size={10} className="text-indigo-500"/> {matrixData.rows.length} Total Students</span>
              </div>
            </div>
            
            <div className="text-[10px] font-medium text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
              Auto-Ranked by Academic Performance
            </div>
          </div>

          {/* Legend row */}
          <div className="px-6 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Key:</span>
            {/* ABS */}
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-rose-400 opacity-60">ABS</span>
              <span className="text-[9px] text-slate-400">= No result recorded</span>
            </span>
            {/* Stream dot */}
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500">1234 • A</span>
              <span className="text-[9px] text-slate-400">= Adm No • Stream</span>
            </span>
            {/* CBC grade bands — all 8 */}
            <span className="flex items-center gap-1 text-[9px] text-slate-400">CBC Bands:</span>
            {[
              { grade: 'EE1', label: 'Exceeding', range: '90–100%', color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { grade: 'EE2', label: 'Exceeding', range: '75–89%',  color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { grade: 'ME1', label: 'Meeting',   range: '58–74%',  color: 'text-blue-700',    bg: 'bg-blue-50' },
              { grade: 'ME2', label: 'Meeting',   range: '41–57%',  color: 'text-blue-600',    bg: 'bg-blue-50' },
              { grade: 'AE1', label: 'Approaching',range: '31–40%', color: 'text-amber-700',   bg: 'bg-amber-50' },
              { grade: 'AE2', label: 'Approaching',range: '21–30%', color: 'text-amber-600',   bg: 'bg-amber-50' },
              { grade: 'BE1', label: 'Below',     range: '11–20%',  color: 'text-rose-700',    bg: 'bg-rose-50' },
              { grade: 'BE2', label: 'Below',     range: '0–10%',   color: 'text-rose-800',    bg: 'bg-rose-100' },
            ].map(({ grade, label, range, color, bg }) => (
              <span key={grade} className="flex items-center gap-1" title={`${label} — ${range}`}>
                <span className={`text-[9px] font-semibold ${color} ${bg} px-1.5 py-0.5 rounded`}>{grade}</span>
                <span className="text-[9px] text-slate-400">{range}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── MATRIX GRID ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="summary-report-matrix bg-white overflow-hidden h-full min-h-0 flex flex-col border-t border-slate-200">
          {loading ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Loader className="animate-spin mb-4" size={40} />
                <p className="text-sm font-medium uppercase tracking-widest">Constructing Matrix...</p>
             </div>
          ) : noStudentsFound ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <div className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center mb-6">
                <Users size={40} className="text-rose-300" />
              </div>
              <h3 className="text-xl font-semibold text-rose-400">No Enrolled Students</h3>
              <p className="text-sm font-medium text-slate-400 max-w-xs text-center mt-2">
                We couldn't find any learners enrolled in {stagedGrade.replace(/_/g, ' ')} {stagedStream !== 'all' ? `(${stagedStream})` : ''}.
              </p>
              <button 
                onClick={() => handleGenerate(true)}
                className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-all"
              >
                Retry Fetch
              </button>
            </div>
          ) : !matrixData ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                <Filter size={40} />
              </div>
              <h3 className="text-xl font-semibold text-slate-400">Ready to Generate</h3>
              <p className="text-sm font-medium text-slate-400 max-w-xs text-center mt-2">
                Select grade filters above for a deep-dive performance analysis across all subjects.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
                <VirtualizedTable
                  data={filteredRows}
                  header={tableHeader}
                  footer={
                    matrixData && filteredRows.length > 0 ? (
                      <>
                        {/* Row 1: Total Marks */}
                        <tr className="bg-slate-50 border-t border-slate-200">
                          <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-4 py-2 text-center text-[10px] font-medium text-slate-400 uppercase">—</td>
                          <td className="sticky left-12 z-10 bg-slate-50 border-r border-slate-200 px-4 py-2 min-w-[200px]">
                            <div className="font-medium text-slate-600 text-[10px] uppercase tracking-wider">Total Marks</div>
                          </td>
                          {matrixData.subjects.map(sub => {
                            const m = subjectMeans[sub];
                            return (
                              <td key={`total-${sub}`} className="border-r border-slate-100 px-2 py-2 text-center">
                                <span className="text-xs font-medium text-slate-600">{m ? m.totalSum : '—'}</span>
                              </td>
                            );
                          })}
                          <td className="bg-slate-100/50 border-r border-slate-200 px-4 py-2 text-center font-medium text-slate-600 w-20 text-xs text-indigo-700">
                            {filteredRows.reduce((acc, r) => acc + parseFloat(r.totalScore), 0).toFixed(0)}
                          </td>
                          <td className="bg-slate-50 border-r border-slate-200 px-4 py-2 text-center font-medium text-slate-400 w-20 text-xs">—</td>
                          <td className="bg-slate-50 border-r border-slate-200 px-4 py-2 text-center font-medium text-slate-400 w-20 text-xs">—</td>
                        </tr>

                        {/* Row 2: Class Mean */}
                        <tr className="bg-indigo-50 border-t-2 border-indigo-100">
                          <td className="sticky left-0 z-10 bg-indigo-50 border-r border-indigo-200 px-4 py-3 text-center text-[10px] font-semibold text-indigo-400 uppercase">—</td>
                          <td className="sticky left-12 z-10 bg-indigo-50 border-r border-indigo-200 px-4 py-3 min-w-[200px]">
                            <div className="font-semibold text-indigo-700 text-xs uppercase tracking-wide">Class Mean</div>
                            <div className="text-[10px] text-indigo-400">{filteredRows.length} students</div>
                          </td>
                          {matrixData.subjects.map(sub => {
                            const m = subjectMeans[sub];
                            if (!m) return (
                              <td key={`mean-${sub}`} className="border-r border-indigo-100 px-2 py-3 text-center bg-indigo-50/50">
                                <span className="text-[10px] font-medium text-indigo-300">N/A</span>
                              </td>
                            );
                            const { color } = getCBCGrade(m.percentage);
                            return (
                              <td key={`mean-${sub}`} className="border-r border-indigo-100 px-2 py-3 text-center bg-indigo-50">
                                <div className={`text-sm font-semibold ${color}`}>{m.mean}</div>
                              </td>
                            );
                          })}
                          <td className="bg-indigo-100 border-r border-indigo-200 px-4 py-3 text-center font-semibold text-indigo-700 w-20 text-sm">—</td>
                          <td className="bg-indigo-100 border-r border-indigo-200 px-4 py-3 text-center font-semibold text-indigo-700 w-20">
                            <div className="text-sm font-semibold text-indigo-700">{classMeanPct.toFixed(1)}</div>
                          </td>
                          <td className={`bg-indigo-100 px-4 py-3 text-center w-20 border-r border-indigo-200`}>
                            <div className={`text-sm font-semibold text-indigo-400`}>—</div>
                          </td>
                        </tr>
                      </>
                    ) : null
                  }
                  renderRow={renderRow}
                  rowHeight={64}
                  visibleHeight={1000} 
                  className="flex-1"
                  emptyComponent={
                    <div className="py-20 text-center text-slate-400 italic font-medium">
                      No students matched your search query in this grade.
                    </div>
                  }
                />
              </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @media print {
          .min-h-screen { background: white !important; }
          button, .bg-white.border-b, .bg-slate-50.px-6.py-2, .Filter-Bar, .self-end { display: none !important; }
          .flex-1 { overflow: visible !important; height: auto !important; }
          .summary-report-matrix { box-shadow: none !important; border: none !important; }
          table { width: 100% !important; border: 1px solid #e2e8f0 !important; }
          th, td { border: 1px solid #e2e8f0 !important; }
          .sticky { position: static !important; }
        }
      `}</style>
    </div>
  );
};

export default SummaryReportPage;
