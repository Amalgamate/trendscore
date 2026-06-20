/**
 * Teacher Mobile Dashboard
 * Daily workflow mobile view for teachers
 */

import React, { useEffect, useMemo, useState } from 'react';
import { dashboardAPI } from '../../../../services/api';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  Users,
  Wallet,
} from 'lucide-react';
import { GreetingToast } from '../../pages/dashboard/DashboardSummary';
import ClockInStatusWidget from '../widgets/teacher/ClockInStatusWidget';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatMoney = (value) => `KES ${Number(value || 0).toLocaleString()}`;

const percent = (value) => `${Math.max(0, Math.min(100, Number(value || 0)))}%`;

const MobileSection = ({ title, actionLabel, onAction, children }) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between px-1">
      <h2 className="ts-mobile-section-title text-sm font-black">{title}</h2>
      {actionLabel && (
        <button type="button" onClick={onAction} className="text-[11px] font-black text-blue-700">
          {actionLabel}
        </button>
      )}
    </div>
    {children}
  </section>
);

const GlanceCard = ({ icon: Icon, value, label, detail, cardClass, iconClass, textClass = 'text-[#06285a]' }) => (
  <div className={`min-h-[92px] rounded-lg border p-3 ${cardClass}`}>
    <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${iconClass}`}>
      <Icon size={17} />
    </div>
    <div className={`text-xl font-black ${textClass}`}>{value}</div>
    <div className={`text-[11px] font-bold leading-tight ${textClass}`}>{label}</div>
    {detail && <div className={`mt-1 text-[10px] font-semibold ${textClass} opacity-70`}>{detail}</div>}
  </div>
);

const ClassCard = ({ classItem, onOpen }) => {
  const attendanceRate = Number(classItem.attendanceRate ?? 0);
  const assessmentRate = Number(classItem.assessmentRate ?? 0);
  const tone = classItem.index % 3 === 0
    ? 'bg-emerald-50 text-emerald-700'
    : classItem.index % 3 === 1
      ? 'bg-blue-50 text-blue-700'
      : 'bg-orange-50 text-orange-700';

  return (
    <button type="button" onClick={onOpen} className="ts-mobile-card rounded-lg p-3 text-left">
      <div className="mb-3 flex items-start gap-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <BookOpen size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-gray-950">{classItem.grade}</div>
          <div className="truncate text-[10px] font-black text-emerald-600">{classItem.subject}</div>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between text-[10px] font-semibold text-gray-400">
        <span>{classItem.room || 'Room not set'}</span>
        <span>{formatNumber(classItem.learners)} learners</span>
      </div>
      <div className="space-y-1.5 text-[11px] font-bold">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Attendance</span>
          <span className="text-emerald-600">{percent(attendanceRate)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100">
          <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: percent(attendanceRate) }} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-gray-500">Assessment</span>
          <span className="text-blue-600">{percent(assessmentRate)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100">
          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: percent(assessmentRate) }} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] font-black text-blue-700">
        <span>{classItem.subject === 'Class teacher' ? 'View Class' : 'View Subject'}</span>
        <ArrowRight size={13} />
      </div>
    </button>
  );
};

const ActionButton = ({ icon: Icon, title, subtitle, tone, onClick }) => (
  <button type="button" onClick={onClick} className={`flex min-h-[62px] items-center gap-3 rounded-lg p-3 text-left ${tone}`}>
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80">
      <Icon size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-xs font-black text-gray-950">{title}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-gray-500">{subtitle}</div>
    </div>
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80">
      <ArrowRight size={13} />
    </div>
  </button>
);

const Donut = ({ value }) => {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="relative flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `conic-gradient(#10b981 ${safe * 3.6}deg, #f97316 0deg)` }}>
      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-white">
        <span className="text-lg font-black text-gray-950">{safe}%</span>
        <span className="text-[9px] font-bold text-gray-500">Complete</span>
      </div>
    </div>
  );
};

