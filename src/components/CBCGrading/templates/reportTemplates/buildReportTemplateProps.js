/**
 * buildReportTemplateProps
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 5 (Template Data Model / Configuration)
 *
 * Single source of truth for turning (backend reportData, user, brandingSettings)
 * into the `reportData` prop every template in `registry.js` expects (see
 * `types.js`). This is a straight extraction of the merge `TermlyReport.jsx`
 * already performs inline today — moved here, not changed — so:
 *   - `ParentReportCards.jsx` and any Phase-6 template-preview screen build
 *     the exact same prop shape without copy-pasting the field list, and
 *   - the branding precedence (explicit school record first, brandingSettings
 *     second, reportData's own carried-over value last) stays defined in one
 *     place instead of drifting between call sites.
 *
 * Deliberately NOT wired into TermlyReport.jsx in this phase — that page's
 * existing inline spread already produces an identical object, so leaving it
 * untouched keeps this an additive, zero-risk change (brief §13/§36). Phase 6
 * (once a second real template exists to preview) is the natural point to
 * switch TermlyReport.jsx over to calling this helper + `registry.js`
 * instead of importing `TermlyReportTemplate` directly.
 *
 * @param {import('../../../../services/api/report.api').TermlyReportData} reportData
 * @param {{ user?: any, brandingSettings?: any }} [context]
 * @returns {Object} the merged object to pass as `reportData` to a template component
 */
export function buildReportTemplateProps(reportData, { user, brandingSettings } = {}) {
  return {
    ...reportData,
    schoolName: user?.school?.name || brandingSettings?.schoolName,
    schoolAddress: user?.school?.location || brandingSettings?.address,
    schoolPhone: user?.school?.phone || brandingSettings?.phone,
    schoolEmail: user?.school?.email || brandingSettings?.email,
    logoUrl: user?.school?.logo || brandingSettings?.logoUrl,
    schoolStamp: user?.school?.stampUrl || brandingSettings?.stampUrl,
    brandColor: brandingSettings?.brandColor || reportData?.brandColor,
  };
}
