/**
 * patch_pdf_rendering.js  —  OBSOLETE — DO NOT RUN
 * ─────────────────────────────────────────────────────────────────────────────
 * All fixes from this patch have been permanently applied to SummativeReport.jsx
 * and the PDF engine has been fully rewritten in simplePdfGenerator.js.
 * This script is kept for historical reference only. All patterns it targeted
 * no longer exist in the codebase, so running it will skip all fixes safely.
 * ─────────────────────────────────────────────────────────────────────────────
 * Run once from the project root:
 *   node patch_pdf_rendering.js
 *
 * Fixes five PDF-rendering bugs in SummativeReport.jsx that cause the
 * printed/downloaded report to be misaligned, overlapping, or clipped:
 *
 *  FIX 1 — Hidden capture container: opacity:0 → visibility:hidden
 *           html2canvas silently fails on opacity:0 elements, producing a blank
 *           or misaligned canvas. visibility:hidden keeps the element laid out
 *           in the DOM so html2canvas can measure it, while hiding it from users.
 *           Also changes overflow:hidden → overflow:visible so nothing is clipped.
 *
 *  FIX 2 — onclone(): preserve flex layout instead of overriding with block
 *           LearnerReportTemplate root is display:flex/column. The old onclone()
 *           set display:'block', scrambling every child and causing the student
 *           name / stat boxes to overlap. Also removes the hard height:1123px
 *           from the inner .report-card so subjects are never clipped.
 *
 *  FIX 3 — Score column min-widths in the subject table headers
 *           Without min-width, OPENER/MIDTERM/END TERM columns collapse at 3×
 *           canvas scale, causing score text to overflow into the grade column.
 *
 *  FIX 4 — report-card root: add minHeight alongside height
 *           Learners with many subjects need the card to be at least 1123px tall.
 *           Keeping height:1123px for canvas sizing while adding minHeight lets
 *           html2canvas capture everything without clipping the footer.
 *
 *  FIX 5 — Bulk page wrapper: overflow:hidden → overflow:visible
 *           Each .pdf-report-page wrapper had overflow:hidden, which clipped the
 *           bottom of any card whose content slightly exceeded 1123px (e.g.
 *           learners with many subjects or long school names).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  'src', 'components', 'CBCGrading', 'pages', 'SummativeReport.jsx'
);

let src = fs.readFileSync(filePath, 'utf8');
let changeCount = 0;

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1  Hidden capture container: opacity:0 → visibility:hidden
// ─────────────────────────────────────────────────────────────────────────────

const OLD_CAPTURE_CONTAINER =
  `      <div style={{ position: 'fixed', top: 0, left: 0, width: '794px', height: '1123px', opacity: 0, pointerEvents: 'none', zIndex: -100, overflow: 'hidden' }}>`;

const NEW_CAPTURE_CONTAINER =
  `      {/* NOTE: visibility:hidden (NOT opacity:0) is required here.
           html2canvas fails silently on opacity:0 and renders a blank/misaligned
           canvas. visibility:hidden keeps the element in the layout tree so
           html2canvas can read it, while remaining invisible to the user. */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '794px', height: '1123px', visibility: 'hidden', pointerEvents: 'none', zIndex: -100, overflow: 'visible' }}>`;

if (src.includes(OLD_CAPTURE_CONTAINER)) {
  src = src.replace(OLD_CAPTURE_CONTAINER, NEW_CAPTURE_CONTAINER);
  console.log('✅ Fix 1 applied: opacity:0 → visibility:hidden, overflow:hidden → visible on capture wrapper');
  changeCount++;
} else {
  console.warn('⚠️  Fix 1 SKIPPED: capture container not found (already patched?)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2  onclone(): preserve flex layout + relax inner .report-card height
// ─────────────────────────────────────────────────────────────────────────────

const OLD_ONCLONE =
`        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById(elementId);
          if (el) {
            el.style.width = '794px';
            el.style.height = '1123px';
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
            el.style.position = 'relative';
            el.style.left = '0';
          }
        }`;

const NEW_ONCLONE =
`        onclone: (clonedDoc) => {
          // CRITICAL FIX: LearnerReportTemplate root is display:flex/column.
          // Setting display:'block' here breaks all child alignment and causes
          // the student name, grade boxes, and subject rows to overlap.
          const el = clonedDoc.getElementById(elementId);
          if (el) {
            el.style.width = '794px';
            el.style.minHeight = '1123px';
            el.style.height = 'auto';           // let content breathe — no hard clip
            el.style.display = 'flex';          // MUST be flex, never block
            el.style.flexDirection = 'column';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
            el.style.position = 'relative';
            el.style.left = '0';
            el.style.overflow = 'visible';
          }
          // Relax the inner .report-card fixed height so learners with
          // more subjects than average are never clipped at the bottom.
          const inner = el?.querySelector('.report-card');
          if (inner) {
            inner.style.minHeight = '1123px';
            inner.style.height = 'auto';
            inner.style.overflow = 'visible';
          }
        }`;

if (src.includes(OLD_ONCLONE)) {
  src = src.replace(OLD_ONCLONE, NEW_ONCLONE);
  console.log('✅ Fix 2 applied: onclone() now preserves flex layout and removes height clipping');
  changeCount++;
} else {
  console.warn('⚠️  Fix 2 SKIPPED: onclone block not found (already patched?)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3  Score column min-widths in the subject table
// ─────────────────────────────────────────────────────────────────────────────

const OLD_TH_TESTCOLS =
`              {testColumns.map(col => (
                <th key={col} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)' }}>
                  {formatTestName(col)}
                </th>
              ))}
              {testColumns.length > 1 && (
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)' }}>AVG %</th>
              )}
              <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)' }}>GRADE</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)' }}>PTS</th>`;

const NEW_TH_TESTCOLS =
`              {testColumns.map(col => (
                <th key={col} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)', minWidth: '64px', whiteSpace: 'nowrap' }}>
                  {formatTestName(col)}
                </th>
              ))}
              {testColumns.length > 1 && (
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)', minWidth: '52px' }}>AVG %</th>
              )}
              <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)', minWidth: '52px' }}>GRADE</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)', minWidth: '36px' }}>PTS</th>`;

if (src.includes(OLD_TH_TESTCOLS)) {
  src = src.replace(OLD_TH_TESTCOLS, NEW_TH_TESTCOLS);
  console.log('✅ Fix 3 applied: minWidth added to test-column <th> elements');
  changeCount++;
} else {
  console.warn('⚠️  Fix 3 SKIPPED: table header block not found (already patched?)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4  report-card root: add minHeight alongside the fixed height
// ─────────────────────────────────────────────────────────────────────────────

const OLD_CARD_STYLE =
`        height: '1123px', // 297mm at 96 DPI
        padding: '30px 40px 60px 40px',`;

const NEW_CARD_STYLE =
`        minHeight: '1123px', // ensure card is never shorter than A4
        height: '1123px',    // 297mm at 96 DPI — kept for canvas crop boundary
        padding: '30px 40px 30px 40px',`;

if (src.includes(OLD_CARD_STYLE)) {
  src = src.replace(OLD_CARD_STYLE, NEW_CARD_STYLE);
  console.log('✅ Fix 4 applied: minHeight:1123px added to .report-card root');
  changeCount++;
} else {
  console.warn('⚠️  Fix 4 SKIPPED: report-card style block not found (already patched?)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5  Bulk page wrapper: overflow:hidden → overflow:visible
// ─────────────────────────────────────────────────────────────────────────────

const OLD_BULK_PAGE_WRAPPER =
  `              <div key={idx} className="pdf-report-page" style={{ width: '794px', height: '1123px', overflow: 'hidden', backgroundColor: '#fff' }}>`;

const NEW_BULK_PAGE_WRAPPER =
  `              <div key={idx} className="pdf-report-page" style={{ width: '794px', height: '1123px', overflow: 'visible', backgroundColor: '#fff' }}>`;

if (src.includes(OLD_BULK_PAGE_WRAPPER)) {
  src = src.replace(OLD_BULK_PAGE_WRAPPER, NEW_BULK_PAGE_WRAPPER);
  console.log('✅ Fix 5 applied: bulk page wrapper overflow:hidden → overflow:visible');
  changeCount++;
} else {
  console.warn('⚠️  Fix 5 SKIPPED: bulk page wrapper not found (already patched?)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Write result
// ─────────────────────────────────────────────────────────────────────────────

if (changeCount > 0) {
  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`\n✅ ${changeCount} of 5 fix(es) applied. SummativeReport.jsx saved.`);
  console.log('\nNext steps:');
  console.log('  1. npm run dev   (restart dev server so Vite re-bundles)');
  console.log('  2. Open Learner Sheet, generate a report, then Download PDF.');
  console.log('  3. The PDF should now match the on-screen preview 1:1.');
} else {
  console.log('\nℹ️  No changes written — all fixes may already be applied.');
}
