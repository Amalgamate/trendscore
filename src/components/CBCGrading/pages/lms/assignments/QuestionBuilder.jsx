import React from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';

const TYPES = [
  ['MULTIPLE_CHOICE', 'Multiple choice'],
  ['TRUE_FALSE', 'True / False'],
  ['SHORT_ANSWER', 'Short answer'],
  ['ESSAY', 'Essay / long answer'],
];

const createQuestion = () => ({
  id: window.crypto?.randomUUID?.() || `question-${Date.now()}`,
  type: 'MULTIPLE_CHOICE',
  prompt: '',
  marks: 1,
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
});

export default function QuestionBuilder({ questions = [], onChange }) {
  const update = (index, patch) => onChange(questions.map((question, position) => (
    position === index ? { ...question, ...patch } : question
  )));
  const add = () => onChange([...questions, createQuestion()]);
  const remove = (index) => onChange(questions.filter((_, position) => position !== index));
  const duplicate = (index) => {
    const copy = { ...questions[index], id: createQuestion().id, options: [...(questions[index].options || [])] };
    onChange([...questions.slice(0, index + 1), copy, ...questions.slice(index + 1)]);
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-950 dark:text-white">Questions</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create and edit the questions students will answer.</p>
        </div>
        <button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white">
          <Plus size={16} /> Add Question
        </button>
      </div>

      {questions.length === 0 ? (
        <button type="button" onClick={add} className="w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-10 text-sm font-semibold text-gray-500 hover:border-brand-purple hover:text-brand-purple dark:border-gray-600">
          Add the first question
        </button>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <article key={question.id || index} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white">Question {index + 1}</span>
                <div className="ml-auto flex gap-1">
                  <button type="button" aria-label={`Duplicate question ${index + 1}`} onClick={() => duplicate(index)} className="rounded p-2 text-gray-500 hover:bg-white"><Copy size={16} /></button>
                  <button type="button" aria-label={`Delete question ${index + 1}`} onClick={() => remove(index)} className="rounded p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_100px]">
                <textarea value={question.prompt || ''} onChange={(event) => update(index, { prompt: event.target.value })} rows={2} placeholder="Write the question…" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                <select value={question.type || 'MULTIPLE_CHOICE'} onChange={(event) => update(index, { type: event.target.value, correctAnswer: '' })} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input type="number" min="0" step="0.5" value={question.marks ?? 1} onChange={(event) => update(index, { marks: Number(event.target.value) })} aria-label={`Marks for question ${index + 1}`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              {question.type === 'MULTIPLE_CHOICE' && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(question.options || ['', '', '', '']).map((option, optionIndex) => (
                    <label key={optionIndex} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${question.id || index}`} checked={question.correctAnswer === optionIndex} onChange={() => update(index, { correctAnswer: optionIndex })} />
                      <input value={option} onChange={(event) => {
                        const options = [...(question.options || [])];
                        options[optionIndex] = event.target.value;
                        update(index, { options });
                      }} placeholder={`Option ${optionIndex + 1}`} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                    </label>
                  ))}
                </div>
              )}
              {question.type === 'TRUE_FALSE' && (
                <div className="mt-3 flex gap-5 text-sm">
                  {['true', 'false'].map((answer) => (
                    <label key={answer} className="flex items-center gap-2 capitalize">
                      <input type="radio" name={`correct-${question.id || index}`} checked={question.correctAnswer === answer} onChange={() => update(index, { correctAnswer: answer })} />{answer}
                    </label>
                  ))}
                </div>
              )}
              {question.type === 'SHORT_ANSWER' && (
                <input value={question.correctAnswer || ''} onChange={(event) => update(index, { correctAnswer: event.target.value })} placeholder="Accepted answer for automarking" className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              )}
              <input value={question.explanation || ''} onChange={(event) => update(index, { explanation: event.target.value })} placeholder="Feedback shown after marking (optional)" className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
