/**
 * patch_header_spacing.js  —  OBSOLETE — DO NOT RUN
 * All fixes permanently applied. Kept for historical reference only.
 * ─────────────────────────────────────────────────────────────────────────────
 * Run once from the project root:
 *   node patch_header_spacing.js
 *
 * Improves the report card header section:
 *  - School name: extra bold (WebkitTextStroke bumped to 1.8px)
 *  - Separator line: tighter top margin so it hugs the school name
 *  - "SUMMATIVE ASSESSMENT REPORT" title: reduced top padding so it
 *    sits closer to the line above, but has breathing room below
 *  - Term/year pill badge: consistent spacing below it before the student card
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
// FIX A — School name: extra bold
// ─────────────────────────────────────────────────────────────────────────────
const OLD_SCHOOL_NAME_H1 =
`        {/* School Info */}
        <h1 style={{ 
          fontSize: '38px', 
          fontWeight: '950', 
          color: brandingSettings?.brandColor || '#1E3A8A', 
          margin: '0 0 2px 0', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px',
          lineHeight: '1.0',
          WebkitTextStroke: '1.4px ' + (brandingSettings?.brandColor || '#1E3A8A') // Extreme bold
        }}>`;

const NEW_SCHOOL_NAME_H1 =
`        {/* School Info */}
        <h1 style={{ 
          fontSize: '38px', 
          fontWeight: '950', 
          color: brandingSettings?.brandColor || '#1E3A8A', 
          margin: '0 0 0px 0', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px',
          lineHeight: '1.0',
          WebkitTextStroke: '1.8px ' + (brandingSettings?.brandColor || '#1E3A8A') // Maximum bold
        }}>`;

if (src.includes(OLD_SCHOOL_NAME_H1)) {
  src = src.replace(OLD_SCHOOL_NAME_H1, NEW_SCHOOL_NAME_H1);
  console.log('✅ Fix A applied: school name WebkitTextStroke → 1.8px (extra bold)');
  changeCount++;
} else {
  console.warn('⚠️  Fix A SKIPPED: school name h1 block not found (already patched?)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX B — Separator line: tighter spacing above and below
// ─────────────────────────────────────────────────────────────────────────────
const OLD_SEPARATOR =
`        {/* Separator Line */}
        <div style={{ width: '100%', height: '3px', backgroundColor: brandingSettings?.brandColor || '#1e3a8a', marginTop: '16px', marginBottom: '12px' }}></div>

        {/* Report Title */}
        <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#000', margin: '4px 0 6px 0', textTransform: 'uppercase', letterSpacing: '4px', paddingTop: '10px' }}>
          Summative Assessment Report
        </h2>

        {/* Exam Name / Termly Details */}
        <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: '700', color: '#1E3A8A', marginTop: '10px', marginBottom: '8px', textTransform: 'uppercase', backgroundColor: '#eff6ff', padding: '4px 16px', borderRadius: '40px', border: '1px solid #dbeafe' }}>`;

const NEW_SEPARATOR =
`        {/* Separator Line */}
        <div style={{ width: '100%', height: '3px', backgroundColor: brandingSettings?.brandColor || '#1e3a8a', marginTop: '10px', marginBottom: '0px' }}></div>

        {/* Report Title */}
        <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#000', margin: '10px 0 4px 0', textTransform: 'uppercase', letterSpacing: '4px' }}>
          Summative Assessment Report
        </h2>

        {/* Exam Name / Termly Details */}
        <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: '700', color: '#1E3A8A', marginTop: '6px', marginBottom: '6px', textTransform: 'uppercase', backgroundColor: '#eff6ff', padding: '4px 16px', borderRadius: '40px', border: '1px solid #dbeafe' }}>`;

if (src.includes(OLD_SEPARATOR)) {
  src = src.replace(OLD_SEPARATOR, NEW_SEPARATOR);
  console.log('✅ Fix B applied: header spacing tightened — separator, title and pill margins adjusted');
  changeCount++;
} else {
  console.warn('⚠️  Fix B SKIPPED: separator block not found (already patched?)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX C — Outer header wrapper: tighten mb (was mb-4) and logo mb (was mb-2)
// ─────────────────────────────────────────────────────────────────────────────
const OLD_HEADER_WRAPPER =
`      {/* Header Section - Centered Professional Redesign */}
      <div className="mb-4" style={{ textAlign: 'center' }}>
        {/* Logo Middle */}
        <div className="mb-2">`;

const NEW_HEADER_WRAPPER =
`      {/* Header Section - Centered Professional Redesign */}
      <div className="mb-3" style={{ textAlign: 'center' }}>
        {/* Logo Middle */}
        <div className="mb-1">`;

if (src.includes(OLD_HEADER_WRAPPER)) {
  src = src.replace(OLD_HEADER_WRAPPER, NEW_HEADER_WRAPPER);
  console.log('✅ Fix C applied: header outer wrapper mb reduced (mb-4 → mb-3, logo mb-2 → mb-1)');
  changeCount++;
} else {
  console.warn('⚠️  Fix C SKIPPED: header wrapper not found (already patched?)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Write result
// ─────────────────────────────────────────────────────────────────────────────

if (changeCount > 0) {
  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`\n✅ ${changeCount} of 3 fix(es) applied. SummativeReport.jsx saved.`);
  console.log('\nNext steps:');
  console.log('  1. npm run dev   (hard refresh if already running)');
  console.log('  2. Preview the report — the heading should now be extra bold');
  console.log('     with tighter, well-balanced spacing throughout the header.');
} else {
  console.log('\nℹ️  No changes written — all fixes may already be applied.');
}
