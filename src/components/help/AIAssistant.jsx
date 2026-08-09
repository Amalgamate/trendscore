import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bot, Check, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react';
import { aiAPI } from '../../services/api/ai.api';
import { ASK_AI_EVENT } from './AskAIButton';
import './helpDrawers.css';

const makeSessionId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const sessionStorageKey = (userId) => `trendscore:ai-session:${userId}`;

const readSessionId = (userId) => {
  const key = sessionStorageKey(userId);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = makeSessionId();
  localStorage.setItem(key, created);
  return created;
};

const exchangeMessages = (history) => history.flatMap((exchange) => [
  { id: `${exchange.id}:user`, role: 'user', text: exchange.userMessage },
  {
    id: `${exchange.id}:assistant`,
    role: 'assistant',
    text: exchange.response?.message || '',
    pendingConfirmation: exchange.response?.pendingConfirmation,
    data: exchange.response?.data,
  },
]);

// ─── AIAssistantPanel ─────────────────────────────────────────────────────────
// Inline panel body — designed to be embedded as a tab inside ChatPanel.
// No floating button, no fixed positioning — just the content.

export function AIAssistantPanel({ currentPage, user, onNavigate, isActive }) {
  const userId = user?.id || user?.userId || 'anonymous';
  const [sessionId, setSessionId] = useState(() => readSessionId(userId));
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardContext, setCardContext] = useState(null);
  const endRef = useRef(null);
  const route = useMemo(() => `/app/${currentPage || 'dashboard'}`, [currentPage]);

  // Reset session when user changes
  useEffect(() => {
    const next = readSessionId(userId);
    setSessionId(next);
    setMessages([]);
  }, [userId]);

  // Listen for "Ask AI" card context events — auto-populate input
  useEffect(() => {
    const handleContextRequest = (event) => {
      const context = event?.detail || {};
      setCardContext(context);
      setInput(context.suggestedPrompt || 'Help me understand this card.');
    };
    window.addEventListener(ASK_AI_EVENT, handleContextRequest);
    return () => window.removeEventListener(ASK_AI_EVENT, handleContextRequest);
  }, []);

  // Clear card context on page change
  useEffect(() => {
    setCardContext(null);
  }, [currentPage]);

  // Load history when the tab becomes active for the first time
  useEffect(() => {
    if (!isActive || !sessionId || messages.length > 0) return;
    let active = true;
    setHistoryLoading(true);
    aiAPI.getHistory(sessionId)
      .then((response) => {
        if (active) setMessages(exchangeMessages(response?.data || []));
      })
      .catch((err) => { if (active) setError(err?.message || 'Could not load AI history.'); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [isActive, sessionId, messages.length]);

  // Scroll to latest message
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, loading]);

  const appendAssistant = (payload) => {
    if (payload?.sessionId && payload.sessionId !== sessionId) {
      localStorage.setItem(sessionStorageKey(userId), payload.sessionId);
      setSessionId(payload.sessionId);
    }
    setMessages((current) => [...current, {
      id: `assistant:${Date.now()}`,
      role: 'assistant',
      text: payload?.message || 'I could not produce a response.',
      pendingConfirmation: payload?.pendingConfirmation,
      data: payload?.data,
    }]);
  };

  const submit = async (message, confirmationId) => {
    const trimmed = String(message || '').trim();
    if (!trimmed && !confirmationId) return;
    setError('');
    setLoading(true);
    setMessages((current) => [...current, {
      id: `user:${Date.now()}`,
      role: 'user',
      text: confirmationId ? 'Confirm action' : trimmed,
    }]);
    if (!confirmationId) setInput('');
    try {
      const contextBlock = cardContext
        ? [
            'Use this visible card context when answering:',
            `Card: ${cardContext.title || 'Untitled card'}`,
            cardContext.description ? `Description: ${cardContext.description}` : '',
            cardContext.context ? `Structured context: ${cardContext.context}` : '',
            cardContext.visibleText ? `Visible card content: ${cardContext.visibleText}` : '',
            `User question: ${trimmed}`,
          ].filter(Boolean).join('\n')
        : trimmed;
      const response = await aiAPI.chat({
        message: confirmationId ? 'Confirm action' : contextBlock,
        currentRoute: route,
        sessionId,
        confirmationId,
      });
      appendAssistant(response?.data || response);
    } catch (err) {
      setError(err?.message || 'The AI assistant request failed.');
    } finally {
      setLoading(false);
    }
  };

  const cancelConfirmation = (confirmationId) => {
    setMessages((current) => current.map((message) => (
      message.pendingConfirmation?.confirmationId === confirmationId
        ? { ...message, pendingConfirmation: null }
        : message
    )));
  };

  const clearHistory = async () => {
    try {
      await aiAPI.archiveHistory(sessionId);
      const next = makeSessionId();
      localStorage.setItem(sessionStorageKey(userId), next);
      setSessionId(next);
      setMessages([]);
      setError('');
    } catch (err) {
      setError(err?.message || 'Could not clear AI history.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Sub-header */}
      <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-violet-700 p-1.5 text-white"><Bot size={15} /></span>
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-900">TrendSCORE AI</p>
            <p className="max-w-48 truncate text-[10px] text-slate-500">
              Context: {cardContext?.title || currentPage || 'dashboard'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-rose-600 transition-colors"
          title="Clear AI history"
          aria-label="Clear AI history"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Card context banner */}
      {cardContext && (
        <div className="flex items-center gap-2 border-b border-violet-100 bg-white px-3 py-2 text-[10px] text-violet-700">
          <Sparkles size={12} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            Asking about: <strong>{cardContext.title}</strong>
          </span>
          <button
            type="button"
            onClick={() => { setCardContext(null); setInput(''); }}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Clear card context"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar">
        {historyLoading && (
          <div className="flex items-center justify-center py-8 text-xs text-slate-500">
            <Loader2 size={15} className="mr-2 animate-spin" /> Loading history…
          </div>
        )}
        {!historyLoading && messages.length === 0 && (
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-relaxed text-slate-600">
            Ask about the current page, any data card, or anything in the system. I have secure access to fees, attendance, assessments, learners, messages, library, staff, reports, and AI Pathways — all in one conversation.
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={message.role === 'user' ? 'ml-8' : 'mr-8'}>
            <div className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed ${
              message.role === 'user'
                ? 'bg-violet-700 text-white'
                : 'border border-slate-200 bg-slate-50 text-slate-700'
            }`}>
              {message.text}
            </div>

            {/* Navigation action */}
            {message.role === 'assistant' && message.data?.navigation?.page && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(message.data.navigation.page, message.data.navigation.params || {})}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-black text-violet-700 hover:bg-violet-100"
              >
                {message.data.navigation.label || 'Open page'} <ArrowRight size={12} />
              </button>
            )}

            {/* Confirmation prompt */}
            {message.pendingConfirmation && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-black text-amber-900">
                  {message.pendingConfirmation.details?.title || 'Confirm action'}
                </p>
                <p className="mt-1 text-[11px] text-amber-800">
                  {message.pendingConfirmation.details?.summary}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-amber-800">
                  {(message.pendingConfirmation.details?.consequences || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => submit('Confirm action', message.pendingConfirmation.confirmationId)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-50"
                  >
                    <Check size={12} /> Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelConfirmation(message.pendingConfirmation.confirmationId)}
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-[10px] font-black text-amber-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="mr-8 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Loader2 size={14} className="mr-2 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Error bar */}
      {error && (
        <p className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </p>
      )}

      {/* Composer */}
      <form
        onSubmit={(event) => { event.preventDefault(); submit(input); }}
        className="flex gap-2 border-t border-slate-200 p-3"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit(input);
            }
          }}
          rows={2}
          placeholder={cardContext ? `Ask about ${cardContext.title}…` : 'Ask about this page…'}
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-violet-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="self-end rounded-xl bg-violet-700 p-3 text-white disabled:opacity-40 hover:bg-violet-800 transition-colors"
          aria-label="Send to TrendSCORE AI"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

// ─── AIAssistant ──────────────────────────────────────────────────────────────
// Legacy default export kept for compatibility.
// Now it simply dispatches the ASK_AI_EVENT to open the chat panel on the AI tab.
// The old standalone floating button is retired.

export default function AIAssistant({ currentPage, user, onNavigate }) {
  // Wire "Ask AI" card events so the chat FAB opens on the AI tab.
  // The actual panel is rendered inside ChatPanel as a tab.
  // This component no longer renders any UI of its own.
  useEffect(() => {
    const handleContextRequest = (event) => {
      // Re-dispatch a custom event that Header.jsx listens for to switch to the AI tab
      window.dispatchEvent(new CustomEvent('trendscore:open-ai-tab', { detail: event?.detail || {} }));
    };
    window.addEventListener(ASK_AI_EVENT, handleContextRequest);
    return () => window.removeEventListener(ASK_AI_EVENT, handleContextRequest);
  }, []);

  return null;
}
