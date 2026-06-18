/**
 * RequestMetadataPanel
 * Renders module-specific metadata fields for an approval request.
 * For SCORE_UNLOCK: shows structured labeled fields.
 * For all other types: generic key-value fallback.
 */

import React from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a key string from camelCase or SNAKE_CASE to "Title Case With Spaces".
 */
function formatKey(key = '') {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Safe string coercion for a metadata value.
 */
function displayValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ── Sub-renderers ─────────────────────────────────────────────────────────────

/**
 * Labeled field row used in structured panels.
 */
function MetaField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-800 break-words">
        {value ?? '—'}
      </span>
    </div>
  );
}

/**
 * Structured panel for SCORE_UNLOCK metadata.
 * Fields: Class, Subject, Assessment ID, Assessment Type, Term, Academic Year.
 */
function ScoreUnlockMetadataPanel({ metadata }) {
  const {
    classId,
    subjectId,
    assessmentId,
    assessmentType,
    term,
    academicYear,
    teacherId,
  } = metadata ?? {};

  // Format term for display — "TERM_1" → "Term 1"
  const formattedTerm = term
    ? String(term).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';

  // Format assessment type — "summative" → "Summative"
  const formattedAssessmentType = assessmentType
    ? String(assessmentType).replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
      <MetaField label="Class"            value={classId} />
      <MetaField label="Subject"          value={subjectId} />
      <MetaField label="Assessment ID"    value={assessmentId} />
      <MetaField label="Assessment Type"  value={formattedAssessmentType} />
      <MetaField label="Term"             value={formattedTerm} />
      <MetaField label="Academic Year"    value={academicYear} />
      {teacherId && <MetaField label="Teacher ID" value={teacherId} />}
    </div>
  );
}

/**
 * Generic key-value fallback for unknown request types.
 */
function GenericMetadataPanel({ metadata }) {
  if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
    return <p className="text-xs text-gray-400 italic">No additional metadata.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
      {Object.entries(metadata).map(([key, value]) => (
        <MetaField
          key={key}
          label={formatKey(key)}
          value={displayValue(value)}
        />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   requestType: string,
 *   metadata: object,
 * }} props
 */
export function RequestMetadataPanel({ requestType, metadata }) {
  const type = String(requestType ?? '').toUpperCase();

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
      <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
        Request Details
      </h4>

      {type === 'SCORE_UNLOCK' ? (
        <ScoreUnlockMetadataPanel metadata={metadata} />
      ) : (
        <GenericMetadataPanel metadata={metadata} />
      )}
    </div>
  );
}

export default RequestMetadataPanel;
