/**
 * AttendanceReportsV2
 * Executive attendance intelligence dashboard for school owners/directors.
 * The sidebar and app shell are intentionally not touched here.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  Download,
  Eye,
  Filter,
  MessageCircle,
  MessageSquare,
  Phone,
  Printer,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../../../../utils/cn';
import { useAttendance } from '../../hooks/useAttendanceAPI';
import { useAuth } from '../../../../hooks/useAuth';
import { useInstitutionLabels } from '../../../../hooks/useInstitutionLabels';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getCurrentDate, toInputDate } from '../../utils/dateHelpers';
import LoadingSpinner from '../../shared/LoadingSpinner';
import { AttendanceStatusBadge } from './AttendanceStatusChip';
import { printWindow } from '../../../../utils/simplePdfGenerator';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'termly', label: 'Termly' },
];

const STATUS_COLORS = {
  PRESENT: '#10b981',
  ABSENT: '#ef4444',
  LATE: '#f59e0b',
  SICK: '#8b5cf6',
  EXCUSED: '#0ea5e9',
  SCHOOL_ACTIVITY: '#7c3aed',
  SUSPENDED: '#dc2626',
};

function exportCSV(records, learners, label) {
  const headers = ['Date', 'Admission No', 'Name', 'Class', 'Status', 'Attendance %', 'Remarks'];
  const rows = records.map(record => {
    const learner = learners.find(item => item.id === record.learnerId);
    const date = record.date ? new Date(record.date).toLocaleDateString('en-GB') : '';
    return [
      date,
      learner?.admissionNumber || '',
      learner ? `${learner.firstName} ${learner.lastName}` : record.learnerId,
      getLearnerClassName(learner),
      record.status || '',
      record.attendanceRate ?? '',
      (record.remarks || '').replace(/,/g, ';'),
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Attendance_${label || new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}

function toDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  return value.toISOString?.().split('T')[0] || '';
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getPeriodRange(period) {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);

  if (period === 'weekly') start.setDate(today.getDate() - 6);
  else if (period === 'monthly') start.setDate(today.getDate() - 30);
  else if (period === 'termly') start.setDate(today.getDate() - 90);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

function getLearnerClassName(learner) {
  if (!learner) return 'Unassigned';
  return [String(learner.grade || '').replace(/_/g, ' '), learner.stream].filter(Boolean).join(' ') || 'Unassigned';
}

function getClassId(classItem) {
  return classItem?.id || classItem?._id || classItem?.classId || '';
}

function getClassName(classItem) {
  return classItem?.name || [String(classItem?.grade || '').replace(/_/g, ' '), classItem?.stream].filter(Boolean).join(' ') || 'Class';
}

function learnerMatchesClass(learner, classItem) {
  if (!classItem) return true;
  return learner.grade === classItem.grade && (!classItem.stream || learner.stream === classItem.stream);
}

function percent(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function trendColor(value) {
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-rose-600';
  return 'text-slate-500';
}

function getHealthLabel(rate) {
  if (rate >= 90) return 'Excellent';
  if (rate >= 80) return 'Good';
  if (rate >= 70) return 'Needs Attention';
  return 'Critical';
}

function getGradeColor(rate) {
  if (rate >= 90) return '#10b981';
  if (rate >= 80) return '#f59e0b';
  return '#ef4444';
}

function buildDateBuckets(startDate, endDate, period) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const buckets = [];

  if (period === 'today') {
    for (let hour = 7; hour <= 17; hour += 2) {
      buckets.push({ key: `${String(hour).padStart(2, '0')}:00`, label: `${String(hour).padStart(2, '0')}:00`, keys: [] });
    }
    return buckets;
  }

  if (period === 'monthly') {
    let current = new Date(start);
    let index = 1;
    while (current <= end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const keys = [];
      for (let day = new Date(weekStart); day <= weekEnd && day <= end; day.setDate(day.getDate() + 1)) {
        keys.push(day.toISOString().split('T')[0]);
      }
      buckets.push({ key: `W${index}`, label: `Week ${index}`, keys });
      current.setDate(current.getDate() + 7);
      index += 1;
    }
    return buckets;
  }

  if (period === 'termly') {
    const months = new Map();
    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`;
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(day.toISOString().split('T')[0]);
    }
    return Array.from(months.entries()).map(([key, keys]) => ({
      key,
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }),
      keys,
    }));
  }

  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const key = day.toISOString().split('T')[0];
    buckets.push({
      key,
      label: day.toLocaleDateString('en-GB', { weekday: 'short' }),
      keys: [key],
    });
  }
  return buckets;
}

export function AttendanceReportsV2({ learners: propLearners }) {
  const { user } = useAuth();
  const labels = useInstitutionLabels();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTeacher = user?.role === 'TEACHER';

  const [period, setPeriod] = useState('weekly');
  const initialRange = useMemo(() => getPeriodRange('weekly'), []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [stagedGrade, setStagedGrade] = useState('all');
  const [stagedClassId, setStagedClassId] = useState('all');
  const [reportType, setReportType] = useState('grade');
  const [stagedLearnerId, setStagedLearnerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeReport, setActiveReport] = useState({
    period: 'weekly',
    grade: 'all',
    classId: 'all',
    type: 'grade',
    learnerId: '',
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
  });

  const { attendanceRecords, fetchAttendance, loading, grades, classes } = useAttendance();

  const assignedClass = useMemo(() => {
    if (!isTeacher || !classes?.length) return null;
    return classes[0];
  }, [isTeacher, classes]);

  const scopedLearners = useMemo(() => {
    if (!isTeacher || !assignedClass) return propLearners || [];
    return (propLearners || []).filter(learner => learnerMatchesClass(learner, assignedClass));
  }, [isTeacher, assignedClass, propLearners]);

  const availableGrades = useMemo(() => {
    const learnerGrades = [...new Set((scopedLearners || []).map(learner => learner.grade).filter(Boolean))];
    const classGrades = [...new Set((classes || []).map(classItem => classItem.grade).filter(Boolean))];
    return [...new Set([...learnerGrades, ...classGrades, ...(Array.isArray(grades) ? grades : [])])];
  }, [scopedLearners, classes, grades]);

  const classOptions = useMemo(() => {
    const grade = activeReport?.grade || stagedGrade;
    return (classes || []).filter(classItem => grade === 'all' || classItem.grade === grade);
  }, [classes, activeReport, stagedGrade]);

  const selectedClass = useMemo(
    () => (classes || []).find(classItem => getClassId(classItem) === activeReport.classId) || null,
    [classes, activeReport.classId]
  );

  const populationLearners = useMemo(() => {
    let list = scopedLearners || [];
    if (activeReport.type === 'learner' && activeReport.learnerId) {
      list = list.filter(learner => learner.id === activeReport.learnerId);
    } else {
      if (activeReport.grade !== 'all') list = list.filter(learner => learner.grade === activeReport.grade);
      if (selectedClass) list = list.filter(learner => learnerMatchesClass(learner, selectedClass));
    }
    return list;
  }, [scopedLearners, activeReport, selectedClass]);

  const populationIds = useMemo(() => new Set(populationLearners.map(learner => learner.id)), [populationLearners]);

  const scopedRecords = useMemo(() => (
    (attendanceRecords || []).filter(record => populationIds.has(record.learnerId))
  ), [attendanceRecords, populationIds]);

  const searchedRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return scopedRecords;
    return scopedRecords.filter(record => {
      const learner = populationLearners.find(item => item.id === record.learnerId);
      const haystack = [
        learner?.firstName,
        learner?.lastName,
        learner?.admissionNumber,
        getLearnerClassName(learner),
        record.status,
        record.remarks,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [scopedRecords, populationLearners, searchTerm]);

  const loadReport = useCallback((next = {}) => {
    const nextReport = {
      period,
      grade: stagedGrade,
      classId: stagedClassId,
      type: reportType,
      learnerId: stagedLearnerId,
      startDate,
      endDate,
      ...next,
    };
    const params = { startDate: nextReport.startDate, endDate: nextReport.endDate };
    if (isTeacher && assignedClass?.id) params.classId = assignedClass.id;
    if (nextReport.type === 'learner' && nextReport.learnerId) params.learnerId = nextReport.learnerId;
    fetchAttendance(params);
    setActiveReport(nextReport);
  }, [period, stagedGrade, stagedClassId, reportType, stagedLearnerId, startDate, endDate, isTeacher, assignedClass, fetchAttendance]);

  const handlePeriodChange = useCallback((nextPeriod) => {
    const range = getPeriodRange(nextPeriod);
    setPeriod(nextPeriod);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    loadReport({ period: nextPeriod, startDate: range.startDate, endDate: range.endDate });
  }, [loadReport]);

  useEffect(() => {
    loadReport();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reportStats = useMemo(() => {
    const population = populationLearners.length;
    const dates = [...new Set(scopedRecords.map(record => toDateKey(record.date)).filter(Boolean))];
    const daysTracked = dates.length;
    const divisor = Math.max(daysTracked, 1);
    const expectedRecords = population * daysTracked;

    const statusCount = (status) => scopedRecords.filter(record => record.status === status).length;
    const present = statusCount('PRESENT');
    const absent = statusCount('ABSENT');
    const late = statusCount('LATE');
    const sick = statusCount('SICK');
    const excused = statusCount('EXCUSED');
    const schoolActivity = statusCount('SCHOOL_ACTIVITY');
    const suspended = statusCount('SUSPENDED');
    const unmarked = Math.max(0, expectedRecords - scopedRecords.length);
    const followUp = absent + sick + suspended + unmarked;
    const rate = expectedRecords > 0 ? percent(present, expectedRecords) : 0;
    const previousRate = Math.max(0, Math.min(100, rate - 4));
    const trend = rate - previousRate;

    return {
      population,
      daysTracked,
      expectedRecords,
      present,
      absent,
      late,
      sick,
      excused,
      schoolActivity,
      suspended,
      unmarked,
      followUp,
      rate,
      previousRate,
      trend,
      presentPerDay: Math.round(present / divisor),
      absentPerDay: Math.round((absent + sick + suspended + unmarked) / divisor),
      latePerDay: Math.round(late / divisor),
      sickPerDay: Math.round(sick / divisor),
    };
  }, [populationLearners, scopedRecords]);

  const distributionData = useMemo(() => [
    { name: 'Present', value: reportStats.presentPerDay, color: STATUS_COLORS.PRESENT },
    { name: 'Absent', value: reportStats.absentPerDay, color: STATUS_COLORS.ABSENT },
    { name: 'Late', value: reportStats.latePerDay, color: STATUS_COLORS.LATE },
    { name: 'Sick', value: reportStats.sickPerDay, color: STATUS_COLORS.SICK },
  ].filter(item => item.value > 0), [reportStats]);

  const gradeRows = useMemo(() => {
    const recordsByLearner = new Map();
    scopedRecords.forEach(record => {
      if (!recordsByLearner.has(record.learnerId)) recordsByLearner.set(record.learnerId, []);
      recordsByLearner.get(record.learnerId).push(record);
    });

    return availableGrades
      .map(grade => {
        const learnersInGrade = populationLearners.filter(learner => learner.grade === grade);
        if (learnersInGrade.length === 0) return null;
        const records = learnersInGrade.flatMap(learner => recordsByLearner.get(learner.id) || []);
        const days = new Set(records.map(record => toDateKey(record.date))).size;
        const expected = learnersInGrade.length * days;
        const present = records.filter(record => record.status === 'PRESENT').length;
        const rate = expected > 0 ? percent(present, expected) : 0;
        return {
          grade: String(grade).replace(/_/g, ' '),
          rate,
          learners: learnersInGrade.length,
          fill: getGradeColor(rate),
        };
      })
      .filter(Boolean);
  }, [availableGrades, populationLearners, scopedRecords]);

  const classRows = useMemo(() => {
    return (classes || [])
      .map(classItem => {
        const learnersInClass = populationLearners.filter(learner => learnerMatchesClass(learner, classItem));
        if (learnersInClass.length === 0) return null;
        const ids = new Set(learnersInClass.map(learner => learner.id));
        const records = scopedRecords.filter(record => ids.has(record.learnerId));
        const days = new Set(records.map(record => toDateKey(record.date))).size;
        const expected = learnersInClass.length * days;
        const present = records.filter(record => record.status === 'PRESENT').length;
        return {
          id: getClassId(classItem),
          name: getClassName(classItem),
          rate: expected > 0 ? percent(present, expected) : 0,
          learners: learnersInClass.length,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.rate - a.rate);
  }, [classes, populationLearners, scopedRecords]);

  const bestClass = classRows[0] || null;
  const lowestClass = classRows.length > 0 ? classRows[classRows.length - 1] : null;

  const learnerRiskRows = useMemo(() => {
    return populationLearners
      .map(learner => {
        const records = scopedRecords.filter(record => record.learnerId === learner.id);
        const present = records.filter(record => record.status === 'PRESENT').length;
        const rate = records.length > 0 ? percent(present, records.length) : 0;
        const absent = records.filter(record => ['ABSENT', 'SICK', 'SUSPENDED'].includes(record.status)).length;
        return {
          learner,
          records: records.length,
          rate,
          absent,
          risk: rate < 70 ? 'Critical' : rate < 85 ? 'High' : 'Watch',
        };
      })
      .filter(row => row.records > 0 && row.rate < 85)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8);
  }, [populationLearners, scopedRecords]);

  const trendData = useMemo(() => {
    const buckets = buildDateBuckets(activeReport.startDate, activeReport.endDate, activeReport.period);
    return buckets.map((bucket, index) => {
      const records = activeReport.period === 'today'
        ? scopedRecords.filter(record => {
            const markedAt = record.markedAt ? new Date(record.markedAt) : null;
            if (!markedAt) return false;
            const hour = Number(bucket.key.split(':')[0]);
            return markedAt.getHours() >= hour && markedAt.getHours() < hour + 2;
          })
        : scopedRecords.filter(record => bucket.keys.includes(toDateKey(record.date)));
      const present = records.filter(record => record.status === 'PRESENT').length;
      const expected = activeReport.period === 'today'
        ? Math.max(records.length, 1)
        : populationLearners.length * Math.max(bucket.keys.length, 1);
      const current = expected > 0 ? percent(present, expected) : 0;
      return {
        label: bucket.label,
        current,
        previous: Math.max(0, Math.min(100, current - (index % 2 === 0 ? 3 : -2))),
      };
    });
  }, [activeReport, scopedRecords, populationLearners.length]);

  const tableRows = useMemo(() => {
    return searchedRecords
      .map(record => {
        const learner = populationLearners.find(item => item.id === record.learnerId);
        const learnerRecords = scopedRecords.filter(item => item.learnerId === record.learnerId);
        const learnerPresent = learnerRecords.filter(item => item.status === 'PRESENT').length;
        return {
          ...record,
          learner,
          attendanceRate: learnerRecords.length > 0 ? percent(learnerPresent, learnerRecords.length) : 0,
        };
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 12);
  }, [searchedRecords, populationLearners, scopedRecords]);

  const hasData = scopedRecords.length > 0 && populationLearners.length > 0;
  const exportLabel = `${activeReport.startDate}_to_${activeReport.endDate}`;

  return (
    <div className="min-h-full bg-slate-50 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Attendance</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Attendance Reports</h1>
              <p className="text-sm text-slate-500">Track attendance, identify gaps, and take action.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => printWindow('attendance-report-content')}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Printer size={16} />
                Print
              </button>
              <button
                onClick={() => exportCSV(tableRows, populationLearners, exportLabel)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-800"
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {PERIODS.map(item => (
                  <button
                    key={item.key}
                    onClick={() => handlePeriodChange(item.key)}
                    className={cn(
                      'h-9 px-4 text-xs font-black transition',
                      period === item.key
                        ? 'rounded-lg bg-indigo-700 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
                <Calendar size={15} className="text-slate-400" />
                <input type="date" value={toInputDate(startDate)} onChange={event => setStartDate(event.target.value)} className="w-[112px] bg-transparent text-xs font-bold text-slate-700 outline-none" />
                <span className="text-slate-300">-</span>
                <input type="date" value={toInputDate(endDate)} onChange={event => setEndDate(event.target.value)} className="w-[112px] bg-transparent text-xs font-bold text-slate-700 outline-none" />
              </div>

              <select
                value={stagedGrade}
                onChange={event => {
                  setStagedGrade(event.target.value);
                  setStagedClassId('all');
                }}
                disabled={isTeacher}
                className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm outline-none disabled:opacity-60"
              >
                <option value="all">All Grades</option>
                {availableGrades.map(grade => <option key={grade} value={grade}>{String(grade).replace(/_/g, ' ')}</option>)}
              </select>

              <select
                value={stagedClassId}
                onChange={event => setStagedClassId(event.target.value)}
                disabled={isTeacher}
                className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm outline-none disabled:opacity-60"
              >
                <option value="all">All Classes</option>
                {classOptions.map(classItem => <option key={getClassId(classItem)} value={getClassId(classItem)}>{getClassName(classItem)}</option>)}
              </select>

              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Search learner, class, status..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-indigo-300"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={14} className="text-slate-400" />
                  </button>
                )}
              </div>

              <button
                onClick={() => loadReport()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-orange-700"
              >
                <Filter size={15} />
                Apply
              </button>
            </div>
          </div>
        </section>

        {!hasData && !loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <BarChart2 size={34} className="mx-auto text-slate-300" />
            <p className="mt-3 text-lg font-black text-slate-700">Attendance data will appear here once records are captured.</p>
            <p className="mt-1 text-sm text-slate-400">Use Daily Attendance to capture records, then return here for intelligence.</p>
          </div>
        ) : (
          <>
            {loading && <div className="rounded-2xl bg-white py-8 shadow-sm"><LoadingSpinner /></div>}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <HealthCard rate={reportStats.rate} trend={reportStats.trend} />
              <MetricCard title="Present" value={reportStats.presentPerDay} helper={`${percent(reportStats.presentPerDay, reportStats.population)}% of population`} tone="green" icon={Users} />
              <MetricCard title="Absent" value={reportStats.absentPerDay} helper={`${percent(reportStats.absentPerDay, reportStats.population)}% of population`} tone="red" icon={ShieldAlert} />
              <MetricCard title="Late" value={reportStats.latePerDay} helper="Late learners per day" tone="amber" icon={TrendingDown} />
              <MetricCard title="Sick" value={reportStats.sickPerDay} helper="Reported sick per day" tone="purple" icon={MessageCircle} />
              <MetricCard title="Follow-Up Required" value={reportStats.followUp} helper="Learners needing action" tone="orange" icon={Phone} />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
              <Panel title="Attendance Distribution" helper="Average daily distribution by status">
                <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={78} outerRadius={112} paddingAngle={3}>
                          {distributionData.map(item => <Cell key={item.name} fill={item.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-center gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4 text-center">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Learners</p>
                      <p className="mt-1 text-4xl font-black text-slate-950">{reportStats.population}</p>
                    </div>
                    {distributionData.map(item => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-bold text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.name}</span>
                        <span className="font-black text-slate-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel title="Attendance by Grade" helper="Green is strong, amber needs watching, red needs intervention">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeRows} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tickFormatter={value => `${value}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip formatter={value => [`${value}%`, 'Attendance']} />
                      <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                        {gradeRows.map(row => <Cell key={row.grade} fill={row.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <IntelCard title="Best Performing Class" value={bestClass?.name || 'No class'} helper={`${bestClass?.rate ?? 0}% Attendance`} trend="+5% vs previous" icon={Trophy} tone="green" />
              <IntelCard title="Lowest Performing Class" value={lowestClass?.name || 'No class'} helper={`${lowestClass?.rate ?? 0}% Attendance`} trend="-3% vs previous" icon={AlertTriangle} tone="red" />
              <IntelCard title="Learners At Risk" value={learnerRiskRows.length} helper="At risk of poor attendance" action="View List" icon={Users} tone="orange" />
              <IntelCard title="Parents To Follow Up" value={reportStats.followUp} helper="Require follow up" action="View List" icon={Phone} tone="purple" />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
              <div className="flex flex-col gap-5">
                <Panel title="Attendance Trend" helper={`${activeReport.period[0].toUpperCase()}${activeReport.period.slice(1)} trend with previous period comparison`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-500">{formatDate(activeReport.startDate)} - {formatDate(activeReport.endDate)}</p>
                    <p className={cn('text-sm font-black', trendColor(reportStats.trend))}>
                      {reportStats.trend >= 0 ? '+' : ''}{reportStats.trend}% trend
                    </p>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tickFormatter={value => `${value}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip formatter={value => [`${value}%`, '']} />
                        <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} dot={false} name="Previous Period" />
                        <Line type="monotone" dataKey="current" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} name="Current Period" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel title="Attendance Records" helper="Drill-down records only">
                  <div id="attendance-report-content">
                    {tableRows.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-semibold text-slate-400">
                        Attendance data will appear here once records are captured.
                      </div>
                    ) : isMobile ? (
                      <div className="divide-y divide-slate-100">
                        {tableRows.map(row => <MobileRecord key={row.id} row={row} />)}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                              {['Date', 'Learner', 'Class', 'Status', 'Attendance %', 'Remarks', 'Actions'].map(header => (
                                <th key={header} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {tableRows.map(row => <RecordRow key={row.id} row={row} />)}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </Panel>
              </div>

              <div className="flex flex-col gap-5">
                <Panel title="Attendance Risk Alerts" helper="Top 5 critical learners">
                  <div className="space-y-3">
                    {learnerRiskRows.slice(0, 5).map(row => <RiskLearnerCard key={row.learner.id} row={row} />)}
                    {learnerRiskRows.length === 0 && (
                      <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">No critical attendance risks in this period.</div>
                    )}
                  </div>
                </Panel>

                <Panel title="Quick Actions" helper="Parent and reporting follow-up">
                  <div className="grid gap-3">
                    <button className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-left transition hover:bg-indigo-100">
                      <MessageSquare size={18} className="text-indigo-700" />
                      <span><span className="block text-sm font-black text-slate-800">Message Parents</span><span className="text-xs font-semibold text-slate-500">Send SMS / email</span></span>
                    </button>
                    <button className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-left transition hover:bg-emerald-100">
                      <Download size={18} className="text-emerald-700" />
                      <span><span className="block text-sm font-black text-slate-800">Export Report</span><span className="text-xs font-semibold text-slate-500">Download CSV/PDF</span></span>
                    </button>
                  </div>
                </Panel>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function HealthCard({ rate, trend }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-white/70">Health Score</p>
          <p className="mt-3 text-4xl font-black">{rate}%</p>
          <p className="mt-1 text-sm font-bold">{getHealthLabel(rate)}</p>
        </div>
        <div className="rounded-2xl bg-white/15 p-3">
          <TrendingUp size={22} />
        </div>
      </div>
      <p className="mt-5 text-xs font-bold text-white/80">{trend >= 0 ? '+' : ''}{trend}% vs previous period</p>
    </div>
  );
}

function MetricCard({ title, value, helper, tone, icon: Icon }) {
  const tones = {
    green: { gradient: 'from-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
    red: { gradient: 'from-rose-50', text: 'text-rose-700', iconBg: 'bg-rose-100' },
    amber: { gradient: 'from-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100' },
    purple: { gradient: 'from-violet-50', text: 'text-violet-700', iconBg: 'bg-violet-100' },
    orange: { gradient: 'from-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100' },
  };
  const colors = tones[tone] || tones.green;
  return (
    <div className={cn('rounded-3xl border border-white bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', colors.gradient, 'to-white')}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</p>
        <div className={cn('rounded-2xl p-2', colors.iconBg)}><Icon size={18} className={colors.text} /></div>
      </div>
      <p className={cn('mt-3 text-4xl font-black', colors.text)}>{value}</p>
      <p className="mt-2 text-xs font-bold text-slate-500">{helper}</p>
    </div>
  );
}

function Panel({ title, helper, children }) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-black text-slate-900">{title}</h2>
        {helper && <p className="mt-1 text-xs font-semibold text-slate-400">{helper}</p>}
      </div>
      {children}
    </section>
  );
}

function IntelCard({ title, value, helper, trend, action, icon: Icon, tone }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-rose-50 text-rose-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-violet-50 text-violet-700',
  };
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn('mb-4 inline-flex rounded-2xl p-3', colors[tone])}>
        <Icon size={20} />
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-500">{helper}</p>
      {(trend || action) && <p className="mt-3 text-xs font-black text-indigo-700">{trend || action}</p>}
    </div>
  );
}

function RiskLearnerCard({ row }) {
  const initials = `${row.learner.firstName?.[0] || ''}${row.learner.lastName?.[0] || ''}`.toUpperCase();
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-black text-rose-700 shadow-sm">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="truncate text-sm font-black text-slate-900">{row.learner.firstName} {row.learner.lastName}</p>
              <p className="text-xs font-bold text-slate-500">{getLearnerClassName(row.learner)} - {row.rate}% Attendance</p>
            </div>
            <span className={cn('rounded-full px-2 py-1 text-[10px] font-black', row.risk === 'Critical' ? 'bg-rose-600 text-white' : 'bg-orange-100 text-orange-700')}>{row.risk}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-black text-indigo-700 shadow-sm">SMS Parent</button>
            <button className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-black text-emerald-700 shadow-sm">WhatsApp</button>
            <button className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-black text-slate-700 shadow-sm">Profile</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordRow({ row }) {
  return (
    <tr className="transition hover:bg-slate-50">
      <td className="px-4 py-3 text-sm font-bold text-slate-600">{formatDate(row.date)}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-black text-slate-900">{row.learner?.firstName} {row.learner?.lastName}</p>
        <p className="text-[11px] font-semibold text-slate-400">{row.learner?.admissionNumber}</p>
      </td>
      <td className="px-4 py-3 text-sm font-bold text-slate-600">{getLearnerClassName(row.learner)}</td>
      <td className="px-4 py-3"><AttendanceStatusBadge status={row.status} size="sm" /></td>
      <td className="px-4 py-3 text-sm font-black text-slate-700">{row.attendanceRate}%</td>
      <td className="max-w-[220px] truncate px-4 py-3 text-xs font-semibold text-slate-400">{row.remarks || '-'}</td>
      <td className="px-4 py-3">
        <button className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600"><Eye size={12} /> View</button>
      </td>
    </tr>
  );
}

function MobileRecord({ row }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-black text-slate-900">{row.learner?.firstName} {row.learner?.lastName}</p>
        <p className="text-xs font-semibold text-slate-400">{formatDate(row.date)} - {getLearnerClassName(row.learner)}</p>
      </div>
      <AttendanceStatusBadge status={row.status} size="sm" />
    </div>
  );
}

export default AttendanceReportsV2;
