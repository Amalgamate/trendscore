import React from 'react';
import { Inbox, Sparkles } from 'lucide-react';
import { useChat } from '../../../../contexts/ChatContext';

/** Parent-wide communication actions. Messages live in Inbox; AI help is separate. */
export default function ParentCommunicationActions({ onNavigate }) {
  const { unreadTotal = 0 } = useChat();
  const openAssistant = () => window.dispatchEvent(new CustomEvent('trendscore:open-ai-tab'));

  return (
    <nav
      aria-label="Parent communication"
      className="fixed inset-x-0 z-[90] grid w-full grid-cols-2 items-stretch border-t border-slate-200 bg-white p-0"
      style={{ bottom: 0, height: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <button
        type="button"
        onClick={() => onNavigate?.('parent-portal-communication')}
        className="relative inline-flex h-full w-full items-center justify-center gap-2 border-r border-white/20 bg-blue-700 px-4 text-sm font-extrabold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200"
      >
        <Inbox size={20} /> Inbox
        {unreadTotal > 0 && <span className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-blue-800">{unreadTotal > 99 ? '99+' : unreadTotal}</span>}
      </button>
      <button
        type="button"
        onClick={openAssistant}
        className="inline-flex h-full w-full items-center justify-center gap-2 bg-indigo-800 px-4 text-sm font-extrabold text-white hover:bg-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-200"
      >
        <Sparkles size={20} /> Assistant
      </button>
    </nav>
  );
}
