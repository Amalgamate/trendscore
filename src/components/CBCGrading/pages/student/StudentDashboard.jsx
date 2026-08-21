/**
 * Student Dashboard – Desktop Redesign
 * Mirrors the Teacher Dashboard's card-based SaaS layout.
 * Brand palette: Navy #06285a · Orange #ff7900 · Purple #030b82
 *
 * Features:
 *  - Stat tiles row (assignments, attendance, GPA, messages)
 *  - Continue Learning: real enrolled-course progress (GET /lms/my-courses)
 *  - Download assignments panel (GET /lms/my-assignments)
 *  - Report card panel (from dashboardAPI.getStudentMetrics)
 *  - Marketplace for past papers — real listings (GET /lms/marketplace) with a
 *    real M-Pesa STK push purchase flow (POST /lms/marketplace/:id/purchase),
 *    polled to completion via GET /lms/marketplace/my-purchases.
 *    If the school hasn't enabled the marketplace add-on (lms-enterprise),
 *    the panel degrades to a friendly "not enabled" state instead of erroring.
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Info,
  Lock,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { dashboardAPI, lmsAPI, marketplaceAPI } from '../../../../services/api';
import { GreetingToast } from '../dashboard/DashboardSummary';
import { useImpersonation } from '../../../../contexts/ImpersonationContext';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const fmt     = (v) => Number(v || 0).toLocaleString();
const pct     = (v) => `${Math.round(Number(v || 0))}%`;
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

/* ─── Skeleton ──────────────────────────────────────────────────────────────── */
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />
);