const AttentionItem = ({ item, onClick }) => {
  const isFinance = /fee|balance/i.test(item.issue || '');
  const isAttendance = /attendance/i.test(item.issue || '');
  const tone = isFinance
    ? 'bg-amber-50 text-amber-600'
    : isAttendance
      ? 'bg-rose-50 text-rose-600'
      : 'bg-orange-50 text-orange-600';
  const label = isFinance ? 'Finance' : isAttendance ? 'Attendance' : 'Assessment';
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-gray-100 py-2.5 text-left last:border-b-0">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
        {isFinance ? <DollarSign size={15} /> : isAttendance ? <Users size={15} /> : <ClipboardList size={15} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-black text-gray-950">{item.name || 'Learner'}</div>
        <div className="truncate text-[10px] font-semibold text-gray-500">{item.issue || item.grade || 'Needs review'}</div>
      </div>
      <span className={`rounded-full px-2 py-1 text-[9px] font-black ${tone}`}>{label}</span>
      <ArrowRight size={13} className="text-gray-400" />
    </button>
  );
};

/**
 * Teacher Mobile Dashboard
 * Teaching workflow mobile view with class and grading metrics
 * @param {Object} props - Component props
 * @param {Object} props.user - User object
 * @param {Function} props.onNavigate - Navigation callback
 * @param {string} props.currentPath - Current page path
 */
