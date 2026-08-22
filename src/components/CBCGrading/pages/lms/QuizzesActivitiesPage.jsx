/**
 * QuizzesActivitiesPage — Interactive Quizzes & Activities
 *
 * Design-phase discovery page. Surfaces the planned feature areas so the
 * team can discuss scope, prioritise, and iterate before writing backend code.
 *
 * Feature areas:
 *   1. Quizzes          — auto-graded teacher-created quizzes
 *   2. Polls            — quick in-class pulse checks
 *   3. Activities       — drag-drop / matching / fill-in exercises
 *   4. Flashcard Sets   — self-paced revision cards
 *   5. Live Q&A         — real-time question board during lessons
 */

import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Flame,
  HelpCircle,
  LayoutGrid,
  Layers,
  MessageSquare,
  Pencil,
  Star,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

// ─── Feature card data ────────────────────────────────────────────────────────

const FEATURE_AREAS = [
  {
    id: 'quizzes',
    icon: ClipboardList,
    color: 'bg-violet-50 text-violet-600',
    ring: 'ring-violet-200',
    accentBg: 'bg-violet-600',
    label: 'Quizzes',
    tagline: 'Auto-graded assessments with instant results',
    status: 'planned',
    description:
      'Teachers create timed or untimed quizzes with multiple-choice, true/false, and short-answer questions. Students attempt them independently and receive instant feedback with scores. Results feed into the analytics dashboard.',
    capabilities: [
      'Multiple-choice, true/false, short answer',
      'Timed or open-ended attempts',
      'Per-question explanations & correct answer reveal',
      'Class results overview for teachers',
      'Retry limits and due-date enforcement',
    ],
    questions: [
      'Should quizzes be linked to a specific Lesson, or standalone?',
      'Do we need randomised question order per student?',
      'Should past attempt history be visible to students?',
    ],
  },
  {
    id: 'polls',
    icon: LayoutGrid,
    color: 'bg-sky-50 text-sky-600',
    ring: 'ring-sky-200',
    accentBg: 'bg-sky-600',
    label: 'Polls & Quick Checks',
    tagline: 'Real-time in-class pulse questions',
    status: 'planned',
    description:
      'A teacher launches a single-question poll during a lesson. Students respond on their devices in real time. Results appear live as a bar chart on the teacher screen. Great for comprehension checks, votes, and icebreakers.',
    capabilities: [
      'Single-question launch from lesson view',
      'Live result chart (no page refresh)',
      'Anonymous or named responses',
      'Poll history tied to lesson',
      'Export responses to CSV',
    ],
    questions: [
      'Should polls be embedded inside Lessons or launched separately?',
      'Do we need real-time WebSocket updates or polling every few seconds?',
      'Should teachers be able to share results with students?',
    ],
  },
  {
    id: 'activities',
    icon: Layers,
    color: 'bg-emerald-50 text-emerald-600',
    ring: 'ring-emerald-200',
    accentBg: 'bg-emerald-600',
    label: 'Interactive Activities',
    tagline: 'Drag-drop, matching & fill-in exercises',
    status: 'exploratory',
    description:
      'Structured exercises beyond standard questions — drag-and-drop ordering, word matching, image labelling, and fill-in-the-blank sentences. Built as reusable activity blocks that teachers can embed directly into a Lesson or assign standalone.',
    capabilities: [
      'Drag-and-drop ordering / sorting',
      'Word-to-definition matching',
      'Image labelling (pin text onto diagram)',
      'Fill-in-the-blank with word bank',
      'Embedded inside lesson blocks',
    ],
    questions: [
      'Should activities share the same builder as Lessons, or have a separate editor?',
      'How do we score partial completion (e.g. 4/6 items matched correctly)?',
      'Do we need mobile-friendly drag-and-drop or only desktop?',
    ],
  },
  {
    id: 'flashcards',
    icon: Zap,
    color: 'bg-amber-50 text-amber-600',
    ring: 'ring-amber-200',
    accentBg: 'bg-amber-600',
    label: 'Flashcard Sets',
    tagline: 'Self-paced spaced-repetition revision',
    status: 'planned',
    description:
      'Teachers create term/front-back flashcard decks linked to a learning area. Students flip through them at their own pace. A confidence rating (Easy / Medium / Hard) schedules cards for spaced repetition so weak cards reappear sooner.',
    capabilities: [
      'Front / back text + optional image',
      'Linked to learning area & topic',
      'Student confidence rating per card',
      'Spaced-repetition scheduling (Easy → hide, Hard → resurface)',
      'Progress ring showing mastery %',
    ],
    questions: [
      'Should flashcard decks be linked to Lessons or standalone?',
      'Do students need to create their own decks, or teacher-only?',
      'Should decks be shareable to the Revision Library?',
    ],
  },
  {
    id: 'liveqa',
    icon: MessageSquare,
    color: 'bg-rose-50 text-rose-600',
    ring: 'ring-rose-200',
    accentBg: 'bg-rose-600',
    label: 'Live Q&A Board',
    tagline: 'Student questions during lessons, answered in real time',
    status: 'exploratory',
    description:
      'Students submit questions anonymously or by name during a live lesson. The teacher sees a moderated board, can upvote/answer questions, and mark them resolved. Prevents hand-raising chaos in large classes and keeps a log for later review.',
    capabilities: [
      'Anonymous or named question submission',
      'Teacher moderation queue',
      'Upvoting to surface popular questions',
      'Resolved / pending status per question',
      'Session transcript export',
    ],
    questions: [
      'Is this per-lesson or per-class-period?',
      'Do we need real-time delivery or near-real-time (10s polling)?',
      'Should this integrate with the Live Lessons module if we build one?',
    ],
  },
];

