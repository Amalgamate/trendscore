/**
 * LessonViewerPage
 *
 * Student-facing lesson viewer (read-only). Renders all blocks sequentially
 * in a single scrollable page (one full lesson, scroll down).
 *
 * On mount:
 *   - GET /api/lms/lessons/:id  (with blocks, filtered for student)
 *   - GET /api/lms/lessons/:id/progress
 *   - POST /api/lms/lessons/:id/session  → stores sessionId
 * On unmount / beforeunload:
 *   - PUT /api/lms/lessons/sessions/:sessionId
 *
 * Block types rendered:
 *   HEADING · PARAGRAPH · IMAGE · VIDEO · AUDIO · QUIZ · FLASHCARDS
 *   PDF · CODE · FORMULA · DISCUSSION · PRACTICE_QUESTIONS
 *   TEACHER_NOTES — never shown (filtered out)
 *
 * Features:
 *   - Progress bar (blocksCompleted / totalBlocks)
 *   - "Mark Complete" button at bottom → POST /api/lms/lessons/:id/progress
 *   - Back button → onNavigate('learning-lessons')
 *   - Enterprise: "Ask AI" button when hasApp('lms-enterprise')
 *   - Swipe left/right gesture support for mobile
 *   - Responsive, dark mode, Tailwind
 *
 * Requirements: 7.1, 7.2, 7.4, 7.5, 7.6, 18.8, 25.1, 25.2
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  BookOpen,
  FileText,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { fetchWithAuth } from '../../../../../services/api/core';
import { useNotifications } from '../../../hooks/useNotifications';
import { useModuleAccess } from '../../../../../contexts/ModuleAccessContext';
import { cn } from '../../../../../utils/cn';

// ─── Utilities ─────────────────────────────────────────────────────────────

const extractYouTubeId = (url) => {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
};

const isCloudinaryVideo = (url) =>
  url && url.includes('res.cloudinary.com') && url.includes('/video/upload/');

// ─── Block Renderers ────────────────────────────────────────────────────────

function HeadingBlock({ content }) {
  const level = Math.min(Math.max(content.level || 2, 1), 4);
  const Tag = `h${level}`;
  const sizeMap = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl', 4: 'text-lg' };
  return (
    <Tag className={cn('font-bold text-gray-950 dark:text-white leading-tight', sizeMap[level])}>
      {content.text}
    </Tag>
  );
}

function ParagraphBlock({ content }) {
  return (
    <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
      {content.text}
    </p>
  );
}

function ImageBlock({ content }) {
  return (
    <figure className="space-y-2">
      <img
        src={content.url}
        alt={content.alt || content.caption || 'Lesson image'}
        className="w-full max-h-96 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      {content.caption && (
        <figcaption className="text-center text-xs text-gray-500 dark:text-gray-400 italic">
          {content.caption}
        </figcaption>
      )}
    </figure>
  );
}

function VideoBlock({ content }) {
  const ytId = extractYouTubeId(content.url || '');
  const isCloud = isCloudinaryVideo(content.url || '');
  return (
    <figure className="space-y-2">
      {ytId ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={content.caption || 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      ) : isCloud ? (
        <video
          src={content.url}
          controls
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-black"
        />
      ) : content.url ? (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <ExternalLink size={16} className="text-brand-purple flex-shrink-0" />
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-purple hover:underline text-sm font-medium truncate"
          >
            {content.caption || content.url}
          </a>
        </div>
      ) : null}
      {content.caption && (
        <figcaption className="text-center text-xs text-gray-500 dark:text-gray-400 italic">
          {content.caption}
        </figcaption>
      )}
    </figure>
  );
}

function AudioBlock({ content }) {
  return (
    <figure className="space-y-2">
      {content.url ? (
        <audio controls src={content.url} className="w-full rounded-lg" aria-label={content.caption || 'Audio'} />
      ) : (
        <p className="text-sm text-gray-400 italic">No audio source provided.</p>
      )}
      {content.caption && (
        <figcaption className="text-xs text-gray-500 dark:text-gray-400 italic text-center">
          {content.caption}
        </figcaption>
      )}
    </figure>
  );
}

function PDFBlock({ content }) {
  if (!content.url) return null;
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <FileText size={24} className="text-red-500 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {content.caption || 'PDF Document'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{content.url}</p>
      </div>
      <a
        href={content.url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-purple text-white text-xs font-semibold rounded-lg hover:bg-brand-purple/90 transition flex-shrink-0"
      >
        <ExternalLink size={12} />
        Open PDF
      </a>
    </div>
  );
}

function CodeBlock({ content }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-700">
      {content.language && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wide">
            {content.language}
          </span>
        </div>
      )}
      <pre className="p-4 bg-gray-900 overflow-x-auto">
        <code className={`text-sm font-mono text-green-300 language-${content.language || 'text'}`}>
          {content.code}
        </code>
      </pre>
    </div>
  );
}

function FormulaBlock({ content }) {
  return (
    <figure className="space-y-2">
      <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-x-auto text-center">
        <code className="text-base font-mono text-gray-800 dark:text-gray-100 select-all">
          {content.latex}
        </code>
      </div>
      {content.caption && (
        <figcaption className="text-center text-xs text-gray-500 dark:text-gray-400 italic">
          {content.caption}
        </figcaption>
      )}
    </figure>
  );
}

function DiscussionBlock({ content }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden>💬</span>
      <div>
        <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">
          Discussion
        </p>
        <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
          {content.prompt}
        </p>
      </div>
    </div>
  );
}

function PracticeQuestionsBlock({ content }) {
  const [openIndex, setOpenIndex] = useState(null);
  const questions = content.questions || [];
  if (!questions.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Practice Questions
      </p>
      {questions.map((q, idx) => (
        <div key={q.id || idx} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            className="w-full flex items-center justify-between px-4 py-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            aria-expanded={openIndex === idx}
          >
            <span className="text-sm font-semibold text-gray-900 dark:text-white pr-2">
              {idx + 1}. {q.question}
            </span>
            {openIndex === idx
              ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
              : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
          </button>
          {openIndex === idx && q.answer && (
            <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Answer</p>
              <p className="text-sm text-green-900 dark:text-green-100 whitespace-pre-wrap">{q.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Quiz Block (interactive) ───────────────────────────────────────────────

function QuizBlock({ content }) {
  const questions = content.questions || [];
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (qIdx, choiceIdx) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: choiceIdx }));
  };
  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) return;
    setSubmitted(true);
  };
  const handleRetry = () => { setAnswers({}); setSubmitted(false); };

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.correctIndex).length
    : 0;

  if (!questions.length) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Quiz — {questions.length} question{questions.length !== 1 ? 's' : ''}
        </p>
        {submitted && (
          <button type="button" onClick={handleRetry}
            className="flex items-center gap-1 text-xs text-brand-purple hover:underline font-semibold">
            <RotateCcw size={12} /> Retry
          </button>
        )}
      </div>
      {submitted && (
        <div className={cn('p-3 rounded-xl text-sm font-semibold text-center',
          score === questions.length
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300')}>
          You scored {score} / {questions.length}{score === questions.length ? ' 🎉 Perfect!' : ''}
        </div>
      )}
      {questions.map((q, qIdx) => {
        const selected = answers[qIdx];
        return (
          <div key={q.id || qIdx} className="space-y-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {qIdx + 1}. {q.question}
            </p>
            <div className="space-y-1.5">
              {(q.choices || []).map((choice, cIdx) => {
                const isSelected = selected === cIdx;
                const isRight = submitted && cIdx === q.correctIndex;
                const isWrongSelected = submitted && isSelected && cIdx !== q.correctIndex;
                return (
                  <button key={cIdx} type="button" disabled={submitted}
                    onClick={() => handleSelect(qIdx, cIdx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm text-left transition-colors',
                      !submitted && isSelected ? 'border-brand-purple bg-brand-purple/10 text-brand-purple font-semibold'
                        : !submitted ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-brand-purple/50 hover:bg-brand-purple/5 text-gray-800 dark:text-gray-200'
                        : isRight ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-semibold'
                        : isWrongSelected ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500',
                    )}>
                    <span className={cn(
                      'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      !submitted && isSelected ? 'border-brand-purple bg-brand-purple'
                        : !submitted ? 'border-gray-300 dark:border-gray-600'
                        : isRight ? 'border-green-500 bg-green-500'
                        : isWrongSelected ? 'border-red-500 bg-red-500'
                        : 'border-gray-300 dark:border-gray-600')}>
                      {!submitted && isSelected && <span className="block w-2 h-2 rounded-full bg-white" />}
                      {submitted && isRight && <CheckCircle size={12} className="text-white" />}
                    </span>
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {!submitted && (
        <button type="button"
          disabled={Object.keys(answers).length < questions.length}
          onClick={handleSubmit}
          className="px-5 py-2 rounded-lg bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple/90 transition disabled:opacity-40 disabled:cursor-not-allowed">
          Submit Answers
        </button>
      )}
    </div>
  );
}

// ─── Flashcards Block (flip animation) ─────────────────────────────────────

function FlashcardsBlock({ content }) {
  const cards = content.cards || [];
  const [flipped, setFlipped] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);

  if (!cards.length) return null;

  const card = cards[currentIdx];
  const isFlipped = !!flipped[currentIdx];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Flashcards — {currentIdx + 1} / {cards.length}
        </p>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <button key={i} type="button"
              onClick={() => { setCurrentIdx(i); setFlipped((p) => ({ ...p, [i]: false })); }}
              className={cn('w-2 h-2 rounded-full transition-colors',
                i === currentIdx ? 'bg-brand-purple' : 'bg-gray-300 dark:bg-gray-600')}
              aria-label={`Go to card ${i + 1}`} />
          ))}
        </div>
      </div>

      {/* Flip card */}
      <button type="button"
        onClick={() => setFlipped((prev) => ({ ...prev, [currentIdx]: !prev[currentIdx] }))}
        aria-label={isFlipped ? 'Show front' : 'Tap to flip'}
        className="w-full min-h-[160px] cursor-pointer focus:outline-none"
        style={{ perspective: '1000px' }}>
        <div style={{
          transition: 'transform 0.5s',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
          minHeight: '160px',
        }}>
          {/* Front */}
          <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-brand-purple/30 bg-gradient-to-br from-brand-purple/5 to-brand-purple/10 dark:from-brand-purple/10 dark:to-brand-purple/20">
            <p className="text-xs font-semibold text-brand-purple uppercase tracking-wide mb-3">Front</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white text-center leading-snug">{card.front}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Tap to flip</p>
          </div>
          {/* Back */}
          <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-green-400/40 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-3">Back</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white text-center leading-snug">{card.back}</p>
          </div>
        </div>
      </button>

      {/* Prev / Next */}
      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={currentIdx === 0}
          onClick={() => { setCurrentIdx((i) => i - 1); setFlipped({}); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-brand-purple hover:text-brand-purple transition disabled:opacity-30">
          <ArrowLeft size={14} /> Prev
        </button>
        <button type="button" disabled={currentIdx === cards.length - 1}
          onClick={() => { setCurrentIdx((i) => i + 1); setFlipped({}); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-brand-purple hover:text-brand-purple transition disabled:opacity-30">
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Gallery Block ──────────────────────────────────────────────────────────

function GalleryBlock({ content }) {
  const images = (content.images || []).filter((img) => img?.url);
  const [activeIdx, setActiveIdx] = useState(0);
  if (!images.length) return null;

  return (
    <div className="space-y-3">
      <figure className="space-y-2">
        <img
          src={images[activeIdx].url}
          alt={images[activeIdx].caption || `Image ${activeIdx + 1}`}
          className="w-full max-h-96 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        {images[activeIdx].caption && (
          <figcaption className="text-center text-xs text-gray-500 dark:text-gray-400 italic">
            {images[activeIdx].caption}
          </figcaption>
        )}
      </figure>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={cn(
                'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition',
                idx === activeIdx ? 'border-brand-purple' : 'border-transparent opacity-70 hover:opacity-100',
              )}
              aria-label={`Show image ${idx + 1}`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline Block ─────────────────────────────────────────────────────────

function TimelineBlock({ content }) {
  const events = content.events || [];
  if (!events.length) return null;

  return (
    <div className="space-y-0">
      {events.map((ev, idx) => (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center flex-shrink-0">
            <span className="w-3 h-3 rounded-full bg-brand-purple mt-1.5" />
            {idx < events.length - 1 && (
              <span className="flex-1 w-px bg-gray-200 dark:bg-gray-700 my-1" />
            )}
          </div>
          <div className={cn('pb-6', idx === events.length - 1 && 'pb-0')}>
            {ev.date && (
              <p className="text-xs font-bold text-brand-purple uppercase tracking-wide mb-0.5">
                {ev.date}
              </p>
            )}
            {ev.title && (
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{ev.title}</p>
            )}
            {ev.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                {ev.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Accordion Block ────────────────────────────────────────────────────────

function AccordionBlock({ content }) {
  const [openIndex, setOpenIndex] = useState(0);
  const items = content.items || [];
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            className="w-full flex items-center justify-between px-4 py-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            aria-expanded={openIndex === idx}
          >
            <span className="text-sm font-semibold text-gray-900 dark:text-white pr-2">
              {item.title}
            </span>
            {openIndex === idx
              ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
              : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
          </button>
          {openIndex === idx && item.content && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{item.content}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Table Block ────────────────────────────────────────────────────────────

function TableBlock({ content }) {
  const headers = content.headers || [];
  const rows = content.rows || [];
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-200"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Block Renderer Map ─────────────────────────────────────────────────────
// TEACHER_NOTES intentionally omitted — never rendered for students

const BLOCK_RENDERERS = {
  HEADING:            HeadingBlock,
  PARAGRAPH:          ParagraphBlock,
  IMAGE:              ImageBlock,
  GALLERY:            GalleryBlock,
  VIDEO:              VideoBlock,
  AUDIO:              AudioBlock,
  QUIZ:               QuizBlock,
  FLASHCARDS:         FlashcardsBlock,
  TIMELINE:           TimelineBlock,
  ACCORDION:          AccordionBlock,
  TABLE:              TableBlock,
  PDF:                PDFBlock,
  CODE:               CodeBlock,
  FORMULA:            FormulaBlock,
  DISCUSSION:         DiscussionBlock,
  PRACTICE_QUESTIONS: PracticeQuestionsBlock,
};

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({ completed, total, lessonTitle }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
            {lessonTitle}
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {completed} / {total} — {pct}%
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Lesson progress"
        >
          <div
            className="h-full bg-brand-purple rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Single Block Card ──────────────────────────────────────────────────────

function BlockCard({ block }) {
  const Renderer = BLOCK_RENDERERS[block.type];
  if (!Renderer) return null; // TEACHER_NOTES and unknown types are silently skipped

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 sm:p-8">
      <Renderer content={block.content || {}} />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function LessonViewerPage({ lessonId: lessonIdProp, onNavigate, pageParams = {} }) {
  const lessonId = lessonIdProp ?? pageParams?.lessonId ?? null;

  const { showSuccess, showError } = useNotifications();
  const { isModuleEnabled } = useModuleAccess();
  const isEnterprise = isModuleEnabled('lms-enterprise');

  // ── Data state ──────────────────────────────────────────────────────────────
  const [lesson, setLesson] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [progress, setProgress] = useState({ blocksCompleted: 0, totalBlocks: 0, percentComplete: 0 });

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // ── Session tracking ─────────────────────────────────────────────────────────
  const sessionIdRef = useRef(null);
  const sessionEndedRef = useRef(false);

  // ── Load lesson + progress on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!lessonId) {
      setLoadError('No lesson ID provided.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadLesson = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [lessonRes, progressRes] = await Promise.all([
          lmsAPI.getLessonWithBlocks(lessonId),
          fetchWithAuth(`/lms/lessons/${lessonId}/progress`).catch(() => null),
        ]);

        if (cancelled) return;

        const lessonData = lessonRes?.data ?? lessonRes;
        const progressData = progressRes?.data ?? progressRes;

        // Filter out TEACHER_NOTES — never shown to students
        const visibleBlocks = (lessonData?.blocks || [])
          .filter((b) => b.type !== 'TEACHER_NOTES')
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        setLesson(lessonData);
        setBlocks(visibleBlocks);

        if (progressData) {
          setProgress({
            blocksCompleted: progressData.blocksCompleted ?? 0,
            totalBlocks: progressData.totalBlocks ?? visibleBlocks.length,
            percentComplete: progressData.percentComplete ?? 0,
          });
          if ((progressData.percentComplete ?? 0) >= 100) setIsCompleted(true);
        } else {
          setProgress((prev) => ({ ...prev, totalBlocks: visibleBlocks.length }));
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[LessonViewerPage] Failed to load lesson:', err);
        setLoadError('Failed to load lesson. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadLesson();
    return () => { cancelled = true; };
  }, [lessonId]);

  // ── Session start on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!lessonId) return;
    const startSession = async () => {
      try {
        const res = await fetchWithAuth(`/lms/lessons/${lessonId}/session`, {
          method: 'POST',
          body: JSON.stringify({
            deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'MOBILE' : 'DESKTOP',
          }),
        });
        const data = res?.data ?? res;
        if (data?.id) sessionIdRef.current = data.id;
      } catch (err) {
        // Non-critical: don't block lesson viewing
        console.warn('[LessonViewerPage] Session start failed:', err);
      }
    };
    startSession();
  }, [lessonId]);

  // ── End session helper ───────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    try {
      await fetchWithAuth(`/lms/lessons/sessions/${sessionIdRef.current}`, {
        method: 'PUT',
        body: JSON.stringify({ endedAt: new Date().toISOString() }),
      });
    } catch (err) {
      console.warn('[LessonViewerPage] Session end failed:', err);
    }
  }, []);

  // ── End session on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => { endSession(); };
  }, [endSession]);

  // ── End session on beforeunload (sendBeacon for reliability) ─────────────────
  useEffect(() => {
    const handleUnload = () => {
      if (!sessionIdRef.current || sessionEndedRef.current) return;
      sessionEndedRef.current = true;
      const url = `/api/lms/lessons/sessions/${sessionIdRef.current}`;
      const payload = JSON.stringify({ endedAt: new Date().toISOString() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // ── Swipe gesture support (left = forward, right = back in the page) ─────────
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Only act on mostly horizontal swipes
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) {
      // Swipe left → navigate forward (next page / mark complete)
    } else {
      // Swipe right → navigate back to lessons list
      onNavigate?.('learning-lessons');
    }
  }, [onNavigate]);

  // ── Mark Complete ────────────────────────────────────────────────────────────
  const handleMarkComplete = useCallback(async () => {
    if (!lessonId || isMarkingComplete || isCompleted) return;
    setIsMarkingComplete(true);
    try {
      const lastBlock = blocks[blocks.length - 1];
      await fetchWithAuth(`/lms/lessons/${lessonId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ blockId: lastBlock?.id }),
      });
      setIsCompleted(true);
      setProgress((prev) => ({
        ...prev,
        blocksCompleted: prev.totalBlocks,
        percentComplete: 100,
      }));
      showSuccess('Lesson marked as complete! Great work! 🎉');
    } catch (err) {
      console.error('[LessonViewerPage] Mark complete failed:', err);
      showError('Failed to mark lesson complete. Please try again.');
    } finally {
      setIsMarkingComplete(false);
    }
  }, [lessonId, blocks, isMarkingComplete, isCompleted, showSuccess, showError]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={36} className="animate-spin text-brand-purple" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading lesson…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{loadError}</p>
        <button type="button" onClick={() => onNavigate?.('learning-lessons')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple/90 transition">
          <ArrowLeft size={14} /> Back to Lessons
        </button>
      </div>
    );
  }

  if (!blocks.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <BookOpen size={40} className="text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
          This lesson has no content yet.
        </p>
        <button type="button" onClick={() => onNavigate?.('learning-lessons')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple/90 transition">
          <ArrowLeft size={14} /> Back to Lessons
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Full lesson — scroll-down layout
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Sticky header: back + title + enterprise Ask AI ── */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate?.('learning-lessons')}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition flex-shrink-0"
              aria-label="Back to lessons"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {lesson?.title || 'Lesson'}
            </h1>
          </div>

          {/* Enterprise: Ask AI button */}
          {isEnterprise && (
            <button
              type="button"
              onClick={() => onNavigate?.('learning-ai-assistant', { lessonId })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-brand-purple text-white text-xs font-semibold hover:opacity-90 transition flex-shrink-0 shadow-sm"
              aria-label="Ask AI assistant about this lesson"
            >
              <Sparkles size={13} />
              Ask AI
            </button>
          )}
        </div>
      </header>

      {/* ── Progress bar ── */}
      <ProgressBar
        completed={progress.blocksCompleted}
        total={progress.totalBlocks}
        lessonTitle={lesson?.title || ''}
      />

      {/* ── All blocks rendered sequentially (scroll-down) ── */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {blocks.map((block) => (
            <BlockCard key={block.id || block.order} block={block} />
          ))}

          {/* ── Mark Complete / Completed state at bottom ── */}
          <div className="flex justify-center pt-4 pb-8">
            {isCompleted ? (
              <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold text-sm">
                <CheckCircle size={18} />
                Lesson Complete!
              </div>
            ) : (
              <button
                type="button"
                onClick={handleMarkComplete}
                disabled={isMarkingComplete}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-purple text-white font-semibold text-sm hover:bg-brand-purple/90 transition disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                {isMarkingComplete ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Mark as Complete
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