const TeacherMobileDashboard = ({ user, onNavigate }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await dashboardAPI.getTeacherMetrics?.() || { success: true, data: {} };
        if (response.success) {
          setMetrics(response.data);
        }
      } catch (error) {
        console.error('Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const stats = metrics?.stats || {};
  const schedule = useMemo(() => metrics?.schedule || [], [metrics?.schedule]);
  const attendanceDue = useMemo(() => metrics?.attendanceDue || [], [metrics?.attendanceDue]);
  const assessmentsToMark = useMemo(() => metrics?.assessmentsToMark || [], [metrics?.assessmentsToMark]);
  const learnersNeedingAttention = useMemo(() => metrics?.learnersNeedingAttention || [], [metrics?.learnersNeedingAttention]);
  const feeSummary = metrics?.feeSummary || {};
  const learnerAnalysis = metrics?.learnerAnalysis || {};
  const attendanceDueLearners = attendanceDue.reduce((sum, item) => sum + Math.max(0, Number(item.learners || 0) - Number(item.marked || 0)), 0);
  const assessmentCompletion = Number(stats.analytics?.graded ?? (stats.pendingTasks ? 0 : 100));

  const classCards = useMemo(() => {
    const attendanceMap = new Map(attendanceDue.map((item) => [item.id || item.classId, item]));
    const analysisMap = new Map((learnerAnalysis.classes || []).map((item) => [item.classId, item]));
    return schedule.slice(0, 3).map((item, index) => {
      const due = attendanceMap.get(item.classId || item.id);
      const analysis = analysisMap.get(item.classId || item.id);
      const learners = Number(item.learners || analysis?.learnerCount || 0);
      const marked = due ? Number(due.marked || 0) : learners;
      const pendingAssessments = (analysis?.subjects || []).reduce((sum, subject) => sum + Number(subject.pendingAssessments || 0), 0);
      return {
        ...item,
        index,
        learners,
        subject: item.subject || analysis?.subjects?.[0]?.subject || 'Class teacher',
        attendanceRate: learners > 0 ? Math.round((marked / learners) * 100) : 100,
        assessmentRate: learners > 0 ? Math.max(0, Math.round(((learners - pendingAssessments) / learners) * 100)) : 100,
      };
    });
  }, [attendanceDue, learnerAnalysis.classes, schedule]);

  const glanceCards = [
    {
      label: 'Present',
      value: formatNumber(Math.max(0, Number(stats.myStudents || 0) - attendanceDueLearners)),
      detail: `of ${formatNumber(stats.myStudents)} learners`,
      icon: Users,
      cardClass: 'ts-mobile-card',
      iconClass: 'bg-[#06285a] text-white',
    },
    {
      label: 'Assessment due today',
      value: formatNumber(assessmentsToMark.length),
      detail: `${formatNumber(stats.pendingTasks)} drafts`,
      icon: ClipboardCheck,
      cardClass: 'ts-mobile-card-orange',
      iconClass: 'bg-[#06285a] text-white',
    },
  ];

  return (
    <div className="min-h-full pb-20 text-white">
      {/* Greeting banner */}
      <GreetingToast user={user} fallbackName="Teacher" description="Teaching Dashboard · Daily Workflow" onNavigate={onNavigate} />

      <div className="px-3 py-4 space-y-5">
        <ClockInStatusWidget user={user} onNavigate={onNavigate} />

        <MobileSection title="Today at a glance">
          <div className="grid grid-cols-2 gap-2">
            {glanceCards.map((card) => (
              <GlanceCard key={card.label} {...card} value={loading ? '...' : card.value} />
            ))}
          </div>
        </MobileSection>

        <MobileSection title="My Classes" actionLabel="View all" onAction={() => onNavigate('teacher-learner-analysis')}>
          {classCards.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
              {classCards.map((classItem) => (
                <ClassCard key={`${classItem.id}-${classItem.subject}`} classItem={classItem} onOpen={() => onNavigate('teacher-learner-analysis')} />
              ))}
            </div>
          ) : (
            <div className="ts-mobile-card-soft rounded-lg p-4 text-sm font-semibold text-[#06285a]/70">
              Assigned classes will appear here.
            </div>
          )}
        </MobileSection>

        <MobileSection title="Today's Actions">
          <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
            <ActionButton
              icon={CalendarCheck}
              title="Take Attendance"
              subtitle="Mark attendance for today"
              tone="ts-mobile-action-solid"
              onClick={() => onNavigate('attendance-daily')}
            />
            <ActionButton
              icon={ClipboardCheck}
              title="Enter Assessment Scores"
              subtitle="Add scores for assessments"
              tone="ts-mobile-action"
              onClick={() => onNavigate('assess-summative-assessment')}
            />
          </div>
        </MobileSection>

        <MobileSection title="Overview">
          <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
            <button type="button" onClick={() => onNavigate('assess-summative-assessment')} className="ts-mobile-card rounded-lg p-3 text-left">
              <div className="mb-3 text-xs font-black text-gray-950">Assessment Progress</div>
              <div className="flex items-center gap-3">
                <Donut value={assessmentCompletion} />
                <div className="space-y-1 text-[10px] font-bold text-gray-500">
                  <div><span className="text-emerald-600">●</span> {percent(assessmentCompletion)} completed</div>
                  <div><span className="text-orange-500">●</span> {percent(100 - assessmentCompletion)} pending</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-black text-blue-700">
                <span>View Assessments</span>
                <ArrowRight size={13} />
              </div>
            </button>

            <button type="button" onClick={() => onNavigate('fees-overview')} className="ts-mobile-card rounded-lg p-3 text-left">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-black text-gray-950">Fee Balances</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <Wallet size={16} />
                </div>
              </div>
              <div className="text-xl font-black text-gray-950">{formatNumber(feeSummary.learnersWithBalance)}</div>
              <div className="text-[10px] font-semibold text-gray-500">Learners with balances</div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="font-bold text-gray-500">Total Outstanding</span>
                <span className="font-black text-red-600">{formatMoney(feeSummary.totalOutstanding)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-black text-blue-700">
                <span>View Fee Details</span>
                <ArrowRight size={13} />
              </div>
            </button>
          </div>
        </MobileSection>

        <MobileSection title="Needs Your Attention" actionLabel="View all" onAction={() => onNavigate('teacher-learner-analysis')}>
          <div className="ts-mobile-card rounded-lg px-3">
            {learnersNeedingAttention.length > 0 ? (
              learnersNeedingAttention.slice(0, 4).map((item) => (
                <AttentionItem key={item.id} item={item} onClick={() => onNavigate(item.actionPage || 'teacher-learner-analysis')} />
              ))
            ) : (
              <div className="flex items-center gap-3 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-950">No urgent learner flags</div>
                  <div className="text-[10px] font-semibold text-gray-500">Attendance and assessment alerts will appear here.</div>
                </div>
              </div>
            )}
          </div>
        </MobileSection>

        {metrics === null && !loading && (
          <div className="ts-mobile-card-orange flex items-center gap-2 rounded-lg p-3 text-xs font-semibold">
            <AlertCircle size={16} />
            Dashboard data could not be loaded. Try refreshing the page.
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherMobileDashboard;
