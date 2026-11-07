import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Bus, CalendarDays, CreditCard, HelpCircle, Inbox, MessageCircle, Send, X } from 'lucide-react';

const HELP_TOPICS = [
  {
    id: 'fees', label: 'Fees & payments', icon: CreditCard,
    question: 'How do I check my child’s fee balance?',
    answer: 'Open School Fees to review invoices, payments and the outstanding balance. Open an invoice to see its details and available payment options.',
    keywords: ['fee', 'fees', 'balance', 'pay', 'payment', 'invoice', 'mpesa', 'm-pesa'],
    page: 'parent-portal-fees', action: 'Open school fees',
  },
  {
    id: 'diary', label: 'Diary & homework', icon: BookOpen,
    question: 'Where can I read the diary and check homework?',
    answer: 'Open Diary & Homework to see work issued to your child, due dates, submission status and any feedback released by the teacher.',
    keywords: ['diary', 'homework', 'assignment', 'work', 'teacher', 'feedback', 'due'],
    page: 'parent-portal-homework', action: 'Open Diary & Homework',
  },
  {
    id: 'attendance', label: 'Attendance & schedule', icon: CalendarDays,
    question: 'How can I check attendance?',
    answer: 'Open School Today for attendance and schedule updates. Attendance records are also available from your child’s profile.',
    keywords: ['attendance', 'absent', 'present', 'late', 'schedule', 'timetable', 'school today'],
    page: 'parent-portal-school-today', action: 'Open School Today',
  },
  {
    id: 'transport', label: 'Transport', icon: Bus,
    question: 'Where can I find transport information?',
    answer: 'Open Transport to view transport information shared by the school.',
    keywords: ['transport', 'bus', 'route', 'vehicle'],
    page: 'parent-portal-transport', action: 'Open transport',
  },
];

function findAnswer(query) {
  const normalized = query.toLowerCase();
  const ranked = HELP_TOPICS.map(topic => ({
    topic,
    score: topic.keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return ranked[0]?.score ? ranked.filter(item => item.score === ranked[0].score).slice(0, 2).map(item => item.topic) : [];
}

export default function ParentHelpChat({ onNavigate, hasBottomNav = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const choices = useMemo(() => HELP_TOPICS, []);

  const ask = (text) => {
    const answers = findAnswer(text);
    setMessages(current => [...current, {
      id: `${Date.now()}-${Math.random()}`,
      question: text,
      answers,
    }]);
    setQuery('');
  };

  return (
    <>
      {open && <section
        className="fixed right-3 z-[90] flex max-h-[min(70dvh,540px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{ bottom: hasBottomNav ? 'calc(9rem + env(safe-area-inset-bottom, 0px))' : 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        role="dialog"
        aria-label="Parent help chat"
      >
        <header className="flex items-center gap-3 bg-indigo-800 px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><HelpCircle size={19} /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">Parent help</h2><p className="text-[11px] text-indigo-100">Ask about school services or find an answer</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close parent help" className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <div className="mr-5 rounded-xl rounded-tl-sm bg-slate-100 p-3 text-xs leading-relaxed text-slate-800">Hello! What would you like help with today? Choose a topic or ask a question. I can find common answers, or help you contact the school.</div>
          {messages.map(message => <div key={message.id} className="space-y-2">
            <div className="ml-8 rounded-xl rounded-tr-sm bg-indigo-700 p-2.5 text-xs text-white">{message.question}</div>
            {message.answers.length ? message.answers.map(topic => <div key={topic.id} className="mr-5 rounded-xl rounded-tl-sm border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800">
              <p>{topic.answer}</p>
              <button type="button" onClick={() => onNavigate?.(topic.page)} className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-lg bg-indigo-800 px-2.5 py-1.5 font-bold text-white">{topic.action}<ArrowRight size={13} /></button>
            </div>) : <div className="mr-5 rounded-xl rounded-tl-sm bg-amber-50 p-3 text-xs leading-relaxed text-slate-800">I couldn’t find a confident answer for that. Send your question to the school and follow the reply in Support.
              <button type="button" onClick={() => onNavigate?.('parent-portal-support')} className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-lg bg-indigo-800 px-2.5 py-1.5 font-bold text-white">Ask the school<ArrowRight size={13} /></button>
            </div>}
          </div>)}

          {messages.length === 0 && <div className="grid grid-cols-2 gap-2">
            {choices.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => ask(label)} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] font-bold text-slate-800 hover:bg-indigo-50"><Icon size={16} className="shrink-0 text-indigo-800" />{label}</button>)}
            <button type="button" onClick={() => onNavigate?.('parent-portal-support')} className="col-span-2 flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200"><MessageCircle size={16} />Ask the school</button>
          </div>}
        </div>

        <form onSubmit={event => { event.preventDefault(); if (query.trim()) ask(query.trim()); }} className="flex items-center gap-2 border-t border-slate-200 p-2.5">
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Ask a school question…" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-xs text-slate-900 outline-none focus:border-indigo-700" />
          <button type="submit" disabled={!query.trim()} aria-label="Send question" className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-800 text-white disabled:opacity-40"><Send size={16} /></button>
        </form>
      </section>}

      <div
        className="fixed inset-x-0 z-[90] grid w-full grid-cols-2 grid-rows-1 items-stretch border-t border-slate-200 bg-white p-0"
        style={{
          bottom: hasBottomNav ? 'calc(4rem + env(safe-area-inset-bottom, 0px))' : '0px',
          height: hasBottomNav ? '4.25rem' : 'calc(4.25rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <button type="button" onClick={() => onNavigate?.('parent-portal-communication')} aria-label="Open school inbox" className="inline-flex h-full w-full items-center justify-center gap-2 border-r border-white/20 bg-blue-700 px-4 text-sm font-extrabold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200">
          <Inbox size={20} /> Inbox
        </button>
        <button type="button" onClick={() => setOpen(value => !value)} aria-label={open ? 'Close parent help chat' : 'Open parent help chat'} aria-expanded={open} className="inline-flex h-full w-full items-center justify-center gap-2 bg-indigo-800 px-4 text-sm font-extrabold text-white hover:bg-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-200">
          {open ? <X size={20} /> : <MessageCircle size={20} />}{open ? 'Close' : 'Chat'}
        </button>
      </div>
    </>
  );
}
