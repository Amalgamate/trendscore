import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle, Download, GraduationCap, Info, RefreshCw, Users } from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import api, { configAPI } from '../../../services/api';

const formatGrade = (grade) => {
  if (grade === 'GRADUATED') return 'Graduate / leave school';
  return String(grade || '').replace(/^GRADE_/, 'Grade ').replace(/_/g, ' ');
};

const nextGradeFor = (grade, grades) => {
  const index = grades.findIndex((item) => String(item).toUpperCase() === String(grade).toUpperCase());
  if (index >= 0) return grades[index + 1] || 'GRADUATED';
  const legacy = { CRECHE: 'RECEPTION', RECEPTION: 'TRANSITION', TRANSITION: 'PLAYGROUP' };
  if (legacy[grade]) return legacy[grade];
  const match = /^GRADE_(\d+)$/i.exec(grade || '');
  if (match) {
    const number = Number(match[1]);
    return grades.includes(`GRADE_${number + 1}`) ? `GRADE_${number + 1}` : 'GRADUATED';
  }
  return grade;
};

const PromotionPage = ({ onPromote, showNotification, showError }) => {
  const [sourceGrade, setSourceGrade] = useState('');
  const [sourceStream, setSourceStream] = useState('all');
  const [targetGrade, setTargetGrade] = useState('');
  const [targetAcademicYear, setTargetAcademicYear] = useState(new Date().getFullYear() + 1);
  const [targetTerm, setTargetTerm] = useState('TERM_1');
  const [availableStreams, setAvailableStreams] = useState([]);
  const [availableGrades, setAvailableGrades] = useState([]);
  const [learners, setLearners] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [preview, setPreview] = useState(null);
  const [rosterVersion, setRosterVersion] = useState(0);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [readiness, setReadiness] = useState(null);
  const [guidanceBusy, setGuidanceBusy] = useState(false);
  const guidanceKey = `promotion-guidance:${targetAcademicYear}:${targetTerm}`;
  const [guidanceDismissed, setGuidanceDismissed] = useState(() => {
    try { return sessionStorage.getItem(guidanceKey) === '1'; } catch { return false; }
  });
  const [loadingLearners, setLoadingLearners] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingConfig(true);
      try {
        const [streamResponse, gradeResponse] = await Promise.all([
          configAPI.getStreamConfigs({ fresh: true }),
          configAPI.getGrades(),
        ]);
        if (cancelled) return;
        const streams = streamResponse?.data?.filter((stream) => stream.active !== false) || [];
        const grades = gradeResponse?.data || [];
        setAvailableStreams(streams);
        setAvailableGrades(grades);
        const preferred = grades.find((grade) => grade === 'GRADE_1') || grades[0] || '';
        setSourceGrade(preferred);
        setTargetGrade(nextGradeFor(preferred, grades));
      } catch (error) {
        (showError || showNotification)?.(error.message || 'Could not load grade and stream options.');
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [showNotification, showError]);

  useEffect(() => {
    if (!sourceGrade) return undefined;
    let cancelled = false;
    const loadAllLearners = async () => {
      setLoadingLearners(true);
      setLearners([]);
      setSelectedIds([]);
      setPreview(null);
      try {
        const roster = [];
        let page = 1;
        let pages = 1;
        do {
          const params = {
            grade: sourceGrade,
            status: 'ACTIVE',
            limit: 200,
            page,
          };
          if (sourceStream !== 'all') params.stream = sourceStream;
          const response = await api.learners.getAll(params);
          const rows = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.data?.data) ? response.data.data : [];
          roster.push(...rows);
          pages = Math.max(1, Number(response?.pagination?.pages || 1));
          page += 1;
        } while (page <= pages && !cancelled);
        if (!cancelled) setLearners(roster.map((learner) => ({
          id: learner.id,
          firstName: learner.firstName,
          lastName: learner.lastName,
          admissionNumber: learner.admissionNumber,
          grade: learner.grade,
          stream: learner.stream,
          photoUrl: learner.photoUrl,
        })));
      } catch (error) {
        if (!cancelled) {
          setLearners([]);
          (showError || showNotification)?.(error.message || 'Could not load this grade roster.');
        }
      } finally {
        if (!cancelled) setLoadingLearners(false);
      }
    };
    loadAllLearners();
    return () => { cancelled = true; };
  }, [sourceGrade, sourceStream, rosterVersion, showNotification, showError]);

  useEffect(() => {
    let cancelled = false;
    const loadReadiness = async () => {
      try {
        const response = await api.learners.getPromotionReadiness({
          targetAcademicYear: Number(targetAcademicYear),
          targetTerm,
        });
        if (!cancelled) setReadiness(response?.data || null);
      } catch {
        if (!cancelled) setReadiness(null);
      }
    };
    loadReadiness();
    return () => { cancelled = true; };
  }, [targetAcademicYear, targetTerm, rosterVersion]);

  useEffect(() => {
    try { setGuidanceDismissed(sessionStorage.getItem(guidanceKey) === '1'); } catch { setGuidanceDismissed(false); }
  }, [guidanceKey]);

  const gradesForSchool = useMemo(() => [...availableGrades, 'GRADUATED'], [availableGrades]);
  const readyPlacements = preview?.placements?.filter((placement) => placement.ready) || [];
  const blockedPlacements = preview?.blockers || [];
  const allSelected = learners.length > 0 && selectedIds.length === learners.length;

  const changeSourceGrade = (grade) => {
    setSourceGrade(grade);
    setTargetGrade(nextGradeFor(grade, availableGrades));
    setSelectedIds([]);
    setPreview(null);
  };

  const toggleLearner = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setPreview(null);
  };

  const handlePreview = useCallback(async () => {
    if (!selectedIds.length) {
      (showError || showNotification)?.('Select learners to review their next-year placement.');
      return;
    }
    setReviewing(true);
    setPreview(null);
    try {
      const response = await api.learners.previewBulkPromote({
        learnerIds: selectedIds,
        sourceGrade,
        sourceStream,
        targetGrade,
        targetAcademicYear: Number(targetAcademicYear),
        targetTerm,
      });
      setPreview(response?.data || null);
    } catch (error) {
      (showError || showNotification)?.(error.message || 'Could not review learner placements.');
    } finally {
      setReviewing(false);
    }
  }, [selectedIds, sourceGrade, sourceStream, targetGrade, targetAcademicYear, targetTerm, showNotification, showError]);

  const handlePromote = async () => {
    if (!preview || readyPlacements.length === 0) return;
    const data = {
      learnerIds: readyPlacements.map((placement) => placement.id),
      sourceGrade,
      sourceStream,
      targetGrade,
      targetAcademicYear: Number(targetAcademicYear),
      targetTerm,
    };
    setPromoting(true);
    try {
      const result = await onPromote(data);
      if (!result?.success) {
        setPreview((current) => current ? { ...current, blockers: result?.blockers || current.blockers } : current);
        (showError || showNotification)?.(result?.error || 'Promotion was not applied. Review the placement issues.');
        return;
      }
      showNotification?.(result.message || 'Learner placements updated.', 'success');
      setSelectedIds([]);
      setPreview(null);
      setRosterVersion((version) => version + 1);
    } catch (error) {
      (showError || showNotification)?.(error.message || 'Promotion failed. No changes were confirmed.');
    } finally {
      setPromoting(false);
    }
  };

  const dismissGuidance = () => {
    setGuidanceDismissed(true);
    try { sessionStorage.setItem(guidanceKey, '1'); } catch { /* storage unavailable */ }
  };

  const refreshAfterGuidance = () => {
    setPreview(null);
    setRosterVersion((version) => version + 1);
  };

  const handleCreateDestinationClasses = async () => {
    setGuidanceBusy(true);
    try {
      const result = await configAPI.bulkCreateYearClasses({
        academicYear: Number(targetAcademicYear),
        term: targetTerm,
      });
      showNotification?.(result?.message || 'Destination classes created.', 'success');
      refreshAfterGuidance();
    } catch (error) {
      (showError || showNotification)?.(error.message || 'Could not create destination classes.');
    } finally {
      setGuidanceBusy(false);
    }
  };

  const handleCleanupStaleEnrollments = async () => {
    setGuidanceBusy(true);
    try {
      const result = await api.learners.cleanupStaleEnrollments({ reason: 'Promotion readiness cleanup' });
      showNotification?.(result?.message || 'Stale enrollments cleared.', 'success');
      refreshAfterGuidance();
    } catch (error) {
      (showError || showNotification)?.(error.message || 'Could not clear stale enrollments.');
    } finally {
      setGuidanceBusy(false);
    }
  };

  const exportPreview = () => {
    if (!preview?.placements?.length) return;
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Name', 'Admission Number', 'Current Grade', 'Stream', 'Destination Grade', 'Destination Class', 'Status', 'Issue'],
      ...preview.placements.map((item) => [
        item.name, item.admissionNumber, item.sourceGrade, item.sourceStream,
        item.targetGrade, item.targetClassName, item.ready ? 'READY' : 'BLOCKED', item.issue || '',
      ]),
    ];
    const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `promotion-preview-${targetAcademicYear}-${targetTerm}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loadingConfig) return <div className="p-6 text-sm text-slate-600">Loading promotion options…</div>;

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <section className="rounded-lg border border-slate-200 bg-white p-4 md:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-md bg-blue-700 p-2 text-white"><GraduationCap size={20} /></span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Prepare next-year placements</h2>
            <p className="mt-0.5 text-sm text-slate-600">Choose the current group and destination. Learner records and results stay linked to each learner.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700">
            Current grade
            <select value={sourceGrade} onChange={(event) => changeSourceGrade(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {availableGrades.map((grade) => <option key={grade} value={grade}>{formatGrade(grade)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Current stream
            <select value={sourceStream} onChange={(event) => { setSourceStream(event.target.value); setSelectedIds([]); setPreview(null); }} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="all">All streams</option>
              {availableStreams.map((stream) => <option key={stream.id} value={stream.name}>{stream.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Destination grade
            <select value={targetGrade} onChange={(event) => { setTargetGrade(event.target.value); setPreview(null); }} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {gradesForSchool.map((grade) => <option key={grade} value={grade}>{formatGrade(grade)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Academic year
            <input type="number" min="2000" max="2150" value={targetAcademicYear} onChange={(event) => { setTargetAcademicYear(event.target.value); setPreview(null); }} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Starting term
            <select value={targetTerm} onChange={(event) => { setTargetTerm(event.target.value); setPreview(null); }} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="TERM_1">Term 1</option><option value="TERM_2">Term 2</option><option value="TERM_3">Term 3</option>
            </select>
          </label>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> Set up destination-year classes and streams before reviewing placements.</p>
        {targetGrade === 'GRADUATED' && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Graduating learners keeps their final grade and records, marks their status as Graduated, and closes active class enrollments.</p>}
      </section>

      {readiness && !guidanceDismissed && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="rounded-md bg-blue-700 p-2 text-white"><Info size={18} /></span>
              <div>
                <h3 className="font-bold text-slate-900">Promotion readiness · {targetAcademicYear} {targetTerm.replace('_', ' ')}</h3>
                <p className="mt-0.5 text-sm text-slate-700">{readiness.activeLearnerCount} active learners · {readiness.missingClasses.length} destination classes missing · {readiness.staleEnrollmentCount} stale enrollments</p>
              </div>
            </div>
            <button type="button" onClick={dismissGuidance} className="text-xs font-semibold text-blue-800 hover:text-blue-950">Hide for this session</button>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {readiness.messages.map((message, index) => <li key={index}>{message}</li>)}
          </ul>
          {readiness.suggestedOrder.length > 0 && (
            <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold">Apply in this order:</span> {readiness.suggestedOrder.join(' · ')}
            </p>
          )}
          {(readiness.missingClasses.length > 0 || readiness.staleEnrollmentCount > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {readiness.missingClasses.length > 0 && (
                <button type="button" onClick={handleCreateDestinationClasses} disabled={guidanceBusy} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  Create {readiness.missingClasses.length} missing class{readiness.missingClasses.length === 1 ? '' : 'es'}
                </button>
              )}
              {readiness.staleEnrollmentCount > 0 && (
                <button type="button" onClick={handleCleanupStaleEnrollments} disabled={guidanceBusy} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:text-slate-400">
                  Clear {readiness.staleEnrollmentCount} stale enrollment{readiness.staleEnrollmentCount === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-700" />
            <h3 className="font-bold text-slate-900">Choose learners</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{learners.length} in group</span>
          </div>
          <button type="button" onClick={() => { setSelectedIds(allSelected ? [] : learners.map((learner) => learner.id)); setPreview(null); }} disabled={loadingLearners || learners.length === 0} className="text-sm font-semibold text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:text-slate-400">
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
        </div>

        {loadingLearners ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-600"><RefreshCw size={16} className="animate-spin" /> Loading the full roster…</div>
        ) : learners.length === 0 ? (
          <EmptyState icon={Users} title="No active learners found" message="Choose another grade or stream." />
        ) : (
          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {learners.map((learner) => (
              <label key={learner.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <input type="checkbox" checked={selectedIds.includes(learner.id)} onChange={() => toggleLearner(learner.id)} className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600" />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-bold text-blue-800 ring-2 ring-white">
                  {learner.photoUrl ? <img src={learner.photoUrl} alt="" className="h-full w-full object-cover" /> : `${learner.firstName?.[0] || ''}${learner.lastName?.[0] || ''}`.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{learner.firstName} {learner.lastName}</span>
                  <span className="block text-xs text-slate-500">{learner.admissionNumber} · {learner.stream || 'No stream'}</span>
                </span>
                <span className="hidden items-center gap-2 text-xs font-semibold text-slate-600 sm:flex">{formatGrade(learner.grade)} <ArrowRight size={14} /> {formatGrade(targetGrade)}</span>
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">{selectedIds.length} selected · {learners.length} loaded</span>
          <button type="button" onClick={handlePreview} disabled={reviewing || loadingLearners || selectedIds.length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            {reviewing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {reviewing ? 'Checking classes…' : 'Review placements'}
          </button>
        </div>
      </section>

      {preview && (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="font-bold text-slate-900">Placement review</h3>
              <p className="text-sm text-slate-600">{formatGrade(preview.destination.grade)} · {preview.destination.academicYear} · {preview.destination.term.replace('_', ' ')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">{preview.readyCount} ready</span>
              {preview.blockerCount > 0 && <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-800">{preview.blockerCount} need attention</span>}
              <button type="button" onClick={exportPreview} disabled={!preview.placements?.length} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400">
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          {preview.blockerCount > 0 && (
            <div className="border-b border-rose-100 bg-rose-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-900"><AlertTriangle size={16} /> Fix these issues before promoting the affected learners.</p>
              <ul className="mt-2 space-y-1 text-sm text-rose-900">
                {blockedPlacements.map((item, index) => <li key={`${item.id}-${index}`}><span className="font-semibold">{item.name}</span>{item.admissionNumber ? ` (${item.admissionNumber})` : ''}: {item.issue}</li>)}
              </ul>
            </div>
          )}
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {preview.placements.map((placement) => (
              <div key={placement.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0"><span className="font-semibold text-slate-900">{placement.name}</span><span className="ml-2 text-xs text-slate-500">{placement.admissionNumber}</span></span>
                <span className={`text-xs font-semibold ${placement.ready ? 'text-emerald-800' : 'text-rose-800'}`}>{placement.ready ? placement.targetClassName : placement.issue}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600">Only the ready learners will be changed. Their assessments, attendance, fees, and diary history remain linked to their records.</p>
            <button type="button" onClick={handlePromote} disabled={promoting || readyPlacements.length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">
              {promoting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {promoting ? 'Applying…' : targetGrade === 'GRADUATED' ? `Graduate ${readyPlacements.length}` : `Promote ${readyPlacements.length}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default PromotionPage;
