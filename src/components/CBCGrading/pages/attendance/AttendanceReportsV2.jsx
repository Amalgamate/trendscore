/**
 * AttendanceReportsV2 — Redesigned attendance reports.
 * No spreadsheet tables on mobile. Rich analytics on desktop.
 * Responsive: cards/summary view on mobile, table on desktop.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Download, Printer, Filter, Search, X, Calendar,
  TrendingUp, TrendingDown, Users, CheckCircle, XCircle,
  Clock, ChevronLeft, ChevronRight, BarChart2
} from 'lucide-react';
import { cn } from '../../../../utils/cn';
import { useAttendance } from '../../hooks/useAttendanceAPI';
import { useAuth } from '../../../../hooks/useAuth';
import { useInstitutionLabels } from '../../../../hooks/useInstitutionLabels';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getCurrentDate, toInputDate } from '../../utils/dateHelpers';
import SmartLearnerSearch from '../../shared/SmartLearnerSearch';
import LoadingSpinner from '../../shared/LoadingSpinner';
import { AttendanceStatusBadge } from './AttendanceStatusChip';
import { AttendanceSummaryCard } from './AttendanceSummaryCard';
import { AttendanceRiskCard } from './AttendanceRiskCard';
import { printWindow } from '../../../../utils/simplePdfGenerator';

// ─── CSV export helper ─────────────────────────────────────────────────────
function exportCSV(records, learners, label) {
  const headers = ['Date', 'Admission No', 'Name', 'Grade', 'Status', 'Remarks'];
  const rows = records.map(r => {
    const learner = learners.find(l => l.id === r.learnerId);
    const date = r.date ? new Date(r.date).toLocaleDateString('en-GB') : '';
    return [
      date,
      learner?.admissionNumber || '',
      learner ? `${learner.firstName} ${learner.lastName}` : r.learnerId,
      learner?.grade || '',
      r.status || '',
      (r.remarks || '').replace(/,/g, ';'),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_${label || new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

export function AttendanceReportsV2({ learners: propLearners }) {
  const { user } = useAuth();
  const labels = useInstitutionLabels();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTeacher = user?.role === 'TEACHER';

  const [reportType, setReportType] = useState('grade');
  const [stagedGrade, setStagedGrade] = useState('all');
  const [stagedLearnerId, setStagedLearnerId] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(getCurrentDate());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const { attendanceRecords, fetchAttendance, loading, grades, classes } = useAttendance();

  const assignedClass = useMemo(() => {
    if (!isTeacher || !classes?.length) return null;
    return classes[0];
  }, [isTeacher, classes]);

  const scopedLearners = useMemo(() => {
    if (!isTeacher || !assignedClass) return propLearners || [];
    return (propLearners || []).filter(l =>
      l.grade === assignedClass.grade &&
      (!assignedClass.stream || l.stream === assignedClass.stream)
    );
  }, [isTeacher, assignedClass, propLearners]);

  const availableGrades = useMemo(() => {
    const lg = [...new Set((scopedLearners || []).map(l => l.grade).filter(Boolean))];
    const cg = [...new Set((classes || []).map(c => c.grade).filter(Boolean))];
    return [...new Set([...lg, ...cg, ...(Array.isArray(grades) ? grades : [])])];
  }, [scopedLearners, classes, grades]);

  const handleLoadReport = useCallback(() => {
    const params = { startDate, endDate };
    if (isTeacher && assignedClass?.id) params.classId = assignedClass.id;
    if (reportType === 'learner' && stagedLearnerId) params.learnerId = stagedLearnerId;
    fetchAttendance(params);
    setActiveReport({ type: reportType, grade: stagedGrade, learnerId: stagedLearnerId, startDate, endDate });
  }, [startDate, endDate, reportType, stagedLearnerId, stagedGrade, isTeacher, assignedClass, fetchAttendance]);

  useEffect(() => { handleLoadReport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── filtered records ─────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (!attendanceRecords) return [];
    return attendanceRecords.filter(r => {
      let date = typeof r.date === 'string' ? r.date.split('T')[0] : r.date?.toISOString?.()?.split('T')[0];
      if (activeReport?.type === 'learner') return activeReport.learnerId ? r.learnerId === activeReport.learnerId : true;
      const learner = scopedLearners.find(l => l.id === r.learnerId);
      if (!learner) return false;
      return activeReport?.grade === 'all' || learner.grade === activeReport?.grade;
    }).filter(r => {
      const learner = scopedLearners.find(l => l.id === r.learnerId);
      if (!learner) return false;
      const name = `${learner.firstName} ${learner.lastName}`.toLowerCase();
      return name.includes(searchTerm.toLowerCase()) || learner.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [attendanceRecords, scopedLearners, activeReport, searchTerm]);

  // ── stats ────────────────────────────────────────────────────────────────
  const reportStats = useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === 'PRESENT').length;
    const absent = filteredRecords.filter(r => r.status === 'ABSENT').length;
    const late = filteredRecords.filter(r => r.status === 'LATE').length;
    const sick = filteredRecords.filter(r => r.status === 'SICK').length;
    const days = new Set(filteredRecords.map(r => r.date?.split?.('T')[0] || r.date)).size;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, late, sick, days, rate };
  }, [filteredRecords]);

  // ── at-risk learners ──────────────────────────────────────────────────────
  const riskLearners = useMemo(() => {
    const byLearner = {};
    filteredRecords.forEach(r => {
      if (!byLearner[r.learnerId]) byLearner[r.learnerId] = { total: 0, present: 0 };
      byLearner[r.learnerId].total++;
      if (r.status === 'PRESENT') byLearner[r.learnerId].present++;
    });
    return Object.entries(byLearner)
      .map(([id, s]) => ({
        learnerId: id,
        rate: Math.round((s.present / s.total) * 100),
        learner: scopedLearners.find(l => l.id === id),
      }))
      .filter(r => r.learner && r.rate < 85)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8);
  }, [filteredRecords, scopedLearners]);

  const exportLabel = `${startDate}_to_${endDate}`;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* ── Sticky filter bar ── */}
      <div className="sticky top-0 z-30 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-purple/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <BarChart2 size={18} className="text-brand-purple" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Attendance Reports</h1>
              <p className="text-xs text-gray-500">Trends, summaries, and export</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printWindow('attendance-report-content')}
              className="h-9 px-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Printer size={14} />
              {!isMobile && 'Print'}
            </button>
            <button
              onClick={() => exportCSV(filteredRecords, scopedLearners, exportLabel)}
              className="h-9 px-3 bg-brand-teal text-white rounded-lg hover:bg-brand-teal/90 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Download size={14} />
              {!isMobile && 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-3">
          {/* Report type toggle (admin only) */}
          {!isTeacher && (
            <div className="flex bg-white p-1 rounded-lg border border-gray-200">
              {['grade', 'learner'].map(type => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize',
                    reportType === type
                      ? 'bg-brand-purple text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {type === 'grade' ? labels.grade || 'Grade' : labels.learner || 'Learner'}
                </button>
              ))}
            </div>
          )}

          {/* Grade/Learner selector */}
          {reportType === 'grade' ? (
            <select
              value={stagedGrade}
              onChange={e => setStagedGrade(e.target.value)}
              disabled={isTeacher}
              className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-brand-purple/40 min-w-[160px] disabled:opacity-60"
            >
              <option value="all">All Grades</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
              ))}
            </select>
          ) : (
            <div className="w-56 h-9">
              <SmartLearnerSearch
                learners={scopedLearners}
                selectedLearnerId={stagedLearnerId}
                onSelect={setStagedLearnerId}
                placeholder="Find learner..."
              />
            </div>
          )}

          {/* Date range */}
          <div className="flex items-center gap-2 h-9 px-3 border border-gray-200 rounded-lg bg-white">
            <input
              type="date"
              value={toInputDate(startDate)}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-gray-700 outline-none w-[105px]"
            />
            <span className="text-gray-300 text-sm">→</span>
            <input
              type="date"
              value={toInputDate(endDate)}
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-gray-700 outline-none w-[105px]"
            />
          </div>

          <button
            onClick={handleLoadReport}
            className="h-9 px-4 bg-brand-purple text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-brand-purple/90 transition-colors"
          >
            <Filter size={13} />
            Apply
          </button>

          {/* Search */}
          <div className="flex-1 min-w-[140px] max-w-xs relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Filter results..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-brand-purple/40"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X size={12} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <AttendanceSummaryCard label="Attendance Rate" value={reportStats.rate} variant="rate" />
        <AttendanceSummaryCard label="Present"         value={reportStats.present} variant="present" total={reportStats.total} />
        <AttendanceSummaryCard label="Absent"          value={reportStats.absent}  variant="absent"  total={reportStats.total} />
        <AttendanceSummaryCard label="Late"            value={reportStats.late}    variant="late"    total={reportStats.total} />
        <AttendanceSummaryCard label="Sick"            value={reportStats.sick}    variant="sick"    total={reportStats.total} />
        <AttendanceSummaryCard label="Days Tracked"    value={reportStats.days}    variant="total"   />
      </div>

      {/* ── Main content area ── */}
      <div className={cn('flex gap-4', !isMobile && riskLearners.length > 0 && 'items-start')}>
        {/* Records table / cards */}
        <div id="attendance-report-content" className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">
              Attendance Records
              <span className="ml-2 text-gray-400 font-normal text-xs">
                {filteredRecords.length} records
              </span>
            </h3>
            {activeReport && (
              <span className="text-xs text-gray-400">
                {new Date(activeReport.startDate).toLocaleDateString('en-GB')} –{' '}
                {new Date(activeReport.endDate).toLocaleDateString('en-GB')}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-16 flex justify-center"><LoadingSpinner /></div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                <BarChart2 size={22} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-400">No records found</p>
              <p className="text-xs text-gray-300">Try adjusting your filters</p>
            </div>
          ) : isMobile ? (
            // ── Mobile: compact cards ──
            <div className="divide-y divide-gray-50">
              {filteredRecords.map(record => {
                const learner = scopedLearners.find(l => l.id === record.learnerId);
                if (!learner) return null;
                return (
                  <div key={record.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-purple/10 flex items-center justify-center text-xs font-bold text-brand-purple flex-shrink-0">
                      {learner.firstName[0]}{learner.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {learner.firstName} {learner.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' · '}{learner.admissionNumber}
                      </p>
                    </div>
                    <AttendanceStatusBadge status={record.status} size="sm" />
                  </div>
                );
              })}
            </div>
          ) : (
            // ── Desktop: table ──
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Learner</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Grade</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRecords.map(record => {
                    const learner = scopedLearners.find(l => l.id === record.learnerId);
                    if (!learner) return null;
                    return (
                      <tr key={record.id} className="hover:bg-gray-50/60 transition-colors group">
                        <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap font-medium">
                          {new Date(record.date).toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short'
                          })}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-brand-purple/10 text-brand-purple flex items-center justify-center text-[10px] font-bold flex-shrink-0 group-hover:bg-brand-purple group-hover:text-white transition-colors">
                              {learner.firstName[0]}{learner.lastName[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{learner.firstName} {learner.lastName}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{learner.admissionNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">{learner.grade?.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3 text-center">
                          <AttendanceStatusBadge status={record.status} />
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 italic max-w-[180px] truncate">
                          {record.remarks || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Risk panel (desktop only) */}
        {!isMobile && riskLearners.length > 0 && (
          <div className="w-64 flex-shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Attendance Risk
              </p>
            </div>
            <div className="p-3 space-y-2">
              {riskLearners.map(({ learnerId, rate, learner }) => (
                <AttendanceRiskCard
                  key={learnerId}
                  learner={learner}
                  attendanceRate={rate}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AttendanceReportsV2;
