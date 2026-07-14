/**
 * pathwayPlanPDF.js
 *
 * Generates a PDF "Pathway and School Plan" for a learner.
 *
 * Sections:
 *   1. School header (branding, logo, stamp)
 *   2. Learner info (name, admission no., grade)
 *   3. Recommended pathway + confidence + justification
 *   4. Subject combination (pathway → track → subjects)
 *   5. Career suggestions
 *   6. School shortlist (ranked)
 *   7. Counsellor notes (if any)
 *   8. Footer (page numbers, official document notice)
 *
 * Usage:
 *   import { generatePathwayPlanPDF } from '../../../utils/pathwayPlanPDF';
 *   await generatePathwayPlanPDF({ learner, recommendation, selection, careers,
 *                                  schoolPreferences, counsellorNotes, brandingSettings });
 *
 * Phase 5, Pathway Planner.
 */

import { drawStandardHeader, getSchoolBranding, hexToRgb } from './brandingUtils';

const M = 14;          // page margin mm
const PW = 210;        // A4 width mm
const UW = PW - M * 2; // usable width

function addPageIfNeeded(doc, y, needed = 20) {
  if (y + needed > 282) {
    doc.addPage();
    return M + 4;
  }
  return y;
}

function sectionHeader(doc, text, y, accent) {
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(M, y, UW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(text.toUpperCase(), M + 3, y + 5);
  doc.setTextColor(31, 41, 55);
  return y + 10;
}

function bodyText(doc, text, y, maxWidth = UW - 4, lineHeight = 4.5) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  lines.forEach(line => {
    y = addPageIfNeeded(doc, y, lineHeight);
    doc.text(line, M + 2, y);
    y += lineHeight;
  });
  return y;
}

