import React from 'react';
import { Bot, BrainCircuit, FileQuestion, Lightbulb, Lock, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';

const insightCards = [
  {
    title: 'Explainable Performance Summary',
    description: 'Will summarize academic patterns only from verified assessment records and visible learner context.',
    icon: BrainCircuit,
  },
  {
    title: 'Intervention Suggestions',
    description: 'Will propose review areas, learner support prompts and follow-up actions with clear source context.',
    icon: Lightbulb,
  },
  {
    title: 'Risk and Growth Narratives',
    description: 'Will translate risk, growth and competency signals into staff-friendly academic notes.',
    icon: Sparkles,
  },
  {
    title: 'Report Drafting Support',
    description: 'Will help draft academic summaries after the AI service and approval flow are connected.',
    icon: FileQuestion,
  },
];

const safetyItems = [
  'AI insights are not active on this page yet.',
  'No synthetic marks, ranks or learner outcomes are generated here.',
  'Future responses must cite the academic data signals used.',
  'Staff review remains required before any learner-facing communication.',
];

const AIInsights = () => (
  <div className="space-y-4 bg-slate-50 p-4 md:p-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Bot size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-indigo-600">Planned AI workspace</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">AI Insights Placeholder</h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
              This workspace is reserved for explainable academic insights after the AI service, permissions and review workflow are connected.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          AI generation is currently disabled.
        </div>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {insightCards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Icon size={19} />
            </div>
            <h3 className="mt-4 text-base font-extrabold text-slate-950">{card.title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">{card.description}</p>
          </div>
        );
      })}
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950">Safe Wording Rules</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Guardrails for the future AI insights workflow.</p>
          </div>
        </div>
        <div className="space-y-2">
          {safetyItems.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              <Lock size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950">Ask TrendSCORE</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">The assistant interface is intentionally inactive until the AI backend is ready.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
          <label htmlFor="ai-insights-placeholder" className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            Question placeholder
          </label>
          <textarea
            id="ai-insights-placeholder"
            disabled
            rows={5}
            value="Ask about academic trends, learner risk or intervention priorities after AI Insights is connected."
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-400 outline-none"
            readOnly
          />
          <button type="button" disabled className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-sm font-black text-slate-500">
            <Bot size={16} />
            Generate unavailable
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default AIInsights;
