/**
 * Report Template contract.
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 5 (Template Data Model / Configuration)
 *
 * This file has no runtime code — it exists to write down, in one place, the
 * exact prop shape every termly-report template component receives. Today
 * only `TermlyReportTemplate.jsx` implements it (assembled ad-hoc inline in
 * `TermlyReport.jsx`); every template added in Phase 6 must match this same
 * shape so `registry.js` can swap components without each one reinventing
 * its own branding-merge logic.
 *
 * Source of truth for the two halves this type combines:
 *   - Academic data: `TermlyReportData` in `server/src/services/report.service.ts`
 *     (the brief §15 "ReportData contract" — untouched by the eReport
 *     engine project, per checklist §2.1).
 *   - Branding: the four `School` fields already read by
 *     `src/utils/brandingUtils.js`'s `getSchoolBranding()`, plus the
 *     `user.school` fallbacks `TermlyReport.jsx` already applies today.
 *
 * @typedef {Object} ReportTemplateBranding
 * @property {string} [schoolName]
 * @property {string} [schoolAddress]
 * @property {string} [schoolPhone]
 * @property {string} [schoolEmail]
 * @property {string} [logoUrl]
 * @property {string} [schoolStamp]
 * @property {string} [brandColor]     - hex; templates should fall back to a
 *                                        sane default when absent, the way
 *                                        TermlyReportTemplate.jsx does today.
 *
 * @typedef {Object} ReportTemplateProps
 * @property {Object} reportData
 *   The exact object `TermlyReport.jsx` builds today: the backend's
 *   `TermlyReportData` (see `server/src/services/report.service.ts`) spread
 *   with the `ReportTemplateBranding` fields above. Every template
 *   component's top-level prop is this one object — do not add sibling
 *   props for branding; keep everything reachable off `reportData` so
 *   templates stay drop-in interchangeable.
 * @property {string} [id]
 *   DOM id `simplePdfGenerator.js` captures via html2canvas (ER-006). Each
 *   template must render its own root element with this id, and must
 *   itself render the letterhead/branding inline (the PDF engine no longer
 *   injects one — see checklist ER-006 "Update (2026-09-15)").
 */

// No exports — JSDoc-only contract file, consumed by editor tooling and by
// this checklist's Phase 6 authors as documentation, not imported at runtime.
export {};