function labelValue(doc, label, value, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  doc.text(label, M + 2, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  doc.text(String(value || '—'), M + 40, y);
  return y + 5;
}

export async function generatePathwayPlanPDF({
  learner,
  recommendation,   // { predictedPathway, confidence, justification, careerRecommendations }
  selection,        // LearnerPathwaySelection with pathway, track, combinationRule, items
  schoolPreferences, // [{ rank, school: { name, county, schoolType, gender, category } }]
  counsellorNotes,  // [{ noteType, note, author: { firstName, lastName } }]
  brandingSettings,
}) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  // ── Branding ──────────────────────────────────────────────────────────────
  const fallback = getSchoolBranding();
  const brand = {
    name:       brandingSettings?.schoolName || fallback.name,
    phone:      brandingSettings?.phone      || fallback.phone,
    email:      brandingSettings?.email      || fallback.email,
    address:    brandingSettings?.address    || fallback.address,
    motto:      brandingSettings?.motto      || fallback.motto,
    logo:       brandingSettings?.logoUrl    || fallback.logo,
    brandColor: brandingSettings?.brandColor || fallback.brandColor || '#1a3668',
  };
  const accent = hexToRgb(brand.brandColor);

  // ── Page 1 header ─────────────────────────────────────────────────────────
  let y = await drawStandardHeader(doc, brand, {
    type: 'PATHWAY & SCHOOL PLAN',
    ref: `PP-${learner?.admissionNumber || 'LEARNER'}-${new Date().toISOString().slice(0, 10)}`,
  });

  // Divider
  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(0.8);
  doc.line(M, y - 2, PW - M, y - 2);

  // Document title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('Student Pathway & School Selection Plan', M, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, M, y + 10);
  y += 15;

  // ── Section 1: Learner ────────────────────────────────────────────────────
  y = sectionHeader(doc, '1. Learner Information', y, accent);
  y = labelValue(doc, 'Name',             `${learner?.firstName || ''} ${learner?.lastName || ''}`.trim(), y);
  y = labelValue(doc, 'Admission No.',    learner?.admissionNumber, y);
  y = labelValue(doc, 'Grade',            String(learner?.grade || '').replace('GRADE_','Grade ').replace('GRADE','Grade '), y);
  y = labelValue(doc, 'Institution Type', learner?.institutionType || '—', y);
  y += 3;

  // ── Section 2: Recommendation ─────────────────────────────────────────────
  y = addPageIfNeeded(doc, y, 30);
  y = sectionHeader(doc, '2. Pathway Recommendation', y, accent);

  if (recommendation?.predictedPathway && recommendation.predictedPathway !== 'Analysis Pending') {
    y = labelValue(doc, 'Recommended Pathway', recommendation.predictedPathway, y);
    y = labelValue(doc, 'Confidence Score',    `${recommendation.confidence ?? 0}%`, y);

    if (recommendation.justification) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(75, 85, 99);
      doc.text('Justification:', M + 2, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      y = bodyText(doc, recommendation.justification, y);
    }

    if (recommendation.clusterBreakdown) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Subject Cluster Scores:', M + 2, y); y += 4.5;
      const bd = recommendation.clusterBreakdown;
      [['STEM', bd.STEM], ['Social Sciences', bd.Social], ['Arts & Sports', bd.Arts]].forEach(([label, score]) => {
        y = addPageIfNeeded(doc, y, 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`${label}: ${score ?? 0}%`, M + 6, y);
        // Mini bar
        const barW = Math.min((score ?? 0) / 100 * 60, 60);
        doc.setFillColor(accent.r, accent.g, accent.b);
        doc.rect(M + 50, y - 3, barW, 2.5, 'F');
        y += 4.5;
      });
    }
  } else {
    y = bodyText(doc, 'No recommendation generated yet — enter summative results to unlock pathway analysis.', y);
  }
  y += 3;

  // ── Section 3: Subject Combination ───────────────────────────────────────
  y = addPageIfNeeded(doc, y, 30);
  y = sectionHeader(doc, '3. Subject Combination', y, accent);

  if (selection?.pathway) {
    y = labelValue(doc, 'Pathway', selection.pathway.name, y);
    if (selection.track) y = labelValue(doc, 'Track', selection.track.name, y);
    if (selection.combinationRule) y = labelValue(doc, 'Combination', selection.combinationRule.name, y);
    y = labelValue(doc, 'Status', selection.status || '—', y);

    if (selection.items?.length > 0) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Subjects:', M + 2, y); y += 4.5;

      // Table header
      doc.setFillColor(245, 247, 250);
      doc.rect(M, y - 3.5, UW, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('#',       M + 2, y);
      doc.text('Subject', M + 10, y);
      doc.text('Type',    M + 120, y);
      y += 5;

      selection.items.forEach((item, idx) => {
        y = addPageIfNeeded(doc, y, 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        if (idx % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(M, y - 3.5, UW, 5.5, 'F'); }
        doc.text(String(idx + 1),                                          M + 2,   y);
        doc.text(item.officialLearningArea?.officialName || '—',           M + 10,  y);
        doc.text(item.officialLearningArea?.subjectType?.replace(/_/g,' ') || '', M + 120, y);
        y += 5.5;
      });
    }
  } else {
    y = bodyText(doc, 'No subject combination selected yet.', y);
  }
  y += 3;

  // ── Section 4: Career Suggestions ────────────────────────────────────────
  const careers = recommendation?.careerRecommendations || [];
  if (careers.length > 0) {
    y = addPageIfNeeded(doc, y, 20);
    y = sectionHeader(doc, '4. Career Suggestions', y, accent);
    careers.forEach((c, i) => {
      y = addPageIfNeeded(doc, y, 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${i + 1}.  ${c}`, M + 4, y);
      y += 5;
    });
    y += 3;
  }

  // ── Section 5: School Shortlist ───────────────────────────────────────────
  const prefs = (schoolPreferences || []).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  y = addPageIfNeeded(doc, y, 20);
  y = sectionHeader(doc, prefs.length > 0 ? '5. School Shortlist' : '5. School Shortlist (none selected)', y, accent);

  if (prefs.length === 0) {
    y = bodyText(doc, 'No schools added to shortlist yet.', y);
  } else {
    // Table header
    doc.setFillColor(245, 247, 250);
    doc.rect(M, y - 3.5, UW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('#',       M + 2,  y);
    doc.text('School',  M + 10, y);
    doc.text('County',  M + 100, y);
    doc.text('Type',    M + 140, y);
    y += 5;

    prefs.forEach((pref, idx) => {
      const s = pref.school || pref;
      y = addPageIfNeeded(doc, y, 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      if (idx % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(M, y - 3.5, UW, 5.5, 'F'); }
      doc.text(String(pref.rank ?? idx + 1),                      M + 2,   y);
      doc.text(String(s.name || '—').substring(0, 40),            M + 10,  y);
      doc.text(String(s.county || '—'),                           M + 100, y);
      doc.text(String(s.schoolType || '—').replace(/_/g, ' '),    M + 140, y);
      y += 5.5;
    });
  }
  y += 3;

  // ── Section 6: Counsellor Notes ───────────────────────────────────────────
  const notes = counsellorNotes || [];
  if (notes.length > 0) {
    y = addPageIfNeeded(doc, y, 20);
    y = sectionHeader(doc, '6. Counsellor Notes', y, accent);
    notes.forEach(note => {
      y = addPageIfNeeded(doc, y, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      const author = note.author ? `${note.author.firstName} ${note.author.lastName}` : 'Counsellor';
      doc.text(`${note.noteType} — ${author}`, M + 2, y);
      y += 4;
      doc.setTextColor(31, 41, 55);
      y = bodyText(doc, note.note, y);
      y += 2;
    });
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 220, 220);
    doc.line(M, 290, PW - M, 290);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`${brand.name} • Confidential Student Document`, M, 294);
    doc.text(`Page ${p} of ${pageCount}`, PW - M, 294, { align: 'right' });
  }

  const safeName = String(learner?.firstName || 'Learner').replace(/\s+/g, '_');
  doc.save(`Pathway_Plan_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
