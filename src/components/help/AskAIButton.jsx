import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

export const ASK_AI_EVENT = 'trendscore:ask-ai';

const cleanText = (value, limit = 2400) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/Ask AI/gi, '')
  .trim()
  .slice(0, limit);

const serializeContext = (context) => {
  if (!context) return '';
  if (typeof context === 'string') return cleanText(context);
  try {
    return cleanText(JSON.stringify(context));
  } catch {
    return cleanText(context);
  }
};

export const openAIWithContext = ({ title, description, context, visibleText } = {}) => {
  if (typeof window === 'undefined') return;
  const safeTitle = cleanText(title, 160) || 'this card';
  window.dispatchEvent(new CustomEvent(ASK_AI_EVENT, {
    detail: {
      title: safeTitle,
      description: cleanText(description, 320),
      context: serializeContext(context),
      visibleText: cleanText(visibleText),
      suggestedPrompt: `What should I know about ${safeTitle}?`,
    },
  }));
};

export default function AskAIButton({
  title,
  description,
  context,
  variant = 'default',
  className = '',
}) {
  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const card = event.currentTarget.closest('[data-ai-card="true"]');
    openAIWithContext({
      title,
      description,
      context,
      visibleText: card?.innerText || card?.textContent || '',
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1',
        variant === 'light'
          ? 'border border-white/35 bg-white/15 text-white hover:bg-white/25'
          : 'border border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100',
        className,
      )}
      aria-label={`Ask AI about ${title || 'this card'}`}
      title={`Ask AI about ${title || 'this card'}`}
    >
      <Sparkles size={12} aria-hidden="true" />
      <span className="hidden sm:inline">Ask AI</span>
    </button>
  );
}