/* ─── Radial ring ────────────────────────────────────────────────────────────── */
const RadialRing = ({ value = 0, size = 56, stroke = 5, color = '#ff7900', bg = '#e2e8f0' }) => {
  const r    = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ─── Mini sparkline bars ────────────────────────────────────────────────────── */
const SparkBars = ({ values = [60, 80, 50, 90, 70, 85, 75], color = '#ff7900', height = 28 }) => (
  <svg width={56} height={height} viewBox={`0 0 56 ${height}`} fill="none" className="shrink-0">
    {values.map((v, i) => {
      const barH = (v / 100) * height;
      return (
        <rect key={i} x={i * 8} y={height - barH} width={5} height={barH} rx={2}
          fill={color} opacity={0.6 + i * 0.04} />
      );
    })}
  </svg>
);

/* ─── Section header ─────────────────────────────────────────────────────────── */
const SectionHeader = ({ title, action, icon: Icon }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <div className="flex items-center gap-2">
      {Icon && <Icon size={14} className="text-[#ff7900]" />}
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#06285a]">{title}</p>
    </div>
    {action}
  </div>
);

/* ─── Card / Panel wrappers ──────────────────────────────────────────────────── */
const Card = ({ children, className = '', style }) => (
  <div className={`rounded-xl border border-slate-100 bg-white ${className}`} style={style}>
    {children}
  </div>
);
const Panel = ({ children, className = '', title, icon, action }) => (
  <Card className={`p-4 ${className}`}>
    {title && <SectionHeader title={title} icon={icon} action={action} />}
    {children}
  </Card>
);

/* ─── Stat Tile ──────────────────────────────────────────────────────────────── */
const StatTile = ({ label, value, sub, icon: Icon, accent, spark, onClick, loading }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-100 bg-white p-4 text-left transition-all duration-200 hover:border-[#ff7900]/40 hover:shadow-[0_4px_24px_rgba(255,121,0,0.10)] focus:outline-none"
    style={{ minHeight: 120 }}
  >
    <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl transition-all duration-300 group-hover:w-[5px]" style={{ background: accent }} />
    <div className="flex items-start justify-between gap-2 pl-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-black text-[#06285a] leading-none">
          {loading ? <span className="text-slate-300">···</span> : value}
        </p>
        {sub && <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{sub}</p>}
      </div>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
        style={{ background: `${accent}18` }}
      >
        <Icon size={18} style={{ color: accent }} />
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between pl-2">
      {spark && <SparkBars color={accent} />}
      <ArrowUpRight size={13} className="ml-auto text-slate-300 transition-colors group-hover:text-[#ff7900]" />
    </div>
  </button>
);

/* ─── Empty panel ────────────────────────────────────────────────────────────── */
const EmptyPanel = ({ icon: Icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
    <Icon size={26} className="mb-2 text-slate-300" />
    <p className="text-sm font-semibold text-slate-400">{title}</p>
    {subtitle && <p className="mt-1 max-w-xs text-[11px] text-slate-400">{subtitle}</p>}
  </div>
);

/* ─── Assignment Row ─────────────────────────────────────────────────────────── */
const AssignmentRow = ({ item, index }) => (
  <div className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition-all duration-200 hover:border-[#ff7900]/30 hover:bg-[#fff8f2]">
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: index % 2 ? '#ff7900' : '#06285a' }}
    >
      <ClipboardList size={14} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-[#06285a]">{item.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-slate-500">
        {[item.subject, item.teacher].filter(Boolean).join(' · ')}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
        Due {fmtDate(item.rawDue) || item.dueDate}
      </span>
      {item.fileUrl ? (
        <a
          href={item.fileUrl}
          download
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded-lg bg-[#ff7900] px-2.5 py-1 text-[10px] font-black text-white transition hover:opacity-90"
        >
          <Download size={10} /> Download
        </a>
      ) : (
        <span className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-400">
          <Download size={10} /> No file
        </span>
      )}
      {item.submitted && (
        <CheckCircle2 size={14} className="text-emerald-500" />
      )}
    </div>
  </div>
);

/* ─── Report Card Grade Row ──────────────────────────────────────────────────── */
const GradeRow = ({ subject, score, grade, comment }) => {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#ff7900' : '#ef4444';
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm text-white"
        style={{ background: 'linear-gradient(135deg,#06285a 60%,#030b82)' }}>
        {subject.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#06285a]">{subject}</p>
        {comment && <p className="mt-0.5 truncate text-[11px] text-slate-500">{comment}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-lg font-black" style={{ color }}>{grade}</span>
        <span className="text-[10px] font-bold text-slate-400">{pct(score)}</span>
      </div>
      <RadialRing value={score} size={36} stroke={3} color={color} />
    </div>
  );
};

/* ─── Course Progress Card (real enrollment + progress data) ────────────────── */
const CourseProgressCard = ({ course, onNavigate }) => {
  const p = Number(course.progressPercent || 0);
  const done = p >= 100;
  const color = done ? '#10b981' : p >= 40 ? '#ff7900' : '#8b5cf6';
  return (
    <button
      type="button"
      onClick={() => onNavigate('student-course-view', { courseId: course.courseId })}
      className="group flex w-64 shrink-0 flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 text-left transition-all duration-200 hover:border-[#ff7900]/40 hover:shadow-[0_4px_20px_rgba(255,121,0,0.10)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#06285a]">{course.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {[course.subject, course.grade].filter(Boolean).join(' · ') || 'Course'}
          </p>
        </div>
        <RadialRing value={p} size={40} stroke={4} color={color} />
      </div>
      {course.description && (
        <p className="line-clamp-2 text-[11px] text-slate-500">{course.description}</p>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: color }} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-slate-400">
          {course.completedItems ?? 0}/{course.totalItems ?? 0} items
        </p>
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-colors" style={{ color }}>
          {done ? 'Review' : p > 0 ? 'Continue' : 'Start'} <ChevronRight size={11} />
        </span>
      </div>
    </button>
  );
};

/* ─── Achievements Panel (real GET /lms/achievements — XP, level, streak, badges) ─── */
const ACHIEVEMENT_ICON_BG = {
  FIRST_LESSON: '#0ea5e9',
  STREAK_7: '#f97316',
  STREAK_30: '#f97316',
  PERFECT_SCORE: '#10b981',
  FAST_LEARNER: '#8b5cf6',
  TOP_CONTRIBUTOR: '#f59e0b',
  EARLY_BIRD: '#6366f1',
  ASSIGNMENT_ACE: '#f43f5e',
  RESOURCE_SHARER: '#14b8a6',
};

const AchievementsPanel = ({ achievements, loading, onNavigate }) => {
  const xpTotal = achievements?.xpTotal ?? 0;
  const level = achievements?.level ?? 1;
  const streakDays = achievements?.streakDays ?? 0;
  const xpThisLevel = achievements?.xpThisLevel ?? 0;
  const xpToNextLevel = achievements?.xpToNextLevel ?? 100;
  const badges = achievements?.achievements ?? [];
  const levelProgressPct = Math.min(100, Math.round((xpThisLevel / Math.max(1, xpThisLevel + xpToNextLevel)) * 100));

  return (
    <Panel
      title="Achievements"
      icon={Trophy}
      action={
        <button
          type="button"
          onClick={() => onNavigate('learning-leaderboard')}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#06285a] transition hover:border-[#ff7900]/40"
        >
          Leaderboard <ChevronRight size={10} />
        </button>
      }
    >
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : !achievements ? (
        <EmptyPanel icon={Trophy} title="Achievements coming soon" subtitle="Complete lessons and assignments to start earning XP and badges." />
      ) : (
        <>
          <div className="relative mb-3 overflow-hidden rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#ff7900 0%,#e56200 100%)' }}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Level</p>
                <p className="mt-0.5 text-3xl font-black text-white">{level}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Total XP</p>
                <p className="mt-0.5 text-3xl font-black text-white">{xpTotal}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Streak</p>
                <p className="mt-0.5 text-3xl font-black text-white">{streakDays}d</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-white/70">
                <span>{xpThisLevel} XP</span>
                <span>{xpToNextLevel} XP to level {level + 1}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${levelProgressPct}%` }} />
              </div>
            </div>
          </div>

          {badges.length === 0 ? (
            <EmptyPanel icon={Award} title="No badges yet" subtitle="Complete lessons and assignments to earn your first badge." />
          ) : (
            <div className="space-y-2">
              {badges.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${ACHIEVEMENT_ICON_BG[a.type] || '#64748b'}18`, color: ACHIEVEMENT_ICON_BG[a.type] || '#64748b' }}
                  >
                    <Award size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#06285a]">{a.title}</p>
                    <p className="text-[10px] text-slate-500">+{a.xpEarned} XP</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
};

/* ─── Marketplace Listing Card (real /lms/marketplace data) ─────────────────── */
const LISTING_TYPE_LABEL = { FREE: 'Free resource', PAID: 'Paid', BUNDLE: 'Bundle', SUBSCRIPTION: 'Subscription' };

const PaperCard = ({ paper, onAddToCart, inCart }) => {
  const isFree = Number(paper.price) === 0;
  const sellerName = paper.seller
    ? `${paper.seller.firstName ?? ''} ${paper.seller.lastName ?? ''}`.trim()
    : '';
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 transition-all duration-200 hover:border-[#ff7900]/30 hover:shadow-[0_4px_20px_rgba(255,121,0,0.08)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#06285a]/8">
          <FileText size={18} className="text-[#06285a]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#06285a]">{paper.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {[LISTING_TYPE_LABEL[paper.listingType] || paper.listingType, sellerName && `by ${sellerName}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {paper.rating ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <Star size={10} className="text-[#ff7900]" fill="#ff7900" />
            <span className="text-[10px] font-bold text-slate-500">{Number(paper.rating).toFixed(1)}</span>
          </div>
        ) : null}
      </div>
      {paper.description && (
        <p className="line-clamp-2 text-[11px] text-slate-500">{paper.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-black text-[#06285a]">
            {isFree ? 'FREE' : `KES ${fmt(paper.price)}`}
          </span>
          {paper.purchaseCount > 0 && (
            <span className="text-[10px] text-slate-400">· {fmt(paper.purchaseCount)} sold</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onAddToCart(paper)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black transition-all duration-200 ${
            inCart
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'bg-[#ff7900] text-white hover:opacity-90'
          }`}
        >
          {inCart ? <CheckCircle2 size={12} /> : <ShoppingCart size={12} />}
          {inCart ? 'Added' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
};

/* ─── M-Pesa Checkout Modal (real STK push + polling) ────────────────────────
 * Flow:
 *  1. form        — collect phone number
 *  2. submitting  — POST /lms/marketplace/:id/purchase for each cart item
 *  3. waiting     — poll GET /lms/marketplace/my-purchases until each
 *                   purchase's status leaves PENDING (Safaricom callback
 *                   updates it asynchronously server-side)
 *  4. success / partial / error — final outcome + real download links
 * ────────────────────────────────────────────────────────────────────────── */
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 14; // ~42s of polling before we give up and let them check later

const MpesaCheckoutModal = ({ cart, user, onClose, onSuccess }) => {
  const [phone, setPhone] = useState(user?.phone || user?.phoneNumber || '');
  const [step, setStep] = useState('form'); // form | submitting | waiting | success | partial | error
  const [results, setResults] = useState([]); // [{ item, purchaseId?, status, error? }]
  const [attempts, setAttempts] = useState(0);
  const [downloadState, setDownloadState] = useState({}); // purchaseId -> 'loading' | 'error' | url

  const total = cart.reduce((s, i) => s + Number(i.price || 0), 0);

  const handlePay = async () => {
    if (!phone) return;
    setStep('submitting');

    const initiated = [];
    for (const item of cart) {
      try {
        const res = await marketplaceAPI.initiatePurchase(
          item.id,
          phone,
          user?.firstName || '',
          user?.lastName || ''
        );
        if (res?.success && res?.data?.purchaseId) {
          initiated.push({ item, purchaseId: res.data.purchaseId, status: 'pending' });
        } else {
          initiated.push({ item, status: 'failed', error: res?.message || 'Could not start the M-Pesa push' });
        }
      } catch (err) {
        initiated.push({ item, status: 'failed', error: err?.message || 'Request failed' });
      }
    }

    setResults(initiated);
    setAttempts(0);
    setStep(initiated.some((r) => r.status === 'pending') ? 'waiting' : 'error');
  };

  // Poll for STK push completion
  useEffect(() => {
    if (step !== 'waiting') return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await marketplaceAPI.getMyPurchases();
        const purchases = res?.data || [];
        const statusById = Object.fromEntries(purchases.map((p) => [p.id, p.status]));
        if (cancelled) return;
        setResults((prev) =>
          prev.map((r) => {
            if (r.status !== 'pending') return r;
            const s = statusById[r.purchaseId];
            if (s === 'COMPLETED') return { ...r, status: 'completed' };
            if (s === 'FAILED') return { ...r, status: 'failed', error: 'Payment failed or was cancelled on your phone' };
            return r;
          })
        );
      } catch {
        // transient network hiccup — keep polling silently
      }
      if (!cancelled) setAttempts((a) => a + 1);
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step]);

  // Resolve final state once nothing is pending, or we've polled long enough
  useEffect(() => {
    if (step !== 'waiting' || results.length === 0) return;
    const stillPending = results.some((r) => r.status === 'pending');
    const anyCompleted = results.some((r) => r.status === 'completed');
    if (!stillPending) {
      setStep(anyCompleted ? (results.every((r) => r.status === 'completed') ? 'success' : 'partial') : 'error');
    } else if (attempts >= POLL_MAX_ATTEMPTS) {
      setStep(anyCompleted ? 'partial' : 'error');
    }
  }, [results, attempts, step]);

  const handleDownload = async (purchaseId) => {
    setDownloadState((prev) => ({ ...prev, [purchaseId]: 'loading' }));
    try {
      const res = await marketplaceAPI.downloadPurchasedResource(purchaseId);
      const url = res?.data?.url;
      if (url) {
        window.open(url, '_blank', 'noopener');
        setDownloadState((prev) => ({ ...prev, [purchaseId]: 'ready' }));
      } else {
        setDownloadState((prev) => ({ ...prev, [purchaseId]: 'error' }));
      }
    } catch {
      setDownloadState((prev) => ({ ...prev, [purchaseId]: 'error' }));
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={step === 'waiting' || step === 'submitting' ? undefined : onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step !== 'waiting' && step !== 'submitting' && (
          <button type="button" onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        )}

        {step === 'form' && (
          <>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4caf50]/10">
                <Phone size={20} className="text-[#4caf50]" />
              </div>
              <div>
                <p className="text-sm font-black text-[#06285a]">M-Pesa Payment</p>
                <p className="text-[11px] text-slate-500">STK Push to your number</p>
              </div>
            </div>

            <div className="mb-4 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <p className="min-w-0 flex-1 truncate text-[11px] text-slate-600">{item.title}</p>
                  <p className="shrink-0 text-[11px] font-black text-[#06285a]">
                    {Number(item.price) === 0 ? 'FREE' : `KES ${fmt(item.price)}`}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                <p className="text-[11px] font-black uppercase text-slate-500">Total</p>
                <p className="text-sm font-black text-[#ff7900]">KES {fmt(total)}</p>
              </div>
            </div>

            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
              M-Pesa Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0712345678"
              className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#06285a] outline-none transition focus:border-[#ff7900] focus:ring-2 focus:ring-[#ff7900]/20"
            />

            <button
              type="button"
              onClick={handlePay}
              disabled={!phone}
              className="w-full rounded-xl bg-[#4caf50] py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Pay KES {fmt(total)} via M-Pesa
            </button>
            <p className="mt-3 text-center text-[10px] text-slate-400">
              You will receive an STK push on your phone to confirm payment.
            </p>
          </>
        )}

        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <RefreshCw size={36} className="mb-4 animate-spin text-[#4caf50]" />
            <p className="text-base font-black text-[#06285a]">Sending STK push…</p>
            <p className="mt-2 text-[12px] text-slate-500">Contacting M-Pesa for {cart.length} item{cart.length > 1 ? 's' : ''}.</p>
          </div>
        )}

        {step === 'waiting' && (
          <div className="py-6 text-center">
            <RefreshCw size={32} className="mx-auto mb-3 animate-spin text-[#4caf50]" />
            <p className="text-base font-black text-[#06285a]">Waiting for payment…</p>
            <p className="mt-1 mb-4 text-[12px] text-slate-500">Check your phone and enter your M-Pesa PIN.</p>
            <div className="space-y-1.5 text-left">
              {results.map((r) => (
                <div key={r.item.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-[11px] text-slate-600">{r.item.title}</p>
                  {r.status === 'pending' && <RefreshCw size={12} className="shrink-0 animate-spin text-slate-400" />}
                  {r.status === 'completed' && <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />}
                  {r.status === 'failed' && <XCircle size={14} className="shrink-0 text-red-400" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {(step === 'success' || step === 'partial' || step === 'error') && (
          <div className="py-4 text-center">
            {step === 'success' && (
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mx-auto">
                <CheckCircle2 size={36} className="text-emerald-500" />
              </div>
            )}
            {step === 'partial' && (
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 mx-auto">
                <AlertTriangle size={32} className="text-amber-500" />
              </div>
            )}
            {step === 'error' && (
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mx-auto">
                <XCircle size={32} className="text-red-500" />
              </div>
            )}

            <p className="text-base font-black text-[#06285a]">
              {step === 'success' && 'Payment Successful!'}
              {step === 'partial' && 'Some payments went through'}
              {step === 'error' && 'Payment did not complete'}
            </p>
            <p className="mt-1 mb-4 text-[12px] text-slate-500">
              {step === 'error'
                ? 'No STK push was confirmed. You can try again — nothing was charged.'
                : 'Download your completed items below.'}
            </p>

            <div className="space-y-1.5 text-left">
              {results.map((r) => (
                <div key={r.item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-[11px] text-slate-600">{r.item.title}</p>
                  {r.status === 'completed' ? (
                    <button
                      type="button"
                      onClick={() => handleDownload(r.purchaseId)}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-[#ff7900] px-2 py-1 text-[10px] font-black text-white transition hover:opacity-90"
                    >
                      {downloadState[r.purchaseId] === 'loading' ? (
                        <RefreshCw size={10} className="animate-spin" />
                      ) : (
                        <Download size={10} />
                      )}
                      {downloadState[r.purchaseId] === 'error' ? 'Retry' : 'Download'}
                    </button>
                  ) : (
                    <span className="shrink-0 text-[10px] font-semibold text-red-400">
                      {r.error || 'Not completed'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={step === 'error' ? () => setStep('form') : onSuccess}
              className="mt-5 w-full rounded-xl bg-[#06285a] py-2.5 text-sm font-black text-white transition hover:opacity-90"
            >
              {step === 'error' ? 'Try Again' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Cart Drawer ────────────────────────────────────────────────────────────── */
const CartDrawer = ({ cart, onRemove, onClose, onCheckout }) => {
  const total = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  return (
    <div className="fixed inset-0 z-[999] flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-80 flex-col border-l border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-[#ff7900]" />
            <p className="text-sm font-black text-[#06285a]">Cart ({cart.length})</p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <EmptyPanel icon={ShoppingCart} title="Your cart is empty" />
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <FileText size={14} className="shrink-0 text-[#06285a]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#06285a]">{item.title}</p>
                    <p className="text-[10px] text-slate-500">{Number(item.price) === 0 ? 'FREE' : `KES ${fmt(item.price)}`}</p>
                  </div>
                  <button type="button" onClick={() => onRemove(item.id)}
                    className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</p>
              <p className="text-lg font-black text-[#ff7900]">KES {fmt(total)}</p>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff7900] py-3 text-sm font-black text-white transition hover:opacity-90"
            >
              <CreditCard size={16} /> Checkout via M-Pesa
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MARKETPLACE_TYPES = ['All', 'FREE', 'PAID', 'BUNDLE', 'SUBSCRIPTION'];

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
const StudentDashboard = ({ user, onNavigate }) => {
  const [loading, setLoading]         = useState(true);
  const [metrics, setMetrics]         = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [reportCard, setReportCard]   = useState(null);
  const [apiError, setApiError]       = useState(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [noLearnerRecord, setNoLearnerRecord] = useState(false);

  /* ── Achievements (real XP / level / streak / badges) ─────────────────────────────── */
  const [achievements, setAchievements] = useState(null);
  const [achievementsLoading, setAchievementsLoading] = useState(true);

  /* ── Courses (real enrollment + progress) ────────────────────────────────── */
  const [courses, setCourses]               = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  /* ── Marketplace (real listings) ─────────────────────────────────────────── */
  const [listings, setListings]                   = useState([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceUnavailable, setMarketplaceUnavailable] = useState(false);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  /* ── Cart state ─────────────────────────────────────────────────────────── */
  const [cart, setCart]                 = useState([]);
  const [cartOpen, setCartOpen]         = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  /* ── Report card expand ──────────────────────────────────────────────────── */
  const [reportExpanded, setReportExpanded] = useState(false);

  const { isImpersonating } = useImpersonation();
  const userId = user?.id || user?.userId;

  const loadData = async () => {
    try {
      setRefreshing(true);
      setApiError(null);
      setNoLearnerRecord(false);

      // Fetch dashboard stats + student assignments + enrolled courses concurrently
      const [metricsRes, assignRes, coursesRes] = await Promise.allSettled([
        dashboardAPI.getStudentMetrics?.() ?? Promise.resolve({ success: true, data: {} }),
        lmsAPI.getStudentAssignments(),
        lmsAPI.getStudentCourses(),
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value?.success) {
        setMetrics(metricsRes.value.data);
      } else if (metricsRes.status === 'rejected') {
        const err = metricsRes.reason;
        const isLearnerNotFound =
          err?.response?.status === 404 ||
          err?.response?.status === 403 ||
          (err?.message || '').toLowerCase().includes('learner record not found') ||
          (err?.message || '').toLowerCase().includes('unauthorized student');
        if (isLearnerNotFound) {
          setNoLearnerRecord(true);
          setMetrics({});
        } else {
          setApiError(err?.message || 'Could not reach the server.');
        }
      }

      if (assignRes.status === 'fulfilled' && assignRes.value?.success) {
        // Normalise API shape → AssignmentRow shape
        const raw = assignRes.value.data ?? [];
        setAssignments(
          raw.map((a) => ({
            id:        a.id,
            title:     a.title,
            subject:   a.learningArea?.name ?? '',
            teacher:   a.class?.name ?? '',
            rawDue:    a.dueDate ?? null,
            dueDate:   fmtDate(a.dueDate),
            submitted:  ['SUBMITTED', 'LATE', 'MARKED', 'RESUBMITTED'].includes(a.mySubmission?.status),
            statusSummary: a.statusSummary,
            isOverdue: Boolean(a.isOverdue),
            fileUrl:   null, // list endpoint doesn't return individual file URLs; see assignment detail for files
          }))
        );
      }

      if (coursesRes.status === 'fulfilled' && coursesRes.value?.success) {
        setCourses(coursesRes.value.data ?? []);
      }
      setCoursesLoading(false);

      // Report card: derive from metrics if available
      if (metricsRes.status === 'fulfilled' && metricsRes.value?.data?.reportCard) {
        setReportCard(metricsRes.value.data.reportCard);
      }

      // Achievements — best-effort, non-fatal (student-only endpoint)
      try {
        const achRes = await lmsAPI.getAchievements?.();
        setAchievements(achRes?.data || null);
      } catch {
        setAchievements(null);
      } finally {
        setAchievementsLoading(false);
      }
    } catch (error) {
      setApiError(error.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [userId]); // eslint-disable-line

  /* ── Marketplace: fetch real listings (debounced by search/type) ─────────── */
  useEffect(() => {
    let active = true;
    setMarketplaceLoading(true);
    const handle = setTimeout(async () => {
      try {
        const params = { limit: 8 };
        if (search) params.search = search;
        if (typeFilter !== 'All') params.type = typeFilter;
        const res = await marketplaceAPI.browseListings(params);
        if (!active) return;
        if (res?.success !== false) {
          setListings(res.listings ?? res.data?.listings ?? []);
          setMarketplaceUnavailable(false);
        } else {
          setListings([]);
        }
      } catch (err) {
        if (!active) return;
        const status = err?.response?.status;
        const msg = (err?.message || '').toLowerCase();
        if (status === 403 || msg.includes('enterprise') || msg.includes('not available') || msg.includes('app')) {
          setMarketplaceUnavailable(true);
        }
        setListings([]);
      } finally {
        if (active) setMarketplaceLoading(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(handle); };
  }, [search, typeFilter]);

  /* ── Derived metrics ─────────────────────────────────────────────────────── */
  const attendanceRate = metrics?.stats?.attendanceRate ?? metrics?.stats?.attendance ?? 0;
  const submittedCount = assignments.filter(a => a.submitted).length;
  const pendingCount   = assignments.length - submittedCount;
  const messages       = metrics?.stats?.messages ?? 0;

  // Report card derived values
  const reportSubjects = reportCard?.subjects ?? [];
  const avgScore = reportSubjects.length
    ? Math.round(reportSubjects.reduce((s, r) => s + (r.score ?? 0), 0) / reportSubjects.length)
    : (metrics?.stats?.avgScore ?? 0);
  const reportTerm     = reportCard?.term ?? '';
  const reportGrade    = reportCard?.grade ?? '--';
  const reportPosition = reportCard?.position ?? '--';
  const reportOutOf    = reportCard?.outOf ?? '--';
  const reportGpa      = reportCard?.gpa ?? '--';

  /* ── Marketplace / cart helpers ───────────────────────────────────────────── */
  const addToCart      = (paper) => { if (!cart.find(i => i.id === paper.id)) setCart(c => [...c, paper]); };
  const removeFromCart = (id)    => setCart(c => c.filter(i => i.id !== id));
  const isInCart       = (id)    => cart.some(i => i.id === id);

  const handleCheckoutSuccess = () => {
    setCheckoutOpen(false);
    setCartOpen(false);
    setCart([]);
  };

  /* ── Stat tiles ──────────────────────────────────────────────────────────── */
  const statTiles = [
    { label: 'Assignments Due', value: fmt(pendingCount), sub: pendingCount === 1 ? 'Needs attention' : 'Need attention', icon: ClipboardList, accent: '#030b82', spark: true,  onClick: () => onNavigate('student-assignments') },
    { label: 'Attendance',  value: attendanceRate ? pct(attendanceRate) : '--', sub: 'View my report', icon: CheckCircle2, accent: '#ff7900', spark: true,  onClick: () => onNavigate('student-attendance') },
    { label: 'Unread Messages', value: fmt(messages), sub: 'Open inbox', icon: MessageSquare, accent: '#06285a', spark: false, onClick: () => onNavigate('communication') },
  ];

  /* ── Error state ─────────────────────────────────────────────────────────── */
  if (apiError && !metrics && !loading) return (
    <div className="space-y-6">
      <GreetingToast user={user} fallbackName="Student" description="Student Dashboard" onNavigate={onNavigate} />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <AlertTriangle size={36} className="mb-3 text-[#ff7900]" />
        <h2 className="text-lg font-black text-[#06285a]">Dashboard unavailable</h2>
        <p className="mt-2 text-sm text-slate-500">{apiError}</p>
        <button type="button" onClick={loadData}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ff7900] px-5 py-2.5 text-sm font-black text-[#06285a] transition hover:opacity-90">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    </div>
  );

  /* ── Loading skeleton ────────────────────────────────────────────────────── */
  if (loading && !metrics) return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-[120px]" />)}
      </div>
      <div className="grid grid-cols-[1fr_1fr_22rem] gap-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-28" /></div>
      </div>
    </div>
  );

  /* ── Main render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 pb-8">
      {/* Overlays */}
      {cartOpen && (
        <CartDrawer cart={cart} onRemove={removeFromCart} onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />
      )}
      {checkoutOpen && (
        <MpesaCheckoutModal cart={cart} user={user} onClose={() => setCheckoutOpen(false)} onSuccess={handleCheckoutSuccess} />
      )}

      {/* Impersonation notice */}
      {noLearnerRecord && isImpersonating && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold">Preview mode — no learner record found.</span>
            {' '}This student account isn't linked to a learner profile yet.
          </div>
        </div>
      )}

      {/* Greeting */}
      <GreetingToast user={user} fallbackName="Student" description="Student Dashboard · Today's Overview" onNavigate={onNavigate} />

      {/* Sync indicator */}
      {refreshing && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2">
          <RefreshCw size={12} className="animate-spin text-blue-500" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Syncing…</p>
        </div>
      )}

      {/* ── Group 1: immediate priorities ─────────────────────── */}
      <section aria-labelledby="student-needs-attention" className="space-y-3">
        <div>
          <h2 id="student-needs-attention" className="text-sm font-black uppercase tracking-wider text-[#06285a]">Needs attention</h2>
          <p className="mt-0.5 text-xs text-slate-500">The important things to check today.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {statTiles.map(tile => (
            <StatTile key={tile.label} {...tile} loading={loading} />
          ))}
        </div>
      </section>

      {/* ── Group 2: learning first ───────────────────────────── */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-[#06285a]">My learning</h2>
        <p className="mt-0.5 text-xs text-slate-500">Pick up where you left off and complete your work.</p>
      </div>

      {/* Continue Learning (real enrolled-course progress) */}
      <Panel
        title="Continue Learning"
        icon={BookOpen}
        action={
          <button type="button" onClick={() => onNavigate('student-courses')}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#06285a] transition hover:border-[#ff7900]/40">
            All Courses <ChevronRight size={10} />
          </button>
        }
      >
        {coursesLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-[152px] w-64 shrink-0" />)}
          </div>
        ) : courses.length === 0 ? (
          <EmptyPanel icon={BookOpen} title="You are not enrolled in any courses yet" subtitle="Your teacher will enroll you when a course is available." />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {courses.map(c => (
              <CourseProgressCard key={c.courseId} course={c} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </Panel>

      {/* ── Group 3: learning activity and progress ──────────── */}
      <div className="border-t border-slate-200 pt-2">
        <h2 className="text-sm font-black uppercase tracking-wider text-[#06285a]">Progress & results</h2>
        <p className="mt-0.5 text-xs text-slate-500">Review completed work, attendance and academic progress.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">

        {/* LEFT ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Assignments + Report Card side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Assignments Panel */}
            <Panel
              title="My Assignments"
              icon={ClipboardList}
              action={
                <button type="button" onClick={() => onNavigate('student-assignments')}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#06285a] transition hover:border-[#ff7900]/40">
                  All <ChevronRight size={10} />
                </button>
              }
            >
              {/* Summary bar */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 py-2">
                  <p className="text-lg font-black text-emerald-700">{submittedCount}</p>
                  <p className="text-[10px] font-bold uppercase text-emerald-600">Submitted</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-xl border border-amber-100 bg-amber-50 py-2">
                  <p className="text-lg font-black text-amber-700">{pendingCount}</p>
                  <p className="text-[10px] font-bold uppercase text-amber-600">Pending</p>
                </div>
              </div>
              <div className="space-y-2">
                {assignments.length === 0 ? (
                  <EmptyPanel icon={ClipboardList} title="No assignments yet" />
                ) : (
                  assignments.map((a, i) => (
                    <AssignmentRow key={a.id} item={a} index={i} />
                  ))
                )}
              </div>
            </Panel>

            {/* Report Card Panel */}
            <Panel
              title="Report Card"
              icon={Award}
              action={
                <button type="button"
                  onClick={() => setReportExpanded(r => !r)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#06285a] transition hover:border-[#ff7900]/40">
                  {reportExpanded ? 'Collapse' : 'Expand'}
                  <ChevronDown size={10} className={`transition-transform ${reportExpanded ? 'rotate-180' : ''}`} />
                </button>
              }
            >
              {/* Hero summary tile */}
              <div
                className="relative mb-3 overflow-hidden rounded-xl p-4 text-white"
                style={{ background: 'linear-gradient(135deg,#06285a 0%,#030b82 100%)' }}
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <div className="flex items-start justify-between">
                  <div>
                    {reportTerm && <p className="text-[10px] font-black uppercase tracking-widest text-white/60">{reportTerm}</p>}
                    <p className="mt-1 text-4xl font-black text-white">{reportGrade}</p>
                    {reportPosition !== '--' && (
                      <p className="text-[12px] font-medium text-white/70">
                        Position {reportPosition} of {reportOutOf}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RadialRing value={avgScore} size={52} stroke={5} color="#ff7900" bg="rgba(255,255,255,0.15)" />
                    <p className="text-[10px] font-bold text-white/70">{avgScore}% avg</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
                  <div className="text-center">
                    <p className="text-base font-black text-white">{reportGpa}</p>
                    <p className="text-[10px] text-white/50">GPA</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-base font-black text-white">{reportSubjects.length || '--'}</p>
                    <p className="text-[10px] text-white/50">Subjects</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-base font-black text-white">{reportPosition}</p>
                    <p className="text-[10px] text-white/50">Position</p>
                  </div>
                </div>
              </div>

              {/* Subject grades (live data when available, empty state otherwise) */}
              {reportSubjects.length > 0 ? (
                <>
                  <div className={`space-y-2 overflow-hidden transition-all duration-300 ${reportExpanded ? '' : 'max-h-[180px]'}`}>
                    {reportSubjects.map((s, i) => (
                      <GradeRow key={i} {...s} />
                    ))}
                  </div>
                  {!reportExpanded && (
                    <div className="mt-1 flex justify-center">
                      <button type="button" onClick={() => setReportExpanded(true)}
                        className="mt-1 text-[11px] font-black text-[#ff7900] hover:underline">
                        Show all {reportSubjects.length} subjects ↓
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <EmptyPanel icon={Award} title="No report card data yet" />
              )}

              {/* PDF download + full results link */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('student-results')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#030b82]/30 bg-[#030b82]/5 py-2.5 text-[11px] font-black uppercase tracking-wider text-[#030b82] transition hover:bg-[#030b82]/10"
                >
                  <BarChart2 size={13} /> View My Results
                </button>
                <button type="button"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#06285a]/20 bg-[#06285a]/5 py-2.5 text-[11px] font-black uppercase tracking-wider text-[#06285a] transition hover:bg-[#06285a]/10">
                  <Download size={13} /> Download PDF
                </button>
              </div>
            </Panel>
          </div>

          <div className="border-t border-slate-200 pt-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#06285a]">Explore & resources</h2>
            <p className="mt-0.5 text-xs text-slate-500">Plan your future and find extra learning material.</p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('student-pathway-planner')}
            className="group flex w-full items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-100/70"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Zap size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[#06285a]">Explore My Pathway</p>
              <p className="mt-0.5 text-xs text-slate-600">Discover subjects, careers and options for your future.</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-emerald-600 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Past Papers Marketplace — supplementary revision resources */}
          <Panel
            title="Revision Resources"
            icon={BookOpen}
            action={
              !marketplaceUnavailable && (
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="relative flex items-center gap-1.5 rounded-lg bg-[#ff7900] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:opacity-90"
                >
                  <ShoppingCart size={10} /> Cart
                  {cart.length > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-black text-[#ff7900]">
                      {cart.length}
                    </span>
                  )}
                </button>
              )
            }
          >
            {marketplaceUnavailable ? (
              <EmptyPanel
                icon={Lock}
                title="Marketplace isn't enabled for your school yet"
                subtitle="Ask your school admin to enable the LMS marketplace add-on to buy and sell past papers and revision resources."
              />
            ) : (
              <>
                {/* Search + filters */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[160px] flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search papers…"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold text-[#06285a] outline-none transition focus:border-[#ff7900] focus:ring-2 focus:ring-[#ff7900]/20"
                    />
                  </div>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#06285a] outline-none transition focus:border-[#ff7900]"
                  >
                    {MARKETPLACE_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : (LISTING_TYPE_LABEL[t] || t)}</option>)}
                  </select>
                </div>

                {marketplaceLoading ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[124px]" />)}
                  </div>
                ) : listings.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {listings.map(paper => (
                      <PaperCard
                        key={paper.id}
                        paper={paper}
                        onAddToCart={addToCart}
                        inCart={isInCart(paper.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyPanel icon={Search} title="No papers match your search" />
                )}

                {/* Checkout CTA bar */}
                {cart.length > 0 && (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-[#ff7900]/30 bg-[#fff8f2] px-4 py-3">
                    <p className="text-sm font-bold text-[#06285a]">
                      {cart.length} item{cart.length > 1 ? 's' : ''} in cart · KES {fmt(cart.reduce((s, i) => s + Number(i.price || 0), 0))}
                    </p>
                    <button type="button"
                      onClick={() => setCheckoutOpen(true)}
                      className="flex items-center gap-2 rounded-xl bg-[#ff7900] px-4 py-2 text-xs font-black text-white transition hover:opacity-90">
                      <CreditCard size={13} /> Pay via M-Pesa
                    </button>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>

        {/* RIGHT SIDEBAR ──────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Attendance glance */}
          <div className="overflow-hidden rounded-xl p-4"
            style={{ background: 'linear-gradient(135deg,#06285a 0%,#030b82 100%)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Attendance</p>
                <p className="mt-1 text-2xl font-black text-white">{attendanceRate ? pct(attendanceRate) : '--'}</p>
                <p className="text-[11px] font-medium text-white/60">Current Term</p>
              </div>
              <RadialRing value={Number(attendanceRate || 0)} size={56} stroke={5} color="#ff7900" bg="rgba(255,255,255,0.15)" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <div className="text-center">
                <p className="text-base font-black text-white">{submittedCount}</p>
                <p className="text-[10px] text-white/50">Submitted</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-base font-black text-white">{pendingCount}</p>
                <p className="text-[10px] text-white/50">Pending</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-base font-black text-white">{reportGrade}</p>
                <p className="text-[10px] text-white/50">Grade</p>
              </div>
            </div>
          </div>

          {/* Subject performance */}
          <Panel title="Subject Performance" icon={TrendingUp}>
            <div className="space-y-2">
              {reportSubjects.length > 0 ? (
                <div className="space-y-2">
                  {reportSubjects.slice(0, 4).map((s, i) => {
                    const color = s.score >= 80 ? '#10b981' : s.score >= 60 ? '#ff7900' : '#ef4444';
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-center font-black text-[10px] text-white"
                          style={{ background: i === 0 ? '#ff7900' : i === 1 ? '#06285a' : i === 2 ? '#8b5cf6' : '#64748b' }}
                        >
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#06285a]">{s.subject}</p>
                          <p className="text-[11px] text-slate-500">{s.grade} · {pct(s.score)}</p>
                        </div>
                        <TrendingUp size={14} className="shrink-0" style={{ color }} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel icon={TrendingUp} title="No subject data yet" />
              )}
            </div>
          </Panel>

          {/* Achievements — real XP, level, streak and badges */}
          <AchievementsPanel achievements={achievements} loading={achievementsLoading} onNavigate={onNavigate} />

          {/* Shortcuts kept together and visually subordinate to learning */}
          <Panel title="Shortcuts" icon={Zap}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'My Courses',   icon: BookOpen,      to: 'student-courses',     orange: true  },
                { label: 'Assignments',  icon: ClipboardList, to: 'student-assignments', orange: false },
                { label: 'My Progress',  icon: BarChart2,     to: 'student-progress',    orange: true  },
                { label: 'My Pathway',   icon: Zap,           to: 'student-pathway-planner', orange: false },
              ].map(({ label, icon: Icon, to, orange }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onNavigate(to)}
                  className="group flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-bold transition-all duration-200"
                  style={{
                    borderColor: orange ? '#ff7900' : 'rgba(6,40,90,0.15)',
                    background:  orange ? '#ff7900' : 'white',
                    color: '#06285a',
                  }}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </Panel>

          {/* Cart shortcut — only when cart has items */}
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="group flex w-full items-center gap-3 rounded-xl border border-[#ff7900]/30 bg-[#fff8f2] p-4 text-left transition-all duration-200 hover:border-[#ff7900]/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7900]">
                <ShoppingCart size={18} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[#06285a]">{cart.length} paper{cart.length > 1 ? 's' : ''} in cart</p>
                <p className="text-[11px] text-slate-500">KES {fmt(cart.reduce((s, i) => s + Number(i.price || 0), 0))} total</p>
              </div>
              <ChevronRight size={14} className="text-slate-300 transition-colors group-hover:text-[#ff7900]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