const STATUS_BADGE = {
  planned:     { label: 'Planned',     cls: 'bg-violet-100 text-violet-700' },
  exploratory: { label: 'Exploratory', cls: 'bg-amber-100  text-amber-700'  },
  building:    { label: 'Building',    cls: 'bg-emerald-100 text-emerald-700' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeatureCard({ feature, isOpen, onToggle }) {
  const Icon = feature.icon;
  const badge = STATUS_BADGE[feature.status];

  return (
    <div
      className={`rounded-xl border bg-white transition-shadow duration-200 ${
        isOpen ? 'shadow-md ring-1 ' + feature.ring : 'shadow-sm hover:shadow-md'
      }`}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${feature.color}`}>
          <Icon size={22} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-gray-900">{feature.label}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate">{feature.tagline}</p>
        </div>

        <ChevronRight
          size={16}
          className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>

      {/* ── Expanded detail ── */}
      {isOpen && (
        <div className="px-5 pb-6 border-t border-gray-100 pt-4 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Capabilities */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Planned capabilities
              </p>
              <ul className="space-y-1.5">
                {feature.capabilities.map((cap) => (
                  <li key={cap} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                    {cap}
                  </li>
                ))}
              </ul>
            </div>

            {/* Open questions */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Open questions
              </p>
              <ul className="space-y-1.5">
                {feature.questions.map((q) => (
                  <li key={q} className="flex items-start gap-2 text-sm text-gray-600">
                    <HelpCircle size={13} className="mt-0.5 flex-shrink-0 text-amber-500" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={17} />
      </div>
      <div>
        <p className="text-lg font-black text-gray-900 leading-none">{value}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuizzesActivitiesPage({ onNavigate }) {
  const [openId, setOpenId] = useState('quizzes'); // first card open by default

  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── Hero header ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-200">
            <ClipboardList size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-black text-gray-900">Quizzes & Activities</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-wide">
                Discovery
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xl">
              This page maps out the planned interactive learning features. Expand each area to review
              its scope, planned capabilities, and open design questions — then decide what to build first.
            </p>
          </div>
        </div>

        {/* ── At-a-glance stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill icon={Layers}      label="Feature areas"   value="5"        color="bg-violet-50 text-violet-600" />
          <StatPill icon={CheckCircle2} label="Planned"        value="3"        color="bg-emerald-50 text-emerald-600" />
          <StatPill icon={Star}        label="Exploratory"     value="2"        color="bg-amber-50 text-amber-600" />
          <StatPill icon={Users}       label="Student-facing"  value="All"      color="bg-sky-50 text-sky-600" />
        </div>

        {/* ── Guiding principle banner ── */}
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 flex items-start gap-3">
          <Flame size={18} className="text-violet-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-violet-800">
            <span className="font-semibold">Design principle:</span> Every activity here should give
            students <span className="font-semibold">immediate feedback</span> without a teacher
            needing to mark it manually. The goal is more learning time, less grading time.
          </div>
        </div>

        {/* ── Feature area accordion ── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Feature areas — click to expand
          </p>
          <div className="space-y-3">
            {FEATURE_AREAS.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                isOpen={openId === feature.id}
                onToggle={() => toggle(feature.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Suggested build order ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={17} className="text-amber-500" />
            <h2 className="text-sm font-bold text-gray-800">Suggested build order</h2>
          </div>
          <ol className="space-y-3">
            {[
              { step: 1, label: 'Quizzes',                  reason: 'Highest value, no real-time dependency, clear data model.',            color: 'bg-violet-600' },
              { step: 2, label: 'Flashcard Sets',           reason: 'Simple UI, reuses revision library patterns, students love them.',     color: 'bg-amber-500'  },
              { step: 3, label: 'Polls & Quick Checks',     reason: 'Low complexity, big classroom impact, easy WebSocket scope.',          color: 'bg-sky-500'    },
              { step: 4, label: 'Interactive Activities',   reason: 'Needs custom block types in the lesson builder — plan editor first.', color: 'bg-emerald-500'},
              { step: 5, label: 'Live Q&A Board',           reason: 'Depends on lesson scheduling + real-time infra — do last.',           color: 'bg-rose-500'   },
            ].map(({ step, label, reason, color }) => (
              <li key={step} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full ${color} text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  {step}
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-800">{label}</span>
                  <span className="text-sm text-gray-500"> — {reason}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Next steps CTA ── */}
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center space-y-3">
          <Pencil size={24} className="mx-auto text-gray-400" />
          <p className="text-sm font-semibold text-gray-700">Ready to start building?</p>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Review the open questions above with your team, pick the first feature area, then create a
            spec to drive the implementation.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('learning-dashboard')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors"
          >
            Back to Learning Dashboard
            <ChevronRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
