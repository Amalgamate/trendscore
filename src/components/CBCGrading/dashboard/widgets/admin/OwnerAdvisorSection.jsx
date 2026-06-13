/**
 * OwnerAdvisorSection
 * "PERSONAL ADVISOR — RECOMMENDED ACTIONS" panel.
 *
 * - Shows up to 10 insights, sorted by severity (critical first)
 * - Horizontal carousel that auto-scrolls one card every 5 seconds
 * - Pauses on hover / focus
 * - Solid-color cards: deep red (critical), red (high), amber (warning),
 *   green (positive), navy (info)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  DollarSign,
  BookOpen,
  Calendar,
  Users,
  Activity,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { dashboardAPI } from '../../../../../services/api';
import OwnerRecommendationCard from './OwnerRecommendationCard';

// ── category → visual tokens ──────────────────────────────────────────────────
const CATEGORY_MAP = {
  attendance: { icon: AlertTriangle, actionLabel: 'View Students',  actionRoute: 'learners-list' },
  financial:  { icon: DollarSign,   actionLabel: 'View Fees',       actionRoute: 'finance-fees' },
  academic:   { icon: BookOpen,     actionLabel: 'Open Analysis',   actionRoute: 'academic-intelligence' },
  staffing:   { icon: Users,        actionLabel: 'View Staff',       actionRoute: 'teachers-list' },
  operations: { icon: Activity,     actionLabel: 'View Details',     actionRoute: 'settings-system-logs' },
  calendar:   { icon: Calendar,     actionLabel: 'Open Calendar',    actionRoute: 'planner-calendar' },
};

const SEVERITY_ORDER = { critical: 0, high: 1, warning: 2, info: 3, positive: 4 };

function mapInsight(insight) {
  const tokens = CATEGORY_MAP[insight.category] ?? CATEGORY_MAP.operations;
  return {
    id:          insight.id ?? `${insight.category}-${Math.random()}`,
    title:       insight.title,
    description: insight.recommendation || insight.description,
    actionLabel: tokens.actionLabel,
    actionRoute: tokens.actionRoute,
    severity:    insight.severity,
    priority:    insight.severity === 'critical' || insight.severity === 'high' ? 'high'
                 : insight.severity === 'warning' ? 'medium' : 'low',
    icon:        tokens.icon,
  };
}

// ── Heading ───────────────────────────────────────────────────────────────────
const AdvisorHeading = ({ onRefresh, refreshing, total, activeIdx }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Sparkles size={14} className="text-brand-purple shrink-0" />
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-purple">
        Personal Advisor
      </p>
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
        — Recommended Actions
      </span>
      {total > 0 && (
        <span className="ml-2 text-[10px] font-semibold text-gray-400">
          {activeIdx + 1} / {total}
        </span>
      )}
    </div>
    <button
      onClick={onRefresh}
      disabled={refreshing}
      className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-brand-purple transition-colors disabled:opacity-40"
      title="Refresh insights"
    >
      <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  </div>
);

// ── Empty ─────────────────────────────────────────────────────────────────────
const AdvisorEmpty = () => (
  <div
    className="flex flex-col items-center justify-center py-10 text-center text-white rounded-xl px-6"
    style={{ backgroundColor: '#14532D' }}
  >
    <Sparkles size={28} className="mb-2 text-white/60" />
    <p className="text-sm font-bold text-white">All clear — no actions required.</p>
    <p className="text-xs mt-1 text-white/70">The advisor will surface recommendations as data changes.</p>
  </div>
);

// ── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="flex-shrink-0 w-72 h-44 flex flex-col gap-3 rounded-xl bg-gray-200 p-4 animate-pulse">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-gray-300 shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 w-4/5 bg-gray-300 rounded" />
        <div className="h-3 w-3/5 bg-gray-300 rounded" />
      </div>
    </div>
    <div className="h-3 w-2/3 bg-gray-300 rounded" />
    <div className="h-8 w-28 bg-gray-300 rounded-lg mt-auto" />
  </div>
);

// ── Dot indicators ─────────────────────────────────────────────────────────────
const Dots = ({ total, active, onDotClick }) => (
  <div className="flex items-center justify-center gap-1.5 mt-3">
    {Array.from({ length: total }).map((_, i) => (
      <button
        key={i}
        type="button"
        onClick={() => onDotClick(i)}
        className={`rounded-full transition-all duration-300 ${
          i === active
            ? 'w-4 h-2 bg-brand-purple'
            : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
        }`}
        aria-label={`Go to insight ${i + 1}`}
      />
    ))}
  </div>
);

const MinimalAdvisor = ({
  recommendations,
  loading,
  error,
  refreshing,
  onRefresh,
  onNavigate,
}) => {
  const items = recommendations.slice(0, 4);

  return (
    <section
      aria-label="Personal Advisor"
      className="h-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} className="text-brand-purple shrink-0" />
          <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-brand-purple">
            Personal Advisor
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-brand-purple transition-colors disabled:opacity-40"
          title="Refresh insights"
          type="button"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="mt-5 border-l border-gray-200 pl-5">
        {loading ? (
          <div className="space-y-5 animate-pulse">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="relative">
                <span className="absolute -left-[1.44rem] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-300" />
                <div className="h-3 w-24 rounded bg-gray-200" />
                <div className="mt-2 h-4 w-4/5 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="relative text-xs font-semibold text-rose-500">
            <span className="absolute -left-[1.44rem] top-1 h-2.5 w-2.5 rounded-full bg-rose-300" />
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="relative">
            <span className="absolute -left-[1.44rem] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <p className="text-sm font-black text-gray-900">No actions required</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">Advisor signals will appear as data changes.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.actionRoute)}
                  className="group relative block w-full text-left"
                >
                  <span className="absolute -left-[1.44rem] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-400 ring-4 ring-white transition-colors group-hover:bg-brand-purple" />
                  <span className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                    {Icon && <Icon size={13} className="text-gray-400" />}
                    {index === 0 ? 'Now' : `${index + 1} priority`}
                  </span>
                  <span className="mt-1 block text-sm font-black leading-snug text-gray-900 group-hover:text-brand-purple">
                    {item.title}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-relaxed text-gray-500">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const CARD_WIDTH   = 288 + 16; // w-72 (288px) + gap-4 (16px)
const AUTO_INTERVAL = 5000;    // 5 seconds
const MAX_ITEMS    = 10;

const OwnerAdvisorSection = ({ onNavigate, variant = 'carousel' }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,    setError]    = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused,   setPaused]   = useState(false);

  const trackRef  = useRef(null);
  const timerRef  = useRef(null);
  const pauseRef  = useRef(false);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async (fresh = false) => {
    if (fresh) setRefreshing(true);
    else       setLoading(true);
    setError(null);

    try {
      const res = await dashboardAPI.getInsights(fresh);
      if (res?.success && Array.isArray(res.data?.insights)) {
        const sorted = [...res.data.insights]
          .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
          .slice(0, MAX_ITEMS);
        setRecommendations(sorted.map(mapInsight));
        setActiveIdx(0);
      } else {
        setRecommendations([]);
      }
    } catch {
      setError('Could not load advisor insights.');
      setRecommendations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  // ── scroll to card ────────────────────────────────────────────────────────
  const scrollTo = useCallback((idx) => {
    setActiveIdx(idx);
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: idx * CARD_WIDTH, behavior: 'smooth' });
    }
  }, []);

  // ── auto-scroll timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (recommendations.length <= 1) return;

    const tick = () => {
      if (pauseRef.current) return;
      setActiveIdx(prev => {
        const next = (prev + 1) % recommendations.length;
        if (trackRef.current) {
          trackRef.current.scrollTo({ left: next * CARD_WIDTH, behavior: 'smooth' });
        }
        return next;
      });
    };

    timerRef.current = setInterval(tick, AUTO_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [recommendations.length]);

  // sync pauseRef
  useEffect(() => { pauseRef.current = paused; }, [paused]);

  // ── wheel scroll → advance/retreat one card ───────────────────────────────
  const totalRef = useRef(0);
  useEffect(() => { totalRef.current = recommendations.length; }, [recommendations.length]);

  const activeIdxRef = useRef(0);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let wheelCooldown = false;

    const onWheel = (e) => {
      const total = totalRef.current;
      if (total <= 1) return;
      e.preventDefault(); // stop page from scrolling

      if (wheelCooldown) return;
      wheelCooldown = true;
      setTimeout(() => { wheelCooldown = false; }, 400); // debounce per card

      const current = activeIdxRef.current;
      const next = e.deltaY > 0
        ? (current + 1) % total
        : (current - 1 + total) % total;

      setActiveIdx(next);
      el.scrollTo({ left: next * CARD_WIDTH, behavior: 'smooth' });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // attach once — reads live values via refs

  // ── manual nav ────────────────────────────────────────────────────────────
  const prev = () => scrollTo((activeIdx - 1 + recommendations.length) % recommendations.length);
  const next = () => scrollTo((activeIdx + 1) % recommendations.length);

  const total = recommendations.length;

  if (variant === 'minimal') {
    return (
      <MinimalAdvisor
        recommendations={recommendations}
        loading={loading}
        error={error}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <section
      aria-label="Personal Advisor — Recommended Actions"
      className="space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AdvisorHeading
        onRefresh={() => load(true)}
        refreshing={refreshing}
        total={total}
        activeIdx={activeIdx}
      />

      {/* ── carousel track ── */}
      <div className="relative">
        {/* left arrow */}
        {total > 1 && (
          <button
            type="button"
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10
              flex items-center justify-center w-7 h-7 rounded-full bg-white border border-gray-200
              shadow-sm text-gray-500 hover:text-brand-purple hover:border-brand-purple transition-colors"
            aria-label="Previous insight"
          >
            <ChevronLeft size={14} />
          </button>
        )}

        {/* scrollable track */}
        <div
          ref={trackRef}
          className="flex gap-4 overflow-x-hidden scroll-smooth pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {loading
            ? [0,1,2,3].map(i => <SkeletonCard key={i} />)
            : error
              ? (
                <div className="flex items-center gap-2 text-xs text-rose-500 py-4 px-1">
                  <AlertTriangle size={14} /> {error}
                </div>
              )
              : total === 0
                ? <AdvisorEmpty />
                : recommendations.map(rec => (
                    <OwnerRecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      onAction={route => onNavigate?.(route)}
                    />
                  ))
          }
        </div>

        {/* right arrow */}
        {total > 1 && (
          <button
            type="button"
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10
              flex items-center justify-center w-7 h-7 rounded-full bg-white border border-gray-200
              shadow-sm text-gray-500 hover:text-brand-purple hover:border-brand-purple transition-colors"
            aria-label="Next insight"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* dots */}
      {total > 1 && !loading && (
        <Dots total={total} active={activeIdx} onDotClick={scrollTo} />
      )}
    </section>
  );
};

export default OwnerAdvisorSection;
