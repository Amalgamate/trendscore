/**
 * LessonBlockEditor — Interactive Block-Based Lesson Editor
 * 
 * - Drag-to-reorder blocks using @dnd-kit
 * - Add new blocks from 20 types
 * - Per-block editor for each content type
 * - Auto-save every 30 seconds via PUT /api/lms/lessons/:id/blocks
 * 
 * Requirements: 6.2, 6.4, 18.8, 25.5
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  GripVertical,
  ChevronDown,
  Loader,
} from 'lucide-react';
import { lmsAPI } from '../../../../../services/api/lms.api';
import FileUploadEditor from '../shared/FileUploadEditor';

const BLOCK_TYPES = [
  { type: 'HEADING', label: 'Heading', icon: '📝' },
  { type: 'PARAGRAPH', label: 'Paragraph', icon: '📄' },
  { type: 'IMAGE', label: 'Image', icon: '🖼️' },
  { type: 'GALLERY', label: 'Gallery', icon: '🎞️' },
  { type: 'VIDEO', label: 'Video', icon: '🎬' },
  { type: 'AUDIO', label: 'Audio', icon: '🎵' },
  { type: 'QUIZ', label: 'Quiz', icon: '❓' },
  { type: 'FLASHCARDS', label: 'Flashcards', icon: '📚' },
  { type: 'TIMELINE', label: 'Timeline', icon: '📊' },
  { type: 'ACCORDION', label: 'Accordion', icon: '📂' },
  { type: 'TABLE', label: 'Table', icon: '📋' },
  { type: 'DIAGRAM', label: 'Diagram', icon: '📐' },
  { type: 'CODE', label: 'Code', icon: '💻' },
  { type: 'FORMULA', label: 'Formula', icon: '∫' },
  { type: 'PDF', label: 'PDF', icon: '📑' },
  { type: 'ASSIGNMENT', label: 'Assignment', icon: '✏️' },
  { type: 'DISCUSSION', label: 'Discussion', icon: '💬' },
  { type: 'REFLECTION', label: 'Reflection', icon: '💭' },
  { type: 'TEACHER_NOTES', label: 'Teacher Notes', icon: '👨‍🏫' },
  { type: 'PRACTICE_QUESTIONS', label: 'Practice Questions', icon: '🧩' },
];

// ─── Block Type Editors ───────────────────────────────────────────────────

function TextBlockEditor({ block, onChange }) {
  return (
    <textarea
      value={block.content?.text || ''}
      onChange={(e) =>
        onChange({ ...block, content: { ...block.content, text: e.target.value } })
      }
      placeholder="Enter text content..."
      rows={3}
      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7900]"
    />
  );
}

function UrlBlockEditor({ block, onChange, label = 'URL' }) {
  return <FileUploadEditor block={block} onChange={onChange} label={label} />;
}

// QuizBlockEditor — builds real multiple-choice questions with a marked
// correct answer, matching the shape the student QuizBlock viewer expects:
// { questions: [{ question, choices: [...], correctIndex }] }
function QuizBlockEditor({ block, onChange }) {
  const questions = block.content?.questions || [];

  const commit = (updated) => {
    onChange({ ...block, content: { ...block.content, questions: updated } });
  };

  const handleAddQuestion = () => {
    commit([...questions, { question: '', choices: ['', ''], correctIndex: 0 }]);
  };

  const handleRemoveQuestion = (qIdx) => {
    commit(questions.filter((_, i) => i !== qIdx));
  };

  const handleQuestionText = (qIdx, text) => {
    const updated = questions.map((q, i) => (i === qIdx ? { ...q, question: text } : q));
    commit(updated);
  };

  const handleChoiceText = (qIdx, cIdx, text) => {
    const updated = questions.map((q, i) => {
      if (i !== qIdx) return q;
      const choices = [...(q.choices || [])];
      choices[cIdx] = text;
      return { ...q, choices };
    });
    commit(updated);
  };

  const handleAddChoice = (qIdx) => {
    const updated = questions.map((q, i) =>
      i === qIdx ? { ...q, choices: [...(q.choices || []), ''] } : q,
    );
    commit(updated);
  };

  const handleRemoveChoice = (qIdx, cIdx) => {
    const updated = questions.map((q, i) => {
      if (i !== qIdx) return q;
      const choices = (q.choices || []).filter((_, idx) => idx !== cIdx);
      let correctIndex = q.correctIndex ?? 0;
      if (correctIndex === cIdx) correctIndex = 0;
      else if (correctIndex > cIdx) correctIndex -= 1;
      return { ...q, choices, correctIndex };
    });
    commit(updated);
  };

  const handleSetCorrect = (qIdx, cIdx) => {
    const updated = questions.map((q, i) => (i === qIdx ? { ...q, correctIndex: cIdx } : q));
    commit(updated);
  };

  return (
    <div className="space-y-4">
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={q.question || ''}
              onChange={(e) => handleQuestionText(qIdx, e.target.value)}
              placeholder={`Question ${qIdx + 1}`}
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm font-medium"
            />
            <button
              onClick={() => handleRemoveQuestion(qIdx)}
              className="p-1.5 rounded hover:bg-rose-100 text-rose-600 flex-shrink-0"
              title="Remove question"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="space-y-1.5 pl-1">
            <p className="text-xs text-slate-500 font-medium">Choices (select the correct one)</p>
            {(q.choices || []).map((choice, cIdx) => (
              <div key={cIdx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`quiz-${block.id}-correct-${qIdx}`}
                  checked={(q.correctIndex ?? 0) === cIdx}
                  onChange={() => handleSetCorrect(qIdx, cIdx)}
                  className="flex-shrink-0 accent-[#ff7900]"
                  title="Mark as correct answer"
                />
                <input
                  type="text"
                  value={choice}
                  onChange={(e) => handleChoiceText(qIdx, cIdx, e.target.value)}
                  placeholder={`Choice ${cIdx + 1}`}
                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                />
                <button
                  onClick={() => handleRemoveChoice(qIdx, cIdx)}
                  disabled={(q.choices || []).length <= 2}
                  className="p-1 rounded hover:bg-rose-100 text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                  title="Remove choice"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => handleAddChoice(qIdx)}
              className="text-xs text-[#ff7900] hover:text-[#ff7900]/80 font-medium"
            >
              + Add Choice
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={handleAddQuestion}
        className="text-sm text-[#ff7900] hover:text-[#ff7900]/80 font-medium"
      >
        + Add Question
      </button>
    </div>
  );
}

// PracticeQuestionsBlockEditor — question + free-text answer pairs, matching
// the student PracticeQuestionsBlock accordion viewer: { question, answer }
function PracticeQuestionsBlockEditor({ block, onChange }) {
  const questions = block.content?.questions || [];

  const commit = (updated) => {
    onChange({ ...block, content: { ...block.content, questions: updated } });
  };

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={i} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={q.question || ''}
              onChange={(e) => {
                const updated = questions.map((item, idx) =>
                  idx === i ? { ...item, question: e.target.value } : item,
                );
                commit(updated);
              }}
              placeholder={`Question ${i + 1}`}
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm font-medium"
            />
            <button
              onClick={() => commit(questions.filter((_, idx) => idx !== i))}
              className="p-1.5 rounded hover:bg-rose-100 text-rose-600 flex-shrink-0"
              title="Remove question"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            value={q.answer || ''}
            onChange={(e) => {
              const updated = questions.map((item, idx) =>
                idx === i ? { ...item, answer: e.target.value } : item,
              );
              commit(updated);
            }}
            placeholder="Answer (shown when student expands the question)"
            rows={2}
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
          />
        </div>
      ))}
      <button
        onClick={() => commit([...questions, { question: '', answer: '' }])}
        className="text-sm text-[#ff7900] hover:text-[#ff7900]/80 font-medium"
      >
        + Add Question
      </button>
    </div>
  );
}

// GalleryBlockEditor — a list of uploaded images with optional captions,
// matching { images: [{ url, caption }] }
function GalleryBlockEditor({ block, onChange }) {
  const images = block.content?.images || [];

  const commit = (updated) => {
    onChange({ ...block, content: { ...block.content, images: updated } });
  };

  return (
    <div className="space-y-3">
      {images.map((img, idx) => (
        <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Image {idx + 1}</p>
            <button
              onClick={() => commit(images.filter((_, i) => i !== idx))}
              className="p-1 rounded hover:bg-rose-100 text-rose-600"
              title="Remove image"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <FileUploadEditor
            block={{ content: { url: img.url } }}
            onChange={(updated) => {
              const url = updated.content?.url || '';
              commit(images.map((item, i) => (i === idx ? { ...item, url } : item)));
            }}
            label="Image"
            acceptTypes="image/*"
          />
          <input
            type="text"
            value={img.caption || ''}
            onChange={(e) => {
              const caption = e.target.value;
              commit(images.map((item, i) => (i === idx ? { ...item, caption } : item)));
            }}
            placeholder="Caption (optional)"
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
          />
        </div>
      ))}
      <button
        onClick={() => commit([...images, { url: '', caption: '' }])}
        className="text-sm text-[#ff7900] hover:text-[#ff7900]/80 font-medium"
      >
        + Add Image
      </button>
    </div>
  );
}

// TimelineBlockEditor — ordered events, matching { events: [{ date, title, description }] }
function TimelineBlockEditor({ block, onChange }) {
  const events = block.content?.events || [];

  const commit = (updated) => {
    onChange({ ...block, content: { ...block.content, events: updated } });
  };

  return (
    <div className="space-y-3">
      {events.map((ev, idx) => (
        <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={ev.date || ''}
              onChange={(e) => {
                const date = e.target.value;
                commit(events.map((item, i) => (i === idx ? { ...item, date } : item)));
              }}
              placeholder="Date / period (e.g. 1963)"
              className="w-32 flex-shrink-0 px-2 py-1.5 border border-slate-200 rounded text-sm"
            />
            <input
              type="text"
              value={ev.title || ''}
              onChange={(e) => {
                const title = e.target.value;
                commit(events.map((item, i) => (i === idx ? { ...item, title } : item)));
              }}
              placeholder="Event title"
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm font-medium"
            />
            <button
              onClick={() => commit(events.filter((_, i) => i !== idx))}
              className="p-1.5 rounded hover:bg-rose-100 text-rose-600 flex-shrink-0"
              title="Remove event"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            value={ev.description || ''}
            onChange={(e) => {
              const description = e.target.value;
              commit(events.map((item, i) => (i === idx ? { ...item, description } : item)));
            }}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
          />
        </div>
      ))}
      <button
        onClick={() => commit([...events, { date: '', title: '', description: '' }])}
        className="text-sm text-[#ff7900] hover:text-[#ff7900]/80 font-medium"
      >
        + Add Event
      </button>
    </div>
  );
}

// AccordionBlockEditor — collapsible sections, matching { items: [{ title, content }] }
function AccordionBlockEditor({ block, onChange }) {
  const items = block.content?.items || [];

  const commit = (updated) => {
    onChange({ ...block, content: { ...block.content, items: updated } });
  };

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={item.title || ''}
              onChange={(e) => {
                const title = e.target.value;
                commit(items.map((it, i) => (i === idx ? { ...it, title } : it)));
              }}
              placeholder={`Section ${idx + 1} title`}
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm font-medium"
            />
            <button
              onClick={() => commit(items.filter((_, i) => i !== idx))}
              className="p-1.5 rounded hover:bg-rose-100 text-rose-600 flex-shrink-0"
              title="Remove section"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            value={item.content || ''}
            onChange={(e) => {
              const content = e.target.value;
              commit(items.map((it, i) => (i === idx ? { ...it, content } : it)));
            }}
            placeholder="Section content"
            rows={2}
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
          />
        </div>
      ))}
      <button
        onClick={() => commit([...items, { title: '', content: '' }])}
        className="text-sm text-[#ff7900] hover:text-[#ff7900]/80 font-medium"
      >
        + Add Section
      </button>
    </div>
  );
}

// TableBlockEditor — simple grid editor, matching { headers: [...], rows: [[...]] }
function TableBlockEditor({ block, onChange }) {
  const headers = block.content?.headers || ['Column 1', 'Column 2'];
  const rows = block.content?.rows || [['', '']];

  const commit = (updatedHeaders, updatedRows) => {
    onChange({ ...block, content: { ...block.content, headers: updatedHeaders, rows: updatedRows } });
  };

  const handleHeaderChange = (colIdx, text) => {
    commit(headers.map((h, i) => (i === colIdx ? text : h)), rows);
  };

  const handleCellChange = (rowIdx, colIdx, text) => {
    const updatedRows = rows.map((row, r) =>
      r === rowIdx ? row.map((cell, c) => (c === colIdx ? text : cell)) : row,
    );
    commit(headers, updatedRows);
  };

  const handleAddColumn = () => {
    const updatedHeaders = [...headers, `Column ${headers.length + 1}`];
    const updatedRows = rows.map((row) => [...row, '']);
    commit(updatedHeaders, updatedRows);
  };

  const handleRemoveColumn = (colIdx) => {
    const updatedHeaders = headers.filter((_, i) => i !== colIdx);
    const updatedRows = rows.map((row) => row.filter((_, i) => i !== colIdx));
    commit(updatedHeaders, updatedRows);
  };

  const handleAddRow = () => {
    commit(headers, [...rows, headers.map(() => '')]);
  };

  const handleRemoveRow = (rowIdx) => {
    commit(headers, rows.filter((_, i) => i !== rowIdx));
  };

  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((h, colIdx) => (
              <th key={colIdx} className="border border-slate-200 p-1">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                    className="flex-1 px-1.5 py-1 border border-slate-200 rounded text-xs font-semibold min-w-[80px]"
                  />
                  <button
                    onClick={() => handleRemoveColumn(colIdx)}
                    disabled={headers.length <= 1}
                    className="p-0.5 rounded hover:bg-rose-100 text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                    title="Remove column"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </th>
            ))}
            <th className="border border-slate-200 p-1 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, colIdx) => (
                <td key={colIdx} className="border border-slate-200 p-1">
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                    className="w-full px-1.5 py-1 border-none text-xs min-w-[80px]"
                  />
                </td>
              ))}
              <td className="border border-slate-200 p-1 text-center">
                <button
                  onClick={() => handleRemoveRow(rowIdx)}
                  disabled={rows.length <= 1}
                  className="p-0.5 rounded hover:bg-rose-100 text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Remove row"
                >
                  <Trash2 size={10} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3">
        <button onClick={handleAddRow} className="text-xs text-[#ff7900] hover:text-[#ff7900]/80 font-medium">
          + Add Row
        </button>
        <button onClick={handleAddColumn} className="text-xs text-[#ff7900] hover:text-[#ff7900]/80 font-medium">
          + Add Column
        </button>
      </div>
    </div>
  );
}

// FlashcardsBlockEditor — front/back card pairs, matching { cards: [{ front, back }] }
function FlashcardsBlockEditor({ block, onChange }) {
  const cards = block.content?.cards || [];

  const commit = (updated) => {
    onChange({ ...block, content: { ...block.content, cards: updated } });
  };

  return (
    <div className="space-y-3">
      {cards.map((card, idx) => (
        <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Card {idx + 1}</p>
            <button
              onClick={() => commit(cards.filter((_, i) => i !== idx))}
              className="p-1 rounded hover:bg-rose-100 text-rose-600"
              title="Remove card"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Front</p>
              <textarea
                value={card.front || ''}
                onChange={(e) => {
                  const front = e.target.value;
                  commit(cards.map((c, i) => (i === idx ? { ...c, front } : c)));
                }}
                placeholder="Question or term"
                rows={2}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Back</p>
              <textarea
                value={card.back || ''}
                onChange={(e) => {
                  const back = e.target.value;
                  commit(cards.map((c, i) => (i === idx ? { ...c, back } : c)));
                }}
                placeholder="Answer or definition"
                rows={2}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={() => commit([...cards, { front: '', back: '' }])}
        className="text-sm text-[#ff7900] hover:text-[#ff7900]/80 font-medium"
      >
        + Add Card
      </button>
    </div>
  );
}

function CodeBlockEditor({ block, onChange }) {
  const [language, setLanguage] = useState(block.content?.language || 'python');

  return (
    <div className="space-y-2">
      <select
        value={language}
        onChange={(e) => {
          setLanguage(e.target.value);
          onChange({ ...block, content: { ...block.content, language: e.target.value } });
        }}
        className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
      >
        <option value="python">Python</option>
        <option value="javascript">JavaScript</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
        <option value="html">HTML</option>
      </select>
      <textarea
        value={block.content?.code || ''}
        onChange={(e) =>
          onChange({ ...block, content: { ...block.content, code: e.target.value } })
        }
        placeholder="Enter code..."
        rows={4}
        className="w-full px-2 py-1 border border-slate-200 rounded font-mono text-sm"
      />
    </div>
  );
}

// ─── Block Render Helper ───────────────────────────────────────────────────

function BlockEditor({ block, onChange }) {
  const type = block.type;

  switch (type) {
    case 'HEADING':
    case 'PARAGRAPH':
    case 'TEACHER_NOTES':
    case 'REFLECTION':
    case 'DISCUSSION':
      return <TextBlockEditor block={block} onChange={onChange} />;

    case 'IMAGE':
    case 'DIAGRAM':
    case 'PDF':
    case 'VIDEO':
    case 'AUDIO':
      return <UrlBlockEditor block={block} onChange={onChange} />;

    case 'QUIZ':
      return <QuizBlockEditor block={block} onChange={onChange} />;

    case 'PRACTICE_QUESTIONS':
      return <PracticeQuestionsBlockEditor block={block} onChange={onChange} />;

    case 'CODE':
      return <CodeBlockEditor block={block} onChange={onChange} />;

    case 'FORMULA':
      return (
        <input
          type="text"
          value={block.content?.latex || ''}
          onChange={(e) =>
            onChange({ ...block, content: { ...block.content, latex: e.target.value } })
          }
          placeholder="Enter LaTeX formula..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7900]"
        />
      );

    case 'FLASHCARDS':
      return <FlashcardsBlockEditor block={block} onChange={onChange} />;

    case 'GALLERY':
      return <GalleryBlockEditor block={block} onChange={onChange} />;

    case 'TIMELINE':
      return <TimelineBlockEditor block={block} onChange={onChange} />;

    case 'ACCORDION':
      return <AccordionBlockEditor block={block} onChange={onChange} />;

    case 'TABLE':
      return <TableBlockEditor block={block} onChange={onChange} />;

    case 'ASSIGNMENT':
      return (
        <input
          type="text"
          value={block.content?.assignmentId || ''}
          onChange={(e) =>
            onChange({ ...block, content: { ...block.content, assignmentId: e.target.value } })
          }
          placeholder="Enter assignment ID..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7900]"
        />
      );

    default:
      return (
        <div className="p-3 bg-gray-100 text-center text-sm text-gray-600">
          No editor for {type}
        </div>
      );
  }
}

const isTemporaryBlockId = (id) => (
  typeof id === 'string' && (id.startsWith('new-') || id.startsWith('dup-') || id.startsWith('assignment-'))
);

const normalizeBlocksForSave = (blocks) => blocks.map((block, index) => {
  const normalized = {
    type: block.type,
    order: index + 1,
    content: block.content || {},
  };
  if (block.id && !isTemporaryBlockId(block.id)) {
    normalized.id = block.id;
  }
  return normalized;
});

// ─── Main Block Editor Component ───────────────────────────────────────────

export default function LessonBlockEditor({ lessonId, blocks, onBlocksUpdate }) {
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    setLocalBlocks(blocks || []);
  }, [blocks]);

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (lessonId && localBlocks.length > 0) {
        setSaving(true);
        lmsAPI
          .upsertLessonBlocks?.(lessonId, normalizeBlocksForSave(localBlocks))
          .then(() => {
            setSaving(false);
          })
          .catch(() => {
            setSaving(false);
          });
      }
    }, 30000);

    return () => clearInterval(autoSaveTimer.current);
  }, [lessonId, localBlocks]);

  const handleAddBlock = (type) => {
    const newBlock = {
      id: `new-${Date.now()}`,
      type,
      order: localBlocks.length + 1,
      content: {},
    };
    const updated = [...localBlocks, newBlock];
    setLocalBlocks(updated);
    onBlocksUpdate?.(updated);
    setShowAddMenu(false);
  };

  const handleUpdateBlock = (id, updatedBlock) => {
    const updated = localBlocks.map((b) => (b.id === id ? updatedBlock : b));
    setLocalBlocks(updated);
    onBlocksUpdate?.(updated);
  };

  const handleDeleteBlock = (id) => {
    const updated = localBlocks
      .filter((b) => b.id !== id)
      .map((block, index) => ({ ...block, order: index + 1 }));
    setLocalBlocks(updated);
    onBlocksUpdate?.(updated);
  };

  const handleDuplicateBlock = (id) => {
    const block = localBlocks.find((b) => b.id === id);
    if (block) {
      const newBlock = {
        ...block,
        id: `dup-${Date.now()}`,
        order: Math.max(...localBlocks.map((b) => b.order)) + 1,
      };
      const updated = [...localBlocks, newBlock];
      setLocalBlocks(updated);
      onBlocksUpdate?.(updated);
    }
  };

  return (
    <div className="space-y-3">
      {/* Add Block Button */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="w-full py-2 px-3 border-2 border-dashed border-[#ff7900] rounded-lg text-[#ff7900] hover:bg-[#ff7900]/5 transition font-medium text-sm flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Add Block
        </button>

        {showAddMenu && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1 z-10">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.type}
                onClick={() => handleAddBlock(bt.type)}
                className="p-2 rounded hover:bg-slate-100 text-center text-xs font-medium transition"
                title={bt.label}
              >
                <div className="text-lg">{bt.icon}</div>
                <div className="text-xs text-slate-600">{bt.label}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Blocks List */}
      <div className="space-y-2">
        {localBlocks.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm">No blocks yet. Add one to get started!</p>
          </div>
        ) : (
          localBlocks.map((block, idx) => {
            const blockType = BLOCK_TYPES.find((bt) => bt.type === block.type);
            const isEditing = editingId === block.id;

            return (
              <div
                key={block.id}
                className="border border-slate-200 rounded-lg bg-white overflow-hidden"
              >
                {/* Block Header */}
                <div
                  className="flex items-center justify-between gap-3 p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => setEditingId(isEditing ? null : block.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <GripVertical size={14} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {blockType?.label || block.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateBlock(block.id);
                      }}
                      className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition"
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBlock(block.id);
                      }}
                      className="p-1.5 rounded hover:bg-rose-100 text-rose-600 transition"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition ${isEditing ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Block Editor (Collapsed by default) */}
                {isEditing && (
                  <div className="p-3 border-t border-slate-200 space-y-2">
                    <BlockEditor
                      block={block}
                      onChange={(updated) => handleUpdateBlock(block.id, updated)}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Auto-save Status */}
      {saving && (
        <div className="text-xs text-amber-600 flex items-center gap-1">
          <Loader size={12} className="animate-spin" />
          Auto-saving...
        </div>
      )}
    </div>
  );
}
