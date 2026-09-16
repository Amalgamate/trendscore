/**
 * Report Template registry.
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 5 (Template Data Model / Configuration)
 *
 * Maps a `Template.key` (Prisma — checklist §2.2) to the React component
 * that renders it, per Decision D2: templates are hand-built components,
 * not JSON layouts, selected by a DB pointer. This is the one file that
 * needs a new line when Phase 6 ships an additional design — nothing else
 * in the report-viewing pages should need to change.
 *
 * `classic` is registered against the existing `TermlyReportTemplate.jsx`
 * (the current "CORPORATE EDITION" design, today's only template) rather
 * than a new component. This is deliberate, not a placeholder: it gives the
 * NEW engine (Phase 4) a real, valid `Template` row to point a school at
 * immediately — seed it via `reportTemplate.service.ts`'s `upsertTemplate`
 * — with zero visual change, before Phase 6 adds any second design.
 */

import TermlyReportTemplate from '../TermlyReportTemplate';
import ModernReportTemplate from './ModernReportTemplate';

export const REPORT_TEMPLATE_REGISTRY = {
  classic: TermlyReportTemplate,
  modern: ModernReportTemplate,
};

export const DEFAULT_REPORT_TEMPLATE_KEY = 'classic';

/**
 * Resolve a `Template.key` to its component. Falls back to the default
 * (`classic`) for an unknown/blank key — e.g. a school on the NEW engine
 * that hasn't picked a template yet, or a key whose component was removed
 * — rather than throwing and breaking report generation. Mirrors
 * `reportEngine.service.ts`'s own "missing template → still return data"
 * fallback philosophy (checklist §4, point 2).
 *
 * KNOWN LIMITATION (not yet built): this resolves by `key` only, not
 * `key@version`. `ReportSnapshot.templateVersion` is captured precisely so
 * a historical report could be reproduced exactly even after its template
 * changes (Decision D3's stated purpose) — but there is currently no
 * version dimension in this registry to make that true. If a registered
 * component is edited and its `Template.version` bumped, every existing
 * snapshot that recorded an older version will render through the *current*
 * component, not the one that actually produced it at generation time.
 * `templateVersion` is stored correctly; it just isn't honoured on the read
 * path yet. Fixing this properly means keying the registry on `key@version`
 * and retaining prior component versions rather than overwriting them —
 * out of scope for now; flagging so this isn't mistaken for already working.
 *
 * @param {string | null | undefined} key
 * @returns {React.ComponentType<import('./types').ReportTemplateProps>}
 */
export function resolveReportTemplateComponent(key) {
  if (key && REPORT_TEMPLATE_REGISTRY[key]) {
    return REPORT_TEMPLATE_REGISTRY[key];
  }
  return REPORT_TEMPLATE_REGISTRY[DEFAULT_REPORT_TEMPLATE_KEY];
}
